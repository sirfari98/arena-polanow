'use strict';
const path=require('node:path');
const crypto=require('node:crypto');
const http=require('node:http');
const express=require('express');
const {Server}=require('socket.io');
const {validateHero,startBattle,publicBattle,act,chooseAIAction,DEFAULT_AI}=require('./engine');
if(process.env.RENDER==='true'&&!process.env.DATABASE_URL)throw Error('DATABASE_URL jest wymagany na Render.');
const store=process.env.DATABASE_URL?require('./database-pg'):require('./database');
const app=express();app.disable('x-powered-by');app.set('trust proxy',process.env.TRUST_PROXY==='1'?1:false);
app.use((req,res,next)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
 res.setHeader('X-Frame-Options','DENY');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
 if(process.env.NODE_ENV==='production'&&req.secure)res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
 next();
});
app.use(express.json({limit:'12kb'}));
// Limity po stronie serwera (na jeden proces, dla wdrożenia z pojedynczą instancją).
const limits=new Map();
function limit(windowMs,max){return (req,res,next)=>{
 const key=(req.ip||req.socket.remoteAddress||'unknown')+':'+req.path,now=Date.now();
 let record=limits.get(key);if(!record||now>=record.until){record={count:0,until:now+windowMs};limits.set(key,record);}
 if(++record.count>max){res.setHeader('Retry-After',Math.ceil((record.until-now)/1000));return res.status(429).json({ok:false,error:'Zbyt wiele prób. Spróbuj ponownie później.'});}
 next();
};}
setInterval(()=>{const now=Date.now();for(const [k,v] of limits)if(v.until<=now)limits.delete(k);},60000).unref();

app.use(express.static(path.join(__dirname,'public')));
// Obsługa obu układów plików: public/* lub pliki HTML/CSS/JS w katalogu głównym.
const fs=require('node:fs');
const webFile=name=>path.join(__dirname,fs.existsSync(path.join(__dirname,'public',name))?'public':'',name);
for(const [route,file] of [['/','index.html'],['/style.css','style.css'],['/app.js','app.js']])
 app.get(route,(_req,res)=>res.sendFile(webFile(file)));
app.get('/health',async (_req,res)=>{
 try{ if(store.ping) await store.ping(); res.json({status:'ok',name:'Arena Polanów',version:'0.4.0',database:process.env.DATABASE_URL?'postgresql':'sqlite'});}
 catch(e){console.error('Health check: database unavailable:',e.message);res.status(503).json({status:'error',name:'Arena Polanów',database:'unavailable'});}
});
const failure=(res,e,status=400)=>res.status(status).json({ok:false,error:e.message||'Błąd serwera.'});
const wrap=fn=>async(req,res)=>{try{res.json({ok:true,...await fn(req)});}catch(e){failure(res,e);}};
app.post('/api/signup',limit(15*60000,5),wrap(async req=>{const auth=await store.signup(req.body?.username,req.body?.password);return {...auth,profile:await store.profile(auth.userId)};}));
app.post('/api/login',limit(15*60000,10),wrap(async req=>{const auth=await store.login(req.body?.username,req.body?.password);return {...auth,profile:await store.profile(auth.userId)};}));
async function authenticate(req,res,next){const token=(req.headers.authorization||'').replace(/^Bearer /,'');const id=await store.userByToken(token);if(!id)return failure(res,Error('Zaloguj się ponownie.'),401);req.userId=id;req.token=token;next();}
app.use('/api',authenticate);
app.get('/api/me',wrap(async req=>({profile:await store.profile(req.userId)})));
app.post('/api/logout',wrap(async req=>{await store.logout(req.token);for(const client of io.sockets.sockets.values())if(client.data.token===req.token){await detach(client);client.data.userId=null;client.data.token=null;client.emit('auth:revoked');}return {};}));
app.get('/api/shop',wrap(()=>({items:Object.entries(store.ITEMS).filter(([,v])=>v.price>0).map(([id,v])=>({id,...v}))})));
app.post('/api/shop/buy',limit(60000,35),wrap(async req=>({profile:await store.buy(req.userId,req.body?.itemId)})));
app.post('/api/equip',wrap(async req=>({profile:await store.equip(req.userId,req.body?.itemId)})));
app.get('/api/expeditions',wrap(()=>({zones:Object.entries(store.EXPEDITIONS).map(([id,v])=>({id,name:v.name,level:v.level,gold:v.gold,xp:v.xp}))})));
app.post('/api/expeditions/start',limit(60000,15),wrap(async req=>({result:await store.expedition(req.userId,req.body?.zoneId)})));
app.get('/api/ranking',wrap(async()=>({ranking:await store.ranking()})));
const server=http.createServer(app),io=new Server(server,{cors:{origin:false},maxHttpBufferSize:30000});
const rooms=new Map(),socketRooms=new Map();let queue=[];
const userInBattle=(userId,exceptSocket)=>[...socketRooms.keys()].some(id=>id!==exceptSocket&&io.sockets.sockets.get(id)?.data.userId===userId);
const cleanQueue=()=>{queue=queue.filter(id=>io.sockets.sockets.has(id)&&!socketRooms.has(id));};
const code=()=>crypto.randomBytes(5).toString('hex').slice(0,5).toUpperCase();
const reply=(ack,payload)=>{if(typeof ack==='function')ack(payload);};
function getRoom(socket){const roomId=socketRooms.get(socket.id);return roomId?rooms.get(roomId):null;}
async function emitProfile(userId){for(const client of io.sockets.sockets.values())if(client.data.userId===userId)client.emit('account:profile',await store.profile(userId));}
async function settle(room){if(!room.battle||room.battle.winner===null||room.settled)return;room.settled=true;
 for(const id of room.players){const s=io.sockets.sockets.get(id);if(!s?.data.userId)continue;const won=room.battle.winner===id;const gold=won?(room.mode==='pve'?50:65):10;const xp=won?(room.mode==='pve'?25:35):8;await store.addProgress(s.data.userId,gold,xp,won,room.mode,'Pojedynek na arenie');await emitProfile(s.data.userId);io.to(id).emit('game:reward',{gold,xp,won});}}
async function broadcast(room,event=null){if(room.battle?.winner!==null)await settle(room);for(const id of room.players)io.to(id).emit('game:state',{mode:room.mode,roomCode:room.code,playerId:id,opponentId:room.players.find(x=>x!==id)||'bot',battle:room.battle?publicBattle(room.battle):null,waiting:!room.battle,event});}
async function detach(socket){queue=queue.filter(id=>id!==socket.id);const room=getRoom(socket);if(!room)return;room.players=room.players.filter(id=>id!==socket.id);socketRooms.delete(socket.id);if(room.players.length){if(room.battle&&room.battle.winner===null){room.battle.winner=room.players[0];room.battle.log.push('Przeciwnik opuścił walkę. Wygrywasz walkowerem.');await broadcast(room);}else io.to(room.players[0]).emit('game:notice','Przeciwnik opuścił pokój.');}for(const id of room.players)socketRooms.delete(id);rooms.delete(room.code);}
function makeRoom(players,mode,codeValue){const c=codeValue||code();const room={code:c,players,mode,battle:null,settled:false,created:Date.now()};rooms.set(c,room);players.forEach(id=>socketRooms.set(id,c));return room;}
async function startPvP(room){if(room.players.length!==2)return;const [a,b]=room.players.map(id=>io.sockets.sockets.get(id));if(!a||!b||!a.data.hero||!b.data.hero)return;room.battle=startBattle(a.data.hero,b.data.hero,{leftId:a.id,rightId:b.id});await broadcast(room);}
function runAI(room){setTimeout(async()=>{if(rooms.get(room.code)!==room||!room.battle||room.battle.winner!==null)return;if(!room.battle.fighters[room.battle.turn].ai)return;const event=act(room.battle,'bot',chooseAIAction(room.battle));await broadcast(room,event);},750);}
io.on('connection',async socket=>{
 socket.data.token=socket.handshake.auth?.token||null;
 socket.data.userId=await store.userByToken(socket.data.token)||null;
 if(socket.data.userId){socket.data.hero=await store.getHero(socket.data.userId);socket.emit('account:profile',await store.profile(socket.data.userId));}
 socket.emit('game:notice',socket.data.userId?'Połączono z serwerem Areny Polanów.':'Zaloguj się, aby rozpocząć grę.');
 const guarded=handler=>async(data,ack)=>{if(!socket.data.userId||(await store.userByToken(socket.data.token))!==socket.data.userId){await detach(socket);socket.data.userId=null;return reply(ack,{ok:false,error:'Sesja wygasła. Zaloguj się ponownie.'});}try{await handler(data,ack);}catch(e){reply(ack,{ok:false,error:e.message});}};
 socket.on('auth:token',async(data,ack)=>{const id=await store.userByToken(data?.token);if(!id)return reply(ack,{ok:false,error:'Sesja wygasła.'});await detach(socket);socket.data.userId=id;socket.data.token=data.token;socket.data.hero=await store.getHero(id);reply(ack,{ok:true,profile:await store.profile(id)});});
 socket.on('hero:save',guarded(async(data,ack)=>{if(userInBattle(socket.data.userId,socket.id)||getRoom(socket)?.battle?.winner===null)return reply(ack,{ok:false,error:'Nie można zmieniać bohatera podczas walki.'});const p=await store.updateHero(socket.data.userId,data);socket.data.hero=validateHero(p.hero);reply(ack,{ok:true,hero:p.hero});await emitProfile(socket.data.userId);}));
 socket.on('game:pve',guarded(async(_data,ack)=>{if(userInBattle(socket.data.userId,socket.id))return reply(ack,{ok:false,error:'Twoje konto jest już na innej arenie.'});await detach(socket);socket.data.hero=await store.getHero(socket.data.userId);const room=makeRoom([socket.id],'pve');room.battle=startBattle(socket.data.hero,DEFAULT_AI,{leftId:socket.id,rightId:'bot',rightAI:true});reply(ack,{ok:true});await broadcast(room);if(room.battle.fighters[room.battle.turn].ai)runAI(room);}));
 socket.on('game:create',guarded(async(_data,ack)=>{if(userInBattle(socket.data.userId,socket.id))return reply(ack,{ok:false,error:'Twoje konto jest już na innej arenie.'});await detach(socket);socket.data.hero=await store.getHero(socket.data.userId);let c=code();while(rooms.has(c))c=code();const room=makeRoom([socket.id],'pvp',c);reply(ack,{ok:true,code:c});await broadcast(room);}));
 socket.on('game:join',guarded(async(data,ack)=>{const c=String(data?.code||'').trim().toUpperCase(),room=rooms.get(c);if(!room||room.mode!=='pvp'||room.players.length!==1||room.battle)return reply(ack,{ok:false,error:'Pokój nie istnieje albo jest pełny.'});if(userInBattle(socket.data.userId,socket.id))return reply(ack,{ok:false,error:'Twoje konto jest już na innej arenie.'});if(room.players[0]===socket.id)return reply(ack,{ok:false,error:'Już jesteś w pokoju.'});const rival=io.sockets.sockets.get(room.players[0]);if(rival?.data.userId===socket.data.userId)return reply(ack,{ok:false,error:'Nie można grać przeciw własnemu kontu.'});await detach(socket);socket.data.hero=await store.getHero(socket.data.userId);room.players.push(socket.id);socketRooms.set(socket.id,c);reply(ack,{ok:true,code:c});await startPvP(room);}));
 socket.on('game:match',guarded(async(_data,ack)=>{if(userInBattle(socket.data.userId,socket.id))return reply(ack,{ok:false,error:'Twoje konto jest już na innej arenie.'});await detach(socket);socket.data.hero=await store.getHero(socket.data.userId);cleanQueue();const idx=queue.findIndex(id=>io.sockets.sockets.get(id)?.data.userId!==socket.data.userId);if(idx>=0){const rival=queue.splice(idx,1)[0];const room=makeRoom([rival,socket.id],'pvp');reply(ack,{ok:true,found:true});await startPvP(room);}else{queue.push(socket.id);reply(ack,{ok:true,found:false});socket.emit('game:notice','Szukamy rywala…');}}));
 socket.on('game:action',guarded(async(data,ack)=>{const room=getRoom(socket);if(!room?.battle)return reply(ack,{ok:false,error:'Nie jesteś w aktywnej walce.'});const event=act(room.battle,socket.id,data?.action);reply(ack,{ok:true});await broadcast(room,event);if(room.mode==='pve'&&room.battle.winner===null&&room.battle.fighters[room.battle.turn].ai)runAI(room);}));
 socket.on('game:leave',guarded(async(_data,ack)=>{await detach(socket);reply(ack,{ok:true});socket.emit('game:state',{battle:null,waiting:false,mode:null});}));
 socket.on('disconnect',()=>{void detach(socket);});
});
const PORT=Number(process.env.PORT)||3000;
function shutdown(signal){console.log(`Zamykanie serwera (${signal})`);io.close(()=>{try{void store.db.close();}catch{}process.exit(0);});setTimeout(()=>process.exit(1),8000).unref();}
if(require.main===module){process.once('SIGTERM',()=>shutdown('SIGTERM'));process.once('SIGINT',()=>shutdown('SIGINT'));}

if(require.main===module)(async()=>{if(store.init)await store.init();server.listen(PORT,'0.0.0.0',()=>console.log(`Arena Polanów: http://localhost:${PORT}`));})().catch(e=>{console.error(e);process.exit(1);});
module.exports={app,server};

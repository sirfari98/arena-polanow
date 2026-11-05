'use strict';

const CLASSES = {
  warrior: { label:'Wojownik', hp:118, stamina:8, attack:13, defense:10, agility:7, color:'#cc9a53' },
  rogue: { label:'Łotr', hp:98, stamina:9, attack:14, defense:6, agility:13, color:'#62b3a2' },
  tank: { label:'Strażnik', hp:135, stamina:8, attack:10, defense:14, agility:5, color:'#81a5c0' }
};
const WEAPONS = {
  sword: { label:'Miecz legionisty', attack:7, agility:1 },
  axe: { label:'Topór bitewny', attack:11, agility:-2 },
  spear: { label:'Włócznia myśliwska', attack:5, agility:4 }
};
const ARMORS = {
  leather: { label:'Skórzany pancerz', defense:3, hp:0, agility:2 },
  chain: { label:'Kolczuga', defense:7, hp:6, agility:-1 },
  plate: { label:'Zbroja płytowa', defense:10, hp:13, agility:-4 }
};
const ACTIONS = {
  strike: { label:'Szybki atak', cost:0 },
  heavy: { label:'Potężne uderzenie', cost:3 },
  guard: { label:'Zasłona tarczą', cost:0 },
  skill: { label:'Cios specjalny', cost:5 }
};
const MAX_POINTS = 6;
const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
const toInt = v => Number.isFinite(Number(v)) ? Math.floor(Number(v)) : 0;
function validateHero(data) {
  if (!data || typeof data !== 'object') throw new Error('Brak danych postaci.');
  const name = String(data.name ?? '').trim().replace(/\s+/g,' ');
  if (name.length < 3 || name.length > 18 || !/^[\p{L}\p{N} _-]+$/u.test(name)) throw new Error('Imię musi mieć 3–18 znaków (litery, cyfry, spacja, _ lub -).');
  const heroClass = String(data.heroClass ?? '');
  const weapon = String(data.weapon ?? '');
  const armor = String(data.armor ?? '');
  if (!CLASSES[heroClass] || !WEAPONS[weapon] || !ARMORS[armor]) throw new Error('Nieprawidłowa klasa lub wyposażenie.');
  const raw = data.points || {};
  const points = {};
  for (const attr of ['strength','vitality','dexterity']) {
    if (!Number.isInteger(raw[attr]) || raw[attr] < 0 || raw[attr] > MAX_POINTS) throw new Error('Nieprawidłowy podział punktów.');
    points[attr] = raw[attr];
  }
  if (Object.values(points).reduce((a,b)=>a+b,0) !== MAX_POINTS) throw new Error('Rozdziel dokładnie 6 punktów atrybutów.');
  return { name, heroClass, weapon, armor, points };
}
function createFighter(data, id, isAI=false) {
  const hero=validateHero(data), cl=CLASSES[hero.heroClass], w=WEAPONS[hero.weapon], a=ARMORS[hero.armor];
  const stats = {
    maxHp: cl.hp + a.hp + hero.points.vitality*10,
    maxStamina: cl.stamina,
    attack: cl.attack + w.attack + hero.points.strength*3,
    defense: cl.defense + a.defense + hero.points.vitality,
    agility: Math.max(1, cl.agility + w.agility + a.agility + hero.points.dexterity*2)
  };
  return { id, ...hero, ...stats, hp:stats.maxHp, stamina:stats.maxStamina, guarding:false, ai:isAI };
}
function startBattle(leftData,rightData,opts={}) {
  const fighters = [createFighter(leftData,opts.leftId||'p1',!!opts.leftAI),createFighter(rightData,opts.rightId||'p2',!!opts.rightAI)];
  const starter = fighters[0].agility>=fighters[1].agility?0:1;
  return { fighters, turn:starter, round:1, winner:null, log:[`${fighters[starter].name} rozpoczyna pojedynek!`], seq:0 };
}
function publicBattle(battle) {
  return { fighters:battle.fighters.map(f=>({...f})),turn:battle.turn,round:battle.round,winner:battle.winner,log:battle.log.slice(-9),seq:battle.seq };
}
function act(battle, actorId, action, rng=Math.random) {
  if (battle.winner !== null) throw new Error('Pojedynek został zakończony.');
  if (!ACTIONS[action]) throw new Error('Nieznana akcja.');
  const self=battle.fighters[battle.turn], target=battle.fighters[1-battle.turn];
  if (self.id!==actorId) throw new Error('To nie Twoja tura.');
  if (self.stamina<ACTIONS[action].cost) throw new Error('Za mało energii.');
  self.stamina-=ACTIONS[action].cost;
  let event={ actor:self.id,target:target.id,action,damage:0,crit:false,dodge:false,guard:false,heal:0 };
  let line='';
  if (action==='guard') {
    self.guarding=true;
    self.stamina=clamp(self.stamina+4,0,self.maxStamina);
    self.hp=clamp(self.hp+3,0,self.maxHp);
    event.heal=3;
    line=`${self.name} przyjmuje postawę obronną i odzyskuje siły.`;
  } else {
    const dodgeChance = clamp(0.04 + (target.agility-self.agility)*0.007,0.02,0.17);
    const dodged = rng() < dodgeChance;
    event.dodge=dodged;
    const critChance = clamp(0.08+self.agility*0.006,0.08,0.26);
    const crit=!dodged && rng()<critChance;
    event.crit=crit;
    const base = self.attack * (action==='heavy'?1.75:action==='skill'?1.35:1);
    const penetration = action==='skill'?0.75:action==='heavy'?0.52:0.40;
    let damage = dodged?0:Math.max(2,Math.round(base-(target.defense*penetration)+(rng()*5-2)));
    if (crit) damage=Math.round(damage*1.5);
    if (target.guarding) {damage=Math.max(1,Math.round(damage*0.42));event.guard=true;}
    target.guarding=false;
    target.hp=clamp(target.hp-damage,0,target.maxHp);
    event.damage=damage;
    const verb=action==='heavy'?'wyprowadza potężny cios':action==='skill'?'używa techniki specjalnej':'atakuje';
    line=dodged?`${target.name} unika ciosu!`:`${self.name} ${verb} — ${damage} obrażeń${crit?'! Trafienie krytyczne!':'.'}`;
    if (action==='strike') self.stamina=clamp(self.stamina+1,0,self.maxStamina);
  }
  battle.log.push(line);battle.log=battle.log.slice(-25);battle.seq++;
  if (target.hp<=0) {
    battle.winner=self.id;
    battle.log.push(`${self.name} zwycięża! Arena wiwatuje!`);
  } else {
    battle.turn=1-battle.turn;
    if (battle.turn===0) battle.round++;
    battle.fighters[battle.turn].stamina=clamp(battle.fighters[battle.turn].stamina+1,0,battle.fighters[battle.turn].maxStamina);
  }
  return event;
}
function chooseAIAction(battle) {
  const f=battle.fighters[battle.turn], opp=battle.fighters[1-battle.turn];
  if (f.hp<f.maxHp*0.35 && f.stamina<=2) return 'guard';
  if (f.stamina>=5 && opp.hp<opp.maxHp*0.55) return 'skill';
  if (f.stamina>=3 && Math.random()>.43) return 'heavy';
  return Math.random()>.84?'guard':'strike';
}
const DEFAULT_AI = { name:'Czarny Wilk',heroClass:'warrior',weapon:'axe',armor:'chain',points:{strength:2,vitality:2,dexterity:2} };
module.exports={CLASSES,WEAPONS,ARMORS,ACTIONS,validateHero,createFighter,startBattle,publicBattle,act,chooseAIAction,DEFAULT_AI};

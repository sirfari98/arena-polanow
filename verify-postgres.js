// Kontrola połączenia z Supabase bez tworzenia i usuwania kont graczy.
'use strict';
const {Pool}=require('pg');
if(!process.env.DATABASE_URL){console.error('Brak DATABASE_URL w środowisku.');process.exit(2);}
const db=new Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:10000,ssl:{rejectUnauthorized:true}});
(async()=>{
 const tables=['users','heroes','inventory','sessions','activity'];
 const res=await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='arena'");
 const found=new Set(res.rows.map(r=>r.table_name));
 if(tables.some(n=>!found.has(n)))throw Error('Brak wymaganych tabel schematu arena');
 const q=await db.query('SELECT (SELECT count(*) FROM arena.users)::integer AS users, (SELECT count(*) FROM arena.heroes)::integer AS heroes');
 await db.query('BEGIN');
 try{await db.query('SELECT 1 FROM arena.users LIMIT 1');}finally{await db.query('ROLLBACK');}
 console.log('Połączenie PostgreSQL OK. Schemat arena: 5/5 tabel. Konta:',q.rows[0].users,'Postacie:',q.rows[0].heroes);
})().catch(e=>{console.error('Nieudany test bazy:',e.message);process.exitCode=1}).finally(()=>db.end());

'use strict';
// Offline migration only. Never run against a live SQLite database.
// Requires: DATABASE_URL (Supabase session pooler), DB_PATH (backed-up SQLite file).
const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs');
const {Pool}=require('pg');

const tableColumns={
 users:['id','username','salt','passhash','created_at'],
 heroes:['user_id','name','class','weapon','armor','points','gold','xp','level','wins','losses','expeditions','next_expedition'],
 inventory:['user_id','item_id','quantity'],
 sessions:['token_hash','user_id','expires'],
 activity:['id','user_id','kind','details','created_at']
};
(async()=>{
 const url=process.env.DATABASE_URL;
 const file=process.env.DB_PATH;
 if(!url||!file)throw Error('Wymagane DATABASE_URL i DB_PATH');
 if(!fs.existsSync(file))throw Error('Nie ma pliku SQLite: '+file);
 const sqlite=new DatabaseSync(file,{readOnly:true});
 const pool=new Pool({connectionString:url,max:1,ssl:{rejectUnauthorized:true}});
 const client=await pool.connect();
 try{
  const integrity=sqlite.prepare('PRAGMA integrity_check').all();
  if(integrity.length!==1||integrity[0].integrity_check!=='ok')throw Error('Błąd integralności kopii SQLite');
  const sourceCounts={};
  for(const table of Object.keys(tableColumns)){
   sourceCounts[table]=Number(sqlite.prepare(`SELECT count(*) AS n FROM ${table}`).get().n);
  }
  console.log('Liczba rekordów w kopii:',JSON.stringify(sourceCounts));
  if(process.env.MIGRATE_CONFIRM!=='YES'){
   console.log('TRYB KONTROLNY: bez zapisu. Aby importować, ustaw MIGRATE_CONFIRM=YES.');
   return;
  }
  await client.query('BEGIN');
  for(const table of Object.keys(tableColumns)){
   const {rows:[r]}=await client.query(`SELECT count(*)::int AS n FROM arena.${table}`);
   if(r.n!==0)throw Error(`Docelowa tabela arena.${table} nie jest pusta`);
  }
  for(const [table,cols] of Object.entries(tableColumns)){
   const rows=sqlite.prepare(`SELECT ${cols.join(',')} FROM ${table}`).all();
   for(const row of rows){
    const values=cols.map(col=>typeof row[col]==='bigint'?Number(row[col]):row[col]);
    await client.query(`INSERT INTO arena.${table} (${cols.join(',')}) VALUES (${values.map((_,i)=>'$'+(i+1)).join(',')})`,values);
   }
   const {rows:[r]}=await client.query(`SELECT count(*)::int AS n FROM arena.${table}`);
   if(r.n!==sourceCounts[table])throw Error(`Błąd liczby rekordów w ${table}: ${r.n} != ${sourceCounts[table]}`);
  }
  for(const table of ['users','activity']){
   await client.query(`SELECT setval(pg_get_serial_sequence('arena.${table}','id'),GREATEST(1,(SELECT COALESCE(MAX(id),0) FROM arena.${table})),(SELECT COUNT(*)>0 FROM arena.${table}))`);
  }
  await client.query('COMMIT');
  console.log('Import zakończony. Zweryfikowano liczby rekordów wszystkich tabel.');
 }catch(e){
  try{await client.query('ROLLBACK');}catch{}
  throw e;
 }finally{client.release();await pool.end();sqlite.close();}
})().catch(e=>{console.error('BŁĄD MIGRACJI:',e.message);process.exitCode=1;});

'use strict';
// Spójny backup SQLite przez VACUUM INTO - bez kopiowania aktywnych plików WAL.
const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs');const path=require('node:path');
const source=process.env.DB_PATH||path.join(__dirname,'..','data','arena.sqlite');
const directory=process.env.BACKUP_DIR||path.join(__dirname,'..','backups');
const keep=Number(process.env.BACKUP_KEEP||14);
if(!Number.isSafeInteger(keep)||keep<1||keep>365)throw Error('BACKUP_KEEP musi mieścić się od 1 do 365.');
if(!fs.existsSync(source))throw Error('Baza jeszcze nie istnieje: '+source);
fs.mkdirSync(directory,{recursive:true});
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const target=path.join(directory,`arena-${stamp}.sqlite`);
const db=new DatabaseSync(source,{readOnly:true});
try{db.prepare('VACUUM INTO ?').run(target);}finally{db.close();}
const test=new DatabaseSync(target,{readOnly:true});
try{if(test.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Błąd integralności kopii');}finally{test.close();}
const backups=fs.readdirSync(directory).filter(n=>/^arena-.*\.sqlite$/.test(n)).sort().reverse();
for(const old of backups.slice(keep))fs.unlinkSync(path.join(directory,old));
console.log(`Kopia zapisana i zweryfikowana: ${target}`);

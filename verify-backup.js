'use strict';
const {DatabaseSync}=require('node:sqlite');
const file=process.argv[2];if(!file){console.error('Użycie: npm run backup:verify -- /ścieżka/do/kopii.sqlite');process.exit(2);}
const db=new DatabaseSync(file,{readOnly:true});
try{const integrity=db.prepare('PRAGMA integrity_check').get().integrity_check;const users=db.prepare('SELECT COUNT(*) AS n FROM users').get().n;console.log(JSON.stringify({integrity,users},null,2));if(integrity!=='ok')process.exitCode=1;}finally{db.close();}

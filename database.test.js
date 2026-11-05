'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'arena-polanow-test-'));
process.env.DB_PATH=path.join(tmp,'test.sqlite');
const d=require('../database');
test('Konta, hasła i sesja są przechowywane na serwerze',()=>{
 const auth=d.signup('Polanin','bardzo-trudne-haslo');assert.ok(auth.token.length===64);
 assert.equal(d.userByToken(auth.token),auth.userId);
 assert.equal(d.login('polanin','bardzo-trudne-haslo').userId,auth.userId);
 assert.throws(()=>d.login('Polanin','bledne-haslo'));
 assert.throws(()=>d.signup('Polanin','bardzo-trudne-haslo'));
 d.logout(auth.token);assert.equal(d.userByToken(auth.token),null);
});
test('Sklep debituje złoto atomowo; bez pieniędzy nie kupisz',()=>{
 const u=d.login('Polanin','bardzo-trudne-haslo');const before=d.profile(u.userId).hero.gold;
 const next=d.buy(u.userId,'spear');assert.equal(next.hero.gold,before-160);
 assert.ok(next.inventory.some(i=>i.id==='spear'));
 assert.throws(()=>d.buy(u.userId,'plate'));
 assert.equal(d.equip(u.userId,'spear').hero.weapon,'spear');
 assert.throws(()=>d.equip(u.userId,'plate'));
});
test('Wyprawy dają nagrody i blokują powtarzanie w okresie odpoczynku',()=>{
 const u=d.login('Polanin','bardzo-trudne-haslo');const a=d.expedition(u.userId,'forest');
 assert.ok(a.gold>=24&&a.gold<=55);assert.ok(a.xp>=15&&a.xp<=30);
 assert.equal(a.profile.hero.expeditions,1);assert.throws(()=>d.expedition(u.userId,'forest'));
 assert.throws(()=>d.expedition(u.userId,'crypt'));
});
test('Nagroda za walkę i ranking utrwalają się w SQLite',()=>{
 const u=d.login('Polanin','bardzo-trudne-haslo');const p=d.addProgress(u.userId,50,125,true,'pve','Zwycięstwo');
 assert.equal(p.hero.wins,1);assert.ok(p.hero.level>=2);
 assert.equal(d.ranking()[0].username,'Polanin');
});

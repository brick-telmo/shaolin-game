import test from 'node:test';
import assert from 'node:assert/strict';
import {StoryCampaign} from './story.js';
import {Match,FORMS} from './core.js';
import {CHAPTERS,BOSS_FORMS,BOSS_MIX_STYLES,BOSS_MAX_HEALTH,bossPhaseForHealth,ENDING} from './story-data.js';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} differs from ${b}`);
const tick=(m,n,inputs=[{},{}])=>{for(let i=0;i<n;i++)m.update(1/60,inputs);};
const bossMatch=()=>{const m=new Match('tiger','snake','local','normal',()=>.4,'volcano',{boss:true});m.start();tick(m,145);return m;};
const clearChapter=c=>{c.start();c.match.ai=()=>({});for(let i=0;i<150;i++)c.update(1/60,{});while(c.phase==='fighting'){c.match.fighters[1].hp=0;for(let i=0;i<250;i++)c.update(1/60,{});}};

test('story visits every home style once, then the neutral volcano boss',()=>{
 const c=new StoryCampaign('crane','hard');
 for(let i=0;i<6;i++){
  assert.equal(c.chapterIndex,i);assert.equal(c.match.mode,'cpu');assert.equal(c.match.difficulty,'hard');assert.equal(c.match.fighters[0].form.id,'crane');assert.equal(c.match.fighters[0].lives,3);
  if(i<5){assert.equal(c.match.fighters[1].form.id,CHAPTERS[i].id);assert.equal(c.match.arena.home,CHAPTERS[i].id);assert.equal(c.match.movementMultiplier(c.match.fighters[1]),1.01);assert.equal(c.match.fighters[1].lives,3);}
  else{assert.equal(c.match.bossBattle,true);assert.equal(c.match.arena.home,null);assert.equal(c.match.fighters[1].hp,300);}
  assert.equal(c.advance(),false);clearChapter(c);assert.equal(c.phase,'won');assert.equal(c.cleared.length,i+1);assert.equal(c.advance(),true);
 }
 assert.deepEqual(c.cleared,CHAPTERS.map(c=>c.id));assert.equal(c.phase,'ending');assert.equal(c.complete(),true);assert.equal(c.phase,'complete');
});
test('losing and retrying keeps completed courts and restores the current chapter',()=>{
 const c=new StoryCampaign('snake');clearChapter(c);c.advance();c.start();c.match.ai=()=>({});for(let i=0;i<150;i++)c.update(1/60,{});
 for(let life=0;life<3;life++){c.match.fighters[0].hp=0;for(let i=0;i<250;i++)c.update(1/60,{});}
 assert.equal(c.phase,'lost');assert.equal(c.advance(),false);assert.equal(c.complete(),false);assert.equal(c.retry(),true);
 assert.equal(c.chapterIndex,1);assert.deepEqual(c.cleared,['snake']);assert.equal(c.phase,'intro');assert.deepEqual(c.match.fighters.map(p=>p.lives),[3,3]);assert.equal(c.match.arena.id,'tiger');
});
test('ending cannot be unlocked by a loss or before all six victories',()=>{
 const c=new StoryCampaign();assert.equal(c.complete(),false);assert.equal(c.advance(),false);clearChapter(c);assert.equal(c.complete(),false);c.advance();assert.equal(c.phase,'intro');assert.equal(ENDING.length,3);assert.match(ENDING.at(-1).text,/true Shaolin master/);
});
test('boss transforms exactly at 90%, 80%, 70%, 60% and 50% health',()=>{
 const m=bossMatch(),b=m.fighters[1];assert.equal(b.form.id,'snake');assert.equal(b.hp,BOSS_MAX_HEALTH);assert.equal(b.lives,1);
 for(let i=1;i<6;i++){
  const threshold=BOSS_MAX_HEALTH*(1-i*.1);b.hp=threshold+.0001;m.syncBossForm(b);assert.equal(b.form.id,BOSS_FORMS[i-1]);
  b.hp=threshold;m.syncBossForm(b);assert.equal(b.form.id,i===5?'snake':BOSS_FORMS[i]);assert.equal(b.bossMixed,i===5);assert.equal(b.bossPhase,i);assert.equal(b.hp,threshold);assert.equal(m.events.filter(e=>e.type==='transform').length,i);
  m.syncBossForm(b);assert.equal(m.events.filter(e=>e.type==='transform').length,i);
 }
 assert.equal(bossPhaseForHealth(300),0);assert.equal(bossPhaseForHealth(0),5);
});
test('a hit crossing a threshold transforms immediately and cancels the old attack',()=>{
 const m=bossMatch(),[a,b]=m.fighters;b.hp=271;m.beginAttack(b,'special');assert.ok(b.attack);m.hit(a,b,{type:'strike',facing:1});assert.equal(b.form.id,'tiger');assert.equal(b.hp,260);assert.equal(b.attack,null);assert.equal(b.invulnerable,.35);assert.ok(b.cooldown>=.45);
});
test('large damage jumps to the correct form without healing or duplicate transitions',()=>{
 const m=bossMatch(),b=m.fighters[1];b.hp=50;m.syncBossForm(b);assert.equal(b.bossMixed,true);assert.equal(b.hp,50);m.syncBossForm(b);assert.equal(m.events.filter(e=>e.type==='transform').length,1);b.hp=0;m.syncBossForm(b);assert.equal(b.bossMixed,true);
});
test('every boss form moves exactly 2% faster and does not mutate the base form',()=>{
 const bases=FORMS.map(f=>f.speed);
 for(let i=0;i<6;i++){
  const m=bossMatch(),b=m.fighters[1];b.hp=300-i*30;m.syncBossForm(b);const x=b.x;tick(m,30,[{},{left:true}]);close(x-b.x,b.form.speed*.5*1.02);assert.equal(m.movementMultiplier(m.fighters[0]),1);
 }
 assert.deepEqual(FORMS.map(f=>f.speed),bases);
});
test('all five boss specials travel exactly 2% farther at the same attack rate',()=>{
 for(let i=0;i<6;i++){
  const boss=bossMatch(),b=boss.fighters[1];b.hp=300-i*30;boss.syncBossForm(b);b.cooldown=0;
  const normal=new Match('tiger',i===5?'snake':BOSS_FORMS[i],'local');normal.start();tick(normal,145);const n=normal.fighters[1],x=b.x;
  boss.beginAttack(b,'special');normal.beginAttack(n,'special');tick(boss,10);tick(normal,10);close(x-b.x,(x-n.x)*1.02);assert.equal(b.attack.time,n.attack.time);
 }
});
test('boss health, form and speed persist when the player loses a life',()=>{
 const m=bossMatch(),[a,b]=m.fighters;b.hp=200;m.syncBossForm(b);a.hp=0;tick(m,250);
 assert.equal(m.phase,'fight');assert.equal(a.lives,2);assert.equal(a.hp,100);assert.equal(b.hp,200);assert.equal(b.form.id,'dragon');assert.equal(b.lives,1);assert.equal(m.movementMultiplier(b),1.02);
});
test('defeating the boss ends its single continuous health bar',()=>{
 const m=bossMatch();m.fighters[1].hp=0;tick(m,120);assert.equal(m.phase,'over');assert.equal(m.winner,0);assert.equal(m.fighters[1].lives,0);tick(m,300);assert.equal(m.fighters[1].hp,0);
});
test('retrying the final boss restores all its forms and the player’s three lives',()=>{
 const c=new StoryCampaign('leopard');for(let i=0;i<5;i++){clearChapter(c);c.advance();}c.start();const b=c.match.fighters[1];b.hp=50;c.match.syncBossForm(b);assert.equal(b.bossMixed,true);c.phase='lost';assert.equal(c.retry(),true);assert.equal(c.chapterIndex,5);assert.equal(c.cleared.length,5);assert.equal(c.match.fighters[1].form.id,'snake');assert.equal(c.match.fighters[1].hp,300);assert.equal(c.match.fighters[0].lives,3);
});
test('pausing the campaign freezes combat and does not advance the story',()=>{
 const c=new StoryCampaign();c.start();c.match.pause();for(let i=0;i<600;i++)c.update(1/60,{right:true,strike:true});assert.equal(c.match.phase,'paused');assert.equal(c.match.fighters[0].x,310);assert.equal(c.phase,'fighting');assert.equal(c.chapterIndex,0);
});

test('a chapter permits one retry only, with a fresh allowance at the next court',()=>{
 const c=new StoryCampaign();assert.equal(c.retriesRemaining,1);assert.equal(c.retry(),false);c.start();assert.equal(c.retry(),false);c.phase='lost';assert.equal(c.retry(),true);assert.equal(c.retriesRemaining,0);c.phase='lost';assert.equal(c.retry(),false);assert.equal(c.chapterIndex,0);c.phase='intro';clearChapter(c);c.advance();assert.equal(c.retriesRemaining,1);
});
test('fighters face each other immediately when every new exchange is reset',()=>{
 for(const boss of [false,true]){const m=boss?bossMatch():new Match('crane','leopard','local');const [a,b]=m.fighters;a.facing=-1;b.facing=1;a.x=950;b.x=160;m.resetRound();assert.equal(m.phase,'countdown');assert.equal(a.facing,1);assert.equal(b.facing,-1);assert.ok(a.x<b.x);}
});
test('Golden Master cycles through all five attack styles and retains its golden appearance flag',()=>{
 const m=bossMatch(),b=m.fighters[1];b.hp=60;m.syncBossForm(b);assert.equal(b.bossMixed,true);const seen=[];
 for(let i=0;i<10;i++){b.cooldown=0;b.stun=0;b.attack=null;b.specialCooldown=0;b.chi=100;assert.equal(m.beginAttack(b,'special'),true);seen.push(b.form.id);assert.equal(b.bossMixed,true);assert.equal(m.movementMultiplier(b),1.02);}
 assert.deepEqual(seen,[...BOSS_MIX_STYLES,...BOSS_MIX_STYLES]);
});
test('blocked input during recovery does not skip a Golden Master technique',()=>{
 const m=bossMatch(),b=m.fighters[1];b.hp=60;m.syncBossForm(b);const index=b.mixedMoveIndex;assert.equal(m.beginAttack(b,'special'),false);assert.equal(b.mixedMoveIndex,index);
});

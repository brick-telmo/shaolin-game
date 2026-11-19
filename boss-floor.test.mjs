import test from 'node:test';
import assert from 'node:assert/strict';
import {Match,FORMS,FLOOR} from './core.js';
import {StoryCampaign} from './story.js';
import {BOSS_GAP_WARNING} from './boss-floor.js';

const tick=(m,n,input={})=>{for(let i=0;i<n;i++)m.update(1/60,[input,{}]);};
function arena(form='tiger',hp=30){
 const m=new Match(form,'snake','local','normal',()=>.5,'volcano',{boss:true});
 m.phase='fight';m.fighters[1].hp=hp;m.syncBossForm(m.fighters[1]);
 return m;
}
function openGaps(m){tick(m,Math.ceil(BOSS_GAP_WARNING*60)+1);}

test('floor opens at exactly 70%, 40% and 10% health with a warning each time',()=>{
 const m=arena('tiger',300),boss=m.fighters[1];
 for(const [index,hp] of [210,120,30].entries()){
  boss.hp=hp+.0001;m.syncBossForm(boss);assert.equal(m.floorGaps.length,index);
  boss.hp=hp;m.syncBossForm(boss);assert.equal(m.floorGaps.length,index+1);
  const gap=m.floorGaps.at(-1),x=gap.x+gap.width/2;
  assert.equal(gap.warning,BOSS_GAP_WARNING);assert.equal(m.floorGapAt(x),undefined);
  tick(m,30);assert.equal(m.floorGapAt(x),undefined);
  tick(m,25);assert.equal(m.floorGapAt(x),gap);
  assert.equal(m.events.filter(e=>e.type==='floor-break').length,index+1);
  m.syncBossForm(boss);assert.equal(m.floorGaps.length,index+1);
 }
 boss.hp=1;m.syncBossForm(boss);
 for(let i=0;i<10;i++){boss.cooldown=0;boss.attack=null;m.beginAttack(boss,'strike');}
 assert.equal(m.floorGaps.length,3);assert.equal(boss.bossMixed,true);assert.equal(boss.bossPhase,5);
 assert.equal(m.events.filter(e=>e.type==='floor-crack').length,3);
});

test('style changes remain every 10% while floor damage continues during Golden Master',()=>{
 const m=arena('tiger',300),boss=m.fighters[1];
 const expected=[[270,1,0],[240,2,0],[210,3,1],[180,4,1],[150,5,1],[120,5,2],[90,5,2],[60,5,2],[30,5,3]];
 for(const [hp,phase,gaps] of expected){
  boss.hp=hp;m.syncBossForm(boss);
  assert.equal(boss.bossPhase,phase);assert.equal(m.floorGaps.length,gaps);
 }
 assert.equal(m.events.filter(e=>e.type==='transform').length,5);
});

test('large health drops add all crossed gaps once without reopening them',()=>{
 const m=arena('tiger',300),boss=m.fighters[1];
 boss.hp=25;m.syncBossForm(boss);assert.equal(m.floorGaps.length,3);
 openGaps(m);boss.hp=20;m.syncBossForm(boss);
 assert.equal(m.floorGaps.length,3);assert.ok(m.floorGaps.every(g=>g.warning===0));
});

test('falling costs 20% of maximum player health once, including when already injured',()=>{
 for(const startingHp of [100,60]){
 const m=arena('tiger',210);openGaps(m);const p=m.fighters[0];p.x=520;
 p.hp=startingHp;
 tick(m,6,{right:true});assert.equal(p.falling,true);assert.ok(p.y>FLOOR);
 const fallingY=p.y;m.update(1/60,[{jump:true,special:true},{}]);assert.ok(p.y>fallingY);assert.equal(p.attack,null);
 tick(m,50);assert.equal(p.hp,startingHp-20);assert.equal(p.lives,3);
 assert.equal(p.falling,false);assert.equal(p.y,FLOOR);assert.equal(m.floorGapAt(p.x,true),undefined);
 assert.equal(m.events.filter(e=>e.type==='fall').length,1);assert.ok(p.invulnerable>0);
 assert.equal(m.events.find(e=>e.type==='fall').damage,20);
 }
});

test('every animal style can jump every gap in either direction without damage',()=>{
 for(const form of FORMS)for(let index=0;index<3;index++)for(const direction of [-1,1]){
  const m=arena(form.id);openGaps(m);const p=m.fighters[0],boss=m.fighters[1],gap=m.floorGaps[index];
  boss.x=direction>0?50:1070;
  p.x=direction>0?gap.x-22:gap.x+gap.width+22;
  const target=direction>0?gap.x+gap.width+22:gap.x-22;
  for(let step=0;step<90;step++){
   const move=direction>0?p.x<target:p.x>target;
   m.update(1/60,[{left:move&&direction<0,right:move&&direction>0,jump:step===0},{}]);
  }
  assert.ok(direction>0?p.x>gap.x+gap.width:p.x<gap.x,`${form.id} gap ${index} direction ${direction}`);
  assert.equal(p.hp,100);assert.equal(p.y,FLOOR);assert.ok(!p.falling);
 }
});

test('a section opening under a fighter drops them; grounded special dashes cannot bridge holes',()=>{
 const m=arena('tiger',210),p=m.fighters[0];p.x=560;tick(m,30);assert.ok(!p.falling);
 tick(m,25);assert.equal(p.falling,true);
 const dash=arena('snake',210);openGaps(dash);const snake=dash.fighters[0];snake.x=520;
 dash.beginAttack(snake,'special');tick(dash,6);assert.equal(snake.falling,true);assert.equal(snake.attack,null);
});

test('boss AI crosses the broken arena using jumps with every style',()=>{
 for(const form of FORMS)for(const direction of [-1,1]){
  const m=arena();openGaps(m);const [p,boss]=m.fighters;
  m.mode='cpu';boss.form=form;boss.bossMixed=false;boss.x=direction>0?110:1010;p.x=direction>0?1050:70;
  let jumps=0;
  for(let step=0;step<750&&Math.abs(boss.x-p.x)>140;step++){
   m.update(1/60,[{},{}]);jumps+=m.events.splice(0).filter(e=>e.type==='jump').length;
  }
  assert.ok(Math.abs(boss.x-p.x)<=140,`${form.id} did not cross direction ${direction}: ${boss.x}`);
  assert.equal(boss.hp,30,`${form.id} fell`);assert.ok(jumps>=3);
 }
});

test('fatal falls use normal life rules, preserve the boss and gaps, and respawn safely',()=>{
 const m=arena();openGaps(m);const p=m.fighters[0];p.hp=20;p.x=560;
 tick(m,230);assert.equal(p.lives,2);assert.equal(p.hp,100);assert.equal(m.fighters[1].hp,30);
 assert.equal(m.floorGaps.length,3);assert.ok(m.floorGaps.every(g=>g.warning===0));assert.equal(p.x,310);assert.equal(p.y,FLOOR);
});

test('boss falls cost 20% of its 300 maximum health and update its form',()=>{
 const m=arena('tiger',210);openGaps(m);const boss=m.fighters[1];boss.x=560;
 tick(m,50);assert.equal(boss.hp,150);assert.equal(boss.lives,1);assert.equal(m.phase,'fight');assert.equal(m.floorGapAt(boss.x,true),undefined);
 assert.equal(m.events.find(e=>e.type==='fall').damage,60);assert.equal(boss.bossMixed,true);
});

test('pause freezes the warning and retry restores an intact final arena',()=>{
 const c=new StoryCampaign();c.chapterIndex=5;c.match=c.createMatch();c.match.phase='fight';
 const m=c.match;m.fighters[1].hp=150;m.syncBossForm(m.fighters[1]);m.pause();tick(m,120);
 assert.ok(m.floorGaps.every(g=>g.warning===BOSS_GAP_WARNING));
 c.phase='lost';assert.equal(c.retry(),true);assert.deepEqual(c.match.floorGaps,[]);assert.equal(c.match.fighters[1].hp,300);
});

test('ordinary fights retain a solid floor throughout the arena',()=>{
 for(const mode of ['cpu','local']){
  const m=new Match('tiger','crane',mode);m.phase='fight';m.fighters[0].x=560;tick(m,30);
  assert.deepEqual(m.floorGaps,[]);assert.equal(m.fighters[0].y,FLOOR);assert.ok(!m.fighters[0].falling);
 }
});

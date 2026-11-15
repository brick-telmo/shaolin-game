import test from 'node:test';
import assert from 'node:assert/strict';
import {Match,FORMS} from './core.js';
import {ARENAS,getArena} from './arena-data.js';
const tick=(m,n,inputs=[{},{}])=>{for(let i=0;i<n;i++)m.update(1/60,inputs);};
const make=(form,arena,mode='local',second='dragon')=>{const m=new Match(form,second,mode,'normal',()=>.4,arena);m.start();tick(m,150);return m;};
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} differs from ${expected}`);

test('six unique arenas: one for each animal and one neutral volcano',()=>{
 assert.equal(ARENAS.length,6);assert.equal(new Set(ARENAS.map(a=>a.id)).size,6);
 assert.deepEqual(ARENAS.filter(a=>a.home).map(a=>a.home).sort(),FORMS.map(f=>f.id).sort());
 assert.equal(getArena('volcano').home,null);assert.equal(getArena('unknown').id,'volcano');
});
test('every form travels exactly 1% farther at home over the same time',()=>{
 for(const f of FORMS){const home=make(f.id,f.id),neutral=make(f.id,'volcano');const x=home.fighters[0].x;
  tick(home,60,[{right:true},{}]);tick(neutral,60,[{right:true},{}]);
  close(neutral.fighters[0].x-x,f.speed);close(home.fighters[0].x-x,f.speed*1.01);
 }
});
test('all other animal courts give visiting styles their normal speed',()=>{
 for(const f of FORMS)for(const arena of ARENAS.filter(a=>a.home!==f.id)){
  const m=make(f.id,arena.id),x=m.fighters[0].x;tick(m,30,[{right:true},{}]);close(m.fighters[0].x-x,f.speed*.5);
 }
});
test('Player 2 and the CPU receive the same home movement advantage',()=>{
 for(const mode of ['local','cpu'])for(const f of FORMS){const m=make('tiger',f.id,mode,f.id);const x=m.fighters[1].x;
  if(mode==='cpu')m.ai=()=>({left:true});
  tick(m,30,[{},{left:true}]);close(x-m.fighters[1].x,f.speed*.5*1.01);
 }
});
test('both fighters receive the bonus in a matching mirror fight',()=>{
 const m=make('snake','snake','local','snake');const [x1,x2]=m.fighters.map(p=>p.x);tick(m,30,[{right:true},{left:true}]);
 close(m.fighters[0].x-x1,235*.5*1.01);close(x2-m.fighters[1].x,235*.5*1.01);
});
test('special-move travel also gets exactly 1% at home for each form',()=>{
 for(const f of FORMS){const home=make(f.id,f.id),neutral=make(f.id,'volcano');const x=home.fighters[0].x;
  home.beginAttack(home.fighters[0],'special');neutral.beginAttack(neutral.fighters[0],'special');tick(home,10);tick(neutral,10);
  close(home.fighters[0].x-x,(neutral.fighters[0].x-x)*1.01);
  assert.equal(home.fighters[0].attack.time,neutral.fighters[0].attack.time);
 }
});
test('home bonus persists across knockouts without stacking or mutating base speed',()=>{
 const m=make('tiger','tiger'),base=FORMS.find(f=>f.id==='tiger').speed;
 for(let round=0;round<2;round++){m.fighters[1].hp=0;tick(m,260);assert.equal(m.arena.id,'tiger');close(m.movementMultiplier(m.fighters[0]),1.01);}
 const x=m.fighters[0].x;tick(m,30,[{right:true},{}]);close(m.fighters[0].x-x,base*.5*1.01);
 assert.equal(FORMS.find(f=>f.id==='tiger').speed,base);assert.equal(m.fighters[1].lives,1);
});
test('guard movement gets the bonus while attack damage and jump impulse remain unchanged',()=>{
 const home=make('snake','snake'),neutral=make('snake','volcano');const x=home.fighters[0].x;
 tick(home,20,[{right:true,guard:true},{}]);tick(neutral,20,[{right:true,guard:true},{}]);close(home.fighters[0].x-x,(neutral.fighters[0].x-x)*1.01);
 tick(home,1,[{jump:true},{}]);tick(neutral,1,[{jump:true},{}]);close(home.fighters[0].vy,neutral.fighters[0].vy);
 for(const m of [home,neutral]){m.fighters[0].x=400;m.fighters[1].x=465;m.hit(m.fighters[0],m.fighters[1],{type:'strike',facing:1});}
 assert.equal(home.fighters[1].hp,neutral.fighters[1].hp);
});

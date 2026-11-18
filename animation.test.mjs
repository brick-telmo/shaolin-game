import test from 'node:test';
import assert from 'node:assert/strict';
import {ARENAS,drawArenaAnimals} from './arenas.js';
import {ARENA_ELEMENTS,drawArenaMotion} from './arena-motion.js';
import {FORMS,Match,FLOOR} from './core.js';
import {packMatch,unpackMatch} from './online-state.js';
import {Renderer} from './render.js';
function drawing(fn){const calls=[];const c=new Proxy({},{set(target,key,value){calls.push([key,value]);target[key]=value;return true;},get(target,key){return key in target?target[key]:(...args)=>calls.push([key,...args]);}});fn(c);return calls;}
test('every arena has animated elemental scenery and all four elements are represented',()=>{
 assert.deepEqual([...new Set(Object.values(ARENA_ELEMENTS).flat())].sort(),['air','earth','fire','water']);
 for(const arena of ARENAS){assert.ok(ARENA_ELEMENTS[arena.id].length>=2);const a=drawing(c=>drawArenaMotion(c,arena.id,0)),b=drawing(c=>drawArenaMotion(c,arena.id,2.3));assert.notDeepEqual(a,b,arena.id+' scene does not animate');}
});
test('all five background animals animate, while reduced motion freezes scenery',()=>{
 for(const arena of ARENAS){if(arena.home)assert.notDeepEqual(drawing(c=>drawArenaAnimals(c,arena.id,0)),drawing(c=>drawArenaAnimals(c,arena.id,2.3)),arena.id+' animal does not animate');assert.deepEqual(drawing(c=>drawArenaMotion(c,arena.id,0,true)),drawing(c=>drawArenaMotion(c,arena.id,2.3,true)));}
});
function renderFighters(match){
 const calls=[],sprites=Object.fromEntries(FORMS.map(f=>[f.id,{form:f.id}]));
 const c=new Proxy({},{set(target,key,value){target[key]=value;return true;},get(target,key){return key in target?target[key]:(...args)=>calls.push([key,...args]);}});
 const cache=Object.fromEntries(FORMS.map(f=>[f.id,Object.fromEntries(['idle','walk','strike','kick','special','guard','hurt','jump','ko'].map(pose=>[pose,Array(8).fill(sprites[f.id])]))]));
 Renderer.prototype.draw.call({c,time:0,shake:0,reduced:true,backgrounds:{volcano:{}},cache,masterCache:cache,particles:[],texts:[]},match,0);
 return {calls,sprites};
}
function assertFighterVisibility(match,visible){
 const {calls,sprites}=renderFighters(match);
 for(const [i,p] of match.fighters.entries()){
  assert.equal(calls.some(([method,image])=>method==='drawImage'&&image===sprites[p.form.id]),visible[i],`${p.form.id} sprite`);
  assert.equal(calls.some(([method,x,y,rx,ry])=>method==='ellipse'&&x===p.x&&y===FLOOR+7&&rx===45&&ry===9),visible[i],`${p.form.id} shadow`);
 }
}
test('knocked-out fighters and their shadows stay hidden until the next round',()=>{
 for(const mode of ['local','cpu','online']){
  for(const loser of [0,1]){
   const match=new Match('tiger','dragon',mode==='cpu'?'cpu':'local','normal',()=>.4);
   match.phase='fight';match.fighters[loser].hp=0;match.update(1/60);
   assert.equal(match.phase,'ko');
   assertFighterVisibility(mode==='online'?unpackMatch(packMatch(match)):match,loser===0?[false,true]:[true,false]);
   for(let i=0;i<110;i++)match.update(1/60);
   assert.equal(match.phase,'countdown');
   assertFighterVisibility(match,[true,true]);
  }
 }
});
test('the eliminated fighter remains hidden after the final knockout',()=>{
 const match=new Match('tiger','dragon','local');
 match.phase='fight';match.fighters[1].lives=1;match.fighters[1].hp=0;match.update(1/60);
 for(let i=0;i<110;i++)match.update(1/60);
 assert.equal(match.phase,'over');assert.equal(match.winner,0);
 assertFighterVisibility(match,[true,false]);
});

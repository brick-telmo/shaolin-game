import test from 'node:test';
import assert from 'node:assert/strict';
import {ARENAS,drawArenaAnimals} from './arenas.js';
import {ARENA_ELEMENTS,drawArenaMotion} from './arena-motion.js';
function drawing(fn){const calls=[];const c=new Proxy({},{set(target,key,value){calls.push([key,value]);target[key]=value;return true;},get(target,key){return key in target?target[key]:(...args)=>calls.push([key,...args]);}});fn(c);return calls;}
test('every arena has animated elemental scenery and all four elements are represented',()=>{
 assert.deepEqual([...new Set(Object.values(ARENA_ELEMENTS).flat())].sort(),['air','earth','fire','water']);
 for(const arena of ARENAS){assert.ok(ARENA_ELEMENTS[arena.id].length>=2);const a=drawing(c=>drawArenaMotion(c,arena.id,0)),b=drawing(c=>drawArenaMotion(c,arena.id,2.3));assert.notDeepEqual(a,b,arena.id+' scene does not animate');}
});
test('all five background animals animate, while reduced motion freezes scenery',()=>{
 for(const arena of ARENAS){if(arena.home)assert.notDeepEqual(drawing(c=>drawArenaAnimals(c,arena.id,0)),drawing(c=>drawArenaAnimals(c,arena.id,2.3)),arena.id+' animal does not animate');assert.deepEqual(drawing(c=>drawArenaMotion(c,arena.id,0,true)),drawing(c=>drawArenaMotion(c,arena.id,2.3,true)));}
});

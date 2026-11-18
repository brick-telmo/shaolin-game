import test from 'node:test';
import assert from 'node:assert/strict';
import {createTouchControls} from './touch-controls.js';

class Element extends EventTarget{
 constructor(action){super();this.dataset={action};this.hidden=false;this.captures=new Set();this.style={setProperty(name,value){this[name]=value;}};}
 setPointerCapture(id){this.captures.add(id);}
 hasPointerCapture(id){return this.captures.has(id);}
 releasePointerCapture(id){this.captures.delete(id);}
 getBoundingClientRect(){return {left:0,top:0};}
 send(type,props={}){const event=new Event(type,{cancelable:true});Object.assign(event,props);this.dispatchEvent(event);}
}
function setup(){
 const zone=new Element(),indicator=new Element(),buttons=['strike','kick','special'].map(action=>new Element(action));
 const changes=[],touch=createTouchControls(zone,indicator,buttons,()=>changes.push({...touch.input}));
 return {zone,indicator,buttons,touch,changes};
}
test('drag controls movement, jump and guard with a dead zone and cancellation',()=>{
 const {zone,indicator,touch}=setup();
 zone.send('pointerdown',{pointerId:1,clientX:50,clientY:50});
 assert.equal(indicator.hidden,false);
 zone.send('pointermove',{pointerId:1,clientX:60,clientY:55});
 assert.deepEqual(touch.input,{left:false,right:false,jump:false,guard:false,strike:false,kick:false,special:false});
 zone.send('pointermove',{pointerId:1,clientX:20,clientY:20});
 assert.equal(touch.input.left,true);assert.equal(touch.input.jump,true);
 zone.send('pointermove',{pointerId:1,clientX:80,clientY:80});
 assert.equal(touch.input.left,false);assert.equal(touch.input.jump,false);
 assert.equal(touch.input.right,true);assert.equal(touch.input.guard,true);
 zone.send('pointercancel',{pointerId:1});
 assert.equal(touch.input.right,false);assert.equal(touch.input.guard,false);assert.equal(indicator.hidden,true);
});
test('movement and attacks track independent pointers and release only their own input',()=>{
 const {zone,buttons,touch}=setup(),[strike,kick]=buttons;
 zone.send('pointerdown',{pointerId:1,clientX:50,clientY:50});
 zone.send('pointermove',{pointerId:1,clientX:80,clientY:50});
 strike.send('pointerdown',{pointerId:2});kick.send('pointerdown',{pointerId:3});
 assert.equal(touch.input.right,true);assert.equal(touch.input.strike,true);assert.equal(touch.input.kick,true);
 strike.send('lostpointercapture',{pointerId:2});
 assert.equal(touch.input.strike,false);assert.equal(touch.input.kick,true);assert.equal(touch.input.right,true);
 zone.send('pointerup',{pointerId:1});
 assert.equal(touch.input.right,false);assert.equal(touch.input.kick,true);
 kick.send('pointerup',{pointerId:3});assert.equal(touch.input.kick,false);
});
test('clearing input releases captures and prevents stale pointer events from restoring actions',()=>{
 const {zone,buttons,touch,changes}=setup(),special=buttons[2];
 zone.send('pointerdown',{pointerId:1,clientX:50,clientY:50});
 zone.send('pointermove',{pointerId:1,clientX:20,clientY:50});
 special.send('pointerdown',{pointerId:2});
 touch.clear();
 assert.equal(zone.hasPointerCapture(1),false);assert.equal(special.hasPointerCapture(2),false);
 assert.equal(Object.values(touch.input).some(Boolean),false);
 zone.send('pointermove',{pointerId:1,clientX:100,clientY:50});
 special.send('pointerup',{pointerId:2});
 assert.equal(Object.values(touch.input).some(Boolean),false);
 assert.equal(Object.values(changes.at(-1)).some(Boolean),false);
});
test('keyboard activation and another pointer can independently hold an attack',()=>{
 const {buttons,touch}=setup(),strike=buttons[0];
 strike.send('keydown',{key:' '});strike.send('pointerdown',{pointerId:2});
 strike.send('keyup',{key:' '});assert.equal(touch.input.strike,true);
 strike.send('pointerup',{pointerId:2});assert.equal(touch.input.strike,false);
});
test('multiple fingers on one attack remain active until all are released',()=>{
 const {buttons,touch}=setup(),strike=buttons[0];
 strike.send('pointerdown',{pointerId:1});strike.send('pointerdown',{pointerId:2});
 strike.send('pointerup',{pointerId:1});assert.equal(touch.input.strike,true);
 strike.send('pointercancel',{pointerId:2});assert.equal(touch.input.strike,false);
});

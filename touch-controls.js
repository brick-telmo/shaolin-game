export function createTouchControls(zone,indicator,buttons,onChange){
 const input={left:false,right:false,jump:false,guard:false,strike:false,kick:false,special:false};
 const pointers=new Map(),keyboard=new Set();
 let movement=null;
 function update(){
  const active=new Set([...pointers.values()].map(({action})=>action).filter(Boolean));
  for(const action of keyboard)active.add(action);
  for(const action of ['strike','kick','special'])input[action]=active.has(action);
  onChange();
 }
 function updateMovement(e){
  const dx=e.clientX-movement.x,dy=e.clientY-movement.y,deadZone=16;
  input.left=dx<-deadZone;input.right=dx>deadZone;
  input.jump=dy<-deadZone;input.guard=dy>deadZone;
  const limit=36,distance=Math.hypot(dx,dy),scale=distance>limit?limit/distance:1;
  indicator.style.setProperty('--drag-x',`${dx*scale}px`);
  indicator.style.setProperty('--drag-y',`${dy*scale}px`);
  onChange();
 }
 function endMovement(){
  movement=null;input.left=input.right=input.jump=input.guard=false;
  indicator.hidden=true;onChange();
 }
 zone.addEventListener('pointerdown',e=>{
  if(movement)return;
  e.preventDefault();movement={id:e.pointerId,x:e.clientX,y:e.clientY};
  zone.setPointerCapture(e.pointerId);
  const rect=zone.getBoundingClientRect();
  indicator.style.left=`${e.clientX-rect.left}px`;indicator.style.top=`${e.clientY-rect.top}px`;
  indicator.style.setProperty('--drag-x','0px');indicator.style.setProperty('--drag-y','0px');
  indicator.hidden=false;
 });
 zone.addEventListener('pointermove',e=>{if(movement?.id===e.pointerId)updateMovement(e);});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])zone.addEventListener(type,e=>{if(movement?.id===e.pointerId)endMovement();});
 for(const button of buttons){
  const action=button.dataset.action;
  button.addEventListener('pointerdown',e=>{
   e.preventDefault();button.setPointerCapture(e.pointerId);
   pointers.set(e.pointerId,{action,element:button});update();
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,e=>{
   if(pointers.get(e.pointerId)?.element===button){pointers.delete(e.pointerId);update();}
  });
  button.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();keyboard.add(action);update();}});
  button.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();keyboard.delete(action);update();}});
  button.addEventListener('blur',()=>{if(keyboard.delete(action))update();});
 }
 function clear(){
  const captures=[...pointers.entries()].map(([id,{element}])=>[id,element]);
  if(movement)captures.push([movement.id,zone]);
  movement=null;pointers.clear();keyboard.clear();indicator.hidden=true;
  const changed=Object.values(input).some(Boolean);
  for(const action of Object.keys(input))input[action]=false;
  for(const [id,element] of captures)if(element.hasPointerCapture(id))element.releasePointerCapture(id);
  if(changed)onChange();
 }
 return {input,clear};
}

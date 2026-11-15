import {FORMS,W,H,FLOOR} from './core.js';
import {ARENAS,createBackground,drawArenaAnimals} from './arenas.js';
import {drawArenaMotion} from './arena-motion.js';
const makeCanvas=(w,h)=>Object.assign(document.createElement('canvas'),{width:w,height:h});
function poly(c,points,color){c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
function limb(c,points,width,color,shade){
 c.lineJoin='miter';c.lineCap='square';c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle='#202f2b';c.lineWidth=width+3;c.stroke();c.strokeStyle=shade;c.lineWidth=width;c.stroke();c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x-1,y-1):c.moveTo(x-1,y-1));c.strokeStyle=color;c.lineWidth=Math.max(2,width-3);c.stroke();
}
function sprite(form,pose,frame){
 const out=makeCanvas(112,112),c=out.getContext('2d');c.imageSmoothingEnabled=false;
 const f=form,skin='#d5ad82',skinShadow='#966d55',ink='#24302b';const t=frame/8*Math.PI*2;const bob=pose==='idle'?Math.round(Math.sin(t)*1):0;
 let head=[49,25+bob],neck=[47,37+bob],hip=[45,61+bob],backKnee=[33,76],backFoot=[26,97],frontKnee=[59,77],frontFoot=[67,98],backElbow=[31,50+bob],backHand=[38,37+bob],frontElbow=[65,49+bob],frontHand=[77,37+bob];
 if(f.id==='snake'){frontElbow=[64,40+bob];frontHand=[78,31+bob];backHand=[41,47+bob];head[0]+=2;}
 if(f.id==='tiger'){backElbow=[27,48+bob];backHand=[33,35+bob];frontElbow=[68,47+bob];frontHand=[78,34+bob];backFoot=[23,98];frontFoot=[72,98];}
 if(f.id==='leopard'){head=[54,29+bob];neck=[50,40+bob];frontHand=[76,43+bob];backHand=[42,43+bob];hip=[45,64+bob];}
 if(f.id==='dragon'){backElbow=[27,41+bob];backHand=[35,25+bob];frontElbow=[68,49+bob];frontHand=[76,39+bob];}
 if(f.id==='crane'){backElbow=[28,35+bob];backHand=[17,27+bob];frontElbow=[67,32+bob];frontHand=[82,25+bob];frontKnee=[66,64];frontFoot=[55,82];hip=[45,60+bob];}
 if(pose==='walk'){const s=Math.sin(t);backKnee=[41-s*13,77];backFoot=[43-s*23,98-Math.max(0,s)*8];frontKnee=[45+s*13,77];frontFoot=[48+s*23,98-Math.max(0,-s)*8];head[1]+=Math.round(Math.abs(s)*2);}
 if(pose==='strike'){const ext=frame>0&&frame<6?1:0.3;head[0]+=5*ext;neck[0]+=5*ext;frontElbow=[68,38];frontHand=[70+29*ext,35];backHand=[44,43];}
 if(pose==='kick'){hip=[44,59];head=[42,24];neck=[41,36];frontKnee=[72,55];frontFoot=[99,42+Math.sin(t)*4];backKnee=[35,78];backFoot=[29,98];frontHand=[62,30];backHand=[25,48];}
 if(pose==='special'){
  if(f.id==='snake'){head=[57,32];neck=[53,44];hip=[43,66];frontElbow=[74,40];frontHand=[102,36];backElbow=[33,50];backHand=[43,40];frontKnee=[69,81];frontFoot=[81,97];backFoot=[18,97];}
  if(f.id==='tiger'){head=[56,28];neck=[50,40];frontElbow=[76,37];frontHand=[96,27];backElbow=[64,50];backHand=[91,42];frontKnee=[69,76];frontFoot=[83,97];backFoot=[20,97];}
  if(f.id==='leopard'){head=[59,33];neck=[53,45];hip=[40,66];frontElbow=[77,42];frontHand=[100,37+Math.sin(t)*9];backElbow=[50,58];backHand=[75,52];frontKnee=[63,78];frontFoot=[81,96];backKnee=[22,78];backFoot=[12,96];}
  if(f.id==='dragon'){head=[50,28];neck=[47,40];frontElbow=[66,27];frontHand=[65,7];backHand=[29,47];frontKnee=[66,68];frontFoot=[57,89];backFoot=[33,99];}
  if(f.id==='crane'){head=[44,26];neck=[42,38];hip=[45,61];frontKnee=[71,51];frontFoot=[99,30];backKnee=[35,80];backFoot=[26,92];frontElbow=[65,31];frontHand=[80,12];backElbow=[27,36];backHand=[14,24];}
 }
 if(pose==='jump'){frontKnee=[67,67];frontFoot=[63,83];backKnee=[33,74];backFoot=[20,87];frontHand=[73,26];backHand=[29,29];}
 if(pose==='guard'){head=[46,30];neck=[44,42];frontElbow=[60,43];frontHand=[58,22];backElbow=[52,51];backHand=[66,31];hip=[43,66];}
 if(pose==='hurt'){head=[39,27];neck=[40,40];frontElbow=[60,48];frontHand=[66,62];backHand=[22,51];}
 if(pose==='bow'){head=[63,43];neck=[55,48];hip=[44,64];backKnee=[34,80];backFoot=[28,98];frontKnee=[59,81];frontFoot=[65,98];frontElbow=[73,55];frontHand=[70,44];backElbow=[62,61];backHand=[69,45];}
 if(pose==='ko'){c.translate(2,107);c.rotate(-Math.PI/2);c.translate(-35,-100);}
 // Shadowed rear limbs, trousers and cloth shoes.
 limb(c,[hip,backKnee,backFoot],10,f.master?f.color:f.dark,f.master?f.dark:'#344339');limb(c,[neck,backElbow,backHand],7,f.dark,f.dark);
 c.fillStyle=ink;c.fillRect(backFoot[0]-5,backFoot[1]-2,14,6);c.fillStyle='#b6b39a';c.fillRect(backFoot[0]-5,backFoot[1]+3,14,2);
 // Costume colors take priority over the active style's trouser palette.
 limb(c,[hip,frontKnee,frontFoot],11,f.master?f.color:f.id==='crane'?'#d5d7be':f.dark,f.master?f.dark:f.id==='crane'?'#8f9e8e':'#344339');
 c.fillStyle=ink;c.fillRect(frontFoot[0]-4,frontFoot[1]-2,15,6);c.fillStyle='#b6b39a';c.fillRect(frontFoot[0]-4,frontFoot[1]+3,15,2);
 // Layered tunic, wrapped waist and asymmetric hem.
 poly(c,[[neck[0]-10,neck[1]-2],[neck[0]+9,neck[1]-1],[hip[0]+12,hip[1]+7],[hip[0]-13,hip[1]+7]],ink);
 poly(c,[[neck[0]-8,neck[1]-2],[neck[0]+7,neck[1]],[hip[0]+9,hip[1]+6],[hip[0]-10,hip[1]+5]],f.color);
 poly(c,[[neck[0]-8,neck[1]+3],[neck[0]-4,neck[1]+13],[hip[0]-6,hip[1]+4],[hip[0]-10,hip[1]+5]],f.dark);
 poly(c,[[neck[0]-3,neck[1]],[neck[0]+2,neck[1]-2],[neck[0]+6,neck[1]+10],[hip[0]-2,hip[1]]],f.light);
 c.fillStyle=ink;c.fillRect(hip[0]-11,hip[1]-3,22,5);c.fillStyle=f.light;c.fillRect(hip[0]-10,hip[1]-3,20,2);c.fillRect(hip[0]+5,hip[1]+1,4,15);c.fillStyle=f.dark;c.fillRect(hip[0]+7,hip[1]+4,2,9);
 // Human faces and hair; every style remains a person.
 c.fillStyle=skinShadow;c.fillRect(head[0]-3,head[1]+6,6,7);c.fillStyle=ink;c.fillRect(head[0]-8,head[1]-8,15,17);c.fillStyle=skinShadow;c.fillRect(head[0]-6,head[1]-7,13,14);c.fillStyle=skin;c.fillRect(head[0]-3,head[1]-6,10,12);c.fillRect(head[0]+7,head[1]-1,3,4);c.fillStyle='#f1cc9c';c.fillRect(head[0]+1,head[1]-5,5,2);c.fillStyle=ink;c.fillRect(head[0]+3,head[1]-1,4,2);c.fillRect(head[0]+4,head[1]+7,4,1);
 c.fillStyle=f.master?'#946123':f.id==='crane'?'#d8dbcc':'#27342f';c.fillRect(head[0]-8,head[1]-9,15,5);c.fillRect(head[0]-8,head[1]-5,4,10);
 if(f.id==='snake'||f.id==='dragon'){c.fillRect(head[0]-6,head[1]-14,8,5);c.fillStyle=f.light;c.fillRect(head[0]-5,head[1]-10,7,2);}
 if(f.id==='crane'){c.fillRect(head[0]-13,head[1]-9,6,7);c.fillStyle=f.light;c.fillRect(head[0]-13,head[1]-3,3,19);}
 if(f.id==='tiger'||f.id==='leopard'){c.fillStyle=f.light;c.fillRect(head[0]-8,head[1]-5,16,3);poly(c,[[head[0]-8,head[1]-5],[head[0]-21,head[1]-3],[head[0]-12,head[1]+1]],f.color);}
 if(f.master){c.fillStyle='#fff1b0';c.fillRect(neck[0]-9,neck[1]+1,5,4);c.fillRect(neck[0]+5,neck[1]+3,5,4);c.fillRect(hip[0]-4,hip[1]-8,7,5);c.fillStyle='#d7a037';c.fillRect(head[0]-7,head[1]+2,17,7);c.fillStyle='#e4ce97';c.fillRect(head[0]-8,head[1]-5,16,2);}
 limb(c,[neck,frontElbow,frontHand],f.id==='tiger'?9:7,f.color,f.dark);
 // Wrist wraps and hands; open fingers distinguish the claw and beak shapes.
 c.fillStyle=f.light;c.fillRect(frontHand[0]-5,frontHand[1]-3,5,6);c.fillStyle=skinShadow;c.fillRect(frontHand[0]-1,frontHand[1]-4,7,7);c.fillStyle=skin;c.fillRect(frontHand[0],frontHand[1]-4,7,4);
 if(f.id==='tiger'){for(let i=0;i<3;i++){c.fillRect(frontHand[0]+3+i*2,frontHand[1]-7+i,1,5);}}
 if(f.id==='snake'){c.fillRect(frontHand[0]+6,frontHand[1]-4,6,2);}if(f.id==='crane'){c.fillRect(frontHand[0]+5,frontHand[1]-2,3,5);}
 c.fillStyle=skin;c.fillRect(backHand[0]-2,backHand[1]-3,6,5);
 // Small embroidery: tiger stripes, leopard spots, flowing dragon edges.
 if(f.id==='tiger'){for(let j=0;j<3;j++)poly(c,[[hip[0]-9,hip[1]-16+j*5],[hip[0]-2,hip[1]-14+j*5],[hip[0]-9,hip[1]-13+j*5]],f.dark);}
 if(f.id==='leopard'){c.fillStyle=f.dark;for(const [x,y]of [[-5,-13],[4,-9],[-4,-5],[3,-17]])c.fillRect(hip[0]+x,hip[1]+y,2,2);}
 if(f.id==='dragon'){c.fillStyle=f.light;c.fillRect(hip[0]+4,hip[1]-13,2,6);c.fillRect(hip[0]+1,hip[1]-10,5,2);}
 return out;
}
export class Renderer{
 constructor(canvas){this.canvas=canvas;this.c=canvas.getContext('2d');this.c.imageSmoothingEnabled=false;this.backgrounds=Object.fromEntries(ARENAS.map(a=>[a.id,createBackground(a.id,{omitAnimals:true})]));this.cache={};this.masterCache={};this.particles=[];this.texts=[];this.shake=0;this.time=0;this.reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;for(const f of FORMS){this.cache[f.id]={};this.masterCache[f.id]={};for(const pose of ['idle','walk','strike','kick','special','guard','hurt','jump','ko','bow']){this.cache[f.id][pose]=Array.from({length:8},(_,i)=>sprite(f,pose,i));this.masterCache[f.id][pose]=Array.from({length:8},(_,i)=>sprite({...f,master:true,color:'#efc451',dark:'#9e6c26',light:'#fff1b0'},pose,i));}}}
 arenaThumbnail(canvas,id){const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;c.drawImage(this.backgrounds[id],0,0,canvas.width,canvas.height);c.save();c.scale(canvas.width/560,canvas.height/250);drawArenaAnimals(c,id,0);c.restore();}
 portrait(canvas,form){const c=canvas.getContext('2d');c.clearRect(0,0,canvas.width,canvas.height);c.imageSmoothingEnabled=false;c.drawImage(this.cache[form.id].idle[2],0,0,canvas.width,canvas.height);}
 event(e){if(e.type==='transform'){this.transformPulse=.65;this.transformX=e.x;this.transformY=e.y-75;this.transformColor=e.color;for(let i=0;i<28;i++){const angle=i/28*Math.PI*2;this.particles.push({x:e.x,y:e.y-75,vx:Math.cos(angle)*180,vy:Math.sin(angle)*180,life:.65,color:e.color,size:4});}}if(e.type==='hit'||e.type==='block'){if(!this.reduced)this.shake=e.special?7:3;for(let i=0;i<(e.type==='block'?9:18);i++)this.particles.push({x:e.x,y:e.y,vx:(Math.random()-.5)*380,vy:(Math.random()-.5)*300,life:.25+Math.random()*.25,color:e.type==='block'?'#e9e9c1':i%2?'#fff1b2':e.color,size:e.special?5:3});this.texts.push({x:e.x,y:e.y-25,life:.7,text:e.type==='block'?'GUARD':e.combo>1?`${e.combo} HIT`:`−${e.damage}`,color:e.type==='block'?'#e2e9da':e.color});}}
 draw(match,dt){
  this.time+=dt;const c=this.c;c.save();c.clearRect(0,0,W,H);if(this.shake>0){c.translate((Math.random()-.5)*this.shake,(Math.random()-.5)*this.shake);this.shake=Math.max(0,this.shake-dt*32);}c.drawImage(this.backgrounds[match.arena.id],0,0,W,H);drawArenaMotion(c,match.arena.id,this.time,this.reduced);
  // Arena-specific atmosphere: leaves, petals, fireflies and rising volcanic embers.
  if(!this.reduced)for(let i=0;i<12;i++){const a=match.arena.id,ember=a==='volcano',x=((this.time*(9+i)+i*139)%1200)-40,y=ember?410-((this.time*(15+i)+i*71)%380):(this.time*(5+i*.3)+i*71)%400;const colors={snake:['#cbe8a788','#b5d69a66','#8ca47566'],tiger:['#e4b46c99','#d5a26299','#bea17399'],leopard:['#cfc27899','#b9c58a77','#8ca47599'],dragon:['#d4c1ec77','#c3c5e566','#b9d2e666'],crane:['#f2d4d099','#e4ddcf99','#e8e2dc99'],volcano:['#f4a45bbb','#e6764cbb','#ffd99eaa']};c.fillStyle=colors[a][i%3];c.fillRect(x|0,y|0,ember?2:4,2);}
  if(this.transformPulse>0){this.transformPulse=Math.max(0,this.transformPulse-dt);c.save();c.globalAlpha=this.transformPulse;c.strokeStyle=this.transformColor;c.lineWidth=4;c.beginPath();c.arc(this.transformX,this.transformY,30+(1-this.transformPulse/.65)*100,0,Math.PI*2);c.stroke();c.restore();}
  for(const p of match.fighters){const f=p.form,frames=(p.bossMixed?this.masterCache:this.cache)[f.id];
   if(p.isBoss&&p.hp>0){c.save();c.strokeStyle='#f0d094aa';c.lineWidth=2;c.beginPath();c.ellipse(p.x,FLOOR+7,58,13,0,0,Math.PI*2);c.stroke();c.fillStyle='#f0d094';c.font='18px serif';c.textAlign='center';c.fillText('✦',p.x,p.y-177);c.restore();}c.fillStyle='#1b322950';c.beginPath();c.ellipse(p.x,FLOOR+7,45,9,0,0,Math.PI*2);c.fill();let pose='idle',frame=Math.floor(this.time*5)%8;if(p.hp<=0)pose='ko';else if(p.stun>0&&!p.block)pose='hurt';else if(p.attack){pose=p.attack.type;frame=Math.min(7,Math.floor(p.attack.time/p.attack.duration*8));}else if(p.block)pose='guard';else if(p.airborne)pose='jump';else if(p.walk&&this.lastWalk?.[p.side]!==p.walk){pose='walk';frame=Math.floor(p.walk)%8;}if(!this.lastWalk)this.lastWalk={};this.lastWalk[p.side]=p.walk;
   const facing=p.attack?.facing||p.facing;const scale=f.id==='tiger'?1.67:f.id==='crane'?1.63:1.59;
   if(p.attack?.type==='special'){c.save();c.globalAlpha=.25;c.translate(p.x-facing*25,p.y);c.scale(facing*scale,scale);c.drawImage(frames[pose][frame],-47,-101);c.restore();}
   c.save();c.translate(p.x,p.y);c.scale(facing*scale,scale);c.drawImage(frames[pose][frame],-47,-101);c.restore();
   if(p.attack&&p.attack.time>.08&&p.attack.time<p.attack.duration-.07){const special=p.attack.type==='special';c.save();c.translate(p.x,p.y-85);c.scale(facing,1);c.strokeStyle=f.light;c.lineWidth=special?5:3;c.globalAlpha=.6;const extent=p.attack.time/p.attack.duration;if(special&&(f.id==='dragon'||f.id==='crane')){c.beginPath();c.arc(12,-5,70,-Math.PI*.7+extent,-Math.PI*.7+extent+2.3);c.stroke();c.strokeStyle=f.color;c.lineWidth=2;c.beginPath();c.arc(12,-5,82,-Math.PI*.6+extent,-Math.PI*.6+extent+2.0);c.stroke();}else if(special&&f.id==='tiger'){for(let i=0;i<3;i++){c.beginPath();c.moveTo(49+i*10,-35);c.lineTo(78+i*10,8);c.stroke();}}else{c.fillStyle=f.light;c.fillRect(45,-3,special?70:30,3);c.fillStyle=f.color;c.fillRect(34,6,special?60:22,2);}c.restore();}
   if(p.block){c.strokeStyle='#d4e3ba88';c.lineWidth=2;c.beginPath();c.arc(p.x+p.facing*12,p.y-72,55,p.facing===1?-1.2:1.94,p.facing===1?1.2:4.34);c.stroke();}
  }
  for(const p of this.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=300*dt;c.globalAlpha=Math.max(0,p.life*2);c.fillStyle=p.color;c.fillRect(p.x|0,p.y|0,p.size,p.size);}this.particles=this.particles.filter(p=>p.life>0);c.globalAlpha=1;
  for(const t of this.texts){t.life-=dt;t.y-=dt*30;c.globalAlpha=Math.min(1,Math.max(0,t.life*3));c.font='bold 18px monospace';c.textAlign='center';c.fillStyle='#20382a';c.fillText(t.text,t.x+2,t.y+2);c.fillStyle=t.color;c.fillText(t.text,t.x,t.y);}this.texts=this.texts.filter(t=>t.life>0);c.globalAlpha=1;c.restore();
 }
 drawEnding(formId,beat,time){
  const c=this.c,hero=FORMS.find(f=>f.id===formId),t=this.reduced?0:time;
  c.save();c.clearRect(0,0,W,H);c.drawImage(this.backgrounds.crane,0,0,W,H);drawArenaMotion(c,'crane',t,this.reduced);
  const dawn=c.createLinearGradient(0,0,0,H);dawn.addColorStop(0,'#e4bc7777');dawn.addColorStop(.5,'#223d2d66');dawn.addColorStop(1,'#101c18');c.fillStyle=dawn;c.fillRect(0,0,W,H);
  c.fillStyle='#f4e4ab22';c.beginPath();c.arc(W/2,125,111,0,Math.PI*2);c.fill();c.strokeStyle='#ead79b66';c.lineWidth=1;c.beginPath();c.arc(W/2,125,97,0,Math.PI*2);c.stroke();
  for(let i=0;i<5;i++){
   const f=FORMS[i],x=150+i*205,y=231+Math.abs(i-2)*6;
   c.save();c.globalAlpha=.4;c.translate(x,y);c.scale(x<W/2?1:-1,1);c.drawImage(this.cache[f.id].bow[0],-47,-101);c.restore();
   const angle=Math.PI+(i/4)*Math.PI,xOrb=W/2+Math.cos(angle)*160,yOrb=150+Math.sin(angle)*95;
   c.fillStyle='#152b25c9';c.beginPath();c.arc(xOrb,yOrb,21,0,Math.PI*2);c.fill();c.strokeStyle=f.color;c.stroke();c.fillStyle=f.light;c.font='21px serif';c.textAlign='center';c.fillText(f.han,xOrb,yOrb+7);
  }
  c.fillStyle='#10271c66';c.beginPath();c.ellipse(W/2,274,67,9,0,0,Math.PI*2);c.fill();
  c.save();c.translate(W/2,269);c.scale(1.85,1.85);c.drawImage(this.cache[hero.id][beat===1?'bow':'idle'][Math.floor(t*3)%8],-47,-101);c.restore();
  if(!this.reduced)for(let i=0;i<30;i++){const x=(i*137+t*(8+i%4))%W,y=(i*47+t*(9+i%5))%290;c.fillStyle=i%2?'#e8cc8d99':'#e8e6cc66';c.fillRect(x,y,3,2);}
  const shade=c.createLinearGradient(0,245,0,H);shade.addColorStop(0,'#13221900');shade.addColorStop(.3,'#132219e8');shade.addColorStop(1,'#101b17');c.fillStyle=shade;c.fillRect(0,245,W,H);c.restore();
 }

}

import {Match,FORMS} from './core.js';
import {Renderer} from './render.js';
import {ENDING} from './story-data.js';
import {installShowcaseShortcut} from './showcase-shortcut.js';
const $=id=>document.getElementById(id),renderer=new Renderer($('game'));
let match,started=false,paused=false,ended=false,elapsed=0,endingTime=0,beat=-1,last=null,accumulator=0,announcementTime=0,scriptedHp=300;
function reset(){
 let seed=741;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
 match=new Match('tiger','snake','cpu','normal',random,'volcano',{boss:true});scriptedHp=300;
 // This separate exhibition drives health on a clock so no transformation can
 // be skipped. Match physics, AI, attacks, sprites and phase rules are shared.
 Object.defineProperty(match.fighters[1],'hp',{get:()=>scriptedHp,set:()=>{},configurable:true});
 const hero=match.fighters[0];let heroHp=100;Object.defineProperty(hero,'hp',{get:()=>heroHp,set:value=>{heroHp=Math.max(36,value);},configurable:true});
 started=false;paused=false;ended=false;elapsed=0;endingTime=0;beat=-1;accumulator=0;announcementTime=0;renderer.time=0;renderer.particles=[];renderer.texts=[];renderer.transformPulse=0;renderer.shake=0;
 $('arena').classList.remove('cinematic');$('endingOverlay').hidden=true;$('demoPlace').textContent='CINDER CALDERA · FINAL BOSS';$('announcement').textContent='';$('demoPlay').textContent='WATCH THE FIGHT →';$('demoPlay').hidden=false;$('demoReplay').hidden=true;updateHUD();
}
function start(){if(!started){started=true;match.start();$('demoPlay').textContent='PAUSE Ⅱ';$('demoReplay').hidden=false;}else{paused=!paused;$('demoPlay').textContent=paused?'RESUME ▶':'PAUSE Ⅱ';}last=null;}
function updateHUD(){
 const boss=match.fighters[1],hero=match.fighters[0];$('bossName').textContent=boss.bossMixed?'GOLDEN MASTER':`MASTER · ${boss.form.name.toUpperCase()}`;$('bossHealth').style.width=`${scriptedHp/3}%`;$('heroHealth').style.width=`${hero.hp}%`;
 $('bossHealth').closest('.fighter-hud').style.setProperty('--fighter',boss.bossMixed?'#f5cc60':boss.form.color);$('heroHealth').closest('.fighter-hud').style.setProperty('--fighter',hero.form.color);
 $('bossNote').textContent=boss.bossMixed?`ALL FIVE STYLES · ${boss.form.name.toUpperCase()} TECHNIQUE · +2%`:`${boss.form.name.toUpperCase()} FORM · +2% SPEED`;
 document.querySelectorAll('.demo-path>span').forEach((el,i)=>{el.classList.toggle('current',!ended&&i===boss.bossPhase);el.classList.toggle('passed',ended||i<boss.bossPhase);});
 $('demoStatus').textContent=ended?'Victory. The path to mastery is complete.':paused?'Showcase paused.':!started?'Ready to begin · about one minute.':match.phase==='countdown'?'The final trial begins.':boss.bossMixed?`Golden Master · ${match.floorGaps.length} floor gap${match.floorGaps.length===1?'':'s'} · ${Math.ceil(scriptedHp/3)}% health`:`${boss.form.name} form · ${Math.ceil(scriptedHp/3)}% health`;
}
function showEnding(){
 const next=Math.min(2,Math.floor(endingTime/6));if(next===beat)return;beat=next;const b=ENDING[beat];$('endingOverlay').innerHTML=`<div class="ending-pages">${ENDING.map((_,i)=>`<i class="${i===beat?'active':''}"></i>`).join('')}</div><span class="overline">${b.eyebrow}</span><h2>${b.title}</h2><p>${b.text}</p>${beat===2?'<div class="ending-actions"><a class="primary-button" href="./">BEGIN YOUR OWN JOURNEY ↗</a></div>':''}`;
}
function heroInputs(){const [a,b]=match.fighters,dx=b.x-a.x,far=Math.abs(dx)>75;return match.avoidFloorGaps(a,{left:far&&dx<0,right:far&&dx>0,strike:Math.floor(elapsed*2)%3!==0,kick:Math.floor(elapsed*2)%3===0,special:Math.floor(elapsed*2)%7===0,jump:elapsed%8>.1&&elapsed%8<.15});}
function tick(dt){
 if(ended){endingTime+=dt;showEnding();return;}
 if(match.phase==='fight'){
  elapsed+=dt;
  // Five seconds for each animal form, then fifteen for the Golden Master.
  scriptedHp=elapsed<25?300-elapsed*6:Math.max(0,150-(elapsed-25)*10);
 }
 match.update(dt,[heroInputs(),{}]);
 for(const event of match.events.splice(0)){
  renderer.event(event);if(event.type==='transform'){$('announcement').innerHTML=`<small>THE MASTER CHANGES${event.floorCracked?' · FLOOR CRACKING':''}</small><span class="form-announcement">${event.name.toUpperCase()}</span>`;announcementTime=1.2;}
  if(event.type==='floor-crack'){$('announcement').innerHTML='<small>THE FLOOR IS BREAKING</small><span class="form-announcement">JUMP THE GAPS</span>';announcementTime=1.2;}
  if(event.type==='fight'){$('announcement').textContent='FIGHT';announcementTime=.7;}
 }
 if(match.phase==='countdown')$('announcement').innerHTML=`<small>FINAL TRIAL</small>${Math.max(1,Math.ceil(match.timer))}`;
 else if(match.phase==='ko')$('announcement').textContent='VICTORY';
 else if(announcementTime>0){announcementTime-=dt;if(announcementTime<=0)$('announcement').textContent='';}
 if(match.phase==='over'){
  ended=true;endingTime=0;$('arena').classList.add('cinematic');$('endingOverlay').hidden=false;$('demoPlace').textContent='THE TEMPLE · DAWN';showEnding();
 }
}
function loop(now){const dt=last===null?0:Math.min((now-last)/1000,.05);last=now;
 if(started&&!paused&&!document.hidden){accumulator+=dt;while(accumulator>=1/60){tick(1/60);accumulator-=1/60;}}
 if(ended)renderer.drawEnding('tiger',beat,endingTime);else renderer.draw(match,started&&!paused&&!document.hidden?dt:0);
 updateHUD();requestAnimationFrame(loop);
}
$('demoPlay').onclick=start;$('demoReplay').onclick=()=>{reset();start();};document.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();if(started)start();}});document.addEventListener('visibilitychange',()=>{last=null;});
reset();installShowcaseShortcut();if(new URLSearchParams(location.search).get('autoplay')==='1')start();requestAnimationFrame(loop);

import {getArena, HOME_SPEED_MULTIPLIER} from './arena-data.js';
import {BOSS_FORMS,BOSS_MIX_STYLES,BOSS_MAX_HEALTH,BOSS_SPEED_MULTIPLIER,bossPhaseForHealth} from './story-data.js';
import {createBossGap,bossGapCountForHealth,BOSS_FALL_DAMAGE_RATIO} from './boss-floor.js';
export const W=1120,H=500,FLOOR=414;
export const FORMS=[
 {id:'snake',name:'Snake',han:'蛇',role:'The precision fighter',trait:'Precision · Fluidity',color:'#9bc7a2',dark:'#3c6555',light:'#d4e5b4',speed:235,power:0.95,reach:100,jump:560,stats:[3,4,5],special:'Serpent’s Reach',specialText:'A swift, long-reaching palm lunge.',strike:'Spear palm',kick:'Low sweep',description:'Fluid, direct palm techniques inspire a patient fighter who controls distance and strikes through an opening.',specialDamage:22},
 {id:'tiger',name:'Tiger',han:'虎',role:'The relentless powerhouse',trait:'Power · Pressure',color:'#e5a16f',dark:'#92472f',light:'#ffd19b',speed:195,power:1.25,reach:78,jump:515,stats:[5,2,3],special:'Tiger Pounce',specialText:'A heavy forward claw with strong knockback.',strike:'Tiger claw',kick:'Driving kick',description:'Forceful claws and pressing footwork inspire a powerful, grounded fighter with deliberate, heavy attacks.',specialDamage:29},
 {id:'leopard',name:'Leopard',han:'豹',role:'The lightning-fast striker',trait:'Speed · Combinations',color:'#e5c66c',dark:'#92723c',light:'#fff0b2',speed:280,power:0.88,reach:76,jump:540,stats:[3,5,2],special:'Leopard Rush',specialText:'A quick dash into a three-strike combination.',strike:'Leopard fist',kick:'Snap kick',description:'Compact punches and agile footwork inspire the fastest fighter, built for short bursts and close combinations.',specialDamage:10},
 {id:'dragon',name:'Dragon',han:'龍',role:'The flowing all-rounder',trait:'Flow · Adaptability',color:'#b6a1dc',dark:'#665082',light:'#e2d3f7',speed:215,power:1.05,reach:91,jump:550,stats:[4,3,4],special:'Rising Dragon',specialText:'A turning palm that lifts you into an arc.',strike:'Turning palm',kick:'Circle kick',description:'Circular movement and fluid transitions inspire an adaptable fighter whose rising palm covers a wide arc.',specialDamage:25},
 {id:'crane',name:'Crane',han:'鹤',role:'The graceful counter-fighter',trait:'Balance · Reach',color:'#b7d1dd',dark:'#667c91',light:'#eff2e5',speed:225,power:0.94,reach:117,jump:630,stats:[2,4,5],special:'Crane Ascends',specialText:'An airborne, long-reaching wing kick.',strike:'Crane beak',kick:'Wing kick',description:'Balanced postures, extended arms and elegant kicks inspire a light-footed fighter with exceptional reach and height.',specialDamage:23}
];
export class Fighter{
 constructor(form,x,side){this.form=FORMS.find(f=>f.id===form)||FORMS[1];this.side=side;this.x=x;this.y=FLOOR;this.vx=0;this.vy=0;this.facing=side===0?1:-1;this.maxHp=100;this.hp=100;this.lives=3;this.isBoss=false;this.bossPhase=0;this.bossMixed=false;this.mixedMoveIndex=0;this.chi=60;this.attack=null;this.cooldown=0;this.stun=0;this.invulnerable=0;this.block=false;this.walk=0;this.combo=0;this.comboTimer=0;this.specialCooldown=0;}
 get airborne(){return this.y<FLOOR-2||!!this.falling;}
}
export class Match{
 constructor(a='tiger',b='dragon',mode='cpu',difficulty='normal',random=Math.random,arena='volcano',options={}){this.bossBattle=!!options.boss;this.arena=getArena(arena);this.mode=mode;this.difficulty=difficulty;this.random=random;this.fighters=[new Fighter(a,310,0),new Fighter(b,810,1)];this.phase='ready';this.timer=0;this.round=1;this.events=[];this.winner=null;this.aiTimer=0;this.aiAction={};this.elapsed=0;if(this.bossBattle){const boss=this.fighters[1];boss.isBoss=true;boss.maxHp=BOSS_MAX_HEALTH;boss.hp=boss.maxHp;boss.lives=1;boss.form=FORMS.find(f=>f.id===BOSS_FORMS[0]);}}
 movementMultiplier(p){if(p.isBoss)return BOSS_SPEED_MULTIPLIER;return this.arena.home===p.form.id?HOME_SPEED_MULTIPLIER:1;}
 floorGaps=[];
 floorGapAt(x,includeWarnings=false){return this.floorGaps.find(g=>(includeWarnings||g.warning<=0)&&x>g.x&&x<g.x+g.width);}
 updateFloor(dt){
  for(const gap of this.floorGaps){
   if(gap.warning<=0)continue;
   gap.warning=Math.max(0,gap.warning-dt);
   if(gap.warning===0)this.events.push({type:'floor-break',x:gap.x+gap.width/2,y:FLOOR,width:gap.width});
  }
 }
 safeLedge(x){
  const candidates=[x,310,810,...this.floorGaps.flatMap(g=>[g.x-26,g.x+g.width+26])];
  return candidates.filter(at=>at>=45&&at<=W-45&&!this.floorGaps.some(g=>at>g.x-24&&at<g.x+g.width+24))
   .sort((a,b)=>Math.abs(a-x)-Math.abs(b-x))[0];
 }
 recoverFromFall(p){
  const damage=Math.round(p.maxHp*BOSS_FALL_DAMAGE_RATIO);
  p.hp=Math.max(0,p.hp-damage);p.x=this.safeLedge(p.x);p.y=FLOOR;p.vx=0;p.vy=0;p.falling=false;p.gapJumpDirection=0;
  p.attack=null;p.block=false;p.stun=.25;p.invulnerable=1;
  this.events.push({type:'fall',x:p.x,y:FLOOR-70,damage,side:p.side});
  this.syncBossForm(p);
 }
 avoidFloorGaps(p,input){
  if(!this.floorGaps.length||p.falling)return input;
  let direction=p.gapJumpDirection||((input.right?1:0)-(input.left?1:0));
  if(!direction&&this.floorGapAt(p.x,true))direction=this.safeLedge(p.x)>p.x?1:-1;
  const gap=this.floorGapAt(p.x,true)||this.floorGapAt(p.x+direction*36,true);
  if(direction&&(p.gapJumpDirection||gap)){
   if(!p.gapJumpDirection)p.gapJumpTarget=direction>0?gap.x+gap.width+24:gap.x-24;
   p.gapJumpDirection=direction;
   const moving=direction>0?p.x<p.gapJumpTarget:p.x>p.gapJumpTarget;
   return {...input,left:moving&&direction<0,right:moving&&direction>0,jump:!p.airborne,guard:false,strike:false,kick:false,special:false};
  }
  return input;
 }
 syncBossForm(p){
  if(!p.isBoss||p.hp<=0)return;
  // Floor damage follows health independently, including during Golden Master.
  const gapCount=bossGapCountForHealth(p.hp,p.maxHp),floorCracked=gapCount>this.floorGaps.length;
  while(this.floorGaps.length<gapCount)this.floorGaps.push(createBossGap(this.floorGaps.length+1));
  if(floorCracked)this.events.push({type:'floor-crack'});
  const phase=bossPhaseForHealth(p.hp,p.maxHp);if(phase<=p.bossPhase)return;
  p.bossPhase=phase;p.bossMixed=BOSS_FORMS[phase]==='mixed';p.mixedMoveIndex=0;p.form=FORMS.find(f=>f.id===(p.bossMixed?BOSS_MIX_STYLES[0]:BOSS_FORMS[phase]));p.attack=null;p.block=false;p.cooldown=Math.max(p.cooldown,.45);p.invulnerable=Math.max(p.invulnerable,.35);this.aiTimer=0;this.aiAction={};
  this.events.push({type:'transform',form:p.bossMixed?'mixed':p.form.id,name:p.bossMixed?'Golden Master':p.form.name,color:p.bossMixed?'#e4ce97':p.form.color,x:p.x,y:p.y,phase,floorCracked});
 }
 start(){this.phase='countdown';this.timer=2.4;this.events.push({type:'start'});}
 command(p,input,dt){
  if(p.stun>0||p.falling)return;
  p.block=!!input.guard&&!p.airborne&&!p.attack;
  if(!p.attack){
   const direction=(input.right?1:0)-(input.left?1:0);p.x+=direction*p.form.speed*this.movementMultiplier(p)*(p.block?0.3:1)*dt;if(direction)p.walk+=dt*11;
   if(input.jump&&!p.airborne&&!p.block&&!this.floorGapAt(p.x)){p.vy=-p.form.jump;p.y-=1;this.events.push({type:'jump',x:p.x,y:p.y});}
   if(!p.block){if(input.special)this.beginAttack(p,'special');else if(input.kick)this.beginAttack(p,'kick');else if(input.strike)this.beginAttack(p,'strike');}
  }
 }
 beginAttack(p,type){
  if(p.cooldown>0||p.stun>0||p.attack||p.falling)return false;
  if(type==='special'&&(p.chi<40||p.specialCooldown>0))return false;
  // In the final phase, every accepted attack advances through all five disciplines.
  if(p.bossMixed){p.form=FORMS.find(f=>f.id===BOSS_MIX_STYLES[p.mixedMoveIndex%BOSS_MIX_STYLES.length]);p.mixedMoveIndex++;}
  const special=type==='special';
  const duration=special?0.60:type==='kick'?0.43:0.29;
  p.attack={type,time:0,duration,hits:new Set(),facing:p.facing};p.cooldown=duration+(type==='strike'?0.1:0.18);
  if(special){p.chi-=40;p.specialCooldown=1.5;if(p.form.id==='crane'||p.form.id==='dragon'){p.vy=p.form.id==='crane'?-400:-280;p.y-=2;}}
  this.events.push({type:'attack',side:p.side,attack:type,form:p.form.id,x:p.x,y:p.y});return true;
 }
 ai(dt){
  const p=this.fighters[1],enemy=this.fighters[0],distance=Math.abs(p.x-enemy.x),dir=enemy.x>p.x;
  this.aiTimer-=dt;
  if(this.aiTimer<=0){
   const diff=this.difficulty==='easy'?0.65:this.difficulty==='hard'?1.25:1;
   this.aiTimer=(0.12+this.random()*0.2)/diff;
   const danger=enemy.attack&&distance<150;
   const guard=!!danger&&this.random()<(this.difficulty==='hard'?0.7:this.difficulty==='easy'?0.2:0.43);
   const retreat=!danger&&distance<65&&this.random()<0.22;
   const approach=distance>p.form.reach-10&&!guard;
   const action=this.random(),attackChance=this.difficulty==='easy'?0.46:this.difficulty==='hard'?0.94:0.72;
   this.aiAction={left:(approach&&!dir)||(retreat&&dir),right:(approach&&dir)||(retreat&&!dir),guard,jump:distance<210&&this.random()<0.08*diff,strike:distance<p.form.reach+12&&action<attackChance*0.58,kick:distance<p.form.reach+30&&action>=attackChance*0.58&&action<attackChance,special:distance<210&&distance>50&&this.random()<0.2*diff};
  }return this.avoidFloorGaps(p,this.aiAction);
 }
 update(dt,inputs=[{},{}]){
  dt=Math.min(dt,0.033);this.elapsed+=dt;
  if(this.phase==='paused'||this.phase==='ready'||this.phase==='over')return;
  if(this.phase==='countdown'||this.phase==='ko'){
   this.timer-=dt;
   if(this.timer<=0){if(this.phase==='ko'){if(this.fighters.some(p=>p.lives<=0)){this.phase='over';this.winner=this.fighters[0].lives===0&&this.fighters[1].lives===0?-1:this.fighters[0].lives>0?0:1;this.events.push({type:'over'});return;}this.resetRound();}else{this.phase='fight';this.events.push({type:'fight'});}}return;
  }
  this.updateFloor(dt);
  const controls=[inputs[0]||{},this.mode==='cpu'?this.ai(dt):inputs[1]||{}];
  for(let i=0;i<2;i++){
   const p=this.fighters[i],other=this.fighters[1-i];
   this.syncBossForm(p);
   p.facing=other.x>=p.x?1:-1;p.cooldown=Math.max(0,p.cooldown-dt);p.specialCooldown=Math.max(0,p.specialCooldown-dt);p.stun=Math.max(0,p.stun-dt);p.invulnerable=Math.max(0,p.invulnerable-dt);p.comboTimer-=dt;if(p.comboTimer<=0)p.combo=0;p.chi=Math.min(100,p.chi+dt*6.5);
   this.command(p,controls[i],dt);
   p.x+=p.vx*dt;p.vx*=Math.pow(0.005,dt);p.vy+=1450*dt;p.y+=p.vy*dt;
   if(p.y>=FLOOR&&!p.falling&&!this.floorGapAt(p.x)){p.y=FLOOR;p.vy=0;}
   if(p.attack){
    const atk=p.attack;atk.time+=dt;const special=atk.type==='special';
    if(special&&atk.time<0.3){const speeds={snake:390,tiger:270,leopard:450,dragon:150,crane:220};p.x+=atk.facing*speeds[p.form.id]*this.movementMultiplier(p)*dt;}
    if(atk.time>atk.duration){p.attack=null;}else{
     const active=atk.time>=0.09&&atk.time<atk.duration-0.08;
     const window=special&&p.form.id==='leopard'?Math.floor((atk.time-0.09)/0.14):0;
     const range=p.form.reach+(atk.type==='kick'?25:special?35:0);
     const dx=(other.x-p.x)*atk.facing;const dy=Math.abs(other.y-p.y);
     if(active&&dx>-16&&dx<range&&dy<(special?150:90)&&!atk.hits.has(window)&&other.invulnerable<=0){
      atk.hits.add(window);this.hit(p,other,atk);
     }
    }
   }
   p.x=Math.max(45,Math.min(W-45,p.x));
  }
  const [a,b]=this.fighters,dx=b.x-a.x;
  if(Math.abs(dx)<44&&Math.abs(a.y-b.y)<90){const dir=dx>=0?1:-1,shift=(44-Math.abs(dx))/2;a.x=Math.max(45,Math.min(W-45,a.x-shift*dir));b.x=Math.max(45,Math.min(W-45,b.x+shift*dir));}
  for(const p of this.fighters){
   if(p.y>=FLOOR){
    if(this.floorGapAt(p.x)||p.falling){p.falling=true;p.block=false;p.attack=null;}
    else{p.y=FLOOR;p.vy=0;p.gapJumpDirection=0;}
   }
   if(p.y>H+120)this.recoverFromFall(p);
  }
  if(this.fighters.some(p=>p.hp<=0)){for(const p of this.fighters){if(p.hp<=0){p.lives--;this.events.push({type:'ko',side:p.side});}p.attack=null;}this.phase='ko';this.timer=1.8;}
 }
 hit(p,other,atk){
  const special=atk.type==='special';const blocked=other.block&&other.facing===-atk.facing&&!other.airborne;
  const base=special?p.form.specialDamage:atk.type==='kick'?14:9;
  const damage=Math.round(base*(special?1:p.form.power)*(blocked?0.17:1));other.hp=Math.max(0,other.hp-damage);
  other.vx=atk.facing*(blocked?90:special?310:150);other.stun=blocked?0.1:special?0.24:0.16;
  if(!blocked){other.attack=null;p.combo++;p.comboTimer=1.2;}
  p.chi=Math.min(100,p.chi+(blocked?2:5));other.chi=Math.min(100,other.chi+4);
  this.events.push({type:blocked?'block':'hit',x:(p.x+other.x)/2,y:other.y-80,color:p.form.color,damage,side:p.side,special,combo:p.combo});
  this.syncBossForm(other);
 }
 resetRound(){this.round++;for(const [i,p]of this.fighters.entries()){if(!p.isBoss)p.hp=p.maxHp;p.x=i===0?310:810;p.facing=i===0?1:-1;p.y=FLOOR;p.vx=0;p.vy=0;p.falling=false;p.gapJumpDirection=0;p.attack=null;p.cooldown=0;p.stun=0;p.invulnerable=0;p.block=false;p.chi=Math.max(40,p.chi);p.combo=0;}this.phase='countdown';this.timer=2;this.aiAction={};}
 pause(){if(this.phase==='paused'){this.phase=this.previousPhase;return;}if(['fight','countdown','ko'].includes(this.phase)){this.previousPhase=this.phase;this.phase='paused';}}
}

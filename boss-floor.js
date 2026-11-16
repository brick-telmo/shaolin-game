// Small, separated gaps leave landing room for even the slowest fighter.
// The two round-start positions (310 and 810) always remain solid.
export const BOSS_GAP_CENTERS = [560,400,720];
export const BOSS_GAP_WIDTH = 64;
export const BOSS_GAP_WARNING = 0.9;
export const BOSS_FALL_DAMAGE_RATIO = 0.2;

export function bossGapCountForHealth(hp,maxHp) {
 return Math.min(BOSS_GAP_CENTERS.length,Math.max(0,Math.floor((1-hp/maxHp)/.3+1e-9)));
}

export function createBossGap(number) {
 return {x:BOSS_GAP_CENTERS[number-1]-BOSS_GAP_WIDTH/2,width:BOSS_GAP_WIDTH,warning:BOSS_GAP_WARNING};
}

export function drawBossFloor(c,gaps,floor,time,reduced=false) {
 for(const gap of gaps){
  const {x,width,warning}=gap,end=x+width;
  c.save();
  if(warning>0){
   // Cracks telegraph the exact section that is about to collapse.
   c.fillStyle='#ffb35a33';c.fillRect(x,floor,width,22);
   c.strokeStyle='#ffcb75';c.lineWidth=3;c.beginPath();
   c.moveTo(x,floor+2);c.lineTo(x+14,floor+8);c.lineTo(x+25,floor+3);c.lineTo(x+37,floor+13);c.lineTo(end,floor+4);c.stroke();
   c.beginPath();c.moveTo(x+25,floor+3);c.lineTo(x+20,floor+23);c.lineTo(x+32,floor+36);c.stroke();
   c.fillStyle='#ffdb91';c.font='bold 12px monospace';c.textAlign='center';c.fillText('!',x+width/2,floor-12);
  }else{
   c.fillStyle='#160e12';c.fillRect(x,floor,width,500-floor);
   const glow=c.createLinearGradient(0,floor,0,500);glow.addColorStop(0,'#431d1700');glow.addColorStop(.6,'#9c382d');glow.addColorStop(1,'#ee873e');c.fillStyle=glow;c.fillRect(x,floor,width,500-floor);
   // Ragged basalt edges and exposed layers make the missing floor readable.
   c.fillStyle='#3b302c';
   for(let row=0;row<6;row++){const y=floor+row*15,lip=4+(row%3)*3;c.fillRect(x,y,lip,10);c.fillRect(end-lip,y+5,lip,10);}
   c.fillStyle='#d99262';c.fillRect(x-4,floor-2,8,4);c.fillRect(end-4,floor-2,8,4);
   c.fillStyle='#ffcd76';
   for(let i=0;i<3;i++){const rise=reduced?i*17:(time*(15+i*7)+i*23)%65;c.fillRect(x+16+i*15,495-rise,2,3);}
  }
  c.restore();
 }
}

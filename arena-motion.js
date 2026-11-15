import {drawArenaAnimals} from './arenas.js';
export const ARENA_ELEMENTS={snake:['air','water'],tiger:['air','fire','earth'],leopard:['air','earth'],dragon:['air','water','earth'],crane:['air','water'],volcano:['air','fire','earth']};

// All motion shares the game's clock: pause freezes it; reduced-motion fixes it.
export function drawArenaMotion(c,id,time,reduced=false){
 const t=reduced?0:time;
 c.save();c.scale(2,2);
 const line=(points,color,width=1)=>{c.strokeStyle=color;c.lineWidth=width;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(Math.round(x),Math.round(y)):c.moveTo(Math.round(x),Math.round(y)));c.stroke();};
 const rect=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),w,h);};
 const flame=(x,y,color='#eab56c')=>{const flicker=Math.sin(t*7+x);c.fillStyle=color+'22';c.beginPath();c.ellipse(x,y-5,12+flicker,16,0,0,Math.PI*2);c.fill();c.fillStyle=color;c.beginPath();c.moveTo(x-4,y);c.lineTo(x-3,y-8);c.lineTo(x+Math.sin(t*5+x)*2,y-15-flicker*3);c.lineTo(x+4,y-5);c.lineTo(x+3,y);c.fill();rect(x-1,y-7,2,7,'#fff0b3');};
 // Air: mist, wind ribbons and a moving bank of cloud.
 if(id!=='volcano')for(let i=0;i<4;i++){
  const x=((t*(3+i)+i*157)%710)-110,y=(id==='dragon'?151:128)+i*12;
  rect(x,y,78+i*8,2,id==='dragon'?'#e2d8ef25':'#e2e5cb12');rect(x+18,y-3,38+i*7,2,'#e0e4ce10');
 }
 // Water: expanding ripples and highlights, confined to the pools/lake.
 if(id==='snake'||id==='crane')for(let i=0;i<12;i++){
  const phase=(t*.2+i*.137)%1,x=35+i*45,y=175+(i%4)*7,rx=3+phase*15;
  c.globalAlpha=(1-phase)*.45;c.strokeStyle=id==='crane'?'#efd5ce':'#bddab7';c.lineWidth=.6;c.beginPath();c.ellipse(x,y,rx,1+phase*2,0,0,Math.PI*2);c.stroke();
 }c.globalAlpha=1;
 // Earth: loose sand sweeps past the stone courts; jungle roots stir with it.
 if(id==='tiger'||id==='leopard')for(let i=0;i<17;i++){
  const x=(i*37+t*(4+i%3))%560,y=202-Math.abs(Math.sin(t*.6+i))*5;
  rect(x,y,2,1,id==='tiger'?'#d8ba7750':'#b6bb7550');
 }
 if(id==='leopard')for(const x of [91,165,390,472])line([[x,99],[x-8+Math.sin(t+x)*3,121],[x-3+Math.sin(t+x)*5,133]],'#89975a',1);
 if(id==='snake')for(const x of [27,47,526])line([[x,65],[x+Math.sin(t*.8+x)*5+14,51],[x+Math.sin(t*.8+x)*7+24,48]],'#78a47580',1);
 if(id==='tiger')for(const x of [86,474]){rect(x-4,193,8,12,'#594b37');rect(x-7,190,14,3,'#9f8654');flame(x,190);}
 if(id==='dragon'){
  // Water falls through cloud; earth rises around the shrine's pearl.
  for(let i=0;i<22;i++){const x=(i*53+t*12)%560,y=(i*19+t*51)%201;line([[x,y],[x-2,y+5]],'#c9d0ea22');}
  for(let i=0;i<5;i++){const a=t*.45+i*Math.PI*2/5,x=283+Math.cos(a)*25,y=103+Math.sin(a)*13;rect(x,y,4,3,'#bfc1ca80');}
  for(const x of [44,511])flame(x,195,'#d8b4ed');
 }
 if(id==='crane')for(const x of [24,66,485,541])line([[x,190],[x+Math.sin(t*.9+x)*3,176],[x+2+Math.sin(t*.9+x)*5,160]],'#819f9188',1);
 if(id==='volcano'){
  // Fire streams down the crater; hot ash rises and earth fragments fall.
  const paths=[[[263,81],[257,106],[268,130],[251,157],[266,182],[259,202]],[[292,81],[304,101],[300,125],[320,148],[329,175],[359,201]]];
  paths.forEach((path,j)=>{line(path,`rgba(255,197,109,${.25+Math.sin(t*2+j)*.15})`,3-j);for(let k=0;k<8;k++){const phase=(t*.35+k*.64+j)%5,idx=Math.floor(phase),f=phase-idx,a=path[idx],b=path[idx+1];rect(a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f,2,2,'#ffe2a999');}});
  for(let i=0;i<10;i++){const rise=(t*9+i*7)%78,x=278-rise*.35+Math.sin(i+t*.5)*10,y=76-rise;c.fillStyle='#a77e7a18';c.beginPath();c.ellipse(x,y,10+rise*.19,5+rise*.1,0,0,Math.PI*2);c.fill();}
  for(let i=0;i<8;i++){const f=(t*.22+i*.13)%1,x=280+(i%2?1:-1)*(20+f*80),y=79-f*105+f*f*200;rect(x,y,2,2,i%3?'#eeba7999':'#493b40');}
  for(let i=0;i<14;i++)rect((i*43+t*6)%560,194+i%8,8+Math.sin(t+i)*4,1,'#ffb87466');
 }
 drawArenaAnimals(c,id,t);
 c.restore();
}

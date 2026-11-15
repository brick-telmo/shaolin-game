// Original pixel-art arena illustrations, drawn at half resolution then scaled.
// Every foreground meets the same floor at y=207; scenery is non-colliding.
import {ARENAS,getArena} from './arena-data.js';
export {ARENAS};
function seeded(seed){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};}
export function createBackground(id='volcano',{omitAnimals=false}={}){
 const arena=getArena(id),canvas=Object.assign(document.createElement('canvas'),{width:560,height:250}),c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
 const random=seeded(741+ARENAS.indexOf(arena)*139);
 const r=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
 const p=(points,color)=>{c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(Math.round(x),Math.round(y)):c.moveTo(Math.round(x),Math.round(y)));c.closePath();c.fill();};
 const line=(points,color,width=1)=>{c.strokeStyle=color;c.lineWidth=width;c.lineCap='square';c.lineJoin='miter';c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(Math.round(x),Math.round(y)):c.moveTo(Math.round(x),Math.round(y)));c.stroke();};
 const ellipse=(x,y,rx,ry,color)=>{c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();};
 const sky=(top,bottom)=>{const g=c.createLinearGradient(0,0,0,210);g.addColorStop(0,top);g.addColorStop(1,bottom);c.fillStyle=g;c.fillRect(0,0,560,250);};
 const sun=(x,y,size,color)=>{r(x-size*.35,y-size*.5,size*.7,size,color);r(x-size*.5,y-size*.35,size,size*.7,color);};
 const mountain=(points,color)=>p([...points,[560,209],[0,209]],color);
 const cloud=(x,y,w,color)=>{r(x,y,w,3,color);r(x+w*.12,y-3,w*.67,3,color);r(x+w*.3,y-6,w*.35,3,color);};
 const foliage=(x,y,w,h,colors,count=90)=>{for(let i=0;i<count;i++){const xx=x+random()*w,yy=y+random()*h;if(((xx-x-w/2)/(w/2))**2+((yy-y-h/2)/(h/2))**2<1.2)r(xx,yy,4+random()*12,2+random()*7,colors[i%colors.length]);}};
 const bamboo=(x,top,color,leaf)=>{r(x,top,3,204-top,color);for(let y=top+12;y<201;y+=20){r(x-1,y,5,2,leaf);p([[x,y+4],[x-24,y-10],[x-14,y+2]],leaf);p([[x+2,y+2],[x+22,y-14],[x+13,y+1]],leaf);}};
 const platform=(base,light,dark,moss)=>{r(0,207,560,43,base);r(0,207,560,3,light);r(0,210,560,2,dark);for(let row=0;row<4;row++){const y=214+row*11;r(0,y+9,560,1,dark);for(let x=(row%2)*-35;x<560;x+=70){r(x,y,1,9,dark);r(x+2,y,65,1,light+'77');}}for(let i=0;i<190;i++)r(random()*560,213+random()*37,1+random()*3,1,i%3?dark+'55':light+'66');if(moss)for(let i=0;i<35;i++)r(random()<.5?random()*70:490+random()*70,209+random()*35,2+random()*7,2,moss);};
 const lantern=(x,y,color)=>{r(x,y-7,1,7,'#3a3c34');r(x-4,y,9,13,color);r(x-5,y+3,11,7,color);r(x-3,y+3,2,6,'#f3d699');r(x-4,y-1,9,2,'#d2b172');r(x,y+13,1,6,'#b69a66');};
 const plaque=(x,y,symbol,color,bg)=>{r(x-13,y-11,26,22,bg);r(x-12,y-10,24,1,color);r(x-12,y+10,24,1,color);c.font='16px serif';c.textAlign='center';c.fillStyle=color;c.fillText(symbol,x,y+6);};
 const roof=(x,y,w,base,light)=>{p([[x-10,y+10],[x+9,y+10],[x+25,y+2],[x+34,y-8],[x+w-34,y-8],[x+w-25,y+2],[x+w-9,y+10],[x+w+10,y+10],[x+w+2,y+18],[x-2,y+18]],base);r(x,y+13,w,3,light);for(let xx=x+30;xx<x+w-25;xx+=8){r(xx,y-3,2,11,light+'88');}r(x+33,y-10,w-66,3,light);};
 if(arena.id==='snake'){
  sky('#304d48','#a0b5a0');sun(390,58,35,'#c8d5b1');
  mountain([[0,138],[40,116],[67,125],[105,76],[122,90],[151,63],[183,120],[226,145],[274,107],[305,87],[339,127],[378,140],[422,93],[459,112],[487,82],[524,123],[560,114]],'#607f70');
  mountain([[0,164],[59,133],[108,152],[142,121],[188,165],[244,151],[298,168],[366,140],[430,168],[510,130],[560,157]],'#456b5b');
  for(let x=0;x<570;x+=19)bamboo(x,88+random()*55,'#3b6554','#4b7e61');
  r(0,171,560,36,'#426e61');for(let i=0;i<65;i++)r(random()*560,173+random()*32,7+random()*36,1,i%3?'#82a38b66':'#b9c6a977');
  if(!omitAnimals)drawArenaAnimals(c,'snake',0);
  // Curving root path, lotus flowers and arching vines.
  p([[0,193],[83,186],[129,191],[172,185],[208,194],[255,200],[560,196],[560,208],[0,208]],'#5c7c5e');
  for(const [x,y]of [[91,180],[138,193],[405,184],[469,196]]){ellipse(x,y,11,3,'#7da36e');r(x-2,y-7,5,7,'#d3b1ba');r(x-5,y-4,11,3,'#eed4d0');}
  for(const x of [8,27,47,526,547])bamboo(x,3+random()*22,'#24483d','#568360');
  line([[43,0],[68,26],[65,51],[84,73],[80,97]],'#375e43',3);line([[505,0],[483,34],[491,62],[475,89]],'#375e43',3);
  cloud(80,160,142,'#c8d8b528');cloud(350,169,170,'#c8d8b530');platform('#5f7967','#a4b697','#344f43','#426e43');
 }
 if(arena.id==='tiger'){
  sky('#8e7258','#e6bb82');sun(373,62,50,'#f5d59b');
  mountain([[0,120],[38,108],[39,84],[73,84],[78,107],[108,112],[118,71],[156,71],[163,106],[199,127],[240,114],[275,146],[308,126],[353,132],[390,99],[397,79],[443,79],[449,111],[484,128],[509,95],[560,95]],'#af8b66');
  mountain([[0,151],[61,123],[114,147],[165,111],[209,147],[266,157],[317,130],[373,153],[430,120],[472,143],[560,121]],'#7f7052');
  r(0,176,560,31,'#6d6b49');for(let i=0;i<100;i++)r(random()*560,172+random()*28,4+random()*9,2,['#8b8053','#a18e57','#786e48'][i%3]);
  // Broad vermilion gate with tiger insignia.
  for(const x of [222,330]){r(x,102,12,95,'#633f30');r(x+2,105,4,87,'#ad6b42');r(x-4,195,20,9,'#b7a47a');}
  r(220,107,125,11,'#754b32');r(234,116,96,3,'#c69458');roof(199,89,165,'#414c3b','#a59662');plaque(283,114,'虎','#f1ce86','#6d492c');lantern(240,132,'#bb7344');lantern(324,132,'#bb7344');
  if(!omitAnimals)drawArenaAnimals(c,'tiger',0);
  // Autumn branches frame the court in amber.
  p([[0,0],[17,0],[22,91],[15,153],[23,208],[7,208],[5,145]],'#3e4432');line([[11,57],[52,26],[111,15]],'#4e4b32',9);line([[557,145],[538,69],[510,29],[458,5]],'#464a33',9);
  foliage(-20,-11,180,70,['#7c743d','#a48b46','#bf994f','#d0aa5d'],190);foliage(443,-13,145,75,['#817240','#ad8c45','#d0a453'],140);
  platform('#8f8465','#cabb92','#5c604a','#8a8150');for(let i=0;i<45;i++)r(random()*560,211+random()*35,3,1,'#d7ad61');
 }
 if(arena.id==='leopard'){
  sky('#777d47','#d5bd73');for(let i=0;i<6;i++)p([[70+i*91,0],[84+i*91,0],[211+i*54,206],[168+i*54,206]],'#f2d78a12');
  mountain([[0,139],[70,99],[121,132],[175,85],[218,135],[280,115],[330,146],[390,101],[448,133],[509,86],[560,115]],'#879258');
  for(let i=0;i<13;i++){const x=i*48+random()*14;r(x,34,9,172,'#5b7042');foliage(x-30,25,98,54,['#6e8448','#819052','#97a05c'],60);}
  r(0,187,560,20,'#435e3c');
  // Rope bridge behind the fighters, deep jungle beneath.
  line([[65,120],[146,145],[228,159],[313,158],[394,144],[488,118]],'#b8aa68',3);line([[65,146],[146,170],[228,184],[313,183],[394,169],[488,144]],'#4f5532',4);
  for(let i=0;i<38;i++){const x=67+i*11.1,y=147+Math.sin(i/37*Math.PI)*37;r(x,y,9,4,i%2?'#9c8b52':'#bdab68');if(i%3===0)line([[x,y-27],[x,y]],'#a99c61',1);}
  // Massive trunks and interlaced overhead branch.
  p([[0,0],[50,0],[38,42],[49,84],[34,136],[46,176],[84,205],[0,207]],'#344c31');p([[10,0],[27,0],[21,79],[28,140],[22,195],[46,207],[31,207],[11,178]],'#637445');
  p([[560,0],[523,0],[516,62],[530,112],[518,165],[483,206],[560,207]],'#384d2f');
  line([[34,61],[108,87],[192,95],[270,87],[351,91],[442,71],[534,31]],'#35492e',17);line([[36,56],[111,82],[195,90],[269,82],[353,86],[443,66],[532,26]],'#687444',7);
  if(!omitAnimals)drawArenaAnimals(c,'leopard',0);
  for(const x of [91,165,390,472])line([[x,0],[x-7,34],[x+4,63],[x,99],[x-8,121]],'#889359',2);
  foliage(-30,-25,240,75,['#3f5a32','#54703a','#718547','#8a9852'],210);foliage(369,-24,239,80,['#3e5831','#58713b','#7e8d4a'],190);
  for(const x of [54,102,455,505])for(let j=0;j<5;j++)line([[x,205],[x+(j-2)*10,183-Math.abs(j-2)*3]],'#90a05e',2);
  platform('#6a7150','#b3aa76','#404f37','#4f6e3f');
 }
 if(arena.id==='dragon'){
  sky('#45445f','#a6a2b4');sun(411,53,38,'#d9cbd9');
  mountain([[0,164],[39,116],[56,121],[74,55],[89,49],[104,117],[130,135],[165,79],[181,89],[202,151],[245,102],[267,144],[310,118],[341,74],[354,94],[367,139],[406,99],[437,150],[472,46],[490,67],[511,142],[560,109]],'#77768f');
  mountain([[0,186],[49,157],[89,173],[137,119],[155,106],[179,176],[238,146],[298,186],[357,137],[395,164],[440,149],[489,177],[532,111],[560,128]],'#555f76');
  for(let i=0;i<15;i++)cloud(random()*560,153+random()*37,60+random()*100,i%2?'#d4ced358':'#aaaec760');
  if(!omitAnimals)drawArenaAnimals(c,'dragon',0);
  for(const x of [115,423]){r(x,132,9,67,'#555970');r(x+2,134,3,61,'#9b91a9');r(x-5,198,19,9,'#8e8a9f');roof(x-17,121,43,'#424d63','#b3a0bd');lantern(x+4,148,'#a38bb7');}
  line([[510,7],[496,31],[510,34],[484,66]],'#e1d8ed99',2);cloud(41,188,164,'#cfbfd46b');cloud(356,191,173,'#c4bbcf70');
  platform('#6e7187','#b2a8bd','#454c63');for(const x of [37,504]){r(x,196,14,11,'#655771');r(x-2,194,18,3,'#a28ea5');r(x+4,184,5,11,'#e3c4e8');}
 }
 if(arena.id==='crane'){
  sky('#727b95','#dfb6b1');sun(359,56,45,'#f4ded0');
  mountain([[0,147],[47,123],[91,137],[134,98],[164,118],[197,141],[232,123],[281,137],[321,99],[343,111],[373,142],[426,115],[462,133],[513,108],[560,125]],'#9298aa');
  mountain([[0,171],[50,153],[104,165],[161,139],[221,174],[282,151],[344,171],[411,145],[480,164],[560,142]],'#6f8790');
  r(0,170,560,37,'#78979c');for(let i=0;i<110;i++)r(random()*560,171+random()*34,6+random()*30,1,i%3?'#ced0bc55':'#e6c7be77');
  for(let i=0;i<13;i++)r(341-random()*i*2,173+i*2,30+random()*i*4,1,'#e7d3be77');
  // Open-sided waterside pavilion and dock.
  for(const x of [106,164]){r(x,133,5,64,'#687779');r(x+1,135,2,59,'#b6bbac');}roof(88,118,99,'#536b75','#b5c2bb');r(99,194,79,5,'#9da8a1');r(94,199,89,6,'#596f76');lantern(136,139,'#c6b4a7');
  if(!omitAnimals)drawArenaAnimals(c,'crane',0);
  // White blossom branch and reeds at the water's edge.
  line([[0,130],[22,88],[29,45],[63,25],[117,19]],'#4e6266',9);line([[26,51],[68,64],[102,49]],'#6b7775',4);
  foliage(-10,-11,162,56,['#9b9d9d','#bdafb1','#d5c0bb','#eddbcd'],150);foliage(52,39,75,25,['#b6afb1','#e0c7c1','#eddacf'],50);
  for(const x of [24,44,66,463,485,520,541]){line([[x,208],[x-5,178],[x+2,161]],'#537d77',2);line([[x,204],[x+10,184],[x+15,179]],'#638b80',1);r(x,160,3,8,'#bda88b');}
  platform('#829295','#c0c5b8','#536c75');for(let y=216;y<250;y+=11)for(let x=0;x<560;x+=56){r(x+7,y+4,34,1,'#637e86');r(x+18,y+6,19,1,'#b8bcb044');}
 }
 if(arena.id==='volcano'){
  sky('#362e40','#b76c53');sun(423,51,35,'#d99a73');
  mountain([[0,165],[37,124],[75,143],[122,103],[178,151],[211,122],[262,158],[304,119],[353,147],[391,100],[439,138],[483,113],[524,146],[560,130]],'#735459');
  // Ash plumes, a broken crater rim and multiple molten lava channels.
  for(let i=0;i<12;i++){const x=270+Math.sin(i*.8)*22-i*4,y=67-i*8;ellipse(x,y,18+i*1.8,9+i,'#594950');ellipse(x+7,y-5,15+i*1.4,8+i*.5,'#6d5155');}
  p([[126,196],[179,158],[219,111],[247,67],[263,70],[278,79],[293,70],[310,65],[332,111],[378,163],[435,202]],'#51404b');
  p([[147,192],[216,136],[250,76],[263,80],[235,140],[214,193]],'#6d474b');p([[300,73],[335,143],[401,199],[345,199],[317,143],[285,86]],'#3b3744');
  p([[247,69],[263,73],[279,81],[294,75],[310,67],[302,83],[280,90],[260,83]],'#e38653');line([[252,71],[267,77],[279,83],[296,77],[305,71]],'#ffc57b',3);
  const lava=(points,width)=>{line(points,'#8d4544',width+8);line(points,'#e77746',width+3);line(points,'#ffc16c',width);};
  lava([[263,81],[257,106],[268,130],[251,157],[266,182],[259,202]],4);lava([[292,81],[304,101],[300,125],[320,148],[329,175],[359,201]],3);lava([[257,112],[236,138],[227,162],[199,194]],2);
  r(0,191,560,16,'#6b4044');for(let i=0;i<65;i++)r(random()*560,193+random()*12,7+random()*26,1,i%3?'#b85b46':'#ed975a');
  p([[0,153],[14,142],[32,168],[52,176],[66,201],[0,211]],'#302f3a');p([[560,134],[546,153],[531,157],[518,184],[497,207],[560,211]],'#302e38');
  for(const [x,y]of [[32,174],[489,186],[90,195],[455,200]]){p([[x-16,y+12],[x-9,y-13],[x+3,y-21],[x+12,y+12]],'#453842');line([[x-8,y+7],[x-3,y-4],[x+1,y]],'#d9794d',2);}
  platform('#50444b','#9b7467','#322f3a');line([[87,213],[104,222],[98,231],[123,240],[117,250]],'#e18e57',1);line([[438,213],[423,222],[436,229],[429,239],[451,249]],'#d88050',1);r(0,207,560,1,'#e6a473');
 }
 const vignette=c.createRadialGradient(280,123,90,280,123,325);vignette.addColorStop(0,'#16231d00');vignette.addColorStop(1,'#13201955');c.fillStyle=vignette;c.fillRect(0,0,560,250);
 return canvas;
}

// Animal layers are separate from scenery, so breathing, tails, wings and eyes
// animate without repainting or reallocating the static pixel-art backgrounds.
export function drawArenaAnimals(c,id,t=0){
 const r=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));};
 const p=(points,color)=>{c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(Math.round(x),Math.round(y)):c.moveTo(Math.round(x),Math.round(y)));c.closePath();c.fill();};
 const line=(points,color,width=1)=>{c.strokeStyle=color;c.lineWidth=width;c.lineCap='square';c.lineJoin='miter';c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(Math.round(x),Math.round(y)):c.moveTo(Math.round(x),Math.round(y)));c.stroke();};
 const ellipse=(x,y,rx,ry,color)=>{c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();};
 const sun=(x,y,size,color)=>{r(x-size*.35,y-size*.5,size*.7,size,color);r(x-size*.5,y-size*.35,size,size*.7,color);};
 c.save();
 if(id==='snake'){
  c.translate(0,Math.sin(t*0.8)*0.7);
  // Coiled jade serpent sculpture: loop, winding neck, diamond-shaped head.
  r(240,171,82,21,'#4c6c54');r(234,190,94,9,'#849b72');r(239,175,84,4,'#a3b28a');
  line([[261,167],[244,154],[249,139],[275,134],[302,145],[297,158],[273,161],[259,151],[264,145],[285,148]],'#294c43',15);
  line([[261,165],[246,153],[251,141],[275,137],[299,146],[295,156],[274,158],[261,150],[265,146],[284,149]],'#7caa88',9);
  line([[300,145],[315,128],[312,111],[297,98],[295,79],[306,68]],'#2e5449',14);line([[300,143],[312,128],[309,112],[294,99],[292,79],[305,69]],'#82b393',8);
  p([[299,65],[311,61],[323,68],[317,76],[303,76]],'#a2c4a0');r(316,67,3,Math.sin(t*1.6)>.96?1:2,'#e5d783');if(Math.sin(t*3.4)>.45)line([[322,71],[331+Math.sin(t*8)*2,72],[334,69]],'#b8986f');
  for(const [x,y]of [[252,147],[267,139],[287,143],[287,157],[309,124],[296,94],[296,83]])r(x,y,3,3,'#cee0b0');
 }
 if(id==='tiger'){
  const tigerStatue=(x,mirror)=>{c.save();c.translate(x,0);c.scale(mirror,1);r(-25,191,57,12,'#6f7258');r(-28,199,63,6,'#b4a47a');p([[-16,189],[-17,162],[-8,145],[14,146],[23,158],[22,189]],'#a39268');r(-20,158,17,28,'#bba575');r(8,163,16,25,'#8d825e');r(-20,185,18,7,'#cfb886');r(9,185,18,7,'#b8a676');p([[-13,147],[-17,132],[-9,120],[13,119],[24,130],[20,147],[8,154],[-3,154]],'#d0b783');r(-15,117,8,12,'#c6a977');r(14,117,8,12,'#b59a6a');r(-8,131,7,Math.sin(t*1.2)>.96?1:3,'#d7b467');r(11,131,7,Math.sin(t*1.2)>.96?1:3,'#d7b467');r(2,139,8,5,'#4a4a38');r(-1,145,14,3,'#e1c795');for(let j=0;j<3;j++){p([[-15,153+j*10],[-3,158+j*10],[-16,160+j*10]],'#6a6246');p([[23,150+j*10],[13,155+j*10],[23,158+j*10]],'#6a6246');}line([[23,180],[39+Math.sin(t)*2,165],[43+Math.sin(t)*4,147],[37+Math.sin(t)*6,140]],'#a69469',5);c.restore();};tigerStatue(172,1);tigerStatue(392,-1);
 }
 if(id==='leopard'){
  c.translate(0,Math.sin(t*1.2)*1);
  // Resting leopard with long tail, distinct rosette spots.
  p([[239,77],[251,65],[279,63],[307,67],[314,77],[305,83],[258,83]],'#cbb16b');r(245,72,9,17,'#d6bd78');r(291,74,10,14,'#c3a65f');p([[303,66],[307,55],[321,53],[332,60],[331,71],[320,77],[309,74]],'#ddc283');r(307,51,5,7,'#ac9153');r(324,51,5,7,'#ac9153');r(323,61,3,Math.sin(t*.9)>.96?1:2,'#36462c');r(330,66,3,3,'#36462c');line([[244,73],[224,69],[210,57+Math.sin(t)*2],[192,59+Math.sin(t)*4],[186,71+Math.sin(t)*6]],'#ccb26d',4);for(const [x,y]of [[252,69],[263,72],[276,68],[287,73],[299,70],[313,61],[317,68]]){r(x,y,4,4,'#6c653d');r(x+1,y+1,2,2,'#d9bb73');}
 }
 if(id==='dragon'){
  c.translate(0,Math.sin(t*0.8)*1);
  // Shrine columns and a long dragon winding around the pearl pedestal.
  r(266,116,32,81,'#565e70');r(272,117,5,77,'#9b9aaf');r(260,191,44,12,'#999aac');r(256,201,52,6,'#bdafc6');
  line([[263,186],[231,173],[223,152],[240,137],[286,137],[319,124],[325,105],[309,89],[283,86],[267,71]],'#424f65',15);
  line([[263,183],[234,171],[227,153],[242,141],[287,141],[323,125],[329,104],[310,85],[283,82],[270,69]],'#9ca8b8',9);
  for(const [x,y]of [[240,170],[226,156],[247,138],[270,139],[300,133],[324,119],[326,103],[310,87],[284,83]])p([[x-4,y-5],[x,y-13],[x+4,y-4]],'#bbc4cb');
  p([[260,69],[257,56],[271,45],[286,48],[296,60],[289,72],[273,75]],'#b9bdc6');p([[262,51],[256,37],[268,46]],'#d7d2d6');p([[282,48],[293,33],[291,52]],'#d7d2d6');r(284,56,4,3,'#f0deb3');p([[289,63],[308,64],[301,70],[284,72]],'#c9c3d1');line([[295,69],[311,79+Math.sin(t*2)*2],[323,75+Math.sin(t*2)*4]],'#d9d0cd',1);line([[260,166],[250,184],[234,188]],'#a9b3bf',4);
  ellipse(283,103,12,12,'#b9a1d555');sun(283,103,15,'#ddd0ef');r(280,98,4,4,'#fff0e7');
 }
 if(id==='crane'){
  const crane=(x,y,s=1)=>{c.save();c.translate(x,y);c.scale(s,s);line([[-4,0],[-4,-21],[1,-31]],'#4c6670',1);line([[5,0],[8,-19],[2,-29]],'#4c6670',1);ellipse(0,-34,14,8,'#e4e6dc');p([[-11,-36],[-22,-43],[-14,-28],[1,-30]],'#beced0');line([[9,-35],[19,-43],[17+Math.sin(t)*2,-57],[24+Math.sin(t)*3,-65+Math.sin(t)*2]],'#e9ebe0',4);r(21,-68,8,7,'#e8e9dc');r(23,-69,5,3,'#ae706a');r(26,-65,2,2,'#405b66');p([[28,-64],[42,-61],[28,-61]],'#bb9e79');p([[-13,-31],[-25,-24],[-13,-25]],'#516b78');c.restore();};crane(301+Math.sin(t*.45)*4,200,1);crane(412+Math.sin(t*.5+1)*4,199,.73);
  for(const [x,y,s]of [[238,76,1],[261,65,.7],[297,85,.65]]){const xx=(x+t*7)%520,flap=Math.sin(t*3+x)*7*s;line([[xx-11*s,y+flap],[xx-4*s,y-3*s],[xx,y],[xx+6*s,y-3*s],[xx+15*s,y+flap]],'#eee3d6',2);}
 }
 c.restore();
}

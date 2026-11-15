export const HOME_SPEED_MULTIPLIER = 1.01;
export const ARENAS = [
  {id:'snake',name:'Jade Coil Grove',home:'snake',style:'Snake',symbol:'蛇',color:'#9bc7a2',setting:'BAMBOO WETLANDS · MIST',description:'A winding jade serpent watches over a bamboo grove and lotus pools.'},
  {id:'tiger',name:'Amber Fang Gate',home:'tiger',style:'Tiger',symbol:'虎',color:'#e5a16f',setting:'AMBER CANYON · SUNSET',description:'Twin tiger guardians stand beneath an autumn canopy at a mountain gate.'},
  {id:'leopard',name:'Golden Canopy',home:'leopard',style:'Leopard',symbol:'豹',color:'#e5c66c',setting:'ANCIENT JUNGLE · GOLDEN HOUR',description:'A spotted leopard rests above tangled roots and a jungle suspension bridge.'},
  {id:'dragon',name:'Stormspire Shrine',home:'dragon',style:'Dragon',symbol:'龍',color:'#b6a1dc',setting:'CLOUD PEAKS · STORMLIGHT',description:'A coiling stone dragon guards a luminous pearl high above a sea of clouds.'},
  {id:'crane',name:'Moonwater Pavilion',home:'crane',style:'Crane',symbol:'鹤',color:'#b7d1dd',setting:'MIRROR LAKE · MOONRISE',description:'White cranes, reeds and pale blossoms surround a still lakeside pavilion.'},
  {id:'volcano',name:'Cinder Caldera',home:null,style:'Neutral',symbol:'火',color:'#edaa82',setting:'VOLCANIC RIM · EMBERFALL',description:'A smoking volcano and glowing lava surround a neutral basalt fighting platform.'}
];
export function getArena(id){return ARENAS.find(arena=>arena.id===id)||ARENAS[5];}

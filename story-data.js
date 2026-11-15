export const BOSS_NAME = 'The Fivefold Master';
export const BOSS_FORMS = ['snake','tiger','leopard','dragon','mixed'];
export const BOSS_MIX_STYLES = ['snake','tiger','leopard','dragon','crane'];
export const BOSS_MAX_HEALTH = 300;
export const BOSS_SPEED_MULTIPLIER = 1.02;
export function bossPhaseForHealth(hp,maxHp=BOSS_MAX_HEALTH){
 return Math.min(4,Math.max(0,Math.floor((1-hp/maxHp)*5+1e-9)));
}
export const CHAPTERS = [
 {id:'snake',name:'Snake',arena:'snake',title:'The quiet opening.',lesson:'Patience',intro:'In Jade Coil Grove, the Snake waits for a single opening. Meet this precise defender on their own ground.',victory:'You found the opening. Patience has become your strength.'},
 {id:'tiger',name:'Tiger',arena:'tiger',title:'Stand before the storm.',lesson:'Courage',intro:'Beyond Amber Fang Gate, the Tiger meets every challenge head-on. Hold your ground against relentless pressure.',victory:'You stood firm. Courage now walks beside patience.'},
 {id:'leopard',name:'Leopard',arena:'leopard',title:'Catch the golden flash.',lesson:'Speed',intro:'Under the Golden Canopy, the Leopard turns every step into a strike. Find the rhythm inside the rush.',victory:'You matched the rhythm. Speed now serves your intention.'},
 {id:'dragon',name:'Dragon',arena:'dragon',title:'Move with the clouds.',lesson:'Flow',intro:'At Stormspire Shrine, the Dragon flows around resistance. Adapt your form to overcome a changing opponent.',victory:'You learned to flow. Strength no longer needs to be rigid.'},
 {id:'crane',name:'Crane',arena:'crane',title:'Still water. Steady spirit.',lesson:'Balance',intro:'At Moonwater Pavilion, the Crane balances reach with restraint. Let every movement have a purpose.',victory:'You found your balance. All five courts now stand behind you.'},
 {id:'master',name:BOSS_NAME,arena:'volcano',title:'Five forms. One final trial.',lesson:'Mastery',boss:true,intro:'At Cinder Caldera, the Fivefold Master commands every style. Each 20% of health lost reveals a new form. At 20% remaining, the Golden Master combines all five styles. Every form moves 2% faster.',victory:'The Fivefold Master bows. Your final trial is complete.'}
];
export const ENDING = [
 {eyebrow:'THE FIVE COURTS ARE BEHIND YOU',title:'You mastered every challenge.',text:'You faced Snake, Tiger, Leopard, Dragon and Crane on their home ground—and defeated them all. Each battle taught you something the last could not.'},
 {eyebrow:'THE FINAL TRIAL IS COMPLETE',title:'Five forms. One spirit.',text:'Even the Fivefold Master could not break your resolve. Patience, courage, speed, flow and balance now move together within you.'},
 {eyebrow:'YOUR NAME JOINS THE MASTERS',title:'A true Shaolin master.',text:'You have beaten all five styles and overcome the final trial. You return to the temple a true Shaolin master. Carry your strength with humility, and let your next journey begin.'}
];

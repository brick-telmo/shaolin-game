import {Match,FORMS} from './core.js';
import {CHAPTERS} from './story-data.js';

// Campaign progression is separate from combat so losing/retrying never skips a court.
export class StoryCampaign {
 constructor(fighter='tiger',difficulty='normal',random=Math.random){
  this.fighter=FORMS.some(f=>f.id===fighter)?fighter:'tiger';this.difficulty=difficulty;this.random=random;
  this.chapterIndex=0;this.cleared=[];this.retriesRemaining=1;this.started=false;this.phase='intro';this.match=this.createMatch();
 }
 get chapter(){return CHAPTERS[this.chapterIndex];}
 createMatch(){const chapter=this.chapter;return new Match(this.fighter,chapter.boss?'snake':chapter.id,'cpu',this.difficulty,this.random,chapter.arena,{boss:!!chapter.boss});}
 start(){if(this.phase!=='intro'||this.match.phase!=='ready')return false;this.started=true;this.phase='fighting';this.match.start();return true;}
 update(dt,input){
  if(this.phase!=='fighting')return;
  this.match.update(dt,[input,{}]);
  if(this.match.phase==='over'){
   if(this.match.winner===0){if(!this.cleared.includes(this.chapter.id))this.cleared.push(this.chapter.id);this.phase='won';}
   else this.phase='lost';
  }
 }
 advance(){
  if(this.phase!=='won')return false;
  if(this.chapterIndex===CHAPTERS.length-1){this.phase='ending';return true;}
  this.chapterIndex++;this.retriesRemaining=1;this.phase='intro';this.match=this.createMatch();return true;
 }
 retry(){
  if(this.phase!=='lost'||this.retriesRemaining<=0)return false;
  this.retriesRemaining--;this.phase='intro';this.match=this.createMatch();return true;
 }
 complete(){if(this.phase!=='ending')return false;this.phase='complete';return true;}
}

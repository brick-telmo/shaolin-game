import {FORMS,Match} from './core.js';
import {OnlineClient} from './online-client.js';
import {AccountClient} from './account-client.js';
import {Renderer} from './render.js';
import {ARENAS} from './arena-data.js';
import {StoryCampaign} from './story.js';
import {installShowcaseShortcut} from './showcase-shortcut.js';
import {createTouchControls} from './touch-controls.js';
import {BOSS_NAME,BOSS_FORMS,CHAPTERS,ENDING} from './story-data.js';
const $=id=>document.getElementById(id);
const canvas=$('game'),renderer=new Renderer(canvas);
let selected=['tiger','dragon'],mode='cpu',selecting=0,selectedArena='volcano',match=new Match(...selected);
let campaign=null,ending=null,soloRetries=1,keys={},lastTime=null,accumulator=0,lastScreen='',soundOn=false,audioCtx,toastTimer,announcementTime=0,modalPaused=false,modalEndingPaused=false;
const bindings=[{left:'a',right:'d',jump:'w',guard:'s',strike:'f',kick:'g',special:'h'},{left:'arrowleft',right:'arrowright',jump:'arrowup',guard:'arrowdown',strike:'j',kick:'k',special:'l'}];
function controls(i){return Object.fromEntries(Object.entries(bindings[i]).map(([action,key])=>[action,!!keys[key]||(i===0&&touch.input[action])]));}
function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2400);}
function audio(type){if(!soundOn)return;try{audioCtx??=new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();const osc=audioCtx.createOscillator(),gain=audioCtx.createGain();osc.connect(gain);gain.connect(audioCtx.destination);const now=audioCtx.currentTime;const config={hit:[150,45,.13,'sawtooth'],block:[340,130,.1,'triangle'],attack:[170,80,.07,'triangle'],jump:[210,380,.12,'sine'],start:[330,660,.23,'sine'],fight:[440,880,.2,'triangle'],ko:[220,55,.5,'triangle'],over:[330,660,.7,'sine'],select:[440,550,.07,'sine']}[type];if(!config)return;osc.type=config[3];osc.frequency.setValueAtTime(config[0],now);osc.frequency.exponentialRampToValueAtTime(config[1],now+config[2]);gain.gain.setValueAtTime(type==='hit'?.055:.035,now);gain.gain.exponentialRampToValueAtTime(.001,now+config[2]);osc.start(now);osc.stop(now+config[2]);}catch{soundOn=false;$('soundText').textContent='SOUND OFF';}}

const online=new OnlineClient(onlineChanged);
const touch=createTouchControls($('movementZone'),$('movementIndicator'),document.querySelectorAll('[data-action]'),()=>{if(mode==='online')online.setInput(controls(0));});
const account=document.documentElement.dataset.authProvider==='azure'?new AccountClient(()=>{online.needsSignIn=!account.username;onlineScreen='';if(mode==='online')updateOnlineUI();}):null;
let onlineScreen='',onlineMatchId=null;
function canChooseFighter(){if(mode==='online')return ['idle','error'].includes(online.status);return mode==='story'?campaign.chapterIndex===0&&!campaign.started:['ready','over'].includes(match.phase);}
function renderRoster(){
 const opponent=mode==='online'?(online.status==='matched'?match.fighters[1-online.side].form.id:null):mode==='story'?match.fighters[1].form.id:selected[1];
 $('roster').innerHTML=FORMS.map((f,i)=>`<button class="fighter-card ${selected[0]===f.id?'p1':''} ${opponent===f.id?'p2':''}" data-form="${f.id}" data-han="${f.han}" style="--color:${f.color}" aria-label="Choose ${f.name} for ${selecting===0?'player one':mode==='local'?'player two':'CPU'}" aria-pressed="${selected[selecting]===f.id}"><span class="card-number">FORM / 0${i+1}</span><h3>${f.name}</h3><span class="card-trait">${f.trait}</span><div class="mini-stats"><span>POWER</span>${Array.from({length:5},(_,j)=>`<i class="${j>=f.stats[0]?'dim':''}"></i>`).join('')}</div><canvas class="card-sprite" width="112" height="112" aria-hidden="true"></canvas><span class="card-badges">${selected[0]===f.id?`<span>${mode==='online'?'YOU':'P1'}</span>`:''}${opponent===f.id?`<span class="p2-badge">${match.bossBattle?'BOSS':mode==='online'?'RIVAL':mode==='local'?'P2':'CPU'}</span>`:''}</span></button>`).join('');
 document.querySelectorAll('.fighter-card').forEach(button=>{renderer.portrait(button.querySelector('canvas'),FORMS.find(f=>f.id===button.dataset.form));button.onclick=()=>choose(button.dataset.form);});
 const f=FORMS.find(f=>f.id===selected[selecting]),k=selecting===0?['F','G','H']:['J','K','L'];
 $('moveStrip').style.setProperty('--fighter',f.color);$('moveStrip').innerHTML=`<span class="form-name">${f.han} &nbsp; THE ${f.name.toUpperCase()} FORM</span><span><kbd>${k[0]}</kbd>${f.strike}</span><span><kbd>${k[1]}</kbd>${f.kick}</span><span><kbd>${k[2]}</kbd>${f.special}</span><span class="special-description">${f.specialText}</span>`;
}
function renderArenaOptions(){
 $('arenaOptions').innerHTML=ARENAS.map(a=>`<button class="arena-option" data-arena="${a.id}" style="--arena-color:${a.color}" aria-label="${a.name} — ${a.home?a.style+' home court, +1% movement speed':'neutral volcano, no speed bonus'}" aria-pressed="false"><canvas width="280" height="125" aria-hidden="true"></canvas><span class="arena-option-copy"><strong>${a.name}</strong><small></small></span></button>`).join('');
 document.querySelectorAll('.arena-option').forEach(button=>{renderer.arenaThumbnail(button.querySelector('canvas'),button.dataset.arena);button.onclick=()=>{if(mode==='story'||mode==='online'||!['ready','over'].includes(match.phase))return;selectedArena=button.dataset.arena;audio('select');reset();};});
}
function updateArenaUI(){
 const arena=match.arena,story=mode==='story',locked=story||mode==='online'||!['ready','over'].includes(match.phase);
 $('arenaName').textContent=ending?'THE TEMPLE · DAWN':arena.name.toUpperCase();$('arenaSymbol').textContent=arena.symbol;$('arenaSetting').textContent=arena.setting;
 document.body.classList.toggle('story-mode',story);$('storyBanner').hidden=!story;
 $('arenaSelectionTitle').textContent=story?'Your path to mastery':mode==='online'?'Six courts. One shared arena.':'Choose your ground';
 if(story){$('storyChapter').textContent=`CHAPTER ${campaign.chapterIndex+1} / 6`;$('storyProgress').textContent=`${campaign.cleared.length} of 6 trials complete`;$('storyLesson').textContent=campaign.chapter.boss?'Final trial: the Fivefold Master':`The lesson of ${campaign.chapter.lesson.toLowerCase()}`;}
 for(const [i,button]of [...document.querySelectorAll('.arena-option')].entries()){
  const a=ARENAS[i];button.setAttribute('aria-pressed',a.id===arena.id);button.disabled=locked;button.classList.toggle('cleared',story&&campaign.cleared.includes(CHAPTERS[i].id));
  button.querySelector('small').textContent=story?`${campaign.cleared.includes(CHAPTERS[i].id)?'✓ CLEARED':String(i+1).padStart(2,'0')} · ${i===5?'FINAL BOSS':a.style.toUpperCase()}`:a.home?a.style.toUpperCase()+' HOME':'NEUTRAL VOLCANO';
 }
 $('arenaRule').textContent=story?'Defeat every home style. Face the master.':mode==='online'?'Arena chosen automatically · home style +1% speed':locked?'Arena locked · reset to change':'Home style gets +1% movement speed';
 const bonus=match.bossBattle?'New form every 20% health lost. Final 20%: Golden Master, all five styles. +2% movement speed throughout.':arena.home?`${arena.style} fighters get +1% movement speed here.`:'Neutral ground. All five styles use their normal speed.';
 $('arenaDetail').innerHTML=`<span style="color:${arena.color}">${match.bossBattle?'FINAL TRIAL':arena.home?'HOME ADVANTAGE':'NEUTRAL GROUND'}</span> ${bonus}`;
 $('selectP2').disabled=story||mode==='online';$('opponentTab').textContent=match.bossBattle?'BOSS':mode==='online'?'RIVAL':mode==='local'?'P2':'CPU';
 $('reset').querySelector('span').textContent=story?'RESTART STORY':mode==='online'?'LEAVE ONLINE':'RESET MATCH';
}
function choose(id){if(!canChooseFighter()){toast(mode==='story'?'Restart the story to choose a new fighter.':'Reset the match to change fighters.');return;}selected[selecting]=id;audio('select');reset();}
function selectPlayer(i){if((mode==='story'||mode==='online')&&i===1)return;selecting=i;for(const n of [0,1]){$(`selectP${n+1}`).classList.toggle('selected',n===i);$(`selectP${n+1}`).setAttribute('aria-pressed',n===i);}renderRoster();}
function setMode(next){
 if(mode===next)return;if(mode==='online'&&!['idle','error'].includes(online.status)){requestOnlineLeave(()=>setMode(next));return;}mode=next;document.querySelector('.fighter-hud .player-label').textContent='P1';$('selectP1').firstChild.textContent='P1 ';ending=null;campaign=null;selecting=0;
 for(const id of ['story','cpu','local','online']){$(id+'Mode').classList.toggle('selected',mode===id);$(id+'Mode').setAttribute('aria-pressed',mode===id);}
 $('difficulty').disabled=['local','online'].includes(mode);$('onlineBanner').hidden=mode!=='online';document.body.classList.toggle('online-mode',mode==='online');onlineScreen='';reset();selectPlayer(0);if(mode==='local')toast('Two players · one keyboard. See All controls.');
 $('accountArea').hidden=mode!=='online'||!account;$('scoreboard').hidden=!account;if(mode==='online'&&account){account.refresh();account.scores();}
}
function prepareMatch(){keys={};touch.clear();accumulator=0;lastScreen='';announcementTime=0;renderer.particles=[];renderer.texts=[];renderer.transformPulse=0;renderRoster();updateArenaUI();updateUI();}
function reset(startNow=false,keepRetry=false){
 if(!keepRetry)soloRetries=1;
 ending=null;$('arena').classList.remove('cinematic');$('endingOverlay').hidden=true;
 if(mode==='story'){campaign=new StoryCampaign(selected[0],$('difficulty').value);match=campaign.match;}
 else match=new Match(...selected,mode,$('difficulty').value,Math.random,selectedArena);
 prepareMatch();if(startNow)start();
}
function start(){if(mode==='online'){online.join(selected[0]);return;}keys={};touch.clear();if(mode==='story')campaign.start();else if(match.phase==='ready')match.start();else reset(true);canvas.focus({preventScroll:true});audio('select');}
function nextChapter(){if(!campaign.advance())return;if(campaign.phase==='ending'){beginEnding();return;}match=campaign.match;prepareMatch();canvas.focus({preventScroll:true});}
function retrySolo(){if(mode!=='cpu'||match.phase!=='over'||match.winner===0||soloRetries<=0)return;soloRetries--;reset(true,true);}
function retryChapter(){if(!campaign.retry())return;match=campaign.match;prepareMatch();canvas.focus({preventScroll:true});}
function togglePause(){keys={};touch.clear();if(mode==='online'){online.setInput({});toast('Online fights keep running. Use Leave online to forfeit.');return;}if(ending){ending.paused=!ending.paused;updateUI();}else match.pause();canvas.focus({preventScroll:true});}
function setOverlay(html){$('overlayContent').innerHTML=html;}
function renderStoryOverlay(){
 const chapter=campaign.chapter;
 if(match.phase==='ready'){
  setOverlay(`<span class="overline">CHAPTER ${String(campaign.chapterIndex+1).padStart(2,'0')} / 06 · ${chapter.boss?'FINAL TRIAL':chapter.name.toUpperCase()+' HOME COURT'}</span><h2>${chapter.title}</h2><p class="story-intro-text">${chapter.intro}</p><button class="primary-button" id="start">${chapter.boss?'FACE THE MASTER':'BEGIN TRIAL'} <span>→</span></button><small>${chapter.boss?`3 LIVES · BOSS 300 HP · ${campaign.retriesRemaining} RETRY LEFT`:`3 LIVES EACH · HOME +1% SPEED · ${campaign.retriesRemaining} RETRY LEFT`}</small>`);
  $('start').onclick=start;$('statusText').textContent=chapter.boss?'One last test of everything you have learned.':`Chapter ${campaign.chapterIndex+1}: ${chapter.name} awaits.`;
 }else if(match.phase==='over'){
  if(campaign.phase==='won'){
   setOverlay(`<span class="overline">${chapter.name.toUpperCase()} DEFEATED · ${campaign.cleared.length} / 6 TRIALS</span><h2>${chapter.lesson} earned.</h2><p class="story-intro-text">${chapter.victory}</p><button class="primary-button" id="nextChapter">${campaign.chapterIndex===4?'TO THE FINAL TRIAL':'NEXT HOME COURT'} <span>→</span></button><small>YOUR THREE LIVES WILL BE RESTORED</small>`);$('nextChapter').onclick=nextChapter;$('statusText').textContent=`${chapter.name} defeated. Continue your journey.`;
  }else{
   const retry=campaign.retriesRemaining>0;
   setOverlay(`<span class="overline">CHAPTER ${campaign.chapterIndex+1} · ${retry?'ONE RETRY REMAINS':'NO RETRIES REMAIN'}</span><h2>${retry?'Rise. Try once more.':'The journey ends here.'}</h2><p class="story-intro-text">${retry?'Keep your earlier victories and return with three fresh lives. This is your final attempt at this fight.':'Both attempts are over. Begin a new journey at the first court to try for mastery again.'}</p>${retry?'<button class="primary-button" id="retryChapter">USE YOUR ONE RETRY <span>↻</span></button>':''}<button class="${retry?'secondary-button':'primary-button'}" id="restartStory">START A NEW JOURNEY</button>`);if(retry)$('retryChapter').onclick=retryChapter;$('restartStory').onclick=()=>reset();$('statusText').textContent=retry?'One retry remains at this court.':'Two attempts used. Restart the story to try again.';
  }
 }
}
function updateHUD(){
 for(const [i,p]of match.fighters.entries()){
  const n=i+1,home=$(`p${n}Home`);home.hidden=!p.isBoss&&match.arena.home!==p.form.id;home.textContent=p.isBoss?'BOSS +2% SPEED':'HOME +1% SPEED';
  $(`p${n}Name`).textContent=p.isBoss?(p.bossMixed?'GOLDEN MASTER':`MASTER · ${p.form.name.toUpperCase()}`):p.form.name.toUpperCase();
  $(`p${n}Name`).classList.toggle('boss-name',p.isBoss);$(`p${n}Health`).style.width=`${p.hp/p.maxHp*100}%`;$(`p${n}Health`).parentElement.classList.toggle('boss-health',p.isBoss);
  $(`p${n}Chi`).style.width=`${p.chi}%`;$(`p${n}Chi`).style.background=p.chi>=40?'#e9e6ae':'#9ca88b';$(`p${n}Health`).closest('.fighter-hud').style.setProperty('--fighter',p.form.color);
  $(`p${n}Lives`).innerHTML=p.isBoss?`<span class="boss-phase-count">${p.bossMixed?'ALL FIVE STYLES':`FORM ${p.bossPhase+1}/5`}</span>`:[0,1,2].map(j=>`<span class="${j>=p.lives?'lost':''}">◆</span>`).join(' ');
 }
 $('p2Label').textContent=match.bossBattle?'BOSS':mode==='online'?'RIVAL':mode==='local'?'P2':'CPU';
 $('round').textContent=mode==='story'?String(campaign.chapterIndex+1).padStart(2,'0'):match.phase==='ready'?'VS':String(match.round).padStart(2,'0');
 $('roundStatus').textContent=mode==='story'?'CHAPTER':match.phase==='ready'?'EXHIBITION':'EXCHANGE';$('roundRule').textContent=match.bossBattle?'FINAL TRIAL':mode==='cpu'?`${soloRetries} RETRY LEFT`:'THREE LIVES';
 $('bossForms').hidden=!match.bossBattle||['ready','over'].includes(match.phase)||!!ending;
 if(match.bossBattle){const boss=match.fighters[1];$('bossForms').innerHTML=BOSS_FORMS.map((id,i)=>`<span class="${i===boss.bossPhase?'current':i<boss.bossPhase?'passed':''}">${id==='mixed'?'武':FORMS.find(f=>f.id===id).han}<small>${100-i*10}%</small></span>`).join('');}
}
function updateTouchControls(){
 const active=!ending&&!$('infoDialog').open&&!$('accountDialog').open&&['fight','countdown','ko'].includes(match.phase)&&(mode!=='online'||online.status==='matched'&&!['ready','over'].includes(online.authoritative?.phase));
 const controls=$('touchControls');if(controls.hidden===active){controls.hidden=!active;if(!active)touch.clear();}
}
function updateUI(){
 updateTouchControls();
 updateHUD();if(mode==='online'){updateOnlineUI();return;}$('pause').textContent=(ending?ending.paused:match.phase==='paused')?'▶':'Ⅱ';$('pause').setAttribute('aria-label',(ending?ending.paused:match.phase==='paused')?'Resume game':'Pause game');$('pause').disabled=!ending&&['ready','over'].includes(match.phase);
 if(ending){$('statusText').textContent=ending.paused?'Ending paused.':'Story complete. A true Shaolin master.';document.querySelector('.desktop-hint').textContent='';return;}
 const screen=`${mode}:${campaign?.chapterIndex}:${campaign?.phase}:${match.phase}`;
 if(screen!==lastScreen){
  lastScreen=screen;updateArenaUI();$('overlay').hidden=!['ready','paused','over'].includes(match.phase);$('announcement').textContent='';
  if(match.phase==='ready'&&mode!=='story'){setOverlay('<span class="overline">THE COURTYARD AWAITS</span><h2>Stillness.<br>Then strike.</h2><p>Choose your style. Make every life count.</p><button class="primary-button" id="start">ENTER THE COURTYARD <span>↗</span></button><small>1 OR 2 PLAYERS <span>·</span> 3 LIVES EACH</small>');$('start').onclick=start;$('statusText').textContent='Ready when you are.';}
  if(match.phase==='paused'){setOverlay('<span class="overline">TAKE A BREATH</span><h2>Find your center.</h2><p>Your match is paused.</p><button class="primary-button" id="resume">RESUME FIGHT <span>→</span></button><button class="secondary-button" id="pauseControls">View controls</button>');$('resume').onclick=togglePause;$('pauseControls').onclick=showControlsWithTouchGuide;$('statusText').textContent='Paused. Take your time.';}
  if(mode==='story'&&['ready','over'].includes(match.phase))renderStoryOverlay();
  if(match.phase==='over'&&mode!=='story'){
   const winner=match.winner,text=winner<0?'An even match.':`${match.fighters[winner].form.name} prevails.`,lost=mode==='cpu'&&winner!==0,label=winner<0?'DRAW':winner===1&&mode==='cpu'?'THE CPU TAKES THE COURTYARD':`PLAYER ${winner+1} WINS`;
   setOverlay(`<span class="overline">${label}</span><h2>${text}</h2><p>${lost?(soloRetries>0?'One retry remains. Three fresh lives. One last attempt.':'Both attempts are over. No retries remain for this fight.'):'Every ending is another beginning.'}</p>${lost?(soloRetries>0?'<button class="primary-button" id="retrySolo">USE YOUR ONE RETRY <span>↻</span></button>':''):'<button class="primary-button" id="rematch">FIGHT AGAIN <span>↗</span></button>'}<button class="${lost&&soloRetries===0?'primary-button':'secondary-button'}" id="backToSelect">${lost?'SET UP A NEW MATCH':'Choose new fighters'}</button>`);
   if($('rematch'))$('rematch').onclick=()=>reset(true);if($('retrySolo'))$('retrySolo').onclick=retrySolo;$('backToSelect').onclick=()=>reset();$('statusText').textContent=lost?`${soloRetries} retry remaining for this fight.`:winner<0?'Draw.':`${match.fighters[winner].form.name} wins the match.`;
  }
  if(match.phase==='fight')$('statusText').textContent=mode==='story'?(match.bossBattle?'The Fivefold Master · watch for each new form.':`Trial ${campaign.chapterIndex+1} · defeat ${campaign.chapter.name}.`):mode==='cpu'?'You vs CPU. Find your opening.':'Local duel. Make every move count.';
 }
 if(match.phase==='countdown')$('announcement').innerHTML=`<small>${mode==='story'?'TRIAL':'EXCHANGE'} ${mode==='story'?campaign.chapterIndex+1:match.round}</small>${Math.max(1,Math.ceil(match.timer))}`;
 if(match.phase==='ko'){$('announcement').innerHTML='<small>A LIFE HAS FALLEN</small>K.O.';$('statusText').textContent=match.bossBattle&&match.fighters[1].hp>0?'Refocus. The boss keeps its remaining health.':'One life down. Refocus.';}
 document.querySelector('.desktop-hint').textContent=mode==='story'?'':match.phase==='ready'?'Choose a fighter below, then enter the courtyard.':'Reset to choose new fighters.';
 $('stageHint').textContent=match.bossBattle?'W + A/D: JUMP GAPS · FALL: −20% HP':match.phase==='ready'?'A LITTLE FOCUS GOES A LONG WAY.':'SPECIAL: 40 QI · HOLD DOWN TO GUARD';
}
function beginEnding(){keys={};touch.clear();$('arenaName').textContent='THE TEMPLE · DAWN';ending={beat:0,time:0,total:0,paused:false};$('arena').classList.add('cinematic');$('endingOverlay').hidden=false;$('touchControls').hidden=true;renderEndingText();audio('over');}
function renderEndingText(){
 const beat=ENDING[ending.beat],final=ending.beat===ENDING.length-1;
 $('endingOverlay').innerHTML=`<div class="ending-pages">${ENDING.map((_,i)=>`<i class="${i===ending.beat?'active':''}"></i>`).join('')}</div><span class="overline">${beat.eyebrow}</span><h2>${beat.title}</h2><p>${beat.text}</p><div class="ending-actions">${final?'<button class="primary-button" id="newJourney">NEW JOURNEY <span>↗</span></button><button class="secondary-button" id="replayEnding">Replay ending</button>':'<button class="primary-button" id="endingNext">CONTINUE <span>→</span></button><button class="secondary-button" id="endingSkip">Skip to epilogue</button>'}</div>`;
 if(final){campaign.complete();$('newJourney').onclick=()=>reset();$('replayEnding').onclick=beginEnding;}
 else{$('endingNext').onclick=()=>advanceEnding();$('endingSkip').onclick=()=>advanceEnding(true);}
}
function advanceEnding(skip=false){if(!ending)return;ending.beat=skip?ENDING.length-1:Math.min(ENDING.length-1,ending.beat+1);ending.time=0;renderEndingText();audio('select');}
function handleEvent(event){renderer.event(event);audio(event.type==='transform'?'start':event.type);if(event.type==='transform'){$('announcement').innerHTML=`<small>THE MASTER CHANGES</small><span class="form-announcement">${event.name.toUpperCase()} FORM</span>`;announcementTime=1.05;renderRoster();}else if(event.type==='fight'){$('announcement').textContent='FIGHT';announcementTime=.6;}}
function loop(now){
 const dt=lastTime===null?0:Math.max(0,Math.min((now-lastTime)/1000,.06));lastTime=now;
 if(ending){if(!ending.paused&&!document.hidden&&!$('infoDialog').open){ending.time+=dt;ending.total+=dt;if(ending.time>=8&&ending.beat<ENDING.length-1)advanceEnding();}renderer.drawEnding(selected[0],ending.beat,ending.total);}
 else{
  accumulator+=dt;while(accumulator>=1/60){if(mode==='online'){online.setInput(controls(0));online.predict(1/60);if(online.game&&online.status==='matched')match=online.game;}else if(mode==='story')campaign.update(1/60,controls(0));else match.update(1/60,[controls(0),controls(1)]);accumulator-=1/60;}
  updateUI();for(const event of (mode==='online'?online.events:match.events).splice(0))handleEvent(event);
  if(announcementTime>0&&match.phase==='fight'){announcementTime-=dt;if(announcementTime<=0)$('announcement').textContent='';}
  renderer.draw(match,match.phase==='paused'?0:dt);
  if(mode==='story'&&campaign.phase==='won'&&campaign.chapter.boss){campaign.advance();beginEnding();updateArenaUI();}
 }
 updateUI();requestAnimationFrame(loop);
}
function openDialog(content){keys={};touch.clear();if(mode==='online')online.setInput({});modalPaused=mode!=='online'&&match.phase!=='paused'&&['fight','countdown','ko'].includes(match.phase);modalEndingPaused=!!ending&&!ending.paused;if(modalPaused)match.pause();if(ending)ending.paused=true;$('dialogContent').innerHTML=content;$('infoDialog').showModal();}
function showControls(){openDialog(`<span class="modal-eyebrow">A MOMENT OF PRACTICE</span><h2>Learn the rhythm.</h2><div class="guide-grid">${[1,2].map(n=>`<article><h3>Player ${n}</h3>${[['Move',n===1?'A / D':'← / →'],['Jump',n===1?'W':'↑'],['Guard',n===1?'S':'↓'],['Strike',n===1?'F':'J'],['Kick',n===1?'G':'K'],['Special',n===1?'H':'L']].map(([a,k])=>`<div class="key-row"><span>${a}</span><kbd>${k}</kbd></div>`).join('')}</article>`).join('')}</div><ul class="rules-list"><li><strong>Story mode:</strong> defeat Snake, Tiger, Leopard, Dragon and Crane at their home courts, then face the Fivefold Master at the volcano. Each new chapter restores your three lives. Each fight allows one retry (two attempts total), with three lives per attempt. Use your retry without losing earlier victories; a second defeat ends the journey. VS CPU also allows only one retry per fight.</li><li><strong>Final boss:</strong> one continuous 300-health bar, five forms, and +2% movement speed. Forms change at 80%, 60% and 40% health. At 20%, the Golden Master mixes all five styles, changing techniques with each attack. The boss keeps its remaining health and form when you lose a life. Defeat it to unlock the ending.</li><li>In regular duels, each fighter begins with <strong>three lives</strong> and 100 health. A knockout costs one life. Both fighters return to full health for the next exchange.</li><li>Take all three opposing lives to win a regular duel; deplete the final boss’s single health bar to complete the story. There is no time limit.</li><li>Choose one of six arenas before the match. Your animal style receives exactly <strong>+1% movement speed</strong> on its home court, including special-move travel. The bonus applies equally to Player 1, Player 2 and the CPU. Both matching fighters benefit in a mirror match. The volcano is neutral ground.</li><li>Specials spend <strong>40 qi</strong>. Qi restores over time and when either fighter lands a hit. The qi bar glows when a special is available.</li><li>Hold Guard to reduce frontal damage. Jump to evade attacks. Holding an attack repeats it after recovery.</li><li><strong>Online:</strong> choose your fighter and Find opponent. Two waiting humans are matched automatically. Both use WASD and F/G/H (or touch controls), whichever side they spawn on. Three lives each, a random arena, and the same +1% home advantage. Return within 10 seconds after a disconnect or forfeit. Both players must agree to a rematch. Online matches keep running when you open controls or change tabs.</li><li>In offline modes, press <kbd>Esc</kbd> to pause. The match also pauses when you switch away. On phones, touch controls operate Player 1; local two-player mode uses a shared keyboard.</li></ul><p>Tip: create space after your attack. Every style has a different reach, speed, and recovery window.</p>`);}
function showStyles(){openDialog(`<span class="modal-eyebrow">THE ROOTS OF THE FIVE FORMS</span><h2>Tradition in motion.</h2><p>These five human martial artists draw on the animal traditions of Shaolin kung fu. Their traits are inspired by descriptions from Shaolin schools; the move names, balance and visual effects are original arcade interpretations. Traditions vary across lineages.</p>${FORMS.map(f=>`<article class="style-entry"><div style="color:${f.color}"><h3>${f.name}</h3><small>${f.han} / ${f.id.toUpperCase()}</small></div><div><p>${f.description}</p><p class="move-note">${f.special} — ${f.specialText}</p></div></article>`).join('')}<div class="source-links">Further reading from practicing schools:<br><a href="https://shaolin.org/answers/sp-issues/mark12-five-animals.html" target="_blank" rel="noopener noreferrer">Shaolin Wahnam · The Five Animals ↗</a><a href="https://shaolingreendragonkungfuassociation.com/the-5-animals/" target="_blank" rel="noopener noreferrer">Shaolin Green Dragon · Animal characteristics ↗</a></div>`);}

function showControlsWithTouchGuide(){showControls();$('dialogContent').querySelector('.rules-list li:nth-child(2)').innerHTML='<strong>Final boss:</strong> one continuous 300-health bar and +2% movement speed. Snake starts at 100%; Tiger at 90%, Leopard at 80%, Dragon at 70%, and Crane at 60%. At 50%, the Golden Master mixes all five styles for the rest of the fight. The floor cracks before opening gaps at 70%, 40% and 10% remaining; use W with A/D to jump them. A fall costs 20% of maximum health and returns the fighter to a safe ledge. Gaps and boss health persist after losing a life; retrying repairs the floor. Defeat it to unlock the ending.';$('dialogContent').insertAdjacentHTML('beforeend','<p><strong>Phone controls:</strong> drag on the left side of the arena to move left or right, drag up to jump, or down to guard. Use the Strike, Kick and Special buttons on the right while dragging.</p>');}
function closeDialog(){if($('infoDialog').open)$('infoDialog').close();}
document.addEventListener('keydown',e=>{
 if($('infoDialog').open||$('accountDialog').open)return;const key=e.key.toLowerCase(),target=e.target;if(['INPUT','SELECT','TEXTAREA'].includes(target.tagName))return;
 if(key==='escape'){e.preventDefault();togglePause();return;}
 if(ending){if((key==='enter'||key===' ')&&target===canvas){e.preventDefault();if(ending.beat<ENDING.length-1)advanceEnding();}return;}
 if(key==='enter'&&match.phase==='ready'&&target===canvas){e.preventDefault();start();return;}
 if(Object.values(bindings[0]).includes(key)||Object.values(bindings[1]).includes(key)){if(!['ready','over'].includes(match.phase))e.preventDefault();keys[key]=true;if(mode==='online')online.setInput(controls(0));}
});
document.addEventListener('keyup',e=>{keys[e.key.toLowerCase()]=false;if(mode==='online')online.setInput(controls(0));});
function pauseForFocus(){keys={};touch.clear();if(mode==='online'){online.setInput({});return;}if(ending)ending.paused=true;else if(['fight','countdown','ko'].includes(match.phase))match.pause();}
window.addEventListener('blur',pauseForFocus);document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseForFocus();});
for(const id of ['story','cpu','local','online'])$(id+'Mode').onclick=()=>setMode(id);
$('selectP1').onclick=()=>selectPlayer(0);$('selectP2').onclick=()=>selectPlayer(1);
$('difficulty').onchange=()=>{match.difficulty=$('difficulty').value;if(campaign)campaign.difficulty=$('difficulty').value;toast(`CPU level: ${$('difficulty').selectedOptions[0].textContent}`);};
$('pause').onclick=togglePause;$('reset').onclick=()=>{if(mode==='online'){requestOnlineLeave();return;}reset();toast(mode==='story'?'A new story · choose your fighter.':'New match · three lives each.');};
$('sound').onclick=()=>{soundOn=!soundOn;$('soundText').textContent=soundOn?'SOUND ON':'SOUND OFF';$('sound').setAttribute('aria-label',soundOn?'Turn sound off':'Turn sound on');$('sound').title=soundOn?'Turn sound off':'Turn sound on';audio('select');};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await $('arena').requestFullscreen();}catch{toast('Fullscreen is unavailable in this browser.');}};
$('stylesNav').onclick=showStyles;$('inspiration').onclick=showStyles;$('controlsNav').onclick=showControlsWithTouchGuide;$('allControls').onclick=showControlsWithTouchGuide;$('playNav').onclick=()=>$('arena').scrollIntoView({behavior:'smooth',block:'center'});$('closeDialog').onclick=closeDialog;
$('infoDialog').addEventListener('click',e=>{if(e.target===$('infoDialog')){const r=$('infoDialog').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();}});
$('infoDialog').addEventListener('close',()=>{keys={};if(modalPaused&&match.phase==='paused')match.pause();if(modalEndingPaused&&ending)ending.paused=false;modalPaused=false;modalEndingPaused=false;});
renderArenaOptions();setMode('story');if(account)account.scores();installShowcaseShortcut();requestAnimationFrame(loop);


function onlineChanged(){
 if(mode!=='online')return;
 if(online.game){
  match=online.game;selected[0]=match.fighters[online.side].form.id;
  if(onlineMatchId!==online.matchId){onlineMatchId=online.matchId;prepareMatch();canvas.focus({preventScroll:true});}
 }
 updateUI();
}
function requestOnlineLeave(after){
 const leave=async()=>{closeDialog();if(await online.leave()){onlineMatchId=null;reset();if(after)after();}};
 if(online.status==='matched'&&online.authoritative?.phase!=='over'){
  openDialog('<span class="modal-eyebrow">LEAVE THE COURTYARD</span><h2>Concede this fight?</h2><p>Your opponent will win. You can find a new opponent afterward.</p><button class="primary-button" id="confirmLeave">LEAVE MATCH</button><button class="secondary-button" id="keepFighting">KEEP FIGHTING</button>');
  $('confirmLeave').onclick=leave;$('keepFighting').onclick=closeDialog;
 }else leave();
}
function updateOnlineUI(){
 const state=online.status,over=state==='matched'&&online.authoritative?.phase==='over';
 const waiting=state==='matched'&&online.authoritative?.phase==='ready';
 if(account){$('signOut').disabled=!['idle','error'].includes(state);$('signOut').title=$('signOut').disabled?'Leave the queue or match before signing out.':'';}
 const signature=[state,over,waiting,online.reason,online.error,online.rematch?.join(),online.side].join(':');
 $('pause').disabled=true;$('pause').title='Online matches cannot be paused';
 document.querySelector('.desktop-hint').textContent='';
 document.querySelector('.fighter-hud .player-label').textContent=state==='matched'?(online.side===0?'YOU':'RIVAL'):'YOU';
 $('p2Label').textContent=state==='matched'?(online.side===1?'YOU':'RIVAL'):'RIVAL';
 $('selectP1').firstChild.textContent='YOU ';
 $('roundRule').textContent='THREE LIVES';
 $('roundStatus').textContent=state==='matched'?'ONLINE DUEL':'ONLINE';
 $('onlineConnection').textContent=state==='queued'?`${Math.max(0,Math.floor((Date.now()-(online.joined||Date.now()))/1000))}s waiting`:state==='matched'?(online.reconnecting?'RECONNECTING':`${Math.round(online.rtt||0)} ms · YOU ARE ${online.side===0?'LEFT':'RIGHT'}`):'HUMAN VS HUMAN';
 const opponentAway=state==='matched'&&!over&&online.serverTime-online.seen?.[1-online.side]>1500;
 const title=online.reconnecting?'Reconnecting…':opponentAway?'Opponent reconnecting…':state==='queued'?'Looking for another fighter…':state==='joining'?'Entering the queue…':state==='leaving'?'Leaving the courtyard…':over?'The duel is complete.':waiting?'Opponent found. Preparing the fight…':state==='matched'?'A human opponent. A shared courtyard.':state==='error'?'Unable to connect.':'Find your next rival.';
 $('onlineTitle').textContent=title;$('statusText').textContent=title;
 $('onlineDetail').textContent=online.reconnecting?'Return within 10 seconds to keep your place.':opponentAway?'Your opponent has 10 seconds to return.':state==='queued'?'Stay here. Your match starts automatically when another player joins.':state==='matched'?'WASD · F/G/H · Online matches keep running when you switch tabs.':account?'Choose a style below, then sign in to play online.':'Choose a style below, then enter the queue. Sign in with ChatGPT to play online.';
 $('stageHint').textContent='WASD + F/G/H · THREE LIVES · HOME +1%';
 if(signature!==onlineScreen){
  onlineScreen=signature;$('overlay').hidden=state==='matched'&&!over&&!waiting;
  $('announcement').textContent='';
  if(['idle','error'].includes(state)){
   setOverlay('<span class="overline">ONLINE DUELS</span><h2>Across the world.<br>In one courtyard.</h2><p id="onlineError">Choose your style. We will find your opponent.</p><button class="primary-button" id="findOpponent">FIND OPPONENT <span>↗</span></button><small>3 LIVES EACH · AUTOMATIC MATCHMAKING</small>');
   if(online.error)$('onlineError').textContent=online.error;
   if(online.needsSignIn){if(account){$('findOpponent').textContent='SIGN IN / CREATE ACCOUNT';$('findOpponent').onclick=()=>account.show();}else $('findOpponent').outerHTML='<a class="primary-button" href="/signin-with-chatgpt?return_to=%2F%3Fmode%3Donline" target="_top">SIGN IN WITH CHATGPT ↗</a>';}else $('findOpponent').onclick=()=>online.join(selected[0]);
  }else if(['queued','joining','leaving'].includes(state)){
   setOverlay('<span class="overline">THE NEXT CHALLENGE</span><h2>Patience is a form.</h2><p>Waiting for another human to enter the courtyard.</p><div class="queue-pulse" aria-hidden="true"><i></i><i></i><i></i></div><button class="secondary-button" id="cancelQueue">CANCEL SEARCH</button>');
   $('cancelQueue').disabled=state==='leaving';$('cancelQueue').onclick=()=>requestOnlineLeave();
  }else if(waiting){
   setOverlay('<span class="overline">A CHALLENGER ARRIVES</span><h2>Find your center.</h2><p>Both fighters are connecting. The countdown starts automatically.</p>');
  }else if(over){
   if(account)account.scores();
   const winner=online.authoritative.winner,won=winner===online.side,draw=winner===-1;
   setOverlay(`<span class="overline">${draw?'DRAW':won?'VICTORY':'DEFEAT'}</span><h2>${draw?'An even match.':won?'Your form prevails.':'Rise. Learn. Return.'}</h2><p>${online.reason==='forfeit'?'Your opponent conceded the fight.':online.reason==='disconnect'?'The reconnect window has ended.':online.reason==='not-ready'?'A fighter could not connect.':'Three lives. One shared lesson.'}</p>${!online.reason?'<button class="primary-button" id="onlineRematch">'+(online.rematch?.[online.side]?'WAITING FOR REMATCH':'REQUEST REMATCH')+'</button>':''}<button class="secondary-button" id="findAnother">FIND ANOTHER OPPONENT</button>`);
   if($('onlineRematch')){$('onlineRematch').disabled=online.rematch?.[online.side];$('onlineRematch').onclick=()=>online.requestRematch();}
   $('findAnother').onclick=async()=>{if(await online.leave())online.join(selected[0]);};
  }
  renderRoster();updateArenaUI();
 }
 if(state==='matched'&&!over&&!waiting){
  if(match.phase==='countdown')$('announcement').innerHTML=`<small>EXCHANGE ${match.round}</small>${Math.max(1,Math.ceil(match.timer))}`;
  if(match.phase==='ko')$('announcement').innerHTML='<small>A LIFE HAS FALLEN</small>K.O.';
 }
}
if(new URLSearchParams(location.search).get('mode')==='online')setMode('online');
if(sessionStorage.getItem('five-forms-online')){setMode('online');online.resume();}
if(account)account.openRecoveryLink();

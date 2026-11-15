// Plain Ctrl taps only: Ctrl+C, Ctrl+S and held/repeated keys never reveal it.
export function createControlTapDetector(reveal,now=()=>performance.now()){
 let down=false,used=false,lastTap=null;
 return {
  keydown(e){
   if(e.key==='Control'){
    if(e.repeat||down)return;
    down=true;used=!!(e.altKey||e.metaKey||e.shiftKey);
   }else if(down)used=true;
  },
  keyup(e){
   if(e.key!=='Control'||!down)return;
   down=false;
   if(used){lastTap=null;return;}
   const t=now();
   if(lastTap!==null&&t-lastTap<=650){lastTap=null;reveal();}
   else lastTap=t;
  },
  reset(){down=false;used=false;lastTap=null;}
 };
}
export function installShowcaseShortcut(){
 if(document.getElementById('showcaseShortcut'))return;
 const button=document.createElement('button');button.id='showcaseShortcut';button.className='showcase-shortcut';button.hidden=true;button.type='button';button.setAttribute('aria-label','Run final boss simulation');button.title='Run final boss simulation';button.textContent='✦';
 const hint=document.createElement('span');hint.textContent='FINAL BOSS SHOWCASE';button.append(hint);document.body.append(button);
 const taps=createControlTapDetector(()=>{button.hidden=false;button.classList.add('glowing');});
 document.addEventListener('keydown',taps.keydown);document.addEventListener('keyup',taps.keyup);window.addEventListener('blur',taps.reset);
 button.onclick=()=>{location.href=new URL('./boss-demo.html?autoplay=1',import.meta.url).href;};
}

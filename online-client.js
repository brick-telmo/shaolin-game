import {PROTOCOL,INPUT_KEYS,STEP,cleanInput,unpackMatch} from './online-state.js';

export class OnlineClient {
  constructor(onChange, {fetcher=(...args)=>fetch(...args),storage=sessionStorage}={}) {
    this.onChange=onChange;this.fetcher=fetcher;this.storage=storage;
    this.client=storage.getItem('five-forms-client')||crypto.randomUUID();
    storage.setItem('five-forms-client',this.client);
    this.status='idle';this.seq=0;this.input={};this.pressed={};this.events=[];
    this.generation=0;this.lastEvent=0;this.failures=0;this.error='';this.timer=null;
  }
  request(route,body={}) {
    // Serialize this tab's requests, including Cancel while Join is in flight.
    const result=(this.requestTail||Promise.resolve()).catch(()=>{}).then(()=>this.sendRequest(route,body));
    this.requestTail=result;return result;
  }
  async sendRequest(route,body={}) {
    const response=await this.fetcher('/api/online/'+route,{method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({client:this.client,protocol:PROTOCOL,...body}),signal:AbortSignal.timeout(4500)});
    const data=await response.json();
    if(!response.ok){const error=new Error(data.error||'Connection interrupted.');error.status=response.status;throw error;}
    return data;
  }
  apply(data,rtt=0) {
    this.error='';this.needsSignIn=false;this.failures=0;this.reconnecting=false;this.receivedAt=performance.now();this.rtt=rtt;
    this.status=data.status;this.joined=data.joined||this.joined;
    if(data.status==='matched') {
      if(this.matchId!==data.matchId){this.lastEvent=0;this.events=[];}
      Object.assign(this,{matchId:data.matchId,side:data.side,version:data.version,reason:data.reason,
        ready:data.ready,seen:data.seen,serverTime:data.serverTime,rematch:data.rematch,remoteInputs:data.inputs});
      this.seq=Math.max(this.seq,data.seq+1);this.authoritative=data.game;this.game=unpackMatch(data.game);
      for(const event of data.events||[])if(event.id>this.lastEvent){this.events.push(event);this.lastEvent=event.id;}
      // Predict a short distance from the authoritative snapshot. Subsequent
      // snapshots reconcile all combat state, including attacks and hit stun.
      for(let t=0;t<Math.min(rtt/2000,.12);t+=STEP)this.predict(STEP);
      this.storage.setItem('five-forms-online','1');
    } else if(data.status==='idle')this.storage.removeItem('five-forms-online');
    this.onChange();
  }
  schedule(delay=100) { clearTimeout(this.timer);const generation=this.generation;this.timer=setTimeout(()=>this.pump(generation),delay); }
  async join(form) {
    this.generation++;clearTimeout(this.timer);this.status='joining';this.error='';this.onChange();
    const generation=this.generation;
    try {const data=await this.request('join',{form});if(generation!==this.generation)return;this.apply(data);this.schedule(0);}
    catch(e){if(generation!==this.generation)return;this.status='error';this.needsSignIn=e.status===401;this.error=e.message;this.onChange();}
  }
  async resume() {
    if(!this.storage.getItem('five-forms-online'))return;
    this.status='joining';this.onChange();const generation=this.generation;
    try{const data=await this.request('poll');if(generation!==this.generation)return;this.apply(data);if(data.status!=='idle')this.schedule(0);}
    catch(e){this.status='error';this.error=e.message;this.onChange();}
  }
  async pump(generation=this.generation) {
    if(generation!==this.generation||!['queued','matched'].includes(this.status))return;
    const started=performance.now(),pressed={...this.pressed};this.pressed={};
    try {
      const data=await this.request(this.status==='matched'?'frame':'poll',this.status==='matched'?{
        matchId:this.matchId,seq:this.seq++,input:this.input,pressed}:{});
      if(generation!==this.generation)return;
      this.apply(data,performance.now()-started);
      if(data.status==='matched'&&data.reason==='not-ready'&&data.game.winner===this.side) {
        await this.join(data.game.fighters[this.side].form);return;
      }
    } catch(e) {
      if(generation!==this.generation)return;
      for(const key of INPUT_KEYS)this.pressed[key] ||= pressed[key];
      this.failures++;this.reconnecting=true;this.error=e.message;
      if([400,401,403,404,409].includes(e.status)){this.status='error';this.storage.removeItem('five-forms-online');}
      this.onChange();
    }
    if(generation===this.generation&&['queued','matched'].includes(this.status))this.schedule(this.failures?500:this.status==='queued'||this.authoritative?.phase==='over'?1000:Math.max(40,100-(performance.now()-started)));
  }
  setInput(input) {
    const next=cleanInput(input);
    for(const key of INPUT_KEYS)if(next[key]&&!this.input[key])this.pressed[key]=true;
    this.input=next;
  }
  predict(dt) {
    if(!this.game||this.status!=='matched'||this.reconnecting||performance.now()-(this.receivedAt||0)>500)return;
    const inputs=this.remoteInputs.map(input=>({...input}));inputs[this.side]=this.input;
    this.game.update(dt,inputs);this.game.events=[];
  }
  async leave() {
    this.generation++;clearTimeout(this.timer);this.input={};this.pressed={};this.status='leaving';this.onChange();
    try {await this.request('leave');this.status='idle';this.game=null;this.matchId=null;this.error='';this.storage.removeItem('five-forms-online');}
    catch(e){this.status='error';this.error='Could not confirm leaving. Retry, or wait 15 seconds for your reservation to expire.';}
    this.onChange();
    return this.status==='idle';
  }
  async requestRematch() {
    const generation=this.generation;
    try{const data=await this.request('rematch',{matchId:this.matchId});if(generation!==this.generation)return;this.apply(data);this.schedule(0);}
    catch(e){this.error=e.message;this.onChange();}
  }
}

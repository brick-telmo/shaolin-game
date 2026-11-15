import {FORMS} from './core.js';
import {ARENAS} from './arena-data.js';
import {PROTOCOL, QUEUE_TTL, newRoom, advanceRoom, acceptFrame, finishRoom} from './online-state.js';

class ApiError extends Error { constructor(status, message) { super(message); this.status=status; } }
const json = (body,status=200) => new Response(JSON.stringify(body), {status,headers:{'content-type':'application/json','cache-control':'no-store'}});

export class MatchmakingService {
  constructor(db, {now=Date.now, uuid=()=>crypto.randomUUID(), random=Math.random}={}) {
    this.db=db; this.now=now; this.uuid=uuid; this.random=random;
  }
  stmt(sql,...args) { return this.db.prepare(sql).bind(...args); }
  player(id) { return this.stmt('SELECT * FROM online_players WHERE id = ?',id).first(); }
  async room(id) { return this.stmt('SELECT * FROM online_matches WHERE id = ?',id).first(); }
  async pair() {
    const now=this.now();
    const {results} = await this.stmt("SELECT * FROM online_players WHERE status = 'queued' AND protocol = ? AND seen > ? ORDER BY joined, id LIMIT 2",PROTOCOL,now-QUEUE_TTL).all();
    if(results.length<2)return;
    const [a,b]=results, id=this.uuid(), arena=ARENAS[Math.floor(this.random()*ARENAS.length)].id;
    const state=JSON.stringify(newRoom([a.form,b.form],arena,now));
    // The insert and both reservations are one D1 transaction. Recheck the
    // queue inside it: concurrent pollers/cancellation cannot double-book.
    await this.db.batch([
      this.stmt(`INSERT INTO online_matches(id,p0,p1,state,version,updated)
        SELECT ?,?,?,?,0,? WHERE
        EXISTS(SELECT 1 FROM online_players WHERE id=? AND status='queued' AND client=? AND form=? AND protocol=? AND seen>?) AND
        EXISTS(SELECT 1 FROM online_players WHERE id=? AND status='queued' AND client=? AND form=? AND protocol=? AND seen>?)`,
        id,a.id,b.id,state,now,a.id,a.client,a.form,PROTOCOL,now-QUEUE_TTL,b.id,b.client,b.form,PROTOCOL,now-QUEUE_TTL),
      this.stmt("UPDATE online_players SET status='matched',match_id=? WHERE id IN (?,?) AND EXISTS(SELECT 1 FROM online_matches WHERE id=?)",id,a.id,b.id,id)
    ]);
  }
  async join(user, client, form) {
    if(!FORMS.some(f=>f.id===form))throw new ApiError(400,'Choose one of the five animal styles.');
    const now=this.now();
    // Keep only bounded recent records. No identity or game history is public.
    await this.db.batch([
      this.stmt("DELETE FROM online_players WHERE seen < ? AND (status != 'matched' OR match_id NOT IN (SELECT id FROM online_matches WHERE updated > ?))",now-86400000,now-86400000),
      this.stmt('DELETE FROM online_matches WHERE updated < ?',now-86400000)
    ]);
    let p=await this.player(user);
    if(p?.status==='matched') {
      const row=await this.room(p.match_id);
      if(row) {
        const room=JSON.parse(row.state); advanceRoom(room,now);
        if(room.game.phase!=='over') {
          if(p.client!==client)throw new ApiError(409,'You already have a match in another tab. Return to that tab first.');
          return this.reply(p);
        }
      }
      await this.stmt("UPDATE online_players SET status='idle',match_id=NULL WHERE id=? AND match_id=?",user,p.match_id).run();
    }
    if(p?.status==='queued'&&p.client!==client&&now-p.seen<QUEUE_TTL)
      throw new ApiError(409,'You are already waiting in another tab. Cancel there first.');
    await this.stmt(`INSERT INTO online_players(id,client,form,status,match_id,protocol,joined,seen) VALUES(?,?,?,'queued',NULL,?,?,?)
      ON CONFLICT(id) DO UPDATE SET client=excluded.client,form=excluded.form,status='queued',match_id=NULL,protocol=excluded.protocol,
      joined=CASE WHEN online_players.status='queued' THEN online_players.joined ELSE excluded.joined END,seen=excluded.seen
      WHERE online_players.status='idle' OR (online_players.status='queued' AND (online_players.client=excluded.client OR online_players.seen<?))`,
      user,client,form,PROTOCOL,now,now,now-QUEUE_TTL).run();
    p=await this.player(user);
    if(p.client!==client)throw new ApiError(409,'Another tab has reserved your place.');
    await this.pair(); return this.reply(await this.player(user));
  }
  async reply(p) {
    if(p?.status==='matched') {
      const row=await this.room(p.match_id);
      if(row)return this.snapshot(row,p.id);
    }
    return {status:p?.status==='queued'?'queued':'idle',joined:p?.joined,serverTime:this.now()};
  }
  snapshot(row,user) {
    const state=JSON.parse(row.state),side=row.p0===user?0:1;
    return {status:'matched',matchId:row.id,side,version:row.version,serverTime:this.now(),
      game:state.game,inputs:state.inputs,ready:state.ready,seen:state.seen,
      seq:state.seq[side],events:state.events,reason:state.reason,rematch:state.rematch};
  }
  async mutate(id,user,change) {
    for(let attempt=0;attempt<8;attempt++) {
      const row=await this.room(id);
      if(!row||![row.p0,row.p1].includes(user))throw new ApiError(404,'This match is no longer available.');
      const state=JSON.parse(row.state), side=row.p0===user?0:1, now=this.now();
      change(state,side,now);
      const saved=await this.stmt('UPDATE online_matches SET state=?,version=version+1,updated=? WHERE id=? AND version=?',JSON.stringify(state),now,id,row.version).run();
      if(saved.meta.changes)return this.snapshot({...row,state:JSON.stringify(state),version:row.version+1},user);
    }
    throw new ApiError(503,'The match is busy. Reconnecting…');
  }
  async handle(request) {
    try {
      if(request.method!=='POST')throw new ApiError(405,'Use POST.');
      const url=new URL(request.url),origin=request.headers.get('origin');
      if((origin&&origin!==url.origin)||request.headers.get('sec-fetch-site')==='cross-site')throw new ApiError(403,'Use the game on this site.');
      const user=request.headers.get('oai-authenticated-user-id');
      if(!user)throw new ApiError(401,'Sign in to play online.');
      if(!request.headers.get('content-type')?.startsWith('application/json'))throw new ApiError(415,'JSON required.');
      const raw=await request.text();if(raw.length>2048)throw new ApiError(413,'Input is too large.');
      let body;try{body=JSON.parse(raw);}catch{throw new ApiError(400,'Invalid input.');}
      if(!body||typeof body.client!=='string'||!/^[a-zA-Z0-9-]{16,80}$/.test(body.client))throw new ApiError(400,'Invalid player session. Reload the game.');
      if(body.protocol!==PROTOCOL)throw new ApiError(409,'The game has been updated. Reload to play online.');
      const route=url.pathname.slice('/api/online/'.length),client=body.client;
      if(route==='join')return json(await this.join(user,client,body.form));
      const p=await this.player(user);
      if(!p)return json({status:'idle'});
      if(p.client!==client)throw new ApiError(409,'This player is active in another tab.');
      if(route==='poll') {
        if(p.status==='queued') {
          await this.stmt("UPDATE online_players SET seen=? WHERE id=? AND client=? AND status='queued'",this.now(),user,client).run();
          await this.pair();
        }
        return json(await this.reply(await this.player(user)));
      }
      if(route==='leave') {
        // Reservation may win the cancellation race: reread after cancelling.
        await this.stmt("UPDATE online_players SET status='idle',match_id=NULL WHERE id=? AND client=? AND status='queued'",user,client).run();
        const current=await this.player(user);
        if(current.status==='matched')await this.mutate(current.match_id,user,(s,side,now)=>{
          advanceRoom(s,now);if(s.game.phase!=='over')finishRoom(s,1-side,s.started?'forfeit':'not-ready');
        });
        await this.stmt("UPDATE online_players SET status='idle',match_id=NULL WHERE id=? AND client=?",user,client).run();
        return json({status:'idle'});
      }
      if(!['frame','rematch'].includes(route))throw new ApiError(404,'Unknown online action.');
      if(p.status!=='matched'||body.matchId!==p.match_id)throw new ApiError(409,'This match has ended. Find another opponent.');
      if(route==='frame'&&(!Number.isSafeInteger(body.seq)||body.seq<0||body.seq>1e12))throw new ApiError(400,'Invalid input sequence.');
      return json(await this.mutate(p.match_id,user,(state,side,now)=>{
        if(route==='frame') {
          if(body.seq>state.seq[side]&&now-state.inputAt[side]<40)throw new ApiError(429,'Sending inputs too quickly. Reconnecting…');
          acceptFrame(state,side,body,now); return;
        }
        advanceRoom(state,now);
        if(state.game.phase!=='over')throw new ApiError(409,'Finish this match first.');
        if(['forfeit','disconnect','not-ready'].includes(state.reason))throw new ApiError(409,'Your opponent has left. Find another opponent.');
        state.rematch[side]=true;
        if(state.rematch.every(Boolean)) {
          const fresh=newRoom(state.game.fighters.map(f=>f.form),ARENAS[Math.floor(this.random()*ARENAS.length)].id,now);
          // Preserve monotonically increasing acknowledgements and event IDs.
          fresh.seq=state.seq;fresh.eventId=state.eventId;Object.assign(state,fresh);
        }
      }));
    } catch(error) {
      if(!error.status)console.error('Online service error',error.message);
      return json({error:error.status?error.message:'Online play is temporarily unavailable. Try again.'},error.status||503);
    }
  }
}

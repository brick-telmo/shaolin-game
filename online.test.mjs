import test from 'node:test';
import assert from 'node:assert/strict';
import {localDatabase} from './local-db.mjs';
import {MatchmakingService} from './online-service.js';
import {PROTOCOL,newRoom,advanceRoom,acceptFrame,packMatch,unpackMatch} from './online-state.js';
import {OnlineClient} from './online-client.js';
import {Match} from './core.js';

function setup(t){
 const db=localDatabase();t.after(()=>db.close());let time=100000;
 const service=new MatchmakingService(db,{now:()=>time,random:()=>0});
 const call=async(user,route,body={},headers={})=>{
  const response=await service.handle(new Request('https://game.test/api/online/'+route,{method:'POST',headers:{'content-type':'application/json','oai-authenticated-user-id':user,...headers},body:JSON.stringify({client:'client-session-'+user,protocol:PROTOCOL,...body})}));
  return {status:response.status,...await response.json()};
 };
 const pair=async()=>{await call('a','join',{form:'tiger'});await call('b','join',{form:'crane'});return await call('a','poll');};
 return {db,service,call,pair,now:()=>time,advance:ms=>time+=ms};
}
test('five concurrent users become two disjoint matches and one queued player',async t=>{
 const {call,db}=setup(t);
 await Promise.all(['a','b','c','d','e'].map(user=>call(user,'join',{form:'snake'})));
 await Promise.all(['a','b','c','d','e'].map(user=>call(user,'poll')));
 const {results:matches}=await db.prepare('SELECT * FROM online_matches').all();
 assert.equal(matches.length,2);assert.equal(new Set(matches.flatMap(m=>[m.p0,m.p1])).size,4);
 const {results:players}=await db.prepare('SELECT * FROM online_players').all();
 assert.equal(players.filter(p=>p.status==='queued').length,1);
 for(const m of matches)for(const user of [m.p0,m.p1])assert.equal(players.find(p=>p.id===user).match_id,m.id);
});
test('repeat joins and competing tabs cannot duplicate a player or match',async t=>{
 const {call,db}=setup(t);await Promise.all(Array.from({length:5},()=>call('a','join',{form:'tiger'})));
 const other=await call('a','join',{form:'crane',client:'another-tab-session'});assert.equal(other.status,409);
 await call('b','join',{form:'snake'});await call('a','join',{form:'tiger'});
 assert.equal((await db.prepare('SELECT * FROM online_matches').all()).results.length,1);
});
test('cancel versus reservation never leaves an abandoned active match',async t=>{
 const {call,db}=setup(t);await call('a','join',{form:'dragon'});
 await Promise.all([call('a','leave'),call('b','join',{form:'leopard'})]);
 const a=await db.prepare('SELECT * FROM online_players WHERE id=?').bind('a').first();assert.equal(a.status,'idle');
 for(const row of (await db.prepare('SELECT * FROM online_matches').all()).results)assert.equal(JSON.parse(row.state).game.phase,'over');
});
test('stale queue entries do not match; a returning player can join again',async t=>{
 const {call,advance}=setup(t);await call('a','join',{form:'snake'});advance(16000);
 assert.equal((await call('b','join',{form:'crane'})).status,'queued');
 assert.equal((await call('a','join',{form:'snake'})).status,'matched');
});
test('both players must connect before the countdown; controls are assigned to their own side',async t=>{
 const {call,pair,advance}=setup(t),room=await pair();
 let a=await call('a','frame',{matchId:room.matchId,seq:0,input:{right:true}});assert.equal(a.game.phase,'ready');
 let b=await call('b','frame',{matchId:room.matchId,seq:0,input:{left:true}});assert.equal(b.game.phase,'countdown');
 for(let i=1;i<=28;i++){advance(100);a=await call('a','frame',{matchId:room.matchId,seq:i,input:{right:true}});b=await call('b','frame',{matchId:room.matchId,seq:i,input:{left:true}});}
 assert.equal(a.game.phase,'fight');assert.ok(b.game.fighters[0].x>310);assert.ok(b.game.fighters[1].x<810);
 assert.deepEqual(b.game.fighters.map(f=>f.lives),[3,3]);assert.deepEqual(b.game.fighters.map(f=>f.facing),[1,-1]);
});
test('server ignores fabricated damage, positions, dt and other-side inputs',async t=>{
 const {call,pair}=setup(t),room=await pair();
 const state=await call('a','frame',{matchId:room.matchId,seq:0,input:{right:'true',hp:0},health:0,winner:0,dt:1000,side:1,x:9999});
 assert.deepEqual(state.game.fighters.map(f=>[f.hp,f.x]),[[100,310],[100,810]]);assert.equal(state.game.winner,null);
 const intruder=await call('c','join',{form:'snake'});
 assert.equal((await call('c','frame',{matchId:room.matchId,seq:0})).status,409);
 assert.equal(intruder.status,'queued');
});
test('out-of-order frames cannot replace newer controls',()=>{
 const room=newRoom(['tiger','snake'],'volcano',0);
 acceptFrame(room,0,{seq:5,input:{right:true}},10);acceptFrame(room,0,{seq:4,input:{left:true}},20);
 assert.equal(room.inputs[0].right,true);assert.equal(room.inputs[0].left,false);assert.equal(room.seq[0],5);
});
test('disconnect clears held inputs after half a second and forfeits after ten seconds',async t=>{
 const {call,pair,advance}=setup(t),room=await pair();
 await call('a','frame',{matchId:room.matchId,seq:0,input:{right:true}});await call('b','frame',{matchId:room.matchId,seq:0});
 let result;
 for(let i=1;i<=11;i++){advance(1000);result=await call('b','frame',{matchId:room.matchId,seq:i});}
 assert.equal(result.game.phase,'over');assert.equal(result.game.winner,result.side);assert.equal(result.reason,'disconnect');
 assert.equal(result.game.fighters[0].x,310);
});
test('refresh/reconnect within the grace period preserves match and input sequence',async t=>{
 const {call,pair,advance}=setup(t),room=await pair();
 await call('a','frame',{matchId:room.matchId,seq:3});await call('b','frame',{matchId:room.matchId,seq:5});advance(5000);
 await call('b','frame',{matchId:room.matchId,seq:6});const resumed=await call('a','poll');
 assert.equal(resumed.matchId,room.matchId);assert.equal(resumed.seq,3);
 assert.notEqual((await call('a','frame',{matchId:room.matchId,seq:4})).game.phase,'over');
});
test('unready opponents release the connected player; explicit leaving records forfeit',async t=>{
 const {call,pair,advance}=setup(t),room=await pair();
 await call('a','frame',{matchId:room.matchId,seq:0});advance(5000);
 await call('a','frame',{matchId:room.matchId,seq:1});advance(5001);
 const expired=await call('a','frame',{matchId:room.matchId,seq:2});
 assert.equal(expired.game.winner,expired.side);
 assert.equal(expired.reason,'not-ready');
 await call('a','join',{form:'tiger'});await call('b','join',{form:'crane'});
 const next=await call('a','poll');await call('a','frame',{matchId:next.matchId,seq:0});await call('b','frame',{matchId:next.matchId,seq:0});
 await call('a','leave');advance(100);const b=await call('b','frame',{matchId:next.matchId,seq:1});assert.equal(b.reason,'forfeit');assert.equal(b.game.winner,b.side);
});
test('rematch requires both votes and starts a fresh three-life game',async t=>{
 const {call,pair,db}=setup(t),room=await pair();
 const row=await db.prepare('SELECT * FROM online_matches WHERE id=?').bind(room.matchId).first();
 const state=JSON.parse(row.state);state.game.phase='over';state.game.winner=0;state.game.fighters[1].lives=0;
 await db.prepare('UPDATE online_matches SET state=? WHERE id=?').bind(JSON.stringify(state),room.matchId).run();
 assert.equal((await call('a','rematch',{matchId:room.matchId})).game.phase,'over');
 const rematch=await call('b','rematch',{matchId:room.matchId});assert.equal(rematch.game.phase,'ready');assert.deepEqual(rematch.game.fighters.map(f=>f.lives),[3,3]);
});
test('rejects invalid protocol, form, sequence, authentication and cross-origin writes',async t=>{
 const {call,pair}=setup(t);
 assert.equal((await call('a','join',{form:'boss'})).status,400);
 assert.equal((await call('a','join',{form:'tiger',protocol:'old'})).status,409);
 assert.equal((await call('a','join',{form:'tiger'},{origin:'https://attacker.test'})).status,403);
 assert.equal((await call('','join',{form:'tiger'})).status,401);
 const room=await pair();assert.equal((await call('a','frame',{matchId:room.matchId,seq:-1})).status,400);
});
test('serialized combat preserves attack hit windows, home bonuses and deterministic continuation',()=>{
 const a=new Match('leopard','crane','local','normal',()=>.5,'leopard');a.start();
 for(let i=0;i<150;i++)a.update(1/60,[{},{}]);a.fighters[0].x=700;a.beginAttack(a.fighters[0],'special');
 for(let i=0;i<12;i++)a.update(1/60,[{},{}]);const b=unpackMatch(packMatch(a));
 for(let i=0;i<80;i++){a.update(1/60,[{right:true},{}]);b.update(1/60,[{right:true},{}]);}
 assert.deepEqual(packMatch(a),packMatch(b));assert.ok(b.fighters[0].form.id==='leopard');
});
test('short button taps survive a network interval',()=>{
 const room=newRoom(['tiger','snake'],'volcano',0);room.started=true;room.ready=[true,true];room.game.phase='fight';
 acceptFrame(room,0,{seq:0,input:{},pressed:{strike:true}},10);advanceRoom(room,30);
 assert.equal(room.game.fighters[0].attack.type,'strike');
});
test('a complete authoritative fight consumes three lives and supports a mutual rematch',async t=>{
 const {call,pair,advance}=setup(t),room=await pair();let state=room;
 for(let seq=0;seq<2200&&state.game.phase!=='over';seq++) {
  const [a,b]=state.game.fighters,dx=b.x-a.x;
  advance(100);
  await call('a','frame',{matchId:room.matchId,seq,input:{right:dx>70,left:dx< -70,kick:Math.abs(dx)<120}});
  state=await call('b','frame',{matchId:room.matchId,seq,input:{}});
 }
 assert.equal(state.game.phase,'over');assert.equal(state.game.winner,0);assert.equal(state.game.fighters[1].lives,0);
 assert.equal(state.game.fighters[0].lives,3);
 await call('a','rematch',{matchId:room.matchId});state=await call('b','rematch',{matchId:room.matchId});
 assert.equal(state.game.phase,'ready');assert.deepEqual(state.game.fighters.map(f=>f.lives),[3,3]);
});
test('simultaneous input updates retain both players controls under compare-and-swap retries',async t=>{
 const {call,pair,advance}=setup(t),room=await pair();
 for(let seq=0;seq<8;seq++){
  advance(100);const results=await Promise.all([call('a','frame',{matchId:room.matchId,seq,input:{right:true}}),call('b','frame',{matchId:room.matchId,seq,input:{left:true}})]);
  assert.ok(results.every(r=>r.status==='matched'));
 }
 const final=await call('a','poll');assert.equal(final.inputs[0].right,true);assert.equal(final.inputs[1].left,true);
});
test('client cancellation ignores a late join response',async()=>{
 const storage=new Map();storage.getItem=storage.get.bind(storage);storage.setItem=storage.set.bind(storage);storage.removeItem=storage.delete.bind(storage);
 let finishJoin;const client=new OnlineClient(()=>{}, {storage,fetcher:async url=>url.endsWith('/join')?await new Promise(resolve=>finishJoin=resolve):Response.json({status:'idle'})});
 const joining=client.join('tiger');await Promise.resolve();await Promise.resolve();const leaving=client.leave();finishJoin(Response.json({status:'queued'}));await joining;await leaving;
 assert.equal(client.status,'idle');assert.equal(client.timer,null);
});

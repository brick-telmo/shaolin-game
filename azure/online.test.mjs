import test from 'node:test';
import assert from 'node:assert/strict';
import {CosmosStore} from './cosmos-store.js';
import {AzureMatchmakingService} from './online-service.js';
import {PROTOCOL} from '../online-state.js';

class FakeContainer {
  constructor() {
    this.documents = new Map();
    this.version = 0;
    this.items = {
      create: async body => {
        if (this.documents.has(body.id)) throw Object.assign(new Error('conflict'), {code: 409});
        this.save(body);
      },
      batch: async operations => {
        await Promise.resolve();
        if (operations.some(operation => operation.operationType === 'Replace' &&
            this.documents.get(operation.id)?._etag !== operation.ifMatch))
          return {code: 412, result: [{statusCode: 412}]};
        if (operations.some(operation => operation.operationType === 'Create' && this.documents.has(operation.resourceBody.id)))
          return {code: 409, result: [{statusCode: 424}, {statusCode: 409}]};
        for (const operation of operations) this.save(operation.resourceBody);
        return {code: 200, result: operations.map(() => ({statusCode: 200}))};
      }
    };
  }
  save(body) {
    this.documents.set(body.id, {...structuredClone(body), _etag: String(++this.version)});
  }
  item(id) {
    return {
      read: async () => {
        const resource = this.documents.get(id);
        if (!resource) throw Object.assign(new Error('not found'), {code: 404});
        return {resource: structuredClone(resource)};
      },
      replace: async (body, options) => {
        await Promise.resolve();
        if (this.documents.get(id)?._etag !== options.accessCondition.condition)
          throw Object.assign(new Error('conflict'), {code: 412});
        this.save(body);
      }
    };
  }
}

function setup() {
  const db = new FakeContainer(), store = new CosmosStore(db);
  for (const id of ['a', 'b', 'c', 'd', 'e']) db.save({id, kind: 'account', victories: 0});
  let time = 100000;
  const service = new AzureMatchmakingService(store, {now: () => time, random: () => 0});
  const call = async (user, route, body = {}, headers = {}) => {
    const response = await service.handle(new Request('https://game.test/api/online/' + route, {
      method: 'POST',
      headers: {'content-type': 'application/json', 'oai-authenticated-user-id': user, ...headers},
      body: JSON.stringify({client: 'client-session-' + user, protocol: PROTOCOL, ...body})
    }));
    return {httpStatus: response.status, ...await response.json()};
  };
  return {db, call, advance: ms => { time += ms; }};
}

test('concurrent joins reserve each player only once and pair atomically', async () => {
  const {db, call} = setup();
  await Promise.all(['a', 'b', 'c', 'd', 'e'].map(user => call(user, 'join', {form: 'snake'})));
  await Promise.all(['a', 'b', 'c', 'd', 'e'].map(user => call(user, 'poll')));
  const lobby = db.documents.get('lobby');
  const rooms = [...db.documents.values()].filter(item => item.state);
  assert.equal(rooms.length, 2);
  assert.equal(new Set(rooms.flatMap(room => [room.p0, room.p1])).size, 4);
  assert.equal(lobby.players.filter(p => p.status === 'queued').length, 1);
  for (const room of rooms) {
    for (const id of [room.p0, room.p1])
      assert.equal(lobby.players.find(p => p.id === id).match_id, room.id);
  }
});

test('concurrent frames keep both players inputs and leaving ends the match', async () => {
  const {call, advance} = setup();
  await call('a', 'join', {form: 'tiger'});
  const paired = await call('b', 'join', {form: 'crane'});
  for (let seq = 0; seq < 8; seq++) {
    advance(100);
    const results = await Promise.all([
      call('a', 'frame', {matchId: paired.matchId, seq, input: {right: true}}),
      call('b', 'frame', {matchId: paired.matchId, seq, input: {left: true}})
    ]);
    assert.ok(results.every(result => result.httpStatus === 200));
  }
  const match = await call('a', 'poll');
  assert.equal(match.inputs[0].right, true);
  assert.equal(match.inputs[1].left, true);
  await call('a', 'leave');
  advance(100);
  assert.equal((await call('b', 'frame', {matchId: paired.matchId, seq: 8})).reason, 'forfeit');
});

test('cancellation racing with pairing does not leave a live abandoned match', async () => {
  const {db, call} = setup();
  await call('a', 'join', {form: 'dragon'});
  await Promise.all([call('a', 'leave'), call('b', 'join', {form: 'leopard'})]);
  assert.equal(db.documents.get('lobby').players.find(p => p.id === 'a').status, 'idle');
  for (const room of [...db.documents.values()].filter(item => item.state))
    assert.equal(JSON.parse(room.state).game.phase, 'over');
});

test('a started forfeited match awards exactly one victory even with concurrent requests', async () => {
  const {db, call, advance} = setup();
  await call('a', 'join', {form: 'tiger'});
  const paired = await call('b', 'join', {form: 'crane'});
  await Promise.all(['a', 'b'].map(user => call(user, 'frame', {matchId: paired.matchId, seq: 0})));
  advance(100);
  await Promise.all([call('a', 'leave'), call('b', 'frame', {matchId: paired.matchId, seq: 1})]);
  assert.equal(db.documents.get('b').victories, 1);
  await call('b', 'frame', {matchId: paired.matchId, seq: 2});
  assert.equal(db.documents.get('b').victories, 1);
  assert.equal(db.documents.get('a').victories, 0);
});

test('an unstarted match does not award a victory', async () => {
  const {db, call} = setup();
  await call('a', 'join', {form: 'tiger'});
  await call('b', 'join', {form: 'crane'});
  await call('a', 'leave');
  assert.equal(db.documents.get('b').victories, 0);
});

test('completed rounds award once, rematches award again, and draws award nothing', async () => {
  const {db, call} = setup();
  await call('a', 'join', {form: 'tiger'});
  const paired = await call('b', 'join', {form: 'crane'});
  const store = new CosmosStore(db), service = new AzureMatchmakingService(store, {now: () => 100000});
  const finish = winner => service.mutate(paired.matchId, 'a', state => {
    state.started = true;
    state.game.phase = 'over';
    state.game.winner = winner;
  });
  await Promise.all([finish(0), finish(0)]);
  assert.equal(db.documents.get('a').victories, 1);
  await service.mutate(paired.matchId, 'a', state => { state.game.phase = 'fight'; state.game.winner = -1; });
  await finish(0);
  assert.equal(db.documents.get('a').victories, 2);
  await service.mutate(paired.matchId, 'a', state => { state.game.phase = 'fight'; state.game.winner = -1; });
  await finish(-1);
  assert.equal(db.documents.get('a').victories, 2);
  assert.equal(db.documents.get('b').victories, 0);
});

test('Azure matchmaking rejects unauthenticated and cross-origin requests', async () => {
  const {call} = setup();
  assert.equal((await call('', 'join', {form: 'snake'})).httpStatus, 401);
  assert.equal((await call('a', 'join', {form: 'snake'}, {origin: 'https://attacker.test'})).httpStatus, 403);
});

test('an incomplete transaction response is not treated as a successful reservation', async () => {
  const db = new FakeContainer(), store = new CosmosStore(db);
  db.items.batch = async () => ({code: 200, result: []});
  await assert.rejects(store.updateLobby(async () => ({changed: true})), /incomplete response/);
});

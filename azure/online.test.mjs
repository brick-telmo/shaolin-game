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
        const replace = operations[0], current = this.documents.get(replace.id);
        if (current?._etag !== replace.ifMatch)
          return {code: 412, result: [{statusCode: 412}]};
        if (operations[1] && this.documents.has(operations[1].resourceBody.id))
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
  const rooms = [...db.documents.values()].filter(item => item.id !== 'lobby');
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
  for (const room of [...db.documents.values()].filter(item => item.id !== 'lobby'))
    assert.equal(JSON.parse(room.state).game.phase, 'over');
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

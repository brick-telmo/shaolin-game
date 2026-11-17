import test from 'node:test';
import assert from 'node:assert/strict';
import {Accounts} from './accounts.js';

class FakeContainer {
  constructor() {
    this.documents = new Map();
    this.version = 0;
    this.items = {
      create: async doc => {
        if (this.documents.has(doc.id)) throw Object.assign(new Error('conflict'), {code: 409});
        this.save(doc);
      },
      query: () => ({fetchAll: async () => ({resources: [...this.documents.values()]
        .filter(doc => doc.kind === 'account')
        .sort((a, b) => b.victories - a.victories)
        .map(({username, victories}) => ({username, victories}))})})
    };
  }
  save(doc) { this.documents.set(doc.id, {...structuredClone(doc), _etag: String(++this.version)}); }
  item(id) {
    return {
      read: async () => {
        const doc = this.documents.get(id);
        if (!doc) throw Object.assign(new Error('missing'), {code: 404});
        return {resource: structuredClone(doc)};
      },
      replace: async (doc, options) => {
        if (this.documents.get(id)?._etag !== options.accessCondition.condition)
          throw Object.assign(new Error('conflict'), {code: 412});
        this.save(doc);
      },
      delete: async () => {
        if (!this.documents.delete(id)) throw Object.assign(new Error('missing'), {code: 404});
      }
    };
  }
}

function setup(mail = async () => {}) {
  const db = new FakeContainer(), messages = [];
  let time = 100000;
  const accounts = new Accounts(db, {origin: 'https://game.test', now: () => time,
    sendMail: mail && (async (to, link) => { messages.push({to, link}); await mail(to, link); })});
  const call = (action, body = {}, headers = {}) => accounts.handle(new Request('https://game.test/api/account/' + action, {
    method: 'POST', headers: {'content-type': 'application/json', ...headers}, body: JSON.stringify(body)
  }), action);
  return {accounts, db, call, messages, advance: ms => { time += ms; }};
}

test('accounts use case-insensitive unique usernames, hashed passwords and revocable sessions', async () => {
  const {db, call, accounts} = setup();
  const registration = await call('register', {username: 'Tiger_1', email: 'player@example.test', password: 'a very strong password'});
  assert.equal(registration.status, 201);
  const doc = db.documents.get('account:tiger_1');
  assert.match(doc.passwordHash, /^scrypt\$/);
  assert.ok(!JSON.stringify(doc).includes('a very strong password'));
  assert.equal((await call('register', {username: 'tiger_1', email: 'other@example.test', password: 'a very strong password'})).status, 409);
  assert.equal((await call('login', {username: 'TIGER_1', password: 'the wrong password'})).status, 401);
  const login = await call('login', {username: 'TIGER_1', password: 'a very strong password'});
  assert.equal(login.status, 200);
  const scores = await (await call('leaderboard')).json();
  assert.deepEqual(scores.players, [{username: 'Tiger_1', victories: 0}]);
  const cookie = login.headers.get('set-cookie').split(';')[0];
  assert.match(login.headers.get('set-cookie'), /HttpOnly; Secure; SameSite=Strict/);
  assert.equal((await accounts.authenticate(new Request('https://game.test/', {headers: {cookie}}))).username, 'Tiger_1');
  assert.equal((await call('logout', {}, {cookie})).status, 200);
  assert.equal(await accounts.authenticate(new Request('https://game.test/', {headers: {cookie}})), null);
});

test('recovery tokens expire, are single-use, and revoke prior sessions', async () => {
  const {call, messages, accounts, advance} = setup();
  const created = await call('register', {username: 'Crane', email: 'crane@example.test', password: 'old safe password'});
  const cookie = created.headers.get('set-cookie').split(';')[0];
  assert.equal((await call('forgot', {username: 'Crane'})).status, 200);
  assert.equal(messages[0].to, 'crane@example.test');
  const params = new URLSearchParams(new URL(messages[0].link).hash.slice(1));
  const body = {username: params.get('username'), token: params.get('reset'), password: 'new safe password'};
  assert.equal((await call('reset', body)).status, 200);
  assert.equal((await call('reset', body)).status, 400);
  assert.equal(await accounts.authenticate(new Request('https://game.test/', {headers: {cookie}})), null);
  assert.equal((await call('login', {username: 'Crane', password: 'new safe password'})).status, 200);
  await call('forgot', {username: 'Crane'});
  const second = new URLSearchParams(new URL(messages[1].link).hash.slice(1));
  advance(31 * 60 * 1000);
  assert.equal((await call('reset', {username: 'Crane', token: second.get('reset'), password: 'another safe password'})).status, 400);
});

test('unconfigured recovery and cross-origin account changes fail explicitly', async () => {
  const {call} = setup(null);
  assert.equal((await call('forgot', {username: 'Crane'})).status, 503);
  assert.equal((await call('register', {username: 'Crane'}, {origin: 'https://evil.test'})).status, 403);
});

test('login attempts are limited even for a nonexistent account', async () => {
  const {call, advance} = setup();
  for (let i = 0; i < 10; i++)
    assert.equal((await call('login', {username: 'Missing', password: 'wrong password value'})).status, 401);
  assert.equal((await call('login', {username: 'Missing', password: 'wrong password value'})).status, 429);
  advance(16 * 60 * 1000);
  assert.equal((await call('login', {username: 'Missing', password: 'wrong password value'})).status, 401);
});

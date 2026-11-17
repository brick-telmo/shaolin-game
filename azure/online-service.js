import {FORMS} from '../core.js';
import {ARENAS} from '../arena-data.js';
import {MatchmakingService} from '../online-service.js';
import {PROTOCOL, QUEUE_TTL, newRoom, advanceRoom, acceptFrame, finishRoom} from '../online-state.js';

class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: {'content-type': 'application/json', 'cache-control': 'no-store'}
});

export class AzureMatchmakingService extends MatchmakingService {
  constructor(store, options) {
    super(null, options);
    this.store = store;
  }

  player(lobby, id) { return lobby.players.find(player => player.id === id); }

  pair(lobby, now) {
    const waiting = lobby.players.filter(p => p.status === 'queued' && p.protocol === PROTOCOL && p.seen > now - QUEUE_TTL)
      .sort((a, b) => a.joined - b.joined || a.id.localeCompare(b.id));
    if (waiting.length < 2) return null;
    const [a, b] = waiting;
    const id = this.uuid();
    const arena = ARENAS[Math.floor(this.random() * ARENAS.length)].id;
    const room = {
      id, p0: a.id, p1: b.id, state: JSON.stringify(newRoom([a.form, b.form], arena, now)),
      version: 0, updated: now
    };
    for (const player of [a, b]) { player.status = 'matched'; player.match_id = id; }
    return room;
  }

  async join(user, client, form) {
    if (!FORMS.some(f => f.id === form)) throw new ApiError(400, 'Choose one of the five animal styles.');
    const now = this.now();
    await this.store.updateLobby(async lobby => {
      const recent = [];
      for (const player of lobby.players) {
        if (player.seen > now - 86400000) recent.push(player);
        else if (player.status === 'matched') {
          const room = await this.store.read(player.match_id);
          if (room && room.updated > now - 86400000) recent.push(player);
        }
      }
      lobby.players = recent;
      let p = this.player(lobby, user);
      if (p?.status === 'matched') {
        const row = await this.store.read(p.match_id);
        if (row) {
          const room = JSON.parse(row.state);
          advanceRoom(room, now);
          if (room.game.phase !== 'over') {
            if (p.client !== client) throw new ApiError(409, 'You already have a match in another tab. Return to that tab first.');
            return {changed: false};
          }
        }
        p.status = 'idle'; p.match_id = null;
      }
      if (p?.status === 'queued' && p.client !== client && now - p.seen < QUEUE_TTL)
        throw new ApiError(409, 'You are already waiting in another tab. Cancel there first.');
      if (!p) {
        if (lobby.players.length >= 500) throw new ApiError(503, 'The matchmaking lobby is full. Please try again later.');
        p = {id: user}; lobby.players.push(p);
      }
      const joined = p.status === 'queued' ? p.joined : now;
      Object.assign(p, {client, form, status: 'queued', match_id: null, protocol: PROTOCOL, joined, seen: now});
      return {changed: true, room: this.pair(lobby, now)};
    });
    return this.reply(await this.currentPlayer(user));
  }

  async currentPlayer(user) {
    return this.player(await this.store.lobby(), user);
  }

  async reply(p) {
    if (p?.status === 'matched') {
      const row = await this.store.read(p.match_id);
      if (row) return this.snapshot(row, p.id);
    }
    return {status: p?.status === 'queued' ? 'queued' : 'idle', joined: p?.joined, serverTime: this.now()};
  }

  async mutate(id, user, change) {
    const result = await this.store.updateRoom(id, row => {
      if (![row.p0, row.p1].includes(user)) throw new ApiError(404, 'This match is no longer available.');
      const state = JSON.parse(row.state), side = row.p0 === user ? 0 : 1, now = this.now();
      change(state, side, now);
      row.state = JSON.stringify(state); row.version++; row.updated = now;
      return this.snapshot(row, user);
    });
    if (!result) throw new ApiError(404, 'This match is no longer available.');
    return result;
  }

  async handle(request) {
    try {
      if (request.method !== 'POST') throw new ApiError(405, 'Use POST.');
      const url = new URL(request.url), origin = request.headers.get('origin');
      if ((origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site')
        throw new ApiError(403, 'Use the game on this site.');
      const user = request.headers.get('oai-authenticated-user-id');
      if (!user) throw new ApiError(401, 'Sign in to play online.');
      if (!request.headers.get('content-type')?.startsWith('application/json')) throw new ApiError(415, 'JSON required.');
      const raw = await request.text();
      if (raw.length > 2048) throw new ApiError(413, 'Input is too large.');
      let body;
      try { body = JSON.parse(raw); } catch { throw new ApiError(400, 'Invalid input.'); }
      if (!body || typeof body.client !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(body.client))
        throw new ApiError(400, 'Invalid player session. Reload the game.');
      if (body.protocol !== PROTOCOL) throw new ApiError(409, 'The game has been updated. Reload to play online.');
      const route = url.pathname.slice('/api/online/'.length), client = body.client;
      if (route === 'join') return json(await this.join(user, client, body.form));
      let p = await this.currentPlayer(user);
      if (!p) return json({status: 'idle'});
      if (p.client !== client) throw new ApiError(409, 'This player is active in another tab.');
      if (route === 'poll') {
        if (p.status === 'queued') {
          await this.store.updateLobby(async lobby => {
            const current = this.player(lobby, user);
            if (!current || current.client !== client || current.status !== 'queued') return {changed: false};
            const now = this.now(); current.seen = now;
            return {changed: true, room: this.pair(lobby, now)};
          });
        }
        return json(await this.reply(await this.currentPlayer(user)));
      }
      if (route === 'leave') {
        p = await this.store.updateLobby(async lobby => {
          const current = this.player(lobby, user);
          if (!current) return {changed: false, value: current};
          if (current.client !== client) throw new ApiError(409, 'This player is active in another tab.');
          if (current.status === 'queued') {
            current.status = 'idle'; current.match_id = null;
            return {changed: true, value: {...current}};
          }
          return {changed: false, value: {...current}};
        });
        if (p?.status === 'matched') {
          await this.mutate(p.match_id, user, (s, side, now) => {
            advanceRoom(s, now);
            if (s.game.phase !== 'over') finishRoom(s, 1 - side, s.started ? 'forfeit' : 'not-ready');
          });
          await this.store.updateLobby(async lobby => {
            const current = this.player(lobby, user);
            if (!current || current.client !== client || current.match_id !== p.match_id) return {changed: false};
            current.status = 'idle'; current.match_id = null;
            return {changed: true};
          });
        }
        return json({status: 'idle'});
      }
      if (!['frame', 'rematch'].includes(route)) throw new ApiError(404, 'Unknown online action.');
      if (p.status !== 'matched' || body.matchId !== p.match_id) throw new ApiError(409, 'This match has ended. Find another opponent.');
      if (route === 'frame' && (!Number.isSafeInteger(body.seq) || body.seq < 0 || body.seq > 1e12))
        throw new ApiError(400, 'Invalid input sequence.');
      return json(await this.mutate(p.match_id, user, (state, side, now) => {
        if (route === 'frame') {
          if (body.seq > state.seq[side] && now - state.inputAt[side] < 40)
            throw new ApiError(429, 'Sending inputs too quickly. Reconnecting…');
          acceptFrame(state, side, body, now); return;
        }
        advanceRoom(state, now);
        if (state.game.phase !== 'over') throw new ApiError(409, 'Finish this match first.');
        if (['forfeit', 'disconnect', 'not-ready'].includes(state.reason))
          throw new ApiError(409, 'Your opponent has left. Find another opponent.');
        state.rematch[side] = true;
        if (state.rematch.every(Boolean)) {
          const fresh = newRoom(state.game.fighters.map(f => f.form), ARENAS[Math.floor(this.random() * ARENAS.length)].id, now);
          fresh.seq = state.seq; fresh.eventId = state.eventId; Object.assign(state, fresh);
        }
      }));
    } catch (error) {
      if (!error.status) console.error('Online service error', error.message);
      return json({error: error.status ? error.message : 'Online play is temporarily unavailable. Try again.'}, error.status || 503);
    }
  }
}

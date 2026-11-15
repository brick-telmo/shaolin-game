import {Match, FORMS} from './core.js';

export const PROTOCOL = 'five-forms-1';
export const INPUT_KEYS = ['left','right','jump','guard','strike','kick','special'];
export const RECONNECT_MS = 10000;
export const QUEUE_TTL = 15000;
export const STEP = 1 / 60;
export function cleanInput(value = {}) {
  return Object.fromEntries(INPUT_KEYS.map(key => [key, value?.[key] === true]));
}
export function packMatch(match) {
  return {
    arena: match.arena.id, phase: match.phase, timer: match.timer,
    round: match.round, winner: match.winner, elapsed: match.elapsed,
    fighters: match.fighters.map(f => ({...f, form: f.form.id,
      attack: f.attack ? {...f.attack, hits: [...f.attack.hits]} : null}))
  };
}
export function unpackMatch(state) {
  const match = new Match(state.fighters[0].form, state.fighters[1].form, 'local', 'normal', Math.random, state.arena);
  for (const key of ['phase','timer','round','winner','elapsed']) match[key] = state[key];
  state.fighters.forEach((f,i) => Object.assign(match.fighters[i], f, {
    form: FORMS.find(form => form.id === f.form),
    attack: f.attack ? {...f.attack, hits: new Set(f.attack.hits)} : null
  }));
  return match;
}
export function newRoom(forms, arena, now) {
  return {game: packMatch(new Match(...forms, 'local', 'normal', Math.random, arena)),
    ready: [false,false], seen: [now,now], inputs: [{},{}], pending: [{},{}],
    seq: [-1,-1], inputAt: [0,0], tickAt: now, created: now,
    started: false, reason: '', eventId: 0, events: [], rematch: [false,false]};
}
function collect(room, match) {
  for (const event of match.events.splice(0)) room.events.push({...event, id: ++room.eventId});
  room.events = room.events.slice(-48);
}
export function finishRoom(room, winner, reason) {
  room.game.phase = 'over'; room.game.winner = winner; room.reason = reason;
  room.inputs = [{},{}]; room.pending = [{},{}];
}
export function advanceRoom(room, now) {
  if (room.game.phase === 'over') return;
  const stale = room.seen.map(time => now - time >= RECONNECT_MS);
  if (stale.some(Boolean)) {
    finishRoom(room, stale.every(Boolean) ? -1 : stale[0] ? 1 : 0,
      room.started ? 'disconnect' : 'not-ready');
    return;
  }
  if (!room.started) { room.tickAt = now; return; }
  const match = unpackMatch(room.game);
  // A stalled client cannot keep walking/attacking indefinitely. The server's
  // own clock controls simulation; clients never submit dt, health or positions.
  while (room.tickAt + STEP * 1000 <= now) {
    room.tickAt += STEP * 1000;
    const inputs = room.inputs.map((held,i) => room.tickAt - room.inputAt[i] > 500 ? {} :
      Object.fromEntries(INPUT_KEYS.map(k => [k, !!held[k] || !!room.pending[i][k]])));
    match.update(STEP, inputs);
    room.pending = [{},{}];
    if (match.phase === 'over') break;
  }
  collect(room, match); room.game = packMatch(match);
}
export function acceptFrame(room, side, payload, now) {
  advanceRoom(room, now);
  room.seen[side] = now;
  room.ready[side] = true;
  if (payload.seq > room.seq[side]) {
    room.inputs[side] = cleanInput(payload.input);
    const presses = cleanInput(payload.pressed);
    for (const key of INPUT_KEYS) room.pending[side][key] ||= presses[key];
    room.seq[side] = payload.seq; room.inputAt[side] = now;
  }
  if (!room.started && room.game.phase !== 'over' && room.ready.every(Boolean)) {
    const match = unpackMatch(room.game); match.start();
    room.started = true; room.tickAt = now; room.game = packMatch(match); collect(room, match);
  }
}

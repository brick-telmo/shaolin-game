# Five Forms — Shaolin Arcade

A browser-based, sprite-animated fighting game with five human martial artists inspired by the Snake, Tiger, Leopard, Dragon and Crane traditions of Shaolin kung fu.

## Play locally

Requires Node.js 22.16 or newer:

```sh
npm ci
npm run build
npm start
```

Open http://127.0.0.1:4173. For two local online players, open a second browser profile, or open http://localhost:4173 in a second tab: these hostnames have separate development identities. The development server listens only on loopback, supplies local identities, and uses an in-memory SQLite database. Set `LOCAL_DATABASE` to a local `.sqlite` path for persistence. Its identity adapter is never part of the hosted Worker.

Offline Story, VS CPU, local two-player, and the boss showcase can still run with `python3 -m http.server 4173` without installing dependencies. Online mode requires the server above or the deployed service. A modern browser with Canvas and ES modules is needed. Optional Google Fonts have system fallbacks.

## Online matchmaking

Choose **ONLINE**, select your animal style, then **FIND OPPONENT**. The oldest two compatible waiting players are paired automatically. Both connect before the countdown. Each starts with three lives. The server randomly chooses one of the six arenas; the existing 1% home advantage applies. Both players use **WASD + F/G/H**, regardless of which side they spawn on. Touch controls also operate your own fighter.

- Hosted visitors need access under the Site’s sharing policy. Public access requires public publishing to be enabled by the workspace administrator. Online play uses ChatGPT sign-in and one active queue/match per account. No emails or names are sent to opponents.
- Cancel removes your queue reservation. Leaving an active match concedes it.
- A refresh restores your session. A disconnected fighter has 10 seconds to return; otherwise the remaining fighter wins. Held inputs expire after 500 ms, so disconnected players cannot continue attacking.
- If an opponent never connects, the connected player returns to the queue automatically. A waiting reservation expires after 15 seconds without a heartbeat.
- Both players must request a rematch after a completed fight. Otherwise, find another opponent.
- Escape, controls dialogs, and switching tabs do not pause an online fight. The game clears held keys when focus is lost.

### Service architecture and deployment

The hosted service is a Cloudflare Worker backed by D1. Atomic queue reservations prevent duplicate assignments. Match updates use a versioned compare-and-swap to preserve simultaneous inputs. The server runs the existing combat engine at 60 fixed steps per simulated second, advancing on incoming requests. Clients submit only validated controls and sequence numbers; health, positions, elapsed time, and winners are determined by the server. The client predicts between authoritative snapshots and corrects to each received state. Short key taps are retained until transmitted.

This first version uses approximately 10 HTTP input/snapshot exchanges per second per active player, plus one queue heartbeat per second. It fits the existing Sites host; it does **not** use the separately hosted Colyseus/WebSocket server considered in the initial plan. It is intended for casual beta play. It has no regional latency-based pairing, skill ratings, rollback lag compensation, or large-scale load validation. High latency can cause visible corrections. A persistent room server is the next scaling step if competitive latency or substantial concurrent traffic is needed.

Production identity comes only from the Sites `oai-authenticated-user-id` header. Requests require same-origin JSON; users cannot read or control another match. Input sequence, payload size and per-player input cadence are checked. Queue records and match snapshots older than 24 hours are removed opportunistically when players join; no long-term match history is retained. The database binding is `DB`.

For Sites, retain the existing project ID in `.openai/hosting.json`, remove the `static` entry, and set `"d1": "DB"` and `"r2": null`. `npm run build` embeds only explicitly listed browser assets and bundles the Worker to `dist/server/index.js`; it does not expose source tests, database schema, or server modules as static routes. Generated immutable schema migrations live in `drizzle/`. After editing `db/schema.ts`, run `npm run db:generate` and inspect the new migration before deploying. Sites applies migrations during deployment.

## Boss showcase

Open `boss-demo.html` and press **Watch the fight** to run a replayable, roughly one-minute scripted exhibition. It uses the real combat renderer, attacks and transformation rules, with a timed health bar that guarantees every boss appearance and the full ending are shown. Pause or replay it at any time. In the game, double-tap Ctrl within 650 milliseconds to reveal the glowing top-right ✦ button, then click it to launch the showcase automatically. The button is hidden until the shortcut is used; ordinary Ctrl key combinations do not reveal it. The main game continues to use normal combat damage.

## Controls

| Action | Player 1 | Player 2 |
| --- | --- | --- |
| Move | A / D | Left / Right |
| Jump | W | Up |
| Guard | S | Down |
| Strike | F | J |
| Kick | G | K |
| Special | H | L |
| Pause | Escape | Escape |

Choose STORY for the campaign, VS CPU for an exhibition, 2 PLAYERS for a shared-keyboard duel, or ONLINE for an automatically matched human opponent. Select the P1 or CPU/P2 tab above the roster to change that fighter. Each fighter begins with three lives and 100 health. A knockout removes one life; health resets for the next exchange. The first fighter to lose all three lives loses a regular match. Each solo fight allows **one retry (two attempts total)**, with three lives per attempt. Fighters face each other at the start of every exchange. Specials cost 40 qi, with regeneration and a short cooldown. Touch controls operate Player 1 on small screens. Two-player mode requires a shared keyboard.

## Story: the path to mastery

Choose one fighter for the whole journey. Defeat Snake, Tiger, Leopard, Dragon and Crane in that order on their own home courts. Each new chapter restores three lives and grants one retry. A retry preserves earlier victories; losing the second attempt ends the journey and requires a new story. Campaign progress lasts for the current browser session and is reset by reloading the page.

The sixth trial takes place at the neutral volcano against **The Fivefold Master**. The boss has one continuous 300-HP bar and exactly **+2% horizontal movement and special-dash speed** relative to its active style. Its remaining health and form persist when the player loses a life.

| Boss health remaining | Appearance and techniques |
| --- | --- |
| Above 80% | Snake |
| 80% down to above 60% | Tiger |
| 60% down to above 40% | Leopard |
| 40% down to above 20% | Dragon |
| 20% or below | Golden Master: golden clothing and armor; cycles Snake, Tiger, Leopard, Dragon and Crane techniques with each accepted attack |

The boss transforms at 240, 180, 120 and 60 HP, with a short visual burst and recovery. Attack timing and damage retain the active style's normal values; the speed bonus never stacks with a home bonus.

Defeat the boss to unlock a three-part animated ceremony about overcoming all five styles and becoming a true Shaolin master. Continue manually, let the scenes advance, skip to the epilogue, or replay the ending. Escape also pauses the cutscene.

## The fighters

| Form | Game role | Original arcade special |
| --- | --- | --- |
| Snake | Precise, long-reaching palm attacks | Serpent’s Reach: forward lunge |
| Tiger | High damage and deliberate pressure | Tiger Pounce: heavy claw and knockback |
| Leopard | Fast footwork and compact combinations | Leopard Rush: three-hit dash |
| Dragon | Balanced movement and circular attacks | Rising Dragon: rising turning palm |
| Crane | Reach, balance and high jumps | Crane Ascends: aerial wing kick |

The move names, effects and game balance are fictional arcade interpretations. Traditional descriptions differ between lineages. Sources used for character inspiration:

- [Shaolin Wahnam: Shaolin Five Animals](https://shaolin.org/answers/sp-issues/mark12-five-animals.html)
- [Shaolin Green Dragon Kung Fu Association: The 5 Animals](https://shaolingreendragonkungfuassociation.com/the-5-animals/)

All sprites, animation frames, scenery and sound effects are generated by the game's own code. The design uses Barlow Condensed, DM Sans and IBM Plex Mono through Google Fonts.

## Six arenas and home advantage

Choose an arena above the match before starting. In offline duels the selected ground stays fixed through knockouts and rematches. Online matches and agreed rematches receive a randomly selected arena. Reset the match to choose a different arena.

| Arena | Home style | Setting |
| --- | --- | --- |
| Jade Coil Grove | Snake | Mist, bamboo, a jade serpent and lotus pools |
| Amber Fang Gate | Tiger | An autumn canyon and twin tiger guardians |
| Golden Canopy | Leopard | Jungle roots, a rope bridge and a resting leopard |
| Stormspire Shrine | Dragon | Cloud peaks, a dragon sculpture and a glowing pearl |
| Moonwater Pavilion | Crane | Moonlit water, white cranes and a lakeside pavilion |
| Cinder Caldera | None | A smoking volcano, lava and a basalt platform |

The matching style receives exactly **1% more horizontal movement speed** (a 1.01 multiplier), including guarded movement, air control and special-move travel. It applies equally to either local player and the CPU; both matching fighters receive it in a mirror match. It does not stack after knockouts. The volcano grants no home bonus; the story boss has its separate 2% bonus. Attack timing, damage, jump impulse and health are unaffected.

Each background has animated elemental scenery: drifting air and mist, water ripples and rain, fire and lava, and moving dust, stone and roots. The snake flicks its tongue, tiger guardians blink and sway their tails, the leopard breathes and moves its tail, the dragon's whiskers move, and cranes wade and flap. Animation shares the game clock, freezes on pause, and respects reduced-motion preferences.

The original game-building requests are recorded in [PROMPTS.md](PROMPTS.md).

## Development

- `core.js`: deterministic simulation, hit detection, life rules and CPU decisions.
- `render.js`: generated humanoid sprite frames, Golden Master variants, combat effects and ending animation.
- `story.js` / `story-data.js`: campaign progression, retry allowance, boss phases and ending script.
- `arena-motion.js`: elemental and animal animation layered over cached scenery.
- `arena-data.js`: the six arenas and exact home-speed multiplier.
- `arenas.js`: six original pixel-art backgrounds.
- `app.js`: input, UI, synthesized audio and the fixed-step game loop.
- `style.css`: responsive interface.
- `core.test.mjs`: automated combat and match-flow checks.
- `story.test.mjs`: six-trial progression, retry cap, facing resets, boss thresholds, mixed techniques and ending gates.
- `shortcut.test.mjs`: double-Ctrl reveal, timeout, modifier combinations and repeated keys.
- `animation.test.mjs`: animated scenery and animals in every arena, plus reduced-motion behavior.
- `arenas.test.mjs`: neutral ground, all home/away combinations, CPU parity, mirror matches, dash movement and bonus persistence.

With Node.js 22.16 or newer:

```sh
node --test *.test.mjs
```

The test suite covers offline combat and story rules plus concurrent matchmaking, odd-sized queues, cancellation races, duplicate tabs, stale reservations, identity and input validation, reconnection, disconnect forfeits, full three-life online fights, mutual rematches, and serialization of attack hit windows. Browser QA covers two independent online sessions, automatic countdown, movement, synchronized damage, refresh/reconnect, cancellation and leaving a match.

Online source files: `online-service.js` (authenticated API and atomic queue), `online-state.js` (authoritative simulation/serialization), `online-client.js` (transport and prediction), `worker.js` (HTTP routing), `db/schema.ts` and `drizzle/` (schema), `build.mjs` (Worker bundle), and `online.test.mjs` (service and client tests).

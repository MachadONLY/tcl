import assert from 'node:assert/strict';
import { createCareer } from '../src/career-core/career-runtime.js';
import { WORLD_PLAYER_BY_ID } from '../src/career-world/world-player-database.js';
import { createPlayerBrain } from '../src/career-world/transfers/player-brain.js';
import { ensurePlayerStatus, playerIdsForClubState } from '../src/career-world/world-employment-index.js';
import { makePlayerPromise, processPlayerLifeDay } from '../src/career-world/players/player-life-engine.js';

const career = createCareer('MUN', '2026-08-08T19:48:00.000Z');
const candidates = playerIdsForClubState(career.world, 'MUN')
  .map(id => WORLD_PLAYER_BY_ID.get(id))
  .filter(Boolean)
  .sort((left, right) => createPlayerBrain(right).playingTimeNeed - createPlayerBrain(left).playingTimeNeed);
const player = candidates[0];
assert.ok(player, 'player life test needs a user-club player');

const status = ensurePlayerStatus(career.world, player);
status.squadRole = 'key';
status.playingTimeExpectation = 'star-player';
status.happiness = 72;

const otherPlayers = candidates.filter(candidate => candidate.id !== player.id).slice(0, 11).map(candidate => candidate.id);
for (let index = 0; index < 5; index += 1) {
  const day = String(20 + index).padStart(2, '0');
  career.results[`life-test-${index}`] = {
    fixtureId: `life-test-${index}`,
    date: `2026-07-${day}`,
    home: 'MUN',
    away: 'EVE',
    homeGoals: 1,
    awayGoals: 0,
    lineups: { home: otherPlayers, away: [] },
    events: []
  };
}

const review = processPlayerLifeDay({ career, date: '2026-08-03', playerById: WORLD_PLAYER_BY_ID });
assert.ok(review.reviewed > 0, 'weekly player-life pass must evaluate employed players');
assert.ok(career.world.playerStatus[player.id].happiness < 72, 'missing promised playing time must affect happiness');
assert.ok(career.world.playerRelations.concerns[`${player.id}:playing-time`]?.active, 'playing-time concern must be explicit state');
assert.ok(career.inbox.some(message => message.id.startsWith(`player-concern-${player.id}-playing-time-`)), 'user must receive the player concern in inbox');

career.currentDate = '2026-08-03';
const promise = makePlayerPromise(career, player.id, 'playing-time', {
  playerById: WORLD_PLAYER_BY_ID,
  dueDate: '2026-08-10',
  requiredShare: .55
});
assert.ok(promise && promise.status === 'tracking', 'user should be able to make an explicit player promise');

const beforeBrokenPromise = career.world.playerStatus[player.id].happiness;
processPlayerLifeDay({ career, date: '2026-08-10', playerById: WORLD_PLAYER_BY_ID });
assert.equal(promise.status, 'broken', 'promise must be evaluated against authoritative match usage');
assert.ok(career.world.playerStatus[player.id].happiness < beforeBrokenPromise, 'broken promise must have a real relationship consequence');
assert.ok(career.world.events.some(event => event.type === 'PLAYER_PROMISE_BROKEN' && event.entities.playerId === player.id));
assert.ok(career.inbox.some(message => message.id === `promise-broken-${promise.id}`), 'broken promise must surface to user');

console.log(JSON.stringify({
  ok: true,
  player: player.name,
  playingTimeNeed: createPlayerBrain(player).playingTimeNeed,
  concernRaised: true,
  promiseTracked: true,
  promiseBroken: true,
  happiness: career.world.playerStatus[player.id].happiness
}, null, 2));

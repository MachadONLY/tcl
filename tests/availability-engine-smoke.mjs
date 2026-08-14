import assert from 'node:assert/strict';
import { createCareer, simulateFixture } from '../src/career-core/career-runtime.js';
import { FIXTURES } from '../src/career-core/season-2026-27-live.js';
import { WORLD_PLAYER_BY_ID } from '../src/career-world/world-player-database.js';
import { positionBucket } from '../src/career-world/clubs/squad-analysis.js';
import { registerPlayerInjury, registerPlayerSuspension, playerUnavailable } from '../src/career-world/players/availability-engine.js';
import { ensurePlayerStatus, playerIdsForClubState } from '../src/career-world/world-employment-index.js';
import { processWorldDay } from '../src/career-world/world-engine.js';

const career = createCareer('MUN', '2026-08-08T19:48:00.000Z');
const fixture = FIXTURES.find(row => row.home === 'MUN' || row.away === 'MUN');
assert.ok(fixture, 'availability test needs a Manchester United fixture');

const munPlayers = playerIdsForClubState(career.world, 'MUN').map(id => WORLD_PLAYER_BY_ID.get(id)).filter(Boolean);
const striker = munPlayers.filter(player => positionBucket(player) === 'ST').sort((left, right) => Number(right.rating) - Number(left.rating))[0];
assert.ok(striker, 'availability test needs a striker');
registerPlayerInjury({ career, date: fixture.date, player: striker, durationDays: 75, type: 'hamstring' });
assert.ok(playerUnavailable(ensurePlayerStatus(career.world, striker), fixture.date));

const simulated = simulateFixture(career, fixture);
const userSide = fixture.home === 'MUN' ? 'home' : 'away';
assert.ok(!simulated.lineups[userSide].includes(striker.id), 'injured player must never be selected for the match');

const defender = munPlayers.filter(player => player.id !== striker.id && player.group === 'DEF')[0];
assert.ok(defender);
registerPlayerSuspension({ career, date: fixture.date, player: defender, matches: 1, reason: 'red-card' });
const simulatedSuspension = simulateFixture(career, fixture);
assert.ok(!simulatedSuspension.lineups[userSide].includes(defender.id), 'suspended player must never be selected');

const strikers = munPlayers.filter(player => positionBucket(player) === 'ST');
for (const player of strikers.slice(0, Math.max(1, strikers.length - 1))) {
  registerPlayerInjury({ career, date: '2026-07-01', player, durationDays: 90, type: 'knee-injury' });
}
processWorldDay(career, '2026-07-02');
const stRequirement = (career.world.clubs.MUN.recruitment.requirements || []).find(row => row.position === 'ST');
assert.ok(stRequirement, 'long injuries must create a real squad requirement');
assert.ok(Number(stRequirement.priority) > 0, 'injury replacement need must carry recruitment priority');

console.log(JSON.stringify({
  ok: true,
  injuredPlayerExcluded: true,
  suspendedPlayerExcluded: true,
  injuryRequirement: {
    position: stRequirement.position,
    priority: stRequirement.priority,
    reason: stRequirement.reason
  },
  medicalInbox: career.inbox.some(message => message.id.startsWith(`injury-${striker.id}-`))
}, null, 2));

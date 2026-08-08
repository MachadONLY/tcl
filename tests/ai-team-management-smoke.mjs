import assert from 'node:assert/strict';
import { createCareer, simulateFixture } from '../src/career-core/career-runtime.js';
import { FIXTURES } from '../src/career-core/season-2026-27-live.js';
import { ensureLivingWorld } from '../src/career-world/world-engine.js';

const career = createCareer('MUN', '2026-08-08T22:00:00.000Z');
const aiFixture = FIXTURES.find(fixture => fixture.home !== career.clubCode && fixture.away !== career.clubCode);
assert.ok(aiFixture, 'test needs a fixture controlled by two AI managers');

const first = simulateFixture(career, aiFixture);
const second = simulateFixture(structuredClone(career), aiFixture);
assert.deepEqual(second, first, 'AI selection and tactical planning must be deterministic for the same save and fixture');
assert.equal(first.lineups.home.length, 11);
assert.equal(first.lineups.away.length, 11);

for (const side of ['home', 'away']) {
  const code = first[side];
  const tactical = first.tactical[side];
  assert.ok(tactical.style && tactical.style !== 'user', `${code} must use its ClubBrain tactical identity`);
  assert.ok(tactical.formation, `${code} must expose the AI manager formation`);
  assert.ok(tactical.managerName && tactical.managerName !== 'AI Manager', `${code} must expose its real manager identity from club data`);
  assert.ok(tactical.importance >= .3 && tactical.importance <= .94, `${code} must evaluate match importance`);
  for (const playerId of first.lineups[side]) {
    assert.equal(career.world.employment[playerId], code, `${playerId} must currently be employed by ${code}`);
  }
}

const preservedEvent = { id: 'legacy-preserve-event', date: '2026-07-02', type: 'TEST_EVENT', entities: {}, payload: {} };
const preservedTransfer = { id: 'legacy-preserve-transfer', date: '2026-07-03', playerId: 'x', fromClubCode: 'ARS', toClubCode: 'CHE', fee: 123 };
career.world.schemaVersion = 1;
career.world.events.push(preservedEvent);
career.world.transferMarket.history.push(preservedTransfer);
const oldSeed = career.world.seed;
ensureLivingWorld(career);
assert.equal(career.world.schemaVersion, 2, 'legacy world save must migrate to v2');
assert.equal(career.world.seed, oldSeed, 'migration must preserve deterministic seed');
assert.ok(career.world.events.some(event => event.id === preservedEvent.id), 'migration must preserve event ledger');
assert.ok(career.world.transferMarket.history.some(row => row.id === preservedTransfer.id), 'migration must preserve transfer history');
assert.ok(career.world.clubs.ARS.brain, 'migration must enrich existing clubs with ClubBrain');
assert.ok(career.world.clubs.ARS.managerBrain, 'migration must enrich existing clubs with ManagerBrain');
assert.ok(career.world.migrations.some(row => row.to === 2), 'migration must be auditable');

console.log(JSON.stringify({
  ok: true,
  fixture: aiFixture.id,
  home: { code: first.home, style: first.tactical.home.style, formation: first.tactical.home.formation, manager: first.tactical.home.managerName },
  away: { code: first.away, style: first.tactical.away.style, formation: first.tactical.away.formation, manager: first.tactical.away.managerName },
  saveMigrationPreserved: true
}, null, 2));

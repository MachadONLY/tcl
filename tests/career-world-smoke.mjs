import assert from 'node:assert/strict';
import {
  createCareer,
  simulateFixture
} from '../src/career-core/career-runtime.js';
import { FIXTURES } from '../src/career-core/season-2026-27-live.js';
import { PLAYER_BY_ID } from '../src/career-core/career-core.js';
import { processWorldDay } from '../src/career-world/world-engine.js';
import { ageValueMultiplier, estimateMarketValue, transferFeeLooksPlausible } from '../src/career-world/transfers/valuation-engine.js';

const career = createCareer('MUN', '2026-08-08T18:00:00.000Z');
assert.equal(career.schemaVersion, 5);
assert.equal(career.currentDate, '2026-07-01');
assert.ok(career.world);
assert.equal(career.world.userClubCode, 'MUN');
assert.ok(Object.keys(career.world.employment).length >= 600, 'Living World must own the complete Premier League player employment map');
assert.equal(Object.keys(career.world.clubs).length, 20);

const first = processWorldDay(career, '2026-07-01');
const eventCount = career.world.events.length;
const second = processWorldDay(career, '2026-07-01');
assert.deepEqual(second, first, 'Daily tick must be idempotent');
assert.equal(career.world.events.length, eventCount, 'Reprocessing the same date cannot duplicate world events');
assert.ok(first.transferMarket.opened <= 3, 'Global daily recruitment starts must stay bounded');

for (const date of ['2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05', '2026-07-06', '2026-07-07']) {
  const summary = processWorldDay(career, date);
  assert.ok(summary.transferMarket.opened <= 3);
}

const veteran = { id: 'veteran', name: 'Veteran', age: 34, rating: 88, potential: 88, value: 30_000_000, wage: 120_000 };
const prime = { ...veteran, id: 'prime', age: 24 };
const sellingClub = { elo: 1900 };
const contract = { endDate: '2029-06-30', weeklyWage: 120_000 };
const veteranValue = estimateMarketValue({ player: veteran, status: { squadRole: 'key' }, contract, date: '2026-07-01', sellingClub });
const primeValue = estimateMarketValue({ player: prime, status: { squadRole: 'key' }, contract, date: '2026-07-01', sellingClub });
assert.ok(ageValueMultiplier(34) < ageValueMultiplier(24));
assert.ok(veteranValue < primeValue * 0.4, 'A 34-year-old must carry a steep resale discount');
assert.equal(transferFeeLooksPlausible(veteran, 100_000_000), false, '£100m for a £30m 34-year-old must fail plausibility');

const fixture = FIXTURES[0];
const result = simulateFixture(career, fixture);
assert.equal(result.lineups.home.length, 11);
assert.equal(result.lineups.away.length, 11);
for (const [side, clubCode] of [['home', fixture.home], ['away', fixture.away]]) {
  for (const playerId of result.lineups[side]) {
    assert.ok(PLAYER_BY_ID.has(playerId));
    assert.equal(career.world.employment[playerId], clubCode, `Match lineup must follow current employment for ${clubCode}`);
  }
}
assert.equal(result.homeGoals + result.awayGoals, result.events.filter(event => event.type === 'goal').length);

console.log(JSON.stringify({
  ok: true,
  schemaVersion: career.schemaVersion,
  startDate: career.currentDate,
  clubs: Object.keys(career.world.clubs).length,
  players: Object.keys(career.world.employment).length,
  processedDays: Object.keys(career.world.processedDays).length,
  worldEvents: career.world.events.length,
  transfersCompleted: career.world.transferMarket.history.length,
  veteranValue,
  primeValue
}, null, 2));

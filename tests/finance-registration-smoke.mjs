import assert from 'node:assert/strict';
import { createCareer } from '../src/career-core/career-runtime.js';
import { WORLD_PLAYER_BY_ID } from '../src/career-world/world-player-database.js';
import { playerIdsForClubState } from '../src/career-world/world-employment-index.js';
import { clubFinanceSnapshot, assessTransferFinancialClearance, processFinanceDay } from '../src/career-world/finance/finance-engine.js';
import { assessRegistrationClearance, registrationSnapshot } from '../src/career-world/rules/registration-engine.js';
import { processDealClearanceDay } from '../src/career-world/rules/deal-clearance-engine.js';

const career = createCareer('MUN', '2026-08-08T22:51:00.000Z');
const world = career.world;
const club = world.clubs.MUN;
assert.ok(club, 'finance test needs the managed club');

const finance = clubFinanceSnapshot({ world, clubCode: 'MUN', playerById: WORLD_PLAYER_BY_ID });
assert.ok(finance.weeklyPayroll > 0, 'club finance must measure real weekly payroll');
assert.ok(finance.wageCapacity >= finance.weeklyPayroll, 'legacy starting squads must receive a viable baseline wage capacity');
assert.ok(['stable', 'watch', 'strained', 'restricted'].includes(finance.pressureBand));

const financeDay = processFinanceDay({ career, date: '2026-07-01', playerById: WORLD_PLAYER_BY_ID });
assert.ok(financeDay.reviewed >= 20, 'daily finance review must cover the active club world');
assert.equal(world.clubs.MUN.finance.reviewedAt, '2026-07-01');

const sellerPlayer = playerIdsForClubState(world, 'ARS')
  .map(id => WORLD_PLAYER_BY_ID.get(id))
  .filter(Boolean)
  .sort((left, right) => Number(right.rating) - Number(left.rating))[0];
assert.ok(sellerPlayer, 'finance test requires a real external player');

const impossibleFee = assessTransferFinancialClearance({
  world,
  clubCode: 'MUN',
  player: sellerPlayer,
  fee: Number(club.transferBudget) + 100_000_000,
  weeklyWage: 50_000,
  playerById: WORLD_PLAYER_BY_ID,
  expectedRole: 'important-player'
});
assert.equal(impossibleFee.approved, false);
assert.ok(impossibleFee.reasonCodes.includes('TRANSFER_BUDGET_INSUFFICIENT'));

const impossibleWage = assessTransferFinancialClearance({
  world,
  clubCode: 'MUN',
  player: sellerPlayer,
  fee: 0,
  weeklyWage: Math.max(1_000_000, finance.topWage * 8),
  playerById: WORLD_PLAYER_BY_ID,
  expectedRole: 'squad-player'
});
assert.equal(impossibleWage.approved, false);
assert.ok(impossibleWage.reasonCodes.some(code => ['WAGE_BUDGET_INSUFFICIENT', 'WAGE_STRUCTURE_BROKEN'].includes(code)));

const registration = registrationSnapshot({ world, clubCode: 'MUN', playerById: WORLD_PLAYER_BY_ID });
assert.ok(registration.total >= 20 && registration.senior >= 1, 'registration snapshot must measure the actual playing squad');
assert.ok(registration.profile.totalActiveCeiling >= registration.profile.seniorRegistrationTarget);

const youngPlayer = [...WORLD_PLAYER_BY_ID.values()].find(player => Number(player.age) <= 21 && world.employment[player.id] && world.employment[player.id] !== 'MUN');
assert.ok(youngPlayer, 'registration test needs a real U21 player');
const youngClearance = assessRegistrationClearance({ world, clubCode: 'MUN', player: youngPlayer, playerById: WORLD_PLAYER_BY_ID });
assert.equal(youngClearance.incoming.youthExempt, true, 'young players must not consume a senior registration slot');
assert.equal(youngClearance.incoming.homegrownState === 'unknown' || youngClearance.incoming.homegrownState === 'homegrown' || youngClearance.incoming.homegrownState === 'non-homegrown', true);

world.transferMarket.negotiations['finance-gate-test'] = {
  id: 'finance-gate-test',
  playerId: sellerPlayer.id,
  buyerCode: 'MUN',
  sellerCode: 'ARS',
  freeAgent: false,
  stage: 'personal-terms',
  status: 'open',
  nextActionDate: '2026-07-02',
  proposedFee: Number(club.transferBudget) + 250_000_000,
  minimumAcceptableFee: 1_000_000,
  need: { expectedPlayingTime: 'squad-player' }
};
const gate = processDealClearanceDay({ career, date: '2026-07-02', playerById: WORLD_PLAYER_BY_ID });
assert.equal(gate.transferDealsBlocked, 1, 'an impossible deal must be stopped before signature');
assert.equal(world.transferMarket.negotiations['finance-gate-test'].status, 'rejected');
assert.ok(world.events.some(event => event.type === 'TRANSFER_CLEARANCE_FAILED' && event.entities.negotiationId === 'finance-gate-test'));

console.log(JSON.stringify({
  ok: true,
  weeklyPayroll: finance.weeklyPayroll,
  wageCapacity: finance.wageCapacity,
  pressureBand: finance.pressureBand,
  registrationTotal: registration.total,
  registrationSenior: registration.senior,
  youthExemptionVerified: true,
  impossibleFeeBlocked: true,
  impossibleWageBlocked: true,
  preSignatureClearanceBlocked: true
}, null, 2));

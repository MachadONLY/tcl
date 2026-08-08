import assert from 'node:assert/strict';
import { createCareer } from '../src/career-core/career-runtime.js';
import { PLAYER_BY_ID } from '../src/career-core/career-core.js';
import { processWorldDay } from '../src/career-world/world-engine.js';
import { createPlayerBrain, evaluateMoveAppeal } from '../src/career-world/transfers/player-brain.js';
import { effectivePlayerContract, effectivePlayerStatus, playerIdsForClubState } from '../src/career-world/world-employment-index.js';

function dateAt(day) {
  return `2026-07-${String(day).padStart(2, '0')}`;
}

function simulateJuly(career) {
  const summaries = [];
  for (let day = 1; day <= 31; day += 1) summaries.push(processWorldDay(career, dateAt(day)));
  return summaries;
}

function rumorFingerprint(career) {
  return (career.world.transferMarket.rumors || []).map(rumor => ({
    buyerCode: rumor.buyerCode,
    sellerCode: rumor.sellerCode,
    playerId: rumor.playerId,
    createdAt: rumor.createdAt,
    stage: rumor.stage,
    status: rumor.status,
    heat: rumor.heat,
    source: rumor.source
  }));
}

const saveA = createCareer('MUN', '2026-08-08T22:00:00.000Z');
const saveARepeat = createCareer('MUN', '2026-08-08T22:00:00.000Z');
const saveB = createCareer('MUN', '2026-08-09T01:17:43.000Z');

const summariesA = simulateJuly(saveA);
simulateJuly(saveARepeat);
simulateJuly(saveB);

assert.ok(saveA.world.transferMarket.rumors.length >= 2, 'a month of an open window should create organic recruitment threads');
assert.deepEqual(rumorFingerprint(saveARepeat), rumorFingerprint(saveA), 'the same save seed must reproduce the same market');
assert.notDeepEqual(rumorFingerprint(saveB), rumorFingerprint(saveA), 'a new save seed must produce a different plausible market path');
assert.ok((saveA.world.transferMarket.rumors || []).every(rumor => rumor.buyerCode !== saveA.clubCode), 'AI rumor generation must not control the user club');
assert.ok((saveA.world.transferMarket.rumors || []).every(rumor => PLAYER_BY_ID.has(rumor.playerId)), 'every rumor must point to a real world player');
assert.ok((saveA.world.transferMarket.rumors || []).every(rumor => ['watching', 'scouted', 'active-interest'].includes(rumor.stage) || ['ended', 'converted'].includes(rumor.status)), 'rumors must stay inside the recruitment state machine');
assert.ok(summariesA.every(summary => Number(summary.rumorMarket?.started || 0) <= 18), 'daily rumor creation must remain globally bounded');
assert.ok(saveA.world.transferMarket.competition && typeof saveA.world.transferMarket.competition === 'object', 'competition index must be persistent in the market state');

const munPlayerId = playerIdsForClubState(saveA.world, 'MUN')[0];
const player = PLAYER_BY_ID.get(munPlayerId);
assert.ok(player, 'test requires a Manchester United player');
const brainA = createPlayerBrain(player);
const brainB = createPlayerBrain(player);
assert.deepEqual(brainB, brainA, 'core player personality must be stable rather than random per click');

const status = effectivePlayerStatus(saveA.world, player);
const contract = effectivePlayerContract(saveA.world, player);
const need = { group: player.group, priority: .72, expectedPlayingTime: 'regular-starter' };
const appealA = evaluateMoveAppeal({ world: saveA.world, date: '2026-07-15', player, status, contract, buyerClub: saveA.world.clubs.MCI, sellerClub: saveA.world.clubs.MUN, need });
const appealB = evaluateMoveAppeal({ world: saveB.world, date: '2026-07-15', player, status, contract, buyerClub: saveB.world.clubs.MCI, sellerClub: saveB.world.clubs.MUN, need });
assert.ok(appealA.interest >= .05 && appealA.interest <= .97);
assert.ok(appealB.interest >= .05 && appealB.interest <= .97);
assert.notEqual(appealA.components.saveVariation, appealB.components.saveVariation, 'save seed may vary marginal openness without changing core personality');

const formal = Object.values(saveA.world.transferMarket.negotiations || {});
for (const negotiation of formal) {
  if (negotiation.openedAt > '2026-07-31') continue;
  const related = saveA.world.transferMarket.rumors.some(rumor => rumor.buyerCode === negotiation.buyerCode && rumor.playerId === negotiation.playerId);
  assert.ok(related, `formal approach ${negotiation.id} should normally emerge from prior scouting/interest during July`);
}

console.log(JSON.stringify({
  ok: true,
  saveASeed: saveA.world.seed,
  saveBSeed: saveB.world.seed,
  saveARumors: saveA.world.transferMarket.rumors.length,
  saveBRumors: saveB.world.transferMarket.rumors.length,
  saveATransfers: saveA.world.transferMarket.history.length,
  activeCompetitionCases: Object.values(saveA.world.transferMarket.competition).filter(row => row.clubs.length > 1).length,
  playerBrainStable: true,
  marketsDifferAcrossSaves: true
}, null, 2));

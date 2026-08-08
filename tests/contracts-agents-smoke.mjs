import assert from 'node:assert/strict';
import { createCareer } from '../src/career-core/career-runtime.js';
import { processWorldDay } from '../src/career-world/world-engine.js';
import { WORLD_PLAYER_BY_ID } from '../src/career-world/world-player-database.js';
import { playerIdsForClubState, ensurePlayerStatus } from '../src/career-world/world-employment-index.js';
import { createAgentProfile, buildAgentContractDemands } from '../src/career-world/contracts/agent-engine.js';
import { evaluateRenewalCase } from '../src/career-world/contracts/renewal-ai.js';

function addDays(date, count) {
  const base = Date.parse(`${date}T00:00:00Z`);
  return new Date(base + count * 86_400_000).toISOString().slice(0, 10);
}

function topPlayer(career, clubCode) {
  return playerIdsForClubState(career.world, clubCode)
    .map(id => WORLD_PLAYER_BY_ID.get(id))
    .filter(Boolean)
    .sort((left, right) => Number(right.rating) - Number(left.rating))[0];
}

const career = createCareer('MUN', '2026-08-08T19:48:00.000Z');
const aiPlayer = topPlayer(career, 'ARS');
const userPlayer = topPlayer(career, 'MUN');
assert.ok(aiPlayer && userPlayer, 'contract test needs real players from AI and user clubs');

const agentA = createAgentProfile(aiPlayer);
const agentB = createAgentProfile(aiPlayer);
assert.deepEqual(agentB, agentA, 'agent personality must be stable for the same player');

career.world.contracts[aiPlayer.id] = {
  playerId: aiPlayer.id,
  clubCode: 'ARS',
  startDate: '2023-07-01',
  endDate: '2027-06-30',
  weeklyWage: Math.max(20_000, Number(aiPlayer.wage) || 50_000),
  status: 'active'
};
const aiStatus = ensurePlayerStatus(career.world, aiPlayer);
aiStatus.squadRole = 'key';
aiStatus.happiness = 86;
aiStatus.playingTimeExpectation = 'star-player';
const evaluation = evaluateRenewalCase({
  world: career.world,
  date: '2026-07-01',
  player: aiPlayer,
  club: career.world.clubs.ARS,
  contract: career.world.contracts[aiPlayer.id],
  status: aiStatus
});
assert.equal(evaluation.action, 'renew', 'a happy key player in the final year should be a genuine renewal priority');
const demands = buildAgentContractDemands({
  world: career.world,
  date: '2026-07-01',
  player: aiPlayer,
  contract: career.world.contracts[aiPlayer.id],
  status: aiStatus,
  club: career.world.clubs.ARS,
  externalInterest: evaluation.externalInterest,
  context: 'renewal'
});
assert.ok(demands.minimumWeeklyWage > 0 && demands.preferredYears >= 1, 'agent must create coherent wage and term demands');

career.world.contracts[userPlayer.id] = {
  playerId: userPlayer.id,
  clubCode: 'MUN',
  startDate: '2023-07-01',
  endDate: '2027-06-30',
  weeklyWage: Math.max(20_000, Number(userPlayer.wage) || 50_000),
  status: 'active'
};

for (let day = 0; day < 18; day += 1) processWorldDay(career, addDays('2026-07-01', day));
const renewals = Object.values(career.world.contractMarket.renewals || {}).filter(row => row.playerId === aiPlayer.id);
assert.ok(renewals.length >= 1, 'AI club should open a renewal process from contract risk rather than a script');
assert.ok(renewals.some(row => row.demands), 'renewal process should involve agent demands');
assert.ok(career.world.events.some(event => event.type === 'CONTRACT_AGENT_DEMANDS_RECEIVED' && event.entities.playerId === aiPlayer.id), 'agent demand must be part of the event ledger');
assert.ok(career.inbox.some(message => message.id.startsWith(`contract-risk-${userPlayer.id}-`)), 'user must be warned instead of having contract decisions auto-controlled');

const expiryCareer = createCareer('MUN', '2026-08-09T02:11:00.000Z');
const expiringPlayer = topPlayer(expiryCareer, 'MUN');
expiryCareer.world.contracts[expiringPlayer.id] = {
  playerId: expiringPlayer.id,
  clubCode: 'MUN',
  startDate: '2024-07-01',
  endDate: '2026-07-01',
  weeklyWage: 50_000,
  status: 'active'
};
processWorldDay(expiryCareer, '2026-07-02');
assert.equal(expiryCareer.world.employment[expiringPlayer.id], undefined, 'expired player must leave active employment');
assert.ok(expiryCareer.world.freeAgents[expiringPlayer.id], 'expired player must remain alive as a free agent');
assert.ok(expiryCareer.world.events.some(event => event.type === 'CONTRACT_EXPIRED' && event.entities.playerId === expiringPlayer.id), 'contract expiry must be recorded in the world ledger');

console.log(JSON.stringify({
  ok: true,
  stableAgent: true,
  aiRenewalThreads: renewals.length,
  renewalStatus: renewals[0]?.status || null,
  agentDemands: Boolean(renewals[0]?.demands),
  userContractAlert: true,
  expiryCreatesFreeAgent: true
}, null, 2));

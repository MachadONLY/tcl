import assert from 'node:assert/strict';
import { createCareer } from '../src/career-core/career-runtime.js';
import { WORLD_PLAYER_BY_ID } from '../src/career-world/world-player-database.js';
import { evaluateClubSquad } from '../src/career-world/clubs/squad-analysis.js';
import { processSellingAiDay } from '../src/career-world/clubs/selling-ai.js';
import { ensurePlayerStatus, playerIdsForClubState } from '../src/career-world/world-employment-index.js';

function squad(career, clubCode) {
  return playerIdsForClubState(career.world, clubCode).map(id => WORLD_PLAYER_BY_ID.get(id)).filter(Boolean);
}

const career = createCareer('MUN', '2026-08-08T19:48:00.000Z');
const world = career.world;
const clubCode = 'CHE';
const clubPlayers = squad(career, clubCode);
assert.ok(clubPlayers.length >= 20, 'selling AI test needs a full AI squad');

const forced = [...clubPlayers].sort((left, right) => Number(left.rating) - Number(right.rating))[0];
const forcedStatus = ensurePlayerStatus(world, forced);
forcedStatus.squadRole = 'fringe';
forcedStatus.happiness = 38;
forcedStatus.contractDisposition = 'sell-before-expiry';
world.contracts[forced.id] = {
  playerId: forced.id,
  clubCode,
  startDate: '2024-07-01',
  endDate: '2027-06-30',
  weeklyWage: Math.max(5_000, Number(forced.wage) || 10_000),
  status: 'active'
};

const analyses = {};
for (const [code, club] of Object.entries(world.clubs)) {
  const players = squad(career, code);
  if (players.length < 11) continue;
  analyses[code] = evaluateClubSquad({ clubCode: code, players, clubState: club });
}
const summary = processSellingAiDay({ career, date: '2026-07-08', playerById: WORLD_PLAYER_BY_ID, squadAnalyses: analyses });
assert.ok(summary.reviewed > 0, 'AI selling review must evaluate the world squads');
assert.ok(summary.changed > 0, 'AI selling review should create explicit sale dispositions');
assert.equal(world.playerStatus[forced.id].saleDisposition.type, 'actively-for-sale', 'fringe contract-risk player should be actively offered to market');
assert.equal(world.playerStatus[forced.id].transferListed, true);
assert.ok(world.playerStatus[forced.id].saleDisposition.reasons.includes('CONTRACT_EXPIRY_RISK'));
assert.ok(world.events.some(event => event.type === 'PLAYER_SALE_DISPOSITION_CHANGED' && event.entities.playerId === forced.id));

const cheDispositions = clubPlayers.map(player => world.playerStatus[player.id]?.saleDisposition?.type).filter(Boolean);
assert.ok(cheDispositions.some(type => ['untouchable', 'exceptional-only', 'retain'].includes(type)), 'selling AI must also explicitly protect players rather than only listing everyone');
assert.ok(cheDispositions.some(type => ['available', 'actively-for-sale', 'loan-pathway'].includes(type)), 'deep squad should produce plausible outgoing pathways');

const userPlayers = squad(career, 'MUN');
assert.ok(userPlayers.every(player => !world.playerStatus[player.id]?.saleDisposition), 'selling AI must never auto-manage the user club');

console.log(JSON.stringify({
  ok: true,
  reviewed: summary.reviewed,
  changed: summary.changed,
  transferListed: summary.transferListed,
  loanListed: summary.loanListed,
  forcedDisposition: world.playerStatus[forced.id].saleDisposition,
  userClubProtected: true
}, null, 2));

import assert from 'node:assert/strict';
import { createCareer } from '../src/career-core/career-runtime.js';
import { WORLD_PLAYER_BY_ID } from '../src/career-world/world-player-database.js';
import {
  effectivePlayerContract,
  ensurePlayerStatus,
  ownerClubForPlayerState,
  playerIdsForClubState
} from '../src/career-world/world-employment-index.js';
import { positionBucket } from '../src/career-world/clubs/squad-analysis.js';
import { processLoanMarketDay, proposeLoanDeal, respondToLoanOffer } from '../src/career-world/loans/loan-engine.js';

function addDays(date, count) {
  const base = Date.parse(`${date}T00:00:00Z`);
  return new Date(base + count * 86_400_000).toISOString().slice(0, 10);
}

const career = createCareer('MUN', '2026-08-08T19:48:00.000Z');
const world = career.world;
const candidates = playerIdsForClubState(world, 'MUN')
  .map(id => WORLD_PLAYER_BY_ID.get(id))
  .filter(Boolean)
  .sort((left, right) => Number(left.rating) - Number(right.rating) || Number(left.age) - Number(right.age));
assert.ok(candidates.length, 'loan test needs a Manchester United squad');

let deal = null;
let player = null;
let borrowerCode = null;
for (const candidate of candidates) {
  const status = ensurePlayerStatus(world, candidate);
  status.loanListed = true;
  status.squadRole = 'fringe';
  status.happiness = 88;
  world.contracts[candidate.id] = {
    ...effectivePlayerContract(world, candidate),
    playerId: candidate.id,
    clubCode: 'MUN',
    startDate: '2025-07-01',
    endDate: '2029-06-30',
    weeklyWage: Math.max(8_000, Number(candidate.wage) || 12_000),
    status: 'active'
  };
  for (const code of ['BHA', 'BRE', 'FUL', 'EVE', 'LEE', 'SUN']) {
    const need = {
      group: candidate.group,
      position: positionBucket(candidate),
      priority: .84,
      targetRating: Number(candidate.rating) || 70,
      reason: 'position-shortage',
      expectedPlayingTime: 'regular-starter',
      transferTypes: ['loan', 'transfer']
    };
    const attempt = proposeLoanDeal({
      career,
      date: '2026-07-01',
      player: candidate,
      parentCode: 'MUN',
      borrowerCode: code,
      need,
      playerById: WORLD_PLAYER_BY_ID
    });
    if (attempt) {
      deal = attempt;
      player = candidate;
      borrowerCode = code;
      break;
    }
  }
  if (deal) break;
}

assert.ok(deal && player && borrowerCode, 'a listed user player should be able to receive a plausible loan proposal');
assert.equal(ownerClubForPlayerState(world, player.id), 'MUN');
assert.equal(world.employment[player.id], 'MUN');

processLoanMarketDay({ career, date: deal.nextActionDate, playerById: WORLD_PLAYER_BY_ID, squadAnalyses: {} });
assert.equal(deal.status, 'awaiting-user', 'user-owned player must never be loaned automatically');
assert.ok(career.inbox.some(message => message.id === `loan-offer-${deal.id}`), 'loan offer must reach the user inbox');

respondToLoanOffer({ career, loanId: deal.id, decision: 'accept', date: deal.updatedAt, playerById: WORLD_PLAYER_BY_ID });
assert.equal(deal.stage, 'player-review', 'user acceptance should still require the player decision');

const playerDecisionDate = deal.nextActionDate;
processLoanMarketDay({ career, date: playerDecisionDate, playerById: WORLD_PLAYER_BY_ID, squadAnalyses: {} });
assert.equal(deal.status, 'active', 'a highly suitable accepted loan should become active after player review');
assert.equal(ownerClubForPlayerState(world, player.id), 'MUN', 'loan must not transfer ownership');
assert.equal(world.employment[player.id], borrowerCode, 'loaned player must be registered with and play for the borrower');
assert.equal(world.contracts[player.id].clubCode, 'MUN', 'parent club must remain the contractual owner');
assert.equal(world.playerStatus[player.id].onLoan, true);
assert.equal(world.playerStatus[player.id].loanParentClubCode, 'MUN');
assert.equal(world.playerStatus[player.id].loanClubCode, borrowerCode);

const borrowerIds = playerIdsForClubState(world, borrowerCode);
assert.ok(borrowerIds.includes(player.id), 'borrower squad index must contain the loaned player');
assert.ok(!playerIdsForClubState(world, 'MUN').includes(player.id), 'parent playing squad must not contain the player while he is away');

const forcedEnd = addDays(playerDecisionDate, 2);
deal.terms.endDate = forcedEnd;
deal.terms.optionToBuy = false;
deal.terms.obligationToBuy = false;
processLoanMarketDay({ career, date: forcedEnd, playerById: WORLD_PLAYER_BY_ID, squadAnalyses: {} });
assert.equal(deal.status, 'returned', 'loan should return the player when no purchase option is exercised');
assert.equal(ownerClubForPlayerState(world, player.id), 'MUN');
assert.equal(world.employment[player.id], 'MUN');
assert.equal(world.playerStatus[player.id].onLoan, false);
assert.ok(playerIdsForClubState(world, 'MUN').includes(player.id), 'returned player must rejoin parent playing squad');
assert.ok(world.loanMarket.history.some(row => row.loanId === deal.id && row.outcome === 'returned'), 'loan history must persist the completed spell');
assert.ok(world.events.some(event => event.type === 'LOAN_STARTED' && event.entities.loanId === deal.id));
assert.ok(world.events.some(event => event.type === 'LOAN_ENDED' && event.entities.loanId === deal.id));

console.log(JSON.stringify({
  ok: true,
  player: player.name,
  parentClub: 'MUN',
  borrowerClub: borrowerCode,
  ownershipPreservedDuringLoan: true,
  borrowerRegistrationActive: true,
  userDecisionRequired: true,
  returnedToParent: true
}, null, 2));

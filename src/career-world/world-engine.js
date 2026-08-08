import { processDailyTick } from './daily-tick.js';
import { appendWorldEvent, latestWorldEvents } from './world-events.js';
import { ensureWorldState } from './world-state.js';
import {
  WORLD_CLUB_CATALOG,
  WORLD_DB_META,
  WORLD_PLAYER_BY_ID,
  WORLD_SQUADS,
  WORLD_TEAM_BUDGETS,
  WORLD_TEAM_ELO,
  worldDatabaseCoverage
} from './world-player-database.js';
import {
  activeNegotiations,
  contractFor,
  marketSearch,
  playerStatusFor,
  squadForWorld,
  transferHistory
} from './world-selectors.js';
import { ensurePlayerStatus } from './world-employment-index.js';
import { respondToTransferOffer } from './transfers/transfer-engine.js';
import { estimateSellingPosition } from './transfers/valuation-engine.js';

const dependencies = Object.freeze({
  clubs: WORLD_CLUB_CATALOG,
  squads: WORLD_SQUADS,
  teamBudgets: WORLD_TEAM_BUDGETS,
  teamElo: WORLD_TEAM_ELO,
  worldMeta: WORLD_DB_META
});

export function ensureLivingWorld(career) {
  return ensureWorldState(career, dependencies);
}

export function processWorldDay(career, date = career.currentDate) {
  ensureLivingWorld(career);
  const summary = processDailyTick({ career, date, playerById: WORLD_PLAYER_BY_ID });
  const userClub = career.world.clubs?.[career.clubCode];
  if (userClub) {
    career.transferBudget = userClub.transferBudget;
    career.wageBudget = userClub.wageBudget;
  }
  return summary;
}

export function worldSquadFor(career, clubCode) {
  ensureLivingWorld(career);
  return squadForWorld(career, clubCode, WORLD_PLAYER_BY_ID);
}

export function setTransferListing(career, playerId, listed = true) {
  ensureLivingWorld(career);
  if (career.world.employment[playerId] !== career.clubCode) return null;
  const player = WORLD_PLAYER_BY_ID.get(playerId);
  if (!player) return null;
  const status = ensurePlayerStatus(career.world, player);
  status.transferListed = Boolean(listed);
  if (!listed) status.askingPrice = null;
  appendWorldEvent(career.world, {
    date: career.currentDate,
    type: listed ? 'PLAYER_TRANSFER_LISTED' : 'PLAYER_TRANSFER_DELISTED',
    entities: { playerId, clubCode: career.clubCode },
    payload: { ai: false }
  });
  return status;
}

export function setLoanListing(career, playerId, listed = true) {
  ensureLivingWorld(career);
  if (career.world.employment[playerId] !== career.clubCode) return null;
  const player = WORLD_PLAYER_BY_ID.get(playerId);
  if (!player) return null;
  const status = ensurePlayerStatus(career.world, player);
  status.loanListed = Boolean(listed);
  appendWorldEvent(career.world, {
    date: career.currentDate,
    type: listed ? 'PLAYER_LOAN_LISTED' : 'PLAYER_LOAN_DELISTED',
    entities: { playerId, clubCode: career.clubCode },
    payload: { ai: false }
  });
  return status;
}

export function setPlayerAskingPrice(career, playerId, amount = null) {
  ensureLivingWorld(career);
  if (career.world.employment[playerId] !== career.clubCode) return null;
  const player = WORLD_PLAYER_BY_ID.get(playerId);
  if (!player) return null;
  const status = ensurePlayerStatus(career.world, player);
  const club = career.world.clubs[career.clubCode];
  const contract = contractFor(career, player, WORLD_PLAYER_BY_ID);
  const natural = estimateSellingPosition({ player, status, contract, date: career.currentDate, sellingClub: club });
  status.askingPrice = Number(amount) > 0 ? Math.round(Number(amount) / 250_000) * 250_000 : natural.askingPrice;
  return status.askingPrice;
}

export function respondToWorldTransferOffer(career, negotiationId, decision) {
  ensureLivingWorld(career);
  const result = respondToTransferOffer({
    career,
    negotiationId,
    decision,
    date: career.currentDate,
    playerById: WORLD_PLAYER_BY_ID
  });
  const userClub = career.world.clubs?.[career.clubCode];
  if (userClub) career.transferBudget = userClub.transferBudget;
  return result;
}

export function worldMarketSearch(career, filters = {}) {
  ensureLivingWorld(career);
  return marketSearch(career, WORLD_PLAYER_BY_ID, filters);
}

export function worldTransferHistory(career) {
  ensureLivingWorld(career);
  return transferHistory(career);
}

export function worldActiveNegotiations(career, predicate = null) {
  ensureLivingWorld(career);
  return activeNegotiations(career, predicate);
}

export function worldPlayerStatus(career, playerId) {
  ensureLivingWorld(career);
  return playerStatusFor(career, playerId, WORLD_PLAYER_BY_ID);
}

export function recentLivingWorldEvents(career, limit = 50) {
  ensureLivingWorld(career);
  return latestWorldEvents(career.world, limit);
}

export function livingWorldDatabaseCoverage() {
  return worldDatabaseCoverage();
}

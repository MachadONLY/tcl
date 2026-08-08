import { appendWorldEvent, eventsOnDate } from './world-events.js';
import { squadForWorld } from './world-selectors.js';
import { evaluateClubSquad, surplusCandidates } from './clubs/squad-analysis.js';
import { processTransferMarketDay } from './transfers/transfer-engine.js';
import { randomUnit } from './deterministic-rng.js';
import { effectivePlayerStatus, ensurePlayerStatus, removePlayerEmployment } from './world-employment-index.js';

function maybeListAiSurplus({ career, date, playerById, analyses }) {
  const world = career.world;
  if (String(date).slice(-2) !== '01' && String(date).slice(-2) !== '15') return 0;
  let listed = 0;
  for (const [clubCode] of Object.entries(analyses)) {
    if (clubCode === career.clubCode) continue;
    const players = squadForWorld(career, clubCode, playerById);
    const statusView = Object.fromEntries(players.map(player => [player.id, effectivePlayerStatus(world, player)]));
    const candidates = surplusCandidates({ players, clubState: world.clubs[clubCode], playerStatus: statusView });
    const candidate = candidates[0]?.player;
    if (!candidate || effectivePlayerStatus(world, candidate).transferListed) continue;
    if (randomUnit(world.seed, date, clubCode, candidate.id, 'surplus-list') > .28) continue;
    ensurePlayerStatus(world, candidate).transferListed = true;
    appendWorldEvent(world, {
      date,
      type: 'PLAYER_TRANSFER_LISTED',
      entities: { playerId: candidate.id, clubCode },
      payload: { reason: candidates[0].reason, ai: true }
    });
    listed += 1;
  }
  return listed;
}

function processExpiredContracts({ career, date }) {
  const world = career.world;
  let expired = 0;
  for (const [playerId, contract] of Object.entries(world.contracts || {})) {
    if (contract.status !== 'active' || !contract.endDate || contract.endDate >= date) continue;
    const clubCode = world.employment[playerId];
    contract.status = 'expired';
    removePlayerEmployment(world, playerId);
    if (world.playerStatus[playerId]) {
      world.playerStatus[playerId].transferListed = false;
      world.playerStatus[playerId].loanListed = false;
    }
    world.freeAgents ||= {};
    world.freeAgents[playerId] = { since: date, previousClubCode: clubCode || contract.clubCode || null };
    appendWorldEvent(world, {
      date,
      type: 'CONTRACT_EXPIRED',
      entities: { playerId, clubCode },
      payload: { endDate: contract.endDate, freeAgent: true }
    });
    expired += 1;
  }
  return expired;
}

export function processDailyTick({ career, date, playerById }) {
  const world = career.world;
  if (world.processedDays?.[date]) return world.dailySummaries[date];

  world.currentDate = date;
  const analyses = {};
  for (const [clubCode, clubState] of Object.entries(world.clubs || {})) {
    const players = squadForWorld(career, clubCode, playerById);
    if (players.length < 11) continue;
    const analysis = evaluateClubSquad({ clubCode, players, clubState });
    analyses[clubCode] = analysis;
    clubState.recruitment.needs = analysis.needs.map(need => ({ ...need }));
    clubState.recruitment.requirements = analysis.requirements.map(requirement => ({ ...requirement }));
    clubState.recruitment.lastEvaluatedDate = date;
  }

  const contractsExpired = processExpiredContracts({ career, date });
  const playersListed = maybeListAiSurplus({ career, date, playerById, analyses });
  const transferMarket = processTransferMarketDay({ career, date, playerById, squadAnalyses: analyses });
  const dayEventsBeforeClose = eventsOnDate(world, date).length;
  const summary = {
    date,
    clubsEvaluated: Object.keys(analyses).length,
    contractsExpired,
    playersListed,
    transferMarket,
    events: dayEventsBeforeClose
  };

  appendWorldEvent(world, {
    date,
    type: 'WORLD_DAY_PROCESSED',
    entities: {},
    payload: {
      clubsEvaluated: summary.clubsEvaluated,
      contractsExpired,
      playersListed,
      transfersOpened: transferMarket.opened,
      transfersCompleted: transferMarket.completed
    },
    visibility: 'system'
  });
  summary.events = eventsOnDate(world, date).length;
  world.processedDays[date] = true;
  world.dailySummaries[date] = summary;
  world.lastProcessedDate = date;
  return summary;
}

import { appendWorldEvent, eventsOnDate } from './world-events.js';
import { squadForWorld } from './world-selectors.js';
import { evaluateClubSquad } from './clubs/squad-analysis.js';
import { processSellingAiDay } from './clubs/selling-ai.js';
import { processTransferMarketDay } from './transfers/transfer-engine.js';
import { processRumorMarketDay, reconcileRumorsAfterTransfers } from './transfers/rumor-engine.js';
import { processContractExpirations, processContractMarketDay } from './contracts/contract-engine.js';
import { processLoanMarketDay } from './loans/loan-engine.js';
import { processPlayerLifeDay } from './players/player-life-engine.js';
import { playerUnavailable, processAvailabilityDay } from './players/availability-engine.js';
import { effectivePlayerStatus } from './world-employment-index.js';

const TRANSFER_TERMINAL = new Set(['completed', 'rejected', 'withdrawn', 'expired']);

function reconcilePermanentDealsWithLoans(world, date) {
  const activeLoanPlayerIds = new Set(
    Object.values(world.loanMarket?.deals || {})
      .filter(deal => deal.status === 'active')
      .map(deal => deal.playerId)
  );
  let withdrawn = 0;
  for (const negotiation of Object.values(world.transferMarket?.negotiations || {})) {
    if (TRANSFER_TERMINAL.has(negotiation.status) || !activeLoanPlayerIds.has(negotiation.playerId)) continue;
    negotiation.status = 'withdrawn';
    negotiation.stage = 'closed';
    negotiation.updatedAt = date;
    negotiation.nextActionDate = null;
    negotiation.withdrawalReason = 'player-on-loan';
    appendWorldEvent(world, {
      date,
      type: 'TRANSFER_NEGOTIATION_ENDED',
      entities: { playerId: negotiation.playerId, buyerCode: negotiation.buyerCode, sellerCode: negotiation.sellerCode, negotiationId: negotiation.id },
      payload: { reason: 'player-on-loan' },
      visibility: 'system'
    });
    withdrawn += 1;
  }
  return withdrawn;
}

export function processDailyTick({ career, date, playerById }) {
  const world = career.world;
  if (world.processedDays?.[date]) return world.dailySummaries[date];

  world.currentDate = date;
  const availability = processAvailabilityDay({ career, date, playerById });
  const analyses = {};
  for (const [clubCode, clubState] of Object.entries(world.clubs || {})) {
    const registeredPlayers = squadForWorld(career, clubCode, playerById);
    const availablePlayers = registeredPlayers.filter(player => !playerUnavailable(effectivePlayerStatus(world, player), date));
    if (registeredPlayers.length < 11) continue;
    const analysis = evaluateClubSquad({ clubCode, players: availablePlayers, clubState });
    analysis.registeredSquadSize = registeredPlayers.length;
    analysis.unavailableCount = registeredPlayers.length - availablePlayers.length;
    analyses[clubCode] = analysis;
    clubState.recruitment.needs = analysis.needs.map(need => ({ ...need }));
    clubState.recruitment.requirements = analysis.requirements.map(requirement => ({ ...requirement }));
    clubState.recruitment.lastEvaluatedDate = date;
  }

  const playerLife = processPlayerLifeDay({ career, date, playerById });
  const contractMarket = processContractMarketDay({ career, date, playerById });
  const contractExpirations = processContractExpirations({ career, date, playerById });
  const sellingMarket = processSellingAiDay({ career, date, playerById, squadAnalyses: analyses });
  const loanMarket = processLoanMarketDay({ career, date, playerById, squadAnalyses: analyses });
  const transferDealsWithdrawnForLoans = reconcilePermanentDealsWithLoans(world, date);
  const rumorMarket = processRumorMarketDay({ career, date, playerById, squadAnalyses: analyses });
  const transferMarket = processTransferMarketDay({ career, date, playerById, squadAnalyses: analyses });
  const rumorReconciliation = reconcileRumorsAfterTransfers({ career, date });
  const dayEventsBeforeClose = eventsOnDate(world, date).length;
  const summary = {
    date,
    clubsEvaluated: Object.keys(analyses).length,
    availability,
    playerLife,
    contractsExpired: contractExpirations.expired,
    bosmanMoves: contractExpirations.bosmanMoves,
    contractMarket,
    sellingMarket,
    loanMarket: { ...loanMarket, transferDealsWithdrawn: transferDealsWithdrawnForLoans },
    rumorMarket: { ...rumorMarket, ...rumorReconciliation },
    transferMarket,
    events: dayEventsBeforeClose
  };

  appendWorldEvent(world, {
    date,
    type: 'WORLD_DAY_PROCESSED',
    entities: {},
    payload: {
      clubsEvaluated: summary.clubsEvaluated,
      injuriesFromRecentMatches: availability.injuries,
      playersReturnedFromInjury: availability.returnedFromInjury,
      suspensionsServed: availability.suspensionsServed,
      playersLifeReviewed: playerLife.reviewed,
      playerConcernsRaised: playerLife.concernsRaised,
      promisesResolved: playerLife.promisesResolved,
      contractsExpired: contractExpirations.expired,
      contractRenewalsOpened: contractMarket.opened,
      contractsRenewed: contractMarket.renewed,
      contractRenewalsRejected: contractMarket.rejected,
      bosmanAgreements: contractMarket.bosman.agreed,
      bosmanMoves: contractExpirations.bosmanMoves,
      sellingReviews: sellingMarket.reviewed,
      sellingDispositionsChanged: sellingMarket.changed,
      playersTransferListed: sellingMarket.transferListed,
      playersLoanListed: sellingMarket.loanListed,
      loansListed: loanMarket.listed,
      loanProposalsOpened: loanMarket.opened,
      loansActivated: loanMarket.activated,
      loansReturned: loanMarket.returned,
      loansRecalled: loanMarket.recalled,
      loanOptionsExercised: loanMarket.converted,
      activeLoans: loanMarket.active,
      transferDealsWithdrawnForLoans,
      rumorsStarted: rumorMarket.started,
      rumorsActive: rumorMarket.active,
      rumorCompetitions: rumorMarket.competitionStarted,
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

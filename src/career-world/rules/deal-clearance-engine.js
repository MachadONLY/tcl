import { appendWorldEvent } from '../world-events.js';
import { effectivePlayerContract } from '../world-employment-index.js';
import { wageExpectation } from '../transfers/valuation-engine.js';
import { assessTransferFinancialClearance } from '../finance/finance-engine.js';
import { assessRegistrationClearance } from './registration-engine.js';

const TERMINAL = new Set(['completed', 'rejected', 'withdrawn', 'expired']);

function candidateFee(negotiation) {
  if (negotiation.freeAgent) return 0;
  return Math.max(0, Number(negotiation.proposedFee) || Number(negotiation.counterFee) || Number(negotiation.minimumAcceptableFee) || 0);
}

function rejectAtClearance(world, negotiation, date, reasonCodes, clearance) {
  negotiation.status = 'rejected';
  negotiation.stage = 'closed';
  negotiation.updatedAt = date;
  negotiation.nextActionDate = null;
  negotiation.clearance = clearance;
  negotiation.withdrawalReason = reasonCodes[0] || 'clearance-failed';
  world.transferMarket ||= {};
  world.transferMarket.cooldowns ||= {};
  world.transferMarket.cooldowns[`${negotiation.buyerCode}:${negotiation.playerId}`] = date;
  appendWorldEvent(world, {
    date,
    type: 'TRANSFER_CLEARANCE_FAILED',
    entities: {
      playerId: negotiation.playerId,
      buyerCode: negotiation.buyerCode,
      sellerCode: negotiation.sellerCode || null,
      negotiationId: negotiation.id
    },
    payload: {
      reasonCodes,
      fee: candidateFee(negotiation),
      financial: clearance.financial?.projected || null,
      registration: clearance.registration?.projected || null
    },
    visibility: 'system'
  });
  appendWorldEvent(world, {
    date,
    type: 'TRANSFER_NEGOTIATION_ENDED',
    entities: {
      playerId: negotiation.playerId,
      buyerCode: negotiation.buyerCode,
      sellerCode: negotiation.sellerCode || null,
      negotiationId: negotiation.id
    },
    payload: { reason: `clearance:${reasonCodes[0] || 'failed'}`, fee: candidateFee(negotiation), freeAgent: Boolean(negotiation.freeAgent) }
  });
}

function assessNegotiation({ career, date, negotiation, playerById }) {
  const world = career.world;
  const player = playerById.get(negotiation.playerId);
  const buyer = world.clubs?.[negotiation.buyerCode];
  if (!player || !buyer) return null;
  const contract = effectivePlayerContract(world, player);
  const weeklyWage = wageExpectation({ player, contract, buyerClub: buyer });
  const fee = candidateFee(negotiation);
  const expectedRole = negotiation.need?.expectedPlayingTime || 'squad-player';
  const financial = assessTransferFinancialClearance({
    world,
    clubCode: buyer.code,
    player,
    fee,
    weeklyWage,
    playerById,
    expectedRole
  });
  const registration = assessRegistrationClearance({
    world,
    clubCode: buyer.code,
    player,
    playerById,
    moveType: negotiation.freeAgent ? 'free-agent' : 'transfer'
  });
  return { weeklyWage, fee, financial, registration };
}

function gateTransferNegotiations({ career, date, playerById }) {
  const world = career.world;
  let reviewed = 0;
  let blocked = 0;
  for (const negotiation of Object.values(world.transferMarket?.negotiations || {})) {
    if (TERMINAL.has(negotiation.status)) continue;
    if (negotiation.stage !== 'personal-terms') continue;
    if (negotiation.nextActionDate && negotiation.nextActionDate > date) continue;
    const clearance = assessNegotiation({ career, date, negotiation, playerById });
    if (!clearance) continue;
    reviewed += 1;
    negotiation.clearance = {
      checkedAt: date,
      financialApproved: clearance.financial.approved,
      registrationApproved: clearance.registration.approved,
      financeReasons: [...clearance.financial.reasonCodes],
      registrationReasons: [...clearance.registration.reasonCodes]
    };
    const reasons = [...clearance.financial.reasonCodes, ...clearance.registration.reasonCodes];
    if (!reasons.length) continue;
    rejectAtClearance(world, negotiation, date, reasons, clearance);
    blocked += 1;
  }
  return { reviewed, blocked };
}

function gateLoanConversions({ career, date, playerById }) {
  const world = career.world;
  let reviewed = 0;
  let blocked = 0;
  for (const deal of Object.values(world.loanMarket?.deals || {})) {
    if (deal.status !== 'active' || !deal.terms?.optionToBuy || !deal.terms?.endDate || deal.terms.endDate > date) continue;
    const player = playerById.get(deal.playerId);
    const borrower = world.clubs?.[deal.borrowerClubCode];
    if (!player || !borrower) continue;
    const contract = effectivePlayerContract(world, player);
    const weeklyWage = wageExpectation({ player, contract, buyerClub: borrower });
    const fee = Math.max(0, Number(deal.terms.optionFee) || 0);
    const financial = assessTransferFinancialClearance({
      world,
      clubCode: borrower.code,
      player,
      fee,
      weeklyWage,
      playerById,
      expectedRole: deal.terms.promisedPlayingTime || 'squad-player'
    });
    const registration = assessRegistrationClearance({ world, clubCode: borrower.code, player, playerById, moveType: 'loan-conversion' });
    reviewed += 1;
    deal.permanentClearance = {
      checkedAt: date,
      financialApproved: financial.approved,
      registrationApproved: registration.approved,
      financeReasons: [...financial.reasonCodes],
      registrationReasons: [...registration.reasonCodes]
    };
    const reasons = [...financial.reasonCodes, ...registration.reasonCodes];
    if (!reasons.length) continue;
    deal.terms.optionToBuy = false;
    deal.terms.obligationToBuy = false;
    deal.permanentClearance.failedReasonCodes = reasons;
    appendWorldEvent(world, {
      date,
      type: 'LOAN_PERMANENT_CLEARANCE_FAILED',
      entities: { playerId: player.id, parentClubCode: deal.parentClubCode, borrowerClubCode: deal.borrowerClubCode, loanId: deal.id },
      payload: { reasonCodes: reasons, fee, weeklyWage },
      visibility: 'system'
    });
    blocked += 1;
  }
  return { reviewed, blocked };
}

export function processDealClearanceDay({ career, date, playerById }) {
  const transfers = gateTransferNegotiations({ career, date, playerById });
  const loanConversions = gateLoanConversions({ career, date, playerById });
  return {
    transferDealsReviewed: transfers.reviewed,
    transferDealsBlocked: transfers.blocked,
    loanConversionsReviewed: loanConversions.reviewed,
    loanConversionsBlocked: loanConversions.blocked
  };
}

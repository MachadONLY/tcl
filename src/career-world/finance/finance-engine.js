import { appendWorldEvent } from '../world-events.js';
import { effectivePlayerContract, ownerClubForPlayerState } from '../world-employment-index.js';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const round = (value, digits = 3) => Number(Number(value || 0).toFixed(digits));

function activeLoanForPlayer(world, playerId) {
  return Object.values(world.loanMarket?.deals || {}).find(deal => deal.playerId === playerId && deal.status === 'active') || null;
}

function ownedPlayerIds(world, clubCode) {
  const ids = new Set();
  for (const [playerId, ownerCode] of Object.entries(world.ownership || {})) {
    if (ownerCode === clubCode) ids.add(playerId);
  }
  for (const [playerId, contract] of Object.entries(world.contracts || {})) {
    if (contract?.status === 'active' && contract.clubCode === clubCode) ids.add(playerId);
  }
  return [...ids];
}

function loanWageAdjustment(world, clubCode, playerId, weeklyWage) {
  const loan = activeLoanForPlayer(world, playerId);
  if (!loan) return weeklyWage;
  const contribution = clamp(Number(loan.terms?.wageContribution) || 0, 0, 1);
  if (loan.parentClubCode === clubCode) return weeklyWage * (1 - contribution);
  if (loan.borrowerClubCode === clubCode) return weeklyWage * contribution;
  return weeklyWage;
}

function borrowerLoanWages(world, clubCode, playerById) {
  let total = 0;
  for (const loan of Object.values(world.loanMarket?.deals || {})) {
    if (loan.status !== 'active' || loan.borrowerClubCode !== clubCode) continue;
    const player = playerById.get(loan.playerId);
    if (!player) continue;
    const contract = effectivePlayerContract(world, player);
    const wage = Math.max(0, Number(contract.weeklyWage) || Number(player.wage) || 0);
    total += wage * clamp(Number(loan.terms?.wageContribution) || 0, 0, 1);
  }
  return total;
}

function futureCommitments(world, clubCode) {
  let transferFees = 0;
  let signingCosts = 0;
  let futureWeeklyWages = 0;
  for (const deal of Object.values(world.loanMarket?.deals || {})) {
    if (deal.status !== 'active' || deal.borrowerClubCode !== clubCode || !deal.terms?.obligationToBuy) continue;
    transferFees += Math.max(0, Number(deal.terms.optionFee) || 0);
  }
  for (const row of Object.values(world.contractMarket?.preContracts || {})) {
    if (row.status !== 'agreed' || row.toClubCode !== clubCode) continue;
    signingCosts += Math.max(0, Number(row.signingBonus) || 0) + Math.max(0, Number(row.agentFee) || 0);
    futureWeeklyWages += Math.max(0, Number(row.weeklyWage) || 0);
  }
  return { transferFees, signingCosts, futureWeeklyWages, totalImmediateEquivalent: transferFees + signingCosts };
}

function pressureBand(score) {
  if (score >= .82) return 'restricted';
  if (score >= .66) return 'strained';
  if (score >= .48) return 'watch';
  return 'stable';
}

export function clubFinanceSnapshot({ world, clubCode, playerById }) {
  const club = world.clubs?.[clubCode];
  if (!club) return null;
  const wages = [];
  let weeklyPayroll = 0;
  for (const playerId of ownedPlayerIds(world, clubCode)) {
    const player = playerById.get(playerId);
    if (!player) continue;
    const contract = effectivePlayerContract(world, player);
    if (contract.status && contract.status !== 'active') continue;
    const weeklyWage = Math.max(0, Number(contract.weeklyWage) || Number(player.wage) || 0);
    if (weeklyWage <= 0) continue;
    wages.push(weeklyWage);
    weeklyPayroll += loanWageAdjustment(world, clubCode, playerId, weeklyWage);
  }
  weeklyPayroll += borrowerLoanWages(world, clubCode, playerById);
  wages.sort((a, b) => a - b);
  const topWage = wages.length ? wages.at(-1) : 0;
  const medianWage = wages.length ? wages[Math.floor(wages.length / 2)] : 0;
  const configuredBudget = Math.max(0, Number(club.wageBudget) || 0);
  const existing = club.finance || {};
  const baselinePayroll = Math.max(Number(existing.baselineWeeklyPayroll) || 0, weeklyPayroll);
  const wageCapacity = Math.max(configuredBudget, Number(existing.wageCapacity) || 0, baselinePayroll * 1.08, 25_000);
  const wageUtilization = weeklyPayroll / Math.max(1, wageCapacity);
  const transferBudget = Math.max(0, Number(club.transferBudget) || 0);
  const startingTransferBudget = Math.max(1, Number(club.startingTransferBudget) || transferBudget || 1);
  const commitments = futureCommitments(world, clubCode);
  const committedTransferRatio = commitments.totalImmediateEquivalent / startingTransferBudget;
  const liquidityUsed = clamp(1 - transferBudget / startingTransferBudget, 0, 1.5);
  const pressureScore = clamp(
    Math.max(0, wageUtilization - .72) * .85
      + clamp(liquidityUsed - .42, 0, 1) * .42
      + clamp(committedTransferRatio, 0, 1) * .36,
    0,
    1
  );
  return {
    clubCode,
    weeklyPayroll: Math.round(weeklyPayroll),
    baselineWeeklyPayroll: Math.round(baselinePayroll),
    wageCapacity: Math.round(wageCapacity),
    wageUtilization: round(wageUtilization),
    topWage: Math.round(topWage),
    medianWage: Math.round(medianWage),
    transferBudget,
    startingTransferBudget,
    commitments,
    pressureScore: round(pressureScore),
    pressureBand: pressureBand(pressureScore)
  };
}

export function assessTransferFinancialClearance({ world, clubCode, player, fee = 0, weeklyWage = 0, playerById, expectedRole = 'squad-player' }) {
  const club = world.clubs?.[clubCode];
  const snapshot = clubFinanceSnapshot({ world, clubCode, playerById });
  if (!club || !snapshot || !player) return { approved: false, reasonCodes: ['FINANCE_ENTITY_MISSING'], snapshot };
  const reasons = [];
  const amount = Math.max(0, Number(fee) || 0);
  const wage = Math.max(0, Number(weeklyWage) || 0);
  const recruitment = club.brain?.recruitment || {};
  const wageDiscipline = Number(recruitment.wageDiscipline) || .70;
  const starBias = Number(recruitment.starBias) || .55;
  const priorityRole = ['star-player', 'important-player', 'regular-starter'].includes(expectedRole);
  const projectedPayroll = snapshot.weeklyPayroll + wage;
  const capacityFlex = 1.02 + (1 - wageDiscipline) * .10 + (priorityRole ? starBias * .05 : 0);
  const wageCeilingBase = Math.max(snapshot.topWage, snapshot.medianWage * 1.9, snapshot.wageCapacity * .08, 8_000);
  const wageHierarchyCeiling = wageCeilingBase * (1.03 + starBias * (priorityRole ? .42 : .16) + (1 - wageDiscipline) * .18);
  const reserveRatio = clamp(.05 + wageDiscipline * .08 - (priorityRole ? .035 : 0), .025, .13);
  const requiredReserve = snapshot.startingTransferBudget * reserveRatio;
  const projectedTransferBudget = snapshot.transferBudget - amount - snapshot.commitments.totalImmediateEquivalent;

  if (amount > snapshot.transferBudget) reasons.push('TRANSFER_BUDGET_INSUFFICIENT');
  if (projectedPayroll > snapshot.wageCapacity * capacityFlex) reasons.push('WAGE_BUDGET_INSUFFICIENT');
  if (wage > wageHierarchyCeiling && Number(player.rating || 0) < 87) reasons.push('WAGE_STRUCTURE_BROKEN');
  if (amount > 0 && projectedTransferBudget < -1) reasons.push('FUTURE_COMMITMENTS_UNFUNDED');
  if (amount > 0 && projectedTransferBudget < requiredReserve && snapshot.pressureBand !== 'stable' && !priorityRole) reasons.push('LIQUIDITY_RESERVE_TOO_LOW');

  return {
    approved: reasons.length === 0,
    reasonCodes: reasons,
    snapshot,
    projected: {
      weeklyPayroll: Math.round(projectedPayroll),
      wageUtilization: round(projectedPayroll / Math.max(1, snapshot.wageCapacity)),
      transferBudget: Math.round(projectedTransferBudget),
      wageHierarchyCeiling: Math.round(wageHierarchyCeiling),
      requiredTransferReserve: Math.round(requiredReserve)
    }
  };
}

export function processFinanceDay({ career, date, playerById }) {
  const world = career.world;
  world.finance ||= { clubs: {}, reviewedAt: null };
  world.finance.clubs ||= {};
  let reviewed = 0;
  let pressureChanges = 0;
  for (const clubCode of Object.keys(world.clubs || {})) {
    const snapshot = clubFinanceSnapshot({ world, clubCode, playerById });
    if (!snapshot) continue;
    const club = world.clubs[clubCode];
    const previous = club.finance?.pressureBand || null;
    club.finance = { ...snapshot, reviewedAt: date };
    world.finance.clubs[clubCode] = club.finance;
    if (previous && previous !== snapshot.pressureBand) {
      appendWorldEvent(world, {
        date,
        type: 'CLUB_FINANCE_PRESSURE_CHANGED',
        entities: { clubCode },
        payload: { from: previous, to: snapshot.pressureBand, pressureScore: snapshot.pressureScore },
        visibility: 'system'
      });
      pressureChanges += 1;
    }
    reviewed += 1;
  }
  world.finance.reviewedAt = date;
  return { reviewed, pressureChanges, restricted: Object.values(world.finance.clubs).filter(row => row.pressureBand === 'restricted').length };
}

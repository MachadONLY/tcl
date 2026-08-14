import { auditCareerWorld as baseAuditCareerWorld, aggregateRealismRuns as baseAggregateRealismRuns } from './realism-audit.js';
import { ownerClubForPlayerState } from '../world-employment-index.js';

const round = (value, digits = 3) => Number(Number(value || 0).toFixed(digits));
const average = values => values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length : 0;
const sum = values => values.reduce((total, value) => total + Number(value || 0), 0);

function activeLoans(world) {
  return Object.values(world.loanMarket?.deals || {}).filter(row => row.status === 'active');
}

function loanByPlayer(world) {
  return new Map(activeLoans(world).map(row => [row.playerId, row]));
}

function loanHardViolations(career, playerById) {
  const world = career.world || {};
  const violations = [];
  const active = activeLoans(world);
  const seenPlayers = new Set();
  for (const deal of active) {
    if (seenPlayers.has(deal.playerId)) violations.push({ code: 'MULTIPLE_ACTIVE_LOANS', playerId: deal.playerId });
    seenPlayers.add(deal.playerId);
    if (!playerById.has(deal.playerId)) violations.push({ code: 'LOAN_PLAYER_MISSING', loanId: deal.id, playerId: deal.playerId });
    if (!world.clubs?.[deal.parentClubCode]) violations.push({ code: 'LOAN_PARENT_MISSING', loanId: deal.id, clubCode: deal.parentClubCode });
    if (!world.clubs?.[deal.borrowerClubCode]) violations.push({ code: 'LOAN_BORROWER_MISSING', loanId: deal.id, clubCode: deal.borrowerClubCode });
    const owner = ownerClubForPlayerState(world, deal.playerId);
    const employer = world.employment?.[deal.playerId] || null;
    const contractClub = world.contracts?.[deal.playerId]?.clubCode || owner;
    if (owner !== deal.parentClubCode) violations.push({ code: 'LOAN_OWNER_MISMATCH', loanId: deal.id, playerId: deal.playerId, expected: deal.parentClubCode, actual: owner });
    if (contractClub !== deal.parentClubCode) violations.push({ code: 'LOAN_CONTRACT_OWNER_MISMATCH', loanId: deal.id, playerId: deal.playerId, expected: deal.parentClubCode, actual: contractClub });
    if (employer !== deal.borrowerClubCode) violations.push({ code: 'LOAN_REGISTRATION_MISMATCH', loanId: deal.id, playerId: deal.playerId, expected: deal.borrowerClubCode, actual: employer });
    if (!deal.terms?.startDate || !deal.terms?.endDate || deal.terms.startDate >= deal.terms.endDate) violations.push({ code: 'INVALID_LOAN_DATES', loanId: deal.id, startDate: deal.terms?.startDate || null, endDate: deal.terms?.endDate || null });
    if (Number(deal.terms?.wageContribution) < .25 || Number(deal.terms?.wageContribution) > 1) violations.push({ code: 'INVALID_LOAN_WAGE_SHARE', loanId: deal.id, wageContribution: deal.terms?.wageContribution });
  }
  return violations;
}

export function auditCareerWorld(career, playerById) {
  const base = baseAuditCareerWorld(career, playerById);
  const world = career.world || {};
  const activeByPlayer = loanByPlayer(world);
  const filteredHard = base.hardViolations.filter(row => {
    if (row.code !== 'CONTRACT_EMPLOYMENT_MISMATCH') return true;
    const loan = activeByPlayer.get(row.playerId);
    return !(loan && row.contractClub === loan.parentClubCode && row.employer === loan.borrowerClubCode);
  });
  const deals = Object.values(world.loanMarket?.deals || {});
  const history = world.loanMarket?.history || [];
  const active = deals.filter(row => row.status === 'active');
  const returned = history.filter(row => row.outcome === 'returned').length;
  const recalled = history.filter(row => row.outcome === 'recalled').length;
  const converted = history.filter(row => row.outcome === 'converted').length;
  const wageShares = deals.map(row => Number(row.terms?.wageContribution)).filter(Number.isFinite);
  const loanViolations = loanHardViolations(career, playerById);
  const loanFingerprint = deals
    .map(row => [row.openedAt, row.playerId, row.parentClubCode, row.borrowerClubCode, row.status, row.terms?.endDate, row.terms?.optionToBuy ? 1 : 0])
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return {
    ...base,
    fingerprint: `${base.fingerprint}|loans:${JSON.stringify(loanFingerprint)}`,
    metrics: {
      ...base.metrics,
      loanThreads: deals.length,
      activeLoans: active.length,
      loansReturned: returned,
      loansRecalled: recalled,
      loanOptionsExercised: converted,
      averageLoanWageContribution: round(average(wageShares), 3)
    },
    hardViolations: [...filteredHard, ...loanViolations]
  };
}

export function aggregateRealismRuns(runs = []) {
  const base = baseAggregateRealismRuns(runs);
  const metric = key => runs.map(run => Number(run.metrics?.[key]) || 0);
  return {
    ...base,
    totals: {
      ...base.totals,
      loanThreads: sum(metric('loanThreads')),
      activeLoans: sum(metric('activeLoans')),
      loansReturned: sum(metric('loansReturned')),
      loansRecalled: sum(metric('loansRecalled')),
      loanOptionsExercised: sum(metric('loanOptionsExercised'))
    },
    averages: {
      ...base.averages,
      loanThreads: round(average(metric('loanThreads')), 2),
      activeLoans: round(average(metric('activeLoans')), 2),
      loanWageContribution: round(average(metric('averageLoanWageContribution')), 3)
    }
  };
}

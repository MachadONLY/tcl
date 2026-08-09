import { auditCareerWorld as auditV2, aggregateRealismRuns as aggregateV2 } from './realism-audit-v2.js';
import { registrationSnapshot } from '../rules/registration-engine.js';
import { clubFinanceSnapshot } from '../finance/finance-engine.js';

const round = (value, digits = 3) => Number(Number(value || 0).toFixed(digits));
const average = values => values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length : 0;
const sum = values => values.reduce((total, value) => total + Number(value || 0), 0);

export function auditCareerWorld(career, playerById) {
  const base = auditV2(career, playerById);
  const world = career.world || {};
  const financeRows = Object.keys(world.clubs || {}).map(clubCode => clubFinanceSnapshot({ world, clubCode, playerById })).filter(Boolean);
  const registrationRows = Object.keys(world.clubs || {}).map(clubCode => registrationSnapshot({ world, clubCode, playerById })).filter(Boolean);
  const clearanceFailures = (world.events || []).filter(event => event.type === 'TRANSFER_CLEARANCE_FAILED');
  const loanClearanceFailures = (world.events || []).filter(event => event.type === 'LOAN_PERMANENT_CLEARANCE_FAILED');
  const warnings = [...base.warnings];
  const hardViolations = [...base.hardViolations];

  for (const row of financeRows) {
    if (row.transferBudget < 0) hardViolations.push({ code: 'NEGATIVE_CLUB_TRANSFER_BUDGET', clubCode: row.clubCode, transferBudget: row.transferBudget });
    if (row.weeklyPayroll < 0 || row.wageCapacity <= 0) hardViolations.push({ code: 'INVALID_CLUB_PAYROLL_STATE', clubCode: row.clubCode, weeklyPayroll: row.weeklyPayroll, wageCapacity: row.wageCapacity });
    if (row.wageUtilization > 1.25) warnings.push({ code: 'EXTREME_WAGE_UTILIZATION', clubCode: row.clubCode, utilization: row.wageUtilization });
    if (row.commitments.totalImmediateEquivalent > row.startingTransferBudget * 1.35) warnings.push({ code: 'EXTREME_FUTURE_COMMITMENTS', clubCode: row.clubCode, commitments: row.commitments.totalImmediateEquivalent, startingTransferBudget: row.startingTransferBudget });
  }

  for (const row of registrationRows) {
    if (row.total > row.profile.totalActiveCeiling + 12) warnings.push({ code: 'ACTIVE_SQUAD_FAR_ABOVE_REGISTRATION_CEILING', clubCode: row.clubCode, total: row.total, ceiling: row.profile.totalActiveCeiling });
    if (row.senior > row.profile.absoluteSeniorCeiling + 8) warnings.push({ code: 'SENIOR_SQUAD_FAR_ABOVE_REGISTRATION_CEILING', clubCode: row.clubCode, senior: row.senior, ceiling: row.profile.absoluteSeniorCeiling });
  }

  const restricted = financeRows.filter(row => row.pressureBand === 'restricted').length;
  const strained = financeRows.filter(row => row.pressureBand === 'strained').length;
  const registrationAdvisory = registrationRows.filter(row => row.senior > row.profile.seniorRegistrationTarget).length;
  const financeFingerprint = financeRows
    .map(row => [row.clubCode, row.pressureBand, Math.round(row.weeklyPayroll), Math.round(row.transferBudget)])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));

  return {
    ...base,
    fingerprint: `${base.fingerprint}|finance:${JSON.stringify(financeFingerprint)}`,
    metrics: {
      ...base.metrics,
      averageWageUtilization: round(average(financeRows.map(row => row.wageUtilization)), 3),
      restrictedFinanceClubs: restricted,
      strainedFinanceClubs: strained,
      transferClearanceFailures: clearanceFailures.length,
      loanPermanentClearanceFailures: loanClearanceFailures.length,
      registrationAdvisoryClubs: registrationAdvisory,
      averageSeniorSquad: round(average(registrationRows.map(row => row.senior)), 2),
      totalFutureCommitments: sum(financeRows.map(row => row.commitments.totalImmediateEquivalent))
    },
    hardViolations,
    warnings,
    finance: financeRows,
    registration: registrationRows
  };
}

export function aggregateRealismRuns(runs = []) {
  const base = aggregateV2(runs);
  const metric = key => runs.map(run => Number(run.metrics?.[key]) || 0);
  return {
    ...base,
    totals: {
      ...base.totals,
      transferClearanceFailures: sum(metric('transferClearanceFailures')),
      loanPermanentClearanceFailures: sum(metric('loanPermanentClearanceFailures'))
    },
    averages: {
      ...base.averages,
      wageUtilization: round(average(metric('averageWageUtilization')), 3),
      restrictedFinanceClubs: round(average(metric('restrictedFinanceClubs')), 2),
      strainedFinanceClubs: round(average(metric('strainedFinanceClubs')), 2),
      transferClearanceFailures: round(average(metric('transferClearanceFailures')), 2),
      registrationAdvisoryClubs: round(average(metric('registrationAdvisoryClubs')), 2),
      seniorSquad: round(average(metric('averageSeniorSquad')), 2)
    }
  };
}

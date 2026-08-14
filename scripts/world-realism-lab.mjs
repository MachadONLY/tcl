import { createCareer } from '../src/career-core/career-runtime.js';
import { processWorldDay } from '../src/career-world/world-engine.js';
import { WORLD_PLAYER_BY_ID, worldDatabaseCoverage } from '../src/career-world/world-player-database.js';
import { auditCareerWorld, aggregateRealismRuns } from '../src/career-world/realism/realism-audit-v3.js';

const DAY_MS = 86_400_000;

function arg(name, fallback) {
  const prefix = `--${name}=`;
  const raw = process.argv.find(value => value.startsWith(prefix));
  return raw ? raw.slice(prefix.length) : fallback;
}

function flag(name) {
  return process.argv.includes(`--${name}`);
}

function dateRange(start, days) {
  const base = Date.parse(`${start}T00:00:00Z`);
  return Array.from({ length: days }, (_, index) => new Date(base + index * DAY_MS).toISOString().slice(0, 10));
}

export function simulateRealismSave({ index = 0, clubCode = 'MUN', start = '2026-07-01', days = 63, createdAt = null } = {}) {
  const seedTime = createdAt || new Date(Date.UTC(2026, 5, 1, 12, 0, 0) + index * 13_371_000).toISOString();
  const career = createCareer(clubCode, seedTime);
  for (const date of dateRange(start, days)) processWorldDay(career, date);
  return { career, audit: auditCareerWorld(career, WORLD_PLAYER_BY_ID) };
}

export function runRealismLab({ saves = 25, clubCode = 'MUN', start = '2026-07-01', days = 63 } = {}) {
  const started = performance.now();
  const runs = [];
  for (let index = 0; index < saves; index += 1) runs.push(simulateRealismSave({ index, clubCode, start, days }).audit);
  const summary = aggregateRealismRuns(runs);
  return {
    meta: {
      version: 3,
      clubCode,
      start,
      days,
      saves,
      durationMs: Math.round(performance.now() - started),
      database: worldDatabaseCoverage()
    },
    summary,
    runs
  };
}

function humanMoney(value) {
  const amount = Number(value) || 0;
  if (amount >= 1_000_000_000) return `£${(amount / 1_000_000_000).toFixed(2)}bn`;
  if (amount >= 1_000_000) return `£${(amount / 1_000_000).toFixed(1)}m`;
  if (amount >= 1_000) return `£${Math.round(amount / 1_000)}k`;
  return `£${amount}`;
}

function printReport(report) {
  const { meta, summary } = report;
  console.log('\nTOUCHLINE WORLD REALISM LAB v3');
  console.log('================================');
  console.log(`Coverage : ${meta.database.mode} · ${meta.database.clubs} clubs · ${meta.database.players} players`);
  console.log(`Scenario : ${meta.saves} saves · ${meta.start} · ${meta.days} days · user club ${meta.clubCode}`);
  console.log(`Runtime  : ${(meta.durationMs / 1000).toFixed(2)}s`);
  console.log('');
  console.log(`Diversity: ${(summary.diversityRate * 100).toFixed(1)}% (${summary.uniqueMarketFingerprints}/${summary.saves})`);
  console.log(`Average rumors/save       : ${summary.averages.rumors}`);
  console.log(`Average negotiations/save : ${summary.averages.formalNegotiations}`);
  console.log(`Average transfers/save    : ${summary.averages.completedTransfers}`);
  console.log(`Average renewals/save     : ${summary.averages.contractRenewalThreads ?? 0}`);
  console.log(`Average loan threads/save : ${summary.averages.loanThreads ?? 0}`);
  console.log(`Average active loans/save : ${summary.averages.activeLoans ?? 0}`);
  console.log(`Average loan wage share   : ${Math.round((summary.averages.loanWageContribution || 0) * 100)}%`);
  console.log(`Average transfer age      : ${summary.averages.transferAge}`);
  console.log(`Average fee               : ${humanMoney(summary.averages.transferFee)}`);
  console.log(`Average wage utilization  : ${Math.round((summary.averages.wageUtilization || 0) * 100)}%`);
  console.log(`Restricted clubs/save     : ${summary.averages.restrictedFinanceClubs || 0}`);
  console.log(`Transfer clearances fail  : ${summary.averages.transferClearanceFailures || 0}`);
  console.log(`Registration advisories   : ${summary.averages.registrationAdvisoryClubs || 0}`);
  console.log(`Average senior squad      : ${summary.averages.seniorSquad || 0}`);
  console.log(`Hard violations           : ${summary.totals.hardViolations}`);
  console.log(`Soft warnings             : ${summary.totals.warnings}`);
  if (summary.hardViolations.length) {
    console.log('\nHARD VIOLATIONS');
    for (const row of summary.hardViolations.slice(0, 30)) console.log(`- save ${row.saveIndex}: ${row.code} ${JSON.stringify(row)}`);
  }
  if (summary.warnings.length) {
    console.log('\nSOFT WARNINGS (first 30)');
    for (const row of summary.warnings.slice(0, 30)) console.log(`- save ${row.saveIndex}: ${row.code} ${JSON.stringify(row)}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('world-realism-lab.mjs')) {
  const saves = Math.max(1, Number(arg('saves', '25')) || 25);
  const days = Math.max(1, Number(arg('days', '63')) || 63);
  const clubCode = String(arg('club', 'MUN')).toUpperCase();
  const start = String(arg('start', '2026-07-01'));
  const report = runRealismLab({ saves, days, clubCode, start });
  if (flag('json')) console.log(JSON.stringify(report, null, 2));
  else printReport(report);

  if (report.summary.totals.hardViolations > 0) process.exitCode = 1;
  if (flag('strict') && report.summary.diversityRate < .70) {
    console.error(`Strict realism gate failed: market diversity ${report.summary.diversityRate} < 0.70`);
    process.exitCode = 1;
  }
}

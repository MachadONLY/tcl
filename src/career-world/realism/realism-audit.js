import { positionBucket } from '../clubs/squad-analysis.js';

const TERMINAL_NEGOTIATIONS = new Set(['completed', 'rejected', 'withdrawn', 'expired']);
const sum = values => values.reduce((total, value) => total + (Number(value) || 0), 0);
const average = values => values.length ? sum(values) / values.length : 0;
const round = (value, digits = 2) => Number(Number(value || 0).toFixed(digits));

function squadRows(career, playerById) {
  const byClub = new Map();
  for (const [playerId, clubCode] of Object.entries(career.world?.employment || {})) {
    if (!clubCode) continue;
    const player = playerById.get(playerId);
    if (!player) continue;
    const row = byClub.get(clubCode) || { clubCode, size: 0, GK: 0, DEF: 0, MID: 0, FWD: 0, positions: {} };
    row.size += 1;
    row[player.group] = (row[player.group] || 0) + 1;
    const position = positionBucket(player);
    row.positions[position] = (row.positions[position] || 0) + 1;
    byClub.set(clubCode, row);
  }
  return [...byClub.values()].sort((left, right) => left.clubCode.localeCompare(right.clubCode));
}

function marketFingerprint(career) {
  const world = career.world || {};
  return JSON.stringify({
    rumors: (world.transferMarket?.rumors || []).map(row => [row.buyerCode, row.playerId, row.createdAt, row.stage, row.status, round(row.heat, 3)]),
    transfers: (world.transferMarket?.history || []).map(row => [row.date, row.playerId, row.fromClubCode, row.toClubCode, row.fee]),
    negotiations: Object.values(world.transferMarket?.negotiations || {}).map(row => [row.openedAt, row.buyerCode, row.playerId, row.stage, row.status])
  });
}

function hardViolations(career, playerById) {
  const world = career.world || {};
  const violations = [];
  const completedKeys = new Set();

  for (const transfer of world.transferMarket?.history || []) {
    if (!playerById.has(transfer.playerId)) violations.push({ code: 'TRANSFER_PLAYER_MISSING', transferId: transfer.id, playerId: transfer.playerId });
    if (!world.clubs?.[transfer.toClubCode]) violations.push({ code: 'TRANSFER_BUYER_MISSING', transferId: transfer.id, clubCode: transfer.toClubCode });
    if (Number(transfer.fee) < 0) violations.push({ code: 'NEGATIVE_TRANSFER_FEE', transferId: transfer.id, fee: transfer.fee });
    const key = `${transfer.date}:${transfer.playerId}`;
    if (completedKeys.has(key)) violations.push({ code: 'DOUBLE_TRANSFER_SAME_DAY', transferId: transfer.id, playerId: transfer.playerId, date: transfer.date });
    completedKeys.add(key);
  }

  for (const [playerId, contract] of Object.entries(world.contracts || {})) {
    if (contract?.status !== 'active') continue;
    const employer = world.employment?.[playerId] || null;
    if (contract.clubCode && employer && contract.clubCode !== employer) {
      violations.push({ code: 'CONTRACT_EMPLOYMENT_MISMATCH', playerId, contractClub: contract.clubCode, employer });
    }
  }

  for (const [playerId, freeAgent] of Object.entries(world.freeAgents || {})) {
    if (world.employment?.[playerId]) violations.push({ code: 'FREE_AGENT_STILL_EMPLOYED', playerId, clubCode: world.employment[playerId], since: freeAgent?.since || null });
  }

  for (const negotiation of Object.values(world.transferMarket?.negotiations || {})) {
    if (TERMINAL_NEGOTIATIONS.has(negotiation.status)) continue;
    if (!playerById.has(negotiation.playerId)) violations.push({ code: 'ACTIVE_NEGOTIATION_PLAYER_MISSING', negotiationId: negotiation.id, playerId: negotiation.playerId });
    if (!world.clubs?.[negotiation.buyerCode]) violations.push({ code: 'ACTIVE_NEGOTIATION_BUYER_MISSING', negotiationId: negotiation.id, clubCode: negotiation.buyerCode });
  }

  return violations;
}

function softWarnings(career, playerById, squads) {
  const world = career.world || {};
  const warnings = [];

  for (const transfer of world.transferMarket?.history || []) {
    const player = playerById.get(transfer.playerId);
    if (!player) continue;
    const fee = Number(transfer.fee) || 0;
    if (Number(player.age) >= 35 && fee > 45_000_000) warnings.push({ code: 'EXTREME_VETERAN_FEE', playerId: player.id, age: player.age, fee });
  }

  for (const squad of squads) {
    if (squad.size < 16) warnings.push({ code: 'SQUAD_DANGEROUSLY_SMALL', clubCode: squad.clubCode, size: squad.size });
    if (squad.size > 55) warnings.push({ code: 'SQUAD_EXTREMELY_LARGE', clubCode: squad.clubCode, size: squad.size });
    if (squad.GK > 8) warnings.push({ code: 'POSITION_HOARDING_GK', clubCode: squad.clubCode, count: squad.GK });
    if (squad.DEF > 22) warnings.push({ code: 'POSITION_HOARDING_DEF', clubCode: squad.clubCode, count: squad.DEF });
    if (squad.MID > 22) warnings.push({ code: 'POSITION_HOARDING_MID', clubCode: squad.clubCode, count: squad.MID });
    if (squad.FWD > 15) warnings.push({ code: 'POSITION_HOARDING_FWD', clubCode: squad.clubCode, count: squad.FWD });
  }

  for (const club of Object.values(world.clubs || {})) {
    const start = Math.max(1, Number(club.startingTransferBudget) || 1);
    const netSpend = Math.max(0, (Number(club.transferSpent) || 0) - (Number(club.transferIncome) || 0));
    if (netSpend > start * 1.75) warnings.push({ code: 'EXTREME_NET_SPEND_VS_STARTING_BUDGET', clubCode: club.code, netSpend, startingBudget: start });
  }

  const activeByPlayer = new Map();
  for (const negotiation of Object.values(world.transferMarket?.negotiations || {})) {
    if (TERMINAL_NEGOTIATIONS.has(negotiation.status)) continue;
    const bucket = activeByPlayer.get(negotiation.playerId) || [];
    bucket.push(negotiation.buyerCode);
    activeByPlayer.set(negotiation.playerId, bucket);
  }
  for (const [playerId, clubs] of activeByPlayer.entries()) {
    if (clubs.length > 6) warnings.push({ code: 'EXCESSIVE_FORMAL_BIDDERS', playerId, bidders: clubs.length });
  }

  return warnings;
}

export function auditCareerWorld(career, playerById) {
  const world = career.world || {};
  const history = world.transferMarket?.history || [];
  const rumors = world.transferMarket?.rumors || [];
  const negotiations = Object.values(world.transferMarket?.negotiations || {});
  const squads = squadRows(career, playerById);
  const fees = history.map(row => Number(row.fee) || 0).filter(value => value > 0);
  const ages = history.map(row => Number(playerById.get(row.playerId)?.age)).filter(Number.isFinite);
  const activeCompetitionCases = Object.values(world.transferMarket?.competition || {}).filter(row => Array.isArray(row.clubs) && row.clubs.length > 1).length;
  const rumorEnded = rumors.filter(row => row.status === 'ended').length;
  const rumorConverted = rumors.filter(row => row.status === 'converted').length;

  const hard = hardViolations(career, playerById);
  const warnings = softWarnings(career, playerById, squads);
  return {
    seed: world.seed,
    fingerprint: marketFingerprint(career),
    metrics: {
      clubs: Object.keys(world.clubs || {}).length,
      playersEmployed: Object.keys(world.employment || {}).length,
      rumors: rumors.length,
      rumorsEnded: rumorEnded,
      rumorsConverted: rumorConverted,
      rumorConversionRate: round(rumors.length ? rumorConverted / rumors.length : 0, 3),
      formalNegotiations: negotiations.length,
      completedTransfers: history.length,
      averageFee: Math.round(average(fees)),
      medianFee: fees.length ? [...fees].sort((a, b) => a - b)[Math.floor(fees.length / 2)] : 0,
      averageTransferAge: round(average(ages), 2),
      freeAgents: Object.keys(world.freeAgents || {}).length,
      activeCompetitionCases,
      minimumSquadSize: squads.length ? Math.min(...squads.map(row => row.size)) : 0,
      maximumSquadSize: squads.length ? Math.max(...squads.map(row => row.size)) : 0,
      totalTransferSpend: sum(Object.values(world.clubs || {}).map(club => club.transferSpent)),
      totalTransferIncome: sum(Object.values(world.clubs || {}).map(club => club.transferIncome))
    },
    hardViolations: hard,
    warnings,
    squads
  };
}

export function aggregateRealismRuns(runs = []) {
  const fingerprints = runs.map(run => run.fingerprint);
  const uniqueFingerprints = new Set(fingerprints);
  const hardViolations = runs.flatMap((run, index) => run.hardViolations.map(row => ({ saveIndex: index, ...row })));
  const warnings = runs.flatMap((run, index) => run.warnings.map(row => ({ saveIndex: index, ...row })));
  const metric = key => runs.map(run => Number(run.metrics?.[key]) || 0);
  return {
    saves: runs.length,
    uniqueMarketFingerprints: uniqueFingerprints.size,
    diversityRate: round(runs.length ? uniqueFingerprints.size / runs.length : 0, 3),
    totals: {
      completedTransfers: sum(metric('completedTransfers')),
      rumors: sum(metric('rumors')),
      formalNegotiations: sum(metric('formalNegotiations')),
      hardViolations: hardViolations.length,
      warnings: warnings.length
    },
    averages: {
      completedTransfers: round(average(metric('completedTransfers')), 2),
      rumors: round(average(metric('rumors')), 2),
      formalNegotiations: round(average(metric('formalNegotiations')), 2),
      transferAge: round(average(metric('averageTransferAge')), 2),
      transferFee: Math.round(average(metric('averageFee')))
    },
    hardViolations,
    warnings
  };
}

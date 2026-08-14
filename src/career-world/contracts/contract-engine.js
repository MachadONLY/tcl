import { appendWorldEvent } from '../world-events.js';
import { addWorldDays, daysBetween } from '../world-time.js';
import { randomInt, randomUnit } from '../deterministic-rng.js';
import {
  effectivePlayerContract,
  effectivePlayerStatus,
  ensurePlayerStatus,
  removePlayerEmployment,
  setPlayerEmployment
} from '../world-employment-index.js';
import { assessAgentOffer, buildAgentContractDemands } from './agent-engine.js';
import { buildRenewalOffer, contractRiskBand, evaluateRenewalCase } from './renewal-ai.js';

const TERMINAL_RENEWALS = new Set(['renewed', 'rejected', 'withdrawn']);
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function ensureContractMarket(world) {
  world.contractMarket ||= {};
  world.contractMarket.renewals ||= {};
  world.contractMarket.preContracts ||= {};
  world.contractMarket.reviewed ||= {};
  world.contractMarket.userNotifications ||= {};
  world.contractMarket.sequence = Number(world.contractMarket.sequence) || 0;
  world.freeAgents ||= {};
  return world.contractMarket;
}

function isReviewDay(date) {
  const parsed = new Date(`${date}T00:00:00Z`);
  return parsed.getUTCDay() === 1 || String(date).slice(-2) === '01';
}

function materializeContract(world, player, contract) {
  if (world.contracts?.[player.id]) return world.contracts[player.id];
  world.contracts ||= {};
  world.contracts[player.id] = {
    playerId: player.id,
    clubCode: contract.clubCode || world.employment[player.id] || player.clubCode || null,
    startDate: contract.startDate || player.joinedAt || null,
    endDate: contract.endDate || player.contractUntil || null,
    weeklyWage: Math.max(1_000, Number(contract.weeklyWage) || Number(player.wage) || 8_000),
    status: contract.status || 'active'
  };
  return world.contracts[player.id];
}

function activeRenewalForPlayer(world, playerId) {
  return Object.values(world.contractMarket?.renewals || {}).find(row => row.playerId === playerId && !TERMINAL_RENEWALS.has(row.status)) || null;
}

function latestRenewalForPlayer(world, playerId) {
  return Object.values(world.contractMarket?.renewals || {})
    .filter(row => row.playerId === playerId)
    .sort((left, right) => String(right.updatedAt || right.openedAt).localeCompare(String(left.updatedAt || left.openedAt)))[0] || null;
}

function openRenewal({ career, date, player, club, contract, status, evaluation }) {
  const world = career.world;
  const market = ensureContractMarket(world);
  if (activeRenewalForPlayer(world, player.id)) return null;
  const id = `renewal-${date}-${String(club.code).toLowerCase()}-${++market.sequence}`;
  const row = {
    id,
    playerId: player.id,
    clubCode: club.code,
    openedAt: date,
    updatedAt: date,
    stage: 'review',
    status: 'open',
    nextActionDate: addWorldDays(date, randomInt(1, 3, world.seed, id, 'agent-contact')),
    riskBand: evaluation.risk.band,
    daysRemainingAtOpen: evaluation.risk.daysRemaining,
    clubIntent: evaluation.clubIntent,
    playerWillingness: evaluation.playerWillingness,
    externalInterest: evaluation.externalInterest,
    reasons: [...evaluation.reasons],
    demands: null,
    offer: null,
    attempts: 0
  };
  market.renewals[id] = row;
  materializeContract(world, player, contract);
  appendWorldEvent(world, {
    date,
    type: 'CONTRACT_REVIEW_OPENED',
    entities: { playerId: player.id, clubCode: club.code, renewalId: id },
    payload: { riskBand: row.riskBand, reasons: row.reasons, daysRemaining: row.daysRemainingAtOpen },
    visibility: 'system'
  });
  return row;
}

function notifyUserContractRisk({ career, date, player, contract, evaluation }) {
  const world = career.world;
  const market = ensureContractMarket(world);
  const key = `${player.id}:${evaluation.risk.band}`;
  if (market.userNotifications[key]) return false;
  if (evaluation.risk.daysRemaining > 365) return false;
  market.userNotifications[key] = date;
  materializeContract(world, player, contract);
  appendWorldEvent(world, {
    date,
    type: 'USER_CONTRACT_DECISION_DUE',
    entities: { playerId: player.id, clubCode: career.clubCode },
    payload: { riskBand: evaluation.risk.band, daysRemaining: evaluation.risk.daysRemaining, reasons: evaluation.reasons }
  });
  career.inbox ||= [];
  career.inbox.unshift({
    id: `contract-risk-${player.id}-${date}`,
    date,
    sender: 'Diretor de futebol',
    subject: `Situação contratual de ${player.name}`,
    body: evaluation.risk.band === 'bosman'
      ? `${player.name} entrou nos últimos seis meses de contrato. Clubes estrangeiros podem tentar um pré-contrato e a renovação precisa de atenção imediata.`
      : `${player.name} está no último ano de contrato. O departamento recomenda decidir entre renovação e venda antes de perder poder de negociação.`,
    read: false
  });
  return true;
}

function applyContractSalePressure({ career, date, player, club, evaluation }) {
  if (club.code === career.clubCode) return false;
  const status = ensurePlayerStatus(career.world, player);
  if (status.transferListed || evaluation.risk.daysRemaining > 365) return false;
  status.transferListed = true;
  status.contractDisposition = 'sell-before-expiry';
  appendWorldEvent(career.world, {
    date,
    type: 'PLAYER_TRANSFER_LISTED',
    entities: { playerId: player.id, clubCode: club.code },
    payload: { reason: 'contract-expiry-risk', reasonCodes: evaluation.reasons, ai: true }
  });
  appendWorldEvent(career.world, {
    date,
    type: 'CONTRACT_SALE_PRESSURE',
    entities: { playerId: player.id, clubCode: club.code },
    payload: { daysRemaining: evaluation.risk.daysRemaining, clubIntent: evaluation.clubIntent },
    visibility: 'system'
  });
  return true;
}

function rejectRenewal({ career, date, row, player, reason = 'terms-not-agreed' }) {
  const world = career.world;
  row.status = 'rejected';
  row.stage = 'closed';
  row.updatedAt = date;
  row.nextActionDate = null;
  row.rejectionReason = reason;
  const contract = effectivePlayerContract(world, player);
  const risk = contractRiskBand(contract, date);
  appendWorldEvent(world, {
    date,
    type: 'CONTRACT_RENEWAL_REJECTED',
    entities: { playerId: player.id, clubCode: row.clubCode, renewalId: row.id },
    payload: { reason, riskBand: risk.band, daysRemaining: risk.daysRemaining }
  });
  if (row.clubCode !== career.clubCode && risk.daysRemaining <= 365) {
    const status = ensurePlayerStatus(world, player);
    status.transferListed = true;
    status.contractDisposition = 'sell-before-expiry';
  }
}

function renewContract({ career, date, row, player }) {
  const world = career.world;
  const current = materializeContract(world, player, effectivePlayerContract(world, player));
  const offer = row.offer;
  const baseYear = Math.max(Number(String(current.endDate || date).slice(0, 4)) || Number(date.slice(0, 4)), Number(date.slice(0, 4)));
  const endDate = `${baseYear + Number(offer.years || 3)}-06-30`;
  Object.assign(current, {
    clubCode: row.clubCode,
    startDate: date,
    endDate,
    weeklyWage: offer.weeklyWage,
    status: 'active',
    lastRenewedAt: date,
    renewalStatus: 'renewed'
  });
  row.status = 'renewed';
  row.stage = 'complete';
  row.updatedAt = date;
  row.nextActionDate = null;
  const status = ensurePlayerStatus(world, player);
  status.contractDisposition = 'retain';
  if (status.transferListed && row.reasons.includes('CONTRACT_EXPIRY_RISK')) status.transferListed = false;
  appendWorldEvent(world, {
    date,
    type: 'CONTRACT_RENEWED',
    entities: { playerId: player.id, clubCode: row.clubCode, renewalId: row.id },
    payload: { weeklyWage: offer.weeklyWage, endDate, years: offer.years, playingTime: offer.playingTime, agentFee: offer.agentFee, signingBonus: offer.signingBonus }
  });
}

function progressRenewals({ career, date, playerById }) {
  const world = career.world;
  let progressed = 0;
  let renewed = 0;
  let rejected = 0;
  for (const row of Object.values(world.contractMarket?.renewals || {})) {
    if (TERMINAL_RENEWALS.has(row.status) || !row.nextActionDate || row.nextActionDate > date) continue;
    const player = playerById.get(row.playerId);
    const club = world.clubs[row.clubCode];
    if (!player || !club || world.employment[player.id] !== row.clubCode) {
      row.status = 'withdrawn';
      row.stage = 'closed';
      row.updatedAt = date;
      row.nextActionDate = null;
      continue;
    }
    const contract = materializeContract(world, player, effectivePlayerContract(world, player));
    const status = effectivePlayerStatus(world, player);
    const evaluation = evaluateRenewalCase({ world, date, player, club, contract, status });

    if (row.stage === 'review') {
      row.demands = buildAgentContractDemands({ world, date, player, contract, status, club, externalInterest: evaluation.externalInterest, context: 'renewal' });
      row.stage = 'agent-demands';
      row.updatedAt = date;
      row.nextActionDate = addWorldDays(date, randomInt(1, 3, world.seed, row.id, 'club-offer'));
      appendWorldEvent(world, {
        date,
        type: 'CONTRACT_AGENT_DEMANDS_RECEIVED',
        entities: { playerId: player.id, clubCode: club.code, renewalId: row.id },
        payload: { minimumWeeklyWage: row.demands.minimumWeeklyWage, preferredYears: row.demands.preferredYears, requiredPlayingTime: row.demands.requiredPlayingTime, agentFee: row.demands.agentFee }
      });
      progressed += 1;
      continue;
    }

    if (row.stage === 'agent-demands') {
      row.offer = buildRenewalOffer({ world, date, player, club, status, evaluation: { ...evaluation, demands: row.demands } });
      row.attempts += 1;
      row.stage = 'club-offer';
      row.updatedAt = date;
      row.nextActionDate = addWorldDays(date, randomInt(1, 4, world.seed, row.id, 'player-response'));
      appendWorldEvent(world, {
        date,
        type: 'CONTRACT_OFFER_MADE',
        entities: { playerId: player.id, clubCode: club.code, renewalId: row.id },
        payload: { weeklyWage: row.offer.weeklyWage, years: row.offer.years, playingTime: row.offer.playingTime }
      });
      progressed += 1;
      continue;
    }

    if (row.stage === 'club-offer') {
      const assessment = assessAgentOffer({ world, date, player, demands: row.demands, offer: row.offer, status, club, externalInterest: evaluation.externalInterest });
      row.agentAssessment = assessment;
      if (assessment.accepted) {
        renewContract({ career, date, row, player });
        renewed += 1;
      } else {
        rejectRenewal({ career, date, row, player, reason: assessment.components.wageScore < .90 ? 'wage-below-expectation' : 'player-not-convinced' });
        rejected += 1;
      }
      progressed += 1;
    }
  }
  return { progressed, renewed, rejected };
}

function findBosmanRumor(world, playerId, sellerClub) {
  return (world.transferMarket?.rumors || [])
    .filter(row => row.playerId === playerId && row.status === 'active' && row.stage === 'active-interest' && row.readyForApproach)
    .filter(row => {
      const buyer = world.clubs[row.buyerCode];
      return buyer && sellerClub && buyer.countryCode && sellerClub.countryCode && buyer.countryCode !== sellerClub.countryCode;
    })
    .sort((left, right) => Number(right.heat) - Number(left.heat) || left.id.localeCompare(right.id))[0] || null;
}

function considerBosmanPreContracts({ career, date, playerById }) {
  const world = career.world;
  const market = ensureContractMarket(world);
  if (!isReviewDay(date)) return { eligible: 0, agreed: 0, userAlerts: 0 };
  let eligible = 0;
  let agreed = 0;
  let userAlerts = 0;
  for (const [playerId, clubCode] of Object.entries(world.employment || {})) {
    const player = playerById.get(playerId);
    const sellerClub = world.clubs[clubCode];
    if (!player || !sellerClub) continue;
    const contract = effectivePlayerContract(world, player);
    const risk = contractRiskBand(contract, date);
    if (risk.band !== 'bosman' || contract.status !== 'active' || market.preContracts[playerId]?.status === 'agreed') continue;
    eligible += 1;
    const rumor = findBosmanRumor(world, playerId, sellerClub);
    if (!rumor) continue;
    const buyer = world.clubs[rumor.buyerCode];
    if (!buyer) continue;
    if (clubCode === career.clubCode) {
      const key = `bosman:${playerId}:${buyer.code}`;
      if (!market.userNotifications[key]) {
        market.userNotifications[key] = date;
        career.inbox ||= [];
        career.inbox.unshift({
          id: `bosman-interest-${playerId}-${buyer.code}-${date}`,
          date,
          sender: 'Diretor de futebol',
          subject: `${buyer.name || buyer.code} acompanha ${player.name}`,
          body: `${player.name} está nos últimos seis meses de contrato e um clube estrangeiro demonstrou interesse sério. Sem renovação, um pré-contrato pode se tornar uma possibilidade.`,
          read: false
        });
        userAlerts += 1;
      }
      continue;
    }
    if (activeRenewalForPlayer(world, playerId)) continue;
    const status = effectivePlayerStatus(world, player);
    const interest = clamp(Number(rumor.playerInterest) || .5, .05, .97);
    const probability = clamp(.06 + interest * .20 + Number(rumor.heat || 0) * .14, .05, .34);
    if (randomUnit(world.seed, date, playerId, buyer.code, 'bosman-agreement') >= probability) continue;
    const demands = buildAgentContractDemands({ world, date, player, contract, status, club: buyer, externalInterest: 1, context: 'bosman' });
    const years = Number(demands.preferredYears) || 3;
    const startsAt = addWorldDays(contract.endDate, 1);
    market.preContracts[playerId] = {
      playerId,
      fromClubCode: clubCode,
      toClubCode: buyer.code,
      agreedAt: date,
      startsAt,
      weeklyWage: demands.minimumWeeklyWage,
      years,
      signingBonus: demands.signingBonus,
      agentFee: demands.agentFee,
      status: 'agreed',
      rumorId: rumor.id
    };
    appendWorldEvent(world, {
      date,
      type: 'BOSMAN_PRECONTRACT_AGREED',
      entities: { playerId, fromClubCode: clubCode, toClubCode: buyer.code, rumorId: rumor.id },
      payload: { startsAt, weeklyWage: demands.minimumWeeklyWage, years, signingBonus: demands.signingBonus, agentFee: demands.agentFee }
    });
    agreed += 1;
  }
  return { eligible, agreed, userAlerts };
}

function completeBosmanMove({ career, date, player, preContract }) {
  const world = career.world;
  const buyer = world.clubs[preContract.toClubCode];
  if (!buyer) return false;
  const oldClubCode = world.employment[player.id] || preContract.fromClubCode || null;
  setPlayerEmployment(world, player.id, buyer.code);
  const status = ensurePlayerStatus(world, player);
  Object.assign(status, {
    transferListed: false,
    loanListed: false,
    askingPrice: null,
    joinedAt: date,
    lastMoveAt: date,
    happiness: Math.max(68, Number(status.happiness) || 70),
    contractDisposition: 'retain'
  });
  world.contracts[player.id] = {
    playerId: player.id,
    clubCode: buyer.code,
    startDate: date,
    endDate: `${Number(date.slice(0, 4)) + Number(preContract.years || 3)}-06-30`,
    weeklyWage: preContract.weeklyWage,
    status: 'active'
  };
  preContract.status = 'completed';
  preContract.completedAt = date;
  world.transferMarket ||= { history: [] };
  world.transferMarket.history ||= [];
  world.transferMarket.history.push({
    id: `bosman-${player.id}-${date}`,
    date,
    playerId: player.id,
    fromClubCode: oldClubCode,
    toClubCode: buyer.code,
    fee: 0,
    weeklyWage: preContract.weeklyWage,
    bosman: true,
    freeAgent: true,
    preContract: true
  });
  appendWorldEvent(world, {
    date,
    type: 'BOSMAN_MOVE_COMPLETED',
    entities: { playerId: player.id, fromClubCode: oldClubCode, toClubCode: buyer.code },
    payload: { fee: 0, weeklyWage: preContract.weeklyWage, contractEnd: world.contracts[player.id].endDate }
  });
  return true;
}

export function processContractExpirations({ career, date, playerById }) {
  const world = career.world;
  const market = ensureContractMarket(world);
  let expired = 0;
  let bosmanMoves = 0;
  for (const [playerId, contract] of Object.entries(world.contracts || {})) {
    if (contract.status !== 'active' || !contract.endDate || contract.endDate >= date) continue;
    const player = playerById.get(playerId);
    if (!player) continue;
    const preContract = market.preContracts[playerId];
    if (preContract?.status === 'agreed' && preContract.startsAt <= date) {
      contract.status = 'expired';
      if (completeBosmanMove({ career, date, player, preContract })) bosmanMoves += 1;
      continue;
    }
    const clubCode = world.employment[playerId];
    contract.status = 'expired';
    removePlayerEmployment(world, playerId);
    if (world.playerStatus[playerId]) {
      world.playerStatus[playerId].transferListed = false;
      world.playerStatus[playerId].loanListed = false;
      world.playerStatus[playerId].contractDisposition = 'free-agent';
    }
    world.freeAgents[playerId] = { since: date, previousClubCode: clubCode || contract.clubCode || null };
    appendWorldEvent(world, {
      date,
      type: 'CONTRACT_EXPIRED',
      entities: { playerId, clubCode },
      payload: { endDate: contract.endDate, freeAgent: true }
    });
    expired += 1;
  }
  return { expired, bosmanMoves };
}

function reviewContracts({ career, date, playerById }) {
  const world = career.world;
  const market = ensureContractMarket(world);
  if (!isReviewDay(date)) return { reviewed: 0, opened: 0, salePressure: 0, userAlerts: 0 };
  let reviewed = 0;
  let opened = 0;
  let salePressure = 0;
  let userAlerts = 0;
  for (const [playerId, clubCode] of Object.entries(world.employment || {})) {
    const player = playerById.get(playerId);
    const club = world.clubs[clubCode];
    if (!player || !club) continue;
    const baseContract = effectivePlayerContract(world, player);
    const risk = contractRiskBand(baseContract, date);
    if (risk.band === 'unknown' || risk.band === 'secure' || risk.band === 'expired') continue;
    if (risk.daysRemaining > 730) continue;
    reviewed += 1;
    market.reviewed[playerId] = date;
    const contract = materializeContract(world, player, baseContract);
    const status = effectivePlayerStatus(world, player);
    const evaluation = evaluateRenewalCase({ world, date, player, club, contract, status });

    if (clubCode === career.clubCode) {
      if (notifyUserContractRisk({ career, date, player, contract, evaluation })) userAlerts += 1;
      continue;
    }

    const latest = latestRenewalForPlayer(world, playerId);
    if (latest && TERMINAL_RENEWALS.has(latest.status) && daysBetween(latest.updatedAt || latest.openedAt, date) < 60) {
      if ((evaluation.action === 'sell' || evaluation.action === 'allow-expiry') && applyContractSalePressure({ career, date, player, club, evaluation })) salePressure += 1;
      continue;
    }
    if (evaluation.action === 'renew' && !activeRenewalForPlayer(world, playerId)) {
      if (openRenewal({ career, date, player, club, contract, status, evaluation })) opened += 1;
    } else if ((evaluation.action === 'sell' || evaluation.action === 'allow-expiry') && applyContractSalePressure({ career, date, player, club, evaluation })) {
      salePressure += 1;
    }
  }
  return { reviewed, opened, salePressure, userAlerts };
}

export function processContractMarketDay({ career, date, playerById }) {
  const world = career.world;
  ensureContractMarket(world);
  const progression = progressRenewals({ career, date, playerById });
  const review = reviewContracts({ career, date, playerById });
  const bosman = considerBosmanPreContracts({ career, date, playerById });
  return { ...review, ...progression, bosman };
}

export function contractMarketSnapshot(career) {
  const market = ensureContractMarket(career.world);
  return {
    renewals: Object.values(market.renewals),
    preContracts: Object.values(market.preContracts),
    userNotifications: { ...market.userNotifications }
  };
}

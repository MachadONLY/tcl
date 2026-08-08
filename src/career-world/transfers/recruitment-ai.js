import { randomUnit, deterministicChoice } from '../deterministic-rng.js';
import { daysBetween } from '../world-time.js';
import { marketAffinity } from '../clubs/club-brain.js';
import { positionBucket } from '../clubs/squad-analysis.js';
import {
  effectivePlayerContract,
  effectivePlayerStatus,
  playerIdsForClubState
} from '../world-employment-index.js';
import { estimateMarketValue } from './valuation-engine.js';
import { evaluateMoveAppeal } from './player-brain.js';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const MIN_GROUP_DEPTH = Object.freeze({ GK: 2, DEF: 7, MID: 7, FWD: 4 });
const MIN_POSITION_DEPTH = Object.freeze({ GK: 2, CB: 3, FB: 3, DM: 1, CM: 2, W: 2, ST: 2 });
const FREE_AGENT_CLUB = Object.freeze({ code: null, name: 'Free Agents', countryCode: null, elo: 1550, policy: {}, brain: { recruitment: {} } });
const NEGOTIATION_TERMINAL = new Set(['completed', 'rejected', 'withdrawn', 'expired']);

export function transferWindowState(date) {
  const year = Number(String(date).slice(0, 4)) || 2026;
  const summerStart = `${year}-06-15`;
  const summerEnd = `${year}-09-01`;
  const winterYear = String(date).slice(5, 10) <= '02-01' ? year : year + 1;
  const winterStart = `${winterYear}-01-01`;
  const winterEnd = `${winterYear}-02-01`;
  if (date >= summerStart && date <= summerEnd) {
    const daysLeft = Math.max(0, daysBetween(date, summerEnd));
    return { open: true, name: 'summer', closes: summerEnd, urgency: daysLeft <= 7 ? 1.35 : daysLeft <= 21 ? 1.08 : .82 };
  }
  if (date >= winterStart && date <= winterEnd) {
    const daysLeft = Math.max(0, daysBetween(date, winterEnd));
    return { open: true, name: 'winter', closes: winterEnd, urgency: daysLeft <= 5 ? 1.28 : .78 };
  }
  return { open: false, name: 'closed', closes: null, urgency: 0 };
}

export function playerMoveInterest({ world = null, date = null, player, status = {}, contract = {}, buyerClub = {}, sellerClub = {}, need = {} }) {
  return evaluateMoveAppeal({ world, date, player, status, contract, buyerClub, sellerClub, need }).interest;
}

function rumorMatchesNeed(rumor, need) {
  if (!rumor || rumor.status !== 'active') return false;
  if (need?.position && rumor.position) return rumor.position === need.position;
  return rumor.group === need?.group;
}

function buyerRumors(world, buyerCode, need) {
  return (world.transferMarket?.rumors || []).filter(rumor => rumor.buyerCode === buyerCode && rumorMatchesNeed(rumor, need));
}

function matureRumor(world, buyerCode, need, date) {
  return buyerRumors(world, buyerCode, need)
    .filter(rumor => rumor.stage === 'active-interest' && rumor.readyForApproach && (!rumor.nextActionDate || rumor.nextActionDate >= date || rumor.nextActionDate <= date))
    .sort((left, right) => Number(right.heat) - Number(left.heat) || left.id.localeCompare(right.id))[0] || null;
}

export function shouldRecruitToday({ world, clubState, date, need, activeNegotiations = 0 }) {
  const window = transferWindowState(date);
  if (!window.open || !need || activeNegotiations > 1) return false;
  if (date < String(clubState.recruitment?.nextRecruitmentDate || date)) return false;
  const budget = Number(clubState.transferBudget) || 0;
  if (budget < 2_000_000) return false;
  const priority = Number(need.priority) || 0;
  const rumors = buyerRumors(world, clubState.code, need);
  const mature = matureRumor(world, clubState.code, need, date);
  if (rumors.length && !mature) return false;

  const patience = Number(clubState.managerBrain?.negotiationPatience ?? clubState.policy?.patience) || .6;
  if (mature) {
    const heat = Number(mature.heat) || .5;
    const probability = clamp((.12 + priority * .24 + heat * .17) * window.urgency * (1.12 - patience * .16), .08, .62);
    return randomUnit(world.seed, date, clubState.code, mature.playerId, 'formal-approach') < probability;
  }

  const deadlineEmergency = window.urgency >= 1.25 && priority >= .72;
  if (!deadlineEmergency) return false;
  const emergencyProbability = clamp(.012 + priority * .035, .01, .055);
  return randomUnit(world.seed, date, clubState.code, need.position || need.group, 'deadline-direct-approach') < emergencyProbability;
}

function potentialScore(player, buyerClub) {
  const rating = Number(player.rating) || 60;
  const potential = Math.max(rating, Number(player.potential) || rating);
  const gap = Math.max(0, potential - rating);
  const youthWeight = Number(buyerClub.brain?.recruitment?.youthBias) || .65;
  return clamp(.50 + gap * .035 * youthWeight + Math.max(0, 23 - (Number(player.age) || 24)) * .015 * youthWeight, .35, 1);
}

function roleFitScore(player, need) {
  if (!need?.position) return player.group === need.group ? .78 : .35;
  const bucket = positionBucket(player);
  if (bucket === need.position) return 1;
  const compatible = new Set(['CB:FB', 'FB:CB', 'DM:CM', 'CM:DM', 'CM:W', 'W:CM', 'W:ST', 'ST:W']);
  return compatible.has(`${bucket}:${need.position}`) ? .62 : player.group === need.group ? .48 : .18;
}

function availabilityScore(status = {}, sellerSquadSize = 25, freeAgent = false) {
  if (freeAgent) return 1;
  if (status.transferListed) return .98;
  if (status.squadRole === 'fringe') return .86;
  if (status.squadRole === 'rotation') return .68;
  if (status.squadRole === 'important') return sellerSquadSize > 26 ? .43 : .30;
  return .20;
}

function rumorBoost(world, buyerCode, playerId, need) {
  const rumor = (world.transferMarket?.rumors || []).find(row => row.status === 'active' && row.buyerCode === buyerCode && row.playerId === playerId && rumorMatchesNeed(row, need));
  if (!rumor) return { value: 0, mature: false, rumor: null };
  const stage = rumor.stage === 'active-interest' ? .34 : rumor.stage === 'scouted' ? .17 : .07;
  return { value: stage + (Number(rumor.heat) || 0) * .18, mature: rumor.stage === 'active-interest' && rumor.readyForApproach, rumor };
}

function playerHasOtherFormalNegotiation(world, playerId, buyerCode) {
  return Object.values(world.transferMarket?.negotiations || {}).some(negotiation =>
    negotiation.playerId === playerId
      && negotiation.buyerCode !== buyerCode
      && !NEGOTIATION_TERMINAL.has(negotiation.status)
  );
}

function candidateScore({ player, need, buyerClub, sellerClub, status, contract, date, world, sellerSquadSize, freeAgent = false }) {
  const marketValue = estimateMarketValue({ player, status, contract, date, sellingClub: sellerClub });
  const budget = Number(buyerClub.transferBudget) || 0;
  const brain = buyerClub.brain?.recruitment || {};
  const maxRatio = Number(brain.maxFeeToBudgetRatio) || (need.priority >= .7 ? .82 : .62);
  if (!freeAgent && marketValue > budget * Math.max(.24, maxRatio * (need.priority >= .72 ? 1 : .82))) return null;
  const age = Number(player.age) || 24;
  const maxAge = Number(need.preferredAgeMax ?? brain.preferredAgeMax) || 29;
  if (age > maxAge + (player.group === 'GK' ? 3 : 1) && Number(brain.starBias || 0) < .8) return null;
  const rating = Number(player.rating) || 60;
  if (rating < Number(need.targetRating || 72) - 6) return null;
  const roleFit = roleFitScore(player, need);
  if (roleFit < .45) return null;
  const interest = playerMoveInterest({ world, date, player, status, contract, buyerClub, sellerClub, need });
  if (interest < .28) return null;

  const valueEfficiency = freeAgent ? 1 : clamp(1 - marketValue / Math.max(1, budget), 0, 1);
  const preferredMid = (Number(need.preferredAgeMin || 18) + maxAge) / 2;
  const ageFit = clamp(1 - Math.abs(age - preferredMid) / 18, 0, 1);
  const qualityFit = clamp(.55 + (rating - Number(need.targetRating || rating)) * .045, .25, 1);
  const potentialFit = potentialScore(player, buyerClub);
  const marketFit = freeAgent ? .62 : marketAffinity(buyerClub.brain, sellerClub.countryCode);
  const availability = availabilityScore(status, sellerSquadSize, freeAgent);
  const tacticalWeight = Number(brain.tacticalFitWeight) || .65;
  const potentialWeight = Number(brain.potentialWeight) || .65;
  const currentWeight = Number(brain.currentAbilityWeight) || .65;
  const resaleWeight = Number(brain.resaleBias) || .6;
  const freeAgentBias = Number(brain.freeAgentBias) || .4;
  const rumor = rumorBoost(world, buyerClub.code, player.id, need);
  const noise = randomUnit(world.seed, date, buyerClub.code, player.id, need.position || need.group, 'candidate-tie') * .045;

  const score = (
    qualityFit * (.20 + currentWeight * .18)
    + roleFit * (.14 + tacticalWeight * .16)
    + potentialFit * (.08 + potentialWeight * .12)
    + interest * .13
    + ageFit * (.05 + resaleWeight * .08)
    + marketFit * .08
    + valueEfficiency * .07
    + availability * .06
    + (freeAgent ? freeAgentBias * .08 : 0)
    + rumor.value
    + noise
  );
  return { player, marketValue, interest, roleFit, marketFit, availability, freeAgent, rumor: rumor.rumor, matureRumor: rumor.mature, score };
}

function sellerContext(world, sellerCode, playerById, cache) {
  if (cache.has(sellerCode)) return cache.get(sellerCode);
  const ids = playerIdsForClubState(world, sellerCode);
  const groups = {};
  const positions = {};
  for (const id of ids) {
    const player = playerById.get(id);
    if (!player) continue;
    groups[player.group] = (groups[player.group] || 0) + 1;
    const position = positionBucket(player);
    positions[position] = (positions[position] || 0) + 1;
  }
  const context = { ids, size: ids.length, groups, positions };
  cache.set(sellerCode, context);
  return context;
}

function fitsNeed(player, need) {
  if (need.position && positionBucket(player) !== need.position && player.group !== need.group) return false;
  if (!need.position && player.group !== need.group) return false;
  return true;
}

export function chooseRecruitmentTarget({ world, date, buyerCode, need, playerById, ignoreRumorPreference = false }) {
  const buyerClub = world.clubs[buyerCode];
  if (!buyerClub) return null;
  const candidates = [];
  const sellerCache = new Map();
  for (const [playerId, sellerCode] of Object.entries(world.employment || {})) {
    if (!sellerCode || sellerCode === buyerCode) continue;
    const player = playerById.get(playerId);
    if (!player || !fitsNeed(player, need)) continue;
    if (playerHasOtherFormalNegotiation(world, playerId, buyerCode)) continue;
    const sellerClub = world.clubs[sellerCode];
    if (!sellerClub) continue;
    const status = effectivePlayerStatus(world, player);
    const seller = sellerContext(world, sellerCode, playerById, sellerCache);
    const playerPosition = positionBucket(player);
    if (!status.transferListed && seller.size <= Number(sellerClub.brain?.recruitment?.minSquadSize || sellerClub.policy?.minSquadSize || 22)) continue;
    if (!status.transferListed && (seller.groups[player.group] || 0) <= (MIN_GROUP_DEPTH[player.group] || 2)) continue;
    if (!status.transferListed && (seller.positions[playerPosition] || 0) <= (MIN_POSITION_DEPTH[playerPosition] || 1)) continue;
    if (status.lastMoveAt && daysBetween(status.lastMoveAt, date) < 120 && !status.transferListed) continue;
    const scored = candidateScore({ player, need, buyerClub, sellerClub, status, contract: effectivePlayerContract(world, player), date, world, sellerSquadSize: seller.size });
    if (scored) candidates.push(scored);
  }

  for (const playerId of Object.keys(world.freeAgents || {})) {
    if (world.employment[playerId]) continue;
    const player = playerById.get(playerId);
    if (!player || !fitsNeed(player, need)) continue;
    if (playerHasOtherFormalNegotiation(world, playerId, buyerCode)) continue;
    const baseStatus = effectivePlayerStatus(world, player);
    const status = { ...baseStatus, transferListed: true, squadRole: 'fringe' };
    const contract = { ...effectivePlayerContract(world, player), endDate: date, status: 'expired' };
    const scored = candidateScore({ player, need, buyerClub, sellerClub: FREE_AGENT_CLUB, status, contract, date, world, sellerSquadSize: 0, freeAgent: true });
    if (scored) candidates.push(scored);
  }

  candidates.sort((left, right) => right.score - left.score || right.player.rating - left.player.rating || left.player.age - right.player.age);
  if (!ignoreRumorPreference) {
    const mature = candidates.filter(candidate => candidate.matureRumor).sort((left, right) => right.score - left.score);
    if (mature.length) return mature[0];
  }
  const finalists = candidates.slice(0, 5);
  return deterministicChoice(finalists, world.seed, date, buyerCode, need.position || need.group, 'target-choice') || null;
}

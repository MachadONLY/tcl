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

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const MIN_GROUP_DEPTH = Object.freeze({ GK: 2, DEF: 7, MID: 7, FWD: 4 });
const MIN_POSITION_DEPTH = Object.freeze({ GK: 2, CB: 3, FB: 3, DM: 1, CM: 2, W: 2, ST: 2 });
const FREE_AGENT_CLUB = Object.freeze({ code: null, name: 'Free Agents', countryCode: null, elo: 1550, policy: {}, brain: { recruitment: {} } });

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

export function playerMoveInterest({ player, status = {}, contract = {}, buyerClub = {}, sellerClub = {}, need = {} }) {
  const buyerElo = Number(buyerClub.elo) || 1750;
  const sellerElo = Number(sellerClub.elo) || 1550;
  const reputationDelta = (buyerElo - sellerElo) / 350;
  const role = status.squadRole || 'rotation';
  const roleResistance = role === 'key' ? -.22 : role === 'important' ? -.1 : role === 'fringe' ? .15 : 0;
  const listing = status.transferListed ? .25 : 0;
  const age = Number(player.age) || 24;
  const careerStep = age <= 27 ? reputationDelta * .28 : reputationDelta * .16;
  const needFit = (Number(need.priority) || 0) * .20;
  const promisedRole = need.expectedPlayingTime === 'regular-starter' ? .12 : need.expectedPlayingTime === 'important-player' ? .07 : 0;
  const longContractResistance = contract?.endDate && String(contract.endDate) > '2029-06-30' ? -.05 : 0;
  const happiness = Number(status.happiness) || 70;
  const happinessEffect = happiness < 55 ? .10 : happiness > 85 ? -.05 : 0;
  const countryAffinity = buyerClub.countryCode && sellerClub.countryCode && buyerClub.countryCode === sellerClub.countryCode ? .03 : 0;
  return clamp(.50 + careerStep + roleResistance + listing + needFit + promisedRole + longContractResistance + happinessEffect + countryAffinity, .05, .97);
}

export function shouldRecruitToday({ world, clubState, date, need, activeNegotiations = 0 }) {
  const window = transferWindowState(date);
  if (!window.open || !need || activeNegotiations > 1) return false;
  if (date < String(clubState.recruitment?.nextRecruitmentDate || date)) return false;
  const budget = Number(clubState.transferBudget) || 0;
  if (budget < 2_000_000) return false;
  const priority = Number(need.priority) || 0;
  const patience = Number(clubState.managerBrain?.negotiationPatience ?? clubState.policy?.patience) || .6;
  const urgency = window.urgency * (1.12 - patience * .20);
  const probability = clamp((.018 + priority * .072) * urgency, .008, .15);
  return randomUnit(world.seed, date, clubState.code, need.position || need.group, 'recruitment-activation') < probability;
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
  const interest = playerMoveInterest({ player, status, contract, buyerClub, sellerClub, need });
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
    + noise
  );
  return { player, marketValue, interest, roleFit, marketFit, availability, freeAgent, score };
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

export function chooseRecruitmentTarget({ world, date, buyerCode, need, playerById }) {
  const buyerClub = world.clubs[buyerCode];
  if (!buyerClub) return null;
  const candidates = [];
  const sellerCache = new Map();
  for (const [playerId, sellerCode] of Object.entries(world.employment || {})) {
    if (!sellerCode || sellerCode === buyerCode) continue;
    const player = playerById.get(playerId);
    if (!player || !fitsNeed(player, need)) continue;
    const sellerClub = world.clubs[sellerCode];
    if (!sellerClub) continue;
    const status = effectivePlayerStatus(world, player);
    const seller = sellerContext(world, sellerCode, playerById, sellerCache);
    const playerPosition = positionBucket(player);
    if (!status.transferListed && seller.size <= Number(sellerClub.brain?.recruitment?.minSquadSize || sellerClub.policy?.minSquadSize || 22)) continue;
    if (!status.transferListed && (seller.groups[player.group] || 0) <= (MIN_GROUP_DEPTH[player.group] || 2)) continue;
    if (!status.transferListed && (seller.positions[playerPosition] || 0) <= (MIN_POSITION_DEPTH[playerPosition] || 1)) continue;
    if (status.lastMoveAt && daysBetween(status.lastMoveAt, date) < 120 && !status.transferListed) continue;
    const scored = candidateScore({
      player,
      need,
      buyerClub,
      sellerClub,
      status,
      contract: effectivePlayerContract(world, player),
      date,
      world,
      sellerSquadSize: seller.size
    });
    if (scored) candidates.push(scored);
  }

  for (const playerId of Object.keys(world.freeAgents || {})) {
    const player = playerById.get(playerId);
    if (!player || !fitsNeed(player, need)) continue;
    const baseStatus = effectivePlayerStatus(world, player);
    const status = { ...baseStatus, transferListed: true, squadRole: 'fringe' };
    const contract = { ...effectivePlayerContract(world, player), endDate: date, status: 'expired' };
    const scored = candidateScore({
      player,
      need,
      buyerClub,
      sellerClub: FREE_AGENT_CLUB,
      status,
      contract,
      date,
      world,
      sellerSquadSize: 0,
      freeAgent: true
    });
    if (scored) candidates.push(scored);
  }

  candidates.sort((left, right) => right.score - left.score || right.player.rating - left.player.rating || left.player.age - right.player.age);
  const finalists = candidates.slice(0, 5);
  return deterministicChoice(finalists, world.seed, date, buyerCode, need.position || need.group, 'target-choice') || null;
}

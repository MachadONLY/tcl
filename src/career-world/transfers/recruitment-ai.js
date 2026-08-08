import { randomUnit, deterministicChoice } from '../deterministic-rng.js';
import { daysBetween } from '../world-time.js';
import { estimateMarketValue } from './valuation-engine.js';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const MIN_GROUP_DEPTH = Object.freeze({ GK: 2, DEF: 7, MID: 7, FWD: 4 });

export function transferWindowState(date) {
  const year = Number(String(date).slice(0, 4)) || 2026;
  const summerStart = `${year}-06-15`;
  const summerEnd = `${year}-09-01`;
  const winterYear = String(date).slice(5, 10) <= '02-01' ? year : year + 1;
  const winterStart = `${winterYear}-01-01`;
  const winterEnd = `${winterYear}-02-01`;
  if (date >= summerStart && date <= summerEnd) {
    const daysLeft = Math.max(0, daysBetween(date, summerEnd));
    return { open: true, name: 'summer', closes: summerEnd, urgency: daysLeft <= 7 ? 1.35 : daysLeft <= 21 ? 1.08 : 0.82 };
  }
  if (date >= winterStart && date <= winterEnd) {
    const daysLeft = Math.max(0, daysBetween(date, winterEnd));
    return { open: true, name: 'winter', closes: winterEnd, urgency: daysLeft <= 5 ? 1.28 : 0.78 };
  }
  return { open: false, name: 'closed', closes: null, urgency: 0 };
}

export function playerMoveInterest({ player, status = {}, contract = {}, buyerClub = {}, sellerClub = {}, need = {} }) {
  const buyerElo = Number(buyerClub.elo) || 1750;
  const sellerElo = Number(sellerClub.elo) || 1750;
  const reputationDelta = (buyerElo - sellerElo) / 350;
  const role = status.squadRole || 'rotation';
  const roleResistance = role === 'key' ? -0.22 : role === 'important' ? -0.1 : role === 'fringe' ? 0.15 : 0;
  const listing = status.transferListed ? 0.25 : 0;
  const age = Number(player.age) || 24;
  const careerStep = age <= 27 ? reputationDelta * 0.28 : reputationDelta * 0.16;
  const needFit = (Number(need.priority) || 0) * 0.22;
  const longContractResistance = contract?.endDate && String(contract.endDate) > '2029-06-30' ? -0.05 : 0;
  return clamp(0.52 + careerStep + roleResistance + listing + needFit + longContractResistance, 0.05, 0.97);
}

export function shouldRecruitToday({ world, clubState, date, need, activeNegotiations = 0 }) {
  const window = transferWindowState(date);
  if (!window.open || !need || activeNegotiations > 0) return false;
  if (date < String(clubState.recruitment?.nextRecruitmentDate || date)) return false;
  const budget = Number(clubState.transferBudget) || 0;
  if (budget < 2_000_000) return false;
  const priority = Number(need.priority) || 0;
  const probability = clamp((0.022 + priority * 0.075) * window.urgency, 0.01, 0.16);
  return randomUnit(world.seed, date, clubState.code, need.group, 'recruitment-activation') < probability;
}

function candidateScore({ player, need, buyerClub, sellerClub, status, contract, date, world }) {
  const marketValue = estimateMarketValue({ player, status, contract, date, sellingClub: sellerClub });
  const budget = Number(buyerClub.transferBudget) || 0;
  if (marketValue > budget * (need.priority >= 0.7 ? 0.82 : 0.62)) return null;
  const age = Number(player.age) || 24;
  const maxAge = Number(need.preferredAgeMax) || 29;
  if (age > maxAge + (player.group === 'GK' ? 3 : 1)) return null;
  const rating = Number(player.rating) || 60;
  if (rating < Number(need.targetRating || 72) - 5) return null;
  const interest = playerMoveInterest({ player, status, contract, buyerClub, sellerClub, need });
  if (interest < 0.31) return null;
  const valueEfficiency = clamp(1 - marketValue / Math.max(1, budget), 0, 1);
  const ageFit = clamp(1 - Math.abs(age - 24) / 18, 0, 1);
  const qualityFit = clamp(0.55 + (rating - Number(need.targetRating || rating)) * 0.045, 0.25, 1);
  const noise = randomUnit(world.seed, date, buyerClub.code, player.id, 'candidate-tie') * 0.08;
  return {
    player,
    marketValue,
    interest,
    score: qualityFit * 0.42 + interest * 0.26 + ageFit * 0.14 + valueEfficiency * 0.1 + noise
  };
}

export function chooseRecruitmentTarget({ world, date, buyerCode, need, playerById }) {
  const buyerClub = world.clubs[buyerCode];
  if (!buyerClub) return null;
  const candidates = [];
  for (const [playerId, sellerCode] of Object.entries(world.employment || {})) {
    if (sellerCode === buyerCode) continue;
    const player = playerById.get(playerId);
    if (!player || player.group !== need.group) continue;
    if (sellerCode === world.userClubCode && !world.playerStatus[playerId]?.transferListed) continue;
    const sellerClub = world.clubs[sellerCode];
    if (!sellerClub) continue;
    const status = world.playerStatus[playerId] || {};
    const sellerSquadIds = Object.entries(world.employment || {}).filter(([, code]) => code === sellerCode).map(([id]) => id);
    if (!status.transferListed && sellerSquadIds.length <= Number(sellerClub.policy?.minSquadSize || 22)) continue;
    const sellerGroupCount = sellerSquadIds.reduce((count, id) => count + (playerById.get(id)?.group === player.group ? 1 : 0), 0);
    if (!status.transferListed && sellerGroupCount <= (MIN_GROUP_DEPTH[player.group] || 2)) continue;
    if (status.lastMoveAt && daysBetween(status.lastMoveAt, date) < 120 && !status.transferListed) continue;
    const scored = candidateScore({
      player, need, buyerClub, sellerClub, status,
      contract: world.contracts[playerId] || {}, date, world
    });
    if (scored) candidates.push(scored);
  }
  candidates.sort((left, right) => right.score - left.score || right.player.rating - left.player.rating);
  const finalists = candidates.slice(0, 3);
  return deterministicChoice(finalists, world.seed, date, buyerCode, need.group, 'target-choice') || null;
}

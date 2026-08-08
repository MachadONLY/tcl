import { randomUnit } from '../deterministic-rng.js';
import { daysBetween } from '../world-time.js';
import { positionBucket } from './squad-analysis.js';
import { createPlayerBrain } from '../transfers/player-brain.js';
import { estimateSellingPosition } from '../transfers/valuation-engine.js';
import { contractRiskBand } from '../contracts/renewal-ai.js';
import { effectivePlayerContract, effectivePlayerStatus, ensurePlayerStatus, playerIdsForClubState } from '../world-employment-index.js';
import { appendWorldEvent } from '../world-events.js';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const REVIEW_DAYS = new Set(['01', '08', '15', '22']);

function roleValue(role) {
  return { key: 1, important: .84, rotation: .58, prospect: .50, fringe: .22 }[role] || .52;
}

function depthContext(players, player) {
  const position = positionBucket(player);
  const peers = players.filter(candidate => positionBucket(candidate) === position)
    .sort((left, right) => Number(right.rating) - Number(left.rating));
  const index = peers.findIndex(candidate => candidate.id === player.id);
  const rank = index < 0 ? peers.length : index + 1;
  const minimum = position === 'GK' ? 2 : ['CB', 'FB'].includes(position) ? 3 : position === 'DM' ? 1 : 2;
  return { position, peers: peers.length, rank, spare: peers.length > minimum, deep: peers.length >= minimum + 2 };
}

function financePressure(club, analysis) {
  const start = Math.max(1, Number(club.startingTransferBudget) || Number(club.transferBudget) || 1);
  const current = Math.max(0, Number(club.transferBudget) || 0);
  const committed = Math.max(0, Number(club.transferSpent) || 0);
  const highNeed = Math.max(0, ...((analysis?.requirements || analysis?.needs || []).map(row => Number(row.priority) || 0)));
  const lowLiquidity = clamp(1 - current / start, 0, 1);
  return clamp(lowLiquidity * .56 + highNeed * .28 + clamp(committed / start - .75, 0, 1) * .16, 0, 1);
}

function classifyDisposition({ world, date, player, club, analysis, status, contract, players }) {
  const brain = createPlayerBrain(player);
  const role = status.squadRole || 'rotation';
  const importance = roleValue(role);
  const depth = depthContext(players, player);
  const risk = contractRiskBand(contract, date);
  const age = Number(player.age) || 24;
  const rating = Number(player.rating) || 65;
  const potential = Math.max(rating, Number(player.potential) || rating);
  const growth = Math.max(0, potential - rating);
  const happiness = clamp((Number(status.happiness) || 70) / 100, 0, 1);
  const resaleBias = Number(club.brain?.recruitment?.resaleBias) || .60;
  const youthBias = Number(club.brain?.recruitment?.youthBias) || .65;
  const starBias = Number(club.brain?.recruitment?.starBias) || .55;
  const pressure = financePressure(club, analysis);
  const recentArrival = status.lastMoveAt && daysBetween(status.lastMoveAt, date) < 180;
  const contractPressure = risk.band === 'bosman' ? 1 : risk.band === 'critical' ? .82 : risk.band === 'renewal-window' ? .46 : .08;
  const youthAsset = age <= 22 && growth >= 3;
  const primeCore = age <= 29 && importance >= .84 && rating >= Number(analysis?.expectedStarterRating || 72) - 1;
  const excessDepth = depth.deep && depth.rank > Math.max(2, Math.ceil(depth.peers * .62));
  const blockedYoungster = youthAsset && roleRank(role) <= 3 && depth.rank > 1;
  const unhappyPressure = happiness < .52 ? (.52 - happiness) * 1.8 : 0;
  const sellScore = clamp(
    (1 - importance) * .30
      + (excessDepth ? .18 : 0)
      + contractPressure * .20
      + pressure * .16
      + unhappyPressure * .16
      + (age >= 30 ? resaleBias * .11 : 0)
      - (youthAsset ? youthBias * .15 : 0)
      - (primeCore ? .24 : 0)
      - (recentArrival ? .15 : 0)
      + (randomUnit(world.seed, date, club.code, player.id, 'selling-disposition') - .5) * .05,
    0,
    1
  );

  let disposition = 'retain';
  const reasons = [];
  if (primeCore && contractPressure < .55 && happiness >= .55) {
    disposition = starBias >= .60 || importance >= 1 ? 'untouchable' : 'exceptional-only';
    reasons.push('CORE_PLAYER');
  } else if (blockedYoungster && contractPressure < .55) {
    disposition = 'loan-pathway';
    reasons.push('YOUTH_PATHWAY_BLOCKED');
  } else if (contractPressure >= .82 && status.contractDisposition === 'sell-before-expiry') {
    disposition = 'actively-for-sale';
    reasons.push('CONTRACT_EXPIRY_RISK');
  } else if (sellScore >= .72) {
    disposition = 'actively-for-sale';
  } else if (sellScore >= .55) {
    disposition = 'available';
  } else if (importance >= .84 || rating >= Number(analysis?.expectedStarterRating || 72) + 3) {
    disposition = 'exceptional-only';
  }

  if (excessDepth) reasons.push('POSITION_SURPLUS');
  if (pressure >= .62) reasons.push('FINANCE_SALE_REQUIRED');
  if (happiness < .52) reasons.push('PLAYER_UNHAPPY');
  if (age >= 30 && resaleBias >= .65) reasons.push('AGE_RESale_WINDOW');
  if (youthAsset) reasons.push('YOUTH_ASSET');
  if (!reasons.length) reasons.push('SQUAD_PLANNING');

  return {
    disposition,
    reasons,
    sellScore: +sellScore.toFixed(3),
    financePressure: +pressure.toFixed(3),
    contractRisk: risk.band,
    position: depth.position,
    positionRank: depth.rank,
    positionDepth: depth.peers
  };
}

function roleRank(role) {
  return { key: 5, important: 4, rotation: 3, prospect: 2, fringe: 1 }[role] || 2;
}

function applyDisposition({ world, date, player, club, status, contract, classification }) {
  const previous = status.saleDisposition?.type || null;
  const type = classification.disposition;
  status.saleDisposition = {
    type,
    reasons: [...classification.reasons],
    reviewedAt: date,
    sellScore: classification.sellScore,
    financePressure: classification.financePressure,
    contractRisk: classification.contractRisk
  };

  if (type === 'actively-for-sale' || type === 'available') {
    status.transferListed = true;
    status.loanListed = false;
    const selling = estimateSellingPosition({ player, status, contract, date, sellingClub: club });
    status.askingPrice = type === 'actively-for-sale'
      ? Math.round(selling.minimumAcceptable / 250_000) * 250_000
      : Math.round(selling.askingPrice / 250_000) * 250_000;
  } else if (type === 'loan-pathway') {
    status.transferListed = false;
    status.askingPrice = null;
    status.loanListed = true;
  } else if (type === 'untouchable' || type === 'exceptional-only' || type === 'retain') {
    if (status.contractDisposition !== 'sell-before-expiry') {
      status.transferListed = false;
      status.askingPrice = null;
    }
    if (type !== 'loan-pathway') status.loanListed = false;
  }

  if (previous !== type) {
    appendWorldEvent(world, {
      date,
      type: 'PLAYER_SALE_DISPOSITION_CHANGED',
      entities: { playerId: player.id, clubCode: club.code },
      payload: {
        from: previous,
        to: type,
        reasonCodes: classification.reasons,
        sellScore: classification.sellScore,
        askingPrice: status.askingPrice || null
      },
      visibility: 'system'
    });
    return true;
  }
  return false;
}

export function processSellingAiDay({ career, date, playerById, squadAnalyses = {} }) {
  const world = career.world;
  if (!REVIEW_DAYS.has(String(date).slice(-2))) return { reviewed: 0, changed: 0, transferListed: 0, loanListed: 0 };
  let reviewed = 0;
  let changed = 0;
  let transferListed = 0;
  let loanListed = 0;
  for (const [clubCode, analysis] of Object.entries(squadAnalyses || {})) {
    if (clubCode === career.clubCode) continue;
    const club = world.clubs[clubCode];
    if (!club) continue;
    const players = playerIdsForClubState(world, clubCode).map(id => playerById.get(id)).filter(Boolean);
    for (const player of players) {
      const status = effectivePlayerStatus(world, player);
      if (status.onLoan) continue;
      const contract = effectivePlayerContract(world, player);
      const classification = classifyDisposition({ world, date, player, club, analysis, status, contract, players });
      const mutable = ensurePlayerStatus(world, player);
      if (applyDisposition({ world, date, player, club, status: mutable, contract, classification })) changed += 1;
      if (mutable.transferListed) transferListed += 1;
      if (mutable.loanListed) loanListed += 1;
      reviewed += 1;
    }
  }
  return { reviewed, changed, transferListed, loanListed };
}

export function saleDispositionFor(career, playerId) {
  return career.world?.playerStatus?.[playerId]?.saleDisposition || null;
}

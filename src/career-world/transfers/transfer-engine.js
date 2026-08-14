import { appendWorldEvent } from '../world-events.js';
import { addWorldDays } from '../world-time.js';
import { randomInt, randomUnit } from '../deterministic-rng.js';
import {
  effectivePlayerContract,
  effectivePlayerStatus,
  ensurePlayerStatus,
  setPlayerEmployment
} from '../world-employment-index.js';
import { chooseRecruitmentTarget, playerMoveInterest, shouldRecruitToday, transferWindowState } from './recruitment-ai.js';
import { estimateSellingPosition, wageExpectation } from './valuation-engine.js';

const TERMINAL = new Set(['completed', 'rejected', 'withdrawn', 'expired']);
const FREE_AGENT_CLUB = Object.freeze({ code: null, name: 'Free Agents', countryCode: null, elo: 1550, policy: {}, brain: { recruitment: {} } });
const roundMoney = value => Math.max(250_000, Math.round(value / 250_000) * 250_000);

function activeForClub(world, clubCode) {
  return Object.values(world.transferMarket.negotiations || {})
    .filter(negotiation => !TERMINAL.has(negotiation.status))
    .filter(negotiation => negotiation.buyerCode === clubCode || negotiation.sellerCode === clubCode);
}

function activeIncomingForUser(world, userClubCode) {
  return Object.values(world.transferMarket.negotiations || {})
    .filter(negotiation => !TERMINAL.has(negotiation.status))
    .filter(negotiation => negotiation.sellerCode === userClubCode).length;
}

function negotiationId(world, date, buyerCode, playerId) {
  const sequence = Object.keys(world.transferMarket.negotiations || {}).length + 1;
  return `neg-${date}-${String(buyerCode).toLowerCase()}-${playerId}-${sequence}`;
}

function setNextRecruitmentDate(world, clubCode, date, salt = 'cooldown') {
  const club = world.clubs[clubCode];
  if (!club) return;
  club.recruitment.nextRecruitmentDate = addWorldDays(date, randomInt(4, 9, world.seed, date, clubCode, salt));
  world.transferMarket.lastActivityByClub[clubCode] = date;
}

function createNegotiation({ career, date, buyerCode, need, target }) {
  const world = career.world;
  const player = target.player;
  const freeAgent = Boolean(target.freeAgent || world.freeAgents?.[player.id]);
  const sellerCode = freeAgent ? null : world.employment[player.id];
  const buyerClub = world.clubs[buyerCode];
  const sellerClub = freeAgent ? FREE_AGENT_CLUB : world.clubs[sellerCode];
  const baseStatus = effectivePlayerStatus(world, player);
  const status = freeAgent ? { ...baseStatus, transferListed: true, squadRole: 'fringe' } : baseStatus;
  const contract = freeAgent
    ? { ...effectivePlayerContract(world, player), endDate: date, status: 'expired' }
    : effectivePlayerContract(world, player);
  const selling = estimateSellingPosition({ player, status, contract, date, sellingClub: sellerClub, shortage: false });
  if (freeAgent) {
    selling.askingPrice = 0;
    selling.minimumAcceptableFee = 0;
  } else if (Number(status.askingPrice) > 0) {
    selling.askingPrice = Math.max(selling.minimumAcceptableFee, Number(status.askingPrice));
  }
  const id = negotiationId(world, date, buyerCode, player.id);
  const negotiation = {
    id,
    playerId: player.id,
    buyerCode,
    sellerCode,
    freeAgent,
    group: player.group,
    position: need.position || null,
    role: need.role || null,
    openedAt: date,
    updatedAt: date,
    stage: 'scouting',
    status: 'open',
    nextActionDate: addWorldDays(date, randomInt(1, 3, world.seed, id, 'scout-delay')),
    marketValue: selling.marketValue,
    askingPrice: selling.askingPrice,
    minimumAcceptableFee: selling.minimumAcceptableFee,
    proposedFee: null,
    counterFee: null,
    attempts: 0,
    playerInterest: playerMoveInterest({ player, status, contract, buyerClub, sellerClub, need }),
    requiresUserDecision: !freeAgent && sellerCode === career.clubCode,
    need: {
      group: need.group,
      position: need.position || null,
      role: need.role || null,
      priority: need.priority,
      reason: need.reason,
      expectedPlayingTime: need.expectedPlayingTime || null
    }
  };
  world.transferMarket.negotiations[id] = negotiation;
  setNextRecruitmentDate(world, buyerCode, date, 'opened');
  appendWorldEvent(world, {
    date,
    type: freeAgent ? 'FREE_AGENT_INTEREST_REGISTERED' : 'TRANSFER_INTEREST_REGISTERED',
    entities: { playerId: player.id, buyerCode, sellerCode, negotiationId: id },
    payload: { marketValue: selling.marketValue, group: player.group, position: need.position || null, role: need.role || null, freeAgent }
  });
  return negotiation;
}

function rejectNegotiation(world, negotiation, date, reason) {
  negotiation.status = 'rejected';
  negotiation.stage = 'closed';
  negotiation.updatedAt = date;
  negotiation.nextActionDate = null;
  world.transferMarket.cooldowns[`${negotiation.buyerCode}:${negotiation.playerId}`] = addWorldDays(date, 14);
  appendWorldEvent(world, {
    date,
    type: 'TRANSFER_NEGOTIATION_ENDED',
    entities: { playerId: negotiation.playerId, buyerCode: negotiation.buyerCode, sellerCode: negotiation.sellerCode, negotiationId: negotiation.id },
    payload: { reason, fee: negotiation.proposedFee, freeAgent: Boolean(negotiation.freeAgent) }
  });
}

function completeTransfer(career, negotiation, date, playerById) {
  const world = career.world;
  const player = playerById.get(negotiation.playerId);
  if (!player) return rejectNegotiation(world, negotiation, date, 'player-missing');
  const buyer = world.clubs[negotiation.buyerCode];
  const seller = negotiation.freeAgent ? null : world.clubs[negotiation.sellerCode];
  const fee = negotiation.freeAgent
    ? 0
    : Math.max(250_000, Number(negotiation.proposedFee) || Number(negotiation.counterFee) || negotiation.minimumAcceptableFee);
  if (!buyer || (!negotiation.freeAgent && !seller) || buyer.transferBudget < fee) {
    return rejectNegotiation(world, negotiation, date, 'budget-changed');
  }
  const oldContract = effectivePlayerContract(world, player);
  const weeklyWage = wageExpectation({ player, contract: oldContract, buyerClub: buyer });
  buyer.transferBudget = Math.max(0, buyer.transferBudget - fee);
  buyer.transferSpent = (Number(buyer.transferSpent) || 0) + fee;
  if (seller) {
    seller.transferIncome = (Number(seller.transferIncome) || 0) + fee;
    seller.transferBudget = (Number(seller.transferBudget) || 0) + Math.round(fee * .72);
  }
  setPlayerEmployment(world, player.id, buyer.code);
  const status = ensurePlayerStatus(world, player);
  Object.assign(status, {
    transferListed: false,
    loanListed: false,
    askingPrice: null,
    squadRole: 'rotation',
    lastMoveAt: date,
    joinedAt: date,
    happiness: Math.max(68, Number(status.happiness) || 70),
    playingTimeExpectation: negotiation.need?.expectedPlayingTime || 'squad-player'
  });
  const years = player.age >= 32 ? 2 : player.age >= 29 ? 3 : player.age <= 22 ? 5 : 4;
  world.contracts[player.id] = {
    playerId: player.id,
    clubCode: buyer.code,
    startDate: date,
    endDate: `${Number(date.slice(0, 4)) + years}-06-30`,
    weeklyWage,
    status: 'active'
  };
  negotiation.status = 'completed';
  negotiation.stage = 'complete';
  negotiation.updatedAt = date;
  negotiation.nextActionDate = null;
  const history = {
    id: `transfer-${negotiation.id}`,
    date,
    playerId: player.id,
    fromClubCode: seller?.code || null,
    toClubCode: buyer.code,
    fee,
    weeklyWage,
    freeAgent: Boolean(negotiation.freeAgent),
    negotiationId: negotiation.id
  };
  world.transferMarket.history.push(history);
  appendWorldEvent(world, {
    date,
    type: negotiation.freeAgent ? 'FREE_AGENT_SIGNED' : 'TRANSFER_COMPLETED',
    entities: { playerId: player.id, fromClubCode: seller?.code || null, toClubCode: buyer.code, negotiationId: negotiation.id },
    payload: { fee, weeklyWage, contractEnd: world.contracts[player.id].endDate, freeAgent: Boolean(negotiation.freeAgent) }
  });
  return history;
}

function progressNegotiation(career, negotiation, date, playerById) {
  const world = career.world;
  if (TERMINAL.has(negotiation.status) || negotiation.nextActionDate > date) return;
  const player = playerById.get(negotiation.playerId);
  const buyer = world.clubs[negotiation.buyerCode];
  const seller = negotiation.freeAgent ? FREE_AGENT_CLUB : world.clubs[negotiation.sellerCode];
  if (!player || !buyer || (!negotiation.freeAgent && !seller)) return rejectNegotiation(world, negotiation, date, 'entity-missing');

  if (negotiation.stage === 'scouting') {
    negotiation.stage = 'enquiry';
    negotiation.updatedAt = date;
    negotiation.nextActionDate = addWorldDays(date, randomInt(1, 3, world.seed, negotiation.id, 'enquiry-delay'));
    appendWorldEvent(world, {
      date,
      type: negotiation.freeAgent ? 'FREE_AGENT_CONTACT' : 'TRANSFER_ENQUIRY',
      entities: { playerId: player.id, buyerCode: buyer.code, sellerCode: seller?.code || null, negotiationId: negotiation.id },
      payload: { marketValue: negotiation.marketValue, freeAgent: Boolean(negotiation.freeAgent) }
    });
    return;
  }

  if (negotiation.stage === 'enquiry') {
    negotiation.attempts = 1;
    negotiation.updatedAt = date;
    if (negotiation.freeAgent) {
      negotiation.proposedFee = 0;
      negotiation.stage = 'personal-terms';
      negotiation.nextActionDate = addWorldDays(date, randomInt(1, 2, world.seed, negotiation.id, 'free-agent-terms'));
      appendWorldEvent(world, {
        date,
        type: 'FREE_AGENT_TERMS_OPENED',
        entities: { playerId: player.id, buyerCode: buyer.code, negotiationId: negotiation.id },
        payload: { fee: 0 }
      });
      return;
    }
    const aggression = Number(buyer.policy?.negotiationAggression) || .55;
    const startRatio = .83 + aggression * .12 + randomUnit(world.seed, negotiation.id, 'opening-offer') * .09;
    negotiation.proposedFee = roundMoney(Math.min(buyer.transferBudget, negotiation.askingPrice * startRatio));
    if (negotiation.requiresUserDecision) {
      negotiation.stage = 'awaiting-user';
      negotiation.status = 'awaiting-user';
      negotiation.nextActionDate = null;
      appendWorldEvent(world, {
        date,
        type: 'TRANSFER_OFFER_RECEIVED',
        entities: { playerId: player.id, buyerCode: buyer.code, sellerCode: seller.code, negotiationId: negotiation.id },
        payload: { fee: negotiation.proposedFee, askingPrice: negotiation.askingPrice }
      });
      career.inbox ||= [];
      career.inbox.unshift({
        id: `transfer-offer-${negotiation.id}`,
        date,
        sender: 'Diretor de futebol',
        subject: `Proposta recebida por ${player.name}`,
        body: `${buyer.name || buyer.code} apresentou uma proposta de £${Math.round(negotiation.proposedFee / 1_000_000 * 10) / 10}M. A negociação aguarda sua decisão.`,
        read: false
      });
      return;
    }
    if (negotiation.proposedFee < negotiation.minimumAcceptableFee * .9) {
      negotiation.counterFee = negotiation.minimumAcceptableFee;
      negotiation.stage = 'counter';
      negotiation.nextActionDate = addWorldDays(date, 1);
      return;
    }
    negotiation.stage = 'personal-terms';
    negotiation.nextActionDate = addWorldDays(date, randomInt(1, 3, world.seed, negotiation.id, 'terms-delay'));
    appendWorldEvent(world, {
      date,
      type: 'TRANSFER_OFFER_ACCEPTED',
      entities: { playerId: player.id, buyerCode: buyer.code, sellerCode: seller.code, negotiationId: negotiation.id },
      payload: { fee: negotiation.proposedFee }
    });
    return;
  }

  if (negotiation.stage === 'counter') {
    const ceiling = Math.min(buyer.transferBudget, negotiation.marketValue * (1.22 + (negotiation.need?.priority || 0) * .18));
    if (negotiation.counterFee > ceiling) return rejectNegotiation(world, negotiation, date, 'price-too-high');
    negotiation.proposedFee = roundMoney(Math.min(negotiation.counterFee, ceiling));
    negotiation.attempts += 1;
    negotiation.stage = 'personal-terms';
    negotiation.updatedAt = date;
    negotiation.nextActionDate = addWorldDays(date, randomInt(1, 2, world.seed, negotiation.id, 'counter-accepted'));
    appendWorldEvent(world, {
      date,
      type: 'TRANSFER_OFFER_ACCEPTED',
      entities: { playerId: player.id, buyerCode: buyer.code, sellerCode: seller.code, negotiationId: negotiation.id },
      payload: { fee: negotiation.proposedFee, afterCounter: true }
    });
    return;
  }

  if (negotiation.stage === 'personal-terms') {
    const interest = Number(negotiation.playerInterest) || 0;
    const acceptance = interest + randomUnit(world.seed, date, negotiation.id, 'personal-terms') * .22;
    if (acceptance < .48) return rejectNegotiation(world, negotiation, date, 'player-declined');
    completeTransfer(career, negotiation, date, playerById);
  }
}

function recruitmentQueue(world, career, date, squadAnalyses) {
  return Object.entries(squadAnalyses || {})
    .filter(([clubCode]) => clubCode !== career.clubCode)
    .map(([clubCode, analysis]) => {
      const need = analysis.requirements?.[0] || analysis.needs?.[0] || null;
      const priority = Number(need?.priority) || 0;
      const noise = randomUnit(world.seed, date, clubCode, need?.position || need?.group || 'none', 'market-queue') * .08;
      return { clubCode, need, score: priority + noise };
    })
    .filter(row => row.need)
    .sort((left, right) => right.score - left.score || left.clubCode.localeCompare(right.clubCode));
}

export function processTransferMarketDay({ career, date, playerById, squadAnalyses }) {
  const world = career.world;
  const window = transferWindowState(date);
  const clubCount = Object.keys(world.clubs || {}).length;
  const globalDailyCap = Math.min(32, Math.max(3, Math.ceil(clubCount / 35)));
  const summary = { window, progressed: 0, opened: 0, completed: 0, globalDailyCap };
  if (!window.open) return summary;

  const completedBefore = world.transferMarket.history.length;
  for (const negotiation of Object.values(world.transferMarket.negotiations || {})) {
    const before = `${negotiation.stage}:${negotiation.status}`;
    progressNegotiation(career, negotiation, date, playerById);
    if (`${negotiation.stage}:${negotiation.status}` !== before) summary.progressed += 1;
  }

  for (const row of recruitmentQueue(world, career, date, squadAnalyses)) {
    const { clubCode, need } = row;
    const clubState = world.clubs[clubCode];
    const active = activeForClub(world, clubCode).filter(negotiation => negotiation.buyerCode === clubCode).length;
    if (!shouldRecruitToday({ world, clubState, date, need, activeNegotiations: active })) continue;
    const target = chooseRecruitmentTarget({ world, date, buyerCode: clubCode, need, playerById });
    if (!target) {
      setNextRecruitmentDate(world, clubCode, date, 'no-target');
      continue;
    }
    if (world.employment[target.player.id] === career.clubCode && activeIncomingForUser(world, career.clubCode) >= 2) {
      setNextRecruitmentDate(world, clubCode, date, 'user-inbox-protection');
      continue;
    }
    const cooldown = world.transferMarket.cooldowns[`${clubCode}:${target.player.id}`];
    if (cooldown && cooldown > date) continue;
    createNegotiation({ career, date, buyerCode: clubCode, need, target });
    summary.opened += 1;
    if (summary.opened >= globalDailyCap) break;
  }
  summary.completed = world.transferMarket.history.length - completedBefore;
  return summary;
}

export function respondToTransferOffer({ career, negotiationId, decision, date, playerById }) {
  const world = career.world;
  const negotiation = world.transferMarket.negotiations?.[negotiationId];
  if (!negotiation || negotiation.stage !== 'awaiting-user' || negotiation.status !== 'awaiting-user') return null;
  if (decision === 'reject') {
    rejectNegotiation(world, negotiation, date, 'user-rejected');
    return negotiation;
  }
  if (decision === 'accept') {
    negotiation.requiresUserDecision = false;
    negotiation.status = 'open';
    negotiation.stage = 'personal-terms';
    negotiation.nextActionDate = date;
    progressNegotiation(career, negotiation, date, playerById);
    return negotiation;
  }
  return null;
}

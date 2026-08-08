import { appendWorldEvent } from '../world-events.js';
import { addWorldDays, daysBetween } from '../world-time.js';
import { deterministicChoice, randomInt, randomUnit } from '../deterministic-rng.js';
import { positionBucket } from '../clubs/squad-analysis.js';
import {
  effectivePlayerContract,
  effectivePlayerStatus,
  ensurePlayerStatus,
  ownerClubForPlayerState,
  playerIdsForClubState,
  setPlayerEmployment
} from '../world-employment-index.js';
import { evaluateMoveAppeal } from '../transfers/player-brain.js';
import { wageExpectation } from '../transfers/valuation-engine.js';
import { transferWindowState } from '../transfers/recruitment-ai.js';

const TERMINAL = new Set(['rejected', 'completed', 'returned', 'recalled', 'converted']);
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const roundMoney = value => Math.max(0, Math.round(Number(value || 0) / 50_000) * 50_000);

function ensureLoanMarket(world) {
  world.loanMarket ||= {};
  world.loanMarket.deals ||= {};
  world.loanMarket.history ||= [];
  world.loanMarket.cooldowns ||= {};
  world.loanMarket.sequence = Number(world.loanMarket.sequence) || 0;
  return world.loanMarket;
}

function activeLoanForPlayer(world, playerId) {
  return Object.values(world.loanMarket?.deals || {}).find(row => row.playerId === playerId && row.status === 'active') || null;
}

function pendingLoanForPlayer(world, playerId) {
  return Object.values(world.loanMarket?.deals || {}).find(row => row.playerId === playerId && !TERMINAL.has(row.status) && row.status !== 'active') || null;
}

function roleRank(role) {
  return { key: 5, important: 4, rotation: 3, prospect: 2, fringe: 1 }[role] || 2;
}

function promisedRole(priority = .5) {
  if (priority >= .80) return 'regular-starter';
  if (priority >= .60) return 'important-player';
  if (priority >= .38) return 'squad-player';
  return 'prospect-or-depth';
}

function loanEndDate(date, contractEnd) {
  const year = Number(String(date).slice(0, 4));
  const month = Number(String(date).slice(5, 7));
  let target = month <= 8 ? `${year + 1}-06-30` : `${year}-06-30`;
  if (target <= date) target = `${year + 1}-06-30`;
  if (contractEnd && target >= contractEnd) target = addWorldDays(contractEnd, -1);
  return target;
}

function requirementRows(analysis) {
  return analysis?.requirements?.length ? analysis.requirements : analysis?.needs || [];
}

function needAcceptsLoan(need) {
  return !Array.isArray(need?.transferTypes) || need.transferTypes.includes('loan');
}

function needFitsPlayer(need, player) {
  if (!need || !player) return false;
  if (need.position) {
    const bucket = positionBucket(player);
    if (bucket !== need.position && player.group !== need.group) return false;
  } else if (need.group && player.group !== need.group) return false;
  const rating = Number(player.rating) || 60;
  const target = Number(need.targetRating) || rating;
  return rating >= target - 8 && rating <= target + 7;
}

function sellerHasDepth(world, parentCode, player, playerById) {
  const ids = playerIdsForClubState(world, parentCode);
  const sameGroup = ids.map(id => playerById.get(id)).filter(candidate => candidate?.group === player.group);
  const samePosition = ids.map(id => playerById.get(id)).filter(candidate => candidate && positionBucket(candidate) === positionBucket(player));
  const groupMinimum = player.group === 'GK' ? 2 : player.group === 'DEF' ? 7 : player.group === 'MID' ? 7 : 4;
  const positionMinimum = positionBucket(player) === 'GK' ? 2 : ['CB', 'FB'].includes(positionBucket(player)) ? 3 : ['DM'].includes(positionBucket(player)) ? 1 : 2;
  return sameGroup.length > groupMinimum && samePosition.length > positionMinimum;
}

function loanCandidateScore({ world, date, player, parent, borrower, need, status, contract }) {
  if (!player || !parent || !borrower || parent.code === borrower.code) return null;
  if (status.onLoan || activeLoanForPlayer(world, player.id) || pendingLoanForPlayer(world, player.id)) return null;
  const endDate = loanEndDate(date, contract.endDate);
  if (!contract.endDate || endDate <= addWorldDays(date, 90) || daysBetween(date, contract.endDate) < 420) return null;
  const age = Number(player.age) || 24;
  const potential = Math.max(Number(player.rating) || 60, Number(player.potential) || Number(player.rating) || 60);
  const growth = Math.max(0, potential - Number(player.rating || 60));
  const role = status.squadRole || 'rotation';
  const listed = Boolean(status.loanListed);
  const developmental = age <= 23 && growth >= 2;
  const blocked = role === 'prospect' || role === 'fringe' || role === 'rotation';
  if (!listed && (!developmental || !blocked)) return null;
  if (!needAcceptsLoan(need) || !needFitsPlayer(need, player)) return null;
  const borrowerCeiling = 70 + Math.max(0, (Number(borrower.elo) || 1600) - 1600) / 35;
  if (Number(player.rating) > borrowerCeiling + 5 && roleRank(role) >= 4) return null;
  const move = evaluateMoveAppeal({
    world,
    date,
    player,
    status,
    contract,
    buyerClub: borrower,
    sellerClub: parent,
    need: { ...need, expectedPlayingTime: promisedRole(Number(need.priority) || .5) }
  });
  const loanUsage = Number(parent.brain?.recruitment?.loanUsage) || .5;
  const borrowerNeed = Number(need.priority) || .4;
  const playingTimeGain = role === 'fringe' || role === 'prospect' ? .22 : role === 'rotation' ? .10 : 0;
  const score = clamp(
    borrowerNeed * .29
      + move.interest * .24
      + loanUsage * .14
      + clamp(growth / 8, 0, 1) * .10
      + (listed ? .16 : .05)
      + playingTimeGain
      + randomUnit(world.seed, date, parent.code, borrower.code, player.id, 'loan-candidate') * .035,
    0,
    1.1
  );
  return { score, endDate, playerInterest: move.interest };
}

function buildLoanTerms({ world, date, player, parent, borrower, need, contract, endDate }) {
  const borrowerStrength = clamp(((Number(borrower.elo) || 1600) - 1450) / 700, .12, 1);
  const parentDiscipline = Number(parent.brain?.recruitment?.feeDiscipline) || .7;
  const wageContribution = Math.round(clamp(.38 + borrowerStrength * .45 + randomUnit(world.seed, date, player.id, borrower.code, 'loan-wage') * .14, .35, 1) * 20) / 20;
  const annualWage = Math.max(1_000, Number(contract.weeklyWage) || Number(player.wage) || 8_000) * 52;
  const loanFee = roundMoney(annualWage * (.03 + parentDiscipline * .06 + Math.max(0, Number(player.rating) - 76) * .006));
  const ownerOpenToSale = ['fringe', 'rotation'].includes(effectivePlayerStatus(world, player).squadRole) && Number(parent.brain?.recruitment?.resaleBias || .6) >= .55;
  const optionProbability = ownerOpenToSale ? .24 + Number(borrower.brain?.recruitment?.feeDiscipline || .6) * .12 : .05;
  const optionToBuy = randomUnit(world.seed, date, player.id, parent.code, borrower.code, 'loan-option') < optionProbability;
  const obligationToBuy = optionToBuy && Number(need.priority || 0) >= .78 && randomUnit(world.seed, date, player.id, borrower.code, 'loan-obligation') < .12;
  const baseValue = Math.max(500_000, Number(player.value) || Math.pow(Math.max(1, Number(player.rating) - 55), 2.1) * 80_000);
  const optionFee = optionToBuy ? roundMoney(baseValue * (.90 + randomUnit(world.seed, player.id, borrower.code, 'loan-option-fee') * .22)) : null;
  const recallClause = !obligationToBuy && randomUnit(world.seed, date, parent.code, player.id, 'loan-recall') < .62;
  return {
    startDate: null,
    endDate,
    wageContribution,
    loanFee,
    promisedPlayingTime: promisedRole(Number(need.priority) || .5),
    optionToBuy,
    obligationToBuy,
    optionFee,
    recallClause
  };
}

export function proposeLoanDeal({ career, date, player, parentCode, borrowerCode, need, playerById }) {
  const world = career.world;
  const market = ensureLoanMarket(world);
  const parent = world.clubs[parentCode];
  const borrower = world.clubs[borrowerCode];
  if (!player || !parent || !borrower || ownerClubForPlayerState(world, player.id) !== parentCode || world.employment[player.id] !== parentCode) return null;
  const status = effectivePlayerStatus(world, player);
  const contract = effectivePlayerContract(world, player);
  const scored = loanCandidateScore({ world, date, player, parent, borrower, need, status, contract });
  if (!scored) return null;
  const id = `loan-${date}-${String(parentCode).toLowerCase()}-${String(borrowerCode).toLowerCase()}-${++market.sequence}`;
  const terms = buildLoanTerms({ world, date, player, parent, borrower, need, contract, endDate: scored.endDate });
  const deal = {
    id,
    playerId: player.id,
    parentClubCode: parentCode,
    borrowerClubCode: borrowerCode,
    openedAt: date,
    updatedAt: date,
    stage: 'proposal',
    status: 'open',
    nextActionDate: addWorldDays(date, randomInt(1, 2, world.seed, id, 'parent-review')),
    playerInterest: scored.playerInterest,
    needSnapshot: {
      group: need.group || player.group,
      position: need.position || positionBucket(player),
      priority: Number(need.priority) || 0,
      reason: need.reason || 'depth',
      targetRating: Number(need.targetRating) || Number(player.rating) || 0
    },
    terms,
    requiresUserDecision: parentCode === career.clubCode,
    userDecision: null,
    previousStatus: null
  };
  market.deals[id] = deal;
  appendWorldEvent(world, {
    date,
    type: 'LOAN_PROPOSAL_OPENED',
    entities: { playerId: player.id, parentClubCode: parentCode, borrowerClubCode: borrowerCode, loanId: id },
    payload: { ...terms, playerInterest: scored.playerInterest, reason: deal.needSnapshot.reason },
    visibility: parentCode === career.clubCode ? 'world' : 'system'
  });
  return deal;
}

function rejectLoan(world, deal, date, reason) {
  deal.status = 'rejected';
  deal.stage = 'closed';
  deal.updatedAt = date;
  deal.nextActionDate = null;
  deal.rejectionReason = reason;
  world.loanMarket.cooldowns[`${deal.parentClubCode}:${deal.playerId}:${deal.borrowerClubCode}`] = addWorldDays(date, 21);
  appendWorldEvent(world, {
    date,
    type: 'LOAN_PROPOSAL_REJECTED',
    entities: { playerId: deal.playerId, parentClubCode: deal.parentClubCode, borrowerClubCode: deal.borrowerClubCode, loanId: deal.id },
    payload: { reason }
  });
}

function activateLoan({ career, deal, date, player }) {
  const world = career.world;
  const status = ensurePlayerStatus(world, player);
  deal.previousStatus = {
    squadRole: status.squadRole,
    playingTimeExpectation: status.playingTimeExpectation,
    lastMoveAt: status.lastMoveAt || null
  };
  setPlayerEmployment(world, player.id, deal.borrowerClubCode, { preserveOwnership: true });
  Object.assign(status, {
    onLoan: true,
    loanParentClubCode: deal.parentClubCode,
    loanClubCode: deal.borrowerClubCode,
    loanEndDate: deal.terms.endDate,
    loanPromisedPlayingTime: deal.terms.promisedPlayingTime,
    loanListed: false,
    transferListed: false,
    lastMoveAt: deal.terms.endDate,
    playingTimeExpectation: deal.terms.promisedPlayingTime,
    happiness: clamp((Number(status.happiness) || 70) + 3, 20, 100)
  });
  deal.status = 'active';
  deal.stage = 'active';
  deal.updatedAt = date;
  deal.terms.startDate = date;
  deal.nextActionDate = deal.terms.endDate;
  appendWorldEvent(world, {
    date,
    type: 'LOAN_STARTED',
    entities: { playerId: player.id, parentClubCode: deal.parentClubCode, borrowerClubCode: deal.borrowerClubCode, loanId: deal.id },
    payload: { ...deal.terms }
  });
}

function progressPendingDeal({ career, date, deal, playerById }) {
  if (TERMINAL.has(deal.status) || deal.status === 'active' || !deal.nextActionDate || deal.nextActionDate > date) return false;
  const world = career.world;
  const player = playerById.get(deal.playerId);
  const parent = world.clubs[deal.parentClubCode];
  const borrower = world.clubs[deal.borrowerClubCode];
  if (!player || !parent || !borrower || ownerClubForPlayerState(world, deal.playerId) !== deal.parentClubCode || world.employment[deal.playerId] !== deal.parentClubCode) {
    rejectLoan(world, deal, date, 'entities-changed');
    return true;
  }
  const status = effectivePlayerStatus(world, player);
  const contract = effectivePlayerContract(world, player);

  if (deal.stage === 'proposal') {
    if (deal.requiresUserDecision && deal.userDecision !== 'accept') {
      deal.stage = 'awaiting-user';
      deal.status = 'awaiting-user';
      deal.nextActionDate = null;
      career.inbox ||= [];
      career.inbox.unshift({
        id: `loan-offer-${deal.id}`,
        date,
        sender: 'Diretor de futebol',
        subject: `Proposta de empréstimo por ${player.name}`,
        body: `${borrower.name || borrower.code} quer ${player.name} por empréstimo até ${deal.terms.endDate}, pagando ${Math.round(deal.terms.wageContribution * 100)}% do salário${deal.terms.optionToBuy ? ` e com opção de compra de £${Math.round(Number(deal.terms.optionFee || 0) / 1_000_000 * 10) / 10}M` : ''}.`,
        read: false
      });
      appendWorldEvent(world, {
        date,
        type: 'LOAN_OFFER_RECEIVED',
        entities: { playerId: player.id, parentClubCode: parent.code, borrowerClubCode: borrower.code, loanId: deal.id },
        payload: { ...deal.terms }
      });
      return true;
    }
    const parentLoanBias = Number(parent.brain?.recruitment?.loanUsage) || .5;
    const listed = Boolean(status.loanListed) || deal.requiresUserDecision && deal.userDecision === 'accept';
    const parentScore = .28 + parentLoanBias * .28 + (listed ? .34 : 0) + (['prospect', 'fringe'].includes(status.squadRole) ? .12 : 0);
    if (randomUnit(world.seed, date, deal.id, 'parent-verdict') > clamp(parentScore, .18, .94)) {
      rejectLoan(world, deal, date, 'parent-prefers-retain');
      return true;
    }
    deal.stage = 'player-review';
    deal.status = 'open';
    deal.updatedAt = date;
    deal.nextActionDate = addWorldDays(date, randomInt(1, 3, world.seed, deal.id, 'player-review'));
    appendWorldEvent(world, {
      date,
      type: 'LOAN_PARENT_APPROVED',
      entities: { playerId: player.id, parentClubCode: parent.code, borrowerClubCode: borrower.code, loanId: deal.id },
      payload: { ...deal.terms }
    });
    return true;
  }

  if (deal.stage === 'player-review') {
    const move = evaluateMoveAppeal({
      world,
      date,
      player,
      status,
      contract,
      buyerClub: borrower,
      sellerClub: parent,
      need: { ...deal.needSnapshot, expectedPlayingTime: deal.terms.promisedPlayingTime }
    });
    const acceptance = move.interest + randomUnit(world.seed, date, deal.id, 'loan-player-verdict') * .16;
    if (acceptance < .43) {
      rejectLoan(world, deal, date, 'player-declined');
      return true;
    }
    activateLoan({ career, deal, date, player });
    return true;
  }
  return false;
}

function returnLoan({ career, date, deal, player, reason = 'loan-complete' }) {
  const world = career.world;
  const parent = world.clubs[deal.parentClubCode];
  if (!parent) return false;
  setPlayerEmployment(world, player.id, deal.parentClubCode, { preserveOwnership: true });
  const status = ensurePlayerStatus(world, player);
  Object.assign(status, {
    onLoan: false,
    loanParentClubCode: null,
    loanClubCode: null,
    loanEndDate: null,
    loanPromisedPlayingTime: null,
    lastMoveAt: deal.previousStatus?.lastMoveAt || null,
    squadRole: deal.previousStatus?.squadRole || status.squadRole,
    playingTimeExpectation: deal.previousStatus?.playingTimeExpectation || status.playingTimeExpectation
  });
  deal.status = reason === 'recalled' ? 'recalled' : 'returned';
  deal.stage = 'complete';
  deal.updatedAt = date;
  deal.nextActionDate = null;
  world.loanMarket.history.push({
    id: `loan-history-${deal.id}`,
    loanId: deal.id,
    playerId: player.id,
    parentClubCode: deal.parentClubCode,
    borrowerClubCode: deal.borrowerClubCode,
    startDate: deal.terms.startDate,
    endDate: date,
    outcome: deal.status,
    terms: { ...deal.terms }
  });
  appendWorldEvent(world, {
    date,
    type: reason === 'recalled' ? 'LOAN_RECALLED' : 'LOAN_ENDED',
    entities: { playerId: player.id, parentClubCode: deal.parentClubCode, borrowerClubCode: deal.borrowerClubCode, loanId: deal.id },
    payload: { reason, scheduledEndDate: deal.terms.endDate }
  });
  return true;
}

function convertLoanToPermanent({ career, date, deal, player }) {
  const world = career.world;
  const borrower = world.clubs[deal.borrowerClubCode];
  const parent = world.clubs[deal.parentClubCode];
  const fee = Number(deal.terms.optionFee) || 0;
  if (!borrower || !parent || !fee || Number(borrower.transferBudget) < fee) return false;
  borrower.transferBudget = Math.max(0, Number(borrower.transferBudget) - fee);
  borrower.transferSpent = (Number(borrower.transferSpent) || 0) + fee;
  parent.transferIncome = (Number(parent.transferIncome) || 0) + fee;
  parent.transferBudget = (Number(parent.transferBudget) || 0) + Math.round(fee * .72);
  setPlayerEmployment(world, player.id, borrower.code);
  const currentContract = effectivePlayerContract(world, player);
  const weeklyWage = wageExpectation({ player, contract: currentContract, buyerClub: borrower });
  const years = Number(player.age) >= 31 ? 2 : Number(player.age) <= 22 ? 5 : 4;
  world.contracts[player.id] = {
    playerId: player.id,
    clubCode: borrower.code,
    startDate: date,
    endDate: `${Number(date.slice(0, 4)) + years}-06-30`,
    weeklyWage,
    status: 'active'
  };
  const status = ensurePlayerStatus(world, player);
  Object.assign(status, {
    onLoan: false,
    loanParentClubCode: null,
    loanClubCode: null,
    loanEndDate: null,
    loanPromisedPlayingTime: null,
    lastMoveAt: date,
    joinedAt: date,
    transferListed: false,
    loanListed: false,
    contractDisposition: 'retain'
  });
  deal.status = 'converted';
  deal.stage = 'complete';
  deal.updatedAt = date;
  deal.nextActionDate = null;
  world.loanMarket.history.push({
    id: `loan-history-${deal.id}`,
    loanId: deal.id,
    playerId: player.id,
    parentClubCode: parent.code,
    borrowerClubCode: borrower.code,
    startDate: deal.terms.startDate,
    endDate: date,
    outcome: 'converted',
    fee,
    terms: { ...deal.terms }
  });
  world.transferMarket ||= {};
  world.transferMarket.history ||= [];
  world.transferMarket.history.push({
    id: `loan-conversion-${deal.id}`,
    date,
    playerId: player.id,
    fromClubCode: parent.code,
    toClubCode: borrower.code,
    fee,
    weeklyWage,
    loanConversion: true
  });
  appendWorldEvent(world, {
    date,
    type: 'LOAN_OPTION_EXERCISED',
    entities: { playerId: player.id, fromClubCode: parent.code, toClubCode: borrower.code, loanId: deal.id },
    payload: { fee, obligation: Boolean(deal.terms.obligationToBuy), weeklyWage, contractEnd: world.contracts[player.id].endDate }
  });
  return true;
}

function resolveActiveLoan({ career, date, deal, playerById, squadAnalyses }) {
  if (deal.status !== 'active') return false;
  const world = career.world;
  const player = playerById.get(deal.playerId);
  if (!player) return false;
  const parentAnalysis = squadAnalyses?.[deal.parentClubCode];
  const matchingParentNeed = requirementRows(parentAnalysis).find(need => needFitsPlayer(need, player) && Number(need.priority) >= .78);
  const eligibleRecall = deal.terms.recallClause
    && deal.parentClubCode !== career.clubCode
    && daysBetween(deal.terms.startDate, date) >= 90
    && Boolean(matchingParentNeed)
    && date < deal.terms.endDate;
  if (eligibleRecall) {
    const probability = clamp(.08 + Number(matchingParentNeed.priority) * .20, .08, .30);
    if (randomUnit(world.seed, date, deal.id, 'recall-decision') < probability) return returnLoan({ career, date, deal, player, reason: 'recalled' });
  }
  if (date < deal.terms.endDate) return false;

  const borrower = world.clubs[deal.borrowerClubCode];
  const borrowerNeed = requirementRows(squadAnalyses?.[deal.borrowerClubCode]).find(need => needFitsPlayer(need, player));
  const canBuy = deal.terms.optionToBuy && borrower && Number(borrower.transferBudget) >= Number(deal.terms.optionFee || 0);
  if (canBuy) {
    const obligation = Boolean(deal.terms.obligationToBuy);
    const fit = Number(borrowerNeed?.priority) || Number(deal.needSnapshot.priority) || .35;
    const probability = clamp(.14 + fit * .33 + Math.max(0, 25 - Number(player.age || 24)) * .01, .12, .62);
    if (obligation || randomUnit(world.seed, date, deal.id, 'exercise-option') < probability) {
      if (convertLoanToPermanent({ career, date, deal, player })) return true;
    }
  }
  return returnLoan({ career, date, deal, player, reason: 'loan-complete' });
}

function aiLoanListCandidates({ career, date, playerById }) {
  const world = career.world;
  if (String(date).slice(-2) !== '01' && String(date).slice(-2) !== '15') return 0;
  let listed = 0;
  for (const [clubCode, club] of Object.entries(world.clubs || {})) {
    if (clubCode === career.clubCode) continue;
    const loanUsage = Number(club.brain?.recruitment?.loanUsage) || .5;
    if (loanUsage < .38) continue;
    const players = playerIdsForClubState(world, clubCode).map(id => playerById.get(id)).filter(Boolean);
    const candidates = players
      .filter(player => {
        const status = effectivePlayerStatus(world, player);
        const contract = effectivePlayerContract(world, player);
        const age = Number(player.age) || 24;
        const growth = Math.max(0, Number(player.potential || player.rating) - Number(player.rating || 0));
        if (status.onLoan || status.loanListed || status.transferListed) return false;
        if (!contract.endDate || daysBetween(date, contract.endDate) < 500) return false;
        if (!sellerHasDepth(world, clubCode, player, playerById)) return false;
        return (age <= 23 && growth >= 2 && ['prospect', 'fringe', 'rotation'].includes(status.squadRole))
          || (status.squadRole === 'fringe' && age <= 26);
      })
      .sort((left, right) => Number(left.rating) - Number(right.rating) || Number(left.age) - Number(right.age));
    const candidate = deterministicChoice(candidates.slice(0, 6), world.seed, date, clubCode, 'loan-list-choice');
    if (!candidate) continue;
    const probability = clamp(.06 + loanUsage * .16, .07, .23);
    if (randomUnit(world.seed, date, clubCode, candidate.id, 'ai-loan-list') >= probability) continue;
    const status = ensurePlayerStatus(world, candidate);
    status.loanListed = true;
    status.loanListReason = Number(candidate.age) <= 23 ? 'development-pathway' : 'squad-minutes';
    appendWorldEvent(world, {
      date,
      type: 'PLAYER_LOAN_LISTED',
      entities: { playerId: candidate.id, clubCode },
      payload: { ai: true, reason: status.loanListReason }
    });
    listed += 1;
  }
  return listed;
}

function seedAiLoanProposals({ career, date, playerById, squadAnalyses }) {
  const world = career.world;
  const window = transferWindowState(date);
  if (!window.open) return 0;
  const market = ensureLoanMarket(world);
  const borrowerRows = Object.entries(squadAnalyses || {})
    .filter(([clubCode]) => clubCode !== career.clubCode)
    .flatMap(([borrowerCode, analysis]) => requirementRows(analysis)
      .filter(need => needAcceptsLoan(need) && Number(need.priority) >= .22)
      .map(need => ({ borrowerCode, need })))
    .sort((left, right) => Number(right.need.priority) - Number(left.need.priority) || left.borrowerCode.localeCompare(right.borrowerCode));
  const cap = Math.min(10, Math.max(1, Math.ceil(Object.keys(world.clubs || {}).length / 90)));
  let opened = 0;
  for (const { borrowerCode, need } of borrowerRows) {
    if (opened >= cap) break;
    const borrower = world.clubs[borrowerCode];
    if (!borrower) continue;
    const candidateRows = [];
    for (const [playerId, parentCode] of Object.entries(world.ownership || {})) {
      if (!parentCode || parentCode === borrowerCode) continue;
      if (world.employment[playerId] !== parentCode) continue;
      const player = playerById.get(playerId);
      if (!player) continue;
      const parent = world.clubs[parentCode];
      if (!parent) continue;
      const status = effectivePlayerStatus(world, player);
      if (!status.loanListed && parentCode === career.clubCode) continue;
      const contract = effectivePlayerContract(world, player);
      const scored = loanCandidateScore({ world, date, player, parent, borrower, need, status, contract });
      if (!scored || !sellerHasDepth(world, parentCode, player, playerById)) continue;
      const cooldown = market.cooldowns[`${parentCode}:${player.id}:${borrowerCode}`];
      if (cooldown && cooldown > date) continue;
      candidateRows.push({ player, parentCode, score: scored.score });
    }
    candidateRows.sort((left, right) => right.score - left.score || Number(right.player.rating) - Number(left.player.rating));
    const finalists = candidateRows.slice(0, 4);
    const chosen = deterministicChoice(finalists, world.seed, date, borrowerCode, need.position || need.group, 'loan-target');
    if (!chosen) continue;
    const probability = clamp(.04 + Number(need.priority) * .17 + Number(borrower.brain?.recruitment?.loanUsage || .5) * .05, .04, .25);
    if (randomUnit(world.seed, date, borrowerCode, chosen.player.id, 'loan-proposal') >= probability) continue;
    if (proposeLoanDeal({ career, date, player: chosen.player, parentCode: chosen.parentCode, borrowerCode, need, playerById })) opened += 1;
  }
  return opened;
}

export function respondToLoanOffer({ career, loanId, decision, date = career.currentDate, playerById }) {
  const world = career.world;
  ensureLoanMarket(world);
  const deal = world.loanMarket.deals[loanId];
  if (!deal || deal.parentClubCode !== career.clubCode || deal.status !== 'awaiting-user') return null;
  const player = playerById.get(deal.playerId);
  if (!player) return null;
  if (decision === 'reject') {
    rejectLoan(world, deal, date, 'user-rejected');
    return deal;
  }
  if (decision !== 'accept') return null;
  deal.userDecision = 'accept';
  deal.stage = 'proposal';
  deal.status = 'open';
  deal.updatedAt = date;
  deal.nextActionDate = date;
  progressPendingDeal({ career, date, deal, playerById });
  return deal;
}

export function processLoanMarketDay({ career, date, playerById, squadAnalyses }) {
  const world = career.world;
  ensureLoanMarket(world);
  const summary = { listed: 0, opened: 0, progressed: 0, activated: 0, returned: 0, recalled: 0, converted: 0 };
  const beforeActive = Object.values(world.loanMarket.deals).filter(row => row.status === 'active').length;
  for (const deal of Object.values(world.loanMarket.deals)) {
    const before = deal.status;
    if (deal.status === 'active') resolveActiveLoan({ career, date, deal, playerById, squadAnalyses });
    else progressPendingDeal({ career, date, deal, playerById });
    if (deal.status !== before) summary.progressed += 1;
    if (before !== 'active' && deal.status === 'active') summary.activated += 1;
    if (before === 'active' && deal.status === 'returned') summary.returned += 1;
    if (before === 'active' && deal.status === 'recalled') summary.recalled += 1;
    if (before === 'active' && deal.status === 'converted') summary.converted += 1;
  }
  summary.listed = aiLoanListCandidates({ career, date, playerById });
  summary.opened = seedAiLoanProposals({ career, date, playerById, squadAnalyses });
  summary.active = Object.values(world.loanMarket.deals).filter(row => row.status === 'active').length;
  summary.activeBefore = beforeActive;
  return summary;
}

export function loanMarketSnapshot(career) {
  const market = ensureLoanMarket(career.world);
  return {
    deals: Object.values(market.deals),
    history: [...market.history]
  };
}

import { appendWorldEvent } from '../world-events.js';
import { addWorldDays, daysBetween } from '../world-time.js';
import { randomUnit } from '../deterministic-rng.js';
import { createPlayerBrain } from '../transfers/player-brain.js';
import { wageExpectation } from '../transfers/valuation-engine.js';
import { effectivePlayerContract, effectivePlayerStatus, ensurePlayerStatus, ownerClubForPlayerState } from '../world-employment-index.js';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const PROMISE_TERMINAL = new Set(['fulfilled', 'broken', 'cancelled']);

function ensureRelations(world) {
  world.playerRelations ||= {};
  world.playerRelations.promises ||= {};
  world.playerRelations.concerns ||= {};
  world.playerRelations.sequence = Number(world.playerRelations.sequence) || 0;
  return world.playerRelations;
}

function isWeeklyReview(date) {
  return new Date(`${date}T00:00:00Z`).getUTCDay() === 1;
}

function expectedStartShare(expectation) {
  return {
    'star-player': .78,
    'important-player': .62,
    'regular-starter': .66,
    'squad-player': .34,
    'prospect': .16,
    'prospect-or-depth': .16
  }[expectation] || .34;
}

function recentClubMatches(career, clubCode, date, days = 35) {
  return Object.values(career.results || {}).filter(result => {
    if (!result?.date || result.date >= date || daysBetween(result.date, date) > days) return false;
    return result.home === clubCode || result.away === clubCode;
  });
}

function playingTimeSnapshot(career, clubCode, playerId, date) {
  const matches = recentClubMatches(career, clubCode, date);
  let starts = 0;
  let lastStartDate = null;
  for (const result of matches) {
    const side = result.home === clubCode ? 'home' : 'away';
    if (!result.lineups?.[side]?.includes(playerId)) continue;
    starts += 1;
    if (!lastStartDate || result.date > lastStartDate) lastStartDate = result.date;
  }
  return {
    matches: matches.length,
    starts,
    share: matches.length ? starts / matches.length : null,
    lastStartDate
  };
}

function externalInterestCount(world, playerId) {
  const rumors = (world.transferMarket?.rumors || []).filter(row => row.playerId === playerId && row.status === 'active').length;
  const formal = Object.values(world.transferMarket?.negotiations || {}).filter(row => row.playerId === playerId && !['completed', 'rejected', 'withdrawn', 'expired'].includes(row.status)).length;
  return rumors + formal;
}

function concernKey(playerId, type) {
  return `${playerId}:${type}`;
}

function emitConcern({ career, date, player, clubCode, type, severity, payload = {}, userVisible = false }) {
  const world = career.world;
  const relations = ensureRelations(world);
  const key = concernKey(player.id, type);
  const previous = relations.concerns[key];
  if (previous && previous.active && daysBetween(previous.updatedAt || previous.createdAt, date) < 21 && Math.abs(Number(previous.severity) - severity) < .12) return false;
  relations.concerns[key] = {
    playerId: player.id,
    clubCode,
    type,
    severity: +severity.toFixed(3),
    active: true,
    createdAt: previous?.createdAt || date,
    updatedAt: date,
    payload: { ...payload }
  };
  appendWorldEvent(world, {
    date,
    type: 'PLAYER_CONCERN_RAISED',
    entities: { playerId: player.id, clubCode },
    payload: { concernType: type, severity, ...payload }
  });
  if (userVisible && clubCode === career.clubCode) {
    career.inbox ||= [];
    const subjects = {
      'playing-time': `${player.name} quer mais minutos`,
      'contract': `${player.name} quer discutir o contrato`,
      'transfer-treatment': `${player.name} está insatisfeito com sua situação`,
      'loan-playing-time': `${player.name} está preocupado com o empréstimo`
    };
    career.inbox.unshift({
      id: `player-concern-${player.id}-${type}-${date}`,
      date,
      sender: player.name,
      subject: subjects[type] || `${player.name} quer conversar`,
      body: type === 'playing-time'
        ? `${player.name} entende que seu papel no elenco deveria render mais minutos e quer clareza sobre os próximos jogos.`
        : type === 'contract'
          ? `${player.name} e seu agente acreditam que a situação contratual não reflete mais seu papel no elenco.`
          : type === 'loan-playing-time'
            ? `${player.name} não está recebendo os minutos esperados no empréstimo e quer que o clube acompanhe a situação.`
            : `${player.name} não está satisfeito com a forma como sua situação no mercado está sendo conduzida.`,
      read: false
    });
  }
  return true;
}

function resolveConcern(world, date, playerId, type, reason) {
  const relations = ensureRelations(world);
  const row = relations.concerns[concernKey(playerId, type)];
  if (!row?.active) return false;
  row.active = false;
  row.resolvedAt = date;
  row.resolution = reason;
  appendWorldEvent(world, {
    date,
    type: 'PLAYER_CONCERN_RESOLVED',
    entities: { playerId, clubCode: row.clubCode },
    payload: { concernType: type, reason }
  });
  return true;
}

function promiseTarget(type) {
  if (type === 'playing-time') return { reviewDays: 35, requiredShare: .55 };
  if (type === 'loan-playing-time') return { reviewDays: 35, requiredShare: .50 };
  if (type === 'new-contract') return { reviewDays: 45 };
  if (type === 'loan-move') return { reviewDays: 45 };
  if (type === 'not-sell') return { reviewDays: 60 };
  return { reviewDays: 35 };
}

export function makePlayerPromise(career, playerId, type, options = {}) {
  const world = career.world;
  const relations = ensureRelations(world);
  const player = options.playerById?.get(playerId);
  if (!player || ownerClubForPlayerState(world, playerId) !== career.clubCode) return null;
  const existing = Object.values(relations.promises).find(row => row.playerId === playerId && row.type === type && !PROMISE_TERMINAL.has(row.status));
  if (existing) return existing;
  const target = promiseTarget(type);
  const id = `promise-${career.currentDate}-${playerId}-${++relations.sequence}`;
  const promise = {
    id,
    playerId,
    clubCode: career.clubCode,
    type,
    status: 'tracking',
    createdAt: career.currentDate,
    dueDate: options.dueDate || addWorldDays(career.currentDate, target.reviewDays),
    requiredShare: options.requiredShare ?? target.requiredShare ?? null,
    payload: { ...options.payload }
  };
  relations.promises[id] = promise;
  appendWorldEvent(world, {
    date: career.currentDate,
    type: 'PLAYER_PROMISE_MADE',
    entities: { playerId, clubCode: career.clubCode, promiseId: id },
    payload: { promiseType: type, dueDate: promise.dueDate, requiredShare: promise.requiredShare }
  });
  return promise;
}

function evaluatePromise({ career, date, promise, playerById }) {
  if (PROMISE_TERMINAL.has(promise.status) || promise.dueDate > date) return null;
  const world = career.world;
  const player = playerById.get(promise.playerId);
  if (!player) return null;
  let fulfilled = false;
  let evidence = {};
  if (promise.type === 'playing-time') {
    const playing = playingTimeSnapshot(career, world.employment[player.id] || promise.clubCode, player.id, date);
    fulfilled = playing.matches === 0 ? true : playing.share >= Number(promise.requiredShare || .55);
    evidence = playing;
  } else if (promise.type === 'loan-playing-time') {
    const status = effectivePlayerStatus(world, player);
    const playing = status.onLoan ? playingTimeSnapshot(career, status.loanClubCode, player.id, date) : { matches: 0, starts: 0, share: 0 };
    fulfilled = status.onLoan && (playing.matches === 0 || playing.share >= Number(promise.requiredShare || .5));
    evidence = { onLoan: Boolean(status.onLoan), ...playing };
  } else if (promise.type === 'new-contract') {
    fulfilled = Boolean(world.contracts[player.id]?.lastRenewedAt && world.contracts[player.id].lastRenewedAt >= promise.createdAt);
  } else if (promise.type === 'loan-move') {
    fulfilled = Boolean(effectivePlayerStatus(world, player).onLoan);
  } else if (promise.type === 'not-sell') {
    fulfilled = ownerClubForPlayerState(world, player.id) === promise.clubCode;
  }
  promise.status = fulfilled ? 'fulfilled' : 'broken';
  promise.resolvedAt = date;
  promise.evidence = evidence;
  const status = ensurePlayerStatus(world, player);
  status.happiness = clamp((Number(status.happiness) || 70) + (fulfilled ? 8 : -14), 10, 100);
  appendWorldEvent(world, {
    date,
    type: fulfilled ? 'PLAYER_PROMISE_FULFILLED' : 'PLAYER_PROMISE_BROKEN',
    entities: { playerId: player.id, clubCode: promise.clubCode, promiseId: promise.id },
    payload: { promiseType: promise.type, evidence }
  });
  if (!fulfilled && promise.clubCode === career.clubCode) {
    career.inbox ||= [];
    career.inbox.unshift({
      id: `promise-broken-${promise.id}`,
      date,
      sender: player.name,
      subject: `Promessa não cumprida com ${player.name}`,
      body: `${player.name} considera que a promessa sobre ${promise.type} não foi cumprida. Isso afetou sua confiança na comissão técnica.`,
      read: false
    });
  }
  return promise.status;
}

function happinessDelta({ career, date, player, clubCode, status, contract }) {
  const brain = createPlayerBrain(player);
  const playing = playingTimeSnapshot(career, clubCode, player.id, date);
  const expectation = status.onLoan ? status.loanPromisedPlayingTime : status.playingTimeExpectation;
  const expectedShare = expectedStartShare(expectation);
  const playingGap = playing.share == null ? 0 : playing.share - expectedShare;
  const playingDelta = clamp(playingGap * (8 + brain.playingTimeNeed * 8), -8, 5);
  const expectedWage = wageExpectation({ player, contract, buyerClub: career.world.clubs[ownerClubForPlayerState(career.world, player.id)] || {} });
  const actualWage = Math.max(1_000, Number(contract.weeklyWage) || Number(player.wage) || 8_000);
  const wageGap = clamp(actualWage / Math.max(1, expectedWage), .35, 1.4);
  const contractDelta = wageGap < .70 ? -(1 - wageGap) * 5 * brain.financialDrive : wageGap >= 1 ? .3 : 0;
  const external = externalInterestCount(career.world, player.id);
  const marketDelta = status.transferListed && status.saleDisposition?.type === 'actively-for-sale'
    ? brain.loyalty > .70 ? -1.5 : .5
    : external > 0 && brain.ambition > .65 ? .5 : 0;
  const loanDelta = status.onLoan && playing.share != null && playing.share < expectedShare - .20 ? -2.5 : status.onLoan && playing.share != null && playing.share >= expectedShare ? 1 : 0;
  const stability = (brain.stability - .5) * .35;
  const variation = (randomUnit(career.world.seed, date, player.id, 'weekly-happiness') - .5) * .55;
  return {
    total: clamp(playingDelta + contractDelta + marketDelta + loanDelta + stability + variation, -9, 6),
    playing,
    expectedShare,
    components: { playingDelta, contractDelta, marketDelta, loanDelta, stability, variation }
  };
}

function processPlayerLife({ career, date, player, playerById }) {
  const world = career.world;
  const clubCode = world.employment[player.id];
  if (!clubCode) return { changed: false, concerns: 0 };
  const status = ensurePlayerStatus(world, player);
  const contract = effectivePlayerContract(world, player);
  const before = Number(status.happiness) || 70;
  const delta = happinessDelta({ career, date, player, clubCode, status, contract });
  status.happiness = Math.round(clamp(before + delta.total, 10, 100));
  status.happinessUpdatedAt = date;
  status.happinessTrend = +delta.total.toFixed(2);
  status.playingTimeForm = {
    matches: delta.playing.matches,
    starts: delta.playing.starts,
    startShare: delta.playing.share == null ? null : +delta.playing.share.toFixed(3),
    expectedShare: +delta.expectedShare.toFixed(3),
    reviewedAt: date
  };
  let concerns = 0;

  if (delta.playing.matches >= 3 && delta.playing.share < delta.expectedShare - .22 && createPlayerBrain(player).playingTimeNeed > .48) {
    if (emitConcern({ career, date, player, clubCode: ownerClubForPlayerState(world, player.id) || clubCode, type: status.onLoan ? 'loan-playing-time' : 'playing-time', severity: clamp(delta.expectedShare - delta.playing.share, .20, .92), payload: { ...status.playingTimeForm }, userVisible: !status.onLoan || ownerClubForPlayerState(world, player.id) === career.clubCode })) concerns += 1;
  } else {
    resolveConcern(world, date, player.id, status.onLoan ? 'loan-playing-time' : 'playing-time', 'minutes-improved');
  }

  const expectedWage = wageExpectation({ player, contract, buyerClub: world.clubs[ownerClubForPlayerState(world, player.id)] || {} });
  const wageRatio = Math.max(1_000, Number(contract.weeklyWage) || Number(player.wage) || 8_000) / Math.max(1, expectedWage);
  if (wageRatio < .68 && ['key', 'important'].includes(status.squadRole) && createPlayerBrain(player).financialDrive > .48) {
    if (emitConcern({ career, date, player, clubCode: ownerClubForPlayerState(world, player.id) || clubCode, type: 'contract', severity: clamp(.68 - wageRatio + .35, .25, .9), payload: { wageRatio: +wageRatio.toFixed(3) }, userVisible: ownerClubForPlayerState(world, player.id) === career.clubCode })) concerns += 1;
  } else if (wageRatio >= .78) {
    resolveConcern(world, date, player.id, 'contract', 'terms-acceptable');
  }

  if (status.happiness <= 36 && !status.onLoan) {
    status.transferRequest = true;
    if (emitConcern({ career, date, player, clubCode: ownerClubForPlayerState(world, player.id) || clubCode, type: 'transfer-treatment', severity: clamp((50 - status.happiness) / 30, .35, .95), payload: { happiness: status.happiness, transferRequest: true }, userVisible: ownerClubForPlayerState(world, player.id) === career.clubCode })) concerns += 1;
  } else if (status.happiness >= 58 && status.transferRequest) {
    status.transferRequest = false;
    resolveConcern(world, date, player.id, 'transfer-treatment', 'happiness-recovered');
  }
  return { changed: status.happiness !== before, concerns };
}

export function processPlayerLifeDay({ career, date, playerById }) {
  const world = career.world;
  const relations = ensureRelations(world);
  let promisesResolved = 0;
  for (const promise of Object.values(relations.promises)) {
    if (evaluatePromise({ career, date, promise, playerById })) promisesResolved += 1;
  }
  if (!isWeeklyReview(date)) return { reviewed: 0, happinessChanged: 0, concernsRaised: 0, promisesResolved };
  let reviewed = 0;
  let happinessChanged = 0;
  let concernsRaised = 0;
  for (const playerId of Object.keys(world.employment || {})) {
    const player = playerById.get(playerId);
    if (!player) continue;
    const result = processPlayerLife({ career, date, player, playerById });
    reviewed += 1;
    if (result.changed) happinessChanged += 1;
    concernsRaised += result.concerns;
  }
  return { reviewed, happinessChanged, concernsRaised, promisesResolved };
}

export function playerRelationsSnapshot(career, playerId = null) {
  const relations = ensureRelations(career.world);
  const promises = Object.values(relations.promises).filter(row => !playerId || row.playerId === playerId);
  const concerns = Object.values(relations.concerns).filter(row => !playerId || row.playerId === playerId);
  return { promises, concerns };
}

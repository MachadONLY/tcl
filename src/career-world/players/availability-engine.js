import { appendWorldEvent } from '../world-events.js';
import { addWorldDays } from '../world-time.js';
import { randomInt, randomUnit } from '../deterministic-rng.js';
import { ensurePlayerStatus, playerIdsForClubState } from '../world-employment-index.js';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function ensureHealth(world) {
  world.health ||= {};
  world.health.processedFixtures ||= {};
  world.health.lastRecoveryDate ||= null;
  return world.health;
}

const INJURY_PROFILES = Object.freeze([
  { type: 'knock', min: 3, max: 8, weight: 38 },
  { type: 'muscle-strain', min: 10, max: 24, weight: 27 },
  { type: 'hamstring', min: 18, max: 42, weight: 16 },
  { type: 'ankle-sprain', min: 18, max: 50, weight: 12 },
  { type: 'knee-injury', min: 60, max: 180, weight: 5 },
  { type: 'serious-knee-injury', min: 150, max: 300, weight: 2 }
]);

function weightedInjury(world, fixtureId, playerId) {
  const total = INJURY_PROFILES.reduce((sum, row) => sum + row.weight, 0);
  let roll = randomUnit(world.seed, fixtureId, playerId, 'injury-type') * total;
  for (const row of INJURY_PROFILES) {
    roll -= row.weight;
    if (roll <= 0) return row;
  }
  return INJURY_PROFILES[0];
}

export function playerUnavailable(status = {}, date = null) {
  if (Number(status.suspensionMatchesRemaining) > 0) return true;
  if (status.unavailableUntil && date && status.unavailableUntil >= date) return true;
  return false;
}

export function registerPlayerInjury({ career, date, player, durationDays, type = 'injury', sourceFixtureId = null, severity = null }) {
  const world = career.world;
  const status = ensurePlayerStatus(world, player);
  const days = Math.max(1, Math.round(Number(durationDays) || 1));
  const until = addWorldDays(date, days);
  const previousUntil = status.unavailableUntil || null;
  if (previousUntil && previousUntil > until) return status.injury;
  status.unavailableUntil = until;
  status.injury = {
    type,
    severity: severity || (days >= 120 ? 'major' : days >= 35 ? 'significant' : days >= 10 ? 'moderate' : 'minor'),
    startDate: date,
    endDate: until,
    durationDays: days,
    sourceFixtureId
  };
  status.worldCondition = clamp((Number(status.worldCondition) || 94) - Math.min(18, days / 5), 45, 100);
  appendWorldEvent(world, {
    date,
    type: 'PLAYER_INJURED',
    entities: { playerId: player.id, clubCode: world.employment[player.id] || null, ownerClubCode: world.ownership?.[player.id] || null, fixtureId: sourceFixtureId },
    payload: { injuryType: type, severity: status.injury.severity, durationDays: days, unavailableUntil: until }
  });
  if ((world.ownership?.[player.id] || world.employment[player.id]) === career.clubCode) {
    career.inbox ||= [];
    career.inbox.unshift({
      id: `injury-${player.id}-${date}-${sourceFixtureId || 'training'}`,
      date,
      sender: 'Departamento médico',
      subject: `${player.name} está lesionado`,
      body: `${player.name} sofreu ${type} e ficará indisponível por aproximadamente ${days} dias, com retorno estimado para ${until}.`,
      read: false
    });
  }
  return status.injury;
}

export function registerPlayerSuspension({ career, date, player, matches = 1, reason = 'red-card', sourceFixtureId = null }) {
  const world = career.world;
  const status = ensurePlayerStatus(world, player);
  status.suspensionMatchesRemaining = Math.max(Number(status.suspensionMatchesRemaining) || 0, Math.max(1, Number(matches) || 1));
  status.suspensionReason = reason;
  status.suspensionStartedAt = date;
  appendWorldEvent(world, {
    date,
    type: 'PLAYER_SUSPENDED',
    entities: { playerId: player.id, clubCode: world.employment[player.id] || null, fixtureId: sourceFixtureId },
    payload: { matches: status.suspensionMatchesRemaining, reason }
  });
  return status.suspensionMatchesRemaining;
}

function recoverDaily({ career, date, playerById }) {
  const world = career.world;
  const health = ensureHealth(world);
  if (health.lastRecoveryDate === date) return 0;
  let returned = 0;
  for (const playerId of Object.keys(world.employment || {})) {
    const player = playerById.get(playerId);
    if (!player) continue;
    const status = ensurePlayerStatus(world, player);
    status.worldCondition = clamp((Number(status.worldCondition) || 94) + (status.injury ? 2.2 : 5.2), 35, 100);
    status.worldSharpness = clamp((Number(status.worldSharpness) || 70) + (status.injury ? -.2 : .5), 20, 100);
    if (status.injury && status.unavailableUntil && status.unavailableUntil < date) {
      const injury = status.injury;
      status.injury = null;
      status.unavailableUntil = null;
      status.worldCondition = Math.max(76, Number(status.worldCondition) || 76);
      appendWorldEvent(world, {
        date,
        type: 'PLAYER_RETURNED_FROM_INJURY',
        entities: { playerId, clubCode: world.employment[playerId] || null },
        payload: { injuryType: injury.type, absenceDays: injury.durationDays }
      });
      returned += 1;
    }
  }
  health.lastRecoveryDate = date;
  return returned;
}

function resultSide(result, clubCode) {
  return result.home === clubCode ? 'home' : result.away === clubCode ? 'away' : null;
}

function applyMatchFatigue({ career, result, side, player, load }) {
  const world = career.world;
  const status = ensurePlayerStatus(world, player);
  const age = Number(player.age) || 24;
  const ageFactor = age >= 31 ? 1.15 : age <= 21 ? .92 : 1;
  const drain = clamp(7 + Number(load || 60) / 14, 8, 15) * ageFactor;
  status.worldCondition = clamp((Number(status.worldCondition) || 94) - drain, 35, 100);
  status.worldSharpness = clamp((Number(status.worldSharpness) || 70) + 3.4, 20, 100);
  const scored = (result.events || []).some(event => event.type === 'goal' && event.playerId === player.id);
  const clubWon = side === 'home' ? result.homeGoals > result.awayGoals : result.awayGoals > result.homeGoals;
  const clubLost = side === 'home' ? result.homeGoals < result.awayGoals : result.awayGoals < result.homeGoals;
  const formBase = Number(status.worldForm) || 65;
  status.worldForm = clamp(formBase + (clubWon ? 2.2 : clubLost ? -1.5 : .3) + (scored ? 3.2 : 0), 25, 100);
  status.lastAppearanceDate = result.date;
  status.appearances = (Number(status.appearances) || 0) + 1;
  if (scored) status.goals = (Number(status.goals) || 0) + 1;
}

function decrementSuspensionsForClub(world, clubCode, lineupIds, playerById, date, fixtureId) {
  let completed = 0;
  for (const playerId of playerIdsForClubState(world, clubCode)) {
    if (lineupIds.includes(playerId)) continue;
    const player = playerById.get(playerId);
    if (!player) continue;
    const status = ensurePlayerStatus(world, player);
    if (Number(status.suspensionMatchesRemaining) <= 0) continue;
    status.suspensionMatchesRemaining -= 1;
    if (status.suspensionMatchesRemaining <= 0) {
      status.suspensionMatchesRemaining = 0;
      appendWorldEvent(world, {
        date,
        type: 'PLAYER_SUSPENSION_SERVED',
        entities: { playerId, clubCode, fixtureId },
        payload: { reason: status.suspensionReason || 'discipline' },
        visibility: 'system'
      });
      status.suspensionReason = null;
      completed += 1;
    }
  }
  return completed;
}

function addDisciplineEvents({ career, result, side, clubCode, players, playerById }) {
  const world = career.world;
  const tactical = result.tactical?.[side] || {};
  const intensity = Number(tactical.load || tactical.metrics?.intensity) || 60;
  const yellowCount = clamp(Math.round(1 + randomUnit(world.seed, result.fixtureId, clubCode, 'yellow-count') * (1.8 + intensity / 80)), 0, 4);
  const eligible = players.filter(player => player.group !== 'GK');
  const booked = new Set();
  for (let index = 0; index < yellowCount && eligible.length; index += 1) {
    const ordered = [...eligible].sort((left, right) => randomUnit(world.seed, result.fixtureId, clubCode, right.id, index, 'yellow-player') - randomUnit(world.seed, result.fixtureId, clubCode, left.id, index, 'yellow-player'));
    const player = ordered.find(candidate => !booked.has(candidate.id));
    if (!player) break;
    booked.add(player.id);
    const minute = 12 + randomInt(0, 76, world.seed, result.fixtureId, player.id, 'yellow-minute');
    result.events ||= [];
    result.events.push({ type: 'yellow-card', minute, side, playerId: player.id, playerName: player.name });
    const status = ensurePlayerStatus(world, player);
    status.yellowCards = (Number(status.yellowCards) || 0) + 1;
    if (status.yellowCards > 0 && status.yellowCards % 5 === 0) registerPlayerSuspension({ career, date: result.date, player, matches: 1, reason: 'yellow-card-accumulation', sourceFixtureId: result.fixtureId });
  }
  const redProbability = clamp(.012 + intensity * .00025, .015, .038);
  if (eligible.length && randomUnit(world.seed, result.fixtureId, clubCode, 'red-card') < redProbability) {
    const player = eligible[randomInt(0, eligible.length - 1, world.seed, result.fixtureId, clubCode, 'red-player')];
    const minute = 18 + randomInt(0, 68, world.seed, result.fixtureId, player.id, 'red-minute');
    result.events ||= [];
    result.events.push({ type: 'red-card', minute, side, playerId: player.id, playerName: player.name });
    const status = ensurePlayerStatus(world, player);
    status.redCards = (Number(status.redCards) || 0) + 1;
    registerPlayerSuspension({ career, date: result.date, player, matches: randomInt(1, 3, world.seed, result.fixtureId, player.id, 'red-ban'), reason: 'red-card', sourceFixtureId: result.fixtureId });
  }
  result.events?.sort((left, right) => Number(left.minute || 0) - Number(right.minute || 0));
}

function maybeInjureFromMatch({ career, result, side, player, load }) {
  const world = career.world;
  const status = ensurePlayerStatus(world, player);
  if (status.injury || status.unavailableUntil) return false;
  const condition = Number(status.worldCondition) || 90;
  const age = Number(player.age) || 24;
  const fatigueRisk = clamp((78 - condition) / 250, 0, .08);
  const ageRisk = age >= 32 ? .008 : age >= 29 ? .004 : 0;
  const intensityRisk = Math.max(0, Number(load || 60) - 65) * .00022;
  const baseRisk = .009 + fatigueRisk + ageRisk + intensityRisk;
  if (randomUnit(world.seed, result.fixtureId, side, player.id, 'match-injury') >= clamp(baseRisk, .006, .09)) return false;
  const profile = weightedInjury(world, result.fixtureId, player.id);
  const duration = randomInt(profile.min, profile.max, world.seed, result.fixtureId, player.id, 'injury-duration');
  registerPlayerInjury({ career, date: result.date, player, durationDays: duration, type: profile.type, sourceFixtureId: result.fixtureId });
  result.events ||= [];
  result.events.push({ type: 'injury', minute: 20 + randomInt(0, 68, world.seed, result.fixtureId, player.id, 'injury-minute'), side, playerId: player.id, playerName: player.name, injuryType: profile.type });
  result.events.sort((left, right) => Number(left.minute || 0) - Number(right.minute || 0));
  return true;
}

function processResult({ career, result, playerById }) {
  const world = career.world;
  const health = ensureHealth(world);
  if (!result?.fixtureId || health.processedFixtures[result.fixtureId]) return { injuries: 0, suspensionsServed: 0 };
  let injuries = 0;
  let suspensionsServed = 0;
  for (const side of ['home', 'away']) {
    const clubCode = side === 'home' ? result.home : result.away;
    if (!clubCode) continue;
    const lineupIds = result.lineups?.[side] || [];
    suspensionsServed += decrementSuspensionsForClub(world, clubCode, lineupIds, playerById, result.date, result.fixtureId);
    const players = lineupIds.map(id => playerById.get(id)).filter(Boolean);
    const load = result.tactical?.[side]?.load || result.tactical?.[side]?.metrics?.intensity || 60;
    for (const player of players) {
      applyMatchFatigue({ career, result, side, player, load });
      if (maybeInjureFromMatch({ career, result, side, player, load })) injuries += 1;
    }
    addDisciplineEvents({ career, result, side, clubCode, players, playerById });
  }
  health.processedFixtures[result.fixtureId] = result.date;
  return { injuries, suspensionsServed };
}

export function processAvailabilityDay({ career, date, playerById }) {
  const returnedFromInjury = recoverDaily({ career, date, playerById });
  let fixturesProcessed = 0;
  let injuries = 0;
  let suspensionsServed = 0;
  for (const result of Object.values(career.results || {})) {
    if (!result?.date || result.date >= date) continue;
    const processed = processResult({ career, result, playerById });
    if (processed.injuries || processed.suspensionsServed || career.world.health.processedFixtures[result.fixtureId]) fixturesProcessed += 1;
    injuries += processed.injuries;
    suspensionsServed += processed.suspensionsServed;
  }
  return { fixturesProcessed, injuries, returnedFromInjury, suspensionsServed };
}

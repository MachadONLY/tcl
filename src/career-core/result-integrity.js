import { PLAYER_BY_ID } from './career-core.js';
import { FIXTURES } from './season-2026-27-live.js';

const FIXTURE_BY_ID = new Map(FIXTURES.map(fixture => [fixture.id, fixture]));

function uniquePlayerIds(ids, clubCode) {
  const seen = new Set();
  const output = [];
  for (const id of Array.isArray(ids) ? ids : []) {
    const player = PLAYER_BY_ID.get(id);
    if (!player || player.clubCode !== clubCode || seen.has(id)) continue;
    seen.add(id);
    output.push(id);
  }
  return output;
}

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : 0;
}

function canonicalGoalEvent(event, fixture, lineups) {
  if (!event || event.type !== 'goal') return null;
  const side = event.side === 'away' ? 'away' : event.side === 'home' ? 'home' : null;
  if (!side) return null;
  const clubCode = fixture[side];
  const scorer = PLAYER_BY_ID.get(event.playerId);
  if (!scorer || scorer.clubCode !== clubCode) return null;

  const isPenalty = event.isPenalty === true || event.penalty === true || event.goalType === 'penalty';
  const assist = !isPenalty ? PLAYER_BY_ID.get(event.assistPlayerId) : null;
  const validAssist = assist && assist.clubCode === clubCode && assist.id !== scorer.id ? assist : null;
  if (!lineups[side].includes(scorer.id)) lineups[side].push(scorer.id);
  if (validAssist && !lineups[side].includes(validAssist.id)) lineups[side].push(validAssist.id);

  return {
    ...event,
    type: 'goal',
    side,
    minute: Math.max(1, Math.min(120, nonNegativeInteger(event.minute) || 1)),
    playerId: scorer.id,
    playerName: scorer.name,
    assistPlayerId: validAssist?.id || null,
    assistName: validAssist?.name || null,
    isPenalty,
    goalType: isPenalty ? 'penalty' : 'open-play'
  };
}

export function canonicalizeResult(result) {
  const fixture = FIXTURE_BY_ID.get(result?.fixtureId);
  if (!fixture) return null;

  const lineups = {
    home: uniquePlayerIds(result?.lineups?.home, fixture.home),
    away: uniquePlayerIds(result?.lineups?.away, fixture.away)
  };
  const events = (Array.isArray(result?.events) ? result.events : [])
    .map(event => canonicalGoalEvent(event, fixture, lineups))
    .filter(Boolean)
    .sort((left, right) => left.minute - right.minute);
  const homeGoals = events.filter(event => event.side === 'home').length;
  const awayGoals = events.filter(event => event.side === 'away').length;

  return {
    ...result,
    fixtureId: fixture.id,
    matchweek: fixture.matchweek,
    date: fixture.date,
    time: fixture.time,
    home: fixture.home,
    away: fixture.away,
    homeGoals,
    awayGoals,
    lineups,
    events
  };
}

export function canonicalResults(career) {
  const output = {};
  for (const result of Object.values(career?.results || {})) {
    const canonical = canonicalizeResult(result);
    if (canonical && !output[canonical.fixtureId]) output[canonical.fixtureId] = canonical;
  }
  return output;
}

export function playerStatsFromResults(careerOrResults) {
  const results = careerOrResults?.results
    ? canonicalResults(careerOrResults)
    : canonicalResults({ results: careerOrResults || {} });
  const stats = {};
  const ensure = id => (stats[id] ||= { appearances: 0, goals: 0, assists: 0, penaltyGoals: 0 });

  for (const result of Object.values(results)) {
    for (const id of new Set([...(result.lineups?.home || []), ...(result.lineups?.away || [])])) {
      ensure(id).appearances += 1;
    }
    for (const event of result.events || []) {
      ensure(event.playerId).goals += 1;
      if (event.isPenalty) ensure(event.playerId).penaltyGoals += 1;
      if (event.assistPlayerId) ensure(event.assistPlayerId).assists += 1;
    }
  }
  return stats;
}

export function reconcileCareerData(career) {
  if (!career || typeof career !== 'object') return career;
  career.results = canonicalResults(career);
  career.playerStats = playerStatsFromResults(career.results);
  return career;
}

export function auditCareerData(career) {
  const results = canonicalResults(career);
  const stats = playerStatsFromResults(results);
  const rows = Object.values(results);
  const goalEvents = rows.flatMap(result => result.events || []);
  const homeGoals = rows.reduce((sum, result) => sum + result.homeGoals, 0);
  const awayGoals = rows.reduce((sum, result) => sum + result.awayGoals, 0);
  const playerGoals = Object.values(stats).reduce((sum, row) => sum + row.goals, 0);
  const assists = Object.values(stats).reduce((sum, row) => sum + row.assists, 0);
  const assistedEvents = goalEvents.filter(event => event.assistPlayerId).length;
  const penaltyGoals = Object.values(stats).reduce((sum, row) => sum + row.penaltyGoals, 0);
  const penaltyEvents = goalEvents.filter(event => event.isPenalty).length;

  return {
    ok:
      rows.length === Object.keys(career?.results || {}).length &&
      homeGoals + awayGoals === goalEvents.length &&
      playerGoals === goalEvents.length &&
      assists === assistedEvents &&
      penaltyGoals === penaltyEvents,
    results: rows.length,
    goals: goalEvents.length,
    assists,
    penaltyGoals,
    playerStats: stats
  };
}

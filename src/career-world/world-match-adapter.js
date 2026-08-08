import {
  analyzeTactics,
  defaultTactics,
  normalizeTactics,
  seededRandom
} from '../career-core/career-core.js';
import { WORLD_PLAYER_BY_ID, WORLD_TEAM_ELO } from './world-player-database.js';
import { squadForWorld } from './world-selectors.js';
import { aiTacticalPlan, selectAiLineup } from './clubs/ai-team-management.js';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const USER_FALLBACK_SHAPE = Object.freeze({ GK: 1, DEF: 4, MID: 5, FWD: 1 });

function fallbackLineup(players = [], shape = USER_FALLBACK_SHAPE) {
  const pool = [...players].sort((left, right) => (right.rating || 0) - (left.rating || 0));
  const selected = [];
  for (const group of ['GK', 'DEF', 'MID', 'FWD']) {
    selected.push(...pool.filter(player => player.group === group).slice(0, shape[group] || 0));
  }
  selected.push(...pool.filter(player => !selected.includes(player)).slice(0, 11 - selected.length));
  return selected.slice(0, 11);
}

function lineupFor(career, code, fixture) {
  const employed = squadForWorld(career, code, WORLD_PLAYER_BY_ID);
  if (code !== career.clubCode) return selectAiLineup(career, code, employed, fixture);
  const selected = (career.lineup || [])
    .map(id => WORLD_PLAYER_BY_ID.get(id))
    .filter(player => player && career.world?.employment?.[player.id] === code);
  const missing = Math.max(0, 11 - selected.length);
  if (!missing) {
    return {
      players: selected.slice(0, 11),
      style: 'user',
      formation: career.formation || '4-2-3-1',
      managerName: career.managerName || 'Manager',
      importance: 1
    };
  }
  const remainder = fallbackLineup(employed.filter(player => !selected.some(chosen => chosen.id === player.id)));
  return {
    players: [...selected, ...remainder.slice(0, missing)].slice(0, 11),
    style: 'user',
    formation: career.formation || '4-2-3-1',
    managerName: career.managerName || 'Manager',
    importance: 1
  };
}

function profile(career, code, home, fixture) {
  const selection = lineupFor(career, code, fixture);
  const players = selection.players;
  const user = code === career.clubCode;
  const aiPlan = user ? null : aiTacticalPlan(career, code, fixture, home);
  const tactics = user
    ? normalizeTactics(career.tactics)
    : normalizeTactics({ ...defaultTactics(), ...aiPlan });
  const metrics = analyzeTactics(tactics, players).metrics;
  const condition = user
    ? average(players.map(player => career.playerState?.[player.id]?.condition || 94))
    : 94;
  const rating = average(players.map(player => Number(player.rating) || 65));
  const elo = Number(career.world?.clubs?.[code]?.elo) || Number(WORLD_TEAM_ELO[code]) || 1750;
  const power = rating + (elo - 1750) / 62 + (home ? 1.65 : 0) + (condition - 90) / 8;
  const attack = power + (metrics.creation - 65) / 8 + (metrics.intensity - 60) / 18;
  const defence = power + (metrics.protection - 65) / 7 + (metrics.control - 60) / 24;
  return {
    code,
    user,
    players,
    tactics,
    metrics,
    condition,
    rating,
    power,
    attack,
    defence,
    style: user ? 'user' : aiPlan.style,
    formation: user ? selection.formation : aiPlan.formation,
    managerName: user ? selection.managerName : aiPlan.managerName,
    importance: user ? 1 : aiPlan.importance
  };
}

function poisson(random, lambda) {
  let count = 0;
  let product = 1;
  const limit = Math.exp(-lambda);
  do {
    count += 1;
    product *= random();
  } while (product > limit && count < 9);
  return count - 1;
}

function weightedPlayer(random, players, assisting = false) {
  const rows = players.map(player => {
    const weight = player.group === 'FWD' ? 5.4 : player.group === 'MID' ? (assisting ? 3.3 : 2.25) : player.group === 'DEF' ? .55 : .06;
    return { player, weight: weight * clamp((Number(player.rating) || 70) / 75, .72, 1.28) };
  });
  let roll = random() * rows.reduce((sum, row) => sum + row.weight, 0);
  for (const row of rows) {
    roll -= row.weight;
    if (roll <= 0) return row.player;
  }
  return rows.at(-1)?.player || null;
}

function goalEvents(random, goals, side, players) {
  const used = new Set();
  const events = [];
  for (let index = 0; index < goals; index += 1) {
    let minute = 5 + Math.floor(random() * 85);
    while (used.has(minute)) minute = 5 + Math.floor(random() * 85);
    used.add(minute);
    const scorer = weightedPlayer(random, players);
    const possibleAssists = players.filter(player => player.id !== scorer?.id);
    const assist = random() > .2 ? weightedPlayer(random, possibleAssists, true) : null;
    events.push({
      type: 'goal', minute, side,
      playerId: scorer?.id || null,
      playerName: scorer?.name || 'Gol',
      assistPlayerId: assist?.id || null,
      assistName: assist?.name || null
    });
  }
  return events;
}

export function simulateWorldFixture(career, fixture) {
  const random = seededRandom(`${career.world?.seed || career.seasonId}:${fixture.id}:${JSON.stringify(normalizeTactics(career.tactics))}`);
  const home = profile(career, fixture.home, true, fixture);
  const away = profile(career, fixture.away, false, fixture);
  const homeEdge = (home.attack - away.defence) / 17;
  const awayEdge = (away.attack - home.defence) / 17;
  const homeXg = clamp(1.18 + homeEdge * .23 + (random() - .5) * .28, .22, 4.0);
  const awayXg = clamp(1.00 + awayEdge * .23 + (random() - .5) * .28, .18, 3.8);
  const homeGoals = poisson(random, homeXg);
  const awayGoals = poisson(random, awayXg);
  const events = [
    ...goalEvents(random, homeGoals, 'home', home.players),
    ...goalEvents(random, awayGoals, 'away', away.players)
  ].sort((left, right) => left.minute - right.minute);
  const controlDelta = (home.metrics.control - away.metrics.control) * .23 + (home.power - away.power) * .45;
  const possession = clamp(Math.round(50 + controlDelta + (home.power - away.power) * .45 + (random() - .5) * 6), 28, 72);
  const shots = xg => Math.max(1, Math.round(xg * (4.7 + random() * 2.2)));

  return {
    fixtureId: fixture.id,
    matchweek: fixture.matchweek,
    date: fixture.date,
    time: fixture.time,
    home: fixture.home,
    away: fixture.away,
    homeGoals,
    awayGoals,
    lineups: { home: home.players.map(player => player.id), away: away.players.map(player => player.id) },
    events,
    stats: {
      home: { xg: +homeXg.toFixed(2), shots: Math.max(homeGoals, shots(homeXg)), possession, corners: 2 + Math.floor(random() * 7), highRecoveries: 4 + Math.floor(random() * 9), counters: 1 + Math.floor(random() * 5), crosses: 6 + Math.floor(random() * 11) },
      away: { xg: +awayXg.toFixed(2), shots: Math.max(awayGoals, shots(awayXg)), possession: 100 - possession, corners: 2 + Math.floor(random() * 7), highRecoveries: 4 + Math.floor(random() * 9), counters: 1 + Math.floor(random() * 5), crosses: 6 + Math.floor(random() * 11) }
    },
    tactical: {
      home: { metrics: home.metrics, load: home.metrics.intensity || 62, plan: home.user ? career.tactics.activePlan || 'A' : 'AI', style: home.style, formation: home.formation, managerName: home.managerName, importance: home.importance },
      away: { metrics: away.metrics, load: away.metrics.intensity || 62, plan: away.user ? career.tactics.activePlan || 'A' : 'AI', style: away.style, formation: away.formation, managerName: away.managerName, importance: away.importance }
    }
  };
}

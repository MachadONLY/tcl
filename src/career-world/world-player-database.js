import { PLAYER_BY_ID as PREMIER_PLAYER_BY_ID, SQUADS as PREMIER_SQUADS } from '../career-core/career-core.js';
import { CLUB_CATALOG, TEAM_BUDGETS, TEAM_ELO } from '../career-core/season-2026-27-live.js';

const EMPTY_SNAPSHOT = Object.freeze({
  meta: Object.freeze({ schemaVersion: 1, complete: false, playerCount: 0, clubCount: 0, countryCount: 0, source: 'PREMIER_LEAGUE_ONLY' }),
  clubs: Object.freeze([]),
  players: Object.freeze([])
});

async function loadExternalSnapshot() {
  const browser = typeof window !== 'undefined' && typeof window.fetch === 'function';
  const protocol = browser ? String(window.location?.protocol || '') : '';
  if (!browser || !/^https?:$/.test(protocol)) return EMPTY_SNAPSHOT;
  try {
    const response = await window.fetch('/generated/world-player-database.json', { cache: 'no-store' });
    if (!response.ok) return EMPTY_SNAPSHOT;
    const payload = await response.json();
    if (!payload?.meta?.complete || !Array.isArray(payload.clubs) || !Array.isArray(payload.players)) return EMPTY_SNAPSHOT;
    return payload;
  } catch {
    return EMPTY_SNAPSHOT;
  }
}

const snapshot = await loadExternalSnapshot();
const externalClubs = Array.isArray(snapshot.clubs) ? snapshot.clubs.filter(club => club?.code && !TEAM_ELO[club.code]) : [];
const externalPlayers = Array.isArray(snapshot.players) ? snapshot.players.filter(player => player?.id && player?.clubCode) : [];
const externalSquadsMutable = {};
for (const player of externalPlayers) {
  (externalSquadsMutable[player.clubCode] ||= []).push(Object.freeze({ ...player, worldExternal: true }));
}
for (const rows of Object.values(externalSquadsMutable)) {
  rows.sort((left, right) => right.rating - left.rating || left.age - right.age || left.name.localeCompare(right.name));
  Object.freeze(rows);
}

const worldPlayerById = new Map(PREMIER_PLAYER_BY_ID);
for (const rows of Object.values(externalSquadsMutable)) {
  for (const player of rows) worldPlayerById.set(player.id, player);
}

export const WORLD_DB_META = Object.freeze({
  ...(snapshot.meta || EMPTY_SNAPSHOT.meta),
  loadedExternalPlayers: externalPlayers.length,
  loadedExternalClubs: externalClubs.length,
  runtimeMode: externalPlayers.length ? 'EUROPEAN_WORLD_DATABASE' : 'PREMIER_LEAGUE_ONLY'
});

export const WORLD_CLUB_CATALOG = Object.freeze([
  ...CLUB_CATALOG,
  ...externalClubs.map(club => Object.freeze({ ...club, internal: false }))
]);

export const WORLD_SQUADS = Object.freeze({
  ...PREMIER_SQUADS,
  ...externalSquadsMutable
});

export const WORLD_PLAYER_BY_ID = worldPlayerById;
export const WORLD_TEAM_BUDGETS = Object.freeze(Object.fromEntries([
  ...Object.entries(TEAM_BUDGETS),
  ...externalClubs.map(club => [club.code, Number(club.budget) || 5_000_000])
]));
export const WORLD_TEAM_ELO = Object.freeze(Object.fromEntries([
  ...Object.entries(TEAM_ELO),
  ...externalClubs.map(club => [club.code, Number(club.elo) || 1600])
]));

export function worldDatabaseCoverage() {
  return {
    mode: WORLD_DB_META.runtimeMode,
    clubs: WORLD_CLUB_CATALOG.length,
    players: WORLD_PLAYER_BY_ID.size,
    externalClubs: externalClubs.length,
    externalPlayers: externalPlayers.length,
    countries: Number(WORLD_DB_META.countryCount) || 1,
    generatedAt: WORLD_DB_META.generatedAt || null,
    complete: Boolean(WORLD_DB_META.complete)
  };
}

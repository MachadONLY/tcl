import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { EUROPEAN_CLUBS } from '../src/career-core/european-club-catalog.js';
import { CLUB_CATALOG } from '../src/career-core/season-2026-27-live.js';
import { groupFromPositions, normalizeName } from './official-football-data.mjs';
import { parseOfficialEaRatingsHtml } from './official-ea-ratings.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_PATH = path.join(ROOT, 'public', 'generated', 'world-player-database.json');
const DATASET_URLS = [
  'https://raw.githubusercontent.com/ismailoksuz/EAFC26-DataHub/main/data/players.json.gz',
  'https://github.com/ismailoksuz/EAFC26-DataHub/raw/refs/heads/main/data/players.json.gz'
];
const EA_PAGE_URLS = page => [
  `https://www.ea.com/games/ea-sports-fc/ratings?gender=0&orderBy=rank&page=${page}`,
  `https://careers.ea.com/games/ea-sports-fc/ratings?gender=0&orderBy=rank&page=${page}`,
  `https://www.ea.com/games/ea-sports-fc/ratings?id=EASFC_PLAYER_RATINGS_PITCH_NOTES_URL&gender=0&page=${page}`
];
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/151 Safari/537.36';
const MAX_AGE_DAYS = 30;
const INTERNAL_CODES = new Set(CLUB_CATALOG.map(club => club.code));

const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const roundMoney = value => Math.max(0, Math.round((Number(value) || 0) / 1000) * 1000);

function firstPresent(record, keys) {
  for (const key of keys) {
    const value = record?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return null;
}

function finiteNumber(value, minimum = -Infinity, maximum = Infinity) {
  const number = Number(value);
  return Number.isFinite(number) && number >= minimum && number <= maximum ? number : null;
}

function normalizeContractEnd(value) {
  const text = clean(value);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const year = Number(text.match(/(20\d{2})/)?.[1]);
  return Number.isFinite(year) ? `${year}-06-30` : null;
}

function displayName(record) {
  return clean(
    firstPresent(record, ['short_name', 'shortName', 'common_name', 'commonName', 'long_name', 'longName', 'name'])
    || `${record?.first_name || record?.firstName || ''} ${record?.last_name || record?.lastName || ''}`
  );
}

function normalizeGender(value) {
  const normalized = normalizeName(value);
  if (!normalized) return null;
  if (['f', 'female', 'woman', 'women'].includes(normalized)) return 'female';
  if (['m', 'male', 'man', 'men'].includes(normalized)) return 'male';
  const number = Number(value);
  if (number === 1) return 'female';
  if (number === 0) return 'male';
  return null;
}

function attributesFromDataset(record) {
  const number = (...keys) => finiteNumber(firstPresent(record, keys), 0, 99);
  return {
    pace: number('pace', 'pac'),
    shooting: number('shooting', 'sho'),
    passing: number('passing', 'pas'),
    dribbling: number('dribbling', 'dri'),
    defending: number('defending', 'def'),
    physical: number('physic', 'physical', 'phy'),
    acceleration: number('movement_acceleration', 'acceleration'),
    sprintSpeed: number('movement_sprint_speed', 'sprint_speed', 'sprintSpeed'),
    stamina: number('power_stamina', 'stamina'),
    strength: number('power_strength', 'strength'),
    aggression: number('mentality_aggression', 'aggression'),
    vision: number('mentality_vision', 'vision'),
    composure: number('mentality_composure', 'composure'),
    reactions: number('movement_reactions', 'reactions'),
    ballControl: number('skill_ball_control', 'ball_control', 'ballControl'),
    shortPassing: number('attacking_short_passing', 'short_passing', 'shortPassing'),
    longPassing: number('skill_long_passing', 'long_passing', 'longPassing'),
    interceptions: number('mentality_interceptions', 'interceptions'),
    positioning: number('mentality_positioning', 'positioning'),
    finishing: number('attacking_finishing', 'finishing')
  };
}

export function normalizeWorldDatasetRecord(record) {
  if (!record || typeof record !== 'object') return null;
  const fifaVersion = finiteNumber(firstPresent(record, ['fifa_version', 'fifaVersion']), 1, 99) ?? 26;
  if (fifaVersion !== 26) return null;
  const gender = normalizeGender(firstPresent(record, ['gender', 'sex', 'player_gender']));
  if (gender === 'female') return null;
  const playerId = finiteNumber(firstPresent(record, ['sofifa_id', 'player_id', 'playerId', 'id']), 1);
  const name = displayName(record);
  const rating = finiteNumber(firstPresent(record, ['overall', 'overall_rating', 'overallRating', 'ovr']), 40, 99);
  if (!playerId || !name || !rating) return null;
  const positions = clean(firstPresent(record, ['player_positions', 'positions', 'position']) || '');
  const teamName = clean(firstPresent(record, ['club_name', 'clubName', 'team_name', 'teamName', 'team']));
  const teamId = finiteNumber(firstPresent(record, ['club_team_id', 'clubTeamId', 'team_id', 'teamId']), 1);
  return {
    playerId,
    name,
    normalizedName: normalizeName(name),
    teamId,
    teamName,
    leagueName: clean(firstPresent(record, ['league_name', 'leagueName', 'league'])),
    leagueLevel: finiteNumber(firstPresent(record, ['league_level', 'leagueLevel']), 1, 20),
    nationality: clean(firstPresent(record, ['nationality_name', 'nationalityName', 'nationality'])),
    age: finiteNumber(firstPresent(record, ['age']), 15, 50),
    rating,
    potential: finiteNumber(firstPresent(record, ['potential']), 40, 99) || rating,
    positions,
    group: groupFromPositions(positions),
    value: roundMoney(firstPresent(record, ['value_eur', 'valueEur', 'value'])),
    wage: roundMoney(firstPresent(record, ['wage_eur', 'wageEur', 'wage'])),
    contractUntil: normalizeContractEnd(firstPresent(record, ['club_contract_valid_until', 'contract_valid_until', 'contractUntil', 'contract_end'])),
    joinedAt: normalizeContractEnd(firstPresent(record, ['club_joined', 'joinedAt']))?.replace('-06-30', '-07-01') || null,
    preferredFoot: clean(firstPresent(record, ['preferred_foot', 'preferredFoot'])),
    heightCm: finiteNumber(firstPresent(record, ['height_cm', 'heightCm']), 140, 220),
    weightKg: finiteNumber(firstPresent(record, ['weight_kg', 'weightKg']), 45, 130),
    photoUrl: clean(firstPresent(record, ['player_face_url', 'face_url', 'photoUrl'])),
    attributes: attributesFromDataset(record),
    source: 'FC26_DATASET'
  };
}

async function fetchResponse(url, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          'user-agent': USER_AGENT,
          accept: 'text/html,application/json,text/plain,*/*',
          'accept-language': 'en-GB,en;q=0.9'
        }
      });
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status}`);
      if (response.status < 500 && response.status !== 429) break;
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 350 * attempt));
  }
  throw new Error(`${url}: ${lastError?.message || 'network failure'}`);
}

async function fetchFirstAvailable(urls, options = {}) {
  let lastError;
  for (const url of urls) {
    try {
      const response = await fetchResponse(url, options.attempts || 2);
      return { response, url: response.url || url };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('all data sources failed');
}

export async function loadRichFc26Dataset() {
  const { response, url } = await fetchFirstAvailable(DATASET_URLS, { attempts: 2 });
  const bytes = Buffer.from(await response.arrayBuffer());
  const parsed = JSON.parse(gunzipSync(bytes).toString('utf8'));
  const sourceRows = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.players) ? parsed.players : [];
  const latestById = new Map();
  for (const raw of sourceRows) {
    const player = normalizeWorldDatasetRecord(raw);
    if (!player) continue;
    latestById.set(player.playerId, player);
  }
  const rows = [...latestById.values()];
  if (rows.length < 10000) throw new Error(`FC26 dataset returned only ${rows.length} valid male players`);
  return { rows, sourceUrl: url };
}

function pageCountFromEaHtml(html) {
  const pages = [...String(html).matchAll(/[?&](?:amp;)?page=(\d+)/gi)].map(match => Number(match[1]));
  return Math.max(1, ...pages.filter(Number.isFinite));
}

async function fetchEaPage(page) {
  const errors = [];
  for (const url of EA_PAGE_URLS(page)) {
    try {
      const response = await fetchResponse(url, 2);
      const html = await response.text();
      const rows = parseOfficialEaRatingsHtml(html);
      if (rows.length) return { html, rows, url: response.url || url };
      errors.push(`no players at ${new URL(url).hostname}`);
    } catch (error) {
      errors.push(error.message);
    }
  }
  throw new Error(`EA page ${page}: ${errors.join(' | ')}`);
}

export async function scanOfficialEaWorld({ progress = true } = {}) {
  const first = await fetchEaPage(1);
  const byId = new Map(first.rows.map(row => [row.eaPlayerId, row]));
  let maximumPage = pageCountFromEaHtml(first.html);
  if (maximumPage < 20) maximumPage = 180;
  maximumPage = Math.min(220, maximumPage);
  let emptyBatches = 0;
  for (let start = 2; start <= maximumPage && emptyBatches < 3; start += 6) {
    const pages = Array.from({ length: Math.min(6, maximumPage - start + 1) }, (_, index) => start + index);
    let added = 0;
    await Promise.all(pages.map(async page => {
      try {
        const result = await fetchEaPage(page);
        for (const row of result.rows) {
          if (!byId.has(row.eaPlayerId)) added += 1;
          byId.set(row.eaPlayerId, row);
        }
      } catch (error) {
        if (progress) console.warn(`EA ${page}: ${error.message}`);
      }
    }));
    emptyBatches = added === 0 ? emptyBatches + 1 : 0;
    if (progress && (start === 2 || start % 30 === 2)) {
      console.log(`  EA pages ${start}-${pages.at(-1)} · ${byId.size} players`);
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const rows = [...byId.values()];
  if (rows.length < 10000) throw new Error(`official EA scan returned only ${rows.length} players`);
  return { rows, sourceUrl: first.url };
}

const CLUB_ALIASES = Object.freeze({
  'fc bayern munchen': 'Bayern Munich',
  'fc bayern münchen': 'Bayern Munich',
  'bayern munchen': 'Bayern Munich',
  'paris sg': 'Paris Saint-Germain',
  'paris saint germain': 'Paris Saint-Germain',
  'inter': 'Inter Milan',
  'internazionale': 'Inter Milan',
  'ac milan': 'AC Milan',
  'sporting lisbon': 'Sporting CP',
  'sporting cp': 'Sporting CP',
  'atletico de madrid': 'Atlético Madrid',
  'atletico madrid': 'Atlético Madrid',
  'man utd': 'Manchester United',
  'manchester utd': 'Manchester United',
  'spurs': 'Tottenham Hotspur',
  'tottenham': 'Tottenham Hotspur',
  'dortmund': 'Borussia Dortmund',
  'ludogorets razgrad': 'Ludogorets'
});

function normalizedClubKey(value) {
  const aliased = CLUB_ALIASES[normalizeName(value)] || value;
  return normalizeName(aliased)
    .replace(/\b(?:football club|futbol club|club de futbol|fc|afc|cf|sc|fk)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildCatalogLookup(catalog) {
  const exact = new Map();
  const simplified = new Map();
  for (const club of catalog) {
    for (const value of [club.name, club.shortName, club.code, club.id]) {
      const key = normalizeName(value);
      if (key && !exact.has(key)) exact.set(key, club);
      const simple = normalizedClubKey(value);
      if (simple && !simplified.has(simple)) simplified.set(simple, club);
    }
  }
  return { exact, simplified };
}

function resolveCatalogClub(teamName, lookup) {
  const aliasName = CLUB_ALIASES[normalizeName(teamName)] || teamName;
  const exact = lookup.exact.get(normalizeName(aliasName));
  if (exact) return exact;
  const simple = normalizedClubKey(aliasName);
  if (lookup.simplified.has(simple)) return lookup.simplified.get(simple);
  if (simple.length >= 6) {
    const candidates = [...lookup.simplified.entries()]
      .filter(([key]) => key.includes(simple) || simple.includes(key))
      .map(([, club]) => club);
    if (candidates.length === 1) return candidates[0];
  }
  return null;
}

function leagueCountryIndex(catalog) {
  const buckets = new Map();
  for (const club of catalog) {
    if (!club.league || !club.countryCode) continue;
    const key = normalizeName(club.league);
    const countries = buckets.get(key) || new Set();
    countries.add(club.countryCode);
    buckets.set(key, countries);
  }
  const result = new Map();
  for (const [league, countries] of buckets) {
    if (countries.size === 1) result.set(league, [...countries][0]);
  }
  return result;
}

function fallbackValue(player) {
  const rating = Number(player.rating) || 60;
  const age = Number(player.age) || 24;
  const ageFactor = age <= 21 ? 1.35 : age <= 24 ? 1.2 : age <= 27 ? 1.08 : age <= 30 ? .82 : age <= 33 ? .52 : .28;
  return Math.max(250000, Math.round(Math.pow(Math.max(1, rating - 54), 2.08) * 95000 * ageFactor / 250000) * 250000);
}

function squadRole(player, peers) {
  const sorted = [...peers].sort((left, right) => right.rating - left.rating || left.age - right.age);
  const index = sorted.findIndex(candidate => candidate.playerId === player.playerId);
  const percentile = sorted.length <= 1 ? 0 : index / Math.max(1, sorted.length - 1);
  if (percentile <= .16) return 'key';
  if (percentile <= .42) return 'important';
  if (percentile <= .72) return 'rotation';
  return player.age <= 21 && player.potential >= player.rating + 3 ? 'prospect' : 'fringe';
}

function teamKey(player) {
  if (player.teamId) return `team:${player.teamId}`;
  const key = normalizedClubKey(player.teamName);
  return key ? `name:${key}` : null;
}

function mergePlayer(official, dataset) {
  const officialAttributes = official?.attributes || {};
  const datasetAttributes = dataset?.attributes || {};
  return {
    ...(dataset || {}),
    ...(official || {}),
    playerId: official?.eaPlayerId || dataset?.playerId,
    name: official?.name || dataset?.name,
    normalizedName: official?.normalizedName || dataset?.normalizedName,
    teamId: official?.teamId || dataset?.teamId || null,
    teamName: official?.teamName || dataset?.teamName || '',
    leagueName: dataset?.leagueName || '',
    rating: official?.overall || dataset?.rating,
    potential: Math.max(official?.overall || 0, dataset?.potential || dataset?.rating || 0),
    positions: official?.position || dataset?.positions || '',
    group: official?.group || dataset?.group,
    attributes: Object.fromEntries(
      Object.keys({ ...datasetAttributes, ...officialAttributes }).map(key => [key, officialAttributes[key] ?? datasetAttributes[key] ?? null])
    ),
    source: official ? 'EA_FC26_OFFICIAL_PLUS_DATASET' : 'FC26_DATASET'
  };
}

export function buildWorldSnapshot({ datasetRows = [], officialRows = [], catalog = EUROPEAN_CLUBS, generatedAt = new Date().toISOString() }) {
  const lookup = buildCatalogLookup(catalog);
  const countryByLeague = leagueCountryIndex(catalog);
  const datasetById = new Map(datasetRows.map(row => [Number(row.playerId), row]));
  const useOfficial = officialRows.length >= 10000;
  const merged = useOfficial
    ? officialRows.map(row => mergePlayer(row, datasetById.get(Number(row.eaPlayerId)))).filter(Boolean)
    : datasetRows.map(row => mergePlayer(null, row));
  const teams = new Map();

  for (const player of merged) {
    if (!player?.playerId || !player.teamName || !player.group || !player.rating) continue;
    const key = teamKey(player);
    if (!key) continue;
    const bucket = teams.get(key) || { teamId: player.teamId || null, teamName: player.teamName, leagueName: player.leagueName || '', players: [] };
    if (!bucket.leagueName && player.leagueName) bucket.leagueName = player.leagueName;
    bucket.players.push(player);
    teams.set(key, bucket);
  }

  const clubs = [];
  const players = [];
  let catalogMatches = 0;
  let dynamicClubs = 0;
  let ignoredInternalPlayers = 0;

  for (const team of teams.values()) {
    if (team.players.length < 12) continue;
    const catalogClub = resolveCatalogClub(team.teamName, lookup);
    if (catalogClub?.code && INTERNAL_CODES.has(catalogClub.code)) {
      ignoredInternalPlayers += team.players.length;
      continue;
    }
    const countryCode = catalogClub?.countryCode || countryByLeague.get(normalizeName(team.leagueName)) || null;
    if (!catalogClub && !countryCode) continue;
    const code = catalogClub?.id || `ea-${team.teamId || normalizedClubKey(team.teamName).replace(/\s+/g, '-')}`;
    const sorted = [...team.players].sort((left, right) => right.rating - left.rating || left.age - right.age);
    const top = sorted.slice(0, Math.min(15, sorted.length));
    const squadRating = top.reduce((sum, player) => sum + player.rating, 0) / Math.max(1, top.length);
    const totalValue = sorted.reduce((sum, player) => sum + (Number(player.value) || fallbackValue(player)), 0);
    const reputation = clamp(Math.round((squadRating - 55) / 6.5), 1, 5);
    const transferBudget = clamp(Math.round(totalValue * (.11 + reputation * .022) / 500000) * 500000, 2_000_000, 260_000_000);
    const elo = clamp(Math.round(1500 + (squadRating - 66) * 37), 1450, 2075);
    clubs.push({
      code,
      id: code,
      eaTeamId: team.teamId,
      name: catalogClub?.name || team.teamName,
      shortName: catalogClub?.shortName || team.teamName,
      countryCode: countryCode || 'UNK',
      country: catalogClub?.country || null,
      league: catalogClub?.league || team.leagueName || 'Unknown',
      division: Number(catalogClub?.division) || 1,
      rating: +squadRating.toFixed(2),
      reputation,
      elo,
      budget: transferBudget,
      internal: false,
      catalogId: catalogClub?.id || null,
      databaseSource: useOfficial ? 'EA_FC26_OFFICIAL_PLUS_DATASET' : 'FC26_DATASET'
    });
    if (catalogClub) catalogMatches += 1;
    else dynamicClubs += 1;

    for (const row of sorted) {
      const role = squadRole(row, sorted);
      players.push({
        id: `ea-${row.playerId}`,
        eaPlayerId: row.playerId,
        clubCode: code,
        name: row.name,
        group: row.group,
        position: row.positions || row.position || '',
        age: Number(row.age) || 24,
        rating: Number(row.rating) || 60,
        potential: Math.max(Number(row.rating) || 60, Number(row.potential) || Number(row.rating) || 60),
        value: Number(row.value) > 0 ? Number(row.value) : fallbackValue(row),
        wage: Number(row.wage) > 0 ? Number(row.wage) : Math.max(1000, Math.round(Math.pow(Number(row.rating) || 60, 2) * 12 / 500) * 500),
        contractUntil: row.contractUntil || null,
        joinedAt: row.joinedAt || null,
        nationality: row.nationality || null,
        preferredFoot: row.preferredFoot || null,
        heightCm: row.heightCm || null,
        weightKg: row.weightKg || null,
        photoUrl: row.photoUrl || null,
        attributes: row.attributes || {},
        initialSquadRole: role,
        worldExternal: true,
        ratingSource: row.source,
        rosterSource: useOfficial ? 'EA_FC26_OFFICIAL_CURRENT_TEAM' : 'FC26_DATASET_TEAM'
      });
    }
  }

  clubs.sort((left, right) => right.reputation - left.reputation || right.rating - left.rating || left.name.localeCompare(right.name));
  players.sort((left, right) => left.clubCode.localeCompare(right.clubCode) || right.rating - left.rating || left.name.localeCompare(right.name));
  const countries = new Set(clubs.map(club => club.countryCode).filter(code => code && code !== 'UNK'));
  const complete = players.length >= 7000 && clubs.length >= 250 && countries.size >= 20;
  return {
    meta: {
      schemaVersion: 1,
      generatedAt,
      complete,
      playerCount: players.length,
      clubCount: clubs.length,
      countryCount: countries.size,
      catalogMatches,
      dynamicClubs,
      ignoredInternalPlayers,
      officialEaPlayers: officialRows.length,
      datasetPlayers: datasetRows.length,
      teamAssignmentSource: useOfficial ? 'EA_SPORTS_FC_26_OFFICIAL' : 'FC26_DATASET',
      detailSource: 'EAFC26_DATAHUB_DATASET',
      attribution: 'EA SPORTS FC 26 ratings pages; FC26 DataHub dataset used for supplemental attributes'
    },
    clubs,
    players
  };
}

function snapshotFresh(snapshot) {
  if (!snapshot?.meta?.complete || snapshot.meta.playerCount < 7000) return false;
  const generated = Date.parse(snapshot.meta.generatedAt || '');
  if (!Number.isFinite(generated)) return false;
  return Date.now() - generated < MAX_AGE_DAYS * 86_400_000;
}

async function readExistingSnapshot() {
  try {
    return JSON.parse(await readFile(OUTPUT_PATH, 'utf8'));
  } catch {
    return null;
  }
}

export async function syncWorldPlayerDatabase({ force = false, datasetOnly = false } = {}) {
  const existing = await readExistingSnapshot();
  if (!force && snapshotFresh(existing)) {
    console.log(`✓ World Player Database already fresh: ${existing.meta.playerCount} players · ${existing.meta.clubCount} clubs.`);
    return existing;
  }
  if (process.env.CI && !force) {
    console.log('CI: external World Player Database sync skipped; runtime will use the committed Premier League database.');
    return existing;
  }

  console.log('Building European World Player Database...');
  const dataset = await loadRichFc26Dataset();
  console.log(`✓ FC26 rich dataset: ${dataset.rows.length} players.`);
  let official = { rows: [], sourceUrl: null };
  if (!datasetOnly) {
    try {
      official = await scanOfficialEaWorld({ progress: true });
      console.log(`✓ Official EA FC26 assignment layer: ${official.rows.length} male players.`);
    } catch (error) {
      console.warn(`EA official layer unavailable (${error.message}); using the rich FC26 dataset as the team-assignment fallback.`);
    }
  }
  const snapshot = buildWorldSnapshot({ datasetRows: dataset.rows, officialRows: official.rows });
  if (!snapshot.meta.complete) {
    throw new Error(`World database coverage too low: ${snapshot.meta.playerCount} players, ${snapshot.meta.clubCount} clubs, ${snapshot.meta.countryCount} countries`);
  }
  snapshot.meta.datasetUrl = dataset.sourceUrl;
  snapshot.meta.officialEaUrl = official.sourceUrl;
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(snapshot), 'utf8');
  console.log(`✓ World Player Database: ${snapshot.meta.playerCount} players · ${snapshot.meta.clubCount} clubs · ${snapshot.meta.countryCount} countries.`);
  console.log(`✓ Catalog matches: ${snapshot.meta.catalogMatches}; dynamic EA clubs: ${snapshot.meta.dynamicClubs}.`);
  return snapshot;
}

async function main() {
  const force = process.argv.includes('--force');
  const datasetOnly = process.argv.includes('--dataset-only');
  await syncWorldPlayerDatabase({ force, datasetOnly });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(`World Player Database sync failed: ${error.message}`);
    process.exitCode = 1;
  });
}

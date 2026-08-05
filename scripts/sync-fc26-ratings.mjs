import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import {
  groupFromPositions,
  normalizeName
} from './official-football-data.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCAL_ROSTER_PATH = path.join(ROOT, 'src', 'career-core', 'fotmob-rosters.local.json');
const PUBLIC_ROSTER_PATH = path.join(ROOT, 'public', 'assets', 'players', '2026-27', 'rosters.json');
const MANIFEST_PATH = path.join(ROOT, 'public', 'assets', 'players', '2026-27', 'manifest.json');
const REPORT_PATH = path.join(ROOT, 'public', 'assets', 'players', '2026-27', 'fotmob-sync-report.json');
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36';
const SOFIFA_API = 'https://api.sofifa.net';
const DATASET_URLS = [
  'https://raw.githubusercontent.com/ismailoksuz/EAFC26-DataHub/main/data/players.json.gz',
  'https://github.com/ismailoksuz/EAFC26-DataHub/raw/refs/heads/main/data/players.json.gz'
];

const CLUB_ALIASES = Object.freeze({
  ARS: ['arsenal'],
  AVL: ['aston villa'],
  BOU: ['afc bournemouth', 'bournemouth'],
  BRE: ['brentford'],
  BHA: ['brighton hove albion', 'brighton and hove albion', 'brighton'],
  CHE: ['chelsea'],
  COV: ['coventry city', 'coventry'],
  CRY: ['crystal palace'],
  EVE: ['everton'],
  FUL: ['fulham'],
  HUL: ['hull city', 'hull'],
  IPS: ['ipswich town', 'ipswich'],
  LEE: ['leeds united', 'leeds'],
  LIV: ['liverpool'],
  MCI: ['manchester city', 'man city'],
  MUN: ['manchester united', 'man utd'],
  NEW: ['newcastle united', 'newcastle'],
  NFO: ['nottingham forest'],
  SUN: ['sunderland'],
  TOT: ['tottenham hotspur', 'tottenham', 'spurs']
});

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function clean(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function finiteRating(value) {
  const rating = Number(value);
  return Number.isFinite(rating) && rating >= 40 && rating <= 99 ? rating : null;
}

function finiteAge(value) {
  const age = Number(value);
  return Number.isFinite(age) && age >= 15 && age <= 50 ? age : null;
}

function normalizedAliases(values) {
  return [...new Set(values.map(normalizeName).filter(Boolean))];
}

function teamMatches(code, value) {
  const normalized = normalizeName(value);
  return (CLUB_ALIASES[code] || []).some(alias => {
    const target = normalizeName(alias);
    return normalized === target || normalized.includes(target) || target.includes(normalized);
  });
}

function displayName(record) {
  const common = clean(record.commonName ?? record.common_name);
  const full = clean(record.long_name ?? record.longName ?? record.name);
  const firstLast = clean(`${record.firstName ?? record.first_name ?? ''} ${record.lastName ?? record.last_name ?? ''}`);
  const short = clean(record.short_name ?? record.shortName);
  return common || full || firstLast || short;
}

function slugAlias(record) {
  const url = clean(record.player_url ?? record.playerUrl ?? record.url);
  const match = url.match(/\/player\/\d+\/([^/]+)/i);
  return match ? match[1].replace(/[-_]+/g, ' ') : '';
}

function normalizeRatingRecord(record, source, teamCode = null, roster = null) {
  const overall = finiteRating(record.overallRating ?? record.overall_rating ?? record.overall ?? record.ovr);
  if (!overall) return null;
  const names = normalizedAliases([
    displayName(record),
    record.commonName,
    record.long_name,
    record.longName,
    record.short_name,
    record.shortName,
    `${record.firstName ?? ''} ${record.lastName ?? ''}`,
    slugAlias(record)
  ]);
  if (!names.length) return null;
  const positions = clean(record.player_positions ?? record.positions ?? record.position ?? [record.position1, record.position2, record.position3, record.position4].filter(value => value != null && value !== -1).join(', '));
  return {
    playerId: Number(record.id ?? record.player_id ?? record.playerId) || null,
    names,
    displayName: displayName(record),
    overall,
    potential: finiteRating(record.potential),
    age: finiteAge(record.age),
    group: groupFromPositions(positions),
    positions,
    teamCode,
    teamName: clean(record.club_name ?? record.clubName ?? record.teamName ?? record.team?.name),
    roster: clean(record.roster ?? roster),
    updatedAt: clean(record.fifa_update_date ?? record.updateDate ?? record.updatedAt),
    source
  };
}

function findPlayerArrays(value, results = [], depth = 0) {
  if (depth > 8 || value == null) return results;
  if (Array.isArray(value)) {
    if (value.some(item => item && typeof item === 'object' && finiteRating(item.overallRating ?? item.overall_rating ?? item.overall ?? item.ovr))) {
      results.push(value);
      return results;
    }
    for (const item of value) findPlayerArrays(item, results, depth + 1);
    return results;
  }
  if (typeof value === 'object') {
    for (const item of Object.values(value)) findPlayerArrays(item, results, depth + 1);
  }
  return results;
}

async function fetchResponse(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          'user-agent': USER_AGENT,
          accept: 'application/json,text/plain,*/*',
          'accept-language': 'en-GB,en;q=0.9'
        }
      });
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 350 * attempt));
  }
  throw new Error(`${url}: ${lastError?.message || 'falha de rede'}`);
}

async function fetchJson(url) {
  const response = await fetchResponse(url);
  return response.json();
}

function chooseLatestRoster(leaguesPayload) {
  const leagues = Array.isArray(leaguesPayload?.data) ? leaguesPayload.data : [];
  const premier = leagues.filter(row => Number(row.id) === 13 || normalizeName(row.name) === 'premier league');
  const candidates = premier
    .flatMap(row => [row.latestRoster, row.roster])
    .map(value => clean(value))
    .filter(value => /^26\d+$/i.test(value));
  return candidates.sort((a, b) => Number(b) - Number(a))[0] || '260007';
}

function chooseTeam(teams, code) {
  return teams
    .filter(team => teamMatches(code, team.name))
    .sort((a, b) => Number(b.latestRoster ?? b.roster ?? 0) - Number(a.latestRoster ?? a.roster ?? 0))[0] || null;
}

export async function loadLatestSofifaRatings() {
  const leagues = await fetchJson(`${SOFIFA_API}/leagues`);
  const roster = chooseLatestRoster(leagues);
  const teamsPayload = await fetchJson(`${SOFIFA_API}/teams/${roster}`);
  const teams = Array.isArray(teamsPayload?.data) ? teamsPayload.data : [];
  const rows = [];
  const missingTeams = [];

  for (const code of Object.keys(CLUB_ALIASES)) {
    const team = chooseTeam(teams, code);
    if (!team?.id) {
      missingTeams.push(code);
      continue;
    }
    let payload;
    try {
      payload = await fetchJson(`${SOFIFA_API}/team/${team.id}/${roster}`);
    } catch {
      payload = await fetchJson(`${SOFIFA_API}/team/${team.id}`);
    }
    const arrays = findPlayerArrays(payload?.data ?? payload);
    const seen = new Set();
    for (const record of arrays.flat()) {
      const normalized = normalizeRatingRecord(record, 'SOFIFA_API_LATEST', code, roster);
      if (!normalized) continue;
      const key = `${normalized.playerId || normalized.names[0]}:${normalized.overall}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(normalized);
    }
  }

  if (rows.length < 250) {
    throw new Error(`API do SoFIFA retornou apenas ${rows.length} jogadores para os clubes encontrados`);
  }
  return { rows, roster, missingTeams };
}

export async function loadDatasetFallback() {
  let bytes;
  let usedUrl;
  let lastError;
  for (const url of DATASET_URLS) {
    try {
      const response = await fetchResponse(url, 2);
      bytes = Buffer.from(await response.arrayBuffer());
      usedUrl = url;
      break;
    } catch (error) {
      lastError = error;
    }
  }
  if (!bytes) throw lastError || new Error('não foi possível baixar o dataset FC 26');
  const parsed = JSON.parse(gunzipSync(bytes).toString('utf8'));
  const sourceRows = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.players) ? parsed.players : [];
  const latestById = new Map();
  for (const record of sourceRows) {
    if (Number(record.fifa_version ?? 26) !== 26) continue;
    const normalized = normalizeRatingRecord(record, 'SOFIFA_DATASET_CC_BY_4_0');
    if (!normalized) continue;
    const key = normalized.playerId || normalized.names[0];
    const current = latestById.get(key);
    const currentUpdate = Number(current?.roster || current?.updatedAt?.replace(/\D/g, '') || 0);
    const nextUpdate = Number(normalized.roster || normalized.updatedAt?.replace(/\D/g, '') || 0);
    if (!current || nextUpdate >= currentUpdate) latestById.set(key, normalized);
  }
  const rows = [...latestById.values()];
  if (rows.length < 10000) throw new Error(`dataset FC 26 contém apenas ${rows.length} jogadores válidos`);
  return { rows, usedUrl };
}

function indexRatings(ratingRows) {
  const index = new Map();
  for (const row of ratingRows) {
    for (const alias of row.names) {
      const bucket = index.get(alias) || [];
      bucket.push(row);
      index.set(alias, bucket);
    }
  }
  return index;
}

function candidateScore(candidate, player, clubCode) {
  let score = candidate.source === 'SOFIFA_API_LATEST' ? 100 : 70;
  if (candidate.teamCode === clubCode || teamMatches(clubCode, candidate.teamName)) score += 30;
  const age = finiteAge(player.age);
  if (age && candidate.age) {
    const difference = Math.abs(age - candidate.age);
    score += difference === 0 ? 12 : difference === 1 ? 6 : difference >= 4 ? -12 : 0;
  }
  if (candidate.group && player.group) score += candidate.group === player.group ? 10 : -16;
  if (candidate.updatedAt) score += 1;
  return score;
}

export function matchRating(player, clubCode, index) {
  const normalized = normalizeName(player.name);
  const candidates = index.get(normalized) || [];
  if (!candidates.length) return null;
  if (normalized.length <= 6 && !candidates.some(candidate => candidate.teamCode === clubCode || teamMatches(clubCode, candidate.teamName))) {
    return null;
  }
  return [...candidates].sort((a, b) => candidateScore(b, player, clubCode) - candidateScore(a, player, clubCode))[0] || null;
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function safeEstimate(player, clubRows, groupRows) {
  const base = median(groupRows) ?? median(clubRows) ?? 70;
  const age = finiteAge(player.age);
  const ageAdjustment = age == null ? 0 : age <= 18 ? -5 : age <= 20 ? -4 : age <= 22 ? -2 : age >= 35 ? -2 : age >= 33 ? -1 : 0;
  return clamp(Math.round(base + ageAdjustment), 55, 88);
}

export function applyRatings(rosterPayload, ratingRows) {
  const index = indexRatings(ratingRows);
  const matches = [];
  const unmatched = [];

  for (const [clubCode, players] of Object.entries(rosterPayload.rosters || {})) {
    for (const player of players) {
      const match = matchRating(player, clubCode, index);
      if (match) {
        player.rating = match.overall;
        player.potential = match.potential;
        player.ratingSource = match.source;
        player.sofifaPlayerId = match.playerId;
        player.ratingRoster = match.roster || null;
        player.ratingUpdatedAt = match.updatedAt || null;
        matches.push({ clubCode, player, match });
      } else {
        unmatched.push({ clubCode, player });
      }
    }
  }

  for (const { clubCode, player } of unmatched) {
    const clubMatched = matches.filter(entry => entry.clubCode === clubCode).map(entry => entry.player.rating);
    const groupMatched = matches
      .filter(entry => entry.clubCode === clubCode && entry.player.group === player.group)
      .map(entry => entry.player.rating);
    player.rating = safeEstimate(player, clubMatched, groupMatched);
    player.ratingSource = 'TOUCHLINE_GROUP_MEDIAN_ESTIMATE';
    player.sofifaPlayerId = null;
    player.ratingRoster = null;
    player.ratingUpdatedAt = null;
  }

  return { matched: matches.length, estimated: unmatched.length };
}

async function writeJsonAtomic(destination, value) {
  const temporary = `${destination}.next`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rm(destination, { force: true });
  await rename(temporary, destination);
}

function updateManifest(manifest, rosterPayload) {
  const byClubAndName = new Map();
  for (const [clubCode, players] of Object.entries(rosterPayload.rosters || {})) {
    for (const player of players) byClubAndName.set(`${clubCode}:${normalizeName(player.name)}`, player);
  }
  let matched = 0;
  let estimated = 0;
  for (const record of Object.values(manifest.players || {})) {
    const player = byClubAndName.get(`${record.clubCode}:${normalizeName(record.name)}`);
    if (!player) continue;
    record.rating = player.rating;
    record.ratingSource = player.ratingSource;
    record.sofifaPlayerId = player.sofifaPlayerId;
    record.ratingRoster = player.ratingRoster;
    record.ratingUpdatedAt = player.ratingUpdatedAt;
    if (player.ratingSource.startsWith('SOFIFA_')) matched += 1;
    else estimated += 1;
  }
  manifest.ratingSource = 'SOFIFA_LATEST_WITH_CONSERVATIVE_FALLBACK';
  manifest.sofifaRatingCount = matched;
  manifest.estimatedRatingCount = estimated;
  manifest.ratingsGeneratedAt = new Date().toISOString();
  return { matched, estimated };
}

export async function main() {
  const rosterPayload = JSON.parse(await readFile(LOCAL_ROSTER_PATH, 'utf8').catch(() => {
    throw new Error('Pacote de elencos não encontrado. Rode primeiro npm run sync:full-rosters.');
  }));

  let apiResult = null;
  let datasetResult = null;
  try {
    console.log('Lendo os ratings mais recentes da API pública do SoFIFA...');
    apiResult = await loadLatestSofifaRatings();
    console.log(`✓ SoFIFA API: ${apiResult.rows.length} jogadores · roster ${apiResult.roster}.`);
  } catch (error) {
    console.warn(`SoFIFA API indisponível: ${error.message}`);
  }

  try {
    console.log('Carregando base FC 26 completa como fallback de correspondência...');
    datasetResult = await loadDatasetFallback();
    console.log(`✓ Dataset FC 26: ${datasetResult.rows.length} jogadores.`);
  } catch (error) {
    console.warn(`Dataset de fallback indisponível: ${error.message}`);
  }

  const ratingRows = [...(apiResult?.rows || []), ...(datasetResult?.rows || [])];
  if (ratingRows.length < 250) throw new Error('Nenhuma fonte real de ratings ficou disponível; os dados atuais foram preservados.');

  const result = applyRatings(rosterPayload, ratingRows);
  const generatedAt = new Date().toISOString();
  rosterPayload.meta = {
    ...(rosterPayload.meta || {}),
    ratingSource: 'SOFIFA_LATEST_WITH_CONSERVATIVE_FALLBACK',
    sofifaRoster: apiResult?.roster || null,
    sofifaRatingCount: result.matched,
    estimatedRatingCount: result.estimated,
    ratingsGeneratedAt: generatedAt,
    ratingsAttribution: 'SoFIFA API; FC 26 dataset by rovnez, CC BY 4.0'
  };

  const united = rosterPayload.rosters?.MUN || [];
  const heaven = united.find(player => normalizeName(player.name) === 'ayden heaven');
  const deLigt = united.find(player => normalizeName(player.name) === 'matthijs de ligt');
  if (!heaven || !deLigt) throw new Error('Validação do Manchester United não encontrou Heaven e De Ligt.');
  if (deLigt.rating <= heaven.rating) {
    throw new Error(`Ratings inconsistentes: De Ligt ${deLigt.rating}, Heaven ${heaven.rating}. Nenhum arquivo foi alterado.`);
  }

  let manifest = null;
  try {
    manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
    updateManifest(manifest, rosterPayload);
  } catch {
    // O pacote principal continua válido mesmo sem manifest local.
  }

  let report = {};
  try {
    report = JSON.parse(await readFile(REPORT_PATH, 'utf8'));
  } catch {
    report = {};
  }
  report.ratings = {
    generatedAt,
    source: 'SOFIFA_LATEST_WITH_CONSERVATIVE_FALLBACK',
    sofifaRoster: apiResult?.roster || null,
    matched: result.matched,
    estimated: result.estimated,
    heaven: { rating: heaven.rating, source: heaven.ratingSource },
    deLigt: { rating: deLigt.rating, source: deLigt.ratingSource }
  };

  await writeJsonAtomic(LOCAL_ROSTER_PATH, rosterPayload);
  await writeJsonAtomic(PUBLIC_ROSTER_PATH, rosterPayload);
  if (manifest) await writeJsonAtomic(MANIFEST_PATH, manifest);
  await writeJsonAtomic(REPORT_PATH, report);

  console.log(`\n✓ Ratings atualizados: ${result.matched} reais do SoFIFA · ${result.estimated} estimativas conservadoras.`);
  console.log(`✓ Manchester United validado: Ayden Heaven ${heaven.rating} · Matthijs de Ligt ${deLigt.rating}.`);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  main().catch(error => {
    console.error(`\nSync de ratings falhou: ${error.message}`);
    process.exitCode = 1;
  });
}

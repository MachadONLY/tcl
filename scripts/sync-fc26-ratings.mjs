import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { groupFromPositions, normalizeName } from './official-football-data.mjs';

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

export const CLUB_ALIASES = Object.freeze({
  ARS: ['arsenal'], AVL: ['aston villa'], BOU: ['afc bournemouth', 'bournemouth'],
  BRE: ['brentford'], BHA: ['brighton hove albion', 'brighton and hove albion', 'brighton'],
  CHE: ['chelsea'], COV: ['coventry city', 'coventry'], CRY: ['crystal palace'],
  EVE: ['everton'], FUL: ['fulham'], HUL: ['hull city', 'hull'], IPS: ['ipswich town', 'ipswich'],
  LEE: ['leeds united', 'leeds'], LIV: ['liverpool'], MCI: ['manchester city', 'man city'],
  MUN: ['manchester united', 'man utd'], NEW: ['newcastle united', 'newcastle'],
  NFO: ['nottingham forest'], SUN: ['sunderland'], TOT: ['tottenham hotspur', 'tottenham', 'spurs']
});

const REFERENCE_RULES = Object.freeze([
  Object.freeze({ clubCode: 'MUN', aliases: ['Ayden Heaven'], maximum: 74, requireReal: true }),
  Object.freeze({ clubCode: 'MUN', aliases: ['Matthijs de Ligt'], minimum: 79, requireReal: true }),
  Object.freeze({ clubCode: 'NEW', aliases: ['Sandro Tonali'], minimum: 84, requireReal: true }),
  Object.freeze({ clubCode: 'MCI', aliases: ['Rúben Dias', 'Ruben Dias'], minimum: 84, requireReal: true })
]);

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const clean = value => String(value ?? '').replace(/\s+/g, ' ').trim();

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
  if (!normalized) return false;
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
    displayName(record), record.commonName, record.long_name, record.longName,
    record.short_name, record.shortName,
    `${record.firstName ?? record.first_name ?? ''} ${record.lastName ?? record.last_name ?? ''}`,
    slugAlias(record)
  ]);
  if (!names.length) return null;
  const positions = clean(record.player_positions ?? record.positions ?? record.position ??
    [record.position1, record.position2, record.position3, record.position4]
      .filter(value => value != null && value !== -1).join(', '));
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
  return (await fetchResponse(url)).json();
}

function chooseLatestRoster(leaguesPayload) {
  const leagues = Array.isArray(leaguesPayload?.data) ? leaguesPayload.data : [];
  const premier = leagues.filter(row => Number(row.id) === 13 || normalizeName(row.name) === 'premier league');
  const candidates = premier
    .flatMap(row => [row.latestRoster, row.roster])
    .map(clean)
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

  if (rows.length < 250) throw new Error(`API do SoFIFA retornou apenas ${rows.length} jogadores`);
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

export function isRealRatingSource(source) {
  return /^SOFIFA_(?:API|DATASET)_/i.test(String(source || '')) || /^EA_SPORTS_FC_26_OFFICIAL$/i.test(String(source || ''));
}

function indexRatings(ratingRows) {
  const exact = new Map();
  for (const row of ratingRows) {
    for (const alias of row.names || []) {
      const bucket = exact.get(alias) || [];
      bucket.push(row);
      exact.set(alias, bucket);
    }
  }
  return { exact, rows: ratingRows };
}

function tokenSet(value) {
  return new Set(normalizeName(value).split(' ').filter(token => token.length > 1));
}

function diceCoefficient(left, right) {
  const a = normalizeName(left).replace(/\s+/g, '');
  const b = normalizeName(right).replace(/\s+/g, '');
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const pairs = new Map();
  for (let index = 0; index < a.length - 1; index += 1) {
    const pair = a.slice(index, index + 2);
    pairs.set(pair, (pairs.get(pair) || 0) + 1);
  }
  let matches = 0;
  for (let index = 0; index < b.length - 1; index += 1) {
    const pair = b.slice(index, index + 2);
    const count = pairs.get(pair) || 0;
    if (count) {
      matches += 1;
      pairs.set(pair, count - 1);
    }
  }
  return (2 * matches) / (a.length + b.length - 2);
}

function nameSimilarity(left, right) {
  const a = tokenSet(left);
  const b = tokenSet(right);
  const intersection = [...a].filter(token => b.has(token)).length;
  const union = new Set([...a, ...b]).size || 1;
  return Math.max(intersection / union, diceCoefficient(left, right));
}

function candidateScore(candidate, player, clubCode, similarity = 1) {
  let score = candidate.source === 'SOFIFA_API_LATEST' ? 100 : 70;
  if (candidate.teamCode === clubCode || teamMatches(clubCode, candidate.teamName)) score += 32;
  const age = finiteAge(player.age);
  if (age && candidate.age) {
    const difference = Math.abs(age - candidate.age);
    score += difference === 0 ? 14 : difference === 1 ? 8 : difference === 2 ? 3 : difference >= 4 ? -16 : 0;
  }
  if (candidate.group && player.group) score += candidate.group === player.group ? 12 : -20;
  score += Math.round(similarity * 30);
  return score;
}

export function matchRating(player, clubCode, index) {
  const normalized = normalizeName(player.name);
  const exactMap = index instanceof Map ? index : index.exact;
  const allRows = index instanceof Map ? [...new Set([...index.values()].flat())] : index.rows;
  const exactCandidates = exactMap.get(normalized) || [];
  if (exactCandidates.length) {
    return [...exactCandidates]
      .sort((a, b) => candidateScore(b, player, clubCode) - candidateScore(a, player, clubCode))[0] || null;
  }

  const fuzzy = [];
  for (const candidate of allRows || []) {
    const sameTeam = candidate.teamCode === clubCode || teamMatches(clubCode, candidate.teamName);
    const sameGroup = !candidate.group || !player.group || candidate.group === player.group;
    const age = finiteAge(player.age);
    const ageClose = !age || !candidate.age || Math.abs(age - candidate.age) <= 2;
    if (!sameGroup || !ageClose) continue;
    const similarity = Math.max(...(candidate.names || []).map(alias => nameSimilarity(normalized, alias)), 0);
    const minimum = sameTeam ? 0.72 : 0.88;
    if (similarity < minimum) continue;
    fuzzy.push({ candidate, similarity, score: candidateScore(candidate, player, clubCode, similarity) });
  }
  fuzzy.sort((a, b) => b.score - a.score);
  const best = fuzzy[0];
  if (!best || (best.score < 105 && !teamMatches(clubCode, best.candidate.teamName) && best.candidate.teamCode !== clubCode)) return null;
  return { ...best.candidate, matchMethod: 'FUZZY_NAME', matchScore: best.score };
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function percentile(values, fraction) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function safeEstimate(player, clubMatches, groupMatches) {
  const clubRatings = clubMatches.map(entry => entry.player.rating);
  const groupRatings = groupMatches.map(entry => entry.player.rating);
  const seniorRatings = groupMatches
    .filter(entry => (finiteAge(entry.player.age) ?? 0) >= 24)
    .map(entry => entry.player.rating);
  const base = median(groupRatings) ?? median(clubRatings) ?? 68;
  const age = finiteAge(player.age);
  let estimate = Math.round(base);
  let cap = Math.min(79, Math.floor(percentile(groupRatings, 0.75) ?? base));

  if (age != null && age <= 18) {
    estimate -= 5;
    cap = Math.min(cap, 72, Math.floor((median(seniorRatings) ?? base) - 6));
  } else if (age != null && age <= 21) {
    estimate -= 4;
    cap = Math.min(cap, 74, Math.floor((median(seniorRatings) ?? base) - 5));
  } else if (age != null && age <= 23) {
    estimate -= 2;
    cap = Math.min(cap, 77, Math.floor((median(seniorRatings) ?? base) - 3));
  } else if (age != null && age >= 34) {
    estimate -= 1;
  }

  return clamp(Math.min(estimate, Math.max(55, cap)), 55, 79);
}

export function applyRatings(rosterPayload, ratingRows) {
  const index = indexRatings(ratingRows);
  const matches = [];
  const unmatched = [];
  const sourceCounts = {};

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
        player.ratingMatchMethod = match.matchMethod || 'EXACT_NAME';
        matches.push({ clubCode, player, match });
        sourceCounts[match.source] = (sourceCounts[match.source] || 0) + 1;
      } else {
        unmatched.push({ clubCode, player });
      }
    }
  }

  for (const { clubCode, player } of unmatched) {
    const clubMatches = matches.filter(entry => entry.clubCode === clubCode);
    const groupMatches = clubMatches.filter(entry => entry.player.group === player.group);
    player.rating = safeEstimate(player, clubMatches, groupMatches);
    player.potential = null;
    player.ratingSource = 'TOUCHLINE_CONSERVATIVE_POSITION_ESTIMATE';
    player.sofifaPlayerId = null;
    player.ratingRoster = null;
    player.ratingUpdatedAt = null;
    player.ratingMatchMethod = null;
  }

  return { matched: matches.length, estimated: unmatched.length, sourceCounts };
}

function findPlayer(players, aliases) {
  const names = new Set(aliases.map(normalizeName));
  return players.find(player => names.has(normalizeName(player.name))) || null;
}

export function auditRatings(rosterPayload, options = {}) {
  const minimumGlobalRealCoverage = options.minimumGlobalRealCoverage ?? 0.65;
  const minimumClubRealCoverage = options.minimumClubRealCoverage ?? 0.45;
  const strictReferences = options.strictReferences ?? true;
  const issues = [];
  const teamReports = {};
  let total = 0;
  let real = 0;
  let estimated = 0;

  const clubs = Object.entries(rosterPayload.rosters || {});
  if (clubs.length !== 20) issues.push(`esperados 20 clubes, encontrados ${clubs.length}`);

  for (const [clubCode, players] of clubs) {
    const invalid = players.filter(player => !finiteRating(player.rating));
    const realPlayers = players.filter(player => isRealRatingSource(player.ratingSource));
    const estimatedPlayers = players.filter(player => !isRealRatingSource(player.ratingSource));
    const coverage = players.length ? realPlayers.length / players.length : 0;
    total += players.length;
    real += realPlayers.length;
    estimated += estimatedPlayers.length;

    if (invalid.length) issues.push(`[${clubCode}] ${invalid.length} ratings inválidos`);
    if (coverage < minimumClubRealCoverage) {
      issues.push(`[${clubCode}] cobertura real baixa: ${(coverage * 100).toFixed(1)}%`);
    }
    if (estimatedPlayers.some(player => player.rating > 79)) {
      issues.push(`[${clubCode}] estimativa acima de 79`);
    }
    if (estimatedPlayers.some(player => (finiteAge(player.age) ?? 99) <= 21 && player.rating > 74)) {
      issues.push(`[${clubCode}] jovem estimado acima de 74`);
    }

    for (const group of ['GK', 'DEF', 'MID', 'FWD']) {
      const established = realPlayers.filter(player => player.group === group && (finiteAge(player.age) ?? 0) >= 24 && player.rating >= 80);
      const estimatedYouth = estimatedPlayers.filter(player => player.group === group && (finiteAge(player.age) ?? 99) <= 21);
      for (const youth of estimatedYouth) {
        for (const senior of established) {
          if (youth.rating >= senior.rating) {
            issues.push(`[${clubCode}] ${youth.name} (${youth.rating}, estimado) não pode superar ${senior.name} (${senior.rating}, real)`);
          }
        }
      }
    }

    teamReports[clubCode] = {
      total: players.length,
      real: realPlayers.length,
      estimated: estimatedPlayers.length,
      coverage: Number(coverage.toFixed(4)),
      maximumEstimated: estimatedPlayers.length ? Math.max(...estimatedPlayers.map(player => player.rating)) : null,
      topRated: [...players].sort((a, b) => b.rating - a.rating).slice(0, 5).map(player => ({
        name: player.name, rating: player.rating, source: player.ratingSource
      }))
    };
  }

  const globalCoverage = total ? real / total : 0;
  if (globalCoverage < minimumGlobalRealCoverage) {
    issues.push(`cobertura real global baixa: ${(globalCoverage * 100).toFixed(1)}%`);
  }

  if (strictReferences) {
    for (const rule of REFERENCE_RULES) {
      const player = findPlayer(rosterPayload.rosters?.[rule.clubCode] || [], rule.aliases);
      if (!player) {
        issues.push(`[${rule.clubCode}] referência ausente: ${rule.aliases[0]}`);
        continue;
      }
      if (rule.requireReal && !isRealRatingSource(player.ratingSource)) {
        issues.push(`[${rule.clubCode}] ${player.name} não recebeu rating real`);
      }
      if (rule.minimum != null && player.rating < rule.minimum) {
        issues.push(`[${rule.clubCode}] ${player.name} ${player.rating} abaixo do piso ${rule.minimum}`);
      }
      if (rule.maximum != null && player.rating > rule.maximum) {
        issues.push(`[${rule.clubCode}] ${player.name} ${player.rating} acima do teto ${rule.maximum}`);
      }
    }

    const united = rosterPayload.rosters?.MUN || [];
    const heaven = findPlayer(united, ['Ayden Heaven']);
    const deLigt = findPlayer(united, ['Matthijs de Ligt']);
    if (heaven && deLigt && deLigt.rating <= heaven.rating) {
      issues.push(`[MUN] De Ligt ${deLigt.rating} deve estar acima de Heaven ${heaven.rating}`);
    }

    const newcastle = rosterPayload.rosters?.NEW || [];
    const tonali = findPlayer(newcastle, ['Sandro Tonali']);
    const newcastleYouth = newcastle.filter(player => player.group === 'MID' && (finiteAge(player.age) ?? 99) <= 21 && !isRealRatingSource(player.ratingSource));
    if (tonali && newcastleYouth.some(player => player.rating >= tonali.rating)) {
      issues.push(`[NEW] jovem estimado não pode superar Tonali ${tonali.rating}`);
    }

    const city = rosterPayload.rosters?.MCI || [];
    const dias = findPlayer(city, ['Rúben Dias', 'Ruben Dias']);
    const cityYouth = city.filter(player => player.group === 'DEF' && (finiteAge(player.age) ?? 99) <= 21 && !isRealRatingSource(player.ratingSource));
    if (dias && cityYouth.some(player => player.rating >= dias.rating)) {
      issues.push(`[MCI] jovem estimado não pode superar Rúben Dias ${dias.rating}`);
    }
  }

  return {
    passed: issues.length === 0,
    issues,
    teamCount: clubs.length,
    playerCount: total,
    realCount: real,
    estimatedCount: estimated,
    globalCoverage: Number(globalCoverage.toFixed(4)),
    teamReports
  };
}

async function writeJsonAtomic(destination, value) {
  const temporary = `${destination}.next`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rm(destination, { force: true });
  await rename(temporary, destination);
}

function updateManifest(manifest, rosterPayload, audit) {
  const byClubAndName = new Map();
  for (const [clubCode, players] of Object.entries(rosterPayload.rosters || {})) {
    for (const player of players) byClubAndName.set(`${clubCode}:${normalizeName(player.name)}`, player);
  }
  for (const record of Object.values(manifest.players || {})) {
    const player = byClubAndName.get(`${record.clubCode}:${normalizeName(record.name)}`);
    if (!player) continue;
    for (const key of ['rating', 'potential', 'ratingSource', 'sofifaPlayerId', 'ratingRoster', 'ratingUpdatedAt', 'ratingMatchMethod']) {
      record[key] = player[key] ?? null;
    }
  }
  manifest.ratingSource = 'SOFIFA_LATEST_WITH_CONSERVATIVE_FALLBACK';
  manifest.sofifaRatingCount = audit.realCount;
  manifest.estimatedRatingCount = audit.estimatedCount;
  manifest.ratingAuditPassed = audit.passed;
  manifest.ratingAuditTeamCount = audit.teamCount;
  manifest.ratingsGeneratedAt = new Date().toISOString();
}

export async function main() {
  const rosterPayload = JSON.parse(await readFile(LOCAL_ROSTER_PATH, 'utf8').catch(() => {
    throw new Error('Pacote de elencos não encontrado. Rode primeiro npm run sync:full-rosters.');
  }));

  let apiResult = null;
  let datasetResult = null;
  try {
    console.log('Lendo o roster mais recente da API pública do SoFIFA...');
    apiResult = await loadLatestSofifaRatings();
    console.log(`✓ SoFIFA API: ${apiResult.rows.length} jogadores · roster ${apiResult.roster}.`);
  } catch (error) {
    console.warn(`SoFIFA API indisponível: ${error.message}`);
  }

  try {
    console.log('Carregando base completa do FC 26 como fallback...');
    datasetResult = await loadDatasetFallback();
    console.log(`✓ Dataset FC 26: ${datasetResult.rows.length} jogadores.`);
  } catch (error) {
    console.warn(`Dataset de fallback indisponível: ${error.message}`);
  }

  const ratingRows = [...(apiResult?.rows || []), ...(datasetResult?.rows || [])];
  if (ratingRows.length < 250) throw new Error('Nenhuma fonte real de ratings ficou disponível; os arquivos atuais foram preservados.');

  const result = applyRatings(rosterPayload, ratingRows);
  const audit = auditRatings(rosterPayload);
  if (!audit.passed) {
    console.error('\nAuditoria dos 20 clubes reprovada:');
    for (const issue of audit.issues) console.error(`- ${issue}`);
    throw new Error('ratings inconsistentes; nenhum arquivo foi alterado');
  }

  const generatedAt = new Date().toISOString();
  rosterPayload.meta = {
    ...(rosterPayload.meta || {}),
    ratingSource: 'SOFIFA_LATEST_WITH_CONSERVATIVE_FALLBACK',
    sofifaRoster: apiResult?.roster || null,
    sofifaRatingCount: audit.realCount,
    estimatedRatingCount: audit.estimatedCount,
    ratingsGeneratedAt: generatedAt,
    ratingAuditPassed: true,
    ratingAuditTeamCount: audit.teamCount,
    ratingAuditGlobalCoverage: audit.globalCoverage,
    ratingsAttribution: 'SoFIFA API; FC 26 dataset by rovnez, CC BY 4.0'
  };

  let manifest = null;
  try {
    manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
    updateManifest(manifest, rosterPayload, audit);
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
    sourceCounts: result.sourceCounts,
    matched: result.matched,
    estimated: result.estimated,
    audit
  };

  await writeJsonAtomic(LOCAL_ROSTER_PATH, rosterPayload);
  await writeJsonAtomic(PUBLIC_ROSTER_PATH, rosterPayload);
  if (manifest) await writeJsonAtomic(MANIFEST_PATH, manifest);
  await writeJsonAtomic(REPORT_PATH, report);

  console.log('\nAuditoria completa dos 20 clubes:');
  for (const [clubCode, team] of Object.entries(audit.teamReports)) {
    console.log(`✓ [${clubCode}] ${team.real}/${team.total} ratings reais · ${team.estimated} estimativas · maior estimativa ${team.maximumEstimated ?? 'nenhuma'}`);
  }
  const heaven = findPlayer(rosterPayload.rosters.MUN, ['Ayden Heaven']);
  const deLigt = findPlayer(rosterPayload.rosters.MUN, ['Matthijs de Ligt']);
  const tonali = findPlayer(rosterPayload.rosters.NEW, ['Sandro Tonali']);
  const dias = findPlayer(rosterPayload.rosters.MCI, ['Rúben Dias', 'Ruben Dias']);
  console.log(`\n✓ ${audit.realCount}/${audit.playerCount} jogadores seguem SoFIFA/FC 26; ${audit.estimatedCount} usam fallback conservador.`);
  console.log(`✓ Referências: Heaven ${heaven.rating} · De Ligt ${deLigt.rating} · Tonali ${tonali.rating} · Rúben Dias ${dias.rating}.`);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (invokedDirectly) {
  main().catch(error => {
    console.error(`\nSync de ratings falhou: ${error.message}`);
    process.exitCode = 1;
  });
}

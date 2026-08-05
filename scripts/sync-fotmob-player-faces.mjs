import { createHash } from 'node:crypto';
import { mkdir, readdir, rm, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLUB_BY_CODE } from '../src/career-core/season-2026-27.js';
import { squadFor } from '../src/career-core/career-core.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIR = path.join(ROOT, 'public', 'assets', 'players', '2026-27');
const MANIFEST_PATH = path.join(OUTPUT_DIR, 'manifest.json');
const TEMP_MANIFEST_PATH = path.join(OUTPUT_DIR, 'manifest.next.json');
const REPORT_PATH = path.join(OUTPUT_DIR, 'fotmob-sync-report.json');
const SEARCH_API = term => `https://apigw.fotmob.com/searchapi/suggest?term=${encodeURIComponent(term)}&lang=en`;
const FACE_URL = id => `https://images.fotmob.com/image_resources/playerimages/${id}.png`;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Touchline/0.3';
const CLUB_CODES = Object.freeze([
  'ARS', 'AVL', 'BOU', 'BRE', 'BHA', 'CHE', 'COV', 'CRY', 'EVE', 'FUL',
  'HUL', 'IPS', 'LEE', 'LIV', 'MCI', 'MUN', 'NEW', 'NFO', 'SUN', 'TOT'
]);
const CLUB_SEARCH_NAMES = Object.freeze({
  ARS: ['Arsenal'], AVL: ['Aston Villa'], BOU: ['Bournemouth'], BRE: ['Brentford'],
  BHA: ['Brighton'], CHE: ['Chelsea'], COV: ['Coventry'], CRY: ['Crystal Palace'],
  EVE: ['Everton'], FUL: ['Fulham'], HUL: ['Hull City'], IPS: ['Ipswich'],
  LEE: ['Leeds United', 'Leeds'], LIV: ['Liverpool'], MCI: ['Manchester City', 'Man City'],
  MUN: ['Manchester United', 'Man United'], NEW: ['Newcastle United', 'Newcastle'],
  NFO: ['Nottingham Forest', 'Nottm Forest'], SUN: ['Sunderland'], TOT: ['Tottenham', 'Spurs']
});
const NAME_ALIASES = Object.freeze({
  'Đorđe Petrović': ['Djordje Petrovic'],
  'João Gomes': ['Joao Gomes'],
  'João Pedro': ['Joao Pedro'],
  'Joël Piroe': ['Joel Piroe'],
  'Jørgen Strand Larsen': ['Jorgen Strand Larsen'],
  'Lukás Horníček': ['Lukas Hornicek'],
  'Moisés Caicedo': ['Moises Caicedo'],
  'Nicolò Savona': ['Nicolo Savona'],
  'Saša Lukić': ['Sasa Lukic'],
  'Viktor Gyökeres': ['Viktor Gyokeres'],
  'Yéremy Pino': ['Yeremy Pino']
});
const searchCache = new Map();

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.'’`-]/g, ' ')
    .replace(/\b(jr|junior|sr|ii|iii|iv)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function compact(value) {
  return normalize(value).replace(/\s+/g, '');
}

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function fetchWithRetry(url, options = {}, attempts = 5) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'user-agent': USER_AGENT,
          accept: '*/*',
          ...(options.headers || {})
        }
      });
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status}: ${url}`);
      if (response.status < 500 && response.status !== 429) break;
    } catch (error) {
      lastError = error;
    }
    await sleep(450 * attempt);
  }
  throw lastError || new Error(`Falha ao acessar ${url}`);
}

async function getJson(url) {
  const response = await fetchWithRetry(url, {
    headers: { accept: 'application/json,text/plain,*/*' }
  });
  return response.json();
}

function collectPlayerRows(value, found = []) {
  if (!value || typeof value !== 'object') return found;
  if (Array.isArray(value)) {
    for (const item of value) collectPlayerRows(item, found);
    return found;
  }

  const id = Number(value.id ?? value.playerId);
  const name = value.name || value.fullName || value.playerName;
  const teamName = value.teamName || value.team?.name || value.clubName || '';
  const type = normalize(value.type || value.entityType || value.suggestType || '');
  if (id && name && !type.includes('team') && !type.includes('match')) {
    found.push({ id, name: String(name), teamName: String(teamName) });
  }
  for (const child of Object.values(value)) collectPlayerRows(child, found);
  return found;
}

function uniquePlayers(rows) {
  const byId = new Map();
  for (const row of rows) {
    if (!byId.has(row.id)) byId.set(row.id, row);
  }
  return [...byId.values()];
}

function extractSearchPlayers(payload) {
  const rows = [];
  for (const section of payload?.squadMemberSuggest || []) {
    for (const option of section?.options || []) {
      const item = option?.payload || option;
      const id = Number(item?.id ?? item?.playerId);
      const name = item?.name || item?.fullName || item?.playerName;
      if (id && name) rows.push({
        id,
        name: String(name),
        teamName: String(item?.teamName || item?.team?.name || '')
      });
    }
  }
  return uniquePlayers(rows.length ? rows : collectPlayerRows(payload));
}

async function searchFotMob(term) {
  const key = normalize(term);
  if (!searchCache.has(key)) {
    searchCache.set(key, getJson(SEARCH_API(term)).then(extractSearchPlayers));
  }
  return searchCache.get(key);
}

function teamMatches(candidateTeamName, clubCode) {
  const remote = normalize(candidateTeamName);
  if (!remote) return false;
  return (CLUB_SEARCH_NAMES[clubCode] || [])
    .map(normalize)
    .some(expected => remote.includes(expected) || expected.includes(remote));
}

function scoreCandidate(player, clubCode, candidate) {
  const target = normalize(player.name);
  const remote = normalize(candidate.name);
  const aliases = (NAME_ALIASES[player.name] || []).map(normalize);
  let score = 0;

  if (remote === target || aliases.includes(remote)) score += 1000;
  if (compact(remote) === compact(target)) score += 850;

  const targetParts = new Set(target.split(' ').filter(Boolean));
  const remoteParts = new Set(remote.split(' ').filter(Boolean));
  let overlap = 0;
  for (const part of targetParts) if (remoteParts.has(part)) overlap += 1;
  score += overlap * 45;
  score -= Math.abs(targetParts.size - remoteParts.size) * 12;
  if (teamMatches(candidate.teamName, clubCode)) score += 160;
  return score;
}

async function resolvePlayer(player, clubCode) {
  const clubName = CLUB_BY_CODE.get(clubCode)?.name || clubCode;
  const terms = [
    `${player.name} ${clubName}`,
    player.name,
    ...(NAME_ALIASES[player.name] || []).flatMap(alias => [`${alias} ${clubName}`, alias])
  ];
  const candidates = [];

  for (const term of terms) {
    const found = await searchFotMob(term);
    candidates.push(...found);
    const exactForClub = found.find(candidate =>
      normalize(candidate.name) === normalize(player.name) && teamMatches(candidate.teamName, clubCode)
    );
    if (exactForClub) return { ...exactForClub, resolvedBy: 'fotmob-search-team-exact' };
    await sleep(55);
  }

  const ranked = uniquePlayers(candidates)
    .map(candidate => ({ candidate, score: scoreCandidate(player, clubCode, candidate) }))
    .sort((left, right) => right.score - left.score);
  const best = ranked[0];
  const runnerUp = ranked[1];

  if (!best || best.score < 900) return null;
  if (runnerUp && best.score === runnerUp.score && best.candidate.id !== runnerUp.candidate.id) return null;
  return { ...best.candidate, resolvedBy: teamMatches(best.candidate.teamName, clubCode)
    ? 'fotmob-search-team-ranked'
    : 'fotmob-search-name-ranked' };
}

function isPng(bytes) {
  return bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
}

async function downloadExactFotMobPortrait(fotmobId, destination) {
  const remoteUrl = FACE_URL(fotmobId);
  const response = await fetchWithRetry(remoteUrl, {
    headers: { accept: 'image/png,image/*;q=0.9,*/*;q=0.5' }
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  const contentType = String(response.headers.get('content-type') || '');
  if (!contentType.startsWith('image/') || bytes.length < 1000 || !isPng(bytes)) {
    throw new Error(`A imagem ${fotmobId} não é o PNG original esperado do FotMob`);
  }
  await writeFile(destination, bytes);
  return {
    remoteUrl,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex')
  };
}

async function removeOldPortraits() {
  const entries = await readdir(OUTPUT_DIR, { withFileTypes: true }).catch(() => []);
  await Promise.all(entries
    .filter(entry => entry.isFile() && /^(ars|avl|bou|bre|bha|che|cov|cry|eve|ful|hul|ips|lee|liv|mci|mun|new|nfo|sun|tot)-\d+\.png$/i.test(entry.name))
    .map(entry => rm(path.join(OUTPUT_DIR, entry.name), { force: true })));
}

async function mapLimit(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const jobs = CLUB_CODES.flatMap(clubCode => squadFor(clubCode).map(player => ({ clubCode, player })));
  const manifest = {
    schemaVersion: 2,
    source: 'fotmob-playerimages-exact',
    sourceHost: 'images.fotmob.com',
    generatedAt: new Date().toISOString(),
    expectedPlayerCount: jobs.length,
    playerCount: 0,
    coverage: 0,
    teams: Object.fromEntries(CLUB_CODES.map(code => [code, {
      expected: squadFor(code).length,
      resolved: 0
    }])),
    players: {}
  };
  const unresolved = [];
  const pendingFiles = [];

  console.log(`Sincronizando ${jobs.length} jogadores com as fotos exatas do FotMob...`);
  await mapLimit(jobs, 4, async ({ clubCode, player }, index) => {
    try {
      const match = await resolvePlayer(player, clubCode);
      if (!match) throw new Error('ID exato do FotMob não encontrado sem ambiguidade');
      const fileName = `${clubCode.toLowerCase()}-${match.id}.png`;
      const temporaryPath = path.join(OUTPUT_DIR, `${fileName}.next`);
      const localPath = `/assets/players/2026-27/${fileName}`;
      const image = await downloadExactFotMobPortrait(match.id, temporaryPath);
      pendingFiles.push({ temporaryPath, finalPath: path.join(OUTPUT_DIR, fileName) });
      manifest.players[player.id] = {
        playerId: player.id,
        fotmobId: match.id,
        clubCode,
        name: player.name,
        fotmobName: match.name,
        fotmobTeamName: match.teamName || null,
        resolvedBy: match.resolvedBy,
        localPath,
        remoteUrl: image.remoteUrl,
        bytes: image.bytes,
        sha256: image.sha256
      };
      manifest.playerCount += 1;
      manifest.teams[clubCode].resolved += 1;
      console.log(`${String(index + 1).padStart(3, '0')}/${jobs.length} ✓ [${clubCode}] ${player.name} → ${match.id}`);
    } catch (error) {
      unresolved.push({ playerId: player.id, clubCode, name: player.name, error: error.message });
      console.error(`${String(index + 1).padStart(3, '0')}/${jobs.length} ✗ [${clubCode}] ${player.name}: ${error.message}`);
    }
  });

  manifest.coverage = manifest.expectedPlayerCount
    ? Number((manifest.playerCount / manifest.expectedPlayerCount).toFixed(4))
    : 0;

  await writeFile(REPORT_PATH, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    expected: manifest.expectedPlayerCount,
    resolved: manifest.playerCount,
    unresolved
  }, null, 2)}\n`, 'utf8');

  if (unresolved.length || manifest.playerCount !== manifest.expectedPlayerCount) {
    await Promise.all(pendingFiles.map(file => rm(file.temporaryPath, { force: true })));
    throw new Error(`Cobertura incompleta: ${manifest.playerCount}/${manifest.expectedPlayerCount}. Veja ${path.relative(ROOT, REPORT_PATH)}`);
  }

  await removeOldPortraits();
  for (const file of pendingFiles) await rename(file.temporaryPath, file.finalPath);
  await writeFile(TEMP_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await rename(TEMP_MANIFEST_PATH, MANIFEST_PATH);

  const manifestStat = await stat(MANIFEST_PATH);
  console.log(`\n✓ ${manifest.playerCount}/${manifest.expectedPlayerCount} fotos exatas do FotMob salvas localmente.`);
  console.log(`✓ Manifesto: ${path.relative(ROOT, MANIFEST_PATH)} (${manifestStat.size} bytes)`);
  console.log('✓ Depois desta sincronização, a tela de elenco usa os arquivos locais e funciona offline.');
}

main().catch(error => {
  console.error(`\nSync FotMob falhou: ${error.message}`);
  process.exitCode = 1;
});

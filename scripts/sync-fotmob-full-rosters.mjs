import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  matchEaRating,
  normalizeName,
  parseFotMobSquadHtml,
  primaryPosition
} from './official-football-data.mjs';
import { parseOfficialEaRatingsHtml } from './official-ea-ratings.mjs';
import { sanitizeRosterRows } from '../src/career-core/roster-integrity.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = path.join(ROOT, 'public', 'assets', 'players', '2026-27');
const LOCAL_ROSTER_PATH = path.join(ROOT, 'src', 'career-core', 'fotmob-rosters.local.json');
const PUBLIC_ROSTER_PATH = path.join(PUBLIC_DIR, 'rosters.json');
const MANIFEST_PATH = path.join(PUBLIC_DIR, 'manifest.json');
const REPORT_PATH = path.join(PUBLIC_DIR, 'fotmob-sync-report.json');
const EA_CACHE_PATH = path.join(ROOT, 'src', 'career-core', 'ea-fc26-ratings.local.json');
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36';
const PHOTO_URL = id => `https://images.fotmob.com/image_resources/playerimages/${id}.png`;
const EA_RATINGS_ID = 'EASFC_PLAYER_RATINGS_PITCH_NOTES_URL';
const EA_URLS = page => [
  `https://www.ea.com/games/ea-sports-fc/ratings?id=${EA_RATINGS_ID}&gender=0&page=${page}`,
  `https://careers.ea.com/games/ea-sports-fc/ratings?id=${EA_RATINGS_ID}&gender=0&page=${page}`,
  `https://www.privacyappendix.ea.com/games/ea-sports-fc/ratings?id=${EA_RATINGS_ID}&gender=0&page=${page}`
];

const TEAMS = Object.freeze({
  ARS: { id: 9825, slug: 'arsenal' }, AVL: { id: 10252, slug: 'aston-villa' },
  BOU: { id: 8678, slug: 'bournemouth' }, BRE: { id: 9937, slug: 'brentford' },
  BHA: { id: 10204, slug: 'brighton-and-hove-albion' }, CHE: { id: 8455, slug: 'chelsea' },
  COV: { id: 8669, slug: 'coventry-city' }, CRY: { id: 9826, slug: 'crystal-palace' },
  EVE: { id: 8668, slug: 'everton' }, FUL: { id: 9879, slug: 'fulham' },
  HUL: { id: 8667, slug: 'hull-city' }, IPS: { id: 9902, slug: 'ipswich-town' },
  LEE: { id: 8463, slug: 'leeds-united' }, LIV: { id: 8650, slug: 'liverpool' },
  MCI: { id: 8456, slug: 'manchester-city' }, MUN: { id: 10260, slug: 'manchester-united' },
  NEW: { id: 10261, slug: 'newcastle-united' }, NFO: { id: 10203, slug: 'nottingham-forest' },
  SUN: { id: 8472, slug: 'sunderland' }, TOT: { id: 8586, slug: 'tottenham-hotspur' }
});

const REQUIRED_MUN_PLAYERS = Object.freeze(['Andrey Santos', 'Youri Tielemans', 'Daniel Gore', 'Harry Amass']);

function hashString(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function corePlayerId(clubCode, name, index) {
  const seed = hashString(`${clubCode}:${name}`);
  return `${clubCode.toLowerCase()}-${index + 1}-${seed.toString(36).slice(0, 4)}`;
}

function sleep(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function fetchWithRetry(url, options = {}, attempts = 5) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        ...options,
        headers: {
          'user-agent': USER_AGENT,
          'accept-language': 'en-GB,en;q=0.9,pt-BR;q=0.7',
          ...(options.headers || {})
        }
      });
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status}: ${url}`);
      if (response.status < 500 && response.status !== 429) break;
    } catch (error) {
      lastError = error;
    }
    await sleep(400 * attempt);
  }
  throw lastError || new Error(`Falha ao acessar ${url}`);
}

async function writeJsonAtomic(destination, value) {
  const temporary = `${destination}.next`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rm(destination, { force: true });
  await rename(temporary, destination);
}

async function mapLimit(items, concurrency, worker) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index], index);
    }
  });
  await Promise.all(workers);
}

function isPng(bytes) {
  return bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
}

async function downloadPortrait(player) {
  const remoteUrl = PHOTO_URL(player.fotmobId);
  const response = await fetchWithRetry(remoteUrl, { headers: { accept: 'image/png,image/*;q=0.9,*/*;q=0.5' } });
  const bytes = Buffer.from(await response.arrayBuffer());
  const contentType = String(response.headers.get('content-type') || '');
  if (!contentType.startsWith('image/') || bytes.length < 500 || !isPng(bytes)) {
    throw new Error(`${player.clubCode} ${player.name}: PNG do FotMob inválido`);
  }
  const fileName = `${player.clubCode.toLowerCase()}-${player.fotmobId}.png`;
  const temporaryPath = path.join(PUBLIC_DIR, `${fileName}.next`);
  await writeFile(temporaryPath, bytes);
  return {
    fileName,
    temporaryPath,
    finalPath: path.join(PUBLIC_DIR, fileName),
    remoteUrl,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex')
  };
}

async function removeOldGeneratedFiles() {
  const entries = await readdir(PUBLIC_DIR, { withFileTypes: true }).catch(() => []);
  await Promise.all(entries
    .filter(entry => entry.isFile() && /^[a-z]{3}-\d+\.png$/i.test(entry.name))
    .map(entry => rm(path.join(PUBLIC_DIR, entry.name), { force: true })));
}

async function removeStaleTemporaryFiles() {
  const entries = await readdir(PUBLIC_DIR, { withFileTypes: true }).catch(() => []);
  await Promise.all(entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.next'))
    .map(entry => rm(path.join(PUBLIC_DIR, entry.name), { force: true })));
}

async function loadCachedEaRatings() {
  try {
    const cache = JSON.parse(await readFile(EA_CACHE_PATH, 'utf8'));
    if (cache?.source === 'EA_SPORTS_FC_26_OFFICIAL' && Array.isArray(cache.players) && cache.players.length > 10000) {
      return cache;
    }
  } catch {
    // A fresh checkout does not have the local cache yet.
  }
  return null;
}

function pageCountFromEaHtml(html) {
  const pages = [...String(html).matchAll(/[?&](?:amp;)?page=(\d+)/gi)].map(match => Number(match[1]));
  return Math.max(1, ...pages.filter(Number.isFinite));
}

async function fetchEaRatingsPage(page) {
  let lastError;
  for (const url of EA_URLS(page)) {
    try {
      const response = await fetchWithRetry(url, { headers: { accept: 'text/html,application/xhtml+xml' } }, 2);
      const html = await response.text();
      const players = parseOfficialEaRatingsHtml(html);
      if (players.length) return { html, players, url: response.url || url };
      lastError = new Error(`página ${page} sem jogadores em ${new URL(url).hostname}`);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error(`EA: página ${page} indisponível`);
}

async function scanOfficialEaRatings() {
  const cached = await loadCachedEaRatings();
  const refreshRequested = process.argv.includes('--refresh-ea');
  if (cached && !refreshRequested) {
    console.log(`✓ Base oficial EA SPORTS FC 26 em cache: ${cached.players.length} atletas.`);
    return cached;
  }
  if (process.env.CI) {
    console.log('CI: varredura integral da EA ignorada; ratings locais usarão fallback determinístico nos testes.');
    return { source: 'EA_SPORTS_FC_26_OFFICIAL', generatedAt: null, players: [], skippedInCI: true };
  }

  console.log('Lendo a base oficial de ratings do EA SPORTS FC 26...');
  let firstPage;
  try {
    firstPage = await fetchEaRatingsPage(1);
  } catch (error) {
    if (cached) {
      console.warn(`EA indisponível (${error.message}); mantendo cache oficial com ${cached.players.length} atletas.`);
      return cached;
    }
    console.warn(`EA indisponível (${error.message}); o elenco será sincronizado e ratings sem correspondência ficarão marcados como estimativa.`);
    return { source: 'EA_SPORTS_FC_26_OFFICIAL', generatedAt: null, players: [], unavailable: true };
  }

  const byId = new Map(firstPage.players.map(player => [player.eaPlayerId, player]));
  let maximumPage = pageCountFromEaHtml(firstPage.html);
  if (maximumPage < 20) maximumPage = 180;
  let emptyBatches = 0;

  for (let firstPageNumber = 2; firstPageNumber <= maximumPage && emptyBatches < 3; firstPageNumber += 5) {
    const pageNumbers = Array.from(
      { length: Math.min(5, maximumPage - firstPageNumber + 1) },
      (_, index) => firstPageNumber + index
    );
    let newRows = 0;
    await Promise.all(pageNumbers.map(async page => {
      try {
        const result = await fetchEaRatingsPage(page);
        for (const row of result.players) {
          if (!byId.has(row.eaPlayerId)) newRows += 1;
          byId.set(row.eaPlayerId, row);
        }
      } catch (error) {
        console.warn(`  EA página ${page}: ${error.message}`);
      }
    }));
    emptyBatches = newRows === 0 ? emptyBatches + 1 : 0;
    if ((firstPageNumber - 2) % 25 === 0) {
      console.log(`  EA: páginas ${firstPageNumber}-${pageNumbers.at(-1)} · ${byId.size} atletas`);
    }
    await sleep(90);
  }

  const players = [...byId.values()];
  if (players.length < 10000) {
    if (cached) {
      console.warn(`A leitura atual da EA retornou ${players.length} atletas; mantendo o cache oficial anterior com ${cached.players.length}.`);
      return cached;
    }
    console.warn(`A EA retornou apenas ${players.length} atletas. O sync continuará sem inventar overalls; apenas correspondências oficiais encontradas serão usadas.`);
    return {
      source: 'EA_SPORTS_FC_26_OFFICIAL',
      sourceUrl: firstPage.url,
      generatedAt: new Date().toISOString(),
      players,
      partial: true
    };
  }

  const cache = {
    source: 'EA_SPORTS_FC_26_OFFICIAL',
    sourceUrl: firstPage.url,
    generatedAt: new Date().toISOString(),
    players
  };
  await writeJsonAtomic(EA_CACHE_PATH, cache);
  console.log(`✓ Base oficial EA SPORTS FC 26: ${players.length} atletas.`);
  return cache;
}

async function validExistingPack() {
  try {
    const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
    const rosterPayload = JSON.parse(await readFile(LOCAL_ROSTER_PATH, 'utf8'));
    if (manifest.schemaVersion < 8 || manifest.source !== 'fotmob-official-full-squads') return false;
    if (manifest.coverage !== 1 || manifest.playerCount < 600 || Object.keys(manifest.teams || {}).length !== 20) return false;
    if (rosterPayload?.meta?.playerCount !== manifest.playerCount) return false;
    const united = rosterPayload.rosters?.MUN || [];
    if (united.some(row => normalizeName(row.name) === 'michael carrick')) return false;
    const andrey = united.find(row => normalizeName(row.name) === 'andrey santos');
    if (!andrey || andrey.group !== 'MID') return false;
    for (const record of Object.values(manifest.players || {})) {
      await readFile(path.join(ROOT, 'public', record.localPath.replace(/^\//, '')));
    }
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const force = process.argv.includes('--force');
  await mkdir(PUBLIC_DIR, { recursive: true });
  await removeStaleTemporaryFiles();

  if (!force && await validExistingPack()) {
    const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
    console.log(`✓ Pacote oficial já disponível: ${manifest.playerCount} jogadores em 20 clubes.`);
    return;
  }

  const eaRatings = await scanOfficialEaRatings();
  const teams = {};
  const failures = [];

  for (const [clubCode, team] of Object.entries(TEAMS)) {
    const url = `https://www.fotmob.com/teams/${team.id}/squad/${team.slug}`;
    try {
      const response = await fetchWithRetry(url, { headers: { accept: 'text/html,application/xhtml+xml' } });
      const parsed = parseFotMobSquadHtml(await response.text(), clubCode);
      const players = sanitizeRosterRows(parsed.players, { managerNames: [parsed.coach?.name] });
      if (players.length < 20) throw new Error(`apenas ${players.length} jogadores encontrados`);
      if (players.some(player => normalizeName(player.name) === normalizeName(parsed.coach?.name))) {
        throw new Error(`o técnico ${parsed.coach?.name} foi incluído como jogador`);
      }
      teams[clubCode] = { ...team, url, coach: parsed.coach, players };
      console.log(`✓ [${clubCode}] técnico separado + ${players.length} jogadores`);
    } catch (error) {
      failures.push({ clubCode, url, error: error.message });
      console.error(`✗ [${clubCode}] ${error.message}`);
    }
    await sleep(100);
  }

  const united = teams.MUN?.players || [];
  const unitedNames = new Set(united.map(player => normalizeName(player.name)));
  const missingUnited = REQUIRED_MUN_PLAYERS.filter(name => !unitedNames.has(normalizeName(name)));
  const andrey = united.find(player => normalizeName(player.name) === 'andrey santos');
  const youri = united.find(player => normalizeName(player.name) === 'youri tielemans');
  if (missingUnited.length) failures.push({ clubCode: 'MUN', error: `faltando: ${missingUnited.join(', ')}` });
  if (andrey?.group !== 'MID') failures.push({ clubCode: 'MUN', error: `Andrey Santos classificado como ${andrey?.group || 'sem posição'}` });
  if (youri?.group !== 'MID') failures.push({ clubCode: 'MUN', error: `Youri Tielemans classificado como ${youri?.group || 'sem posição'}` });

  const allPlayers = Object.entries(teams).flatMap(([clubCode, team]) =>
    team.players.map((player, index) => ({ ...player, clubCode, index }))
  );

  if (failures.length || Object.keys(teams).length !== 20 || allPlayers.length < 600) {
    await writeJsonAtomic(REPORT_PATH, {
      generatedAt: new Date().toISOString(), teamCount: Object.keys(teams).length,
      playerCount: allPlayers.length, failures
    });
    throw new Error(`Varredura incompleta: ${Object.keys(teams).length}/20 clubes e ${allPlayers.length} jogadores.`);
  }

  const pending = [];
  const manifestPlayers = {};
  const rosterRows = {};
  let officialRatingCount = 0;
  console.log(`Baixando ${allPlayers.length} fotos originais do FotMob...`);

  try {
    await mapLimit(allPlayers, 8, async (player, globalIndex) => {
      const image = await downloadPortrait(player);
      pending.push(image);
      const playerId = corePlayerId(player.clubCode, player.name, player.index);
      const ea = matchEaRating(player, eaRatings.players || []);
      if (ea) officialRatingCount += 1;
      const row = {
        name: player.name,
        group: player.group,
        position: player.position || primaryPosition('', player.group),
        number: player.number,
        age: player.age,
        fotmobId: player.fotmobId,
        rating: ea?.overall ?? null,
        ratingSource: ea ? 'EA_SPORTS_FC_26_OFFICIAL' : 'TOUCHLINE_ESTIMATE_NO_EA_MATCH',
        eaPlayerId: ea?.eaPlayerId ?? null
      };
      (rosterRows[player.clubCode] ||= [])[player.index] = row;
      manifestPlayers[playerId] = {
        playerId, ...row, clubCode: player.clubCode,
        localPath: `/assets/players/2026-27/${image.fileName}`,
        remoteUrl: image.remoteUrl, bytes: image.bytes, sha256: image.sha256
      };
      if ((globalIndex + 1) % 50 === 0 || globalIndex + 1 === allPlayers.length) {
        console.log(`  fotos: ${globalIndex + 1}/${allPlayers.length}`);
      }
    });
  } catch (error) {
    await Promise.all(pending.map(file => rm(file.temporaryPath, { force: true })));
    throw error;
  }

  const generatedAt = new Date().toISOString();
  const metaTeams = Object.fromEntries(Object.entries(teams).map(([clubCode, team]) => [clubCode, {
    fotmobTeamId: team.id,
    sourceUrl: team.url,
    coach: team.coach,
    playerCount: team.players.length,
    groups: Object.fromEntries(['GK', 'DEF', 'MID', 'FWD'].map(group => [group, team.players.filter(player => player.group === group).length]))
  }]));
  const rosterPayload = {
    meta: {
      source: 'fotmob-official-full-squads',
      positionSource: 'FOTMOB_OFFICIAL',
      ratingSource: 'EA_SPORTS_FC_26_OFFICIAL_WHEN_AVAILABLE',
      generatedAt, teamCount: 20, playerCount: allPlayers.length,
      officialRatingCount,
      teams: Object.fromEntries(Object.entries(metaTeams).map(([code, team]) => [code, team.playerCount])),
      coaches: Object.fromEntries(Object.entries(metaTeams).map(([code, team]) => [code, team.coach]))
    },
    rosters: rosterRows
  };
  const manifest = {
    schemaVersion: 8,
    source: 'fotmob-official-full-squads',
    positionSource: 'FOTMOB_OFFICIAL',
    ratingSource: 'EA_SPORTS_FC_26_OFFICIAL_WHEN_AVAILABLE',
    sourceHost: 'images.fotmob.com', generatedAt,
    teamCount: 20, expectedPlayerCount: allPlayers.length, playerCount: allPlayers.length,
    officialRatingCount, coverage: 1, teams: metaTeams, players: manifestPlayers
  };

  await removeOldGeneratedFiles();
  for (const file of pending) await rename(file.temporaryPath, file.finalPath);
  await writeJsonAtomic(LOCAL_ROSTER_PATH, rosterPayload);
  await writeJsonAtomic(PUBLIC_ROSTER_PATH, rosterPayload);
  await writeJsonAtomic(MANIFEST_PATH, manifest);
  await writeJsonAtomic(REPORT_PATH, {
    generatedAt, teamCount: 20, playerCount: allPlayers.length,
    officialRatingCount, failures: [],
    validation: {
      coachExcluded: !rosterRows.MUN.some(row => normalizeName(row.name) === 'michael carrick'),
      andreySantos: rosterRows.MUN.find(row => normalizeName(row.name) === 'andrey santos'),
      youriTielemans: rosterRows.MUN.find(row => normalizeName(row.name) === 'youri tielemans')
    }
  });

  console.log(`\n✓ Varredura completa: ${allPlayers.length} jogadores, 20 técnicos separados e posições oficiais do FotMob.`);
  console.log(`✓ Ratings oficiais EA SPORTS FC 26 encontrados para ${officialRatingCount}/${allPlayers.length} jogadores.`);
}

main().catch(error => {
  console.error(`\nSync oficial falhou: ${error.message}`);
  process.exitCode = 1;
});

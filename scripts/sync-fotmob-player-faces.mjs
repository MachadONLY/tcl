import { createHash } from 'node:crypto';
import { mkdir, readdir, rm, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { squadFor } from '../src/career-core/career-core.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIR = path.join(ROOT, 'public', 'assets', 'players', '2026-27');
const MANIFEST_PATH = path.join(OUTPUT_DIR, 'manifest.json');
const TEMP_MANIFEST_PATH = path.join(OUTPUT_DIR, 'manifest.next.json');
const REPORT_PATH = path.join(OUTPUT_DIR, 'fotmob-sync-report.json');
const FACE_URL = id => `https://images.fotmob.com/image_resources/playerimages/${id}.png`;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36';
const TEAMS = Object.freeze({
  ARS: { id: 9825, slug: 'arsenal' },
  AVL: { id: 10252, slug: 'aston-villa' },
  BOU: { id: 8678, slug: 'bournemouth' },
  BRE: { id: 9937, slug: 'brentford' },
  BHA: { id: 10204, slug: 'brighton-and-hove-albion' },
  CHE: { id: 8455, slug: 'chelsea' },
  COV: { id: 8669, slug: 'coventry-city' },
  CRY: { id: 9826, slug: 'crystal-palace' },
  EVE: { id: 8668, slug: 'everton' },
  FUL: { id: 9879, slug: 'fulham' },
  HUL: { id: 8667, slug: 'hull-city' },
  IPS: { id: 9902, slug: 'ipswich-town' },
  LEE: { id: 8463, slug: 'leeds-united' },
  LIV: { id: 8650, slug: 'liverpool' },
  MCI: { id: 8456, slug: 'manchester-city' },
  MUN: { id: 10260, slug: 'manchester-united' },
  NEW: { id: 10261, slug: 'newcastle-united' },
  NFO: { id: 10203, slug: 'nottingham-forest' },
  SUN: { id: 8472, slug: 'sunderland' },
  TOT: { id: 8586, slug: 'tottenham-hotspur' }
});
const SQUAD_URL = team => `https://www.fotmob.com/teams/${team.id}/squad/${team.slug}`;
const NAME_ALIASES = Object.freeze({
  'Đorđe Petrović': ['Djordje Petrovic'],
  'Benjamin Šeško': ['Benjamin Sesko'],
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

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&amp;/g, ' and ')
    .replace(/[.'’`_-]/g, ' ')
    .replace(/\b(jr|junior|sr|ii|iii|iv)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function compact(value) {
  return normalize(value).replace(/\s+/g, '');
}

function titleFromSlug(slug) {
  return decodeURIComponent(String(slug || ''))
    .replace(/\?.*$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&Oslash;/g, 'Ø')
    .replace(/&oslash;/g, 'ø')
    .replace(/\s+/g, ' ')
    .trim();
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
          accept: '*/*',
          'accept-language': 'en-GB,en;q=0.9',
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

function addCandidate(map, id, slug, visibleName, clubCode) {
  const numericId = Number(id);
  if (!numericId) return;
  const slugName = titleFromSlug(slug);
  const names = [...new Set([visibleName, slugName].filter(Boolean))];
  const existing = map.get(numericId);
  if (existing) {
    existing.names = [...new Set([...existing.names, ...names])];
    existing.clubCodes.add(clubCode);
    return;
  }
  map.set(numericId, {
    id: numericId,
    slug: String(slug || ''),
    names,
    clubCodes: new Set([clubCode])
  });
}

function extractPlayersFromHtml(rawHtml, clubCode) {
  const html = String(rawHtml || '')
    .replace(/\\u002F/gi, '/')
    .replace(/\\\//g, '/');
  const players = new Map();

  const anchorPattern = /<a\b[^>]*href=["'](?:https?:\/\/www\.fotmob\.com)?\/?(?:[a-z]{2}(?:-[A-Z]{2})?\/)?players\/(\d+)\/([^"'?#\\]+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorPattern)) {
    addCandidate(players, match[1], match[2], decodeHtml(match[3]), clubCode);
  }

  const linkPattern = /(?:https?:\/\/www\.fotmob\.com)?\/?(?:[a-z]{2}(?:-[A-Z]{2})?\/)?players\/(\d+)\/([a-zA-Z0-9%._-]+)/g;
  for (const match of html.matchAll(linkPattern)) {
    addCandidate(players, match[1], match[2], '', clubCode);
  }

  const jsonPattern = /["'](?:playerId|id)["']\s*:\s*(\d+)[\s\S]{0,260}?["'](?:playerName|fullName|name)["']\s*:\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(jsonPattern)) {
    addCandidate(players, match[1], normalize(match[2]).replace(/\s+/g, '-'), match[2], clubCode);
  }

  return [...players.values()];
}

async function loadOfficialFotMobSquads() {
  const allCandidates = new Map();
  const counts = {};

  for (const [clubCode, team] of Object.entries(TEAMS)) {
    const url = SQUAD_URL(team);
    const response = await fetchWithRetry(url, {
      headers: { accept: 'text/html,application/xhtml+xml' }
    });
    const html = await response.text();
    const candidates = extractPlayersFromHtml(html, clubCode);
    counts[clubCode] = candidates.length;
    if (candidates.length < 15) {
      throw new Error(`A página oficial do FotMob retornou apenas ${candidates.length} jogadores para ${clubCode}: ${url}`);
    }
    for (const candidate of candidates) {
      const existing = allCandidates.get(candidate.id);
      if (existing) {
        existing.names = [...new Set([...existing.names, ...candidate.names])];
        for (const code of candidate.clubCodes) existing.clubCodes.add(code);
      } else {
        allCandidates.set(candidate.id, candidate);
      }
    }
    console.log(`✓ [${clubCode}] ${candidates.length} IDs oficiais encontrados`);
    await sleep(120);
  }

  return { candidates: [...allCandidates.values()], counts };
}

function candidateScore(player, clubCode, candidate) {
  const targets = [player.name, ...(NAME_ALIASES[player.name] || [])];
  let bestNameScore = -Infinity;

  for (const targetValue of targets) {
    const target = normalize(targetValue);
    for (const remoteValue of candidate.names) {
      const remote = normalize(remoteValue);
      let score = 0;
      if (remote === target) score += 2000;
      if (compact(remote) === compact(target)) score += 1700;
      if (remote.endsWith(target) || target.endsWith(remote)) score += 350;

      const targetParts = new Set(target.split(' ').filter(Boolean));
      const remoteParts = new Set(remote.split(' ').filter(Boolean));
      let overlap = 0;
      for (const part of targetParts) if (remoteParts.has(part)) overlap += 1;
      score += overlap * 80;
      score -= Math.abs(targetParts.size - remoteParts.size) * 25;
      bestNameScore = Math.max(bestNameScore, score);
    }
  }

  if (candidate.clubCodes.has(clubCode)) bestNameScore += 260;
  return bestNameScore;
}

function resolvePlayer(player, clubCode, candidates) {
  const ranked = candidates
    .map(candidate => ({ candidate, score: candidateScore(player, clubCode, candidate) }))
    .sort((left, right) => right.score - left.score);
  const best = ranked[0];
  const runnerUp = ranked[1];

  if (!best || best.score < 1500) return null;
  if (runnerUp && best.score === runnerUp.score && best.candidate.id !== runnerUp.candidate.id) return null;
  return {
    ...best.candidate,
    matchedName: best.candidate.names
      .slice()
      .sort((left, right) => candidateScore(player, clubCode, { ...best.candidate, names: [right] }) - candidateScore(player, clubCode, { ...best.candidate, names: [left] }))[0],
    resolvedBy: best.candidate.clubCodes.has(clubCode)
      ? 'official-fotmob-squad-page-exact'
      : 'official-fotmob-cross-squad-exact'
  };
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
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const jobs = Object.keys(TEAMS).flatMap(clubCode => squadFor(clubCode).map(player => ({ clubCode, player })));
  const official = await loadOfficialFotMobSquads();
  const manifest = {
    schemaVersion: 3,
    source: 'fotmob-playerimages-exact',
    idSource: 'official-fotmob-squad-pages',
    sourceHost: 'images.fotmob.com',
    generatedAt: new Date().toISOString(),
    expectedPlayerCount: jobs.length,
    playerCount: 0,
    coverage: 0,
    officialSquadCounts: official.counts,
    teams: Object.fromEntries(Object.keys(TEAMS).map(code => [code, {
      fotmobTeamId: TEAMS[code].id,
      expected: squadFor(code).length,
      resolved: 0
    }])),
    players: {}
  };
  const unresolved = [];
  const assignments = [];

  for (const { clubCode, player } of jobs) {
    const match = resolvePlayer(player, clubCode, official.candidates);
    if (!match) {
      unresolved.push({ playerId: player.id, clubCode, name: player.name, error: 'ID oficial do FotMob não encontrado sem ambiguidade' });
      continue;
    }
    assignments.push({ clubCode, player, match });
  }

  await writeFile(REPORT_PATH, `${JSON.stringify({
    generatedAt: new Date().toISOString(),
    officialCandidateCount: official.candidates.length,
    expected: jobs.length,
    resolved: assignments.length,
    unresolved
  }, null, 2)}\n`, 'utf8');

  if (unresolved.length) {
    throw new Error(`Mapeamento incompleto: ${assignments.length}/${jobs.length}. Veja ${path.relative(ROOT, REPORT_PATH)}`);
  }

  const pendingFiles = [];
  console.log(`Baixando ${assignments.length} PNGs originais do CDN do FotMob...`);
  await mapLimit(assignments, 6, async ({ clubCode, player, match }, index) => {
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
      fotmobName: match.matchedName || match.names[0],
      fotmobSquadCodes: [...match.clubCodes],
      resolvedBy: match.resolvedBy,
      localPath,
      remoteUrl: image.remoteUrl,
      bytes: image.bytes,
      sha256: image.sha256
    };
    manifest.playerCount += 1;
    manifest.teams[clubCode].resolved += 1;
    console.log(`${String(index + 1).padStart(3, '0')}/${assignments.length} ✓ [${clubCode}] ${player.name} → ${match.id}`);
  });

  manifest.coverage = Number((manifest.playerCount / manifest.expectedPlayerCount).toFixed(4));
  if (manifest.coverage !== 1) {
    await Promise.all(pendingFiles.map(file => rm(file.temporaryPath, { force: true })));
    throw new Error(`Cobertura incompleta: ${manifest.playerCount}/${manifest.expectedPlayerCount}`);
  }

  await removeOldPortraits();
  for (const file of pendingFiles) await rename(file.temporaryPath, file.finalPath);
  await writeFile(TEMP_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await rename(TEMP_MANIFEST_PATH, MANIFEST_PATH);

  const manifestStat = await stat(MANIFEST_PATH);
  console.log(`\n✓ ${manifest.playerCount}/${manifest.expectedPlayerCount} fotos exatas do FotMob salvas localmente.`);
  console.log(`✓ Manifesto: ${path.relative(ROOT, MANIFEST_PATH)} (${manifestStat.size} bytes)`);
  console.log('✓ A tela de elenco agora usa os mesmos PNGs do FotMob e funciona offline.');
}

main().catch(error => {
  console.error(`\nSync FotMob falhou: ${error.message}`);
  process.exitCode = 1;
});

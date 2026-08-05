import { createHash } from 'node:crypto';
import { mkdir, readdir, rm, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { squadFor } from '../src/career-core/career-core.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIR = path.join(ROOT, 'public', 'assets', 'players', '2026-27');
const MANIFEST_PATH = path.join(OUTPUT_DIR, 'manifest.json');
const NEXT_MANIFEST_PATH = path.join(OUTPUT_DIR, 'manifest.next.json');
const REPORT_PATH = path.join(OUTPUT_DIR, 'fotmob-sync-report.json');
const FACE_URL = id => `https://images.fotmob.com/image_resources/playerimages/${id}.png`;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36';

const TEAMS = Object.freeze({
  ARS: [9825, 'arsenal'], AVL: [10252, 'aston-villa'], BOU: [8678, 'bournemouth'],
  BRE: [9937, 'brentford'], BHA: [10204, 'brighton-and-hove-albion'], CHE: [8455, 'chelsea'],
  COV: [8669, 'coventry-city'], CRY: [9826, 'crystal-palace'], EVE: [8668, 'everton'],
  FUL: [9879, 'fulham'], HUL: [8667, 'hull-city'], IPS: [9902, 'ipswich-town'],
  LEE: [8463, 'leeds-united'], LIV: [8650, 'liverpool'], MCI: [8456, 'manchester-city'],
  MUN: [10260, 'manchester-united'], NEW: [10261, 'newcastle-united'],
  NFO: [10203, 'nottingham-forest'], SUN: [8472, 'sunderland'], TOT: [8586, 'tottenham-hotspur']
});

const ID_OVERRIDES = Object.freeze({
  'ARS|Gabriel Magalhães': 795179,
  'AVL|Andrés García': 1430406,
  'BRE|Kim Ji-soo': 1341538,
  'BHA|Diego Coppola': 1321562,
  'COV|Norman Bassette': 1292100,
  'CRY|Yéremy Pino': 1047676,
  'CRY|Christantus Uche': 1580704,
  'FUL|Alfie McNally': 1587812,
  'HUL|Harvey Cartwright': 1184696,
  'HUL|Mason Burstow': 1293027,
  'IPS|Sam Szmodics': 491827,
  'LEE|Jack Harrison': 751649,
  'LIV|Jayden Danns': 1416696
});

const ALIASES = Object.freeze({
  'Gabriel Magalhães': ['Gabriel'],
  'Victor Lindelöf': ['Victor Nilsson Lindelof', 'Victor Lindelof'],
  'Hákon Valdimarsson': ['Hakon Rafn Valdimarsson', 'Hakon Valdimarsson'],
  'Kim Ji-soo': ['Ji-Soo Kim', 'Ji Soo Kim'],
  'Ferdi Kadıoğlu': ['Ferdi Kadioglu'],
  "Matt O'Riley": ['Matt ORiley', 'Matthew O Riley'],
  'Jamie Bynoe-Gittens': ['Jamie Gittens', 'Jamie Bynoe Gittens'],
  'Kaine Andrews': ['Kaine Kesler-Hayden', 'Kaine Andrews'],
  'Cheick Doucouré': ['Cheick Oumar Doucoure', 'Cheick Doucoure'],
  'Eddie Nketiah': ['Edward Nketiah', 'Eddie Nketiah'],
  'Vitalii Mykolenko': ['Vitaliy Mykolenko', 'Vitali Mykolenko'],
  'Carlos Alcaraz': ['Charly Alcaraz', 'Carlos Jonas Alcaraz'],
  'Josh King': ['Joshua King', 'Josh King'],
  'Jaden Philogene': ['Jaden Philogene-Bidace', 'Jaden Philogene'],
  'Sam Szmodics': ['Sammie Szmodics', 'Samuel Szmodics', 'Sam Szmodics'],
  'Joe Gomez': ['Joseph Gomez', 'Joe Gomez'],
  'Kostas Tsimikas': ['Konstantinos Tsimikas', 'Kostas Tsimikas'],
  'Altay Bayındır': ['Altay Bayindir'],
  'Dan Burn': ['Daniel Burn', 'Dan Burn'],
  'Tino Livramento': ['Valentino Livramento', 'Tino Livramento'],
  'Joe Willock': ['Joseph Willock', 'Joe Willock'],
  'Arnaud Kalimuendo': ['Arnaud Kalimuendo-Muinga', 'Arnaud Kalimuendo'],
  'Reinildo Mandava': ['Reinildo', 'Reinildo Mandava'],
  'Pape Matar Sarr': ['Pape Sarr', 'Pape Matar Sarr'],
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
  'Yéremy Pino': ['Yeremi Pino', 'Yeremy Pino']
});

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ıİ]/g, 'i')
    .replace(/[øØ]/g, 'o')
    .replace(/[łŁ]/g, 'l')
    .replace(/[đĐðÐ]/g, 'd')
    .replace(/[þÞ]/g, 'th')
    .replace(/[æÆ]/g, 'ae')
    .replace(/[œŒ]/g, 'oe')
    .replace(/ß/g, 'ss')
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

function sortedTokens(value) {
  return normalize(value).split(' ').filter(Boolean).sort().join(' ');
}

function slugName(value) {
  return decodeURIComponent(String(value || '')).replace(/\?.*$/, '').replace(/[-_]+/g, ' ').trim();
}

function visibleText(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function wait(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function fetchRetry(url, options = {}, attempts = 5) {
  let error;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        ...options,
        headers: {
          'user-agent': USER_AGENT,
          'accept-language': 'en-GB,en;q=0.9',
          ...(options.headers || {})
        }
      });
      if (response.ok) return response;
      error = new Error(`HTTP ${response.status}: ${url}`);
      if (response.status < 500 && response.status !== 429) break;
    } catch (caught) {
      error = caught;
    }
    await wait(attempt * 400);
  }
  throw error || new Error(`Falha ao acessar ${url}`);
}

function registerCandidate(map, id, slug, text, clubCode) {
  const playerId = Number(id);
  if (!playerId) return;
  const names = [...new Set([slugName(slug), visibleText(text)].filter(Boolean))];
  const existing = map.get(playerId);
  if (existing) {
    existing.names = [...new Set([...existing.names, ...names])];
    existing.clubCodes.add(clubCode);
    return;
  }
  map.set(playerId, { id: playerId, names, clubCodes: new Set([clubCode]) });
}

function extractCandidates(source, clubCode) {
  const html = String(source || '').replace(/\\u002F/gi, '/').replace(/\\\//g, '/');
  const map = new Map();
  const anchors = /<a\b[^>]*href=["'](?:https?:\/\/www\.fotmob\.com)?\/?(?:[a-z]{2}(?:-[A-Z]{2})?\/)?players\/(\d+)\/([^"'?#\\]+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchors)) registerCandidate(map, match[1], match[2], match[3], clubCode);
  const links = /(?:https?:\/\/www\.fotmob\.com)?\/?(?:[a-z]{2}(?:-[A-Z]{2})?\/)?players\/(\d+)\/([a-zA-Z0-9%._-]+)/g;
  for (const match of html.matchAll(links)) registerCandidate(map, match[1], match[2], '', clubCode);
  return [...map.values()];
}

async function loadCandidatePool() {
  const pool = new Map();
  const counts = {};
  for (const [clubCode, [teamId, slug]] of Object.entries(TEAMS)) {
    const url = `https://www.fotmob.com/teams/${teamId}/squad/${slug}`;
    const response = await fetchRetry(url, { headers: { accept: 'text/html,application/xhtml+xml' } });
    const candidates = extractCandidates(await response.text(), clubCode);
    if (candidates.length < 15) throw new Error(`Página oficial do FotMob sem elenco suficiente para ${clubCode}`);
    counts[clubCode] = candidates.length;
    for (const candidate of candidates) {
      const existing = pool.get(candidate.id);
      if (existing) {
        existing.names = [...new Set([...existing.names, ...candidate.names])];
        for (const code of candidate.clubCodes) existing.clubCodes.add(code);
      } else {
        pool.set(candidate.id, candidate);
      }
    }
    console.log(`✓ [${clubCode}] ${candidates.length} IDs oficiais`);
    await wait(100);
  }
  return { candidates: [...pool.values()], counts };
}

function nameScore(targetValue, remoteValue) {
  const target = normalize(targetValue);
  const remote = normalize(remoteValue);
  if (!target || !remote) return -10000;
  if (target === remote) return 6000;
  if (compact(target) === compact(remote)) return 5800;
  if (sortedTokens(target) === sortedTokens(remote)) return 5600;

  const targetTokens = target.split(' ').filter(Boolean);
  const remoteTokens = remote.split(' ').filter(Boolean);
  const targetSet = new Set(targetTokens);
  const remoteSet = new Set(remoteTokens);
  const overlap = targetTokens.filter(token => remoteSet.has(token)).length;
  const targetSubset = targetTokens.every(token => remoteSet.has(token));
  const remoteSubset = remoteTokens.every(token => targetSet.has(token));
  let score = overlap * 220;
  if (targetSubset || remoteSubset) score += 2600;
  if (targetTokens.at(-1) === remoteTokens.at(-1)) score += 650;
  if (targetTokens[0]?.[0] === remoteTokens[0]?.[0]) score += 150;
  score -= Math.abs(targetTokens.length - remoteTokens.length) * 90;
  return score;
}

function candidateScore(player, clubCode, candidate) {
  const names = [player.name, ...(ALIASES[player.name] || [])];
  let score = Math.max(...names.flatMap(target => candidate.names.map(remote => nameScore(target, remote))));
  if (candidate.clubCodes.has(clubCode)) score += 500;
  return score;
}

function resolvePlayer(player, clubCode, candidates) {
  const overrideId = ID_OVERRIDES[`${clubCode}|${player.name}`];
  if (overrideId) {
    const existing = candidates.find(candidate => candidate.id === overrideId);
    return existing
      ? { ...existing, resolvedBy: 'verified-fotmob-id-override' }
      : {
          id: overrideId,
          names: [player.name, ...(ALIASES[player.name] || [])],
          clubCodes: new Set([clubCode]),
          resolvedBy: 'verified-fotmob-id-override'
        };
  }

  const ranked = candidates
    .map(candidate => ({ candidate, score: candidateScore(player, clubCode, candidate) }))
    .sort((left, right) => right.score - left.score);
  const best = ranked[0];
  const second = ranked[1];
  if (!best || best.score < 3200) return null;
  if (second && best.score === second.score && best.candidate.id !== second.candidate.id) return null;
  return {
    ...best.candidate,
    resolvedBy: best.candidate.clubCodes.has(clubCode)
      ? 'official-fotmob-squad-name-match'
      : 'official-fotmob-cross-squad-name-match'
  };
}

function isPng(bytes) {
  return bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
}

async function downloadPortrait(id, destination) {
  const remoteUrl = FACE_URL(id);
  const response = await fetchRetry(remoteUrl, { headers: { accept: 'image/png,image/*;q=0.9,*/*;q=0.5' } });
  const bytes = Buffer.from(await response.arrayBuffer());
  const contentType = String(response.headers.get('content-type') || '');
  if (!contentType.startsWith('image/') || bytes.length < 1000 || !isPng(bytes)) {
    throw new Error(`Imagem original do FotMob inválida para ${id}`);
  }
  await writeFile(destination, bytes);
  return {
    remoteUrl,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex')
  };
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

async function clearOldPortraits() {
  const entries = await readdir(OUTPUT_DIR, { withFileTypes: true }).catch(() => []);
  await Promise.all(entries
    .filter(entry => entry.isFile() && /^[a-z]{3}-\d+\.png$/i.test(entry.name))
    .map(entry => rm(path.join(OUTPUT_DIR, entry.name), { force: true })));
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const jobs = Object.keys(TEAMS).flatMap(clubCode =>
    squadFor(clubCode).map(player => ({ clubCode, player }))
  );
  const official = await loadCandidatePool();
  const unresolved = [];
  const assignments = [];

  for (const job of jobs) {
    const match = resolvePlayer(job.player, job.clubCode, official.candidates);
    if (match) assignments.push({ ...job, match });
    else unresolved.push({ playerId: job.player.id, clubCode: job.clubCode, name: job.player.name });
  }

  await writeFile(REPORT_PATH, `${JSON.stringify({
    expected: jobs.length,
    resolved: assignments.length,
    unresolved
  }, null, 2)}\n`, 'utf8');

  if (unresolved.length) {
    console.error('\nNão mapeados:');
    unresolved.forEach(row => console.error(`- [${row.clubCode}] ${row.name}`));
    throw new Error(`Mapeamento FotMob incompleto: ${assignments.length}/${jobs.length}`);
  }

  const manifest = {
    schemaVersion: 5,
    source: 'fotmob-playerimages-exact',
    idSource: 'official-fotmob-squad-pages-and-verified-player-pages',
    sourceHost: 'images.fotmob.com',
    generatedAt: new Date().toISOString(),
    expectedPlayerCount: jobs.length,
    playerCount: 0,
    coverage: 0,
    officialSquadCounts: official.counts,
    players: {}
  };
  const pending = [];

  console.log(`Baixando ${assignments.length} fotos originais do FotMob...`);
  await mapLimit(assignments, 6, async ({ clubCode, player, match }, index) => {
    const fileName = `${clubCode.toLowerCase()}-${match.id}.png`;
    const temporaryPath = path.join(OUTPUT_DIR, `${fileName}.next`);
    const image = await downloadPortrait(match.id, temporaryPath);
    pending.push({ temporaryPath, finalPath: path.join(OUTPUT_DIR, fileName) });
    manifest.players[player.id] = {
      playerId: player.id,
      fotmobId: match.id,
      clubCode,
      name: player.name,
      fotmobName: match.names[0] || player.name,
      fotmobSquadCodes: [...match.clubCodes],
      resolvedBy: match.resolvedBy,
      localPath: `/assets/players/2026-27/${fileName}`,
      remoteUrl: image.remoteUrl,
      bytes: image.bytes,
      sha256: image.sha256
    };
    manifest.playerCount += 1;
    console.log(`${String(index + 1).padStart(3, '0')}/${assignments.length} ✓ [${clubCode}] ${player.name}`);
  });

  manifest.coverage = Number((manifest.playerCount / manifest.expectedPlayerCount).toFixed(4));
  if (manifest.coverage !== 1) {
    await Promise.all(pending.map(file => rm(file.temporaryPath, { force: true })));
    throw new Error(`Download incompleto: ${manifest.playerCount}/${manifest.expectedPlayerCount}`);
  }

  await clearOldPortraits();
  for (const file of pending) await rename(file.temporaryPath, file.finalPath);
  await writeFile(NEXT_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  await rename(NEXT_MANIFEST_PATH, MANIFEST_PATH);
  const info = await stat(MANIFEST_PATH);

  console.log(`\n✓ ${manifest.playerCount}/${manifest.expectedPlayerCount} fotos exatas do FotMob salvas localmente.`);
  console.log(`✓ Manifesto validado (${info.size} bytes).`);
}

main().catch(error => {
  console.error(`\nSync FotMob falhou: ${error.message}`);
  process.exitCode = 1;
});

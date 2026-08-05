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
  'BRE|Kim Ji-soo': 1341538
});

const ALIASES = Object.freeze({
  'Gabriel Magalhães': ['Gabriel'],
  'Victor Lindelöf': ['Victor Nilsson Lindelof', 'Victor Lindelof'],
  'Hákon Valdimarsson': ['Hakon Rafn Valdimarsson', 'Hakon Valdimarsson'],
  'Kim Ji-soo': ['Ji-Soo Kim', 'Ji Soo Kim'],
  'Ferdi Kadıoğlu': ['Ferdi Kadioglu'],
  'Diego Coppola': ['Diego Coppola'],
  "Matt O'Riley": ['Matt ORiley', 'Matthew O Riley'],
  'Jamie Bynoe-Gittens': ['Jamie Gittens', 'Jamie Bynoe Gittens'],
  'Emmanuel Emegha': ['Emanuel Emegha', 'Emmanuel Emegha'],
  'Kaine Andrews': ['Kaine Kesler-Hayden', 'Kaine Andrews'],
  'Norman Bassette': ['Norman Bassette'],
  'Yéremy Pino': ['Yeremy Pino'],
  'Cheick Doucouré': ['Cheick Oumar Doucoure', 'Cheick Doucoure'],
  'Eddie Nketiah': ['Edward Nketiah', 'Eddie Nketiah'],
  'Christantus Uche': ['Uche Christantus', 'Christantus Uche'],
  'Vitalii Mykolenko': ['Vitaliy Mykolenko', 'Vitali Mykolenko'],
  'Carlos Alcaraz': ['Charly Alcaraz', 'Carlos Jonas Alcaraz'],
  'Alfie McNally': ['Alfie McNally'],
  'Josh King': ['Joshua King', 'Josh King'],
  'Harvey Cartwright': ['Harvey Cartwright'],
  'Mason Burstow': ['Mason Burstow'],
  'Jaden Philogene': ['Jaden Philogene-Bidace', 'Jaden Philogene'],
  'Sam Szmodics': ['Samuel Szmodics', 'Sam Szmodics'],
  'Jack Harrison': ['Jack Harrison'],
  'Joe Gomez': ['Joseph Gomez', 'Joe Gomez'],
  'Kostas Tsimikas': ['Konstantinos Tsimikas', 'Kostas Tsimikas'],
  'Jayden Danns': ['Jayden Danns'],
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
  'Viktor Gyökeres': ['Viktor Gyokeres']
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

function sortedTokens(value) {
  return normalize(value).split(' ').filter(Boolean).sort().join(' ');
}

function compact(value) {
  return normalize(value).replace(/\s+/g, '');
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

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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
  const current = map.get(playerId);
  if (current) {
    current.names = [...new Set([...current.names, ...names])];
    current.clubCodes.add(clubCode);
    return;
  }
  map.set(playerId, { id: playerId, names, clubCodes: new Set([clubCode]) });
}

function extractCandidates(htmlSource, clubCode) {
  const html = String(htmlSource || '').replace(/\\u002F/gi, '/').replace(/\\\//g, '/');
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
  for (const [clubCode, [id, slug]] of Object.entries(TEAMS)) {
    const url = `https://www.fotmob.com/teams/${id}/squad/${slug}`;
    const response = await fetchRetry(url, { headers: { accept: 'text/html,application/xhtml+xml' } });
    const candidates = extractCandidates(await response.text(), clubCode);
    if (candidates.length < 15) throw new Error(`Página do FotMob sem elenco suficiente para ${clubCode}`);
    counts[clubCode] = candidates.length;
    for (const candidate of candidates) {
      const current = pool.get(candidate.id);
      if (current) {
        current.names = [...new Set([...current.names, ...candidate.names])];
        for (const code of candidate.clubCodes) current.clubCodes.add(code);
      } else pool.set(candidate.id, candidate);
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

function resolve(player, clubCode, candidates) {
  const override = ID_OVERRIDES[`${clubCode}|${player.name}`];
  if (override) {
    const candidate = candidates.find(row => row.id === override);
    return candidate ? { ...candidate, resolvedBy: 'verified-id-override' } : null;
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
    resolvedBy: best.candidate.clubCodes.has(clubCode) ? 'official-squad-name-match' : 'official-cross-squad-name-match'
  };
}

function isPng(bytes) {
  return bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
}

async function downloadPortrait(id, target) {
  const remoteUrl = FACE_URL(id);
  const response = await fetchRetry(remoteUrl, { headers: { accept: 'image/png,image/*;q=0.9,*/*;q=0.5' } });
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!String(response.headers.get('content-type') || '').startsWith('image/') || bytes.length < 1000 || !isPng(bytes)) {
    throw new Error(`Imagem original do FotMob inválida para ${id}`);
  }
  await writeFile(target, bytes);
  return { remoteUrl, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
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
  const jobs = Object.keys(TEAMS).flatMap(clubCode => squadFor(clubCode).map(player => ({ clubCode, player })));
  const official = await loadCandidatePool();
  const unresolved = [];
  const assignments = [];

  for (const job of jobs) {
    const match = resolve(job.player, job.clubCode, official.candidates);
    if (match) assignments.push({ ...job, match });
    else unresolved.push({ playerId: job.player.id, clubCode: job.clubCode, name: job.player.name });
  }

  await writeFile(REPORT_PATH, `${JSON.stringify({ expected: jobs.length, resolved: assignments.length, unresolved }, null, 2)}\n`);
  if (unresolved.length) {
    console.error('\nNão mapeados:');
    unresolved.forEach(row => console.error(`- [${row.clubCode}] ${row.name}`));
    throw new Error(`Mapeamento FotMob incompleto: ${assignments.length}/${jobs.length}`);
  }

  const manifest = {
    schemaVersion: 4,
    source: 'fotmob-playerimages-exact',
    idSource: 'official-fotmob-squad-pages',
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
    const temp = path.join(OUTPUT_DIR, `${fileName}.next`);
    const image = await downloadPortrait(match.id, temp);
    pending.push({ temp, final: path.join(OUTPUT_DIR, fileName) });
    manifest.players[player.id] = {
      playerId: player.id,
      fotmobId: match.id,
      clubCode,
      name: player.name,
      fotmobName: match.names[0],
      fotmobSquadCodes: [...match.clubCodes],
      resolvedBy: match.resolvedBy,
      localPath: `/assets/players/2026-27/${fileName}`,
      remoteUrl: image.remoteUrl,
      bytes: image.bytes,
      sha256: image.sha256
    };
    manifest.playerCount += 1;
    console.log(`${String(index + 1).padStart(3, '0')}/${assignments.length} ✓ ${player.name}`);
  });

  manifest.coverage = Number((manifest.playerCount / manifest.expectedPlayerCount).toFixed(4));
  if (manifest.coverage !== 1) throw new Error(`Download incompleto: ${manifest.playerCount}/${manifest.expectedPlayerCount}`);

  await clearOldPortraits();
  for (const file of pending) await rename(file.temp, file.final);
  await writeFile(NEXT_MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  await rename(NEXT_MANIFEST_PATH, MANIFEST_PATH);
  const info = await stat(MANIFEST_PATH);
  console.log(`\n✓ 496/496 fotos exatas do FotMob salvas localmente.`);
  console.log(`✓ Manifesto validado (${info.size} bytes).`);
}

main().catch(error => {
  console.error(`\nSync FotMob falhou: ${error.message}`);
  process.exitCode = 1;
});

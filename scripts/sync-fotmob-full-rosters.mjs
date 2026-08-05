import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Window } from 'happy-dom';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = path.join(ROOT, 'public', 'assets', 'players', '2026-27');
const LOCAL_ROSTER_PATH = path.join(ROOT, 'src', 'career-core', 'fotmob-rosters.local.json');
const PUBLIC_ROSTER_PATH = path.join(PUBLIC_DIR, 'rosters.json');
const MANIFEST_PATH = path.join(PUBLIC_DIR, 'manifest.json');
const REPORT_PATH = path.join(PUBLIC_DIR, 'fotmob-sync-report.json');
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/150 Safari/537.36';
const PHOTO_URL = id => `https://images.fotmob.com/image_resources/playerimages/${id}.png`;

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

const REQUIRED_MUN_PLAYERS = Object.freeze([
  'Andrey Santos',
  'Youri Tielemans',
  'Daniel Gore',
  'Harry Amass',
  'Marcus Rashford',
  'Enzo Kana Biyik',
  'Ethan Wheatley'
]);

const POSITION_CODES = Object.freeze({
  GK: 'GK', GO: 'GK', GOALKEEPER: 'GK', KEEPER: 'GK',
  CB: 'DEF', ZC: 'DEF', RB: 'DEF', LB: 'DEF', RWB: 'DEF', LWB: 'DEF',
  LD: 'DEF', LE: 'DEF', DF: 'DEF', DEFENDER: 'DEF', DEFENCE: 'DEF', DEFENSE: 'DEF',
  DM: 'MID', CDM: 'MID', CM: 'MID', MCC: 'MID', VOL: 'MID', AM: 'MID', CAM: 'MID',
  MO: 'MID', LM: 'MID', RM: 'MID', ME: 'MID', MD: 'MID', LW: 'MID', RW: 'MID',
  PE: 'MID', PD: 'MID', MIDFIELDER: 'MID', MIDFIELD: 'MID',
  ST: 'FWD', CF: 'FWD', FW: 'FWD', CA: 'FWD', STRIKER: 'FWD', FORWARD: 'FWD', ATTACKER: 'FWD'
});

function cleanText(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalize(value) {
  return cleanText(value)
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
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function titleFromSlug(slug) {
  return decodeURIComponent(String(slug || ''))
    .replace(/\?.*$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase())
    .trim();
}

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
    await sleep(350 * attempt);
  }
  throw lastError || new Error(`Falha ao acessar ${url}`);
}

function positionTokens(text) {
  const normalized = cleanText(text).toUpperCase();
  const matches = normalized.match(/\b(?:GOALKEEPER|KEEPER|DEFENDER|DEFENCE|DEFENSE|MIDFIELDER|MIDFIELD|STRIKER|FORWARD|ATTACKER|GK|GO|CB|ZC|RB|LB|RWB|LWB|LD|LE|DF|DM|CDM|CM|MCC|VOL|AM|CAM|MO|LM|RM|ME|MD|LW|RW|PE|PD|ST|CF|FW|CA)\b/g);
  return matches || [];
}

function groupFromText(text) {
  const tokens = positionTokens(text);
  for (const token of tokens) {
    const group = POSITION_CODES[token];
    if (group) return { group, position: tokens.join(', ') };
  }
  return null;
}

function nearbyPlayerText(anchor, name) {
  let node = anchor;
  const target = normalize(name);
  let best = '';

  for (let depth = 0; node && depth < 10; depth += 1, node = node.parentElement) {
    const text = cleanText(node.textContent);
    if (!text || text.length > 420) continue;
    if (target && !normalize(text).includes(target)) continue;
    best = text;
    if (groupFromText(text)) return text;
  }
  return best;
}

function groupFromRawContext(html, id) {
  const patterns = [
    `/players/${id}/`,
    `\\u002Fplayers\\u002F${id}\\u002F`,
    `playerId\\":${id}`,
    `\"id\":${id}`
  ];
  let index = -1;
  for (const pattern of patterns) {
    index = html.indexOf(pattern);
    if (index >= 0) break;
  }
  if (index < 0) return null;

  const context = html.slice(Math.max(0, index - 900), index + 1400);
  const jsonPosition = context.match(/(?:position|positionLabel|role)\\?"?\s*:\s*\\?"([^"\\]{1,80})/i);
  return groupFromText(jsonPosition?.[1] || context);
}

function pickName(anchor, slug) {
  const canonical = titleFromSlug(slug);
  const visible = [
    anchor.getAttribute('aria-label'),
    anchor.getAttribute('title'),
    anchor.textContent
  ]
    .map(cleanText)
    .filter(value => value.length >= 2 && value.length <= 70 && !/[€£$]/.test(value));
  const exactVisible = visible.find(value => normalize(value) === normalize(canonical));
  return exactVisible || canonical;
}

function extractSquad(html, clubCode) {
  const window = new Window({
    settings: {
      disableJavaScriptEvaluation: true,
      disableJavaScriptFileLoading: true,
      disableCSSFileLoading: true,
      disableIframePageLoading: true
    }
  });
  window.document.write(html);

  const byId = new Map();
  const anchors = [...window.document.querySelectorAll('a[href*="/players/"]')];

  for (const anchor of anchors) {
    const href = anchor.getAttribute('href') || '';
    const match = href.match(/\/players\/(\d+)\/([^/?#]+)/i);
    if (!match) continue;
    const fotmobId = Number(match[1]);
    if (!fotmobId || byId.has(fotmobId)) continue;

    const name = pickName(anchor, match[2]);
    const nearby = nearbyPlayerText(anchor, name);
    const detected = groupFromText(nearby) || groupFromRawContext(html, fotmobId);
    byId.set(fotmobId, {
      fotmobId,
      name,
      group: detected?.group || null,
      position: detected?.position || '',
      nearby
    });
  }

  const players = [...byId.values()];
  const ranks = { GK: 0, DEF: 1, MID: 2, FWD: 3 };

  for (let index = 0; index < players.length; index += 1) {
    if (players[index].group) continue;
    const previous = [...players.slice(0, index)].reverse().find(player => player.group);
    const next = players.slice(index + 1).find(player => player.group);
    if (previous && next && previous.group === next.group) players[index].group = previous.group;
    else if (!previous && next) players[index].group = next.group;
    else if (previous && !next) players[index].group = previous.group;
    else if (previous && next && ranks[previous.group] <= ranks[next.group]) players[index].group = previous.group;
  }

  const unresolved = players.filter(player => !player.group);
  if (unresolved.length) {
    const details = unresolved.map(player => `${player.name} (${player.fotmobId}) [${player.nearby}]`).join('; ');
    throw new Error(`${clubCode}: posição não identificada para ${details}`);
  }

  const duplicateNames = players
    .map(player => normalize(player.name))
    .filter((name, index, all) => all.indexOf(name) !== index);
  if (duplicateNames.length) {
    throw new Error(`${clubCode}: nomes duplicados no elenco oficial: ${[...new Set(duplicateNames)].join(', ')}`);
  }

  window.close();
  return players;
}

function isPng(bytes) {
  return bytes.length > 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
}

async function downloadPortrait(player, clubCode) {
  const remoteUrl = PHOTO_URL(player.fotmobId);
  const response = await fetchWithRetry(remoteUrl, {
    headers: { accept: 'image/png,image/*;q=0.9,*/*;q=0.5' }
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  const contentType = String(response.headers.get('content-type') || '');
  if (!contentType.startsWith('image/') || bytes.length < 500 || !isPng(bytes)) {
    throw new Error(`${clubCode} ${player.name}: PNG do FotMob inválido`);
  }

  const fileName = `${clubCode.toLowerCase()}-${player.fotmobId}.png`;
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

async function mapLimit(items, concurrency, worker) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      await worker(items[index], index);
    }
  });
  await Promise.all(workers);
}

async function removeOldGeneratedFiles() {
  const entries = await readdir(PUBLIC_DIR, { withFileTypes: true }).catch(() => []);
  await Promise.all(entries
    .filter(entry => entry.isFile() && (/^[a-z]{3}-\d+\.png$/i.test(entry.name) || entry.name.endsWith('.png.next')))
    .map(entry => rm(path.join(PUBLIC_DIR, entry.name), { force: true })));
}

async function writeJsonAtomic(destination, value) {
  const temporary = `${destination}.next`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rm(destination, { force: true });
  await rename(temporary, destination);
}

async function validExistingPack() {
  try {
    const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
    const rosterPayload = JSON.parse(await readFile(LOCAL_ROSTER_PATH, 'utf8'));
    if (manifest.source !== 'fotmob-official-full-squads' || manifest.coverage !== 1) return false;
    if (manifest.playerCount < 600 || Object.keys(manifest.teams || {}).length !== 20) return false;
    if (rosterPayload?.meta?.playerCount !== manifest.playerCount) return false;
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

  if (!force && await validExistingPack()) {
    const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
    console.log(`✓ Pacote FotMob completo já disponível: ${manifest.playerCount} jogadores em 20 clubes.`);
    return;
  }

  const teams = {};
  const failures = [];

  for (const [clubCode, team] of Object.entries(TEAMS)) {
    const url = `https://www.fotmob.com/teams/${team.id}/squad/${team.slug}`;
    try {
      const response = await fetchWithRetry(url, {
        headers: { accept: 'text/html,application/xhtml+xml' }
      });
      const players = extractSquad(await response.text(), clubCode);
      if (players.length < 24) throw new Error(`apenas ${players.length} jogadores encontrados`);
      teams[clubCode] = { ...team, url, players };
      console.log(`✓ [${clubCode}] ${players.length} jogadores oficiais encontrados`);
    } catch (error) {
      failures.push({ clubCode, url, error: error.message });
      console.error(`✗ [${clubCode}] ${error.message}`);
    }
    await sleep(100);
  }

  const unitedNames = new Set((teams.MUN?.players || []).map(player => normalize(player.name)));
  const missingUnited = REQUIRED_MUN_PLAYERS.filter(name => !unitedNames.has(normalize(name)));
  if (missingUnited.length) {
    failures.push({ clubCode: 'MUN', error: `faltando: ${missingUnited.join(', ')}` });
  }

  const allPlayers = Object.entries(teams).flatMap(([clubCode, team]) =>
    team.players.map((player, index) => ({ ...player, clubCode, index }))
  );

  await writeJsonAtomic(REPORT_PATH, {
    generatedAt: new Date().toISOString(),
    teamCount: Object.keys(teams).length,
    playerCount: allPlayers.length,
    failures,
    teamCounts: Object.fromEntries(Object.entries(teams).map(([code, team]) => [code, team.players.length]))
  });

  if (failures.length || Object.keys(teams).length !== 20 || allPlayers.length < 600) {
    throw new Error(`Varredura incompleta: ${Object.keys(teams).length}/20 clubes e ${allPlayers.length} jogadores. Veja ${path.relative(ROOT, REPORT_PATH)}`);
  }

  const pending = [];
  const manifestPlayers = {};
  console.log(`Baixando ${allPlayers.length} fotos originais do FotMob...`);

  try {
    await mapLimit(allPlayers, 8, async (player, globalIndex) => {
      const image = await downloadPortrait(player, player.clubCode);
      pending.push(image);
      const playerId = corePlayerId(player.clubCode, player.name, player.index);
      manifestPlayers[playerId] = {
        playerId,
        fotmobId: player.fotmobId,
        clubCode: player.clubCode,
        name: player.name,
        group: player.group,
        position: player.position,
        localPath: `/assets/players/2026-27/${image.fileName}`,
        remoteUrl: image.remoteUrl,
        bytes: image.bytes,
        sha256: image.sha256
      };
      if ((globalIndex + 1) % 50 === 0 || globalIndex + 1 === allPlayers.length) {
        console.log(`  ${globalIndex + 1}/${allPlayers.length}`);
      }
    });
  } catch (error) {
    await Promise.all(pending.map(file => rm(file.temporaryPath, { force: true })));
    throw error;
  }

  const generatedAt = new Date().toISOString();
  const rosters = Object.fromEntries(Object.entries(teams).map(([clubCode, team]) => [
    clubCode,
    team.players.map(player => [player.name, player.group])
  ]));
  const metaTeams = Object.fromEntries(Object.entries(teams).map(([clubCode, team]) => [
    clubCode,
    {
      fotmobTeamId: team.id,
      sourceUrl: team.url,
      playerCount: team.players.length,
      players: team.players.map(player => ({
        fotmobId: player.fotmobId,
        name: player.name,
        group: player.group,
        position: player.position
      }))
    }
  ]));
  const rosterPayload = {
    meta: {
      source: 'fotmob-official-full-squads',
      generatedAt,
      teamCount: 20,
      playerCount: allPlayers.length,
      teams: Object.fromEntries(Object.entries(metaTeams).map(([code, team]) => [code, team.playerCount]))
    },
    rosters
  };
  const manifest = {
    schemaVersion: 6,
    source: 'fotmob-official-full-squads',
    sourceHost: 'images.fotmob.com',
    generatedAt,
    teamCount: 20,
    expectedPlayerCount: allPlayers.length,
    playerCount: allPlayers.length,
    coverage: 1,
    teams: metaTeams,
    players: manifestPlayers
  };

  await removeOldGeneratedFiles();
  for (const file of pending) await rename(file.temporaryPath, file.finalPath);
  await writeJsonAtomic(LOCAL_ROSTER_PATH, rosterPayload);
  await writeJsonAtomic(PUBLIC_ROSTER_PATH, rosterPayload);
  await writeJsonAtomic(MANIFEST_PATH, manifest);

  console.log(`\n✓ Varredura completa: ${allPlayers.length} jogadores dos 20 clubes oficiais do FotMob.`);
  console.log('✓ Todas as fotos foram salvas localmente e vinculadas ao elenco integral.');
}

main().catch(error => {
  console.error(`\nSync FotMob falhou: ${error.message}`);
  process.exitCode = 1;
});

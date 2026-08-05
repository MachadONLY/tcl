import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLUB_BY_CODE } from '../src/career-core/season-2026-27.js';
import { squadFor } from '../src/career-core/career-core.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIR = path.join(ROOT, 'public', 'assets', 'players', '2026-27');
const MANIFEST_PATH = path.join(OUTPUT_DIR, 'manifest.json');
const TEMP_MANIFEST_PATH = path.join(OUTPUT_DIR, 'manifest.next.json');
const REPORT_PATH = path.join(OUTPUT_DIR, 'fotmob-sync-report.json');
const TEAM_API = id => `https://www.fotmob.com/api/teams?id=${id}&ccode3=GBR`;
const SEARCH_API = name => `https://apigw.fotmob.com/searchapi/suggest?term=${encodeURIComponent(name)}&lang=en`;
const FACE_URL = id => `https://images.fotmob.com/image_resources/playerimages/${id}.png`;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Touchline/0.3';
const TEAM_IDS = Object.freeze({
  ARS: 9825, AVL: 10252, BOU: 8678, BRE: 9937, BHA: 10204,
  CHE: 8455, COV: 8669, CRY: 9826, EVE: 8668, FUL: 9879,
  HUL: 8667, IPS: 9902, LEE: 8463, LIV: 8650, MCI: 8456,
  MUN: 10260, NEW: 10261, NFO: 10203, SUN: 8472, TOT: 8586
});
const NAME_ALIASES = Object.freeze({
  'Đorđe Petrović': ['Djordje Petrovic'],
  'João Gomes': ['Joao Gomes'],
  'João Pedro': ['Joao Pedro'],
  'Joël Piroe': ['Joel Piroe'],
  'Jørgen Strand Larsen': ['Jorgen Strand Larsen'],
  'Lukás Horníček': ['Lukas Hornicek'],
  'Matthijs de Ligt': ['Matthijs De Ligt'],
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

async function fetchWithRetry(url, options = {}, attempts = 4) {
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
    await sleep(350 * attempt);
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
  const position = value.position || value.role || value.positionLabel || '';
  const teamName = value.teamName || value.team?.name || value.clubName || '';
  if (id && name && String(position).toLowerCase() !== 'coach') {
    found.push({ id, name: String(name), teamName: String(teamName), position: String(position) });
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

function extractTeamSquad(payload) {
  const rows = uniquePlayers(collectPlayerRows(payload));
  const grouped = new Map();
  for (const row of rows) {
    const key = row.teamName || 'unknown';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  return [...grouped.values()].sort((left, right) => right.length - left.length)[0] || rows;
}

function extractSearchPlayers(payload) {
  const sections = Array.isArray(payload?.squadMemberSuggest)
    ? payload.squadMemberSuggest
    : [];
  const rows = [];
  for (const section of sections) {
    for (const option of section?.options || []) {
      const item = option?.payload || option;
      const id = Number(item?.id ?? item?.playerId);
      const name = item?.name || item?.fullName || item?.playerName;
      if (id && name) rows.push({
        id,
        name: String(name),
        teamName: String(item?.teamName || item?.team?.name || ''),
        position: String(item?.position || '')
      });
    }
  }
  return uniquePlayers(rows.length ? rows : collectPlayerRows(payload));
}

function scoreCandidate(player, candidate, expectedClubName) {
  const target = normalize(player.name);
  const candidateName = normalize(candidate.name);
  const aliases = (NAME_ALIASES[player.name] || []).map(normalize);
  let score = 0;

  if (candidateName === target || aliases.includes(candidateName)) score += 1000;
  if (compact(candidateName) === compact(target)) score += 800;

  const targetParts = new Set(target.split(' ').filter(Boolean));
  const candidateParts = new Set(candidateName.split(' ').filter(Boolean));
  let overlap = 0;
  for (const part of targetParts) if (candidateParts.has(part)) overlap += 1;
  score += overlap * 35;
  score -= Math.abs(targetParts.size - candidateParts.size) * 8;

  const teamName = normalize(candidate.teamName);
  const expectedTeam = normalize(expectedClubName);
  if (teamName && expectedTeam && (teamName.includes(expectedTeam) || expectedTeam.includes(teamName))) score += 90;
  if (candidate.position && player.group && normalize(candidate.position).startsWith(normalize(player.group)[0])) score += 5;
  return score;
}

async function resolvePlayer(player, clubCode, teamSquad) {
  const expectedClubName = CLUB_BY_CODE.get(clubCode)?.name || clubCode;
  const teamMatch = teamSquad
    .map(candidate => ({ candidate, score: scoreCandidate(player, candidate, expectedClubName) }))
    .sort((left, right) => right.score - left.score)[0];

  if (teamMatch?.score >= 900) return { ...teamMatch.candidate, resolvedBy: 'team-squad' };

  const searchTerms = [player.name, ...(NAME_ALIASES[player.name] || [])];
  const searchCandidates = [];
  for (const term of searchTerms) {
    const payload = await getJson(SEARCH_API(term));
    searchCandidates.push(...extractSearchPlayers(payload));
    if (searchCandidates.some(candidate => normalize(candidate.name) === normalize(term))) break;
    await sleep(90);
  }

  const globalMatch = uniquePlayers(searchCandidates)
    .map(candidate => ({ candidate, score: scoreCandidate(player, candidate, expectedClubName) }))
    .sort((left, right) => right.score - left.score)[0];

  if (globalMatch?.score >= 800) return { ...globalMatch.candidate, resolvedBy: 'fotmob-search' };
  if (teamMatch?.score >= 60) return { ...teamMatch.candidate, resolvedBy: 'team-fuzzy' };
  return null;
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

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const expectedPlayers = Object.keys(TEAM_IDS).flatMap(code => squadFor(code));
  const manifest = {
    schemaVersion: 2,
    source: 'fotmob-playerimages-exact',
    sourceHost: 'images.fotmob.com',
    generatedAt: new Date().toISOString(),
    expectedPlayerCount: expectedPlayers.length,
    playerCount: 0,
    coverage: 0,
    teams: {},
    players: {}
  };
  const unresolved = [];
  const pendingFiles = [];

  for (const [clubCode, teamId] of Object.entries(TEAM_IDS)) {
    const gameSquad = squadFor(clubCode);
    console.log(`\n[${clubCode}] FotMob team ${teamId}: ${gameSquad.length} jogadores`);
    const teamPayload = await getJson(TEAM_API(teamId));
    const teamSquad = extractTeamSquad(teamPayload);
    manifest.teams[clubCode] = { fotmobTeamId: teamId, expected: gameSquad.length, resolved: 0 };

    for (const [index, player] of gameSquad.entries()) {
      try {
        const match = await resolvePlayer(player, clubCode, teamSquad);
        if (!match) throw new Error('nenhum ID do FotMob encontrado');
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
        console.log(`  ${String(index + 1).padStart(2, '0')}/${gameSquad.length} ✓ ${player.name} → ${match.id}`);
      } catch (error) {
        unresolved.push({ playerId: player.id, clubCode, name: player.name, error: error.message });
        console.error(`  ${String(index + 1).padStart(2, '0')}/${gameSquad.length} ✗ ${player.name}: ${error.message}`);
      }
      await sleep(70);
    }
  }

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
  console.log('✓ O jogo agora pode carregar essas fotos offline.');
}

main().catch(error => {
  console.error(`\nSync FotMob falhou: ${error.message}`);
  process.exitCode = 1;
});

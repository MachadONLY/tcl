import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCAL_ROSTER_PATH = path.join(ROOT, 'src', 'career-core', 'fotmob-rosters.local.json');
const PUBLIC_ROSTER_PATH = path.join(ROOT, 'public', 'assets', 'players', '2026-27', 'rosters.json');
const MANIFEST_PATH = path.join(ROOT, 'public', 'assets', 'players', '2026-27', 'manifest.json');

const STATUS_SUFFIX_PATTERN = /(?:back injury|cruciate ligament injury|acl injury|achilles injury|muscle injury|hamstring injury|knee injury|ankle injury|foot injury|calf injury|shoulder injury|groin injury|hip injury|thigh injury|head injury|hand injury|leg injury|injured|illness|suspended|suspension|doubtful|international duty|personal reasons|red card|yellow card suspension|icInjury).*$/i;
const RATING_FIELDS = Object.freeze([
  'rating', 'potential', 'ratingSource', 'sofifaPlayerId', 'ratingRoster',
  'ratingUpdatedAt', 'ratingMatchMethod', 'eaPlayerId'
]);

export function cleanFotMobPlayerName(value) {
  return String(value || '')
    .replace(STATUS_SUFFIX_PATTERN, '')
    .replace(/\s+/g, ' ')
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

async function writeJsonAtomic(destination, value) {
  const temporary = `${destination}.next`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rm(destination, { force: true });
  await rename(temporary, destination);
}

function buildRosterIndex(rosterPayload) {
  const byFotmobId = new Map();
  const expectedPlayerIds = new Set();
  let cleanedNames = 0;
  let playerCount = 0;

  for (const [clubCode, players] of Object.entries(rosterPayload.rosters || {})) {
    if (!Array.isArray(players)) throw new Error(`[${clubCode}] elenco inválido`);

    players.forEach((player, index) => {
      const cleanedName = cleanFotMobPlayerName(player.name);
      if (!cleanedName) throw new Error(`[${clubCode}] jogador sem nome após limpeza`);
      if (cleanedName !== player.name) {
        player.name = cleanedName;
        cleanedNames += 1;
      }

      const fotmobId = Number(player.fotmobId);
      if (!Number.isInteger(fotmobId) || fotmobId <= 0) {
        throw new Error(`[${clubCode}] ${player.name}: fotmobId inválido`);
      }

      const playerId = corePlayerId(clubCode, player.name, index);
      const fotmobKey = `${clubCode}:${fotmobId}`;
      if (byFotmobId.has(fotmobKey)) throw new Error(`fotmobId duplicado: ${fotmobKey}`);
      if (expectedPlayerIds.has(playerId)) throw new Error(`playerId duplicado: ${playerId}`);

      byFotmobId.set(fotmobKey, { clubCode, player, index, playerId });
      expectedPlayerIds.add(playerId);
      playerCount += 1;
    });
  }

  return { byFotmobId, expectedPlayerIds, cleanedNames, playerCount };
}

function rebuildManifest(manifest, rosterIndex) {
  const nextPlayers = {};
  const matchedFotmobKeys = new Set();
  const missingRecords = [];

  for (const record of Object.values(manifest.players || {})) {
    const clubCode = String(record.clubCode || '').toUpperCase();
    const fotmobId = Number(record.fotmobId);
    const fotmobKey = `${clubCode}:${fotmobId}`;
    const target = rosterIndex.byFotmobId.get(fotmobKey);

    if (!target) {
      missingRecords.push(`${clubCode}:${record.name || fotmobId}`);
      continue;
    }

    const { player, playerId } = target;
    const repaired = {
      ...record,
      playerId,
      clubCode,
      name: player.name,
      fotmobId
    };
    for (const field of RATING_FIELDS) repaired[field] = player[field] ?? null;

    if (nextPlayers[playerId]) throw new Error(`manifest gerou playerId duplicado: ${playerId}`);
    nextPlayers[playerId] = repaired;
    matchedFotmobKeys.add(fotmobKey);
  }

  const rosterWithoutManifest = [...rosterIndex.byFotmobId.keys()]
    .filter(key => !matchedFotmobKeys.has(key));

  if (missingRecords.length || rosterWithoutManifest.length) {
    throw new Error(
      `manifest desalinhado: ${missingRecords.length} registros órfãos e ` +
      `${rosterWithoutManifest.length} jogadores sem registro`
    );
  }
  if (Object.keys(nextPlayers).length !== rosterIndex.playerCount) {
    throw new Error(
      `manifest contém ${Object.keys(nextPlayers).length} jogadores; esperados ${rosterIndex.playerCount}`
    );
  }

  manifest.players = nextPlayers;
  manifest.expectedPlayerCount = rosterIndex.playerCount;
  manifest.playerCount = rosterIndex.playerCount;
  manifest.manifestRepairedAt = new Date().toISOString();
  manifest.cleanedContaminatedNames = rosterIndex.cleanedNames;
}

export async function main() {
  let rosterPayload;
  let manifest;
  try {
    rosterPayload = JSON.parse(await readFile(LOCAL_ROSTER_PATH, 'utf8'));
    manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  } catch {
    console.log('Reparo de manifest ignorado: pacote de jogadores ainda não foi gerado.');
    return;
  }

  const rosterIndex = buildRosterIndex(rosterPayload);
  rebuildManifest(manifest, rosterIndex);

  await writeJsonAtomic(LOCAL_ROSTER_PATH, rosterPayload);
  await writeJsonAtomic(PUBLIC_ROSTER_PATH, rosterPayload);
  await writeJsonAtomic(MANIFEST_PATH, manifest);

  const suffix = rosterIndex.cleanedNames
    ? ` · ${rosterIndex.cleanedNames} nomes contaminados corrigidos`
    : ' · nomes já estavam limpos';
  console.log(`✓ Manifest alinhado por fotmobId: ${rosterIndex.playerCount} jogadores${suffix}.`);
}

main().catch(error => {
  console.error(`\nReparo do manifest falhou: ${error.message}`);
  process.exitCode = 1;
});

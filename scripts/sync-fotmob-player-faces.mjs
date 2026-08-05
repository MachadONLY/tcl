import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { squadFor } from '../src/career-core/career-core.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_DIR = path.join(ROOT, 'public', 'assets', 'players', '2026-27');
const MANIFEST_PATH = path.join(OUTPUT_DIR, 'manifest.json');
const TEAM_IDS = Object.freeze({
  ARS: 9825, AVL: 10252, BOU: 8678, BRE: 9937, BHA: 10204,
  CHE: 8455, COV: 8669, CRY: 9826, EVE: 8668, FUL: 9879,
  HUL: 8667, IPS: 9902, LEE: 8463, LIV: 8650, MCI: 8456,
  MUN: 10260, NEW: 10261, NFO: 10203, SUN: 8472, TOT: 8586
});
const API_URL = id => `https://www.fotmob.com/api/teams?id=${id}&ccode3=GBR`;
const FACE_URL = id => `https://images.fotmob.com/image_resources/playerimages/${id}.png`;

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

function walkForPlayers(value, found = []) {
  if (!value || typeof value !== 'object') return found;
  if (Array.isArray(value)) {
    const rows = value.filter(item => item && typeof item === 'object' && Number(item.id) && (item.name || item.fullName));
    if (rows.length >= 8) found.push(rows);
    for (const item of value) walkForPlayers(item, found);
    return found;
  }
  for (const child of Object.values(value)) walkForPlayers(child, found);
  return found;
}

function bestSquad(payload) {
  const candidates = walkForPlayers(payload);
  return candidates.sort((a, b) => b.length - a.length)[0] || [];
}

async function getJson(url) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 Touchline Career Asset Sync',
      accept: 'application/json,text/plain,*/*'
    }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.json();
}

async function download(url, destination) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 Touchline Career Asset Sync',
      accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
    }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1000) throw new Error(`Imagem inválida: ${url}`);
  await writeFile(destination, bytes);
}

function scoreName(target, candidate) {
  const left = normalize(target);
  const right = normalize(candidate);
  if (left === right) return 100;
  const leftParts = new Set(left.split(' '));
  const rightParts = new Set(right.split(' '));
  let overlap = 0;
  for (const part of leftParts) if (rightParts.has(part)) overlap += 1;
  return overlap * 10 - Math.abs(leftParts.size - rightParts.size);
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });
  const manifest = {
    source: 'fotmob-unofficial',
    generatedAt: new Date().toISOString(),
    playerCount: 0,
    players: {}
  };

  for (const [clubCode, teamId] of Object.entries(TEAM_IDS)) {
    console.log(`\n[${clubCode}] Buscando elenco no FotMob...`);
    const payload = await getJson(API_URL(teamId));
    const remoteSquad = bestSquad(payload)
      .map(row => ({ id: Number(row.id), name: row.name || row.fullName || row.playerName || '' }))
      .filter(row => row.id && row.name);

    for (const player of squadFor(clubCode)) {
      const match = remoteSquad
        .map(candidate => ({ candidate, score: scoreName(player.name, candidate.name) }))
        .sort((a, b) => b.score - a.score)[0];

      if (!match || match.score < 9) {
        console.warn(`  sem correspondência: ${player.name}`);
        continue;
      }

      const fileName = `${clubCode.toLowerCase()}-${match.candidate.id}.png`;
      const localPath = `/assets/players/2026-27/${fileName}`;
      try {
        await download(FACE_URL(match.candidate.id), path.join(OUTPUT_DIR, fileName));
        manifest.players[player.id] = {
          playerId: player.id,
          fotmobId: match.candidate.id,
          clubCode,
          name: player.name,
          remoteName: match.candidate.name,
          localPath
        };
        manifest.playerCount += 1;
        console.log(`  ✓ ${player.name}`);
      } catch (error) {
        console.warn(`  falhou ${player.name}: ${error.message}`);
      }
    }
  }

  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  console.log(`\nConcluído: ${manifest.playerCount} fotos locais em ${path.relative(ROOT, OUTPUT_DIR)}`);
}

main().catch(error => {
  console.error(`\nSync FotMob falhou: ${error.message}`);
  process.exitCode = 1;
});

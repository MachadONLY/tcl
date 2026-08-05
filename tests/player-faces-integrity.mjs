import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { squadFor } from '../src/career-core/career-core.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = path.join(ROOT, 'public', 'assets', 'players', '2026-27', 'manifest.json');
const CLUB_CODES = [
  'ARS', 'AVL', 'BOU', 'BRE', 'BHA', 'CHE', 'COV', 'CRY', 'EVE', 'FUL',
  'HUL', 'IPS', 'LEE', 'LIV', 'MCI', 'MUN', 'NEW', 'NFO', 'SUN', 'TOT'
];
const players = CLUB_CODES.flatMap(code => squadFor(code));
const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));

assert.equal(manifest.source, 'fotmob-playerimages-exact');
assert.equal(manifest.sourceHost, 'images.fotmob.com');
assert.equal(manifest.expectedPlayerCount, players.length);
assert.equal(manifest.playerCount, players.length);
assert.equal(manifest.coverage, 1);
assert.equal(Object.keys(manifest.players || {}).length, players.length);

const fotmobIds = new Set();
for (const player of players) {
  const record = manifest.players[player.id];
  assert.ok(record, `missing manifest row for ${player.clubCode} ${player.name}`);
  assert.equal(record.playerId, player.id);
  assert.equal(record.clubCode, player.clubCode);
  assert.ok(Number.isInteger(record.fotmobId) && record.fotmobId > 0, `invalid FotMob id for ${player.name}`);
  assert.equal(record.remoteUrl, `https://images.fotmob.com/image_resources/playerimages/${record.fotmobId}.png`);
  assert.match(record.localPath, /^\/assets\/players\/2026-27\/[a-z]{3}-\d+\.png$/);
  assert.match(record.sha256, /^[a-f0-9]{64}$/);
  assert.ok(record.bytes >= 1000, `image too small for ${player.name}`);
  await access(path.join(ROOT, 'public', record.localPath.replace(/^\//, '')));
  fotmobIds.add(`${player.clubCode}:${record.fotmobId}`);
}

assert.equal(fotmobIds.size, players.length, 'duplicate FotMob portrait assignment inside a club');

console.log(JSON.stringify({
  ok: true,
  source: manifest.source,
  players: players.length,
  coverage: manifest.coverage,
  exactFotMobCdn: true,
  offlineFiles: true
}, null, 2));

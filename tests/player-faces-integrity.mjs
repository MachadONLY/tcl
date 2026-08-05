import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { squadFor } from '../src/career-core/career-core.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = path.join(ROOT, 'public', 'assets', 'players', '2026-27', 'manifest.json');
const ROSTER_PATH = path.join(ROOT, 'src', 'career-core', 'fotmob-rosters.local.json');
const CLUB_CODES = [
  'ARS', 'AVL', 'BOU', 'BRE', 'BHA', 'CHE', 'COV', 'CRY', 'EVE', 'FUL',
  'HUL', 'IPS', 'LEE', 'LIV', 'MCI', 'MUN', 'NEW', 'NFO', 'SUN', 'TOT'
];
const REQUIRED_MUN = [
  'Andrey Santos', 'Youri Tielemans', 'Daniel Gore', 'Harry Amass',
  'Marcus Rashford', 'Enzo Kana Biyik', 'Ethan Wheatley'
];

const players = CLUB_CODES.flatMap(code => squadFor(code));
const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
const rosterPayload = JSON.parse(await readFile(ROSTER_PATH, 'utf8'));
const [facesSource, facesCss] = await Promise.all([
  readFile(path.join(ROOT, 'src', 'career-squad-faces.js'), 'utf8'),
  readFile(path.join(ROOT, 'src', 'career-squad-faces.css'), 'utf8')
]);

assert.equal(manifest.source, 'fotmob-official-full-squads');
assert.equal(manifest.sourceHost, 'images.fotmob.com');
assert.equal(manifest.teamCount, 20);
assert.equal(Object.keys(manifest.teams || {}).length, 20);
assert.ok(players.length >= 600, `expected at least 600 full-squad players, got ${players.length}`);
assert.equal(manifest.expectedPlayerCount, players.length);
assert.equal(manifest.playerCount, players.length);
assert.equal(manifest.coverage, 1);
assert.equal(Object.keys(manifest.players || {}).length, players.length);
assert.equal(rosterPayload.meta.teamCount, 20);
assert.equal(rosterPayload.meta.playerCount, players.length);

for (const code of CLUB_CODES) {
  const squad = squadFor(code);
  assert.ok(squad.length >= 24, `${code} full FotMob squad has only ${squad.length} players`);
  assert.equal(squad.length, manifest.teams[code].playerCount, `${code} roster/manifest mismatch`);
  assert.ok(squad.some(player => player.group === 'GK'), `${code} has no goalkeeper`);
  assert.ok(squad.some(player => player.group === 'DEF'), `${code} has no defender`);
  assert.ok(squad.some(player => player.group === 'MID'), `${code} has no midfielder`);
  assert.ok(squad.some(player => player.group === 'FWD'), `${code} has no forward`);
}

const unitedNames = new Set(squadFor('MUN').map(player => player.name));
for (const name of REQUIRED_MUN) assert.ok(unitedNames.has(name), `Manchester United missing ${name}`);

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
  assert.ok(record.bytes >= 500, `image too small for ${player.name}`);
  await access(path.join(ROOT, 'public', record.localPath.replace(/^\//, '')));
  fotmobIds.add(`${player.clubCode}:${record.fotmobId}`);
}

assert.equal(fotmobIds.size, players.length, 'duplicate FotMob portrait assignment inside a club');
assert.doesNotMatch(facesSource, /createElement\(['"]small['"]\)/);
assert.doesNotMatch(facesCss, /cp-player-photo\s+small/);

console.log(JSON.stringify({
  ok: true,
  source: manifest.source,
  teams: manifest.teamCount,
  players: players.length,
  coverage: manifest.coverage,
  completeFotMobSquads: true,
  exactFotMobCdn: true,
  portraitNumberBadge: false,
  offlineFiles: true
}, null, 2));

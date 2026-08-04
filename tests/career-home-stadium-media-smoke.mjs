import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import {
  STADIUM_EXTENSION_BY_CLUB,
  canonicalStadiumAsset,
  stadiumAssetCandidates
} from '../src/career-core/stadium-assets.js';

const clubCodes = [
  'ARS', 'AVL', 'BHA', 'BOU', 'BRE', 'CHE', 'COV', 'CRY', 'EVE', 'FUL',
  'HUL', 'IPS', 'LEE', 'LIV', 'MCI', 'MUN', 'NEW', 'NFO', 'SUN', 'TOT'
];

assert.equal(Object.keys(STADIUM_EXTENSION_BY_CLUB).length, 20);
assert.equal(canonicalStadiumAsset('HUL'), '/assets/clubs/2026-27/hul/stadium.png');
assert.equal(canonicalStadiumAsset('ARS'), '/assets/clubs/2026-27/ars/stadium.jpg');

for (const code of clubCodes) {
  const candidates = stadiumAssetCandidates(code);
  assert.equal(new Set(candidates).size, candidates.length, `${code} has duplicate candidates`);
  assert.ok(candidates[0].endsWith(`stadium.${STADIUM_EXTENSION_BY_CLUB[code]}`));
  const localPath = new URL(`../public${candidates[0]}`, import.meta.url);
  await access(localPath);
}

const [index, controller] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-home-stadium-media.js', import.meta.url), 'utf8')
]);

assert.match(index, /career-home-stadium-media\.js/);
assert.match(controller, /fixture\.home/);
assert.match(controller, /data-stadium-candidates/);
assert.match(controller, /window\.addEventListener\('error'/);
assert.match(controller, /CareerRepository\.load/);
assert.match(controller, /nextUserFixture/);

console.log(JSON.stringify({
  ok: true,
  clubs: clubCodes.length,
  hullStadium: canonicalStadiumAsset('HUL'),
  source: 'home-club fixture'
}, null, 2));

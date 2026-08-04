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
assert.equal(canonicalStadiumAsset('HUL'), '/assets/clubs/2026-27/hul/stadium-custom.svg');
assert.equal(canonicalStadiumAsset('ARS'), '/assets/clubs/2026-27/ars/stadium.jpg');

for (const code of clubCodes) {
  const candidates = stadiumAssetCandidates(code);
  assert.equal(new Set(candidates).size, candidates.length, `${code} has duplicate candidates`);
  const localPath = new URL(`../public${candidates[0]}`, import.meta.url);
  await access(localPath);
}

const [index, controller, onboardingMedia, hullDecoder, hullSvg] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-home-stadium-media.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/onboarding/offline-media.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-core/hull-stadium-object-url.js', import.meta.url), 'utf8'),
  readFile(new URL('../public/assets/clubs/2026-27/hul/stadium-custom.svg', import.meta.url), 'utf8')
]);

assert.match(index, /career-home-stadium-media\.js/);
assert.match(controller, /fixture\.home/);
assert.match(controller, /data-stadium-candidates/);
assert.match(controller, /window\.addEventListener\('error'/);
assert.match(controller, /CareerRepository\.load/);
assert.match(controller, /nextUserFixture/);
assert.match(controller, /hullStadiumObjectUrl/);
assert.match(onboardingMedia, /hullStadiumObjectUrl/);
assert.match(onboardingMedia, /club\.code === "HUL"/);
assert.match(onboardingMedia, /role === "stadium"/);
assert.match(onboardingMedia, /\["backdrop", hullStadium \|\| entry\.stadium/);
assert.match(hullDecoder, /URL\.createObjectURL/);
assert.match(hullDecoder, /new Blob\(\[bytes\], \{ type: 'image\/webp' \}\)/);
assert.match(hullSvg, /data:image\/webp;base64,/);
assert.match(hullSvg, /viewBox="0 0 1024 576"/);

console.log(JSON.stringify({
  ok: true,
  clubs: clubCodes.length,
  hullStadium: canonicalStadiumAsset('HUL'),
  nativeWebpBlob: true,
  selectorUsesSameAsset: true,
  source: 'home-club fixture'
}, null, 2));

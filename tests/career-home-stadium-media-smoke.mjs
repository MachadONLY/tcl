import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import {
  STADIUM_EXTENSION_BY_CLUB,
  canonicalStadiumAsset,
  stadiumAssetCandidates
} from '../src/career-core/stadium-assets.js';
import { chooseSportsDbStadium, STADIUM_MEDIA_META } from '../src/career-core/stadium-media-service.js';
import { createCareer, nextUserFixture } from '../src/career-core/career-runtime.js';
import { resolveFriendlyClub } from '../src/career-core/friendly-engine.js';

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
  const localPath = new URL(`../public${candidates[0]}`, import.meta.url);
  await access(localPath);
}

const unitedCareer = createCareer('MUN', '2026-07-01T08:00:00.000Z');
const firstFriendly = nextUserFixture(unitedCareer);
assert.equal(firstFriendly.date, '2026-07-18');
assert.equal(firstFriendly.home, 'MUN', 'first United friendly must use Manchester United as the home-background owner');
assert.equal(resolveFriendlyClub(unitedCareer, firstFriendly.away).name, 'Wrexham');

unitedCareer.friendlyResults[firstFriendly.id] = {
  fixtureId: firstFriendly.id,
  fixtureType: 'friendly',
  date: firstFriendly.date,
  home: firstFriendly.home,
  away: firstFriendly.away,
  homeGoals: 2,
  awayGoals: 0,
  events: []
};
const secondFriendly = nextUserFixture(unitedCareer);
assert.equal(secondFriendly.date, '2026-07-24');
assert.equal(resolveFriendlyClub(unitedCareer, secondFriendly.home).name, 'Rosenborg');
assert.notEqual(secondFriendly.home, unitedCareer.clubCode, 'away friendlies must resolve the opponent stadium, never the save club stadium');

const rosenborg = resolveFriendlyClub(unitedCareer, secondFriendly.home);
const sportsDbChoice = chooseSportsDbStadium([
  { idTeam: 'wrong', strSport: 'Ice Hockey', strTeam: 'Rosenborg', strStadium: 'Wrong Arena', strStadiumThumb: 'https://example.test/wrong.jpg' },
  { idTeam: '133728', strSport: 'Soccer', strTeam: 'Rosenborg', strTeamShort: 'RBK', strCountry: 'Norway', strStadium: 'Lerkendal Stadion', strStadiumThumb: 'https://example.test/lerkendal.jpg' }
], rosenborg);
assert.equal(sportsDbChoice?.stadiumName, 'Lerkendal Stadion');
assert.equal(sportsDbChoice?.url, 'https://example.test/lerkendal.jpg');
assert.equal(STADIUM_MEDIA_META.invariant, 'fixture.home owns match background');

const [index, controller, imageFix, service] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-home-stadium-media.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-home-image-fix.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-core/stadium-media-service.js', import.meta.url), 'utf8')
]);

assert.match(index, /career-home-stadium-media\.js/);
assert.match(controller, /career-runtime\.js/, 'stadium bridge must use the same combined fixture runtime as the visible home card');
assert.match(controller, /nextUserFixture\(career\)/);
assert.match(controller, /const homeReference = fixture\.home/);
assert.match(controller, /resolveFriendlyClub\(career, homeReference\)/, 'external friendly home clubs must be resolved');
assert.match(controller, /resolveClubStadiumMedia\(homeClub\)/, 'external home stadiums must use online stadium resolution');
assert.match(controller, /touchline:career-updated/, 'stadium must refresh when the save advances');
assert.match(controller, /data-stadium-candidates/);
assert.match(controller, /revealWhenLoaded/, 'candidate loads must explicitly reveal the stadium image');
assert.match(controller, /window\.addEventListener\('error'/);
assert.doesNotMatch(controller, /career-core\/career-core\.js/, 'league-only next fixture logic must never drive the home stadium');
assert.doesNotMatch(controller, /stadium-custom\.svg/);
assert.doesNotMatch(controller, /hullStadiumObjectUrl/);

const localBranch = controller.indexOf('if (CLUB_BY_CODE.has(homeReference))');
const externalBlank = controller.indexOf('clearWrongBackground(image)', localBranch + 1);
assert.ok(localBranch >= 0 && externalBlank > localBranch, 'verified local home stadiums must be installed before any external-only blanking path');
assert.match(controller.slice(localBranch, externalBlank), /stadiumAssetCandidates\(homeReference\)/, 'local home clubs must use their bundled stadium media directly');

assert.match(service, /strStadiumThumb/);
assert.match(service, /Wikipedia PageImages/);
assert.match(service, /Lerkendal Stadion/);
assert.match(imageFix, /is-stadium-resolving\{opacity:0!important\}/);
assert.match(imageFix, /linear-gradient\(180deg,rgba\(4,7,5,.44\)/);
assert.match(imageFix, /object-fit:cover!important/);

console.log(JSON.stringify({
  ok: true,
  clubs: clubCodes.length,
  hullStadium: canonicalStadiumAsset('HUL'),
  firstFriendlyBackground: 'Manchester United / Old Trafford',
  secondFriendlyBackground: 'Rosenborg / Lerkendal Stadion',
  localStadiumBlankingPrevented: true,
  externalProviderChain: ['TheSportsDB strStadiumThumb', 'Wikipedia PageImages'],
  invariant: STADIUM_MEDIA_META.invariant
}, null, 2));

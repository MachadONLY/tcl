import assert from 'node:assert/strict';
import {
  completePreparedUserMatch,
  createCareer,
  deriveTable,
  nextUserFixture,
  simulateFixture,
  userFixtures
} from '../src/career-core/career-runtime.js';
import {
  cancelFriendly,
  friendlyDateStatus,
  friendlyResultFor,
  resolveFriendlyClub,
  scheduleFriendly
} from '../src/career-core/friendly-engine.js';
import { EUROPEAN_CATALOG_META, EUROPE_COUNTRIES, EUROPEAN_CLUBS } from '../src/career-core/european-club-catalog.js';

const career = createCareer('MUN', '2026-07-01T09:00:00.000Z');
assert.equal(career.schemaVersion, 4);
assert.equal(career.currentDate, '2026-07-01', 'every season must begin on 1 July');
assert.ok(EUROPE_COUNTRIES.length >= 50, 'European browser must include the complete continent-sized country catalog');
assert.ok(EUROPEAN_CLUBS.length >= 1200, 'European browser must include more than one thousand offline clubs');
assert.equal(EUROPEAN_CATALOG_META.runtimeNetworkRequired, false);
assert.equal(new Set(EUROPE_COUNTRIES.map(country => country.code)).size, EUROPE_COUNTRIES.length, 'country codes must be unique');
assert.equal(new Set(EUROPEAN_CLUBS.map(club => club.id)).size, EUROPEAN_CLUBS.length, 'club ids must be unique');

const friendlies = career.friendlies;
const official = friendlies.map(fixture => ({
  date: fixture.date,
  opponent: resolveFriendlyClub(career, fixture.home === 'MUN' ? fixture.away : fixture.home).name
}));
const expectedManchesterUnited = [
  ['2026-07-18', 'Wrexham'],
  ['2026-07-24', 'Rosenborg'],
  ['2026-08-01', 'Atlético Madrid'],
  ['2026-08-08', 'Paris Saint-Germain'],
  ['2026-08-12', 'Leeds United'],
  ['2026-08-15', 'AC Milan']
];
for (const [date, opponent] of expectedManchesterUnited) {
  assert.ok(official.some(row => row.date === date && row.opponent === opponent), `missing official seed ${date} ${opponent}`);
}
assert.equal(new Set(friendlies.map(fixture => fixture.date)).size, friendlies.length, 'user club cannot play twice on one day');

const first = nextUserFixture(career);
assert.equal(first.date, '2026-07-18');
assert.equal(first.fixtureType, 'friendly');
assert.equal(userFixtures(career)[0].id, first.id);

const psg = EUROPEAN_CLUBS.find(club => club.name === 'Paris Saint-Germain');
assert.ok(psg);
const openDate = friendlyDateStatus(career, '2026-07-02', psg.id);
assert.equal(openDate.available, true);
const custom = scheduleFriendly(career, { date: '2026-07-02', opponentId: psg.id, venue: 'home', time: '19:30' });
assert.equal(custom.fixtureType, 'friendly');
assert.throws(
  () => scheduleFriendly(career, { date: '2026-07-02', opponentId: EUROPEAN_CLUBS.find(club => club.name === 'Real Madrid').id }),
  /já tem uma partida/
);
const realBetis = EUROPEAN_CLUBS.find(club => club.name === 'Real Betis');
const opponentConflict = friendlyDateStatus(career, '2026-08-05', realBetis.id);
assert.equal(opponentConflict.available, false, 'opponent cannot be double-booked against Arsenal and the user');
cancelFriendly(career, custom.id);
assert.equal(career.friendlies.some(fixture => fixture.id === custom.id), false);

career.currentDate = first.date;
const result = simulateFixture(career, first);
completePreparedUserMatch(career, result);
assert.ok(friendlyResultFor(career, first));
assert.equal(Object.keys(career.results).length, 0, 'friendlies must not enter Premier League results');
assert.equal(career.currentDate, '2026-07-19');
assert.ok(Object.values(career.playerState).some(state => state.sharpness > 72), 'friendlies must build match sharpness');
assert.ok(deriveTable(career).every(row => row.played === 0), 'friendlies must not alter the league table');

console.log(JSON.stringify({
  ok: true,
  seasonStart: '2026-07-01',
  countries: EUROPE_COUNTRIES.length,
  clubs: EUROPEAN_CLUBS.length,
  officialManchesterUnitedFriendlies: expectedManchesterUnited.length,
  sameDayDoubleBookingBlocked: true,
  opponentConflictBlocked: true,
  cancelSupported: true,
  friendlyExcludedFromLeagueTable: true
}, null, 2));

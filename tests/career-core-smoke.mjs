import assert from "node:assert/strict";
import {
  completeSeasonForTest,
  createCareer,
  deriveTable,
  nextUserFixture,
  playCurrentUserFixture,
  simulateFixture,
  squadFor
} from "../src/career-core/career-core.js";
import { CLUB_CATALOG, FIXTURES, validateSeasonPack } from "../src/career-core/season-2026-27.js";

const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

assert.deepEqual(validateSeasonPack(), []);
assert.equal(CLUB_CATALOG.length, 20);
assert.equal(FIXTURES.length, 380);
assert.equal(new Set(FIXTURES.map(fixture => fixture.matchweek)).size, 38);
assert.equal(FIXTURES[0].date, "2026-08-21");
assert.equal(FIXTURES.at(-1).date, "2027-05-30");

for (const club of CLUB_CATALOG) {
  const squad = squadFor(club.code);
  assert.ok(squad.length >= 18, `${club.code} needs a playable squad`);
  assert.equal(squad.some(player => normalize(player.name) === normalize(club.manager)), false, `${club.code} manager must not be a player`);
  assert.ok(squad.every(player => ['GK', 'DEF', 'MID', 'FWD'].includes(player.group)), `${club.code} has invalid role groups`);
  assert.equal(FIXTURES.filter(fixture => fixture.home === club.code).length, 19);
  assert.equal(FIXTURES.filter(fixture => fixture.away === club.code).length, 19);
}

const united = squadFor('MUN');
assert.equal(united.some(player => normalize(player.name) === 'michael carrick'), false);
assert.equal(united.find(player => normalize(player.name) === 'andrey santos')?.group, 'MID');
assert.equal(united.find(player => normalize(player.name) === 'youri tielemans')?.group, 'MID');

for (let left = 0; left < CLUB_CATALOG.length; left += 1) {
  for (let right = left + 1; right < CLUB_CATALOG.length; right += 1) {
    const first = CLUB_CATALOG[left].code;
    const second = CLUB_CATALOG[right].code;
    const meetings = FIXTURES.filter(fixture =>
      (fixture.home === first && fixture.away === second) ||
      (fixture.home === second && fixture.away === first)
    );
    assert.equal(meetings.length, 2, `${first}/${second} must meet twice`);
    assert.notEqual(meetings[0].home, meetings[1].home, `${first}/${second} must swap home team`);
  }
}

const career = createCareer("TOT", "2026-08-04T12:00:00.000Z");
assert.equal(career.currentDate, "2026-08-10");
assert.equal(career.lineup.length, 11);
assert.equal(career.clubCode, "TOT");

const opener = nextUserFixture(career);
assert.ok(opener);
const firstSimulation = simulateFixture(career, opener);
const secondSimulation = simulateFixture(career, opener);
assert.deepEqual(
  {
    score: [firstSimulation.homeGoals, firstSimulation.awayGoals],
    events: firstSimulation.events,
    stats: firstSimulation.stats,
    seed: firstSimulation.seed
  },
  {
    score: [secondSimulation.homeGoals, secondSimulation.awayGoals],
    events: secondSimulation.events,
    stats: secondSimulation.stats,
    seed: secondSimulation.seed
  },
  "same save and tactics must produce the same match"
);

while (career.currentDate < opener.date) {
  const { advanceOneDay } = await import("../src/career-core/career-core.js");
  advanceOneDay(career);
}
const firstPlayed = playCurrentUserFixture(career);
assert.equal(firstPlayed.fixture.id, opener.id);
assert.ok(career.results[opener.id]);
assert.equal(career.recentForm.length, 1);
assert.ok(career.inbox.some(message => message.id === `match-report-${opener.id}`));

completeSeasonForTest(career);
assert.equal(Object.keys(career.results).length, 380);
assert.equal(career.status, "complete");
const table = deriveTable(career);
assert.equal(table.length, 20);
assert.ok(table.every(row => row.played === 38));
assert.ok(table.every(row => row.wins + row.draws + row.losses === 38));
assert.equal(table.reduce((sum, row) => sum + row.gf, 0), table.reduce((sum, row) => sum + row.ga, 0));
assert.ok(table[0].points >= table.at(-1).points);
assert.ok(career.seasonSummary.position >= 1 && career.seasonSummary.position <= 20);

console.log(JSON.stringify({
  ok: true,
  clubs: CLUB_CATALOG.length,
  fixtures: FIXTURES.length,
  players: Object.fromEntries(CLUB_CATALOG.map(club => [club.code, squadFor(club.code).length])),
  managerExcluded: true,
  unitedMidfieldVerified: true,
  champion: table[0].name,
  userFinish: career.seasonSummary.position,
  userPoints: career.seasonSummary.points
}, null, 2));

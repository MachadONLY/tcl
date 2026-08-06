import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PLAYER_BY_ID, createCareer } from '../src/career-core/career-core.js';
import { CLUB_BY_CODE } from '../src/career-core/season-2026-27-live.js';
import { clubForm, leagueLeaders, nextClubFixture, standingsRows } from '../src/career-core/league-hub-data.js';

const career = createCareer('BOU');
const players = [...PLAYER_BY_ID.values()].slice(0, 3);
assert.equal(players.length, 3, 'Test needs three players');

career.playerStats = {
  [players[0].id]: { appearances: 4, goals: 3, assists: 1, penaltyGoals: 1 },
  [players[1].id]: { appearances: 4, goals: 2, assists: 4, penaltyGoals: 0 },
  [players[2].id]: { appearances: 3, goals: 1, assists: 2, penaltyGoals: 0 }
};

const scorers = leagueLeaders(career, 'goals');
const assists = leagueLeaders(career, 'assists');
assert.equal(scorers[0].player.id, players[0].id, 'Goal leaders must sort by goals');
assert.equal(assists[0].player.id, players[1].id, 'Assist leaders must sort by assists');
assert.equal(scorers[0].goals, 3);
assert.equal(scorers[0].penaltyGoals, 1, 'Goal leaders must expose penalty goals');
assert.equal(assists[0].assists, 4);

const firstFixture = nextClubFixture(career, 'BOU');
assert.ok(firstFixture, 'Bournemouth must have a next fixture');
career.results[firstFixture.id] = {
  fixtureId: firstFixture.id,
  date: firstFixture.date,
  matchweek: firstFixture.matchweek,
  home: firstFixture.home,
  away: firstFixture.away,
  homeGoals: firstFixture.home === 'BOU' ? 2 : 0,
  awayGoals: firstFixture.away === 'BOU' ? 2 : 0,
  events: [{ type: 'goal', playerId: players[0].id, isPenalty: true }]
};

const updatedScorers = leagueLeaders(career, 'goals');
assert.equal(updatedScorers[0].penaltyGoals, 1, 'Penalty events in saved results must be counted without duplication');

const secondFixture = nextClubFixture(career, 'BOU');
assert.ok(secondFixture && secondFixture.id !== firstFixture.id, 'Next fixture must advance after a result');
career.results[secondFixture.id] = {
  fixtureId: secondFixture.id,
  date: secondFixture.date,
  matchweek: secondFixture.matchweek,
  home: secondFixture.home,
  away: secondFixture.away,
  homeGoals: 1,
  awayGoals: 1
};

assert.deepEqual(clubForm(career, 'BOU'), ['W', 'D'], 'Club form must preserve chronological results');

const standings = standingsRows(career);
assert.equal(standings.length, 20, 'Premier League table must contain 20 clubs');
assert.ok(standings.every(row => CLUB_BY_CODE.has(row.code)), 'Every standings row must map to an official club');
const bournemouth = standings.find(row => row.code === 'BOU');
assert.equal(bournemouth.played, 2);
assert.deepEqual(bournemouth.form, ['W', 'D']);
assert.equal(bournemouth.nextFixture.id, nextClubFixture(career, 'BOU').id);

const [hubSource, hubCss] = await Promise.all([
  readFile(new URL('../src/career-league-hub.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-league-hub.css', import.meta.url), 'utf8')
]);
assert.ok(hubSource.includes('cp-league-leader-row-minimal'), 'Leader rows must use the minimal layout');
assert.ok(hubSource.includes('penaltyLabel(row.penaltyGoals)'), 'Scorers must show penalty goals');
assert.ok(hubSource.includes('cp-league-player-club-mark'), 'Leader rows must retain the club crest');
assert.ok(!hubSource.includes('<span>Posição</span><span>Jogos</span><span>OVR</span>'), 'Position, appearances and OVR columns must stay removed');
assert.ok(hubCss.includes('grid-template-columns:48px minmax(0,1fr) 88px'), 'Minimal leader rows must keep a compact three-column grid');

console.log(JSON.stringify({
  ok: true,
  views: ['table', 'scorers', 'assists'],
  clubs: standings.length,
  scorer: scorers[0].player.name,
  scorerPenaltyGoals: scorers[0].penaltyGoals,
  assistLeader: assists[0].player.name,
  leaderLayout: 'rank-face-club-name-penalties-total',
  bournemouthForm: bournemouth.form
}, null, 2));

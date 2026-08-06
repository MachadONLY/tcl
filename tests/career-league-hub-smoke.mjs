import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { autoPickLineup, createCareer } from '../src/career-core/career-core.js';
import { CLUB_BY_CODE, FIXTURES } from '../src/career-core/season-2026-27-live.js';
import { auditCareerData, reconcileCareerData } from '../src/career-core/result-integrity.js';
import { clubForm, leagueLeaders, leagueProgress, nextClubFixture, standingsRows } from '../src/career-core/league-hub-data.js';

const fixture = FIXTURES[0];
const career = createCareer(fixture.home);
const homeLineup = autoPickLineup(fixture.home);
const awayLineup = autoPickLineup(fixture.away);
const [homeScorer, homeCreator] = homeLineup;
const [awayScorer] = awayLineup;

career.results = {
  [fixture.id]: {
    fixtureId: fixture.id,
    matchweek: 999,
    date: '2099-01-01',
    home: fixture.home,
    away: fixture.away,
    homeGoals: 99,
    awayGoals: 88,
    lineups: { home: homeLineup, away: awayLineup },
    events: [
      { type: 'goal', minute: 10, side: 'home', playerId: homeScorer, isPenalty: true },
      { type: 'goal', minute: 28, side: 'home', playerId: homeScorer, assistPlayerId: homeCreator },
      { type: 'goal', minute: 45, side: 'home', playerId: awayScorer },
      { type: 'goal', minute: 67, side: 'away', playerId: awayScorer }
    ]
  },
  invalid: {
    fixtureId: 'not-a-real-fixture',
    homeGoals: 7,
    awayGoals: 7,
    events: []
  }
};
career.playerStats = {
  [awayScorer]: { appearances: 77, goals: 99, assists: 88, penaltyGoals: 55 }
};

reconcileCareerData(career);
assert.equal(Object.keys(career.results).length, 1, 'Invalid fixtures must be removed from the canonical save');
assert.equal(career.results[fixture.id].events.length, 3, 'A scorer assigned to the wrong team must be discarded');
assert.equal(career.results[fixture.id].homeGoals, 2, 'Home score must be derived from valid goal events');
assert.equal(career.results[fixture.id].awayGoals, 1, 'Away score must be derived from valid goal events');
assert.equal(career.results[fixture.id].matchweek, fixture.matchweek, 'Fixture metadata must come from the official schedule');
assert.equal(career.results[fixture.id].date, fixture.date, 'Fixture date must come from the official schedule');

const audit = auditCareerData(career);
assert.equal(audit.ok, true, 'Canonical results, score, goals, assists and penalties must reconcile');
assert.equal(audit.results, 1);
assert.equal(audit.goals, 3);
assert.equal(audit.assists, 1);
assert.equal(audit.penaltyGoals, 1);

const scorers = leagueLeaders(career, 'goals');
const assists = leagueLeaders(career, 'assists');
assert.equal(scorers[0].player.id, homeScorer, 'Scorer ranking must come from actual goal events');
assert.equal(scorers[0].goals, 2);
assert.equal(scorers[0].penaltyGoals, 1);
assert.equal(assists[0].player.id, homeCreator, 'Assist ranking must come from actual assist events');
assert.equal(assists[0].assists, 1);
assert.notEqual(scorers[0].player.id, awayScorer, 'Corrupted cached playerStats must never control the ranking');

const standings = standingsRows(career);
assert.equal(standings.length, 20, 'Premier League table must contain 20 clubs');
assert.ok(standings.every(row => CLUB_BY_CODE.has(row.code)), 'Every standings row must map to an official club');
const homeClub = standings.find(row => row.code === fixture.home);
const awayClub = standings.find(row => row.code === fixture.away);
assert.equal(homeClub.played, 1);
assert.equal(homeClub.wins, 1);
assert.equal(homeClub.gf, 2);
assert.equal(homeClub.ga, 1);
assert.equal(awayClub.played, 1);
assert.equal(awayClub.losses, 1);
assert.deepEqual(clubForm(career, fixture.home), ['W']);
assert.deepEqual(clubForm(career, fixture.away), ['L']);

const progress = leagueProgress(career);
assert.equal(progress.clubPlayed, 1, 'Page progress must show the managed club matches, not all league results');
assert.equal(progress.clubTotal, 38);
assert.equal(progress.leagueMatches, 1);
assert.equal(progress.tableMatchTotal, 1, 'Table appearances divided by two must equal canonical results');
assert.ok(nextClubFixture(career, fixture.home)?.id !== fixture.id, 'Next fixture must advance after a canonical result');

const [hubSource, hubCss] = await Promise.all([
  readFile(new URL('../src/career-league-hub.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-league-hub.css', import.meta.url), 'utf8')
]);
assert.ok(hubSource.includes('leagueProgress(career)'), 'League UI must use canonical club progress');
assert.ok(hubSource.includes('progress.clubPlayed'), 'League subtitle must show managed-club matches');
assert.ok(hubSource.includes('cp-league-leader-row-minimal'), 'Leader rows must use the minimal layout');
assert.ok(hubSource.includes('penaltyLabel(row.penaltyGoals)'), 'Scorers must show penalty goals');
assert.ok(hubSource.includes('cp-league-player-club-mark'), 'Leader rows must retain the club crest');
assert.ok(!hubSource.includes('<span>Posição</span><span>Jogos</span><span>OVR</span>'), 'Position, appearances and OVR columns must stay removed');
assert.ok(hubCss.includes('grid-template-columns:48px minmax(0,1fr) 88px'), 'Minimal leader rows must keep a compact three-column grid');

console.log(JSON.stringify({
  ok: true,
  sourceOfTruth: 'canonical-match-events',
  views: ['table', 'scorers', 'assists'],
  clubs: standings.length,
  managedClubMatches: progress.clubPlayed,
  leagueMatches: progress.leagueMatches,
  scorer: scorers[0].player.name,
  scorerGoals: scorers[0].goals,
  scorerPenaltyGoals: scorers[0].penaltyGoals,
  assistLeader: assists[0].player.name,
  goalsReconciled: audit.goals,
  assistsReconciled: audit.assists,
  wrongTeamGoalRejected: true
}, null, 2));

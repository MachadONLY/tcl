import assert from 'node:assert/strict';
import { parseOfficialEaRatingsHtml } from '../scripts/official-ea-ratings.mjs';
import { buildWorldSnapshot } from '../scripts/sync-world-player-database.mjs';

const html = `
<div class="rating-card">
  <a href="/games/ea-sports-fc/ratings/player-ratings/test-star/999001">Test Star</a>
  <a href="/games/ea-sports-fc/ratings/teams-ratings/real-madrid/243">Real Madrid</a>
  <a href="/games/ea-sports-fc/ratings?nationality=45">Spain</a>
  <span>ST</span><span>OVR 88</span><span>PAC 91</span><span>SHO 87</span><span>PAS 80</span><span>DRI 89</span><span>DEF 42</span><span>PHY 78</span>
</div>`;
const parsed = parseOfficialEaRatingsHtml(html);
assert.equal(parsed.length, 1);
assert.equal(parsed[0].eaPlayerId, 999001);
assert.equal(parsed[0].teamId, 243);
assert.equal(parsed[0].teamName, 'Real Madrid');
assert.equal(parsed[0].overall, 88);
assert.equal(parsed[0].attributes.pace, 91);

function squad(teamId, teamName, startId, countrySeed = 0) {
  const positions = ['GK', 'CB', 'CB', 'LB', 'RB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST', 'ST', 'CM', 'CB', 'GK'];
  return positions.map((position, index) => ({
    playerId: startId + index,
    name: `${teamName} Player ${index + 1}`,
    normalizedName: `${teamName.toLowerCase()} player ${index + 1}`,
    teamId,
    teamName,
    leagueName: teamName === 'Real Madrid' ? 'LaLiga' : teamName === 'Borussia Dortmund' ? 'Bundesliga' : 'First League',
    nationality: ['Spain', 'Germany', 'Bulgaria'][(countrySeed + index) % 3],
    age: 18 + index,
    rating: 82 - Math.floor(index / 2),
    potential: 86 - Math.floor(index / 3),
    positions: position,
    group: position === 'GK' ? 'GK' : ['CB', 'LB', 'RB'].includes(position) ? 'DEF' : position === 'ST' ? 'FWD' : 'MID',
    value: 8_000_000 + index * 500_000,
    wage: 20_000 + index * 1_000,
    contractUntil: '2029-06-30',
    attributes: { pace: 70 + index % 10, passing: 72, shooting: 68 },
    source: 'TEST'
  }));
}

const datasetRows = [
  ...squad(243, 'Real Madrid', 1000, 0),
  ...squad(22, 'Borussia Dortmund', 2000, 1),
  ...squad(1901, 'Ludogorets', 3000, 2),
  ...squad(1, 'Arsenal', 4000, 0)
];
const officialRows = Array.from({ length: 10000 }, (_, index) => {
  if (index < datasetRows.length) {
    const row = datasetRows[index];
    return {
      eaPlayerId: row.playerId,
      name: row.name,
      normalizedName: row.normalizedName,
      teamId: row.teamId,
      teamName: row.teamName,
      position: row.positions,
      group: row.group,
      overall: row.rating,
      attributes: { pace: row.attributes.pace },
      source: 'EA_SPORTS_FC_26_OFFICIAL'
    };
  }
  return {
    eaPlayerId: 50000 + index,
    name: `Ignored Player ${index}`,
    normalizedName: `ignored player ${index}`,
    teamId: 900000 + Math.floor(index / 20),
    teamName: `Non European Team ${Math.floor(index / 20)}`,
    position: 'CM',
    group: 'MID',
    overall: 70,
    attributes: {},
    source: 'EA_SPORTS_FC_26_OFFICIAL'
  };
});

const catalog = [
  { id: 'esp-1-real-madrid', code: null, name: 'Real Madrid', countryCode: 'ESP', country: 'Spain', league: 'LaLiga', division: 1, rating: 86, reputation: 5 },
  { id: 'ger-1-borussia-dortmund', code: null, name: 'Borussia Dortmund', countryCode: 'GER', country: 'Germany', league: 'Bundesliga', division: 1, rating: 83, reputation: 5 },
  { id: 'bul-1-ludogorets', code: null, name: 'Ludogorets', countryCode: 'BUL', country: 'Bulgaria', league: 'First League', division: 1, rating: 72, reputation: 3 },
  { id: 'eng-1-arsenal', code: 'ARS', name: 'Arsenal', countryCode: 'ENG', country: 'England', league: 'Premier League', division: 1, rating: 88, reputation: 5 }
];

const snapshot = buildWorldSnapshot({ datasetRows, officialRows, catalog, generatedAt: '2026-08-08T21:00:00.000Z' });
assert.equal(snapshot.clubs.length, 3, 'Premier League clubs must stay owned by the existing live roster layer');
assert.equal(snapshot.players.length, 45);
assert.ok(snapshot.clubs.some(club => club.name === 'Real Madrid'));
assert.ok(snapshot.clubs.some(club => club.name === 'Borussia Dortmund'));
assert.ok(snapshot.clubs.some(club => club.name === 'Ludogorets'));
assert.ok(snapshot.players.every(player => player.worldExternal));
assert.ok(snapshot.players.some(player => player.initialSquadRole === 'key'));
assert.equal(snapshot.meta.ignoredInternalPlayers, 15);

console.log(JSON.stringify({
  ok: true,
  parsedOfficialTeam: parsed[0].teamName,
  externalClubs: snapshot.clubs.map(club => club.name),
  externalPlayers: snapshot.players.length,
  premierLeagueOverridePreserved: true
}, null, 2));

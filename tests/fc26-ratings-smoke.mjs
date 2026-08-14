import assert from 'node:assert/strict';
import { applyRatings, auditRatings, matchRating } from '../scripts/sync-fc26-ratings.mjs';

const CLUB_CODES = ['ARS','AVL','BOU','BRE','BHA','CHE','COV','CRY','EVE','FUL','HUL','IPS','LEE','LIV','MCI','MUN','NEW','NFO','SUN','TOT'];
const rosterPayload = { meta: {}, rosters: {} };
const ratingRows = [];

for (const [index, code] of CLUB_CODES.entries()) {
  rosterPayload.rosters[code] = [
    { name: `${code} Senior`, group: 'MID', position: 'CM', age: 27 },
    { name: `${code} Academy`, group: 'MID', position: 'CM', age: 19 }
  ];
  ratingRows.push({
    playerId: 1000 + index,
    names: [`${code.toLowerCase()} senior`],
    displayName: `${code} Senior`,
    overall: 80,
    potential: 80,
    age: 27,
    group: 'MID',
    positions: 'CM',
    teamCode: code,
    teamName: code,
    roster: '260007',
    updatedAt: '2025-10-23',
    source: 'SOFIFA_API_LATEST'
  });
}

rosterPayload.rosters.MUN = [
  { name: 'Ayden Heaven', group: 'DEF', position: 'CB', age: 19 },
  { name: 'Matthijs de Ligt', group: 'DEF', position: 'CB', age: 26 },
  { name: 'Harry Maguire', group: 'DEF', position: 'CB', age: 33 }
];
rosterPayload.rosters.NEW = [
  { name: 'Sandro Tonali', group: 'MID', position: 'CM, CDM', age: 25 },
  { name: 'Newcastle Academy', group: 'MID', position: 'CM', age: 19 }
];
rosterPayload.rosters.MCI = [
  { name: 'Rúben Dias', group: 'DEF', position: 'CB', age: 29 },
  { name: 'City Academy', group: 'DEF', position: 'CB', age: 18 }
];

ratingRows.push(
  {
    playerId: 75087, names: ['ayden heaven', 'ayden edford heaven'], displayName: 'Ayden Heaven',
    overall: 69, potential: 84, age: 19, group: 'DEF', positions: 'CB, LB', teamCode: 'MUN',
    teamName: 'Manchester United', roster: '260007', updatedAt: '2025-10-23', source: 'SOFIFA_API_LATEST'
  },
  {
    playerId: 235243, names: ['matthijs de ligt'], displayName: 'Matthijs de Ligt',
    overall: 82, potential: 84, age: 26, group: 'DEF', positions: 'CB', teamCode: 'MUN',
    teamName: 'Manchester United', roster: '260007', updatedAt: '2025-10-23', source: 'SOFIFA_API_LATEST'
  },
  {
    playerId: 241096, names: ['sandro tonali'], displayName: 'Sandro Tonali',
    overall: 86, potential: 88, age: 25, group: 'MID', positions: 'CDM, CM', teamCode: 'NEW',
    teamName: 'Newcastle United', roster: '260007', updatedAt: '2025-10-23', source: 'SOFIFA_API_LATEST'
  },
  {
    playerId: 239818, names: ['ruben dias', 'ruben dos santos gato alves dias'], displayName: 'Rúben Dias',
    overall: 86, potential: 86, age: 29, group: 'DEF', positions: 'CB', teamCode: 'MCI',
    teamName: 'Manchester City', roster: '260007', updatedAt: '2025-10-23', source: 'SOFIFA_API_LATEST'
  }
);

const result = applyRatings(rosterPayload, ratingRows);
const heaven = rosterPayload.rosters.MUN.find(player => player.name === 'Ayden Heaven');
const deLigt = rosterPayload.rosters.MUN.find(player => player.name === 'Matthijs de Ligt');
const maguire = rosterPayload.rosters.MUN.find(player => player.name === 'Harry Maguire');
const tonali = rosterPayload.rosters.NEW.find(player => player.name === 'Sandro Tonali');
const newcastleAcademy = rosterPayload.rosters.NEW.find(player => player.name === 'Newcastle Academy');
const dias = rosterPayload.rosters.MCI.find(player => player.name === 'Rúben Dias');
const cityAcademy = rosterPayload.rosters.MCI.find(player => player.name === 'City Academy');

assert.equal(heaven.rating, 69);
assert.equal(deLigt.rating, 82);
assert.equal(tonali.rating, 86);
assert.equal(dias.rating, 86);
assert.ok(deLigt.rating > heaven.rating);
assert.ok(tonali.rating > newcastleAcademy.rating);
assert.ok(dias.rating > cityAcademy.rating);
assert.ok(maguire.rating <= 79);
assert.ok(newcastleAcademy.rating <= 74);
assert.ok(cityAcademy.rating <= 72);

const audit = auditRatings(rosterPayload, {
  minimumGlobalRealCoverage: 0.45,
  minimumClubRealCoverage: 0.45,
  strictReferences: true
});
assert.equal(audit.passed, true, audit.issues.join('\n'));
assert.equal(audit.teamCount, 20);
assert.equal(Object.keys(audit.teamReports).length, 20);

const corrupted = structuredClone(rosterPayload);
corrupted.rosters.MCI.find(player => player.name === 'City Academy').rating = 90;
const corruptedAudit = auditRatings(corrupted, {
  minimumGlobalRealCoverage: 0.45,
  minimumClubRealCoverage: 0.45,
  strictReferences: true
});
assert.equal(corruptedAudit.passed, false);
assert.ok(corruptedAudit.issues.some(issue => issue.includes('estimativa acima de 79')));

const exactIndex = new Map([['matthijs de ligt', [ratingRows.find(row => row.playerId === 235243)]]]);
assert.equal(matchRating({ name: 'Matthijs de Ligt', group: 'DEF', age: 26 }, 'MUN', exactIndex)?.overall, 82);

console.log(JSON.stringify({
  ok: true,
  matched: result.matched,
  estimated: result.estimated,
  teamsAudited: audit.teamCount,
  heaven: heaven.rating,
  deLigt: deLigt.rating,
  tonali: tonali.rating,
  rubenDias: dias.rating,
  corruptionDetected: !corruptedAudit.passed
}, null, 2));

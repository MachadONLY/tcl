import assert from 'node:assert/strict';
import { applyRatings, matchRating } from '../scripts/sync-fc26-ratings.mjs';

const rosterPayload = {
  meta: {},
  rosters: {
    MUN: [
      { name: 'Ayden Heaven', group: 'DEF', position: 'CB', age: 19 },
      { name: 'Matthijs de Ligt', group: 'DEF', position: 'CB', age: 26 },
      { name: 'Harry Maguire', group: 'DEF', position: 'CB', age: 33 }
    ]
  }
};

const ratingRows = [
  {
    playerId: 75087,
    names: ['ayden heaven', 'ayden edford heaven'],
    displayName: 'Ayden Heaven',
    overall: 69,
    potential: 84,
    age: 19,
    group: 'DEF',
    positions: 'CB, LB',
    teamCode: 'MUN',
    teamName: 'Manchester United',
    roster: '260007',
    updatedAt: '2025-10-23',
    source: 'SOFIFA_API_LATEST'
  },
  {
    playerId: 235243,
    names: ['matthijs de ligt'],
    displayName: 'Matthijs de Ligt',
    overall: 82,
    potential: 84,
    age: 26,
    group: 'DEF',
    positions: 'CB',
    teamCode: 'MUN',
    teamName: 'Manchester United',
    roster: '260007',
    updatedAt: '2025-10-23',
    source: 'SOFIFA_API_LATEST'
  }
];

const result = applyRatings(rosterPayload, ratingRows);
const [heaven, deLigt, maguire] = rosterPayload.rosters.MUN;

assert.equal(result.matched, 2);
assert.equal(result.estimated, 1);
assert.equal(heaven.rating, 69);
assert.equal(deLigt.rating, 82);
assert.ok(deLigt.rating > heaven.rating);
assert.equal(heaven.ratingSource, 'SOFIFA_API_LATEST');
assert.equal(deLigt.ratingSource, 'SOFIFA_API_LATEST');
assert.equal(maguire.ratingSource, 'TOUCHLINE_GROUP_MEDIAN_ESTIMATE');
assert.ok(maguire.rating >= heaven.rating && maguire.rating <= deLigt.rating);

const exactIndex = new Map([['matthijs de ligt', [ratingRows[1]]]]);
assert.equal(matchRating({ name: 'Matthijs de Ligt', group: 'DEF', age: 26 }, 'MUN', exactIndex)?.overall, 82);

console.log(JSON.stringify({
  ok: true,
  matched: result.matched,
  estimated: result.estimated,
  heaven: heaven.rating,
  deLigt: deLigt.rating,
  conservativeFallback: maguire.rating
}, null, 2));

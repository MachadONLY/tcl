import assert from 'node:assert/strict';
import {
  PLAYER_BY_ID,
  analyzeTactics,
  createCareer,
  normalizeTactics,
  setTactic,
  simulateFixture
} from '../src/career-core/career-core.js';
import { FIXTURES } from '../src/career-core/season-2026-27-live.js';

const career = createCareer('MUN');
const players = career.lineup.map(id => PLAYER_BY_ID.get(id)).filter(Boolean);
assert.equal(career.schemaVersion, 3);
assert.equal(Object.keys(career.tactics.plans).length, 3);
assert.equal(players.length, 11);

const balanced = analyzeTactics(career.tactics, players);
const attackingDraft = normalizeTactics({
  ...career.tactics,
  mentality: 'Ofensiva',
  pressing: 88,
  tempo: 88,
  defensiveLine: 82,
  afterLoss: 'Contrapressão',
  afterWin: 'Contra-atacar',
  chanceCreation: 'Infiltrações',
  roles: {
    ...career.tactics.roles,
    [players.at(-1).id]: { role: 'Finalizador', focus: 'Atacar' }
  }
});

globalThis.__touchlineTacticsDraft = attackingDraft;
setTactic(career, 'pressing', 88);
delete globalThis.__touchlineTacticsDraft;

assert.equal(career.tactics.afterLoss, 'Contrapressão');
assert.equal(career.tactics.roles[players.at(-1).id].role, 'Finalizador');
const attacking = analyzeTactics(career.tactics, players);
assert.ok(attacking.metrics.intensity > balanced.metrics.intensity);
assert.ok(attacking.metrics.penetration >= balanced.metrics.penetration);

const defensive = analyzeTactics(normalizeTactics({
  ...career.tactics,
  mentality: 'Cautelosa',
  pressing: 40,
  tempo: 42,
  defensiveLine: 38,
  afterLoss: 'Recompor',
  defensiveShape: 'Bloco baixo'
}), players);
assert.ok(defensive.metrics.protection > attacking.metrics.protection);

const fixture = FIXTURES.find(item => item.home === 'MUN' || item.away === 'MUN');
const result = simulateFixture(career, fixture);
const side = fixture.home === 'MUN' ? 'home' : 'away';
assert.ok(Number.isFinite(result.stats[side].xg));
assert.ok(Number.isInteger(result.stats[side].highRecoveries));
assert.ok(Number.isInteger(result.stats[side].counters));
assert.ok(Number.isInteger(result.stats[side].crosses));
assert.ok(result.tactical[side].metrics.intensity >= 80);
assert.equal(result.tactical[side].plan, 'A');

console.log(JSON.stringify({
  ok: true,
  schemaVersion: career.schemaVersion,
  plans: Object.keys(career.tactics.plans),
  balanced: balanced.metrics,
  attacking: attacking.metrics,
  defensive: defensive.metrics,
  match: {
    xg: result.stats[side].xg,
    highRecoveries: result.stats[side].highRecoveries,
    counters: result.stats[side].counters,
    crosses: result.stats[side].crosses,
    tacticalLoad: result.tactical[side].load
  }
}, null, 2));

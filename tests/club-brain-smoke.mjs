import assert from 'node:assert/strict';
import { createCareer } from '../src/career-core/career-runtime.js';
import { processWorldDay } from '../src/career-world/world-engine.js';
import { europeanBrainCoverage, europeanClubBrain } from '../src/career-world/clubs/european-brain-registry.js';

const career = createCareer('TOT', '2026-08-08T21:30:00.000Z');
processWorldDay(career, '2026-07-01');

for (const code of ['ARS', 'BHA', 'BRE', 'CHE', 'LIV', 'MCI', 'MUN', 'TOT']) {
  assert.ok(career.world.clubs[code]?.brain, `${code} must have a persistent ClubBrain`);
  assert.ok(career.world.clubs[code]?.managerBrain, `${code} must have a persistent ManagerBrain`);
  assert.ok(Array.isArray(career.world.clubs[code]?.recruitment?.requirements), `${code} must publish recruitment requirements`);
}

assert.notDeepEqual(career.world.clubs.BHA.brain.recruitment, career.world.clubs.MCI.brain.recruitment, 'Brighton and Man City cannot recruit with the same profile');
assert.notEqual(career.world.clubs.TOT.brain.tacticalIdentity.style, career.world.clubs.ARS.brain.tacticalIdentity.style, 'Spurs and Arsenal should have distinct recruitment/tactical identities');

const realMadrid = europeanClubBrain('Real Madrid', career.world.seed);
const dortmund = europeanClubBrain('Borussia Dortmund', career.world.seed);
const ludogorets = europeanClubBrain('Ludogorets', career.world.seed) || europeanClubBrain('Ludogorets Razgrad', career.world.seed);
assert.ok(realMadrid, 'Real Madrid must exist in European intelligence registry');
assert.ok(dortmund, 'Borussia Dortmund must exist in European intelligence registry');
assert.ok(ludogorets, 'Ludogorets must exist in European intelligence registry');
assert.ok(realMadrid.brain.recruitment.starBias > dortmund.brain.recruitment.starBias, 'Real Madrid should tolerate superstar recruitment more than Dortmund');
assert.ok(dortmund.brain.recruitment.youthBias > realMadrid.brain.recruitment.youthBias, 'Dortmund should lean harder toward youth development');
assert.ok(ludogorets.brain.recruitment.feeDiscipline > realMadrid.brain.recruitment.feeDiscipline, 'Ludogorets should be materially more fee-disciplined than Real Madrid');

const coverage = europeanBrainCoverage(career.world.seed);
assert.ok(coverage.clubs >= 1200, 'every club in the European catalog must receive a deterministic intelligence profile');
assert.ok(coverage.countries >= 40, 'European intelligence registry must span the continental catalog');
assert.ok(Object.keys(coverage.styles).length >= 5, 'club identities must span multiple tactical archetypes');

const requirements = Object.values(career.world.clubs).flatMap(club => club.recruitment.requirements || []);
assert.ok(requirements.some(requirement => requirement.position && requirement.role), 'recruitment needs must be position + role specific');
assert.ok(requirements.some(requirement => Array.isArray(requirement.attributePriorities) && requirement.attributePriorities.length >= 3), 'requirements must inherit tactical attribute priorities');

console.log(JSON.stringify({
  ok: true,
  worldSchema: career.world.schemaVersion,
  europeanClubsWithBrains: coverage.clubs,
  countries: coverage.countries,
  tacticalStyles: coverage.styles
}, null, 2));

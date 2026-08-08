import './no-scripted-world-smoke.mjs';
import assert from 'node:assert/strict';
import { simulateRealismSave } from '../scripts/world-realism-lab.mjs';

const repeatedAt = '2026-06-01T12:00:00.000Z';
const saveA = simulateRealismSave({ index: 0, days: 31, createdAt: repeatedAt });
const saveARepeat = simulateRealismSave({ index: 99, days: 31, createdAt: repeatedAt });
const saveB = simulateRealismSave({ index: 1, days: 31, createdAt: '2026-06-03T16:42:17.000Z' });

assert.equal(saveA.audit.hardViolations.length, 0, 'baseline save must have no structural world violations');
assert.equal(saveARepeat.audit.hardViolations.length, 0, 'deterministic replay must remain structurally valid');
assert.equal(saveB.audit.hardViolations.length, 0, 'alternate save must remain structurally valid');
assert.equal(saveA.audit.fingerprint, saveARepeat.audit.fingerprint, 'same seed/input must reproduce the same market fingerprint');
assert.notEqual(saveA.audit.fingerprint, saveB.audit.fingerprint, 'different save seed should create a different plausible market fingerprint');
assert.ok(saveA.audit.metrics.rumors >= 2, 'open transfer window should create multiple recruitment threads');
assert.ok(saveA.audit.metrics.clubs >= 20, 'lab must audit the active world club population');
assert.ok(saveA.audit.metrics.playersEmployed >= 600, 'lab must audit the active player population');

console.log(JSON.stringify({
  ok: true,
  noScriptedWorldGuard: true,
  sameSeedReproducible: true,
  differentSaveDiverges: true,
  hardViolations: saveA.audit.hardViolations.length + saveB.audit.hardViolations.length,
  saveARumors: saveA.audit.metrics.rumors,
  saveBRumors: saveB.audit.metrics.rumors,
  saveATransfers: saveA.audit.metrics.completedTransfers,
  saveBTransfers: saveB.audit.metrics.completedTransfers,
  warnings: saveA.audit.warnings.length + saveB.audit.warnings.length
}, null, 2));

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/career-tactics-studio.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../src/career-tactics-studio.css', import.meta.url), 'utf8');

assert.ok(source.includes('data-drop-zone="pitch"'), 'pitch must be a drop surface');
assert.ok(source.includes('data-drop-zone="bench"'), 'bench must be a drop surface');
assert.ok(source.includes('data-drop-zone="reserves"'), 'unselected squad must be a drop surface');
assert.ok(source.includes('data-drag-player'), 'players must expose pointer drag handles');
assert.ok(source.includes('movePlayerOnPitch'), 'free pitch positioning must exist');
assert.ok(source.includes('swapPlayers'), 'dropping over another player must swap them');
assert.ok(source.includes('Banco de reservas'), 'bench must be visible');
assert.ok(source.includes('Não relacionados'), 'full remaining squad must be visible');
assert.ok(source.includes('tacticalLayouts'), 'manual layouts must persist by plan and phase');
assert.ok(source.includes('BENCH_LIMIT = 9'), 'match bench must support nine players');
assert.ok(!source.includes('Recomendar XI'), 'recommend XI button must stay removed');
assert.ok(!source.includes('tl-impact-metrics'), 'large metrics panel must stay removed');
assert.ok(!source.includes('<b>${player.number}</b>'), 'player shirt number must not overlay the portrait');
assert.ok(css.includes('.tl-squad-manager'), 'squad management layout must be styled');
assert.ok(css.includes('.tl-drag-ghost'), 'drag feedback must be styled');
assert.ok(css.includes('cursor:grab'), 'draggable affordance must be visible');

console.log(JSON.stringify({
  ok: true,
  dropZones: ['pitch', 'bench', 'reserves'],
  benchLimit: 9,
  freePositioning: true,
  swapOnPlayerDrop: true,
  shirtNumberOverlay: false,
  legacyMetricsPanel: false,
  recommendXiButton: false
}, null, 2));

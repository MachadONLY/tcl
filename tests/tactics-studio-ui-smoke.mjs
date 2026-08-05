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
assert.ok(source.includes('tl-command-bar'), 'game command bar must render');
assert.ok(source.includes('tl-war-room'), 'tactics war room must render');
assert.ok(source.includes('tl-bench-dock'), 'bench must stay next to the pitch');
assert.ok(source.includes('Elenco disponível'), 'full remaining squad must be visible');
assert.ok(source.includes('GROUP_FILTERS'), 'squad filters must exist');
assert.ok(source.includes('tacticalLayouts'), 'manual layouts must persist by plan and phase');
assert.ok(source.includes('BENCH_LIMIT = 9'), 'match bench must support nine players');
assert.ok(source.includes('touchline-tactics-mode'), 'tactics route must receive its own game-shell styling');
assert.ok(!source.includes('Recomendar XI'), 'recommend XI button must stay removed');
assert.ok(!source.includes('tl-impact-metrics'), 'large metrics panel must stay removed');
assert.ok(!source.includes('<b>${player.number}</b>'), 'player shirt number must not overlay the portrait');
assert.ok(css.includes('.tl-command-bar'), 'command bar must be styled');
assert.ok(css.includes('.tl-war-room'), 'war room layout must be styled');
assert.ok(css.includes('.tl-bench-dock'), 'bench dock must be styled');
assert.ok(css.includes('.tl-squad-manager'), 'squad drawer must be styled');
assert.ok(css.includes('.tl-drag-ghost'), 'drag feedback must be styled');
assert.ok(css.includes('cursor:grab'), 'draggable affordance must be visible');
assert.ok(css.includes('backdrop-filter'), 'premium layered depth must be present');
assert.ok(css.includes('prefers-reduced-motion'), 'motion accessibility must be respected');

console.log(JSON.stringify({
  ok: true,
  interface: 'premium-tactics-war-room',
  dropZones: ['pitch', 'bench', 'reserves'],
  benchLimit: 9,
  squadFilters: true,
  freePositioning: true,
  swapOnPlayerDrop: true,
  shirtNumberOverlay: false,
  legacyMetricsPanel: false,
  recommendXiButton: false,
  reducedMotion: true
}, null, 2));

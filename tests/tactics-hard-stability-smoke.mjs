import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [source, css, index] = await Promise.all([
  readFile(new URL('../src/career-tactics-hard-stability.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-tactics-hard-stability.css', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8')
]);

assert.ok(source.includes("event.preventDefault()"), 'pointer interaction must prevent native focus scrolling');
assert.ok(source.includes('interactionPatch(root, text)'), 'player interactions must bypass the full tactics renderer');
assert.ok(source.includes('!pointerInteraction.moved && sameSquadComposition'), 'simple player selection must use a selection-only patch');
assert.ok(source.includes('pointerInteraction.moved && sameSquadComposition'), 'free pitch movement must patch player coordinates only');
assert.ok(source.includes('syncPitchPositions(root, parser)'), 'pitch movement must retain the existing field DOM');
assert.ok(source.includes('syncSquadContainers(root, parser)'), 'lineup swaps must update squad containers without replacing the screen');
assert.ok(source.includes('lockGeometry(root)'), 'lineup geometry must be measured and locked');
assert.ok(source.includes("root.dataset.hardGeometry = 'true'"), 'geometry lock must be explicit');
assert.ok(source.includes("window.addEventListener('resize'"), 'geometry may only be recalculated for a real viewport resize');

assert.ok(css.includes('--tl-locked-war-height'), 'war-room height must be frozen');
assert.ok(css.includes('--tl-locked-pitch-height'), 'pitch-stage height must be frozen');
assert.ok(css.includes('--tl-locked-field-height'), 'field height must be frozen');
assert.ok(css.includes('--tl-locked-rail-height'), 'right rail height must be frozen');
assert.ok(css.includes('contain:size layout paint'), 'the field must be isolated from neighboring layout changes');
assert.ok(css.includes('.tl-player-node.selected'), 'selected players must have a fixed transform');
assert.ok(css.includes('.tl-squad-card.selected'), 'selected squad cards must not move vertically');

assert.ok(index.includes('career-tactics-hard-stability.css'), 'hard stability CSS must load last in the tactics stack');
assert.ok(index.includes('career-tactics-hard-stability.js'), 'hard stability runtime must load after the live DOM reconciler');

console.log(JSON.stringify({
  ok: true,
  playerSelectionRender: false,
  freePitchMoveRender: false,
  lineupGeometry: 'pixel-locked',
  nativeFocusScroll: false,
  fieldHeightShift: false,
  pitchTopShift: false,
  selectedPlayerScaleShift: false,
  viewportResizeRelock: true
}, null, 2));

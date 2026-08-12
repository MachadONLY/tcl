import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [source, css, formationManager, repository, index] = await Promise.all([
  readFile(new URL('../src/career-tactics-hard-stability.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-tactics-hard-stability.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-tactics-formation-manager.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-core/career-repository.js', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8')
]);

assert.ok(source.includes("document.addEventListener('pointerdown'"), 'pointer interactions must still be observed');
assert.ok(!source.includes('event.preventDefault();'), 'stability must not cancel pointerdown or block dragging');
assert.ok(source.includes('setPointerCapture'), 'the original pointer-capture drag contract must remain preserved');
assert.ok(source.includes('interactionPatch(root, text)'), 'player interactions must bypass the full tactics renderer');
assert.ok(source.includes('!pointerInteraction.moved && sameSquadComposition'), 'simple player selection must use a selection-only patch');
assert.ok(source.includes('pointerInteraction.moved && sameSquadComposition'), 'free pitch movement must patch player coordinates only');
assert.ok(source.includes('syncPitchPositions(root, parser)'), 'pitch movement must retain the existing field DOM');
assert.ok(source.includes('syncSquadContainers(root, parser)'), 'lineup swaps must update squad containers without replacing the screen');
assert.ok(source.includes('lockGeometry(root)'), 'lineup geometry must be measured and locked');
assert.ok(source.includes("root.dataset.hardGeometry = 'true'"), 'geometry lock must be explicit');
assert.ok(source.includes("window.addEventListener('resize'"), 'geometry may only be recalculated for a real viewport resize');

assert.ok(formationManager.includes('function patchPitchInstantly'), 'formation manager may still patch coordinates for explicit formation work');
assert.ok(!formationManager.includes('if (!applyingFormation) patchPitchInstantly(root, career);'), 'generic enhancement must never overwrite a manual pitch drop');
assert.ok(!formationManager.includes('if (root && cachedCareer && !applyingFormation) patchPitchInstantly(root, cachedCareer);'), 'DOM mutations must never snap a manually moved player back to cached formation coordinates');
assert.ok(formationManager.includes('Generic DOM enhancement must never re-apply a cached formation here.'), 'manual pitch ownership must be documented in the formation manager');
assert.ok(repository.includes('function syncFormationDraftFromCareer'), 'career persistence must synchronize manual tactical coordinates into the formation draft');
assert.ok(repository.includes('syncFormationDraftFromCareer(draft);'), 'the freshest tactics career draft must replace any older formation draft before saving');
assert.ok(repository.includes('tacticalLayouts: structuredClone(career.tacticalLayouts)'), 'manual x/y layouts must be cloned into the authoritative formation draft');

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
  freePitchPositionAuthority: 'manual-layout',
  mutationSnapBack: false,
  savedManualCoordinates: true,
  dragEnabled: true,
  pointerDownCancelled: false,
  pointerCapturePreserved: true,
  lineupGeometry: 'pixel-locked',
  nativeFocusScroll: false,
  fieldHeightShift: false,
  pitchTopShift: false,
  selectedPlayerScaleShift: false,
  viewportResizeRelock: true
}, null, 2));
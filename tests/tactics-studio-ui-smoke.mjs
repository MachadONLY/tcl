import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  TACTICS_FORMATION_GROUPS,
  TACTICS_FORMATION_SLOTS,
  TACTICS_FORMATIONS,
  formationOptionsMarkup,
  isTacticsFormation
} from '../src/career-tactics-formations.js';
import {
  TACTICS_PHASES,
  TACTICS_PLANS,
  applyFormationState,
  ensureTacticalLayouts,
  formationDraftFromCareer,
  manualPosition,
  setManualPosition
} from '../src/career-tactics-state.js';

const [source, css, dragCss, dragSource, threeViews, threeViewsCss, refinementCss, formationCss, repository, index] = await Promise.all([
  readFile(new URL('../src/career-tactics-studio.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-tactics-studio.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-tactics-drag-polish.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-tactics-drag-polish.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-tactics-three-views.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-tactics-three-views.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-tactics-layout-refinement.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-tactics-formation-manager.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-core/career-repository.js', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8')
]);

// Shared formation catalog: one definition for rendering, validation and state.
assert.equal(TACTICS_FORMATIONS.length, 15, 'the tactics studio must expose the complete 15-shape catalog');
assert.equal(new Set(TACTICS_FORMATIONS).size, TACTICS_FORMATIONS.length, 'formation catalog must not contain duplicates');
assert.equal(TACTICS_FORMATION_GROUPS.length, 3, 'formations must remain grouped by back-line family');
for (const formation of TACTICS_FORMATIONS) {
  assert.equal(isTacticsFormation(formation), true, `${formation} must be recognized`);
  assert.equal(TACTICS_FORMATION_SLOTS[formation].length, 11, `${formation} must define exactly eleven pitch slots`);
  for (const [x, y] of TACTICS_FORMATION_SLOTS[formation]) {
    assert.ok(x >= 6 && x <= 94 && y >= 6 && y <= 94, `${formation} slots must stay inside the playable pitch`);
  }
}
assert.ok(formationOptionsMarkup('3-5-2').includes('value="3-5-2" selected'), 'formation markup must preserve selected shape');

// Stateful regression sweep. This reproduces the exact user flow that was broken.
const career = {
  saveId: 'primary',
  clubCode: 'MUN',
  formation: '4-2-3-1',
  tactics: { activePlan: 'A' },
  tacticalLayouts: {},
  lineup: Array.from({ length: 11 }, (_, index) => `p${index + 1}`)
};
ensureTacticalLayouts(career);
for (const plan of TACTICS_PLANS) {
  for (const phase of TACTICS_PHASES) assert.deepEqual(career.tacticalLayouts[plan][phase], {});
}

assert.equal(applyFormationState(career, '4-3-3'), true);
assert.equal(career.formation, '4-3-3');
assert.equal(setManualPosition(career, { playerId: 'p6', plan: 'A', phase: 'base', x: 63.275, y: 47.814 }), true);
assert.equal(career.formation, '4-3-3', 'manual movement must never reset the chosen formation');
assert.deepEqual(manualPosition(career, 'p6', 'A', 'base'), { x: 63.27, y: 47.81 });
let draft = formationDraftFromCareer(career);
assert.equal(draft.formation, '4-3-3', 'save draft must preserve formation after drag');
assert.deepEqual(draft.tacticalLayouts.A.base.p6, { x: 63.27, y: 47.81 });

// Changing formation must invalidate old coordinates in ALL plans/phases.
career.tacticalLayouts.B.base.p2 = { x: 12, y: 12 };
career.tacticalLayouts.C.out.p4 = { x: 88, y: 88 };
assert.equal(applyFormationState(career, '3-5-2'), true);
assert.equal(career.formation, '3-5-2');
for (const plan of TACTICS_PLANS) {
  for (const phase of TACTICS_PHASES) {
    assert.deepEqual(career.tacticalLayouts[plan][phase], {}, `changing formation must clear stale ${plan}/${phase} layout`);
  }
}

// Plan and phase isolation after a formation change.
career.tactics.activePlan = 'B';
assert.equal(setManualPosition(career, { playerId: 'p8', plan: 'B', phase: 'possession', x: 31.2, y: 26.4 }), true);
assert.equal(career.formation, '3-5-2');
assert.equal(manualPosition(career, 'p8', 'A', 'possession'), null, 'manual positions must stay isolated by plan');
assert.deepEqual(manualPosition(career, 'p8', 'B', 'possession'), { x: 31.2, y: 26.4 });

// Every supported formation must survive formation -> drag -> draft without fallback.
for (const [indexValue, formation] of TACTICS_FORMATIONS.entries()) {
  assert.equal(applyFormationState(career, formation), true, `${formation} must apply`);
  const playerId = `p${(indexValue % 11) + 1}`;
  const plan = TACTICS_PLANS[indexValue % TACTICS_PLANS.length];
  const phase = TACTICS_PHASES[indexValue % TACTICS_PHASES.length];
  assert.equal(setManualPosition(career, {
    playerId,
    plan,
    phase,
    x: 10 + indexValue * 4.7,
    y: 90 - indexValue * 3.9
  }), true);
  draft = formationDraftFromCareer(career);
  assert.equal(draft.formation, formation, `${formation} must remain authoritative after manual drag`);
  assert.ok(draft.tacticalLayouts[plan][phase][playerId], `${formation} manual coordinates must reach the save draft`);
}

const beforeInvalid = structuredClone(career);
assert.equal(applyFormationState(career, '9-9-9'), false, 'invalid formations must be rejected');
assert.deepEqual(career, beforeInvalid, 'invalid formation attempts must not mutate career state');
assert.equal(setManualPosition(career, { playerId: 'p1', plan: 'A', phase: 'base', x: -100, y: 500 }), true);
assert.deepEqual(manualPosition(career, 'p1', 'A', 'base'), { x: 6, y: 94 }, 'manual positioning must clamp only at pitch edges');

// Runtime ownership: Tactics Studio is the ONLY active formation controller.
assert.ok(source.includes('applyFormationState(currentCareer, formation)'), 'studio must own formation state changes');
assert.ok(source.includes('formationDraftFromCareer(currentCareer)'), 'studio must immediately publish its authoritative formation draft');
assert.ok(source.includes('syncDraftsFromCurrentCareer()'), 'all mutations must synchronize the save draft');
assert.ok(source.includes('setManualPosition(currentCareer'), 'free pitch movement must use the tested state layer');
assert.ok(source.includes("studioRoot.querySelectorAll('[data-tl-formation]')"), 'all visible formation selectors must bind to one handler');
assert.ok(source.includes('formationOptionsMarkup(currentCareer.formation)'), 'formation controls must use the shared catalog');
assert.ok(source.includes('data-drop-zone="pitch"'), 'pitch must remain a drop surface');
assert.ok(source.includes('data-drop-zone="bench"'), 'bench must remain a drop surface');
assert.ok(source.includes('data-drop-zone="reserves"'), 'unselected squad must remain a drop surface');
assert.ok(source.includes('movePlayerOnPitch'), 'free pitch positioning must exist');
assert.ok(source.includes('swapPlayers'), 'dropping over another player must still swap players');
assert.ok(source.includes('BENCH_LIMIT = 9'), 'match bench must support nine players');
assert.ok(!source.includes("currentCareer.formation = '4-2-3-1'"), 'runtime mutations must never hard-reset formation to 4-2-3-1');
assert.ok(!index.includes('src/career-tactics-formation-manager.js'), 'the stale duplicate formation runtime must not be loaded');
assert.equal((index.match(/src\/career-tactics-studio\.js/g) || []).length, 1, 'tactics studio runtime must load exactly once');
assert.ok(repository.includes('syncFormationDraftFromCareer(draft)'), 'repository must promote the freshest career draft before formation merge');
assert.ok(repository.includes('mergeFormationDraft(consumeCareerDraft(save))'), 'fresh career draft must win before formation merge');

// Drag remains smooth and precise after state fixes.
assert.ok(dragCss.includes('--tl-drag-size:58px'), 'drag preview must stay compact');
assert.ok(dragCss.includes('border-radius:50%'), 'drag preview must remain circular');
assert.ok(dragCss.includes('translate3d(var(--tl-drag-x'), 'drag preview must stay on GPU translation');
assert.ok(dragSource.includes('requestAnimationFrame'), 'drag paint must remain frame-synchronized');
assert.ok(dragSource.includes('getCoalescedEvents'), 'high-frequency pointer samples must be supported');
assert.ok(!dragSource.includes('const easing ='), 'old rubber-band pointer lag must never return');

// Existing three-view and geometry contracts must remain intact.
assert.ok(threeViews.includes("let activeView = 'lineup'"), 'lineup must remain the default tactics view');
assert.ok(threeViews.includes("id: 'lineup'"));
assert.ok(threeViews.includes("id: 'tactics'"));
assert.ok(threeViews.includes("id: 'roles'"));
assert.ok(threeViews.includes('localStorage.setItem'), 'responsibilities must remain persistent');
assert.ok(threeViewsCss.includes('.tl-primary-view-switch'), 'fixed view switch must remain styled');
assert.ok(refinementCss.includes('grid-template-columns:minmax(700px,1fr) minmax(292px,324px)!important'), 'desktop tactics geometry must stay stable');
assert.ok(refinementCss.includes('height:clamp(132px,16vh,158px)'), 'lower squad strip must remain compact');
assert.ok(formationCss.includes('.tl-field-formation-control'), 'integrated field formation control must retain styling');
assert.ok(css.includes('.tl-war-room'));
assert.ok(css.includes('.tl-bench-dock'));
assert.ok(css.includes('.tl-squad-manager'));
assert.ok(css.includes('prefers-reduced-motion'));

console.log(JSON.stringify({
  ok: true,
  formationCatalog: TACTICS_FORMATIONS.length,
  formationControllerCount: 1,
  duplicateFormationRuntime: false,
  testedFlows: [
    'formation->drag->draft',
    'formation->plan-switch',
    'formation->phase-position',
    'all-15-formations->drag->draft',
    'invalid-formation-no-mutation',
    'manual-position-edge-clamp'
  ],
  formationResetAfterDrag: false,
  stalePlanLayoutAfterFormationChange: false,
  manualPositionAuthority: true,
  saveDraftAuthority: 'current-tactics-career',
  freePositioning: true,
  dragRendering: 'raf-latest-pointer-sample',
  rubberBandLag: false,
  views: ['lineup', 'tactics', 'roles'],
  benchLimit: 9,
  reducedMotion: true
}, null, 2));

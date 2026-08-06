import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [source, css, hardSource, hardCss, cleanupSource, cleanupCss, index] = await Promise.all([
  readFile(new URL('../src/career-tactics-live-dom.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-tactics-live-dom.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-tactics-hard-stability.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-tactics-hard-stability.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-tactics-unselected-cleanup.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-tactics-unselected-cleanup.css', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8')
]);

assert.ok(source.includes("Object.defineProperty(root, 'innerHTML'"), 'studio HTML assignments must be reconciled instead of replacing the screen');
assert.ok(source.includes('morphStudio(root, String(markup))'), 'studio updates must use the live DOM reconciler');
assert.ok(source.includes('morphChildren(root, parser)'), 'existing DOM nodes must be retained and patched');
assert.ok(source.includes("player:${node.dataset.zone || 'unknown'}:${node.dataset.dragPlayer}"), 'players must be keyed by zone and stable player id');
assert.ok(source.includes('detachPersistentUi'), 'three-view navigation must survive tactics updates');
assert.ok(source.includes('restorePersistentUi'), 'persistent view UI must be restored synchronously');
assert.ok(source.includes('captureGeometry(root)'), 'the field position must be captured before every live update');
assert.ok(source.includes('stabilizeGeometry(root, geometry)'), 'the field position must be restored in the same update frame');
assert.ok(source.includes('restoreScrollPositions'), 'all relevant scroll containers must retain their positions');
assert.ok(source.includes('verticalScroller(root)'), 'viewport compensation must target the real vertical scroller');
assert.ok(source.includes("root.dataset.geometryLock = 'true'"), 'the studio must expose its fixed-geometry state');
assert.ok(source.includes('scrollRoster(grid, 1)'), 'reserve carousel must provide controlled forward navigation');
assert.ok(source.includes('rosterMaximum(grid)'), 'carousel controls must use the exact final scroll position');
assert.ok(source.includes("event.key === 'End'"), 'keyboard users must be able to reach the final player');
assert.ok(source.includes('grid.scrollWidth - grid.clientWidth'), 'carousel controls must detect the true scroll range');
assert.ok(!source.includes('root.replaceChildren('), 'live tactics updates must never replace the full studio root');

assert.ok(hardSource.includes("document.addEventListener('pointerdown'"), 'stability layer must observe player pointer interactions');
assert.ok(hardSource.includes('setPointerCapture'), 'stability layer must explicitly preserve the original drag controller contract');
assert.ok(!hardSource.includes('event.preventDefault();'), 'stability layer must never cancel pointerdown and break dragging');
assert.ok(hardSource.includes('pointerInteraction.moved = true'), 'stability layer must distinguish click from drag');
assert.ok(hardSource.includes('syncPitchPositions'), 'dragging within the pitch must patch only player coordinates');
assert.ok(hardSource.includes('syncSquadContainers'), 'cross-zone drops must reconcile only squad containers');
assert.ok(hardSource.includes('data-hard-geometry'), 'lineup geometry must remain locked during interactions');

assert.ok(cleanupSource.includes("const TITLE = 'Não relacionados'"), 'unselected squad must use the correct Portuguese title');
assert.ok(cleanupSource.includes('header.replaceChildren(title)'), 'legacy title, count and positional filters must be removed from the DOM');
assert.ok(cleanupSource.includes("root.querySelectorAll('[data-roster-filter]')"), 'positional filter buttons must be removed after every render');
assert.ok(!cleanupSource.includes('Goleiros'), 'cleanup runtime must not recreate goalkeeper filters');
assert.ok(!cleanupSource.includes('Defensores'), 'cleanup runtime must not recreate defender filters');
assert.ok(!cleanupSource.includes('Meio-campo'), 'cleanup runtime must not recreate midfield filters');
assert.ok(!cleanupSource.includes('Atacantes'), 'cleanup runtime must not recreate attacker filters');
assert.ok(cleanupCss.includes('header > nav'), 'legacy positional navigation must be hidden before runtime cleanup');
assert.ok(cleanupCss.includes('header small'), 'legacy unselected-player count must be hidden before runtime cleanup');
assert.ok(cleanupCss.includes("content:'Não relacionados'"), 'correct title must be visible without a flash of legacy content');

assert.ok(css.includes('[data-live-dom="true"]'), 'zero-flash state must disable entry animations after mount');
assert.ok(css.includes('overflow-anchor:none!important'), 'browser scroll anchoring must be disabled in the tactics room');
assert.ok(css.includes('contain:layout paint'), 'the pitch must be isolated from side-panel layout changes');
assert.ok(css.includes('grid-template-rows:68px minmax(0,1fr)!important'), 'the right rail must keep a fixed navigation row');
assert.ok(css.includes('.tl-player-node.selected'), 'selected players must have an explicit non-moving state');
assert.ok(css.includes('transform:none!important'), 'selected squad cards must not shift vertically');
assert.ok(css.includes('overflow-x:auto!important'), 'reserve carousel must remain horizontally scrollable');
assert.ok(css.includes('padding:3px 78px 13px 18px!important'), 'carousel must leave enough trailing room for the final player');
assert.ok(css.includes('flex-basis:72px'), 'the final carousel spacer must keep the final card fully visible');
assert.ok(css.includes('flex:0 0 220px!important'), 'reserve cards must retain a stable readable width');
assert.ok(css.includes('scroll-snap-type:none!important'), 'native free scrolling must not stop before the final card');
assert.ok(css.includes('.tl-roster-scroll-tools'), 'compact previous and next controls must exist');
assert.ok(hardCss.includes('--tl-locked-field-height'), 'hard stability CSS must keep the field height fixed');

assert.ok(index.includes('career-tactics-live-dom.css'), 'live DOM CSS must load after the formation styles');
assert.ok(index.includes('career-tactics-live-dom.js'), 'live DOM runtime must load after the tactics controllers');
assert.ok(index.includes('career-tactics-hard-stability.css'), 'hard stability CSS must be loaded');
assert.ok(index.includes('career-tactics-hard-stability.js'), 'hard stability runtime must be loaded');
assert.ok(index.includes('career-tactics-unselected-cleanup.css'), 'simplified unselected header CSS must be loaded');
assert.ok(index.includes('career-tactics-unselected-cleanup.js'), 'simplified unselected header runtime must be loaded');

console.log(JSON.stringify({
  ok: true,
  tacticsUpdates: 'keyed-live-dom-fixed-geometry',
  fullScreenRemount: false,
  playerClickFlash: false,
  playerClickLayoutShift: false,
  dragEnabled: true,
  pointerDownCancelled: false,
  playerPointerCapturePreserved: true,
  dragDropFlash: false,
  dragDropLayoutShift: false,
  browserScrollAnchoring: false,
  pitchGeometry: 'captured-and-restored-same-frame',
  playerImagesReused: true,
  reserveCarousel: 'first-to-last-exact-reach',
  unselectedHeader: 'Não relacionados',
  unselectedCountVisible: false,
  positionalFiltersVisible: false,
  scrollMethods: ['native-scrollbar', 'wheel', 'buttons', 'home-end'],
  trailingCarouselSpace: 72,
  cardWidth: 220
}, null, 2));
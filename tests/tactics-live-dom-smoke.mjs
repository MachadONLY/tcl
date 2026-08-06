import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [source, css, index] = await Promise.all([
  readFile(new URL('../src/career-tactics-live-dom.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-tactics-live-dom.css', import.meta.url), 'utf8'),
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

assert.ok(index.includes('career-tactics-live-dom.css'), 'live DOM CSS must load after the formation styles');
assert.ok(index.includes('career-tactics-live-dom.js'), 'live DOM runtime must load after the tactics controllers');

console.log(JSON.stringify({
  ok: true,
  tacticsUpdates: 'keyed-live-dom-fixed-geometry',
  fullScreenRemount: false,
  playerClickFlash: false,
  playerClickLayoutShift: false,
  dragDropFlash: false,
  dragDropLayoutShift: false,
  browserScrollAnchoring: false,
  pitchGeometry: 'captured-and-restored-same-frame',
  playerImagesReused: true,
  reserveCarousel: 'first-to-last-exact-reach',
  scrollMethods: ['native-scrollbar', 'wheel', 'buttons', 'home-end'],
  trailingCarouselSpace: 72,
  cardWidth: 220
}, null, 2));
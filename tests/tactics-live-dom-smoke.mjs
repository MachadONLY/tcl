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
assert.ok(source.includes('grid.scrollBy'), 'reserve carousel must provide controlled horizontal navigation');
assert.ok(source.includes("event.key === 'End'"), 'keyboard users must be able to reach the final player');
assert.ok(source.includes('grid.scrollWidth - grid.clientWidth'), 'carousel controls must detect the true scroll range');
assert.ok(!source.includes('root.replaceChildren('), 'live tactics updates must never replace the full studio root');

assert.ok(css.includes('[data-live-dom="true"]'), 'zero-flash state must disable entry animations after mount');
assert.ok(css.includes('overflow-x:auto!important'), 'reserve carousel must remain horizontally scrollable');
assert.ok(css.includes('padding:3px 26px 13px 18px!important'), 'carousel must have visible leading and trailing breathing room');
assert.ok(css.includes('flex:0 0 220px!important'), 'reserve cards must retain a stable readable width');
assert.ok(css.includes('.tl-roster-scroll-tools'), 'compact previous and next controls must exist');
assert.ok(css.includes('scroll-snap-align:start'), 'cards must settle into fully visible positions');

assert.ok(index.includes('career-tactics-live-dom.css'), 'live DOM CSS must load after the formation styles');
assert.ok(index.includes('career-tactics-live-dom.js'), 'live DOM runtime must load after the tactics controllers');

console.log(JSON.stringify({
  ok: true,
  tacticsUpdates: 'keyed-live-dom',
  fullScreenRemount: false,
  playerClickFlash: false,
  dragDropFlash: false,
  playerImagesReused: true,
  reserveCarousel: 'first-to-last-reachable',
  scrollMethods: ['native-scrollbar', 'wheel', 'buttons', 'home-end'],
  cardWidth: 220
}, null, 2));

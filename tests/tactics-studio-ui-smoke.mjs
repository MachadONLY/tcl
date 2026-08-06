import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [source, css, dragCss, dragSource, threeViews, threeViewsCss, refinementCss, formationManager, formationCss, index] = await Promise.all([
  readFile(new URL('../src/career-tactics-studio.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-tactics-studio.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-tactics-drag-polish.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-tactics-drag-polish.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-tactics-three-views.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-tactics-three-views.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-tactics-layout-refinement.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-tactics-formation-manager.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-tactics-formation-manager.css', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8')
]);

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
assert.ok(css.includes('.tl-drag-ghost'), 'base drag feedback must be styled');
assert.ok(css.includes('cursor:grab'), 'draggable affordance must be visible');
assert.ok(css.includes('backdrop-filter'), 'premium layered depth must be present');
assert.ok(css.includes('prefers-reduced-motion'), 'motion accessibility must be respected');
assert.ok(dragCss.includes('--tl-drag-size:62px'), 'drag preview must be a compact avatar');
assert.ok(dragCss.includes('border-radius:50%'), 'drag preview must remain circular');
assert.ok(dragCss.includes('.tl-drag-ghost>*{display:none!important}'), 'rectangular card content must be hidden while dragging');
assert.ok(dragCss.includes('translate3d(var(--tl-drag-x'), 'drag preview must use GPU translation');
assert.ok(dragCss.includes('tlDragAvatarPickup'), 'drag pickup must have a subtle avatar animation');
assert.ok(dragSource.includes('requestAnimationFrame'), 'drag movement must be synchronized to animation frames');
assert.ok(dragSource.includes('const easing = 0.58'), 'drag movement must use controlled smoothing');
assert.ok(threeViews.includes("let activeView = 'lineup'"), 'lineup must be the default tactics view');
assert.ok(threeViews.includes("id: 'lineup'"), 'lineup view must exist');
assert.ok(threeViews.includes("id: 'tactics'"), 'game model view must exist');
assert.ok(threeViews.includes("id: 'roles'"), 'roles view must exist');
assert.ok(threeViews.includes('navigationHost'), 'view navigation must have a dedicated layout host');
assert.ok(threeViews.includes("root.querySelector('.tl-side-rail')"), 'view navigation must dock in the right rail');
assert.ok(threeViews.includes('Capitão'), 'captain responsibility must exist');
assert.ok(threeViews.includes('Pênaltis'), 'penalty responsibility must exist');
assert.ok(threeViews.includes('Faltas diretas'), 'direct free-kick responsibility must exist');
assert.ok(threeViews.includes('Faltas indiretas'), 'indirect free-kick responsibility must exist');
assert.ok(threeViews.includes('Escanteio esquerdo'), 'left-corner responsibility must exist');
assert.ok(threeViews.includes('Escanteio direito'), 'right-corner responsibility must exist');
assert.ok(threeViews.includes('localStorage.setItem'), 'responsibilities must persist for the club');
assert.ok(threeViewsCss.includes('[data-tactics-view="lineup"]'), 'lineup-specific layout must be styled');
assert.ok(threeViewsCss.includes('[data-tactics-view="tactics"]'), 'tactics-specific layout must be styled');
assert.ok(threeViewsCss.includes('[data-tactics-view="roles"]'), 'roles-specific layout must be styled');
assert.ok(threeViewsCss.includes('.tl-responsibilities-view'), 'responsibilities screen must be styled');
assert.ok(threeViewsCss.includes('prefers-reduced-motion'), 'three-view transitions must respect reduced motion');
assert.ok(refinementCss.includes('::-webkit-scrollbar-button'), 'native scrollbar arrow buttons must be suppressed');
assert.ok(refinementCss.includes('scrollbar-width:thin'), 'horizontal roster scrolling must remain available');
assert.ok(refinementCss.includes('.tl-side-rail>.tl-primary-view-switch'), 'view switch must sit above the bench rail');
assert.ok(refinementCss.includes('[data-tactics-view="lineup"] .tl-command-bar'), 'lineup must remove the old full-width command strip');
assert.ok(refinementCss.includes('grid-template-columns:minmax(700px,1fr)'), 'lineup field must receive the dominant left column');
assert.ok(refinementCss.includes('height:clamp(132px,16vh,158px)'), 'unselected squad strip must stay compact to increase pitch height');

assert.ok(formationManager.includes("document.addEventListener('change', interceptFormationChange, true)"), 'formation select must be intercepted before legacy rerender handlers');
assert.ok(formationManager.includes('event.stopImmediatePropagation()'), 'legacy formation rerender must be blocked');
assert.ok(formationManager.includes('getBoundingClientRect()'), 'formation motion must measure first and last player positions');
assert.ok(formationManager.includes('node.animate(['), 'formation motion must use the Web Animations API');
assert.ok(formationManager.includes('translate3d('), 'formation motion must stay on the GPU transform path');
assert.ok(formationManager.includes("easing: 'cubic-bezier(.16, 1, .3, 1)'"), 'formation motion must use controlled premium easing');
assert.ok(formationManager.includes('createVisualSnapshot'), 'internal state remount must be visually masked');
assert.ok(formationManager.includes('waitForFreshStudio'), 'visual mask must remain until the fresh studio is ready');
assert.ok(!formationManager.includes('location.reload()'), 'formation changes must never reload the page');
assert.ok(formationCss.includes('.tl-formation-snapshot'), 'seamless remount snapshot must be styled');
assert.ok(formationCss.includes('.tl-formation-measuring .tl-player-node'), 'measurement phase must disable competing transitions');
assert.ok(formationCss.includes('[data-formation-moving]'), 'moving players must receive explicit motion styling');
assert.ok(formationCss.includes('prefers-reduced-motion'), 'formation motion must respect reduced-motion preferences');

assert.ok(index.includes('career-tactics-drag-polish.css'), 'polished drag CSS must be loaded');
assert.ok(index.includes('career-tactics-drag-polish.js'), 'polished drag runtime must be loaded');
assert.ok(index.includes('career-tactics-three-views.css'), 'three-view CSS must be loaded');
assert.ok(index.includes('career-tactics-layout-refinement.css'), 'final tactics layout refinement must be loaded');
assert.ok(index.includes('career-tactics-formation-manager.css'), 'formation manager CSS must be loaded');
assert.ok(index.includes('career-tactics-formation-manager.js'), 'formation manager runtime must be loaded');
assert.ok(index.includes('career-tactics-three-views.js'), 'three-view runtime must be loaded');

console.log(JSON.stringify({
  ok: true,
  interface: 'three-view-premium-tactics-room',
  views: ['lineup', 'tactics', 'roles'],
  defaultView: 'lineup',
  viewDock: 'above-bench-right-rail',
  fieldPriority: true,
  nativeScrollbarArrows: false,
  horizontalRosterScroll: true,
  responsibilities: 7,
  dragPreview: 'circular-player-avatar',
  dragRendering: 'request-animation-frame-gpu',
  formationMotion: 'flip-web-animations-gpu',
  formationRemountFlash: false,
  formationPageReload: false,
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

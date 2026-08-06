import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [source, css, dragCss, dragSource, threeViews, threeViewsCss, refinementCss, formationManager, formationCss, repository, index] = await Promise.all([
  readFile(new URL('../src/career-tactics-studio.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-tactics-studio.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-tactics-drag-polish.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-tactics-drag-polish.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-tactics-three-views.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-tactics-three-views.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-tactics-layout-refinement.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-tactics-formation-manager.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-tactics-formation-manager.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-core/career-repository.js', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8')
]);

assert.ok(source.includes('data-drop-zone="pitch"'), 'pitch must be a drop surface');
assert.ok(source.includes('data-drop-zone="bench"'), 'bench must be a drop surface');
assert.ok(source.includes('data-drop-zone="reserves"'), 'unselected squad must be a drop surface');
assert.ok(source.includes('data-drag-player'), 'players must expose pointer drag handles');
assert.ok(source.includes('movePlayerOnPitch'), 'free pitch positioning must exist');
assert.ok(source.includes('swapPlayers'), 'dropping over another player must swap them');
assert.ok(source.includes('tl-command-bar'), 'game command bar must render for legacy state synchronization');
assert.ok(source.includes('tl-war-room'), 'tactics war room must render');
assert.ok(source.includes('tl-bench-dock'), 'bench must stay next to the pitch');
assert.ok(source.includes('Elenco disponível'), 'full remaining squad must remain in the source model');
assert.ok(source.includes('GROUP_FILTERS'), 'legacy squad filters must remain harmlessly compatible');
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
assert.ok(threeViews.includes('function navigationHost(root)'), 'view navigation must have one explicit host');
assert.ok(threeViews.includes("return root.querySelector('.tl-side-rail')"), 'all views must keep navigation in the right rail');
assert.ok(!threeViews.includes("activeView === 'roles' ? root.querySelector('.tl-responsibilities-head')"), 'roles must never move navigation into another header');
assert.ok(threeViews.includes('host.firstElementChild !== navigation'), 'navigation must remain the first fixed rail element');
assert.ok(threeViews.includes('tl-responsibilities-main'), 'roles content must render inside the shared main column');
assert.ok(threeViews.includes('data-role-lineup-panel'), 'roles summary must render inside the shared right column');
assert.ok(threeViews.includes('tl-model-context'), 'model view must keep formation inside its own main panel');
assert.ok(threeViews.includes('Capitão'), 'captain responsibility must exist');
assert.ok(threeViews.includes('Pênaltis'), 'penalty responsibility must exist');
assert.ok(threeViews.includes('Faltas diretas'), 'direct free-kick responsibility must exist');
assert.ok(threeViews.includes('Faltas indiretas'), 'indirect free-kick responsibility must exist');
assert.ok(threeViews.includes('Escanteio esquerdo'), 'left-corner responsibility must exist');
assert.ok(threeViews.includes('Escanteio direito'), 'right-corner responsibility must exist');
assert.ok(threeViews.includes('localStorage.setItem'), 'responsibilities must persist for the club');

assert.ok(threeViewsCss.includes('.tl-primary-view-switch'), 'fixed view switch must be styled');
assert.ok(threeViewsCss.includes('.tl-responsibilities-main'), 'responsibilities main panel must be styled');
assert.ok(threeViewsCss.includes('.tl-role-lineup-panel'), 'roles side panel must be styled');
assert.ok(threeViewsCss.includes('.tl-model-context'), 'model context must be styled');
assert.ok(threeViewsCss.includes('prefers-reduced-motion'), 'three-view transitions must respect reduced motion');
assert.ok(refinementCss.includes('::-webkit-scrollbar-button'), 'native scrollbar arrow buttons must be suppressed');
assert.ok(refinementCss.includes('scrollbar-width:thin'), 'horizontal roster scrolling must remain available');
assert.ok(refinementCss.includes('.tl-tactics-studio[data-tactics-view] .tl-command-bar'), 'every view must suppress the shifting top command bar');
assert.ok(refinementCss.includes('grid-template-columns:minmax(700px,1fr) minmax(292px,324px)!important'), 'all views must share the same two-column geometry');
assert.ok(refinementCss.includes('grid-template-rows:68px minmax(0,1fr)!important'), 'right rail navigation row must stay fixed');
assert.ok(refinementCss.includes('.tl-tactics-studio[data-tactics-view] .tl-side-rail>.tl-primary-view-switch'), 'view switch must stay in one exact rail slot');
assert.ok(refinementCss.includes('.tl-tactics-studio[data-tactics-view] .tl-squad-manager'), 'lower squad strip must keep the same slot in every view');
assert.ok(refinementCss.includes('[data-tactics-view="tactics"] .tl-tactic-controls'), 'model instructions must replace the field in the main column');
assert.ok(refinementCss.includes('[data-tactics-view="roles"] .tl-responsibilities-main'), 'responsibilities must replace the field in the main column');
assert.ok(refinementCss.includes('height:clamp(132px,16vh,158px)'), 'unselected squad strip must stay compact and fixed');

assert.ok(formationManager.includes("document.addEventListener('change', interceptFormationChange, true)"), 'formation select must be intercepted before legacy rerender handlers');
assert.ok(formationManager.includes('event.stopImmediatePropagation()'), 'legacy formation rerender must be blocked');
assert.ok(formationManager.includes('getBoundingClientRect()'), 'formation motion must measure first and last player positions');
assert.ok(formationManager.includes('node.animate(['), 'formation motion must use the Web Animations API');
assert.ok(formationManager.includes('translate3d('), 'formation motion must stay on the GPU transform path');
assert.ok(formationManager.includes("easing: 'cubic-bezier(.16, 1, .3, 1)'"), 'formation motion must use controlled premium easing');
assert.ok(formationManager.includes('queueFormationSave'), 'formation persistence must run in the background');
assert.ok(formationManager.includes('__touchlineFormationDraft'), 'latest formation must remain authoritative across later saves');
assert.ok(formationManager.includes('patchPitchInstantly'), 'later UI renders must restore the live formation before paint');
assert.ok(!formationManager.includes('createVisualSnapshot'), 'formation changes must not clone the screen');
assert.ok(!formationManager.includes('remountStudio'), 'formation changes must not remount the tactics screen');
assert.ok(!formationManager.includes('waitForFreshStudio'), 'formation changes must not wait for a replacement screen');
assert.ok(!formationManager.includes('location.reload()'), 'formation changes must never reload the page');
assert.ok(repository.includes('mergeFormationDraft'), 'repository saves must preserve the newest live formation');
assert.ok(repository.includes('__touchlineFormationDraft'), 'repository must read the live formation draft');
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
  interface: 'three-view-fixed-tactics-shell',
  views: ['lineup', 'tactics', 'roles'],
  defaultView: 'lineup',
  viewDock: 'permanent-right-rail-top',
  stableColumns: true,
  stableNavigationCoordinates: true,
  shiftingCommandBar: false,
  lowerSquadStripPersistent: true,
  modelReplacesField: true,
  rolesReplaceField: true,
  responsibilities: 7,
  dragPreview: 'circular-player-avatar',
  dragRendering: 'request-animation-frame-gpu',
  formationMotion: 'live-flip-web-animations-gpu',
  formationUpdate: 'same-dom-real-time',
  formationRemount: false,
  formationScreenClone: false,
  formationRemountFlash: false,
  formationPageReload: false,
  formationPersistence: 'background-authoritative-draft',
  dropZones: ['pitch', 'bench', 'reserves'],
  benchLimit: 9,
  freePositioning: true,
  swapOnPlayerDrop: true,
  shirtNumberOverlay: false,
  legacyMetricsPanel: false,
  recommendXiButton: false,
  reducedMotion: true
}, null, 2));

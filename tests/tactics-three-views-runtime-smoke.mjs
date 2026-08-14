import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [source, layoutCss] = await Promise.all([
  readFile(new URL('../src/career-tactics-three-views.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-tactics-layout-refinement.css', import.meta.url), 'utf8')
]);

assert.ok(
  source.includes("if (activeView !== 'tactics') return;"),
  'model context must only mutate the DOM while view 02 is active'
);
assert.ok(
  source.includes('context.dataset.signature === signature'),
  'model context must skip identical DOM writes'
);
assert.equal(
  (source.match(/context\.innerHTML\s*=/g) || []).length,
  1,
  'model context must have one guarded HTML write path'
);
assert.ok(
  source.includes("return root.querySelector('.tl-side-rail')"),
  'navigation must use the permanent right rail host'
);
assert.ok(
  source.includes('placeNavigation(root);\n  syncNavigation(root);\n  bindViewEvents(root);'),
  'navigation must be mounted before asynchronous view loading'
);
assert.ok(
  source.includes('requestAnimationFrame(() =>'),
  'observer reconciliation must be batched into animation frames'
);
assert.ok(
  source.includes('const version = ++enhanceVersion'),
  'stale asynchronous view work must be discarded'
);
assert.ok(
  source.includes("console.error('Falha ao montar as views da central tática:'"),
  'runtime failures must be surfaced instead of silently freezing the UI'
);
assert.ok(source.includes('analyzeTactics'), 'view 02 must use the real tactical engine');
assert.ok(source.includes('data-model-summary'), 'view 02 must render a tactical impact summary');
assert.ok(source.includes('Pontos fortes'), 'view 02 must explain tactical strengths');
assert.ok(source.includes('Riscos e conflitos'), 'view 02 must expose tactical risks and contradictions');
assert.ok(source.includes('data-role-lineup-panel'), 'view 03 must render a compact responsibility summary');
assert.ok(source.includes('Resumo definido'), 'view 03 must summarize assigned responsibilities');
assert.ok(source.includes('Atenção antes do jogo'), 'view 03 must warn about invalid or fragile assignments');
assert.ok(!source.includes('XI inicial</span><small>Funções individuais'), 'view 03 must not repeat the full XI list');
assert.ok(!source.includes('data-open-player-role'), 'view 03 must not expose a redundant individual-player shortcut');

assert.ok(
  layoutCss.includes('[data-tactics-view="tactics"] .tl-squad-manager,\n.tl-tactics-studio[data-tactics-view="roles"] .tl-squad-manager{display:none!important}'),
  'unselected squad must be exclusive to view 01'
);
assert.ok(
  layoutCss.includes('[data-tactics-view="tactics"] .tl-inspector'),
  'the redundant individual-player inspector must be hidden in view 02'
);
assert.ok(
  layoutCss.includes('[data-tactics-view="tactics"] .tl-model-summary'),
  'the tactical summary must occupy the fixed right rail in view 02'
);
assert.ok(
  layoutCss.includes('[data-tactics-view="roles"] .tl-role-lineup-panel'),
  'the responsibility summary must occupy the fixed right rail in view 03'
);

console.log(JSON.stringify({
  ok: true,
  navigationHost: 'permanent-right-rail',
  observerLoop: false,
  modelContextWrites: 'signature-guarded',
  navigationBeforeAsyncLoad: true,
  staleAsyncWorkDiscarded: true,
  lineupView: ['pitch', 'bench', 'unselected-squad'],
  modelView: ['team-instructions', 'tactical-engine-summary'],
  rolesView: ['responsibility-editor', 'assignment-summary'],
  redundantPlayerInspector: false,
  squadOutsideLineupView: false
}, null, 2));

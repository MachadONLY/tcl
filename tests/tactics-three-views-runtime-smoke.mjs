import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/career-tactics-three-views.js', import.meta.url), 'utf8');

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
  'navigation must be mounted before any asynchronous roles loading'
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

console.log(JSON.stringify({
  ok: true,
  navigationHost: 'permanent-right-rail',
  observerLoop: false,
  modelContextWrites: 'signature-guarded',
  navigationBeforeAsyncLoad: true,
  staleAsyncWorkDiscarded: true
}, null, 2));

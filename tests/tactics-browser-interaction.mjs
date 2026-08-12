import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { TACTICS_FORMATIONS } from '../src/career-tactics-formations.js';

const baseUrl = process.env.TOUCHLINE_URL || 'http://127.0.0.1:5173/#tactics';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });

await context.addInitScript(() => {
  localStorage.setItem('touchline.career.reset.v5', 'done');
  localStorage.setItem('touchline.career.mode.v1', JSON.stringify({
    onboardingComplete: true,
    selectedClubCode: 'MUN',
    selectedClubName: 'Manchester United',
    careerSeason: '2026/27'
  }));
});

const page = await context.newPage();
const failures = [];
const browserErrors = [];
page.on('pageerror', error => browserErrors.push(`pageerror:${error.message}`));
page.on('console', message => {
  if (message.type() === 'error' || message.type() === 'warning') browserErrors.push(`console:${message.type()}:${message.text()}`);
});
const fail = message => failures.push(message);

async function waitForStudio() {
  await page.waitForSelector('.tl-tactics-studio .tl-pitch', { timeout: 30000 });
  await page.waitForSelector('.tl-field-formation-control select[data-tl-formation]', { timeout: 30000 });
  await page.waitForSelector('[data-tactics-view-nav]', { timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll('.tl-pitch [data-drag-player]').length === 11, null, { timeout: 30000 });
}

async function snapshot() {
  return page.evaluate(() => {
    const select = document.querySelector('.tl-field-formation-control select[data-tl-formation]');
    const players = [...document.querySelectorAll('.tl-pitch [data-drag-player]')];
    const bench = [...document.querySelectorAll('.tl-bench-list [data-drag-player]')];
    let fallback = null;
    try { fallback = JSON.parse(localStorage.getItem('touchline.career.v5.primary') || 'null'); } catch {}
    const draft = globalThis.__touchlineCareerDraft;
    const formationDraft = globalThis.__touchlineFormationDraft;
    return {
      formation: select?.value || null,
      players: players.map(node => ({
        id: node.dataset.dragPlayer,
        x: parseFloat(node.style.getPropertyValue('--x')),
        y: parseFloat(node.style.getPropertyValue('--y'))
      })),
      bench: bench.map(node => node.dataset.dragPlayer),
      view: document.querySelector('.tl-tactics-studio')?.dataset.tacticsView || null,
      dragGhosts: document.querySelectorAll('.tl-drag-ghost').length,
      draftFormation: draft?.formation || null,
      formationDraftFormation: formationDraft?.formation || null,
      fallbackFormation: fallback?.formation || null,
      fallbackLineup: fallback?.lineup || null
    };
  });
}

async function dragDiagnostics(playerId, targetX, targetY) {
  return page.evaluate(({ playerId: id, x, y }) => {
    const element = document.elementFromPoint(x, y);
    const player = document.querySelector(`.tl-pitch [data-drag-player="${id}"]`);
    const draft = globalThis.__touchlineCareerDraft;
    const plan = draft?.tactics?.activePlan || 'A';
    const phase = document.querySelector('.tl-pitch')?.classList.contains('phase-possession') ? 'possession'
      : document.querySelector('.tl-pitch')?.classList.contains('phase-out') ? 'out' : 'base';
    return {
      htmlFreeDrag: document.documentElement.classList.contains('tl-lineup-free-drag'),
      htmlDragging: document.documentElement.classList.contains('tl-is-dragging'),
      ghost: Boolean(document.querySelector('.tl-drag-ghost')),
      playerCaptured: player?.hasPointerCapture?.(1) ?? null,
      elementTag: element?.tagName || null,
      elementClass: element?.className || null,
      dropZone: element?.closest?.('[data-drop-zone]')?.dataset.dropZone || null,
      dropPlayer: element?.closest?.('[data-drop-player]')?.dataset.dropPlayer || null,
      draftFormation: draft?.formation || null,
      draftPosition: draft?.tacticalLayouts?.[plan]?.[phase]?.[id] || null
    };
  }, { playerId, x: targetX, y: targetY });
}

async function selectFormation(formation) {
  const selector = '.tl-field-formation-control select[data-tl-formation]';
  await page.locator(selector).selectOption(formation);
  await page.waitForFunction(expected => {
    const select = document.querySelector('.tl-field-formation-control select[data-tl-formation]');
    return select?.value === expected;
  }, formation, { timeout: 5000 });
}

async function setView(view) {
  await page.locator(`[data-tactics-view-button="${view}"]`).click({ force: true });
  await page.waitForFunction(expected => document.querySelector('.tl-tactics-studio')?.dataset.tacticsView === expected, view, { timeout: 5000 });
}

async function dragToPoint(playerId, xRatio, yRatio) {
  const player = page.locator(`.tl-pitch [data-drag-player="${playerId}"]`);
  const pitch = page.locator('.tl-pitch');
  const playerBox = await player.boundingBox();
  const pitchBox = await pitch.boundingBox();
  assert.ok(playerBox && pitchBox, 'pitch and player must have browser geometry');
  const startX = playerBox.x + playerBox.width / 2;
  const startY = playerBox.y + playerBox.height / 2;
  const targetX = pitchBox.x + pitchBox.width * xRatio;
  const targetY = pitchBox.y + pitchBox.height * yRatio;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(targetX, targetY, { steps: 8 });
  const during = await dragDiagnostics(playerId, targetX, targetY);
  await page.mouse.up();
  await page.waitForTimeout(120);
  const after = await snapshot();
  return {
    expectedX: Math.max(6, Math.min(94, xRatio * 100)),
    expectedY: Math.max(6, Math.min(94, yRatio * 100)),
    during,
    after
  };
}

async function swapBenchIntoLineup() {
  const field = page.locator('.tl-pitch [data-drag-player]').nth(5);
  const bench = page.locator('.tl-bench-list [data-drag-player]').first();
  const fieldId = await field.getAttribute('data-drag-player');
  const benchId = await bench.getAttribute('data-drag-player');
  const from = await bench.boundingBox();
  const to = await field.boundingBox();
  assert.ok(from && to && fieldId && benchId, 'bench/field swap requires visible browser nodes');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(140);
  return { fieldId, benchId };
}

await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
await waitForStudio();

let state = await snapshot();
if (state.players.length !== 11) fail(`initial lineup count ${state.players.length}, expected 11`);
if (state.bench.length !== 9) fail(`initial bench count ${state.bench.length}, expected 9`);

for (const formation of TACTICS_FORMATIONS) {
  await selectFormation(formation);
  state = await snapshot();
  if (state.formation !== formation) fail(`${formation}: visible selector reverted to ${state.formation}`);
  if (state.players.length !== 11) fail(`${formation}: lineup count became ${state.players.length}`);
}

await selectFormation('4-3-3');
const playerId = await page.locator('.tl-pitch [data-drag-player]').nth(5).getAttribute('data-drag-player');
assert.ok(playerId, 'a midfield player must exist for free positioning');
const target = await dragToPoint(playerId, 0.71, 0.43);
state = target.after;
if (state.formation !== '4-3-3') fail(`formation->drag race reverted to ${state.formation}; diag=${JSON.stringify(target.during)}`);
const moved = state.players.find(player => player.id === playerId);
if (!moved) fail(`dragged player disappeared from lineup; diag=${JSON.stringify(target.during)}`);
else {
  if (Math.abs(moved.x - target.expectedX) > 1.2) fail(`drag x imprecise: ${moved.x} vs ${target.expectedX}; diag=${JSON.stringify(target.during)}; after=${JSON.stringify({draft:state.draftFormation,fallback:state.fallbackFormation})}`);
  if (Math.abs(moved.y - target.expectedY) > 1.2) fail(`drag y imprecise: ${moved.y} vs ${target.expectedY}; diag=${JSON.stringify(target.during)}`);
}
if (state.dragGhosts !== 0) fail('drag ghost remained after pointerup');

const swap = await swapBenchIntoLineup();
state = await snapshot();
if (state.formation !== '4-3-3') fail(`bench swap reverted formation to ${state.formation}`);
if (state.players.length !== 11) fail(`bench swap lineup count ${state.players.length}, expected 11`);
if (state.bench.length !== 9) fail(`bench swap bench count ${state.bench.length}, expected 9`);
if (!state.players.some(player => player.id === swap.benchId)) fail('bench player did not enter the XI after drop');
if (!state.bench.includes(swap.fieldId)) fail('replaced field player did not enter the bench');

const secondTarget = await dragToPoint(swap.benchId, 0.27, 0.58);
state = secondTarget.after;
if (state.formation !== '4-3-3') fail(`second free drag reverted formation to ${state.formation}`);
const secondMoved = state.players.find(player => player.id === swap.benchId);
if (!secondMoved || Math.abs(secondMoved.x - secondTarget.expectedX) > 1.2 || Math.abs(secondMoved.y - secondTarget.expectedY) > 1.2) {
  fail(`incoming player did not retain precise free positioning; diag=${JSON.stringify(secondTarget.during)}`);
}

await page.waitForTimeout(1000);
const beforeReload = await snapshot();
await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
await waitForStudio();
state = await snapshot();
if (state.formation !== '4-3-3') fail(`reload restored wrong formation ${state.formation}; before=${JSON.stringify({draft:beforeReload.draftFormation,formationDraft:beforeReload.formationDraftFormation,fallback:beforeReload.fallbackFormation})}`);
if (!state.players.some(player => player.id === swap.benchId)) fail(`lineup swap did not survive reload; beforeFallbackLineup=${JSON.stringify(beforeReload.fallbackLineup)}`);
const reloadedMoved = state.players.find(player => player.id === swap.benchId);
if (!reloadedMoved || Math.abs(reloadedMoved.x - secondTarget.expectedX) > 1.2 || Math.abs(reloadedMoved.y - secondTarget.expectedY) > 1.2) {
  fail(`manual coordinates did not survive reload: ${JSON.stringify(reloadedMoved)}; before=${JSON.stringify({draft:beforeReload.draftFormation,fallback:beforeReload.fallbackFormation})}`);
}

await setView('tactics');
await page.waitForSelector('[data-model-context] select', { timeout: 5000 });
await page.locator('[data-model-context] select').selectOption('5-2-1-2');
await page.waitForFunction(() => document.querySelector('.tl-field-hud [data-tl-formation]')?.value === '5-2-1-2', null, { timeout: 5000 });
await setView('lineup');
state = await snapshot();
if (state.formation !== '5-2-1-2') fail(`model-view formation bridge produced ${state.formation}`);

const modelPlayerId = state.players[7]?.id;
if (!modelPlayerId) fail('model-view regression test could not resolve a field player');
else {
  const modelTarget = await dragToPoint(modelPlayerId, 0.61, 0.31);
  state = modelTarget.after;
  if (state.formation !== '5-2-1-2') fail(`model formation -> drag reverted to ${state.formation}; diag=${JSON.stringify(modelTarget.during)}`);
  const modelMoved = state.players.find(player => player.id === modelPlayerId);
  if (!modelMoved || Math.abs(modelMoved.x - modelTarget.expectedX) > 1.2 || Math.abs(modelMoved.y - modelTarget.expectedY) > 1.2) {
    fail(`model-view formation drag did not retain precise coordinates; diag=${JSON.stringify(modelTarget.during)}`);
  }
}

await page.waitForTimeout(1000);
const finalBeforeReload = await snapshot();
await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
await waitForStudio();
state = await snapshot();
if (state.formation !== '5-2-1-2') fail(`final reload restored wrong formation ${state.formation}; before=${JSON.stringify({draft:finalBeforeReload.draftFormation,formationDraft:finalBeforeReload.formationDraftFormation,fallback:finalBeforeReload.fallbackFormation})}`);
if (state.players.length !== 11 || state.bench.length !== 9) fail(`final reload squad counts ${state.players.length}/${state.bench.length}`);

await setView('tactics');
await setView('roles');
await setView('lineup');
state = await snapshot();
if (state.formation !== '5-2-1-2') fail(`three-view round-trip changed formation to ${state.formation}`);

await browser.close();

if (browserErrors.length) console.error('Browser diagnostics:\n' + browserErrors.join('\n'));
if (failures.length) {
  console.error('Tactics browser interaction failures:\n' + failures.map(item => `- ${item}`).join('\n'));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  browser: 'chromium',
  formationsSwept: TACTICS_FORMATIONS.length,
  formationDragRace: 'passed',
  modelFormationBridge: 'passed',
  freePositionPrecision: 'passed',
  benchLineupSwap: 'passed',
  reloadPersistence: 'passed',
  threeViewRoundTrip: 'passed',
  finalFormation: '5-2-1-2'
}, null, 2));

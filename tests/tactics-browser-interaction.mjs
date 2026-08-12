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
  await page.waitForFunction(() => {
    const grid = document.querySelector('.tl-roster-grid.reserves');
    return Boolean(grid && grid.querySelectorAll('[data-drag-player]').length > 0);
  }, null, { timeout: 30000 });
}

async function snapshot() {
  return page.evaluate(() => {
    const select = document.querySelector('.tl-field-formation-control select[data-tl-formation]');
    const players = [...document.querySelectorAll('.tl-pitch [data-drag-player]')];
    const bench = [...document.querySelectorAll('.tl-bench-list [data-drag-player]')];
    let fallback = null;
    try { fallback = JSON.parse(localStorage.getItem('touchline.career.v5.primary') || 'null'); } catch {}
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
      fallbackFormation: fallback?.formation || null,
      fallbackLineup: fallback?.lineup || null
    };
  });
}

async function reserveLayoutSnapshot() {
  return page.evaluate(() => {
    const grid = document.querySelector('.tl-roster-grid.reserves');
    const manager = document.querySelector('.tl-squad-manager');
    if (!grid || !manager) return null;
    const cards = [...grid.querySelectorAll('.tl-squad-card')];
    const boxes = cards.map(card => card.getBoundingClientRect());
    const rowTops = [...new Set(boxes.map(box => Math.round(box.top)))];
    const style = getComputedStyle(grid);
    return {
      cardCount: cards.length,
      rows: rowTops.length,
      horizontalOverflow: Math.max(0, grid.scrollWidth - grid.clientWidth),
      verticalOverflow: Math.max(0, grid.scrollHeight - grid.clientHeight),
      gridWidth: grid.clientWidth,
      scrollWidth: grid.scrollWidth,
      overflowX: style.overflowX,
      overflowY: style.overflowY,
      scrollSnapType: style.scrollSnapType,
      scrollTools: document.querySelectorAll('.tl-roster-scroll-tools').length
    };
  });
}

async function reserveEdgeReachability() {
  return page.evaluate(async () => {
    const grid = document.querySelector('.tl-roster-grid.reserves');
    const cards = [...(grid?.querySelectorAll('.tl-squad-card') || [])];
    if (!grid || !cards.length) return null;
    const originalBehavior = grid.style.scrollBehavior;
    grid.style.scrollBehavior = 'auto';
    const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const tolerance = 2;

    grid.scrollLeft = 0;
    await settle();
    const startGrid = grid.getBoundingClientRect();
    const first = cards[0].getBoundingClientRect();
    const firstComplete = first.left >= startGrid.left - tolerance && first.right <= startGrid.right + tolerance;

    const maxScroll = Math.max(0, grid.scrollWidth - grid.clientWidth);
    grid.scrollLeft = maxScroll;
    await settle();
    const endGrid = grid.getBoundingClientRect();
    const last = cards.at(-1).getBoundingClientRect();
    const lastComplete = last.left >= endGrid.left - tolerance && last.right <= endGrid.right + tolerance;
    const reachedEnd = Math.abs(grid.scrollLeft - maxScroll) <= 2;

    grid.scrollLeft = 0;
    await settle();
    grid.style.scrollBehavior = originalBehavior;
    return { firstComplete, lastComplete, reachedEnd, maxScroll };
  });
}

async function verifyReserveLayout(label) {
  const layout = await reserveLayoutSnapshot();
  if (!layout) {
    fail(`${label}: reserve grid missing`);
    return;
  }
  if (layout.cardCount < 1) fail(`${label}: no unselected players rendered`);
  if (layout.rows !== 1) fail(`${label}: reserves wrapped into ${layout.rows} rows instead of one horizontal lane`);
  if (layout.cardCount > 5 && layout.horizontalOverflow <= 2) fail(`${label}: reserve lane is not horizontally scrollable`);
  if (layout.verticalOverflow > 2) fail(`${label}: reserve lane has unwanted vertical overflow ${layout.verticalOverflow}px`);
  if (!/(auto|scroll)/.test(layout.overflowX)) fail(`${label}: overflow-x is ${layout.overflowX}, expected horizontal scrolling`);
  if (layout.overflowY !== 'hidden') fail(`${label}: overflow-y is ${layout.overflowY}, expected hidden`);
  if (!String(layout.scrollSnapType).includes('x')) fail(`${label}: horizontal scroll snap is not active`);
  if (layout.scrollTools !== 0) fail(`${label}: obsolete reserve carousel controls still exist`);

  const edges = await reserveEdgeReachability();
  if (!edges) fail(`${label}: reserve edge reachability missing`);
  else {
    if (!edges.firstComplete) fail(`${label}: first reserve card is clipped at the left edge`);
    if (!edges.lastComplete) fail(`${label}: last reserve card is clipped at the right edge`);
    if (!edges.reachedEnd) fail(`${label}: reserve lane cannot reach its maximum horizontal scroll`);
  }
}

async function selectFormation(formation) {
  const selector = '.tl-field-formation-control select[data-tl-formation]';
  await page.locator(selector).selectOption(formation);
  await page.waitForFunction(expected => document.querySelector('.tl-field-formation-control select[data-tl-formation]')?.value === expected, formation, { timeout: 5000 });
}

async function setView(view) {
  await page.locator(`[data-tactics-view-button="${view}"]`).click({ force: true });
  await page.waitForFunction(expected => document.querySelector('.tl-tactics-studio')?.dataset.tacticsView === expected, view, { timeout: 5000 });
}

async function pointerDrag(sourceSelector, targetX, targetY, steps = 8) {
  return page.evaluate(({ sourceSelector: selector, targetX: x, targetY: y, steps: count }) => {
    const source = document.querySelector(selector);
    if (!source) throw new Error(`pointer drag source not found: ${selector}`);
    const bounds = source.getBoundingClientRect();
    const startX = bounds.left + bounds.width / 2;
    const startY = bounds.top + bounds.height / 2;
    Object.defineProperty(source, 'setPointerCapture', { configurable: true, value: () => {} });
    Object.defineProperty(source, 'releasePointerCapture', { configurable: true, value: () => {} });
    const init = (clientX, clientY, buttons) => ({
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: 77,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      buttons,
      clientX,
      clientY
    });
    source.dispatchEvent(new PointerEvent('pointerdown', init(startX, startY, 1)));
    for (let index = 1; index <= count; index += 1) {
      const ratio = index / count;
      source.dispatchEvent(new PointerEvent('pointermove', init(
        startX + (x - startX) * ratio,
        startY + (y - startY) * ratio,
        1
      )));
    }
    const during = {
      dragging: document.documentElement.classList.contains('tl-is-dragging'),
      freeDrag: document.documentElement.classList.contains('tl-lineup-free-drag'),
      ghost: Boolean(document.querySelector('.tl-drag-ghost')),
      targetZone: document.elementFromPoint(x, y)?.closest?.('[data-drop-zone]')?.dataset.dropZone || null
    };
    source.dispatchEvent(new PointerEvent('pointerup', init(x, y, 0)));
    return during;
  }, { sourceSelector, targetX, targetY, steps });
}

async function dragPlayerToPitch(playerId, xRatio, yRatio) {
  const pitchBox = await page.locator('.tl-pitch').boundingBox();
  assert.ok(pitchBox, 'pitch must have browser geometry');
  const targetX = pitchBox.x + pitchBox.width * xRatio;
  const targetY = pitchBox.y + pitchBox.height * yRatio;
  const during = await pointerDrag(`.tl-pitch [data-drag-player="${playerId}"]`, targetX, targetY);
  await page.waitForTimeout(180);
  return {
    expectedX: Math.max(6, Math.min(94, xRatio * 100)),
    expectedY: Math.max(6, Math.min(94, yRatio * 100)),
    during
  };
}

async function swapBenchIntoLineup() {
  const field = page.locator('.tl-pitch [data-drag-player]').nth(5);
  const bench = page.locator('.tl-bench-list [data-drag-player]').first();
  const fieldId = await field.getAttribute('data-drag-player');
  const benchId = await bench.getAttribute('data-drag-player');
  const to = await field.boundingBox();
  assert.ok(to && fieldId && benchId, 'bench/field swap requires browser geometry');
  await pointerDrag(`.tl-bench-list [data-drag-player="${benchId}"]`, to.x + to.width / 2, to.y + to.height / 2, 10);
  await page.waitForTimeout(200);
  return { fieldId, benchId };
}

await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
await waitForStudio();
await page.waitForTimeout(120);

let state = await snapshot();
if (state.players.length !== 11) fail(`initial lineup count ${state.players.length}, expected 11`);
if (state.bench.length !== 9) fail(`initial bench count ${state.bench.length}, expected 9`);
await verifyReserveLayout('initial');

for (const formation of TACTICS_FORMATIONS) {
  await selectFormation(formation);
  state = await snapshot();
  if (state.formation !== formation) fail(`${formation}: selector reverted to ${state.formation}`);
  if (state.players.length !== 11) fail(`${formation}: lineup count became ${state.players.length}`);
}

await selectFormation('4-3-3');
const playerId = await page.locator('.tl-pitch [data-drag-player]').nth(5).getAttribute('data-drag-player');
assert.ok(playerId);
const target = await dragPlayerToPitch(playerId, 0.71, 0.43);
state = await snapshot();
if (!target.during.dragging || !target.during.ghost) fail(`pointer drag never entered active state: ${JSON.stringify(target.during)}`);
if (state.formation !== '4-3-3') fail(`formation->drag reverted to ${state.formation}`);
const moved = state.players.find(player => player.id === playerId);
if (!moved || Math.abs(moved.x - target.expectedX) > 1.2 || Math.abs(moved.y - target.expectedY) > 1.2) {
  fail(`free drag imprecise: ${JSON.stringify(moved)} expected ${target.expectedX}/${target.expectedY}`);
}
if (state.dragGhosts !== 0) fail('drag ghost remained after pointerup');

const swap = await swapBenchIntoLineup();
state = await snapshot();
if (state.formation !== '4-3-3') fail(`bench swap reverted formation to ${state.formation}`);
if (state.players.length !== 11 || state.bench.length !== 9) fail(`squad counts after swap ${state.players.length}/${state.bench.length}`);
if (!state.players.some(player => player.id === swap.benchId)) fail('bench player did not enter XI');
if (!state.bench.includes(swap.fieldId)) fail('replaced starter did not enter bench');
await verifyReserveLayout('after bench/XI swap');

const secondTarget = await dragPlayerToPitch(swap.benchId, 0.27, 0.58);
state = await snapshot();
const secondMoved = state.players.find(player => player.id === swap.benchId);
if (state.formation !== '4-3-3') fail(`second free drag reverted formation to ${state.formation}`);
if (!secondMoved || Math.abs(secondMoved.x - secondTarget.expectedX) > 1.2 || Math.abs(secondMoved.y - secondTarget.expectedY) > 1.2) fail('incoming player did not retain free position');

await page.waitForTimeout(1100);
const beforeReload = await snapshot();
await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
await waitForStudio();
state = await snapshot();
if (state.formation !== '4-3-3') fail(`reload restored ${state.formation}; durable fallback before reload=${beforeReload.fallbackFormation}`);
if (!state.players.some(player => player.id === swap.benchId)) fail(`lineup swap lost on reload; persisted=${JSON.stringify(beforeReload.fallbackLineup)}`);
const reloaded = state.players.find(player => player.id === swap.benchId);
if (!reloaded || Math.abs(reloaded.x - secondTarget.expectedX) > 1.2 || Math.abs(reloaded.y - secondTarget.expectedY) > 1.2) fail(`manual position lost on reload: ${JSON.stringify(reloaded)}`);
await verifyReserveLayout('after reload');

await setView('tactics');
await page.waitForSelector('[data-model-context] select', { timeout: 5000 });
await page.locator('[data-model-context] select').selectOption('5-2-1-2');
await page.waitForFunction(() => document.querySelector('.tl-field-hud [data-tl-formation]')?.value === '5-2-1-2', null, { timeout: 5000 });
await setView('lineup');
state = await snapshot();
if (state.formation !== '5-2-1-2') fail(`model formation bridge produced ${state.formation}`);

const modelPlayerId = state.players[7]?.id;
if (!modelPlayerId) fail('no player available after model formation change');
else {
  const modelTarget = await dragPlayerToPitch(modelPlayerId, 0.61, 0.31);
  state = await snapshot();
  const modelMoved = state.players.find(player => player.id === modelPlayerId);
  if (state.formation !== '5-2-1-2') fail(`model formation->drag reverted to ${state.formation}`);
  if (!modelMoved || Math.abs(modelMoved.x - modelTarget.expectedX) > 1.2 || Math.abs(modelMoved.y - modelTarget.expectedY) > 1.2) fail('model formation drag lost precision');
}

await page.waitForTimeout(1100);
const finalBeforeReload = await snapshot();
await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
await waitForStudio();
state = await snapshot();
if (state.formation !== '5-2-1-2') fail(`final reload restored ${state.formation}; durable fallback=${finalBeforeReload.fallbackFormation}`);
if (state.players.length !== 11 || state.bench.length !== 9) fail(`final squad counts ${state.players.length}/${state.bench.length}`);
await verifyReserveLayout('final reload');

await setView('tactics');
await setView('roles');
await setView('lineup');
state = await snapshot();
if (state.formation !== '5-2-1-2') fail(`three-view round-trip changed formation to ${state.formation}`);
await verifyReserveLayout('three-view round-trip');

await browser.close();
if (browserErrors.length) console.error('Browser diagnostics:\n' + browserErrors.join('\n'));
if (failures.length) {
  console.error('Tactics browser interaction failures:\n' + failures.map(item => `- ${item}`).join('\n'));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  browser: 'chromium-pointer-events',
  formationsSwept: TACTICS_FORMATIONS.length,
  formationDragRace: 'passed',
  freePositionPrecision: 'passed',
  benchLineupSwap: 'passed',
  reloadPersistence: 'passed',
  modelFormationBridge: 'passed',
  threeViewRoundTrip: 'passed',
  reserveGrid: 'single-horizontal-scroll-lane-complete-edges',
  finalFormation: '5-2-1-2'
}, null, 2));

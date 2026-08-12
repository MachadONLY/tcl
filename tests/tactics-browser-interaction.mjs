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
const fail = message => failures.push(message);
page.on('pageerror', error => browserErrors.push(`pageerror:${error.message}`));
page.on('console', message => {
  if (message.type() === 'error' || message.type() === 'warning') {
    browserErrors.push(`console:${message.type()}:${message.text()}`);
  }
});

async function waitForStudio() {
  await page.waitForSelector('.tl-tactics-studio .tl-pitch', { timeout: 30000 });
  await page.waitForSelector('.tl-field-formation-control select[data-tl-formation]', { timeout: 30000 });
  await page.waitForSelector('[data-tactics-view-nav]', { timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll('.tl-pitch [data-drag-player]').length === 11, null, { timeout: 30000 });
  await page.waitForFunction(() => document.querySelectorAll('.tl-roster-grid.reserves [data-drag-player]').length > 0, null, { timeout: 30000 });
}

async function snapshot() {
  return page.evaluate(() => {
    const formation = document.querySelector('.tl-field-formation-control select[data-tl-formation]')?.value || null;
    const players = [...document.querySelectorAll('.tl-pitch [data-drag-player]')].map(node => ({
      id: node.dataset.dragPlayer,
      x: parseFloat(node.style.getPropertyValue('--x')),
      y: parseFloat(node.style.getPropertyValue('--y'))
    }));
    const bench = [...document.querySelectorAll('.tl-bench-list [data-drag-player]')].map(node => node.dataset.dragPlayer);
    return {
      formation,
      players,
      bench,
      view: document.querySelector('.tl-tactics-studio')?.dataset.tacticsView || null,
      ghosts: document.querySelectorAll('.tl-drag-ghost').length
    };
  });
}

async function verifyReserveLane(label) {
  const result = await page.evaluate(async () => {
    const grid = document.querySelector('.tl-roster-grid.reserves');
    const cards = [...(grid?.querySelectorAll('.tl-squad-card') || [])];
    if (!grid || !cards.length) return null;

    const settle = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const style = getComputedStyle(grid);
    const rows = [...new Set(cards.map(card => Math.round(card.getBoundingClientRect().top)))].length;
    const horizontalOverflow = grid.scrollWidth - grid.clientWidth;
    const verticalOverflow = grid.scrollHeight - grid.clientHeight;
    const tolerance = 3;

    grid.scrollLeft = 0;
    await settle();
    const startBounds = grid.getBoundingClientRect();
    const firstBounds = cards[0].getBoundingClientRect();
    const firstComplete = firstBounds.left >= startBounds.left - tolerance && firstBounds.right <= startBounds.right + tolerance;

    const beforeWheel = grid.scrollLeft;
    cards[0].dispatchEvent(new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: Math.max(520, grid.clientWidth * .65),
      deltaMode: WheelEvent.DOM_DELTA_PIXEL
    }));
    await new Promise(resolve => setTimeout(resolve, 220));
    const wheelMovedRight = grid.scrollLeft > beforeWheel + 2;

    // Scroll through the same native lane until the final player is reached.
    // Mandatory snap may finish a few pixels before scrollWidth-clientWidth;
    // the real invariant is that the final card is completely reachable.
    grid.scrollTo({ left: grid.scrollWidth, behavior: 'auto' });
    await new Promise(resolve => setTimeout(resolve, 380));
    const endBounds = grid.getBoundingClientRect();
    const lastBounds = cards.at(-1).getBoundingClientRect();
    const lastComplete = lastBounds.left >= endBounds.left - tolerance && lastBounds.right <= endBounds.right + tolerance;
    const movedToEndRegion = grid.scrollLeft > Math.max(1, horizontalOverflow * .65);

    grid.scrollTo({ left: 0, behavior: 'auto' });
    await settle();

    return {
      cardCount: cards.length,
      rows,
      horizontalOverflow,
      verticalOverflow,
      overflowX: style.overflowX,
      overflowY: style.overflowY,
      snap: style.scrollSnapType,
      firstComplete,
      wheelMovedRight,
      lastComplete,
      movedToEndRegion,
      tools: document.querySelectorAll('.tl-roster-scroll-tools').length
    };
  });

  if (!result) return fail(`${label}: reserve lane missing`);
  if (result.cardCount < 1) fail(`${label}: no reserve cards`);
  if (result.rows !== 1) fail(`${label}: reserves wrapped into ${result.rows} rows`);
  if (result.cardCount > 5 && result.horizontalOverflow <= 2) fail(`${label}: reserve lane has no horizontal overflow`);
  if (result.verticalOverflow > 2) fail(`${label}: reserve lane has vertical overflow ${result.verticalOverflow}px`);
  if (!/(auto|scroll)/.test(result.overflowX)) fail(`${label}: overflow-x=${result.overflowX}`);
  if (result.overflowY !== 'hidden') fail(`${label}: overflow-y=${result.overflowY}`);
  if (!String(result.snap).includes('x')) fail(`${label}: x scroll snap is not active`);
  if (!result.firstComplete) fail(`${label}: first reserve card is clipped`);
  if (!result.wheelMovedRight) fail(`${label}: mouse wheel did not move reserve lane right`);
  if (!result.movedToEndRegion) fail(`${label}: reserve lane did not reach its final region`);
  if (!result.lastComplete) fail(`${label}: last reserve card is not completely reachable`);
  if (result.tools !== 0) fail(`${label}: obsolete carousel arrows still exist`);
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

async function pointerDrag(sourceSelector, targetX, targetY, steps = 10) {
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
    const active = document.documentElement.classList.contains('tl-is-dragging');
    const ghost = Boolean(document.querySelector('.tl-drag-ghost'));
    source.dispatchEvent(new PointerEvent('pointerup', init(x, y, 0)));
    return { active, ghost };
  }, { sourceSelector, targetX, targetY, steps });
}

async function dragPlayerToPitch(playerId, xRatio, yRatio) {
  const box = await page.locator('.tl-pitch').boundingBox();
  assert.ok(box, 'pitch must have browser geometry');
  const targetX = box.x + box.width * xRatio;
  const targetY = box.y + box.height * yRatio;
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
  const target = await field.boundingBox();
  assert.ok(fieldId && benchId && target, 'bench/XI swap requires geometry');
  await pointerDrag(`.tl-bench-list [data-drag-player="${benchId}"]`, target.x + target.width / 2, target.y + target.height / 2);
  await page.waitForTimeout(220);
  return { fieldId, benchId };
}

await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 120000 });
await waitForStudio();
await page.waitForTimeout(150);

let state = await snapshot();
if (state.players.length !== 11) fail(`initial XI=${state.players.length}`);
if (state.bench.length !== 9) fail(`initial bench=${state.bench.length}`);
await verifyReserveLane('initial');

for (const formation of TACTICS_FORMATIONS) {
  await selectFormation(formation);
  state = await snapshot();
  if (state.formation !== formation) fail(`${formation}: selector reverted to ${state.formation}`);
  if (state.players.length !== 11) fail(`${formation}: XI=${state.players.length}`);
}

await selectFormation('4-3-3');
const playerId = await page.locator('.tl-pitch [data-drag-player]').nth(5).getAttribute('data-drag-player');
assert.ok(playerId);
const firstTarget = await dragPlayerToPitch(playerId, .71, .43);
state = await snapshot();
if (!firstTarget.during.active || !firstTarget.during.ghost) fail('free drag did not enter active pointer state');
if (state.formation !== '4-3-3') fail(`formation->drag reverted to ${state.formation}`);
const moved = state.players.find(player => player.id === playerId);
if (!moved || Math.abs(moved.x - firstTarget.expectedX) > 1.2 || Math.abs(moved.y - firstTarget.expectedY) > 1.2) {
  fail(`free position imprecise: ${JSON.stringify(moved)}`);
}
if (state.ghosts !== 0) fail('drag ghost remained after drop');

const swap = await swapBenchIntoLineup();
state = await snapshot();
if (state.formation !== '4-3-3') fail(`bench swap reverted formation to ${state.formation}`);
if (state.players.length !== 11 || state.bench.length !== 9) fail(`post-swap squad counts ${state.players.length}/${state.bench.length}`);
if (!state.players.some(player => player.id === swap.benchId)) fail('bench player did not enter XI');
if (!state.bench.includes(swap.fieldId)) fail('replaced starter did not enter bench');
await verifyReserveLane('after swap');

const secondTarget = await dragPlayerToPitch(swap.benchId, .27, .58);
state = await snapshot();
const secondMoved = state.players.find(player => player.id === swap.benchId);
if (!secondMoved || Math.abs(secondMoved.x - secondTarget.expectedX) > 1.2 || Math.abs(secondMoved.y - secondTarget.expectedY) > 1.2) {
  fail('incoming XI player did not retain free position');
}

await page.waitForTimeout(1100);
await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
await waitForStudio();
state = await snapshot();
if (state.formation !== '4-3-3') fail(`reload formation=${state.formation}`);
if (!state.players.some(player => player.id === swap.benchId)) fail('bench/XI swap was lost on reload');
const reloaded = state.players.find(player => player.id === swap.benchId);
if (!reloaded || Math.abs(reloaded.x - secondTarget.expectedX) > 1.2 || Math.abs(reloaded.y - secondTarget.expectedY) > 1.2) {
  fail('manual position was lost on reload');
}
await verifyReserveLane('after reload');

await setView('tactics');
await page.waitForSelector('[data-model-context] select', { timeout: 5000 });
await page.locator('[data-model-context] select').selectOption('5-2-1-2');
await page.waitForFunction(() => document.querySelector('.tl-field-hud [data-tl-formation]')?.value === '5-2-1-2', null, { timeout: 5000 });
await setView('lineup');
state = await snapshot();
if (state.formation !== '5-2-1-2') fail(`model formation bridge=${state.formation}`);

await page.waitForTimeout(1100);
await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
await waitForStudio();
state = await snapshot();
if (state.formation !== '5-2-1-2') fail(`final reload formation=${state.formation}`);
await verifyReserveLane('final reload');

await setView('tactics');
await setView('roles');
await setView('lineup');
state = await snapshot();
if (state.formation !== '5-2-1-2') fail(`three-view round trip formation=${state.formation}`);
await verifyReserveLane('three-view round trip');

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
  reserveLane: 'one-row-horizontal-wheel-to-last-card',
  reserveLastCardFullyReachable: true,
  finalFormation: '5-2-1-2'
}, null, 2));

import { chromium } from "playwright";
import { CLUBS } from "../src/onboarding/offline-data.js";

const VIEWPORTS = [
  { width: 1920, height: 1080, name: "desktop-1920" },
  { width: 1366, height: 768, name: "desktop-1366" }
];
const baseUrl = process.env.TOUCHLINE_URL || "http://127.0.0.1:5173/#club-select";
const browser = await chromium.launch({ headless: true });
const failures = [];

const roundedBox = box => box && ({
  x: Math.round(box.x * 10) / 10,
  y: Math.round(box.y * 10) / 10,
  width: Math.round(box.width * 10) / 10,
  height: Math.round(box.height * 10) / 10
});

for (const viewport of VIEWPORTS) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector(".tl-club-select[data-offline-ready='true']", { timeout: 30000 });

  const snapshot = async () => page.evaluate(() => {
    const root = document.querySelector(".tl-club-select");
    const card = document.querySelector(".tl-club-card");
    const header = document.querySelector(".tl-club-select__header");
    const rail = document.querySelector(".tl-club-select__rail");
    const stage = document.querySelector(".tl-club-select__stage");
    const controls = document.querySelector(".tl-club-select__controls");
    const box = node => {
      const rect = node?.getBoundingClientRect();
      return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom } : null;
    };
    const railBox = box(rail);
    const cardBox = box(card);
    return {
      code: root?.dataset.clubCode,
      root: box(root),
      card: cardBox,
      header: box(header),
      rail: railBox,
      stage: box(stage),
      panelGap: railBox && cardBox ? cardBox.y - railBox.bottom : null,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      controlsDisplay: controls ? getComputedStyle(controls).display : "absent"
    };
  });

  const baseline = await snapshot();
  const stableKeys = ["root", "card", "header", "rail", "stage"];

  const check = (state, label) => {
    if (state.scrollX !== 0 || state.scrollY !== 0) failures.push(`${viewport.name} ${label}: viewport rolou para ${state.scrollX},${state.scrollY}`);
    if (state.documentWidth > state.viewportWidth || state.documentHeight > state.viewportHeight) {
      failures.push(`${viewport.name} ${label}: documento excede viewport ${state.documentWidth}x${state.documentHeight}`);
    }
    if (state.controlsDisplay !== "none" && state.controlsDisplay !== "absent") {
      failures.push(`${viewport.name} ${label}: controles inferiores ainda visíveis`);
    }
    if (state.panelGap === null || Math.abs(state.panelGap) > 0.6) {
      failures.push(`${viewport.name} ${label}: gap entre barra e painel = ${state.panelGap}px`);
    }
    for (const key of stableKeys) {
      const before = roundedBox(baseline[key]);
      const after = roundedBox(state[key]);
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        failures.push(`${viewport.name} ${label}: ${key} moveu ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
      }
    }
  };

  check(baseline, "inicial");

  for (let index = 0; index < CLUBS.length; index += 1) {
    const club = CLUBS[index];
    await page.locator(".tl-club-select__rail-item").nth(index).click({ force: true });
    await page.waitForFunction(code => {
      const root = document.querySelector(".tl-club-select");
      return root?.dataset.clubCode === code && root?.dataset.switching === "false";
    }, club.code, { timeout: 30000 });
    check(await snapshot(), club.code);
  }

  await page.evaluate(() => {
    const indexes = [18, 0, 16, 5, 13, 3, 0];
    const items = [...document.querySelectorAll(".tl-club-select__rail-item")];
    indexes.forEach((index, step) => setTimeout(() => items[index]?.click(), step * 5));
  });
  await page.waitForFunction(() => {
    const root = document.querySelector(".tl-club-select");
    return root?.dataset.clubCode === "ARS" && root?.dataset.switching === "false";
  }, null, { timeout: 30000 });
  check(await snapshot(), "troca rápida");

  await page.close();
}

await browser.close();
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Static selector frame passed for 20/20 clubs at two desktop sizes; no scroll, no geometry drift, no panel gap, no footer controls.");

import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CLUBS } from "../src/onboarding/offline-data.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(await readFile(path.join(dirname, "../public/assets/clubs/2026-27/manifest.json"), "utf8"));
const baseUrl = process.env.TOUCHLINE_URL || "http://127.0.0.1:5173/#club-select";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const failures = [];

const expectedFor = code => {
  const club = CLUBS.find(item => item.code === code);
  const entry = manifest.clubs[code];
  return {
    code,
    index: CLUBS.findIndex(item => item.code === code),
    copy: {
      "club-name": club.shortName || club.name,
      city: club.city,
      manager: club.manager,
      titles: club.titles,
      stadium: club.stadium,
      capacity: club.capacity,
      founded: club.founded,
      nickname: club.nickname,
      story: club.story,
      rival: club.rival
    },
    media: {
      backdrop: entry.stadium,
      crest: entry.crest,
      city: entry.city,
      manager: entry.manager,
      stadium: entry.stadium,
      homeKit: entry.homeKit,
      awayKit: entry.awayKit,
      rivalCrest: entry.rivalCrest
    }
  };
};

async function waitForExactClub(code, label) {
  const expected = expectedFor(code);
  try {
    await page.waitForFunction(expectedState => {
      const root = document.querySelector(".tl-club-select");
      if (!root) return false;
      if (root.dataset.clubCode !== expectedState.code) return false;
      if (root.dataset.mediaClubCode !== expectedState.code) return false;
      if (root.dataset.switching !== "false") return false;
      if (root.dataset.requestedClubCode !== expectedState.code) return false;

      const selected = root.querySelector(".tl-club-select__rail-item[aria-current='true']");
      if (Number(selected?.dataset.clubIndex) !== expectedState.index) return false;

      for (const [key, value] of Object.entries(expectedState.copy)) {
        if (root.querySelector(`[data-copy="${key}"]`)?.textContent?.trim() !== String(value)) return false;
      }

      for (const [role, source] of Object.entries(expectedState.media)) {
        const stack = root.querySelector(`[data-media="${role}"]`);
        const active = [...(stack?.querySelectorAll(":scope > img.is-active") || [])];
        if (active.length !== 1) return false;
        const image = active[0];
        if (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) return false;
        if (new URL(image.currentSrc || image.src).pathname !== source) return false;
      }

      return true;
    }, expected, { timeout: 30000 });
  } catch {
    const state = await page.evaluate(() => {
      const root = document.querySelector(".tl-club-select");
      return {
        clubCode: root?.dataset.clubCode,
        mediaClubCode: root?.dataset.mediaClubCode,
        requestedClubCode: root?.dataset.requestedClubCode,
        switching: root?.dataset.switching,
        switchError: root?.dataset.switchError,
        selectedIndex: root?.querySelector(".tl-club-select__rail-item[aria-current='true']")?.dataset.clubIndex,
        copy: Object.fromEntries([...root?.querySelectorAll("[data-copy]") || []].map(node => [node.dataset.copy, node.textContent?.trim()])),
        media: Object.fromEntries([...root?.querySelectorAll("[data-media]") || []].map(stack => [
          stack.dataset.media,
          [...stack.querySelectorAll(":scope > img.is-active")].map(image => new URL(image.currentSrc || image.src).pathname)
        ]))
      };
    });
    failures.push(`${label} ${code}: estado divergente ${JSON.stringify(state)}`);
  }
}

await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForSelector(".tl-club-select[data-offline-ready='true'] .tl-club-select__rail-item", { timeout: 30000 });

for (let index = 0; index < CLUBS.length; index += 1) {
  const club = CLUBS[index];
  await page.locator(".tl-club-select__rail-item").nth(index).click({ force: true });
  await waitForExactClub(club.code, "sequencial");
}

const sunIndex = CLUBS.findIndex(club => club.code === "SUN");
const arsenalIndex = CLUBS.findIndex(club => club.code === "ARS");
await page.locator(".tl-club-select__rail-item").nth(sunIndex).click({ force: true });
await waitForExactClub("SUN", "regressão Sunderland");
await page.locator(".tl-club-select__rail-item").nth(arsenalIndex).click({ force: true });
await waitForExactClub("ARS", "regressão Sunderland→Arsenal");

await page.evaluate(indexes => {
  const items = [...document.querySelectorAll(".tl-club-select__rail-item")];
  indexes.forEach((index, step) => window.setTimeout(() => items[index]?.click(), step * 4));
}, [sunIndex, arsenalIndex, CLUBS.findIndex(club => club.code === "NEW"), arsenalIndex]);
await waitForExactClub("ARS", "seleção rápida SUN→ARS→NEW→ARS");

await page.waitForTimeout(160);
const stackHealth = await page.evaluate(() => {
  const root = document.querySelector(".tl-club-select");
  return [...root.querySelectorAll("[data-media]")].map(stack => ({
    role: stack.dataset.media,
    active: stack.querySelectorAll(":scope > img.is-active").length,
    total: stack.querySelectorAll(":scope > img").length
  }));
});
for (const stack of stackHealth) {
  if (stack.active !== 1 || stack.total > 2) failures.push(`pilha ${stack.role}: ${JSON.stringify(stack)}`);
}

await browser.close();
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Club switch integrity passed: 20/20 exact mappings plus Sunderland→Arsenal and rapid-click regressions.");

import { chromium } from "playwright";

const CLUBS = [
  "ARS", "AVL", "BOU", "BRE", "BHA", "CHE", "COV", "CRY", "EVE", "FUL",
  "HUL", "IPS", "LEE", "LIV", "MCI", "MUN", "NEW", "NFO", "SUN", "TOT"
];
const EXPECTED = new Map([
  ["ARS", "4"], ["CHE", "5"], ["LIV", "2"], ["MCI", "8"], ["MUN", "13"]
]);

const baseUrl = process.env.TOUCHLINE_URL || "http://127.0.0.1:5173/#club-select";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const failures = [];

await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForSelector(".tl-club-select[data-offline-ready='true'] .tl-club-select__rail-item", { timeout: 30000 });

for (let index = 0; index < CLUBS.length; index += 1) {
  const code = CLUBS[index];
  process.stdout.write(`→ titles ${code}\n`);
  await page.locator(".tl-club-select__rail-item").nth(index).click({ force: true });
  try {
    await page.waitForFunction(expected => {
      const root = document.querySelector(".tl-club-select");
      return root?.dataset.clubCode === expected
        && root?.dataset.offlineReady === "true"
        && root?.dataset.switching === "false";
    }, code, { timeout: 15000 });
  } catch {
    const state = await page.evaluate(() => {
      const root = document.querySelector(".tl-club-select");
      return {
        code: root?.dataset.clubCode,
        switching: root?.dataset.switching,
        error: root?.dataset.switchError,
        selected: root?.querySelector(".tl-club-select__rail-item.selected .tl-club-select__rail-code")?.textContent
      };
    });
    throw new Error(`${code}: selector timeout ${JSON.stringify(state)}`);
  }

  const result = await page.evaluate(() => {
    const panel = document.querySelector(".tl-club-card__titles");
    const trophy = panel?.querySelector(".tl-club-card__trophy svg");
    const label = panel?.querySelector(".tl-club-label");
    const value = panel?.querySelector(":scope > strong");
    const metrics = element => {
      if (!element) return { visible: false, width: 0, height: 0 };
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return {
        visible: style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0,
        width: box.width,
        height: box.height
      };
    };
    return {
      trophy: metrics(trophy),
      label: metrics(label),
      labelText: label?.textContent?.trim() || "",
      value: metrics(value),
      valueText: value?.textContent?.trim() || ""
    };
  });

  if (!result.trophy.visible || result.trophy.width < 24 || result.trophy.height < 24) failures.push(`${code}: troféu invisível`);
  if (!result.label.visible || result.labelText !== "TÍTULOS PREMIER LEAGUE") failures.push(`${code}: label incorreta`);
  const expected = EXPECTED.get(code) || "0";
  if (!result.value.visible || result.valueText !== expected) failures.push(`${code}: títulos ${result.valueText}, esperado ${expected}`);
}

await browser.close();
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`Premier League titles validation passed for ${CLUBS.length}/${CLUBS.length} clubs.`);

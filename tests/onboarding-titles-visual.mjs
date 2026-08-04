import { chromium } from "playwright";

const CLUBS = [
  "ARS", "AVL", "BOU", "BRE", "BHA", "CHE", "COV", "CRY", "EVE", "FUL",
  "HUL", "IPS", "LEE", "LIV", "MCI", "MUN", "NEW", "NFO", "SUN", "TOT"
];

const baseUrl = process.env.TOUCHLINE_URL || "http://127.0.0.1:5173/#club-select";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
const failures = [];

await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForSelector(".career-club-selection .club-rail-item", { timeout: 30000 });

for (let index = 0; index < CLUBS.length; index += 1) {
  const code = CLUBS[index];
  await page.locator(".club-rail-item").nth(index).click();
  await page.waitForFunction(expected => {
    const root = document.querySelector(".career-club-selection");
    return root?.dataset.finalMediaClub === expected
      && root?.querySelector(".club-titles-panel")?.dataset.titlesReadyV13 === "true";
  }, code, { timeout: 30000 });

  const result = await page.evaluate(() => {
    const panel = document.querySelector(".club-titles-panel");
    const trophy = panel?.querySelector(":scope > .club-trophy-v13 svg");
    const label = panel?.querySelector(":scope > .club-data-label");
    const value = panel?.querySelector(":scope > strong");
    const visible = element => {
      if (!element) return false;
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.display !== "none"
        && style.visibility !== "hidden"
        && Number(style.opacity || 1) > 0
        && box.width > 4
        && box.height > 4;
    };

    return {
      trophy: visible(trophy),
      label: visible(label) && label.textContent.trim() === "TÍTULOS NACIONAIS",
      value: visible(value) && /^\d+$/.test(value.textContent.trim()),
      panelWidth: panel?.getBoundingClientRect().width || 0,
      panelHeight: panel?.getBoundingClientRect().height || 0
    };
  });

  if (!result.trophy) failures.push(`${code}: trophy is missing or invisible`);
  if (!result.label) failures.push(`${code}: titles label is missing or invisible`);
  if (!result.value) failures.push(`${code}: titles value is missing or invalid`);
  if (result.panelWidth < 80 || result.panelHeight < 90) failures.push(`${code}: titles panel is collapsed`);
}

await browser.close();

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Titles tile validation passed for ${CLUBS.length}/${CLUBS.length} clubs.`);

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

    const metrics = element => {
      if (!element) return { visible: false, width: 0, height: 0 };
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return {
        visible: style.display !== "none"
          && style.visibility !== "hidden"
          && Number(style.opacity || 1) > 0,
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

  if (!result.trophy.visible || result.trophy.width < 24 || result.trophy.height < 24) {
    failures.push(`${code}: trophy is missing, invisible, or too small`);
  }
  if (!result.label.visible || result.label.width < 30 || result.label.height < 5 || result.labelText !== "TÍTULOS NACIONAIS") {
    failures.push(`${code}: titles label is missing or invisible`);
  }
  if (!result.value.visible || result.value.width < 8 || result.value.height < 18 || !/^\d+$/.test(result.valueText)) {
    failures.push(`${code}: titles value is missing or invalid`);
  }
}

await browser.close();

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Titles tile validation passed for ${CLUBS.length}/${CLUBS.length} clubs.`);

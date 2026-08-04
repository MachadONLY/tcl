import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const CLUBS = [
  "ARS", "AVL", "BOU", "BRE", "BHA", "CHE", "COV", "CRY", "EVE", "FUL",
  "HUL", "IPS", "LEE", "LIV", "MCI", "MUN", "NEW", "NFO", "SUN", "TOT"
];

const baseUrl = process.env.TOUCHLINE_URL || "http://127.0.0.1:5173/#club-select";
const output = path.join(process.cwd(), "artifacts", "onboarding-final");
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const failures = [];

page.on("pageerror", error => failures.push(`pageerror: ${error.message}`));
page.on("console", message => {
  if (message.type() === "error") failures.push(`console: ${message.text()}`);
});

await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForSelector(".career-club-selection .club-rail-item", { timeout: 30000 });

for (let index = 0; index < CLUBS.length; index += 1) {
  const code = CLUBS[index];
  await page.locator(".club-rail-item").nth(index).click();
  await page.waitForFunction(expected => {
    const root = document.querySelector(".career-club-selection");
    const selected = root?.querySelector(".club-rail-item.selected span")?.textContent?.trim();
    return selected === expected && root?.dataset.finalMediaClub === expected;
  }, code, { timeout: 20000 });
  await page.waitForTimeout(250);

  const result = await page.evaluate(expected => {
    const root = document.querySelector(".career-club-selection");
    const details = root?.querySelector("[data-club-details]");
    const identity = details?.querySelector(".club-identity-card");
    const location = details?.querySelector(".club-location-panel");
    const manager = details?.querySelector(".club-manager-panel");
    const mainBadge = details?.querySelector(".club-badge-panel img");
    const rival = details?.querySelector(".club-rival-panel img");
    const managerImage = manager?.querySelector(":scope > img[data-media-ready='true']");
    const placeholder = manager?.querySelector(":scope > .club-manager-placeholder");
    const kits = [...(details?.querySelectorAll(".club-kit-slot img") || [])];
    const rail = [...(root?.querySelectorAll(".club-rail-item img") || [])];
    const visibleBroken = [...document.images].filter(image => {
      const style = getComputedStyle(image);
      const visible = style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0;
      return visible && image.getBoundingClientRect().width > 2 && image.naturalWidth === 0;
    }).map(image => image.alt || image.src);
    const identityBox = identity?.getBoundingClientRect();
    const locationBox = location?.getBoundingClientRect();
    const managerBox = manager?.getBoundingClientRect();
    const stadiumStyle = getComputedStyle(details?.querySelector(".club-stadium-panel"));
    const cityStyle = getComputedStyle(location);
    return {
      selected: root?.querySelector(".club-rail-item.selected span")?.textContent?.trim(),
      railReady: rail.length === 20 && rail.every(image => image.naturalWidth > 0),
      badgeReady: Boolean(mainBadge?.naturalWidth),
      managerReady: expected === "NEW" ? Boolean(placeholder) : Boolean(managerImage?.naturalWidth),
      managerPlaceholderVisible: expected === "NEW" ? true : Boolean(placeholder && getComputedStyle(placeholder).display !== "none"),
      rivalReady: Boolean(rival?.naturalWidth),
      kitsReady: kits.length >= 2 && kits.slice(0, 2).every(image => image.naturalWidth > 0),
      cityBackground: cityStyle.backgroundImage.includes("url("),
      stadiumBackground: stadiumStyle.backgroundImage.includes("url("),
      locationRatio: identityBox && locationBox ? locationBox.height / identityBox.height : 1,
      managerRatio: identityBox && managerBox ? managerBox.height / identityBox.height : 0,
      visibleBroken
    };
  }, code);

  const checks = [
    [result.selected === code, "selected club mismatch"],
    [result.railReady, "one or more rail crests failed"],
    [result.badgeReady, "main club badge failed"],
    [result.managerReady, "manager portrait/placeholder failed"],
    [code === "NEW" || !result.managerPlaceholderVisible, "manager placeholder remained visible"],
    [result.rivalReady, "rival badge failed"],
    [result.kitsReady, "kit images failed"],
    [result.cityBackground, "city background missing"],
    [result.stadiumBackground, "stadium background missing"],
    [result.locationRatio <= 0.48, `city panel too tall (${result.locationRatio.toFixed(3)})`],
    [result.managerRatio >= 0.27, `manager panel too short (${result.managerRatio.toFixed(3)})`],
    [result.visibleBroken.length === 0, `visible broken images: ${result.visibleBroken.join(", ")}`]
  ];

  for (const [ok, message] of checks) {
    if (!ok) failures.push(`${code}: ${message}`);
  }

  await page.screenshot({ path: path.join(output, `${String(index + 1).padStart(2, "0")}-${code}.png`), fullPage: true });
}

await browser.close();

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Visual onboarding validation passed for ${CLUBS.length}/${CLUBS.length} clubs.`);

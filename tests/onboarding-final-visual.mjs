import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const CLUBS = [
  "ARS", "AVL", "BOU", "BRE", "BHA", "CHE", "COV", "CRY", "EVE", "FUL",
  "HUL", "IPS", "LEE", "LIV", "MCI", "MUN", "NEW", "NFO", "SUN", "TOT"
];
const VIEWPORTS = [
  { name: "desktop-1920", width: 1920, height: 1080 },
  { name: "desktop-1366", width: 1366, height: 768 }
];

const baseUrl = process.env.TOUCHLINE_URL || "http://127.0.0.1:5173/#club-select";
const localOrigin = new URL(baseUrl).origin;
const output = path.join(process.cwd(), "artifacts", "onboarding-final");
await mkdir(output, { recursive: true });

const browser = await chromium.launch({ headless: true });
const failures = [];

for (const viewport of VIEWPORTS) {
  const folder = path.join(output, viewport.name);
  await mkdir(folder, { recursive: true });
  const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1 });

  await page.route("**/*", route => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    const mediaRequest = ["image", "xhr", "fetch", "media"].includes(request.resourceType());
    if (mediaRequest && requestUrl.origin !== localOrigin) return route.abort();
    return route.continue();
  });

  page.on("pageerror", error => failures.push(`${viewport.name}: pageerror: ${error.message}`));
  page.on("console", message => {
    if (message.type() === "error" && !/ERR_FAILED|offline-only/i.test(message.text())) {
      failures.push(`${viewport.name}: console: ${message.text()}`);
    }
  });

  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector(".career-club-selection .club-rail-item", { timeout: 30000 });

  for (let index = 0; index < CLUBS.length; index += 1) {
    const code = CLUBS[index];
    await page.locator(".club-rail-item").nth(index).click();
    await page.waitForFunction(expected => {
      const root = document.querySelector(".career-club-selection");
      const selected = root?.querySelector(".club-rail-item.selected span")?.textContent?.trim();
      return selected === expected
        && root?.dataset.finalMediaClub === expected
        && root?.dataset.finalMediaController === "ready";
    }, code, { timeout: 30000 });
    await page.waitForFunction(() => {
      const root = document.querySelector(".career-club-selection");
      const selected = root?.querySelector(".club-rail-item.selected span")?.textContent?.trim();
      const details = root?.querySelector("[data-club-details]");
      const required = [
        ...root.querySelectorAll(".club-rail-item img"),
        details?.querySelector(".club-badge-panel > img.club-badge-image-v13"),
        details?.querySelector(".club-manager-panel > img.club-manager-image-v13"),
        details?.querySelector(".club-rival-panel > img.club-rival-image-v13"),
        ...details.querySelectorAll(".club-kit-slot > img.club-kit-image-v13")
      ].filter(Boolean);
      return selected && required.length === 25 && required.every(image => image.complete && image.naturalWidth > 0);
    }, { timeout: 30000 });
    await page.waitForTimeout(140);

    const result = await page.evaluate(expected => {
      const localAsset = value => String(value || "").includes("/assets/clubs/2026-27/");
      const inside = (inner, outer, tolerance = 1.5) => inner
        && outer
        && inner.left >= outer.left - tolerance
        && inner.top >= outer.top - tolerance
        && inner.right <= outer.right + tolerance
        && inner.bottom <= outer.bottom + tolerance;

      const root = document.querySelector(".career-club-selection");
      const details = root?.querySelector("[data-club-details]");
      const identity = details?.querySelector(".club-identity-card");
      const header = root?.querySelector(".club-selection-header");
      const railElement = root?.querySelector(".club-rail");
      const grid = details?.querySelector(".club-selection-grid");
      const locationPanel = details?.querySelector(".club-location-panel");
      const stadiumPanel = details?.querySelector(".club-stadium-panel");
      const manager = details?.querySelector(".club-manager-panel");
      const badgePanel = details?.querySelector(".club-badge-panel");
      const badge = badgePanel?.querySelector(":scope > img.club-badge-image-v13");
      const managerImages = [...(manager?.querySelectorAll(":scope > img") || [])];
      const managerImage = manager?.querySelector(":scope > img.club-manager-image-v13");
      const rivalImages = [...(details?.querySelectorAll(".club-rival-panel > img") || [])];
      const rival = details?.querySelector(".club-rival-panel > img.club-rival-image-v13");
      const kits = [...(details?.querySelectorAll(".club-kit-slot > img.club-kit-image-v13") || [])];
      const rail = [...(root?.querySelectorAll(".club-rail-item img") || [])];
      const visibleBroken = [...(root?.querySelectorAll("img") || [])].filter(image => {
        const style = getComputedStyle(image);
        const rect = image.getBoundingClientRect();
        const visible = style.display !== "none"
          && style.visibility !== "hidden"
          && Number(style.opacity || 1) > 0
          && rect.width > 2
          && rect.height > 2;
        return visible && image.naturalWidth === 0;
      }).map(image => image.alt || image.src);

      const identityBox = identity?.getBoundingClientRect();
      const locationBox = locationPanel?.getBoundingClientRect();
      const managerBox = manager?.getBoundingClientRect();
      const managerImageBox = managerImage?.getBoundingClientRect();
      const badgeBox = badge?.getBoundingClientRect();
      const badgePanelBox = badgePanel?.getBoundingClientRect();
      const gridBox = grid?.getBoundingClientRect();
      const headerBox = header?.getBoundingClientRect();
      const railBox = railElement?.getBoundingClientRect();
      const cityStyle = getComputedStyle(locationPanel);
      const stadiumStyle = getComputedStyle(stadiumPanel);
      const managerStyle = getComputedStyle(managerImage);
      const titleStyle = getComputedStyle(header?.querySelector("h1"));
      const managerWidthRatio = managerBox && managerImageBox && managerBox.width > 0
        ? managerImageBox.width / managerBox.width
        : 0;

      return {
        selected: root?.querySelector(".club-rail-item.selected span")?.textContent?.trim(),
        controller: root?.dataset.finalMediaController,
        runtimeOffline: root?.dataset.runtimeNetworkRequired === "false",
        footerAbsent: !root?.querySelector(".club-selection-controls"),
        railReady: rail.length === 20 && rail.every(image => image.naturalWidth > 0 && localAsset(image.currentSrc || image.src)),
        badgeReady: Boolean(badge?.naturalWidth) && localAsset(badge.currentSrc || badge.src) && badgeBox.width >= 54 && inside(badgeBox, badgePanelBox),
        managerReady: managerImages.length === 1 && Boolean(managerImage?.naturalWidth) && localAsset(managerImage.currentSrc || managerImage.src),
        managerUncropped: managerStyle.objectFit === "contain"
          && managerStyle.objectPosition.includes("bottom")
          && managerWidthRatio >= .88
          && inside(managerImageBox, managerBox),
        managerPlaceholderAbsent: !manager?.querySelector(":scope > .club-manager-placeholder"),
        rivalReady: rivalImages.length === 1 && Boolean(rival?.naturalWidth) && localAsset(rival.currentSrc || rival.src),
        kitsReady: kits.length === 2 && kits.every(image => image.naturalWidth > 0 && localAsset(image.currentSrc || image.src)),
        cityBackground: cityStyle.backgroundImage.includes("/assets/clubs/2026-27/"),
        stadiumBackground: stadiumStyle.backgroundImage.includes("/assets/clubs/2026-27/"),
        locationRatio: identityBox && locationBox ? locationBox.height / identityBox.height : 1,
        managerRatio: identityBox && managerBox ? managerBox.height / identityBox.height : 0,
        managerWidthRatio,
        headerCompact: Number.parseFloat(titleStyle.fontSize) <= 43 && headerBox.bottom <= railBox.top + 1,
        viewportFit: gridBox && gridBox.bottom <= innerHeight + 1 && document.documentElement.scrollHeight <= innerHeight + 2,
        visibleBroken
      };
    }, code);

    const checks = [
      [result.selected === code, "selected club mismatch"],
      [result.controller === "ready", "deterministic controller not ready"],
      [result.runtimeOffline, "runtime is not marked offline"],
      [result.footerAbsent, "bottom control footer still exists"],
      [result.railReady, "one or more rail crests failed or are not local"],
      [result.badgeReady, "main club badge failed, is too small, or overflows"],
      [result.managerReady, "manager tile does not contain exactly one local portrait"],
      [result.managerUncropped, `manager portrait is cropped, narrow, or overflows (${result.managerWidthRatio.toFixed(3)} width ratio)`],
      [result.managerPlaceholderAbsent, "manager initials/placeholder remained visible"],
      [result.rivalReady, "rival badge failed or is not local"],
      [result.kitsReady, "both kit images must be local and visible"],
      [result.cityBackground, "city tile is not using a local city photo"],
      [result.stadiumBackground, "stadium tile is not using a local stadium photo"],
      [result.locationRatio <= 0.47, `city panel too tall (${result.locationRatio.toFixed(3)})`],
      [result.managerRatio >= 0.29, `manager panel too short (${result.managerRatio.toFixed(3)})`],
      [result.headerCompact, "header is too large or overlaps the club rail"],
      [result.viewportFit, "club selection screen does not fit inside the viewport"],
      [result.visibleBroken.length === 0, `visible broken images: ${result.visibleBroken.join(", ")}`]
    ];

    for (const [ok, message] of checks) {
      if (!ok) failures.push(`${viewport.name} ${code}: ${message}`);
    }

    await page.screenshot({
      path: path.join(folder, `${String(index + 1).padStart(2, "0")}-${code}.png`),
      fullPage: true
    });
  }

  await page.close();
}

await browser.close();

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Visual onboarding validation passed for ${CLUBS.length}/${CLUBS.length} clubs at ${VIEWPORTS.length} desktop sizes.`);

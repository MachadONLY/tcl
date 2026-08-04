import { chromium } from "playwright";

const baseUrl = process.env.TOUCHLINE_URL || "http://127.0.0.1:5173/#club-select";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForSelector(".career-club-selection .club-rail-item", { timeout: 30000 });
await page.locator(".club-rail-item").nth(5).click();
await page.waitForTimeout(1800);

const report = await page.evaluate(() => {
  const root = document.querySelector(".career-club-selection");
  const details = root?.querySelector("[data-club-details]");
  const describe = image => image ? {
    className: image.className,
    src: image.getAttribute("src"),
    currentSrc: image.currentSrc,
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
    width: image.getBoundingClientRect().width,
    height: image.getBoundingClientRect().height,
    ready: image.dataset.mediaReady,
    display: getComputedStyle(image).display,
    opacity: getComputedStyle(image).opacity,
    objectFit: getComputedStyle(image).objectFit,
    objectPosition: getComputedStyle(image).objectPosition
  } : null;

  return {
    rootClass: root?.className,
    rootDataset: { ...root?.dataset },
    selected: root?.querySelector(".club-rail-item.selected span")?.textContent,
    rail: [...root.querySelectorAll(".club-rail-item img")].map(describe),
    badge: describe(details?.querySelector(".club-badge-panel > img")),
    managerImages: [...details.querySelectorAll(".club-manager-panel > img")].map(describe),
    managerHtml: details.querySelector(".club-manager-panel")?.innerHTML,
    kits: [...details.querySelectorAll(".club-kit-slot img")].map(describe),
    rivalImages: [...details.querySelectorAll(".club-rival-panel > img")].map(describe),
    rivalHtml: details.querySelector(".club-rival-panel")?.innerHTML,
    locationBackground: getComputedStyle(details.querySelector(".club-location-panel")).backgroundImage,
    stadiumBackground: getComputedStyle(details.querySelector(".club-stadium-panel")).backgroundImage
  };
});

console.log(JSON.stringify(report, null, 2));
await browser.close();

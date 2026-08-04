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
    const requestUrl = new URL(route.request().url());
    if (requestUrl.origin !== localOrigin) return route.abort();
    return route.continue();
  });
  page.on("pageerror", error => failures.push(`${viewport.name}: pageerror: ${error.message}`));
  page.on("console", message => {
    if (message.type() === "error") failures.push(`${viewport.name}: console: ${message.text()}`);
  });

  await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector(".tl-club-select__rail-item", { timeout: 30000 });

  let baselineCard = null;
  for (let index = 0; index < CLUBS.length; index += 1) {
    const code = CLUBS[index];
    await page.locator(".tl-club-select__rail-item").nth(index).click();
    await page.waitForFunction(expected => {
      const root = document.querySelector(".tl-club-select");
      const active = [...(root?.querySelectorAll(".offline-media-stack > img.is-active") || [])];
      return root?.dataset.clubCode === expected
        && root?.dataset.offlineReady === "true"
        && root?.dataset.switching === "false"
        && active.length === 8
        && active.every(image => image.complete && image.naturalWidth > 0);
    }, code, { timeout: 30000 });

    const result = await page.evaluate(() => {
      const root = document.querySelector(".tl-club-select");
      const card = root?.querySelector(".tl-club-card");
      const identity = root?.querySelector(".tl-club-card__identity");
      const story = root?.querySelector(".tl-club-card__story");
      const manager = root?.querySelector(".tl-club-card__manager");
      const managerCopy = root?.querySelector(".tl-club-card__overlay--bottom");
      const managerImage = root?.querySelector('[data-media="manager"] > img.is-active');
      const cityText = root?.querySelector('[data-copy="city"]');
      const name = root?.querySelector('[data-copy="club-name"]');
      const active = [...(root?.querySelectorAll(".offline-media-stack > img.is-active") || [])];
      const allImages = [...(root?.querySelectorAll("img") || [])];
      const cardBox = card?.getBoundingClientRect();
      const identityBox = identity?.getBoundingClientRect();
      const storyBox = story?.getBoundingClientRect();
      const managerBox = manager?.getBoundingClientRect();
      const copyStyle = managerCopy ? getComputedStyle(managerCopy) : null;
      const managerStyle = managerImage ? getComputedStyle(managerImage) : null;
      const inside = (inner, outer, tolerance = 1.5) => inner && outer
        && inner.left >= outer.left - tolerance && inner.top >= outer.top - tolerance
        && inner.right <= outer.right + tolerance && inner.bottom <= outer.bottom + tolerance;
      return {
        code: root?.dataset.clubCode,
        card: cardBox ? { x: cardBox.x, y: cardBox.y, width: cardBox.width, height: cardBox.height, bottom: cardBox.bottom } : null,
        halves: identityBox && storyBox ? Math.abs(identityBox.width - storyBox.width) : 999,
        managerReady: Boolean(managerImage?.naturalWidth),
        managerFill: managerStyle?.objectFit === "cover" && inside(managerImage?.getBoundingClientRect(), managerBox),
        managerNoBar: copyStyle?.backgroundColor === "rgba(0, 0, 0, 0)" || copyStyle?.backgroundColor === "transparent",
        cityNotClipped: cityText ? cityText.scrollWidth <= cityText.clientWidth + 1 : false,
        nameNotClipped: name ? name.scrollWidth <= name.clientWidth + 1 : false,
        activeLocal: active.length === 8 && active.every(image => new URL(image.currentSrc || image.src).origin === location.origin),
        brokenVisible: allImages.filter(image => {
          const style = getComputedStyle(image);
          const box = image.getBoundingClientRect();
          return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0
            && box.width > 2 && box.height > 2 && image.naturalWidth === 0;
        }).length,
        viewportFit: document.documentElement.scrollHeight <= innerHeight + 2 && cardBox?.bottom <= innerHeight - 20,
        cardRatio: cardBox ? cardBox.width / cardBox.height : 0
      };
    });

    baselineCard ||= result.card;
    const heightDelta = Math.abs((result.card?.height || 0) - baselineCard.height);
    const widthDelta = Math.abs((result.card?.width || 0) - baselineCard.width);
    const checks = [
      [result.code === code, "clube divergente"],
      [result.card && result.card.width >= viewport.width * .72, "card principal pequeno"],
      [result.cardRatio >= 2.30 && result.cardRatio <= 2.48, `proporção ${result.cardRatio.toFixed(3)}`],
      [heightDelta <= 1 && widthDelta <= 1, `layout variou ${widthDelta.toFixed(1)}×${heightDelta.toFixed(1)}px`],
      [result.halves <= 2, `metades divergentes ${result.halves.toFixed(1)}px`],
      [result.managerReady && result.managerFill, "foto do técnico ausente ou sem preencher o tile"],
      [result.managerNoBar, "nome do técnico recebeu faixa de fundo"],
      [result.cityNotClipped, "nome da cidade cortado"],
      [result.nameNotClipped, "nome do clube cortado"],
      [result.activeLocal, "mídia ativa ausente ou remota"],
      [result.brokenVisible === 0, "imagem quebrada visível"],
      [result.viewportFit, "tela ultrapassa o viewport"]
    ];
    for (const [ok, message] of checks) if (!ok) failures.push(`${viewport.name} ${code}: ${message}`);

    await page.screenshot({ path: path.join(folder, `${String(index + 1).padStart(2, "0")}-${code}.png`), fullPage: true });
  }

  // Stress the exact failure mode reported by the user: rapid alternating selection.
  const cardBefore = await page.locator(".tl-club-card").boundingBox();
  await page.evaluate(() => {
    const items = [...document.querySelectorAll(".tl-club-select__rail-item")];
    [0, 5, 18, 3, 14, 1, 19, 8, 17].forEach((index, step) => setTimeout(() => items[index]?.click(), step * 12));
  });
  await page.waitForFunction(() => document.querySelector(".tl-club-select")?.dataset.clubCode === "NFO", null, { timeout: 30000 });
  await page.waitForFunction(() => document.querySelector(".tl-club-select")?.dataset.switching === "false", null, { timeout: 30000 });
  const stress = await page.evaluate(() => {
    const root = document.querySelector(".tl-club-select");
    const active = [...root.querySelectorAll(".offline-media-stack > img.is-active")];
    return {
      code: root.dataset.clubCode,
      active: active.length,
      loaded: active.every(image => image.complete && image.naturalWidth > 0),
      manager: root.querySelector('[data-copy="manager"]')?.textContent?.trim()
    };
  });
  const cardAfter = await page.locator(".tl-club-card").boundingBox();
  if (stress.code !== "NFO" || stress.active !== 8 || !stress.loaded || stress.manager !== "Oliver Glasner") {
    failures.push(`${viewport.name}: seleção rápida terminou em estado inconsistente`);
  }
  if (!cardBefore || !cardAfter || Math.abs(cardBefore.height - cardAfter.height) > 1 || Math.abs(cardBefore.width - cardAfter.width) > 1) {
    failures.push(`${viewport.name}: card mudou de tamanho durante seleção rápida`);
  }

  await page.close();
}

await browser.close();
if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`Reference layout validation passed for ${CLUBS.length}/${CLUBS.length} clubs at ${VIEWPORTS.length} desktop sizes.`);

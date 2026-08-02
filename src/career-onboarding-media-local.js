import "./career-onboarding-media-local.css";

const DB_NAME = "touchline-onboarding-media";
const DB_VERSION = 2;
const STORE = "webp";
const PROXY = "https://images.weserv.nl/";

const STADIUM_FIXES = Object.freeze({
  ARS: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Emirates_Stadium_aerial_2020-07.jpg/1280px-Emirates_Stadium_aerial_2020-07.jpg",
  NEW: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Newcastle_st-james-park_stadium.jpg/1280px-Newcastle_st-james-park_stadium.jpg"
});

const CLUB_CRESTS = Object.freeze({
  ARS:57, AVL:58, BOU:1044, BRE:402, BHA:397, CHE:61, COV:1076, CRY:354,
  EVE:62, FUL:63, HUL:322, IPS:349, LEE:341, LIV:64, MCI:65, MUN:66,
  NEW:67, NFO:351, SUN:746, TOT:73
});

const objectUrls = new Map();
const inflight = new Map();
let refreshFrame = 0;
let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise(resolve => {
    if (!("indexedDB" in window)) return resolve(null);
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (db.objectStoreNames.contains(STORE)) db.deleteObjectStore(STORE);
      db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
  return dbPromise;
}

async function readBlob(key) {
  const db = await openDb();
  if (!db) return null;
  return new Promise(resolve => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
    request.onerror = () => resolve(null);
  });
}

async function writeBlob(key, blob) {
  const db = await openDb();
  if (!db || !(blob instanceof Blob)) return;
  await new Promise(resolve => {
    const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(blob, key);
    request.onsuccess = request.onerror = () => resolve();
  });
}

function selectedCode() {
  return document.querySelector(".club-rail-item.selected span")?.textContent?.trim().toUpperCase() || "";
}

function cleanSource(source) {
  return String(source || "").trim().replace(/^url\(["']?/, "").replace(/["']?\)$/, "");
}

function isRemote(source) {
  return /^https?:\/\//i.test(source) && !source.startsWith(PROXY);
}

function proxyUrl(source, { width = 1100, height = 650, fit = "cover", quality = 72 } = {}) {
  const clean = cleanSource(source);
  if (!isRemote(clean)) return clean;
  const url = new URL(PROXY);
  url.searchParams.set("url", clean.replace(/^https?:\/\//i, ""));
  url.searchParams.set("output", "webp");
  url.searchParams.set("q", String(quality));
  url.searchParams.set("w", String(width));
  url.searchParams.set("h", String(height));
  url.searchParams.set("fit", fit);
  if (fit === "contain") url.searchParams.set("bg", "transparent");
  return url.toString();
}

function cacheKey(source, options) {
  return `${source}|${options.width || 0}x${options.height || 0}|${options.fit || "cover"}|q${options.quality || 72}`;
}

function objectUrl(key, blob) {
  if (objectUrls.has(key)) return objectUrls.get(key);
  const url = URL.createObjectURL(blob);
  objectUrls.set(key, url);
  return url;
}

async function localWebp(source, options = {}) {
  const clean = cleanSource(source);
  if (!isRemote(clean)) return clean;
  const key = cacheKey(clean, options);
  const stored = await readBlob(key);
  if (stored) return objectUrl(key, stored);
  if (inflight.has(key)) return inflight.get(key);

  const pending = (async () => {
    const optimized = proxyUrl(clean, options);
    try {
      const response = await fetch(optimized, { cache: "force-cache", mode: "cors" });
      if (!response.ok) return optimized;
      const blob = await response.blob();
      if (!blob.type.startsWith("image/")) return optimized;
      await writeBlob(key, blob);
      return objectUrl(key, blob);
    } catch {
      return optimized;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, pending);
  return pending;
}

async function localizeImage(image) {
  if (!(image instanceof HTMLImageElement)) return;
  const current = image.dataset.localMediaSource || image.currentSrc || image.src;
  const source = cleanSource(current);
  if (!isRemote(source)) return;

  const isManager = image.classList.contains("club-manager-image");
  const isKit = Boolean(image.closest(".club-kit-slot"));
  const isLargeCrest = Boolean(image.closest(".club-badge-panel"));
  const isRail = Boolean(image.closest(".club-rail-item"));
  const isRival = Boolean(image.closest(".club-rival-panel"));
  const contain = isKit || isLargeCrest || isRail || isRival || image.classList.contains("is-cutout");
  const options = {
    width: isKit ? 420 : isLargeCrest ? 360 : isManager ? 360 : isRail ? 120 : 220,
    height: isKit ? 420 : isLargeCrest ? 360 : isManager ? 360 : isRail ? 120 : 220,
    fit: contain ? "contain" : "cover",
    quality: isRail ? 68 : 74
  };
  const key = cacheKey(source, options);
  if (image.dataset.localMediaKey === key) return;

  image.dataset.localMediaSource = source;
  image.dataset.localMediaKey = key;
  image.decoding = "async";
  image.loading = isRail ? "eager" : image.loading || "eager";
  image.fetchPriority = isLargeCrest || isManager || isKit ? "high" : "auto";

  const fast = proxyUrl(source, options);
  if (image.src !== fast) image.src = fast;
  const local = await localWebp(source, options);
  if (image.isConnected && image.dataset.localMediaKey === key && image.src !== local) image.src = local;
}

async function localizeBackground(details, property, source, options) {
  const clean = cleanSource(source);
  if (!clean || !isRemote(clean)) return;
  const marker = `${property}:${cacheKey(clean, options)}`;
  if (details.dataset.localBackgroundKey === marker && property === "--v5-stadium-image") return;

  const fast = proxyUrl(clean, options);
  details.style.setProperty(property, `url("${fast}")`);
  const local = await localWebp(clean, options);
  if (!details.isConnected) return;
  details.style.setProperty(property, `url("${local}")`);
  if (property === "--v5-stadium-image") details.dataset.localBackgroundKey = marker;
  details.dataset.localMediaReady = "true";
}

function cssVariable(details, property) {
  return cleanSource(details.style.getPropertyValue(property) || getComputedStyle(details).getPropertyValue(property));
}

async function localizeCurrentDetails() {
  const details = document.querySelector("[data-club-details]");
  if (!details) return;
  const code = selectedCode();
  const stadium = STADIUM_FIXES[code] || cssVariable(details, "--v5-stadium-image");
  const location = cssVariable(details, "--v5-location-image");

  await Promise.all([
    stadium ? localizeBackground(details, "--v5-stadium-image", stadium, { width: 1280, height: 720, fit: "cover", quality: 72 }) : null,
    location ? localizeBackground(details, "--v5-location-image", location, { width: 1100, height: 650, fit: "cover", quality: 70 }) : null,
    ...[...details.querySelectorAll("img")].map(localizeImage),
    ...[...document.querySelectorAll(".club-rail-item img")].map(localizeImage)
  ]);
}

function scheduleRefresh() {
  cancelAnimationFrame(refreshFrame);
  refreshFrame = requestAnimationFrame(() => localizeCurrentDetails());
}

function prewarmCoreAssets() {
  const work = async () => {
    await Promise.all([
      ...Object.values(STADIUM_FIXES).map(source => localWebp(source, { width: 1280, height: 720, fit: "cover", quality: 72 })),
      ...Object.values(CLUB_CRESTS).map(id => localWebp(`https://crests.football-data.org/${id}.png`, { width: 120, height: 120, fit: "contain", quality: 68 }))
    ]);
  };
  if ("requestIdleCallback" in window) requestIdleCallback(work, { timeout: 900 });
  else setTimeout(work, 120);
}

const observer = new MutationObserver(mutations => {
  const relevant = mutations.some(mutation => {
    if (mutation.type === "attributes") return true;
    return [...mutation.addedNodes].some(node => node instanceof Element && (
      node.matches?.("[data-club-details], img, .club-rail-item") || node.querySelector?.("[data-club-details], img, .club-rail-item")
    ));
  });
  if (relevant) scheduleRefresh();
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["class", "style", "src"]
});

document.addEventListener("click", event => {
  if (event.target.closest("[data-club-index], [data-club-step]")) scheduleRefresh();
}, true);
window.addEventListener("hashchange", scheduleRefresh);
document.addEventListener("DOMContentLoaded", () => {
  scheduleRefresh();
  prewarmCoreAssets();
}, { once: true });
scheduleRefresh();
prewarmCoreAssets();

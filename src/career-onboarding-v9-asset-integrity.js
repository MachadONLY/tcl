const MANIFEST_URL = "/assets/clubs/2026-27/manifest.json?asset-integrity=9";

const CREST_IDS = Object.freeze({
  ARS: 57,
  AVL: 58,
  BOU: 1044,
  BRE: 402,
  BHA: 397,
  CHE: 61,
  COV: 1076,
  CRY: 354,
  EVE: 62,
  FUL: 63,
  HUL: 322,
  IPS: 349,
  LEE: 341,
  LIV: 64,
  MCI: 65,
  MUN: 66,
  NEW: 67,
  NFO: 351,
  SUN: 746,
  TOT: 73
});

const MANAGER_PAGES = Object.freeze({
  ARS: "Mikel_Arteta",
  AVL: "Unai_Emery",
  BOU: "Marco_Rose",
  BRE: "Keith_Andrews_(footballer)",
  BHA: "Fabian_Hürzeler",
  CHE: "Xabi_Alonso",
  COV: "Frank_Lampard",
  CRY: "Pierre_Sage",
  EVE: "David_Moyes",
  FUL: "Álvaro_Arbeloa",
  HUL: "Sergej_Jakirović",
  IPS: "Gary_O'Neil",
  LEE: "Daniel_Farke",
  LIV: "Andoni_Iraola",
  MCI: "Enzo_Maresca",
  MUN: "Michael_Carrick"
});

let manifestPromise = null;
let scheduledFrame = 0;
let repairVersion = 0;
const sourceChecks = new Map();
const managerSources = new Map();

function canonicalCrest(code) {
  const id = CREST_IDS[code];
  return id ? `https://crests.football-data.org/${id}.png` : "";
}

function selectedCode(root) {
  return root?.querySelector(".club-rail-item.selected span")?.textContent?.trim().toUpperCase() || "";
}

function loadManifest() {
  if (manifestPromise) return manifestPromise;
  manifestPromise = fetch(MANIFEST_URL, { cache: "no-store" })
    .then(response => response.ok ? response.json() : null)
    .catch(() => null);
  return manifestPromise;
}

function isRenderable(source) {
  if (!source) return Promise.resolve(false);
  if (sourceChecks.has(source)) return sourceChecks.get(source);

  const pending = new Promise(resolve => {
    const probe = new Image();
    probe.decoding = "async";
    probe.onload = async () => {
      try { await probe.decode?.(); } catch { /* load already succeeded */ }
      resolve(probe.naturalWidth > 0 && probe.naturalHeight > 0);
    };
    probe.onerror = () => resolve(false);
    probe.src = source;
    if (probe.complete) resolve(probe.naturalWidth > 0 && probe.naturalHeight > 0);
  });

  sourceChecks.set(source, pending);
  return pending;
}

function setImageSource(image, source, fallback = "") {
  if (!(image instanceof HTMLImageElement) || !source) return;

  let absolute;
  try { absolute = new URL(source, location.href).href; }
  catch { return; }

  if (image.src !== absolute) image.src = source;
  image.decoding = "async";
  image.loading = "eager";
  image.removeAttribute("referrerpolicy");
  image.style.removeProperty("display");
  image.style.removeProperty("visibility");
  image.style.removeProperty("opacity");

  if (fallback) image.dataset.v9Fallback = fallback;
  if (!image.dataset.v9ErrorBound) {
    image.dataset.v9ErrorBound = "true";
    image.addEventListener("error", () => {
      const next = image.dataset.v9Fallback;
      if (!next) return;
      let nextAbsolute;
      try { nextAbsolute = new URL(next, location.href).href; }
      catch { return; }
      if (image.src !== nextAbsolute) image.src = next;
    });
  }
}

async function bestCrestSource(code, entry) {
  const fallback = canonicalCrest(code);
  const local = entry?.crest;
  if (local && await isRenderable(local)) return { source: local, fallback };
  return { source: fallback, fallback: "" };
}

async function repairRail(root, clubs, version) {
  const items = [...root.querySelectorAll(".club-rail-item")];

  await Promise.all(items.map(async item => {
    const code = item.querySelector("span")?.textContent?.trim().toUpperCase();
    const image = item.querySelector("img");
    if (!code || !(image instanceof HTMLImageElement)) return;

    image.dataset.clubCode = code;
    const { source, fallback } = await bestCrestSource(code, clubs?.[code]);
    if (!source || version !== repairVersion || !image.isConnected) return;
    setImageSource(image, source, fallback);
  }));

  window.setTimeout(() => {
    if (!root.isConnected) return;
    const loaded = items.filter(item => item.querySelector("img")?.naturalWidth > 0).length;
    root.dataset.railCrestsV9 = String(loaded);
  }, 80);
}

function ensureMainBadge(details, code) {
  const panel = details?.querySelector(".club-badge-panel");
  if (!panel) return null;

  let image = panel.querySelector(":scope > img");
  if (!image) {
    image = document.createElement("img");
    image.alt = `Escudo do ${panel.querySelector("h2")?.textContent?.trim() || code}`;
    const title = panel.querySelector("h2");
    panel.insertBefore(image, title || panel.firstChild);
  }

  image.classList.add("club-badge-image-v8");
  image.fetchPriority = "high";
  panel.classList.add("club-badge-ready-v8");
  return image;
}

async function repairMainBadge(root, details, code, entry, version) {
  const image = ensureMainBadge(details, code);
  if (!image) return;

  const { source, fallback } = await bestCrestSource(code, entry);
  if (version !== repairVersion || !image.isConnected) return;

  const selectedRail = root.querySelector(".club-rail-item.selected img");
  const railSource = selectedRail?.naturalWidth > 0 ? (selectedRail.currentSrc || selectedRail.src) : "";
  setImageSource(image, source || railSource || canonicalCrest(code), fallback || canonicalCrest(code));
}

function managerPanel(details) {
  return details?.querySelector(".club-manager-panel") || null;
}

function managerName(panel) {
  return panel?.querySelector(":scope > div:last-child strong, .club-manager-copy-v5 strong")?.textContent?.trim() || "Técnico";
}

function ensureManagerImage(panel) {
  if (!panel) return null;
  let image = panel.querySelector(":scope > img.club-manager-image-v9, :scope > img.club-manager-image-v8, :scope > img.club-manager-image, :scope > img");

  if (!image) {
    image = document.createElement("img");
    const placeholder = panel.querySelector(":scope > .club-manager-placeholder");
    const copy = panel.querySelector(":scope > div:last-child, .club-manager-copy-v5");
    if (placeholder) placeholder.replaceWith(image);
    else panel.insertBefore(image, copy || panel.firstChild);
  }

  image.classList.add("club-manager-image", "club-manager-image-v8", "club-manager-image-v9");
  image.alt = managerName(panel);
  image.fetchPriority = "high";
  return image;
}

function restoreManagerPlaceholder(panel) {
  const name = managerName(panel);
  panel.querySelector(":scope > img.club-manager-image-v9")?.remove();
  if (panel.querySelector(":scope > .club-manager-placeholder")) return;

  const placeholder = document.createElement("div");
  placeholder.className = "club-manager-placeholder";
  const initials = document.createElement("span");
  initials.textContent = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "?";
  placeholder.append(initials);
  const copy = panel.querySelector(":scope > div:last-child, .club-manager-copy-v5");
  panel.insertBefore(placeholder, copy || panel.firstChild);
}

async function wikipediaManagerSource(code) {
  if (managerSources.has(code)) return managerSources.get(code);
  const page = MANAGER_PAGES[code];
  if (!page) return "";

  const pending = fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page)}`, {
    cache: "force-cache",
    headers: { Accept: "application/json" }
  })
    .then(response => response.ok ? response.json() : null)
    .then(payload => payload?.originalimage?.source || payload?.thumbnail?.source || "")
    .catch(() => "");

  managerSources.set(code, pending);
  return pending;
}

async function resolveManagerSource(code, entry) {
  const candidates = [entry?.manager, entry?.sources?.manager].filter(Boolean);
  for (const candidate of candidates) {
    if (await isRenderable(candidate)) return candidate;
  }

  const wikipedia = await wikipediaManagerSource(code);
  return wikipedia && await isRenderable(wikipedia) ? wikipedia : "";
}

async function repairManager(details, code, entry, version) {
  const panel = managerPanel(details);
  if (!panel) return;

  panel.classList.add("manager-photo-loading-v8");
  panel.classList.remove("manager-photo-ready-v8", "manager-photo-failed-v8");

  const source = await resolveManagerSource(code, entry);
  if (version !== repairVersion || !panel.isConnected) return;

  if (!source) {
    restoreManagerPlaceholder(panel);
    panel.classList.remove("manager-photo-loading-v8", "manager-photo-ready-v8");
    panel.classList.add("manager-photo-failed-v8");
    return;
  }

  const image = ensureManagerImage(panel);
  if (!image) return;

  image.onload = () => {
    if (!image.isConnected) return;
    panel.classList.remove("manager-photo-loading-v8", "manager-photo-failed-v8");
    panel.classList.add("manager-photo-ready-v8");
  };
  image.onerror = () => {
    restoreManagerPlaceholder(panel);
    panel.classList.remove("manager-photo-loading-v8", "manager-photo-ready-v8");
    panel.classList.add("manager-photo-failed-v8");
  };

  setImageSource(image, source);
  if (image.complete && image.naturalWidth > 0) image.onload();
}

async function runIntegrityRepair() {
  const root = document.querySelector(".career-club-selection");
  const details = root?.querySelector("[data-club-details]");
  const code = selectedCode(root);
  if (!root || !details || !code) return;

  const version = ++repairVersion;
  const manifest = await loadManifest();
  if (version !== repairVersion || !root.isConnected) return;

  const clubs = manifest?.clubs || {};
  const entry = clubs[code] || null;

  await Promise.all([
    repairRail(root, clubs, version),
    repairMainBadge(root, details, code, entry, version),
    repairManager(details, code, entry, version)
  ]);

  if (version === repairVersion && root.isConnected) {
    root.dataset.assetIntegrityV9 = "ready";
  }
}

function scheduleRepair() {
  cancelAnimationFrame(scheduledFrame);
  scheduledFrame = requestAnimationFrame(() => requestAnimationFrame(runIntegrityRepair));
  window.clearTimeout(scheduleRepair.retryOne);
  window.clearTimeout(scheduleRepair.retryTwo);
  scheduleRepair.retryOne = window.setTimeout(runIntegrityRepair, 180);
  scheduleRepair.retryTwo = window.setTimeout(runIntegrityRepair, 700);
}

const observer = new MutationObserver(mutations => {
  const relevant = mutations.some(mutation => {
    if (mutation.type === "attributes") {
      return mutation.target instanceof Element && mutation.target.matches(".club-rail-item, [data-club-details]");
    }
    return [...mutation.addedNodes].some(node => node instanceof Element && (
      node.matches?.(".career-club-selection, [data-club-details], .club-rail-item, .club-manager-panel")
      || node.querySelector?.(".career-club-selection, [data-club-details], .club-rail-item, .club-manager-panel")
    ));
  });
  if (relevant) scheduleRepair();
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["class", "data-local-pack"]
});

document.addEventListener("click", event => {
  if (event.target.closest("[data-club-index], [data-club-step]")) scheduleRepair();
}, true);
document.addEventListener("keydown", event => {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") scheduleRepair();
}, true);
window.addEventListener("hashchange", scheduleRepair);
document.addEventListener("DOMContentLoaded", scheduleRepair, { once: true });
scheduleRepair();

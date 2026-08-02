const MANIFEST_URL = "/assets/clubs/2026-27/manifest.json?pipeline=3";
const CLUB_ORDER = Object.freeze([
  "ARS", "AVL", "BOU", "BRE", "BHA", "CHE", "COV", "CRY", "EVE", "FUL",
  "HUL", "IPS", "LEE", "LIV", "MCI", "MUN", "NEW", "NFO", "SUN", "TOT"
]);
const RIVALS = Object.freeze({
  ARS: "TOT", AVL: null, BOU: null, BRE: "FUL", BHA: "CRY",
  CHE: "FUL", COV: null, CRY: "BHA", EVE: "LIV", FUL: "CHE",
  HUL: "LEE", IPS: null, LEE: "MUN", LIV: "EVE", MCI: "MUN",
  MUN: "LIV", NEW: "SUN", NFO: null, SUN: "NEW", TOT: "ARS"
});

let manifestPromise = null;
let frame = 0;
let idleWarmStarted = false;
let missingManifestRetries = 0;
const decoded = new Map();

function loadManifest(refresh = false) {
  if (refresh) manifestPromise = null;
  if (manifestPromise) return manifestPromise;
  manifestPromise = fetch(MANIFEST_URL, { cache: "no-store" })
    .then(response => response.ok ? response.json() : null)
    .catch(() => null);
  return manifestPromise;
}

function selectedCode(root) {
  return root?.querySelector(".club-rail-item.selected span")?.textContent?.trim().toUpperCase() || "";
}

function railItemForCode(root, code) {
  return [...(root?.querySelectorAll(".club-rail-item") || [])]
    .find(item => item.querySelector("span")?.textContent?.trim().toUpperCase() === code) || null;
}

function railCrestSource(root, code) {
  const image = railItemForCode(root, code)?.querySelector("img");
  return image?.currentSrc || image?.src || "";
}

function isLocalAsset(source) {
  return typeof source === "string" && source.startsWith("/assets/clubs/2026-27/");
}

function decodeLocalImage(source, priority = "auto") {
  if (!isLocalAsset(source)) return Promise.resolve(false);
  if (decoded.has(source)) return decoded.get(source);

  const pending = new Promise(resolve => {
    const image = new Image();
    image.decoding = "async";
    image.fetchPriority = priority;
    image.onload = async () => {
      try { await image.decode?.(); } catch { /* onload already guarantees paintability */ }
      resolve(image.naturalWidth > 0 && image.naturalHeight > 0);
    };
    image.onerror = () => resolve(false);
    image.src = source;
    if (image.complete) resolve(image.naturalWidth > 0 && image.naturalHeight > 0);
  });

  decoded.set(source, pending);
  return pending;
}

function useImage(image, source, { priority = "high", fallback = "" } = {}) {
  if (!(image instanceof HTMLImageElement) || !source) return false;
  if (image.dataset.localPackSource === source && image.src) return true;

  const current = image.currentSrc || image.src;
  image.dataset.localPackSource = source;
  image.dataset.localPackFailed = "false";
  if (fallback) image.dataset.localPackFallback = fallback;
  else if (current && current !== source && !isLocalAsset(current)) image.dataset.localPackFallback = current;

  image.decoding = "async";
  image.loading = "eager";
  image.fetchPriority = priority;
  image.style.removeProperty("display");
  image.style.removeProperty("visibility");
  image.style.removeProperty("opacity");
  image.removeAttribute("referrerpolicy");

  image.addEventListener("load", () => {
    image.dataset.localPackFailed = "false";
    image.classList.add("club-asset-loaded");
  }, { once: true });

  image.addEventListener("error", () => {
    const next = image.dataset.localPackFallback;
    if (!next || image.dataset.localPackFailed === "true" || image.src === next) return;
    image.dataset.localPackFailed = "true";
    image.src = next;
  }, { once: true });

  image.src = source;
  if (isLocalAsset(source)) decodeLocalImage(source, priority);
  return true;
}

function useLocalBackground(element, property, source) {
  if (!(element instanceof HTMLElement) || !isLocalAsset(source)) return false;
  element.style.setProperty(property, `url("${source}")`);
  decodeLocalImage(source, "high");
  return true;
}

function ensureMainCrest(root, details, code, localSource = "") {
  const panel = details?.querySelector(".club-badge-panel");
  if (!panel) return false;
  let image = panel.querySelector("img");
  if (!image) {
    image = document.createElement("img");
    image.alt = `Escudo do ${panel.querySelector("h2")?.textContent?.trim() || code}`;
    panel.prepend(image);
  }

  const railSource = railCrestSource(root, code);
  const source = localSource || railSource || image.currentSrc || image.src;
  if (!source) return false;
  useImage(image, source, { priority: "high", fallback: railSource });
  panel.classList.add("club-badge-ready");
  return true;
}

function installKit(slot, source, label) {
  if (!(slot instanceof HTMLElement) || !isLocalAsset(source)) return false;
  let image = slot.querySelector(".club-kit-image");
  const caption = slot.querySelector("small") || document.createElement("small");
  caption.textContent = label;

  if (!image) {
    image = document.createElement("img");
    image.className = "club-kit-image";
    image.alt = `Uniforme ${label.toLowerCase()} 2026/27`;
    slot.replaceChildren(image, caption);
  } else if (!caption.isConnected) {
    slot.append(caption);
  }

  useImage(image, source, { priority: "high" });
  slot.classList.add("has-kit-image", "has-local-kit");
  slot.classList.remove("has-procedural-kit", "club-kit-loading", "club-kit-missing");
  return true;
}

function applyRailPack(root, clubs) {
  root.querySelectorAll(".club-rail-item").forEach(item => {
    const code = item.querySelector("span")?.textContent?.trim().toUpperCase();
    if (!code) return;
    item.dataset.clubCode = code;
    const entry = clubs?.[code];
    if (entry?.crest) useImage(item.querySelector("img"), entry.crest, { priority: item.classList.contains("selected") ? "high" : "auto" });
  });
}

function applyDetailPack(root, clubs, code) {
  const details = root.querySelector("[data-club-details]");
  const entry = clubs?.[code];
  if (!details) return false;

  ensureMainCrest(root, details, code, entry?.crest || "");
  if (!entry) {
    details.dataset.localPackReady = "missing";
    return false;
  }

  const background = details.querySelector(".club-selection-background");
  const location = details.querySelector(".club-location-panel");
  const stadium = details.querySelector(".club-stadium-panel");
  let applied = 0;

  if (useLocalBackground(background, "--club-background", entry.backdrop || entry.stadium)) applied += 1;

  if (entry.city) {
    if (useLocalBackground(details, "--v5-location-image", entry.city)) applied += 1;
    if (useLocalBackground(location, "--stadium-image", entry.city)) applied += 1;
    location?.classList.add("club-city-photo-ready");
  }

  if (entry.stadium) {
    if (useLocalBackground(details, "--v5-stadium-image", entry.stadium)) applied += 1;
    if (useLocalBackground(stadium, "--stadium-image", entry.stadium)) applied += 1;
    stadium?.classList.add("club-stadium-photo-ready");
  }

  if (entry.crest && ensureMainCrest(root, details, code, entry.crest)) applied += 1;
  if (entry.manager) {
    const manager = details.querySelector(".club-manager-panel > img, .club-manager-image");
    if (useImage(manager, entry.manager, { priority: "high" })) applied += 1;
  }

  const slots = details.querySelectorAll(".club-kit-slot");
  if (slots[0] && entry.homeKit && installKit(slots[0], entry.homeKit, "CASA")) applied += 1;
  if (slots[1] && entry.awayKit && installKit(slots[1], entry.awayKit, "FORA")) applied += 1;

  const rivalCode = RIVALS[code];
  const rivalCrest = rivalCode ? clubs?.[rivalCode]?.crest : null;
  const rivalImage = details.querySelector(".club-rival-panel img");
  if (rivalCrest && rivalImage && useImage(rivalImage, rivalCrest, { priority: "auto" })) applied += 1;

  details.dataset.localPackReady = applied >= 8 ? "true" : "partial";
  details.dataset.localPackCode = code;
  details.dataset.cityAsset = entry.city || "";
  details.dataset.stadiumAsset = entry.stadium || "";
  details.dataset.homeKitAsset = entry.homeKit || "";
  details.dataset.awayKitAsset = entry.awayKit || "";
  return applied >= 6;
}

function neighboringCodes(code) {
  const index = CLUB_ORDER.indexOf(code);
  if (index < 0) return [];
  return [
    CLUB_ORDER[(index - 1 + CLUB_ORDER.length) % CLUB_ORDER.length],
    CLUB_ORDER[(index + 1) % CLUB_ORDER.length]
  ];
}

function assetsForEntry(entry, includeHeavy = true) {
  if (!entry) return [];
  return [
    entry.crest,
    includeHeavy ? entry.stadium : null,
    includeHeavy ? entry.city : null,
    includeHeavy ? entry.backdrop : null,
    includeHeavy ? entry.manager : null,
    includeHeavy ? entry.homeKit : null,
    includeHeavy ? entry.awayKit : null
  ].filter(isLocalAsset);
}

function warmSelection(clubs, code) {
  [code, ...neighboringCodes(code)].forEach((clubCode, index) => {
    assetsForEntry(clubs?.[clubCode], true).forEach(source => decodeLocalImage(source, index === 0 ? "high" : "auto"));
  });
}

function warmWholePackDuringIdle(clubs) {
  if (idleWarmStarted) return;
  idleWarmStarted = true;
  const queue = CLUB_ORDER.flatMap(code => assetsForEntry(clubs?.[code], true));
  let cursor = 0;

  const work = deadline => {
    while (cursor < queue.length && (!deadline || deadline.timeRemaining() > 3 || deadline.didTimeout)) {
      decodeLocalImage(queue[cursor++], "low");
      if (!deadline) break;
    }
    if (cursor >= queue.length) return;
    if ("requestIdleCallback" in window) window.requestIdleCallback(work, { timeout: 1200 });
    else window.setTimeout(() => work(null), 40);
  };

  if ("requestIdleCallback" in window) window.requestIdleCallback(work, { timeout: 900 });
  else window.setTimeout(() => work(null), 180);
}

async function applyLocalPack() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(async () => {
    const root = document.querySelector(".career-club-selection");
    if (!root) return;

    const code = selectedCode(root);
    const details = root.querySelector("[data-club-details]");
    ensureMainCrest(root, details, code);

    const manifest = await loadManifest();
    const clubs = manifest?.clubs;
    if (!clubs || !Object.keys(clubs).length || !root.isConnected) {
      root.dataset.localPack = "missing";
      if (missingManifestRetries < 3) {
        missingManifestRetries += 1;
        window.setTimeout(() => {
          loadManifest(true);
          applyLocalPack();
        }, 650 * missingManifestRetries);
      }
      return;
    }

    missingManifestRetries = 0;
    applyRailPack(root, clubs);
    const ready = applyDetailPack(root, clubs, code);
    warmSelection(clubs, code);
    warmWholePackDuringIdle(clubs);

    root.classList.add("onboarding-local-pack-ready");
    root.dataset.localPack = ready ? "ready" : "partial";
    root.dataset.localPackSeason = manifest.season || "2026/27";
    root.dataset.localPackPipeline = String(manifest.pipelineVersion || "");
  });
}

const observer = new MutationObserver(mutations => {
  const relevant = mutations.some(mutation => [...mutation.addedNodes].some(node => node instanceof Element && (
    node.matches?.(".career-club-selection, [data-club-details], .club-selection-grid, .club-badge-panel img")
    || node.querySelector?.(".career-club-selection, [data-club-details], .club-selection-grid, .club-badge-panel img")
  )));
  if (relevant) applyLocalPack();
});

observer.observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener("click", event => {
  if (event.target.closest("[data-club-index], [data-club-step]")) applyLocalPack();
}, true);
document.addEventListener("keydown", event => {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") applyLocalPack();
}, true);
window.addEventListener("hashchange", applyLocalPack);
document.addEventListener("DOMContentLoaded", applyLocalPack, { once: true });
applyLocalPack();

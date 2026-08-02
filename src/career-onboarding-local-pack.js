const MANIFEST_URL = "/assets/clubs/2026-27/manifest.json";
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
const decoded = new Map();

function loadManifest() {
  if (manifestPromise) return manifestPromise;
  manifestPromise = fetch(MANIFEST_URL, { cache: "force-cache" })
    .then(response => response.ok ? response.json() : null)
    .catch(() => null);
  return manifestPromise;
}

function selectedCode(root) {
  return root?.querySelector(".club-rail-item.selected span")?.textContent?.trim().toUpperCase() || "";
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

function useLocalImage(image, source, priority = "high") {
  if (!(image instanceof HTMLImageElement) || !isLocalAsset(source)) return false;
  if (image.dataset.localPackSource === source) return true;

  const fallback = image.currentSrc || image.src;
  image.dataset.localPackSource = source;
  if (fallback && fallback !== source && !isLocalAsset(fallback)) image.dataset.localPackFallback = fallback;
  image.decoding = "async";
  image.loading = "eager";
  image.fetchPriority = priority;
  image.removeAttribute("referrerpolicy");

  image.addEventListener("error", () => {
    const remoteFallback = image.dataset.localPackFallback;
    if (!remoteFallback || image.dataset.localPackFailed === "true") return;
    image.dataset.localPackFailed = "true";
    image.src = remoteFallback;
  }, { once: true });

  image.src = source;
  decodeLocalImage(source, priority);
  return true;
}

function useLocalBackground(element, property, source) {
  if (!(element instanceof HTMLElement) || !isLocalAsset(source)) return false;
  element.style.setProperty(property, `url("${source}")`);
  decodeLocalImage(source, "high");
  return true;
}

function installKit(slot, source, label) {
  if (!(slot instanceof HTMLElement) || !isLocalAsset(source)) return false;
  let image = slot.querySelector(".club-kit-image");
  if (!image) {
    image = document.createElement("img");
    image.className = "club-kit-image";
    image.alt = `Uniforme ${label.toLowerCase()} 2026/27`;
    image.decoding = "async";
    image.loading = "eager";
    const caption = slot.querySelector("small") || document.createElement("small");
    caption.textContent = label;
    slot.replaceChildren(image, caption);
  }
  useLocalImage(image, source, "high");
  slot.classList.add("has-kit-image", "has-local-kit");
  slot.classList.remove("has-procedural-kit");
  return true;
}

function applyRailPack(root, clubs) {
  root.querySelectorAll(".club-rail-item").forEach(item => {
    const code = item.querySelector("span")?.textContent?.trim().toUpperCase();
    if (!code) return;
    item.dataset.clubCode = code;
    const entry = clubs?.[code];
    if (entry?.crest) useLocalImage(item.querySelector("img"), entry.crest, "high");
  });
}

function applyDetailPack(root, clubs, code) {
  const details = root.querySelector("[data-club-details]");
  const entry = clubs?.[code];
  if (!details || !entry) return false;

  const background = details.querySelector(".club-selection-background");
  const backdrop = entry.backdrop || entry.stadium || entry.city;
  const stadiumAsset = entry.stadium || entry.backdrop || entry.city;
  const cityAsset = entry.city || entry.stadium || entry.backdrop;
  let applied = 0;

  if (useLocalBackground(background, "--club-background", backdrop)) applied += 1;
  if (useLocalBackground(details, "--v5-stadium-image", stadiumAsset)) applied += 1;
  if (useLocalBackground(details, "--v5-location-image", cityAsset)) applied += 1;

  const location = details.querySelector(".club-location-panel");
  const stadium = details.querySelector(".club-stadium-panel");
  if (useLocalBackground(location, "--stadium-image", cityAsset)) applied += 1;
  if (useLocalBackground(stadium, "--stadium-image", stadiumAsset)) applied += 1;

  if (entry.crest && useLocalImage(details.querySelector(".club-badge-panel img"), entry.crest, "high")) applied += 1;
  if (entry.manager && useLocalImage(details.querySelector(".club-manager-panel > img, .club-manager-image"), entry.manager, "high")) applied += 1;

  const slots = details.querySelectorAll(".club-kit-slot");
  if (slots[0] && entry.homeKit && installKit(slots[0], entry.homeKit, "CASA")) applied += 1;
  if (slots[1] && entry.awayKit && installKit(slots[1], entry.awayKit, "FORA")) applied += 1;

  const rivalCode = RIVALS[code];
  const rivalCrest = rivalCode ? clubs?.[rivalCode]?.crest : null;
  if (rivalCrest && useLocalImage(details.querySelector(".club-rival-panel img"), rivalCrest, "auto")) applied += 1;

  details.dataset.localPackReady = applied >= 6 ? "true" : "partial";
  details.dataset.localPackCode = code;
  return applied >= 4;
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
  const immediate = [code, ...neighboringCodes(code)];
  immediate.forEach((clubCode, index) => {
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

    const manifest = await loadManifest();
    const clubs = manifest?.clubs;
    if (!clubs || !Object.keys(clubs).length || !root.isConnected) {
      root.dataset.localPack = "missing";
      return;
    }

    applyRailPack(root, clubs);
    const code = selectedCode(root);
    const ready = applyDetailPack(root, clubs, code);
    warmSelection(clubs, code);
    warmWholePackDuringIdle(clubs);

    root.classList.add("onboarding-local-pack-ready");
    root.dataset.localPack = ready ? "ready" : "partial";
    root.dataset.localPackSeason = manifest.season || "2026/27";
  });
}

const observer = new MutationObserver(mutations => {
  const relevant = mutations.some(mutation => [...mutation.addedNodes].some(node => node instanceof Element && (
    node.matches?.(".career-club-selection, [data-club-details], .club-selection-grid")
    || node.querySelector?.(".career-club-selection, [data-club-details], .club-selection-grid")
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

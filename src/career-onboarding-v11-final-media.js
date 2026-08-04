import "./career-onboarding-v11-final-media.css";

const MANIFEST_URL = "/assets/clubs/2026-27/manifest.json?controller=11";

const CLUB_ORDER = Object.freeze([
  "ARS", "AVL", "BOU", "BRE", "BHA", "CHE", "COV", "CRY", "EVE", "FUL",
  "HUL", "IPS", "LEE", "LIV", "MCI", "MUN", "NEW", "NFO", "SUN", "TOT"
]);

const CREST_IDS = Object.freeze({
  ARS: 57, AVL: 58, BOU: 1044, BRE: 402, BHA: 397,
  CHE: 61, COV: 1076, CRY: 354, EVE: 62, FUL: 63,
  HUL: 322, IPS: 349, LEE: 341, LIV: 64, MCI: 65,
  MUN: 66, NEW: 67, NFO: 351, SUN: 71, TOT: 73
});

const RIVALS = Object.freeze({
  ARS: "TOT", AVL: null, BOU: null, BRE: "FUL", BHA: "CRY",
  CHE: "FUL", COV: null, CRY: "BHA", EVE: "LIV", FUL: "CHE",
  HUL: "LEE", IPS: null, LEE: "MUN", LIV: "EVE", MCI: "MUN",
  MUN: "LIV", NEW: "SUN", NFO: null, SUN: "NEW", TOT: "ARS"
});

let manifestPromise = null;
let scheduledFrame = 0;
let renderVersion = 0;
const checkedSources = new Map();

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

function canonicalCrest(code) {
  const id = CREST_IDS[code];
  return id ? `https://crests.football-data.org/${id}.png` : "";
}

function validateImage(source) {
  if (!source) return Promise.resolve(false);
  if (checkedSources.has(source)) return checkedSources.get(source);

  const pending = new Promise(resolve => {
    const probe = new Image();
    probe.decoding = "async";
    probe.onload = async () => {
      try { await probe.decode?.(); } catch { /* onload is sufficient */ }
      resolve(probe.naturalWidth > 0 && probe.naturalHeight > 0);
    };
    probe.onerror = () => resolve(false);
    probe.src = source;
    if (probe.complete) resolve(probe.naturalWidth > 0 && probe.naturalHeight > 0);
  });

  checkedSources.set(source, pending);
  return pending;
}

async function firstValid(sources) {
  for (const source of [...new Set(sources.filter(Boolean))]) {
    if (await validateImage(source)) return source;
  }
  return "";
}

function setReadyImage(image, source, alt = "") {
  if (!(image instanceof HTMLImageElement) || !source) return;
  image.alt = alt;
  image.decoding = "async";
  image.loading = "eager";
  image.removeAttribute("referrerpolicy");
  image.dataset.mediaReady = "false";
  image.onload = () => {
    if (!image.isConnected) return;
    image.dataset.mediaReady = "true";
  };
  image.onerror = () => {
    if (!image.isConnected) return;
    image.dataset.mediaReady = "false";
  };
  image.src = source;
  if (image.complete && image.naturalWidth > 0) image.onload();
}

async function repairRail(root, clubs, version) {
  const items = [...root.querySelectorAll(".club-rail-item")];

  await Promise.all(items.map(async item => {
    const code = item.querySelector("span")?.textContent?.trim().toUpperCase();
    const image = item.querySelector("img");
    if (!code || !(image instanceof HTMLImageElement)) return;

    const source = await firstValid([
      clubs?.[code]?.crest,
      image.currentSrc,
      image.src,
      canonicalCrest(code)
    ]);

    if (!source || version !== renderVersion || !image.isConnected) return;
    setReadyImage(image, source, `${code} crest`);
  }));
}

function ensureMainBadge(details, code) {
  const panel = details?.querySelector(".club-badge-panel");
  if (!panel) return null;
  let image = panel.querySelector(":scope > img");
  if (!image) {
    image = document.createElement("img");
    const title = panel.querySelector("h2");
    panel.insertBefore(image, title || panel.firstChild);
  }
  image.classList.add("club-badge-image-v11");
  image.fetchPriority = "high";
  return image;
}

async function repairMainBadge(root, details, code, entry, version) {
  const image = ensureMainBadge(details, code);
  if (!image) return;
  const rail = root.querySelector(".club-rail-item.selected img");
  const source = await firstValid([
    entry?.crest,
    rail?.currentSrc,
    rail?.src,
    canonicalCrest(code)
  ]);
  if (!source || version !== renderVersion || !image.isConnected || selectedCode(root) !== code) return;
  setReadyImage(image, source, `Escudo do ${details.querySelector(".club-badge-panel h2")?.textContent?.trim() || code}`);
}

function managerName(panel) {
  return panel?.querySelector(":scope > div:last-child strong, .club-manager-copy-v5 strong")?.textContent?.trim() || "Técnico";
}

function ensureManagerPlaceholder(panel, name) {
  panel.querySelectorAll(":scope > img").forEach(image => image.remove());
  let placeholder = panel.querySelector(":scope > .club-manager-placeholder");
  if (!placeholder) {
    placeholder = document.createElement("div");
    placeholder.className = "club-manager-placeholder";
    const copy = panel.querySelector(":scope > div:last-child, .club-manager-copy-v5");
    panel.insertBefore(placeholder, copy || panel.firstChild);
  }
  placeholder.replaceChildren();
  const initials = document.createElement("span");
  initials.textContent = /anunciar|a definir|sem técnico/i.test(name)
    ? "?"
    : name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  placeholder.append(initials);
  return placeholder;
}

async function repairManager(root, details, code, entry, version) {
  const panel = details?.querySelector(".club-manager-panel");
  if (!panel) return;

  const name = managerName(panel);
  const placeholder = ensureManagerPlaceholder(panel, name);
  const source = await firstValid([entry?.manager]);
  if (!source || version !== renderVersion || !panel.isConnected || selectedCode(root) !== code) return;

  const image = document.createElement("img");
  image.className = "club-manager-image club-manager-image-v11";
  image.fetchPriority = "high";
  image.alt = name;
  image.dataset.mediaReady = "false";
  image.onload = () => {
    if (!image.isConnected || selectedCode(root) !== code) return;
    image.dataset.mediaReady = "true";
    placeholder.remove();
    panel.dataset.managerMedia = "ready";
  };
  image.onerror = () => {
    image.remove();
    panel.dataset.managerMedia = "missing";
  };
  panel.insertBefore(image, placeholder);
  image.src = source;
  if (image.complete && image.naturalWidth > 0) image.onload();
}

async function repairBackground(element, property, candidates, version, code, root) {
  if (!(element instanceof HTMLElement)) return;
  const source = await firstValid(candidates);
  if (!source || version !== renderVersion || !element.isConnected || selectedCode(root) !== code) return;
  element.style.setProperty(property, `url("${source}")`);
}

function ensureRivalImage(panel) {
  if (!panel) return null;
  panel.querySelectorAll(":scope > img").forEach((image, index) => {
    if (index > 0) image.remove();
  });
  let image = panel.querySelector(":scope > img");
  if (!image) {
    image = document.createElement("img");
    const name = panel.querySelector("strong");
    panel.insertBefore(image, name || null);
  }
  image.classList.add("club-rival-image-v11");
  return image;
}

async function repairRival(root, details, code, entry, clubs, version) {
  const panel = details?.querySelector(".club-rival-panel");
  if (!panel) return;
  const image = ensureRivalImage(panel);
  const rivalCode = RIVALS[code];
  const source = await firstValid([
    entry?.rivalCrest,
    rivalCode ? clubs?.[rivalCode]?.crest : "",
    rivalCode ? canonicalCrest(rivalCode) : ""
  ]);
  if (!source || version !== renderVersion || !image?.isConnected || selectedCode(root) !== code) {
    image?.remove();
    return;
  }
  setReadyImage(image, source, `${panel.querySelector("strong")?.textContent?.trim() || "Rival"} crest`);
}

async function repairKits(details, entry, version, code, root) {
  const slots = details?.querySelectorAll(".club-kit-slot") || [];
  const sources = [entry?.homeKit, entry?.awayKit];
  const labels = ["CASA", "FORA"];

  await Promise.all([...slots].slice(0, 2).map(async (slot, index) => {
    const source = await firstValid([sources[index]]);
    if (!source || version !== renderVersion || !slot.isConnected || selectedCode(root) !== code) return;
    let image = slot.querySelector(".club-kit-image");
    if (!image) {
      image = document.createElement("img");
      image.className = "club-kit-image";
      const caption = slot.querySelector("small") || document.createElement("small");
      caption.textContent = labels[index];
      slot.replaceChildren(image, caption);
    }
    setReadyImage(image, source, `Uniforme ${labels[index].toLowerCase()} 2026/27`);
    slot.classList.add("has-kit-image", "has-local-kit");
    slot.classList.remove("club-kit-missing", "club-kit-loading", "has-procedural-kit");
  }));
}

async function renderCurrentClub({ refresh = false } = {}) {
  const root = document.querySelector(".career-club-selection");
  const details = root?.querySelector("[data-club-details]");
  const code = selectedCode(root);
  if (!root || !details || !CLUB_ORDER.includes(code)) return;

  const version = ++renderVersion;
  const manifest = await loadManifest(refresh);
  if (version !== renderVersion || !root.isConnected || selectedCode(root) !== code) return;

  const clubs = manifest?.clubs || {};
  const entry = clubs[code] || {};
  const location = details.querySelector(".club-location-panel");
  const stadium = details.querySelector(".club-stadium-panel");
  const background = details.querySelector(".club-selection-background");

  await Promise.all([
    repairRail(root, clubs, version),
    repairMainBadge(root, details, code, entry, version),
    repairManager(root, details, code, entry, version),
    repairRival(root, details, code, entry, clubs, version),
    repairKits(details, entry, version, code, root),
    repairBackground(details, "--v5-location-image", [entry.city], version, code, root),
    repairBackground(location, "--stadium-image", [entry.city], version, code, root),
    repairBackground(details, "--v5-stadium-image", [entry.stadium], version, code, root),
    repairBackground(stadium, "--stadium-image", [entry.stadium], version, code, root),
    repairBackground(background, "--club-background", [entry.backdrop, entry.stadium], version, code, root)
  ]);

  if (version === renderVersion && root.isConnected && selectedCode(root) === code) {
    root.dataset.finalMediaController = "ready";
    root.dataset.finalMediaClub = code;
  }
}

function scheduleRender() {
  cancelAnimationFrame(scheduledFrame);
  scheduledFrame = requestAnimationFrame(() => requestAnimationFrame(() => renderCurrentClub()));
  window.clearTimeout(scheduleRender.retryOne);
  window.clearTimeout(scheduleRender.retryTwo);
  scheduleRender.retryOne = window.setTimeout(() => renderCurrentClub(), 180);
  scheduleRender.retryTwo = window.setTimeout(() => renderCurrentClub({ refresh: true }), 800);
}

const observer = new MutationObserver(mutations => {
  const relevant = mutations.some(mutation => {
    if (mutation.type === "attributes") {
      return mutation.target instanceof Element && mutation.target.matches(".club-rail-item, [data-club-details]");
    }
    return [...mutation.addedNodes].some(node => node instanceof Element && (
      node.matches?.(".career-club-selection, [data-club-details], .club-manager-panel, .club-rival-panel")
      || node.querySelector?.(".career-club-selection, [data-club-details], .club-manager-panel, .club-rival-panel")
    ));
  });
  if (relevant) scheduleRender();
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["class", "data-club-details"]
});

document.addEventListener("click", event => {
  if (event.target.closest("[data-club-index], [data-club-step]")) scheduleRender();
}, true);
document.addEventListener("keydown", event => {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") scheduleRender();
}, true);
window.addEventListener("hashchange", scheduleRender);
document.addEventListener("DOMContentLoaded", scheduleRender, { once: true });
scheduleRender();

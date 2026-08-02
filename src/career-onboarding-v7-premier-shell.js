import "./career-onboarding-v7-premier-shell.css";

const MANIFEST_URL = "/assets/clubs/2026-27/manifest.json";
const RIVALS = Object.freeze({
  ARS: "TOT", AVL: null, BOU: null, BRE: "FUL", BHA: "CRY",
  CHE: "FUL", COV: null, CRY: "BHA", EVE: "LIV", FUL: "CHE",
  HUL: "LEE", IPS: null, LEE: "MUN", LIV: "EVE", MCI: "MUN",
  MUN: "LIV", NEW: "SUN", NFO: null, SUN: "NEW", TOT: "ARS"
});

const decodedAssets = new Map();
let manifestPromise = null;
let queuedFrame = 0;
let observer = null;

function localAsset(value) {
  const source = String(value || "").trim();
  if (!source) return null;
  if (source.startsWith("/assets/")) return source;
  try {
    const url = new URL(source, window.location.origin);
    return url.origin === window.location.origin && url.pathname.startsWith("/assets/")
      ? `${url.pathname}${url.search}`
      : null;
  } catch {
    return null;
  }
}

async function loadManifest() {
  if (manifestPromise) return manifestPromise;
  manifestPromise = fetch(MANIFEST_URL, { cache: "force-cache" })
    .then(response => {
      if (!response.ok) throw new Error(`Local club pack unavailable: ${response.status}`);
      return response.json();
    })
    .then(payload => {
      const clubs = payload?.clubs && typeof payload.clubs === "object" ? payload.clubs : {};
      const manifest = { ...payload, clubs };
      window.__touchlineOnboardingAssetPack = manifest;
      return manifest;
    })
    .catch(() => ({ season: "2026/27", clubs: {} }));
  return manifestPromise;
}

function currentCode() {
  return document.querySelector(".club-rail-item.selected span")?.textContent?.trim().toUpperCase() || "";
}

function warmImage(source, priority = "auto") {
  const url = localAsset(source);
  if (!url) return Promise.resolve(false);
  if (decodedAssets.has(url)) return decodedAssets.get(url);

  const pending = new Promise(resolve => {
    const image = new Image();
    image.decoding = "async";
    image.fetchPriority = priority;
    image.onload = async () => {
      try { await image.decode?.(); } catch { /* onload is enough for paint */ }
      resolve(image.naturalWidth > 0 && image.naturalHeight > 0);
    };
    image.onerror = () => resolve(false);
    image.src = url;
    if (image.complete) resolve(image.naturalWidth > 0 && image.naturalHeight > 0);
  });

  decodedAssets.set(url, pending);
  return pending;
}

function setImage(image, source, { priority = "high", alt } = {}) {
  const url = localAsset(source);
  if (!(image instanceof HTMLImageElement) || !url) return false;
  if (image.getAttribute("src") !== url) image.src = url;
  image.decoding = "async";
  image.loading = "eager";
  image.fetchPriority = priority;
  image.removeAttribute("referrerpolicy");
  if (typeof alt === "string") image.alt = alt;
  image.dataset.localPackAsset = "true";
  warmImage(url, priority);
  return true;
}

function setBackground(element, property, source) {
  const url = localAsset(source);
  if (!(element instanceof HTMLElement) || !url) return false;
  element.style.setProperty(property, `url("${url.replaceAll('"', "%22")}")`);
  warmImage(url, "high");
  return true;
}

function installKit(slot, source, label) {
  const url = localAsset(source);
  if (!(slot instanceof HTMLElement) || !url) return false;

  let image = slot.querySelector(".club-kit-image");
  if (!image) {
    image = document.createElement("img");
    image.className = "club-kit-image";
    slot.replaceChildren(image);
    const caption = document.createElement("small");
    caption.textContent = label;
    slot.append(caption);
  }

  return setImage(image, url, {
    priority: "high",
    alt: `Uniforme ${label.toLowerCase()} 2026/27`
  });
}

function applyRail(manifest) {
  const entries = manifest.clubs || {};
  const items = [...document.querySelectorAll(".club-rail-item")];

  items.forEach(item => {
    const code = item.querySelector("span")?.textContent?.trim().toUpperCase();
    if (!code) return;
    item.dataset.clubCode = code;
    const entry = entries[code];
    if (entry?.crest) setImage(item.querySelector("img"), entry.crest, { priority: "high", alt: "" });
  });

  Promise.all(items
    .map(item => entries[item.dataset.clubCode]?.crest)
    .filter(Boolean)
    .map(source => warmImage(source, "high")));
}

function applyDetails(manifest) {
  const root = document.querySelector(".career-club-selection");
  const details = document.querySelector("[data-club-details]");
  const code = currentCode();
  if (!(root instanceof HTMLElement) || !(details instanceof HTMLElement) || !code) return;

  root.classList.add("onboarding-premier-shell-v7");
  root.dataset.selectedClub = code;
  details.dataset.clubCodeV7 = code;

  const entry = manifest.clubs?.[code];
  if (!entry) {
    root.dataset.localPack = "missing";
    return;
  }

  const backdrop = entry.backdrop || entry.stadium || entry.city;
  const stadium = entry.stadium || entry.backdrop || entry.city;
  const city = entry.city || entry.stadium || entry.backdrop;
  let applied = 0;

  const background = details.querySelector(".club-selection-background");
  if (setBackground(background, "--club-background", backdrop)) applied += 1;
  if (setBackground(details, "--v7-stadium-image", stadium)) applied += 1;
  if (setBackground(details, "--v7-city-image", city)) applied += 1;
  if (setBackground(details, "--v5-stadium-image", stadium)) applied += 1;
  if (setBackground(details, "--v5-location-image", city)) applied += 1;

  if (setImage(details.querySelector(".club-badge-panel img"), entry.crest, {
    priority: "high",
    alt: `Escudo do ${entry.name || code}`
  })) applied += 1;

  if (setImage(details.querySelector(".club-manager-image, .club-manager-panel img"), entry.manager, {
    priority: "high"
  })) applied += 1;

  const kitSlots = details.querySelectorAll(".club-kit-slot");
  if (installKit(kitSlots[0], entry.homeKit, "CASA")) applied += 1;
  if (installKit(kitSlots[1], entry.awayKit, "FORA")) applied += 1;

  const rivalCode = RIVALS[code];
  const rivalEntry = rivalCode ? manifest.clubs?.[rivalCode] : null;
  if (setImage(details.querySelector(".club-rival-panel img"), rivalEntry?.crest, {
    priority: "auto",
    alt: ""
  })) applied += 1;

  root.dataset.localPack = applied >= 4 ? "ready" : "partial";

  const selectedAssets = [
    entry.crest,
    entry.stadium,
    entry.city,
    entry.backdrop,
    entry.manager,
    entry.homeKit,
    entry.awayKit,
    rivalEntry?.crest
  ].filter(Boolean);
  Promise.all(selectedAssets.map(source => warmImage(source, "high")));
}

async function refresh() {
  const root = document.querySelector(".career-club-selection");
  if (!(root instanceof HTMLElement)) return;
  document.documentElement.classList.add("touchline-premier-shell-v7");
  root.classList.add("onboarding-fit-v4", "onboarding-premier-shell-v7");
  const manifest = await loadManifest();
  if (!document.querySelector(".career-club-selection")) return;
  applyRail(manifest);
  applyDetails(manifest);
}

function queueRefresh() {
  cancelAnimationFrame(queuedFrame);
  queuedFrame = requestAnimationFrame(refresh);
}

function installObserver() {
  if (observer) return;
  observer = new MutationObserver(mutations => {
    const relevant = mutations.some(mutation => {
      if (mutation.type === "attributes") {
        return mutation.target instanceof Element
          && mutation.target.matches(".club-rail-item, .career-club-selection");
      }
      return [...mutation.addedNodes].some(node => node instanceof Element && (
        node.matches?.(".career-club-selection, [data-club-details], .club-rail-item")
        || node.querySelector?.(".career-club-selection, [data-club-details], .club-rail-item")
      ));
    });
    if (relevant) queueRefresh();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"]
  });
}

document.addEventListener("click", event => {
  if (event.target.closest("[data-club-index], [data-club-step]")) queueRefresh();
}, true);

document.addEventListener("keydown", event => {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") queueRefresh();
}, true);

window.addEventListener("hashchange", queueRefresh);
document.addEventListener("DOMContentLoaded", () => {
  installObserver();
  queueRefresh();
}, { once: true });

installObserver();
queueRefresh();

import "./career-onboarding-v13-deterministic.css";

const MANIFEST_URL = "/assets/clubs/2026-27/manifest.json?controller=13";
const CLUBS = Object.freeze([
  "ARS", "AVL", "BOU", "BRE", "BHA", "CHE", "COV", "CRY", "EVE", "FUL",
  "HUL", "IPS", "LEE", "LIV", "MCI", "MUN", "NEW", "NFO", "SUN", "TOT"
]);

let manifestPromise = null;
let renderFrame = 0;
let renderVersion = 0;
let retryOne = 0;
let retryTwo = 0;

function selectedCode(root) {
  return root?.querySelector(".club-rail-item.selected span")?.textContent?.trim().toUpperCase() || "";
}

function loadManifest(refresh = false) {
  if (refresh) manifestPromise = null;
  if (manifestPromise) return manifestPromise;
  manifestPromise = fetch(MANIFEST_URL, { cache: "no-store" })
    .then(response => {
      if (!response.ok) throw new Error(`manifest HTTP ${response.status}`);
      return response.json();
    })
    .then(manifest => {
      if (!manifest?.clubs || Object.keys(manifest.clubs).length !== CLUBS.length) {
        throw new Error("offline onboarding manifest is incomplete");
      }
      return manifest;
    });
  return manifestPromise;
}

function isLocalAsset(source) {
  if (!source) return false;
  try {
    const url = new URL(source, window.location.href);
    return url.origin === window.location.origin && url.pathname.startsWith("/assets/clubs/2026-27/");
  } catch {
    return false;
  }
}

function prepareImage(image, source, alt, priority = "auto") {
  if (!(image instanceof HTMLImageElement) || !isLocalAsset(source)) return false;
  image.alt = alt;
  image.decoding = "async";
  image.loading = "eager";
  image.fetchPriority = priority;
  image.removeAttribute("referrerpolicy");
  image.dataset.mediaReady = "false";

  image.onload = () => {
    if (!image.isConnected) return;
    image.dataset.mediaReady = image.naturalWidth > 0 && image.naturalHeight > 0 ? "true" : "false";
  };
  image.onerror = () => {
    if (!image.isConnected) return;
    image.dataset.mediaReady = "false";
  };

  const absolute = new URL(source, window.location.href).href;
  if (image.src !== absolute) image.src = source;
  if (image.complete && image.naturalWidth > 0) image.onload();
  return true;
}

function ensureDirectImage(panel, className, before) {
  if (!(panel instanceof HTMLElement)) return null;
  let image = panel.querySelector(`:scope > img.${className}`);
  if (!image) {
    panel.querySelectorAll(":scope > img").forEach(item => item.remove());
    image = document.createElement("img");
    image.className = className;
    const anchor = typeof before === "string" ? panel.querySelector(before) : before;
    panel.insertBefore(image, anchor || panel.firstChild);
  }
  return image;
}

function paintRail(root, manifest) {
  root.querySelectorAll(".club-rail-item").forEach(item => {
    const code = item.querySelector("span")?.textContent?.trim().toUpperCase();
    const image = item.querySelector("img");
    const entry = manifest.clubs[code];
    if (!code || !entry || !(image instanceof HTMLImageElement)) return;
    prepareImage(image, entry.crest, `${entry.name || code} crest`, item.classList.contains("selected") ? "high" : "auto");
  });
}

function paintBadge(details, entry) {
  const panel = details.querySelector(".club-badge-panel");
  const title = panel?.querySelector("h2");
  const image = ensureDirectImage(panel, "club-badge-image-v13", title);
  if (!image) return;
  prepareImage(image, entry.crest, `Escudo do ${title?.textContent?.trim() || entry.name}`, "high");
}

function paintManager(details, entry) {
  const panel = details.querySelector(".club-manager-panel");
  if (!panel) return;

  panel.querySelectorAll(":scope > .club-manager-placeholder, :scope > img").forEach(node => node.remove());
  const copy = panel.querySelector(":scope > div:last-child, .club-manager-copy-v5");

  let media = panel.querySelector(":scope > .club-manager-photo-v13");
  if (!media) {
    media = document.createElement("div");
    media.className = "club-manager-photo-v13";
    panel.insertBefore(media, copy || panel.firstChild);
  }

  let image = media.querySelector(":scope > img.club-manager-image-v13");
  if (!image) {
    media.replaceChildren();
    image = document.createElement("img");
    image.className = "club-manager-image-v13 club-manager-image";
    media.append(image);
  }

  prepareImage(image, entry.manager, entry.managerName || "Técnico", "high");
}

function setBackground(element, property, source) {
  if (!(element instanceof HTMLElement) || !isLocalAsset(source)) return;
  element.style.setProperty(property, `url("${source}")`);
}

function paintLocationAndStadium(details, entry) {
  const location = details.querySelector(".club-location-panel");
  const stadium = details.querySelector(".club-stadium-panel");
  const background = details.querySelector(".club-selection-background");

  setBackground(details, "--v5-location-image", entry.city);
  setBackground(location, "--stadium-image", entry.city);
  setBackground(details, "--v5-stadium-image", entry.stadium);
  setBackground(stadium, "--stadium-image", entry.stadium);
  setBackground(background, "--club-background", entry.backdrop || entry.stadium);
}

function paintTrophy(details) {
  const panel = details.querySelector(".club-titles-panel");
  if (!panel) return;
  panel.querySelectorAll(":scope > .club-trophy-media-v5, :scope > .club-trophy-v13").forEach(node => node.remove());
  const media = document.createElement("div");
  media.className = "club-trophy-v13";
  media.setAttribute("aria-hidden", "true");
  media.innerHTML = `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="cup-v13" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff"/><stop offset=".52" stop-color="#aeb8c2"/><stop offset="1" stop-color="#68737e"/></linearGradient></defs>
    <path d="M22 8h20v9c0 10-4 17-10 20-6-3-10-10-10-20V8Z" fill="url(#cup-v13)" stroke="#e6edf3" stroke-width="1.5"/>
    <path d="M22 13H13v5c0 8 4 13 12 14M42 13h9v5c0 8-4 13-12 14" fill="none" stroke="#cdd5dd" stroke-width="4" stroke-linecap="round"/>
    <path d="M29 37h6v10h-6zM21 48h22v7H21z" fill="url(#cup-v13)"/>
    <path d="M25 8V4h14v4" fill="none" stroke="#f0c62d" stroke-width="3"/>
  </svg>`;
  const label = panel.querySelector(".club-data-label");
  panel.insertBefore(media, label || panel.firstChild);
}

function paintKits(details, entry) {
  const sources = [entry.homeKit, entry.awayKit];
  const labels = ["CASA", "FORA"];
  [...details.querySelectorAll(".club-kit-slot")].slice(0, 2).forEach((slot, index) => {
    const image = document.createElement("img");
    image.className = "club-kit-image club-kit-image-v13";
    const caption = document.createElement("small");
    caption.textContent = labels[index];
    slot.replaceChildren(image, caption);
    slot.classList.add("has-kit-image", "has-local-kit");
    slot.classList.remove("club-kit-missing", "club-kit-loading", "has-procedural-kit");
    prepareImage(image, sources[index], `Uniforme ${labels[index].toLowerCase()} 2026/27`, "high");
  });
}

function paintRival(details, entry) {
  const panel = details.querySelector(".club-rival-panel");
  if (!panel) return;
  panel.querySelectorAll(":scope > img").forEach(image => image.remove());
  panel.querySelectorAll(":scope > .club-rival-symbol").forEach(symbol => symbol.remove());
  const name = panel.querySelector("strong");
  const image = document.createElement("img");
  image.className = "club-rival-image-v13";
  panel.insertBefore(image, name || null);
  prepareImage(image, entry.rivalCrest, `${entry.rivalName || name?.textContent?.trim() || "Rival"} crest`, "high");
}

function removeFooter(root) {
  root.querySelectorAll(":scope > .club-selection-controls").forEach(footer => footer.remove());
}

function prewarm(entry) {
  [entry.crest, entry.city, entry.stadium, entry.manager, entry.homeKit, entry.awayKit, entry.rivalCrest]
    .filter(isLocalAsset)
    .forEach(source => {
      const image = new Image();
      image.decoding = "async";
      image.src = source;
    });
}

async function renderCurrent({ refresh = false } = {}) {
  const root = document.querySelector(".career-club-selection");
  const details = root?.querySelector("[data-club-details]");
  const code = selectedCode(root);
  if (!root || !details || !CLUBS.includes(code)) return;

  root.classList.add("onboarding-deterministic-v13");
  removeFooter(root);
  const version = ++renderVersion;

  let manifest;
  try {
    manifest = await loadManifest(refresh);
  } catch (error) {
    root.dataset.finalMediaController = "error";
    root.dataset.finalMediaError = error.message;
    return;
  }

  if (version !== renderVersion || !root.isConnected || selectedCode(root) !== code) return;
  const entry = manifest.clubs[code];
  if (!entry) return;

  paintRail(root, manifest);
  paintBadge(details, entry);
  paintManager(details, entry);
  paintLocationAndStadium(details, entry);
  paintTrophy(details);
  paintKits(details, entry);
  paintRival(details, entry);
  prewarm(entry);

  root.dataset.finalMediaController = "ready";
  root.dataset.finalMediaClub = code;
  root.dataset.runtimeNetworkRequired = "false";
}

function scheduleRender() {
  cancelAnimationFrame(renderFrame);
  window.clearTimeout(retryOne);
  window.clearTimeout(retryTwo);
  renderFrame = requestAnimationFrame(() => requestAnimationFrame(() => renderCurrent()));
  retryOne = window.setTimeout(() => renderCurrent(), 120);
  retryTwo = window.setTimeout(() => renderCurrent({ refresh: true }), 420);
}

const observer = new MutationObserver(mutations => {
  const relevant = mutations.some(mutation => {
    if (mutation.type === "attributes") {
      return mutation.target instanceof Element && mutation.target.matches(".club-rail-item, [data-club-details]");
    }
    return [...mutation.addedNodes].some(node => node instanceof Element && (
      node.matches?.(".career-club-selection, [data-club-details], .club-selection-grid, .club-manager-panel")
      || node.querySelector?.(".career-club-selection, [data-club-details], .club-selection-grid, .club-manager-panel")
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

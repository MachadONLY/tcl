import "./career-onboarding-v8-assets-fix.css";

const MANIFEST_URL = "/assets/clubs/2026-27/manifest.json?assets-fix=8";

let manifestPromise = null;
let scheduledFrame = 0;
let renderToken = 0;
const testedSources = new Map();

function loadManifest() {
  if (manifestPromise) return manifestPromise;
  manifestPromise = fetch(MANIFEST_URL, { cache: "no-store" })
    .then(response => response.ok ? response.json() : null)
    .catch(() => null);
  return manifestPromise;
}

function selectedCode(root) {
  return root?.querySelector(".club-rail-item.selected span")?.textContent?.trim().toUpperCase() || "";
}

function selectedRailImage(root) {
  return root?.querySelector(".club-rail-item.selected img") || null;
}

function managerName(panel) {
  return panel?.querySelector(":scope > div:last-child strong, .club-manager-copy-v5 strong")?.textContent?.trim() || "Técnico";
}

function managerInitials(name) {
  return String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "?";
}

function sourceIsUsable(source) {
  if (!source) return Promise.resolve(false);
  if (testedSources.has(source)) return testedSources.get(source);

  const pending = new Promise(resolve => {
    const probe = new Image();
    probe.decoding = "async";
    probe.onload = async () => {
      try { await probe.decode?.(); } catch { /* onload is enough */ }
      resolve(probe.naturalWidth > 0 && probe.naturalHeight > 0);
    };
    probe.onerror = () => resolve(false);
    probe.src = source;
    if (probe.complete) resolve(probe.naturalWidth > 0 && probe.naturalHeight > 0);
  });

  testedSources.set(source, pending);
  return pending;
}

async function firstUsableSource(sources) {
  for (const source of [...new Set(sources.filter(Boolean))]) {
    if (await sourceIsUsable(source)) return source;
  }
  return "";
}

function ensureBadgeImage(details, code) {
  const panel = details?.querySelector(".club-badge-panel");
  if (!panel) return null;

  let image = panel.querySelector(":scope > img");
  if (!image) {
    image = document.createElement("img");
    const title = panel.querySelector("h2");
    image.alt = `Escudo do ${title?.textContent?.trim() || code}`;
    panel.insertBefore(image, title || panel.firstChild);
  }

  image.classList.add("club-badge-image-v8");
  image.decoding = "async";
  image.loading = "eager";
  image.fetchPriority = "high";
  image.removeAttribute("referrerpolicy");
  return image;
}

async function repairBadge(root, details, code, entry, token) {
  const panel = details?.querySelector(".club-badge-panel");
  const image = ensureBadgeImage(details, code);
  if (!panel || !image) return;

  const rail = selectedRailImage(root);
  const source = await firstUsableSource([
    entry?.crest,
    rail?.currentSrc,
    rail?.src,
    image.currentSrc,
    image.src
  ]);

  if (!source || token !== renderToken || !image.isConnected) return;
  if (image.src !== source) image.src = source;
  panel.classList.add("club-badge-ready-v8");

  if (rail && !rail.dataset.v8BadgeListener) {
    rail.dataset.v8BadgeListener = "true";
    rail.addEventListener("load", scheduleRepair);
  }
}

function ensureManagerImage(panel) {
  if (!panel) return null;

  let image = panel.querySelector(":scope > img.club-manager-image-v8, :scope > img.club-manager-image, :scope > img");
  if (!image) {
    image = document.createElement("img");
    const placeholder = panel.querySelector(":scope > .club-manager-placeholder");
    const copy = panel.querySelector(":scope > div:last-child, .club-manager-copy-v5");
    if (placeholder) placeholder.replaceWith(image);
    else panel.insertBefore(image, copy || panel.firstChild);
  }

  image.classList.add("club-manager-image", "club-manager-image-v8");
  image.alt = managerName(panel);
  image.decoding = "async";
  image.loading = "eager";
  image.fetchPriority = "high";
  image.removeAttribute("referrerpolicy");
  return image;
}

function restoreManagerPlaceholder(panel, name) {
  panel.querySelector(":scope > img.club-manager-image-v8")?.remove();
  if (panel.querySelector(":scope > .club-manager-placeholder")) return;

  const placeholder = document.createElement("div");
  placeholder.className = "club-manager-placeholder";
  const initials = document.createElement("span");
  initials.textContent = managerInitials(name);
  placeholder.append(initials);
  const copy = panel.querySelector(":scope > div:last-child, .club-manager-copy-v5");
  panel.insertBefore(placeholder, copy || panel.firstChild);
}

async function repairManager(details, entry, token) {
  const panel = details?.querySelector(".club-manager-panel");
  if (!panel) return;

  const name = managerName(panel);
  const image = ensureManagerImage(panel);
  if (!image) return;

  panel.classList.add("manager-photo-loading-v8");
  panel.classList.remove("manager-photo-ready-v8", "manager-photo-failed-v8");

  const source = await firstUsableSource([
    entry?.manager,
    entry?.sources?.manager,
    image.dataset.v8PreviousSource,
    image.currentSrc,
    image.src
  ]);

  if (token !== renderToken || !panel.isConnected || !image.isConnected) return;

  if (!source) {
    restoreManagerPlaceholder(panel, name);
    panel.classList.remove("manager-photo-loading-v8", "manager-photo-ready-v8");
    panel.classList.add("manager-photo-failed-v8");
    return;
  }

  image.dataset.v8PreviousSource = source;
  image.onload = () => {
    if (!image.isConnected) return;
    panel.classList.remove("manager-photo-loading-v8", "manager-photo-failed-v8");
    panel.classList.add("manager-photo-ready-v8");
  };
  image.onerror = () => {
    restoreManagerPlaceholder(panel, name);
    panel.classList.remove("manager-photo-loading-v8", "manager-photo-ready-v8");
    panel.classList.add("manager-photo-failed-v8");
  };

  if (image.src !== source) image.src = source;
  else if (image.complete && image.naturalWidth > 0) image.onload();
}

async function repairCurrentClub() {
  const root = document.querySelector(".career-club-selection");
  const details = root?.querySelector("[data-club-details]");
  const code = selectedCode(root);
  if (!root || !details || !code) return;

  const token = ++renderToken;
  const manifest = await loadManifest();
  if (token !== renderToken || !details.isConnected) return;

  const entry = manifest?.clubs?.[code] || null;
  await Promise.all([
    repairBadge(root, details, code, entry, token),
    repairManager(details, entry, token)
  ]);

  if (token === renderToken && details.isConnected) {
    details.dataset.assetsFixV8 = "ready";
  }
}

function scheduleRepair() {
  cancelAnimationFrame(scheduledFrame);
  scheduledFrame = requestAnimationFrame(() => {
    requestAnimationFrame(repairCurrentClub);
  });
}

const observer = new MutationObserver(mutations => {
  const relevant = mutations.some(mutation => {
    if (mutation.type === "attributes") {
      return mutation.target instanceof Element && mutation.target.matches(".club-rail-item, .club-rail-item img");
    }
    return [...mutation.addedNodes].some(node => node instanceof Element && (
      node.matches?.(".career-club-selection, [data-club-details], .club-badge-panel, .club-manager-panel")
      || node.querySelector?.(".career-club-selection, [data-club-details], .club-badge-panel, .club-manager-panel")
    ));
  });
  if (relevant) scheduleRepair();
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["class", "src"]
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

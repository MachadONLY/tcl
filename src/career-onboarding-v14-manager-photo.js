import "./career-onboarding-v14-manager-photo.css";

const PORTRAIT_VERSION = "3";

const MANAGERS = Object.freeze({
  ARS: { name: "Mikel Arteta", page: "Mikel_Arteta" },
  AVL: { name: "Unai Emery", page: "Unai_Emery" },
  BOU: { name: "Marco Rose", page: "Marco_Rose" },
  BRE: { name: "Keith Andrews", page: "Keith_Andrews_(footballer)" },
  BHA: { name: "Fabian Hürzeler", page: "Fabian_Hürzeler" },
  CHE: { name: "Xabi Alonso", page: "Xabi_Alonso" },
  COV: { name: "Frank Lampard", page: "Frank_Lampard" },
  CRY: { name: "Pierre Sage", page: "Pierre_Sage" },
  EVE: { name: "David Moyes", page: "David_Moyes" },
  FUL: { name: "Álvaro Arbeloa", page: "Álvaro_Arbeloa" },
  HUL: { name: "Sergej Jakirović", page: "Sergej_Jakirović" },
  IPS: { name: "Gary O’Neil", page: "Gary_O'Neil" },
  LEE: { name: "Daniel Farke", page: "Daniel_Farke" },
  LIV: { name: "Andoni Iraola", page: "Andoni_Iraola" },
  MCI: { name: "Enzo Maresca", page: "Enzo_Maresca" },
  MUN: { name: "Michael Carrick", page: "Michael_Carrick" },
  NEW: { name: "Eddie Howe", page: "Eddie_Howe" },
  NFO: { name: "Oliver Glasner", page: "Oliver_Glasner" },
  SUN: { name: "Régis Le Bris", page: "Régis_Le_Bris" },
  TOT: { name: "Roberto De Zerbi", page: "Roberto_De_Zerbi" }
});

const DIRECT_PHOTOS = Object.freeze({
  CHE: "https://upload.wikimedia.org/wikipedia/commons/b/b6/Los_Caminos_del_f%C3%BAtbol._Xabi_Alonso_%2839666778464%29_%28cropped%29.jpg",
  CRY: "https://upload.wikimedia.org/wikipedia/commons/d/db/Pierre_Sage_en_2024.jpg"
});

const sourceChecks = new Map();
const fallbackPromises = new Map();
let frame = 0;
let delayedRepair = 0;

function selectedClubCode(root = document.querySelector(".career-club-selection")) {
  return root?.dataset.clubCode
    || root?.querySelector("[data-club-details]")?.dataset.clubCodeV7
    || root?.querySelector(".club-rail-item.selected span")?.textContent?.trim().toUpperCase()
    || "";
}

function managerCopy(panel) {
  return panel?.querySelector(":scope > .club-manager-copy-v14, :scope > .club-manager-copy-v5, :scope > div:last-child") || null;
}

function managerLayer(panel) {
  let layer = panel.querySelector(":scope > .club-manager-photo-v14");
  if (layer) return layer;

  layer = document.createElement("div");
  layer.className = "club-manager-photo-v14";
  layer.setAttribute("aria-hidden", "true");
  panel.insertBefore(layer, managerCopy(panel) || panel.firstChild);
  return layer;
}

function localPortrait(code) {
  return `/assets/clubs/2026-27/${code.toLowerCase()}/manager.webp?portrait=${PORTRAIT_VERSION}&club=${code}`;
}

function validSource(source) {
  return /^(?:https?:|blob:|data:image\/|\/assets\/)/i.test(String(source || "").trim());
}

function sourceLoads(source) {
  if (!validSource(source)) return Promise.resolve(false);
  if (sourceChecks.has(source)) return sourceChecks.get(source);

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

  sourceChecks.set(source, pending);
  return pending;
}

async function wikipediaPortrait(manager, code) {
  if (fallbackPromises.has(code)) return fallbackPromises.get(code);

  const pending = (async () => {
    const direct = DIRECT_PHOTOS[code];
    if (direct && await sourceLoads(direct)) return direct;

    try {
      const response = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(manager.page)}`,
        { cache: "force-cache", headers: { Accept: "application/json" } }
      );
      if (response.ok) {
        const payload = await response.json();
        const source = payload?.originalimage?.source || payload?.thumbnail?.source || "";
        if (source && await sourceLoads(source)) return source;
      }
    } catch {
      // Search fallback below.
    }

    try {
      const url = new URL("https://en.wikipedia.org/w/api.php");
      url.searchParams.set("action", "query");
      url.searchParams.set("generator", "search");
      url.searchParams.set("gsrsearch", `\"${manager.name}\" football manager`);
      url.searchParams.set("gsrlimit", "8");
      url.searchParams.set("prop", "pageimages");
      url.searchParams.set("piprop", "original|thumbnail");
      url.searchParams.set("pithumbsize", "1600");
      url.searchParams.set("format", "json");
      url.searchParams.set("origin", "*");
      const response = await fetch(url.toString(), { cache: "force-cache" });
      if (!response.ok) return "";
      const payload = await response.json();
      const pages = Object.values(payload?.query?.pages || {})
        .sort((a, b) => Number(a.index || 99) - Number(b.index || 99));
      for (const page of pages) {
        const source = page?.original?.source || page?.thumbnail?.source || "";
        if (source && await sourceLoads(source)) return source;
      }
    } catch {
      return "";
    }

    return "";
  })();

  fallbackPromises.set(code, pending);
  return pending;
}

function applyPortrait(panel, layer, code, manager, source) {
  if (!source || selectedClubCode(panel.closest(".career-club-selection")) !== code) return false;

  layer.style.backgroundImage = `url("${String(source).replaceAll('"', "%22")}")`;
  panel.classList.add("manager-photo-ready-v14");
  panel.dataset.managerPhotoCode = code;
  panel.dataset.managerPhotoName = manager.name;
  panel.dataset.managerPhotoSource = source;
  panel.dataset.managerPhotoState = "ready";
  return true;
}

async function renderManagerCard(root) {
  const details = root?.querySelector("[data-club-details]");
  const panel = details?.querySelector(".club-manager-panel");
  const code = selectedClubCode(root);
  const manager = MANAGERS[code];
  if (!panel || !manager) return;

  panel.classList.add("manager-photo-card-v14");
  panel.querySelectorAll(":scope > img, :scope > .club-manager-placeholder").forEach(node => node.remove());

  const copy = managerCopy(panel);
  if (copy) {
    copy.classList.add("club-manager-copy-v5", "club-manager-copy-v14");
    const label = copy.querySelector(".club-data-label");
    const name = copy.querySelector("strong");
    if (label) label.textContent = "TÉCNICO";
    if (name) name.textContent = manager.name;
  }

  const layer = managerLayer(panel);
  const requestId = `${code}:${manager.name}:${Date.now()}`;
  panel.dataset.managerPhotoRequest = requestId;
  panel.dataset.managerPhotoState = "loading";
  panel.classList.remove("manager-photo-ready-v14");
  layer.style.removeProperty("background-image");

  const local = localPortrait(code);
  applyPortrait(panel, layer, code, manager, local);

  if (await sourceLoads(local)) {
    if (panel.dataset.managerPhotoRequest === requestId) applyPortrait(panel, layer, code, manager, local);
    return;
  }

  const fallback = await wikipediaPortrait(manager, code);
  if (panel.dataset.managerPhotoRequest !== requestId || selectedClubCode(root) !== code) return;

  if (fallback) applyPortrait(panel, layer, code, manager, fallback);
  else {
    panel.classList.remove("manager-photo-ready-v14");
    panel.dataset.managerPhotoState = "failed";
  }
}

function repair() {
  const root = document.querySelector(".career-club-selection");
  if (root) renderManagerCard(root);
}

function scheduleRepair() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => requestAnimationFrame(repair));
  window.clearTimeout(delayedRepair);
  delayedRepair = window.setTimeout(repair, 180);
}

const observer = new MutationObserver(mutations => {
  const relevant = mutations.some(mutation => {
    if (mutation.type === "attributes") {
      return mutation.target instanceof Element
        && mutation.target.matches(".club-rail-item, [data-club-details], .career-club-selection");
    }

    return [...mutation.addedNodes].some(node => node instanceof Element && (
      node.matches?.(".career-club-selection, [data-club-details], .club-manager-panel")
      || node.querySelector?.(".career-club-selection, [data-club-details], .club-manager-panel")
    ));
  });

  if (relevant) scheduleRepair();
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["class", "data-club-code-v7", "data-club-code"]
});

document.addEventListener("click", event => {
  if (event.target.closest("[data-club-index], [data-club-step], .club-rail-item")) scheduleRepair();
}, true);

document.addEventListener("keydown", event => {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") scheduleRepair();
}, true);

window.addEventListener("hashchange", scheduleRepair);
document.addEventListener("DOMContentLoaded", scheduleRepair, { once: true });
scheduleRepair();

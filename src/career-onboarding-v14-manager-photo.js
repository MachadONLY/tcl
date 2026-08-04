import "./career-onboarding-v14-manager-photo.css";

const MANAGER_PAGES = Object.freeze({
  "mikel arteta": "Mikel_Arteta",
  "unai emery": "Unai_Emery",
  "marco rose": "Marco_Rose",
  "keith andrews": "Keith_Andrews_(footballer)",
  "fabian hurzeler": "Fabian_Hürzeler",
  "xabi alonso": "Xabi_Alonso",
  "frank lampard": "Frank_Lampard",
  "pierre sage": "Pierre_Sage",
  "david moyes": "David_Moyes",
  "alvaro arbeloa": "Álvaro_Arbeloa",
  "sergej jakirovic": "Sergej_Jakirović",
  "gary o neil": "Gary_O'Neil",
  "daniel farke": "Daniel_Farke",
  "andoni iraola": "Andoni_Iraola",
  "enzo maresca": "Enzo_Maresca",
  "michael carrick": "Michael_Carrick",
  "oliver glasner": "Oliver_Glasner",
  "regis le bris": "Régis_Le_Bris",
  "roberto de zerbi": "Roberto_De_Zerbi"
});

const DIRECT_PHOTOS = Object.freeze({
  "xabi alonso": "https://upload.wikimedia.org/wikipedia/commons/b/b6/Los_Caminos_del_f%C3%BAtbol._Xabi_Alonso_%2839666778464%29_%28cropped%29.jpg",
  "pierre sage": "https://upload.wikimedia.org/wikipedia/commons/d/db/Pierre_Sage_en_2024.jpg"
});

const photoPromises = new Map();
let frame = 0;
let retryTimer = 0;

function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function copyNode(panel) {
  return panel?.querySelector(":scope > .club-manager-copy-v5, :scope > div:last-child") || null;
}

function managerName(panel) {
  return copyNode(panel)?.querySelector("strong")?.textContent?.trim() || "";
}

function sourceOf(image) {
  if (!(image instanceof HTMLImageElement)) return "";
  return image.currentSrc || image.src || image.getAttribute("src") || "";
}

function validSource(source) {
  return /^(?:https?:|blob:|data:image\/|\/assets\/)/i.test(String(source || "").trim());
}

function canLoad(source) {
  if (!validSource(source)) return Promise.resolve(false);
  return new Promise(resolve => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image.naturalWidth > 0 && image.naturalHeight > 0);
    image.onerror = () => resolve(false);
    image.src = source;
    if (image.complete) resolve(image.naturalWidth > 0 && image.naturalHeight > 0);
  });
}

async function firstWorking(sources) {
  for (const source of [...new Set(sources.filter(validSource))]) {
    if (await canLoad(source)) return source;
  }
  return "";
}

async function summaryPhoto(page) {
  try {
    const response = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page)}`,
      { cache: "force-cache", headers: { Accept: "application/json" } }
    );
    if (!response.ok) return "";
    const payload = await response.json();
    return payload?.originalimage?.source || payload?.thumbnail?.source || "";
  } catch {
    return "";
  }
}

async function searchPhoto(name) {
  try {
    const url = new URL("https://en.wikipedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("generator", "search");
    url.searchParams.set("gsrsearch", `${name} football manager`);
    url.searchParams.set("gsrlimit", "8");
    url.searchParams.set("prop", "pageimages");
    url.searchParams.set("piprop", "original|thumbnail");
    url.searchParams.set("pithumbsize", "1400");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");
    const response = await fetch(url.toString(), { cache: "force-cache" });
    if (!response.ok) return "";
    const payload = await response.json();
    const pages = Object.values(payload?.query?.pages || {})
      .sort((a, b) => Number(a.index || 99) - Number(b.index || 99));
    for (const page of pages) {
      const source = page?.original?.source || page?.thumbnail?.source || "";
      if (source && await canLoad(source)) return source;
    }
  } catch {
    // Keep the last valid photo.
  }
  return "";
}

function remotePhoto(name) {
  const key = normalize(name);
  if (photoPromises.has(key)) return photoPromises.get(key);
  const pending = (async () => {
    const direct = DIRECT_PHOTOS[key];
    if (direct && await canLoad(direct)) return direct;
    const page = MANAGER_PAGES[key] || name.replace(/\s+/g, "_");
    const summary = await summaryPhoto(page);
    if (summary && await canLoad(summary)) return summary;
    return searchPhoto(name);
  })();
  photoPromises.set(key, pending);
  return pending;
}

function photoLayer(panel) {
  let layer = panel.querySelector(":scope > .club-manager-photo-v14");
  if (layer) return layer;
  layer = document.createElement("div");
  layer.className = "club-manager-photo-v14";
  layer.setAttribute("aria-hidden", "true");
  panel.prepend(layer);
  return layer;
}

function enforceManagerLayout(panel, copy, layer) {
  panel.classList.add("manager-photo-card-v14");

  if (layer && panel.firstElementChild !== layer) panel.prepend(layer);

  if (copy) {
    copy.classList.add("club-manager-copy-v5", "club-manager-copy-v14");
    copy.removeAttribute("style");
    if (panel.lastElementChild !== copy) panel.append(copy);
  }

  panel.querySelectorAll(":scope > .club-manager-photo-v14").forEach((node, index) => {
    if (index > 0) node.remove();
  });
}

function applyPhoto(panel, layer, source) {
  if (!source) return false;
  layer.style.backgroundImage = `url("${String(source).replaceAll('"', "%22")}")`;
  panel.classList.add("manager-photo-ready-v14");
  panel.dataset.managerPhotoState = "ready";
  panel.dataset.managerPhotoSource = source;
  return true;
}

async function renderPhoto(panel) {
  if (!(panel instanceof HTMLElement)) return;

  const copy = copyNode(panel);
  const layer = photoLayer(panel);
  enforceManagerLayout(panel, copy, layer);

  const name = managerName(panel);
  const key = normalize(name);

  if (!name || /anunciar|a definir|sem tecnico/i.test(key)) {
    layer.style.removeProperty("background-image");
    panel.classList.remove("manager-photo-ready-v14");
    panel.dataset.managerPhotoState = "unassigned";
    return;
  }

  const pinned = DIRECT_PHOTOS[key];
  if (pinned) applyPhoto(panel, layer, pinned);

  if (panel.dataset.managerPhotoName === key && panel.classList.contains("manager-photo-ready-v14")) return;

  const requestId = `${key}:${Date.now()}:${Math.random()}`;
  panel.dataset.managerPhotoRequest = requestId;
  panel.dataset.managerPhotoName = key;
  if (!pinned) {
    panel.dataset.managerPhotoState = "loading";
    panel.classList.remove("manager-photo-ready-v14");
  }

  const existing = [...panel.querySelectorAll(":scope > img")].map(sourceOf).filter(validSource);
  const source = await firstWorking(existing) || await remotePhoto(name);

  if (!panel.isConnected || panel.dataset.managerPhotoRequest !== requestId) return;
  if (!source) {
    if (!pinned) panel.dataset.managerPhotoState = "failed";
    return;
  }

  applyPhoto(panel, layer, source);
  enforceManagerLayout(panel, copyNode(panel), layer);
}

function repair() {
  document.querySelectorAll(".club-manager-panel").forEach(renderPhoto);
}

function scheduleRepair() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => requestAnimationFrame(repair));
  window.clearTimeout(retryTimer);
  retryTimer = window.setTimeout(repair, 420);
}

const observer = new MutationObserver(mutations => {
  const relevant = mutations.some(mutation => {
    if (mutation.type === "attributes") {
      return mutation.target instanceof Element
        && Boolean(mutation.target.closest(".club-manager-panel, .club-rail-item"));
    }
    return [...mutation.addedNodes].some(node => node instanceof Element && (
      node.matches?.(".club-manager-panel, .club-manager-panel *, .club-rail-item")
      || node.querySelector?.(".club-manager-panel, .club-rail-item")
    ));
  });
  if (relevant) scheduleRepair();
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["class", "src", "style", "data-local-pack"]
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

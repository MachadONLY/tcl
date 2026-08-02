import "./career-onboarding-v5.css";

const TROPHY_IMAGE = "https://upload.wikimedia.org/wikipedia/commons/2/2c/Premier_league_trophy_icon.png";
const MEDIA_CACHE_KEY = "touchline:onboarding-image-urls:v1";
const MEDIA_CACHE_TTL = 30 * 24 * 60 * 60 * 1000;

const CLUB_MEDIA = Object.freeze({
  ARS: { stadium: "Emirates_Stadium", location: "London" },
  AVL: { stadium: "Villa_Park", location: "Birmingham" },
  BOU: { stadium: "Dean_Court", location: "Bournemouth" },
  BRE: { stadium: "Brentford_Community_Stadium", location: "London" },
  BHA: { stadium: "Falmer_Stadium", location: "Brighton" },
  CHE: { stadium: "Stamford_Bridge_(stadium)", location: "London" },
  COV: { stadium: "Coventry_Building_Society_Arena", location: "Coventry" },
  CRY: { stadium: "Selhurst_Park", location: "London" },
  EVE: { stadium: "Everton_Stadium", location: "Liverpool" },
  FUL: { stadium: "Craven_Cottage", location: "London" },
  HUL: { stadium: "MKM_Stadium", location: "Kingston_upon_Hull" },
  IPS: { stadium: "Portman_Road", location: "Ipswich" },
  LEE: { stadium: "Elland_Road", location: "Leeds" },
  LIV: { stadium: "Anfield", location: "Liverpool" },
  MCI: { stadium: "City_of_Manchester_Stadium", location: "Manchester" },
  MUN: { stadium: "Old_Trafford", location: "Manchester" },
  NEW: { stadium: "St_James%27_Park", location: "Newcastle_upon_Tyne" },
  NFO: { stadium: "City_Ground", location: "Nottingham" },
  SUN: { stadium: "Stadium_of_Light", location: "Sunderland" },
  TOT: { stadium: "Tottenham_Hotspur_Stadium", location: "London" }
});

const CLUB_ORDER = Object.keys(CLUB_MEDIA);
const imageCache = new Map();
const preloadCache = window.__touchlineImagePreloads || new Map();
window.__touchlineImagePreloads = preloadCache;

let storedMedia = null;
let persistTimer = 0;
let renderToken = 0;
let refreshQueued = false;

function loadStoredMedia() {
  if (storedMedia) return storedMedia;
  try {
    const parsed = JSON.parse(localStorage.getItem(MEDIA_CACHE_KEY) || "{}");
    storedMedia = parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    storedMedia = {};
  }
  return storedMedia;
}

function schedulePersist() {
  window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    try { localStorage.setItem(MEDIA_CACHE_KEY, JSON.stringify(loadStoredMedia())); }
    catch { /* memory cache remains active */ }
  }, 140);
}

function readStored(page) {
  const entry = loadStoredMedia()[page];
  if (!entry || Date.now() - Number(entry.savedAt || 0) > MEDIA_CACHE_TTL) {
    if (entry) {
      delete loadStoredMedia()[page];
      schedulePersist();
    }
    return null;
  }
  return safeImageUrl(entry.url);
}

function writeStored(page, url) {
  if (!url) return;
  loadStoredMedia()[page] = { url, savedAt: Date.now() };
  schedulePersist();
}

function currentClubCode() {
  return document.querySelector(".club-rail-item.selected span")?.textContent?.trim().toUpperCase() || "";
}

function currentDetails() {
  return document.querySelector("[data-club-details]");
}

async function fetchJson(url, timeout = 6500) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    window.clearTimeout(timer);
  }
}

function safeImageUrl(value) {
  const source = String(value || "").trim();
  return /^https:\/\//i.test(source) ? source : null;
}

function preloadImage(source, priority = "low") {
  if (!source) return Promise.resolve(false);
  if (preloadCache.has(source)) return preloadCache.get(source);

  const pending = new Promise(resolve => {
    const image = new Image();
    image.decoding = "async";
    image.fetchPriority = priority;
    image.referrerPolicy = "no-referrer";
    image.onload = async () => {
      try { await image.decode?.(); } catch { /* already decoded enough to display */ }
      resolve(image.naturalWidth > 0 && image.naturalHeight > 0);
    };
    image.onerror = () => resolve(false);
    image.src = source;
    if (image.complete) resolve(image.naturalWidth > 0 && image.naturalHeight > 0);
  });

  preloadCache.set(source, pending);
  return pending;
}

async function wikipediaImage(page) {
  if (!page) return null;
  const key = String(page);
  if (imageCache.has(key)) return imageCache.get(key);

  const stored = readStored(key);
  if (stored) {
    imageCache.set(key, stored);
    return stored;
  }

  const pending = (async () => {
    try {
      const summary = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(key)}`);
      const source = safeImageUrl(summary?.originalimage?.source || summary?.thumbnail?.source);
      if (source) {
        writeStored(key, source);
        return source;
      }
    } catch {
      // The pageimages endpoint below is the secondary source.
    }

    try {
      const payload = await fetchJson(`https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&piprop=original%7Cthumbnail&pithumbsize=1400&titles=${encodeURIComponent(key)}&format=json&origin=*`);
      const pageData = Object.values(payload?.query?.pages || {})[0];
      const source = safeImageUrl(pageData?.original?.source || pageData?.thumbnail?.source);
      if (source) writeStored(key, source);
      return source;
    } catch {
      return null;
    }
  })();

  imageCache.set(key, pending);
  const resolved = await pending;
  imageCache.set(key, resolved);
  return resolved;
}

function cssImage(source) {
  return source ? `url("${String(source).replaceAll('"', "%22")}")` : "none";
}

function installTrophy(panel) {
  if (!panel) return;
  panel.querySelector(".club-trophy-icon")?.setAttribute("aria-hidden", "true");

  let media = panel.querySelector(":scope > .club-trophy-media-v5");
  if (!media) {
    media = document.createElement("div");
    media.className = "club-trophy-media-v5";
    const label = panel.querySelector(".club-data-label");
    panel.insertBefore(media, label || panel.firstChild);
  }

  if (!media.querySelector("img")) {
    const image = document.createElement("img");
    image.src = TROPHY_IMAGE;
    image.alt = "Troféu da Premier League";
    image.referrerPolicy = "no-referrer";
    image.decoding = "async";
    image.loading = "eager";
    image.fetchPriority = "high";
    media.append(image);
    preloadImage(TROPHY_IMAGE, "high");
  }
}

function normalizeManagerPanel(panel) {
  if (!panel) return;
  const info = panel.querySelector(":scope > div:last-child");
  if (!info) return;
  info.classList.add("club-manager-copy-v5");
  const name = info.querySelector("strong");
  if (name) name.title = name.textContent?.trim() || "";
  const portrait = panel.querySelector("img");
  if (portrait) {
    portrait.decoding = "async";
    portrait.loading = "eager";
    portrait.fetchPriority = "high";
  }
}

function prepareStructure(details, code) {
  details.classList.add("club-details-v5");
  details.dataset.clubCodeV5 = code;
  details.querySelector(".club-selection-grid")?.classList.add("club-selection-grid-v5");
  details.querySelector(".club-identity-card")?.classList.add("club-identity-card-v5");
  installTrophy(details.querySelector(".club-titles-panel"));
  normalizeManagerPanel(details.querySelector(".club-manager-panel"));
}

function applyMedia(details, code, stadiumImage, locationImage) {
  if (!details || details.dataset.clubCodeV5 !== code) return;
  const actualStadium = stadiumImage || locationImage;
  const actualLocation = locationImage || stadiumImage;
  if (actualStadium) details.style.setProperty("--v5-stadium-image", cssImage(actualStadium));
  if (actualLocation) details.style.setProperty("--v5-location-image", cssImage(actualLocation));
  if (actualStadium || actualLocation) details.classList.add("club-media-v5-ready");
}

async function loadClubMedia(code, priority = "low") {
  const media = CLUB_MEDIA[code];
  if (!media) return { stadiumImage: null, locationImage: null };
  const [stadiumImage, locationImage] = await Promise.all([
    wikipediaImage(media.stadium),
    wikipediaImage(media.location)
  ]);
  await Promise.all([
    preloadImage(stadiumImage, priority),
    preloadImage(locationImage, priority)
  ]);
  return { stadiumImage, locationImage };
}

function neighborCodes(code) {
  const index = CLUB_ORDER.indexOf(code);
  if (index < 0) return [];
  return [
    CLUB_ORDER[(index - 1 + CLUB_ORDER.length) % CLUB_ORDER.length],
    CLUB_ORDER[(index + 1) % CLUB_ORDER.length]
  ];
}

function prewarmNeighbors(code) {
  const run = () => neighborCodes(code).forEach(neighbor => loadClubMedia(neighbor, "low"));
  if ("requestIdleCallback" in window) window.requestIdleCallback(run, { timeout: 1200 });
  else window.setTimeout(run, 180);
}

async function enhanceCurrentClub() {
  const code = currentClubCode();
  const details = currentDetails();
  if (!code || !details || !CLUB_MEDIA[code]) return;

  const token = ++renderToken;
  prepareStructure(details, code);

  const media = CLUB_MEDIA[code];
  const cachedStadium = readStored(media.stadium);
  const cachedLocation = readStored(media.location);
  if (cachedStadium || cachedLocation) {
    applyMedia(details, code, cachedStadium, cachedLocation);
    preloadImage(cachedStadium, "high");
    preloadImage(cachedLocation, "high");
  }

  const { stadiumImage, locationImage } = await loadClubMedia(code, "high");
  if (token !== renderToken || currentClubCode() !== code || currentDetails() !== details) return;
  applyMedia(details, code, stadiumImage, locationImage);
  prewarmNeighbors(code);
}

function queueRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(() => {
    refreshQueued = false;
    if (document.querySelector(".career-club-selection")) enhanceCurrentClub();
  });
}

const observer = new MutationObserver(mutations => {
  const relevant = mutations.some(mutation => [...mutation.addedNodes].some(node => {
    if (!(node instanceof Element)) return false;
    return node.matches?.(".career-club-selection, [data-club-details], .club-selection-grid")
      || node.querySelector?.(".career-club-selection, [data-club-details], .club-selection-grid");
  }));
  if (relevant) queueRefresh();
});

observer.observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener("click", event => {
  if (event.target.closest("[data-club-index], [data-club-step]")) queueRefresh();
}, true);
window.addEventListener("hashchange", queueRefresh);
document.addEventListener("DOMContentLoaded", queueRefresh, { once: true });
queueRefresh();

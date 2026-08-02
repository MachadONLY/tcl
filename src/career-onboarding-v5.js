import "./career-onboarding-v5.css";

const TROPHY_IMAGE = "https://upload.wikimedia.org/wikipedia/commons/2/2c/Premier_league_trophy_icon.png";

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

const imageCache = new Map();
let renderToken = 0;
let refreshQueued = false;

function currentClubCode() {
  return document.querySelector(".club-rail-item.selected span")?.textContent?.trim().toUpperCase() || "";
}

function currentDetails() {
  return document.querySelector("[data-club-details]");
}

async function fetchJson(url, timeout = 8000) {
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

async function wikipediaImage(page) {
  if (!page) return null;
  const key = String(page);
  if (imageCache.has(key)) return imageCache.get(key);

  const pending = (async () => {
    try {
      const summary = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(key)}`);
      const source = safeImageUrl(summary?.originalimage?.source || summary?.thumbnail?.source);
      if (source) return source;
    } catch {
      // The pageimages endpoint below is the secondary source.
    }

    try {
      const payload = await fetchJson(`https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&piprop=original%7Cthumbnail&pithumbsize=1400&titles=${encodeURIComponent(key)}&format=json&origin=*`);
      const pageData = Object.values(payload?.query?.pages || {})[0];
      return safeImageUrl(pageData?.original?.source || pageData?.thumbnail?.source);
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
    media.append(image);
  }
}

function normalizeManagerPanel(panel) {
  if (!panel) return;
  const info = panel.querySelector(":scope > div:last-child");
  if (!info) return;
  info.classList.add("club-manager-copy-v5");
  const name = info.querySelector("strong");
  if (name) name.title = name.textContent?.trim() || "";
}

function prepareStructure(details, code) {
  details.classList.add("club-details-v5");
  details.dataset.clubCodeV5 = code;

  const grid = details.querySelector(".club-selection-grid");
  grid?.classList.add("club-selection-grid-v5");

  const identity = details.querySelector(".club-identity-card");
  identity?.classList.add("club-identity-card-v5");

  installTrophy(details.querySelector(".club-titles-panel"));
  normalizeManagerPanel(details.querySelector(".club-manager-panel"));
}

async function enhanceCurrentClub() {
  const code = currentClubCode();
  const details = currentDetails();
  const media = CLUB_MEDIA[code];
  if (!code || !details || !media) return;

  const token = ++renderToken;
  prepareStructure(details, code);

  const [stadiumImage, locationImage] = await Promise.all([
    wikipediaImage(media.stadium),
    wikipediaImage(media.location)
  ]);

  if (token !== renderToken || currentClubCode() !== code || currentDetails() !== details) return;

  const actualStadium = stadiumImage || locationImage;
  const actualLocation = locationImage || stadiumImage;
  if (actualStadium) details.style.setProperty("--v5-stadium-image", cssImage(actualStadium));
  if (actualLocation) details.style.setProperty("--v5-location-image", cssImage(actualLocation));
  details.classList.add("club-media-v5-ready");
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
window.addEventListener("resize", queueRefresh, { passive: true });
document.addEventListener("DOMContentLoaded", queueRefresh, { once: true });
queueRefresh();

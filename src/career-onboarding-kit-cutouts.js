const SPORTS_DB_KEY = "123";
const SEASON = "2026/27";

const CLUBS = Object.freeze({
  ARS: "Arsenal",
  AVL: "Aston Villa",
  BOU: "AFC Bournemouth",
  BRE: "Brentford",
  BHA: "Brighton & Hove Albion",
  CHE: "Chelsea",
  COV: "Coventry City",
  CRY: "Crystal Palace",
  EVE: "Everton",
  FUL: "Fulham",
  HUL: "Hull City",
  IPS: "Ipswich Town",
  LEE: "Leeds United",
  LIV: "Liverpool",
  MCI: "Manchester City",
  MUN: "Manchester United",
  NEW: "Newcastle United",
  NFO: "Nottingham Forest",
  SUN: "Sunderland",
  TOT: "Tottenham Hotspur"
});

// Imagens oficiais de produto, sem modelo ou pessoa usando a camisa.
const VERIFIED_CUTOUTS = Object.freeze({
  MUN: {
    home: "https://assets.adidas.com/images/w_500%2Cf_auto%2Cq_auto/7d4fa15a9acf4108a10cfe78e1cf5ff4_9366/Manchester_United_26-27_Home_Jersey_Red_KA6871_01_laydown.jpg"
  }
});

const cache = new Map();
let activeRequest = 0;
let refreshTimer = 0;
let applying = false;

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function selectedCode() {
  return document.querySelector(".club-rail-item.selected span")?.textContent?.trim().toUpperCase() || "";
}

function detailsPanel() {
  return document.querySelector("[data-club-details]");
}

function isForbiddenPhoto(source, alt = "") {
  const text = `${source || ""} ${alt || ""}`.toLowerCase();
  return /(?:^|[_\-/])(model|models|player|players|person|people|worn|wearing|lifestyle|campaign|onbody|on-body|hover-model|hover_model)(?:[_\-/]|\.|$)/i.test(text)
    || /\b(man|men|woman|women|kid|kids)\s+(?:wearing|model)\b/i.test(text);
}

function seasonMatches(value) {
  const compact = String(value || "").replace(/\s+/g, "").replace(/[–—]/g, "-");
  return /(?:2026[-/]2027|2026[-/]27|26[-/]27)/i.test(compact);
}

function equipmentRole(item) {
  const type = normalize(item?.strType);
  if (/\b(home|1st|first|principal|casa)\b/.test(type)) return "home";
  if (/\b(away|2nd|second|visitante|fora)\b/.test(type)) return "away";
  if (/\b(third|3rd|terceiro)\b/.test(type)) return "third";
  return "unknown";
}

function equipmentSource(item) {
  return item?.strEquipment || item?.strEquipmentThumb || item?.strThumb || null;
}

async function fetchJson(url, timeout = 8500) {
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

function bestTeamMatch(teams, name) {
  const wanted = normalize(name);
  return (teams || []).find(team => normalize(team?.strTeam) === wanted)
    || (teams || []).find(team => {
      const candidate = normalize(team?.strTeam);
      return candidate && (candidate.includes(wanted) || wanted.includes(candidate));
    })
    || (teams || []).find(team => /england/i.test(team?.strCountry || ""))
    || (teams || [])[0]
    || null;
}

function chooseKits(items) {
  const candidates = (items || [])
    .filter(item => seasonMatches(item?.strSeason))
    .map(item => ({ source: equipmentSource(item), role: equipmentRole(item) }))
    .filter(item => item.source && !isForbiddenPhoto(item.source));

  const home = candidates.find(item => item.role === "home")
    || candidates.find(item => item.role === "unknown")
    || null;
  const away = candidates.find(item => item.role === "away")
    || candidates.find(item => item !== home && item.role === "unknown")
    || candidates.find(item => item !== home && item.role === "third")
    || null;

  return { home: home?.source || null, away: away?.source || null };
}

async function loadCutouts(code) {
  if (cache.has(code)) return cache.get(code);
  const teamName = CLUBS[code];
  if (!teamName) return { home: null, away: null };

  const pending = (async () => {
    const verified = VERIFIED_CUTOUTS[code] || {};
    let database = { home: null, away: null };

    try {
      const teamsPayload = await fetchJson(`https://www.thesportsdb.com/api/v1/json/${SPORTS_DB_KEY}/searchteams.php?t=${encodeURIComponent(teamName)}`);
      const team = bestTeamMatch(teamsPayload?.teams, teamName);
      if (team?.idTeam) {
        const equipmentPayload = await fetchJson(`https://www.thesportsdb.com/api/v1/json/${SPORTS_DB_KEY}/lookupequipment.php?id=${encodeURIComponent(team.idTeam)}`);
        database = chooseKits(equipmentPayload?.equipment);
      }
    } catch {
      // O estado neutro permanece visível; jamais usamos uma foto com pessoa como fallback.
    }

    return {
      home: verified.home || database.home || null,
      away: verified.away || database.away || null
    };
  })();

  cache.set(code, pending);
  const result = await pending;
  cache.set(code, result);
  return result;
}

function preload(source) {
  if (!source || isForbiddenPhoto(source)) return Promise.resolve(false);
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve(image.naturalWidth > 0 && image.naturalHeight > 0);
    image.onerror = () => resolve(false);
    image.referrerPolicy = "no-referrer";
    image.src = source;
    if (image.complete) resolve(image.naturalWidth > 0 && image.naturalHeight > 0);
  });
}

function cutoutMarkup(source, label) {
  return `<figure class="club-kit-official-v3 club-kit-cutout-only">
    <div><img src="${escapeHtml(source)}" alt="Camisa oficial ${label.toLowerCase()} ${SEASON}, sem modelo" referrerpolicy="no-referrer" /></div>
    <figcaption><strong>${label}</strong><span>OFICIAL 26/27</span></figcaption>
  </figure>`;
}

function pendingMarkup(label) {
  return `<figure class="club-kit-pending-v3 club-kit-cutout-only">
    <div><span aria-hidden="true">◇</span><strong>KIT OFICIAL 26/27</strong><small>CAMISA ISOLADA AINDA NÃO DISPONÍVEL</small></div>
    <figcaption>${label}</figcaption>
  </figure>`;
}

function scrubPeoplePhotos(details) {
  details?.querySelectorAll(".club-kit-slot img").forEach(image => {
    if (!isForbiddenPhoto(image.currentSrc || image.src, image.alt)) return;
    const slot = image.closest(".club-kit-slot");
    const index = [...details.querySelectorAll(".club-kit-slot")].indexOf(slot);
    if (slot) slot.innerHTML = pendingMarkup(index === 1 ? "FORA" : "CASA");
  });
}

async function applyCutouts() {
  if (applying) return;
  const code = selectedCode();
  const details = detailsPanel();
  if (!code || !CLUBS[code] || !details) return;

  applying = true;
  const request = ++activeRequest;
  try {
    scrubPeoplePhotos(details);
    const slots = [...details.querySelectorAll(".club-kit-slot")];
    if (slots.length < 2) return;

    const kits = await loadCutouts(code);
    if (request !== activeRequest || selectedCode() !== code || detailsPanel() !== details) return;

    const entries = [
      { slot: slots[0], source: kits.home, label: "CASA" },
      { slot: slots[1], source: kits.away, label: "FORA" }
    ];

    await Promise.all(entries.map(async entry => {
      const ready = entry.source ? await preload(entry.source) : false;
      if (request !== activeRequest || selectedCode() !== code || detailsPanel() !== details) return;
      entry.slot.innerHTML = ready ? cutoutMarkup(entry.source, entry.label) : pendingMarkup(entry.label);
      entry.slot.dataset.cutoutOnly = code;
    }));
  } finally {
    applying = false;
  }
}

function scheduleRefresh(delay = 0) {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => {
    if (!document.querySelector(".career-club-selection")) return;
    applyCutouts();
  }, delay);
}

const observer = new MutationObserver(mutations => {
  if (applying) return;
  const relevant = mutations.some(mutation => {
    if (mutation.type === "attributes") return mutation.target instanceof Element && mutation.target.matches(".club-rail-item");
    return [...mutation.addedNodes].some(node => node instanceof Element && (
      node.matches?.("[data-club-details], .club-kit-slot, .club-kit-official-v3")
      || node.querySelector?.("[data-club-details], .club-kit-slot, .club-kit-official-v3")
    ));
  });
  if (relevant) scheduleRefresh(40);
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["class"]
});

document.addEventListener("click", event => {
  if (!event.target.closest("[data-club-index], [data-club-step]")) return;
  scheduleRefresh(40);
  window.setTimeout(() => scheduleRefresh(0), 450);
}, true);

window.addEventListener("hashchange", () => scheduleRefresh(80));
document.addEventListener("DOMContentLoaded", () => scheduleRefresh(80), { once: true });
scheduleRefresh(80);

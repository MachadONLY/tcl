import "./career-onboarding-v2.css";

const SPORTS_DB_KEY = "123";
const SEASON = "2026/27";

const CLUBS = Object.freeze({
  ARS: { team: "Arsenal", manager: "Mikel Arteta", wiki: "Mikel_Arteta", focus: "50% 100%" },
  AVL: { team: "Aston Villa", manager: "Unai Emery", wiki: "Unai_Emery", focus: "50% 100%" },
  BOU: { team: "AFC Bournemouth", manager: "Marco Rose", wiki: "Marco_Rose", focus: "50% 100%" },
  BRE: { team: "Brentford", manager: "Keith Andrews", wiki: "Keith_Andrews_(footballer)", focus: "50% 100%" },
  BHA: { team: "Brighton & Hove Albion", manager: "Fabian Hürzeler", wiki: "Fabian_Hürzeler", focus: "50% 100%" },
  CHE: { team: "Chelsea", manager: "Xabi Alonso", wiki: "Xabi_Alonso", focus: "50% 100%" },
  COV: { team: "Coventry City", manager: "Frank Lampard", wiki: "Frank_Lampard", focus: "50% 100%" },
  CRY: { team: "Crystal Palace", manager: "Pierre Sage", wiki: "Pierre_Sage", focus: "50% 100%" },
  EVE: { team: "Everton", manager: "David Moyes", wiki: "David_Moyes", focus: "50% 100%" },
  FUL: { team: "Fulham", manager: "Álvaro Arbeloa", wiki: "Álvaro_Arbeloa", focus: "50% 100%" },
  HUL: { team: "Hull City", manager: "Sergej Jakirović", wiki: "Sergej_Jakirović", focus: "50% 100%" },
  IPS: { team: "Ipswich Town", manager: "Gary O'Neil", wiki: "Gary_O'Neil", focus: "50% 100%" },
  LEE: { team: "Leeds United", manager: "Daniel Farke", wiki: "Daniel_Farke", focus: "50% 100%" },
  LIV: { team: "Liverpool", manager: "Andoni Iraola", wiki: "Andoni_Iraola", focus: "50% 100%" },
  MCI: { team: "Manchester City", manager: "Enzo Maresca", wiki: "Enzo_Maresca", focus: "50% 100%" },
  MUN: { team: "Manchester United", manager: "Michael Carrick", wiki: "Michael_Carrick", focus: "50% 100%" },
  NEW: { team: "Newcastle United", manager: "Técnico a anunciar", wiki: null, focus: "50% 100%" },
  NFO: { team: "Nottingham Forest", manager: "Oliver Glasner", wiki: "Oliver_Glasner", focus: "50% 100%" },
  SUN: { team: "Sunderland", manager: "Régis Le Bris", wiki: "Régis_Le_Bris", focus: "50% 100%" },
  TOT: { team: "Tottenham Hotspur", manager: "Roberto De Zerbi", wiki: "Roberto_De_Zerbi", focus: "50% 100%" }
});

const clubAssets = new Map();
const requestVersions = new Map();
let refreshQueued = false;

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

function currentClubCode() {
  return document.querySelector(".club-rail-item.selected span")?.textContent?.trim().toUpperCase() || "";
}

function currentDetails() {
  return document.querySelector("[data-club-details]");
}

async function fetchJson(url, timeout = 7500) {
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

function seasonMatches(value) {
  const normalized = String(value || "").replace(/\s+/g, "").replace(/[–—]/g, "-");
  return /(?:2026[-/]2027|2026[-/]27|26[-/]27)/i.test(normalized);
}

function equipmentImage(item) {
  return item?.strEquipment || item?.strEquipmentThumb || item?.strThumb || null;
}

function equipmentRole(item) {
  const type = normalize(item?.strType);
  if (/\b(home|1st|first|principal|casa)\b/.test(type)) return "home";
  if (/\b(away|2nd|second|visitante|fora)\b/.test(type)) return "away";
  if (/\b(third|3rd|terceiro)\b/.test(type)) return "third";
  return "unknown";
}

function selectSeasonKits(items) {
  const current = (items || [])
    .filter(item => seasonMatches(item?.strSeason))
    .map(item => ({ ...item, image: equipmentImage(item), role: equipmentRole(item) }))
    .filter(item => item.image);

  const home = current.find(item => item.role === "home") || current.find(item => item.role === "unknown") || null;
  const away = current.find(item => item.role === "away")
    || current.find(item => item !== home && item.role === "unknown")
    || current.find(item => item !== home && item.role === "third")
    || null;

  return {
    homeKit: home?.image || null,
    awayKit: away?.image || null
  };
}

function bestTeamMatch(teams, club) {
  const wanted = normalize(club.team);
  return (teams || []).find(team => normalize(team.strTeam) === wanted)
    || (teams || []).find(team => normalize(team.strTeam).includes(wanted) || wanted.includes(normalize(team.strTeam)))
    || (teams || []).find(team => /england/i.test(team.strCountry || ""))
    || (teams || [])[0]
    || null;
}

function bestManagerMatch(players, club) {
  const wanted = normalize(club.manager);
  const candidates = (players || []).filter(Boolean);
  return candidates.find(person => normalize(person.strPlayer) === wanted)
    || candidates.find(person => normalize(person.strPlayer).includes(wanted) || wanted.includes(normalize(person.strPlayer)))
    || candidates[0]
    || null;
}

async function managerAsset(club) {
  if (!club.manager || club.manager === "Técnico a anunciar") return null;

  try {
    const payload = await fetchJson(`https://www.thesportsdb.com/api/v1/json/${SPORTS_DB_KEY}/searchplayers.php?p=${encodeURIComponent(club.manager)}`);
    const person = bestManagerMatch(payload?.player, club);
    const image = person?.strCutout || person?.strRender || person?.strThumb || null;
    if (image) return { image, kind: person?.strCutout || person?.strRender ? "cutout" : "photo" };
  } catch {
    // Wikipedia remains the secondary public source.
  }

  if (!club.wiki) return null;
  try {
    const payload = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(club.wiki)}`);
    const image = payload?.originalimage?.source || payload?.thumbnail?.source || null;
    return image ? { image, kind: "photo" } : null;
  } catch {
    return null;
  }
}

async function loadClubAssets(code) {
  if (clubAssets.has(code)) return clubAssets.get(code);
  const club = CLUBS[code];
  if (!club) return {};

  const pending = (async () => {
    const assets = {
      homeKit: null,
      awayKit: null,
      managerImage: null,
      managerKind: "placeholder"
    };

    const [manager] = await Promise.all([
      managerAsset(club),
      (async () => {
        try {
          const teamsPayload = await fetchJson(`https://www.thesportsdb.com/api/v1/json/${SPORTS_DB_KEY}/searchteams.php?t=${encodeURIComponent(club.team)}`);
          const team = bestTeamMatch(teamsPayload?.teams, club);
          if (!team?.idTeam) return;
          const equipmentPayload = await fetchJson(`https://www.thesportsdb.com/api/v1/json/${SPORTS_DB_KEY}/lookupequipment.php?id=${encodeURIComponent(team.idTeam)}`);
          Object.assign(assets, selectSeasonKits(equipmentPayload?.equipment));
        } catch {
          // The UI shows a neutral official-release state rather than a fake shirt.
        }
      })()
    ]);

    if (manager?.image) {
      assets.managerImage = manager.image;
      assets.managerKind = manager.kind;
    }
    return assets;
  })();

  clubAssets.set(code, pending);
  const resolved = await pending;
  clubAssets.set(code, resolved);
  return resolved;
}

function initials(value) {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || "")
    .join("") || "?";
}

function preloadImage(source) {
  if (!source) return Promise.resolve(false);
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.referrerPolicy = "no-referrer";
    image.src = source;
    if (image.complete) resolve(image.naturalWidth > 0);
  });
}

async function applyManager(panel, club, assets, version) {
  if (!panel || panel.dataset.managerV2 === version) return;
  const info = panel.querySelector(":scope > div:last-child");
  const managerName = info?.querySelector("strong")?.textContent?.trim() || club.manager;
  const source = assets.managerImage;

  let media = panel.querySelector(":scope > .club-manager-media");
  if (!media) {
    media = document.createElement("div");
    media.className = "club-manager-media";
    panel.querySelectorAll(":scope > img, :scope > .club-manager-placeholder").forEach(node => node.remove());
    panel.insertBefore(media, info || panel.firstChild);
  }

  panel.style.setProperty("--manager-focus", club.focus || "50% 100%");
  panel.dataset.managerV2 = version;

  if (source && await preloadImage(source)) {
    if (currentClubCode() !== version.split(":")[0]) return;
    media.innerHTML = `<img class="club-manager-image ${assets.managerKind === "cutout" ? "is-cutout" : "is-photo"}" src="${escapeHtml(source)}" alt="${escapeHtml(managerName)}" referrerpolicy="no-referrer" />`;
    media.classList.add("has-image");
    return;
  }

  media.classList.remove("has-image");
  media.innerHTML = `<div class="club-manager-v2-placeholder" aria-hidden="true"><span>${managerName === "Técnico a anunciar" ? "?" : escapeHtml(initials(managerName))}</span></div>`;
}

function pendingKitMarkup(label) {
  return `
    <div class="club-kit-pending" aria-label="Uniforme ${label.toLowerCase()} ainda não disponível">
      <span aria-hidden="true">⌛</span>
      <strong>AGUARDANDO</strong>
      <small>DIVULGAÇÃO OFICIAL</small>
    </div>
    <em>${label}</em>`;
}

function officialKitMarkup(source, label) {
  return `
    <div class="club-kit-official">
      <img class="club-kit-image" src="${escapeHtml(source)}" alt="Uniforme oficial ${label.toLowerCase()} ${SEASON}" referrerpolicy="no-referrer" />
      <span>OFICIAL 26/27</span>
    </div>
    <em>${label}</em>`;
}

async function applyKits(details, assets, version) {
  const slots = [...details.querySelectorAll(".club-kit-slot")];
  if (slots.length < 2) return;

  const entries = [
    { slot: slots[0], source: assets.homeKit, label: "CASA" },
    { slot: slots[1], source: assets.awayKit, label: "FORA" }
  ];

  for (const entry of entries) {
    const ready = entry.source ? await preloadImage(entry.source) : false;
    if (currentClubCode() !== version.split(":")[0]) return;
    entry.slot.dataset.kitV2 = version;
    entry.slot.innerHTML = ready
      ? officialKitMarkup(entry.source, entry.label)
      : pendingKitMarkup(entry.label);
  }
}

async function enhanceCurrentClub() {
  const code = currentClubCode();
  const club = CLUBS[code];
  const details = currentDetails();
  if (!code || !club || !details) return;

  const nextRequest = (requestVersions.get(code) || 0) + 1;
  requestVersions.set(code, nextRequest);
  const version = `${code}:${nextRequest}`;
  details.dataset.onboardingV2 = version;

  const assets = await loadClubAssets(code);
  if (currentClubCode() !== code || currentDetails() !== details) return;

  await Promise.all([
    applyManager(details.querySelector(".club-manager-panel"), club, assets, version),
    applyKits(details, assets, version)
  ]);
}

function queueRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(() => {
    refreshQueued = false;
    if (!document.querySelector(".career-club-selection")) return;
    enhanceCurrentClub();
  });
}

const observer = new MutationObserver(mutations => {
  const meaningful = mutations.some(mutation => [...mutation.addedNodes].some(node => {
    if (!(node instanceof Element)) return false;
    return node.matches?.(".career-club-selection, [data-club-details], .club-selection-grid")
      || node.querySelector?.("[data-club-details], .club-selection-grid");
  }));
  if (meaningful) queueRefresh();
});

observer.observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener("click", event => {
  if (event.target.closest("[data-club-index], [data-club-step]")) queueRefresh();
}, true);
window.addEventListener("hashchange", queueRefresh);
document.addEventListener("DOMContentLoaded", queueRefresh, { once: true });
queueRefresh();

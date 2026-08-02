import "./career-onboarding-v3.css";

const SPORTS_DB_KEY = "123";
const SEASON = "2026/27";
const PREMIER_LEAGUE_KIT_READER = "https://r.jina.ai/http://www.premierleague.com/en/news/4658330/premier-league-club-kits-for-202627-season";

const CLUBS = Object.freeze({
  ARS: { team: "Arsenal", aliases: ["Arsenal"], manager: "Mikel Arteta", wiki: "Mikel_Arteta" },
  AVL: { team: "Aston Villa", aliases: ["Aston Villa"], manager: "Unai Emery", wiki: "Unai_Emery" },
  BOU: { team: "AFC Bournemouth", aliases: ["AFC Bournemouth", "Bournemouth"], manager: "Marco Rose", wiki: "Marco_Rose" },
  BRE: { team: "Brentford", aliases: ["Brentford"], manager: "Keith Andrews", wiki: "Keith_Andrews_(footballer)" },
  BHA: { team: "Brighton & Hove Albion", aliases: ["Brighton & Hove Albion", "Brighton"], manager: "Fabian Hürzeler", wiki: "Fabian_Hürzeler" },
  CHE: { team: "Chelsea", aliases: ["Chelsea"], manager: "Xabi Alonso", wiki: "Xabi_Alonso" },
  COV: { team: "Coventry City", aliases: ["Coventry City", "Coventry"], manager: "Frank Lampard", wiki: "Frank_Lampard" },
  CRY: { team: "Crystal Palace", aliases: ["Crystal Palace"], manager: "Pierre Sage", wiki: "Pierre_Sage" },
  EVE: { team: "Everton", aliases: ["Everton"], manager: "David Moyes", wiki: "David_Moyes" },
  FUL: { team: "Fulham", aliases: ["Fulham"], manager: "Álvaro Arbeloa", wiki: "Álvaro_Arbeloa" },
  HUL: { team: "Hull City", aliases: ["Hull City", "Hull"], manager: "Sergej Jakirović", wiki: "Sergej_Jakirović" },
  IPS: { team: "Ipswich Town", aliases: ["Ipswich Town", "Ipswich"], manager: "Gary O'Neil", wiki: "Gary_O'Neil" },
  LEE: { team: "Leeds United", aliases: ["Leeds United", "Leeds"], manager: "Daniel Farke", wiki: "Daniel_Farke" },
  LIV: { team: "Liverpool", aliases: ["Liverpool"], manager: "Andoni Iraola", wiki: "Andoni_Iraola" },
  MCI: { team: "Manchester City", aliases: ["Manchester City", "Man City"], manager: "Enzo Maresca", wiki: "Enzo_Maresca" },
  MUN: { team: "Manchester United", aliases: ["Manchester United", "Man Utd"], manager: "Michael Carrick", wiki: "Michael_Carrick" },
  NEW: { team: "Newcastle United", aliases: ["Newcastle United", "Newcastle"], manager: "Técnico a anunciar", wiki: null },
  NFO: { team: "Nottingham Forest", aliases: ["Nottingham Forest", "Nott'm Forest"], manager: "Oliver Glasner", wiki: "Oliver_Glasner" },
  SUN: { team: "Sunderland", aliases: ["Sunderland"], manager: "Régis Le Bris", wiki: "Régis_Le_Bris" },
  TOT: { team: "Tottenham Hotspur", aliases: ["Tottenham Hotspur", "Tottenham", "Spurs"], manager: "Roberto De Zerbi", wiki: "Roberto_De_Zerbi" }
});

const VERIFIED_KITS = Object.freeze({
  ARS: {
    homeKit: "https://assets.adidas.com/images/w_500%2Cf_auto%2Cq_auto/371d94df693e4a23a752a677701dd070_9366/Arsenal_FC_26-27_Home_Authentic_Jersey_Red_JZ3165_HM51.jpg"
  },
  MUN: {
    homeKit: "https://assets.adidas.com/images/w_500%2Cf_auto%2Cq_auto/f7eaae60d3ea488796a6be104acbe9a4_9366/Manchester_United_26-27_Home_Jersey_Red_KA6871_21_model.jpg",
    awayKit: "https://assets.adidas.com/images/w_500%2Cf_auto%2Cq_auto/eec2ddd0517947eaafc7bc4f9758a978_9366/Manchester_United_26-27_Away_Jersey_Blue_KA6861_21_model.jpg"
  }
});

const assetCache = new Map();
let officialKitIndexPromise = null;
let refreshQueued = false;
let renderToken = 0;

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

async function fetchJson(url, timeout = 9000) {
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

async function fetchText(url, timeout = 13000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "text/plain,text/markdown;q=0.9,*/*;q=0.7" }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    window.clearTimeout(timer);
  }
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

function isUsefulKitImage(url, alt = "") {
  const haystack = normalize(`${url} ${alt}`);
  if (!/^https?:\/\//i.test(url)) return false;
  if (/badge|crest|logo|icon|sponsor|favicon/.test(haystack)) return false;
  return /kit|shirt|jersey|home|away|player|premierleague|pulselive|resources/.test(haystack)
    || /\.(?:png|jpe?g|webp)(?:\?|$)/i.test(url);
}

function roleFromText(value) {
  const text = normalize(value);
  if (/\baway\b|\bsecond\b|\b2nd\b|\bfora\b/.test(text)) return "away";
  if (/\bhome\b|\bfirst\b|\b1st\b|\bcasa\b/.test(text)) return "home";
  if (/\bthird\b|\b3rd\b/.test(text)) return "third";
  return "unknown";
}

function extractMarkdownImages(section) {
  const entries = [];
  const markdownImage = /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match;
  while ((match = markdownImage.exec(section))) {
    const alt = match[1] || "";
    const url = match[2].replaceAll("&amp;", "&");
    if (!isUsefulKitImage(url, alt)) continue;
    entries.push({ url, alt, role: roleFromText(`${alt} ${url}`) });
  }
  return entries.filter((entry, index, list) => list.findIndex(item => item.url === entry.url) === index);
}

function sectionForClub(markdown, club) {
  const lines = String(markdown || "").split(/\r?\n/);
  let start = -1;
  let level = 7;

  for (let index = 0; index < lines.length; index += 1) {
    const heading = lines[index].match(/^(#{2,6})\s+(.+?)\s*$/);
    if (!heading) continue;
    const title = normalize(heading[2].replace(/\[[^\]]+\]\([^)]*\)/g, ""));
    if (club.aliases.some(alias => title === normalize(alias) || title.includes(normalize(alias)))) {
      start = index;
      level = heading[1].length;
      break;
    }
  }

  if (start < 0) return "";
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const heading = lines[index].match(/^(#{2,6})\s+/);
    if (heading && heading[1].length <= level) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

function kitsFromEntries(entries) {
  if (!entries.length) return {};
  const home = entries.find(entry => entry.role === "home") || entries[0] || null;
  const away = entries.find(entry => entry.role === "away")
    || entries.find(entry => entry.url !== home?.url && entry.role === "unknown")
    || entries.find(entry => entry.url !== home?.url)
    || null;
  return {
    homeKit: home?.url || null,
    awayKit: away?.url || null
  };
}

async function loadOfficialKitIndex() {
  if (officialKitIndexPromise) return officialKitIndexPromise;
  officialKitIndexPromise = (async () => {
    const index = {};
    try {
      const markdown = await fetchText(PREMIER_LEAGUE_KIT_READER);
      Object.entries(CLUBS).forEach(([code, club]) => {
        const section = sectionForClub(markdown, club);
        index[code] = kitsFromEntries(extractMarkdownImages(section));
      });
    } catch {
      // The SportsDB and verified manufacturer images remain available.
    }
    return index;
  })();
  return officialKitIndexPromise;
}

function seasonMatches(value) {
  const text = String(value || "").replace(/\s+/g, "").replace(/[–—]/g, "-");
  return /(?:2026[-/]2027|2026[-/]27|26[-/]27)/i.test(text);
}

function equipmentRole(item) {
  return roleFromText(item?.strType || "");
}

function selectSportsDbKits(items) {
  const candidates = (items || [])
    .filter(item => seasonMatches(item?.strSeason))
    .map(item => ({
      source: item?.strEquipment || item?.strEquipmentThumb || item?.strThumb || null,
      role: equipmentRole(item)
    }))
    .filter(item => item.source);
  return kitsFromEntries(candidates.map(item => ({ url: item.source, role: item.role, alt: "" })));
}

function bestTeamMatch(teams, club) {
  const wanted = normalize(club.team);
  return (teams || []).find(team => normalize(team.strTeam) === wanted)
    || (teams || []).find(team => normalize(team.strTeam).includes(wanted) || wanted.includes(normalize(team.strTeam)))
    || (teams || []).find(team => /england/i.test(team.strCountry || ""))
    || (teams || [])[0]
    || null;
}

async function sportsDbKits(club) {
  try {
    const teams = await fetchJson(`https://www.thesportsdb.com/api/v1/json/${SPORTS_DB_KEY}/searchteams.php?t=${encodeURIComponent(club.team)}`);
    const team = bestTeamMatch(teams?.teams, club);
    if (!team?.idTeam) return {};
    const equipment = await fetchJson(`https://www.thesportsdb.com/api/v1/json/${SPORTS_DB_KEY}/lookupequipment.php?id=${encodeURIComponent(team.idTeam)}`);
    return selectSportsDbKits(equipment?.equipment);
  } catch {
    return {};
  }
}

async function managerAsset(club) {
  if (!club.manager || club.manager === "Técnico a anunciar") return null;
  try {
    const payload = await fetchJson(`https://www.thesportsdb.com/api/v1/json/${SPORTS_DB_KEY}/searchplayers.php?p=${encodeURIComponent(club.manager)}`);
    const wanted = normalize(club.manager);
    const person = (payload?.player || []).find(item => normalize(item?.strPlayer) === wanted)
      || (payload?.player || [])[0];
    const image = person?.strCutout || person?.strRender || person?.strThumb || null;
    if (image) return { image, kind: person?.strCutout || person?.strRender ? "cutout" : "photo" };
  } catch {
    // Wikipedia is the secondary public source.
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

async function loadAssets(code) {
  if (assetCache.has(code)) return assetCache.get(code);
  const club = CLUBS[code];
  if (!club) return {};

  const pending = (async () => {
    const [manager, officialIndex, databaseKits] = await Promise.all([
      managerAsset(club),
      loadOfficialKitIndex(),
      sportsDbKits(club)
    ]);
    const verified = VERIFIED_KITS[code] || {};
    const official = officialIndex?.[code] || {};
    return {
      managerImage: manager?.image || null,
      managerKind: manager?.kind || "placeholder",
      homeKit: verified.homeKit || official.homeKit || databaseKits.homeKit || null,
      awayKit: verified.awayKit || official.awayKit || databaseKits.awayKit || null
    };
  })();

  assetCache.set(code, pending);
  const resolved = await pending;
  assetCache.set(code, resolved);
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

async function applyManager(panel, club, assets, token) {
  if (!panel) return;
  const info = panel.querySelector(":scope > div:last-child");
  const name = info?.querySelector("strong")?.textContent?.trim() || club.manager;
  let media = panel.querySelector(":scope > .club-manager-media");
  if (!media) {
    media = document.createElement("div");
    media.className = "club-manager-media";
    panel.querySelectorAll(":scope > img, :scope > .club-manager-placeholder").forEach(node => node.remove());
    panel.insertBefore(media, info || panel.firstChild);
  }

  const ready = assets.managerImage ? await preloadImage(assets.managerImage) : false;
  if (token !== renderToken || currentClubCode() !== panel.closest("[data-club-details]")?.dataset.clubCodeV3) return;

  if (ready) {
    media.innerHTML = `<img class="club-manager-image ${assets.managerKind === "cutout" ? "is-cutout" : "is-photo"}" src="${escapeHtml(assets.managerImage)}" alt="${escapeHtml(name)}" referrerpolicy="no-referrer" />`;
  } else {
    media.innerHTML = `<div class="club-manager-v3-placeholder" aria-hidden="true"><span>${name === "Técnico a anunciar" ? "?" : escapeHtml(initials(name))}</span></div>`;
  }
}

function kitMarkup(source, label) {
  return `<figure class="club-kit-official-v3">
    <div><img src="${escapeHtml(source)}" alt="Uniforme oficial ${label.toLowerCase()} ${SEASON}" referrerpolicy="no-referrer" /></div>
    <figcaption><strong>${label}</strong><span>OFICIAL 26/27</span></figcaption>
  </figure>`;
}

function pendingKitMarkup(label) {
  return `<figure class="club-kit-pending-v3">
    <div><span aria-hidden="true">⌛</span><strong>IMAGEM OFICIAL</strong><small>AINDA NÃO DISPONÍVEL</small></div>
    <figcaption>${label}</figcaption>
  </figure>`;
}

async function applyKits(details, assets, token) {
  const slots = [...details.querySelectorAll(".club-kit-slot")];
  if (slots.length < 2) return;
  const entries = [
    { slot: slots[0], source: assets.homeKit, label: "CASA" },
    { slot: slots[1], source: assets.awayKit, label: "FORA" }
  ];

  await Promise.all(entries.map(async entry => {
    const ready = entry.source ? await preloadImage(entry.source) : false;
    if (token !== renderToken || currentDetails() !== details) return;
    entry.slot.innerHTML = ready ? kitMarkup(entry.source, entry.label) : pendingKitMarkup(entry.label);
  }));
}

async function enhanceCurrentClub() {
  const code = currentClubCode();
  const club = CLUBS[code];
  const details = currentDetails();
  if (!code || !club || !details) return;

  const token = ++renderToken;
  details.dataset.clubCodeV3 = code;
  details.classList.add("club-details-v3");
  const assets = await loadAssets(code);
  if (token !== renderToken || currentClubCode() !== code || currentDetails() !== details) return;

  await Promise.all([
    applyManager(details.querySelector(".club-manager-panel"), club, assets, token),
    applyKits(details, assets, token)
  ]);
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
  const changed = mutations.some(mutation => [...mutation.addedNodes].some(node => {
    if (!(node instanceof Element)) return false;
    return node.matches?.("[data-club-details], .club-selection-grid, .club-manager-panel, .club-kit-slot")
      || node.querySelector?.("[data-club-details], .club-selection-grid, .club-manager-panel, .club-kit-slot");
  }));
  if (changed) queueRefresh();
});

observer.observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener("click", event => {
  if (event.target.closest("[data-club-index], [data-club-step]")) queueRefresh();
}, true);
window.addEventListener("hashchange", queueRefresh);
document.addEventListener("DOMContentLoaded", queueRefresh, { once: true });
queueRefresh();

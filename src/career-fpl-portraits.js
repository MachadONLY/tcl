const FPL_ENDPOINT = "https://fantasy.premierleague.com/api/bootstrap-static/";
const CACHE_KEY = "touchline.fpl.portraits.v2";
const CACHE_TTL = 12 * 60 * 60 * 1000;

const IMAGE_ROOTS = [
  "https://resources.premierleague.com/premierleague26/photos/players/250x250",
  "https://resources.premierleague.com/premierleague26/photos/players/110x140",
  "https://resources.premierleague.com/premierleague25/photos/players/250x250",
  "https://resources.premierleague.com/premierleague25/photos/players/110x140",
  "https://resources.premierleague.com/premierleague/photos/players/250x250",
  "https://platform-static-files.s3.amazonaws.com/premierleague/photos/players/250x250"
];

let catalog = null;
let scanQueued = false;

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.'’`-]/g, " ")
    .replace(/\b(jr|junior|sr|ii|iii|iv)\b/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (!cached?.savedAt || Date.now() - cached.savedAt > CACHE_TTL) return null;
    if (!Array.isArray(cached.players) || !cached.players.length) return null;
    return cached;
  } catch {
    return null;
  }
}

function writeCache(value) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...value, savedAt: Date.now() }));
  } catch {
    // Storage failure must never block portraits.
  }
}

function buildCatalog(payload) {
  const teams = new Map((payload?.teams || []).map(team => [team.id, team]));
  const players = (payload?.elements || []).map(player => {
    const team = teams.get(player.team);
    const fullName = `${player.first_name || ""} ${player.second_name || ""}`.trim();
    return {
      id: player.id,
      code: player.code,
      photo: player.photo,
      teamName: team?.name || "",
      teamShortName: team?.short_name || "",
      names: [...new Set([
        fullName,
        player.web_name,
        player.second_name,
        `${player.first_name || ""} ${player.web_name || ""}`.trim()
      ].map(normalize).filter(Boolean))]
    };
  });

  const byName = new Map();
  for (const player of players) {
    for (const key of player.names) {
      const list = byName.get(key) || [];
      list.push(player);
      byName.set(key, list);
    }
  }

  return { players, teams: [...teams.values()], byName };
}

async function loadCatalog() {
  if (catalog) return catalog;

  const cached = readCache();
  if (cached) {
    catalog = buildCatalog({ elements: cached.players, teams: cached.teams });
    return catalog;
  }

  const response = await fetch(FPL_ENDPOINT, {
    headers: { Accept: "application/json" },
    credentials: "omit",
    cache: "no-cache"
  });
  if (!response.ok) throw new Error(`FPL respondeu ${response.status}`);

  const payload = await response.json();
  const compactPlayers = (payload.elements || []).map(player => ({
    id: player.id,
    code: player.code,
    photo: player.photo,
    team: player.team,
    first_name: player.first_name,
    second_name: player.second_name,
    web_name: player.web_name
  }));
  const compactTeams = (payload.teams || []).map(team => ({
    id: team.id,
    name: team.name,
    short_name: team.short_name
  }));

  writeCache({ players: compactPlayers, teams: compactTeams });
  catalog = buildCatalog({ elements: compactPlayers, teams: compactTeams });
  return catalog;
}

function inferName(face) {
  const row = face.closest(".career-squad-row, .career-transfer-row, .career-market-row, .career-shortlist-row, .career-mail-row");
  const panel = face.closest(".career-player-profile, .career-transfer-profile, .career-offer-profile, .career-mail-reader");
  return String(
    face.dataset.playerName ||
    row?.querySelector("strong")?.textContent ||
    panel?.querySelector("h2")?.textContent ||
    face.querySelector("img")?.alt ||
    ""
  ).trim();
}

function inferTeam(face) {
  if (face.dataset.teamName) return face.dataset.teamName;
  if (face.closest(".career-squad-row, .career-player-profile, .career-tactics-module")) return "Manchester United";

  const row = face.closest(".career-transfer-row, .career-market-row, .career-shortlist-row");
  return String(
    row?.dataset.teamName ||
    row?.querySelector("[data-team-name]")?.textContent ||
    row?.querySelector(".career-player-club, .career-transfer-club")?.textContent ||
    ""
  ).trim();
}

function teamMatches(player, teamHint) {
  if (!teamHint) return true;
  const hint = normalize(teamHint);
  const team = normalize(`${player.teamName} ${player.teamShortName}`);
  return team.includes(hint) || hint.includes(team);
}

function findPlayer(name, teamHint) {
  if (!catalog) return null;
  const key = normalize(name);
  if (!key) return null;

  const exact = catalog.byName.get(key) || [];
  if (exact.length) return exact.find(player => teamMatches(player, teamHint)) || exact[0];

  const tokens = key.split(" ");
  const last = tokens.at(-1);
  if (!last || last.length < 4) return null;

  const candidates = catalog.players.filter(player =>
    player.names.some(candidate => candidate.endsWith(` ${last}`) || candidate === last)
  );
  return candidates.find(player => teamMatches(player, teamHint)) || (candidates.length === 1 ? candidates[0] : null);
}

function photoFilenames(player) {
  const filenames = [];
  if (player.photo) {
    filenames.push(String(player.photo).replace(/\.jpg$/i, ".png"));
    filenames.push(String(player.photo));
  }
  if (player.code) filenames.push(`p${player.code}.png`);
  return [...new Set(filenames.filter(Boolean))];
}

function officialSources(player) {
  return IMAGE_ROOTS.flatMap(root => photoFilenames(player).map(filename => `${root}/${filename}`));
}

function existingFallbacks(image) {
  const values = [image?.currentSrc, image?.getAttribute("src")];
  try {
    const stored = JSON.parse(image?.dataset.originalSources || "[]");
    if (Array.isArray(stored)) values.push(...stored);
  } catch {
    // Ignore malformed data attributes.
  }
  return [...new Set(values.filter(source =>
    source &&
    !String(source).startsWith("blob:") &&
    !String(source).includes("resources.premierleague.com")
  ))];
}

function installOfficialPortrait(face, player, name) {
  let image = face.querySelector(":scope > img");
  if (!image) {
    image = document.createElement("img");
    image.alt = name;
    face.insertBefore(image, face.querySelector(":scope > small") || null);
  }

  const identity = `${player.id}:${player.photo || player.code || name}`;
  if (image.dataset.fplPortraitIdentity === identity) return;

  const queue = [...officialSources(player), ...existingFallbacks(image)];
  if (!queue.length) return;

  image.dataset.fplPortraitIdentity = identity;
  image.dataset.fplPortraitQueue = JSON.stringify(queue.slice(1));
  image.dataset.smartPortraitReady = "false";
  image.alt = name;
  image.decoding = "async";
  image.loading = face.classList.contains("hero") || face.classList.contains("transfer") ? "eager" : "lazy";
  image.crossOrigin = "anonymous";
  image.referrerPolicy = "no-referrer";

  face.classList.remove("smart-portrait-ready", "smart-portrait-unresolved");

  image.onerror = () => {
    let remaining = [];
    try {
      remaining = JSON.parse(image.dataset.fplPortraitQueue || "[]");
    } catch {
      remaining = [];
    }
    const next = remaining.shift();
    image.dataset.fplPortraitQueue = JSON.stringify(remaining);
    if (next) {
      image.src = next;
      return;
    }
    image.onerror = null;
  };

  image.onload = () => {
    face.classList.add("has-photo", "photo-ready", "official-pl-portrait");
    face.classList.remove("photo-loading", "photo-failed");
  };

  face.classList.add("has-photo", "photo-loading", "official-pl-portrait");
  image.src = queue[0];
}

function scan() {
  if (!catalog) return;
  document.querySelectorAll(".career-face").forEach(face => {
    const name = inferName(face);
    const player = findPlayer(name, inferTeam(face));
    if (player) installOfficialPortrait(face, player, name);
  });
}

function queueScan() {
  if (scanQueued) return;
  scanQueued = true;
  requestAnimationFrame(() => {
    scanQueued = false;
    scan();
  });
}

const observer = new MutationObserver(queueScan);
observer.observe(document.body, { childList: true, subtree: true });

loadCatalog()
  .then(queueScan)
  .catch(() => {
    // Existing ESPN/API-Football/TheSportsDB pipeline remains active.
  });

const CACHE_KEY = "touchline.premier-league.live.v2";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

const TEAM_CODE_OVERRIDES = Object.freeze({
  MAN: "MUN",
  MNC: "MCI",
  BOU: "BOU",
  ARS: "ARS",
  AVL: "AVL",
  BRE: "BRE",
  BHA: "BHA",
  CHE: "CHE",
  COV: "COV",
  CRY: "CRY",
  EVE: "EVE",
  FUL: "FUL",
  HUL: "HUL",
  IPS: "IPS",
  LEE: "LEE",
  LIV: "LIV",
  NEW: "NEW",
  NFO: "NFO",
  SUN: "SUN",
  TOT: "TOT"
});

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function firstValue(...values) {
  return values.find(value => value !== undefined && value !== null && value !== "") ?? null;
}

function imageHref(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.href || value.url || value.src || null;
}

function positionValue(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.abbreviation || value.shortName || value.displayName || value.name || "";
}

function ageFromDate(dateOfBirth) {
  if (!dateOfBirth) return null;
  const date = new Date(dateOfBirth);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - date.getUTCFullYear();
  const beforeBirthday = now.getUTCMonth() < date.getUTCMonth() ||
    (now.getUTCMonth() === date.getUTCMonth() && now.getUTCDate() < date.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age > 0 && age < 60 ? age : null;
}

function nationalityOf(athlete) {
  return firstValue(
    athlete.citizenship,
    athlete.citizenshipCountry,
    athlete.nationality,
    athlete.birthPlace?.country,
    athlete.birthPlace?.countryCode,
    athlete.country?.name,
    athlete.country?.displayName
  ) || "—";
}

function athleteName(athlete) {
  return firstValue(
    athlete.fullName,
    athlete.displayName,
    athlete.commonName,
    athlete.shortName,
    athlete.name
  );
}

function looksLikeAthlete(node) {
  if (!node || typeof node !== "object") return false;
  const candidate = node.athlete && typeof node.athlete === "object" ? node.athlete : node;
  const name = athleteName(candidate);
  const id = firstValue(candidate.id, node.id);
  if (!name || !id) return false;

  const uid = String(candidate.uid || "");
  if (uid.includes("~t:") && !uid.includes("~a:")) return false;

  return Boolean(
    candidate.headshot ||
    candidate.position ||
    candidate.jersey ||
    candidate.dateOfBirth ||
    candidate.age ||
    node.position ||
    node.jersey ||
    node.starter !== undefined
  );
}

function collectAthletes(payload) {
  const results = [];
  const seenObjects = new WeakSet();
  const seenIds = new Set();

  function visit(node, inheritedPosition = "") {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(item => visit(item, inheritedPosition));
      return;
    }
    if (typeof node !== "object") return;
    if (seenObjects.has(node)) return;
    seenObjects.add(node);

    const localPosition = positionValue(node.position) || inheritedPosition;

    if (looksLikeAthlete(node)) {
      const athlete = node.athlete && typeof node.athlete === "object" ? node.athlete : node;
      const id = String(firstValue(athlete.id, node.id));
      const name = athleteName(athlete);
      if (id && name && !seenIds.has(id)) {
        seenIds.add(id);
        results.push({
          raw: athlete,
          wrapper: node,
          inheritedPosition: localPosition
        });
      }
    }

    for (const [key, value] of Object.entries(node)) {
      if (["team", "sports", "league", "links", "logos"].includes(key)) continue;
      const nextPosition = key === "items" || key === "athletes" ? localPosition : inheritedPosition;
      visit(value, nextPosition);
    }
  }

  visit(payload);
  return results;
}

function parseTeams(payload) {
  const leagues = payload?.sports?.flatMap(sport => sport?.leagues || []) || [];
  return leagues
    .flatMap(league => league?.teams || [])
    .map(entry => entry?.team || entry)
    .filter(team => team?.id && team?.displayName)
    .map(team => ({
      id: String(team.id),
      name: team.displayName,
      shortName: team.shortDisplayName || team.name || team.displayName,
      abbreviation: TEAM_CODE_OVERRIDES[team.abbreviation] || team.abbreviation || String(team.id),
      slug: team.slug || null,
      logo: imageHref(team.logos?.find(logo => logo?.rel?.includes("default"))) || imageHref(team.logos?.[0]),
      color: team.color ? `#${team.color.replace(/^#/, "")}` : null
    }));
}

function normalizePlayer(entry, team) {
  const athlete = entry.raw;
  const wrapper = entry.wrapper;
  const id = String(firstValue(athlete.id, wrapper.id));
  const name = athleteName(athlete);
  const position = positionValue(firstValue(athlete.position, wrapper.position, entry.inheritedPosition));
  const headshot = imageHref(firstValue(athlete.headshot, wrapper.headshot));
  const espnHeadshot = `https://a.espncdn.com/i/headshots/soccer/players/full/${encodeURIComponent(id)}.png`;
  const photoSources = [...new Set([headshot, espnHeadshot].filter(Boolean))];

  return {
    id: `espn-${id}`,
    providerId: id,
    name,
    normalizedName: normalizeText(name),
    teamId: team.id,
    teamName: team.name,
    teamCode: team.abbreviation,
    teamLogo: team.logo,
    position: position || "Midfielder",
    age: Number(firstValue(athlete.age, wrapper.age)) || ageFromDate(athlete.dateOfBirth) || null,
    dateOfBirth: athlete.dateOfBirth || null,
    number: Number(firstValue(athlete.jersey, wrapper.jersey, athlete.number, wrapper.number)) || null,
    nationality: nationalityOf(athlete),
    photo: photoSources[0] || null,
    photoFallbacks: photoSources.slice(1),
    source: "espn-live"
  };
}

export function normalizePremierLeagueSnapshot(payload) {
  const teams = parseTeams(payload?.teams);
  const rosterByTeam = new Map(
    (payload?.rosters || []).map(item => [String(item.teamId), item.roster])
  );

  const players = teams.flatMap(team => {
    const roster = rosterByTeam.get(team.id);
    return collectAthletes(roster)
      .map(entry => normalizePlayer(entry, team))
      .filter(player => player.name && player.id);
  });

  const deduped = [...new Map(players.map(player => [`${player.teamId}:${player.providerId}`, player])).values()];
  return {
    teams,
    players: deduped,
    meta: {
      ready: teams.length === 20 && deduped.length >= 300,
      provider: "ESPN public soccer feed",
      league: "Premier League",
      season: 2026,
      teamCount: teams.length,
      playerCount: deduped.length,
      generatedAt: payload?.generatedAt || new Date().toISOString()
    }
  };
}

function readCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
    if (!cached || Date.now() - cached.savedAt > CACHE_TTL_MS) return null;
    if (!Array.isArray(cached.players) || cached.players.length < 100) return null;
    return cached;
  } catch {
    return null;
  }
}

function writeCache(snapshot) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ ...snapshot, savedAt: Date.now() }));
  } catch {
    // The game still works without persistent cache (private browsing/storage limits).
  }
}

export async function loadPremierLeagueLive() {
  if (typeof window === "undefined") return { teams: [], players: [], meta: { ready: false } };

  const cached = readCache();
  if (cached) return cached;

  const response = await fetch("/api/espn/snapshot", {
    headers: { Accept: "application/json" },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`ESPN live catalog returned HTTP ${response.status}`);
  }

  const snapshot = normalizePremierLeagueSnapshot(await response.json());
  if (snapshot.players.length >= 100) writeCache(snapshot);
  return snapshot;
}

export function clearPremierLeagueLiveCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // noop
  }
}

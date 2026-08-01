import { PREMIER_LEAGUE_PLAYERS, PLAYER_FACE_META } from "./data/premier-league-player-faces.js";

const CURATED_FALLBACKS = Object.freeze({
  "kobbie mainoo": {
    id: "wikimedia-kobbie-mainoo-2026",
    name: "Kobbie Mainoo",
    normalizedName: "kobbie mainoo",
    teamName: "Manchester United",
    teamCode: "MUN",
    position: "Midfielder",
    number: 37,
    photo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1f/Kobbie_Mainoo_England_v_Ghana_23_June_2026-042.jpg/330px-Kobbie_Mainoo_England_v_Ghana_23_June_2026-042.jpg",
    photoFallbacks: [
      "https://commons.wikimedia.org/wiki/Special:FilePath/Kobbie_Mainoo_England_v_Ghana_23_June_2026-042.jpg?width=330",
      "https://a.espncdn.com/i/headshots/soccer/players/full/328466.png"
    ],
    source: "wikimedia-curated-fallback",
    credit: "Bryan Berlin / WikiPortraits · CC BY-SA 4.0"
  }
});

export function normalizePlayerName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.'’`-]/g, " ")
    .replace(/\b(jr|junior|sr|ii|iii|iv)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const byExactName = new Map();
const byLastName = new Map();

for (const player of PREMIER_LEAGUE_PLAYERS) {
  const normalized = player.normalizedName || normalizePlayerName(player.name);
  if (!normalized) continue;

  const exact = byExactName.get(normalized) || [];
  exact.push(player);
  byExactName.set(normalized, exact);

  const lastName = normalized.split(" ").at(-1);
  if (lastName) {
    const matches = byLastName.get(lastName) || [];
    matches.push(player);
    byLastName.set(lastName, matches);
  }
}

function teamMatches(player, teamHint) {
  if (!teamHint) return true;
  const hint = normalizePlayerName(teamHint);
  const team = normalizePlayerName(`${player.teamName || ""} ${player.teamCode || ""}`);
  return team.includes(hint) || hint.includes(team);
}

function chooseBest(matches, teamHint) {
  if (!matches?.length) return null;
  if (!teamHint) return matches[0];
  return matches.find(player => teamMatches(player, teamHint)) || matches[0];
}

function withPhotoSources(player, source) {
  if (!player) return null;
  const photoSources = [...new Set([player.photo, ...(player.photoFallbacks || [])].filter(Boolean))];
  return {
    ...player,
    photo: photoSources[0] || null,
    photoSources,
    source: player.source || source
  };
}

export function getPlayerFace(playerName, teamHint = "") {
  const normalized = normalizePlayerName(playerName);
  if (!normalized) return null;

  const exact = chooseBest(byExactName.get(normalized), teamHint);
  if (exact) return withPhotoSources(exact, "api-football");

  const fallback = CURATED_FALLBACKS[normalized];
  if (fallback && teamMatches(fallback, teamHint)) {
    return withPhotoSources(fallback, "curated-fallback");
  }

  const tokens = normalized.split(" ");
  if (tokens.length > 1) {
    const lastNameMatches = byLastName.get(tokens.at(-1)) || [];
    const fuzzy = lastNameMatches.find(player => {
      const candidate = player.normalizedName || normalizePlayerName(player.name);
      return candidate.includes(tokens[0]) && teamMatches(player, teamHint);
    });
    if (fuzzy) return withPhotoSources(fuzzy, "api-football");
  }

  return null;
}

export function playerFaceCoverage() {
  return {
    ...PLAYER_FACE_META,
    available: PREMIER_LEAGUE_PLAYERS.length,
    curatedFallbacks: Object.keys(CURATED_FALLBACKS).length,
    ready: PREMIER_LEAGUE_PLAYERS.length > 0 || Object.keys(CURATED_FALLBACKS).length > 0
  };
}

const FALLBACK_SQUADS = {
  61: [
    ["Robert Sánchez", "Goalkeeper", 1],
    ["Reece James", "Defence", 24],
    ["Wesley Fofana", "Defence", 29],
    ["Levi Colwill", "Defence", 6],
    ["Marc Cucurella", "Defence", 3],
    ["Moisés Caicedo", "Midfield", 25],
    ["Enzo Fernández", "Midfield", 8],
    ["Cole Palmer", "Midfield", 10],
    ["Pedro Neto", "Offence", 7],
    ["Nicolas Jackson", "Offence", 15],
    ["Jadon Sancho", "Offence", 19],
    ["Filip Jørgensen", "Goalkeeper", 12],
    ["Malo Gusto", "Defence", 27],
    ["Tosin Adarabioyo", "Defence", 4],
    ["Romeo Lavia", "Midfield", 45],
    ["Christopher Nkunku", "Offence", 18],
    ["Noni Madueke", "Offence", 11],
    ["Marc Guiu", "Offence", 38]
  ],
  66: [
    ["André Onana", "Goalkeeper", 24],
    ["Diogo Dalot", "Defence", 20],
    ["Leny Yoro", "Defence", 15],
    ["Matthijs de Ligt", "Defence", 4],
    ["Lisandro Martínez", "Defence", 6],
    ["Manuel Ugarte", "Midfield", 25],
    ["Kobbie Mainoo", "Midfield", 37],
    ["Amad Diallo", "Midfield", 16],
    ["Bruno Fernandes", "Midfield", 8],
    ["Alejandro Garnacho", "Offence", 17],
    ["Rasmus Højlund", "Offence", 9],
    ["Altay Bayındır", "Goalkeeper", 1],
    ["Harry Maguire", "Defence", 5],
    ["Noussair Mazraoui", "Defence", 3],
    ["Casemiro", "Midfield", 18],
    ["Mason Mount", "Midfield", 7],
    ["Joshua Zirkzee", "Offence", 11],
    ["Luke Shaw", "Defence", 23]
  ]
};

const FALLBACK_TEAMS = {
  61: {
    id: 61,
    name: "Chelsea FC",
    shortName: "Chelsea",
    tla: "CHE",
    crest: "https://crests.football-data.org/61.png"
  },
  66: {
    id: 66,
    name: "Manchester United FC",
    shortName: "Man United",
    tla: "MUN",
    crest: "https://crests.football-data.org/66.png"
  }
};

function normalizePlayer(player, index) {
  return {
    id: player.id ?? `demo-${index}-${player.name}`,
    name: player.name,
    position: player.position || "Unknown",
    shirtNumber: player.shirtNumber ?? player.number ?? null
  };
}

function normalizeTeam(team, source) {
  const fallback = FALLBACK_TEAMS[team.id] || {};
  return {
    id: team.id,
    name: team.name || fallback.name,
    shortName: team.shortName || fallback.shortName || team.name,
    tla: team.tla || fallback.tla || "CLB",
    crest: team.crest || fallback.crest,
    source,
    squad: (team.squad || []).map(normalizePlayer)
  };
}

function fallbackTeam(teamId) {
  const team = FALLBACK_TEAMS[teamId];
  const squad = (FALLBACK_SQUADS[teamId] || []).map(([name, position, shirtNumber], index) =>
    normalizePlayer({ name, position, shirtNumber }, index)
  );
  return normalizeTeam({ ...team, squad }, "demo");
}

async function requestJson(pathname) {
  const response = await fetch(`/api/football-data${pathname}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || "Não foi possível carregar os dados de futebol.");
    error.code = payload.code;
    error.status = response.status;
    throw error;
  }
  return payload;
}

export async function getProviderStatus() {
  return requestJson("/status");
}

export async function getPremierLeagueTeams() {
  const payload = await requestJson("/competition");
  return (payload.teams || []).map(team => normalizeTeam(team, "live"));
}

export async function getTeam(teamId) {
  try {
    const payload = await requestJson(`/team?id=${encodeURIComponent(teamId)}`);
    const normalized = normalizeTeam(payload, "live");
    return normalized.squad.length ? normalized : fallbackTeam(teamId);
  } catch (error) {
    if (error.code !== "FOOTBALL_DATA_KEY_MISSING" && error.status !== 503) {
      console.warn("Football data indisponível; usando demonstração.", error);
    }
    return fallbackTeam(teamId);
  }
}

export async function loadMatchTeams(homeId = 61, awayId = 66) {
  const [home, away, status] = await Promise.all([
    getTeam(homeId),
    getTeam(awayId),
    getProviderStatus().catch(() => ({ configured: false, provider: "football-data.org" }))
  ]);
  return {
    home,
    away,
    provider: status.provider || "football-data.org",
    live: home.source === "live" && away.source === "live"
  };
}

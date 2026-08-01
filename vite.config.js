import { defineConfig, loadEnv } from "vite";

const FOOTBALL_DATA_ROOT = "https://api.football-data.org/v4";
const ESPN_ROOT = "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1";
const CACHE_TTL_MS = 30 * 60 * 1000;
const ESPN_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map();

function sendJson(response, status, payload, cacheControl = "no-store") {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", cacheControl);
  response.end(JSON.stringify(payload));
}

function getCached(key, ttl = CACHE_TTL_MS) {
  const item = cache.get(key);
  if (!item || Date.now() - item.createdAt > ttl) {
    cache.delete(key);
    return null;
  }
  return item.payload;
}

function setCached(key, payload) {
  cache.set(key, { createdAt: Date.now(), payload });
}

async function fetchJson(url, options = {}) {
  const upstream = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(18000)
  });
  const payload = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const error = new Error(payload.message || `${url} respondeu ${upstream.status}`);
    error.status = upstream.status;
    throw error;
  }
  return payload;
}

async function fetchFootballData(pathname, apiKey) {
  const key = `football-data:${pathname}`;
  const cached = getCached(key);
  if (cached) return cached;

  const payload = await fetchJson(`${FOOTBALL_DATA_ROOT}${pathname}`, {
    headers: {
      "X-Auth-Token": apiKey,
      "User-Agent": "Touchline-Matchday-Prototype/0.4"
    }
  });

  setCached(key, payload);
  return payload;
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function espnTeamsFromPayload(payload) {
  return payload?.sports
    ?.flatMap(sport => sport?.leagues || [])
    .flatMap(league => league?.teams || [])
    .map(entry => entry?.team || entry)
    .filter(team => team?.id && team?.displayName) || [];
}

async function fetchEspn(pathname) {
  const key = `espn:${pathname}`;
  const cached = getCached(key, ESPN_CACHE_TTL_MS);
  if (cached) return cached;

  const payload = await fetchJson(`${ESPN_ROOT}${pathname}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Touchline-Career/0.4"
    }
  });
  setCached(key, payload);
  return payload;
}

async function fetchEspnSnapshot() {
  const key = "espn:snapshot";
  const cached = getCached(key, ESPN_CACHE_TTL_MS);
  if (cached) return cached;

  const teams = await fetchEspn("/teams");
  const teamList = espnTeamsFromPayload(teams);
  const rosters = await mapLimit(teamList, 5, async team => {
    try {
      return {
        teamId: String(team.id),
        roster: await fetchEspn(`/teams/${encodeURIComponent(team.id)}/roster`)
      };
    } catch (error) {
      return {
        teamId: String(team.id),
        roster: null,
        error: error.message
      };
    }
  });

  const payload = {
    teams,
    rosters,
    generatedAt: new Date().toISOString(),
    provider: "ESPN public soccer feed"
  };
  setCached(key, payload);
  return payload;
}

function footballDataProxy(apiKey) {
  return {
    name: "touchline-football-data-proxy",
    configureServer(server) {
      server.middlewares.use("/api/football-data", async (request, response) => {
        const url = new URL(request.url || "/", "http://touchline.local");

        if (url.pathname === "/status") {
          sendJson(response, 200, {
            configured: Boolean(apiKey),
            provider: "football-data.org",
            competition: "PL"
          });
          return;
        }

        if (!apiKey) {
          sendJson(response, 503, {
            configured: false,
            code: "FOOTBALL_DATA_KEY_MISSING",
            message: "Configure FOOTBALL_DATA_API_KEY em .env.local."
          });
          return;
        }

        try {
          if (url.pathname === "/competition") {
            sendJson(response, 200, await fetchFootballData("/competitions/PL/teams", apiKey));
            return;
          }

          if (url.pathname === "/team") {
            const teamId = Number(url.searchParams.get("id"));
            if (!Number.isInteger(teamId) || teamId < 1 || teamId > 999999) {
              sendJson(response, 400, { message: "Team id inválido." });
              return;
            }
            sendJson(response, 200, await fetchFootballData(`/teams/${teamId}`, apiKey));
            return;
          }

          sendJson(response, 404, { message: "Endpoint não encontrado." });
        } catch (error) {
          sendJson(response, error.status || 502, {
            message: error.message,
            provider: "football-data.org"
          });
        }
      });
    }
  };
}

function espnProxy() {
  return {
    name: "touchline-espn-premier-league-proxy",
    configureServer(server) {
      server.middlewares.use("/api/espn", async (request, response) => {
        const url = new URL(request.url || "/", "http://touchline.local");
        try {
          if (url.pathname === "/status") {
            sendJson(response, 200, {
              configured: true,
              provider: "ESPN public soccer feed",
              competition: "eng.1",
              cacheHours: ESPN_CACHE_TTL_MS / 3600000
            });
            return;
          }

          if (url.pathname === "/teams") {
            sendJson(response, 200, await fetchEspn("/teams"), "public, max-age=300");
            return;
          }

          if (url.pathname === "/roster") {
            const teamId = Number(url.searchParams.get("id"));
            if (!Number.isInteger(teamId) || teamId < 1 || teamId > 999999) {
              sendJson(response, 400, { message: "Team id inválido." });
              return;
            }
            sendJson(response, 200, await fetchEspn(`/teams/${teamId}/roster`), "public, max-age=300");
            return;
          }

          if (url.pathname === "/snapshot") {
            sendJson(response, 200, await fetchEspnSnapshot(), "public, max-age=300");
            return;
          }

          sendJson(response, 404, { message: "Endpoint ESPN não encontrado." });
        } catch (error) {
          sendJson(response, error.status || 502, {
            message: error.message,
            provider: "ESPN public soccer feed"
          });
        }
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [footballDataProxy(env.FOOTBALL_DATA_API_KEY), espnProxy()],
    server: {
      host: "0.0.0.0"
    },
    build: {
      target: "esnext"
    }
  };
});

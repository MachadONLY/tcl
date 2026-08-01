import { defineConfig, loadEnv } from "vite";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const FOOTBALL_DATA_ROOT = "https://api.football-data.org/v4";
const ESPN_ROOT = "https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1";
const API_FOOTBALL_ROOT = "https://v3.football.api-sports.io";
const SPORTS_DB_ROOT = "https://www.thesportsdb.com/api/v1/json/123";
const CACHE_TTL_MS = 30 * 60 * 1000;
const ESPN_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FACE_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const FACE_CACHE_DIR = join(process.cwd(), ".cache", "touchline-player-faces");
const cache = new Map();
const facePromises = new Map();

const ALLOWED_IMAGE_HOSTS = new Set([
  "a.espncdn.com",
  "cdn.espn.com",
  "media.api-sports.io",
  "upload.wikimedia.org",
  "commons.wikimedia.org",
  "www.thesportsdb.com",
  "r2.thesportsdb.com",
  "images.unsplash.com",
  "randomuser.me",
  "i.pravatar.cc"
]);

function sendJson(response, status, payload, cacheControl = "no-store") {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", cacheControl);
  response.end(JSON.stringify(payload));
}

function sendBuffer(response, status, buffer, contentType, cacheControl = "public, max-age=2592000, immutable") {
  response.statusCode = status;
  response.setHeader("Content-Type", contentType);
  response.setHeader("Content-Length", String(buffer.byteLength));
  response.setHeader("Cache-Control", cacheControl);
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(buffer);
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
      "User-Agent": "Touchline-Matchday-Prototype/0.5"
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
      "User-Agent": "Touchline-Career/0.5"
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

function safeImageUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !ALLOWED_IMAGE_HOSTS.has(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function initials(value) {
  return String(value || "Player")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || "")
    .join("") || "PL";
}

function portraitSvg(name) {
  const label = initials(name);
  const escapedName = String(name || "Premier League player")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
  return Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="360" height="420" viewBox="0 0 360 420" role="img" aria-label="${escapedName}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#edf5e8"/><stop offset="1" stop-color="#d9e8d1"/></linearGradient>
    <linearGradient id="kit" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#20261e"/><stop offset="1" stop-color="#11150f"/></linearGradient>
  </defs>
  <rect width="360" height="420" rx="38" fill="url(#bg)"/>
  <circle cx="180" cy="139" r="70" fill="#b9cbb0"/>
  <path d="M87 367c5-91 39-137 93-137s88 46 93 137" fill="url(#kit)"/>
  <path d="M142 205c11 15 24 22 38 22s27-7 38-22v53c-9 13-22 20-38 20s-29-7-38-20z" fill="#a9bea0"/>
  <circle cx="180" cy="342" r="39" fill="#65a83c" opacity=".95"/>
  <text x="180" y="352" text-anchor="middle" font-family="Arial, sans-serif" font-size="36" font-weight="800" fill="#fff">${label}</text>
</svg>`);
}

function faceCachePaths(key) {
  const digest = createHash("sha256").update(key).digest("hex");
  return {
    body: join(FACE_CACHE_DIR, `${digest}.bin`),
    meta: join(FACE_CACHE_DIR, `${digest}.json`)
  };
}

async function readFaceDiskCache(key) {
  const paths = faceCachePaths(key);
  try {
    const [body, rawMeta] = await Promise.all([readFile(paths.body), readFile(paths.meta, "utf8")]);
    const meta = JSON.parse(rawMeta);
    if (!meta.savedAt || Date.now() - meta.savedAt > FACE_CACHE_TTL_MS) return null;
    return { body, contentType: meta.contentType || "image/png", source: meta.source || "disk-cache" };
  } catch {
    return null;
  }
}

async function writeFaceDiskCache(key, result) {
  const paths = faceCachePaths(key);
  try {
    await mkdir(FACE_CACHE_DIR, { recursive: true });
    await Promise.all([
      writeFile(paths.body, result.body),
      writeFile(paths.meta, JSON.stringify({
        savedAt: Date.now(),
        contentType: result.contentType,
        source: result.source
      }))
    ]);
  } catch {
    // Cache failure must never block the game.
  }
}

async function downloadImage(url) {
  const safe = safeImageUrl(url);
  if (!safe) return null;
  try {
    const upstream = await fetch(safe, {
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
        "User-Agent": "Touchline-Career/0.5"
      },
      redirect: "follow",
      signal: AbortSignal.timeout(12000)
    });
    if (!upstream.ok) return null;
    const contentType = upstream.headers.get("content-type")?.split(";")[0] || "";
    if (!contentType.startsWith("image/")) return null;
    const body = Buffer.from(await upstream.arrayBuffer());
    if (body.byteLength < 500 || body.byteLength > 8 * 1024 * 1024) return null;
    return { body, contentType, source: safe };
  } catch {
    return null;
  }
}

async function sportsDbPortrait(name) {
  if (!name) return [];
  const key = `sportsdb:${name.toLowerCase()}`;
  const cached = getCached(key, FACE_CACHE_TTL_MS);
  if (cached) return cached;
  try {
    const payload = await fetchJson(`${SPORTS_DB_ROOT}/searchplayers.php?p=${encodeURIComponent(name)}`, {
      headers: { Accept: "application/json", "User-Agent": "Touchline-Career/0.5" }
    });
    const player = payload?.player?.[0];
    const candidates = [player?.strCutout, player?.strRender, player?.strThumb]
      .map(safeImageUrl)
      .filter(Boolean);
    setCached(key, candidates);
    return candidates;
  } catch {
    setCached(key, []);
    return [];
  }
}

async function apiFootballPortrait(name, apiKey) {
  if (!apiKey || !name || name.length < 4) return [];
  const search = name.trim().split(/\s+/).at(-1);
  const key = `api-football-face:${search.toLowerCase()}`;
  const cached = getCached(key, FACE_CACHE_TTL_MS);
  if (cached) return cached;
  try {
    const payload = await fetchJson(`${API_FOOTBALL_ROOT}/players/profiles?search=${encodeURIComponent(search)}`, {
      headers: { "x-apisports-key": apiKey, Accept: "application/json" }
    });
    const normalized = name.toLowerCase();
    const matches = (payload?.response || []).filter(item => {
      const candidate = String(item?.player?.name || `${item?.player?.firstname || ""} ${item?.player?.lastname || ""}`).toLowerCase();
      return candidate.includes(search.toLowerCase()) || normalized.includes(candidate);
    });
    const candidates = matches.map(item => safeImageUrl(item?.player?.photo)).filter(Boolean);
    setCached(key, candidates);
    return candidates;
  } catch {
    setCached(key, []);
    return [];
  }
}

function espnPortraitCandidates(providerId, size = 320) {
  if (!providerId || !/^\d+$/.test(String(providerId))) return [];
  const id = encodeURIComponent(String(providerId));
  const dimension = Math.max(96, Math.min(640, Number(size) || 320));
  return [
    `https://a.espncdn.com/i/headshots/soccer/players/full/${id}.png`,
    `https://a.espncdn.com/combiner/i?img=/i/headshots/soccer/players/full/${id}.png&w=${dimension}&h=${dimension}&scale=crop&cquality=82&location=origin`
  ];
}

async function resolvePortrait({ name, providerId, sources, size, apiFootballKey }) {
  const cacheKey = JSON.stringify({ name, providerId, sources, size });
  const disk = await readFaceDiskCache(cacheKey);
  if (disk) return disk;

  const candidates = [...new Set([
    ...sources,
    ...espnPortraitCandidates(providerId, size),
    ...(await apiFootballPortrait(name, apiFootballKey)),
    ...(await sportsDbPortrait(name))
  ].map(safeImageUrl).filter(Boolean))];

  for (const candidate of candidates) {
    const image = await downloadImage(candidate);
    if (image) {
      await writeFaceDiskCache(cacheKey, image);
      return image;
    }
  }

  const fallback = { body: portraitSvg(name), contentType: "image/svg+xml; charset=utf-8", source: "touchline-fallback" };
  await writeFaceDiskCache(cacheKey, fallback);
  return fallback;
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

function playerFaceProxy(apiFootballKey) {
  return {
    name: "touchline-player-face-proxy",
    configureServer(server) {
      server.middlewares.use("/api/player-face", async (request, response) => {
        const url = new URL(request.url || "/", "http://touchline.local");
        const name = String(url.searchParams.get("name") || "Premier League player").slice(0, 100);
        const providerId = String(url.searchParams.get("providerId") || "").replace(/\D/g, "").slice(0, 20);
        const size = Number(url.searchParams.get("size") || 320);
        const sources = [
          url.searchParams.get("src"),
          ...url.searchParams.getAll("fallback")
        ].map(safeImageUrl).filter(Boolean).slice(0, 8);
        const promiseKey = JSON.stringify({ name, providerId, sources, size });

        try {
          let pending = facePromises.get(promiseKey);
          if (!pending) {
            pending = resolvePortrait({ name, providerId, sources, size, apiFootballKey });
            facePromises.set(promiseKey, pending);
            pending.finally(() => facePromises.delete(promiseKey));
          }
          const portrait = await pending;
          response.setHeader("X-Touchline-Portrait-Source", portrait.source);
          sendBuffer(response, 200, portrait.body, portrait.contentType);
        } catch {
          sendBuffer(response, 200, portraitSvg(name), "image/svg+xml; charset=utf-8", "no-store");
        }
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [
      footballDataProxy(env.FOOTBALL_DATA_API_KEY),
      espnProxy(),
      playerFaceProxy(env.API_FOOTBALL_KEY || env.API_SPORTS_KEY)
    ],
    server: {
      host: "0.0.0.0"
    },
    build: {
      target: "esnext"
    }
  };
});

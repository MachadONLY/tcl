const CACHE_VERSION = "touchline-offline-v16";
const APP_CACHE = `${CACHE_VERSION}-app`;
const MEDIA_CACHE = `${CACHE_VERSION}-media`;
const CORE = ["/", "/index.html", "/assets/clubs/2026-27/manifest.json"];

function sameOriginPath(value) {
  try {
    const url = new URL(value, self.location.origin);
    return url.origin === self.location.origin ? `${url.pathname}${url.search}` : null;
  } catch {
    return null;
  }
}

async function cacheIndividually(cache, paths) {
  await Promise.allSettled([...new Set(paths.filter(Boolean))].map(async path => {
    const response = await fetch(path, { cache: "reload" });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    await cache.put(path, response);
  }));
}

async function discoverApplicationAssets() {
  const response = await fetch("/index.html", { cache: "reload" });
  if (!response.ok) throw new Error(`index HTTP ${response.status}`);
  const html = await response.clone().text();
  const assets = [];
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    const path = sameOriginPath(match[1]);
    if (path) assets.push(path);
  }
  return { response, assets };
}

async function discoverMediaAssets() {
  const response = await fetch("/assets/clubs/2026-27/manifest.json", { cache: "reload" });
  if (!response.ok) throw new Error(`manifest HTTP ${response.status}`);
  const manifest = await response.clone().json();
  const assets = [];
  for (const entry of Object.values(manifest.clubs || {})) {
    for (const key of ["crest", "city", "stadium", "backdrop", "manager", "homeKit", "awayKit", "rivalCrest"]) {
      const path = sameOriginPath(entry?.[key]);
      if (path) assets.push(path);
    }
  }
  return { response, assets };
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const [appCache, mediaCache] = await Promise.all([
      caches.open(APP_CACHE),
      caches.open(MEDIA_CACHE)
    ]);
    const [application, media] = await Promise.all([
      discoverApplicationAssets(),
      discoverMediaAssets()
    ]);
    await appCache.put("/index.html", application.response.clone());
    await appCache.put("/", application.response.clone());
    await mediaCache.put("/assets/clubs/2026-27/manifest.json", media.response.clone());
    await Promise.all([
      cacheIndividually(appCache, [...CORE, ...application.assets]),
      cacheIndividually(mediaCache, media.assets)
    ]);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("touchline-") && ![APP_CACHE, MEDIA_CACHE].includes(key)).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function cachedResponse(request) {
  const cached = await caches.match(request, { ignoreSearch: false });
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok && request.url.startsWith(self.location.origin)) {
      const target = request.url.includes("/assets/clubs/2026-27/") ? MEDIA_CACHE : APP_CACHE;
      const cache = await caches.open(target);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (error) {
    if (request.mode === "navigate") {
      const fallback = await caches.match("/index.html");
      if (fallback) return fallback;
    }
    throw error;
  }
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(cachedResponse(request));
});

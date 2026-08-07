const CACHE_VERSION = "touchline-offline-v17";
const APP_CACHE = `${CACHE_VERSION}-app`;
const MEDIA_CACHE = `${CACHE_VERSION}-media`;
const CORE = ["/", "/index.html", "/assets/clubs/2026-27/manifest.json"];
const DEVELOPMENT_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function sameOriginPath(value) {
  try {
    const url = new URL(value, self.location.origin);
    return url.origin === self.location.origin ? `${url.pathname}${url.search}` : null;
  } catch {
    return null;
  }
}

function isApplicationCode(request, url) {
  return request.mode === "navigate" ||
    url.pathname === "/" ||
    url.pathname === "/index.html" ||
    url.pathname.startsWith("/src/") ||
    /\.(?:html|m?js|css)$/i.test(url.pathname);
}

function isMediaAsset(url) {
  return url.pathname.startsWith("/assets/") &&
    /\.(?:png|jpe?g|webp|gif|svg|avif|woff2?)$/i.test(url.pathname);
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
    if (DEVELOPMENT_HOSTS.has(self.location.hostname)) {
      await self.skipWaiting();
      return;
    }
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
    const validCaches = DEVELOPMENT_HOSTS.has(self.location.hostname) ? [] : [APP_CACHE, MEDIA_CACHE];
    await Promise.all(
      keys
        .filter(key => key.startsWith("touchline-") && !validCaches.includes(key))
        .map(key => caches.delete(key))
    );
    await self.clients.claim();
  })());
});

async function networkFirst(request) {
  try {
    const response = await fetch(request, { cache: "no-store" });
    if (response.ok && request.url.startsWith(self.location.origin)) {
      const cache = await caches.open(APP_CACHE);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request, { ignoreSearch: false });
    if (cached) return cached;
    if (request.mode === "navigate") {
      const fallback = await caches.match("/index.html");
      if (fallback) return fallback;
    }
    throw error;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request, { ignoreSearch: false });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && request.url.startsWith(self.location.origin)) {
    const cache = await caches.open(MEDIA_CACHE);
    cache.put(request, response.clone()).catch(() => {});
  }
  return response;
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (DEVELOPMENT_HOSTS.has(self.location.hostname)) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  if (isApplicationCode(request, url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isMediaAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(networkFirst(request));
});

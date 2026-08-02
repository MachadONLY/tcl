const CACHE_KEY = "touchline:onboarding-fetch-cache:v1";
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const MAX_ENTRY_SIZE = 320_000;
const CACHEABLE_HOSTS = new Set([
  "en.wikipedia.org",
  "www.thesportsdb.com"
]);

const originalFetch = window.fetch.bind(window);
const inflight = new Map();
let persisted = null;
let persistTimer = 0;

function loadPersisted() {
  if (persisted) return persisted;
  try {
    const value = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    persisted = value && typeof value === "object" ? value : {};
  } catch {
    persisted = {};
  }
  return persisted;
}

function schedulePersist() {
  window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(loadPersisted()));
    } catch {
      persisted = {};
      try { localStorage.removeItem(CACHE_KEY); } catch { /* storage unavailable */ }
    }
  }, 120);
}

function cacheKey(request) {
  return request.url;
}

function cachedResponse(key) {
  const entry = loadPersisted()[key];
  if (!entry || Date.now() - Number(entry.savedAt || 0) > CACHE_TTL) {
    if (entry) {
      delete loadPersisted()[key];
      schedulePersist();
    }
    return null;
  }
  return new Response(entry.body, {
    status: entry.status || 200,
    headers: { "content-type": entry.contentType || "application/json" }
  });
}

async function persistResponse(key, response) {
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !/(?:json|text)/i.test(contentType)) return;
  try {
    const body = await response.clone().text();
    if (!body || body.length > MAX_ENTRY_SIZE) return;
    loadPersisted()[key] = {
      body,
      contentType,
      status: response.status,
      savedAt: Date.now()
    };
    schedulePersist();
  } catch {
    // Network response remains usable even when persistence fails.
  }
}

window.fetch = async function touchlineCachedFetch(input, init) {
  let request;
  try {
    request = input instanceof Request ? input : new Request(input, init);
  } catch {
    return originalFetch(input, init);
  }

  let host = "";
  try { host = new URL(request.url).hostname; } catch { /* use normal fetch */ }
  if (request.method !== "GET" || !CACHEABLE_HOSTS.has(host)) {
    return originalFetch(input, init);
  }

  const key = cacheKey(request);
  const cached = cachedResponse(key);
  if (cached) return cached;

  if (!inflight.has(key)) {
    const pending = originalFetch(request)
      .then(async response => {
        await persistResponse(key, response);
        return response;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }

  const response = await inflight.get(key);
  return response.clone();
};

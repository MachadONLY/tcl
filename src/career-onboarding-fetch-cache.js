const CACHE_KEY = "touchline:onboarding-fetch-cache:v2";
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
const JINA_TTL = 12 * 60 * 60 * 1000;
const MAX_ENTRY_SIZE = 950_000;
const MAX_ENTRIES = 24;
const MAX_TOTAL_CHARS = 3_100_000;
const CACHEABLE_HOSTS = new Set([
  "en.wikipedia.org",
  "www.thesportsdb.com",
  "r.jina.ai"
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

function prunePersisted() {
  const entries = Object.entries(loadPersisted())
    .filter(([, entry]) => entry && typeof entry.body === "string")
    .sort((a, b) => Number(b[1].savedAt || 0) - Number(a[1].savedAt || 0));
  let total = 0;
  const keep = new Set();
  entries.forEach(([key, entry], index) => {
    const size = entry.body.length;
    if (index < MAX_ENTRIES && total + size <= MAX_TOTAL_CHARS) {
      keep.add(key);
      total += size;
    }
  });
  Object.keys(loadPersisted()).forEach(key => {
    if (!keep.has(key)) delete loadPersisted()[key];
  });
}

function schedulePersist() {
  window.clearTimeout(persistTimer);
  persistTimer = window.setTimeout(() => {
    try {
      prunePersisted();
      localStorage.setItem(CACHE_KEY, JSON.stringify(loadPersisted()));
    } catch {
      persisted = {};
      try { localStorage.removeItem(CACHE_KEY); } catch { /* storage unavailable */ }
    }
  }, 120);
}

function requestTtl(request) {
  try { return new URL(request.url).hostname === "r.jina.ai" ? JINA_TTL : CACHE_TTL; }
  catch { return CACHE_TTL; }
}

function cachedResponse(request) {
  const key = request.url;
  const entry = loadPersisted()[key];
  if (!entry || Date.now() - Number(entry.savedAt || 0) > requestTtl(request)) {
    if (entry) {
      delete loadPersisted()[key];
      schedulePersist();
    }
    return null;
  }
  return new Response(entry.body, {
    status: entry.status || 200,
    headers: { "content-type": entry.contentType || "text/plain;charset=utf-8" }
  });
}

async function persistResponse(request, response) {
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !/(?:json|text|markdown)/i.test(contentType)) return;
  try {
    const body = await response.clone().text();
    if (!body || body.length > MAX_ENTRY_SIZE) return;
    loadPersisted()[request.url] = {
      body,
      contentType,
      status: response.status,
      savedAt: Date.now()
    };
    schedulePersist();
  } catch {
    // The live response stays usable if persistence fails.
  }
}

function legacyKitResponse(request) {
  if (!window.__touchlineKitPipeline) return null;
  let url;
  try { url = new URL(request.url); } catch { return null; }
  if (url.hostname === "r.jina.ai" && url.pathname.includes("premierleague.com/en/news/4658330")) {
    return new Response("", { status: 200, headers: { "content-type": "text/plain;charset=utf-8" } });
  }
  if (url.hostname === "www.thesportsdb.com" && url.pathname.endsWith("/lookupequipment.php")) {
    return new Response('{"equipment":[]}', { status: 200, headers: { "content-type": "application/json" } });
  }
  return null;
}

window.fetch = async function touchlineCachedFetch(input, init) {
  let request;
  try {
    request = input instanceof Request ? input : new Request(input, init);
  } catch {
    return originalFetch(input, init);
  }

  const legacy = legacyKitResponse(request);
  if (legacy) return legacy;

  let host = "";
  try { host = new URL(request.url).hostname; } catch { /* normal fetch below */ }
  if (request.method !== "GET" || !CACHEABLE_HOSTS.has(host)) {
    return originalFetch(input, init);
  }

  const cached = cachedResponse(request);
  if (cached) return cached;

  const key = request.url;
  if (!inflight.has(key)) {
    const pending = originalFetch(request)
      .then(async response => {
        await persistResponse(request, response);
        return response;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }

  const response = await inflight.get(key);
  return response.clone();
};

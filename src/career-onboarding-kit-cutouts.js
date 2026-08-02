import "./career-onboarding-kit-pipeline.css";

window.__touchlineKitPipeline = true;

const SEASON = "2026/27";
const OVERVIEW_URL = "https://www.footyheadlines.com/26-27-kit-overview/";
const OVERVIEW_READER = "https://r.jina.ai/http://www.footyheadlines.com/26-27-kit-overview/";
const DB_NAME = "touchline-kit-media-v3";
const DB_STORE = "kits";
const DB_VERSION = 1;
const MANIFEST_KEY = "touchline:footy-headlines-kit-manifest:v3";
const MANIFEST_TTL = 12 * 60 * 60 * 1000;
const IMAGE_SIZE = 360;
const ARTICLE_CONCURRENCY = 2;

const CLUBS = Object.freeze({
  ARS: { name: "Arsenal", aliases: ["arsenal"] },
  AVL: { name: "Aston Villa", aliases: ["aston villa"] },
  BOU: { name: "Bournemouth", aliases: ["bournemouth", "afc bournemouth"] },
  BRE: { name: "Brentford", aliases: ["brentford", "brentford fc"] },
  BHA: { name: "Brighton", aliases: ["brighton", "brighton hove albion"] },
  CHE: { name: "Chelsea", aliases: ["chelsea"] },
  COV: { name: "Coventry", aliases: ["coventry", "coventry city"] },
  CRY: { name: "Crystal Palace", aliases: ["crystal palace"] },
  EVE: { name: "Everton", aliases: ["everton"] },
  FUL: { name: "Fulham", aliases: ["fulham"] },
  HUL: { name: "Hull City", aliases: ["hull city", "hull"] },
  IPS: { name: "Ipswich Town", aliases: ["ipswich town", "ipswich"] },
  LEE: { name: "Leeds United", aliases: ["leeds united", "leeds"] },
  LIV: { name: "Liverpool", aliases: ["liverpool"] },
  MCI: { name: "Manchester City", aliases: ["manchester city", "man city"] },
  MUN: { name: "Manchester United", aliases: ["manchester united", "man united", "man utd"] },
  NEW: { name: "Newcastle United", aliases: ["newcastle united", "newcastle"] },
  NFO: { name: "Nottingham Forest", aliases: ["nottingham forest", "nott m forest"] },
  SUN: { name: "Sunderland", aliases: ["sunderland"] },
  TOT: { name: "Tottenham", aliases: ["tottenham", "tottenham hotspur", "spurs"] }
});

const VERIFIED_FLATLAYS = Object.freeze({
  MUN: {
    home: "https://assets.adidas.com/images/w_600,f_auto,q_auto/7d4fa15a9acf4108a10cfe78e1cf5ff4_9366/Manchester_United_26-27_Home_Jersey_Red_KA6871_01_laydown.jpg"
  }
});

const textPromises = new Map();
const articlePromises = new Map();
const mediaPromises = new Map();
const memoryUrls = new Map();
const activeObjectUrls = new Set();
let overviewPromise = null;
let renderToken = 0;
let refreshTimer = 0;
let observerMuted = false;
let prewarmTimer = 0;
let dbPromise = null;
let backgroundQueueRunning = false;

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&amp;/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function selectedCode() {
  return document.querySelector(".club-rail-item.selected span")?.textContent?.trim().toUpperCase() || "";
}

function detailsPanel() {
  return document.querySelector("[data-club-details]");
}

function readerUrl(url) {
  const parsed = new URL(url);
  return `https://r.jina.ai/http://${parsed.host}${parsed.pathname}${parsed.search}`;
}

function proxiedWebp(source, size = 460) {
  const url = new URL("https://images.weserv.nl/");
  url.searchParams.set("url", source);
  url.searchParams.set("w", String(size));
  url.searchParams.set("h", String(size));
  url.searchParams.set("fit", "contain");
  url.searchParams.set("output", "webp");
  url.searchParams.set("q", "84");
  url.searchParams.set("trim", "8");
  url.searchParams.set("we", "1");
  return url.toString();
}

async function fetchText(url, timeout = 14000) {
  if (textPromises.has(url)) return textPromises.get(url);
  const pending = (async () => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "text/plain,text/markdown;q=0.9,*/*;q=0.7" }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } finally {
      window.clearTimeout(timer);
    }
  })().catch(error => {
    textPromises.delete(url);
    throw error;
  });
  textPromises.set(url, pending);
  return pending;
}

function loadStoredManifest() {
  try {
    const stored = JSON.parse(localStorage.getItem(MANIFEST_KEY) || "null");
    if (!stored || typeof stored !== "object") return null;
    if (Date.now() - Number(stored.savedAt || 0) > MANIFEST_TTL) return null;
    return stored.data && typeof stored.data === "object" ? stored.data : null;
  } catch {
    return null;
  }
}

function storeManifest(data) {
  try {
    localStorage.setItem(MANIFEST_KEY, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    // Runtime parsing remains available when storage is unavailable.
  }
}

function absoluteUrl(raw, base = OVERVIEW_URL) {
  try {
    return new URL(String(raw || "").replaceAll("&amp;", "&"), base).toString();
  } catch {
    return null;
  }
}

function codeForLabel(label) {
  const wanted = normalize(label);
  return Object.entries(CLUBS).find(([, club]) => club.aliases.some(alias => wanted === normalize(alias)))?.[0] || "";
}

function parseOverview(markdown) {
  const section = String(markdown || "").split(/\n##\s+La Liga\b/i)[0].split(/##\s+Premier League\b/i)[1] || "";
  const result = {};
  let currentCode = "";
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]+)\)/g;
  let match;

  while ((match = linkPattern.exec(section))) {
    const label = match[1].replace(/[*_`]/g, "").trim();
    const url = absoluteUrl(match[2]);
    if (!url) continue;

    const clubCode = codeForLabel(label);
    if (clubCode) {
      currentCode = clubCode;
      result[currentCode] ||= {};
      continue;
    }

    if (!currentCode) continue;
    const roleLabel = normalize(label);
    if (/\bhome\b/.test(roleLabel)) result[currentCode].home = url;
    if (/\baway\b/.test(roleLabel)) result[currentCode].away = url;
  }

  return result;
}

async function loadOverview() {
  if (overviewPromise) return overviewPromise;
  const stored = loadStoredManifest();
  if (stored) {
    overviewPromise = Promise.resolve(stored);
    window.setTimeout(() => {
      fetchText(OVERVIEW_READER).then(markdown => {
        const fresh = parseOverview(markdown);
        if (Object.keys(fresh).length >= 15) storeManifest(fresh);
      }).catch(() => {});
    }, 4500);
    return overviewPromise;
  }

  overviewPromise = fetchText(OVERVIEW_READER).then(markdown => {
    const manifest = parseOverview(markdown);
    if (Object.keys(manifest).length >= 15) storeManifest(manifest);
    return manifest;
  }).catch(() => ({}));
  return overviewPromise;
}

function articleIsOfficial(markdown) {
  const top = String(markdown || "").slice(0, 5000);
  return /(?:^|\n)OFFICIAL(?:\n|$)/i.test(top)
    || /\b(?:officially\s+(?:unveiled|launched|released)|kit\s+released)\b/i.test(top);
}

function extractImages(markdown, articleUrl) {
  const text = String(markdown || "");
  const results = [];
  const regex = /!\[([^\]]*)\]\((https?:\/\/[^)\s]+|\/[^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match;

  while ((match = regex.exec(text))) {
    const source = absoluteUrl(match[2], articleUrl);
    if (!source) continue;
    const context = text.slice(Math.max(0, match.index - 260), Math.min(text.length, regex.lastIndex + 260));
    results.push({ source, alt: match[1] || "", context });
  }

  return results.filter((entry, index, list) => list.findIndex(item => item.source === entry.source) === index);
}

function forbiddenCandidate(candidate) {
  const text = normalize(`${candidate.source} ${candidate.alt} ${candidate.context}`);
  return /\b(?:avatar|author|profile|logo|badge|crest|icon|favicon|advert|banner|social|boot|shoe|shorts|socks|training|pre match|goalkeeper|gk|stadium|store|sponsor)\b/.test(text)
    || /\b(?:player|players|model|models|person|people|worn|wearing|lifestyle|campaign|launch event|team photo|squad)\b/.test(text);
}

function candidateScore(candidate, code, role) {
  if (forbiddenCandidate(candidate)) return -1000;
  const club = CLUBS[code];
  const text = normalize(`${candidate.alt} ${candidate.context} ${candidate.source}`);
  let score = 0;
  if (club.aliases.some(alias => text.includes(normalize(alias)))) score += 24;
  if (text.includes(role)) score += 30;
  if (/\b(?:shirt|jersey|football shirt|kit)\b/.test(text)) score += 26;
  if (/\b(?:front|flat|flatlay|laydown|product|replica|authentic|render)\b/.test(text)) score += 18;
  if (/\b26 27\b|\b2026 27\b|\b2026 2027\b/.test(text)) score += 12;
  if (/\b(?:full kit|shorts|socks|back view|long sleeve)\b/.test(text)) score -= 18;
  if (/\.(?:png|webp)(?:\?|$)/i.test(candidate.source)) score += 5;
  return score;
}

function loadImage(source, priority = "auto") {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.referrerPolicy = "no-referrer";
    image.decoding = "async";
    try { image.fetchPriority = priority; } catch { /* unsupported */ }
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image-load-failed"));
    image.src = source;
    if (image.complete && image.naturalWidth) resolve(image);
  });
}

function isBackgroundPixel(data, offset) {
  const alpha = data[offset + 3];
  if (alpha < 28) return true;
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return r > 238 && g > 238 && b > 238 && max - min < 18;
}

function inspectImage(image) {
  const size = 80;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.clearRect(0, 0, size, size);
  context.drawImage(image, 0, 0, size, size);
  let data;
  try { data = context.getImageData(0, 0, size, size).data; } catch { return { acceptable: true, score: 0 }; }

  let edgeBackground = 0;
  let edgeCount = 0;
  let centerForeground = 0;
  let centerCount = 0;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const edge = x < 7 || y < 7 || x >= size - 7 || y >= size - 7;
      if (edge) {
        edgeCount += 1;
        if (isBackgroundPixel(data, offset)) edgeBackground += 1;
      }
      if (x > 18 && x < 62 && y > 10 && y < 72) {
        centerCount += 1;
        if (!isBackgroundPixel(data, offset)) centerForeground += 1;
      }
    }
  }

  const edgeRatio = edgeBackground / Math.max(1, edgeCount);
  const centerRatio = centerForeground / Math.max(1, centerCount);
  const aspect = image.naturalWidth / Math.max(1, image.naturalHeight);
  const acceptable = edgeRatio > 0.5 && centerRatio > 0.06 && aspect > 0.48 && aspect < 1.55;
  return { acceptable, score: edgeRatio * 32 + centerRatio * 12 - Math.abs(1 - aspect) * 4 };
}

async function chooseCandidate(candidates, code, role) {
  const ranked = candidates
    .map(candidate => ({ ...candidate, baseScore: candidateScore(candidate, code, role) }))
    .filter(candidate => candidate.baseScore > -100)
    .sort((a, b) => b.baseScore - a.baseScore)
    .slice(0, 8);

  let best = null;
  for (const candidate of ranked) {
    const optimized = proxiedWebp(candidate.source, 260);
    try {
      const image = await loadImage(optimized, "low");
      const inspection = inspectImage(image);
      if (!inspection.acceptable) continue;
      const totalScore = candidate.baseScore + inspection.score;
      if (!best || totalScore > best.score) best = { source: candidate.source, optimized, score: totalScore };
      if (totalScore >= 72) break;
    } catch {
      // Continue to the next article image.
    }
  }
  return best;
}

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise(resolve => {
    if (!("indexedDB" in window)) return resolve(null);
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
  return dbPromise;
}

async function dbGet(key) {
  const db = await openDb();
  if (!db) return null;
  return new Promise(resolve => {
    const request = db.transaction(DB_STORE, "readonly").objectStore(DB_STORE).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
  });
}

async function dbPut(key, value) {
  const db = await openDb();
  if (!db) return;
  return new Promise(resolve => {
    const request = db.transaction(DB_STORE, "readwrite").objectStore(DB_STORE).put(value, key);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
  });
}

function blobUrl(key, blob) {
  if (memoryUrls.has(key)) return memoryUrls.get(key);
  const url = URL.createObjectURL(blob);
  memoryUrls.set(key, url);
  activeObjectUrls.add(url);
  return url;
}

function kitKey(code, role) {
  return `v3:${code}:${role}`;
}

function floodRemoveWhiteBackground(image, sourceUrl) {
  const sourceSize = Math.min(520, Math.max(220, image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = sourceSize;
  canvas.height = sourceSize;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.clearRect(0, 0, sourceSize, sourceSize);

  const scale = Math.min(sourceSize / image.naturalWidth, sourceSize / image.naturalHeight);
  const drawWidth = Math.round(image.naturalWidth * scale);
  const drawHeight = Math.round(image.naturalHeight * scale);
  const drawX = Math.round((sourceSize - drawWidth) / 2);
  const drawY = Math.round((sourceSize - drawHeight) / 2);
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

  let frame;
  try { frame = context.getImageData(0, 0, sourceSize, sourceSize); } catch { return Promise.resolve(null); }
  const data = frame.data;
  const visited = new Uint8Array(sourceSize * sourceSize);
  const queue = new Int32Array(sourceSize * sourceSize);
  let head = 0;
  let tail = 0;

  const enqueue = index => {
    if (index < 0 || index >= visited.length || visited[index]) return;
    visited[index] = 1;
    queue[tail++] = index;
  };

  for (let x = 0; x < sourceSize; x += 1) {
    enqueue(x);
    enqueue((sourceSize - 1) * sourceSize + x);
  }
  for (let y = 1; y < sourceSize - 1; y += 1) {
    enqueue(y * sourceSize);
    enqueue(y * sourceSize + sourceSize - 1);
  }

  while (head < tail) {
    const index = queue[head++];
    const offset = index * 4;
    if (!isBackgroundPixel(data, offset)) continue;
    data[offset + 3] = 0;
    const x = index % sourceSize;
    const y = Math.floor(index / sourceSize);
    if (x > 0) enqueue(index - 1);
    if (x < sourceSize - 1) enqueue(index + 1);
    if (y > 0) enqueue(index - sourceSize);
    if (y < sourceSize - 1) enqueue(index + sourceSize);
  }

  context.putImageData(frame, 0, 0);

  let minX = sourceSize;
  let minY = sourceSize;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < sourceSize; y += 1) {
    for (let x = 0; x < sourceSize; x += 1) {
      const alpha = data[(y * sourceSize + x) * 4 + 3];
      if (alpha < 20) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) return Promise.resolve(null);

  const output = document.createElement("canvas");
  output.width = IMAGE_SIZE;
  output.height = IMAGE_SIZE;
  const outputContext = output.getContext("2d");
  const contentWidth = maxX - minX + 1;
  const contentHeight = maxY - minY + 1;
  const padding = 22;
  const outputScale = Math.min((IMAGE_SIZE - padding * 2) / contentWidth, (IMAGE_SIZE - padding * 2) / contentHeight);
  const outWidth = Math.round(contentWidth * outputScale);
  const outHeight = Math.round(contentHeight * outputScale);
  const outX = Math.round((IMAGE_SIZE - outWidth) / 2);
  const outY = Math.round((IMAGE_SIZE - outHeight) / 2);
  outputContext.clearRect(0, 0, IMAGE_SIZE, IMAGE_SIZE);
  outputContext.drawImage(canvas, minX, minY, contentWidth, contentHeight, outX, outY, outWidth, outHeight);

  return new Promise(resolve => {
    output.toBlob(blob => resolve(blob ? { blob, sourceUrl } : null), "image/webp", 0.86);
  });
}

async function createCachedWebp(source, code, role) {
  const optimized = proxiedWebp(source, 520);
  const image = await loadImage(optimized, "high");
  const processed = await floodRemoveWhiteBackground(image, source);
  if (!processed?.blob) return { displayUrl: optimized, source, cached: false };
  const record = {
    blob: processed.blob,
    source,
    savedAt: Date.now(),
    season: SEASON,
    contentType: "image/webp"
  };
  await dbPut(kitKey(code, role), record);
  return { displayUrl: blobUrl(kitKey(code, role), record.blob), source, cached: true };
}

async function loadArticle(articleUrl) {
  if (articlePromises.has(articleUrl)) return articlePromises.get(articleUrl);
  const pending = fetchText(readerUrl(articleUrl)).then(markdown => ({
    markdown,
    official: articleIsOfficial(markdown),
    images: extractImages(markdown, articleUrl)
  })).catch(() => ({ markdown: "", official: false, images: [] }));
  articlePromises.set(articleUrl, pending);
  return pending;
}

async function resolveSource(code, role) {
  const verified = VERIFIED_FLATLAYS[code]?.[role];
  if (verified) return { source: verified, official: true, articleUrl: null };

  const manifest = await loadOverview();
  const articleUrl = manifest?.[code]?.[role] || null;
  if (!articleUrl) return null;
  const article = await loadArticle(articleUrl);
  if (!article.images.length) return null;

  const candidate = await chooseCandidate(article.images, code, role);
  if (!candidate) return null;
  return { source: candidate.source, optimized: candidate.optimized, official: article.official, articleUrl };
}

async function resolveKit(code, role, { priority = false } = {}) {
  const key = kitKey(code, role);
  if (mediaPromises.has(key)) return mediaPromises.get(key);

  const pending = (async () => {
    const cached = await dbGet(key);
    if (cached?.blob && cached.season === SEASON) {
      return {
        displayUrl: blobUrl(key, cached.blob),
        source: cached.source || "",
        official: cached.official !== false,
        cached: true
      };
    }

    const resolved = await resolveSource(code, role);
    if (!resolved?.source) return null;

    const immediate = resolved.optimized || proxiedWebp(resolved.source, priority ? 420 : 320);
    try {
      const processed = await createCachedWebp(resolved.source, code, role);
      const record = await dbGet(key);
      if (record) {
        record.official = resolved.official;
        record.articleUrl = resolved.articleUrl;
        await dbPut(key, record);
      }
      return { ...processed, official: resolved.official, articleUrl: resolved.articleUrl, immediate };
    } catch {
      return {
        displayUrl: immediate,
        source: resolved.source,
        official: resolved.official,
        articleUrl: resolved.articleUrl,
        cached: false
      };
    }
  })();

  mediaPromises.set(key, pending);
  const result = await pending;
  if (!result) mediaPromises.delete(key);
  return result;
}

function loadingMarkup(label) {
  return `<figure class="club-kit-pipeline club-kit-loading" aria-busy="true">
    <div class="club-kit-loader"><span></span></div>
    <figcaption><strong>${label}</strong><span>CARREGANDO 26/27</span></figcaption>
  </figure>`;
}

function pendingMarkup(label) {
  return `<figure class="club-kit-pipeline club-kit-unavailable">
    <div><span aria-hidden="true">◇</span><strong>KIT 26/27</strong><small>IMAGEM ISOLADA NÃO PUBLICADA</small></div>
    <figcaption><strong>${label}</strong><span>AGUARDANDO FONTE</span></figcaption>
  </figure>`;
}

function kitMarkup(asset, label, code, role) {
  const status = asset.official ? "OFICIAL 26/27" : "PRÉVIA 26/27";
  const sourceLink = asset.articleUrl || asset.source || "";
  return `<figure class="club-kit-pipeline club-kit-ready" data-club="${escapeHtml(code)}" data-role="${escapeHtml(role)}">
    <div class="club-kit-stage">
      <img src="${escapeHtml(asset.displayUrl)}" alt="Camisa ${label.toLowerCase()} ${SEASON} do ${escapeHtml(CLUBS[code].name)}" decoding="async" loading="eager" fetchpriority="high" referrerpolicy="no-referrer" />
    </div>
    <figcaption><strong>${label}</strong><span>${status}</span></figcaption>
    ${sourceLink ? `<span class="club-kit-source" data-source="${escapeHtml(sourceLink)}" aria-hidden="true"></span>` : ""}
  </figure>`;
}

function setSlot(slot, markup) {
  observerMuted = true;
  slot.innerHTML = markup;
  requestAnimationFrame(() => { observerMuted = false; });
}

async function paintRole(slot, code, role, label, token) {
  const key = kitKey(code, role);
  const cached = await dbGet(key);
  if (token !== renderToken || selectedCode() !== code || detailsPanel() !== slot.closest("[data-club-details]")) return;

  if (cached?.blob && cached.season === SEASON) {
    setSlot(slot, kitMarkup({
      displayUrl: blobUrl(key, cached.blob),
      source: cached.source || "",
      official: cached.official !== false,
      articleUrl: cached.articleUrl || null
    }, label, code, role));
    return;
  }

  setSlot(slot, loadingMarkup(label));
  const asset = await resolveKit(code, role, { priority: true });
  if (token !== renderToken || selectedCode() !== code || detailsPanel() !== slot.closest("[data-club-details]")) return;
  setSlot(slot, asset ? kitMarkup(asset, label, code, role) : pendingMarkup(label));
}

async function paintCurrentClub() {
  const code = selectedCode();
  const details = detailsPanel();
  if (!code || !CLUBS[code] || !details) return;
  const slots = [...details.querySelectorAll(".club-kit-slot")];
  if (slots.length < 2) return;
  const token = ++renderToken;
  details.dataset.kitPipelineCode = code;

  await Promise.all([
    paintRole(slots[0], code, "home", "CASA", token),
    paintRole(slots[1], code, "away", "FORA", token)
  ]);
  scheduleAdjacentPrewarm(code);
}

function railCodes() {
  return [...document.querySelectorAll(".club-rail-item span")]
    .map(node => node.textContent?.trim().toUpperCase() || "")
    .filter(code => CLUBS[code]);
}

function prewarmClub(code) {
  if (!CLUBS[code] || document.hidden) return Promise.resolve();
  return Promise.allSettled([
    resolveKit(code, "home"),
    resolveKit(code, "away")
  ]);
}

function scheduleAdjacentPrewarm(code) {
  window.clearTimeout(prewarmTimer);
  prewarmTimer = window.setTimeout(() => {
    const codes = railCodes();
    const index = codes.indexOf(code);
    if (index < 0) return;
    const neighbours = [
      codes[index - 1], codes[index + 1],
      codes[index - 2], codes[index + 2]
    ].filter(Boolean);
    const run = async () => {
      for (const neighbour of neighbours) await prewarmClub(neighbour);
      warmRemainingClubs(codes, new Set([code, ...neighbours]));
    };
    if ("requestIdleCallback" in window) requestIdleCallback(() => run(), { timeout: 2600 });
    else window.setTimeout(run, 600);
  }, 180);
}

async function warmRemainingClubs(codes, skipped) {
  if (backgroundQueueRunning || document.hidden) return;
  backgroundQueueRunning = true;
  const queue = codes.filter(code => !skipped.has(code));
  let cursor = 0;

  const worker = async () => {
    while (cursor < queue.length && !document.hidden) {
      const code = queue[cursor++];
      await prewarmClub(code);
      await new Promise(resolve => window.setTimeout(resolve, 180));
    }
  };

  await Promise.all(Array.from({ length: ARTICLE_CONCURRENCY }, worker));
  backgroundQueueRunning = false;
}

function scheduleRefresh(delay = 0) {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => {
    if (!document.querySelector(".career-club-selection")) return;
    paintCurrentClub();
  }, delay);
}

const observer = new MutationObserver(mutations => {
  if (observerMuted) return;
  const relevant = mutations.some(mutation => {
    if (mutation.type === "attributes") {
      return mutation.target instanceof Element && mutation.target.matches(".club-rail-item");
    }
    return [...mutation.addedNodes].some(node => node instanceof Element && (
      node.matches?.("[data-club-details], .club-kit-slot")
      || node.querySelector?.("[data-club-details], .club-kit-slot")
    ));
  });
  if (relevant) scheduleRefresh(24);
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["class"]
});

document.addEventListener("click", event => {
  if (!event.target.closest("[data-club-index], [data-club-step]")) return;
  scheduleRefresh(0);
}, true);
window.addEventListener("hashchange", () => scheduleRefresh(30));
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) scheduleRefresh(0);
});
document.addEventListener("DOMContentLoaded", () => scheduleRefresh(20), { once: true });
window.addEventListener("beforeunload", () => {
  activeObjectUrls.forEach(url => URL.revokeObjectURL(url));
});
scheduleRefresh(30);

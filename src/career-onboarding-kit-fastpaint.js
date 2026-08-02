const FAST_MANIFEST_KEY = "touchline:footy-headlines-kit-manifest:v3";
const FAST_OVERVIEW = "https://r.jina.ai/http://www.footyheadlines.com/26-27-kit-overview/";
const FAST_CLUBS = Object.freeze({
  ARS: ["arsenal"], AVL: ["aston villa"], BOU: ["bournemouth", "afc bournemouth"],
  BRE: ["brentford", "brentford fc"], BHA: ["brighton", "brighton hove albion"], CHE: ["chelsea"],
  COV: ["coventry", "coventry city"], CRY: ["crystal palace"], EVE: ["everton"], FUL: ["fulham"],
  HUL: ["hull city", "hull"], IPS: ["ipswich town", "ipswich"], LEE: ["leeds united", "leeds"],
  LIV: ["liverpool"], MCI: ["manchester city", "man city"], MUN: ["manchester united", "man united", "man utd"],
  NEW: ["newcastle united", "newcastle"], NFO: ["nottingham forest", "nott m forest"], SUN: ["sunderland"],
  TOT: ["tottenham", "tottenham hotspur", "spurs"]
});

const fastText = new Map();
let fastManifestPromise = null;
let fastTimer = 0;
let fastToken = 0;

function fastNormalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function fastCode() {
  return document.querySelector(".club-rail-item.selected span")?.textContent?.trim().toUpperCase() || "";
}

function fastReader(url) {
  const parsed = new URL(url);
  return `https://r.jina.ai/http://${parsed.host}${parsed.pathname}${parsed.search}`;
}

function fastWebp(source) {
  const url = new URL("https://images.weserv.nl/");
  url.searchParams.set("url", source);
  url.searchParams.set("w", "360");
  url.searchParams.set("h", "360");
  url.searchParams.set("fit", "contain");
  url.searchParams.set("output", "webp");
  url.searchParams.set("q", "82");
  url.searchParams.set("trim", "8");
  url.searchParams.set("we", "1");
  return url.toString();
}

async function fastFetch(url) {
  if (fastText.has(url)) return fastText.get(url);
  const pending = fetch(url, { headers: { Accept: "text/plain,text/markdown;q=0.9,*/*;q=0.7" } })
    .then(response => response.ok ? response.text() : "")
    .catch(() => "");
  fastText.set(url, pending);
  return pending;
}

function fastCodeFor(label) {
  const wanted = fastNormalize(label);
  return Object.entries(FAST_CLUBS).find(([, aliases]) => aliases.some(alias => wanted === alias))?.[0] || "";
}

function fastParseOverview(markdown) {
  const section = String(markdown || "").split(/\n##\s+La Liga\b/i)[0].split(/##\s+Premier League\b/i)[1] || "";
  const manifest = {};
  const links = /\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]+)\)/g;
  let code = "";
  let match;
  while ((match = links.exec(section))) {
    const label = match[1].replace(/[*_`]/g, "").trim();
    const clubCode = fastCodeFor(label);
    if (clubCode) {
      code = clubCode;
      manifest[code] ||= {};
      continue;
    }
    if (!code) continue;
    const role = fastNormalize(label);
    let url;
    try { url = new URL(match[2], "https://www.footyheadlines.com/26-27-kit-overview/").toString(); }
    catch { continue; }
    if (/\bhome\b/.test(role)) manifest[code].home = url;
    if (/\baway\b/.test(role)) manifest[code].away = url;
  }
  return manifest;
}

async function fastManifest() {
  if (fastManifestPromise) return fastManifestPromise;
  try {
    const stored = JSON.parse(localStorage.getItem(FAST_MANIFEST_KEY) || "null");
    if (stored?.data && typeof stored.data === "object") {
      fastManifestPromise = Promise.resolve(stored.data);
      return fastManifestPromise;
    }
  } catch { /* fetch below */ }
  fastManifestPromise = fastFetch(FAST_OVERVIEW).then(fastParseOverview);
  return fastManifestPromise;
}

function fastCandidates(markdown, articleUrl, code, role) {
  const text = String(markdown || "");
  const regex = /!\[([^\]]*)\]\((https?:\/\/[^)\s]+|\/[^)\s]+)(?:\s+"[^"]*")?\)/g;
  const candidates = [];
  let match;
  while ((match = regex.exec(text))) {
    let source;
    try { source = new URL(match[2], articleUrl).toString(); }
    catch { continue; }
    const alt = match[1] || "";
    const hard = fastNormalize(`${source} ${alt}`);
    if (/\b(?:player|model|person|wearing|worn|campaign|avatar|author|logo|badge|crest|shorts|socks|boot|training|goalkeeper|gk)\b/.test(hard)) continue;
    const context = fastNormalize(text.slice(Math.max(0, match.index - 180), Math.min(text.length, regex.lastIndex + 180)));
    let score = 0;
    if (FAST_CLUBS[code]?.some(alias => context.includes(alias) || hard.includes(alias))) score += 20;
    if (hard.includes(role) || context.includes(`${role} shirt`) || context.includes(`${role} kit`)) score += 30;
    if (/\b(?:shirt|jersey|kit)\b/.test(hard)) score += 24;
    if (/\b(?:front|flat|flatlay|laydown|product|replica|authentic|render)\b/.test(hard)) score += 18;
    if (/\b(?:player|model|person)\s+(?:wearing|wears|models)\b/.test(context)) score -= 80;
    candidates.push({ source, score });
  }
  return candidates.sort((a, b) => b.score - a.score);
}

async function fastSource(code, role) {
  const manifest = await fastManifest();
  const articleUrl = manifest?.[code]?.[role];
  if (!articleUrl) return null;
  const markdown = await fastFetch(fastReader(articleUrl));
  const candidate = fastCandidates(markdown, articleUrl, code, role)[0];
  return candidate?.score > 20 ? { source: candidate.source, articleUrl } : null;
}

function fastMarkup(source, code, role, label) {
  return `<figure class="club-kit-pipeline club-kit-ready club-kit-fastpaint" data-club="${code}" data-role="${role}">
    <div class="club-kit-stage"><img src="${fastWebp(source)}" alt="Camisa ${label.toLowerCase()} 2026/27" decoding="async" loading="eager" fetchpriority="high" referrerpolicy="no-referrer" /></div>
    <figcaption><strong>${label}</strong><span>26/27</span></figcaption>
  </figure>`;
}

async function fastPaint() {
  const code = fastCode();
  const details = document.querySelector("[data-club-details]");
  if (!code || !FAST_CLUBS[code] || !details) return;
  const slots = [...details.querySelectorAll(".club-kit-slot")];
  if (slots.length < 2) return;
  const token = ++fastToken;
  const roles = [[slots[0], "home", "CASA"], [slots[1], "away", "FORA"]];

  await Promise.all(roles.map(async ([slot, role, label]) => {
    if (slot.querySelector(`.club-kit-ready[data-club="${code}"][data-role="${role}"]`)) return;
    const resolved = await fastSource(code, role);
    if (!resolved || token !== fastToken || fastCode() !== code || document.querySelector("[data-club-details]") !== details) return;
    if (slot.querySelector(`.club-kit-ready[data-club="${code}"][data-role="${role}"]`)) return;
    slot.innerHTML = fastMarkup(resolved.source, code, role, label);
  }));
}

function fastSchedule(delay = 0) {
  clearTimeout(fastTimer);
  fastTimer = setTimeout(fastPaint, delay);
}

const fastObserver = new MutationObserver(mutations => {
  const relevant = mutations.some(mutation => mutation.type === "attributes"
    ? mutation.target instanceof Element && mutation.target.matches(".club-rail-item")
    : [...mutation.addedNodes].some(node => node instanceof Element && (
      node.matches?.("[data-club-details], .club-kit-loading")
      || node.querySelector?.("[data-club-details], .club-kit-loading")
    )));
  if (relevant) fastSchedule(8);
});

fastObserver.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
document.addEventListener("click", event => {
  if (event.target.closest("[data-club-index], [data-club-step]")) fastSchedule(0);
}, true);
document.addEventListener("DOMContentLoaded", () => fastSchedule(20), { once: true });
fastSchedule(30);

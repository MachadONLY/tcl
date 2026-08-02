import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const PIPELINE_VERSION = 3;
const SEASON = "2026/27";
const OUTPUT_ROOT = path.join(ROOT, "public", "assets", "clubs", "2026-27");
const MANIFEST_PATH = path.join(OUTPUT_ROOT, "manifest.json");
const OVERRIDES_PATH = path.join(ROOT, "scripts", "onboarding-assets-overrides.json");
const SPORTS_DB_KEY = process.env.THESPORTSDB_KEY || "3";
const FORCE = process.argv.includes("--force");
const CLUB_FILTER = process.argv.find(value => value.startsWith("--club="))?.split("=")[1]?.toUpperCase() || null;
const CONCURRENCY = Math.max(1, Math.min(5, Number(process.env.ASSET_SYNC_CONCURRENCY || 3)));
const FOOTY_OVERVIEW = "https://r.jina.ai/http://www.footyheadlines.com/26-27-kit-overview/";

const CLUBS = [
  { code: "ARS", team: "Arsenal", crestId: 57, city: "London", stadium: "Emirates_Stadium", manager: "Mikel_Arteta", home: ["#d71920", "#ffffff", "sleeves"], away: ["#fff000", "#102b5c", "trim"] },
  { code: "AVL", team: "Aston Villa", crestId: 58, city: "Birmingham", stadium: "Villa_Park", manager: "Unai_Emery", home: ["#7a2048", "#95c9e8", "sleeves"], away: ["#f4f2e9", "#7a2048", "trim"] },
  { code: "BOU", team: "AFC Bournemouth", crestId: 1044, city: "Bournemouth", stadium: "Dean_Court", manager: "Marco_Rose", home: ["#d71920", "#111111", "stripes"], away: ["#e8f5ff", "#101820", "trim"] },
  { code: "BRE", team: "Brentford", crestId: 402, city: "London", stadium: "Brentford_Community_Stadium", manager: "Keith_Andrews_(footballer)", home: ["#ffffff", "#df1625", "stripes"], away: ["#171717", "#f0cf25", "trim"] },
  { code: "BHA", team: "Brighton & Hove Albion", crestId: 397, city: "Brighton", stadium: "Falmer_Stadium", manager: "Fabian_Hürzeler", home: ["#ffffff", "#0057b8", "stripes"], away: ["#ff6a00", "#101820", "trim"] },
  { code: "CHE", team: "Chelsea", crestId: 61, city: "London", stadium: "Stamford_Bridge_(stadium)", manager: "Xabi_Alonso", home: ["#034694", "#ffffff", "trim"], away: ["#f5f3eb", "#d51d2e", "stripe-center"] },
  { code: "COV", team: "Coventry City", crestId: 1076, city: "Coventry", stadium: "Coventry_Building_Society_Arena", manager: "Frank_Lampard", home: ["#69bfe7", "#ffffff", "trim"], away: ["#181818", "#69bfe7", "stripe-center"] },
  { code: "CRY", team: "Crystal Palace", crestId: 354, city: "London", stadium: "Selhurst_Park", manager: "Pierre_Sage", home: ["#1b458f", "#c4122e", "stripes"], away: ["#f4f0df", "#1b458f", "sash"] },
  { code: "EVE", team: "Everton", crestId: 62, city: "Liverpool", stadium: "Everton_Stadium", manager: "David_Moyes", home: ["#003399", "#ffffff", "trim"], away: ["#f1d9b5", "#112a4a", "trim"] },
  { code: "FUL", team: "Fulham", crestId: 63, city: "London", stadium: "Craven_Cottage", manager: "Álvaro_Arbeloa", home: ["#ffffff", "#111111", "sleeves"], away: ["#d9ff2f", "#111111", "trim"] },
  { code: "HUL", team: "Hull City", crestId: 322, city: "Kingston upon Hull", stadium: "MKM_Stadium", manager: "Sergej_Jakirović", home: ["#f5a623", "#111111", "stripes"], away: ["#f3f3f3", "#f5a623", "trim"] },
  { code: "IPS", team: "Ipswich Town", crestId: 349, city: "Ipswich", stadium: "Portman_Road", manager: "Gary_O'Neil", home: ["#0057b8", "#ffffff", "trim"], away: ["#ff5a36", "#111111", "trim"] },
  { code: "LEE", team: "Leeds United", crestId: 341, city: "Leeds", stadium: "Elland_Road", manager: "Daniel_Farke", home: ["#ffffff", "#ffcd00", "trim"], away: ["#164a85", "#ffcd00", "trim"] },
  { code: "LIV", team: "Liverpool", crestId: 64, city: "Liverpool", stadium: "Anfield", manager: "Andoni_Iraola", home: ["#c8102e", "#ffffff", "trim"], away: ["#f1eee5", "#16827b", "trim"] },
  { code: "MCI", team: "Manchester City", crestId: 65, city: "Manchester", stadium: "City_of_Manchester_Stadium", manager: "Enzo_Maresca", home: ["#6cabdd", "#ffffff", "trim"], away: ["#101010", "#f2cf20", "stripe-center"] },
  { code: "MUN", team: "Manchester United", crestId: 66, city: "Manchester", stadium: "Old_Trafford", manager: "Michael_Carrick", home: ["#da291c", "#ffffff", "trim"], away: ["#f2efe7", "#2a2a2a", "trim"] },
  { code: "NEW", team: "Newcastle United", crestId: 67, city: "Newcastle upon Tyne", stadium: "St_James'_Park", manager: null, home: ["#ffffff", "#111111", "stripes"], away: ["#4f2d7f", "#f4b942", "trim"] },
  { code: "NFO", team: "Nottingham Forest", crestId: 351, city: "Nottingham", stadium: "City_Ground", manager: null, home: ["#e53233", "#ffffff", "trim"], away: ["#f2d94e", "#10293f", "trim"] },
  { code: "SUN", team: "Sunderland", crestId: 746, city: "Sunderland", stadium: "Stadium_of_Light", manager: null, home: ["#ffffff", "#d71920", "stripes"], away: ["#1e314f", "#e8d7b0", "trim"] },
  { code: "TOT", team: "Tottenham Hotspur", crestId: 73, city: "London", stadium: "Tottenham_Hotspur_Stadium", manager: null, home: ["#ffffff", "#132257", "trim"], away: ["#171722", "#b8ff42", "trim"] }
];

const KIT_ALIASES = Object.freeze({
  ARS: ["arsenal"], AVL: ["aston villa"], BOU: ["bournemouth", "afc bournemouth"],
  BRE: ["brentford", "brentford fc"], BHA: ["brighton", "brighton hove albion"], CHE: ["chelsea"],
  COV: ["coventry", "coventry city"], CRY: ["crystal palace"], EVE: ["everton"], FUL: ["fulham"],
  HUL: ["hull city", "hull"], IPS: ["ipswich town", "ipswich"], LEE: ["leeds united", "leeds"],
  LIV: ["liverpool"], MCI: ["manchester city", "man city"], MUN: ["manchester united", "man united", "man utd"],
  NEW: ["newcastle united", "newcastle"], NFO: ["nottingham forest", "nott m forest"], SUN: ["sunderland"],
  TOT: ["tottenham", "tottenham hotspur", "spurs"]
});

const SPECS = {
  crest: { width: 420, height: 420, fit: "contain", quality: 88 },
  stadium: { width: 1600, height: 900, fit: "cover", quality: 82 },
  city: { width: 1280, height: 720, fit: "cover", quality: 80 },
  backdrop: { width: 1920, height: 1080, fit: "cover", quality: 78 },
  manager: { width: 520, height: 620, fit: "cover", quality: 82 },
  homeKit: { width: 620, height: 620, fit: "contain", quality: 90 },
  awayKit: { width: 620, height: 620, fit: "contain", quality: 90 }
};

const textCache = new Map();
let overviewPromise = null;
let refreshExisting = FORCE;

const log = value => process.stdout.write(`${value}\n`);
const timestamp = () => new Date().toISOString();
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function safeUrl(value) {
  const source = String(value || "").trim();
  return /^https:\/\//i.test(source) ? source : null;
}

function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function readable(value) {
  return String(value || "").replaceAll("_", " ").replace(/\s*\([^)]*\)\s*/g, " ").trim();
}

function localUrl(filePath) {
  return `/${path.relative(path.join(ROOT, "public"), filePath).split(path.sep).join("/")}`;
}

function isLikelyPhoto(source) {
  const url = safeUrl(source);
  if (!url) return false;
  let decoded = url.toLowerCase();
  try { decoded = decodeURIComponent(decoded); } catch { /* keep encoded */ }
  if (/\.svg(?:\?|$)/i.test(decoded)) return false;
  if (/\b(?:logo|crest|badge|coat[_ -]?of[_ -]?arms|flag|emblem|wordmark|icon|kit|shirt|jersey)\b/i.test(decoded)) return false;
  return /\.(?:jpe?g|png|webp)(?:\?|$)/i.test(decoded) || /upload\.wikimedia\.org/i.test(decoded);
}

function seasonMatches(value) {
  return /2026\s*(?:-|\/)?\s*27|2026.*2027|26\s*(?:-|\/)\s*27/i.test(String(value || ""));
}

function equipmentSource(items, role) {
  const aliases = role === "home" ? ["home"] : ["away", "alternate", "third"];
  const match = (items || []).find(item => {
    const type = String(item.strType || "").toLowerCase();
    return seasonMatches(item.strSeason) && aliases.some(alias => type.includes(alias));
  });
  return safeUrl(match?.strEquipment);
}

async function readJson(filePath, fallback) {
  try { return JSON.parse(await readFile(filePath, "utf8")); }
  catch { return fallback; }
}

async function existingFile(filePath) {
  if (!existsSync(filePath)) return false;
  try { return (await stat(filePath)).size > 128; }
  catch { return false; }
}

async function fetchWithRetry(url, options = {}, attempts = 3, timeout = 28000) {
  let finalError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      finalError = error;
      if (attempt < attempts) await wait(attempt * 450);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`${finalError?.message || "request failed"}: ${url}`);
}

async function fetchJson(url) {
  const response = await fetchWithRetry(url, { headers: { Accept: "application/json" } });
  return response.json();
}

async function fetchText(url) {
  if (textCache.has(url)) return textCache.get(url);
  const pending = fetchWithRetry(url, { headers: { Accept: "text/plain,text/markdown;q=.9,*/*;q=.5" } }, 2, 32000)
    .then(response => response.text())
    .catch(() => "");
  textCache.set(url, pending);
  return pending;
}

async function wikipediaPageImage(page, requirePhoto = false) {
  if (!page) return null;
  try {
    const payload = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page)}`);
    const source = safeUrl(payload?.originalimage?.source || payload?.thumbnail?.source);
    return requirePhoto ? (isLikelyPhoto(source) ? source : null) : source;
  } catch {
    return null;
  }
}

async function wikipediaSearchImage(query) {
  if (!query) return null;
  try {
    const url = new URL("https://en.wikipedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("generator", "search");
    url.searchParams.set("gsrsearch", query);
    url.searchParams.set("gsrlimit", "8");
    url.searchParams.set("prop", "pageimages");
    url.searchParams.set("piprop", "original|thumbnail");
    url.searchParams.set("pithumbsize", "1600");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");
    const payload = await fetchJson(url.toString());
    const pages = Object.values(payload?.query?.pages || {}).sort((a, b) => Number(a.index || 99) - Number(b.index || 99));
    for (const page of pages) {
      const source = safeUrl(page?.original?.source || page?.thumbnail?.source);
      if (isLikelyPhoto(source)) return source;
    }
  } catch {
    // caller falls through to the next candidate
  }
  return null;
}

async function resolvePhoto(page, queries) {
  const direct = await wikipediaPageImage(page, true);
  if (direct) return direct;
  for (const query of queries) {
    const source = await wikipediaSearchImage(query);
    if (source) return source;
  }
  return null;
}

async function fetchTeam(club) {
  try {
    const payload = await fetchJson(`https://www.thesportsdb.com/api/v1/json/${SPORTS_DB_KEY}/searchteams.php?t=${encodeURIComponent(club.team)}`);
    return payload?.teams?.find(team => /England/i.test(team.strCountry || "")) || payload?.teams?.[0] || null;
  } catch {
    return null;
  }
}

async function fetchEquipment(teamId) {
  if (!teamId) return [];
  try {
    const payload = await fetchJson(`https://www.thesportsdb.com/api/v1/json/${SPORTS_DB_KEY}/lookupequipment.php?id=${encodeURIComponent(teamId)}`);
    return payload?.equipment || [];
  } catch {
    return [];
  }
}

function kitCodeFor(label) {
  const wanted = normalize(label);
  return Object.entries(KIT_ALIASES).find(([, aliases]) => aliases.some(alias => wanted === alias))?.[0] || "";
}

function parseKitOverview(markdown) {
  const section = String(markdown || "").split(/\n##\s+La Liga\b/i)[0].split(/##\s+Premier League\b/i)[1] || "";
  const manifest = {};
  const links = /\[([^\]]+)\]\((https?:\/\/[^)\s]+|\/[^)\s]+)\)/g;
  let code = "";
  let match;
  while ((match = links.exec(section))) {
    const label = match[1].replace(/[*_`]/g, "").trim();
    const clubCode = kitCodeFor(label);
    if (clubCode) {
      code = clubCode;
      manifest[code] ||= {};
      continue;
    }
    if (!code) continue;
    const role = normalize(label);
    let articleUrl;
    try { articleUrl = new URL(match[2], "https://www.footyheadlines.com/26-27-kit-overview/").toString(); }
    catch { continue; }
    if (/\bhome\b/.test(role)) manifest[code].home = articleUrl;
    if (/\baway\b/.test(role)) manifest[code].away = articleUrl;
  }
  return manifest;
}

async function kitOverview() {
  if (!overviewPromise) overviewPromise = fetchText(FOOTY_OVERVIEW).then(parseKitOverview);
  return overviewPromise;
}

function readerUrl(source) {
  const parsed = new URL(source);
  return `https://r.jina.ai/http://${parsed.host}${parsed.pathname}${parsed.search}`;
}

function kitImageCandidates(markdown, articleUrl, code, role) {
  const text = String(markdown || "");
  const regex = /!\[([^\]]*)\]\((https?:\/\/[^)\s]+|\/[^)\s]+)(?:\s+"[^"]*")?\)/g;
  const candidates = [];
  let match;
  while ((match = regex.exec(text))) {
    let source;
    try { source = new URL(match[2], articleUrl).toString(); }
    catch { continue; }
    const alt = match[1] || "";
    const hard = normalize(`${source} ${alt}`);
    if (/\b(?:player|model|person|wearing|worn|campaign|avatar|author|logo|badge|crest|shorts|socks|boot|training|goalkeeper|gk)\b/.test(hard)) continue;
    const context = normalize(text.slice(Math.max(0, match.index - 220), Math.min(text.length, regex.lastIndex + 220)));
    let score = 0;
    if (KIT_ALIASES[code]?.some(alias => context.includes(alias) || hard.includes(alias))) score += 22;
    if (hard.includes(role) || context.includes(`${role} shirt`) || context.includes(`${role} kit`)) score += 34;
    if (/\b(?:shirt|jersey|kit)\b/.test(hard)) score += 24;
    if (/\b(?:front|flat|flatlay|laydown|product|replica|authentic|render)\b/.test(hard)) score += 20;
    if (/\b(?:player|model|person)\s+(?:wearing|wears|models)\b/.test(context)) score -= 90;
    candidates.push({ source, score });
  }
  return candidates.sort((a, b) => b.score - a.score);
}

async function footyKitSource(code, role) {
  try {
    const overview = await kitOverview();
    const articleUrl = overview?.[code]?.[role];
    if (!articleUrl) return null;
    const markdown = await fetchText(readerUrl(articleUrl));
    const candidate = kitImageCandidates(markdown, articleUrl, code, role)[0];
    return candidate?.score > 24 ? candidate.source : null;
  } catch {
    return null;
  }
}

function optimizationUrl(source, spec) {
  const url = new URL("https://images.weserv.nl/");
  url.searchParams.set("url", source.replace(/^https?:\/\//i, ""));
  url.searchParams.set("output", "webp");
  url.searchParams.set("q", String(spec.quality));
  url.searchParams.set("w", String(spec.width));
  url.searchParams.set("h", String(spec.height));
  url.searchParams.set("fit", spec.fit);
  if (spec.fit === "contain") url.searchParams.set("bg", "transparent");
  return url.toString();
}

async function saveWebp(source, destination, spec) {
  const response = await fetchWithRetry(optimizationUrl(source, spec), {
    headers: { Accept: "image/webp,image/*" }
  }, 3, 42000);
  const type = response.headers.get("content-type") || "";
  if (!type.startsWith("image/")) throw new Error(`unexpected response type ${type}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength < 256) throw new Error("image payload is empty");
  await writeFile(destination, buffer);
  return localUrl(destination);
}

async function saveFirstSource(sources, destination, spec, previousSource) {
  const candidates = [...new Set(sources.map(safeUrl).filter(Boolean))];
  if (!refreshExisting && await existingFile(destination) && candidates[0] && candidates[0] === previousSource) {
    return { url: localUrl(destination), source: previousSource };
  }
  let finalError;
  for (const source of candidates) {
    try {
      const url = await saveWebp(source, destination, spec);
      return { url, source };
    } catch (error) {
      finalError = error;
    }
  }
  if (await existingFile(destination)) return { url: localUrl(destination), source: previousSource || "existing-local-file" };
  throw finalError || new Error("no usable source");
}

function kitSvg([base, detail, pattern], code, label) {
  const patternMarkup = pattern === "stripes"
    ? `<path d="M76 45h24v150H76zm48 0h24v150h-24z" fill="${detail}"/>`
    : pattern === "stripe-center"
      ? `<path d="M91 42h42v154H91z" fill="${detail}"/>`
      : pattern === "sash"
        ? `<path d="M55 48 80 38l91 146-27 13z" fill="${detail}"/>`
        : pattern === "sleeves"
          ? `<path d="m55 48-33 22 18 37 31-18V48zm102 0 33 22-18 37-31-18V48z" fill="${detail}"/>`
          : "";
  const trim = pattern === "trim" || pattern === "sleeves"
    ? `<path d="M54 48 22 70l17 36 28-17m91-41 32 22-17 36-28-17M88 37q24 20 48 0" fill="none" stroke="${detail}" stroke-width="8" stroke-linejoin="round"/>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 212 242" role="img" aria-label="${code} ${label} kit fallback"><defs><filter id="shadow"><feDropShadow dx="0" dy="9" stdDeviation="8" flood-opacity=".28"/></filter><clipPath id="shirt"><path d="m78 31 28 10 28-10 26 15 30 24-18 38-20-12v116H60V96l-20 12-18-38 30-24z"/></clipPath></defs><g filter="url(#shadow)"><path d="m78 31 28 10 28-10 26 15 30 24-18 38-20-12v116H60V96l-20 12-18-38 30-24z" fill="${base}" stroke="rgba(255,255,255,.34)" stroke-width="2"/><g clip-path="url(#shirt)">${patternMarkup}</g>${trim}<text x="106" y="137" fill="${detail}" font-family="Arial,sans-serif" font-size="22" font-weight="800" text-anchor="middle" opacity=".78">${code}</text></g></svg>\n`;
}

async function saveFallbackKit(destination, colors, code, label) {
  await writeFile(destination, kitSvg(colors, code, label), "utf8");
  return localUrl(destination);
}

async function buildClubEntry(club, overrides, previousEntry) {
  const directory = path.join(OUTPUT_ROOT, club.code.toLowerCase());
  await mkdir(directory, { recursive: true });
  log(`→ ${club.code} ${club.team}`);

  const override = overrides?.clubs?.[club.code] || {};
  const cityName = readable(club.city);
  const stadiumName = readable(club.stadium);
  const [team, cityPhoto, stadiumPhoto, managerPhoto] = await Promise.all([
    fetchTeam(club),
    resolvePhoto(club.city, [`${cityName} skyline England`, `${cityName} city centre England`]),
    resolvePhoto(club.stadium, [`${stadiumName} football stadium`, `${club.team} stadium England`]),
    wikipediaPageImage(club.manager, true)
  ]);
  const equipment = await fetchEquipment(team?.idTeam);
  const [footyHome, footyAway] = await Promise.all([
    equipmentSource(equipment, "home") ? null : footyKitSource(club.code, "home"),
    equipmentSource(equipment, "away") ? null : footyKitSource(club.code, "away")
  ]);

  const sourceLists = {
    crest: [override.crest, team?.strBadge, team?.strLogo, `https://crests.football-data.org/${club.crestId}.png`],
    stadium: [override.stadium, stadiumPhoto, team?.strStadiumThumb],
    city: [override.city, cityPhoto],
    backdrop: [override.backdrop, stadiumPhoto, team?.strStadiumThumb, team?.strFanart1, team?.strFanart2],
    manager: [override.manager, managerPhoto],
    homeKit: [override.homeKit, equipmentSource(equipment, "home"), footyHome],
    awayKit: [override.awayKit, equipmentSource(equipment, "away"), footyAway]
  };

  const entry = {
    code: club.code,
    name: team?.strTeam || club.team,
    providerTeamId: team?.idTeam || null,
    season: SEASON,
    pipelineVersion: PIPELINE_VERSION,
    generatedAt: timestamp(),
    sources: {}
  };

  for (const [kind, spec] of Object.entries(SPECS)) {
    const filename = kind.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
    const destination = path.join(directory, `${filename}.webp`);
    try {
      const saved = await saveFirstSource(sourceLists[kind], destination, spec, previousEntry?.sources?.[kind]);
      entry[kind] = saved.url;
      entry.sources[kind] = saved.source;
    } catch (error) {
      if (kind === "homeKit" || kind === "awayKit") {
        const home = kind === "homeKit";
        entry[kind] = await saveFallbackKit(path.join(directory, `${filename}.svg`), home ? club.home : club.away, club.code, home ? "HOME" : "AWAY");
        entry.sources[kind] = "generated-local-fallback";
      } else {
        log(`  ! ${kind}: ${error.message}`);
      }
    }
  }

  entry.complete = ["crest", "stadium", "city", "homeKit", "awayKit"].every(key => Boolean(entry[key]));
  log(`  ✓ ${Object.keys(SPECS).filter(key => entry[key]).length}/${Object.keys(SPECS).length} assets${entry.complete ? " — offline ready" : ""}`);
  return entry;
}

async function runPool(items, worker, concurrency) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      try { results[index] = await worker(items[index]); }
      catch (error) { log(`  ✕ ${items[index].code}: ${error.message}`); }
    }
  });
  await Promise.all(runners);
  return results.filter(Boolean);
}

async function main() {
  await mkdir(OUTPUT_ROOT, { recursive: true });
  const [existing, overrides] = await Promise.all([
    readJson(MANIFEST_PATH, { clubs: {} }),
    readJson(OVERRIDES_PATH, { clubs: {} })
  ]);
  refreshExisting = FORCE || Number(existing?.pipelineVersion || 0) !== PIPELINE_VERSION;

  const selected = CLUB_FILTER ? CLUBS.filter(club => club.code === CLUB_FILTER) : CLUBS;
  if (!selected.length) throw new Error(`Unknown club code: ${CLUB_FILTER}`);

  log(`Syncing ${selected.length} club${selected.length === 1 ? "" : "s"} into ${path.relative(ROOT, OUTPUT_ROOT)}${refreshExisting ? " (verified refresh)" : ""}`);
  const entries = await runPool(selected, club => buildClubEntry(club, overrides, existing?.clubs?.[club.code]), CONCURRENCY);
  const merged = { ...(existing?.clubs || {}) };
  entries.forEach(entry => { merged[entry.code] = entry; });

  const orderedClubs = {};
  CLUBS.forEach(club => { if (merged[club.code]) orderedClubs[club.code] = merged[club.code]; });
  const manifest = {
    pipelineVersion: PIPELINE_VERSION,
    season: SEASON,
    generatedAt: timestamp(),
    source: "verified build-time local pack: Wikimedia city/stadium photography, TheSportsDB, football-data crests, Footy Headlines kit discovery and explicit overrides",
    runtimeNetworkRequired: false,
    clubCount: Object.keys(orderedClubs).length,
    completeClubCount: Object.values(orderedClubs).filter(entry => entry.complete).length,
    clubs: orderedClubs
  };
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  log(`Done: ${manifest.completeClubCount}/${CLUBS.length} clubs have crest, stadium, city and both kit slots available offline.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

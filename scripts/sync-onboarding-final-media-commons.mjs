import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_ROOT = path.join(ROOT, "public", "assets", "clubs", "2026-27");
const MANIFEST_PATH = path.join(OUTPUT_ROOT, "manifest.json");
const REPORT_PATH = path.join(OUTPUT_ROOT, "validation-report.json");
const FORCE = process.argv.includes("--force");
const SPORTS_DB_KEY = process.env.THESPORTSDB_KEY || "3";
const USER_AGENT = "TouchlineCareer/1.0 (offline club media builder)";

const CLUBS = Object.freeze({
  ARS: { name: "Arsenal", aliases: ["Arsenal FC"], crestId: 57, city: "London", stadium: "Emirates Stadium", manager: "Mikel Arteta", rival: ["Tottenham Hotspur", "TOT"], home: ["#d71920", "#ffffff", "sleeves"], away: ["#fff000", "#102b5c", "trim"] },
  AVL: { name: "Aston Villa", aliases: ["Aston Villa FC"], crestId: 58, city: "Birmingham", stadium: "Villa Park", manager: "Unai Emery", rival: ["Birmingham City", null], home: ["#7a2048", "#95c9e8", "sleeves"], away: ["#f4f2e9", "#7a2048", "trim"] },
  BOU: { name: "AFC Bournemouth", aliases: ["Bournemouth"], crestId: 1044, city: "Bournemouth", stadium: "Dean Court", manager: "Marco Rose", rival: ["Southampton", null], home: ["#d71920", "#111111", "stripes"], away: ["#e8f5ff", "#101820", "trim"] },
  BRE: { name: "Brentford", aliases: ["Brentford FC"], crestId: 402, city: "London", stadium: "Brentford Community Stadium", manager: "Keith Andrews", rival: ["Fulham", "FUL"], home: ["#ffffff", "#df1625", "stripes"], away: ["#171717", "#f0cf25", "trim"] },
  BHA: { name: "Brighton & Hove Albion", aliases: ["Brighton", "Brighton Hove Albion"], crestId: 397, city: "Brighton", stadium: "Falmer Stadium", manager: "Fabian Hürzeler", rival: ["Crystal Palace", "CRY"], home: ["#ffffff", "#0057b8", "stripes"], away: ["#ff6a00", "#101820", "trim"] },
  CHE: { name: "Chelsea", aliases: ["Chelsea FC"], crestId: 61, city: "London", stadium: "Stamford Bridge", manager: "Xabi Alonso", rival: ["Fulham", "FUL"], home: ["#034694", "#ffffff", "trim"], away: ["#f5f3eb", "#d51d2e", "stripe-center"] },
  COV: { name: "Coventry City", aliases: ["Coventry City FC"], crestId: 1076, city: "Coventry", stadium: "Coventry Building Society Arena", manager: "Frank Lampard", rival: ["Leicester City", null], home: ["#69bfe7", "#ffffff", "trim"], away: ["#181818", "#69bfe7", "stripe-center"] },
  CRY: { name: "Crystal Palace", aliases: ["Crystal Palace FC"], crestId: 354, city: "London", stadium: "Selhurst Park", manager: "Pierre Sage", rival: ["Brighton & Hove Albion", "BHA"], home: ["#1b458f", "#c4122e", "stripes"], away: ["#f4f0df", "#1b458f", "sash"] },
  EVE: { name: "Everton", aliases: ["Everton FC"], crestId: 62, city: "Liverpool", stadium: "Everton Stadium", manager: "David Moyes", rival: ["Liverpool", "LIV"], home: ["#003399", "#ffffff", "trim"], away: ["#f1d9b5", "#112a4a", "trim"] },
  FUL: { name: "Fulham", aliases: ["Fulham FC"], crestId: 63, city: "London", stadium: "Craven Cottage", manager: "Álvaro Arbeloa", rival: ["Chelsea", "CHE"], home: ["#ffffff", "#111111", "sleeves"], away: ["#d9ff2f", "#111111", "trim"] },
  HUL: { name: "Hull City", aliases: ["Hull City AFC"], crestId: 322, city: "Kingston upon Hull", stadium: "MKM Stadium", manager: "Sergej Jakirović", rival: ["Leeds United", "LEE"], home: ["#f5a623", "#111111", "stripes"], away: ["#f3f3f3", "#f5a623", "trim"] },
  IPS: { name: "Ipswich Town", aliases: ["Ipswich Town FC"], crestId: 349, city: "Ipswich", stadium: "Portman Road", manager: "Gary O'Neil", rival: ["Norwich City", null], home: ["#0057b8", "#ffffff", "trim"], away: ["#ff5a36", "#111111", "trim"] },
  LEE: { name: "Leeds United", aliases: ["Leeds United FC"], crestId: 341, city: "Leeds", stadium: "Elland Road", manager: "Daniel Farke", rival: ["Manchester United", "MUN"], home: ["#ffffff", "#ffcd00", "trim"], away: ["#164a85", "#ffcd00", "trim"] },
  LIV: { name: "Liverpool", aliases: ["Liverpool FC"], crestId: 64, city: "Liverpool", stadium: "Anfield", manager: "Andoni Iraola", rival: ["Everton", "EVE"], home: ["#c8102e", "#ffffff", "trim"], away: ["#f1eee5", "#16827b", "trim"] },
  MCI: { name: "Manchester City", aliases: ["Manchester City FC"], crestId: 65, city: "Manchester", stadium: "Etihad Stadium", manager: "Enzo Maresca", rival: ["Manchester United", "MUN"], home: ["#6cabdd", "#ffffff", "trim"], away: ["#101010", "#f2cf20", "stripe-center"] },
  MUN: { name: "Manchester United", aliases: ["Manchester United FC"], crestId: 66, city: "Manchester", stadium: "Old Trafford", manager: "Michael Carrick", rival: ["Liverpool", "LIV"], home: ["#da291c", "#ffffff", "trim"], away: ["#f2efe7", "#2a2a2a", "trim"] },
  NEW: { name: "Newcastle United", aliases: ["Newcastle United FC"], crestId: 67, city: "Newcastle upon Tyne", stadium: "St James' Park", manager: null, rival: ["Sunderland", "SUN"], home: ["#ffffff", "#111111", "stripes"], away: ["#4f2d7f", "#f4b942", "trim"] },
  NFO: { name: "Nottingham Forest", aliases: ["Nottingham Forest FC"], crestId: 351, city: "Nottingham", stadium: "City Ground Nottingham", manager: "Oliver Glasner", rival: ["Derby County", null], home: ["#e53233", "#ffffff", "trim"], away: ["#f2d94e", "#10293f", "trim"] },
  SUN: { name: "Sunderland", aliases: ["Sunderland AFC"], crestId: 71, city: "Sunderland", stadium: "Stadium of Light Sunderland", manager: "Régis Le Bris", rival: ["Newcastle United", "NEW"], home: ["#ffffff", "#d71920", "stripes"], away: ["#1e314f", "#e8d7b0", "trim"] },
  TOT: { name: "Tottenham Hotspur", aliases: ["Tottenham Hotspur FC"], crestId: 73, city: "London", stadium: "Tottenham Hotspur Stadium", manager: "Roberto De Zerbi", rival: ["Arsenal", "ARS"], home: ["#ffffff", "#132257", "trim"], away: ["#171722", "#b8ff42", "trim"] }
});

const CITY_CACHE = new Map();
const TEAM_CACHE = new Map();
let lastApiRequest = 0;

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const log = message => process.stdout.write(`${message}\n`);

async function readJson(filePath, fallback) {
  try { return JSON.parse(await readFile(filePath, "utf8")); }
  catch { return fallback; }
}

function localPath(url) {
  if (!String(url || "").startsWith("/assets/")) return null;
  return path.join(ROOT, "public", ...String(url).split("/").filter(Boolean));
}

async function validLocal(url, minimum = 512) {
  const filePath = localPath(url);
  if (!filePath || !existsSync(filePath)) return false;
  try { return (await stat(filePath)).size >= minimum; }
  catch { return false; }
}

async function waitForApi() {
  const elapsed = Date.now() - lastApiRequest;
  if (elapsed < 420) await sleep(420 - elapsed);
  lastApiRequest = Date.now();
}

async function fetchWithRetry(url, { accept = "*/*", api = false, attempts = 3, timeout = 22000 } = {}) {
  let finalError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (api) await waitForApi();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        headers: { Accept: accept, "User-Agent": USER_AGENT },
        signal: controller.signal
      });
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("retry-after") || 0);
        await sleep(Math.max(retryAfter * 1000, attempt * 1800));
        throw new Error("HTTP 429");
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      finalError = error;
      if (attempt < attempts) await sleep(Math.min(5000, 700 * 2 ** (attempt - 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw finalError || new Error(`request failed: ${url}`);
}

async function fetchJson(url, api = true) {
  const response = await fetchWithRetry(url, { accept: "application/json", api });
  return response.json();
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function imageExtension(contentType) {
  if (/png/i.test(contentType)) return "png";
  if (/webp/i.test(contentType)) return "webp";
  if (/gif/i.test(contentType)) return "gif";
  if (/svg/i.test(contentType)) return "svg";
  return "jpg";
}

async function removeStemVariants(directory, stem) {
  await Promise.all(["jpg", "jpeg", "png", "webp", "gif", "svg"].map(extension =>
    rm(path.join(directory, `${stem}.${extension}`), { force: true }).catch(() => {})
  ));
}

async function downloadImage(source, directory, stem, previousUrl) {
  if (!FORCE && await validLocal(previousUrl)) return previousUrl;
  if (!source) return await validLocal(previousUrl) ? previousUrl : null;

  try {
    const response = await fetchWithRetry(source, { accept: "image/avif,image/webp,image/png,image/jpeg,image/svg+xml,image/*", api: false, attempts: 3, timeout: 30000 });
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) throw new Error(`not an image: ${contentType}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength < 1024) throw new Error("image payload is too small");
    const extension = imageExtension(contentType);
    await mkdir(directory, { recursive: true });
    await removeStemVariants(directory, stem);
    await writeFile(path.join(directory, `${stem}.${extension}`), buffer);
    return `/assets/clubs/2026-27/${path.basename(directory)}/${stem}.${extension}`;
  } catch (error) {
    log(`    download ${stem} failed: ${error.message}`);
    return await validLocal(previousUrl) ? previousUrl : null;
  }
}

function mediaScore(candidate, kind, terms) {
  const haystack = normalize(`${candidate.title} ${candidate.description || ""}`);
  let score = 0;
  terms.forEach(term => { if (haystack.includes(normalize(term))) score += 16; });

  const positive = {
    city: ["skyline", "city centre", "city center", "panorama", "aerial", "downtown", "waterfront", "cityscape"],
    stadium: ["stadium", "ground", "stand", "pitch", "aerial", "exterior", "football"],
    manager: ["portrait", "manager", "coach", "football", "head coach", "press conference"],
    crest: ["logo", "crest", "badge", "football club"]
  }[kind] || [];
  positive.forEach(term => { if (haystack.includes(term)) score += 9; });

  const negative = ["map", "diagram", "signature", "autograph", "shirt", "kit", "ticket", "programme", "poster", "video game", "flag"];
  if (kind !== "crest") negative.push("logo", "crest", "badge", "emblem", "coat of arms");
  negative.forEach(term => { if (haystack.includes(term)) score -= 35; });

  if (/\.svg$/i.test(candidate.source || "")) score -= kind === "crest" ? 0 : 50;
  if (/\.gif$/i.test(candidate.source || "")) score -= 30;
  return score;
}

async function commonsSearch(query, kind, terms, width) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrsearch", query);
  url.searchParams.set("gsrlimit", "14");
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|mime|extmetadata");
  url.searchParams.set("iiurlwidth", String(width));
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  try {
    const payload = await fetchJson(url.toString(), true);
    const candidates = Object.values(payload?.query?.pages || {}).map(page => {
      const info = page?.imageinfo?.[0] || {};
      return {
        title: page?.title || "",
        description: info?.extmetadata?.ImageDescription?.value || "",
        mime: info?.mime || "",
        source: info?.thumburl || info?.url || ""
      };
    }).filter(candidate => candidate.source && /^image\//.test(candidate.mime));

    return candidates
      .map(candidate => ({ ...candidate, score: mediaScore(candidate, kind, terms) }))
      .filter(candidate => candidate.score > (kind === "manager" ? 5 : 0))
      .sort((a, b) => b.score - a.score)[0]?.source || "";
  } catch (error) {
    log(`    Commons search failed for “${query}”: ${error.message}`);
    return "";
  }
}

async function firstCommons(queries, kind, terms, width) {
  for (const query of queries) {
    const source = await commonsSearch(query, kind, terms, width);
    if (source) return source;
  }
  return "";
}

async function teamData(config) {
  if (TEAM_CACHE.has(config.name)) return TEAM_CACHE.get(config.name);
  const promise = (async () => {
    for (const name of [config.name, ...(config.aliases || [])]) {
      try {
        const payload = await fetchJson(`https://www.thesportsdb.com/api/v1/json/${SPORTS_DB_KEY}/searchteams.php?t=${encodeURIComponent(name)}`, true);
        const team = payload?.teams?.find(candidate => /England/i.test(candidate.strCountry || "")) || payload?.teams?.[0];
        if (team) return team;
      } catch {
        // try the next alias
      }
    }
    return null;
  })();
  TEAM_CACHE.set(config.name, promise);
  return promise;
}

async function citySource(city) {
  if (CITY_CACHE.has(city)) return CITY_CACHE.get(city);
  const promise = firstCommons([
    `intitle:${city} skyline`,
    `intitle:${city} city centre`,
    `${city} England panorama`,
    `${city} cityscape`
  ], "city", [city], 1600);
  CITY_CACHE.set(city, promise);
  return promise;
}

async function stadiumSource(config, team) {
  return firstCommons([
    `intitle:${config.stadium}`,
    `"${config.stadium}" football stadium`,
    `"${config.name}" stadium`,
    `${config.stadium} pitch`
  ], "stadium", [config.stadium, config.name], 1800) || team?.strStadiumThumb || "";
}

async function managerSource(config) {
  if (!config.manager) return "";
  return firstCommons([
    `intitle:${config.manager}`,
    `"${config.manager}" football manager`,
    `"${config.manager}" coach`,
    config.manager
  ], "manager", [config.manager], 1100);
}

function kitSvg([base, detail, pattern], code) {
  const patternMarkup = pattern === "stripes"
    ? `<path d="M76 45h24v150H76zm48 0h24v150h-24z" fill="${detail}"/>`
    : pattern === "stripe-center"
      ? `<path d="M91 42h42v154H91z" fill="${detail}"/>`
      : pattern === "sash"
        ? `<path d="M55 48 80 38l91 146-27 13z" fill="${detail}"/>`
        : pattern === "sleeves"
          ? `<path d="m55 48-33 22 18 37 31-18V48zm102 0 33 22-18 37-31-18V48z" fill="${detail}"/>`
          : "";
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 212 242"><defs><clipPath id="shirt"><path d="m78 31 28 10 28-10 26 15 30 24-18 38-20-12v116H60V96l-20 12-18-38 30-24z"/></clipPath><filter id="shadow"><feDropShadow dx="0" dy="8" stdDeviation="7" flood-opacity=".28"/></filter></defs><g filter="url(#shadow)"><path d="m78 31 28 10 28-10 26 15 30 24-18 38-20-12v116H60V96l-20 12-18-38 30-24z" fill="${base}" stroke="#fff" stroke-opacity=".3" stroke-width="2"/><g clip-path="url(#shirt)">${patternMarkup}</g><text x="106" y="137" fill="${detail}" font-family="Arial" font-size="22" font-weight="800" text-anchor="middle">${code}</text></g></svg>`;
}

async function ensureKit(directory, code, role, colors, previousUrl) {
  if (await validLocal(previousUrl)) return previousUrl;
  await mkdir(directory, { recursive: true });
  const destination = path.join(directory, `${role}-kit.svg`);
  await writeFile(destination, kitSvg(colors, code), "utf8");
  return `/assets/clubs/2026-27/${code.toLowerCase()}/${role}-kit.svg`;
}

async function buildClub(code, config, previous) {
  log(`→ ${code} ${config.name}`);
  const directory = path.join(OUTPUT_ROOT, code.toLowerCase());
  const team = await teamData(config);

  const crestSource = team?.strBadge || team?.strLogo || `https://crests.football-data.org/${config.crestId}.png`;
  const [cityRemote, stadiumRemote, managerRemote] = await Promise.all([
    citySource(config.city),
    stadiumSource(config, team),
    managerSource(config)
  ]);

  const [crest, city, stadium, manager, homeKit, awayKit] = await Promise.all([
    downloadImage(crestSource, directory, "crest", previous.crest),
    downloadImage(cityRemote, directory, "city", previous.city),
    downloadImage(stadiumRemote, directory, "stadium", previous.stadium),
    config.manager ? downloadImage(managerRemote, directory, "manager", previous.manager) : Promise.resolve(null),
    ensureKit(directory, code, "home", config.home, previous.homeKit),
    ensureKit(directory, code, "away", config.away, previous.awayKit)
  ]);

  return {
    code,
    name: config.name,
    season: "2026/27",
    crest,
    city,
    stadium,
    backdrop: stadium,
    manager,
    managerName: config.manager,
    homeKit,
    awayKit,
    rivalName: config.rival[0],
    sources: {
      crest: crestSource,
      city: cityRemote,
      stadium: stadiumRemote,
      manager: managerRemote,
      homeKit: "generated-local-fallback",
      awayKit: "generated-local-fallback"
    }
  };
}

async function attachRival(code, entry, entries, previous) {
  const [rivalName, rivalCode] = CLUBS[code].rival;
  if (rivalCode && await validLocal(entries[rivalCode]?.crest)) {
    entry.rivalCrest = entries[rivalCode].crest;
    entry.sources.rivalCrest = `league:${rivalCode}`;
    return;
  }

  const rivalTeam = await teamData({ name: rivalName, aliases: [] });
  const remote = rivalTeam?.strBadge || rivalTeam?.strLogo || await firstCommons([
    `intitle:${rivalName} crest`,
    `intitle:${rivalName} logo`,
    `"${rivalName}" football club badge`
  ], "crest", [rivalName], 700);
  entry.rivalCrest = await downloadImage(remote, path.join(OUTPUT_ROOT, code.toLowerCase()), "rival-crest", previous.rivalCrest);
  entry.sources.rivalCrest = remote;
}

async function validateClub(code, entry) {
  const checks = {
    crest: await validLocal(entry.crest),
    city: await validLocal(entry.city),
    stadium: await validLocal(entry.stadium),
    manager: CLUBS[code].manager ? await validLocal(entry.manager) : true,
    rival: await validLocal(entry.rivalCrest),
    homeKit: await validLocal(entry.homeKit),
    awayKit: await validLocal(entry.awayKit)
  };
  return { code, ...checks, complete: Object.values(checks).every(Boolean) };
}

await mkdir(OUTPUT_ROOT, { recursive: true });
const previousManifest = await readJson(MANIFEST_PATH, { clubs: {} });
const entries = {};

for (const [code, config] of Object.entries(CLUBS)) {
  entries[code] = await buildClub(code, config, previousManifest.clubs?.[code] || { sources: {} });
}
for (const code of Object.keys(CLUBS)) {
  await attachRival(code, entries[code], entries, previousManifest.clubs?.[code] || {});
}

const report = [];
for (const code of Object.keys(CLUBS)) {
  const status = await validateClub(code, entries[code]);
  entries[code].complete = status.complete;
  report.push(status);
  log(`  ${status.complete ? "✓" : "!"} ${code} crest=${status.crest} city=${status.city} stadium=${status.stadium} manager=${status.manager} rival=${status.rival} kits=${status.homeKit && status.awayKit}`);
}

const manifest = {
  pipelineVersion: 13,
  season: "2026/27",
  generatedAt: new Date().toISOString(),
  runtimeNetworkRequired: false,
  source: "verified Wikimedia Commons local pack with TheSportsDB team/rival fallbacks",
  clubCount: Object.keys(entries).length,
  completeClubCount: report.filter(item => item.complete).length,
  clubs: entries
};
await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await writeFile(REPORT_PATH, `${JSON.stringify({ generatedAt: manifest.generatedAt, clubs: report }, null, 2)}\n`, "utf8");

const incomplete = report.filter(item => !item.complete);
if (incomplete.length) throw new Error(`media validation failed for: ${incomplete.map(item => item.code).join(", ")}`);
log(`Done: ${report.length}/${report.length} clubs passed final media validation.`);

import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_ROOT = path.join(ROOT, "public", "assets", "clubs", "2026-27");
const MANIFEST_PATH = path.join(OUTPUT_ROOT, "manifest.json");
const REPORT_PATH = path.join(OUTPUT_ROOT, "validation-report.json");
const SPORTS_DB_KEY = process.env.THESPORTSDB_KEY || "3";
const FORCE = process.argv.includes("--force");
const USER_AGENT = "TouchlineCareer/1.0 (offline game media builder)";

const CLUBS = Object.freeze({
  ARS: ["Arsenal", 57, "London", "Emirates Stadium", "Mikel Arteta", ["Tottenham Hotspur", "TOT"], ["#d71920", "#fff", "sleeves"], ["#fff000", "#102b5c", "trim"]],
  AVL: ["Aston Villa", 58, "Birmingham", "Villa Park", "Unai Emery", ["Birmingham City", null], ["#7a2048", "#95c9e8", "sleeves"], ["#f4f2e9", "#7a2048", "trim"]],
  BOU: ["AFC Bournemouth", 1044, "Bournemouth", "Dean Court", "Marco Rose", ["Southampton", null], ["#d71920", "#111", "stripes"], ["#e8f5ff", "#101820", "trim"]],
  BRE: ["Brentford", 402, "London", "Brentford Community Stadium", "Keith Andrews", ["Fulham", "FUL"], ["#fff", "#df1625", "stripes"], ["#171717", "#f0cf25", "trim"]],
  BHA: ["Brighton & Hove Albion", 397, "Brighton", "Falmer Stadium", "Fabian Hürzeler", ["Crystal Palace", "CRY"], ["#fff", "#0057b8", "stripes"], ["#ff6a00", "#101820", "trim"]],
  CHE: ["Chelsea", 61, "London", "Stamford Bridge", "Xabi Alonso", ["Fulham", "FUL"], ["#034694", "#fff", "trim"], ["#f5f3eb", "#d51d2e", "stripe-center"]],
  COV: ["Coventry City", 1076, "Coventry", "Coventry Building Society Arena", "Frank Lampard", ["Leicester City", null], ["#69bfe7", "#fff", "trim"], ["#181818", "#69bfe7", "stripe-center"]],
  CRY: ["Crystal Palace", 354, "London", "Selhurst Park", "Pierre Sage", ["Brighton & Hove Albion", "BHA"], ["#1b458f", "#c4122e", "stripes"], ["#f4f0df", "#1b458f", "sash"]],
  EVE: ["Everton", 62, "Liverpool", "Everton Stadium", "David Moyes", ["Liverpool", "LIV"], ["#003399", "#fff", "trim"], ["#f1d9b5", "#112a4a", "trim"]],
  FUL: ["Fulham", 63, "London", "Craven Cottage", "Álvaro Arbeloa", ["Chelsea", "CHE"], ["#fff", "#111", "sleeves"], ["#d9ff2f", "#111", "trim"]],
  HUL: ["Hull City", 322, "Kingston upon Hull", "MKM Stadium", "Sergej Jakirović", ["Leeds United", "LEE"], ["#f5a623", "#111", "stripes"], ["#f3f3f3", "#f5a623", "trim"]],
  IPS: ["Ipswich Town", 349, "Ipswich", "Portman Road", "Gary O'Neil", ["Norwich City", null], ["#0057b8", "#fff", "trim"], ["#ff5a36", "#111", "trim"]],
  LEE: ["Leeds United", 341, "Leeds", "Elland Road", "Daniel Farke", ["Manchester United", "MUN"], ["#fff", "#ffcd00", "trim"], ["#164a85", "#ffcd00", "trim"]],
  LIV: ["Liverpool", 64, "Liverpool", "Anfield", "Andoni Iraola", ["Everton", "EVE"], ["#c8102e", "#fff", "trim"], ["#f1eee5", "#16827b", "trim"]],
  MCI: ["Manchester City", 65, "Manchester", "Etihad Stadium", "Enzo Maresca", ["Manchester United", "MUN"], ["#6cabdd", "#fff", "trim"], ["#101010", "#f2cf20", "stripe-center"]],
  MUN: ["Manchester United", 66, "Manchester", "Old Trafford", "Michael Carrick", ["Liverpool", "LIV"], ["#da291c", "#fff", "trim"], ["#f2efe7", "#2a2a2a", "trim"]],
  NEW: ["Newcastle United", 67, "Newcastle upon Tyne", "St James' Park", null, ["Sunderland", "SUN"], ["#fff", "#111", "stripes"], ["#4f2d7f", "#f4b942", "trim"]],
  NFO: ["Nottingham Forest", 351, "Nottingham", "City Ground Nottingham", "Oliver Glasner", ["Derby County", null], ["#e53233", "#fff", "trim"], ["#f2d94e", "#10293f", "trim"]],
  SUN: ["Sunderland", 71, "Sunderland", "Stadium of Light Sunderland", "Régis Le Bris", ["Newcastle United", "NEW"], ["#fff", "#d71920", "stripes"], ["#1e314f", "#e8d7b0", "trim"]],
  TOT: ["Tottenham Hotspur", 73, "London", "Tottenham Hotspur Stadium", "Roberto De Zerbi", ["Arsenal", "ARS"], ["#fff", "#132257", "trim"], ["#171722", "#b8ff42", "trim"]]
});

const CITY_SOURCE_CACHE = new Map();
const TEAM_CACHE = new Map();
const WIKIDATA_CACHE = new Map();
let apiQueue = Promise.resolve();
let previousApiAt = 0;

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

function queuedApi(url) {
  const operation = apiQueue.then(async () => {
    const elapsed = Date.now() - previousApiAt;
    if (elapsed < 280) await sleep(280 - elapsed);
    previousApiAt = Date.now();
    return fetchRetry(url, { accept: "application/json", attempts: 2, timeout: 12000 });
  });
  apiQueue = operation.catch(() => null);
  return operation;
}

async function fetchRetry(url, { accept = "*/*", attempts = 3, timeout = 18000 } = {}) {
  let finalError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        headers: { Accept: accept, "User-Agent": USER_AGENT },
        signal: controller.signal
      });
      if (response.status === 429) {
        await sleep(attempt * 1400);
        throw new Error("HTTP 429");
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      finalError = error;
      if (attempt < attempts) await sleep(attempt * 550);
    } finally {
      clearTimeout(timer);
    }
  }
  throw finalError || new Error(`request failed: ${url}`);
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function commonsRedirect(filename, width) {
  if (!filename) return "";
  return `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(filename)}?width=${width}`;
}

function claimFilename(entity, properties) {
  for (const property of properties) {
    const claims = entity?.claims?.[property] || [];
    for (const claim of claims) {
      const value = claim?.mainsnak?.datavalue?.value;
      if (typeof value === "string" && value) return value;
    }
  }
  return "";
}

async function wikidataMedia(query, { width, properties = ["P18"], hints = [] } = {}) {
  const key = `${query}|${properties.join(",")}|${width}`;
  if (WIKIDATA_CACHE.has(key)) return WIKIDATA_CACHE.get(key);

  const promise = (async () => {
    const searchUrl = new URL("https://www.wikidata.org/w/api.php");
    searchUrl.searchParams.set("action", "wbsearchentities");
    searchUrl.searchParams.set("search", query);
    searchUrl.searchParams.set("language", "en");
    searchUrl.searchParams.set("uselang", "en");
    searchUrl.searchParams.set("limit", "7");
    searchUrl.searchParams.set("format", "json");
    searchUrl.searchParams.set("origin", "*");
    const searchResponse = await queuedApi(searchUrl.toString());
    const searchData = await searchResponse.json();
    const results = searchData?.search || [];
    if (!results.length) return "";

    const ids = results.map(result => result.id).filter(Boolean).slice(0, 7);
    const entityUrl = new URL("https://www.wikidata.org/w/api.php");
    entityUrl.searchParams.set("action", "wbgetentities");
    entityUrl.searchParams.set("ids", ids.join("|"));
    entityUrl.searchParams.set("props", "claims|labels|descriptions");
    entityUrl.searchParams.set("languages", "en");
    entityUrl.searchParams.set("format", "json");
    entityUrl.searchParams.set("origin", "*");
    const entityResponse = await queuedApi(entityUrl.toString());
    const entityData = await entityResponse.json();

    const wanted = normalize(query);
    const ranked = results.map((result, index) => {
      const entity = entityData?.entities?.[result.id];
      const label = normalize(entity?.labels?.en?.value || result.label);
      const description = normalize(entity?.descriptions?.en?.value || result.description);
      let score = Math.max(0, 30 - index * 3);
      if (label === wanted) score += 80;
      else if (label.includes(wanted) || wanted.includes(label)) score += 38;
      hints.forEach(hint => { if (description.includes(normalize(hint))) score += 18; });
      if (/disambiguation|album|song|film|video game|railway station/.test(description)) score -= 90;
      return { entity, score };
    }).sort((a, b) => b.score - a.score);

    for (const candidate of ranked) {
      const filename = claimFilename(candidate.entity, properties);
      if (filename) return commonsRedirect(filename, width);
    }
    return "";
  })().catch(error => {
    log(`    Wikidata failed for “${query}”: ${error.message}`);
    return "";
  });

  WIKIDATA_CACHE.set(key, promise);
  return promise;
}

async function commonsSearch(query, width, terms, kind) {
  const url = new URL("https://commons.wikimedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrsearch", query);
  url.searchParams.set("gsrlimit", "12");
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|mime|extmetadata");
  url.searchParams.set("iiurlwidth", String(width));
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");

  try {
    const response = await queuedApi(url.toString());
    const data = await response.json();
    const candidates = Object.values(data?.query?.pages || {}).map(page => {
      const info = page?.imageinfo?.[0] || {};
      const text = normalize(`${page.title || ""} ${info?.extmetadata?.ImageDescription?.value || ""}`);
      let score = 0;
      terms.forEach(term => { if (text.includes(normalize(term))) score += 24; });
      const positives = kind === "manager"
        ? ["portrait", "manager", "coach", "football"]
        : kind === "stadium"
          ? ["stadium", "ground", "pitch", "stand", "football", "aerial"]
          : ["skyline", "panorama", "city centre", "cityscape", "aerial"];
      positives.forEach(term => { if (text.includes(term)) score += 8; });
      ["logo", "crest", "badge", "flag", "map", "diagram", "signature", "autograph", "shirt", "kit"].forEach(term => {
        if (text.includes(term)) score -= 35;
      });
      return { source: info?.thumburl || info?.url || "", mime: info?.mime || "", score };
    }).filter(candidate => candidate.source && /^image\//.test(candidate.mime) && !/svg/i.test(candidate.mime));
    return candidates.sort((a, b) => b.score - a.score)[0]?.source || "";
  } catch (error) {
    log(`    Commons fallback failed for “${query}”: ${error.message}`);
    return "";
  }
}

async function teamData(name) {
  if (TEAM_CACHE.has(name)) return TEAM_CACHE.get(name);
  const promise = (async () => {
    const url = `https://www.thesportsdb.com/api/v1/json/${SPORTS_DB_KEY}/searchteams.php?t=${encodeURIComponent(name)}`;
    try {
      const response = await queuedApi(url);
      const data = await response.json();
      return data?.teams?.find(team => /England/i.test(team.strCountry || "")) || data?.teams?.[0] || null;
    } catch {
      return null;
    }
  })();
  TEAM_CACHE.set(name, promise);
  return promise;
}

async function citySource(city) {
  if (CITY_SOURCE_CACHE.has(city)) return CITY_SOURCE_CACHE.get(city);
  const promise = (async () => {
    const wikidata = await wikidataMedia(city, { width: 1600, hints: ["city", "England", "United Kingdom"] });
    if (wikidata) return wikidata;
    return commonsSearch(`"${city}" skyline`, 1600, [city], "city");
  })();
  CITY_SOURCE_CACHE.set(city, promise);
  return promise;
}

async function stadiumSource(stadium, clubName, team) {
  const wikidata = await wikidataMedia(stadium, { width: 1800, hints: ["football stadium", "stadium", clubName] });
  if (wikidata) return wikidata;
  const commons = await commonsSearch(`"${stadium}" football`, 1800, [stadium, clubName], "stadium");
  return commons || team?.strStadiumThumb || "";
}

async function managerSource(manager) {
  if (!manager) return "";
  const wikidata = await wikidataMedia(manager, { width: 1000, hints: ["football manager", "football player", "coach"] });
  if (wikidata) return wikidata;
  return commonsSearch(`"${manager}" football`, 1000, [manager], "manager");
}

function imageExtension(contentType) {
  if (/png/i.test(contentType)) return "png";
  if (/webp/i.test(contentType)) return "webp";
  if (/gif/i.test(contentType)) return "gif";
  if (/svg/i.test(contentType)) return "svg";
  return "jpg";
}

async function removeVariants(directory, stem) {
  await Promise.all(["jpg", "jpeg", "png", "webp", "gif", "svg"].map(extension =>
    rm(path.join(directory, `${stem}.${extension}`), { force: true }).catch(() => {})
  ));
}

async function downloadImage(source, directory, stem, previousUrl) {
  if (!FORCE && await validLocal(previousUrl)) return previousUrl;
  if (!source) return await validLocal(previousUrl) ? previousUrl : null;

  try {
    const response = await fetchRetry(source, { accept: "image/avif,image/webp,image/png,image/jpeg,image/svg+xml,image/*", attempts: 3, timeout: 25000 });
    const type = response.headers.get("content-type") || "";
    if (!type.startsWith("image/")) throw new Error(`not image: ${type}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength < 1024) throw new Error("image is too small");
    const extension = imageExtension(type);
    await mkdir(directory, { recursive: true });
    await removeVariants(directory, stem);
    await writeFile(path.join(directory, `${stem}.${extension}`), buffer);
    return `/assets/clubs/2026-27/${path.basename(directory)}/${stem}.${extension}`;
  } catch (error) {
    log(`    ${stem} download failed: ${error.message}`);
    return await validLocal(previousUrl) ? previousUrl : null;
  }
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

async function buildClub(code, values, previous) {
  const [name, crestId, city, stadium, manager, rival, home, away] = values;
  log(`→ ${code} ${name}`);
  const directory = path.join(OUTPUT_ROOT, code.toLowerCase());
  const team = await teamData(name);

  const [cityRemote, stadiumRemote, managerRemote] = await Promise.all([
    citySource(city),
    stadiumSource(stadium, name, team),
    managerSource(manager)
  ]);
  const crestRemote = team?.strBadge || team?.strLogo || `https://crests.football-data.org/${crestId}.png`;

  const [crest, cityUrl, stadiumUrl, managerUrl, homeKit, awayKit] = await Promise.all([
    downloadImage(crestRemote, directory, "crest", previous.crest),
    downloadImage(cityRemote, directory, "city", previous.city),
    downloadImage(stadiumRemote, directory, "stadium", previous.stadium),
    manager ? downloadImage(managerRemote, directory, "manager", previous.manager) : Promise.resolve(null),
    ensureKit(directory, code, "home", home, previous.homeKit),
    ensureKit(directory, code, "away", away, previous.awayKit)
  ]);

  return {
    code,
    name,
    season: "2026/27",
    crest,
    city: cityUrl,
    stadium: stadiumUrl,
    backdrop: stadiumUrl,
    manager: managerUrl,
    managerName: manager,
    homeKit,
    awayKit,
    rivalName: rival[0],
    sources: {
      crest: crestRemote,
      city: cityRemote,
      stadium: stadiumRemote,
      manager: managerRemote,
      homeKit: "generated-local-fallback",
      awayKit: "generated-local-fallback"
    }
  };
}

async function attachRival(code, entry, entries, previous) {
  const [rivalName, rivalCode] = CLUBS[code][5];
  if (rivalCode && await validLocal(entries[rivalCode]?.crest)) {
    entry.rivalCrest = entries[rivalCode].crest;
    entry.sources.rivalCrest = `league:${rivalCode}`;
    return;
  }

  const rivalTeam = await teamData(rivalName);
  const wikidata = await wikidataMedia(rivalName, { width: 700, properties: ["P154", "P18"], hints: ["football club", "association football"] });
  const remote = rivalTeam?.strBadge || rivalTeam?.strLogo || wikidata;
  entry.rivalCrest = await downloadImage(remote, path.join(OUTPUT_ROOT, code.toLowerCase()), "rival-crest", previous.rivalCrest);
  entry.sources.rivalCrest = remote;
}

async function validateClub(code, entry) {
  const checks = {
    crest: await validLocal(entry.crest),
    city: await validLocal(entry.city),
    stadium: await validLocal(entry.stadium),
    manager: CLUBS[code][4] ? await validLocal(entry.manager) : true,
    rival: await validLocal(entry.rivalCrest),
    homeKit: await validLocal(entry.homeKit),
    awayKit: await validLocal(entry.awayKit)
  };
  return { code, ...checks, complete: Object.values(checks).every(Boolean) };
}

await mkdir(OUTPUT_ROOT, { recursive: true });
const previousManifest = await readJson(MANIFEST_PATH, { clubs: {} });
const entries = {};

for (const [code, values] of Object.entries(CLUBS)) {
  entries[code] = await buildClub(code, values, previousManifest.clubs?.[code] || {});
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
  pipelineVersion: 14,
  season: "2026/27",
  generatedAt: new Date().toISOString(),
  runtimeNetworkRequired: false,
  source: "Wikidata P18/P154 media with Wikimedia Commons and TheSportsDB fallbacks",
  clubCount: Object.keys(entries).length,
  completeClubCount: report.filter(item => item.complete).length,
  clubs: entries
};
await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await writeFile(REPORT_PATH, `${JSON.stringify({ generatedAt: manifest.generatedAt, clubs: report }, null, 2)}\n`, "utf8");

const incomplete = report.filter(item => !item.complete);
if (incomplete.length) throw new Error(`media validation failed for: ${incomplete.map(item => item.code).join(", ")}`);
log(`Done: ${report.length}/${report.length} clubs passed final media validation.`);

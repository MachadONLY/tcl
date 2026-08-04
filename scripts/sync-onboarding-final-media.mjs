import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_ROOT = path.join(ROOT, "public", "assets", "clubs", "2026-27");
const MANIFEST_PATH = path.join(OUTPUT_ROOT, "manifest.json");
const REPORT_PATH = path.join(OUTPUT_ROOT, "validation-report.json");
const FORCE = process.argv.includes("--force");
const SPORTS_DB_KEY = process.env.THESPORTSDB_KEY || "3";
const USER_AGENT = "TouchlineCareerMedia/1.0 (local game asset builder)";

const CLUBS = Object.freeze({
  ARS: { name: "Arsenal", crestId: 57, city: "London", stadium: "Emirates_Stadium", manager: ["Mikel Arteta", "Mikel_Arteta"], rival: ["Tottenham Hotspur", "TOT"], home: ["#d71920", "#ffffff", "sleeves"], away: ["#fff000", "#102b5c", "trim"] },
  AVL: { name: "Aston Villa", crestId: 58, city: "Birmingham", stadium: "Villa_Park", manager: ["Unai Emery", "Unai_Emery"], rival: ["Birmingham City", null], home: ["#7a2048", "#95c9e8", "sleeves"], away: ["#f4f2e9", "#7a2048", "trim"] },
  BOU: { name: "AFC Bournemouth", crestId: 1044, city: "Bournemouth", stadium: "Dean_Court", manager: ["Marco Rose", "Marco_Rose"], rival: ["Southampton", null], home: ["#d71920", "#111111", "stripes"], away: ["#e8f5ff", "#101820", "trim"] },
  BRE: { name: "Brentford", crestId: 402, city: "London", stadium: "Brentford_Community_Stadium", manager: ["Keith Andrews", "Keith_Andrews_(footballer)"], rival: ["Fulham", "FUL"], home: ["#ffffff", "#df1625", "stripes"], away: ["#171717", "#f0cf25", "trim"] },
  BHA: { name: "Brighton & Hove Albion", crestId: 397, city: "Brighton", stadium: "Falmer_Stadium", manager: ["Fabian Hürzeler", "Fabian_Hürzeler"], rival: ["Crystal Palace", "CRY"], home: ["#ffffff", "#0057b8", "stripes"], away: ["#ff6a00", "#101820", "trim"] },
  CHE: { name: "Chelsea", crestId: 61, city: "London", stadium: "Stamford_Bridge_(stadium)", manager: ["Xabi Alonso", "Xabi_Alonso"], rival: ["Fulham", "FUL"], home: ["#034694", "#ffffff", "trim"], away: ["#f5f3eb", "#d51d2e", "stripe-center"] },
  COV: { name: "Coventry City", crestId: 1076, city: "Coventry", stadium: "Coventry_Building_Society_Arena", manager: ["Frank Lampard", "Frank_Lampard"], rival: ["Leicester City", null], home: ["#69bfe7", "#ffffff", "trim"], away: ["#181818", "#69bfe7", "stripe-center"] },
  CRY: { name: "Crystal Palace", crestId: 354, city: "London", stadium: "Selhurst_Park", manager: ["Pierre Sage", "Pierre_Sage"], rival: ["Brighton & Hove Albion", "BHA"], home: ["#1b458f", "#c4122e", "stripes"], away: ["#f4f0df", "#1b458f", "sash"] },
  EVE: { name: "Everton", crestId: 62, city: "Liverpool", stadium: "Everton_Stadium", manager: ["David Moyes", "David_Moyes"], rival: ["Liverpool", "LIV"], home: ["#003399", "#ffffff", "trim"], away: ["#f1d9b5", "#112a4a", "trim"] },
  FUL: { name: "Fulham", crestId: 63, city: "London", stadium: "Craven_Cottage", manager: ["Álvaro Arbeloa", "Álvaro_Arbeloa"], rival: ["Chelsea", "CHE"], home: ["#ffffff", "#111111", "sleeves"], away: ["#d9ff2f", "#111111", "trim"] },
  HUL: { name: "Hull City", crestId: 322, city: "Kingston_upon_Hull", stadium: "MKM_Stadium", manager: ["Sergej Jakirović", "Sergej_Jakirović"], rival: ["Leeds United", "LEE"], home: ["#f5a623", "#111111", "stripes"], away: ["#f3f3f3", "#f5a623", "trim"] },
  IPS: { name: "Ipswich Town", crestId: 349, city: "Ipswich", stadium: "Portman_Road", manager: ["Gary O'Neil", "Gary_O'Neil"], rival: ["Norwich City", null], home: ["#0057b8", "#ffffff", "trim"], away: ["#ff5a36", "#111111", "trim"] },
  LEE: { name: "Leeds United", crestId: 341, city: "Leeds", stadium: "Elland_Road", manager: ["Daniel Farke", "Daniel_Farke"], rival: ["Manchester United", "MUN"], home: ["#ffffff", "#ffcd00", "trim"], away: ["#164a85", "#ffcd00", "trim"] },
  LIV: { name: "Liverpool", crestId: 64, city: "Liverpool", stadium: "Anfield", manager: ["Andoni Iraola", "Andoni_Iraola"], rival: ["Everton", "EVE"], home: ["#c8102e", "#ffffff", "trim"], away: ["#f1eee5", "#16827b", "trim"] },
  MCI: { name: "Manchester City", crestId: 65, city: "Manchester", stadium: "City_of_Manchester_Stadium", manager: ["Enzo Maresca", "Enzo_Maresca"], rival: ["Manchester United", "MUN"], home: ["#6cabdd", "#ffffff", "trim"], away: ["#101010", "#f2cf20", "stripe-center"] },
  MUN: { name: "Manchester United", crestId: 66, city: "Manchester", stadium: "Old_Trafford", manager: ["Michael Carrick", "Michael_Carrick"], rival: ["Liverpool", "LIV"], home: ["#da291c", "#ffffff", "trim"], away: ["#f2efe7", "#2a2a2a", "trim"] },
  NEW: { name: "Newcastle United", crestId: 67, city: "Newcastle_upon_Tyne", stadium: "St_James'_Park", manager: null, rival: ["Sunderland", "SUN"], home: ["#ffffff", "#111111", "stripes"], away: ["#4f2d7f", "#f4b942", "trim"] },
  NFO: { name: "Nottingham Forest", crestId: 351, city: "Nottingham", stadium: "City_Ground", manager: ["Oliver Glasner", "Oliver_Glasner"], rival: ["Derby County", null], home: ["#e53233", "#ffffff", "trim"], away: ["#f2d94e", "#10293f", "trim"] },
  SUN: { name: "Sunderland", crestId: 71, city: "Sunderland", stadium: "Stadium_of_Light", manager: ["Régis Le Bris", "Régis_Le_Bris"], rival: ["Newcastle United", "NEW"], home: ["#ffffff", "#d71920", "stripes"], away: ["#1e314f", "#e8d7b0", "trim"] },
  TOT: { name: "Tottenham Hotspur", crestId: 73, city: "London", stadium: "Tottenham_Hotspur_Stadium", manager: ["Roberto De Zerbi", "Roberto_De_Zerbi"], rival: ["Arsenal", "ARS"], home: ["#ffffff", "#132257", "trim"], away: ["#171722", "#b8ff42", "trim"] }
});

const sourceCache = new Map();
let previousApiRequestAt = 0;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const log = value => process.stdout.write(`${value}\n`);

async function readJson(filePath, fallback) {
  try { return JSON.parse(await readFile(filePath, "utf8")); }
  catch { return fallback; }
}

async function fileExists(filePath, minimum = 512) {
  if (!filePath || !existsSync(filePath)) return false;
  try { return (await stat(filePath)).size >= minimum; }
  catch { return false; }
}

function localPath(url) {
  if (!String(url || "").startsWith("/assets/")) return null;
  return path.join(ROOT, "public", ...String(url).split("/").filter(Boolean));
}

async function manifestAssetExists(url) {
  return fileExists(localPath(url));
}

async function rateLimitApi() {
  const elapsed = Date.now() - previousApiRequestAt;
  if (elapsed < 320) await wait(320 - elapsed);
  previousApiRequestAt = Date.now();
}

async function fetchWithRetry(url, options = {}, attempts = 5, timeout = 45000, api = false) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (api) await rateLimitApi();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          "User-Agent": USER_AGENT,
          ...(options.headers || {})
        },
        signal: controller.signal
      });
      if (response.status === 429) {
        const retryAfter = Number(response.headers.get("retry-after") || 0);
        await wait(Math.max(retryAfter * 1000, 1600 * attempt));
        throw new Error("HTTP 429");
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await wait(Math.min(8000, 700 * 2 ** (attempt - 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error(`request failed: ${url}`);
}

async function fetchJson(url, api = true) {
  const response = await fetchWithRetry(url, { headers: { Accept: "application/json" } }, 5, 45000, api);
  return response.json();
}

function likelyPhoto(source) {
  let value = String(source || "").toLowerCase();
  try { value = decodeURIComponent(value); } catch { /* keep encoded */ }
  return Boolean(value) && !/\b(?:logo|crest|badge|coat[_ -]?of[_ -]?arms|flag|emblem|wordmark|icon|diagram|map)\b/.test(value);
}

async function pageImage(page, size, requirePhoto) {
  const key = `page:${page}:${size}:${requirePhoto}`;
  if (sourceCache.has(key)) return sourceCache.get(key);
  const pending = (async () => {
    const url = new URL("https://en.wikipedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("prop", "pageimages");
    url.searchParams.set("titles", page);
    url.searchParams.set("piprop", "thumbnail|original");
    url.searchParams.set("pithumbsize", String(size));
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");
    const payload = await fetchJson(url.toString());
    const record = Object.values(payload?.query?.pages || {})[0];
    const source = record?.thumbnail?.source || record?.original?.source || "";
    return !requirePhoto || likelyPhoto(source) ? source : "";
  })().catch(() => "");
  sourceCache.set(key, pending);
  return pending;
}

async function searchImage(query, size, requirePhoto) {
  const key = `search:${query}:${size}:${requirePhoto}`;
  if (sourceCache.has(key)) return sourceCache.get(key);
  const pending = (async () => {
    const url = new URL("https://en.wikipedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("generator", "search");
    url.searchParams.set("gsrsearch", query);
    url.searchParams.set("gsrlimit", "8");
    url.searchParams.set("prop", "pageimages");
    url.searchParams.set("piprop", "thumbnail|original");
    url.searchParams.set("pithumbsize", String(size));
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");
    const payload = await fetchJson(url.toString());
    const pages = Object.values(payload?.query?.pages || {}).sort((a, b) => Number(a.index || 99) - Number(b.index || 99));
    for (const record of pages) {
      const source = record?.thumbnail?.source || record?.original?.source || "";
      if (source && (!requirePhoto || likelyPhoto(source))) return source;
    }
    return "";
  })().catch(() => "");
  sourceCache.set(key, pending);
  return pending;
}

async function resolveWikiImage(page, queries, size, requirePhoto = true) {
  const direct = await pageImage(page, size, requirePhoto);
  if (direct) return direct;
  for (const query of queries) {
    const source = await searchImage(query, size, requirePhoto);
    if (source) return source;
  }
  return "";
}

function extensionForType(type) {
  if (/png/i.test(type)) return "png";
  if (/webp/i.test(type)) return "webp";
  if (/gif/i.test(type)) return "gif";
  if (/svg/i.test(type)) return "svg";
  return "jpg";
}

async function removeVariants(directory, stem) {
  await Promise.all(["jpg", "jpeg", "png", "webp", "gif", "svg"].map(extension =>
    rm(path.join(directory, `${stem}.${extension}`), { force: true }).catch(() => {})
  ));
}

async function downloadImage(source, directory, stem) {
  const response = await fetchWithRetry(source, { headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/svg+xml,image/*" } }, 4, 50000, false);
  const type = response.headers.get("content-type") || "";
  if (!type.startsWith("image/")) throw new Error(`not an image: ${type}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength < 1024) throw new Error("image is too small");
  const extension = extensionForType(type);
  await mkdir(directory, { recursive: true });
  await removeVariants(directory, stem);
  const destination = path.join(directory, `${stem}.${extension}`);
  await writeFile(destination, buffer);
  return `/assets/clubs/2026-27/${path.basename(directory)}/${stem}.${extension}`;
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
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 212 242"><defs><filter id="s"><feDropShadow dx="0" dy="8" stdDeviation="7" flood-opacity=".28"/></filter><clipPath id="c"><path d="m78 31 28 10 28-10 26 15 30 24-18 38-20-12v116H60V96l-20 12-18-38 30-24z"/></clipPath></defs><g filter="url(#s)"><path d="m78 31 28 10 28-10 26 15 30 24-18 38-20-12v116H60V96l-20 12-18-38 30-24z" fill="${base}" stroke="rgba(255,255,255,.34)" stroke-width="2"/><g clip-path="url(#c)">${patternMarkup}</g>${trim}<text x="106" y="137" fill="${detail}" font-family="Arial,sans-serif" font-size="22" font-weight="800" text-anchor="middle" opacity=".78">${code}</text></g></svg>\n`;
}

async function ensureKit(directory, existingUrl, colors, code, label) {
  if (await manifestAssetExists(existingUrl)) return existingUrl;
  const stem = label === "HOME" ? "home-kit" : "away-kit";
  const destination = path.join(directory, `${stem}.svg`);
  await mkdir(directory, { recursive: true });
  await writeFile(destination, kitSvg(colors, code, label), "utf8");
  return `/assets/clubs/2026-27/${code.toLowerCase()}/${stem}.svg`;
}

async function resolveRivalBadge(name) {
  try {
    const payload = await fetchJson(`https://www.thesportsdb.com/api/v1/json/${SPORTS_DB_KEY}/searchteams.php?t=${encodeURIComponent(name)}`);
    const team = payload?.teams?.find(item => /England/i.test(item.strCountry || "")) || payload?.teams?.[0];
    return team?.strBadge || team?.strLogo || "";
  } catch {
    return "";
  }
}

async function ensureDownloaded({ directory, stem, existingUrl, source }) {
  if (!FORCE && await manifestAssetExists(existingUrl)) return existingUrl;
  if (!source) {
    if (await manifestAssetExists(existingUrl)) return existingUrl;
    return null;
  }
  try { return await downloadImage(source, directory, stem); }
  catch {
    if (await manifestAssetExists(existingUrl)) return existingUrl;
    return null;
  }
}

async function buildBaseAssets(code, config, previous) {
  const directory = path.join(OUTPUT_ROOT, code.toLowerCase());
  await mkdir(directory, { recursive: true });
  const cityLabel = config.city.replaceAll("_", " ");
  const stadiumLabel = config.stadium.replaceAll("_", " ").replace(/\s*\([^)]*\)/g, "");

  const crestSource = `https://crests.football-data.org/${config.crestId}.png`;
  const citySource = await resolveWikiImage(config.city, [`${cityLabel} skyline England`, `${cityLabel} city centre England`], 1600, true);
  const stadiumSource = await resolveWikiImage(config.stadium, [`${stadiumLabel} football stadium`, `${config.name} stadium`], 1800, true);
  const managerSource = config.manager
    ? await resolveWikiImage(config.manager[1], [`${config.manager[0]} football manager`, `${config.manager[0]} coach`], 1000, false)
    : "";

  const crest = await ensureDownloaded({ directory, stem: "crest", existingUrl: previous.crest, source: crestSource });
  const city = await ensureDownloaded({ directory, stem: "city", existingUrl: previous.city, source: citySource });
  const stadium = await ensureDownloaded({ directory, stem: "stadium", existingUrl: previous.stadium, source: stadiumSource });
  const manager = config.manager
    ? await ensureDownloaded({ directory, stem: "manager", existingUrl: previous.manager, source: managerSource })
    : null;
  const homeKit = await ensureKit(directory, previous.homeKit, config.home, code, "HOME");
  const awayKit = await ensureKit(directory, previous.awayKit, config.away, code, "AWAY");

  return {
    code,
    name: config.name,
    season: "2026/27",
    crest,
    city,
    stadium,
    backdrop: stadium,
    manager,
    managerName: config.manager?.[0] || null,
    homeKit,
    awayKit,
    rivalName: config.rival[0],
    sources: {
      crest: crestSource,
      city: citySource,
      stadium: stadiumSource,
      manager: managerSource,
      homeKit: previous.sources?.homeKit || "generated-local-fallback",
      awayKit: previous.sources?.awayKit || "generated-local-fallback"
    }
  };
}

async function attachRival(code, entry, allEntries) {
  const [rivalName, rivalCode] = CLUBS[code].rival;
  if (rivalCode && allEntries[rivalCode]?.crest && await manifestAssetExists(allEntries[rivalCode].crest)) {
    entry.rivalCrest = allEntries[rivalCode].crest;
    entry.sources.rivalCrest = `league:${rivalCode}`;
    return;
  }
  const directory = path.join(OUTPUT_ROOT, code.toLowerCase());
  const source = await resolveRivalBadge(rivalName);
  entry.rivalCrest = await ensureDownloaded({ directory, stem: "rival-crest", existingUrl: entry.rivalCrest, source });
  entry.sources.rivalCrest = source;
}

async function validateEntry(code, entry) {
  const required = {
    crest: await manifestAssetExists(entry.crest),
    city: await manifestAssetExists(entry.city),
    stadium: await manifestAssetExists(entry.stadium),
    manager: CLUBS[code].manager ? await manifestAssetExists(entry.manager) : true,
    rival: await manifestAssetExists(entry.rivalCrest),
    homeKit: await manifestAssetExists(entry.homeKit),
    awayKit: await manifestAssetExists(entry.awayKit)
  };
  return { code, ...required, complete: Object.values(required).every(Boolean) };
}

async function main() {
  await mkdir(OUTPUT_ROOT, { recursive: true });
  const previousManifest = await readJson(MANIFEST_PATH, { clubs: {} });
  const entries = {};

  for (const [code, config] of Object.entries(CLUBS)) {
    log(`→ ${code} ${config.name}`);
    entries[code] = await buildBaseAssets(code, config, previousManifest.clubs?.[code] || { sources: {} });
  }

  for (const code of Object.keys(CLUBS)) await attachRival(code, entries[code], entries);

  const report = [];
  for (const code of Object.keys(CLUBS)) {
    const status = await validateEntry(code, entries[code]);
    entries[code].complete = status.complete;
    report.push(status);
    log(`  ${status.complete ? "✓" : "!"} ${code} city=${status.city} stadium=${status.stadium} manager=${status.manager} rival=${status.rival}`);
  }

  const manifest = {
    pipelineVersion: 11,
    season: "2026/27",
    generatedAt: new Date().toISOString(),
    source: "direct verified local pack: football-data crests, Wikimedia city/stadium/manager media, TheSportsDB external rival crests, local kit fallbacks",
    runtimeNetworkRequired: false,
    clubCount: Object.keys(entries).length,
    completeClubCount: report.filter(item => item.complete).length,
    clubs: entries
  };

  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(REPORT_PATH, `${JSON.stringify({ generatedAt: manifest.generatedAt, clubs: report }, null, 2)}\n`, "utf8");

  const incomplete = report.filter(item => !item.complete);
  if (incomplete.length) throw new Error(`media validation failed for: ${incomplete.map(item => item.code).join(", ")}`);
  log(`Done: ${report.length}/${report.length} clubs passed final media validation.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

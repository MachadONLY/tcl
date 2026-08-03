import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_ROOT = path.join(ROOT, "public", "assets", "clubs", "2026-27");
const MANIFEST_PATH = path.join(OUTPUT_ROOT, "manifest.json");
const REPORT_PATH = path.join(OUTPUT_ROOT, "validation-report.json");
const FORCE = process.argv.includes("--force");
const SPORTS_DB_KEY = process.env.THESPORTSDB_KEY || "3";

const CLUBS = Object.freeze({
  ARS: { city: "London", stadium: "Emirates_Stadium", manager: ["Mikel Arteta", "Mikel_Arteta"], rival: ["Tottenham Hotspur", "TOT"] },
  AVL: { city: "Birmingham", stadium: "Villa_Park", manager: ["Unai Emery", "Unai_Emery"], rival: ["Birmingham City", null] },
  BOU: { city: "Bournemouth", stadium: "Dean_Court", manager: ["Marco Rose", "Marco_Rose"], rival: ["Southampton", null] },
  BRE: { city: "London", stadium: "Brentford_Community_Stadium", manager: ["Keith Andrews", "Keith_Andrews_(footballer)"], rival: ["Fulham", "FUL"] },
  BHA: { city: "Brighton", stadium: "Falmer_Stadium", manager: ["Fabian Hürzeler", "Fabian_Hürzeler"], rival: ["Crystal Palace", "CRY"] },
  CHE: { city: "London", stadium: "Stamford_Bridge_(stadium)", manager: ["Xabi Alonso", "Xabi_Alonso"], rival: ["Fulham", "FUL"] },
  COV: { city: "Coventry", stadium: "Coventry_Building_Society_Arena", manager: ["Frank Lampard", "Frank_Lampard"], rival: ["Leicester City", null] },
  CRY: { city: "London", stadium: "Selhurst_Park", manager: ["Pierre Sage", "Pierre_Sage"], rival: ["Brighton & Hove Albion", "BHA"] },
  EVE: { city: "Liverpool", stadium: "Everton_Stadium", manager: ["David Moyes", "David_Moyes"], rival: ["Liverpool", "LIV"] },
  FUL: { city: "London", stadium: "Craven_Cottage", manager: ["Álvaro Arbeloa", "Álvaro_Arbeloa"], rival: ["Chelsea", "CHE"] },
  HUL: { city: "Kingston upon Hull", stadium: "MKM_Stadium", manager: ["Sergej Jakirović", "Sergej_Jakirović"], rival: ["Leeds United", "LEE"] },
  IPS: { city: "Ipswich", stadium: "Portman_Road", manager: ["Gary O'Neil", "Gary_O'Neil"], rival: ["Norwich City", null] },
  LEE: { city: "Leeds", stadium: "Elland_Road", manager: ["Daniel Farke", "Daniel_Farke"], rival: ["Manchester United", "MUN"] },
  LIV: { city: "Liverpool", stadium: "Anfield", manager: ["Andoni Iraola", "Andoni_Iraola"], rival: ["Everton", "EVE"] },
  MCI: { city: "Manchester", stadium: "City_of_Manchester_Stadium", manager: ["Enzo Maresca", "Enzo_Maresca"], rival: ["Manchester United", "MUN"] },
  MUN: { city: "Manchester", stadium: "Old_Trafford", manager: ["Michael Carrick", "Michael_Carrick"], rival: ["Liverpool", "LIV"] },
  NEW: { city: "Newcastle upon Tyne", stadium: "St_James'_Park", manager: null, rival: ["Sunderland", "SUN"] },
  NFO: { city: "Nottingham", stadium: "City_Ground", manager: ["Oliver Glasner", "Oliver_Glasner"], rival: ["Derby County", null] },
  SUN: { city: "Sunderland", stadium: "Stadium_of_Light", manager: ["Régis Le Bris", "Régis_Le_Bris"], rival: ["Newcastle United", "NEW"] },
  TOT: { city: "London", stadium: "Tottenham_Hotspur_Stadium", manager: ["Roberto De Zerbi", "Roberto_De_Zerbi"], rival: ["Arsenal", "ARS"] }
});

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

async function fetchWithRetry(url, options = {}, attempts = 3, timeout = 35000) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await wait(450 * attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error(`request failed: ${url}`);
}

async function fetchJson(url) {
  const response = await fetchWithRetry(url, { headers: { Accept: "application/json" } });
  return response.json();
}

function likelyPhoto(source) {
  let value = String(source || "").toLowerCase();
  try { value = decodeURIComponent(value); } catch { /* keep encoded */ }
  return Boolean(value) && !/\b(?:logo|crest|badge|coat[_ -]?of[_ -]?arms|flag|emblem|wordmark|icon|diagram|map)\b/.test(value);
}

async function pageImage(page, size, requirePhoto) {
  if (!page) return "";
  try {
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
  } catch {
    return "";
  }
}

async function searchImage(query, size, requirePhoto) {
  try {
    const url = new URL("https://en.wikipedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("generator", "search");
    url.searchParams.set("gsrsearch", query);
    url.searchParams.set("gsrlimit", "10");
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
  } catch {
    // caller keeps existing verified local asset
  }
  return "";
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
  return "jpg";
}

async function removeVariants(directory, stem) {
  await Promise.all(["jpg", "jpeg", "png", "webp", "gif"].map(extension =>
    rm(path.join(directory, `${stem}.${extension}`), { force: true }).catch(() => {})
  ));
}

async function downloadImage(source, directory, stem) {
  if (!source) throw new Error("no source");
  const response = await fetchWithRetry(source, { headers: { Accept: "image/avif,image/webp,image/png,image/jpeg,image/*" } }, 3, 45000);
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

async function resolveRivalBadge(name) {
  try {
    const payload = await fetchJson(`https://www.thesportsdb.com/api/v1/json/${SPORTS_DB_KEY}/searchteams.php?t=${encodeURIComponent(name)}`);
    const team = payload?.teams?.find(item => /England/i.test(item.strCountry || "")) || payload?.teams?.[0];
    return team?.strBadge || team?.strLogo || "";
  } catch {
    return "";
  }
}

async function ensurePhoto({ code, entry, directory, key, page, queries, size }) {
  const existing = entry[key];
  if (!FORCE && await manifestAssetExists(existing)) return { url: existing, source: entry.sources?.[key] || "existing-local" };

  const source = await resolveWikiImage(page, queries, size, true);
  if (!source) {
    if (await manifestAssetExists(existing)) return { url: existing, source: entry.sources?.[key] || "existing-local" };
    entry[key] = null;
    return { url: null, source: null };
  }

  try {
    const url = await downloadImage(source, directory, key);
    return { url, source };
  } catch (error) {
    log(`  ! ${code} ${key}: ${error.message}`);
    if (await manifestAssetExists(existing)) return { url: existing, source: entry.sources?.[key] || "existing-local" };
    entry[key] = null;
    return { url: null, source: null };
  }
}

async function ensureManager(code, entry, directory, manager) {
  if (!manager) {
    entry.manager = null;
    entry.managerName = null;
    return { url: null, source: null };
  }

  const [name, page] = manager;
  const existing = entry.manager;
  if (!FORCE && await manifestAssetExists(existing)) {
    entry.managerName = name;
    return { url: existing, source: entry.sources?.manager || "existing-local" };
  }

  const source = await resolveWikiImage(page, [`${name} football manager`, `${name} coach`], 1000, false);
  if (!source) {
    entry.manager = null;
    entry.managerName = name;
    return { url: null, source: null };
  }

  try {
    const url = await downloadImage(source, directory, "manager");
    entry.managerName = name;
    return { url, source };
  } catch (error) {
    log(`  ! ${code} manager: ${error.message}`);
    entry.manager = null;
    entry.managerName = name;
    return { url: null, source: null };
  }
}

async function ensureRival(code, entry, directory, rival, manifest) {
  const [name, leagueCode] = rival;
  entry.rivalName = name;
  if (leagueCode && manifest.clubs?.[leagueCode]?.crest && await manifestAssetExists(manifest.clubs[leagueCode].crest)) {
    return { url: manifest.clubs[leagueCode].crest, source: `league:${leagueCode}` };
  }

  const existing = entry.rivalCrest;
  if (!FORCE && await manifestAssetExists(existing)) return { url: existing, source: entry.sources?.rivalCrest || "existing-local" };

  const source = await resolveRivalBadge(name);
  if (!source) {
    entry.rivalCrest = null;
    return { url: null, source: null };
  }

  try {
    const url = await downloadImage(source, directory, "rival-crest");
    return { url, source };
  } catch (error) {
    log(`  ! ${code} rival: ${error.message}`);
    entry.rivalCrest = null;
    return { url: null, source: null };
  }
}

async function processClub(code, config, manifest) {
  const entry = manifest.clubs?.[code];
  if (!entry) throw new Error(`manifest entry missing for ${code}`);
  const directory = path.join(OUTPUT_ROOT, code.toLowerCase());
  entry.sources ||= {};

  log(`→ ${code}`);
  const cityName = config.city.replaceAll("_", " ");
  const stadiumName = config.stadium.replaceAll("_", " ").replace(/\s*\([^)]*\)/g, "");

  const [city, stadium, manager, rival] = await Promise.all([
    ensurePhoto({ code, entry, directory, key: "city", page: config.city, queries: [`${cityName} skyline England`, `${cityName} city centre England`], size: 1600 }),
    ensurePhoto({ code, entry, directory, key: "stadium", page: config.stadium, queries: [`${stadiumName} football stadium exterior`, `${stadiumName} pitch`], size: 1800 }),
    ensureManager(code, entry, directory, config.manager),
    ensureRival(code, entry, directory, config.rival, manifest)
  ]);

  entry.city = city.url;
  entry.stadium = stadium.url;
  entry.manager = manager.url;
  entry.rivalCrest = rival.url;
  entry.sources.city = city.source;
  entry.sources.stadium = stadium.source;
  entry.sources.manager = manager.source;
  entry.sources.rivalCrest = rival.source;

  const status = {
    code,
    crest: await manifestAssetExists(entry.crest),
    city: await manifestAssetExists(entry.city),
    stadium: await manifestAssetExists(entry.stadium),
    manager: config.manager ? await manifestAssetExists(entry.manager) : true,
    rival: await manifestAssetExists(entry.rivalCrest),
    homeKit: await manifestAssetExists(entry.homeKit),
    awayKit: await manifestAssetExists(entry.awayKit)
  };
  status.complete = Object.values(status).every(value => value === code || value === true);
  log(`  ${status.complete ? "✓" : "!"} city=${status.city} stadium=${status.stadium} manager=${status.manager} rival=${status.rival}`);
  return status;
}

async function main() {
  const manifest = await readJson(MANIFEST_PATH, null);
  if (!manifest?.clubs) throw new Error("onboarding manifest is missing; run sync-onboarding-assets-v3 first");

  const report = [];
  for (const [code, config] of Object.entries(CLUBS)) {
    try { report.push(await processClub(code, config, manifest)); }
    catch (error) {
      log(`  ✕ ${code}: ${error.message}`);
      report.push({ code, complete: false, error: error.message });
    }
  }

  manifest.pipelineVersion = Math.max(11, Number(manifest.pipelineVersion || 0));
  manifest.finalMediaGeneratedAt = new Date().toISOString();
  manifest.finalMediaCompleteClubCount = report.filter(item => item.complete).length;
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await writeFile(REPORT_PATH, `${JSON.stringify({ generatedAt: new Date().toISOString(), clubs: report }, null, 2)}\n`, "utf8");

  const incomplete = report.filter(item => !item.complete);
  if (incomplete.length) {
    throw new Error(`media validation failed for: ${incomplete.map(item => item.code).join(", ")}`);
  }
  log(`Done: ${report.length}/${report.length} clubs passed final media validation.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

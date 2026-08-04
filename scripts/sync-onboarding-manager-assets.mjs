import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_ROOT = path.join(ROOT, "public", "assets", "clubs", "2026-27");
const MANIFEST_PATH = path.join(OUTPUT_ROOT, "manifest.json");
const FORCE = process.argv.includes("--force");
const CLUB_FILTER = process.argv.find(value => value.startsWith("--club="))?.split("=")[1]?.toUpperCase() || null;

const MANAGERS = Object.freeze({
  ARS: { name: "Mikel Arteta", page: "Mikel_Arteta" },
  AVL: { name: "Unai Emery", page: "Unai_Emery" },
  BOU: { name: "Marco Rose", page: "Marco_Rose" },
  BRE: { name: "Keith Andrews", page: "Keith_Andrews_(footballer)" },
  BHA: { name: "Fabian Hürzeler", page: "Fabian_Hürzeler" },
  CHE: {
    name: "Xabi Alonso",
    page: "Xabi_Alonso",
    source: "https://upload.wikimedia.org/wikipedia/commons/b/bb/Xabi_Alonso_01.png"
  },
  COV: { name: "Frank Lampard", page: "Frank_Lampard" },
  CRY: { name: "Pierre Sage", page: "Pierre_Sage" },
  EVE: { name: "David Moyes", page: "David_Moyes" },
  FUL: { name: "Álvaro Arbeloa", page: "Álvaro_Arbeloa" },
  HUL: { name: "Sergej Jakirović", page: "Sergej_Jakirović" },
  IPS: { name: "Gary O'Neil", page: "Gary_O'Neil" },
  LEE: { name: "Daniel Farke", page: "Daniel_Farke" },
  LIV: { name: "Andoni Iraola", page: "Andoni_Iraola" },
  MCI: { name: "Enzo Maresca", page: "Enzo_Maresca" },
  MUN: { name: "Michael Carrick", page: "Michael_Carrick" },
  NFO: { name: "Oliver Glasner", page: "Oliver_Glasner" },
  SUN: { name: "Régis Le Bris", page: "Régis_Le_Bris" },
  TOT: { name: "Roberto De Zerbi", page: "Roberto_De_Zerbi" }
});

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const log = value => process.stdout.write(`${value}\n`);

async function readJson(filePath, fallback) {
  try { return JSON.parse(await readFile(filePath, "utf8")); }
  catch { return fallback; }
}

async function existingFile(filePath) {
  if (!existsSync(filePath)) return false;
  try { return (await stat(filePath)).size > 512; }
  catch { return false; }
}

async function fetchWithRetry(url, options = {}, attempts = 3, timeout = 32000) {
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
  throw finalError || new Error(`request failed: ${url}`);
}

async function fetchJson(url) {
  const response = await fetchWithRetry(url, { headers: { Accept: "application/json" } });
  return response.json();
}

function safeUrl(value) {
  const source = String(value || "").trim();
  return /^https:\/\//i.test(source) ? source : null;
}

function likelyPortrait(source) {
  const url = safeUrl(source);
  if (!url) return false;
  let decoded = url.toLowerCase();
  try { decoded = decodeURIComponent(decoded); } catch { /* keep encoded */ }
  if (/\.svg(?:\?|$)/.test(decoded)) return false;
  if (/\b(?:logo|crest|badge|flag|emblem|icon|kit|shirt|jersey)\b/.test(decoded)) return false;
  return /upload\.wikimedia\.org/.test(decoded) || /\.(?:jpe?g|png|webp)(?:\?|$)/.test(decoded);
}

async function summaryPortrait(page) {
  try {
    const payload = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page)}`);
    const source = safeUrl(payload?.originalimage?.source || payload?.thumbnail?.source);
    return likelyPortrait(source) ? source : null;
  } catch {
    return null;
  }
}

async function searchPortrait(name) {
  try {
    const url = new URL("https://en.wikipedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("generator", "search");
    url.searchParams.set("gsrsearch", `${name} football manager`);
    url.searchParams.set("gsrlimit", "10");
    url.searchParams.set("prop", "pageimages");
    url.searchParams.set("piprop", "original|thumbnail");
    url.searchParams.set("pithumbsize", "1600");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");
    const payload = await fetchJson(url.toString());
    const pages = Object.values(payload?.query?.pages || {}).sort((a, b) => Number(a.index || 99) - Number(b.index || 99));
    for (const page of pages) {
      const source = safeUrl(page?.original?.source || page?.thumbnail?.source);
      if (likelyPortrait(source)) return source;
    }
  } catch {
    // no portrait found
  }
  return null;
}

function optimizedUrl(source) {
  const url = new URL("https://images.weserv.nl/");
  url.searchParams.set("url", source.replace(/^https?:\/\//i, ""));
  url.searchParams.set("output", "webp");
  url.searchParams.set("q", "86");
  url.searchParams.set("w", "620");
  url.searchParams.set("h", "760");
  url.searchParams.set("fit", "cover");
  url.searchParams.set("position", "top");
  return url.toString();
}

async function savePortrait(source, destination) {
  const response = await fetchWithRetry(optimizedUrl(source), {
    headers: { Accept: "image/webp,image/*" }
  }, 3, 42000);
  const type = response.headers.get("content-type") || "";
  if (!type.startsWith("image/")) throw new Error(`unexpected content type ${type}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength < 512) throw new Error("portrait payload is empty");
  await writeFile(destination, buffer);
}

async function syncManager(code, manager, manifest) {
  const entry = manifest.clubs?.[code];
  if (!entry) return;

  const directory = path.join(OUTPUT_ROOT, code.toLowerCase());
  const destination = path.join(directory, "manager.webp");
  await mkdir(directory, { recursive: true });

  if (!FORCE && entry.manager && await existingFile(destination)) {
    entry.managerName = manager.name;
    return;
  }

  const source = safeUrl(manager.source)
    || await summaryPortrait(manager.page)
    || await searchPortrait(manager.name);
  if (!source) {
    log(`  ! ${code}: manager portrait not found`);
    return;
  }

  await savePortrait(source, destination);
  entry.manager = `/assets/clubs/2026-27/${code.toLowerCase()}/manager.webp`;
  entry.managerName = manager.name;
  entry.sources ||= {};
  entry.sources.manager = source;
  log(`  ✓ ${code}: ${manager.name}`);
}

async function main() {
  const manifest = await readJson(MANIFEST_PATH, null);
  if (!manifest?.clubs) throw new Error("onboarding manifest is missing; run the main asset sync first");

  const selected = Object.entries(MANAGERS).filter(([code]) => !CLUB_FILTER || code === CLUB_FILTER);
  if (!selected.length) throw new Error(`Unknown or unsupported club code: ${CLUB_FILTER}`);

  log(`Ensuring ${selected.length} local manager portrait${selected.length === 1 ? "" : "s"}`);
  for (const [code, manager] of selected) {
    try { await syncManager(code, manager, manifest); }
    catch (error) { log(`  ! ${code}: ${error.message}`); }
  }

  manifest.managerPortraitsGeneratedAt = new Date().toISOString();
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

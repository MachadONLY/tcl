import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SEASON = "2026-27";
const OUTPUT_ROOT = path.join(ROOT, "public", "assets", "clubs", SEASON);
const MANIFEST_PATH = path.join(OUTPUT_ROOT, "manifest.json");
const SPORTS_DB_KEY = process.env.THESPORTSDB_KEY || "3";
const FORCE = process.argv.includes("--force");
const CONCURRENCY = 3;

const CLUBS = [
  { code: "ARS", team: "Arsenal", city: "London", managerWiki: "Mikel_Arteta" },
  { code: "AVL", team: "Aston Villa", city: "Birmingham", managerWiki: "Unai_Emery" },
  { code: "BOU", team: "Bournemouth", city: "Bournemouth", managerWiki: "Marco_Rose" },
  { code: "BRE", team: "Brentford", city: "London", managerWiki: "Keith_Andrews_(footballer)" },
  { code: "BHA", team: "Brighton", city: "Brighton", managerWiki: "Fabian_Hürzeler" },
  { code: "CHE", team: "Chelsea", city: "London", managerWiki: "Xabi_Alonso" },
  { code: "COV", team: "Coventry City", city: "Coventry", managerWiki: "Frank_Lampard" },
  { code: "CRY", team: "Crystal Palace", city: "London", managerWiki: "Pierre_Sage" },
  { code: "EVE", team: "Everton", city: "Liverpool", managerWiki: "David_Moyes" },
  { code: "FUL", team: "Fulham", city: "London", managerWiki: "Álvaro_Arbeloa" },
  { code: "HUL", team: "Hull City", city: "Kingston_upon_Hull", managerWiki: "Sergej_Jakirović" },
  { code: "IPS", team: "Ipswich Town", city: "Ipswich", managerWiki: "Gary_O%27Neil" },
  { code: "LEE", team: "Leeds United", city: "Leeds", managerWiki: "Daniel_Farke" },
  { code: "LIV", team: "Liverpool", city: "Liverpool", managerWiki: "Andoni_Iraola" },
  { code: "MCI", team: "Manchester City", city: "Manchester", managerWiki: "Enzo_Maresca" },
  { code: "MUN", team: "Manchester United", city: "Manchester", managerWiki: "Michael_Carrick" },
  { code: "NEW", team: "Newcastle United", city: "Newcastle_upon_Tyne", managerWiki: null },
  { code: "NFO", team: "Nottingham Forest", city: "Nottingham", managerWiki: null },
  { code: "SUN", team: "Sunderland", city: "Sunderland", managerWiki: null },
  { code: "TOT", team: "Tottenham Hotspur", city: "London", managerWiki: null }
];

const ASSET_SPECS = {
  crest: { width: 420, height: 420, fit: "contain", quality: 84 },
  stadium: { width: 1600, height: 900, fit: "cover", quality: 78 },
  city: { width: 1280, height: 720, fit: "cover", quality: 76 },
  backdrop: { width: 1920, height: 1080, fit: "cover", quality: 75 },
  manager: { width: 520, height: 620, fit: "cover", quality: 80 },
  homeKit: { width: 620, height: 620, fit: "contain", quality: 84 },
  awayKit: { width: 620, height: 620, fit: "contain", quality: 84 }
};

function log(message) {
  process.stdout.write(`${message}\n`);
}

function safeUrl(value) {
  const url = String(value || "").trim();
  return /^https:\/\//i.test(url) ? url : null;
}

function seasonMatches(value) {
  const normalized = String(value || "").replace(/\s/g, "").toLowerCase();
  return /2026.*2027|2026-27|26\/27/.test(normalized);
}

function equipmentForSeason(items, type) {
  return (items || []).find(item => {
    const itemType = String(item.strType || "").toLowerCase();
    return seasonMatches(item.strSeason) && itemType.includes(type);
  })?.strEquipment || null;
}

async function fetchWithTimeout(url, options = {}, timeout = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url) {
  const response = await fetchWithTimeout(url, { headers: { Accept: "application/json" } });
  return response.json();
}

async function wikipediaImage(page) {
  if (!page) return null;
  try {
    const data = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page)}`);
    return safeUrl(data?.originalimage?.source || data?.thumbnail?.source);
  } catch {
    return null;
  }
}

function optimizedUrl(source, spec) {
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

async function saveOptimized(source, destinationBase, spec) {
  if (!source) return null;
  const webpPath = `${destinationBase}.webp`;
  const publicUrl = `/${path.relative(path.join(ROOT, "public"), webpPath).split(path.sep).join("/")}`;

  if (!FORCE && existsSync(webpPath)) return publicUrl;

  const response = await fetchWithTimeout(optimizedUrl(source, spec), {
    headers: { Accept: "image/webp,image/*" }
  }, 30000);
  const type = response.headers.get("content-type") || "";
  if (!type.startsWith("image/")) throw new Error(`Unexpected content type ${type}`);

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(webpPath, buffer);
  return publicUrl;
}

async function loadExistingManifest() {
  try {
    return JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  } catch {
    return { season: "2026/27", generatedAt: null, source: "local-pack", clubs: {} };
  }
}

async function fetchTeamData(club) {
  const result = await fetchJson(
    `https://www.thesportsdb.com/api/v1/json/${SPORTS_DB_KEY}/searchteams.php?t=${encodeURIComponent(club.team)}`
  );
  return result?.teams?.find(team => /England/i.test(team.strCountry || "")) || result?.teams?.[0] || null;
}

async function fetchEquipment(teamId) {
  if (!teamId) return [];
  try {
    const result = await fetchJson(
      `https://www.thesportsdb.com/api/v1/json/${SPORTS_DB_KEY}/lookupequipment.php?id=${teamId}`
    );
    return result?.equipment || [];
  } catch {
    return [];
  }
}

async function syncClub(club, manifest) {
  const clubDir = path.join(OUTPUT_ROOT, club.code.toLowerCase());
  await mkdir(clubDir, { recursive: true });

  log(`→ ${club.code} ${club.team}`);
  const team = await fetchTeamData(club);
  if (!team) throw new Error(`Team not found: ${club.team}`);

  const equipment = await fetchEquipment(team.idTeam);
  const cityImage = await wikipediaImage(club.city);
  const managerImage = await wikipediaImage(club.managerWiki);

  const sources = {
    crest: safeUrl(team.strBadge || team.strLogo),
    stadium: safeUrl(team.strStadiumThumb),
    city: cityImage,
    backdrop: safeUrl(team.strFanart1 || team.strFanart2 || team.strStadiumThumb),
    manager: managerImage,
    homeKit: safeUrl(equipmentForSeason(equipment, "home")),
    awayKit: safeUrl(equipmentForSeason(equipment, "away"))
  };

  const entry = {
    code: club.code,
    name: team.strTeam || club.team,
    providerTeamId: team.idTeam || null,
    generatedAt: new Date().toISOString()
  };

  for (const [kind, source] of Object.entries(sources)) {
    if (!source) continue;
    try {
      const filename = kind.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
      entry[kind] = await saveOptimized(source, path.join(clubDir, filename), ASSET_SPECS[kind]);
    } catch (error) {
      log(`  ! ${kind}: ${error.message}`);
    }
  }

  manifest.clubs[club.code] = entry;
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  log(`  ✓ ${Object.keys(entry).filter(key => ASSET_SPECS[key]).length} assets`);
}

async function runPool(items, worker, concurrency) {
  let cursor = 0;
  const runners = Array.from({ length: concurrency }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      try {
        await worker(item);
      } catch (error) {
        log(`  ✕ ${item.code}: ${error.message}`);
      }
    }
  });
  await Promise.all(runners);
}

async function main() {
  await mkdir(OUTPUT_ROOT, { recursive: true });
  const manifest = await loadExistingManifest();
  manifest.season = "2026/27";
  manifest.source = "TheSportsDB + Wikipedia, optimized at build time";
  manifest.generatedAt = new Date().toISOString();
  manifest.clubs ||= {};

  log(`Syncing ${CLUBS.length} club media packs into ${path.relative(ROOT, OUTPUT_ROOT)}`);
  await runPool(CLUBS, club => syncClub(club, manifest), CONCURRENCY);

  manifest.generatedAt = new Date().toISOString();
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  log("Done. Runtime can now use the local manifest without waiting for network images.");
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

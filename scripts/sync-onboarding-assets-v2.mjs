import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SEASON_SLUG = "2026-27";
const OUTPUT_ROOT = path.join(ROOT, "public", "assets", "clubs", SEASON_SLUG);
const MANIFEST_PATH = path.join(OUTPUT_ROOT, "manifest.json");
const OVERRIDES_PATH = path.join(ROOT, "scripts", "onboarding-assets-overrides.json");
const SPORTS_DB_KEY = process.env.THESPORTSDB_KEY || "123";
const FORCE = process.argv.includes("--force");
const CLUB_FILTER = process.argv.find(arg => arg.startsWith("--club="))?.split("=")[1]?.toUpperCase() || null;
const CONCURRENCY = Math.max(1, Math.min(6, Number(process.env.ASSET_SYNC_CONCURRENCY || 3)));

const CLUBS = [
  { code: "ARS", team: "Arsenal", footballDataId: 57, city: "London", stadium: "Emirates_Stadium", manager: "Mikel_Arteta", home: ["#d71920", "#ffffff", "sleeves"], away: ["#fff000", "#102b5c", "trim"] },
  { code: "AVL", team: "Aston Villa", footballDataId: 58, city: "Birmingham", stadium: "Villa_Park", manager: "Unai_Emery", home: ["#7a2048", "#95c9e8", "sleeves"], away: ["#f4f2e9", "#7a2048", "trim"] },
  { code: "BOU", team: "AFC Bournemouth", footballDataId: 1044, city: "Bournemouth", stadium: "Dean_Court", manager: "Marco_Rose", home: ["#d71920", "#111111", "stripes"], away: ["#e8f5ff", "#101820", "trim"] },
  { code: "BRE", team: "Brentford", footballDataId: 402, city: "London", stadium: "Brentford_Community_Stadium", manager: "Keith_Andrews_(footballer)", home: ["#ffffff", "#df1625", "stripes"], away: ["#171717", "#f0cf25", "trim"] },
  { code: "BHA", team: "Brighton & Hove Albion", footballDataId: 397, city: "Brighton", stadium: "Falmer_Stadium", manager: "Fabian_Hürzeler", home: ["#ffffff", "#0057b8", "stripes"], away: ["#ff6a00", "#101820", "trim"] },
  { code: "CHE", team: "Chelsea", footballDataId: 61, city: "London", stadium: "Stamford_Bridge_(stadium)", manager: "Xabi_Alonso", home: ["#034694", "#ffffff", "trim"], away: ["#f5f3eb", "#d51d2e", "stripe-center"] },
  { code: "COV", team: "Coventry City", footballDataId: 1076, city: "Coventry", stadium: "Coventry_Building_Society_Arena", manager: "Frank_Lampard", home: ["#69bfe7", "#ffffff", "trim"], away: ["#181818", "#69bfe7", "stripe-center"] },
  { code: "CRY", team: "Crystal Palace", footballDataId: 354, city: "London", stadium: "Selhurst_Park", manager: "Pierre_Sage", home: ["#1b458f", "#c4122e", "stripes"], away: ["#f4f0df", "#1b458f", "sash"] },
  { code: "EVE", team: "Everton", footballDataId: 62, city: "Liverpool", stadium: "Everton_Stadium", manager: "David_Moyes", home: ["#003399", "#ffffff", "trim"], away: ["#f1d9b5", "#112a4a", "trim"] },
  { code: "FUL", team: "Fulham", footballDataId: 63, city: "London", stadium: "Craven_Cottage", manager: "Álvaro_Arbeloa", home: ["#ffffff", "#111111", "sleeves"], away: ["#d9ff2f", "#111111", "trim"] },
  { code: "HUL", team: "Hull City", footballDataId: 322, city: "Kingston_upon_Hull", stadium: "MKM_Stadium", manager: "Sergej_Jakirović", home: ["#f5a623", "#111111", "stripes"], away: ["#f3f3f3", "#f5a623", "trim"] },
  { code: "IPS", team: "Ipswich Town", footballDataId: 349, city: "Ipswich", stadium: "Portman_Road", manager: "Gary_O%27Neil", home: ["#0057b8", "#ffffff", "trim"], away: ["#ff5a36", "#111111", "trim"] },
  { code: "LEE", team: "Leeds United", footballDataId: 341, city: "Leeds", stadium: "Elland_Road", manager: "Daniel_Farke", home: ["#ffffff", "#ffcd00", "trim"], away: ["#164a85", "#ffcd00", "trim"] },
  { code: "LIV", team: "Liverpool", footballDataId: 64, city: "Liverpool", stadium: "Anfield", manager: "Andoni_Iraola", home: ["#c8102e", "#ffffff", "trim"], away: ["#f1eee5", "#16827b", "trim"] },
  { code: "MCI", team: "Manchester City", footballDataId: 65, city: "Manchester", stadium: "City_of_Manchester_Stadium", manager: "Enzo_Maresca", home: ["#6cabdd", "#ffffff", "trim"], away: ["#101010", "#f2cf20", "stripe-center"] },
  { code: "MUN", team: "Manchester United", footballDataId: 66, city: "Manchester", stadium: "Old_Trafford", manager: "Michael_Carrick", home: ["#da291c", "#ffffff", "trim"], away: ["#f2efe7", "#2a2a2a", "trim"] },
  { code: "NEW", team: "Newcastle United", footballDataId: 67, city: "Newcastle_upon_Tyne", stadium: "St_James%27_Park", manager: null, home: ["#ffffff", "#111111", "stripes"], away: ["#4f2d7f", "#f4b942", "trim"] },
  { code: "NFO", team: "Nottingham Forest", footballDataId: 351, city: "Nottingham", stadium: "City_Ground", manager: null, home: ["#e53233", "#ffffff", "trim"], away: ["#f2d94e", "#10293f", "trim"] },
  { code: "SUN", team: "Sunderland", footballDataId: 746, city: "Sunderland", stadium: "Stadium_of_Light", manager: null, home: ["#ffffff", "#d71920", "stripes"], away: ["#1e314f", "#e8d7b0", "trim"] },
  { code: "TOT", team: "Tottenham Hotspur", footballDataId: 73, city: "London", stadium: "Tottenham_Hotspur_Stadium", manager: null, home: ["#ffffff", "#132257", "trim"], away: ["#171722", "#b8ff42", "trim"] }
];

const SPECS = Object.freeze({
  crest: { width: 420, height: 420, fit: "contain", quality: 86 },
  stadium: { width: 1600, height: 900, fit: "cover", quality: 80 },
  city: { width: 1280, height: 720, fit: "cover", quality: 78 },
  backdrop: { width: 1920, height: 1080, fit: "cover", quality: 77 },
  manager: { width: 520, height: 620, fit: "cover", quality: 82 },
  homeKit: { width: 620, height: 620, fit: "contain", quality: 88 },
  awayKit: { width: 620, height: 620, fit: "contain", quality: 88 }
});

const ASSET_KEYS = Object.keys(SPECS);
const now = () => new Date().toISOString();
const log = message => process.stdout.write(`${message}\n`);

function safeUrl(value) {
  const source = String(value || "").trim();
  return /^https:\/\//i.test(source) ? source : null;
}

function publicUrl(filePath) {
  return `/${path.relative(path.join(ROOT, "public"), filePath).split(path.sep).join("/")}`;
}

function matchesSeason(value) {
  return /(?:2026\s*[-/]?\s*27)|(?:2026.*2027)|(?:26\s*[-/]\s*27)/i.test(String(value || ""));
}

function equipmentUrl(items, kind) {
  const aliases = kind === "homeKit" ? ["home"] : ["away", "alternate", "third"];
  const exact = (items || []).find(item => {
    const type = String(item.strType || "").toLowerCase();
    return matchesSeason(item.strSeason) && aliases.some(alias => type.includes(alias));
  });
  return safeUrl(exact?.strEquipment);
}

async function readJson(filePath, fallback) {
  try { return JSON.parse(await readFile(filePath, "utf8")); }
  catch { return fallback; }
}

async function fetchWithRetry(url, options = {}, attempts = 3, timeout = 20000) {
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
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, 350 * attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`${lastError?.message || "request failed"}: ${url}`);
}

async function fetchJson(url) {
  const response = await fetchWithRetry(url, { headers: { Accept: "application/json" } });
  return response.json();
}

async function wikipediaImage(page) {
  if (!page) return null;
  try {
    const payload = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page)}`);
    return safeUrl(payload?.originalimage?.source || payload?.thumbnail?.source);
  } catch {
    return null;
  }
}

async function teamData(club) {
  try {
    const payload = await fetchJson(`https://www.thesportsdb.com/api/v1/json/${SPORTS_DB_KEY}/searchteams.php?t=${encodeURIComponent(club.team)}`);
    return payload?.teams?.find(team => /England/i.test(team.strCountry || "")) || payload?.teams?.[0] || null;
  } catch {
    return null;
  }
}

async function equipment(teamId) {
  if (!teamId) return [];
  try {
    const payload = await fetchJson(`https://www.thesportsdb.com/api/v1/json/${SPORTS_DB_KEY}/lookupequipment.php?id=${encodeURIComponent(teamId)}`);
    return payload?.equipment || [];
  } catch {
    return [];
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

async function validExisting(filePath) {
  if (!existsSync(filePath)) return false;
  try { return (await stat(filePath)).size > 128; }
  catch { return false; }
}

async function saveWebp(source, filePath, spec) {
  if (!source) return null;
  if (!FORCE && await validExisting(filePath)) return publicUrl(filePath);
  const response = await fetchWithRetry(optimizedUrl(source, spec), {
    headers: { Accept: "image/webp,image/*" }
  }, 3, 35000);
  const type = response.headers.get("content-type") || "";
  if (!type.startsWith("image/")) throw new Error(`unexpected content type: ${type}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength < 128) throw new Error("downloaded image is empty");
  const temporary = `${filePath}.tmp`;
  await writeFile(temporary, buffer);
  await rename(temporary, filePath);
  return publicUrl(filePath);
}

function kitSvg([base, detail, pattern], clubCode, label) {
  const stripes = pattern === "stripes"
    ? `<path d="M76 45h24v150H76zm48 0h24v150h-24z" fill="${detail}" opacity=".96"/>`
    : pattern === "stripe-center"
      ? `<path d="M91 42h42v154H91z" fill="${detail}" opacity=".95"/>`
      : pattern === "sash"
        ? `<path d="M55 48 80 38l91 146-27 13z" fill="${detail}" opacity=".95"/>`
        : "";
  const trim = pattern === "trim" || pattern === "sleeves"
    ? `<path d="M54 48 22 70l17 36 28-17m91-41 32 22-17 36-28-17" fill="none" stroke="${detail}" stroke-width="10" stroke-linejoin="round"/><path d="M88 37q24 20 48 0" fill="none" stroke="${detail}" stroke-width="7"/>`
    : "";
  const sleeves = pattern === "sleeves"
    ? `<path d="m55 48-33 22 18 37 31-18V48zm102 0 33 22-18 37-31-18V48z" fill="${detail}"/>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 212 242" role="img" aria-label="${clubCode} ${label} kit fallback">
  <defs><filter id="s" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="9" stdDeviation="8" flood-opacity=".28"/></filter><clipPath id="shirt"><path d="m78 31 28 10 28-10 26 15 30 24-18 38-20-12v116H60V96l-20 12-18-38 30-24z"/></clipPath></defs>
  <g filter="url(#s)"><path d="m78 31 28 10 28-10 26 15 30 24-18 38-20-12v116H60V96l-20 12-18-38 30-24z" fill="${base}" stroke="rgba(255,255,255,.34)" stroke-width="2"/>
  <g clip-path="url(#shirt)">${stripes}${sleeves}</g>${trim}<path d="M78 31q28 25 56 0" fill="none" stroke="rgba(0,0,0,.2)" stroke-width="2"/>
  <text x="106" y="137" fill="${detail}" font-family="Arial, sans-serif" font-size="22" font-weight="800" text-anchor="middle" opacity=".78">${clubCode}</text></g>
</svg>\n`;
}

async function saveKitFallback(filePath, colors, clubCode, label) {
  if (!FORCE && await validExisting(filePath)) return publicUrl(filePath);
  await writeFile(filePath, kitSvg(colors, clubCode, label), "utf8");
  return publicUrl(filePath);
}

async function syncClub(club, manifest, overrides) {
  const lowerCode = club.code.toLowerCase();
  const clubDir = path.join(OUTPUT_ROOT, lowerCode);
  await mkdir(clubDir, { recursive: true });
  log(`→ ${club.code} ${club.team}`);

  const override = overrides?.clubs?.[club.code] || {};
  const [team, cityImage, stadiumImage, managerImage] = await Promise.all([
    teamData(club),
    wikipediaImage(club.city),
    wikipediaImage(club.stadium),
    wikipediaImage(club.manager)
  ]);
  const kits = await equipment(team?.idTeam);

  const sources = {
    crest: safeUrl(override.crest) || safeUrl(team?.strBadge || team?.strLogo) || `https://crests.football-data.org/${club.footballDataId}.png`,
    stadium: safeUrl(override.stadium) || stadiumImage || safeUrl(team?.strStadiumThumb),
    city: safeUrl(override.city) || cityImage,
    backdrop: safeUrl(override.backdrop) || safeUrl(team?.strFanart1 || team?.strFanart2) || stadiumImage || safeUrl(team?.strStadiumThumb),
    manager: safeUrl(override.manager) || managerImage,
    homeKit: safeUrl(override.homeKit) || equipmentUrl(kits, "homeKit"),
    awayKit: safeUrl(override.awayKit) || equipmentUrl(kits, "awayKit")
  };

  const entry = {
    code: club.code,
    name: team?.strTeam || club.team,
    providerTeamId: team?.idTeam || null,
    season: "2026/27",
    generatedAt: now(),
    sources: {}
  };

  for (const kind of ASSET_KEYS) {
    const filename = kind.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
    const source = sources[kind];
    try {
      if (source) {
        entry[kind] = await saveWebp(source, path.join(clubDir, `${filename}.webp`), SPECS[kind]);
        entry.sources[kind] = source;
      } else if (kind === "homeKit" || kind === "awayKit") {
        const colors = kind === "homeKit" ? club.home : club.away;
        entry[kind] = await saveKitFallback(path.join(clubDir, `${filename}.svg`), colors, club.code, kind === "homeKit" ? "HOME" : "AWAY");
        entry.sources[kind] = "generated-local-fallback";
      }
    } catch (error) {
      log(`  ! ${kind}: ${error.message}`);
      if (kind === "homeKit" || kind === "awayKit") {
        const colors = kind === "homeKit" ? club.home : club.away;
        entry[kind] = await saveKitFallback(path.join(clubDir, `${filename}.svg`), colors, club.code, kind === "homeKit" ? "HOME" : "AWAY");
        entry.sources[kind] = "generated-local-fallback";
      }
    }
  }

  entry.complete = ["crest", "stadium", "city", "homeKit", "awayKit"].every(key => Boolean(entry[key]));
  manifest.clubs[club.code] = entry;
  await writeManifest(manifest);
  log(`  ✓ ${ASSET_KEYS.filter(key => entry[key]).length}/${ASSET_KEYS.length} assets${entry.complete ? " — offline ready" : ""}`);
}

async function writeManifest(manifest) {
  const temporary = `${MANIFEST_PATH}.tmp`;
  await writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await rename(temporary, MANIFEST_PATH);
}

async function runPool(items, worker, concurrency) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      try { await worker(item); }
      catch (error) { log(`  ✕ ${item.code}: ${error.message}`); }
    }
  });
  await Promise.all(runners);
}

async function main() {
  await mkdir(OUTPUT_ROOT, { recursive: true });
  const [existing, overrides] = await Promise.all([
    readJson(MANIFEST_PATH, { clubs: {} }),
    readJson(OVERRIDES_PATH, { clubs: {} })
  ]);
  const manifest = {
    season: "2026/27",
    generatedAt: now(),
    source: "build-time local pack: TheSportsDB, football-data crests, Wikimedia imagery, explicit overrides",
    runtimeNetworkRequired: false,
    clubs: existing?.clubs || {}
  };
  const selected = CLUB_FILTER ? CLUBS.filter(club => club.code === CLUB_FILTER) : CLUBS;
  if (!selected.length) throw new Error(`Unknown club code: ${CLUB_FILTER}`);

  log(`Syncing ${selected.length} club${selected.length === 1 ? "" : "s"} into ${path.relative(ROOT, OUTPUT_ROOT)}`);
  await runPool(selected, club => syncClub(club, manifest, overrides), CONCURRENCY);
  manifest.generatedAt = now();
  manifest.clubCount = Object.keys(manifest.clubs).length;
  manifest.completeClubCount = Object.values(manifest.clubs).filter(entry => entry.complete).length;
  await writeManifest(manifest);
  log(`Done: ${manifest.completeClubCount}/${CLUBS.length} clubs have the mandatory offline set.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

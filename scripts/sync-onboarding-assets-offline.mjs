import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_ROOT = path.join(ROOT, "public", "assets", "clubs", "2026-27");
const MANIFEST_PATH = path.join(OUTPUT_ROOT, "manifest.json");
const OVERRIDES_PATH = path.join(ROOT, "scripts", "onboarding-assets-overrides.json");
const SPORTS_DB_KEY = process.env.THESPORTSDB_KEY || "123";
const FORCE = process.argv.includes("--force");
const CLUB_FILTER = process.argv.find(value => value.startsWith("--club="))?.split("=")[1]?.toUpperCase() || null;
const CONCURRENCY = Math.max(1, Math.min(5, Number(process.env.ASSET_SYNC_CONCURRENCY || 3)));

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
  { code: "HUL", team: "Hull City", crestId: 322, city: "Kingston_upon_Hull", stadium: "MKM_Stadium", manager: "Sergej_Jakirović", home: ["#f5a623", "#111111", "stripes"], away: ["#f3f3f3", "#f5a623", "trim"] },
  { code: "IPS", team: "Ipswich Town", crestId: 349, city: "Ipswich", stadium: "Portman_Road", manager: "Gary_O'Neil", home: ["#0057b8", "#ffffff", "trim"], away: ["#ff5a36", "#111111", "trim"] },
  { code: "LEE", team: "Leeds United", crestId: 341, city: "Leeds", stadium: "Elland_Road", manager: "Daniel_Farke", home: ["#ffffff", "#ffcd00", "trim"], away: ["#164a85", "#ffcd00", "trim"] },
  { code: "LIV", team: "Liverpool", crestId: 64, city: "Liverpool", stadium: "Anfield", manager: "Andoni_Iraola", home: ["#c8102e", "#ffffff", "trim"], away: ["#f1eee5", "#16827b", "trim"] },
  { code: "MCI", team: "Manchester City", crestId: 65, city: "Manchester", stadium: "City_of_Manchester_Stadium", manager: "Enzo_Maresca", home: ["#6cabdd", "#ffffff", "trim"], away: ["#101010", "#f2cf20", "stripe-center"] },
  { code: "MUN", team: "Manchester United", crestId: 66, city: "Manchester", stadium: "Old_Trafford", manager: "Michael_Carrick", home: ["#da291c", "#ffffff", "trim"], away: ["#f2efe7", "#2a2a2a", "trim"] },
  { code: "NEW", team: "Newcastle United", crestId: 67, city: "Newcastle_upon_Tyne", stadium: "St_James'_Park", manager: null, home: ["#ffffff", "#111111", "stripes"], away: ["#4f2d7f", "#f4b942", "trim"] },
  { code: "NFO", team: "Nottingham Forest", crestId: 351, city: "Nottingham", stadium: "City_Ground", manager: null, home: ["#e53233", "#ffffff", "trim"], away: ["#f2d94e", "#10293f", "trim"] },
  { code: "SUN", team: "Sunderland", crestId: 746, city: "Sunderland", stadium: "Stadium_of_Light", manager: null, home: ["#ffffff", "#d71920", "stripes"], away: ["#1e314f", "#e8d7b0", "trim"] },
  { code: "TOT", team: "Tottenham Hotspur", crestId: 73, city: "London", stadium: "Tottenham_Hotspur_Stadium", manager: null, home: ["#ffffff", "#132257", "trim"], away: ["#171722", "#b8ff42", "trim"] }
];

const SPECS = {
  crest: { width: 420, height: 420, fit: "contain", quality: 86 },
  stadium: { width: 1600, height: 900, fit: "cover", quality: 80 },
  city: { width: 1280, height: 720, fit: "cover", quality: 78 },
  backdrop: { width: 1920, height: 1080, fit: "cover", quality: 77 },
  manager: { width: 520, height: 620, fit: "cover", quality: 82 },
  homeKit: { width: 620, height: 620, fit: "contain", quality: 88 },
  awayKit: { width: 620, height: 620, fit: "contain", quality: 88 }
};

const log = value => process.stdout.write(`${value}\n`);
const timestamp = () => new Date().toISOString();

function safeUrl(value) {
  const source = String(value || "").trim();
  return /^https:\/\//i.test(source) ? source : null;
}

function localUrl(filePath) {
  return `/${path.relative(path.join(ROOT, "public"), filePath).split(path.sep).join("/")}`;
}

function seasonMatches(value) {
  return /2026\s*(?:-|\/)?\s*27|2026.*2027|26\s*(?:-|\/)\s*27/i.test(String(value || ""));
}

function equipmentSource(items, kind) {
  const aliases = kind === "homeKit" ? ["home"] : ["away", "alternate", "third"];
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

async function fetchWithRetry(url, options = {}, attempts = 3, timeout = 25000) {
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
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, attempt * 400));
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

async function wikipediaImage(page) {
  if (!page) return null;
  try {
    const payload = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page)}`);
    return safeUrl(payload?.originalimage?.source || payload?.thumbnail?.source);
  } catch {
    return null;
  }
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
  if (!source) return null;
  if (!FORCE && await existingFile(destination)) return localUrl(destination);
  const response = await fetchWithRetry(optimizationUrl(source, spec), {
    headers: { Accept: "image/webp,image/*" }
  }, 3, 40000);
  const type = response.headers.get("content-type") || "";
  if (!type.startsWith("image/")) throw new Error(`unexpected response type ${type}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength < 128) throw new Error("image payload is empty");
  await writeFile(destination, buffer);
  return localUrl(destination);
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
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 212 242" role="img" aria-label="${code} ${label} kit fallback">
  <defs><filter id="shadow"><feDropShadow dx="0" dy="9" stdDeviation="8" flood-opacity=".28"/></filter><clipPath id="shirt"><path d="m78 31 28 10 28-10 26 15 30 24-18 38-20-12v116H60V96l-20 12-18-38 30-24z"/></clipPath></defs>
  <g filter="url(#shadow)"><path d="m78 31 28 10 28-10 26 15 30 24-18 38-20-12v116H60V96l-20 12-18-38 30-24z" fill="${base}" stroke="rgba(255,255,255,.34)" stroke-width="2"/><g clip-path="url(#shirt)">${patternMarkup}</g>${trim}<text x="106" y="137" fill="${detail}" font-family="Arial,sans-serif" font-size="22" font-weight="800" text-anchor="middle" opacity=".78">${code}</text></g>
</svg>\n`;
}

async function saveFallbackKit(destination, colors, code, label) {
  if (!FORCE && await existingFile(destination)) return localUrl(destination);
  await writeFile(destination, kitSvg(colors, code, label), "utf8");
  return localUrl(destination);
}

async function buildClubEntry(club, overrides) {
  const directory = path.join(OUTPUT_ROOT, club.code.toLowerCase());
  await mkdir(directory, { recursive: true });
  log(`→ ${club.code} ${club.team}`);

  const override = overrides?.clubs?.[club.code] || {};
  const [team, city, stadium, manager] = await Promise.all([
    fetchTeam(club),
    wikipediaImage(club.city),
    wikipediaImage(club.stadium),
    wikipediaImage(club.manager)
  ]);
  const equipment = await fetchEquipment(team?.idTeam);

  const sources = {
    crest: safeUrl(override.crest) || safeUrl(team?.strBadge || team?.strLogo) || `https://crests.football-data.org/${club.crestId}.png`,
    stadium: safeUrl(override.stadium) || stadium || safeUrl(team?.strStadiumThumb),
    city: safeUrl(override.city) || city,
    backdrop: safeUrl(override.backdrop) || safeUrl(team?.strFanart1 || team?.strFanart2) || stadium || safeUrl(team?.strStadiumThumb),
    manager: safeUrl(override.manager) || manager,
    homeKit: safeUrl(override.homeKit) || equipmentSource(equipment, "homeKit"),
    awayKit: safeUrl(override.awayKit) || equipmentSource(equipment, "awayKit")
  };

  const entry = {
    code: club.code,
    name: team?.strTeam || club.team,
    providerTeamId: team?.idTeam || null,
    season: "2026/27",
    generatedAt: timestamp(),
    sources: {}
  };

  for (const [kind, spec] of Object.entries(SPECS)) {
    const filename = kind.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
    const source = sources[kind];
    try {
      if (source) {
        entry[kind] = await saveWebp(source, path.join(directory, `${filename}.webp`), spec);
        entry.sources[kind] = source;
      } else if (kind === "homeKit" || kind === "awayKit") {
        const home = kind === "homeKit";
        entry[kind] = await saveFallbackKit(path.join(directory, `${filename}.svg`), home ? club.home : club.away, club.code, home ? "HOME" : "AWAY");
        entry.sources[kind] = "generated-local-fallback";
      }
    } catch (error) {
      log(`  ! ${kind}: ${error.message}`);
      if (kind === "homeKit" || kind === "awayKit") {
        const home = kind === "homeKit";
        entry[kind] = await saveFallbackKit(path.join(directory, `${filename}.svg`), home ? club.home : club.away, club.code, home ? "HOME" : "AWAY");
        entry.sources[kind] = "generated-local-fallback";
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
  const selected = CLUB_FILTER ? CLUBS.filter(club => club.code === CLUB_FILTER) : CLUBS;
  if (!selected.length) throw new Error(`Unknown club code: ${CLUB_FILTER}`);

  log(`Syncing ${selected.length} club${selected.length === 1 ? "" : "s"} into ${path.relative(ROOT, OUTPUT_ROOT)}`);
  const entries = await runPool(selected, club => buildClubEntry(club, overrides), CONCURRENCY);
  const merged = { ...(existing?.clubs || {}) };
  entries.forEach(entry => { merged[entry.code] = entry; });

  const orderedClubs = {};
  CLUBS.forEach(club => { if (merged[club.code]) orderedClubs[club.code] = merged[club.code]; });
  const manifest = {
    season: "2026/27",
    generatedAt: timestamp(),
    source: "build-time local pack: TheSportsDB, football-data crests, Wikimedia imagery and explicit overrides",
    runtimeNetworkRequired: false,
    clubCount: Object.keys(orderedClubs).length,
    completeClubCount: Object.values(orderedClubs).filter(entry => entry.complete).length,
    clubs: orderedClubs
  };
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  log(`Done: ${manifest.completeClubCount}/${CLUBS.length} clubs have the mandatory offline set.`);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_ROOT = path.join(ROOT, "public", "assets", "clubs", "2026-27");
const shard = process.argv.find(argument => argument.startsWith("--shard="))?.slice(8) || "";
const requested = process.argv.find(argument => argument.startsWith("--clubs="))?.slice(8).split(",").map(value => value.trim().toUpperCase()).filter(Boolean) || [];
const manifestPath = path.join(OUTPUT_ROOT, shard ? `manifest-${shard}.json` : "manifest.json");
const reportPath = path.join(OUTPUT_ROOT, shard ? `validation-report-${shard}.json` : "validation-report.json");
const USER_AGENT = "TouchlineCareer/1.0 explicit-media-repair";

const commonsFile = (filename, width = 1280) =>
  `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(filename)}?width=${width}`;

const LONDON_CITY = commonsFile("London Skyline.jpg", 1280);

const EXPLICIT = Object.freeze({
  ARS: {
    stadium: commonsFile("Emirates Stadium aerial 2020-07.jpg", 1280),
    manager: commonsFile("Mikel Arteta.jpg", 900)
  },
  BOU: {
    city: commonsFile("Bournemouth Town Centre from West Cliff.jpg", 1280),
    stadium: commonsFile("Bournemouth , Boscombe - Dean Court Football Stadium - geograph.org.uk - 2197013.jpg", 1280),
    manager: commonsFile("MarcoRose.jpg", 800)
  },
  BRE: {
    stadium: commonsFile("Brentford Gtech Community Stadium.jpg", 1280),
    manager: commonsFile("Keith Andrews, Brentford F.C. head coach, August 2025.jpg", 900)
  },
  CHE: {
    stadium: "https://upload.wikimedia.org/wikipedia/commons/8/87/Stamford_Bridge_stadium.jpg",
    manager: "https://upload.wikimedia.org/wikipedia/commons/5/5b/Xabi_alonso.jpg"
  },
  COV: {
    stadium: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Coventry_Building_Society_Arena_%28geograph_7345889%29.jpg/960px-Coventry_Building_Society_Arena_%28geograph_7345889%29.jpg",
    manager: "https://upload.wikimedia.org/wikipedia/commons/0/05/Frank_lampard.jpg"
  },
  CRY: {
    city: LONDON_CITY,
    manager: "https://upload.wikimedia.org/wikipedia/commons/f/f2/Pierre_Sage_lors_d%E2%80%99un_entra%C3%AEnement.jpg"
  },
  HUL: {
    city: commonsFile("Skyline of Kingston upon Hull from across the Humber.jpg", 1280),
    stadium: commonsFile("Mkm stadium.png", 1280),
    manager: commonsFile("Sergej Jakirović 2024 (cropped).png", 800)
  },
  LIV: {
    stadium: "https://upload.wikimedia.org/wikipedia/commons/3/33/Anfield_Stadium.jpg",
    manager: "https://upload.wikimedia.org/wikipedia/commons/8/8c/Andoni_Iraola_2023.jpg"
  },
  MCI: {
    manager: "https://upload.wikimedia.org/wikipedia/commons/3/3c/Enzo_maresca.jpg"
  },
  MUN: {
    stadium: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/Oldtraffordstadpano.jpg/1280px-Oldtraffordstadpano.jpg",
    manager: "https://upload.wikimedia.org/wikipedia/commons/3/30/Michael_Carrick.jpg"
  },
  NFO: {
    manager: "https://upload.wikimedia.org/wikipedia/commons/5/5a/Oliver_Glasner30.JPG"
  },
  SUN: {
    city: "https://upload.wikimedia.org/wikipedia/commons/9/93/SunderlandSkyline.jpg",
    stadium: "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/Sunderland_stadium_of_light.jpg/1280px-Sunderland_stadium_of_light.jpg",
    manager: "https://resources.premierleague.pulselive.com/photo-resources/2026/07/28/918475f4-a10f-4e88-9e0e-11fca7705a91/Regis-Le-Bris-bio-pic.jpg?width=1440"
  },
  TOT: {
    city: LONDON_CITY,
    stadium: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fc/Tottenham_Hotspur_Stadium.jpg/1280px-Tottenham_Hotspur_Stadium.jpg",
    manager: "https://upload.wikimedia.org/wikipedia/commons/0/0d/Roberto_De_Zerbi%2C_2019_%28cropped%29.png"
  }
});

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function validFile(filePath, minimum = 512) {
  if (!filePath || !existsSync(filePath)) return false;
  try { return (await stat(filePath)).size >= minimum; }
  catch { return false; }
}

function localPath(url) {
  if (!String(url || "").startsWith("/assets/")) return null;
  return path.join(ROOT, "public", ...String(url).split("/").filter(Boolean));
}

async function validLocal(url) {
  return validFile(localPath(url));
}

async function fetchImage(url) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "image/avif,image/webp,image/png,image/jpeg,image/*",
          "User-Agent": USER_AGENT
        },
        signal: controller.signal
      });
      if (response.status === 429) {
        await wait(attempt * 3500);
        throw new Error("HTTP 429");
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const type = response.headers.get("content-type") || "";
      if (!type.startsWith("image/")) throw new Error(`unexpected content type ${type}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength < 1024) throw new Error("image payload is too small");
      return { buffer, type };
    } catch (error) {
      lastError = error;
      if (attempt < 5) await wait(attempt * 1800);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error("download failed");
}

function extension(type) {
  if (/png/i.test(type)) return "png";
  if (/webp/i.test(type)) return "webp";
  if (/gif/i.test(type)) return "gif";
  return "jpg";
}

async function removeVariants(directory, stem) {
  await Promise.all(["jpg", "jpeg", "png", "webp", "gif"].map(ext =>
    rm(path.join(directory, `${stem}.${ext}`), { force: true }).catch(() => {})
  ));
}

async function install(code, kind, source) {
  const directory = path.join(OUTPUT_ROOT, code.toLowerCase());
  await mkdir(directory, { recursive: true });
  const downloaded = await fetchImage(source);
  await removeVariants(directory, kind);
  const ext = extension(downloaded.type);
  await writeFile(path.join(directory, `${kind}.${ext}`), downloaded.buffer);
  return `/assets/clubs/2026-27/${code.toLowerCase()}/${kind}.${ext}`;
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const selected = requested.length ? requested : Object.keys(EXPLICIT);

for (const code of selected) {
  const overrides = EXPLICIT[code];
  const entry = manifest.clubs?.[code];
  if (!overrides || !entry) continue;

  entry.sources ||= {};
  for (const [kind, source] of Object.entries(overrides)) {
    const previous = entry[kind];
    process.stdout.write(`→ ${code} authoritative ${kind}\n`);
    try {
      await wait(450);
      entry[kind] = await install(code, kind, source);
      entry.sources[kind] = source;
    } catch (error) {
      if (!await validLocal(previous)) throw error;
      process.stdout.write(`  ! kept existing ${kind}: ${error.message}\n`);
      entry[kind] = previous;
    }
  }
}

const statuses = [];
for (const code of selected) {
  const entry = manifest.clubs?.[code];
  if (!entry) continue;
  const required = {
    crest: await validLocal(entry.crest),
    city: await validLocal(entry.city),
    stadium: await validLocal(entry.stadium),
    manager: code === "NEW" ? true : await validLocal(entry.manager),
    rival: await validLocal(entry.rivalCrest),
    homeKit: await validLocal(entry.homeKit),
    awayKit: await validLocal(entry.awayKit)
  };
  entry.complete = Object.values(required).every(Boolean);
  statuses.push({ code, ...required, complete: entry.complete });
  process.stdout.write(`  ${entry.complete ? "✓" : "!"} ${code} city=${required.city} stadium=${required.stadium} manager=${required.manager} rival=${required.rival}\n`);
}

manifest.explicitMediaRepairedAt = new Date().toISOString();
manifest.completeClubCount = Object.values(manifest.clubs || {}).filter(entry => entry.complete).length;
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await writeFile(reportPath, `${JSON.stringify({ generatedAt: manifest.explicitMediaRepairedAt, clubs: statuses }, null, 2)}\n`, "utf8");

const failed = statuses.filter(status => !status.complete);
if (failed.length) throw new Error(`explicit media repair still incomplete: ${failed.map(status => status.code).join(", ")}`);

import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "public", "assets", "clubs", "2026-27");
const MANIFEST_FILE = path.join(OUT, "manifest.json");
const REPORT_FILE = path.join(OUT, "validation-report.json");
const SPORTS_KEY = process.env.THESPORTSDB_KEY || "3";
const FORCE = process.argv.includes("--force");
const UA = "TouchlineCareer/1.0 local-media-builder";

const CLUBS = {
  ARS: ["Arsenal",57,"London","Emirates_Stadium",["Mikel Arteta","Mikel_Arteta"],["Tottenham Hotspur","TOT"],["#d71920","#fff","sleeves"],["#fff000","#102b5c","trim"]],
  AVL: ["Aston Villa",58,"Birmingham","Villa_Park",["Unai Emery","Unai_Emery"],["Birmingham City",null],["#7a2048","#95c9e8","sleeves"],["#f4f2e9","#7a2048","trim"]],
  BOU: ["AFC Bournemouth",1044,"Bournemouth","Dean_Court",["Marco Rose","Marco_Rose"],["Southampton",null],["#d71920","#111","stripes"],["#e8f5ff","#101820","trim"]],
  BRE: ["Brentford",402,"London","Brentford_Community_Stadium",["Keith Andrews","Keith_Andrews_(footballer)"],["Fulham","FUL"],["#fff","#df1625","stripes"],["#171717","#f0cf25","trim"]],
  BHA: ["Brighton & Hove Albion",397,"Brighton","Falmer_Stadium",["Fabian Hürzeler","Fabian_Hürzeler"],["Crystal Palace","CRY"],["#fff","#0057b8","stripes"],["#ff6a00","#101820","trim"]],
  CHE: ["Chelsea",61,"London","Stamford_Bridge_(stadium)",["Xabi Alonso","Xabi_Alonso"],["Fulham","FUL"],["#034694","#fff","trim"],["#f5f3eb","#d51d2e","stripe-center"]],
  COV: ["Coventry City",1076,"Coventry","Coventry_Building_Society_Arena",["Frank Lampard","Frank_Lampard"],["Leicester City",null],["#69bfe7","#fff","trim"],["#181818","#69bfe7","stripe-center"]],
  CRY: ["Crystal Palace",354,"London","Selhurst_Park",["Pierre Sage","Pierre_Sage"],["Brighton & Hove Albion","BHA"],["#1b458f","#c4122e","stripes"],["#f4f0df","#1b458f","sash"]],
  EVE: ["Everton",62,"Liverpool","Everton_Stadium",["David Moyes","David_Moyes"],["Liverpool","LIV"],["#003399","#fff","trim"],["#f1d9b5","#112a4a","trim"]],
  FUL: ["Fulham",63,"London","Craven_Cottage",["Álvaro Arbeloa","Álvaro_Arbeloa"],["Chelsea","CHE"],["#fff","#111","sleeves"],["#d9ff2f","#111","trim"]],
  HUL: ["Hull City",322,"Kingston_upon_Hull","MKM_Stadium",["Sergej Jakirović","Sergej_Jakirović"],["Leeds United","LEE"],["#f5a623","#111","stripes"],["#f3f3f3","#f5a623","trim"]],
  IPS: ["Ipswich Town",349,"Ipswich","Portman_Road",["Gary O'Neil","Gary_O'Neil"],["Norwich City",null],["#0057b8","#fff","trim"],["#ff5a36","#111","trim"]],
  LEE: ["Leeds United",341,"Leeds","Elland_Road",["Daniel Farke","Daniel_Farke"],["Manchester United","MUN"],["#fff","#ffcd00","trim"],["#164a85","#ffcd00","trim"]],
  LIV: ["Liverpool",64,"Liverpool","Anfield",["Andoni Iraola","Andoni_Iraola"],["Everton","EVE"],["#c8102e","#fff","trim"],["#f1eee5","#16827b","trim"]],
  MCI: ["Manchester City",65,"Manchester","City_of_Manchester_Stadium",["Enzo Maresca","Enzo_Maresca"],["Manchester United","MUN"],["#6cabdd","#fff","trim"],["#101010","#f2cf20","stripe-center"]],
  MUN: ["Manchester United",66,"Manchester","Old_Trafford",["Michael Carrick","Michael_Carrick"],["Liverpool","LIV"],["#da291c","#fff","trim"],["#f2efe7","#2a2a2a","trim"]],
  NEW: ["Newcastle United",67,"Newcastle_upon_Tyne","St_James'_Park",null,["Sunderland","SUN"],["#fff","#111","stripes"],["#4f2d7f","#f4b942","trim"]],
  NFO: ["Nottingham Forest",351,"Nottingham","City_Ground",["Oliver Glasner","Oliver_Glasner"],["Derby County",null],["#e53233","#fff","trim"],["#f2d94e","#10293f","trim"]],
  SUN: ["Sunderland",71,"Sunderland","Stadium_of_Light",["Régis Le Bris","Régis_Le_Bris"],["Newcastle United","NEW"],["#fff","#d71920","stripes"],["#1e314f","#e8d7b0","trim"]],
  TOT: ["Tottenham Hotspur",73,"London","Tottenham_Hotspur_Stadium",["Roberto De Zerbi","Roberto_De_Zerbi"],["Arsenal","ARS"],["#fff","#132257","trim"],["#171722","#b8ff42","trim"]]
};

const summaryCache = new Map();
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function json(file, fallback) {
  try { return JSON.parse(await readFile(file, "utf8")); }
  catch { return fallback; }
}

function localFile(url) {
  return String(url || "").startsWith("/assets/")
    ? path.join(ROOT, "public", ...url.split("/").filter(Boolean))
    : null;
}

async function valid(url, min = 512) {
  const file = localFile(url);
  if (!file || !existsSync(file)) return false;
  try { return (await stat(file)).size >= min; }
  catch { return false; }
}

async function request(url, { accept = "*/*", attempts = 2, timeout = 15000 } = {}) {
  let last;
  for (let i = 0; i < attempts; i += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, { headers: { "User-Agent": UA, Accept: accept }, signal: controller.signal });
      if (response.status === 429) {
        await sleep(1500 * (i + 1));
        throw new Error("HTTP 429");
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      last = error;
      if (i + 1 < attempts) await sleep(500 * (i + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw last || new Error("request failed");
}

async function summary(page) {
  if (!page) return null;
  if (summaryCache.has(page)) return summaryCache.get(page);
  const promise = (async () => {
    await sleep(180);
    const response = await request(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page)}`, { accept: "application/json", attempts: 3, timeout: 12000 });
    return response.json();
  })().catch(() => null);
  summaryCache.set(page, promise);
  return promise;
}

function imageFromSummary(data, photo = true) {
  const candidates = [data?.originalimage?.source, data?.thumbnail?.source].filter(Boolean);
  if (!photo) return candidates[0] || "";
  return candidates.find(source => {
    let value = source.toLowerCase();
    try { value = decodeURIComponent(value); } catch {}
    return !/logo|crest|badge|flag|emblem|coat[_ -]?of[_ -]?arms|map|diagram/.test(value);
  }) || "";
}

function ext(type) {
  if (/png/.test(type)) return "png";
  if (/webp/.test(type)) return "webp";
  if (/svg/.test(type)) return "svg";
  return "jpg";
}

async function clearStem(dir, stem) {
  await Promise.all(["jpg","jpeg","png","webp","svg","gif"].map(x => rm(path.join(dir, `${stem}.${x}`), { force: true }).catch(() => {})));
}

async function saveRemote(source, dir, stem, previous) {
  if (!FORCE && await valid(previous)) return previous;
  if (!source) return await valid(previous) ? previous : null;
  try {
    const response = await request(source, { accept: "image/*", attempts: 2, timeout: 15000 });
    const type = response.headers.get("content-type") || "";
    if (!type.startsWith("image/")) throw new Error("not image");
    const body = Buffer.from(await response.arrayBuffer());
    if (body.length < 1024) throw new Error("small image");
    await mkdir(dir, { recursive: true });
    await clearStem(dir, stem);
    const suffix = ext(type);
    await writeFile(path.join(dir, `${stem}.${suffix}`), body);
    return `/assets/clubs/2026-27/${path.basename(dir)}/${stem}.${suffix}`;
  } catch {
    return await valid(previous) ? previous : null;
  }
}

function kitSvg([base, detail, pattern], code) {
  const stripes = pattern === "stripes" ? `<path d="M76 45h24v150H76zm48 0h24v150h-24z" fill="${detail}"/>` : "";
  const center = pattern === "stripe-center" ? `<path d="M91 42h42v154H91z" fill="${detail}"/>` : "";
  const sash = pattern === "sash" ? `<path d="M55 48 80 38l91 146-27 13z" fill="${detail}"/>` : "";
  const sleeves = pattern === "sleeves" ? `<path d="m55 48-33 22 18 37 31-18V48zm102 0 33 22-18 37-31-18V48z" fill="${detail}"/>` : "";
  return `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 212 242"><defs><clipPath id="c"><path d="m78 31 28 10 28-10 26 15 30 24-18 38-20-12v116H60V96l-20 12-18-38 30-24z"/></clipPath></defs><path d="m78 31 28 10 28-10 26 15 30 24-18 38-20-12v116H60V96l-20 12-18-38 30-24z" fill="${base}" stroke="#fff" stroke-opacity=".3" stroke-width="2"/><g clip-path="url(#c)">${stripes}${center}${sash}${sleeves}</g><text x="106" y="137" fill="${detail}" font-family="Arial" font-size="22" font-weight="800" text-anchor="middle">${code}</text></svg>`;
}

async function kit(dir, code, role, colors, previous) {
  if (await valid(previous)) return previous;
  const file = path.join(dir, `${role}-kit.svg`);
  await mkdir(dir, { recursive: true });
  await writeFile(file, kitSvg(colors, code), "utf8");
  return `/assets/clubs/2026-27/${code.toLowerCase()}/${role}-kit.svg`;
}

async function externalRival(name) {
  try {
    const response = await request(`https://www.thesportsdb.com/api/v1/json/${SPORTS_KEY}/searchteams.php?t=${encodeURIComponent(name)}`, { accept: "application/json", attempts: 2, timeout: 12000 });
    const data = await response.json();
    const team = data?.teams?.find(x => /England/i.test(x.strCountry || "")) || data?.teams?.[0];
    return team?.strBadge || team?.strLogo || "";
  } catch {
    const data = await summary(name.replaceAll(" ", "_"));
    return imageFromSummary(data, false);
  }
}

async function build(code, config, previous) {
  const [name, crestId, cityPage, stadiumPage, manager, rival, home, away] = config;
  const dir = path.join(OUT, code.toLowerCase());
  const [cityData, stadiumData, managerData] = await Promise.all([
    summary(cityPage), summary(stadiumPage), manager ? summary(manager[1]) : Promise.resolve(null)
  ]);
  const crestSource = `https://crests.football-data.org/${crestId}.png`;
  const citySource = imageFromSummary(cityData, true);
  const stadiumSource = imageFromSummary(stadiumData, true);
  const managerSource = manager ? imageFromSummary(managerData, false) : "";

  const [crest, city, stadium, managerUrl, homeKit, awayKit] = await Promise.all([
    saveRemote(crestSource, dir, "crest", previous.crest),
    saveRemote(citySource, dir, "city", previous.city),
    saveRemote(stadiumSource, dir, "stadium", previous.stadium),
    manager ? saveRemote(managerSource, dir, "manager", previous.manager) : Promise.resolve(null),
    kit(dir, code, "home", home, previous.homeKit),
    kit(dir, code, "away", away, previous.awayKit)
  ]);

  return {
    code, name, season: "2026/27", crest, city, stadium, backdrop: stadium,
    manager: managerUrl, managerName: manager?.[0] || null,
    homeKit, awayKit, rivalName: rival[0],
    sources: { crest: crestSource, city: citySource, stadium: stadiumSource, manager: managerSource }
  };
}

async function addRival(code, entry, entries, previous) {
  const [name, leagueCode] = CLUBS[code][5];
  if (leagueCode && await valid(entries[leagueCode]?.crest)) {
    entry.rivalCrest = entries[leagueCode].crest;
    entry.sources.rivalCrest = `league:${leagueCode}`;
    return;
  }
  const source = await externalRival(name);
  entry.rivalCrest = await saveRemote(source, path.join(OUT, code.toLowerCase()), "rival-crest", previous.rivalCrest);
  entry.sources.rivalCrest = source;
}

async function status(code, entry) {
  const result = {
    crest: await valid(entry.crest), city: await valid(entry.city), stadium: await valid(entry.stadium),
    manager: CLUBS[code][4] ? await valid(entry.manager) : true,
    rival: await valid(entry.rivalCrest), homeKit: await valid(entry.homeKit), awayKit: await valid(entry.awayKit)
  };
  return { code, ...result, complete: Object.values(result).every(Boolean) };
}

await mkdir(OUT, { recursive: true });
const previous = await json(MANIFEST_FILE, { clubs: {} });
const entries = {};

for (const [code, config] of Object.entries(CLUBS)) {
  process.stdout.write(`→ ${code} ${config[0]}\n`);
  entries[code] = await build(code, config, previous.clubs?.[code] || {});
}
for (const code of Object.keys(CLUBS)) await addRival(code, entries[code], entries, previous.clubs?.[code] || {});

const report = [];
for (const code of Object.keys(CLUBS)) {
  const item = await status(code, entries[code]);
  entries[code].complete = item.complete;
  report.push(item);
  process.stdout.write(`  ${item.complete ? "✓" : "!"} ${code} city=${item.city} stadium=${item.stadium} manager=${item.manager} rival=${item.rival}\n`);
}

const manifest = {
  pipelineVersion: 12, season: "2026/27", generatedAt: new Date().toISOString(), runtimeNetworkRequired: false,
  source: "bounded direct local pack: football-data, Wikipedia summary media, TheSportsDB rival badges, local kit fallback",
  clubCount: 20, completeClubCount: report.filter(x => x.complete).length, clubs: entries
};
await writeFile(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(REPORT_FILE, `${JSON.stringify({ generatedAt: manifest.generatedAt, clubs: report }, null, 2)}\n`);
const broken = report.filter(x => !x.complete);
if (broken.length) throw new Error(`media validation failed for: ${broken.map(x => x.code).join(", ")}`);
process.stdout.write("Done: 20/20 clubs passed final media validation.\n");

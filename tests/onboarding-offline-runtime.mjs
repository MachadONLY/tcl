import { createHash } from "node:crypto";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const fail = message => { throw new Error(message); };
const read = relative => readFile(path.join(ROOT, relative), "utf8");
const normalize = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function localFile(url) {
  if (!String(url || "").startsWith("/assets/clubs/2026-27/")) fail(`asset remoto: ${url}`);
  return path.join(ROOT, "public", ...url.split("/").filter(Boolean));
}

const [index, controller, media, view, css, worker, manifestText] = await Promise.all([
  read("index.html"),
  read("src/career-onboarding-offline.js"),
  read("src/onboarding/offline-media.js"),
  read("src/onboarding/offline-view.js"),
  read("src/career-club-selector.css"),
  read("public/touchline-sw.js"),
  read("public/assets/clubs/2026-27/manifest.json")
]);
const { CLUBS } = await import(pathToFileURL(path.join(ROOT, "src/onboarding/offline-data.js")));
const manifest = JSON.parse(manifestText);

const onboardingScripts = [...index.matchAll(/<script[^>]+src="([^"]*career-onboarding[^"]*)"/g)].map(match => match[1]);
if (onboardingScripts.length !== 1 || onboardingScripts[0] !== "/src/career-onboarding-offline.js") {
  fail(`controladores de onboarding: ${onboardingScripts.join(", ")}`);
}
if (/preconnect|dns-prefetch|fonts\.googleapis|fonts\.gstatic|https?:\/\//i.test(index)) fail("index possui dependência remota");
if (/https?:\/\//i.test(controller + media + view)) fail("runtime possui URL remota");
if (!controller.includes('import "./career-club-selector.css"')) fail("seletor não usa o CSS canônico");
if (/career-onboarding-v7-premier\.css|career-onboarding-offline\.css/.test(controller)) fail("CSS legado ainda carregado");
if (/details\.innerHTML|club-selection-details[^\n]*innerHTML/.test(controller + view)) fail("painel é recriado durante a troca");

if (!media.includes("decodeImage") || !media.includes("stageClubMedia") || !media.includes("activateMedia")) {
  fail("pipeline atômico de mídia ausente");
}
if (!media.includes("activeIndex ^ 1") || !media.includes("offline-media-stack")) fail("double buffer de imagens ausente");
if (!/await Promise\.all\(jobs\.map\(job => decodeImage\(job\.source\)\)\)/.test(media)) fail("mídias não são decodificadas antes do commit");
if (/stageClubMedia[\s\S]*?\.src\s*=/.test(media.split("export function activateMedia")[0])) fail("stageClubMedia altera o DOM visível");
if (!media.includes("one club per idle slice") || !media.includes("prewarmedClubs")) fail("prewarm progressivo ausente");

const geometryChecks = [
  ["aspect-ratio: 2.37 / 1", "proporção principal"],
  ["grid-template-columns: 50% 25% 25%", "colunas de identidade"],
  ["grid-template-rows: 43% 32% 25%", "linhas de identidade"],
  ["grid-template-rows: 67% 33%", "painel editorial"],
  ["contain: layout paint size", "contenção de layout"],
  ["transition: opacity 76ms", "crossfade curto"],
  ["object-position: 50% 16%", "enquadramento do técnico"]
];
for (const [needle, label] of geometryChecks) if (!css.includes(needle)) fail(`${label} ausente`);
if (!/\.tl-club-card__overlay--bottom\s*\{[^}]*bottom:/s.test(css)) fail("nome do técnico não está sobre a foto");
if (/\.tl-club-card__overlay--bottom\s*\{[^}]*background:/s.test(css)) fail("nome do técnico recebeu faixa de fundo");
if (!view.includes("TÍTULOS PREMIER LEAGUE") || !view.includes("UNIFORMES 2026/27")) fail("conteúdo obrigatório ausente");
if (!worker.includes("MEDIA_CACHE") || !worker.includes("manifest.json") || !worker.includes("clients.claim")) fail("service worker incompleto");

if (CLUBS.length !== 20) fail(`clubes no runtime: ${CLUBS.length}`);
if (Object.keys(manifest.clubs || {}).length !== 20) fail("manifest não contém 20 clubes");
if (manifest.runtimeNetworkRequired !== false) fail("manifest não marca runtime offline");

const hashes = new Map();
let total = 0;
for (const club of CLUBS) {
  const entry = manifest.clubs[club.code];
  if (!entry) fail(`manifest sem ${club.code}`);
  if (normalize(entry.managerName) !== normalize(club.manager)) fail(`${club.code}: técnico divergente`);
  for (const role of ["crest", "city", "stadium", "manager", "homeKit", "awayKit", "rivalCrest"]) {
    const file = localFile(entry[role]);
    await access(file);
    const info = await stat(file);
    if (info.size < 96) fail(`${club.code}.${role} vazio`);
    total += info.size;
  }
  const managerFile = localFile(entry.manager);
  const digest = createHash("sha256").update(await readFile(managerFile)).digest("hex");
  if (hashes.has(digest)) fail(`retrato de técnico repetido: ${hashes.get(digest)} e ${club.code}`);
  hashes.set(digest, club.code);
}

const expectedPremierLeagueTitles = new Map([
  ["ARS", "4"], ["CHE", "5"], ["LIV", "2"], ["MCI", "8"], ["MUN", "13"]
]);
for (const club of CLUBS) {
  const expected = expectedPremierLeagueTitles.get(club.code) || "0";
  if (club.titles !== expected) fail(`${club.code}: títulos de Premier League ${club.titles}, esperado ${expected}`);
}

const sun = manifest.clubs.SUN;
if (normalize(sun.managerName) !== "regis le bris") fail("Sunderland sem Régis Le Bris");
if (!/\/sun\/manager\.webp$/i.test(sun.manager)) fail(`Sunderland usa arquivo incorreto: ${sun.manager}`);
if (total > 60 * 1024 * 1024) fail(`pack pesado: ${(total / 1024 / 1024).toFixed(1)} MB`);

process.stdout.write(`Club selector OK: 20 clubes, mídia local, geometria estável, ${(total / 1024 / 1024).toFixed(1)} MB\n`);

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

const [index, controller, media, view, cssMain, shell, layout, story, mediaCss, worker, manifestText] = await Promise.all([
  read("index.html"),
  read("src/career-onboarding-offline.js"),
  read("src/onboarding/offline-media.js"),
  read("src/onboarding/offline-view.js"),
  read("src/career-onboarding-offline.css"),
  read("src/styles/offline-shell.css"),
  read("src/styles/offline-layout.css"),
  read("src/styles/offline-story.css"),
  read("src/styles/offline-media.css"),
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
if (!media.includes("decode()") || !media.includes("stageClubMedia") || !media.includes("activateMedia")) fail("troca atômica não implementada");
if (!media.includes("activeIndex ^ 1") || !media.includes("offline-media-stack")) fail("double buffer de imagens ausente");
if (/details\.innerHTML|club-selection-details[^\n]*innerHTML/.test(controller + view)) fail("painel é recriado durante a troca");
if (!shell.includes("contain: layout paint") || !layout.includes("contain: strict")) fail("contenção de layout ausente");
if (!/\.club-manager-copy\s*\{[^}]*background:\s*none\s*;/s.test(layout)) fail("nome do técnico recebeu faixa de fundo");
if (!mediaCss.includes("transition: opacity 90ms") || !mediaCss.includes("object-position: 50% 16%")) fail("transição ou enquadramento do técnico ausente");
if (!worker.includes("MEDIA_CACHE") || !worker.includes("manifest.json") || !worker.includes("clients.claim")) fail("service worker incompleto");
if (!cssMain.includes("offline-shell.css") || !cssMain.includes("offline-media.css")) fail("composição de CSS incompleta");
if (!story.includes("club-story-copy")) fail("painel editorial ausente");

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
  if (hashes.has(digest)) fail(`foto de técnico repetida: ${hashes.get(digest)} e ${club.code}`);
  hashes.set(digest, club.code);
}

const sun = manifest.clubs.SUN;
if (normalize(sun.managerName) !== "regis le bris") fail("Sunderland sem Régis Le Bris");
if (!/\/sun\/manager\.webp$/i.test(sun.manager)) fail(`Sunderland usa arquivo incorreto: ${sun.manager}`);
if (total > 60 * 1024 * 1024) fail(`pack pesado: ${(total / 1024 / 1024).toFixed(1)} MB`);

process.stdout.write(`Offline onboarding OK: 20 clubes, 20 retratos únicos, ${(total / 1024 / 1024).toFixed(1)} MB\n`);

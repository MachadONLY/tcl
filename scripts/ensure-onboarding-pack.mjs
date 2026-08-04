import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const PACK_ROOT = path.join(ROOT, "public", "assets", "clubs", "2026-27");
const MANIFEST_PATH = path.join(PACK_ROOT, "manifest.json");
const CLUBS = Object.freeze([
  "ARS", "AVL", "BOU", "BRE", "BHA", "CHE", "COV", "CRY", "EVE", "FUL",
  "HUL", "IPS", "LEE", "LIV", "MCI", "MUN", "NEW", "NFO", "SUN", "TOT"
]);
const REQUIRED = Object.freeze(["crest", "city", "stadium", "manager", "homeKit", "awayKit", "rivalCrest"]);

function localFile(assetPath) {
  if (!assetPath || !String(assetPath).startsWith("/assets/")) return null;
  return path.join(ROOT, "public", String(assetPath).replace(/^\//, ""));
}

async function readManifest() {
  try {
    return JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  } catch {
    return null;
  }
}

async function fileReady(assetPath) {
  const file = localFile(assetPath);
  if (!file) return false;
  try {
    await access(file, constants.R_OK);
    return (await stat(file)).size > 96;
  } catch {
    return false;
  }
}

function vacancyPortraitSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" role="img" aria-label="Técnico a anunciar">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#263542"/>
      <stop offset="1" stop-color="#0b141d"/>
    </linearGradient>
    <radialGradient id="light" cx="50%" cy="28%" r="58%">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".13"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="640" height="640" fill="url(#bg)"/>
  <rect width="640" height="640" fill="url(#light)"/>
  <circle cx="320" cy="205" r="112" fill="#647482"/>
  <path d="M92 640c12-180 100-282 228-282s216 102 228 282H92Z" fill="#536370"/>
</svg>\n`;
}

async function installMissingManagerFallbacks(manifest) {
  if (!manifest?.clubs) return false;
  let changed = false;

  for (const code of CLUBS) {
    const entry = manifest.clubs[code];
    if (!entry || await fileReady(entry.manager)) continue;

    const directory = path.join(PACK_ROOT, code.toLowerCase());
    const filename = path.join(directory, "manager-vacant.svg");
    await mkdir(directory, { recursive: true });
    await writeFile(filename, vacancyPortraitSvg(), "utf8");
    entry.manager = `/assets/clubs/2026-27/${code.toLowerCase()}/manager-vacant.svg`;
    entry.managerName ||= "Técnico a anunciar";
    entry.sources ||= {};
    entry.sources.manager = "generated-local-vacancy-portrait";
    changed = true;
  }

  if (changed) {
    manifest.generatedAt = new Date().toISOString();
    manifest.runtimeNetworkRequired = false;
    await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }
  return changed;
}

async function validate(manifest) {
  if (!manifest?.clubs || Number(manifest.clubCount || Object.keys(manifest.clubs).length) !== CLUBS.length) {
    return { ok: false, reason: "manifest does not contain twenty clubs" };
  }

  for (const code of CLUBS) {
    const entry = manifest.clubs[code];
    if (!entry) return { ok: false, reason: `${code} is missing from manifest` };
    for (const key of REQUIRED) {
      if (!await fileReady(entry[key])) return { ok: false, reason: `${code}.${key} is missing` };
    }
  }

  return { ok: true, reason: "all twenty clubs are complete" };
}

function runSync() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["scripts/sync-onboarding-user-pack.mjs"], {
      cwd: ROOT,
      env: process.env,
      stdio: "inherit"
    });
    child.on("error", reject);
    child.on("exit", code => code === 0 ? resolve() : reject(new Error(`offline pack sync exited with ${code ?? 1}`)));
  });
}

let manifest = await readManifest();
await installMissingManagerFallbacks(manifest);
manifest = await readManifest();
let status = await validate(manifest);

if (!status.ok) {
  process.stdout.write(`Onboarding pack incomplete (${status.reason}). Building the verified local pack...\n`);
  await runSync();
  manifest = await readManifest();
  await installMissingManagerFallbacks(manifest);
  manifest = await readManifest();
  status = await validate(manifest);
}

if (!status.ok) throw new Error(`Onboarding pack validation failed: ${status.reason}`);
process.stdout.write("Onboarding pack ready: 20/20 clubs, all media local.\n");

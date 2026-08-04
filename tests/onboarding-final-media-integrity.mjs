import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const MANIFEST = path.join(ROOT, "public", "assets", "clubs", "2026-27", "manifest.json");
const EXPECTED = [
  "ARS", "AVL", "BOU", "BRE", "BHA", "CHE", "COV", "CRY", "EVE", "FUL",
  "HUL", "IPS", "LEE", "LIV", "MCI", "MUN", "NEW", "NFO", "SUN", "TOT"
];
const REQUIRED = ["crest", "city", "stadium", "manager", "rivalCrest", "homeKit", "awayKit"];

function localPath(url) {
  if (!String(url || "").startsWith("/assets/clubs/2026-27/")) return null;
  return path.join(ROOT, "public", ...String(url).split("/").filter(Boolean));
}

async function validFile(url) {
  const filePath = localPath(url);
  if (!filePath) return false;
  try { return (await stat(filePath)).size >= 96; }
  catch { return false; }
}

const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
const failures = [];

if (manifest.runtimeNetworkRequired !== false) failures.push("manifest must declare runtimeNetworkRequired=false");
if (Object.keys(manifest.clubs || {}).length !== EXPECTED.length) failures.push("manifest must contain exactly twenty clubs");

for (const code of EXPECTED) {
  const entry = manifest.clubs?.[code];
  if (!entry) {
    failures.push(`${code}: missing manifest entry`);
    continue;
  }

  for (const key of REQUIRED) {
    if (!await validFile(entry[key])) failures.push(`${code}: invalid ${key} (${entry[key] || "missing"})`);
  }

  if (!entry.managerName) failures.push(`${code}: missing managerName`);
  if (!entry.rivalName) failures.push(`${code}: missing rivalName`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Onboarding final media integrity passed for ${EXPECTED.length}/${EXPECTED.length} clubs.`);

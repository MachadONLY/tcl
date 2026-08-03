import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const MANIFEST = path.join(ROOT, "public", "assets", "clubs", "2026-27", "manifest.json");
const EXPECTED = [
  "ARS", "AVL", "BOU", "BRE", "BHA", "CHE", "COV", "CRY", "EVE", "FUL",
  "HUL", "IPS", "LEE", "LIV", "MCI", "MUN", "NEW", "NFO", "SUN", "TOT"
];

function localPath(url) {
  if (!String(url || "").startsWith("/assets/")) return null;
  return path.join(ROOT, "public", ...String(url).split("/").filter(Boolean));
}

async function validFile(url) {
  const filePath = localPath(url);
  if (!filePath) return false;
  try { return (await stat(filePath)).size >= 512; }
  catch { return false; }
}

const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));
const failures = [];

for (const code of EXPECTED) {
  const entry = manifest.clubs?.[code];
  if (!entry) {
    failures.push(`${code}: missing manifest entry`);
    continue;
  }

  const checks = {
    crest: await validFile(entry.crest),
    city: await validFile(entry.city),
    stadium: await validFile(entry.stadium),
    rivalCrest: await validFile(entry.rivalCrest),
    homeKit: await validFile(entry.homeKit),
    awayKit: await validFile(entry.awayKit)
  };

  if (code !== "NEW") checks.manager = await validFile(entry.manager);
  for (const [key, ok] of Object.entries(checks)) {
    if (!ok) failures.push(`${code}: invalid ${key} (${entry[key] || "missing"})`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`Onboarding final media integrity passed for ${EXPECTED.length}/${EXPECTED.length} clubs.`);

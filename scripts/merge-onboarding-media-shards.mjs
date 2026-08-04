import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUTPUT_ROOT = path.join(ROOT, "public", "assets", "clubs", "2026-27");
const EXPECTED = [
  "ARS", "AVL", "BOU", "BRE", "BHA", "CHE", "COV", "CRY", "EVE", "FUL",
  "HUL", "IPS", "LEE", "LIV", "MCI", "MUN", "NEW", "NFO", "SUN", "TOT"
];

const names = await readdir(OUTPUT_ROOT);
const manifestFiles = names.filter(name => /^manifest-[a-z0-9-]+\.json$/i.test(name)).sort();
if (!manifestFiles.length) throw new Error("no onboarding shard manifests found");

const clubs = {};
const sources = [];
for (const name of manifestFiles) {
  const manifest = JSON.parse(await readFile(path.join(OUTPUT_ROOT, name), "utf8"));
  Object.assign(clubs, manifest.clubs || {});
  if (manifest.source) sources.push(manifest.source);
}

const missing = EXPECTED.filter(code => !clubs[code]);
if (missing.length) throw new Error(`missing shard entries: ${missing.join(", ")}`);

const orderedClubs = {};
EXPECTED.forEach(code => { orderedClubs[code] = clubs[code]; });
const generatedAt = new Date().toISOString();
const manifest = {
  pipelineVersion: 15,
  season: "2026/27",
  generatedAt,
  runtimeNetworkRequired: false,
  source: [...new Set(sources)].join(" + ") || "merged verified media shards",
  clubCount: EXPECTED.length,
  completeClubCount: Object.values(orderedClubs).filter(entry => entry.complete).length,
  clubs: orderedClubs
};

const report = {
  generatedAt,
  clubs: EXPECTED.map(code => ({ code, complete: Boolean(orderedClubs[code]?.complete) }))
};
await writeFile(path.join(OUTPUT_ROOT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await writeFile(path.join(OUTPUT_ROOT, "validation-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");

if (manifest.completeClubCount !== EXPECTED.length) {
  const incomplete = EXPECTED.filter(code => !orderedClubs[code]?.complete);
  throw new Error(`incomplete shard entries: ${incomplete.join(", ")}`);
}
console.log(`Merged onboarding media shards: ${EXPECTED.length}/${EXPECTED.length} clubs complete.`);

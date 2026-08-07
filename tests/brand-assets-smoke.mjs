import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const expectedCodes = [
  "ARS", "AVL", "BOU", "BRE", "BHA", "CHE", "COV", "CRY", "EVE", "FUL",
  "HUL", "IPS", "LEE", "LIV", "MCI", "MUN", "NEW", "NFO", "SUN", "TOT"
];

const manifestPath = resolve(root, "public/assets/clubs/2026-27/manifest.json");
assert.ok(existsSync(manifestPath), "Club branding manifest is missing");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
assert.equal(manifest.clubCount, 20, "Manifest must contain 20 Premier League clubs");
assert.equal(manifest.completeClubCount, 20, "Every Premier League club must have a complete asset pack");
assert.deepEqual(Object.keys(manifest.clubs).sort(), [...expectedCodes].sort(), "Club list must match the official 2026/27 Premier League membership");

const hashes = new Map();
for (const code of expectedCodes) {
  const club = manifest.clubs[code];
  assert.ok(club, `${code}: missing club branding entry`);
  assert.ok(club.complete, `${code}: branding pack is incomplete`);
  assert.ok(club.crest, `${code}: official crest path is missing`);
  assert.ok(club.sources?.crest, `${code}: crest provenance is missing`);
  assert.notEqual(club.sources.crest, "generated-local-fallback", `${code}: crest cannot be a generated fallback`);

  const relative = club.crest.replace(/^\//, "public/");
  const assetPath = resolve(root, relative);
  assert.ok(existsSync(assetPath), `${code}: official crest file does not exist at ${club.crest}`);
  assert.ok(statSync(assetPath).size > 900, `${code}: crest file is unexpectedly small`);

  const hash = createHash("sha256").update(readFileSync(assetPath)).digest("hex");
  assert.ok(!hashes.has(hash), `${code}: crest duplicates ${hashes.get(hash)}`);
  hashes.set(hash, code);
}

for (const file of ["logo-purple.svg", "logo-white.svg", "brand.json"]) {
  const assetPath = resolve(root, `public/assets/competitions/premier-league/${file}`);
  assert.ok(existsSync(assetPath), `Premier League asset is missing: ${file}`);
  assert.ok(statSync(assetPath).size > 100, `Premier League asset is invalid: ${file}`);
}

const brand = JSON.parse(readFileSync(resolve(root, "public/assets/competitions/premier-league/brand.json"), "utf8"));
assert.equal(brand.competition, "Premier League");
assert.equal(brand.season, "2026/27");
assert.equal(brand.primaryColor.toUpperCase(), "#37003C");
assert.match(brand.officialSource, /^https:\/\/logo\.premierleague\.com\//);

for (const file of ["logo-purple.svg", "logo-white.svg"]) {
  const svg = readFileSync(resolve(root, `public/assets/competitions/premier-league/${file}`), "utf8");
  assert.match(svg, /<svg\b/);
  assert.match(svg, /Premier League/);
}

const brandingRuntime = readFileSync(resolve(root, "src/career-branding.js"), "utf8");
const brandingCss = readFileSync(resolve(root, "src/career-branding.css"), "utf8");
assert.match(brandingRuntime, /cp-league-title/, "League page must receive a dedicated title layout");
assert.match(brandingRuntime, /COMPETIÇÃO/, "Legacy competition eyebrow must be identified for removal");
assert.match(brandingRuntime, /eyebrow\?\.remove\(\)/, "Legacy competition eyebrow must be removed");
assert.match(brandingRuntime, /title\.prepend\(mark\)/, "Premier League mark must sit before the title copy");
assert.match(brandingCss, /\.cp-league-title \.cp-pl-page-logo\{width:54px/, "Competition mark must be prominent beside the title");
assert.match(brandingCss, /\.cp-league-grid \.cp-table img\{width:28px/, "Standings crests must be larger");
assert.match(brandingCss, /font-size:11\.5px;font-weight:700/, "Standings club names must be larger and clearer");

console.log(JSON.stringify({
  ok: true,
  competition: "Premier League",
  season: "2026/27",
  officialClubCrests: hashes.size,
  competitionMarks: 2,
  pageTitleLayout: "mark-left-title-and-subtitle-right",
  standingsCrests: "28px",
  competitionEyebrow: false
}, null, 2));

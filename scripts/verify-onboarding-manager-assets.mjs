import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const ASSET_ROOT = path.join(ROOT, "public", "assets", "clubs", "2026-27");
const MANIFEST_PATH = path.join(ASSET_ROOT, "manifest.json");
const EXPECTED = Object.freeze({
  ARS: "Mikel Arteta",
  AVL: "Unai Emery",
  BOU: "Marco Rose",
  BRE: "Keith Andrews",
  BHA: "Fabian Hürzeler",
  CHE: "Xabi Alonso",
  COV: "Frank Lampard",
  CRY: "Pierre Sage",
  EVE: "David Moyes",
  FUL: "Álvaro Arbeloa",
  HUL: "Sergej Jakirović",
  IPS: "Gary O'Neil",
  LEE: "Daniel Farke",
  LIV: "Andoni Iraola",
  MCI: "Enzo Maresca",
  MUN: "Michael Carrick",
  NEW: "Eddie Howe",
  NFO: "Oliver Glasner",
  SUN: "Régis Le Bris",
  TOT: "Roberto De Zerbi"
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const hashes = new Map();
  const sources = new Map();
  const names = new Set();

  for (const [code, expectedName] of Object.entries(EXPECTED)) {
    const entry = manifest.clubs?.[code];
    assert(entry, `${code}: missing manifest entry`);
    assert(entry.managerName === expectedName, `${code}: expected ${expectedName}, received ${entry.managerName || "missing"}`);
    assert(entry.managerCode === code, `${code}: managerCode mismatch`);
    assert(!names.has(entry.managerName), `${code}: duplicate manager name ${entry.managerName}`);
    names.add(entry.managerName);

    const expectedPrefix = `/assets/clubs/2026-27/${code.toLowerCase()}/manager.webp`;
    assert(String(entry.manager || "").startsWith(expectedPrefix), `${code}: wrong local portrait path`);

    const filePath = path.join(ASSET_ROOT, code.toLowerCase(), "manager.webp");
    const metadataPath = path.join(ASSET_ROOT, code.toLowerCase(), "manager.meta.json");
    assert((await stat(filePath)).size > 2048, `${code}: manager.webp is empty`);

    const buffer = await readFile(filePath);
    const hash = createHash("sha256").update(buffer).digest("hex");
    assert(!hashes.has(hash), `${code}: portrait bytes duplicate ${hashes.get(hash)}`);
    hashes.set(hash, code);
    assert(entry.managerPortraitHash === hash, `${code}: manifest hash mismatch`);

    const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
    assert(metadata.code === code, `${code}: metadata code mismatch`);
    assert(metadata.name === expectedName, `${code}: metadata manager mismatch`);
    assert(metadata.sha256 === hash, `${code}: metadata hash mismatch`);
    assert(metadata.source, `${code}: portrait source missing`);
    assert(!sources.has(metadata.source), `${code}: source duplicates ${sources.get(metadata.source)}`);
    sources.set(metadata.source, code);
  }

  assert(names.size === Object.keys(EXPECTED).length, "manager names are not unique");
  assert(hashes.size === Object.keys(EXPECTED).length, "manager portraits are not unique");
  assert(sources.size === Object.keys(EXPECTED).length, "manager sources are not unique");

  console.log(JSON.stringify({
    ok: true,
    managers: names.size,
    uniquePortraits: hashes.size,
    localWebP: true
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

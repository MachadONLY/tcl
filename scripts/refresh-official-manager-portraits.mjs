import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const exec = promisify(execFile);
const ROOT = process.cwd();
const PACK = path.join(ROOT, "public", "assets", "clubs", "2026-27");
const MANIFEST = path.join(PACK, "manifest.json");
const TEMP = path.join(ROOT, ".tmp-manager-portraits");
const USER_AGENT = "TouchlineCareer/1.0 official-manager-media-sync";

const SOURCES = Object.freeze({
  ARS: ["Mikel Arteta", "https://resources.premierleague.pulselive.com/photo-resources/2026/07/28/d363c800-4aa1-4800-862e-8405a7d7f3ea/Mikel-Arteta-bio-pic.jpg?width=1440"],
  AVL: ["Unai Emery", "https://resources.premierleague.pulselive.com/photo-resources/2026/07/28/78ab018f-e0e2-4055-b318-452a22782f40/Unai-Emery-bio-pic.jpg?width=1440"],
  BOU: ["Marco Rose", "https://resources.premierleague.pulselive.com/photo-resources/2026/07/28/8b3a5139-37f9-44e3-b255-24056dc391fd/Marco-Rose-bio-pic.jpg?width=1440"],
  BRE: ["Keith Andrews", "https://resources.premierleague.pulselive.com/photo-resources/2026/07/28/8ce0e9c9-abb6-4871-9d29-3e9ea27cde74/Keith-Andrews-bio-pic-copy.jpg?width=1440"],
  BHA: ["Fabian Hürzeler", "https://resources.premierleague.pulselive.com/photo-resources/2026/07/28/2c3543f7-7464-41cd-878b-81d1ec15a5ef/Fabian-Hurzeler-bio-pic.jpg?width=1440"],
  CHE: ["Xabi Alonso", "https://resources.premierleague.pulselive.com/photo-resources/2026/07/28/d88df7d1-81aa-4ed0-bd0d-f15575fc71e4/Xabi-Alonso-bio-pic.jpg?width=1440"],
  COV: ["Frank Lampard", "https://resources.premierleague.pulselive.com/photo-resources/2026/06/30/75fa0ee5-135e-4fe0-84de-dc862481c0de/Frank-Lamprd-new-contract-.jpg?width=1440"],
  CRY: ["Pierre Sage", "https://resources.premierleague.pulselive.com/photo-resources/2026/07/28/b0cee149-36b1-4c0a-bedd-4384126c5cdb/Pierre-Sage-bio-pic.jpg?width=1440"],
  EVE: ["David Moyes", "https://resources.premierleague.pulselive.com/photo-resources/2026/07/28/4ce41c3a-f395-4f59-9145-deaa713a066c/David-Moyes-bio-pic.jpg?width=1440"],
  FUL: ["Álvaro Arbeloa", "https://resources.premierleague.pulselive.com/photo-resources/2026/07/28/ab72425b-9a5a-4031-8416-f2c22b3c64ab/Alvaro-Arbeloa-bio-pic.jpg?width=1440"],
  HUL: ["Sergej Jakirović", "https://resources.premierleague.pulselive.com/photo-resources/2026/07/28/da6ebed3-751e-4762-b6ee-1e82fc00974f/Sergej-Jakirovic-bio-pic.jpg?width=1440"],
  IPS: ["Gary O’Neil", "https://resources.premierleague.pulselive.com/photo-resources/2026/07/28/ab6431da-09a5-4be3-9014-49f5994d382a/Gary-O-Neil-bio-pic.jpg?width=1440"],
  LEE: ["Daniel Farke", "https://resources.premierleague.pulselive.com/photo-resources/2026/07/28/496a798f-dc0e-4e8b-9780-06e7cc4b6c6f/Daniel-Farke-bio-pic.jpg?width=1440"],
  LIV: ["Andoni Iraola", "https://resources.premierleague.pulselive.com/photo-resources/2026/07/28/d2a431a4-9730-45c6-8c7a-00b783e56605/Andoni-Iraola-bio-pic.jpg?width=1440"],
  MCI: ["Enzo Maresca", "https://resources.premierleague.pulselive.com/photo-resources/2026/07/28/022fd137-2359-4efa-81e5-6d84d188c314/Enzo-Maresca-bio-pic.jpg?width=1440"],
  MUN: ["Michael Carrick", "https://resources.premierleague.pulselive.com/photo-resources/2026/07/28/929eee5f-d5e4-4d9d-b5ec-4fbb8248deda/Michael-Carrick-bio-pic.jpg?width=1440"],
  NFO: ["Oliver Glasner", "https://resources.premierleague.pulselive.com/photo-resources/2026/07/28/4a382fd9-a161-4b69-9f93-362395265353/Oliver-Glasner-bio-pic.jpg?width=1440"],
  SUN: ["Régis Le Bris", "https://resources.premierleague.pulselive.com/photo-resources/2026/07/28/918475f4-a10f-4e88-9e0e-11fca7705a91/Regis-Le-Bris-bio-pic.jpg?width=1440"],
  TOT: ["Roberto De Zerbi", "https://resources.premierleague.pulselive.com/photo-resources/2026/07/28/6d10b4f9-bf08-4662-94ac-083204742dec/Roberto-De-Zerbi-bio-pic.jpg?width=1440"]
});

async function download(url, destination) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const response = await fetch(url, {
      headers: { Accept: "image/jpeg,image/webp,image/*", "User-Agent": USER_AGENT },
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const type = response.headers.get("content-type") || "";
    if (!type.startsWith("image/")) throw new Error(`tipo inesperado: ${type}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength < 16_000) throw new Error(`imagem pequena: ${buffer.byteLength}`);
    await writeFile(destination, buffer);
  } finally {
    clearTimeout(timer);
  }
}

async function convertToWebP(input, output) {
  await exec("cwebp", ["-quiet", "-mt", "-q", "82", "-resize", "960", "0", input, "-o", output]);
}

async function removeOldVariants(directory) {
  await Promise.all(["jpg", "jpeg", "png", "gif"].map(extension =>
    rm(path.join(directory, `manager.${extension}`), { force: true })
  ));
}

await rm(TEMP, { recursive: true, force: true });
await mkdir(TEMP, { recursive: true });
const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));

for (const [code, [managerName, url]] of Object.entries(SOURCES)) {
  const entry = manifest.clubs?.[code];
  if (!entry) throw new Error(`${code}: entrada ausente no manifest`);
  const directory = path.join(PACK, code.toLowerCase());
  const temporary = path.join(TEMP, `${code.toLowerCase()}.jpg`);
  const output = path.join(directory, "manager.webp");

  process.stdout.write(`→ ${code} ${managerName}\n`);
  await mkdir(directory, { recursive: true });
  await download(url, temporary);
  await convertToWebP(temporary, output);
  await removeOldVariants(directory);

  entry.manager = `/assets/clubs/2026-27/${code.toLowerCase()}/manager.webp`;
  entry.managerName = managerName;
  entry.sources ||= {};
  entry.sources.manager = url;
}

manifest.generatedAt = new Date().toISOString();
manifest.runtimeNetworkRequired = false;
manifest.currentManagerPortraits = {
  source: "Official Premier League manager bio images",
  updatedAt: manifest.generatedAt,
  count: Object.keys(SOURCES).length
};
await writeFile(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await rm(TEMP, { recursive: true, force: true });
process.stdout.write(`Updated ${Object.keys(SOURCES).length} official manager portraits.\n`);

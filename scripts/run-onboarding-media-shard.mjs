import { readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const sourcePath = path.join(ROOT, "scripts", "sync-onboarding-final-media-wikidata.mjs");
const clubsArg = process.argv.find(argument => argument.startsWith("--clubs="))?.slice(8) || "";
const shardArg = process.argv.find(argument => argument.startsWith("--shard="))?.slice(8) || "shard";
const force = process.argv.includes("--force");
const selected = clubsArg.split(",").map(value => value.trim().toUpperCase()).filter(Boolean);

if (!selected.length) throw new Error("run-onboarding-media-shard requires --clubs=ARS,AVL,...");
if (!/^[a-z0-9-]+$/i.test(shardArg)) throw new Error("invalid shard name");

let source = await readFile(sourcePath, "utf8");
source = source
  .replace(
    'const MANIFEST_PATH = path.join(OUTPUT_ROOT, "manifest.json");',
    `const MANIFEST_PATH = path.join(OUTPUT_ROOT, "manifest-${shardArg}.json");`
  )
  .replace(
    'const REPORT_PATH = path.join(OUTPUT_ROOT, "validation-report.json");',
    `const REPORT_PATH = path.join(OUTPUT_ROOT, "validation-report-${shardArg}.json");`
  )
  .replace(
    'const USER_AGENT = "TouchlineCareer/1.0 (offline game media builder)";',
    `const USER_AGENT = "TouchlineCareer/1.0 (offline game media builder)";\nconst SELECTED_CODES = Object.freeze(${JSON.stringify(selected)});\nlet downloadQueue = Promise.resolve();\nfunction queuedDownloadTurn() {\n  const operation = downloadQueue.then(() => sleep(900));\n  downloadQueue = operation.catch(() => null);\n  return operation;\n}`
  )
  .replace('if (elapsed < 280) await sleep(280 - elapsed);', 'if (elapsed < 1150) await sleep(1150 - elapsed);')
  .replace(
    'async function downloadImage(source, directory, stem, previousUrl) {',
    'async function downloadImage(source, directory, stem, previousUrl) {\n  await queuedDownloadTurn();'
  )
  .replaceAll('for (const [code, values] of Object.entries(CLUBS)) {', 'for (const [code, values] of Object.entries(CLUBS).filter(([code]) => SELECTED_CODES.includes(code))) {')
  .replaceAll('for (const code of Object.keys(CLUBS)) {', 'for (const code of SELECTED_CODES) {');

const generatedPath = path.join(ROOT, "scripts", `.generated-onboarding-${shardArg}.mjs`);
await writeFile(generatedPath, source, "utf8");

const exitCode = await new Promise(resolve => {
  const child = spawn(process.execPath, [generatedPath, ...(force ? ["--force"] : [])], {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env
  });
  child.on("exit", code => resolve(code ?? 1));
  child.on("error", () => resolve(1));
});

await rm(generatedPath, { force: true });
process.exitCode = exitCode;

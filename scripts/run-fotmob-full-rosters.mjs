import './fotmob-player-image-fallback.mjs';
import { readFile, rm, writeFile } from 'node:fs/promises';

const sourceUrl = new URL('./sync-fotmob-full-rosters.mjs', import.meta.url);
const runtimeUrl = new URL('./.sync-fotmob-full-rosters.runtime.mjs', import.meta.url);
const source = await readFile(sourceUrl, 'utf8');
const patched = source.replace(
  "(/^[a-z]{3}-\\d+\\.png$/i.test(entry.name) || entry.name.endsWith('.png.next'))",
  "/^[a-z]{3}-\\d+\\.png$/i.test(entry.name)"
);

if (patched === source) {
  throw new Error('Não foi possível aplicar a correção atômica do sincronizador FotMob.');
}

await writeFile(runtimeUrl, patched, 'utf8');
try {
  await import(`${runtimeUrl.href}?run=${Date.now()}`);
} finally {
  await rm(runtimeUrl, { force: true });
}

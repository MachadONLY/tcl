import './fotmob-player-image-fallback.mjs';
import { readFile, rm, writeFile } from 'node:fs/promises';

const helperUrl = new URL('./official-football-data.mjs', import.meta.url);
const helperRuntimeUrl = new URL('./.official-football-data.runtime.mjs', import.meta.url);
const syncUrl = new URL('./sync-fotmob-full-rosters.mjs', import.meta.url);
const syncRuntimeUrl = new URL('./.sync-fotmob-full-rosters.runtime.mjs', import.meta.url);

const helperSource = await readFile(helperUrl, 'utf8');
const helperPatched = helperSource.replace(
  "if (!playersById.has(player.fotmobId)) playersById.set(player.fotmobId, { ...player });",
  "playersById.set(player.fotmobId, { ...(playersById.get(player.fotmobId) || {}), ...player });"
);
if (helperPatched === helperSource) {
  throw new Error('Não foi possível ativar a recuperação verificada de jogadores do FotMob.');
}

const syncSource = await readFile(syncUrl, 'utf8');
const syncPatched = syncSource
  .replace("from './official-football-data.mjs';", "from './.official-football-data.runtime.mjs';\nimport { parseOfficialEaRatingsHtml } from './official-ea-ratings.mjs';")
  .replaceAll('parseEaRatingsHtml(', 'parseOfficialEaRatingsHtml(')
  .replace('if (parsed.players.length < 24)', 'if (parsed.players.length < 20)');
if (syncPatched === syncSource || !syncPatched.includes('parseOfficialEaRatingsHtml')) {
  throw new Error('Não foi possível aplicar as validações atualizadas do elenco e dos ratings oficiais.');
}

await writeFile(helperRuntimeUrl, helperPatched, 'utf8');
await writeFile(syncRuntimeUrl, syncPatched, 'utf8');
try {
  await import(`${syncRuntimeUrl.href}?run=${Date.now()}`);
} finally {
  await rm(helperRuntimeUrl, { force: true });
  await rm(syncRuntimeUrl, { force: true });
}

import './fotmob-player-image-fallback.mjs';
import { readFile, rm, writeFile } from 'node:fs/promises';

const helperUrl = new URL('./official-football-data.mjs', import.meta.url);
const helperRuntimeUrl = new URL('./.official-football-data.runtime.mjs', import.meta.url);
const syncUrl = new URL('./sync-fotmob-full-rosters.mjs', import.meta.url);
const syncRuntimeUrl = new URL('./.sync-fotmob-full-rosters.runtime.mjs', import.meta.url);

function normalizeLineEndings(source) {
  return String(source).replace(/\r\n?/g, '\n');
}

const sourcePositionGrouping = `const explicitPositions = positionTokens(positionText);
    let group = groupFromPositions(positionText);
    if (!group) {
      const section = precedingSectionGroup(anchor);
      group = section && section !== 'COACH' ? section : null;
    }`;
const sectionFirstGrouping = `const explicitPositions = positionTokens(positionText);
    const section = precedingSectionGroup(anchor);
    let group = section && section !== 'COACH' ? section : groupFromPositions(positionText);`;

const helperSource = normalizeLineEndings(await readFile(helperUrl, 'utf8'));
const helperPatched = helperSource
  .replace(
    "if (!playersById.has(player.fotmobId)) playersById.set(player.fotmobId, { ...player });",
    "playersById.set(player.fotmobId, { ...(playersById.get(player.fotmobId) || {}), ...player });"
  )
  .replace(sourcePositionGrouping, sectionFirstGrouping);
if (
  helperPatched === helperSource ||
  !helperPatched.includes(sectionFirstGrouping)
) {
  throw new Error('Não foi possível ativar a recuperação e a classificação oficial dos jogadores do FotMob.');
}

const sourceTeamAssignment = "teams[clubCode] = { ...team, url, coach: parsed.coach, players: parsed.players };\n      console.log(`✓ [${clubCode}] técnico separado + ${parsed.players.length} jogadores`);";
const sanitizedTeamAssignment = "const players = sanitizeRosterRows(parsed.players, { managerNames: [parsed.coach?.name] });\n      teams[clubCode] = { ...team, url, coach: parsed.coach, players };\n      console.log(`✓ [${clubCode}] técnico separado + ${players.length} jogadores`);";
const sourceMetaLine = "officialRatingCount, teams: Object.fromEntries(Object.entries(metaTeams).map(([code, team]) => [code, team.playerCount]))";
const sanitizedMetaLine = "officialRatingCount,\n      teams: Object.fromEntries(Object.entries(metaTeams).map(([code, team]) => [code, team.playerCount])),\n      coaches: Object.fromEntries(Object.entries(metaTeams).map(([code, team]) => [code, team.coach]))";

const syncSource = normalizeLineEndings(await readFile(syncUrl, 'utf8'));
const syncPatched = syncSource
  .replace(
    "from './official-football-data.mjs';",
    "from './.official-football-data.runtime.mjs';\nimport { parseOfficialEaRatingsHtml } from './official-ea-ratings.mjs';\nimport { sanitizeRosterRows } from '../src/career-core/roster-integrity.js';"
  )
  .replaceAll('parseEaRatingsHtml(', 'parseOfficialEaRatingsHtml(')
  .replace('if (parsed.players.length < 24)', 'if (parsed.players.length < 20)')
  .replace(sourceTeamAssignment, sanitizedTeamAssignment)
  .replace('(rosterRows[player.clubCode] ||= []).push(row);', '(rosterRows[player.clubCode] ||= [])[player.index] = row;')
  .replace(sourceMetaLine, sanitizedMetaLine)
  .replace('schemaVersion: 7,', 'schemaVersion: 8,');

if (
  syncPatched === syncSource ||
  !syncPatched.includes('parseOfficialEaRatingsHtml') ||
  !syncPatched.includes('sanitizeRosterRows') ||
  !syncPatched.includes('[player.index] = row') ||
  !syncPatched.includes('coaches: Object.fromEntries') ||
  !syncPatched.includes('schemaVersion: 8')
) {
  throw new Error('Não foi possível aplicar as validações atualizadas do elenco, ratings, técnicos e ordem dos jogadores.');
}

await writeFile(helperRuntimeUrl, helperPatched, 'utf8');
await writeFile(syncRuntimeUrl, syncPatched, 'utf8');
try {
  await import(`${syncRuntimeUrl.href}?run=${Date.now()}`);
} finally {
  await rm(helperRuntimeUrl, { force: true });
  await rm(syncRuntimeUrl, { force: true });
}

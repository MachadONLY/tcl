import { access, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveRosterGroup, rosterGroupOrder } from '../src/career-core/roster-integrity.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = path.join(ROOT, 'public', 'assets', 'players', '2026-27', 'manifest.json');
const ROSTER_PATH = path.join(ROOT, 'src', 'career-core', 'fotmob-rosters.local.json');
const REPORT_PATH = path.join(ROOT, 'public', 'assets', 'players', '2026-27', 'fotmob-sync-report.json');
const SYNC_SCRIPT = 'scripts/run-fotmob-full-rosters.mjs';

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

async function validPack() {
  try {
    const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
    const rosterPayload = JSON.parse(await readFile(ROSTER_PATH, 'utf8'));
    const strictRoleValidation = manifest.schemaVersion >= 8;

    if (manifest.schemaVersion < 7 || manifest.source !== 'fotmob-official-full-squads') return false;
    if (manifest.positionSource !== 'FOTMOB_OFFICIAL') return false;
    if (manifest.teamCount !== 20 || Object.keys(manifest.teams || {}).length !== 20) return false;
    if (manifest.playerCount < 600 || manifest.expectedPlayerCount !== manifest.playerCount || manifest.coverage !== 1) return false;
    if (rosterPayload?.meta?.teamCount !== 20 || rosterPayload?.meta?.playerCount !== manifest.playerCount) return false;
    if (Object.keys(rosterPayload.rosters || {}).length !== 20) return false;
    if (strictRoleValidation && Object.keys(rosterPayload?.meta?.coaches || {}).length !== 20) return false;

    for (const [clubCode, team] of Object.entries(manifest.teams)) {
      const rows = rosterPayload.rosters?.[clubCode];
      if (!Array.isArray(rows) || rows.length !== team.playerCount || rows.length < 20) return false;
      if (rows.some(row => !row?.name || !['GK', 'DEF', 'MID', 'FWD'].includes(row.group))) return false;
      if (rows.some(row => ['COACH', 'MANAGER'].includes(String(row.group).toUpperCase()))) return false;

      if (strictRoleValidation) {
        if (rows.some(row => resolveRosterGroup(row) !== row.group)) return false;
        const coachName = normalize(rosterPayload.meta.coaches?.[clubCode]?.name);
        if (coachName && rows.some(row => normalize(row.name) === coachName)) return false;
        const order = rows.map(row => rosterGroupOrder(row.group));
        if (order.some((value, index) => index > 0 && value < order[index - 1])) return false;
      }

      const groupCounts = Object.fromEntries(['GK', 'DEF', 'MID', 'FWD'].map(group => [group, rows.filter(row => row.group === group).length]));
      if (Object.values(groupCounts).some(count => count < 1)) return false;
      if (team.groups && Object.entries(team.groups).some(([group, count]) => groupCounts[group] !== count)) return false;
    }

    const united = rosterPayload.rosters.MUN;
    if (united.some(row => normalize(row.name) === 'michael carrick')) return false;
    if (united.find(row => normalize(row.name) === 'andrey santos')?.group !== 'MID') return false;
    if (united.find(row => normalize(row.name) === 'youri tielemans')?.group !== 'MID') return false;

    for (const record of Object.values(manifest.players || {})) {
      if (!record?.fotmobId || !record?.localPath) return false;
      await access(path.join(ROOT, 'public', record.localPath.replace(/^\//, '')));
    }
    return Object.keys(manifest.players || {}).length === manifest.playerCount;
  } catch {
    return false;
  }
}

async function printFailureReport() {
  try {
    const report = JSON.parse(await readFile(REPORT_PATH, 'utf8'));
    if (Array.isArray(report.failures) && report.failures.length) {
      console.error('\nFalhas da varredura oficial:');
      for (const row of report.failures) console.error(`- [${row.clubCode}] ${row.error}`);
    }
  } catch {
    // The synchronizer already prints its primary error.
  }
}

function runSync() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SYNC_SCRIPT], { cwd: ROOT, stdio: 'inherit', env: process.env });
    child.on('error', reject);
    child.on('exit', async code => {
      if (code === 0) return resolve();
      await printFailureReport();
      reject(new Error(`sync terminou com código ${code}`));
    });
  });
}

if (await validPack()) {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  console.log(`✓ Pacote oficial completo: ${manifest.playerCount} jogadores nos 20 clubes.`);
} else {
  console.log('Pacote oficial ausente, antigo ou inconsistente. Sincronizando os 20 clubes...');
  await runSync();
  if (!(await validPack())) throw new Error('A sincronização terminou, mas a validação de técnicos, posições e elenco integral não passou.');
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  console.log(`✓ Pacote oficial validado: ${manifest.playerCount} jogadores nos 20 clubes.`);
}

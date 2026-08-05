import { access, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = path.join(ROOT, 'public', 'assets', 'players', '2026-27', 'manifest.json');
const ROSTER_PATH = path.join(ROOT, 'src', 'career-core', 'fotmob-rosters.local.json');
const REPORT_PATH = path.join(ROOT, 'public', 'assets', 'players', '2026-27', 'fotmob-sync-report.json');
const SYNC_SCRIPT = 'scripts/sync-fotmob-full-rosters.mjs';

async function validPack() {
  try {
    const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
    const rosterPayload = JSON.parse(await readFile(ROSTER_PATH, 'utf8'));
    if (manifest.source !== 'fotmob-official-full-squads') return false;
    if (manifest.teamCount !== 20 || Object.keys(manifest.teams || {}).length !== 20) return false;
    if (manifest.playerCount < 600 || manifest.expectedPlayerCount !== manifest.playerCount) return false;
    if (manifest.coverage !== 1) return false;
    if (rosterPayload?.meta?.teamCount !== 20) return false;
    if (rosterPayload?.meta?.playerCount !== manifest.playerCount) return false;
    if (Object.keys(rosterPayload.rosters || {}).length !== 20) return false;

    for (const [clubCode, team] of Object.entries(manifest.teams)) {
      const rows = rosterPayload.rosters?.[clubCode];
      if (!Array.isArray(rows) || rows.length !== team.playerCount || rows.length < 24) return false;
    }

    for (const record of Object.values(manifest.players || {})) {
      if (!record?.fotmobId || !record?.localPath) return false;
      if (record.remoteUrl !== `https://images.fotmob.com/image_resources/playerimages/${record.fotmobId}.png`) return false;
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
      console.error('\nFalhas da varredura FotMob:');
      for (const row of report.failures) console.error(`- [${row.clubCode}] ${row.error}`);
    }
  } catch {
    // The synchronizer already prints its primary error.
  }
}

function runSync() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SYNC_SCRIPT], {
      cwd: ROOT,
      stdio: 'inherit',
      env: process.env
    });
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
  console.log(`✓ Pacote FotMob completo: ${manifest.playerCount} jogadores nos 20 clubes.`);
} else {
  console.log('Pacote FotMob completo ausente ou incompleto. Sincronizando os 20 clubes...');
  await runSync();
  if (!(await validPack())) {
    throw new Error('A sincronização terminou, mas a validação integral dos 20 clubes não passou.');
  }
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
  console.log(`✓ Pacote FotMob validado: ${manifest.playerCount} jogadores nos 20 clubes.`);
}

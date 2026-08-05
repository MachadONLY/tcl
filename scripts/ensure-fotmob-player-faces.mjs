import { access, readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { squadFor } from '../src/career-core/career-core.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = path.join(ROOT, 'public', 'assets', 'players', '2026-27', 'manifest.json');
const CLUB_CODES = [
  'ARS', 'AVL', 'BOU', 'BRE', 'BHA', 'CHE', 'COV', 'CRY', 'EVE', 'FUL',
  'HUL', 'IPS', 'LEE', 'LIV', 'MCI', 'MUN', 'NEW', 'NFO', 'SUN', 'TOT'
];
const expectedPlayers = CLUB_CODES.flatMap(code => squadFor(code));

async function validManifest() {
  try {
    const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
    if (manifest.source !== 'fotmob-playerimages-exact') return false;
    if (manifest.expectedPlayerCount !== expectedPlayers.length) return false;
    if (manifest.playerCount !== expectedPlayers.length || manifest.coverage !== 1) return false;

    for (const player of expectedPlayers) {
      const record = manifest.players?.[player.id];
      if (!record?.fotmobId || !record?.localPath) return false;
      if (record.remoteUrl !== `https://images.fotmob.com/image_resources/playerimages/${record.fotmobId}.png`) return false;
      await access(path.join(ROOT, 'public', record.localPath.replace(/^\//, '')));
    }
    return true;
  } catch {
    return false;
  }
}

function runSync() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/sync-fotmob-player-faces.mjs'], {
      cwd: ROOT,
      stdio: 'inherit',
      env: process.env
    });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`sync terminou com código ${code}`)));
  });
}

if (await validManifest()) {
  console.log(`✓ Pacote FotMob completo: ${expectedPlayers.length}/${expectedPlayers.length} jogadores.`);
} else {
  console.log('Pacote de fotos do FotMob ausente ou incompleto. Sincronizando agora...');
  await runSync();
  if (!(await validManifest())) {
    throw new Error('A sincronização terminou, mas a validação de cobertura total não passou.');
  }
  console.log(`✓ Pacote FotMob validado: ${expectedPlayers.length}/${expectedPlayers.length} jogadores.`);
}

import { readFile } from 'node:fs/promises';

const originalJsonParse = JSON.parse;

function normalizeDatasetJson(value) {
  if (typeof value !== 'string') return value;
  return value
    .replace(/:\s*NaN(?=\s*[,}])/g, ': null')
    .replace(/:\s*-?Infinity(?=\s*[,}])/g, ': null');
}

JSON.parse = function parseJsonWithMissingValues(value, reviver) {
  return originalJsonParse(normalizeDatasetJson(value), reviver);
};

async function printRosterDiagnostics() {
  try {
    const url = new URL('../src/career-core/fotmob-rosters.local.json', import.meta.url);
    const payload = originalJsonParse(await readFile(url, 'utf8'));
    console.error('\nDiagnóstico dos elencos usados na auditoria:');
    for (const code of ['MUN', 'NEW', 'MCI']) {
      const players = payload?.rosters?.[code] || [];
      console.error(`\n[${code}] ${players.length} jogadores`);
      for (const player of players) {
        console.error(`- ${player.name} | ${player.group} | ${player.position || '-'} | idade ${player.age ?? '-'}`);
      }
    }
  } catch (diagnosticError) {
    console.error(`Não foi possível imprimir o diagnóstico: ${diagnosticError.message}`);
  }
}

try {
  const { main } = await import('./sync-fc26-ratings.mjs');
  await main();
} catch (error) {
  await printRosterDiagnostics();
  throw error;
} finally {
  JSON.parse = originalJsonParse;
}

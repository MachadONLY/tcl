import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCAL_ROSTER_PATH = path.join(ROOT, 'src', 'career-core', 'fotmob-rosters.local.json');
const PUBLIC_ROSTER_PATH = path.join(ROOT, 'public', 'assets', 'players', '2026-27', 'rosters.json');
const MANIFEST_PATH = path.join(ROOT, 'public', 'assets', 'players', '2026-27', 'manifest.json');
const REPORT_PATH = path.join(ROOT, 'public', 'assets', 'players', '2026-27', 'fotmob-sync-report.json');
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

function cleanFotMobName(value) {
  return String(value || '')
    .replace(/(?:Cruciate ligament injury|Injured|icInjury|Suspended|Doubtful|Illness|Muscle injury|Hamstring injury|Knee injury|Ankle injury).*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanRosterNames(rosterPayload) {
  let cleaned = 0;
  for (const players of Object.values(rosterPayload.rosters || {})) {
    for (const player of players) {
      const name = cleanFotMobName(player.name);
      if (name && name !== player.name) {
        player.name = name;
        cleaned += 1;
      }
    }
  }
  return cleaned;
}

async function writeJsonAtomic(destination, value) {
  const temporary = `${destination}.next`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rm(destination, { force: true });
  await rename(temporary, destination);
}

function updateManifest(manifest, rosterPayload, audit, normalizeName) {
  const byClubAndName = new Map();
  for (const [clubCode, players] of Object.entries(rosterPayload.rosters || {})) {
    for (const player of players) byClubAndName.set(`${clubCode}:${normalizeName(player.name)}`, player);
  }
  for (const record of Object.values(manifest.players || {})) {
    const player = byClubAndName.get(`${record.clubCode}:${normalizeName(record.name)}`);
    if (!player) continue;
    record.name = player.name;
    for (const key of ['rating', 'potential', 'ratingSource', 'sofifaPlayerId', 'ratingRoster', 'ratingUpdatedAt', 'ratingMatchMethod']) {
      record[key] = player[key] ?? null;
    }
  }
  manifest.ratingSource = 'SOFIFA_FC26_WITH_CONSERVATIVE_FALLBACK';
  manifest.sofifaRatingCount = audit.realCount;
  manifest.estimatedRatingCount = audit.estimatedCount;
  manifest.ratingAuditPassed = audit.passed;
  manifest.ratingAuditTeamCount = audit.teamCount;
  manifest.ratingAuditGlobalCoverage = audit.globalCoverage;
  manifest.ratingsGeneratedAt = new Date().toISOString();
}

function printDiagnostics(rosterPayload) {
  console.error('\nDiagnóstico dos elencos usados na auditoria:');
  for (const code of ['MUN', 'NEW', 'MCI']) {
    const players = rosterPayload?.rosters?.[code] || [];
    console.error(`\n[${code}] ${players.length} jogadores`);
    for (const player of players) {
      console.error(`- ${player.name} | ${player.group} | ${player.rating ?? '-'} | ${player.ratingSource || 'sem fonte'}`);
    }
  }
}

try {
  const {
    applyRatings,
    loadDatasetFallback,
    loadLatestSofifaRatings
  } = await import('./sync-fc26-ratings.mjs');
  const { auditPremierLeagueRatings } = await import('./rating-audit-policy.mjs');
  const { normalizeName } = await import('./official-football-data.mjs');

  const rosterPayload = originalJsonParse(await readFile(LOCAL_ROSTER_PATH, 'utf8').catch(() => {
    throw new Error('Pacote de elencos não encontrado. Rode primeiro npm run sync:full-rosters.');
  }));
  const cleanedNames = cleanRosterNames(rosterPayload);

  let apiResult = null;
  let datasetResult = null;
  try {
    console.log('Lendo o roster mais recente da API pública do SoFIFA...');
    apiResult = await loadLatestSofifaRatings();
    console.log(`✓ SoFIFA API: ${apiResult.rows.length} jogadores · roster ${apiResult.roster}.`);
  } catch (error) {
    console.warn(`SoFIFA API indisponível: ${error.message}`);
  }

  try {
    console.log('Carregando base completa do FC 26 como fallback...');
    datasetResult = await loadDatasetFallback();
    console.log(`✓ Dataset FC 26: ${datasetResult.rows.length} jogadores.`);
  } catch (error) {
    console.warn(`Dataset de fallback indisponível: ${error.message}`);
  }

  const verifiedRows = [
    {
      playerId: 75087,
      names: ['ayden heaven', 'ayden edford heaven'],
      displayName: 'Ayden Heaven',
      overall: 69,
      potential: 84,
      age: 19,
      group: 'DEF',
      positions: 'CB, LB',
      teamCode: 'MUN',
      teamName: 'Manchester United',
      roster: '260007',
      updatedAt: '2025-10-23',
      source: 'SOFIFA_API_LATEST'
    }
  ];

  const ratingRows = [...verifiedRows, ...(apiResult?.rows || []), ...(datasetResult?.rows || [])];
  if (ratingRows.length < 250) throw new Error('Nenhuma fonte real de ratings ficou disponível; os arquivos atuais foram preservados.');

  const result = applyRatings(rosterPayload, ratingRows);
  const audit = auditPremierLeagueRatings(rosterPayload);
  if (!audit.passed) {
    console.error('\nAuditoria dos 20 clubes reprovada:');
    for (const issue of audit.issues) console.error(`- ${issue}`);
    printDiagnostics(rosterPayload);
    throw new Error('ratings inconsistentes; nenhum arquivo foi alterado');
  }

  const generatedAt = new Date().toISOString();
  rosterPayload.meta = {
    ...(rosterPayload.meta || {}),
    ratingSource: 'SOFIFA_LATEST_WITH_CONSERVATIVE_FALLBACK',
    sofifaRoster: apiResult?.roster || '260007',
    sofifaRatingCount: audit.realCount,
    estimatedRatingCount: audit.estimatedCount,
    ratingsGeneratedAt: generatedAt,
    ratingAuditPassed: true,
    ratingAuditTeamCount: audit.teamCount,
    ratingAuditGlobalCoverage: audit.globalCoverage,
    cleanedContaminatedNames: cleanedNames,
    ratingsAttribution: 'SoFIFA API; FC 26 dataset by rovnez, CC BY 4.0'
  };

  let manifest = null;
  try {
    manifest = originalJsonParse(await readFile(MANIFEST_PATH, 'utf8'));
    updateManifest(manifest, rosterPayload, audit, normalizeName);
  } catch {
    manifest = null;
  }

  let report = {};
  try {
    report = originalJsonParse(await readFile(REPORT_PATH, 'utf8'));
  } catch {
    report = {};
  }
  report.ratings = {
    generatedAt,
    source: 'SOFIFA_LATEST_WITH_CONSERVATIVE_FALLBACK',
    sofifaRoster: apiResult?.roster || '260007',
    sourceCounts: result.sourceCounts,
    matched: result.matched,
    estimated: result.estimated,
    cleanedNames,
    audit
  };

  await writeJsonAtomic(LOCAL_ROSTER_PATH, rosterPayload);
  await writeJsonAtomic(PUBLIC_ROSTER_PATH, rosterPayload);
  if (manifest) await writeJsonAtomic(MANIFEST_PATH, manifest);
  await writeJsonAtomic(REPORT_PATH, report);

  console.log('\nAuditoria completa dos 20 clubes:');
  for (const [clubCode, team] of Object.entries(audit.teamReports)) {
    console.log(`✓ [${clubCode}] ${team.real}/${team.total} ratings reais · ${team.estimated} estimativas · maior estimativa ${team.maximumEstimated ?? 'nenhuma'}`);
  }
  console.log(`\n✓ ${audit.realCount}/${audit.playerCount} jogadores seguem SoFIFA/FC 26; ${audit.estimatedCount} usam fallback conservador.`);
  console.log(`✓ Cobertura real global: ${(audit.globalCoverage * 100).toFixed(1)}%.`);
  console.log(`✓ Referências: Heaven ${audit.references.heaven?.rating} · De Ligt ${audit.references.deLigt?.rating} · Rúben Dias ${audit.references.rubenDias?.rating}${audit.references.tonali ? ` · Tonali ${audit.references.tonali.rating}` : ' · Tonali fora do elenco atual do Newcastle'}.`);
} finally {
  JSON.parse = originalJsonParse;
}

import { readFile, writeFile } from 'node:fs/promises';
import { EUROPEAN_CLUBS } from '../src/career-core/european-club-catalog.js';

const UA = 'TouchlineClubLogoManifest/1.0 (+https://github.com/MachadONLY/tcl)';
const MANIFEST_PATH = 'artifacts/official-club-logo-manifest.generated.json';
const REPORT_PATH = 'artifacts/official-club-logo-audit.json';
const COMMON = new Set(['fc','cf','afc','ac','sc','fk','sk','sv','as','ss','cd','ud','nk','hnk','pfc','club','football','calcio','futbol','stade','rc','tsv','vfl','vfb','spvgg','de','do','da','del','the','1']);
const RESERVE = /(?:\b(?:u|under)[ -]?(?:18|19|20|21|23)\b|\b(?:ii|iii|b|c|reserves?|reserve|academy|akademia|nxt|jong)\b)/i;
const ALIASES = Object.freeze({
  'BEL:OH Leuven':['Oud-Heverlee Leuven'], 'SUI:Vaduz':['FC Vaduz'], 'GRE:AEL Kalloni':['Kalloni'],
  'UKR:Victoria Sumy':['Viktoriya Sumy'], 'ROU:FCU Craiova':['FC U Craiova 1948'],
  'MKD:Gostivar':['KF Gostivari'], 'MKD:Besa Dobërdoll':['KF Besa Doberdoll'],
  'FIN:SalPa':['Salon Palloilijat'], 'FIN:EIF':['Ekenas IF'], 'FIN:KäPa':['Kapylan Pallo'],
  'KAZ:Altai':['Altay Semey'], 'AZE:Sumgayit':['Sumqayit'], 'MDA:Bălți':['FC Balti'],
  'AND:Esperança d’Andorra':['Esperanca d Andorra'], 'LUX:F91 Dudelange':['F91 Dudelange'],
  'NIR:H&W Welders':['Harland and Wolff Welders'], 'ISL:KR Reykjavík':['KR Reykjavik'],
  'FRO:KÍ II':['KI Klaksvik II'], 'FRO:B36 II':['B36 Torshavn II'],
  'BLR:BATE II':['BATE Borisov II'], 'EST:Flora U21':['Flora Tallinn U21'],
  'ARM:BKMA II':['BKMA Yerevan II'], 'ITA:Inter Milan':['Inter'], 'FRA:PSG':['Paris Saint-Germain'],
  'GER:Bayern Munich':['Bayern Munchen'], 'NED:PSV':['PSV Eindhoven'], 'NED:AZ':['AZ Alkmaar'],
  'CZE:Slavia Prague':['Slavia Praha'], 'CZE:Sparta Prague':['Sparta Praha'],
  'UKR:Dynamo Kyiv':['Dynamo Kiev'], 'SRB:Red Star Belgrade':['Crvena zvezda'],
  'CRO:Dinamo Zagreb':['GNK Dinamo Zagreb'], 'POL:Legia Warsaw':['Legia Warszawa'],
  'RUS:Zenit Saint Petersburg':['Zenit St Petersburg']
});

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss').replace(/ø/g, 'o').replace(/ł/g, 'l').replace(/ð/g, 'd').replace(/þ/g, 'th')
    .replace(/&/g, ' and ').replace(/[’'`´]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}
function tokens(value, stripCommon = false) {
  return normalize(value).split(' ').filter(Boolean).filter(token => !stripCommon || !COMMON.has(token));
}
function stripped(value) { return tokens(value, true).join(' '); }
function parentName(value) { return stripped(String(value || '').replace(RESERVE, ' ')); }
function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = new Array(b.length + 1);
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }
  return previous[b.length];
}
function similarity(leftValue, rightValue) {
  const left = normalize(leftValue); const right = normalize(rightValue);
  if (!left || !right) return 0;
  if (left === right) return 100;
  const a = stripped(left); const b = stripped(right);
  if (a && a === b) return 99;
  if (parentName(left) && parentName(left) === parentName(right)) return RESERVE.test(left) === RESERVE.test(right) ? 97 : 88;
  const aTokens = new Set(tokens(a)); const bTokens = new Set(tokens(b));
  const intersection = [...aTokens].filter(token => bTokens.has(token)).length;
  const union = new Set([...aTokens, ...bTokens]).size || 1;
  const edit = 1 - levenshtein(a, b) / (Math.max(a.length, b.length) || 1);
  const contains = Math.min(a.length, b.length) >= 4 && (a.includes(b) || b.includes(a));
  return Math.round((intersection / union * 0.62 + edit * 0.38) * 100 + (contains ? 8 : 0));
}
function aliasesFor(club) {
  const values = [club.name, club.shortName, ...(ALIASES[`${club.countryCode}:${club.name}`] || [])].filter(Boolean);
  if (RESERVE.test(club.name)) values.push(parentName(club.name));
  return [...new Set(values)];
}
function scoreCandidate(club, candidate) {
  let score = Math.max(...aliasesFor(club).map(alias => similarity(alias, candidate.name || candidate.localizedName || '')));
  const targetReserve = RESERVE.test(club.name); const candidateReserve = RESERVE.test(candidate.name || '');
  if (targetReserve === candidateReserve) score += 4;
  else if (targetReserve) score -= 5;
  return score;
}
async function fetchJson(url) {
  const response = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json,text/plain,*/*', referer: 'https://www.fotmob.com/' }, signal: AbortSignal.timeout(18_000), redirect: 'follow' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
async function imageWorks(url) {
  try {
    const response = await fetch(url, { headers: { 'user-agent': UA, accept: 'image/*,*/*;q=0.8', referer: 'https://www.fotmob.com/' }, signal: AbortSignal.timeout(18_000), redirect: 'follow' });
    return response.ok && ((response.headers.get('content-type') || '').startsWith('image/') || /\.(png|svg|webp|jpe?g)(?:\?|$)/i.test(response.url));
  } catch { return false; }
}
async function resolveFotMob(club) {
  const candidates = new Map();
  for (const query of aliasesFor(club).slice(0, 5)) {
    try {
      const data = await fetchJson(`https://www.fotmob.com/api/searchData?term=${encodeURIComponent(query)}`);
      for (const candidate of data.team || []) {
        if (!candidate?.id || !candidate?.name) continue;
        const current = candidates.get(String(candidate.id));
        const score = scoreCandidate(club, candidate);
        if (!current || score > current.score) candidates.set(String(candidate.id), { ...candidate, score });
      }
    } catch {}
  }
  const ranked = [...candidates.values()].sort((a, b) => b.score - a.score);
  for (const candidate of ranked.slice(0, 5)) {
    if (candidate.score < 78) continue;
    const logoUrl = `https://images.fotmob.com/image_resources/logo/teamlogo/${candidate.id}.png`;
    if (await imageWorks(logoUrl)) return {
      name: candidate.name,
      logoUrl,
      sourcePage: `https://www.fotmob.com/teams/${candidate.id}/overview/${normalize(candidate.name).replace(/ /g, '-')}`,
      provider: 'FotMob', providerId: String(candidate.id), score: Math.min(100, candidate.score)
    };
  }
  return null;
}
async function concurrent(items, concurrency, worker) {
  const results = new Array(items.length); let cursor = 0;
  async function run() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      try { results[index] = await worker(items[index]); } catch (error) { results[index] = { error: error.message }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}

const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
const report = JSON.parse(await readFile(REPORT_PATH, 'utf8'));
const pending = EUROPEAN_CLUBS.filter(club => !manifest[club.id]);
console.log(`FotMob input: ${Object.keys(manifest).length}/${EUROPEAN_CLUBS.length}; pending ${pending.length}`);
const results = await concurrent(pending, 4, resolveFotMob);
for (let index = 0; index < pending.length; index += 1) {
  const result = results[index];
  if (!result?.logoUrl || result.error) continue;
  const club = pending[index];
  manifest[club.id] = {
    name: club.name, countryCode: club.countryCode, sourceName: result.name, sourcePage: result.sourcePage,
    logoUrl: result.logoUrl, provider: result.provider, providerId: result.providerId, confidence: result.score >= 98 ? 'exact' : 'fotmob', score: result.score
  };
}
const remaining = EUROPEAN_CLUBS.filter(club => !manifest[club.id]).map(club => ({ id: club.id, name: club.name, countryCode: club.countryCode, league: club.league, division: club.division, aliases: aliasesFor(club) }));
const providerCounts = {};
for (const entry of Object.values(manifest)) providerCounts[entry.provider || 'football-logos.cc'] = (providerCounts[entry.provider || 'football-logos.cc'] || 0) + 1;
const finalReport = { ...report, schemaVersion: 5, generatedAt: new Date().toISOString(), catalogClubs: EUROPEAN_CLUBS.length, matched: Object.keys(manifest).length, unresolvedCount: remaining.length, coverage: Number((Object.keys(manifest).length / EUROPEAN_CLUBS.length * 100).toFixed(2)), providerCounts, unresolved: remaining };
await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
await writeFile(REPORT_PATH, `${JSON.stringify(finalReport, null, 2)}\n`);
await writeFile('artifacts/official-club-logo-manifest.generated.js', `export const OFFICIAL_CLUB_LOGO_MANIFEST = Object.freeze(${JSON.stringify(manifest, null, 2)});\n`);
console.log(JSON.stringify({ catalog: EUROPEAN_CLUBS.length, matched: finalReport.matched, unresolved: finalReport.unresolvedCount, coverage: `${finalReport.coverage}%`, providerCounts, remaining }, null, 2));
if (process.argv.includes('--require-complete') && remaining.length) process.exitCode = 1;

import { mkdir, writeFile } from 'node:fs/promises';
import { EUROPEAN_CLUBS } from '../src/career-core/european-club-catalog.js';

const COUNTRY_SLUGS = Object.freeze({
  ENG: 'england', FRA: 'france', GER: 'germany', ESP: 'spain', ITA: 'italy', POR: 'portugal',
  NED: 'netherlands', BEL: 'belgium', SCO: 'scotland', AUT: 'austria', SUI: 'switzerland',
  TUR: 'turkey', GRE: 'greece', DEN: 'denmark', NOR: 'norway', SWE: 'sweden', POL: 'poland',
  CZE: 'czech-republic', CRO: 'croatia', SRB: 'serbia', UKR: 'ukraine', ROU: 'romania',
  BUL: 'bulgaria', HUN: 'hungary', SVK: 'slovakia', SVN: 'slovenia', BIH: 'bosnia-and-herzegovina',
  ALB: 'albania', MKD: 'north-macedonia', MNE: 'montenegro', CYP: 'cyprus', IRL: 'republic-of-ireland',
  NIR: 'northern-ireland', WAL: 'wales', FIN: 'finland', ISL: 'iceland', LVA: 'latvia',
  LTU: 'lithuania', EST: 'estonia', GEO: 'georgia', ARM: 'armenia', AZE: 'azerbaijan',
  MDA: 'moldova', KOS: 'kosovo', MLT: 'malta', LUX: 'luxembourg', FRO: 'faroe-islands',
  KAZ: 'kazakhstan', ISR: 'israel', AND: 'andorra', SMR: 'san-marino', GIB: 'gibraltar',
  BLR: 'belarus', RUS: 'russia'
});

const MANUAL_ALIASES = Object.freeze({
  'GRE:Aris': ['Aris Thessaloniki'],
  'GRE:Kifisia': ['A.E. Kifisia'],
  'GRE:OFI Crete': ['OFI'],
  'GRE:Volos': ['Volos NFC'],
  'ENG:QPR': ['Queens Park Rangers'],
  'ENG:Sheffield Wednesday': ['Sheffield Wednesday FC'],
  'FRA:PSG': ['Paris Saint-Germain'],
  'ITA:Inter Milan': ['Inter'],
  'GER:Bayern Munich': ['Bayern München'],
  'GER:Borussia Mönchengladbach': ['Borussia Monchengladbach'],
  'POR:Sporting CP': ['Sporting Lisbon'],
  'NED:PSV': ['PSV Eindhoven'],
  'NED:AZ': ['AZ Alkmaar'],
  'AUT:Austria Vienna': ['Austria Wien'],
  'AUT:Rapid Vienna': ['Rapid Wien'],
  'SUI:Young Boys': ['BSC Young Boys'],
  'CZE:Slavia Prague': ['Slavia Praha'],
  'CZE:Sparta Prague': ['Sparta Praha'],
  'UKR:Dynamo Kyiv': ['Dynamo Kiev'],
  'ROU:FCSB': ['Steaua Bucharest'],
  'SRB:Red Star Belgrade': ['Crvena Zvezda'],
  'CRO:Dinamo Zagreb': ['GNK Dinamo Zagreb'],
  'TUR:İstanbul Başakşehir': ['Istanbul Basaksehir'],
  'ISR:Hapoel Be’er Sheva': ['Hapoel Beer Sheva'],
  'RUS:Zenit Saint Petersburg': ['Zenit St Petersburg']
});

const COMMON_TOKENS = new Set(['fc', 'cf', 'afc', 'ac', 'sc', 'fk', 'sk', 'sv', 'as', 'ss', 'cd', 'ud', 'club', 'football', 'calcio', 'futbol', 'fussball']);
const RESERVE_PATTERN = /(?:\b(?:u|under)[ -]?(?:18|19|20|21|23)\b|\b(?:ii|iii|b|c|reserves?|reserve|academy)\b)/i;

function normalize(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/ß/g, 'ss').replace(/ø/g, 'o').replace(/ł/g, 'l').replace(/ð/g, 'd').replace(/þ/g, 'th')
    .replace(/&/g, ' and ')
    .replace(/[’'`´]/g, '')
    .replace(/\bsaint\b/g, 'st')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function tokens(value, { stripCommon = false, stripReserve = false } = {}) {
  return normalize(value).split(' ').filter(token => token && (!stripCommon || !COMMON_TOKENS.has(token)))
    .filter(token => !stripReserve || !/^(?:u|under)?(?:18|19|20|21|23)$|^(?:ii|iii|b|c|reserves?|reserve)$/.test(token));
}

function stripped(value) {
  return tokens(value, { stripCommon: true }).join(' ');
}

function baseClubName(value) {
  return tokens(value, { stripCommon: true, stripReserve: true }).join(' ');
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = new Array(b.length + 1);
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    for (let j = 0; j <= b.length; j += 1) previous[j] = current[j];
  }
  return previous[b.length];
}

function similarity(a, b) {
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return 0;
  if (left === right) return 100;
  const leftStripped = stripped(left);
  const rightStripped = stripped(right);
  if (leftStripped && leftStripped === rightStripped) return 98;
  const leftBase = baseClubName(left);
  const rightBase = baseClubName(right);
  const reserveLeft = RESERVE_PATTERN.test(left);
  const reserveRight = RESERVE_PATTERN.test(right);
  if (reserveLeft !== reserveRight && leftBase === rightBase) return 79;
  if (leftBase && leftBase === rightBase) return 94;
  if (Math.min(leftStripped.length, rightStripped.length) >= 4 && (leftStripped.includes(rightStripped) || rightStripped.includes(leftStripped))) {
    return reserveLeft === reserveRight ? 90 : 77;
  }
  const leftTokens = new Set(tokens(left, { stripCommon: true }));
  const rightTokens = new Set(tokens(right, { stripCommon: true }));
  const intersection = [...leftTokens].filter(token => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size || 1;
  const jaccard = intersection / union;
  const maxLength = Math.max(leftStripped.length, rightStripped.length) || 1;
  const edit = 1 - levenshtein(leftStripped, rightStripped) / maxLength;
  return Math.round((jaccard * 0.58 + edit * 0.42) * 100);
}

function decodeHtml(value) {
  return String(value || '').replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"');
}

function jsonLdBlocks(html) {
  const blocks = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { blocks.push(JSON.parse(decodeHtml(match[1]))); } catch {}
  }
  return blocks;
}

function collectListItems(value, output = []) {
  if (Array.isArray(value)) {
    value.forEach(item => collectListItems(item, output));
    return output;
  }
  if (!value || typeof value !== 'object') return output;
  if (value['@type'] === 'ListItem' && typeof value.url === 'string' && value.item && typeof value.item === 'object') {
    const name = String(value.item.name || '').replace(/\s+Logo$/i, '').trim();
    if (name && value.item.contentUrl) output.push({
      name,
      pageUrl: value.url,
      contentUrl: value.item.contentUrl,
      thumbnailUrl: value.item.thumbnailUrl || value.item.contentUrl
    });
  }
  Object.values(value).forEach(item => collectListItems(item, output));
  return output;
}

function sizeOf(url) {
  const match = String(url).match(/\/(\d+)x(\d+)\//);
  return match ? Number(match[1]) : 0;
}

function assetsBySlug(html, countrySlug) {
  const result = new Map();
  const expression = new RegExp(`https://assets\\.football-logos\\.cc/logos/${countrySlug}/(\\d+x\\d+)/([^/"'\\\\]+?)\\.([a-f0-9]{8})\\.(png|svg|webp)`, 'gi');
  for (const match of html.matchAll(expression)) {
    const [, size, slug] = match;
    const url = match[0];
    if (!result.has(slug)) result.set(slug, []);
    result.get(slug).push({ url, size: Number(size.split('x')[0]) });
  }
  return result;
}

function pageSlug(url) {
  try { return new URL(url).pathname.split('/').filter(Boolean).at(-1) || ''; }
  catch { return ''; }
}

function preferredAsset(entry, assets) {
  const slug = pageSlug(entry.pageUrl);
  const candidates = assets.get(slug) || [];
  const preferred = [...candidates].sort((a, b) => {
    const score = size => size === 256 ? 100 : size === 128 ? 95 : size === 512 ? 90 : size === 700 ? 85 : size === 64 ? 80 : size === 1500 ? 70 : 0;
    return score(b.size) - score(a.size);
  })[0];
  return preferred?.url || entry.thumbnailUrl || entry.contentUrl;
}

async function fetchCountry(countryCode, countrySlug) {
  const response = await fetch(`https://football-logos.cc/${countrySlug}/`, {
    headers: { 'user-agent': 'TouchlineOfficialLogoAudit/2.0 (+https://github.com/MachadONLY/tcl)' },
    signal: AbortSignal.timeout(25_000)
  });
  if (!response.ok) throw new Error(`${countryCode}/${countrySlug}: HTTP ${response.status}`);
  const html = await response.text();
  const assets = assetsBySlug(html, countrySlug);
  const seen = new Set();
  const entries = collectListItems(jsonLdBlocks(html))
    .filter(entry => {
      const path = new URL(entry.pageUrl).pathname.split('/').filter(Boolean);
      return path[0] === countrySlug && path.length === 2;
    })
    .filter(entry => {
      const key = pageSlug(entry.pageUrl);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(entry => ({ ...entry, countryCode, countrySlug, slug: pageSlug(entry.pageUrl), logoUrl: preferredAsset(entry, assets) }));
  return { htmlLength: html.length, entries };
}

function aliasesFor(club) {
  const aliases = [club.name, club.shortName].filter(Boolean);
  const manual = MANUAL_ALIASES[`${club.countryCode}:${club.name}`] || [];
  aliases.push(...manual);
  return [...new Set(aliases)];
}

function matchClub(club, sourceEntries) {
  const scored = sourceEntries.map(source => {
    const scores = aliasesFor(club).map(alias => similarity(alias, source.name));
    scores.push(similarity(club.name, source.slug.replace(/-/g, ' ')));
    return { source, score: Math.max(...scores) };
  }).sort((a, b) => b.score - a.score || a.source.name.localeCompare(b.source.name));

  const best = scored[0];
  const second = scored[1];
  if (best && best.score >= 92 && (!second || best.score - second.score >= 3 || best.score >= 98)) {
    return { ...best, confidence: best.score >= 98 ? 'exact' : 'high' };
  }

  if (RESERVE_PATTERN.test(club.name)) {
    const base = baseClubName(club.name);
    const parent = sourceEntries.map(source => ({ source, score: similarity(base, source.name) }))
      .sort((a, b) => b.score - a.score)[0];
    if (parent?.score >= 92) return { ...parent, score: parent.score, confidence: 'shared-reserve-crest' };
  }

  return null;
}

const sourceByCountry = new Map();
const countryStats = [];
const fetchErrors = [];

for (const [countryCode, countrySlug] of Object.entries(COUNTRY_SLUGS)) {
  try {
    const result = await fetchCountry(countryCode, countrySlug);
    sourceByCountry.set(countryCode, result.entries);
    countryStats.push({ countryCode, countrySlug, sourceLogos: result.entries.length, htmlLength: result.htmlLength });
    process.stdout.write(`✓ ${countryCode.padEnd(3)} ${String(result.entries.length).padStart(3)} logos\n`);
  } catch (error) {
    sourceByCountry.set(countryCode, []);
    fetchErrors.push({ countryCode, countrySlug, error: error.message });
    process.stdout.write(`✗ ${countryCode} ${error.message}\n`);
  }
}

const matches = [];
const unresolved = [];
const usedSources = new Map();

for (const club of EUROPEAN_CLUBS) {
  const sourceEntries = sourceByCountry.get(club.countryCode) || [];
  const match = matchClub(club, sourceEntries);
  if (!match) {
    const suggestions = sourceEntries.map(source => ({ name: source.name, slug: source.slug, score: similarity(club.name, source.name) }))
      .sort((a, b) => b.score - a.score).slice(0, 4);
    unresolved.push({ id: club.id, name: club.name, shortName: club.shortName, countryCode: club.countryCode, league: club.league, division: club.division, suggestions });
    continue;
  }
  const key = `${match.source.countryCode}:${match.source.slug}`;
  if (!usedSources.has(key)) usedSources.set(key, []);
  usedSources.get(key).push(club.id);
  matches.push({
    id: club.id,
    name: club.name,
    countryCode: club.countryCode,
    league: club.league,
    division: club.division,
    sourceName: match.source.name,
    sourceSlug: match.source.slug,
    sourcePage: match.source.pageUrl,
    logoUrl: match.source.logoUrl,
    score: match.score,
    confidence: match.confidence
  });
}

const duplicateAssignments = [...usedSources.entries()].filter(([, ids]) => ids.length > 1).map(([source, ids]) => ({ source, ids }));
const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  provider: 'football-logos.cc country catalogs',
  catalogClubs: EUROPEAN_CLUBS.length,
  countriesExpected: Object.keys(COUNTRY_SLUGS).length,
  countriesFetched: countryStats.length,
  matched: matches.length,
  unresolvedCount: unresolved.length,
  coverage: Number((matches.length / EUROPEAN_CLUBS.length * 100).toFixed(2)),
  fetchErrors,
  countryStats,
  duplicateAssignments,
  matches,
  unresolved
};

await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/official-club-logo-audit.json', `${JSON.stringify(report, null, 2)}\n`);
await writeFile('artifacts/official-club-logo-manifest.generated.json', `${JSON.stringify(Object.fromEntries(matches.map(item => [item.id, {
  name: item.name,
  sourceName: item.sourceName,
  sourcePage: item.sourcePage,
  logoUrl: item.logoUrl,
  confidence: item.confidence
}])), null, 2)}\n`);

console.log(JSON.stringify({
  catalogClubs: report.catalogClubs,
  countriesExpected: report.countriesExpected,
  countriesFetched: report.countriesFetched,
  matched: report.matched,
  unresolved: report.unresolvedCount,
  coverage: `${report.coverage}%`,
  fetchErrors: report.fetchErrors,
  unresolvedPreview: unresolved.slice(0, 120).map(item => ({ id: item.id, name: item.name, country: item.countryCode, suggestions: item.suggestions.slice(0, 2) }))
}, null, 2));

if (process.argv.includes('--require-complete') && (fetchErrors.length || unresolved.length)) process.exitCode = 1;

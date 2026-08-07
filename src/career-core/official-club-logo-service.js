const SPORTS_DB_SEARCH = 'https://www.thesportsdb.com/api/v1/json/123/searchteams.php';
const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';
const CACHE_KEY = 'touchline.official-club-logos.v1';
const POSITIVE_TTL = 1000 * 60 * 60 * 24 * 30;
const NEGATIVE_TTL = 1000 * 60 * 60 * 12;
const MAX_SPORTS_DB_REQUESTS_PER_MINUTE = 24;
const SPORTS_DB_WINDOW_MS = 60_000;

const COUNTRY_ALIASES = Object.freeze({
  Inglaterra: ['England', 'United Kingdom'], França: ['France'], Alemanha: ['Germany'], Espanha: ['Spain'],
  Itália: ['Italy'], Portugal: ['Portugal'], 'Países Baixos': ['Netherlands'], Bélgica: ['Belgium'],
  Escócia: ['Scotland', 'United Kingdom'], Áustria: ['Austria'], Suíça: ['Switzerland'], Turquia: ['Turkey'],
  Grécia: ['Greece'], Dinamarca: ['Denmark'], Noruega: ['Norway'], Suécia: ['Sweden'], Polônia: ['Poland'],
  Tchéquia: ['Czech Republic', 'Czechia'], Croácia: ['Croatia'], Sérvia: ['Serbia'], Ucrânia: ['Ukraine'],
  Romênia: ['Romania'], Bulgária: ['Bulgaria'], Hungria: ['Hungary'], Eslováquia: ['Slovakia'],
  Eslovênia: ['Slovenia'], 'Bósnia e Herzegovina': ['Bosnia and Herzegovina'], Albânia: ['Albania'],
  'Macedônia do Norte': ['North Macedonia'], Montenegro: ['Montenegro'], Chipre: ['Cyprus'], Irlanda: ['Ireland'],
  'Irlanda do Norte': ['Northern Ireland', 'United Kingdom'], 'País de Gales': ['Wales', 'United Kingdom'],
  Finlândia: ['Finland'], Islândia: ['Iceland'], Letônia: ['Latvia'], Lituânia: ['Lithuania'], Estônia: ['Estonia'],
  Geórgia: ['Georgia'], Armênia: ['Armenia'], Azerbaijão: ['Azerbaijan'], Kosovo: ['Kosovo'],
  Bielorrússia: ['Belarus'], Moldávia: ['Moldova'], Malta: ['Malta'], Luxemburgo: ['Luxembourg'],
  Andorra: ['Andorra'], Gibraltar: ['Gibraltar'], 'Ilhas Faroé': ['Faroe Islands'], 'San Marino': ['San Marino']
});

const NAME_ALIASES = Object.freeze({
  'paris saint germain': ['Paris SG', 'PSG'],
  'inter milan': ['Internazionale', 'Inter'],
  'ac milan': ['Milan'],
  'bayern munich': ['FC Bayern Munich', 'Bayern München'],
  'red bull salzburg': ['RB Salzburg'],
  'borussia monchengladbach': ['Borussia Mönchengladbach', 'Borussia Gladbach'],
  'sporting cp': ['Sporting Lisbon'],
  'athletic club': ['Athletic Bilbao'],
  'real sociedad': ['Real Sociedad San Sebastian'],
  'copenhagen': ['FC Copenhagen', 'FC København'],
  'red star belgrade': ['Crvena Zvezda'],
  'shakhtar donetsk': ['Shakhtar Donetsk'],
  'dynamo kyiv': ['Dynamo Kiev'],
  'fcsb': ['Steaua Bucharest'],
  'slavia prague': ['Slavia Praha'],
  'sparta prague': ['Sparta Praha'],
  'viktoria plzen': ['Viktoria Plzeň']
});

let cacheLoaded = false;
let cache = {};
let saveTimer = null;
const inflight = new Map();
const sportsDbStarts = [];
let sportsDbQueue = Promise.resolve();

export function normalizeClubLogoKey(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
}

function loadCache() {
  if (cacheLoaded) return;
  cacheLoaded = true;
  try {
    const parsed = JSON.parse(globalThis.localStorage?.getItem(CACHE_KEY) || '{}');
    cache = parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    cache = {};
  }
}

function persistCacheSoon() {
  if (!globalThis.localStorage || saveTimer) return;
  saveTimer = globalThis.setTimeout(() => {
    saveTimer = null;
    try { globalThis.localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch {}
  }, 250);
}

function cacheKey(club) {
  return [normalizeClubLogoKey(club?.name), normalizeClubLogoKey(club?.country), normalizeClubLogoKey(club?.league)].join('|');
}

function readCached(club) {
  loadCache();
  const entry = cache[cacheKey(club)];
  if (!entry || Number(entry.expiresAt) <= Date.now()) return null;
  return entry;
}

function writeCached(club, value) {
  loadCache();
  cache[cacheKey(club)] = {
    ...value,
    expiresAt: Date.now() + (value.url ? POSITIVE_TTL : NEGATIVE_TTL)
  };
  persistCacheSoon();
}

function queryNames(club) {
  const normalized = normalizeClubLogoKey(club?.name);
  const aliases = NAME_ALIASES[normalized] || [];
  const stripped = String(club?.name || '')
    .replace(/\b(football club|futebol clube|fútbol club|soccer club)\b/gi, '')
    .replace(/\b(fc|afc|cf|sc|ac|fk|sk|sv|vfb|vfl|as|us|ssc|ss|cd|sd|rc|ks|nk|if|bk)\b/gi, '')
    .replace(/\s+/g, ' ').trim();
  return [...new Set([club?.name, ...aliases, stripped].filter(Boolean))].slice(0, 3);
}

function countryNames(club) {
  return [club?.country, ...(COUNTRY_ALIASES[club?.country] || [])]
    .map(normalizeClubLogoKey).filter(Boolean);
}

export function scoreSportsDbTeam(team, club) {
  if (!team || normalizeClubLogoKey(team.strSport) !== 'soccer') return -1000;
  const target = normalizeClubLogoKey(club?.name);
  const teamName = normalizeClubLogoKey(team.strTeam);
  const alternate = normalizeClubLogoKey(team.strAlternate);
  const shortName = normalizeClubLogoKey(team.strTeamShort);
  const aliases = new Set([target, ...(NAME_ALIASES[target] || []).map(normalizeClubLogoKey)]);
  let score = 0;
  if (teamName === target) score += 130;
  else if (aliases.has(teamName)) score += 118;
  else if (teamName.includes(target) || target.includes(teamName)) score += 72;
  if (alternate && [...aliases].some(alias => alternate.includes(alias))) score += 45;
  if (shortName && aliases.has(shortName)) score += 32;
  const countries = countryNames(club);
  const teamCountry = normalizeClubLogoKey(team.strCountry);
  if (countries.includes(teamCountry)) score += 34;
  else if (teamCountry) score -= 18;
  const league = normalizeClubLogoKey(club?.league);
  const teamLeague = normalizeClubLogoKey(team.strLeague);
  if (league && teamLeague && (league.includes(teamLeague) || teamLeague.includes(league))) score += 18;
  if (typeof team.strBadge === 'string' && /^https:\/\//i.test(team.strBadge)) score += 22;
  return score;
}

export function chooseSportsDbLogo(teams, club) {
  const ranked = (Array.isArray(teams) ? teams : [])
    .map(team => ({ team, score: scoreSportsDbTeam(team, club) }))
    .filter(row => row.score >= 70 && /^https:\/\//i.test(row.team?.strBadge || ''))
    .sort((left, right) => right.score - left.score);
  const match = ranked[0]?.team;
  if (!match) return null;
  const base = String(match.strBadge).replace(/\/(tiny|small|medium)$/i, '');
  return {
    url: `${base}/small`,
    source: 'TheSportsDB',
    providerId: match.idTeam || null,
    resolvedName: match.strTeam || club?.name || ''
  };
}

function logoFilenameLooksOfficial(value) {
  return /(logo|crest|badge|emblem|escudo|coat[_ -]?of[_ -]?arms)/i.test(String(value || ''));
}

async function fetchJson(url, timeout = 8_000) {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal, mode: 'cors', credentials: 'omit' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    globalThis.clearTimeout(timer);
  }
}

function wait(ms) {
  return new Promise(resolve => globalThis.setTimeout(resolve, Math.max(0, ms)));
}

async function rateLimitedSportsDbFetch(url) {
  let release;
  const previous = sportsDbQueue;
  sportsDbQueue = new Promise(resolve => { release = resolve; });
  await previous;
  try {
    const now = Date.now();
    while (sportsDbStarts.length && now - sportsDbStarts[0] >= SPORTS_DB_WINDOW_MS) sportsDbStarts.shift();
    if (sportsDbStarts.length >= MAX_SPORTS_DB_REQUESTS_PER_MINUTE) {
      await wait(SPORTS_DB_WINDOW_MS - (Date.now() - sportsDbStarts[0]) + 150);
      const refreshed = Date.now();
      while (sportsDbStarts.length && refreshed - sportsDbStarts[0] >= SPORTS_DB_WINDOW_MS) sportsDbStarts.shift();
    }
    sportsDbStarts.push(Date.now());
  } finally {
    release();
  }
  return fetchJson(url);
}

async function sportsDbLogo(club) {
  for (const name of queryNames(club)) {
    const url = `${SPORTS_DB_SEARCH}?t=${encodeURIComponent(name)}`;
    try {
      const data = await rateLimitedSportsDbFetch(url);
      const logo = chooseSportsDbLogo(data?.teams, club);
      if (logo) return logo;
    } catch {}
  }
  return null;
}

function wikipediaScore(page, club) {
  if (!page?.thumbnail?.source || !logoFilenameLooksOfficial(page.pageimage)) return -1000;
  const title = normalizeClubLogoKey(page.title);
  const target = normalizeClubLogoKey(club?.name);
  let score = 50;
  if (title === target) score += 90;
  else if (title.includes(target) || target.includes(title)) score += 45;
  if (/football|futebol|futbol|soccer|fc|afc|cf/.test(title)) score += 18;
  return score;
}

async function wikipediaLogo(club) {
  const query = `${club?.name || ''} football club`;
  const params = new URLSearchParams({
    origin: '*', action: 'query', format: 'json', generator: 'search',
    gsrsearch: query, gsrnamespace: '0', gsrlimit: '5',
    prop: 'pageimages', piprop: 'thumbnail|name', pithumbsize: '256', pilicense: 'any'
  });
  try {
    const data = await fetchJson(`${WIKIPEDIA_API}?${params}`);
    const pages = Object.values(data?.query?.pages || {})
      .map(page => ({ page, score: wikipediaScore(page, club) }))
      .filter(row => row.score >= 70)
      .sort((left, right) => right.score - left.score);
    const match = pages[0]?.page;
    if (!match) return null;
    return {
      url: match.thumbnail.source,
      source: 'Wikipedia PageImages',
      providerId: String(match.pageid || ''),
      resolvedName: match.title || club?.name || ''
    };
  } catch {
    return null;
  }
}

export async function resolveOfficialClubLogo(club) {
  if (!club?.name) return null;
  const cached = readCached(club);
  if (cached) return cached.url ? cached : null;
  const key = cacheKey(club);
  if (inflight.has(key)) return inflight.get(key);
  const task = (async () => {
    const found = await sportsDbLogo(club) || await wikipediaLogo(club);
    writeCached(club, found || { url: null, source: 'unresolved', providerId: null, resolvedName: club.name });
    return found;
  })().finally(() => inflight.delete(key));
  inflight.set(key, task);
  return task;
}

export function clearOfficialClubLogoCache() {
  cache = {};
  cacheLoaded = true;
  try { globalThis.localStorage?.removeItem(CACHE_KEY); } catch {}
}

export const OFFICIAL_CLUB_LOGO_META = Object.freeze({
  primaryProvider: 'TheSportsDB',
  fallbackProvider: 'Wikipedia PageImages',
  networkMode: 'lazy-visible-only',
  cacheDays: 30,
  sportsDbRequestsPerMinute: MAX_SPORTS_DB_REQUESTS_PER_MINUTE
});

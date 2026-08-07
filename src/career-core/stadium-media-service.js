import { normalizeClubLogoKey, scoreSportsDbTeam } from './official-club-logo-service.js';

const SPORTS_DB_SEARCH = 'https://www.thesportsdb.com/api/v1/json/123/searchteams.php';
const WIKIPEDIA_API = 'https://en.wikipedia.org/w/api.php';
const CACHE_KEY = 'touchline.club-stadium-media.v1';
const POSITIVE_TTL = 1000 * 60 * 60 * 24 * 45;
const NEGATIVE_TTL = 1000 * 60 * 60 * 6;
const REQUEST_TIMEOUT = 8_000;
const inflight = new Map();
let cacheLoaded = false;
let cache = {};
let saveTimer = null;

const STADIUM_ALIASES = Object.freeze({
  'manchester united': ['Old Trafford'],
  arsenal: ['Emirates Stadium'],
  'aston villa': ['Villa Park'],
  'afc bournemouth': ['Vitality Stadium'],
  brentford: ['Gtech Community Stadium'],
  'brighton and hove albion': ['Falmer Stadium', 'American Express Stadium'],
  chelsea: ['Stamford Bridge'],
  'coventry city': ['Coventry Building Society Arena'],
  'crystal palace': ['Selhurst Park'],
  everton: ['Hill Dickinson Stadium'],
  fulham: ['Craven Cottage'],
  'hull city': ['MKM Stadium'],
  'ipswich town': ['Portman Road'],
  'leeds united': ['Elland Road'],
  liverpool: ['Anfield'],
  'manchester city': ['Etihad Stadium'],
  'newcastle united': ["St James' Park", 'St James Park'],
  'nottingham forest': ['City Ground'],
  sunderland: ['Stadium of Light'],
  'tottenham hotspur': ['Tottenham Hotspur Stadium'],
  rosenborg: ['Lerkendal Stadion', 'Lerkendal Stadium']
});

function normalize(value) {
  return normalizeClubLogoKey(value);
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
  }, 200);
}

function cacheKey(club) {
  return [normalize(club?.name), normalize(club?.country), normalize(club?.league)].join('|');
}

export function cachedClubStadiumMedia(club) {
  loadCache();
  const entry = cache[cacheKey(club)];
  if (!entry || Number(entry.expiresAt) <= Date.now()) return null;
  return entry.url ? entry : null;
}

function writeCached(club, value) {
  loadCache();
  cache[cacheKey(club)] = {
    ...value,
    expiresAt: Date.now() + (value?.url ? POSITIVE_TTL : NEGATIVE_TTL)
  };
  persistCacheSoon();
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  try {
    const response = await fetch(url, { signal: controller.signal, mode: 'cors', credentials: 'omit' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    globalThis.clearTimeout(timer);
  }
}

function queryNames(club) {
  const normalized = normalize(club?.name);
  const aliases = STADIUM_ALIASES[normalized] || [];
  const stripped = String(club?.name || '')
    .replace(/\b(football club|futebol clube|fútbol club|soccer club)\b/gi, '')
    .replace(/\b(fc|afc|cf|sc|ac|fk|sk|sv|vfb|vfl|as|us|ssc|ss|cd|sd|rc|ks|nk|if|bk)\b/gi, '')
    .replace(/\s+/g, ' ').trim();
  return [...new Set([club?.name, club?.shortName, stripped, ...aliases].filter(Boolean))].slice(0, 5);
}

function validHttpImage(value) {
  return typeof value === 'string' && /^https:\/\//i.test(value);
}

export function chooseSportsDbStadium(teams, club) {
  const ranked = (Array.isArray(teams) ? teams : [])
    .map(team => {
      let score = scoreSportsDbTeam(team, club);
      if (validHttpImage(team?.strStadiumThumb)) score += 36;
      if (String(team?.strStadium || '').trim()) score += 14;
      return { team, score };
    })
    .filter(row => row.score >= 76)
    .sort((left, right) => right.score - left.score);
  const match = ranked[0]?.team;
  if (!match) return null;
  return {
    url: validHttpImage(match.strStadiumThumb) ? match.strStadiumThumb : null,
    stadiumName: String(match.strStadium || '').trim() || null,
    source: 'TheSportsDB',
    providerId: match.idTeam || null,
    resolvedName: match.strTeam || club?.name || ''
  };
}

async function sportsDbStadium(club) {
  for (const name of queryNames(club)) {
    try {
      const data = await fetchJson(`${SPORTS_DB_SEARCH}?t=${encodeURIComponent(name)}`);
      const found = chooseSportsDbStadium(data?.teams, club);
      if (found) return found;
    } catch {}
  }
  return null;
}

function filenameLooksLikeLogo(value) {
  return /(logo|crest|badge|emblem|escudo|coat[_ -]?of[_ -]?arms)/i.test(String(value || ''));
}

function stadiumTokens(club, stadiumName) {
  const names = [stadiumName, club?.stadium, ...(STADIUM_ALIASES[normalize(club?.name)] || [])].filter(Boolean);
  return [...new Set(names.flatMap(name => normalize(name).split(' ')).filter(token => token.length >= 4))];
}

function wikipediaStadiumScore(page, club, stadiumName) {
  if (!page?.thumbnail?.source || filenameLooksLikeLogo(page.pageimage)) return -1000;
  const title = normalize(page.title);
  const tokens = stadiumTokens(club, stadiumName);
  let score = 0;
  if (/stadium|stadion|stadionet|arena|park|ground|trafford|anfield|lerkendal/.test(title)) score += 34;
  score += tokens.filter(token => title.includes(token)).length * 18;
  const exactNames = [stadiumName, club?.stadium, ...(STADIUM_ALIASES[normalize(club?.name)] || [])].filter(Boolean).map(normalize);
  if (exactNames.some(name => name && (title === name || title.includes(name) || name.includes(title)))) score += 82;
  const clubName = normalize(club?.name);
  if (clubName && title.includes(clubName)) score += 22;
  return score;
}

async function wikipediaStadium(club, stadiumName = null) {
  const queries = [
    stadiumName,
    club?.stadium,
    ...(STADIUM_ALIASES[normalize(club?.name)] || []),
    `${club?.name || ''} stadium`
  ].filter(Boolean);

  for (const query of [...new Set(queries)]) {
    const params = new URLSearchParams({
      origin: '*', action: 'query', format: 'json', generator: 'search',
      gsrsearch: query, gsrnamespace: '0', gsrlimit: '6',
      prop: 'pageimages|info', inprop: 'url', piprop: 'thumbnail|name', pithumbsize: '1400', pilicense: 'any'
    });
    try {
      const data = await fetchJson(`${WIKIPEDIA_API}?${params}`);
      const ranked = Object.values(data?.query?.pages || {})
        .map(page => ({ page, score: wikipediaStadiumScore(page, club, stadiumName) }))
        .filter(row => row.score >= 52)
        .sort((left, right) => right.score - left.score);
      const match = ranked[0]?.page;
      if (match?.thumbnail?.source) {
        return {
          url: match.thumbnail.source,
          stadiumName: stadiumName || club?.stadium || match.title,
          source: 'Wikipedia PageImages',
          providerId: String(match.pageid || ''),
          resolvedName: match.title || stadiumName || club?.name || ''
        };
      }
    } catch {}
  }
  return null;
}

export async function resolveClubStadiumMedia(club, { bypassCache = false, preferWikipedia = false } = {}) {
  if (!club?.name) return null;
  if (!bypassCache) {
    const cached = cachedClubStadiumMedia(club);
    if (cached) return cached;
  }

  const key = `${cacheKey(club)}|${preferWikipedia ? 'wiki' : 'default'}`;
  if (inflight.has(key)) return inflight.get(key);

  const task = (async () => {
    const sports = preferWikipedia ? null : await sportsDbStadium(club);
    const found = sports?.url
      ? sports
      : await wikipediaStadium(club, sports?.stadiumName || club?.stadium || null)
        || (preferWikipedia ? await sportsDbStadium(club) : null);
    writeCached(club, found || { url: null, source: 'unresolved', providerId: null, resolvedName: club.name });
    return found;
  })().finally(() => inflight.delete(key));

  inflight.set(key, task);
  return task;
}

export function clearClubStadiumMediaCache() {
  cache = {};
  cacheLoaded = true;
  try { globalThis.localStorage?.removeItem(CACHE_KEY); } catch {}
}

export const STADIUM_MEDIA_META = Object.freeze({
  primaryProvider: 'TheSportsDB strStadiumThumb',
  fallbackProvider: 'Wikipedia PageImages',
  cacheDays: 45,
  invariant: 'fixture.home owns match background'
});

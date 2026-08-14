import { CLUB_BY_CODE, FIXTURES } from './season-2026-27-live.js';
import {
  EUROPEAN_CLUBS,
  EUROPEAN_CLUB_BY_ID,
  EUROPEAN_CLUB_BY_CODE,
  findEuropeanClub
} from './european-club-catalog.js';

const DAY_MS = 86_400_000;
const DEFAULT_TIME = '19:30';
const FRIENDLY_WINDOW_END_MONTH_DAY = '08-20';

const OFFICIAL_2026_ROWS = Object.freeze([
  ['2026-07-25','ARS','MK Dons'],['2026-08-01','ARS','Girona'],['2026-08-05','ARS','Real Betis'],['2026-08-09','ARS','Borussia Dortmund'],
  ['2026-07-21','Walsall','AVL'],['2026-07-25','Porto','AVL'],['2026-07-28','AVL','Real Sociedad'],['2026-08-01','Indonesia All-Stars','AVL'],['2026-08-04','BG Pathum United','AVL'],['2026-08-07','Bayern Munich','AVL'],['2026-08-15','Borussia Mönchengladbach','AVL'],
  ['2026-07-24','St. Pauli','BOU'],['2026-07-30','BOU','Augsburg'],['2026-08-04','Genoa','BOU'],['2026-08-08','Real Betis','BOU'],
  ['2026-07-15','BRE','AFC Wimbledon'],['2026-08-05','BRE','Wycombe Wanderers'],['2026-08-08','Rennes','BRE'],['2026-08-15','BRE','Eintracht Frankfurt'],
  ['2026-07-18','BHA','Wycombe Wanderers'],['2026-08-01','BHA','Strasbourg'],['2026-08-08','BHA','Roma'],['2026-08-15','BHA','Bologna'],
  ['2026-07-28','Western Sydney Wanderers','CHE'],['2026-08-01','CHE','TOT'],['2026-08-05','CHE','Juventus'],['2026-08-08','CHE','AC Milan'],['2026-08-09','Johor Darul Ta’zim','CHE'],['2026-08-15','CHE','Real Sociedad'],
  ['2026-07-11','AFC Wimbledon','COV'],['2026-07-18','Northampton Town','COV'],['2026-08-01','Leicester City','COV'],['2026-08-04','West Bromwich Albion','COV'],['2026-08-08','COV','Espanyol'],['2026-08-14','COV','Monaco'],
  ['2026-07-18','CRY','Swindon Town'],['2026-07-25','Bromley','CRY'],['2026-07-28','Famalicão','CRY'],['2026-08-07','FUL','CRY'],
  ['2026-07-18','Dundee FC','EVE'],['2026-07-25','Bolton Wanderers','EVE'],['2026-07-28','Stoke City','EVE'],['2026-08-01','Hamburg','EVE'],['2026-08-08','VfB Stuttgart','EVE'],['2026-08-12','EVE','NEW'],
  ['2026-07-25','FUL','Norwich City'],['2026-07-28','Al-Ahli','FUL'],['2026-07-31','SC Farense','FUL'],['2026-08-12','Málaga','FUL'],['2026-08-15','FUL','VfB Stuttgart'],
  ['2026-07-25','Konyaspor','HUL'],['2026-07-28','Çaykur Rizespor','HUL'],['2026-08-01','HUL','Kasımpaşa'],['2026-08-08','Eintracht Frankfurt','HUL'],['2026-08-15','HUL','Nice'],
  ['2026-07-29','IPS','Osasuna'],['2026-08-01','Oxford United','IPS'],['2026-08-04','IPS','Le Havre'],['2026-08-08','IPS','Rayo Vallecano'],['2026-08-15','Union Berlin','IPS'],
  ['2026-07-25','LEE','Wrexham'],['2026-07-30','LEE','SUN'],['2026-08-02','LIV','LEE'],['2026-08-08','LEE','RB Leipzig'],['2026-08-12','LEE','MUN'],
  ['2026-07-25','LIV','SUN'],['2026-07-29','LIV','Wrexham'],['2026-08-09','LIV','Monaco'],['2026-08-16','LIV','Como'],
  ['2026-08-01','MCI','Inter Milan'],['2026-08-05','K-League All-Stars','MCI'],['2026-08-09','MCI','Atlético Madrid'],
  ['2026-07-18','MUN','Wrexham'],['2026-07-24','Rosenborg','MUN'],['2026-08-01','MUN','Atlético Madrid'],['2026-08-08','MUN','Paris Saint-Germain'],['2026-08-15','MUN','AC Milan'],
  ['2026-07-18','NEW','Darlington'],['2026-07-25','Gateshead','NEW'],['2026-07-29','NEW','Bristol City'],['2026-08-08','Valencia','NEW'],['2026-08-15','NEW','Bayer Leverkusen'],['2026-08-16','NEW','Strasbourg'],
  ['2026-07-18','Notts County','NFO'],['2026-07-22','NFO','Blackburn Rovers'],['2026-07-26','Vitória de Guimarães','NFO'],['2026-07-31','Sporting CP','NFO'],['2026-08-08','Udinese','NFO'],['2026-08-12','NFO','Bayer Leverkusen'],['2026-08-16','NFO','Brest'],
  ['2026-07-18','York City','SUN'],['2026-08-02','SUN','Wrexham'],['2026-08-08','Lens','SUN'],['2026-08-15','SUN','Rennes'],
  ['2026-07-22','TOT','MK Dons'],['2026-07-26','Auckland FC','TOT'],['2026-07-29','TOT','Sydney FC'],['2026-08-08','TOT','Getafe'],['2026-08-15','TOT','Hoffenheim']
]);

function hashString(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function randomFor(seed) {
  let state = hashString(seed) || 0x9e3779b9;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function slug(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function isoDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  return Math.round(Math.abs(new Date(`${a}T00:00:00Z`) - new Date(`${b}T00:00:00Z`)) / DAY_MS);
}

function exactCatalogClub(name) {
  const normalized = slug(name);
  return EUROPEAN_CLUBS.find(club => slug(club.name) === normalized) || null;
}

function registerExternal(index, name) {
  const catalog = exactCatalogClub(name);
  if (catalog) return catalog.id;
  const id = `world-${slug(name)}`;
  if (!index[id]) {
    index[id] = {
      id,
      code: null,
      name,
      shortName: name,
      countryCode: 'INT',
      country: 'Internacional',
      league: 'Outros clubes',
      division: 1,
      rating: 72 + hashString(name) % 10,
      reputation: 2 + hashString(`${name}:rep`) % 4,
      color: '#69a7bf',
      internal: false
    };
  }
  return id;
}

function clubRef(index, value) {
  if (CLUB_BY_CODE.has(value)) return value;
  const catalog = findEuropeanClub(value) || exactCatalogClub(value);
  if (catalog) return catalog.id;
  return registerExternal(index, value);
}

function normalizeFixture(fixture) {
  return {
    id: String(fixture.id),
    fixtureType: 'friendly',
    competition: 'Friendly',
    date: String(fixture.date),
    time: fixture.time || DEFAULT_TIME,
    home: String(fixture.home),
    away: String(fixture.away),
    venue: fixture.venue || 'neutral',
    rules: fixture.rules || '90-minutes',
    source: fixture.source || 'generated',
    locked: Boolean(fixture.locked),
    status: fixture.status || 'scheduled'
  };
}

function fixtureKey(date, home, away) {
  return `${date}:${[home, away].sort().join(':')}`;
}

function officialFixtures(index) {
  const occupied = new Set();
  const seen = new Set();
  const fixtures = [];
  for (const [date, homeName, awayName] of OFFICIAL_2026_ROWS) {
    const home = clubRef(index, homeName);
    const away = clubRef(index, awayName);
    const pair = fixtureKey(date, home, away);
    if (seen.has(pair) || occupied.has(`${date}:${home}`) || occupied.has(`${date}:${away}`)) continue;
    seen.add(pair);
    occupied.add(`${date}:${home}`);
    occupied.add(`${date}:${away}`);
    fixtures.push(normalizeFixture({
      id: `friendly-official-${date}-${slug(home)}-${slug(away)}`,
      date, home, away, venue: CLUB_BY_CODE.has(home) ? 'home' : CLUB_BY_CODE.has(away) ? 'away' : 'neutral',
      source: 'official-2026-preseason'
    }));
  }
  return fixtures;
}

function generatedWorldFixtures(index, career) {
  const year = Number(String(career.seasonLabel || '2026/27').slice(0, 4)) || 2026;
  const random = randomFor(`${career.saveId}:${career.createdAt}:${career.seasonId}:friendly-world`);
  const candidates = EUROPEAN_CLUBS.filter(club => !club.internal && club.division <= 2);
  const occupied = new Set();
  const fixtures = [];
  const dates = [];
  for (let day = 4; day <= 31; day += 3) dates.push(`${year}-07-${String(day).padStart(2, '0')}`);
  for (let day = 2; day <= 17; day += 3) dates.push(`${year}-08-${String(day).padStart(2, '0')}`);

  for (const date of dates) {
    const shuffled = [...candidates].sort(() => random() - 0.5).slice(0, 24);
    while (shuffled.length > 1 && fixtures.length < 96) {
      const home = shuffled.pop();
      const away = shuffled.pop();
      if (!home || !away || home.countryCode === away.countryCode && random() < 0.35) continue;
      if (occupied.has(`${date}:${home.id}`) || occupied.has(`${date}:${away.id}`)) continue;
      occupied.add(`${date}:${home.id}`);
      occupied.add(`${date}:${away.id}`);
      fixtures.push(normalizeFixture({
        id: `friendly-world-${date}-${slug(home.id)}-${slug(away.id)}`,
        date, home: home.id, away: away.id, venue: random() > 0.2 ? 'home' : 'neutral', source: 'living-world'
      }));
      index[home.id] ||= home;
      index[away.id] ||= away;
    }
  }
  return fixtures;
}

function resultsFor(career) {
  career.friendlyResults ||= {};
  career.worldFriendlyResults ||= {};
}

export function ensureFriendlyWorld(career) {
  career.friendlyClubIndex ||= {};
  resultsFor(career);
  if (!Array.isArray(career.friendlies) || !Array.isArray(career.worldFriendlies)) {
    const year = Number(String(career.seasonLabel || '2026/27').slice(0, 4)) || 2026;
    const seedFixtures = year === 2026 ? officialFixtures(career.friendlyClubIndex) : [];
    const generated = generatedWorldFixtures(career.friendlyClubIndex, career);
    const combined = [...seedFixtures, ...generated];
    career.friendlies = combined.filter(fixture => fixture.home === career.clubCode || fixture.away === career.clubCode);
    career.worldFriendlies = combined.filter(fixture => fixture.home !== career.clubCode && fixture.away !== career.clubCode);
  } else {
    career.friendlies = career.friendlies.map(normalizeFixture);
    career.worldFriendlies = career.worldFriendlies.map(normalizeFixture);
  }
  career.friendlySeed ||= hashString(`${career.saveId}:${career.createdAt}:${career.seasonId}`);
  return career;
}

export function resolveFriendlyClub(career, reference) {
  const key = String(reference || '');
  const internal = CLUB_BY_CODE.get(key);
  if (internal) return { ...internal, id: internal.code, internal: true, rating: Math.round((internal.elo || 1750) / 24) };
  const catalog = EUROPEAN_CLUB_BY_ID.get(key) || EUROPEAN_CLUB_BY_CODE.get(key);
  if (catalog) return catalog;
  return career?.friendlyClubIndex?.[key] || {
    id: key,
    name: key.replace(/^world-/, '').replace(/-/g, ' '),
    shortName: key,
    country: 'Internacional', countryCode: 'INT', league: 'Outros clubes', division: 1,
    rating: 70, reputation: 2, color: '#69a7bf', internal: false
  };
}

export function friendlyResultFor(career, fixture) {
  return fixture?.fixtureType === 'friendly'
    ? career?.friendlyResults?.[fixture.id] || career?.worldFriendlyResults?.[fixture.id] || null
    : career?.results?.[fixture?.id] || null;
}

export function userFriendlyFixtures(career) {
  ensureFriendlyWorld(career);
  return career.friendlies;
}

export function combinedUserFixtures(career, leagueFixtures = FIXTURES) {
  ensureFriendlyWorld(career);
  return [...leagueFixtures.filter(fixture => fixture.home === career.clubCode || fixture.away === career.clubCode), ...career.friendlies]
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.time).localeCompare(String(b.time)));
}

export function allFixturesOnDate(career, date) {
  ensureFriendlyWorld(career);
  return [
    ...FIXTURES.filter(fixture => fixture.date === date),
    ...career.friendlies.filter(fixture => fixture.date === date),
    ...career.worldFriendlies.filter(fixture => fixture.date === date)
  ];
}

export function friendlyDateStatus(career, date, opponentId = null) {
  ensureFriendlyWorld(career);
  const reasons = [];
  const target = String(date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(target)) reasons.push('Data inválida.');
  if (target < career.currentDate) reasons.push('A data já passou.');
  const seasonYear = Number(String(career.seasonLabel || '2026/27').slice(0, 4)) || 2026;
  if (target < `${seasonYear}-07-01` || target > `${seasonYear}-${FRIENDLY_WINDOW_END_MONTH_DAY}`) {
    reasons.push('Amistosos de pré-temporada devem ficar entre 1 de julho e 20 de agosto.');
  }
  const dateFixtures = allFixturesOnDate(career, target);
  if (dateFixtures.some(fixture => fixture.home === career.clubCode || fixture.away === career.clubCode)) {
    reasons.push('Seu clube já tem uma partida nesta data.');
  }
  if (opponentId && dateFixtures.some(fixture => fixture.home === opponentId || fixture.away === opponentId)) {
    reasons.push('O adversário já tem uma partida nesta data.');
  }
  const nearbyUser = combinedUserFixtures(career).filter(fixture => daysBetween(fixture.date, target) < 3);
  const warning = nearbyUser.length ? 'Intervalo inferior a três dias: maior fadiga e menor chance de aceite.' : '';
  return { available: reasons.length === 0, reasons, warning };
}

export function friendlyQuote(career, opponentId, venue = 'home') {
  const opponent = resolveFriendlyClub(career, opponentId);
  const reputation = Number(opponent.reputation) || 2;
  const fee = Math.round((35_000 + reputation * reputation * 38_000) / 5_000) * 5_000;
  const income = venue === 'home'
    ? Math.round((80_000 + reputation * reputation * 72_000) / 5_000) * 5_000
    : venue === 'neutral'
      ? Math.round((55_000 + reputation * 44_000) / 5_000) * 5_000
      : Math.round((20_000 + reputation * 18_000) / 5_000) * 5_000;
  const travel = venue === 'away' ? 45_000 + reputation * 8_000 : venue === 'neutral' ? 28_000 : 0;
  return { fee, income, travel, net: income - fee - travel };
}

export function scheduleFriendly(career, { date, opponentId, venue = 'home', time = DEFAULT_TIME, rules = '90-minutes' }) {
  ensureFriendlyWorld(career);
  const opponent = resolveFriendlyClub(career, opponentId);
  if (!opponent?.id || opponent.id === career.clubCode) throw new Error('Escolha um adversário válido.');
  const status = friendlyDateStatus(career, date, opponent.id);
  if (!status.available) throw new Error(status.reasons[0]);
  const home = venue === 'away' ? opponent.id : career.clubCode;
  const away = venue === 'away' ? career.clubCode : opponent.id;
  const fixture = normalizeFixture({
    id: `friendly-user-${date}-${slug(career.clubCode)}-${slug(opponent.id)}-${Date.now().toString(36)}`,
    date, time, home, away, venue, rules, source: 'manager-arranged'
  });
  career.friendlies.push(fixture);
  career.friendlies.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  career.inbox ||= [];
  career.inbox.unshift({
    id: `friendly-confirmed-${fixture.id}`,
    date: career.currentDate,
    sender: 'Secretaria de Futebol',
    subject: `Amistoso confirmado contra ${opponent.name}`,
    body: `${date}, ${time}. Local: ${venue === 'home' ? 'casa' : venue === 'away' ? 'fora' : 'neutro'}. A agenda dos dois clubes foi bloqueada para evitar conflito.`,
    read: false
  });
  return fixture;
}

export function cancelFriendly(career, fixtureId) {
  ensureFriendlyWorld(career);
  const index = career.friendlies.findIndex(fixture => fixture.id === fixtureId);
  if (index < 0) throw new Error('Amistoso não encontrado.');
  const fixture = career.friendlies[index];
  if (fixture.date < career.currentDate || career.friendlyResults[fixture.id]) throw new Error('Este amistoso não pode mais ser cancelado.');
  career.friendlies.splice(index, 1);
  const opponentId = fixture.home === career.clubCode ? fixture.away : fixture.home;
  const opponent = resolveFriendlyClub(career, opponentId);
  career.inbox ||= [];
  career.inbox.unshift({
    id: `friendly-cancelled-${fixture.id}`,
    date: career.currentDate,
    sender: 'Secretaria de Futebol',
    subject: `Amistoso cancelado: ${opponent.name}`,
    body: `A partida de ${fixture.date} foi retirada do calendário e ambos os clubes voltaram a ficar disponíveis.`,
    read: false
  });
  return fixture;
}

export function recordFriendlyResult(career, result, world = false) {
  resultsFor(career);
  const store = world ? career.worldFriendlyResults : career.friendlyResults;
  if (!store[result.fixtureId]) store[result.fixtureId] = result;
  return result;
}

export function isFriendlyFixture(fixture) {
  return fixture?.fixtureType === 'friendly' || fixture?.competition === 'Friendly';
}

export function nextCombinedUserFixture(career) {
  return combinedUserFixtures(career).find(fixture => !friendlyResultFor(career, fixture)) || null;
}

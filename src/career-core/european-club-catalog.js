import {
  EUROPEAN_CLUBS as BASE_CLUBS,
  EUROPE_COUNTRIES as BASE_COUNTRIES
} from './european-club-catalog-base.js';
import { EXTRA_EUROPE_COUNTRIES } from './european-club-catalog-extra.js';

const SOURCE_SEASON = '2025/26';

function slug(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function rowToClub(countryCode, countryName, color, leagueName, division, name, index) {
  const strengthBase = division === 1 ? 77 : division === 2 ? 69 : 63;
  const rating = Math.max(56, strengthBase - Math.floor(index / 4));
  return Object.freeze({
    id: `${countryCode.toLowerCase()}-${division}-${slug(name)}`,
    code: null,
    name,
    shortName: name,
    countryCode,
    country: countryName,
    league: leagueName,
    division,
    rating,
    reputation: Math.max(1, Math.min(5, Math.round((rating - 53) / 7))),
    color,
    sourceSeason: SOURCE_SEASON,
    internal: false
  });
}

const EXTRA_COUNTRIES = EXTRA_EUROPE_COUNTRIES.map(([code, name, color, leagues]) => Object.freeze({
  code,
  name,
  color,
  divisions: Object.freeze(leagues.map(([league, division]) => Object.freeze({ league, division })))
}));

const EXTRA_CLUBS = EXTRA_EUROPE_COUNTRIES.flatMap(([countryCode, country, color, leagues]) =>
  leagues.flatMap(([league, division, rows]) => rows.map((name, index) =>
    rowToClub(countryCode, country, color, league, division, name, index)
  ))
);

export const EUROPE_COUNTRIES = Object.freeze([...BASE_COUNTRIES, ...EXTRA_COUNTRIES]);
export const EUROPEAN_CLUBS = Object.freeze([...BASE_CLUBS, ...EXTRA_CLUBS]);
export const EUROPEAN_CLUB_BY_ID = new Map(EUROPEAN_CLUBS.map(club => [club.id, club]));
export const EUROPEAN_CLUB_BY_CODE = new Map(EUROPEAN_CLUBS.filter(club => club.code).map(club => [club.code, club]));

export function clubsByCountry(countryCode) {
  return EUROPEAN_CLUBS.filter(club => club.countryCode === countryCode);
}

export function clubsByCountryDivision(countryCode, division) {
  return EUROPEAN_CLUBS.filter(club => club.countryCode === countryCode && club.division === Number(division));
}

export function findEuropeanClub(value) {
  const key = String(value || '');
  return EUROPEAN_CLUB_BY_ID.get(key) || EUROPEAN_CLUB_BY_CODE.get(key) || null;
}

export const EUROPEAN_CATALOG_META = Object.freeze({
  source: 'OpenFootball-compatible offline seed',
  sourceSeason: SOURCE_SEASON,
  countries: EUROPE_COUNTRIES.length,
  clubs: EUROPEAN_CLUBS.length,
  runtimeNetworkRequired: false
});

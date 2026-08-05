export * from './season-2026-27.js';

import rosterPayload from './fotmob-rosters.local.json' with { type: 'json' };
import {
  CLUB_BY_CODE,
  rosterRowsFor as provisionalRosterRowsFor
} from './season-2026-27.js';

const LIVE_ROSTERS = Object.freeze(rosterPayload?.rosters || {});

export const ROSTER_SOURCE = 'FOTMOB_OFFICIAL_FULL_SQUADS';
export const RATING_SOURCE = 'EA_SPORTS_FC_26_OFFICIAL_WHEN_AVAILABLE';
export const LIVE_ROSTER_META = Object.freeze(rosterPayload?.meta || {});

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function rowName(row) {
  return Array.isArray(row) ? row[0] : row?.name;
}

function rowGroup(row) {
  return Array.isArray(row) ? row[1] : row?.group;
}

export function rosterRowsFor(clubCode) {
  const rows = LIVE_ROSTERS[clubCode];
  if (!Array.isArray(rows) || !rows.length) return provisionalRosterRowsFor(clubCode);
  const manager = normalize(CLUB_BY_CODE.get(clubCode)?.manager);
  return rows.filter(row => {
    const group = String(rowGroup(row) || '').toUpperCase();
    const name = normalize(rowName(row));
    return group !== 'COACH' && group !== 'MANAGER' && name && name !== manager;
  });
}

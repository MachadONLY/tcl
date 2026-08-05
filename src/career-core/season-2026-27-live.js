export * from './season-2026-27.js';

import rosterPayload from './fotmob-rosters.local.json' with { type: 'json' };
import {
  rosterRowsFor as provisionalRosterRowsFor
} from './season-2026-27.js';

const LIVE_ROSTERS = Object.freeze(rosterPayload?.rosters || {});

export const ROSTER_SOURCE = 'FOTMOB_OFFICIAL_FULL_SQUADS';
export const LIVE_ROSTER_META = Object.freeze(rosterPayload?.meta || {});

export function rosterRowsFor(clubCode) {
  const rows = LIVE_ROSTERS[clubCode];
  return Array.isArray(rows) && rows.length
    ? rows
    : provisionalRosterRowsFor(clubCode);
}

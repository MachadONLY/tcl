export * from './season-2026-27.js';

import {
  rosterRowsFor as provisionalRosterRowsFor
} from './season-2026-27.js';
import {
  FOTMOB_ROSTERS,
  FOTMOB_ROSTER_META
} from './fotmob-rosters.generated.js';

export const ROSTER_SOURCE = 'FOTMOB_OFFICIAL_FULL_SQUADS';
export const LIVE_ROSTER_META = FOTMOB_ROSTER_META;

export function rosterRowsFor(clubCode) {
  const rows = FOTMOB_ROSTERS[clubCode];
  return Array.isArray(rows) && rows.length
    ? rows
    : provisionalRosterRowsFor(clubCode);
}

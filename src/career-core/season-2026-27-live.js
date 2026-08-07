export * from './season-2026-27.js';

import rosterPayload from './fotmob-rosters.local.json' with { type: 'json' };
import {
  CLUB_BY_CODE,
  rosterRowsFor as provisionalRosterRowsFor
} from './season-2026-27.js';
import { sanitizeRosterRows } from './roster-integrity.js';

const LIVE_ROSTERS = Object.freeze(rosterPayload?.rosters || {});

export const ROSTER_SOURCE = 'FOTMOB_OFFICIAL_FULL_SQUADS';
export const RATING_SOURCE = 'EA_SPORTS_FC_26_OFFICIAL_WHEN_AVAILABLE';
export const LIVE_ROSTER_META = Object.freeze(rosterPayload?.meta || {});

function coachNameFromMeta(clubCode) {
  const coach = rosterPayload?.meta?.coaches?.[clubCode];
  if (typeof coach === 'string') return coach;
  return coach?.name || null;
}

export function rosterRowsFor(clubCode) {
  const liveRows = LIVE_ROSTERS[clubCode];
  const rows = Array.isArray(liveRows) && liveRows.length
    ? liveRows
    : provisionalRosterRowsFor(clubCode);

  return sanitizeRosterRows(rows, {
    managerNames: [
      CLUB_BY_CODE.get(clubCode)?.manager,
      coachNameFromMeta(clubCode)
    ].filter(Boolean)
  });
}

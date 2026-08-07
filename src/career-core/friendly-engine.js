import * as Base from './friendly-engine-base.js';

export {
  friendlyQuote,
  friendlyResultFor,
  isFriendlyFixture,
  recordFriendlyResult,
  resolveFriendlyClub
} from './friendly-engine-base.js';

const SOURCE_PRIORITY = Object.freeze({
  'manager-arranged': 0,
  'official-2026-preseason': 1,
  'living-world': 2,
  generated: 3
});

function priority(fixture) {
  return SOURCE_PRIORITY[fixture?.source] ?? 4;
}

function removeGlobalDoubleBookings(career) {
  const indexed = [...(career.friendlies || []), ...(career.worldFriendlies || [])]
    .map((fixture, index) => ({ fixture, index }))
    .sort((left, right) =>
      priority(left.fixture) - priority(right.fixture)
      || left.fixture.date.localeCompare(right.fixture.date)
      || left.index - right.index
    );
  const occupied = new Set();
  const accepted = [];

  for (const { fixture } of indexed) {
    const homeKey = `${fixture.date}:${fixture.home}`;
    const awayKey = `${fixture.date}:${fixture.away}`;
    if (occupied.has(homeKey) || occupied.has(awayKey)) continue;
    occupied.add(homeKey);
    occupied.add(awayKey);
    accepted.push(fixture);
  }

  accepted.sort((left, right) => left.date.localeCompare(right.date) || String(left.time).localeCompare(String(right.time)));
  career.friendlies = accepted.filter(fixture => fixture.home === career.clubCode || fixture.away === career.clubCode);
  career.worldFriendlies = accepted.filter(fixture => fixture.home !== career.clubCode && fixture.away !== career.clubCode);
  return career;
}

export function ensureFriendlyWorld(career) {
  Base.ensureFriendlyWorld(career);
  return removeGlobalDoubleBookings(career);
}

export function userFriendlyFixtures(career) {
  ensureFriendlyWorld(career);
  return Base.userFriendlyFixtures(career);
}

export function combinedUserFixtures(career, leagueFixtures) {
  ensureFriendlyWorld(career);
  return Base.combinedUserFixtures(career, leagueFixtures);
}

export function allFixturesOnDate(career, date) {
  ensureFriendlyWorld(career);
  return Base.allFixturesOnDate(career, date);
}

export function friendlyDateStatus(career, date, opponentId = null) {
  ensureFriendlyWorld(career);
  return Base.friendlyDateStatus(career, date, opponentId);
}

export function scheduleFriendly(career, options) {
  ensureFriendlyWorld(career);
  const fixture = Base.scheduleFriendly(career, options);
  removeGlobalDoubleBookings(career);
  return fixture;
}

export function cancelFriendly(career, fixtureId) {
  ensureFriendlyWorld(career);
  return Base.cancelFriendly(career, fixtureId);
}

export function nextCombinedUserFixture(career) {
  ensureFriendlyWorld(career);
  return Base.nextCombinedUserFixture(career);
}

import { PLAYER_BY_ID, deriveTable } from './career-core.js';
import { FIXTURES } from './season-2026-27-live.js';
import { canonicalResults, playerStatsFromResults } from './result-integrity.js';

function canonicalCareer(career) {
  return { ...(career || {}), results: canonicalResults(career) };
}

function playedResults(career, clubCode) {
  return Object.values(canonicalResults(career))
    .filter(result => result.home === clubCode || result.away === clubCode)
    .sort((left, right) =>
      String(left.date || '').localeCompare(String(right.date || '')) ||
      Number(left.matchweek || 0) - Number(right.matchweek || 0)
    );
}

export function clubForm(career, clubCode, limit = 5) {
  return playedResults(career, clubCode)
    .slice(-Math.max(1, Number(limit) || 5))
    .map(result => {
      const home = result.home === clubCode;
      const scored = home ? result.homeGoals : result.awayGoals;
      const conceded = home ? result.awayGoals : result.homeGoals;
      return scored > conceded ? 'W' : scored < conceded ? 'L' : 'D';
    });
}

export function nextClubFixture(career, clubCode) {
  const results = canonicalResults(career);
  return FIXTURES.find(fixture =>
    !results[fixture.id] && (fixture.home === clubCode || fixture.away === clubCode)
  ) || null;
}

export function leagueLeaders(career, metric = 'goals', limit = 30) {
  const primary = metric === 'assists' ? 'assists' : 'goals';
  const secondary = primary === 'goals' ? 'assists' : 'goals';
  const maximum = Math.max(1, Number(limit) || 30);
  const statsByPlayer = playerStatsFromResults(career);

  return Object.entries(statsByPlayer)
    .map(([id, stats = {}]) => ({
      player: PLAYER_BY_ID.get(id),
      appearances: Number(stats.appearances || 0),
      goals: Number(stats.goals || 0),
      assists: Number(stats.assists || 0),
      penaltyGoals: Number(stats.penaltyGoals || 0)
    }))
    .filter(row => row.player && row[primary] > 0)
    .sort((left, right) =>
      right[primary] - left[primary] ||
      right[secondary] - left[secondary] ||
      right.appearances - left.appearances ||
      left.player.name.localeCompare(right.player.name, 'pt-BR')
    )
    .slice(0, maximum);
}

export function standingsRows(career) {
  const canonical = canonicalCareer(career);
  return deriveTable(canonical).map(row => ({
    ...row,
    form: clubForm(canonical, row.code),
    nextFixture: nextClubFixture(canonical, row.code)
  }));
}

export function leagueProgress(career) {
  const canonical = canonicalCareer(career);
  const table = deriveTable(canonical);
  const club = table.find(row => row.code === career?.clubCode);
  const leagueMatches = Object.keys(canonical.results).length;
  const tableMatchTotal = table.reduce((sum, row) => sum + row.played, 0) / 2;
  return {
    clubPlayed: Number(club?.played || 0),
    clubTotal: 38,
    leagueMatches,
    leagueTotal: FIXTURES.length,
    tableMatchTotal
  };
}

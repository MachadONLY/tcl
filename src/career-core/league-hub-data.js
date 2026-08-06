import { PLAYER_BY_ID, deriveTable } from './career-core.js';
import { FIXTURES } from './season-2026-27-live.js';

function playedResults(career, clubCode) {
  return Object.values(career?.results || {})
    .filter(result => result?.home === clubCode || result?.away === clubCode)
    .sort((left, right) =>
      String(left.date || '').localeCompare(String(right.date || '')) ||
      Number(left.matchweek || 0) - Number(right.matchweek || 0)
    );
}

function penaltyGoalsByPlayer(career) {
  const totals = new Map();
  for (const result of Object.values(career?.results || {})) {
    for (const event of result?.events || []) {
      const penalty = event?.isPenalty === true || event?.penalty === true || event?.goalType === 'penalty';
      if (!penalty || !event.playerId) continue;
      totals.set(event.playerId, (totals.get(event.playerId) || 0) + 1);
    }
  }
  return totals;
}

export function clubForm(career, clubCode, limit = 5) {
  return playedResults(career, clubCode)
    .slice(-Math.max(1, Number(limit) || 5))
    .map(result => {
      const home = result.home === clubCode;
      const scored = home ? Number(result.homeGoals || 0) : Number(result.awayGoals || 0);
      const conceded = home ? Number(result.awayGoals || 0) : Number(result.homeGoals || 0);
      return scored > conceded ? 'W' : scored < conceded ? 'L' : 'D';
    });
}

export function nextClubFixture(career, clubCode) {
  return FIXTURES.find(fixture =>
    !career?.results?.[fixture.id] && (fixture.home === clubCode || fixture.away === clubCode)
  ) || null;
}

export function leagueLeaders(career, metric = 'goals', limit = 30) {
  const primary = metric === 'assists' ? 'assists' : 'goals';
  const secondary = primary === 'goals' ? 'assists' : 'goals';
  const maximum = Math.max(1, Number(limit) || 30);
  const derivedPenaltyGoals = penaltyGoalsByPlayer(career);

  return Object.entries(career?.playerStats || {})
    .map(([id, stats = {}]) => ({
      player: PLAYER_BY_ID.get(id),
      appearances: Number(stats.appearances || 0),
      goals: Number(stats.goals || 0),
      assists: Number(stats.assists || 0),
      penaltyGoals: Math.max(
        Number(stats.penaltyGoals || 0),
        Number(derivedPenaltyGoals.get(id) || 0)
      )
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
  return deriveTable(career).map(row => ({
    ...row,
    form: clubForm(career, row.code),
    nextFixture: nextClubFixture(career, row.code)
  }));
}

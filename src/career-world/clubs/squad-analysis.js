const GROUPS = ['GK', 'DEF', 'MID', 'FWD'];
const TARGETS = Object.freeze({
  GK: { min: 2, target: 3, max: 4, starters: 1 },
  DEF: { min: 7, target: 9, max: 11, starters: 4 },
  MID: { min: 7, target: 9, max: 12, starters: 4 },
  FWD: { min: 4, target: 5, max: 7, starters: 2 }
});
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export function expectedStarterRating(elo = 1750) {
  return clamp(Math.round(72 + (Number(elo) - 1600) / 34), 70, 87);
}

export function evaluateClubSquad({ clubCode, players = [], clubState = {} }) {
  const expected = expectedStarterRating(clubState.elo);
  const needs = [];
  const groups = Object.fromEntries(GROUPS.map(group => [group, players.filter(player => player.group === group)]));

  for (const group of GROUPS) {
    const target = TARGETS[group];
    const groupPlayers = groups[group].sort((left, right) => right.rating - left.rating);
    const top = groupPlayers.slice(0, target.starters);
    const topAverage = average(top.map(player => Number(player.rating) || 0));
    const groupAverageAge = average(groupPlayers.map(player => Number(player.age) || 24));
    const shortage = Math.max(0, target.target - groupPlayers.length);
    const severeShortage = Math.max(0, target.min - groupPlayers.length);
    const qualityGap = Math.max(0, expected - topAverage);
    const ageing = Math.max(0, groupAverageAge - (group === 'GK' ? 31.5 : 29.0));
    const priority = clamp(
      severeShortage * 0.34 + shortage * 0.12 + qualityGap * 0.055 + ageing * 0.045,
      0,
      1
    );
    if (priority >= 0.18) {
      needs.push({
        group,
        priority: +priority.toFixed(3),
        currentCount: groupPlayers.length,
        targetCount: target.target,
        targetRating: expected,
        preferredAgeMin: 18,
        preferredAgeMax: group === 'GK' ? 32 : Number(clubState.policy?.preferredAgeMax) || 28,
        reason: severeShortage ? 'squad-shortage' : qualityGap >= 3 ? 'quality-gap' : ageing > 1 ? 'age-profile' : 'depth'
      });
    }
  }

  return {
    clubCode,
    squadSize: players.length,
    expectedStarterRating: expected,
    groups,
    needs: needs.sort((left, right) => right.priority - left.priority)
  };
}

export function surplusCandidates({ players = [], clubState = {}, playerStatus = {} }) {
  const expected = expectedStarterRating(clubState.elo);
  const rows = [];
  for (const group of GROUPS) {
    const target = TARGETS[group];
    const groupPlayers = players.filter(player => player.group === group)
      .sort((left, right) => right.rating - left.rating);
    const overage = Math.max(0, groupPlayers.length - target.max);
    for (let index = 0; index < groupPlayers.length; index += 1) {
      const player = groupPlayers[index];
      const status = playerStatus[player.id] || {};
      if (status.squadRole === 'key' || status.squadRole === 'important') continue;
      if (player.age <= 21 && player.potential >= player.rating + 3) continue;
      const clearlyBelowLevel = player.rating <= expected - 7 && player.age >= 24;
      const surplusByDepth = overage > 0 && index >= groupPlayers.length - overage;
      if (clearlyBelowLevel || surplusByDepth) {
        rows.push({ player, reason: surplusByDepth ? 'position-surplus' : 'below-squad-level' });
      }
    }
  }
  return rows.sort((left, right) => left.player.rating - right.player.rating || right.player.age - left.player.age);
}

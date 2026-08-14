import { tacticalRoleFor } from './club-brain.js';

const GROUPS = ['GK', 'DEF', 'MID', 'FWD'];
const TARGETS = Object.freeze({
  GK: { min: 2, target: 3, max: 4, starters: 1 },
  DEF: { min: 7, target: 9, max: 11, starters: 4 },
  MID: { min: 7, target: 9, max: 12, starters: 4 },
  FWD: { min: 4, target: 5, max: 7, starters: 2 }
});
const POSITION_TARGETS = Object.freeze({
  GK: { group: 'GK', min: 2, target: 3, starters: 1 },
  CB: { group: 'DEF', min: 3, target: 4, starters: 2 },
  FB: { group: 'DEF', min: 3, target: 4, starters: 2 },
  DM: { group: 'MID', min: 1, target: 2, starters: 1 },
  CM: { group: 'MID', min: 2, target: 4, starters: 2 },
  W: { group: 'MID', min: 2, target: 4, starters: 2 },
  ST: { group: 'FWD', min: 2, target: 3, starters: 1 }
});
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const average = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export function positionBucket(player) {
  if (player?.group === 'GK') return 'GK';
  const raw = String(player?.position || '').toUpperCase().replace(/\s+/g, '');
  const positions = raw.split(/[,/|;-]+/).filter(Boolean);
  if (positions.some(position => /^(CB|LCB|RCB)$/.test(position))) return 'CB';
  if (positions.some(position => /^(LB|RB|LWB|RWB|WB)$/.test(position))) return 'FB';
  if (positions.some(position => /^(DM|CDM|DMC)$/.test(position))) return 'DM';
  if (positions.some(position => /^(LW|RW|LM|RM|AML|AMR)$/.test(position))) return 'W';
  if (positions.some(position => /^(ST|CF|SS)$/.test(position))) return 'ST';
  if (player?.group === 'DEF') return 'CB';
  if (player?.group === 'FWD') return 'ST';
  return 'CM';
}

export function expectedStarterRating(elo = 1750) {
  return clamp(Math.round(72 + (Number(elo) - 1600) / 34), 70, 87);
}

function expectedPositionRating(base, bucket) {
  if (bucket === 'GK') return base;
  if (bucket === 'DM' || bucket === 'FB') return Math.max(68, base - 1);
  return base;
}

function playingTimeFor(priority, shortage) {
  if (shortage >= 2 || priority >= .78) return 'regular-starter';
  if (priority >= .58) return 'important-player';
  if (priority >= .36) return 'squad-player';
  return 'prospect-or-depth';
}

function transferTypes(clubBrain, priority) {
  const loanUsage = Number(clubBrain?.recruitment?.loanUsage) || .5;
  if (priority < .48 && loanUsage >= .62) return ['loan', 'transfer'];
  return ['transfer', 'loan'];
}

function buildRequirement({ bucket, players, expected, clubState }) {
  const target = POSITION_TARGETS[bucket];
  const sorted = [...players].sort((left, right) => (right.rating || 0) - (left.rating || 0));
  const top = sorted.slice(0, target.starters);
  const topAverage = average(top.map(player => Number(player.rating) || 0));
  const averageAge = average(sorted.map(player => Number(player.age) || 24));
  const shortage = Math.max(0, target.target - sorted.length);
  const severeShortage = Math.max(0, target.min - sorted.length);
  const desiredRating = expectedPositionRating(expected, bucket);
  const qualityGap = Math.max(0, desiredRating - topAverage);
  const ageThreshold = bucket === 'GK' ? 32.5 : bucket === 'CB' ? 30.5 : 29;
  const ageing = Math.max(0, averageAge - ageThreshold);
  const brain = clubState.brain;
  const youthBias = Number(brain?.recruitment?.youthBias) || .65;
  const priority = clamp(
    severeShortage * .37 + shortage * .13 + qualityGap * .055 + ageing * .04 + (sorted.length === 0 ? .28 : 0),
    0,
    1
  );
  if (priority < .16) return null;
  const preferredAgeMax = bucket === 'GK'
    ? Math.max(30, Number(brain?.recruitment?.preferredAgeMax) || 29)
    : Number(brain?.recruitment?.preferredAgeMax) || 28;
  return {
    group: target.group,
    position: bucket,
    role: tacticalRoleFor(brain, bucket),
    priority: +priority.toFixed(3),
    currentCount: sorted.length,
    targetCount: target.target,
    targetRating: desiredRating,
    expectedPlayingTime: playingTimeFor(priority, shortage),
    transferTypes: transferTypes(brain, priority),
    preferredAgeMin: youthBias >= .88 ? 17 : 18,
    preferredAgeMax,
    attributePriorities: [...(brain?.tacticalIdentity?.attributePriorities || [])],
    reason: severeShortage ? 'position-shortage' : qualityGap >= 3 ? 'quality-gap' : ageing > 1 ? 'age-profile' : 'depth'
  };
}

export function evaluateClubSquad({ clubCode, players = [], clubState = {} }) {
  const expected = expectedStarterRating(clubState.elo);
  const groups = Object.fromEntries(GROUPS.map(group => [group, players.filter(player => player.group === group)]));
  const positions = Object.fromEntries(Object.keys(POSITION_TARGETS).map(bucket => [
    bucket,
    players.filter(player => positionBucket(player) === bucket)
  ]));
  const requirements = Object.entries(positions)
    .map(([bucket, bucketPlayers]) => buildRequirement({ bucket, players: bucketPlayers, expected, clubState }))
    .filter(Boolean)
    .sort((left, right) => right.priority - left.priority || left.position.localeCompare(right.position));

  const legacyNeeds = [];
  for (const group of GROUPS) {
    const target = TARGETS[group];
    const groupPlayers = groups[group].sort((left, right) => right.rating - left.rating);
    const top = groupPlayers.slice(0, target.starters);
    const topAverage = average(top.map(player => Number(player.rating) || 0));
    const groupAverageAge = average(groupPlayers.map(player => Number(player.age) || 24));
    const shortage = Math.max(0, target.target - groupPlayers.length);
    const severeShortage = Math.max(0, target.min - groupPlayers.length);
    const qualityGap = Math.max(0, expected - topAverage);
    const ageing = Math.max(0, groupAverageAge - (group === 'GK' ? 31.5 : 29));
    const priority = clamp(severeShortage * .34 + shortage * .12 + qualityGap * .055 + ageing * .045, 0, 1);
    if (priority >= .18) legacyNeeds.push({
      group,
      priority: +priority.toFixed(3),
      currentCount: groupPlayers.length,
      targetCount: target.target,
      targetRating: expected,
      preferredAgeMin: 18,
      preferredAgeMax: group === 'GK' ? 32 : Number(clubState.brain?.recruitment?.preferredAgeMax || clubState.policy?.preferredAgeMax) || 28,
      reason: severeShortage ? 'squad-shortage' : qualityGap >= 3 ? 'quality-gap' : ageing > 1 ? 'age-profile' : 'depth'
    });
  }

  return {
    clubCode,
    squadSize: players.length,
    expectedStarterRating: expected,
    groups,
    positions,
    requirements,
    needs: requirements.length ? requirements : legacyNeeds.sort((left, right) => right.priority - left.priority)
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
      if (clearlyBelowLevel || surplusByDepth) rows.push({ player, reason: surplusByDepth ? 'position-surplus' : 'below-squad-level' });
    }
  }
  return rows.sort((left, right) => left.player.rating - right.player.rating || right.player.age - left.player.age);
}

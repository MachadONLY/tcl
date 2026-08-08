import { randomUnit } from '../deterministic-rng.js';
import { positionBucket } from '../clubs/squad-analysis.js';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function requirementFor(analysis, rumor) {
  const rows = analysis?.requirements?.length ? analysis.requirements : analysis?.needs || [];
  return rows.find(need => {
    if (rumor.position && need.position) return need.position === rumor.position;
    return need.group === rumor.group;
  }) || null;
}

function acquisitionCeiling(club) {
  const elo = Number(club?.elo) || 1600;
  const starBias = Number(club?.brain?.recruitment?.starBias) || .45;
  return clamp(72 + (elo - 1600) / 36 + starBias * 5, 68, 91);
}

export function findRumorCompetitors({ world, date, leadRumor, player, squadAnalyses, userClubCode }) {
  if (!leadRumor || !player) return [];
  const rows = [];
  for (const [clubCode, analysis] of Object.entries(squadAnalyses || {})) {
    if (clubCode === userClubCode || clubCode === leadRumor.buyerCode) continue;
    const club = world.clubs?.[clubCode];
    if (!club) continue;
    const need = requirementFor(analysis, leadRumor);
    if (!need || Number(need.priority) < .24) continue;
    const budget = Number(club.transferBudget) || 0;
    const marketValue = Number(leadRumor.marketValueSnapshot) || Number(player.value) || 0;
    if (marketValue > 0 && budget < marketValue * .62) continue;
    const rating = Number(player.rating) || 70;
    const youthException = Number(player.age) <= 21 && Number(player.potential || rating) >= rating + 4 ? 2.5 : 0;
    if (rating > acquisitionCeiling(club) + youthException) continue;
    const samePosition = need.position && leadRumor.position ? need.position === leadRumor.position : need.group === leadRumor.group;
    if (!samePosition) continue;
    const existing = (world.transferMarket?.rumors || []).some(rumor => rumor.status === 'active' && rumor.buyerCode === clubCode && rumor.playerId === player.id);
    if (existing) continue;
    const budgetComfort = marketValue > 0 ? clamp(1 - marketValue / Math.max(1, budget), 0, 1) : .7;
    const starFit = rating >= 82 ? Number(club.brain?.recruitment?.starBias) || .45 : .55;
    const youthFit = Number(player.age) <= 23 ? Number(club.brain?.recruitment?.youthBias) || .55 : .5;
    const noise = randomUnit(world.seed, date, clubCode, player.id, 'rumor-competition') * .08;
    const score = Number(need.priority) * .42 + budgetComfort * .20 + starFit * .15 + youthFit * .10 + noise;
    rows.push({ clubCode, need, score });
  }
  return rows.sort((left, right) => right.score - left.score || left.clubCode.localeCompare(right.clubCode)).slice(0, 4);
}

export function rebuildCompetitionIndex(world) {
  const index = {};
  for (const rumor of world.transferMarket?.rumors || []) {
    if (rumor.status !== 'active') continue;
    const bucket = index[rumor.playerId] ||= { playerId: rumor.playerId, clubs: [], heat: 0 };
    if (!bucket.clubs.includes(rumor.buyerCode)) bucket.clubs.push(rumor.buyerCode);
    bucket.heat = Math.max(bucket.heat, Number(rumor.heat) || 0);
  }
  for (const bucket of Object.values(index)) bucket.clubs.sort();
  world.transferMarket.competition = index;
  return index;
}

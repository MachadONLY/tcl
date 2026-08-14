import { randomUnit } from '../deterministic-rng.js';
import { daysBetween } from '../world-time.js';
import { createPlayerBrain } from '../transfers/player-brain.js';
import { buildAgentContractDemands } from './agent-engine.js';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const round = value => +Number(value).toFixed(3);
const roundWage = value => Math.max(500, Math.round(Number(value || 0) / 500) * 500);

export function contractRiskBand(contract, date) {
  if (!contract?.endDate) return { band: 'unknown', daysRemaining: 9999 };
  const daysRemaining = daysBetween(date, contract.endDate);
  if (daysRemaining < 0 || contract.status === 'expired') return { band: 'expired', daysRemaining };
  if (daysRemaining <= 183) return { band: 'bosman', daysRemaining };
  if (daysRemaining <= 365) return { band: 'critical', daysRemaining };
  if (daysRemaining <= 548) return { band: 'renewal-window', daysRemaining };
  if (daysRemaining <= 730) return { band: 'monitor', daysRemaining };
  return { band: 'secure', daysRemaining };
}

function roleValue(role) {
  return { key: 1, important: .84, rotation: .62, prospect: .58, fringe: .30 }[role] || .55;
}

function externalInterestCount(world, playerId) {
  const rumors = (world.transferMarket?.rumors || []).filter(row => row.playerId === playerId && row.status === 'active').length;
  const negotiations = Object.values(world.transferMarket?.negotiations || {}).filter(row => row.playerId === playerId && !['completed', 'rejected', 'withdrawn', 'expired'].includes(row.status)).length;
  return rumors + negotiations;
}

export function evaluateRenewalCase({ world, date, player, club, contract = {}, status = {} }) {
  const risk = contractRiskBand(contract, date);
  const brain = createPlayerBrain(player);
  const role = status.squadRole || 'rotation';
  const importance = roleValue(role);
  const age = Number(player?.age) || 24;
  const rating = Number(player?.rating) || 70;
  const potential = Math.max(rating, Number(player?.potential) || rating);
  const externalInterest = externalInterestCount(world, player?.id);
  const happiness = clamp((Number(status.happiness) || 70) / 100, 0, 1);
  const recruitment = club?.brain?.recruitment || {};
  const youthBias = Number(recruitment.youthBias) || .65;
  const resaleBias = Number(recruitment.resaleBias) || .60;
  const wageDiscipline = Number(recruitment.wageDiscipline) || .70;
  const starBias = Number(recruitment.starBias) || .55;
  const ageFit = age <= 24 ? youthBias : age >= 31 ? starBias * .52 + (1 - wageDiscipline) * .18 : .72;
  const potentialValue = age <= 24 ? clamp(.48 + Math.max(0, potential - rating) * .055, .48, 1) : .55;
  const qualityValue = clamp(.42 + (rating - 68) * .025, .28, 1);
  const contractUrgency = risk.band === 'bosman' ? 1 : risk.band === 'critical' ? .86 : risk.band === 'renewal-window' ? .62 : risk.band === 'monitor' ? .34 : .08;
  const clubVariation = (randomUnit(world.seed, date, club?.code || 'club', player?.id || 'player', 'renewal-club-intent') - .5) * .08;
  const clubIntent = clamp(
    importance * .30
      + qualityValue * .22
      + potentialValue * .12
      + ageFit * .12
      + contractUrgency * .18
      + resaleBias * (age <= 28 ? .08 : .02)
      + clubVariation,
    0,
    1
  );

  const roleSecurity = importance;
  const outsidePressure = clamp(externalInterest * .09, 0, .36);
  const playerVariation = (randomUnit(world.seed, date, player?.id || 'player', club?.code || 'club', 'renewal-player-willingness') - .5) * .10;
  const playerWillingness = clamp(
    .26
      + happiness * .24
      + brain.loyalty * .18
      + roleSecurity * (.10 + brain.playingTimeNeed * .08)
      + brain.stability * .10
      - brain.ambition * outsidePressure
      - brain.bigClubDrive * outsidePressure * .35
      + playerVariation,
    .04,
    .98
  );

  const demands = buildAgentContractDemands({ world, date, player, contract, status, club, externalInterest, context: 'renewal' });
  let action = 'monitor';
  const reasons = [];
  if (risk.band === 'secure') action = 'secure';
  else if (clubIntent >= .58 && playerWillingness >= .44) action = 'renew';
  else if (risk.daysRemaining <= 365 && clubIntent < .46) action = 'sell';
  else if (risk.daysRemaining <= 183 && playerWillingness < .40) action = 'allow-expiry';
  else if (clubIntent >= .54) action = 'renew';
  else action = 'monitor';

  if (risk.daysRemaining <= 365) reasons.push('CONTRACT_EXPIRY_RISK');
  if (importance >= .84) reasons.push('CORE_PLAYER_RETENTION');
  if (age <= 23 && potential >= rating + 3) reasons.push('YOUTH_ASSET_PROTECTION');
  if (externalInterest > 0) reasons.push('EXTERNAL_INTEREST');
  if (happiness < .55) reasons.push('PLAYER_UNHAPPY');
  if (clubIntent < .46 && risk.daysRemaining <= 365) reasons.push('SALE_BEFORE_EXPIRY');

  return Object.freeze({
    risk,
    action,
    clubIntent: round(clubIntent),
    playerWillingness: round(playerWillingness),
    externalInterest,
    demands,
    reasons: Object.freeze(reasons)
  });
}

export function buildRenewalOffer({ world, date, player, club, status = {}, evaluation }) {
  const demands = evaluation.demands;
  const discipline = Number(club?.brain?.recruitment?.wageDiscipline) || .70;
  const importance = roleValue(status.squadRole || 'rotation');
  const flexibility = .91 + (1 - discipline) * .10 + importance * .035 + randomUnit(world.seed, date, club?.code || 'club', player?.id || 'player', 'renewal-offer') * .045;
  const weeklyWage = roundWage(demands.minimumWeeklyWage * flexibility);
  const preferred = Number(demands.preferredYears) || 3;
  const age = Number(player?.age) || 24;
  const years = clamp(age >= 33 ? Math.min(2, preferred) : preferred, 1, 5);
  return Object.freeze({
    weeklyWage,
    years,
    playingTime: demands.requiredPlayingTime,
    signingBonus: demands.signingBonus,
    agentFee: demands.agentFee
  });
}

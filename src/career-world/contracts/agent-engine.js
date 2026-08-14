import { randomUnit } from '../deterministic-rng.js';
import { createPlayerBrain } from '../transfers/player-brain.js';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const round = value => +Number(value).toFixed(3);
const roundWage = value => Math.max(500, Math.round(Number(value || 0) / 500) * 500);
const roundMoney = value => Math.max(0, Math.round(Number(value || 0) / 25_000) * 25_000);

function trait(player, salt, center = .5, spread = .62) {
  return clamp(center + (randomUnit(player?.id || player?.name || 'player', 'agent', salt) - .5) * spread, .05, .95);
}

export function createAgentProfile(player) {
  const brain = createPlayerBrain(player);
  const elite = Number(player?.rating) >= 84;
  return Object.freeze({
    schemaVersion: 1,
    playerId: player?.id || null,
    assertiveness: round(trait(player, 'assertiveness', elite ? .66 : .52, .58)),
    patience: round(trait(player, 'patience', .54, .62)),
    feeDrive: round(trait(player, 'fee-drive', elite ? .70 : .50, .58)),
    mobilityDrive: round(clamp(trait(player, 'mobility', .48, .68) * .72 + brain.ambition * .28, .05, .95)),
    confidentiality: round(trait(player, 'confidentiality', .55, .72)),
    clientLeverage: round(clamp(.32 + brain.agentInfluence * .45 + (elite ? .16 : 0), .18, .94))
  });
}

function roleWeight(role) {
  return {
    key: 1.20,
    important: 1.12,
    rotation: 1.00,
    prospect: .88,
    fringe: .82
  }[role] || 1;
}

function expectedPlayingTime(role) {
  return role === 'key' ? 'star-player'
    : role === 'important' ? 'important-player'
      : role === 'rotation' ? 'squad-player'
        : 'prospect-or-depth';
}

export function buildAgentContractDemands({ world, date, player, contract = {}, status = {}, club = {}, externalInterest = 0, context = 'renewal' }) {
  const agent = createAgentProfile(player);
  const brain = createPlayerBrain(player);
  const currentWage = Math.max(1_000, Number(contract.weeklyWage) || Number(player?.wage) || 8_000);
  const rating = Number(player?.rating) || 70;
  const age = Number(player?.age) || 24;
  const happiness = clamp((Number(status.happiness) || 70) / 100, 0, 1);
  const role = status.squadRole || 'rotation';
  const abilityPremium = clamp(1 + Math.max(0, rating - 72) * .012, 1, 1.30);
  const rolePremium = roleWeight(role);
  const leveragePremium = 1 + agent.clientLeverage * .10 + Math.min(.18, Number(externalInterest || 0) * .045);
  const unhappinessPremium = happiness < .58 ? 1 + (.58 - happiness) * .20 : 1;
  const renewalDiscount = context === 'renewal' ? 1 - brain.loyalty * .035 : 1;
  const saveVariation = world
    ? .97 + randomUnit(world.seed, date || world.currentDate || 'date', player?.id || 'player', club?.code || 'club', context, 'agent-demand') * .08
    : 1;
  const minimumWeeklyWage = roundWage(currentWage * abilityPremium * rolePremium * leveragePremium * unhappinessPremium * renewalDiscount * saveVariation);

  let preferredYears = age <= 21 ? 5 : age <= 26 ? 4 : age <= 29 ? 3 : age <= 32 ? 2 : 1;
  if (brain.stability > .72 && age <= 29) preferredYears += 1;
  if (brain.ambition > .78 && externalInterest > 0) preferredYears = Math.max(2, preferredYears - 1);
  preferredYears = clamp(preferredYears, 1, 5);

  const annualWage = minimumWeeklyWage * 52;
  const signingBonus = roundMoney(annualWage * (.06 + agent.feeDrive * .10 + agent.assertiveness * .035));
  const agentFee = roundMoney(annualWage * (.015 + agent.feeDrive * .045 + agent.clientLeverage * .025));
  const requiredPlayingTime = expectedPlayingTime(role);

  return Object.freeze({
    schemaVersion: 1,
    minimumWeeklyWage,
    preferredYears,
    requiredPlayingTime,
    signingBonus,
    agentFee,
    agent,
    leverage: round(clamp(.25 + agent.clientLeverage * .42 + Math.min(.2, Number(externalInterest || 0) * .05) + (1 - happiness) * .12, .18, .96))
  });
}

function playingTimeScore(required, offered) {
  const ranks = { 'prospect-or-depth': 1, 'squad-player': 2, 'important-player': 3, 'regular-starter': 4, 'star-player': 5 };
  const requiredRank = ranks[required] || 2;
  const offeredRank = ranks[offered] || 2;
  return clamp(.58 + (offeredRank - requiredRank) * .16, .12, 1);
}

export function assessAgentOffer({ world, date, player, demands, offer, status = {}, club = {}, externalInterest = 0 }) {
  const brain = createPlayerBrain(player);
  const wageScore = clamp(Number(offer?.weeklyWage || 0) / Math.max(1, Number(demands?.minimumWeeklyWage || 1)), 0, 1.25);
  const yearsDelta = Math.abs(Number(offer?.years || 0) - Number(demands?.preferredYears || 0));
  const yearsScore = clamp(1 - yearsDelta * .14, .35, 1);
  const roleScore = playingTimeScore(demands?.requiredPlayingTime, offer?.playingTime);
  const happiness = clamp((Number(status.happiness) || 70) / 100, 0, 1);
  const externalPressure = clamp(Number(externalInterest || 0) * .06, 0, .28);
  const variation = world ? (randomUnit(world.seed, date, player?.id, club?.code, 'agent-offer-assessment') - .5) * .08 : 0;
  const score = clamp(
    wageScore * .38
      + yearsScore * .10
      + roleScore * (.16 + brain.playingTimeNeed * .08)
      + happiness * .16
      + brain.loyalty * .08
      - brain.ambition * externalPressure
      + variation,
    0,
    1.15
  );
  return {
    accepted: score >= .64 && wageScore >= .90 && roleScore >= .42,
    score: round(score),
    components: Object.freeze({ wageScore: round(wageScore), yearsScore: round(yearsScore), roleScore: round(roleScore), happiness: round(happiness), externalPressure: round(externalPressure), variation: round(variation) })
  };
}

import { randomUnit } from '../deterministic-rng.js';
import { contractYearsRemaining } from './valuation-engine.js';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const round = value => +Number(value).toFixed(3);

function trait(player, salt, center = .5, spread = .72) {
  return clamp(center + (randomUnit(player?.id || player?.name || 'player', salt) - .5) * spread, .05, .95);
}

export function createPlayerBrain(player) {
  const age = Number(player?.age) || 24;
  const rating = Number(player?.rating) || 70;
  const potential = Math.max(rating, Number(player?.potential) || rating);
  const prospect = age <= 22 && potential >= rating + 3;
  const veteran = age >= 31;
  return Object.freeze({
    schemaVersion: 1,
    playerId: player?.id || null,
    careerStage: prospect ? 'prospect' : veteran ? 'veteran' : age <= 27 ? 'prime-growth' : 'prime-late',
    ambition: round(trait(player, 'ambition', prospect ? .66 : rating >= 82 ? .70 : .56, .54)),
    loyalty: round(trait(player, 'loyalty', .58, .64)),
    financialDrive: round(trait(player, 'financial-drive', veteran ? .66 : .50, .62)),
    playingTimeNeed: round(trait(player, 'playing-time', prospect ? .76 : .60, .58)),
    developmentDrive: round(trait(player, 'development', prospect ? .82 : veteran ? .24 : .54, .50)),
    bigClubDrive: round(trait(player, 'big-club', rating >= 82 ? .76 : .56, .54)),
    stability: round(trait(player, 'stability', veteran ? .68 : .52, .62)),
    adaptability: round(trait(player, 'adaptability', .56, .68)),
    agentInfluence: round(trait(player, 'agent-influence', rating >= 84 ? .66 : .48, .58))
  });
}

function promisedRoleScore(expectedPlayingTime) {
  return { 'star-player': 1, 'regular-starter': .92, 'important-player': .82, 'squad-player': .58, 'prospect-or-depth': .40 }[expectedPlayingTime] || .56;
}

export function evaluateMoveAppeal({ world = null, date = null, player, status = {}, contract = {}, buyerClub = {}, sellerClub = {}, need = {} }) {
  const brain = createPlayerBrain(player);
  const buyerElo = Number(buyerClub?.elo) || 1550;
  const sellerElo = Number(sellerClub?.elo) || 1550;
  const reputationGain = clamp((buyerElo - sellerElo + 300) / 600, 0, 1);
  const promisedRole = promisedRoleScore(need.expectedPlayingTime);
  const currentRole = status.squadRole || 'rotation';
  const currentRoleSecurity = currentRole === 'key' ? .95 : currentRole === 'important' ? .82 : currentRole === 'rotation' ? .60 : currentRole === 'prospect' ? .48 : .32;
  const playingTimeGain = clamp(promisedRole - currentRoleSecurity + .5, 0, 1);
  const sameCountry = Boolean(buyerClub?.countryCode && sellerClub?.countryCode && buyerClub.countryCode === sellerClub.countryCode);
  const relocationComfort = sameCountry ? .88 : .36 + brain.adaptability * .52;
  const happiness = clamp((Number(status.happiness) || 70) / 100, 0, 1);
  const yearsRemaining = contractYearsRemaining(contract, date || '2026-07-01');
  const contractResistance = clamp(yearsRemaining / 5, 0, 1);
  const listedBoost = status.transferListed ? .19 : 0;
  const freeAgentBoost = contract?.status === 'expired' ? .24 : 0;
  const developmentFit = (Number(player?.age) || 24) <= 23 ? clamp(.45 + (Number(buyerClub?.brain?.recruitment?.youthBias) || .6) * .48, 0, 1) : .55;
  const salaryEnvironment = clamp(.48 + (buyerElo - 1650) / 850, .25, .95);
  const saveVariation = world ? (randomUnit(world.seed, date || world.currentDate || 'date', player?.id || 'player', buyerClub?.code || 'buyer', 'move-openness') - .5) * .08 : 0;
  const interest = clamp(
    .31
      + reputationGain * (.20 + brain.ambition * .22 + brain.bigClubDrive * .18)
      + playingTimeGain * (.12 + brain.playingTimeNeed * .18)
      + developmentFit * brain.developmentDrive * .10
      + salaryEnvironment * brain.financialDrive * .10
      + relocationComfort * .08
      + listedBoost
      + freeAgentBoost
      - brain.loyalty * currentRoleSecurity * .12
      - brain.stability * contractResistance * .10
      - (happiness > .82 ? (happiness - .82) * .28 : 0)
      + saveVariation,
    .05,
    .97
  );
  return {
    interest: round(interest),
    brain,
    components: Object.freeze({ reputationGain: round(reputationGain), playingTimeGain: round(playingTimeGain), relocationComfort: round(relocationComfort), developmentFit: round(developmentFit), contractResistance: round(contractResistance), saveVariation: round(saveVariation) })
  };
}

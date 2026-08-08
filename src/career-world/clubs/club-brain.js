import { randomUnit } from '../deterministic-rng.js';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const round = value => +Number(value).toFixed(3);

const STYLE_LIBRARY = Object.freeze({
  'positional-possession': Object.freeze({
    inPossession: '4-3-3', outOfPossession: '4-1-4-1',
    attributes: ['technique', 'passing', 'firstTouch', 'decisions', 'composure'],
    roles: { GK: 'sweeper-keeper', CB: 'ball-playing-defender', FB: 'inverted-full-back', DM: 'deep-lying-playmaker', CM: 'advanced-8', W: 'inside-forward', ST: 'complete-forward' }
  }),
  'high-press-vertical': Object.freeze({
    inPossession: '4-3-3', outOfPossession: '4-4-2',
    attributes: ['stamina', 'workRate', 'pace', 'anticipation', 'aggression'],
    roles: { GK: 'sweeper-keeper', CB: 'front-foot-defender', FB: 'attacking-full-back', DM: 'ball-winning-midfielder', CM: 'box-to-box-midfielder', W: 'pressing-winger', ST: 'pressing-forward' }
  }),
  'transition-attack': Object.freeze({
    inPossession: '4-2-3-1', outOfPossession: '4-4-2',
    attributes: ['pace', 'acceleration', 'dribbling', 'offBall', 'decisions'],
    roles: { GK: 'goalkeeper', CB: 'cover-defender', FB: 'overlapping-full-back', DM: 'holding-midfielder', CM: 'runner', W: 'direct-winger', ST: 'advanced-forward' }
  }),
  'compact-control': Object.freeze({
    inPossession: '4-2-3-1', outOfPossession: '4-4-2',
    attributes: ['positioning', 'teamwork', 'decisions', 'strength', 'passing'],
    roles: { GK: 'goalkeeper', CB: 'central-defender', FB: 'full-back', DM: 'holding-midfielder', CM: 'central-midfielder', W: 'wide-midfielder', ST: 'complete-forward' }
  }),
  'direct-physical': Object.freeze({
    inPossession: '4-4-2', outOfPossession: '4-4-2',
    attributes: ['strength', 'jumpingReach', 'workRate', 'pace', 'bravery'],
    roles: { GK: 'goalkeeper', CB: 'no-nonsense-defender', FB: 'full-back', DM: 'ball-winning-midfielder', CM: 'box-to-box-midfielder', W: 'winger', ST: 'target-forward' }
  }),
  balanced: Object.freeze({
    inPossession: '4-2-3-1', outOfPossession: '4-4-2',
    attributes: ['decisions', 'teamwork', 'passing', 'pace', 'workRate'],
    roles: { GK: 'goalkeeper', CB: 'central-defender', FB: 'full-back', DM: 'holding-midfielder', CM: 'central-midfielder', W: 'winger', ST: 'advanced-forward' }
  })
});

const CURATED = Object.freeze({
  ARS: { style: 'positional-possession', youthBias: .78, resaleBias: .64, starBias: .76, domesticBias: .48, feeDiscipline: .66, wageDiscipline: .72 },
  MCI: { style: 'positional-possession', youthBias: .68, resaleBias: .44, starBias: .92, domesticBias: .42, feeDiscipline: .40, wageDiscipline: .48 },
  LIV: { style: 'high-press-vertical', youthBias: .73, resaleBias: .63, starBias: .78, domesticBias: .44, feeDiscipline: .62, wageDiscipline: .68 },
  MUN: { style: 'transition-attack', youthBias: .72, resaleBias: .54, starBias: .83, domesticBias: .50, feeDiscipline: .50, wageDiscipline: .56 },
  CHE: { style: 'positional-possession', youthBias: .94, resaleBias: .82, starBias: .72, domesticBias: .38, feeDiscipline: .56, wageDiscipline: .62 },
  TOT: { style: 'high-press-vertical', youthBias: .79, resaleBias: .73, starBias: .66, domesticBias: .46, feeDiscipline: .66, wageDiscipline: .70 },
  BHA: { style: 'positional-possession', youthBias: .92, resaleBias: .96, starBias: .28, domesticBias: .30, feeDiscipline: .91, wageDiscipline: .92 },
  BRE: { style: 'direct-physical', youthBias: .86, resaleBias: .94, starBias: .22, domesticBias: .36, feeDiscipline: .93, wageDiscipline: .94 },
  NEW: { style: 'high-press-vertical', youthBias: .70, resaleBias: .55, starBias: .84, domesticBias: .56, feeDiscipline: .54, wageDiscipline: .58 },
  'Real Madrid': { style: 'transition-attack', youthBias: .82, resaleBias: .48, starBias: .98, domesticBias: .36, feeDiscipline: .34, wageDiscipline: .38 },
  Barcelona: { style: 'positional-possession', youthBias: .91, resaleBias: .61, starBias: .82, domesticBias: .54, feeDiscipline: .72, wageDiscipline: .78 },
  'Atlético Madrid': { style: 'compact-control', youthBias: .57, resaleBias: .55, starBias: .75, domesticBias: .54, feeDiscipline: .63, wageDiscipline: .67 },
  'Bayern Munich': { style: 'high-press-vertical', youthBias: .72, resaleBias: .55, starBias: .92, domesticBias: .72, feeDiscipline: .52, wageDiscipline: .56 },
  'Borussia Dortmund': { style: 'high-press-vertical', youthBias: .97, resaleBias: .96, starBias: .48, domesticBias: .48, feeDiscipline: .83, wageDiscipline: .86 },
  'Bayer Leverkusen': { style: 'positional-possession', youthBias: .83, resaleBias: .80, starBias: .58, domesticBias: .44, feeDiscipline: .78, wageDiscipline: .82 },
  'Paris Saint-Germain': { style: 'positional-possession', youthBias: .73, resaleBias: .42, starBias: .97, domesticBias: .50, feeDiscipline: .34, wageDiscipline: .36 },
  'Inter Milan': { style: 'compact-control', youthBias: .53, resaleBias: .52, starBias: .82, domesticBias: .62, feeDiscipline: .68, wageDiscipline: .72 },
  'AC Milan': { style: 'transition-attack', youthBias: .76, resaleBias: .70, starBias: .76, domesticBias: .56, feeDiscipline: .70, wageDiscipline: .74 },
  Juventus: { style: 'compact-control', youthBias: .67, resaleBias: .62, starBias: .84, domesticBias: .70, feeDiscipline: .63, wageDiscipline: .68 },
  Napoli: { style: 'transition-attack', youthBias: .69, resaleBias: .73, starBias: .70, domesticBias: .48, feeDiscipline: .75, wageDiscipline: .78 },
  Atalanta: { style: 'high-press-vertical', youthBias: .89, resaleBias: .93, starBias: .34, domesticBias: .48, feeDiscipline: .88, wageDiscipline: .90 },
  Benfica: { style: 'positional-possession', youthBias: .98, resaleBias: .98, starBias: .42, domesticBias: .50, feeDiscipline: .88, wageDiscipline: .90 },
  Porto: { style: 'high-press-vertical', youthBias: .91, resaleBias: .96, starBias: .48, domesticBias: .52, feeDiscipline: .88, wageDiscipline: .90 },
  'Sporting CP': { style: 'positional-possession', youthBias: .96, resaleBias: .96, starBias: .44, domesticBias: .58, feeDiscipline: .90, wageDiscipline: .91 },
  Ajax: { style: 'positional-possession', youthBias: .99, resaleBias: .97, starBias: .34, domesticBias: .64, feeDiscipline: .91, wageDiscipline: .91 },
  PSV: { style: 'high-press-vertical', youthBias: .88, resaleBias: .89, starBias: .50, domesticBias: .62, feeDiscipline: .84, wageDiscipline: .86 },
  Feyenoord: { style: 'high-press-vertical', youthBias: .90, resaleBias: .91, starBias: .42, domesticBias: .64, feeDiscipline: .87, wageDiscipline: .88 },
  'Red Bull Salzburg': { style: 'high-press-vertical', youthBias: .99, resaleBias: .99, starBias: .20, domesticBias: .32, feeDiscipline: .91, wageDiscipline: .92 },
  Celtic: { style: 'high-press-vertical', youthBias: .82, resaleBias: .85, starBias: .48, domesticBias: .54, feeDiscipline: .82, wageDiscipline: .84 },
  Rangers: { style: 'transition-attack', youthBias: .69, resaleBias: .76, starBias: .54, domesticBias: .58, feeDiscipline: .80, wageDiscipline: .82 },
  Ludogorets: { style: 'transition-attack', youthBias: .77, resaleBias: .90, starBias: .22, domesticBias: .18, feeDiscipline: .94, wageDiscipline: .94 },
  'Ludogorets Razgrad': { style: 'transition-attack', youthBias: .77, resaleBias: .90, starBias: .22, domesticBias: .18, feeDiscipline: .94, wageDiscipline: .94 }
});

const REGIONAL_MARKETS = Object.freeze({
  ENG: ['ENG', 'SCO', 'IRL', 'NIR', 'WAL', 'FRA', 'NED', 'BEL'],
  ESP: ['ESP', 'POR', 'FRA', 'ARG', 'BRA', 'URU'],
  GER: ['GER', 'AUT', 'SUI', 'NED', 'BEL', 'DEN'],
  ITA: ['ITA', 'FRA', 'SUI', 'CRO', 'SRB', 'ARG'],
  FRA: ['FRA', 'BEL', 'SUI', 'NED', 'SEN', 'CIV', 'MAR'],
  POR: ['POR', 'BRA', 'ANG', 'CPV', 'ESP', 'FRA'],
  NED: ['NED', 'BEL', 'DEN', 'NOR', 'SWE', 'GER'],
  BEL: ['BEL', 'NED', 'FRA', 'DEN', 'NOR', 'SWE'],
  AUT: ['AUT', 'GER', 'CZE', 'SVK', 'CRO', 'SLO'],
  BUL: ['BUL', 'ROU', 'SRB', 'CRO', 'GRE', 'TUR', 'BRA']
});

function keyForClub(club) {
  return club?.code || club?.name || club?.id || 'club';
}

function inferredStyle(club, seed) {
  const rating = Number(club?.rating ?? (club?.elo ? 72 + (club.elo - 1600) / 34 : 70)) || 70;
  const country = String(club?.countryCode || 'ENG');
  const roll = randomUnit(seed, keyForClub(club), 'style');
  if (['NED', 'ESP', 'POR'].includes(country) && rating >= 72) return 'positional-possession';
  if (['GER', 'AUT', 'DEN', 'NOR'].includes(country) && roll > .28) return 'high-press-vertical';
  if (rating <= 65 && roll > .55) return 'direct-physical';
  if (roll < .22) return 'compact-control';
  if (roll < .48) return 'transition-attack';
  return 'balanced';
}

function scalar(seed, club, salt, center, spread) {
  return clamp(center + (randomUnit(seed, keyForClub(club), salt) - .5) * spread, .05, .98);
}

export function createClubBrain(club, seed) {
  const reputation = clamp(Number(club?.reputation) || Math.round(((Number(club?.rating) || 70) - 53) / 7), 1, 5);
  const elite = reputation >= 5 || Number(club?.elo) >= 1925;
  const small = reputation <= 2;
  const curated = CURATED[club?.code] || CURATED[club?.name] || {};
  const style = curated.style || inferredStyle(club, seed);
  const styleData = STYLE_LIBRARY[style] || STYLE_LIBRARY.balanced;
  const youthBias = curated.youthBias ?? scalar(seed, club, 'youth', small ? .78 : .66, .30);
  const resaleBias = curated.resaleBias ?? scalar(seed, club, 'resale', small ? .84 : .62, .34);
  const starBias = curated.starBias ?? scalar(seed, club, 'star', elite ? .83 : small ? .24 : .52, .28);
  const domesticBias = curated.domesticBias ?? scalar(seed, club, 'domestic', .48, .34);
  const feeDiscipline = curated.feeDiscipline ?? scalar(seed, club, 'fee-discipline', small ? .90 : elite ? .48 : .72, .26);
  const wageDiscipline = curated.wageDiscipline ?? scalar(seed, club, 'wage-discipline', small ? .92 : elite ? .50 : .74, .24);
  const preferredAgeMax = youthBias >= .9 ? 24 : youthBias >= .78 ? 26 : elite ? 28 : 29;
  const countryCode = String(club?.countryCode || 'ENG');

  return Object.freeze({
    schemaVersion: 1,
    clubKey: keyForClub(club),
    clubName: club?.name || club?.shortName || keyForClub(club),
    countryCode,
    league: club?.league || null,
    division: Number(club?.division) || 1,
    reputation,
    tacticalIdentity: Object.freeze({
      style,
      inPossessionFormation: styleData.inPossession,
      outOfPossessionFormation: styleData.outOfPossession,
      attributePriorities: Object.freeze([...styleData.attributes]),
      rolePreferences: Object.freeze({ ...styleData.roles })
    }),
    recruitment: Object.freeze({
      preferredAgeMin: 17,
      preferredAgeMax,
      youthBias: round(youthBias),
      resaleBias: round(resaleBias),
      starBias: round(starBias),
      domesticBias: round(domesticBias),
      regionalBias: round(scalar(seed, club, 'regional', small ? .82 : .66, .28)),
      currentAbilityWeight: round(clamp(.78 - youthBias * .24 + starBias * .18, .42, .90)),
      potentialWeight: round(clamp(.36 + youthBias * .48, .35, .92)),
      tacticalFitWeight: round(clamp(.50 + randomUnit(seed, keyForClub(club), 'tactical-fit') * .34, .50, .88)),
      feeDiscipline: round(feeDiscipline),
      wageDiscipline: round(wageDiscipline),
      loanUsage: round(scalar(seed, club, 'loan-usage', small ? .72 : youthBias > .85 ? .76 : .48, .32)),
      freeAgentBias: round(scalar(seed, club, 'free-agent', small ? .78 : .36, .28)),
      maxFeeToBudgetRatio: round(clamp(.82 - feeDiscipline * .38 + starBias * .16, .30, .82)),
      maxSquadSize: elite ? 30 : 28,
      minSquadSize: 22,
      targetSquadSize: elite ? 26 : 25,
      primaryMarkets: Object.freeze([countryCode, ...(REGIONAL_MARKETS[countryCode] || []).filter(code => code !== countryCode)].slice(0, 7))
    }),
    vision: Object.freeze({
      developYoungPlayers: round(youthBias),
      signHighProfilePlayers: round(starBias),
      financialSustainability: round((feeDiscipline + wageDiscipline + resaleBias) / 3),
      domesticCore: round(domesticBias)
    })
  });
}

export function createManagerBrain(club, seed, clubBrain = createClubBrain(club, seed)) {
  const managerName = club?.manager || club?.coach || `Manager ${clubBrain.clubName}`;
  const managerKey = `${clubBrain.clubKey}:${managerName}`;
  return Object.freeze({
    schemaVersion: 1,
    managerName,
    tacticalStyle: clubBrain.tacticalIdentity.style,
    riskTolerance: round(clamp(.38 + randomUnit(seed, managerKey, 'risk') * .46, .35, .88)),
    rotation: round(clamp(.38 + randomUnit(seed, managerKey, 'rotation') * .48, .30, .90)),
    youthTrust: round(clamp(clubBrain.recruitment.youthBias * .72 + randomUnit(seed, managerKey, 'youth-trust') * .24, .20, .96)),
    tacticalRigidity: round(clamp(.35 + randomUnit(seed, managerKey, 'rigidity') * .50, .30, .92)),
    squadLoyalty: round(clamp(.38 + randomUnit(seed, managerKey, 'loyalty') * .48, .30, .92)),
    negotiationPatience: round(clamp(.38 + randomUnit(seed, managerKey, 'patience') * .48, .30, .92))
  });
}

export function tacticalRoleFor(clubBrain, positionBucket) {
  return clubBrain?.tacticalIdentity?.rolePreferences?.[positionBucket]
    || STYLE_LIBRARY.balanced.roles[positionBucket]
    || 'squad-player';
}

export function marketAffinity(clubBrain, sellerCountryCode) {
  if (!clubBrain || !sellerCountryCode) return .55;
  const country = String(sellerCountryCode);
  if (country === clubBrain.countryCode) return clamp(.55 + clubBrain.recruitment.domesticBias * .42, .55, .97);
  if (clubBrain.recruitment.primaryMarkets.includes(country)) return clamp(.48 + clubBrain.recruitment.regionalBias * .38, .48, .92);
  return clamp(.32 + (1 - clubBrain.recruitment.domesticBias) * .28, .30, .68);
}

export const CURATED_CLUB_BRAIN_KEYS = Object.freeze(Object.keys(CURATED));

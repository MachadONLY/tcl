import { hashString, randomInt, seedFromParts } from './deterministic-rng.js';
import { createClubBrain, createManagerBrain } from './clubs/club-brain.js';

export const WORLD_SCHEMA_VERSION = 2;

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

function seasonStart(career) {
  const year = Number(String(career?.seasonLabel || '2026/27').slice(0, 4)) || 2026;
  return `${year}-07-01`;
}

function contractEndFor(player, seed, startYear) {
  const published = String(player.contractUntil || player.contractEnd || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(published)) return published;
  const age = Number(player.age) || 24;
  const rating = Number(player.rating) || 70;
  const potential = Number(player.potential) || rating;
  let years = age <= 21 ? 4 + randomInt(0, 2, seed, player.id, 'contract')
    : age <= 27 ? 3 + randomInt(0, 2, seed, player.id, 'contract')
      : age <= 30 ? 2 + randomInt(0, 2, seed, player.id, 'contract')
        : age <= 33 ? 1 + randomInt(0, 2, seed, player.id, 'contract')
          : 1 + randomInt(0, 1, seed, player.id, 'contract');
  if (potential >= 88 && age < 25) years = Math.max(years, 5);
  return `${startYear + years}-06-30`;
}

function joinedAtFor(player, seed, startYear) {
  const published = String(player.joinedAt || player.transferDate || '').slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(published)) return published;
  const age = Number(player.age) || 24;
  const careerYears = Math.max(1, age - 17);
  const maxTenure = Math.min(careerYears, age <= 21 ? 3 : 7);
  const tenure = 1 + randomInt(0, Math.max(0, maxTenure - 1), seed, player.id, 'tenure');
  return `${Math.max(2014, startYear - tenure)}-07-01`;
}

function squadRole(player, peers) {
  const sorted = [...peers].sort((left, right) => (right.rating || 0) - (left.rating || 0));
  const index = sorted.findIndex(candidate => candidate.id === player.id);
  const percentile = sorted.length <= 1 ? 0 : index / (sorted.length - 1);
  if (percentile <= .17) return 'key';
  if (percentile <= .45) return 'important';
  if (percentile <= .72) return 'rotation';
  return player.age <= 21 && (player.potential || player.rating) > (player.rating || 0) + 2 ? 'prospect' : 'fringe';
}

function compatibilityPolicy(brain, managerBrain) {
  return {
    preferredAgeMin: brain.recruitment.preferredAgeMin,
    preferredAgeMax: brain.recruitment.preferredAgeMax,
    maxAgeForPermanent: Math.max(28, brain.recruitment.preferredAgeMax + 2),
    developmentBias: brain.recruitment.youthBias,
    patience: managerBrain.negotiationPatience,
    negotiationAggression: clamp(1 - brain.recruitment.feeDiscipline * .55, .30, .82),
    targetSquadSize: brain.recruitment.targetSquadSize,
    minSquadSize: brain.recruitment.minSquadSize,
    maxSquadSize: brain.recruitment.maxSquadSize
  };
}

function normalizeWorldShape(world) {
  world.schemaVersion = WORLD_SCHEMA_VERSION;
  world.events ||= [];
  world.eventSequence = Number(world.eventSequence) || 0;
  world.processedDays ||= {};
  world.dailySummaries ||= {};
  world.employment ||= {};
  world.contracts ||= {};
  world.playerStatus ||= {};
  world.clubs ||= {};
  world.transferMarket ||= {};
  world.transferMarket.negotiations ||= {};
  world.transferMarket.history ||= [];
  world.transferMarket.rumors ||= [];
  world.transferMarket.cooldowns ||= {};
  world.transferMarket.lastActivityByClub ||= {};
  return world;
}

export function createWorldState({ career, clubs = [], squads = {}, teamBudgets = {}, teamElo = {} }) {
  const startDate = seasonStart(career);
  const startYear = Number(startDate.slice(0, 4));
  const seed = hashString(seedFromParts(
    career?.saveId || 'primary',
    career?.seasonId || career?.seasonLabel || 'season',
    career?.clubCode || 'club',
    career?.createdAt || 'created'
  ));
  const world = normalizeWorldShape({
    schemaVersion: WORLD_SCHEMA_VERSION,
    seed,
    userClubCode: career?.clubCode || null,
    createdAt: career?.createdAt || new Date().toISOString(),
    currentDate: startDate,
    processedDays: {},
    dailySummaries: {},
    events: [],
    eventSequence: 0,
    employment: {},
    contracts: {},
    playerStatus: {},
    clubs: {},
    transferMarket: {
      negotiations: {}, history: [], rumors: [], cooldowns: {}, lastActivityByClub: {}
    }
  });

  for (const club of clubs) {
    const code = club.code;
    const players = Array.isArray(squads[code]) ? squads[code] : [];
    const budget = Number(code === career?.clubCode ? career?.transferBudget : teamBudgets[code]) || Number(club.budget) || 50_000_000;
    const wageBudget = Number(code === career?.clubCode ? career?.wageBudget : Math.round(budget * .009)) || 500_000;
    const elo = Number(teamElo[code] ?? club.elo) || 1750;
    const brain = createClubBrain({ ...club, countryCode: club.countryCode || 'ENG', elo }, seed);
    const managerBrain = createManagerBrain(club, seed, brain);
    world.clubs[code] = {
      code,
      name: club.name,
      countryCode: club.countryCode || 'ENG',
      league: club.league || 'Premier League',
      elo,
      transferBudget: budget,
      startingTransferBudget: budget,
      wageBudget,
      transferSpent: 0,
      transferIncome: 0,
      brain,
      managerBrain,
      recruitment: {
        needs: [],
        requirements: [],
        shortlist: [],
        lastEvaluatedDate: null,
        nextRecruitmentDate: startDate
      },
      policy: compatibilityPolicy(brain, managerBrain)
    };

    for (const player of players) {
      world.employment[player.id] = code;
      const role = squadRole(player, players);
      const joinedAt = joinedAtFor(player, seed, startYear);
      world.playerStatus[player.id] = {
        transferListed: false,
        loanListed: false,
        askingPrice: null,
        squadRole: role,
        joinedAt,
        lastMoveAt: null,
        unavailableUntil: null,
        happiness: 70,
        playingTimeExpectation: role === 'key' ? 'star-player' : role === 'important' ? 'important-player' : role === 'rotation' ? 'squad-player' : 'prospect'
      };
      world.contracts[player.id] = {
        playerId: player.id,
        clubCode: code,
        startDate: joinedAt,
        endDate: contractEndFor(player, seed, startYear),
        weeklyWage: Math.max(1_000, Number(player.wage) || 8_000),
        status: 'active'
      };
    }
  }
  return world;
}

export function ensureWorldState(career, dependencies) {
  if (!career.world || career.world.schemaVersion !== WORLD_SCHEMA_VERSION) {
    career.world = createWorldState({ career, ...dependencies });
  } else {
    normalizeWorldShape(career.world);
  }
  career.worldSeed = career.world.seed;
  return career.world;
}

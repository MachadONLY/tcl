import { hashString, randomInt, seedFromParts } from './deterministic-rng.js';
import { createClubBrain, createManagerBrain } from './clubs/club-brain.js';
import { rebuildEmploymentIndex } from './world-employment-index.js';

export const WORLD_SCHEMA_VERSION = 3;

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
  if (player?.initialSquadRole) return player.initialSquadRole;
  const sorted = [...peers].sort((left, right) => (right.rating || 0) - (left.rating || 0));
  const index = sorted.findIndex(candidate => candidate.id === player.id);
  const percentile = sorted.length <= 1 ? 0 : index / (sorted.length - 1);
  if (percentile <= .17) return 'key';
  if (percentile <= .45) return 'important';
  if (percentile <= .72) return 'rotation';
  return player.age <= 21 && (player.potential || player.rating) > (player.rating || 0) + 2 ? 'prospect' : 'fringe';
}

function playingTimeForRole(role) {
  return role === 'key' ? 'star-player'
    : role === 'important' ? 'important-player'
      : role === 'rotation' ? 'squad-player'
        : 'prospect';
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
  world.freeAgents ||= {};
  world.playerStatus ||= {};
  world.clubs ||= {};
  world.transferMarket ||= {};
  world.transferMarket.negotiations ||= {};
  world.transferMarket.history ||= [];
  world.transferMarket.rumors ||= [];
  world.transferMarket.cooldowns ||= {};
  world.transferMarket.lastActivityByClub ||= {};
  world.contractMarket ||= {};
  world.contractMarket.renewals ||= {};
  world.contractMarket.preContracts ||= {};
  world.contractMarket.reviewed ||= {};
  world.contractMarket.userNotifications ||= {};
  world.contractMarket.sequence = Number(world.contractMarket.sequence) || 0;
  world.migrations ||= [];
  world.database ||= {};
  rebuildEmploymentIndex(world);
  return world;
}

function brainForClub(club, clubState, seed, teamElo) {
  const elo = Number(clubState?.elo ?? teamElo?.[club.code] ?? club.elo) || 1750;
  const enriched = { ...club, countryCode: club.countryCode || clubState?.countryCode || 'ENG', elo };
  const brain = clubState?.brain || createClubBrain(enriched, seed);
  const managerBrain = clubState?.managerBrain || createManagerBrain(enriched, seed, brain);
  return { elo, brain, managerBrain, enriched };
}

function clubBudget(career, club, code, teamBudgets) {
  return Number(code === career?.clubCode ? career?.transferBudget : teamBudgets?.[code])
    || Number(club?.budget)
    || 5_000_000;
}

function buildClubState(career, club, seed, dependencies, existing = null) {
  const code = club.code;
  const { elo, brain, managerBrain } = brainForClub(club, existing, seed, dependencies.teamElo);
  const budget = Number(existing?.transferBudget) || clubBudget(career, club, code, dependencies.teamBudgets);
  const wageBudget = Number(existing?.wageBudget)
    || Number(code === career?.clubCode ? career?.wageBudget : Math.round(budget * .009))
    || 100_000;
  return {
    ...(existing || {}),
    code,
    name: existing?.name || club.name,
    countryCode: existing?.countryCode || club.countryCode || 'ENG',
    league: existing?.league || club.league || 'Unknown',
    division: Number(existing?.division ?? club.division) || 1,
    elo,
    transferBudget: budget,
    startingTransferBudget: Number(existing?.startingTransferBudget) || budget,
    wageBudget,
    transferSpent: Number(existing?.transferSpent) || 0,
    transferIncome: Number(existing?.transferIncome) || 0,
    brain,
    managerBrain,
    recruitment: {
      needs: existing?.recruitment?.needs || [],
      requirements: existing?.recruitment?.requirements || [],
      shortlist: existing?.recruitment?.shortlist || [],
      lastEvaluatedDate: existing?.recruitment?.lastEvaluatedDate || null,
      nextRecruitmentDate: existing?.recruitment?.nextRecruitmentDate || career.currentDate || seasonStart(career)
    },
    policy: { ...compatibilityPolicy(brain, managerBrain), ...(existing?.policy || {}) }
  };
}

function seedPersistentPlayerState(world, player, code, peers, seed, startYear) {
  world.employment[player.id] = code;
  if (player.worldExternal) return;
  const role = squadRole(player, peers);
  const joinedAt = joinedAtFor(player, seed, startYear);
  world.playerStatus[player.id] ||= {
    transferListed: false,
    loanListed: false,
    askingPrice: null,
    squadRole: role,
    joinedAt,
    lastMoveAt: null,
    unavailableUntil: null,
    happiness: 70,
    playingTimeExpectation: playingTimeForRole(role)
  };
  world.contracts[player.id] ||= {
    playerId: player.id,
    clubCode: code,
    startDate: joinedAt,
    endDate: contractEndFor(player, seed, startYear),
    weeklyWage: Math.max(1_000, Number(player.wage) || 8_000),
    status: 'active'
  };
}

function migrateExistingWorld(career, dependencies) {
  const world = career.world;
  const previousVersion = Number(world.schemaVersion) || 1;
  const clubs = dependencies.clubs || [];
  const squads = dependencies.squads || {};
  const seed = Number(world.seed) || hashString(seedFromParts(career.saveId, career.seasonId, career.clubCode, career.createdAt));
  const startYear = Number(seasonStart(career).slice(0, 4));
  world.seed = seed;
  world.userClubCode ||= career.clubCode || null;
  world.createdAt ||= career.createdAt || new Date().toISOString();
  world.clubs ||= {};
  world.employment ||= {};
  world.playerStatus ||= {};
  world.contracts ||= {};

  for (const club of clubs) {
    if (!club?.code) continue;
    world.clubs[club.code] = buildClubState(career, club, seed, dependencies, world.clubs[club.code]);
  }

  if (previousVersion < 3) {
    for (const club of clubs) {
      const players = Array.isArray(squads[club.code]) ? squads[club.code] : [];
      for (const player of players) {
        if (world.employment[player.id]) continue;
        seedPersistentPlayerState(world, player, club.code, players, seed, startYear);
      }
    }
  }

  for (const [playerId, status] of Object.entries(world.playerStatus || {})) {
    status.happiness = Number.isFinite(Number(status.happiness)) ? Number(status.happiness) : 70;
    if (!status.playingTimeExpectation) status.playingTimeExpectation = playingTimeForRole(status.squadRole || 'rotation');
    if (world.contracts[playerId] && !world.contracts[playerId].clubCode) world.contracts[playerId].clubCode = world.employment[playerId] || null;
  }

  world.database = {
    ...(world.database || {}),
    ...(dependencies.worldMeta || {}),
    attachedAtCareerDate: career.currentDate || world.currentDate || null
  };
  normalizeWorldShape(world);
  if (!world.migrations.some(row => row?.to === WORLD_SCHEMA_VERSION)) {
    world.migrations.push({ from: previousVersion, to: WORLD_SCHEMA_VERSION, atCareerDate: career.currentDate || world.currentDate || null });
  }
  return world;
}

export function createWorldState({ career, clubs = [], squads = {}, teamBudgets = {}, teamElo = {}, worldMeta = {} }) {
  const startDate = seasonStart(career);
  const startYear = Number(startDate.slice(0, 4));
  const seed = hashString(seedFromParts(
    career?.saveId || 'primary',
    career?.seasonId || career?.seasonLabel || 'season',
    career?.clubCode || 'club',
    career?.createdAt || 'created'
  ));
  const world = {
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
    freeAgents: {},
    playerStatus: {},
    clubs: {},
    transferMarket: { negotiations: {}, history: [], rumors: [], cooldowns: {}, lastActivityByClub: {} },
    contractMarket: { renewals: {}, preContracts: {}, reviewed: {}, userNotifications: {}, sequence: 0 },
    migrations: [],
    database: { ...worldMeta, attachedAtCareerDate: startDate }
  };

  const dependencies = { clubs, squads, teamBudgets, teamElo, worldMeta };
  for (const club of clubs) {
    if (!club?.code) continue;
    world.clubs[club.code] = buildClubState(career, club, seed, dependencies);
    const players = Array.isArray(squads[club.code]) ? squads[club.code] : [];
    for (const player of players) seedPersistentPlayerState(world, player, club.code, players, seed, startYear);
  }
  return normalizeWorldShape(world);
}

export function ensureWorldState(career, dependencies) {
  if (!career.world) {
    career.world = createWorldState({ career, ...dependencies });
  } else if (Number(career.world.schemaVersion) !== WORLD_SCHEMA_VERSION) {
    career.world = migrateExistingWorld(career, dependencies);
  } else {
    normalizeWorldShape(career.world);
    career.world.database = { ...(career.world.database || {}), ...(dependencies.worldMeta || {}) };
  }
  career.worldSeed = career.world.seed;
  return career.world;
}

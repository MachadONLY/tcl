import { appendWorldEvent } from '../world-events.js';
import { daysBetween } from '../world-time.js';
import { randomUnit } from '../deterministic-rng.js';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const round = value => +Number(value).toFixed(3);

const STYLE_PROFILES = Object.freeze({
  'positional-possession': { formation: '4-3-3', attributes: ['technique', 'passing', 'firstTouch', 'decisions', 'composure'], roles: { GK: 'sweeper-keeper', CB: 'ball-playing-defender', FB: 'inverted-full-back', DM: 'deep-lying-playmaker', CM: 'advanced-8', W: 'inside-forward', ST: 'complete-forward' } },
  'high-press-vertical': { formation: '4-3-3', attributes: ['stamina', 'workRate', 'pace', 'anticipation', 'aggression'], roles: { GK: 'sweeper-keeper', CB: 'front-foot-defender', FB: 'attacking-full-back', DM: 'ball-winning-midfielder', CM: 'box-to-box-midfielder', W: 'pressing-winger', ST: 'pressing-forward' } },
  'transition-attack': { formation: '4-2-3-1', attributes: ['pace', 'acceleration', 'dribbling', 'offBall', 'decisions'], roles: { GK: 'goalkeeper', CB: 'cover-defender', FB: 'overlapping-full-back', DM: 'holding-midfielder', CM: 'runner', W: 'direct-winger', ST: 'advanced-forward' } },
  'compact-control': { formation: '4-2-3-1', attributes: ['positioning', 'teamwork', 'decisions', 'strength', 'passing'], roles: { GK: 'goalkeeper', CB: 'central-defender', FB: 'full-back', DM: 'holding-midfielder', CM: 'central-midfielder', W: 'wide-midfielder', ST: 'complete-forward' } },
  'direct-physical': { formation: '4-4-2', attributes: ['strength', 'jumpingReach', 'workRate', 'pace', 'bravery'], roles: { GK: 'goalkeeper', CB: 'no-nonsense-defender', FB: 'full-back', DM: 'ball-winning-midfielder', CM: 'box-to-box-midfielder', W: 'winger', ST: 'target-forward' } },
  balanced: { formation: '4-2-3-1', attributes: ['decisions', 'teamwork', 'passing', 'pace', 'workRate'], roles: { GK: 'goalkeeper', CB: 'central-defender', FB: 'full-back', DM: 'holding-midfielder', CM: 'central-midfielder', W: 'winger', ST: 'advanced-forward' } }
});

function ensureManagerMarket(world) {
  world.managerMarket ||= {};
  world.managerMarket.managers ||= {};
  world.managerMarket.history ||= [];
  world.managerMarket.sequence = Number(world.managerMarket.sequence) || 0;
  world.managerMarket.initialized ||= false;
  return world.managerMarket;
}

function managerId(clubCode, name) {
  return `mgr-${String(clubCode).toLowerCase()}-${String(name || 'manager').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

function styleProfile(style) {
  return STYLE_PROFILES[style] || STYLE_PROFILES.balanced;
}

function seedManagerEntity(world, clubCode, club) {
  const brain = club.managerBrain || {};
  const name = brain.managerName || `Manager ${club.name || clubCode}`;
  const id = managerId(clubCode, name);
  if (world.managerMarket.managers[id]) return world.managerMarket.managers[id];
  const style = brain.tacticalStyle || club.brain?.tacticalIdentity?.style || 'balanced';
  const profile = styleProfile(style);
  const entity = {
    id,
    name,
    currentClubCode: clubCode,
    status: 'employed',
    reputation: clamp(Math.round(1 + ((Number(club.elo) || 1600) - 1450) / 170), 1, 5),
    hiredAt: world.currentDate || world.createdAt?.slice(0, 10) || '2026-07-01',
    previousClubs: [],
    brain: {
      ...brain,
      managerName: name,
      tacticalStyle: style,
      formation: profile.formation,
      attributePriorities: [...profile.attributes],
      rolePreferences: { ...profile.roles }
    }
  };
  world.managerMarket.managers[id] = entity;
  club.managerId = id;
  club.managerBrain = { ...entity.brain };
  return entity;
}

function initializeManagers(world) {
  const market = ensureManagerMarket(world);
  if (market.initialized) return market;
  for (const [clubCode, club] of Object.entries(world.clubs || {})) seedManagerEntity(world, clubCode, club);
  market.initialized = true;
  return market;
}

function recentResults(career, clubCode, date, limit = 10) {
  return Object.values(career.results || {})
    .filter(result => result?.date && result.date < date && (result.home === clubCode || result.away === clubCode))
    .sort((left, right) => String(right.date).localeCompare(String(left.date)))
    .slice(0, limit);
}

function pointsForClub(result, clubCode) {
  const home = result.home === clubCode;
  const own = home ? Number(result.homeGoals) : Number(result.awayGoals);
  const opp = home ? Number(result.awayGoals) : Number(result.homeGoals);
  return own > opp ? 3 : own === opp ? 1 : 0;
}

function expectedPoints(career, result, clubCode) {
  const own = Number(career.world.clubs?.[clubCode]?.elo) || 1700;
  const opponentCode = result.home === clubCode ? result.away : result.home;
  const opponent = Number(career.world.clubs?.[opponentCode]?.elo) || 1700;
  const homeBonus = result.home === clubCode ? 55 : -20;
  const probability = 1 / (1 + Math.pow(10, -((own + homeBonus - opponent) / 400)));
  return clamp(.55 + probability * 2.05, .55, 2.55);
}

function jobSecurity(career, clubCode, date) {
  const club = career.world.clubs[clubCode];
  const manager = career.world.managerMarket.managers[club.managerId];
  const results = recentResults(career, clubCode, date, 10);
  if (!manager || results.length < 6) return { score: .75, results: results.length, ppg: null, expectedPpg: null, underperformance: 0 };
  const points = results.reduce((sum, result) => sum + pointsForClub(result, clubCode), 0);
  const expected = results.reduce((sum, result) => sum + expectedPoints(career, result, clubCode), 0);
  const ppg = points / results.length;
  const expectedPpg = expected / results.length;
  const underperformance = clamp((expectedPpg - ppg) / 1.8, -.3, 1);
  const tenureDays = Math.max(0, daysBetween(manager.hiredAt || date, date));
  const patience = Number(manager.brain?.squadLoyalty) || .55;
  const elitePressure = Number(club.elo) >= 1900 ? .10 : 0;
  const earlyProtection = tenureDays < 90 ? .18 : tenureDays < 180 ? .08 : 0;
  const score = clamp(.78 - underperformance * (.58 + elitePressure) + patience * .10 + earlyProtection, .05, .96);
  return { score: round(score), results: results.length, ppg: round(ppg), expectedPpg: round(expectedPpg), underperformance: round(underperformance), tenureDays };
}

function caretakerBrain(world, clubCode, club, date) {
  const style = club.brain?.tacticalIdentity?.style || 'balanced';
  const profile = styleProfile(style);
  return {
    schemaVersion: 1,
    managerName: `Caretaker ${club.name || clubCode}`,
    tacticalStyle: style,
    formation: profile.formation,
    attributePriorities: [...profile.attributes],
    rolePreferences: { ...profile.roles },
    riskTolerance: round(clamp(.42 + randomUnit(world.seed, date, clubCode, 'caretaker-risk') * .22, .38, .68)),
    rotation: .55,
    youthTrust: round(clamp(Number(club.brain?.recruitment?.youthBias || .6) * .72, .30, .82)),
    tacticalRigidity: .50,
    squadLoyalty: .58,
    negotiationPatience: .55
  };
}

function sackManager({ career, date, clubCode, security }) {
  const world = career.world;
  const market = initializeManagers(world);
  const club = world.clubs[clubCode];
  const manager = market.managers[club.managerId];
  if (!club || !manager) return false;
  manager.status = 'unemployed';
  manager.currentClubCode = null;
  manager.dismissedAt = date;
  manager.previousClubs ||= [];
  manager.previousClubs.push({ clubCode, from: manager.hiredAt, to: date, reason: 'sacked' });
  club.managerId = null;
  club.managerBrain = caretakerBrain(world, clubCode, club, date);
  club.managerStatus = 'vacant';
  club.managerVacancySince = date;
  club.recruitment.requirements = [];
  club.recruitment.needs = [];
  club.recruitment.lastEvaluatedDate = null;
  for (const playerId of Object.keys(world.playerStatus || {})) {
    if (world.employment[playerId] !== clubCode) continue;
    delete world.playerStatus[playerId].saleDisposition;
  }
  market.history.push({ date, type: 'sacked', managerId: manager.id, clubCode, security });
  appendWorldEvent(world, {
    date,
    type: 'MANAGER_SACKED',
    entities: { managerId: manager.id, clubCode },
    payload: { managerName: manager.name, jobSecurity: security.score, ppg: security.ppg, expectedPpg: security.expectedPpg, underperformance: security.underperformance }
  });
  return true;
}

function styleAffinity(managerStyle, clubStyle) {
  if (managerStyle === clubStyle) return 1;
  const close = new Set([
    'positional-possession:high-press-vertical', 'high-press-vertical:positional-possession',
    'transition-attack:high-press-vertical', 'high-press-vertical:transition-attack',
    'compact-control:balanced', 'balanced:compact-control',
    'transition-attack:balanced', 'balanced:transition-attack'
  ]);
  return close.has(`${managerStyle}:${clubStyle}`) ? .72 : .40;
}

function candidateScore(world, hiringClub, manager) {
  const clubStyle = hiringClub.brain?.tacticalIdentity?.style || 'balanced';
  const styleFit = styleAffinity(manager.brain?.tacticalStyle || 'balanced', clubStyle);
  const youthFit = 1 - Math.abs(Number(manager.brain?.youthTrust || .5) - Number(hiringClub.brain?.recruitment?.youthBias || .5));
  const reputationTarget = clamp(Math.round(1 + ((Number(hiringClub.elo) || 1600) - 1450) / 170), 1, 5);
  const reputationFit = clamp(1 - Math.max(0, reputationTarget - Number(manager.reputation || 1)) * .16, .28, 1);
  const ambition = manager.status === 'unemployed' ? 1 : Number(hiringClub.elo) > Number(world.clubs[manager.currentClubCode]?.elo || 0) + 90 ? .82 : .35;
  return styleFit * .34 + youthFit * .18 + reputationFit * .27 + ambition * .16 + randomUnit(world.seed, hiringClub.code, manager.id, 'manager-candidate') * .05;
}

function eligibleCandidates(career, clubCode, date) {
  const world = career.world;
  const market = initializeManagers(world);
  const hiringClub = world.clubs[clubCode];
  return Object.values(market.managers)
    .filter(manager => manager.id !== hiringClub.managerId)
    .filter(manager => {
      if (manager.status === 'unemployed') return true;
      if (!manager.currentClubCode || manager.currentClubCode === career.clubCode || manager.currentClubCode === clubCode) return false;
      const currentClub = world.clubs[manager.currentClubCode];
      if (!currentClub) return false;
      const tenure = daysBetween(manager.hiredAt || date, date);
      return tenure >= 120 && Number(hiringClub.elo) >= Number(currentClub.elo) + 80;
    })
    .map(manager => ({ manager, score: candidateScore(world, hiringClub, manager) }))
    .sort((left, right) => right.score - left.score || right.manager.reputation - left.manager.reputation)
    .slice(0, 8);
}

function hireManager({ career, date, clubCode }) {
  const world = career.world;
  const market = initializeManagers(world);
  const club = world.clubs[clubCode];
  const candidates = eligibleCandidates(career, clubCode, date);
  if (!candidates.length) return false;
  const best = candidates[0];
  const second = candidates[1];
  const pool = second && best.score - second.score < .08 ? candidates.slice(0, 3) : candidates.slice(0, 1);
  const index = Math.min(pool.length - 1, Math.floor(randomUnit(world.seed, date, clubCode, 'manager-hire-choice') * pool.length));
  const manager = pool[index].manager;
  const sourceClubCode = manager.currentClubCode;
  if (sourceClubCode) {
    const source = world.clubs[sourceClubCode];
    if (source) {
      source.managerId = null;
      source.managerBrain = caretakerBrain(world, sourceClubCode, source, date);
      source.managerStatus = 'vacant';
      source.managerVacancySince = date;
      source.recruitment.requirements = [];
      source.recruitment.needs = [];
      source.recruitment.lastEvaluatedDate = null;
    }
  }
  manager.previousClubs ||= [];
  if (sourceClubCode) manager.previousClubs.push({ clubCode: sourceClubCode, from: manager.hiredAt, to: date, reason: 'poached' });
  manager.status = 'employed';
  manager.currentClubCode = clubCode;
  manager.hiredAt = date;
  manager.dismissedAt = null;
  club.managerId = manager.id;
  club.managerBrain = { ...manager.brain };
  club.managerStatus = 'permanent';
  club.managerVacancySince = null;
  club.recruitment.requirements = [];
  club.recruitment.needs = [];
  club.recruitment.shortlist = [];
  club.recruitment.lastEvaluatedDate = null;
  for (const playerId of Object.keys(world.playerStatus || {})) {
    if (world.employment[playerId] !== clubCode) continue;
    delete world.playerStatus[playerId].saleDisposition;
  }
  market.history.push({ date, type: sourceClubCode ? 'poached' : 'hired', managerId: manager.id, clubCode, fromClubCode: sourceClubCode || null, fitScore: pool[index].score });
  appendWorldEvent(world, {
    date,
    type: sourceClubCode ? 'MANAGER_POACHED' : 'MANAGER_HIRED',
    entities: { managerId: manager.id, clubCode, fromClubCode: sourceClubCode || null },
    payload: { managerName: manager.name, tacticalStyle: manager.brain.tacticalStyle, fitScore: round(pool[index].score) }
  });
  return true;
}

function reviewSackings(career, date) {
  const world = career.world;
  initializeManagers(world);
  if (String(date).slice(-2) !== '01' && String(date).slice(-2) !== '15') return { reviewed: 0, sacked: 0 };
  let reviewed = 0;
  let sacked = 0;
  for (const [clubCode, club] of Object.entries(world.clubs || {})) {
    if (clubCode === career.clubCode || club.managerStatus === 'vacant') continue;
    const security = jobSecurity(career, clubCode, date);
    if (security.results < 6) continue;
    reviewed += 1;
    if (security.score >= .34) continue;
    const probability = clamp((.36 - security.score) * 1.85 + security.underperformance * .16, .04, .48);
    if (randomUnit(world.seed, date, clubCode, club.managerId, 'sack-decision') < probability && sackManager({ career, date, clubCode, security })) sacked += 1;
  }
  return { reviewed, sacked };
}

function fillVacancies(career, date) {
  const world = career.world;
  let hired = 0;
  const vacancies = Object.entries(world.clubs || {})
    .filter(([clubCode, club]) => clubCode !== career.clubCode && club.managerStatus === 'vacant')
    .sort((left, right) => Number(right[1].elo) - Number(left[1].elo));
  for (const [clubCode, club] of vacancies) {
    const vacancyDays = daysBetween(club.managerVacancySince || date, date);
    if (vacancyDays < 5) continue;
    const probability = clamp(.20 + vacancyDays * .035, .20, .88);
    if (randomUnit(world.seed, date, clubCode, 'vacancy-fill') >= probability) continue;
    if (hireManager({ career, date, clubCode })) hired += 1;
    if (hired >= 4) break;
  }
  return hired;
}

export function processManagerMarketDay({ career, date }) {
  initializeManagers(career.world);
  const sackings = reviewSackings(career, date);
  const hired = fillVacancies(career, date);
  return {
    managers: Object.keys(career.world.managerMarket.managers).length,
    reviewed: sackings.reviewed,
    sacked: sackings.sacked,
    hired,
    vacancies: Object.values(career.world.clubs || {}).filter(club => club.managerStatus === 'vacant').length
  };
}

export function managerMarketSnapshot(career) {
  const market = initializeManagers(career.world);
  return { managers: Object.values(market.managers), history: [...market.history] };
}

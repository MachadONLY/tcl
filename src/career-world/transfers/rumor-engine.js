import { appendWorldEvent } from '../world-events.js';
import { addWorldDays, daysBetween } from '../world-time.js';
import { randomInt, randomUnit } from '../deterministic-rng.js';
import { effectivePlayerContract, effectivePlayerStatus } from '../world-employment-index.js';
import { chooseRecruitmentTarget, transferWindowState } from './recruitment-ai.js';
import { evaluateMoveAppeal } from './player-brain.js';
import { findRumorCompetitors, rebuildCompetitionIndex } from './competition-engine.js';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const ACTIVE_NEGOTIATION_TERMINAL = new Set(['completed', 'rejected', 'withdrawn', 'expired']);
const FREE_AGENT_CLUB = Object.freeze({ code: null, name: 'Free Agents', countryCode: null, elo: 1550, brain: { recruitment: {} } });

function ensureRumorMarket(world) {
  world.transferMarket ||= {};
  world.transferMarket.rumors ||= [];
  world.transferMarket.rumorSequence = Number(world.transferMarket.rumorSequence) || 0;
  world.transferMarket.rumorCooldowns ||= {};
  world.transferMarket.competition ||= {};
  return world.transferMarket;
}

function activeNegotiation(world, buyerCode, playerId = null) {
  return Object.values(world.transferMarket?.negotiations || {}).find(negotiation =>
    !ACTIVE_NEGOTIATION_TERMINAL.has(negotiation.status)
      && negotiation.buyerCode === buyerCode
      && (!playerId || negotiation.playerId === playerId)
  ) || null;
}

function requirementRows(analysis) {
  return analysis?.requirements?.length ? analysis.requirements : analysis?.needs || [];
}

function matchingNeed(analysis, rumor) {
  return requirementRows(analysis).find(need => {
    if (rumor.position && need.position) return rumor.position === need.position;
    return rumor.group === need.group;
  }) || null;
}

function existingRumor(world, buyerCode, playerId = null, need = null) {
  return (world.transferMarket?.rumors || []).find(rumor => {
    if (rumor.status !== 'active' || rumor.buyerCode !== buyerCode) return false;
    if (playerId && rumor.playerId !== playerId) return false;
    if (!need) return true;
    if (need.position && rumor.position) return need.position === rumor.position;
    return need.group === rumor.group;
  }) || null;
}

function endRumor(world, rumor, date, reason) {
  if (!rumor || rumor.status !== 'active') return false;
  rumor.status = 'ended';
  rumor.endedAt = date;
  rumor.endReason = reason;
  rumor.updatedAt = date;
  rumor.readyForApproach = false;
  world.transferMarket.rumorCooldowns[`${rumor.buyerCode}:${rumor.playerId}`] = addWorldDays(date, reason === 'need-resolved' ? 18 : 10);
  appendWorldEvent(world, {
    date,
    type: 'TRANSFER_RUMOUR_ENDED',
    entities: { playerId: rumor.playerId, buyerCode: rumor.buyerCode, sellerCode: rumor.sellerCode, rumorId: rumor.id },
    payload: { reason, stage: rumor.stage },
    visibility: 'system'
  });
  return true;
}

function registerRumor({ career, date, buyerCode, need, target, source = 'organic', initialStage = 'watching' }) {
  const world = career.world;
  const market = ensureRumorMarket(world);
  const player = target?.player;
  if (!player || existingRumor(world, buyerCode, player.id)) return null;
  const freeAgent = Boolean(target.freeAgent || world.freeAgents?.[player.id] && !world.employment[player.id]);
  const sellerCode = freeAgent ? null : world.employment[player.id];
  const buyerClub = world.clubs[buyerCode];
  const sellerClub = freeAgent ? FREE_AGENT_CLUB : world.clubs[sellerCode];
  if (!buyerClub || (!freeAgent && !sellerClub)) return null;
  const status = freeAgent ? { ...effectivePlayerStatus(world, player), transferListed: true, squadRole: 'fringe' } : effectivePlayerStatus(world, player);
  const contract = freeAgent ? { ...effectivePlayerContract(world, player), status: 'expired', endDate: date } : effectivePlayerContract(world, player);
  const appeal = evaluateMoveAppeal({ world, date, player, status, contract, buyerClub, sellerClub, need });
  const marketValue = Number(target.marketValue) || Number(player.value) || 0;
  const heat = clamp(.28 + Number(need.priority || 0) * .24 + appeal.interest * .20 + randomUnit(world.seed, date, buyerCode, player.id, 'rumor-heat') * .10, .18, .88);
  const mediaChance = clamp(.18 + Math.max(0, (Number(player.rating) || 70) - 76) * .018 + heat * .30 + (Number(player?.value) >= 50_000_000 ? .08 : 0), .15, .76);
  const mediaVisible = randomUnit(world.seed, buyerCode, player.id, date, 'media-leak') < mediaChance;
  const id = `rumor-${date}-${String(buyerCode).toLowerCase()}-${++market.rumorSequence}`;
  const rumor = {
    id,
    playerId: player.id,
    buyerCode,
    sellerCode,
    freeAgent,
    group: need.group || player.group,
    position: need.position || null,
    role: need.role || null,
    source,
    status: 'active',
    stage: initialStage,
    createdAt: date,
    updatedAt: date,
    nextActionDate: addWorldDays(date, randomInt(initialStage === 'scouted' ? 1 : 2, initialStage === 'scouted' ? 3 : 5, world.seed, id, 'next')),
    expiresAt: addWorldDays(date, randomInt(14, 28, world.seed, id, 'expiry')),
    readyForApproach: initialStage === 'active-interest',
    heat: +heat.toFixed(3),
    playerInterest: appeal.interest,
    marketValueSnapshot: marketValue,
    mediaVisible,
    needSnapshot: {
      priority: Number(need.priority) || 0,
      reason: need.reason || null,
      expectedPlayingTime: need.expectedPlayingTime || null
    }
  };
  market.rumors.push(rumor);
  appendWorldEvent(world, {
    date,
    type: 'TRANSFER_RUMOUR_STARTED',
    entities: { playerId: player.id, buyerCode, sellerCode, rumorId: id },
    payload: { stage: rumor.stage, source, heat: rumor.heat, mediaVisible },
    visibility: 'system'
  });
  if (mediaVisible) {
    appendWorldEvent(world, {
      date,
      type: 'TRANSFER_INTEREST_REGISTERED',
      entities: { playerId: player.id, buyerCode, sellerCode, rumorId: id },
      payload: { rumor: true, stage: rumor.stage, heat: rumor.heat, marketValue, group: rumor.group, position: rumor.position }
    });
  }
  return rumor;
}

function rumorStillValid({ career, rumor, date, playerById, squadAnalyses }) {
  const world = career.world;
  const player = playerById.get(rumor.playerId);
  if (!player) return { valid: false, reason: 'player-missing' };
  const currentClub = world.employment[player.id] || null;
  if (rumor.freeAgent) {
    if (currentClub) return { valid: false, reason: 'signed-elsewhere' };
  } else if (currentClub !== rumor.sellerCode) {
    return { valid: false, reason: 'player-moved' };
  }
  if (date > rumor.expiresAt) return { valid: false, reason: 'stale-interest' };
  const analysis = squadAnalyses?.[rumor.buyerCode];
  const need = matchingNeed(analysis, rumor);
  if (!need || Number(need.priority) < .12) return { valid: false, reason: 'need-resolved' };
  const buyer = world.clubs[rumor.buyerCode];
  if (!buyer) return { valid: false, reason: 'buyer-missing' };
  if (!rumor.freeAgent && Number(rumor.marketValueSnapshot) > Number(buyer.transferBudget || 0) * 1.05) return { valid: false, reason: 'budget-no-longer-fits' };
  return { valid: true, player, buyer, need };
}

function progressRumor({ career, rumor, date, playerById, squadAnalyses }) {
  const world = career.world;
  if (rumor.status !== 'active') return 'none';
  const formal = activeNegotiation(world, rumor.buyerCode, rumor.playerId);
  if (formal) {
    rumor.status = 'converted';
    rumor.convertedAt = date;
    rumor.negotiationId = formal.id;
    rumor.updatedAt = date;
    rumor.readyForApproach = false;
    return 'converted';
  }
  const validity = rumorStillValid({ career, rumor, date, playerById, squadAnalyses });
  if (!validity.valid) return endRumor(world, rumor, date, validity.reason) ? 'ended' : 'none';
  if (date < rumor.nextActionDate) return 'none';

  const { player, buyer, need } = validity;
  const seller = rumor.freeAgent ? FREE_AGENT_CLUB : world.clubs[rumor.sellerCode];
  const status = rumor.freeAgent ? { ...effectivePlayerStatus(world, player), transferListed: true, squadRole: 'fringe' } : effectivePlayerStatus(world, player);
  const contract = rumor.freeAgent ? { ...effectivePlayerContract(world, player), status: 'expired', endDate: date } : effectivePlayerContract(world, player);
  const appeal = evaluateMoveAppeal({ world, date, player, status, contract, buyerClub: buyer, sellerClub: seller, need });
  rumor.playerInterest = appeal.interest;
  rumor.updatedAt = date;

  if (rumor.stage === 'watching') {
    const budgetStress = rumor.freeAgent ? 0 : clamp(Number(rumor.marketValueSnapshot) / Math.max(1, Number(buyer.transferBudget) || 1), 0, 1.5);
    const coolChance = clamp(.30 - appeal.interest * .22 + Math.max(0, budgetStress - .65) * .30 - Number(need.priority) * .08, .04, .42);
    if (randomUnit(world.seed, date, rumor.id, 'watching-verdict') < coolChance) {
      return endRumor(world, rumor, date, 'scouting-negative') ? 'ended' : 'none';
    }
    rumor.stage = 'scouted';
    rumor.heat = +clamp(rumor.heat + .10 + appeal.interest * .08, .2, .94).toFixed(3);
    rumor.nextActionDate = addWorldDays(date, randomInt(2, 5, world.seed, rumor.id, 'scouted-next'));
    appendWorldEvent(world, { date, type: 'TRANSFER_RUMOUR_SCOUTED', entities: { playerId: player.id, buyerCode: buyer.code, sellerCode: rumor.sellerCode, rumorId: rumor.id }, payload: { heat: rumor.heat }, visibility: 'system' });
    return 'scouted';
  }

  if (rumor.stage === 'scouted') {
    const progressScore = appeal.interest * .52 + Number(need.priority) * .31 + rumor.heat * .17;
    const threshold = .45 + randomUnit(world.seed, date, rumor.id, 'active-threshold') * .18;
    if (progressScore < threshold) {
      return endRumor(world, rumor, date, 'club-chose-other-options') ? 'ended' : 'none';
    }
    rumor.stage = 'active-interest';
    rumor.readyForApproach = true;
    rumor.heat = +clamp(rumor.heat + .14, .25, 1).toFixed(3);
    rumor.nextActionDate = addWorldDays(date, randomInt(3, 7, world.seed, rumor.id, 'hot-next'));
    appendWorldEvent(world, { date, type: 'TRANSFER_RUMOUR_HEATS_UP', entities: { playerId: player.id, buyerCode: buyer.code, sellerCode: rumor.sellerCode, rumorId: rumor.id }, payload: { heat: rumor.heat }, visibility: 'system' });
    return 'heated';
  }

  if (rumor.stage === 'active-interest') {
    const patience = Number(buyer.managerBrain?.negotiationPatience) || .58;
    const coolChance = clamp(.05 + patience * .06 - Number(need.priority) * .05, .025, .12);
    if (randomUnit(world.seed, date, rumor.id, 'hot-patience') < coolChance) {
      return endRumor(world, rumor, date, 'interest-cooled') ? 'ended' : 'none';
    }
    rumor.heat = +clamp(rumor.heat + .015, .25, 1).toFixed(3);
    rumor.nextActionDate = addWorldDays(date, randomInt(3, 6, world.seed, rumor.id, 'remain-hot'));
  }
  return 'none';
}

function seedRumors({ career, date, playerById, squadAnalyses }) {
  const world = career.world;
  const window = transferWindowState(date);
  if (!window.open) return 0;
  const queue = Object.entries(squadAnalyses || {})
    .filter(([clubCode]) => clubCode !== career.clubCode)
    .map(([clubCode, analysis]) => {
      const need = requirementRows(analysis)[0] || null;
      const noise = randomUnit(world.seed, date, clubCode, need?.position || need?.group || 'none', 'rumor-queue') * .10;
      return { clubCode, analysis, need, score: Number(need?.priority) + noise };
    })
    .filter(row => row.need)
    .sort((left, right) => right.score - left.score || left.clubCode.localeCompare(right.clubCode));
  const cap = Math.min(18, Math.max(2, Math.ceil(Object.keys(world.clubs || {}).length / 55)));
  let started = 0;
  for (const row of queue) {
    if (started >= cap) break;
    const { clubCode, need } = row;
    if (activeNegotiation(world, clubCode) || existingRumor(world, clubCode, null, need)) continue;
    const cooldownKey = `${clubCode}:${need.position || need.group}`;
    const cooldown = world.transferMarket.rumorCooldowns[cooldownKey];
    if (cooldown && cooldown > date) continue;
    const club = world.clubs[clubCode];
    const scoutingBias = Number(club?.brain?.recruitment?.tacticalFitWeight) || .62;
    const probability = clamp((.055 + Number(need.priority) * .22 + scoutingBias * .04) * Math.min(1.16, window.urgency), .04, .34);
    if (randomUnit(world.seed, date, clubCode, need.position || need.group, 'start-rumor') >= probability) continue;
    const target = chooseRecruitmentTarget({ world, date, buyerCode: clubCode, need, playerById, ignoreRumorPreference: true });
    if (!target) continue;
    const key = `${clubCode}:${target.player.id}`;
    if (world.transferMarket.rumorCooldowns[key] && world.transferMarket.rumorCooldowns[key] > date) continue;
    if (registerRumor({ career, date, buyerCode: clubCode, need, target })) started += 1;
  }
  return started;
}

function seedCompetition({ career, date, playerById, squadAnalyses }) {
  const world = career.world;
  let started = 0;
  const hot = (world.transferMarket.rumors || [])
    .filter(rumor => rumor.status === 'active' && rumor.stage === 'active-interest')
    .sort((left, right) => right.heat - left.heat || left.id.localeCompare(right.id));
  for (const lead of hot) {
    if (started >= 2) break;
    const player = playerById.get(lead.playerId);
    if (!player) continue;
    const currentCompetitors = (world.transferMarket.rumors || []).filter(rumor => rumor.status === 'active' && rumor.playerId === player.id).length;
    if (currentCompetitors >= 3) continue;
    const starFactor = Math.max(0, (Number(player.rating) || 70) - 78) * .012;
    const probability = clamp(.035 + lead.heat * .08 + starFactor, .03, .22);
    if (randomUnit(world.seed, date, lead.id, 'competition-spawn') >= probability) continue;
    const competitors = findRumorCompetitors({ world, date, leadRumor: lead, player, squadAnalyses, userClubCode: career.clubCode });
    const candidate = competitors[0];
    if (!candidate) continue;
    const target = { player, marketValue: lead.marketValueSnapshot, freeAgent: lead.freeAgent };
    const rumor = registerRumor({ career, date, buyerCode: candidate.clubCode, need: candidate.need, target, source: 'market-competition', initialStage: 'scouted' });
    if (rumor) started += 1;
  }
  return started;
}

export function reconcileRumorsAfterTransfers({ career, date }) {
  const world = career.world;
  ensureRumorMarket(world);
  let converted = 0;
  let ended = 0;
  for (const rumor of world.transferMarket.rumors) {
    if (rumor.status !== 'active') continue;
    const formal = activeNegotiation(world, rumor.buyerCode, rumor.playerId);
    if (formal) {
      rumor.status = 'converted';
      rumor.convertedAt = date;
      rumor.negotiationId = formal.id;
      rumor.updatedAt = date;
      rumor.readyForApproach = false;
      converted += 1;
      continue;
    }
    const currentClub = world.employment[rumor.playerId] || null;
    if ((!rumor.freeAgent && currentClub !== rumor.sellerCode) || (rumor.freeAgent && currentClub)) {
      if (endRumor(world, rumor, date, 'player-moved')) ended += 1;
    }
  }
  for (const playerId of Object.keys(world.freeAgents || {})) {
    if (world.employment[playerId]) delete world.freeAgents[playerId];
  }
  rebuildCompetitionIndex(world);
  return { converted, ended };
}

export function processRumorMarketDay({ career, date, playerById, squadAnalyses }) {
  const world = career.world;
  ensureRumorMarket(world);
  const summary = { started: 0, scouted: 0, heated: 0, ended: 0, converted: 0, competitionStarted: 0, active: 0 };
  for (const rumor of world.transferMarket.rumors) {
    const result = progressRumor({ career, rumor, date, playerById, squadAnalyses });
    if (result === 'scouted') summary.scouted += 1;
    else if (result === 'heated') summary.heated += 1;
    else if (result === 'ended') summary.ended += 1;
    else if (result === 'converted') summary.converted += 1;
  }
  summary.started = seedRumors({ career, date, playerById, squadAnalyses });
  summary.competitionStarted = seedCompetition({ career, date, playerById, squadAnalyses });
  rebuildCompetitionIndex(world);
  summary.active = world.transferMarket.rumors.filter(rumor => rumor.status === 'active').length;
  return summary;
}

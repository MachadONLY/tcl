import { seededRandom } from '../../career-core/career-core.js';
import { TEAM_ELO } from '../../career-core/season-2026-27-live.js';
import { daysBetween } from '../world-time.js';
import { positionBucket } from './squad-analysis.js';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

const FORMATION_SLOTS = Object.freeze({
  'positional-possession': Object.freeze(['GK', 'CB', 'CB', 'FB', 'FB', 'DM', 'CM', 'CM', 'W', 'W', 'ST']),
  'high-press-vertical': Object.freeze(['GK', 'CB', 'CB', 'FB', 'FB', 'DM', 'CM', 'CM', 'W', 'W', 'ST']),
  'transition-attack': Object.freeze(['GK', 'CB', 'CB', 'FB', 'FB', 'DM', 'CM', 'CM', 'W', 'W', 'ST']),
  'compact-control': Object.freeze(['GK', 'CB', 'CB', 'FB', 'FB', 'DM', 'DM', 'CM', 'W', 'W', 'ST']),
  'direct-physical': Object.freeze(['GK', 'CB', 'CB', 'FB', 'FB', 'CM', 'CM', 'W', 'W', 'ST', 'ST']),
  balanced: Object.freeze(['GK', 'CB', 'CB', 'FB', 'FB', 'DM', 'CM', 'CM', 'W', 'W', 'ST'])
});

const FORMATION_LABEL = Object.freeze({
  'positional-possession': '4-3-3',
  'high-press-vertical': '4-3-3',
  'transition-attack': '4-2-3-1',
  'compact-control': '4-2-3-1',
  'direct-physical': '4-4-2',
  balanced: '4-2-3-1'
});

function recentStarts(career, clubCode, playerId, fixtureDate) {
  let starts = 0;
  let lastStartDate = null;
  for (const result of Object.values(career.results || {})) {
    if (!result?.date || result.date >= fixtureDate || daysBetween(result.date, fixtureDate) > 14) continue;
    const side = result.home === clubCode ? 'home' : result.away === clubCode ? 'away' : null;
    if (!side || !result.lineups?.[side]?.includes(playerId)) continue;
    starts += 1;
    if (!lastStartDate || result.date > lastStartDate) lastStartDate = result.date;
  }
  return { starts, lastStartDate };
}

function fixtureImportance(career, clubCode, fixture) {
  const own = Number(TEAM_ELO[clubCode]) || Number(career.world?.clubs?.[clubCode]?.elo) || 1750;
  const opponentCode = fixture.home === clubCode ? fixture.away : fixture.home;
  const opponent = Number(TEAM_ELO[opponentCode]) || Number(career.world?.clubs?.[opponentCode]?.elo) || 1750;
  const strength = clamp(.56 + (opponent - own) / 900, .34, .84);
  const month = Number(String(fixture.date).slice(5, 7));
  const lateSeason = month >= 4 && month <= 5 ? .10 : 0;
  return clamp(strength + lateSeason, .30, .94);
}

function selectionScore(career, clubCode, player, fixture, managerBrain, importance) {
  const rating = Number(player.rating) || 60;
  const potential = Math.max(rating, Number(player.potential) || rating);
  const age = Number(player.age) || 24;
  const status = career.world?.playerStatus?.[player.id] || {};
  const history = recentStarts(career, clubCode, player.id, fixture.date);
  const rotation = Number(managerBrain?.rotation) || .55;
  const youthTrust = Number(managerBrain?.youthTrust) || .55;
  const role = status.squadRole || 'rotation';
  const roleBoost = role === 'key' ? 5.2 : role === 'important' ? 2.9 : role === 'rotation' ? 1.0 : role === 'prospect' ? -.3 : -1.4;
  const youthBoost = age <= 21 ? Math.max(0, potential - rating) * .35 * youthTrust + youthTrust * 2.2 : 0;
  const consecutivePenalty = history.starts * (1.4 + rotation * 2.6) * (1.12 - importance * .35);
  const latestPenalty = history.lastStartDate && daysBetween(history.lastStartDate, fixture.date) <= 3 ? 2.4 + rotation * 2.2 : 0;
  const importanceBoost = importance * (role === 'key' ? 3.0 : role === 'important' ? 1.4 : 0);
  const random = seededRandom(`${career.world?.seed}:${fixture.id}:${clubCode}:${player.id}:selection`)();
  return rating + roleBoost + youthBoost + importanceBoost - consecutivePenalty - latestPenalty + (random - .5) * 1.2;
}

function bestForSlot(career, clubCode, pool, slot, fixture, managerBrain, importance) {
  const exact = pool.filter(player => positionBucket(player) === slot);
  const groupFallback = slot === 'CB' || slot === 'FB'
    ? pool.filter(player => player.group === 'DEF')
    : slot === 'DM' || slot === 'CM' || slot === 'W'
      ? pool.filter(player => player.group === 'MID')
      : slot === 'ST'
        ? pool.filter(player => player.group === 'FWD')
        : pool.filter(player => player.group === 'GK');
  const candidates = exact.length ? exact : groupFallback.length ? groupFallback : pool;
  return [...candidates].sort((left, right) =>
    selectionScore(career, clubCode, right, fixture, managerBrain, importance)
    - selectionScore(career, clubCode, left, fixture, managerBrain, importance)
  )[0] || null;
}

export function selectAiLineup(career, clubCode, players = [], fixture) {
  const club = career.world?.clubs?.[clubCode] || {};
  const managerBrain = club.managerBrain || {};
  const style = club.brain?.tacticalIdentity?.style || 'balanced';
  const slots = FORMATION_SLOTS[style] || FORMATION_SLOTS.balanced;
  const importance = fixtureImportance(career, clubCode, fixture);
  const pool = [...players];
  const selected = [];
  for (const slot of slots) {
    const player = bestForSlot(career, clubCode, pool, slot, fixture, managerBrain, importance);
    if (!player) continue;
    selected.push(player);
    pool.splice(pool.indexOf(player), 1);
  }
  while (selected.length < 11 && pool.length) {
    pool.sort((left, right) =>
      selectionScore(career, clubCode, right, fixture, managerBrain, importance)
      - selectionScore(career, clubCode, left, fixture, managerBrain, importance)
    );
    selected.push(pool.shift());
  }
  return {
    players: selected.slice(0, 11),
    style,
    formation: FORMATION_LABEL[style] || '4-2-3-1',
    managerName: managerBrain.managerName || club.brain?.managerName || 'AI Manager',
    importance
  };
}

export function aiTacticalPlan(career, clubCode, fixture, home = false) {
  const club = career.world?.clubs?.[clubCode] || {};
  const brain = club.brain || {};
  const manager = club.managerBrain || {};
  const style = brain.tacticalIdentity?.style || 'balanced';
  const ownElo = Number(club.elo) || Number(TEAM_ELO[clubCode]) || 1750;
  const opponentCode = fixture.home === clubCode ? fixture.away : fixture.home;
  const opponentElo = Number(career.world?.clubs?.[opponentCode]?.elo) || Number(TEAM_ELO[opponentCode]) || 1750;
  const delta = ownElo - opponentElo + (home ? 32 : 0);
  const risk = Number(manager.riskTolerance) || .58;
  const cautious = delta < -130 && risk < .65;
  const superior = delta > 150;
  const styleSettings = {
    'positional-possession': { pressing: 70, tempo: 63, defensiveLine: 68, width: 62, defensiveWidth: 55, buildUp: 'Curta', chanceCreation: 'Combinação curta', afterLoss: 'Contrapressão', afterWin: 'Segurar a bola', defensiveShape: 'Bloco alto', freedom: 'Fluida' },
    'high-press-vertical': { pressing: 80, tempo: 76, defensiveLine: 70, width: 59, defensiveWidth: 52, buildUp: 'Equilibrada', chanceCreation: 'Infiltrações', afterLoss: 'Contrapressão', afterWin: 'Contra-atacar', defensiveShape: 'Bloco alto', freedom: 'Fluida' },
    'transition-attack': { pressing: 64, tempo: 75, defensiveLine: 55, width: 62, defensiveWidth: 50, buildUp: 'Direta', chanceCreation: 'Infiltrações', afterLoss: 'Contextual', afterWin: 'Contra-atacar', defensiveShape: 'Bloco médio', freedom: 'Equilibrada' },
    'compact-control': { pressing: 58, tempo: 56, defensiveLine: 52, width: 52, defensiveWidth: 46, buildUp: 'Equilibrada', chanceCreation: 'Combinação curta', afterLoss: 'Recompor', afterWin: 'Contextual', defensiveShape: 'Bloco médio', freedom: 'Estruturada' },
    'direct-physical': { pressing: 58, tempo: 72, defensiveLine: 46, width: 68, defensiveWidth: 56, buildUp: 'Direta', chanceCreation: 'Cruzamentos', afterLoss: 'Recompor', afterWin: 'Contra-atacar', defensiveShape: 'Bloco médio', freedom: 'Estruturada' },
    balanced: { pressing: 62, tempo: 64, defensiveLine: 58, width: 56, defensiveWidth: 52, buildUp: 'Equilibrada', chanceCreation: 'Combinação curta', afterLoss: 'Contextual', afterWin: 'Contextual', defensiveShape: 'Bloco médio', freedom: 'Equilibrada' }
  }[style] || {};
  let mentality = superior ? 'Positiva' : cautious ? 'Cautelosa' : delta > 40 || risk > .72 ? 'Positiva' : 'Equilibrada';
  const adjustment = cautious ? -7 : superior && risk > .65 ? 4 : 0;
  return {
    ...styleSettings,
    pressing: clamp((styleSettings.pressing || 62) + adjustment, 35, 88),
    tempo: clamp((styleSettings.tempo || 64) + (cautious ? -5 : superior ? 2 : 0), 36, 86),
    defensiveLine: clamp((styleSettings.defensiveLine || 58) + adjustment, 35, 82),
    mentality,
    attackingFocus: 'Equilibrado',
    distribution: style === 'direct-physical' ? 'Longa' : style === 'positional-possession' ? 'Curta' : 'Meio',
    pressingTrap: 'Equilibrada',
    tackling: style === 'high-press-vertical' ? 'Agressivo' : 'Normal',
    marking: 'Zona',
    offsideTrap: ['positional-possession', 'high-press-vertical'].includes(style),
    style,
    formation: FORMATION_LABEL[style] || '4-2-3-1',
    managerName: manager.managerName || 'AI Manager',
    importance: fixtureImportance(career, clubCode, fixture)
  };
}

import {
  CAREER_START_DATE, CLUB_BY_CODE, CLUB_CATALOG, FIXTURES, RATING_OVERRIDES,
  RATING_SOURCE, ROSTER_SOURCE, SEASON_END_DATE, SEASON_ID, SEASON_LABEL,
  TEAM_BUDGETS, TEAM_ELO, rosterRowsFor
} from './season-2026-27-live.js';

export const SAVE_ID = 'primary';
const DAY = 86400000;
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const avg = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const clone = value => JSON.parse(JSON.stringify(value));

export const FORMATION_SHAPES = Object.freeze({
  '4-2-3-1': Object.freeze({ GK: 1, DEF: 4, MID: 5, FWD: 1 }),
  '4-3-3': Object.freeze({ GK: 1, DEF: 4, MID: 3, FWD: 3 }),
  '3-4-2-1': Object.freeze({ GK: 1, DEF: 3, MID: 6, FWD: 1 }),
  '4-4-2': Object.freeze({ GK: 1, DEF: 4, MID: 4, FWD: 2 }),
  '4-1-4-1': Object.freeze({ GK: 1, DEF: 4, MID: 5, FWD: 1 }),
  '3-5-2': Object.freeze({ GK: 1, DEF: 3, MID: 5, FWD: 2 }),
  '5-3-2': Object.freeze({ GK: 1, DEF: 5, MID: 3, FWD: 2 })
});

export const TACTIC_OPTIONS = Object.freeze({
  mentality: Object.freeze(['Defensiva', 'Cautelosa', 'Equilibrada', 'Positiva', 'Ofensiva']),
  buildUp: Object.freeze(['Curta', 'Equilibrada', 'Direta']),
  chanceCreation: Object.freeze(['Combinação curta', 'Infiltrações', 'Cruzamentos', 'Finalizar cedo']),
  attackingFocus: Object.freeze(['Esquerda', 'Centro', 'Equilibrado', 'Direita']),
  freedom: Object.freeze(['Estruturada', 'Equilibrada', 'Fluida']),
  afterLoss: Object.freeze(['Recompor', 'Contextual', 'Contrapressão']),
  afterWin: Object.freeze(['Segurar a bola', 'Contextual', 'Contra-atacar']),
  distribution: Object.freeze(['Curta', 'Laterais', 'Meio', 'Longa']),
  defensiveShape: Object.freeze(['Bloco baixo', 'Bloco médio', 'Bloco alto']),
  pressingTrap: Object.freeze(['Equilibrada', 'Forçar por dentro', 'Forçar por fora']),
  tackling: Object.freeze(['Cauteloso', 'Normal', 'Agressivo']),
  marking: Object.freeze(['Zona', 'Mista', 'Individual'])
});

const ROLE_CATALOG = Object.freeze({
  GK: Object.freeze(['Goleiro', 'Goleiro líbero']),
  DEF: Object.freeze(['Zagueiro', 'Zagueiro construtor', 'Zagueiro de cobertura', 'Lateral', 'Ala', 'Lateral invertido']),
  MID: Object.freeze(['Volante', 'Organizador recuado', 'Meia área a área', 'Meia criativo', 'Meia aberto', 'Ponta', 'Ponta invertido']),
  FWD: Object.freeze(['Centroavante', 'Atacante móvel', 'Falso 9', 'Finalizador', 'Segundo atacante'])
});

export const PLAYER_ROLE_OPTIONS = ROLE_CATALOG;

const BALANCED_PLAN = Object.freeze({
  mentality: 'Equilibrada', pressing: 62, tempo: 64, width: 56, defensiveLine: 58,
  buildUp: 'Equilibrada', chanceCreation: 'Combinação curta', attackingFocus: 'Equilibrado',
  freedom: 'Equilibrada', afterLoss: 'Contextual', afterWin: 'Contextual', distribution: 'Curta',
  defensiveShape: 'Bloco médio', defensiveWidth: 52, pressingTrap: 'Equilibrada',
  tackling: 'Normal', marking: 'Zona', offsideTrap: false
});

const ATTACKING_PLAN = Object.freeze({
  ...BALANCED_PLAN,
  mentality: 'Ofensiva', pressing: 78, tempo: 78, width: 64, defensiveLine: 72,
  buildUp: 'Curta', chanceCreation: 'Infiltrações', freedom: 'Fluida',
  afterLoss: 'Contrapressão', afterWin: 'Contra-atacar', defensiveShape: 'Bloco alto'
});

const DEFENSIVE_PLAN = Object.freeze({
  ...BALANCED_PLAN,
  mentality: 'Cautelosa', pressing: 44, tempo: 46, width: 48, defensiveLine: 42,
  buildUp: 'Direta', chanceCreation: 'Cruzamentos', freedom: 'Estruturada',
  afterLoss: 'Recompor', afterWin: 'Contra-atacar', distribution: 'Longa',
  defensiveShape: 'Bloco baixo', defensiveWidth: 46
});

function defaultRoles() {
  return {};
}

export function defaultTactics() {
  return {
    ...clone(BALANCED_PLAN),
    activePlan: 'A',
    plans: {
      A: clone(BALANCED_PLAN),
      B: clone(ATTACKING_PLAN),
      C: clone(DEFENSIVE_PLAN)
    },
    roles: defaultRoles()
  };
}

function normalizePlan(plan, fallback = BALANCED_PLAN) {
  const source = { ...fallback, ...(plan || {}) };
  return {
    mentality: TACTIC_OPTIONS.mentality.includes(source.mentality) ? source.mentality : fallback.mentality,
    pressing: clamp(Number(source.pressing) || fallback.pressing, 20, 90),
    tempo: clamp(Number(source.tempo) || fallback.tempo, 20, 90),
    width: clamp(Number(source.width) || fallback.width, 20, 90),
    defensiveLine: clamp(Number(source.defensiveLine) || fallback.defensiveLine, 20, 90),
    buildUp: TACTIC_OPTIONS.buildUp.includes(source.buildUp) ? source.buildUp : fallback.buildUp,
    chanceCreation: TACTIC_OPTIONS.chanceCreation.includes(source.chanceCreation) ? source.chanceCreation : fallback.chanceCreation,
    attackingFocus: TACTIC_OPTIONS.attackingFocus.includes(source.attackingFocus) ? source.attackingFocus : fallback.attackingFocus,
    freedom: TACTIC_OPTIONS.freedom.includes(source.freedom) ? source.freedom : fallback.freedom,
    afterLoss: TACTIC_OPTIONS.afterLoss.includes(source.afterLoss) ? source.afterLoss : fallback.afterLoss,
    afterWin: TACTIC_OPTIONS.afterWin.includes(source.afterWin) ? source.afterWin : fallback.afterWin,
    distribution: TACTIC_OPTIONS.distribution.includes(source.distribution) ? source.distribution : fallback.distribution,
    defensiveShape: TACTIC_OPTIONS.defensiveShape.includes(source.defensiveShape) ? source.defensiveShape : fallback.defensiveShape,
    defensiveWidth: clamp(Number(source.defensiveWidth) || fallback.defensiveWidth, 20, 90),
    pressingTrap: TACTIC_OPTIONS.pressingTrap.includes(source.pressingTrap) ? source.pressingTrap : fallback.pressingTrap,
    tackling: TACTIC_OPTIONS.tackling.includes(source.tackling) ? source.tackling : fallback.tackling,
    marking: TACTIC_OPTIONS.marking.includes(source.marking) ? source.marking : fallback.marking,
    offsideTrap: Boolean(source.offsideTrap)
  };
}

export function normalizeTactics(tactics = {}) {
  const defaults = defaultTactics();
  const activePlan = ['A', 'B', 'C'].includes(tactics.activePlan) ? tactics.activePlan : 'A';
  const plans = {
    A: normalizePlan(tactics.plans?.A || tactics, BALANCED_PLAN),
    B: normalizePlan(tactics.plans?.B, ATTACKING_PLAN),
    C: normalizePlan(tactics.plans?.C, DEFENSIVE_PLAN)
  };
  const active = normalizePlan({ ...plans[activePlan], ...tactics }, plans[activePlan]);
  plans[activePlan] = { ...active };
  return {
    ...active,
    activePlan,
    plans,
    roles: tactics.roles && typeof tactics.roles === 'object' ? clone(tactics.roles) : defaults.roles
  };
}

export function hashString(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seededRandom(seed) {
  let state = hashString(seed) || 0x9e3779b9;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function addDays(date, number = 1) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day) + number * DAY).toISOString().slice(0, 10);
}

export function formatDate(date, short = false) {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC', day: '2-digit', month: short ? 'short' : 'long', year: 'numeric'
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatMoney(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'GBP', notation: 'compact', maximumFractionDigits: 1
  }).format(value || 0);
}

function finePosition(group, seed) {
  const positions = {
    GK: ['GK'], DEF: ['CB', 'CB', 'RB', 'LB'], MID: ['CM', 'CDM', 'CAM', 'RW', 'LW'], FWD: ['ST', 'ST', 'CF', 'LW']
  }[group] || ['CM'];
  return positions[seed % positions.length];
}

function rowData(row) {
  return Array.isArray(row) ? { name: row[0], group: row[1] } : (row || {});
}

function makePlayer(code, row, index) {
  const data = rowData(row);
  const name = String(data.name || '');
  const group = String(data.group || 'MID');
  const seed = hashString(`${code}:${name}`);
  const base = Math.round(68 + (TEAM_ELO[code] - 1500) / 43);
  const published = Number(data.rating);
  const rating = Number.isFinite(published) && published >= 40 && published <= 99
    ? published
    : RATING_OVERRIDES[name] || clamp(base + (seed % 9) - 4 + (group === 'FWD' ? 1 : 0), 58, 92);
  const publishedAge = Number(data.age);
  const age = Number.isFinite(publishedAge) && publishedAge >= 16 && publishedAge <= 45 ? publishedAge : 18 + (seed % 17);
  const potential = clamp(rating + (age < 21 ? 7 : age < 24 ? 4 : age < 27 ? 2 : 0), rating, 93);
  const factor = age < 23 ? 1.35 : age < 27 ? 1.12 : age < 31 ? 0.88 : 0.58;
  const publishedNumber = Number(data.number);
  const number = Number.isFinite(publishedNumber) && publishedNumber > 0 && publishedNumber < 100
    ? publishedNumber
    : group === 'GK' && index === 0 ? 1 : 2 + seed % 97;
  const position = String(data.position || finePosition(group, seed)).split(',').map(value => value.trim()).filter(Boolean).join(', ');
  return Object.freeze({
    id: `${code.toLowerCase()}-${index + 1}-${seed.toString(36).slice(0, 4)}`,
    clubCode: code, name, group, position, age, rating, potential,
    value: Math.max(750000, Math.round(Math.pow(rating - 58, 2.12) * 90000 * factor / 250000) * 250000),
    wage: Math.max(8000, Math.round((rating * rating * 18 + seed % 22000) / 1000) * 1000),
    number, fotmobId: data.fotmobId || null, eaPlayerId: data.eaPlayerId || null,
    ratingSource: data.ratingSource || RATING_SOURCE, rosterSource: ROSTER_SOURCE
  });
}

export const SQUADS = Object.freeze(Object.fromEntries(
  CLUB_CATALOG.map(club => [club.code, Object.freeze(rosterRowsFor(club.code).map((row, index) => makePlayer(club.code, row, index)))])
));
export const PLAYER_BY_ID = new Map(Object.values(SQUADS).flat().map(player => [player.id, player]));
export const squadFor = code => SQUADS[code] || [];

function initialPlayerState(code) {
  return Object.fromEntries(squadFor(code).map(player => [player.id, {
    condition: 92 + hashString(`${player.id}:c`) % 9,
    sharpness: 72 + hashString(`${player.id}:s`) % 25,
    morale: 74 + hashString(`${player.id}:m`) % 23
  }]));
}

export function autoPickLineup(code, formation = '4-2-3-1', states = {}) {
  const shape = FORMATION_SHAPES[formation] || FORMATION_SHAPES['4-2-3-1'];
  const pool = [...squadFor(code)].sort((a, b) =>
    b.rating * ((states[b.id]?.condition || 100) / 100) - a.rating * ((states[a.id]?.condition || 100) / 100)
  );
  const selected = [];
  for (const group of ['GK', 'DEF', 'MID', 'FWD']) {
    selected.push(...pool.filter(player => player.group === group).slice(0, shape[group]));
  }
  selected.push(...pool.filter(player => !selected.includes(player)).slice(0, 11 - selected.length));
  return selected.slice(0, 11).map(player => player.id);
}

export function createCareer(code = 'MUN', now = new Date().toISOString()) {
  const club = CLUB_BY_CODE.get(code) || CLUB_CATALOG[0];
  const playerState = initialPlayerState(club.code);
  const formation = '4-2-3-1';
  return {
    schemaVersion: 3,
    saveId: SAVE_ID,
    seasonId: SEASON_ID,
    seasonLabel: SEASON_LABEL,
    clubCode: club.code,
    managerName: 'Gabriel Machado',
    createdAt: now,
    updatedAt: now,
    currentDate: CAREER_START_DATE,
    status: 'active',
    formation,
    lineup: autoPickLineup(club.code, formation, playerState),
    tactics: defaultTactics(),
    trainingFocus: 'Equilibrado',
    transferBudget: TEAM_BUDGETS[club.code],
    wageBudget: Math.round(TEAM_BUDGETS[club.code] * 0.009),
    boardConfidence: 70,
    objectives: [
      club.elo >= 1950 ? 'Disputar o título da Premier League' : club.elo >= 1850 ? 'Classificar para competições europeias' : club.elo >= 1750 ? 'Terminar na metade superior' : 'Evitar o rebaixamento',
      'Desenvolver dois jogadores sub-23',
      'Manter as finanças sob controle'
    ],
    results: {}, playerState, playerStats: {}, recentForm: [],
    inbox: [
      { id: 'welcome', date: CAREER_START_DATE, sender: 'Diretoria', subject: `Bem-vindo ao ${club.name}`, body: 'Você tem onze dias para preparar o elenco antes da estreia da Premier League.', read: false },
      { id: 'pack', date: CAREER_START_DATE, sender: 'Analista', subject: 'Pacote 2026/27 carregado', body: 'Os 380 jogos, vinte clubes e elencos completos do FotMob estão disponíveis offline.', read: false }
    ],
    news: [], seasonSummary: null
  };
}

export function normalizeCareer(career, code = 'MUN') {
  if (!career || ![2, 3].includes(career.schemaVersion) || !CLUB_BY_CODE.has(career.clubCode)) return createCareer(code);
  const base = createCareer(career.clubCode, career.createdAt);
  const states = { ...base.playerState, ...(career.playerState || {}) };
  return {
    ...base,
    ...career,
    schemaVersion: 3,
    tactics: normalizeTactics(career.tactics),
    playerState: states,
    results: career.results || {},
    playerStats: career.playerStats || {},
    inbox: Array.isArray(career.inbox) ? career.inbox : base.inbox,
    recentForm: Array.isArray(career.recentForm) ? career.recentForm : [],
    lineup: Array.isArray(career.lineup) && career.lineup.filter(id => PLAYER_BY_ID.has(id)).length === 11
      ? career.lineup
      : autoPickLineup(career.clubCode, career.formation, states)
  };
}

export const userFixtures = career => FIXTURES.filter(fixture => fixture.home === career.clubCode || fixture.away === career.clubCode);
export const fixturesOnDate = date => FIXTURES.filter(fixture => fixture.date === date);
export const nextUserFixture = career => userFixtures(career).find(fixture => !career.results[fixture.id]) || null;

function mentalityValue(value) {
  return { Defensiva: -1.2, Cautelosa: -0.6, Equilibrada: 0, Positiva: 0.55, Ofensiva: 1.05 }[value] || 0;
}

function roleFamily(role, group) {
  if (/construtor|organizador|criativo|falso/i.test(role)) return 'creator';
  if (/ala|lateral|ponta|aberto/i.test(role)) return 'wide';
  if (/cobertura|volante|zagueiro|goleiro/i.test(role)) return 'protector';
  if (/finalizador|centroavante|segundo|móvel/i.test(role)) return 'runner';
  return group === 'FWD' ? 'runner' : group === 'DEF' ? 'protector' : 'connector';
}

function defaultRoleFor(player) {
  const position = String(player.position || '').toUpperCase();
  if (player.group === 'GK') return position.includes('GK') ? 'Goleiro' : 'Goleiro líbero';
  if (player.group === 'DEF') {
    if (/RB|LB|RWB|LWB/.test(position)) return /RWB|LWB/.test(position) ? 'Ala' : 'Lateral';
    return 'Zagueiro';
  }
  if (player.group === 'MID') {
    if (/RW|LW|RM|LM/.test(position)) return 'Ponta';
    if (/AM|CAM/.test(position)) return 'Meia criativo';
    if (/DM|CDM/.test(position)) return 'Volante';
    return 'Meia área a área';
  }
  return /CF|SS/.test(position) ? 'Atacante móvel' : 'Centroavante';
}

function roleFit(player, assignment) {
  const role = assignment?.role || defaultRoleFor(player);
  const focus = assignment?.focus || 'Apoiar';
  const family = roleFamily(role, player.group);
  const position = String(player.position || '').toUpperCase();
  let fit = 0.72;
  if (player.group === 'GK' && /Goleiro/.test(role)) fit = 0.92;
  if (player.group === 'DEF' && /Zagueiro/.test(role) && /CB/.test(position)) fit = 0.94;
  if (player.group === 'DEF' && /Lateral|Ala/.test(role) && /RB|LB|RWB|LWB/.test(position)) fit = 0.93;
  if (player.group === 'MID' && /Volante|recuado/.test(role) && /DM|CDM|CM/.test(position)) fit = 0.91;
  if (player.group === 'MID' && /criativo/.test(role) && /AM|CAM|CM/.test(position)) fit = 0.9;
  if (/Ponta/.test(role) && /RW|LW|RM|LM/.test(position)) fit = 0.93;
  if (player.group === 'FWD' && /Centroavante|Finalizador/.test(role) && /ST|CF/.test(position)) fit = 0.94;
  if (focus === 'Atacar' && family === 'protector') fit -= 0.04;
  if (focus === 'Defender' && family === 'runner') fit -= 0.05;
  return clamp(fit, 0.58, 0.98);
}

function aiTactics(code) {
  const elo = TEAM_ELO[code] || 1750;
  const elite = elo >= 1900;
  const underdog = elo < 1700;
  return normalizeTactics({
    ...BALANCED_PLAN,
    mentality: elite ? 'Positiva' : underdog ? 'Cautelosa' : 'Equilibrada',
    pressing: clamp(54 + Math.round((elo - 1750) / 15), 38, 78),
    tempo: clamp(58 + Math.round((elo - 1750) / 20), 44, 76),
    defensiveLine: clamp(52 + Math.round((elo - 1750) / 18), 38, 72),
    buildUp: elite ? 'Curta' : underdog ? 'Direta' : 'Equilibrada',
    afterLoss: elite ? 'Contrapressão' : underdog ? 'Recompor' : 'Contextual',
    afterWin: underdog ? 'Contra-atacar' : 'Contextual'
  });
}

function tacticalModel(tactics, players) {
  const t = normalizeTactics(tactics);
  const mentality = mentalityValue(t.mentality);
  const directness = t.buildUp === 'Direta' ? 1 : t.buildUp === 'Curta' ? -1 : 0;
  const counter = t.afterWin === 'Contra-atacar' ? 1 : t.afterWin === 'Segurar a bola' ? -1 : 0;
  const counterPress = t.afterLoss === 'Contrapressão' ? 1 : t.afterLoss === 'Recompor' ? -1 : 0;
  const fluidity = t.freedom === 'Fluida' ? 1 : t.freedom === 'Estruturada' ? -1 : 0;
  const roleEntries = players.map(player => ({ player, assignment: t.roles?.[player.id] || {}, fit: roleFit(player, t.roles?.[player.id]) }));
  const averageFit = avg(roleEntries.map(entry => entry.fit));
  const creators = roleEntries.filter(entry => ['creator', 'connector'].includes(roleFamily(entry.assignment.role || defaultRoleFor(entry.player), entry.player.group))).length;
  const runners = roleEntries.filter(entry => roleFamily(entry.assignment.role || defaultRoleFor(entry.player), entry.player.group) === 'runner').length;
  const protectors = roleEntries.filter(entry => roleFamily(entry.assignment.role || defaultRoleFor(entry.player), entry.player.group) === 'protector').length;
  const attackers = roleEntries.filter(entry => entry.assignment.focus === 'Atacar').length;
  const defenders = roleEntries.filter(entry => entry.assignment.focus === 'Defender').length;
  const intensity = clamp((t.pressing * 0.48 + t.tempo * 0.34 + t.defensiveLine * 0.18) / 100 + counterPress * 0.08, 0.35, 1.12);
  const control = clamp(0.5 + (70 - t.tempo) / 180 - directness * 0.09 + creators * 0.013 + averageFit * 0.16, 0.35, 0.85);
  const progression = clamp(0.47 + t.tempo / 260 + directness * 0.08 + fluidity * 0.035 + runners * 0.012, 0.38, 0.88);
  const chanceQuality = clamp(0.48 + mentality * 0.05 + (t.chanceCreation === 'Combinação curta' ? 0.07 : t.chanceCreation === 'Infiltrações' ? 0.08 : t.chanceCreation === 'Finalizar cedo' ? -0.04 : 0.01) + creators * 0.014 + averageFit * 0.12, 0.38, 0.88);
  const attackVolume = clamp(0.49 + t.tempo / 220 + mentality * 0.07 + counter * 0.05 + attackers * 0.018, 0.42, 1.02);
  const protection = clamp(0.72 - mentality * 0.06 - (t.defensiveLine - 50) / 260 + protectors * 0.018 + defenders * 0.016 + (t.afterLoss === 'Recompor' ? 0.07 : 0), 0.4, 0.9);
  const recovery = clamp(0.38 + t.pressing / 150 + counterPress * 0.09 + (t.defensiveShape === 'Bloco alto' ? 0.05 : t.defensiveShape === 'Bloco baixo' ? -0.05 : 0), 0.3, 0.96);
  const transitionThreat = clamp(0.38 + counter * 0.12 + directness * 0.07 + runners * 0.018 + t.tempo / 300, 0.28, 0.92);
  const lineRisk = clamp((t.defensiveLine - 50) / 100 + (t.pressing < t.defensiveLine - 15 ? 0.14 : 0) - protection * 0.18, 0.02, 0.42);
  return { t, averageFit, intensity, control, progression, chanceQuality, attackVolume, protection, recovery, transitionThreat, lineRisk, creators, runners, protectors };
}

export function analyzeTactics(tactics, players = []) {
  const model = tacticalModel(tactics, players);
  const t = model.t;
  const metrics = {
    construction: Math.round(clamp((model.control * 0.7 + (t.buildUp === 'Curta' ? 0.2 : t.buildUp === 'Direta' ? -0.08 : 0.07)) * 100, 20, 96)),
    control: Math.round(model.control * 100),
    penetration: Math.round(clamp((model.progression * 0.58 + model.transitionThreat * 0.42) * 100, 20, 96)),
    creation: Math.round(model.chanceQuality * 100),
    protection: Math.round(model.protection * 100),
    intensity: Math.round(model.intensity * 100)
  };
  const strengths = [];
  const risks = [];
  const conflicts = [];
  if (model.recovery >= 0.78) strengths.push('Recuperação agressiva no campo adversário');
  if (model.control >= 0.67) strengths.push('Boa capacidade de controlar a posse');
  if (model.transitionThreat >= 0.7) strengths.push('Ameaça forte nas transições');
  if (model.chanceQuality >= 0.68) strengths.push('Criação de chances de melhor qualidade');
  if (model.protection >= 0.72) strengths.push('Estrutura defensiva protegida');
  if (model.intensity >= 0.88) risks.push('Exigência física muito alta');
  if (model.lineRisk >= 0.26) risks.push('Espaço relevante nas costas da última linha');
  if (t.width >= 74 && t.defensiveWidth <= 44) risks.push('Distâncias grandes após perder a bola');
  if (t.defensiveLine >= 70 && t.pressing <= 50) conflicts.push('Linha alta com pressão baixa abre espaço entre defesa e meio');
  if (t.afterLoss === 'Contrapressão' && t.pressing <= 42) conflicts.push('Contrapressão contradiz uma intensidade de pressão baixa');
  if (t.buildUp === 'Curta' && t.distribution === 'Longa') conflicts.push('Saída curta e distribuição longa apontam para planos diferentes');
  if (t.mentality === 'Defensiva' && t.defensiveLine >= 72) conflicts.push('Mentalidade defensiva com linha muito alta aumenta o risco sem necessidade');
  if (!strengths.length) strengths.push('Estrutura equilibrada e adaptável');
  if (!risks.length) risks.push('Nenhum risco estrutural crítico detectado');
  return { metrics, strengths: strengths.slice(0, 3), risks: risks.slice(0, 3), conflicts, model };
}

function teamProfile(career, code, home) {
  const user = code === career.clubCode;
  const ids = user ? career.lineup : autoPickLineup(code);
  const players = ids.map(id => PLAYER_BY_ID.get(id)).filter(Boolean);
  const condition = user ? avg(players.map(player => career.playerState[player.id]?.condition || 100)) : 94;
  const tactics = user ? normalizeTactics(career.tactics) : aiTactics(code);
  const tactical = tacticalModel(tactics, players);
  const roleAdjustedRating = avg(players.map(player => player.rating * roleFit(player, tactics.roles?.[player.id])));
  const squadPower = roleAdjustedRating + (TEAM_ELO[code] - 1800) / 38 + (home ? 1.9 : 0) + (condition - 90) / 7;
  const attack = squadPower * (0.92 + tactical.chanceQuality * 0.13 + tactical.progression * 0.08 + tactical.transitionThreat * 0.06);
  const defence = squadPower * (0.9 + tactical.protection * 0.17 + tactical.recovery * 0.07 - tactical.lineRisk * 0.08);
  return { code, user, ids, players, condition, tactics, tactical, squadPower, attack, defence };
}

function poisson(random, lambda) {
  let count = 0;
  let product = 1;
  const limit = Math.exp(-lambda);
  do {
    count += 1;
    product *= random();
  } while (product > limit && count < 9);
  return count - 1;
}

function weighted(random, players, tactics) {
  const rows = players.map(player => {
    const assignment = tactics.roles?.[player.id] || {};
    const family = roleFamily(assignment.role || defaultRoleFor(player), player.group);
    let weight = player.group === 'FWD' ? 5 : player.group === 'MID' ? 2.4 : player.group === 'DEF' ? 0.55 : 0.08;
    if (family === 'runner') weight *= 1.28;
    if (family === 'creator') weight *= 0.88;
    if (assignment.focus === 'Atacar') weight *= 1.3;
    if (assignment.focus === 'Defender') weight *= 0.62;
    return { player, weight };
  });
  const total = rows.reduce((sum, row) => sum + row.weight, 0);
  let roll = random() * total;
  for (const row of rows) {
    roll -= row.weight;
    if (roll <= 0) return row.player;
  }
  return rows.at(-1)?.player;
}

function distributeEvents(random, goals, side, profile) {
  const minutes = new Set();
  const events = [];
  for (let index = 0; index < goals; index += 1) {
    let minute = 5 + Math.floor(random() * 84);
    while (minutes.has(minute)) minute = 5 + Math.floor(random() * 84);
    minutes.add(minute);
    const scorer = weighted(random, profile.players, profile.tactics);
    const assist = random() > 0.18
      ? weighted(random, profile.players.filter(player => player.id !== scorer?.id), profile.tactics)
      : null;
    events.push({
      type: 'goal', minute, side,
      playerId: scorer?.id || null, playerName: scorer?.name || 'Gol',
      assistPlayerId: assist?.id || null, assistName: assist?.name || null
    });
  }
  return events;
}

function matchupAttack(attacker, defender) {
  const pressVsBuild = attacker.tactics.buildUp === 'Curta'
    ? defender.tactical.recovery * -0.16 + attacker.tactical.control * 0.13
    : attacker.tactics.buildUp === 'Direta'
      ? defender.tactical.lineRisk * 0.2 + attacker.tactical.transitionThreat * 0.11
      : 0;
  const transition = attacker.tactical.transitionThreat * (1 - defender.tactical.protection) * 0.25;
  const widthMatch = Math.abs(attacker.tactics.width - defender.tactics.defensiveWidth) / 1000;
  return pressVsBuild + transition + widthMatch;
}

export function simulateFixture(career, fixture) {
  const random = seededRandom(`${career.seasonId}:${fixture.id}:${career.clubCode}:${JSON.stringify(normalizeTactics(career.tactics))}`);
  const home = teamProfile(career, fixture.home, true);
  const away = teamProfile(career, fixture.away, false);
  const homeMatchup = matchupAttack(home, away);
  const awayMatchup = matchupAttack(away, home);
  const qualityDiff = (home.attack - away.defence) / 18;
  const reverseDiff = (away.attack - home.defence) / 18;
  const homeXg = clamp(1.18 + qualityDiff * 0.24 + homeMatchup + (random() - 0.5) * 0.26, 0.22, 3.9);
  const awayXg = clamp(1.02 + reverseDiff * 0.24 + awayMatchup + (random() - 0.5) * 0.26, 0.18, 3.7);
  const homeGoals = poisson(random, homeXg);
  const awayGoals = poisson(random, awayXg);
  const events = [
    ...distributeEvents(random, homeGoals, 'home', home),
    ...distributeEvents(random, awayGoals, 'away', away)
  ].sort((left, right) => left.minute - right.minute);
  const controlDiff = (home.tactical.control - away.tactical.control) * 36 + (home.squadPower - away.squadPower) / 3;
  const possession = clamp(Math.round(50 + controlDiff + (random() - 0.5) * 5), 27, 73);
  const homeShots = Math.max(homeGoals, Math.round(homeXg * (4.5 + home.tactical.attackVolume * 2.2) + random() * 3));
  const awayShots = Math.max(awayGoals, Math.round(awayXg * (4.5 + away.tactical.attackVolume * 2.2) + random() * 3));
  const homeRecoveries = Math.round(3 + home.tactical.recovery * 9 + random() * 3);
  const awayRecoveries = Math.round(3 + away.tactical.recovery * 9 + random() * 3);
  const homeCounters = Math.round(home.tactical.transitionThreat * 5 + random() * 2);
  const awayCounters = Math.round(away.tactical.transitionThreat * 5 + random() * 2);
  const homeCrosses = Math.round((home.tactics.chanceCreation === 'Cruzamentos' ? 13 : 6) + home.tactics.width / 12 + random() * 3);
  const awayCrosses = Math.round((away.tactics.chanceCreation === 'Cruzamentos' ? 13 : 6) + away.tactics.width / 12 + random() * 3);
  return {
    fixtureId: fixture.id, matchweek: fixture.matchweek, date: fixture.date, time: fixture.time,
    home: fixture.home, away: fixture.away, homeGoals, awayGoals,
    lineups: { home: home.ids, away: away.ids }, events,
    stats: {
      home: { xg: +homeXg.toFixed(2), shots: homeShots, possession, corners: 2 + Math.floor(random() * 8), highRecoveries: homeRecoveries, counters: homeCounters, crosses: homeCrosses },
      away: { xg: +awayXg.toFixed(2), shots: awayShots, possession: 100 - possession, corners: 2 + Math.floor(random() * 8), highRecoveries: awayRecoveries, counters: awayCounters, crosses: awayCrosses }
    },
    tactical: {
      home: { metrics: analyzeTactics(home.tactics, home.players).metrics, load: Math.round(home.tactical.intensity * 100), plan: home.tactics.activePlan || 'A' },
      away: { metrics: analyzeTactics(away.tactics, away.players).metrics, load: Math.round(away.tactical.intensity * 100), plan: away.tactics.activePlan || 'A' }
    }
  };
}

function userForm(career, result) {
  const home = result.home === career.clubCode;
  const scored = home ? result.homeGoals : result.awayGoals;
  const conceded = home ? result.awayGoals : result.homeGoals;
  return scored > conceded ? 'W' : scored < conceded ? 'L' : 'D';
}

function updateStats(career, result) {
  for (const id of [...result.lineups.home, ...result.lineups.away]) {
    const stats = career.playerStats[id] || { appearances: 0, goals: 0, assists: 0 };
    stats.appearances += 1;
    career.playerStats[id] = stats;
  }
  for (const event of result.events) {
    if (event.playerId) {
      const stats = career.playerStats[event.playerId] || { appearances: 0, goals: 0, assists: 0 };
      stats.goals += 1;
      career.playerStats[event.playerId] = stats;
    }
    if (event.assistPlayerId) {
      const stats = career.playerStats[event.assistPlayerId] || { appearances: 0, goals: 0, assists: 0 };
      stats.assists += 1;
      career.playerStats[event.assistPlayerId] = stats;
    }
  }
}

export function commitResult(career, result) {
  if (career.results[result.fixtureId]) return career;
  career.results[result.fixtureId] = result;
  updateStats(career, result);
  if (result.home === career.clubCode || result.away === career.clubCode) {
    const form = userForm(career, result);
    const userSide = result.home === career.clubCode ? 'home' : 'away';
    const tacticalLoad = result.tactical?.[userSide]?.load || 62;
    for (const id of career.lineup) {
      const state = career.playerState[id];
      if (state) {
        const loadPenalty = Math.round((tacticalLoad - 50) / 13);
        state.condition = clamp(state.condition - (7 + loadPenalty + hashString(`${result.fixtureId}:${id}`) % 7), 45, 100);
        state.sharpness = clamp(state.sharpness + 2, 0, 100);
        state.morale = clamp(state.morale + (form === 'W' ? 4 : form === 'L' ? -4 : 1), 20, 100);
      }
    }
    career.recentForm = [form, ...career.recentForm].slice(0, 5);
    career.boardConfidence = clamp(career.boardConfidence + (form === 'W' ? 3 : form === 'L' ? -3 : 1), 10, 100);
    const home = result.home === career.clubCode;
    const opponent = CLUB_BY_CODE.get(home ? result.away : result.home);
    const userStats = result.stats[userSide];
    career.inbox.unshift({
      id: `match-report-${result.fixtureId}`,
      date: result.date,
      sender: 'Analista',
      subject: `${form === 'W' ? 'Vitória' : form === 'L' ? 'Derrota' : 'Empate'} contra ${opponent?.name}`,
      body: `Placar final ${home ? result.homeGoals : result.awayGoals}–${home ? result.awayGoals : result.homeGoals}. A tática gerou ${userStats.highRecoveries} recuperações altas, ${userStats.counters} contra-ataques e ${userStats.crosses} cruzamentos.`,
      read: false
    });
  }
  career.updatedAt = new Date().toISOString();
  return career;
}

function recover(career) {
  const gain = career.trainingFocus === 'Recuperação' ? 6 : career.trainingFocus === 'Intensivo' ? 2 : 4;
  for (const state of Object.values(career.playerState)) {
    state.condition = clamp(state.condition + gain, 0, 100);
    state.sharpness = clamp(state.sharpness + (career.trainingFocus === 'Intensivo' ? 3 : 1), 0, 100);
  }
}

export function advanceOneDay(career) {
  const userFixture = fixturesOnDate(career.currentDate).find(fixture =>
    !career.results[fixture.id] && (fixture.home === career.clubCode || fixture.away === career.clubCode)
  );
  for (const fixture of fixturesOnDate(career.currentDate)) {
    if (!career.results[fixture.id] && fixture !== userFixture) commitResult(career, simulateFixture(career, fixture));
  }
  if (userFixture) return { career, ready: true, fixture: userFixture };
  recover(career);
  career.currentDate = addDays(career.currentDate);
  if (career.currentDate > SEASON_END_DATE && Object.keys(career.results).length === FIXTURES.length) {
    career.status = 'complete';
    career.seasonSummary = buildSeasonSummary(career);
  }
  return { career, ready: false, fixture: null };
}

export function continueToNextMatch(career) {
  for (let index = 0; index < 400; index += 1) {
    const step = advanceOneDay(career);
    if (step.ready || career.status === 'complete') return step;
  }
  throw new Error('Calendar guard exceeded');
}

export function completePreparedUserMatch(career, result) {
  const fixture = FIXTURES.find(item => item.id === result?.fixtureId);
  if (!fixture || career.results[fixture.id]) return { career, fixture, result: career.results[fixture?.id] };
  commitResult(career, result);
  for (const aiFixture of fixturesOnDate(career.currentDate)) {
    if (!career.results[aiFixture.id]) commitResult(career, simulateFixture(career, aiFixture));
  }
  recover(career);
  career.currentDate = addDays(career.currentDate);
  if (Object.keys(career.results).length === FIXTURES.length) {
    career.status = 'complete';
    career.seasonSummary = buildSeasonSummary(career);
  }
  return { career, fixture, result };
}

export function playCurrentUserFixture(career) {
  const fixture = fixturesOnDate(career.currentDate).find(item =>
    !career.results[item.id] && (item.home === career.clubCode || item.away === career.clubCode)
  );
  return fixture
    ? completePreparedUserMatch(career, simulateFixture(career, fixture))
    : { career, fixture: null, result: null };
}

function mergeBridgeDraft(career) {
  const bridge = typeof globalThis !== 'undefined' ? globalThis.__touchlineTacticsDraft : null;
  if (bridge && typeof bridge === 'object') career.tactics = normalizeTactics({ ...career.tactics, ...clone(bridge) });
}

export function setFormation(career, formation) {
  if (FORMATION_SHAPES[formation]) {
    career.formation = formation;
    career.lineup = autoPickLineup(career.clubCode, formation, career.playerState);
  }
  mergeBridgeDraft(career);
  return career;
}

export function setTactic(career, key, value) {
  mergeBridgeDraft(career);
  if (key === 'mentality') career.tactics[key] = String(value);
  else if (['pressing', 'tempo', 'width', 'defensiveLine', 'defensiveWidth'].includes(key)) career.tactics[key] = clamp(Number(value), 20, 90);
  else if (key === 'offsideTrap') career.tactics[key] = value === true || value === 'true';
  else if (key) career.tactics[key] = value;
  career.tactics = normalizeTactics(career.tactics);
  return career;
}

export function toggleLineupPlayer(career, id) {
  const player = PLAYER_BY_ID.get(id);
  if (!player || player.clubCode !== career.clubCode) return career;
  const selected = new Set(career.lineup);
  if (selected.has(id) && selected.size > 1) selected.delete(id);
  else if (selected.size < 11) selected.add(id);
  else {
    const players = [...selected].map(playerId => PLAYER_BY_ID.get(playerId)).filter(Boolean);
    const sameGroup = players.filter(item => item.group === player.group).sort((a, b) => a.rating - b.rating);
    selected.delete((sameGroup[0] || players.sort((a, b) => a.rating - b.rating)[0]).id);
    selected.add(id);
  }
  career.lineup = [...selected];
  return career;
}

export function deriveTable(career) {
  const rows = Object.fromEntries(CLUB_CATALOG.map(club => [club.code, {
    code: club.code, name: club.name, played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, points: 0
  }]));
  for (const result of Object.values(career.results)) {
    const home = rows[result.home];
    const away = rows[result.away];
    home.played += 1; away.played += 1;
    home.gf += result.homeGoals; home.ga += result.awayGoals;
    away.gf += result.awayGoals; away.ga += result.homeGoals;
    if (result.homeGoals > result.awayGoals) { home.wins += 1; away.losses += 1; home.points += 3; }
    else if (result.homeGoals < result.awayGoals) { away.wins += 1; home.losses += 1; away.points += 3; }
    else { home.draws += 1; away.draws += 1; home.points += 1; away.points += 1; }
  }
  return Object.values(rows)
    .map(row => ({ ...row, gd: row.gf - row.ga }))
    .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.name.localeCompare(b.name))
    .map((row, index) => ({ ...row, position: index + 1 }));
}

export function topScorers(career, number = 10) {
  return Object.entries(career.playerStats)
    .map(([id, stats]) => ({ player: PLAYER_BY_ID.get(id), ...stats }))
    .filter(row => row.player && row.goals)
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists)
    .slice(0, number);
}

export function buildSeasonSummary(career) {
  const row = deriveTable(career).find(item => item.code === career.clubCode);
  return {
    position: row?.position || 20,
    points: row?.points || 0,
    wins: row?.wins || 0,
    draws: row?.draws || 0,
    losses: row?.losses || 0,
    boardConfidence: career.boardConfidence,
    completedAt: new Date().toISOString()
  };
}

export function completeSeasonForTest(career) {
  for (let index = 0; index < 500 && Object.keys(career.results).length < FIXTURES.length; index += 1) {
    const user = fixturesOnDate(career.currentDate).some(fixture =>
      !career.results[fixture.id] && (fixture.home === career.clubCode || fixture.away === career.clubCode)
    );
    user ? playCurrentUserFixture(career) : advanceOneDay(career);
  }
  return career;
}

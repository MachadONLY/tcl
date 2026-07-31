export const FORMATIONS = {
  "4-2-3-1": [
    { role: "GK", x: .07, y: .50 },
    { role: "RB", x: .23, y: .84 },
    { role: "RCB", x: .22, y: .61 },
    { role: "LCB", x: .22, y: .39 },
    { role: "LB", x: .23, y: .16 },
    { role: "DM", x: .43, y: .60 },
    { role: "CM", x: .43, y: .40 },
    { role: "RW", x: .68, y: .81 },
    { role: "AM", x: .62, y: .50 },
    { role: "LW", x: .68, y: .19 },
    { role: "ST", x: .82, y: .50 }
  ],
  "4-3-3": [
    { role: "GK", x: .07, y: .50 },
    { role: "RB", x: .23, y: .84 },
    { role: "RCB", x: .22, y: .61 },
    { role: "LCB", x: .22, y: .39 },
    { role: "LB", x: .23, y: .16 },
    { role: "DM", x: .43, y: .50 },
    { role: "RCM", x: .52, y: .66 },
    { role: "LCM", x: .52, y: .34 },
    { role: "RW", x: .76, y: .82 },
    { role: "ST", x: .83, y: .50 },
    { role: "LW", x: .76, y: .18 }
  ],
  "4-4-2": [
    { role: "GK", x: .07, y: .50 },
    { role: "RB", x: .23, y: .84 },
    { role: "RCB", x: .22, y: .61 },
    { role: "LCB", x: .22, y: .39 },
    { role: "LB", x: .23, y: .16 },
    { role: "RM", x: .49, y: .82 },
    { role: "RCM", x: .47, y: .61 },
    { role: "LCM", x: .47, y: .39 },
    { role: "LM", x: .49, y: .18 },
    { role: "RST", x: .78, y: .62 },
    { role: "LST", x: .78, y: .38 }
  ],
  "3-4-2-1": [
    { role: "GK", x: .07, y: .50 },
    { role: "RCB", x: .23, y: .72 },
    { role: "CB", x: .20, y: .50 },
    { role: "LCB", x: .23, y: .28 },
    { role: "RWB", x: .46, y: .89 },
    { role: "RCM", x: .45, y: .61 },
    { role: "LCM", x: .45, y: .39 },
    { role: "LWB", x: .46, y: .11 },
    { role: "RAM", x: .66, y: .64 },
    { role: "LAM", x: .66, y: .36 },
    { role: "ST", x: .82, y: .50 }
  ]
};

export const DEFAULT_TACTICS = {
  formation: "4-2-3-1",
  mentality: 52,
  width: 58,
  defensiveLine: 55,
  pressing: 60,
  tempo: 56,
  passingRisk: 52,
  counterpress: true,
  playerRoles: {},
  playerPositions: {}
};

export const PLAYER_ROLE_OPTIONS = Object.freeze([
  "goleiro-líbero",
  "zagueiro construtor",
  "lateral apoio",
  "lateral ofensivo",
  "volante protetor",
  "organizador",
  "área-a-área",
  "ponta aberto",
  "atacante interior",
  "meia criativo",
  "atacante móvel",
  "referência"
]);

const PLAYER_ROLE_EFFECTS = {
  "goleiro-líbero": {
    attackAdvance: .028, defensiveAdvance: .012, widthScale: 1,
    ballInfluence: 1.35, fatigueLoad: 1.08, passBias: .08, riskBias: .04, progressionBias: .08
  },
  "zagueiro construtor": {
    attackAdvance: .018, defensiveAdvance: 0, widthScale: .96,
    ballInfluence: 1.12, fatigueLoad: 1.04, passBias: .12, riskBias: .1, progressionBias: .16
  },
  "lateral apoio": {
    attackAdvance: .035, defensiveAdvance: .005, widthScale: 1.08,
    ballInfluence: 1.08, fatigueLoad: 1.1, passBias: .05, riskBias: .02, progressionBias: .08
  },
  "lateral ofensivo": {
    attackAdvance: .082, defensiveAdvance: .018, widthScale: 1.14,
    ballInfluence: 1.16, fatigueLoad: 1.25, passBias: -.03, carryBias: .08, riskBias: .1, progressionBias: .2
  },
  "volante protetor": {
    attackAdvance: -.035, defensiveAdvance: -.02, widthScale: .82,
    ballInfluence: .82, fatigueLoad: 1.06, passBias: .08, riskBias: -.12, progressionBias: -.08
  },
  "organizador": {
    attackAdvance: .012, defensiveAdvance: -.006, widthScale: .88,
    ballInfluence: 1.18, fatigueLoad: .98, passBias: .15, riskBias: .13, progressionBias: .18
  },
  "área-a-área": {
    attackAdvance: .052, defensiveAdvance: -.025, widthScale: .96,
    ballInfluence: 1.32, fatigueLoad: 1.27, passBias: -.02, carryBias: .1, progressionBias: .14
  },
  "ponta aberto": {
    attackAdvance: .038, defensiveAdvance: .004, widthScale: 1.22,
    ballInfluence: 1.02, fatigueLoad: 1.13, passBias: .03, carryBias: .04, riskBias: .06, progressionBias: .14
  },
  "atacante interior": {
    attackAdvance: .052, defensiveAdvance: .008, widthScale: .7,
    ballInfluence: 1.12, fatigueLoad: 1.15, passBias: -.08, carryBias: .07, shotBias: .07, riskBias: .08
  },
  "meia criativo": {
    attackAdvance: .03, defensiveAdvance: -.008, widthScale: .82,
    ballInfluence: 1.2, fatigueLoad: 1.04, passBias: .16, riskBias: .16, progressionBias: .2
  },
  "atacante móvel": {
    attackAdvance: .045, defensiveAdvance: -.01, widthScale: .84,
    ballInfluence: 1.38, fatigueLoad: 1.2, passBias: -.05, carryBias: .1, shotBias: .04, progressionBias: .12
  },
  "referência": {
    attackAdvance: .058, defensiveAdvance: .01, widthScale: .62,
    ballInfluence: .72, fatigueLoad: 1.06, passBias: -.08, carryBias: -.06, shotBias: .08, riskBias: -.02
  }
};

const DEFAULT_SHOT_TENDENCY_BY_POSITION = Object.freeze({
  GK: .05,
  RB: .5,
  RCB: .27,
  CB: .27,
  LCB: .27,
  LB: .5,
  RWB: .63,
  LWB: .63,
  DM: .69,
  RM: 1.02,
  RCM: 1.02,
  CM: 1.02,
  LCM: 1.02,
  LM: 1.02,
  RW: 1.29,
  AM: 1.48,
  RAM: 1.48,
  LAM: 1.48,
  LW: 1.29,
  RST: 1.85,
  ST: 1.85,
  LST: 1.85
});

const POSITION_GROUPS = {
  GK: "Goalkeeper",
  RB: "Defence",
  RCB: "Defence",
  CB: "Defence",
  LCB: "Defence",
  LB: "Defence",
  RWB: "Defence",
  LWB: "Defence",
  DM: "Midfield",
  RCM: "Midfield",
  CM: "Midfield",
  LCM: "Midfield",
  RM: "Midfield",
  LM: "Midfield",
  RW: "Offence",
  AM: "Midfield",
  RAM: "Midfield",
  LAM: "Midfield",
  LW: "Offence",
  RST: "Offence",
  ST: "Offence",
  LST: "Offence"
};

const RIGHT_SIDE_ROLES = new Set(["RB", "RWB", "RCB", "RCM", "RM", "RW", "RAM", "RST"]);
const LEFT_SIDE_ROLES = new Set(["LB", "LWB", "LCB", "LCM", "LM", "LW", "LAM", "LST"]);
const WIDE_ROLES = new Set(["RB", "RWB", "LB", "LWB", "RM", "LM", "RW", "LW"]);

function positionLimitsForRole(role) {
  if (role === "GK") {
    return { minX: .025, maxX: .2, minY: .3, maxY: .7, maxDx: .13, maxDy: .2 };
  }

  const group = POSITION_GROUPS[role];
  let limits;
  if (group === "Defence") {
    limits = WIDE_ROLES.has(role)
      ? { minX: .1, maxX: .62, minY: .03, maxY: .97, maxDx: .32, maxDy: .3 }
      : { minX: .08, maxX: .5, minY: .12, maxY: .88, maxDx: .24, maxDy: .27 };
  } else if (group === "Offence") {
    limits = WIDE_ROLES.has(role)
      ? { minX: .38, maxX: .95, minY: .025, maxY: .975, maxDx: .3, maxDy: .3 }
      : { minX: .46, maxX: .96, minY: .16, maxY: .84, maxDx: .28, maxDy: .28 };
  } else {
    const advanced = ["AM", "RAM", "LAM"].includes(role);
    const holding = role === "DM";
    limits = {
      minX: holding ? .18 : advanced ? .3 : .2,
      maxX: holding ? .68 : advanced ? .9 : .82,
      minY: .05,
      maxY: .95,
      maxDx: holding ? .29 : .32,
      maxDy: .32
    };
  }

  if (RIGHT_SIDE_ROLES.has(role)) limits.minY = Math.max(limits.minY, .44);
  if (LEFT_SIDE_ROLES.has(role)) limits.maxY = Math.min(limits.maxY, .56);
  return limits;
}

/**
 * Sanitiza uma posição local (x=0 gol próprio, x=1 gol rival) para o slot informado.
 * O retorno inclui indicadores úteis para preview e para o cálculo de coesão do motor.
 */
export function sanitizePlayerPosition(position, role, basePosition = { x: .5, y: .5 }) {
  const limits = positionLimitsForRole(role);
  const numericBaseX = Number(basePosition?.x);
  const numericBaseY = Number(basePosition?.y);
  const baseX = Number.isFinite(numericBaseX) ? clamp(numericBaseX, .025, .975) : .5;
  const baseY = Number.isFinite(numericBaseY) ? clamp(numericBaseY, .025, .975) : .5;
  const requestedX = Number(position?.x);
  const requestedY = Number(position?.y);
  const rawX = Number.isFinite(requestedX) ? requestedX : baseX;
  const rawY = Number.isFinite(requestedY) ? requestedY : baseY;
  const x = clamp(
    rawX,
    Math.max(limits.minX, baseX - limits.maxDx),
    Math.min(limits.maxX, baseX + limits.maxDx)
  );
  const y = clamp(
    rawY,
    Math.max(limits.minY, baseY - limits.maxDy),
    Math.min(limits.maxY, baseY + limits.maxDy)
  );
  const normalizedDisplacement = clamp(
    Math.hypot((x - baseX) / limits.maxDx, (y - baseY) / limits.maxDy) / Math.SQRT2,
    0,
    1
  );
  const zoneFit = clamp(
    1 - Math.max(0, normalizedDisplacement - .28) * .34,
    .72,
    1
  );
  return {
    x,
    y,
    zoneFit,
    displacement: normalizedDisplacement,
    clamped: Math.abs(x - rawX) > EPSILON || Math.abs(y - rawY) > EPSILON
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, amount) {
  return a + (b - a) * amount;
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

const HALF_SECONDS = 45 * 60;
const FULL_TIME_SECONDS = 90 * 60;
const MAX_SUBSTITUTIONS = 5;
const SIMULATION_STEP_SECONDS = .5;
const EPSILON = 1e-6;

function createPlayerStats() {
  return {
    touches: 0,
    passesAttempted: 0,
    passesCompleted: 0,
    shots: 0,
    shotsOnTarget: 0,
    goals: 0,
    assists: 0,
    tackles: 0,
    interceptions: 0,
    fouls: 0,
    rating: 6.5
  };
}

function sanitizeTactics(current, patch = {}) {
  const next = { ...current, ...patch };
  next.formation = FORMATIONS[next.formation] ? next.formation : current.formation;
  ["mentality", "width", "defensiveLine", "pressing", "tempo", "passingRisk"].forEach(key => {
    next[key] = clamp(Number(next[key]), 0, 100);
  });
  next.counterpress = Boolean(next.counterpress);
  const roleMap = { ...(current.playerRoles || {}) };
  Object.entries(patch.playerRoles || {}).forEach(([playerId, role]) => {
    if (role == null || role === "") delete roleMap[playerId];
    else if (PLAYER_ROLE_EFFECTS[role]) roleMap[playerId] = role;
  });
  next.playerRoles = roleMap;
  const positionMap = {};
  Object.entries(current.playerPositions || {}).forEach(([playerId, position]) => {
    const x = Number(position?.x);
    const y = Number(position?.y);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      positionMap[playerId] = { x: clamp(x, 0, 1), y: clamp(y, 0, 1) };
    }
  });
  Object.entries(patch.playerPositions || {}).forEach(([playerId, position]) => {
    if (position == null) {
      delete positionMap[playerId];
      return;
    }
    const x = Number(position.x);
    const y = Number(position.y);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      positionMap[playerId] = { x: clamp(x, 0, 1), y: clamp(y, 0, 1) };
    }
  });
  next.playerPositions = positionMap;
  return next;
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function effectiveAttribute(player, key) {
  const base = player.attributes?.[key] ?? player.overall ?? 72;
  const condition = clamp((player.condition ?? 90) / 100, .58, 1);
  const sharpness = clamp((player.sharpness ?? 80) / 100, .65, 1);
  const morale = clamp((player.morale ?? 75) / 100, .72, 1.04);
  return base * (.72 + condition * .16 + sharpness * .08) * morale;
}

function positionFit(player, role) {
  const exact = player.positions?.includes(role) || player.position === role;
  if (exact) return 1;
  const roleGroup = POSITION_GROUPS[role];
  const playerGroup = player.group || player.positionGroup;
  if (playerGroup === roleGroup) return .88;
  if (role === "AM" && playerGroup === "Offence") return .84;
  if ((role === "RWB" || role === "LWB") && playerGroup === "Midfield") return .8;
  return .64;
}

function evaluateTacticalPosition(tactics, playerId, slot) {
  const custom = tactics.playerPositions?.[String(playerId)];
  if (!custom) {
    return {
      x: slot.x,
      y: slot.y,
      zoneFit: 1,
      displacement: 0,
      custom: false
    };
  }
  return {
    ...sanitizePlayerPosition(custom, slot.role, slot),
    custom: true
  };
}

function constrainPlayerPositionMap(tactics, playerStates, formation) {
  const positions = { ...(tactics.playerPositions || {}) };
  playerStates.forEach((playerState, index) => {
    const playerId = String(playerState.id);
    if (!positions[playerId]) return;
    const slot = formation[index] || formation[formation.length - 1];
    const evaluated = sanitizePlayerPosition(positions[playerId], slot.role, slot);
    positions[playerId] = { x: evaluated.x, y: evaluated.y };
  });
  return positions;
}

function lineStrength(playerState) {
  const player = playerState.player;
  const role = playerState.role;
  const fit = positionFit(player, role) * (playerState.zoneFit ?? 1);
  if (role === "GK") return effectiveAttribute(player, "goalkeeping") * fit;
  if (POSITION_GROUPS[role] === "Defence") {
    return mean([
      effectiveAttribute(player, "defending"),
      effectiveAttribute(player, "positioning"),
      effectiveAttribute(player, "physical")
    ]) * fit;
  }
  if (POSITION_GROUPS[role] === "Midfield") {
    return mean([
      effectiveAttribute(player, "passing"),
      effectiveAttribute(player, "decisions"),
      effectiveAttribute(player, "technique")
    ]) * fit;
  }
  return mean([
    effectiveAttribute(player, "finishing"),
    effectiveAttribute(player, "pace"),
    effectiveAttribute(player, "technique")
  ]) * fit;
}

export function calculateTeamProfile(team, lineupIds, tactics = DEFAULT_TACTICS) {
  const activeTactics = sanitizeTactics(DEFAULT_TACTICS, tactics);
  const formation = FORMATIONS[activeTactics.formation] || FORMATIONS["4-2-3-1"];
  const players = lineupIds
    .map(id => team.squad.find(player => String(player.id) === String(id)))
    .filter(Boolean)
    .slice(0, 11)
    .map((player, index) => {
      const slot = formation[index] || formation[formation.length - 1];
      const position = evaluateTacticalPosition(activeTactics, player.id, slot);
      const group = POSITION_GROUPS[slot.role];
      const advancedDisplacement = Math.max(0, position.x - slot.x);
      const defensiveFit = group === "Defence"
        ? clamp(1 - advancedDisplacement * .65, .78, 1)
        : group === "Midfield"
          ? clamp(1 - advancedDisplacement * .28, .88, 1)
          : 1;
      return {
        player,
        role: slot.role || player.position,
        zoneFit: position.zoneFit,
        defensiveFit,
        position
      };
    });

  const defence = players
    .filter(item => POSITION_GROUPS[item.role] === "Defence")
    .map(item => lineStrength(item) * item.defensiveFit);
  const midfield = players.filter(item => POSITION_GROUPS[item.role] === "Midfield").map(lineStrength);
  const attack = players.filter(item => POSITION_GROUPS[item.role] === "Offence").map(lineStrength);
  const keeper = players.filter(item => item.role === "GK").map(lineStrength);
  const overall = mean(players.map(item => lineStrength(item)));
  const fit = mean(players.map(item => positionFit(item.player, item.role) * item.zoneFit));
  const cohesion = mean(players.map(item => item.zoneFit));
  const cohesionMultiplier = .9 + cohesion * .1;

  return {
    overall: Math.round(overall),
    defence: Math.round(mean([...keeper, ...defence])),
    midfield: Math.round(mean(midfield)),
    attack: Math.round(mean(attack)),
    fit: Math.round(fit * 100),
    cohesion: Math.round(cohesion * 100),
    customPositions: players.filter(item => item.position.custom).length,
    pressing: Math.round(
      mean(players.map(item => effectiveAttribute(item.player, "stamina"))) *
      (.8 + activeTactics.pressing / 250) *
      cohesionMultiplier
    ),
    transition: Math.round(
      mean(players.map(item => effectiveAttribute(item.player, "pace"))) *
      (.84 + activeTactics.mentality / 400) *
      cohesionMultiplier
    )
  };
}

function createTeamState(team, lineupIds, tactics, direction) {
  const activeTactics = sanitizeTactics(DEFAULT_TACTICS, tactics);
  const formation = FORMATIONS[activeTactics.formation] || FORMATIONS["4-2-3-1"];
  const players = lineupIds.slice(0, 11).map((playerId, index) => {
    const player = team.squad.find(item => String(item.id) === String(playerId)) || team.squad[index];
    if (!player) {
      throw new Error(`Escalação inválida para ${team.name || team.id}: faltou o jogador do slot ${index + 1}.`);
    }
    const slot = formation[index] || formation[formation.length - 1];
    const baseX = direction === 1 ? slot.x : 1 - slot.x;
    return {
      id: player.id,
      player,
      slotIndex: index,
      role: slot.role,
      x: baseX,
      y: slot.y,
      previousX: baseX,
      previousY: slot.y,
      targetX: baseX,
      targetY: slot.y,
      velocityX: 0,
      velocityY: 0,
      stamina: player.condition ?? 92,
      yellowCards: 0,
      redCard: false,
      injured: false,
      stats: createPlayerStats()
    };
  });
  activeTactics.playerPositions = constrainPlayerPositionMap(activeTactics, players, formation);
  players.forEach((playerState, index) => {
    const slot = formation[index] || formation[formation.length - 1];
    const evaluated = evaluateTacticalPosition(activeTactics, playerState.id, slot);
    playerState.customPosition = evaluated.custom ? { x: evaluated.x, y: evaluated.y } : null;
    playerState.positionZoneFit = evaluated.zoneFit;
    playerState.positionDisplacement = evaluated.displacement;
    playerState.tacticalFit = positionFit(playerState.player, slot.role) * evaluated.zoneFit;
    const initialX = direction === 1 ? evaluated.x : 1 - evaluated.x;
    playerState.x = initialX;
    playerState.y = evaluated.y;
    playerState.previousX = initialX;
    playerState.previousY = evaluated.y;
    playerState.targetX = initialX;
    playerState.targetY = evaluated.y;
  });
  const usedPlayerIds = players.map(player => String(player.id));

  return {
    id: team.id,
    team,
    direction,
    tactics: activeTactics,
    pendingTactics: null,
    pendingSubstitution: null,
    players,
    bench: team.squad.filter(player => !usedPlayerIds.includes(String(player.id))),
    substitutionsUsed: 0,
    substitutionHistory: [],
    substitutedOutIds: [],
    usedPlayerIds,
    ai: {
      enabled: false,
      nextDecisionAt: 50 * 60,
      lastPlanSignature: null
    },
    profile: calculateTeamProfile(team, lineupIds, activeTactics),
    stats: {
      possessionSeconds: 0,
      passesAttempted: 0,
      passesCompleted: 0,
      shots: 0,
      shotsOnTarget: 0,
      xG: 0,
      goals: 0,
      fouls: 0,
      yellowCards: 0,
      redCards: 0,
      corners: 0,
      offsides: 0,
      saves: 0
    }
  };
}

export class MatchEngine {
  constructor({
    home,
    away,
    homeLineup,
    awayLineup,
    homeTactics = DEFAULT_TACTICS,
    awayTactics = DEFAULT_TACTICS,
    seed = 20260730,
    realDurationSeconds = 120,
    aiTeamIndexes = [1],
    strictInvariants = false
  }) {
    this.random = mulberry32(seed);
    this.realDurationSeconds = realDurationSeconds;
    this.clockRate = FULL_TIME_SECONDS / realDurationSeconds;
    this.strictInvariants = Boolean(strictInvariants);
    this.ratingsFinalized = false;
    this.listeners = new Set();
    this.state = {
      phase: "prematch",
      period: 1,
      clockSeconds: 0,
      score: [0, 0],
      paused: true,
      speed: 1,
      simulationAccumulator: 0,
      halftimeCompleted: false,
      stoppage: null,
      possessionTeam: 0,
      possessionSequence: 0,
      lastCompletedPass: null,
      nextActionAt: 2,
      lastActionAt: 0,
      eventId: 0,
      events: [],
      teams: [
        createTeamState(home, homeLineup, homeTactics, 1),
        createTeamState(away, awayLineup, awayTactics, -1)
      ],
      ball: {
        x: .5,
        y: .5,
        z: 0,
        carrierId: null,
        moving: false,
        progress: 0,
        duration: .25,
        fromX: .5,
        fromY: .5,
        toX: .5,
        toY: .5,
        targetCarrierId: null
      }
    };
    this.state.teams.forEach((team, teamIndex) => {
      team.ai.enabled = aiTeamIndexes.includes(teamIndex);
    });
    this.resetKickoff(0);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(type, payload = {}) {
    const message = { type, payload, snapshot: this.state };
    this.listeners.forEach(listener => listener(message));
  }

  start() {
    if (this.state.phase === "prematch") {
      this.state.phase = "kickoff";
      this.state.paused = false;
      this.addEvent("kickoff", null, null, "A partida começou.");
      this.notify("started");
      return true;
    }
    if (this.state.phase === "halftime") return this.resumeSecondHalf();
    return false;
  }

  setPaused(value) {
    if (this.state.phase === "fulltime") return;
    if (!value && this.state.phase === "halftime") {
      this.resumeSecondHalf();
      return;
    }
    this.state.paused = Boolean(value);
    this.notify("pause", { paused: this.state.paused });
  }

  resumeSecondHalf() {
    const state = this.state;
    if (state.phase !== "halftime" || state.halftimeCompleted) return false;
    state.halftimeCompleted = true;
    state.period = 2;
    state.phase = "secondHalf";
    state.paused = false;
    state.stoppage = null;
    this.resetKickoff(1);
    this.addEvent("secondHalf", null, null, "Começa o segundo tempo.");
    this.notify("secondHalfStarted");
    return true;
  }

  setSpeed(value) {
    this.state.speed = [1, 2, 4].includes(Number(value)) ? Number(value) : 1;
    this.notify("speed", { speed: this.state.speed });
  }

  queueTactics(teamIndex, tactics, options = {}) {
    const team = this.state.teams[teamIndex];
    if (!team) return { ok: false, reason: "Equipe inválida." };
    team.pendingTactics = sanitizeTactics(team.tactics, tactics);
    const pendingFormation =
      FORMATIONS[team.pendingTactics.formation] ||
      FORMATIONS["4-2-3-1"];
    team.pendingTactics.playerPositions = constrainPlayerPositionMap(
      team.pendingTactics,
      team.players,
      pendingFormation
    );
    const subject = options.source === "ai" ? "O adversário preparou" : "Mudança tática preparada:";
    this.addEvent(
      "tacticalChange",
      teamIndex,
      null,
      `${subject} ${team.pendingTactics.formation} para a próxima interrupção.`,
      { source: options.source || "user", status: "queued" }
    );
    this.notify("tacticsQueued", { teamIndex, tactics: team.pendingTactics });
    return { ok: true };
  }

  previewPlayerPosition(teamIndex, playerId, position, formationName = null) {
    const team = this.state.teams[teamIndex];
    if (!team) return null;
    const playerIndex = team.players.findIndex(player => String(player.id) === String(playerId));
    if (playerIndex < 0) return null;
    const selectedFormation =
      FORMATIONS[formationName || team.pendingTactics?.formation || team.tactics.formation] ||
      FORMATIONS["4-2-3-1"];
    const slot = selectedFormation[playerIndex] || selectedFormation[selectedFormation.length - 1];
    const evaluated = sanitizePlayerPosition(position, slot.role, slot);
    return {
      ...evaluated,
      role: slot.role,
      playerId: team.players[playerIndex].id,
      tacticalFit:
        positionFit(team.players[playerIndex].player, slot.role) *
        evaluated.zoneFit
    };
  }

  queueSubstitution(teamIndex, outgoingId, incomingId, options = {}) {
    const team = this.state.teams[teamIndex];
    if (!team) return { ok: false, reason: "Equipe inválida." };
    const outgoing = team.players.find(item => String(item.id) === String(outgoingId));
    const incoming = team.bench.find(item => String(item.id) === String(incomingId));
    if (!outgoing || !incoming || String(outgoingId) === String(incomingId)) {
      return { ok: false, reason: "Jogadores inválidos." };
    }
    if (outgoing.redCard) return { ok: false, reason: "Um atleta expulso não pode ser substituído." };
    if (team.pendingSubstitution) return { ok: false, reason: "Já existe uma substituição preparada." };
    if (team.substitutionsUsed >= MAX_SUBSTITUTIONS) {
      return { ok: false, reason: "Limite de substituições atingido." };
    }
    if (team.usedPlayerIds.includes(String(incomingId))) {
      return { ok: false, reason: "Este atleta já participou da partida." };
    }
    if (incoming.available === false || incoming.suspended) {
      return { ok: false, reason: "O atleta não está disponível." };
    }
    team.pendingSubstitution = {
      outgoingId,
      incomingId,
      source: options.source || "user",
      queuedAt: this.state.clockSeconds
    };
    this.addEvent("substitutionPrepared", teamIndex, outgoingId, `${incoming.name} está pronto para entrar.`);
    this.notify("substitutionQueued", { teamIndex, outgoingId, incomingId });
    return { ok: true };
  }

  applyPendingChanges() {
    this.state.teams.forEach((team, teamIndex) => {
      if (team.pendingTactics) {
        team.tactics = sanitizeTactics(team.tactics, team.pendingTactics);
        team.pendingTactics = null;
        const formation = FORMATIONS[team.tactics.formation] || FORMATIONS["4-2-3-1"];
        team.tactics.playerPositions = constrainPlayerPositionMap(
          team.tactics,
          team.players,
          formation
        );
        team.players.forEach((player, index) => {
          const slot = formation[index] || formation[formation.length - 1];
          const evaluated = evaluateTacticalPosition(team.tactics, player.id, slot);
          player.slotIndex = index;
          player.role = slot.role || player.role;
          player.customPosition = evaluated.custom ? { x: evaluated.x, y: evaluated.y } : null;
          player.positionZoneFit = evaluated.zoneFit;
          player.positionDisplacement = evaluated.displacement;
          player.tacticalFit = positionFit(player.player, player.role) * evaluated.zoneFit;
        });
        const lineupIds = team.players.filter(player => !player.redCard).map(player => player.id);
        team.profile = calculateTeamProfile(team.team, lineupIds, team.tactics);
        this.addEvent("tacticalChange", teamIndex, null, `Estrutura alterada para ${team.tactics.formation}.`);
      }
      if (team.pendingSubstitution) {
        const { outgoingId, incomingId, source, queuedAt } = team.pendingSubstitution;
        const outgoingIndex = team.players.findIndex(item => String(item.id) === String(outgoingId));
        const incomingIndex = team.bench.findIndex(item => String(item.id) === String(incomingId));
        const alreadyUsed = team.usedPlayerIds.includes(String(incomingId));
        const canApply =
          outgoingIndex >= 0 &&
          incomingIndex >= 0 &&
          !alreadyUsed &&
          !team.players[outgoingIndex].redCard &&
          team.substitutionsUsed < MAX_SUBSTITUTIONS;
        if (canApply) {
          const outgoing = team.players[outgoingIndex];
          const incoming = team.bench[incomingIndex];
          const formation = FORMATIONS[team.tactics.formation] || FORMATIONS["4-2-3-1"];
          const slot = formation[outgoingIndex] || formation[formation.length - 1];
          const incomingPosition = evaluateTacticalPosition(team.tactics, incoming.id, slot);
          const replacement = {
            ...outgoing,
            id: incoming.id,
            player: incoming,
            stamina: incoming.condition ?? 95,
            instructionRole:
              team.tactics.playerRoles?.[String(incoming.id)] ||
              outgoing.role,
            customPosition: incomingPosition.custom
              ? { x: incomingPosition.x, y: incomingPosition.y }
              : null,
            positionZoneFit: incomingPosition.zoneFit,
            positionDisplacement: incomingPosition.displacement,
            tacticalFit:
              positionFit(incoming, slot.role) *
              incomingPosition.zoneFit,
            yellowCards: 0,
            redCard: false,
            injured: false,
            stats: createPlayerStats()
          };
          outgoing.stats.subbedOut = true;
          outgoing.stats.minuteOut = Math.floor(this.state.clockSeconds / 60);
          team.players[outgoingIndex] = replacement;
          if (team.tactics.playerPositions?.[String(incoming.id)]) {
            team.tactics.playerPositions[String(incoming.id)] = {
              x: incomingPosition.x,
              y: incomingPosition.y
            };
          }
          team.bench.splice(incomingIndex, 1);
          team.substitutionsUsed += 1;
          team.usedPlayerIds.push(String(incoming.id));
          team.substitutedOutIds.push(String(outgoing.id));
          team.substitutionHistory.push({
            minute: Math.floor(this.state.clockSeconds / 60),
            second: Math.floor(this.state.clockSeconds),
            outgoingId: outgoing.id,
            incomingId: incoming.id,
            outgoingName: outgoing.player.name,
            incomingName: incoming.name,
            source,
            queuedAt,
            outgoingState: outgoing
          });
          if (
            this.state.lastCompletedPass &&
            [outgoing.id, incoming.id].some(id =>
              String(id) === String(this.state.lastCompletedPass.passerId) ||
              String(id) === String(this.state.lastCompletedPass.receiverId)
            )
          ) {
            this.state.lastCompletedPass = null;
          }
          if (String(this.state.ball.carrierId) === String(outgoing.id)) {
            this.state.ball.carrierId = null;
          }
          const lineupIds = team.players.filter(player => !player.redCard).map(player => player.id);
          team.profile = calculateTeamProfile(team.team, lineupIds, team.tactics);
          this.addEvent(
            "substitution",
            teamIndex,
            incoming.id,
            `${incoming.name} entrou no lugar de ${outgoing.player.name}.`,
            { outgoingId: outgoing.id, incomingId: incoming.id, source }
          );
          this.notify("substitutionApplied", {
            teamIndex,
            outgoingId: outgoing.id,
            incomingId: incoming.id,
            substitutionsUsed: team.substitutionsUsed
          });
        } else {
          this.addEvent(
            "substitutionCancelled",
            teamIndex,
            outgoingId,
            "A substituição preparada deixou de ser válida."
          );
        }
        team.pendingSubstitution = null;
      }
    });
  }

  tick(realDeltaSeconds) {
    const state = this.state;
    if (
      state.paused ||
      state.phase === "prematch" ||
      state.phase === "halftime" ||
      state.phase === "fulltime"
    ) return;

    state.simulationAccumulator +=
      clamp(realDeltaSeconds, 0, .08) *
      this.clockRate *
      state.speed;
    let fixedStepGuard = 0;

    while (
      state.simulationAccumulator + EPSILON >= SIMULATION_STEP_SECONDS &&
      !state.paused &&
      state.phase !== "fulltime" &&
      fixedStepGuard < 128
    ) {
      state.simulationAccumulator -= SIMULATION_STEP_SECONDS;
      this.processGameWindow(SIMULATION_STEP_SECONDS);
      fixedStepGuard += 1;
    }

    if (fixedStepGuard >= 128) {
      throw new Error("O motor excedeu o limite de passos fixos em um único tick.");
    }

    if (this.strictInvariants) {
      const result = this.checkInvariants();
      if (!result.ok) throw new Error(`Invariantes inválidas: ${result.errors.join(" | ")}`);
    }
  }

  processGameWindow(gameSeconds) {
    const state = this.state;
    let remainingGameSeconds = gameSeconds;
    let guard = 0;

    while (
      remainingGameSeconds > EPSILON &&
      !state.paused &&
      state.phase !== "fulltime" &&
      guard < 160
    ) {
      guard += 1;
      const periodEnd = state.halftimeCompleted ? FULL_TIME_SECONDS : HALF_SECONDS;

      if (state.clockSeconds >= periodEnd - EPSILON) {
        if (state.halftimeCompleted) this.finishMatch();
        else this.enterHalftime();
        break;
      }

      if (
        state.phase === "stoppage" &&
        state.stoppage &&
        state.clockSeconds >= state.stoppage.resumeAt - EPSILON
      ) {
        this.resumeFromStoppage();
        continue;
      }

      if (
        state.phase !== "stoppage" &&
        state.clockSeconds >= state.nextActionAt - EPSILON
      ) {
        this.simulateAction();
        this.maybeRunOpponentAI();
        if (state.phase === "stoppage") this.applyPendingChanges();
        continue;
      }

      const nextMarker = state.phase === "stoppage" && state.stoppage
        ? Math.min(periodEnd, state.stoppage.resumeAt)
        : Math.min(periodEnd, state.nextActionAt);
      const untilMarker = Math.max(EPSILON, nextMarker - state.clockSeconds);
      const segment = Math.min(remainingGameSeconds, untilMarker);
      this.advanceContinuous(segment);
      remainingGameSeconds -= segment;
      this.maybeRunOpponentAI();
    }

    if (guard >= 160) {
      throw new Error("O motor excedeu o limite de transições em um único tick.");
    }
  }

  advanceContinuous(gameDelta) {
    const state = this.state;
    state.clockSeconds = Math.min(FULL_TIME_SECONDS, state.clockSeconds + gameDelta);
    const inOpenPlay = state.phase !== "stoppage";
    if (inOpenPlay) {
      state.teams[state.possessionTeam].stats.possessionSeconds += gameDelta;
      this.updateBall(gameDelta / this.clockRate);
    }
    this.updatePositions(gameDelta / this.clockRate, gameDelta);
    this.updateFatigue(gameDelta, inOpenPlay ? 1 : .18);
  }

  enterHalftime() {
    const state = this.state;
    if (state.halftimeCompleted || state.phase === "halftime") return;
    state.clockSeconds = HALF_SECONDS;
    state.phase = "halftime";
    state.paused = true;
    state.simulationAccumulator = 0;
    state.stoppage = null;
    state.ball.moving = false;
    state.ball.carrierId = null;
    state.lastCompletedPass = null;
    this.applyPendingChanges();
    this.addEvent("halftime", null, null, "Intervalo. A partida está pausada.");
    this.notify("halftime", { paused: true });
  }

  finishMatch() {
    const state = this.state;
    if (state.phase === "fulltime") return;
    state.clockSeconds = FULL_TIME_SECONDS;
    state.phase = "fulltime";
    state.paused = true;
    state.simulationAccumulator = 0;
    state.stoppage = null;
    state.ball.moving = false;
    state.ball.carrierId = null;
    state.teams.forEach(team => {
      team.pendingSubstitution = null;
      team.pendingTactics = null;
    });
    this.finalizeRatings();
    this.addEvent("fulltime", null, null, "Fim de jogo.");
    this.notify("fulltime");
  }

  updateBall(realDelta) {
    const ball = this.state.ball;
    if (!ball.moving) {
      const carrier = this.getCarrier();
      if (carrier) {
        ball.x = carrier.x;
        ball.y = carrier.y;
        ball.z = 0;
      }
      return;
    }
    ball.progress = clamp(ball.progress + realDelta / ball.duration, 0, 1);
    const eased = ball.progress * ball.progress * (3 - 2 * ball.progress);
    ball.x = lerp(ball.fromX, ball.toX, eased);
    ball.y = lerp(ball.fromY, ball.toY, eased);
    ball.z = Math.sin(ball.progress * Math.PI) * .025;
    if (ball.progress >= 1) {
      ball.moving = false;
      ball.carrierId = ball.targetCarrierId;
      ball.z = 0;
    }
  }

  getAssignedPlayerRole(team, playerState) {
    const role = team.tactics.playerRoles?.[String(playerState.id)];
    return PLAYER_ROLE_EFFECTS[role] ? role : null;
  }

  getPlayerRoleEffect(team, playerState) {
    const role = this.getAssignedPlayerRole(team, playerState);
    return role ? PLAYER_ROLE_EFFECTS[role] : null;
  }

  updatePositions(realDelta, gameDelta) {
    const ball = this.state.ball;
    this.state.teams.forEach((team, teamIndex) => {
      const formation = FORMATIONS[team.tactics.formation] || FORMATIONS["4-2-3-1"];
      const widthScale = .72 + team.tactics.width / 180;
      const mentalityShift = (team.tactics.mentality - 50) / 600;
      const lineShift = (team.tactics.defensiveLine - 50) / 520;
      const pressPower = team.tactics.pressing / 100;

      team.players.forEach((playerState, index) => {
        const slot = formation[index] || formation[formation.length - 1];
        const direction = team.direction;
        const assignedRole = this.getAssignedPlayerRole(team, playerState);
        const roleEffect = assignedRole ? PLAYER_ROLE_EFFECTS[assignedRole] : null;
        const tacticalPosition = evaluateTacticalPosition(team.tactics, playerState.id, slot);
        playerState.instructionRole = assignedRole || slot.role;
        playerState.customPosition = tacticalPosition.custom
          ? { x: tacticalPosition.x, y: tacticalPosition.y }
          : null;
        playerState.positionZoneFit = tacticalPosition.zoneFit;
        playerState.positionDisplacement = tacticalPosition.displacement;
        playerState.tacticalFit =
          positionFit(playerState.player, slot.role) *
          tacticalPosition.zoneFit;
        let x = direction === 1 ? tacticalPosition.x : 1 - tacticalPosition.x;
        let y = .5 + (tacticalPosition.y - .5) * widthScale;
        const group = POSITION_GROUPS[slot.role];
        const roleWeight = slot.role === "GK" ? 0 : group === "Defence" ? .45 : group === "Midfield" ? .72 : 1;
        x += mentalityShift * direction * roleWeight;
        if (group === "Defence") x += lineShift * direction;
        if (roleEffect) {
          const advance = teamIndex === this.state.possessionTeam
            ? roleEffect.attackAdvance
            : roleEffect.defensiveAdvance;
          x += advance * direction;
          y = .5 + (y - .5) * roleEffect.widthScale;
        }

        const ballInfluence =
          (teamIndex === this.state.possessionTeam ? .045 : .028) *
          (roleEffect?.ballInfluence ?? 1);
        x += clamp(ball.x - .5, -.5, .5) * ballInfluence;
        y += clamp(ball.y - .5, -.5, .5) * ballInfluence * 1.35;

        const distance = Math.hypot(playerState.x - ball.x, playerState.y - ball.y);
        const available = !playerState.redCard && !playerState.injured;
        if (available && teamIndex !== this.state.possessionTeam && distance < .24 && slot.role !== "GK") {
          const cohesionFactor = .82 + (team.profile?.cohesion ?? 100) / 555;
          const pressAmount =
            pressPower *
            .18 *
            clamp(playerState.stamina / 70, .45, 1) *
            lerp(.78, 1, playerState.tacticalFit) *
            cohesionFactor;
          x = lerp(x, ball.x, pressAmount);
          y = lerp(y, ball.y, pressAmount);
        }

        if (playerState.redCard) {
          x = direction === 1 ? -.08 : 1.08;
          y = 1.08;
        } else if (playerState.injured) {
          x = playerState.x;
          y = 1.035;
        }

        playerState.previousX = playerState.x;
        playerState.previousY = playerState.y;
        const leavingField = playerState.redCard || playerState.injured;
        playerState.targetX = leavingField ? x : clamp(x, .025, .975);
        playerState.targetY = leavingField ? y : clamp(y, .045, .955);
        const response = (.85 + effectiveAttribute(playerState.player, "pace") / 95) * (realDelta * 2.4);
        playerState.velocityX = (playerState.targetX - playerState.x) * response;
        playerState.velocityY = (playerState.targetY - playerState.y) * response;
        playerState.x += playerState.velocityX;
        playerState.y += playerState.velocityY;
      });
    });
  }

  updateFatigue(gameDelta, loadMultiplier = 1) {
    this.state.teams.forEach(team => {
      const intensity = .72 + team.tactics.pressing / 155 + team.tactics.tempo / 310;
      team.players.forEach(playerState => {
        if (playerState.redCard || playerState.injured) return;
        const staminaAttribute = effectiveAttribute(playerState.player, "stamina");
        const roleLoad = this.getPlayerRoleEffect(team, playerState)?.fatigueLoad ?? 1;
        const positionLoad = 1 + (1 - (playerState.positionZoneFit ?? 1)) * .4;
        const cost =
          gameDelta /
          FULL_TIME_SECONDS *
          48 *
          intensity *
          (1.12 - staminaAttribute / 500) *
          loadMultiplier *
          roleLoad *
          positionLoad;
        playerState.stamina = clamp(playerState.stamina - cost, 18, 100);
      });
    });
  }

  simulateAction() {
    const state = this.state;
    if (state.phase === "stoppage" || state.phase === "halftime" || state.phase === "fulltime") return;
    const teamIndex = state.possessionTeam;
    const team = state.teams[teamIndex];
    const ball = state.ball;
    const currentCarrier = this.getCarrier();
    const carrier = currentCarrier && team.players.includes(currentCarrier)
      ? currentCarrier
      : this.choosePlayer(teamIndex, player => player.role !== "GK");
    if (!carrier) {
      state.nextActionAt = state.clockSeconds + 3;
      return;
    }
    if (state.phase === "kickoff") state.phase = state.halftimeCompleted ? "secondHalf" : "firstHalf";
    ball.carrierId = carrier.id;
    carrier.stats.touches += 1;

    const progress = team.direction === 1 ? ball.x : 1 - ball.x;
    const finalThird = progress > .68;
    const pressure = this.nearestOpponentDistance(teamIndex, carrier.x, carrier.y);
    const actionRoll = this.random();
    const roleEffect = this.getPlayerRoleEffect(team, carrier);
    const positionalShotTendency = roleEffect
      ? 1
      : DEFAULT_SHOT_TENDENCY_BY_POSITION[carrier.role] ?? .65;
    const shotThreshold = clamp(
      (.115 + team.tactics.mentality / 650 + (roleEffect?.shotBias ?? 0)) *
      positionalShotTendency,
      .008,
      .34
    );
    const passThreshold = clamp(
      .82 + (roleEffect?.passBias ?? 0) - (roleEffect?.carryBias ?? 0),
      shotThreshold + .12,
      .95
    );

    if (this.random() < .012) {
      this.simulateFoul(teamIndex, carrier);
    } else if (finalThird && actionRoll < shotThreshold) {
      this.simulateShot(teamIndex, carrier, pressure);
    } else if (actionRoll < passThreshold) {
      this.simulatePass(teamIndex, carrier, pressure);
    } else {
      this.simulateCarry(teamIndex, carrier, pressure);
    }

    const tempoFactor = clamp(1.25 - team.tactics.tempo / 125, .48, 1.05);
    state.lastActionAt = state.clockSeconds;
    state.nextActionAt = state.clockSeconds + (4.2 + this.random() * 4.6) * tempoFactor;
    if (state.phase !== "stoppage") this.maybeInjury(teamIndex);
  }

  simulatePass(teamIndex, carrier, pressureDistance) {
    const state = this.state;
    const team = state.teams[teamIndex];
    const direction = team.direction;
    const roleEffect = this.getPlayerRoleEffect(team, carrier);
    const carrierTacticalFit = carrier.tacticalFit ?? positionFit(carrier.player, carrier.role);
    const decisionShapeFit =
      (carrierTacticalFit + (team.profile?.cohesion ?? 100) / 100) / 2;
    const risk = clamp(
      (team.tactics.passingRisk / 100 + (roleEffect?.riskBias ?? 0)) *
      lerp(.8, 1, decisionShapeFit),
      0,
      1
    );
    const passing =
      effectiveAttribute(carrier.player, "passing") *
      lerp(.86, 1, carrierTacticalFit);
    const decisions =
      effectiveAttribute(carrier.player, "decisions") *
      lerp(.88, 1, carrierTacticalFit);
    const candidates = team.players.filter(player =>
      String(player.id) !== String(carrier.id) && !player.redCard && !player.injured
    );
    if (!candidates.length) return;

    const sorted = candidates
      .map(player => {
        const progression = (player.x - carrier.x) * direction;
        const distance = Math.hypot(player.x - carrier.x, player.y - carrier.y);
        const support = 1 - Math.abs(player.y - carrier.y);
        const offside = progression > .03 && this.isOffside(teamIndex, player);
        const receiverTacticalFit =
          player.tacticalFit ??
          positionFit(player.player, player.role);
        const score =
          progression * (1.2 + risk * 1.7 + (roleEffect?.progressionBias ?? 0)) +
          support * .28 -
          distance * (1.1 - risk * .42) +
          (receiverTacticalFit - .75) * .28 +
          this.random() * .25;
        return { player, distance, score, offside, receiverTacticalFit };
      })
      .sort((a, b) => b.score - a.score);
    const onside = sorted.filter(option => !option.offside);
    const offside = sorted.filter(option => option.offside);
    const offsideAttemptChance = clamp(
      .0015 + risk * .003 + Math.max(0, 72 - decisions) / 6000,
      .0015,
      .01
    );
    const optionPool =
      offside.length && this.random() < offsideAttemptChance
        ? offside
        : onside.length
          ? onside
          : sorted;
    const target = optionPool[
      Math.min(optionPool.length - 1, Math.floor(this.random() * (risk > .65 ? 4 : 2)))
    ];
    const targetControl =
      effectiveAttribute(target.player.player, "technique") *
      lerp(.86, 1, target.receiverTacticalFit);
    const pressurePenalty = clamp((.18 - pressureDistance) * 1.65, 0, .22);
    const distancePenalty = clamp((target.distance - .18) * .55, 0, .2);
    const riskPenalty = Math.max(0, risk - .5) * .11;
    const cohesionPenalty = (100 - (team.profile?.cohesion ?? 100)) / 500;
    const shapePenalty =
      (1 - carrierTacticalFit) * .08 +
      (1 - target.receiverTacticalFit) * .06;
    const successChance = clamp(
      .67 +
      passing / 390 +
      decisions / 620 +
      targetControl / 900 -
      pressurePenalty -
      distancePenalty -
      riskPenalty -
      cohesionPenalty -
      shapePenalty,
      .42,
      .96
    );

    team.stats.passesAttempted += 1;
    carrier.stats.passesAttempted += 1;

    const advance = (target.player.x - carrier.x) * direction;
    if (advance > .03 && target.offside) {
      team.stats.offsides += 1;
      state.lastCompletedPass = null;
      this.addEvent("offside", teamIndex, target.player.id, `${target.player.player.name} estava impedido.`);
      this.beginStoppage({
        reason: "offside",
        restartTeamIndex: 1 - teamIndex,
        durationGameSeconds: 12 + this.random() * 8,
        x: target.player.x,
        y: target.player.y
      });
      return;
    }

    const completed = this.random() < successChance;

    if (completed) {
      team.stats.passesCompleted += 1;
      carrier.stats.passesCompleted += 1;
      this.animateBall(carrier, target.player, target.distance);
      state.ball.targetCarrierId = target.player.id;
      state.lastCompletedPass = {
        teamIndex,
        passerId: carrier.id,
        receiverId: target.player.id,
        at: state.clockSeconds,
        sequence: state.possessionSequence
      };
      if (advance > .14 && this.random() < .03) {
        this.addEvent("keyPass", teamIndex, carrier.id, `${carrier.player.name} encontrou um passe vertical.`);
      }
    } else {
      const interceptor = this.chooseNearestPlayer(1 - teamIndex, target.player.x, target.player.y);
      if (interceptor) {
        interceptor.stats.interceptions += 1;
        this.animateBall(carrier, interceptor, Math.hypot(interceptor.x - carrier.x, interceptor.y - carrier.y));
        this.changePossession(1 - teamIndex, interceptor.id);
      } else {
        this.changePossession(1 - teamIndex, null);
      }
    }
  }

  simulateCarry(teamIndex, carrier, pressureDistance) {
    const team = this.state.teams[teamIndex];
    const tacticalFit = carrier.tacticalFit ?? positionFit(carrier.player, carrier.role);
    const executionFit = lerp(.85, 1, tacticalFit);
    const pace = effectiveAttribute(carrier.player, "pace") * executionFit;
    const technique = effectiveAttribute(carrier.player, "technique") * executionFit;
    const distance = (.018 + pace / 3600 + technique / 5200) * team.direction;
    const tackler = this.chooseNearestPlayer(1 - teamIndex, carrier.x, carrier.y);
    const defenderFit = tackler?.tacticalFit ?? 1;
    const safeChance = clamp(
      technique / 115 + (1 - defenderFit) * .12,
      .28,
      .92
    );
    const safe = pressureDistance > .08 || this.random() < safeChance;
    if (safe) {
      carrier.x = clamp(carrier.x + distance, .035, .965);
      carrier.y = clamp(carrier.y + (this.random() - .5) * .03, .05, .95);
      this.state.ball.x = carrier.x;
      this.state.ball.y = carrier.y;
    } else {
      if (tackler) tackler.stats.tackles += 1;
      this.changePossession(1 - teamIndex, tackler?.id || null);
    }
  }

  simulateShot(teamIndex, shooter, pressureDistance) {
    const state = this.state;
    const team = state.teams[teamIndex];
    const opponent = state.teams[1 - teamIndex];
    const direction = team.direction;
    const distanceToGoal = direction === 1 ? 1 - shooter.x : shooter.x;
    const centrality = 1 - Math.min(1, Math.abs(shooter.y - .5) * 2);
    const tacticalFit = shooter.tacticalFit ?? positionFit(shooter.player, shooter.role);
    const executionFit = lerp(.84, 1, tacticalFit);
    const finishing = effectiveAttribute(shooter.player, "finishing") * executionFit;
    const decisions = effectiveAttribute(shooter.player, "decisions") * executionFit;
    const pressurePenalty = clamp((.13 - pressureDistance) * 1.9, 0, .2);
    const xG = clamp(
      .03 +
      centrality * .105 +
      Math.max(0, .34 - distanceToGoal) * .86 +
      finishing / 1050 +
      decisions / 1650 -
      pressurePenalty,
      .02,
      .62
    );
    const keeper = opponent.players.find(player => player.role === "GK" && !player.redCard && !player.injured);
    const keeperQuality = keeper ? effectiveAttribute(keeper.player, "goalkeeping") : 65;
    const onTargetChance = clamp(
      .22 + finishing / 520 + centrality * .08 - pressurePenalty * .55,
      .18,
      .62
    );
    const onTarget = this.random() < onTargetChance;
    const goalChance = clamp(
      xG * (.78 + finishing / 240) * (1.2 - keeperQuality / 270),
      .01,
      .7
    );
    const goal = onTarget && this.random() < clamp(goalChance / onTargetChance, .01, .92);

    team.stats.shots += 1;
    team.stats.xG += xG;
    shooter.stats.shots += 1;
    if (onTarget) {
      team.stats.shotsOnTarget += 1;
      shooter.stats.shotsOnTarget += 1;
    }

    if (goal) {
      const pass = state.lastCompletedPass;
      const assister =
        pass &&
        pass.teamIndex === teamIndex &&
        pass.sequence === state.possessionSequence &&
        String(pass.receiverId) === String(shooter.id) &&
        String(pass.passerId) !== String(shooter.id) &&
        state.clockSeconds - pass.at <= 20
          ? team.players.find(player => String(player.id) === String(pass.passerId))
          : null;
      team.stats.goals += 1;
      shooter.stats.goals += 1;
      shooter.stats.rating += .85;
      if (assister) {
        assister.stats.assists += 1;
        assister.stats.rating += .3;
      }
      state.score[teamIndex] += 1;
      const assistText = assister ? ` Assistência de ${assister.player.name}.` : "";
      this.addEvent(
        "goal",
        teamIndex,
        shooter.id,
        `Gol de ${shooter.player.name}.${assistText}`,
        {
          xG,
          assistPlayerId: assister?.id ?? null,
          assistPlayerName: assister?.player.name ?? null
        }
      );
      state.teams.forEach((candidateTeam, candidateIndex) => {
        if (candidateTeam.ai.enabled) this.evaluateOpponentAI(candidateIndex);
      });
      this.beginStoppage({
        reason: "goal",
        restartTeamIndex: 1 - teamIndex,
        durationGameSeconds: 16 + this.random() * 8,
        kickoff: true
      });
      this.notify("goal", {
        teamIndex,
        shooterId: shooter.id,
        assistPlayerId: assister?.id ?? null,
        xG
      });
    } else if (onTarget) {
      if (keeper) {
        keeper.stats.rating += .06;
        opponent.stats.saves += 1;
      }
      this.addEvent("shotOnTarget", teamIndex, shooter.id, `${shooter.player.name} finalizou e o goleiro defendeu.`, { xG });
      if (this.random() < .26) {
        team.stats.corners += 1;
        this.beginStoppage({
          reason: "corner",
          restartTeamIndex: teamIndex,
          durationGameSeconds: 12 + this.random() * 10,
          x: direction === 1 ? .985 : .015,
          y: shooter.y < .5 ? .02 : .98
        });
      } else {
        this.changePossession(1 - teamIndex, keeper?.id || null);
      }
    } else {
      this.beginStoppage({
        reason: "goalKick",
        restartTeamIndex: 1 - teamIndex,
        durationGameSeconds: 10 + this.random() * 9,
        x: direction === 1 ? .94 : .06,
        y: .5
      });
    }
  }

  simulateFoul(attackingTeamIndex, fouledPlayer) {
    const defendingTeamIndex = 1 - attackingTeamIndex;
    const defendingTeam = this.state.teams[defendingTeamIndex];
    const offender = this.chooseNearestPlayer(defendingTeamIndex, fouledPlayer.x, fouledPlayer.y);
    if (!offender) return;
    defendingTeam.stats.fouls += 1;
    offender.stats.fouls += 1;
    const aggression = effectiveAttribute(offender.player, "aggression");
    const cardRoll = this.random();
    const directRedChance = .002 + Math.max(0, aggression - 78) / 3200;
    const yellowChance = clamp(.14 + aggression / 950, .16, .3);
    if (cardRoll < directRedChance) {
      offender.redCard = true;
      defendingTeam.stats.redCards += 1;
      offender.stats.rating -= .9;
      this.addEvent("redCard", defendingTeamIndex, offender.id, `${offender.player.name} foi expulso.`);
      this.notify("redCard", { teamIndex: defendingTeamIndex, playerId: offender.id });
    } else if (cardRoll < directRedChance + yellowChance) {
      offender.yellowCards += 1;
      defendingTeam.stats.yellowCards += 1;
      this.addEvent("yellowCard", defendingTeamIndex, offender.id, `Cartão amarelo para ${offender.player.name}.`);
      if (offender.yellowCards >= 2) {
        offender.redCard = true;
        defendingTeam.stats.redCards += 1;
        this.addEvent("redCard", defendingTeamIndex, offender.id, `${offender.player.name} recebeu o segundo amarelo.`);
        this.notify("redCard", {
          teamIndex: defendingTeamIndex,
          playerId: offender.id,
          secondYellow: true
        });
      }
    }
    if (this.activePlayerCount(defendingTeamIndex) < 7) {
      this.abandonMatch(defendingTeamIndex);
      return;
    }
    this.state.lastCompletedPass = null;
    this.beginStoppage({
      reason: "freeKick",
      restartTeamIndex: attackingTeamIndex,
      durationGameSeconds: 14 + this.random() * 16,
      x: fouledPlayer.x,
      y: fouledPlayer.y
    });
  }

  maybeInjury(teamIndex) {
    const team = this.state.teams[teamIndex];
    const fatigueRisk = mean(
      team.players
        .filter(player => !player.redCard && !player.injured)
        .map(player => Math.pow(clamp((65 - player.stamina) / 45, 0, 1), 2))
    );
    const injuryRisk =
      .00032 +
      team.tactics.pressing / 220000 +
      team.tactics.tempo / 300000 +
      fatigueRisk * .0005;
    if (this.random() >= injuryRisk) return;
    const candidates = team.players.filter(player => !player.injured && !player.redCard && player.role !== "GK");
    const player = candidates[Math.floor(this.random() * candidates.length)];
    if (!player) return;
    player.injured = true;
    player.stats.rating -= .18;
    this.addEvent("injury", teamIndex, player.id, `${player.player.name} sentiu uma lesão e precisa ser avaliado.`);
    if (team.ai.enabled) this.queueBestAISubstitution(teamIndex, player);
    this.state.lastCompletedPass = null;
    this.beginStoppage({
      reason: "injury",
      restartTeamIndex: this.state.possessionTeam,
      durationGameSeconds: 34 + this.random() * 28,
      x: player.x,
      y: player.y
    });
    this.notify("injury", { teamIndex, playerId: player.id });
  }

  beginStoppage({
    reason,
    restartTeamIndex,
    durationGameSeconds,
    kickoff = false,
    x = this.state.ball.x,
    y = this.state.ball.y
  }) {
    const state = this.state;
    if (state.phase === "halftime" || state.phase === "fulltime") return;
    const duration = clamp(Number(durationGameSeconds) || 10, 4, 90);
    state.phase = "stoppage";
    state.stoppage = {
      reason,
      restartTeamIndex,
      resumeAt: state.clockSeconds + duration,
      kickoff,
      x: clamp(x, .015, .985),
      y: clamp(y, .02, .98)
    };
    state.ball.moving = false;
    state.ball.progress = 0;
    state.ball.carrierId = null;
    state.ball.targetCarrierId = null;
    state.ball.x = state.stoppage.x;
    state.ball.y = state.stoppage.y;
    state.ball.z = 0;
    this.changePossession(restartTeamIndex, null);
    this.applyPendingChanges();
    state.nextActionAt = Math.max(state.nextActionAt, state.stoppage.resumeAt + 2);
  }

  resumeFromStoppage() {
    const state = this.state;
    const stoppage = state.stoppage;
    if (state.phase !== "stoppage" || !stoppage) return false;

    state.stoppage = null;
    state.phase = state.halftimeCompleted ? "secondHalf" : "firstHalf";

    if (stoppage.kickoff) {
      this.resetKickoff(stoppage.restartTeamIndex);
    } else {
      const team = state.teams[stoppage.restartTeamIndex];
      const preferred =
        stoppage.reason === "goalKick"
          ? team.players.find(player => player.role === "GK" && !player.redCard && !player.injured)
          : this.chooseNearestPlayer(stoppage.restartTeamIndex, stoppage.x, stoppage.y);
      if (preferred) {
        preferred.previousX = stoppage.x;
        preferred.previousY = stoppage.y;
        preferred.x = stoppage.x;
        preferred.y = stoppage.y;
        preferred.velocityX = 0;
        preferred.velocityY = 0;
      }
      this.changePossession(stoppage.restartTeamIndex, preferred?.id || null);
      state.ball.x = stoppage.x;
      state.ball.y = stoppage.y;
      state.ball.z = 0;
      state.ball.moving = false;
    }

    state.nextActionAt = state.clockSeconds + 2 + this.random() * 2;
    this.notify("restart", {
      reason: stoppage.reason,
      teamIndex: stoppage.restartTeamIndex
    });
    return true;
  }

  changePossession(teamIndex, carrierId = null) {
    const state = this.state;
    if (state.possessionTeam !== teamIndex) state.possessionSequence += 1;
    state.possessionTeam = teamIndex;
    state.lastCompletedPass = null;
    state.ball.carrierId = carrierId;
    state.ball.targetCarrierId = carrierId;
  }

  isOffside(teamIndex, attacker) {
    const team = this.state.teams[teamIndex];
    const opponent = this.state.teams[1 - teamIndex];
    const toLocalX = x => team.direction === 1 ? x : 1 - x;
    const attackerX = toLocalX(attacker.x);
    const ballX = toLocalX(this.state.ball.x);
    const defenders = opponent.players
      .filter(player => !player.redCard)
      .map(player => toLocalX(player.x))
      .sort((a, b) => b - a);
    const secondLastDefenderX = defenders[1] ?? defenders[0] ?? 1;
    return (
      attackerX > .5 &&
      attackerX > ballX + .008 &&
      attackerX > secondLastDefenderX + .008
    );
  }

  activePlayerCount(teamIndex) {
    return this.state.teams[teamIndex].players.filter(player => !player.redCard).length;
  }

  abandonMatch(teamIndex) {
    const state = this.state;
    if (state.phase === "fulltime") return;
    state.phase = "fulltime";
    state.paused = true;
    state.simulationAccumulator = 0;
    state.stoppage = null;
    state.ball.moving = false;
    state.ball.carrierId = null;
    this.finalizeRatings();
    this.addEvent(
      "abandoned",
      teamIndex,
      null,
      "A partida foi encerrada porque uma equipe ficou com menos de sete atletas."
    );
    this.notify("fulltime", { abandoned: true, teamIndex });
  }

  maybeRunOpponentAI() {
    const state = this.state;
    state.teams.forEach((team, teamIndex) => {
      if (!team.ai.enabled || state.clockSeconds + EPSILON < team.ai.nextDecisionAt) return;
      while (team.ai.nextDecisionAt <= state.clockSeconds + EPSILON) {
        team.ai.nextDecisionAt += 5 * 60;
      }
      this.evaluateOpponentAI(teamIndex);
    });
  }

  evaluateOpponentAI(teamIndex) {
    const state = this.state;
    const team = state.teams[teamIndex];
    if (!team?.ai.enabled || state.phase === "fulltime") return;
    const minute = state.clockSeconds / 60;
    const scoreDifference = state.score[teamIndex] - state.score[1 - teamIndex];
    const availablePlayers = team.players.filter(player => !player.redCard && !player.injured);
    const averageStamina = mean(availablePlayers.map(player => player.stamina));
    const desired = { ...(team.pendingTactics || team.tactics) };

    if (scoreDifference < 0 && minute >= 55) {
      const urgency = minute >= 80 ? 1 : minute >= 70 ? .72 : .45;
      desired.mentality = Math.max(desired.mentality, Math.round(57 + urgency * 22));
      desired.pressing = Math.max(desired.pressing, Math.round(61 + urgency * 22));
      desired.tempo = Math.max(desired.tempo, Math.round(59 + urgency * 19));
      desired.passingRisk = Math.max(desired.passingRisk, Math.round(58 + urgency * 24));
      desired.defensiveLine = Math.max(desired.defensiveLine, Math.round(56 + urgency * 16));
    } else if (scoreDifference > 0 && minute >= 70) {
      const protect = minute >= 82 ? 1 : .55;
      desired.mentality = Math.min(desired.mentality, Math.round(49 - protect * 13));
      desired.tempo = Math.min(desired.tempo, Math.round(55 - protect * 13));
      desired.passingRisk = Math.min(desired.passingRisk, Math.round(52 - protect * 14));
      desired.defensiveLine = Math.min(desired.defensiveLine, Math.round(53 - protect * 9));
      desired.pressing = Math.min(desired.pressing, Math.round(61 - protect * 9));
    } else if (averageStamina < 58 && minute >= 65) {
      desired.pressing = Math.min(desired.pressing, 52);
      desired.tempo = Math.min(desired.tempo, 52);
    }

    const sanitized = sanitizeTactics(team.tactics, desired);
    const signature = JSON.stringify([
      sanitized.formation,
      sanitized.mentality,
      sanitized.width,
      sanitized.defensiveLine,
      sanitized.pressing,
      sanitized.tempo,
      sanitized.passingRisk,
      scoreDifference < 0 ? "behind" : scoreDifference > 0 ? "ahead" : "level"
    ]);
    const changed = Object.keys(sanitized).some(key => sanitized[key] !== team.tactics[key]);
    if (changed && signature !== team.ai.lastPlanSignature) {
      team.ai.lastPlanSignature = signature;
      this.queueTactics(teamIndex, sanitized, { source: "ai" });
    }

    this.queueBestAISubstitution(teamIndex);
  }

  queueBestAISubstitution(teamIndex, forcedOutgoing = null) {
    const state = this.state;
    const team = state.teams[teamIndex];
    if (
      !team?.ai.enabled ||
      team.pendingSubstitution ||
      team.substitutionsUsed >= MAX_SUBSTITUTIONS
    ) return false;

    const minute = state.clockSeconds / 60;
    const threshold = minute >= 78 ? 66 : minute >= 62 ? 58 : 48;
    const candidates = forcedOutgoing
      ? [forcedOutgoing]
      : team.players
          .filter(player =>
            !player.redCard &&
            player.role !== "GK" &&
            (player.injured || player.stamina < threshold)
          )
          .sort((a, b) => {
            const aUrgency = (a.injured ? 1000 : 0) + (100 - a.stamina) + a.yellowCards * 8;
            const bUrgency = (b.injured ? 1000 : 0) + (100 - b.stamina) + b.yellowCards * 8;
            return bUrgency - aUrgency;
          });
    const outgoing = candidates[0];
    if (!outgoing || outgoing.redCard) return false;

    const incoming = team.bench
      .filter(player => !team.usedPlayerIds.includes(String(player.id)) && player.available !== false)
      .map(player => ({
        player,
        score:
          positionFit(player, outgoing.role) * 80 +
          (player.overall ?? effectiveAttribute(player, "stamina")) * .16 +
          (player.condition ?? 90) * .08
      }))
      .sort((a, b) => b.score - a.score)[0]?.player;
    if (!incoming) return false;

    return this.queueSubstitution(
      teamIndex,
      outgoing.id,
      incoming.id,
      { source: "ai" }
    ).ok;
  }

  animateBall(from, to, distance) {
    const ball = this.state.ball;
    ball.moving = true;
    ball.progress = 0;
    ball.duration = clamp(.18 + distance * .5, .2, .48);
    ball.fromX = from.x;
    ball.fromY = from.y;
    ball.toX = to.x;
    ball.toY = to.y;
    ball.targetCarrierId = to.id;
  }

  resetKickoff(teamIndex) {
    const state = this.state;
    const team = state.teams[teamIndex];
    const eligible = player => !player.redCard && !player.injured;
    const forward =
      team.players.find(player => eligible(player) && POSITION_GROUPS[player.role] === "Offence") ||
      team.players.find(eligible);
    state.possessionSequence += 1;
    state.possessionTeam = teamIndex;
    state.lastCompletedPass = null;
    state.ball.x = .5;
    state.ball.y = .5;
    state.ball.z = 0;
    state.ball.carrierId = forward?.id || null;
    state.ball.targetCarrierId = forward?.id || null;
    state.ball.moving = false;
    state.ball.progress = 0;
    state.nextActionAt = Math.max(state.nextActionAt, state.clockSeconds + 4);
  }

  getCarrier() {
    const id = this.state.ball.carrierId;
    for (const team of this.state.teams) {
      const carrier = team.players.find(player =>
        String(player.id) === String(id) &&
        !player.redCard &&
        !player.injured
      );
      if (carrier) return carrier;
    }
    return null;
  }

  choosePlayer(teamIndex, predicate = () => true) {
    const candidates = this.state.teams[teamIndex].players.filter(player => !player.redCard && !player.injured && predicate(player));
    return candidates[Math.floor(this.random() * candidates.length)] || null;
  }

  chooseNearestPlayer(teamIndex, x, y) {
    return this.state.teams[teamIndex].players
      .filter(player => !player.redCard && !player.injured)
      .sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0] || null;
  }

  nearestOpponentDistance(teamIndex, x, y) {
    const opponent = this.chooseNearestPlayer(1 - teamIndex, x, y);
    return opponent ? Math.hypot(opponent.x - x, opponent.y - y) : .5;
  }

  addEvent(type, teamIndex, playerId, description, meta = {}) {
    const event = {
      id: ++this.state.eventId,
      type,
      teamIndex,
      playerId,
      minute: Math.min(90, Math.floor(this.state.clockSeconds / 60)),
      description,
      meta
    };
    this.state.events.unshift(event);
    if (this.state.events.length > 500) this.state.events.length = 500;
    this.notify("event", { event });
    return event;
  }

  finalizeRatings() {
    if (this.ratingsFinalized) return;
    this.ratingsFinalized = true;
    this.state.teams.forEach(team => {
      const allParticipants = [
        ...team.players,
        ...team.substitutionHistory.map(change => change.outgoingState)
      ];
      allParticipants.forEach(player => {
        const passBonus = player.stats.passesAttempted
          ? (player.stats.passesCompleted / player.stats.passesAttempted - .72) * .8
          : 0;
        const defensiveBonus = player.stats.tackles * .025 + player.stats.interceptions * .018;
        const fatiguePenalty = player.stamina < 35 ? .15 : 0;
        player.stats.rating = clamp(
          player.stats.rating + passBonus + defensiveBonus + player.stats.goals * .35 + player.stats.assists * .22 - fatiguePenalty,
          4.2,
          10
        );
      });
    });
  }

  checkInvariants() {
    const state = this.state;
    const errors = [];
    if (!Number.isFinite(state.clockSeconds) || state.clockSeconds < 0 || state.clockSeconds > FULL_TIME_SECONDS) {
      errors.push("relógio fora do intervalo 0–90");
    }
    if (![0, 1].includes(state.possessionTeam)) errors.push("equipe de posse inválida");
    if (state.phase === "halftime" && (!state.paused || state.clockSeconds !== HALF_SECONDS)) {
      errors.push("intervalo deve estar pausado exatamente aos 45:00");
    }
    if (state.phase === "fulltime" && !state.paused) errors.push("fim de jogo não está pausado");
    if (state.phase === "stoppage" && !state.stoppage) errors.push("stoppage sem reinício agendado");
    if (state.phase !== "stoppage" && state.stoppage) errors.push("reinício pendente fora de stoppage");

    state.teams.forEach((team, teamIndex) => {
      const ids = team.players.map(player => String(player.id));
      if (new Set(ids).size !== ids.length) errors.push(`IDs duplicados no time ${teamIndex}`);
      if (new Set(team.usedPlayerIds).size !== team.usedPlayerIds.length) {
        errors.push(`histórico de participantes duplicado no time ${teamIndex}`);
      }
      if (
        team.substitutionsUsed !== team.substitutionHistory.length ||
        team.substitutionsUsed > MAX_SUBSTITUTIONS
      ) {
        errors.push(`contagem de substituições inválida no time ${teamIndex}`);
      }
      if (team.substitutedOutIds.some(id => ids.includes(String(id)))) {
        errors.push(`atleta substituído voltou ao campo no time ${teamIndex}`);
      }
      if (team.stats.passesCompleted > team.stats.passesAttempted) {
        errors.push(`passes completos excedem tentativas no time ${teamIndex}`);
      }
      if (team.stats.shotsOnTarget > team.stats.shots) {
        errors.push(`chutes no alvo excedem chutes no time ${teamIndex}`);
      }
      if (team.stats.goals > team.stats.shotsOnTarget) {
        errors.push(`gols excedem chutes no alvo no time ${teamIndex}`);
      }
      if (team.stats.goals !== state.score[teamIndex]) {
        errors.push(`placar e gols divergem no time ${teamIndex}`);
      }
      Object.entries(team.tactics.playerPositions || {}).forEach(([playerId, position]) => {
        if (
          !Number.isFinite(position?.x) ||
          !Number.isFinite(position?.y) ||
          position.x < 0 ||
          position.x > 1 ||
          position.y < 0 ||
          position.y > 1
        ) {
          errors.push(`posição personalizada inválida para ${playerId}`);
        }
      });
      if (state.phase !== "fulltime" && this.activePlayerCount(teamIndex) < 7) {
        errors.push(`time ${teamIndex} segue ativo com menos de sete atletas`);
      }
      const formation = FORMATIONS[team.tactics.formation] || FORMATIONS["4-2-3-1"];
      team.players.forEach((player, playerIndex) => {
        if (![player.x, player.y, player.stamina, player.stats.rating].every(Number.isFinite)) {
          errors.push(`estado numérico inválido para ${player.id}`);
        }
        if (player.stats.passesCompleted > player.stats.passesAttempted) {
          errors.push(`passes individuais inválidos para ${player.id}`);
        }
        if (player.stats.shotsOnTarget > player.stats.shots) {
          errors.push(`chutes individuais inválidos para ${player.id}`);
        }
        if (
          !Number.isFinite(player.positionZoneFit) ||
          player.positionZoneFit < .72 ||
          player.positionZoneFit > 1
        ) {
          errors.push(`adequação de zona inválida para ${player.id}`);
        }
        const configured = team.tactics.playerPositions?.[String(player.id)];
        if (configured) {
          const slot = formation[playerIndex] || formation[formation.length - 1];
          const constrained = sanitizePlayerPosition(configured, slot.role, slot);
          if (
            Math.abs(configured.x - constrained.x) > EPSILON ||
            Math.abs(configured.y - constrained.y) > EPSILON
          ) {
            errors.push(`posição fora dos limites do slot para ${player.id}`);
          }
        }
      });
    });

    const eventIds = state.events.map(event => event.id);
    if (new Set(eventIds).size !== eventIds.length) errors.push("IDs de eventos duplicados");
    const carrier = this.getCarrier();
    if (state.ball.carrierId != null && !state.ball.moving && !carrier && state.phase !== "stoppage") {
      errors.push("portador da bola não está disponível");
    }
    return { ok: errors.length === 0, errors };
  }

  getSnapshot() {
    return this.state;
  }
}

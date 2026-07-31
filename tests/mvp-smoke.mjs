import assert from "node:assert/strict";

import { createMvpMatchData } from "../src/mvp-data.js";
import { calculateTeamProfile, MatchEngine } from "../src/match-engine.js";

function createEngine(speed = 4) {
  const data = createMvpMatchData();
  const engine = new MatchEngine({
    home: data.home,
    away: data.away,
    homeLineup: data.homeLineup,
    awayLineup: data.awayLineup,
    homeTactics: data.homeTactics,
    awayTactics: data.awayTactics,
    seed: data.meta.seed,
    realDurationSeconds: data.meta.realDurationSeconds,
    aiTeamIndexes: [1 - data.userTeamIndex],
    strictInvariants: true
  });
  engine.setSpeed(speed);
  return { data, engine };
}

function runToHalftime(engine) {
  engine.start();
  let guard = 0;
  while (engine.getSnapshot().phase !== "halftime" && guard < 5000) {
    engine.tick(1 / 60);
    guard += 1;
  }
  assert.ok(guard < 5000, "a partida deve chegar ao intervalo");
}

function runToFulltime(engine) {
  runToHalftime(engine);
  const half = engine.getSnapshot();
  assert.equal(half.clockSeconds, 45 * 60);
  assert.equal(half.paused, true);
  assert.equal(engine.resumeSecondHalf(), true);
  let guard = 0;
  while (engine.getSnapshot().phase !== "fulltime" && guard < 5000) {
    engine.tick(1 / 60);
    guard += 1;
  }
  assert.ok(guard < 5000, "a partida deve chegar ao fim");
  return engine.getSnapshot();
}

function centralEvents(snapshot) {
  return snapshot.events
    .filter(event => [
      "goal",
      "yellowCard",
      "redCard",
      "injury",
      "substitution",
      "halftime",
      "fulltime"
    ].includes(event.type))
    .map(event => ({
      type: event.type,
      teamIndex: event.teamIndex,
      playerId: event.playerId,
      minute: event.minute,
      description: event.description
    }));
}

const data = createMvpMatchData();
assert.equal(data.home.squad.length, 25);
assert.equal(data.away.squad.length, 25);
assert.equal(data.homeLineup.length, 11);
assert.equal(data.awayLineup.length, 11);
assert.equal(new Set([...data.home.squad, ...data.away.squad].map(player => player.id)).size, 50);

const first = runToFulltime(createEngine(1).engine);
const second = runToFulltime(createEngine(4).engine);
assert.equal(first.clockSeconds, 90 * 60);
assert.equal(first.paused, true);
assert.deepEqual(first.score, first.teams.map(team => team.stats.goals));
assert.deepEqual(centralEvents(first), centralEvents(second), "velocidade não pode mudar os eventos centrais");

first.teams.forEach(team => {
  assert.ok(team.stats.passesCompleted <= team.stats.passesAttempted);
  assert.ok(team.stats.shotsOnTarget <= team.stats.shots);
  assert.ok(team.stats.goals <= team.stats.shotsOnTarget);
  assert.equal(team.substitutionsUsed, team.substitutionHistory.length);
  assert.ok(team.substitutionsUsed <= 5);
  team.players.forEach(player => {
    assert.ok(Number.isFinite(player.x));
    assert.ok(Number.isFinite(player.y));
    assert.ok(player.stats.rating >= 4.2 && player.stats.rating <= 10);
  });
});

const goalCounts = first.events.filter(event => event.type === "goal").reduce(
  (counts, event) => {
    counts[event.teamIndex] += 1;
    return counts;
  },
  [0, 0]
);
assert.deepEqual(goalCounts, first.score);
const totalGoals = first.score.reduce((sum, value) => sum + value, 0);
const totalShots = first.teams.reduce((sum, team) => sum + team.stats.shots, 0);
const totalShotsOnTarget = first.teams.reduce((sum, team) => sum + team.stats.shotsOnTarget, 0);
const totalXg = first.teams.reduce((sum, team) => sum + team.stats.xG, 0);
assert.ok(totalGoals >= 1 && totalGoals <= 4, "o cenário padrão deve gerar placar plausível");
assert.ok(totalShots >= 18 && totalShots <= 34, "o volume padrão de chutes deve ser plausível");
assert.ok(totalShotsOnTarget >= 5 && totalShotsOnTarget <= 14, "chutes no alvo devem ficar em faixa plausível");
assert.ok(totalXg >= 1.4 && totalXg <= 4.2, "xG total deve ficar em faixa plausível");

const substitutionCase = createEngine(1);
substitutionCase.engine.start();
const userTeam = substitutionCase.engine.getSnapshot().teams[substitutionCase.data.userTeamIndex];
const outgoing = userTeam.players.find(player => player.role !== "GK");
const incoming = userTeam.bench[0];
const queued = substitutionCase.engine.queueSubstitution(
  substitutionCase.data.userTeamIndex,
  outgoing.id,
  incoming.id
);
assert.equal(queued.ok, true);
substitutionCase.engine.applyPendingChanges();
assert.equal(userTeam.substitutionsUsed, 1);
assert.ok(userTeam.players.some(player => String(player.id) === String(incoming.id)));
assert.ok(!userTeam.players.some(player => String(player.id) === String(outgoing.id)));

const positionCase = createEngine(1);
const positionTeamIndex = positionCase.data.userTeamIndex;
const positionTeam = positionTeamIndex === 0 ? positionCase.data.home : positionCase.data.away;
const positionLineup = positionTeamIndex === 0
  ? positionCase.data.homeLineup
  : positionCase.data.awayLineup;
const positionTactics = positionTeamIndex === 0
  ? positionCase.data.homeTactics
  : positionCase.data.awayTactics;
const movedPlayerId = positionLineup[1];
const preview = positionCase.engine.previewPlayerPosition(
  positionTeamIndex,
  movedPlayerId,
  { x: .95, y: .05 }
);
assert.ok(preview);
assert.ok(preview.clamped, "o motor deve limitar arraste fora da zona");
assert.ok(preview.zoneFit < 1, "um deslocamento grande deve reduzir encaixe de zona");
const customProfile = calculateTeamProfile(positionTeam, positionLineup, {
  ...positionTactics,
  playerPositions: {
    [movedPlayerId]: { x: preview.x, y: preview.y }
  }
});
assert.equal(customProfile.customPositions, 1);
assert.ok(customProfile.cohesion < 100, "posição manual extrema deve reduzir coesão");

console.log(JSON.stringify({
  ok: true,
  score: first.score,
  events: first.events.length,
  goals: goalCounts,
  shots: first.teams.map(team => team.stats.shots),
  shotsOnTarget: first.teams.map(team => team.stats.shotsOnTarget),
  xG: first.teams.map(team => Number(team.stats.xG.toFixed(2))),
  possession: first.teams.map(team => Math.round(team.stats.possessionSeconds)),
  customPosition: {
    clamped: preview.clamped,
    zoneFit: Number(preview.zoneFit.toFixed(2)),
    cohesion: customProfile.cohesion
  }
}, null, 2));

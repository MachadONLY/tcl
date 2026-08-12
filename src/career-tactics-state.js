import { isTacticsFormation } from './career-tactics-formations.js';

export const TACTICS_PHASES = Object.freeze(['base', 'possession', 'out']);
export const TACTICS_PLANS = Object.freeze(['A', 'B', 'C']);

const finitePoint = point => point && Number.isFinite(point.x) && Number.isFinite(point.y);
const clone = value => structuredClone(value);

export function ensureTacticalLayouts(career) {
  if (!career || typeof career !== 'object') return career;
  career.tacticalLayouts = career.tacticalLayouts && typeof career.tacticalLayouts === 'object'
    ? career.tacticalLayouts
    : {};
  for (const plan of TACTICS_PLANS) {
    career.tacticalLayouts[plan] ||= {};
    for (const phase of TACTICS_PHASES) career.tacticalLayouts[plan][phase] ||= {};
  }
  return career;
}

export function applyFormationState(career, formation) {
  if (!career || !isTacticsFormation(formation)) return false;
  ensureTacticalLayouts(career);
  career.formation = formation;
  // Formation is global for the XI. Reset every plan/phase so no previous
  // shape can leak back when the user changes plan after choosing a formation.
  for (const plan of TACTICS_PLANS) {
    career.tacticalLayouts[plan] = Object.fromEntries(
      TACTICS_PHASES.map(phase => [phase, {}])
    );
  }
  return true;
}

export function manualPosition(career, playerId, plan, phase) {
  ensureTacticalLayouts(career);
  const point = career?.tacticalLayouts?.[plan]?.[phase]?.[playerId];
  return finitePoint(point) ? { x: point.x, y: point.y } : null;
}

export function setManualPosition(career, { playerId, plan, phase, x, y }) {
  if (!career || !playerId || !TACTICS_PLANS.includes(plan) || !TACTICS_PHASES.includes(phase)) return false;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  ensureTacticalLayouts(career);
  career.tacticalLayouts[plan][phase][playerId] = {
    x: +Math.max(6, Math.min(94, x)).toFixed(2),
    y: +Math.max(6, Math.min(94, y)).toFixed(2)
  };
  return true;
}

export function removeManualPosition(career, playerId) {
  if (!career || !playerId) return;
  ensureTacticalLayouts(career);
  for (const plan of TACTICS_PLANS) {
    for (const phase of TACTICS_PHASES) delete career.tacticalLayouts[plan][phase][playerId];
  }
}

export function formationDraftFromCareer(career) {
  if (!career?.saveId || !career?.clubCode || !isTacticsFormation(career.formation)) return null;
  ensureTacticalLayouts(career);
  return {
    saveId: career.saveId,
    clubCode: career.clubCode,
    formation: career.formation,
    tacticalLayouts: clone(career.tacticalLayouts)
  };
}

import { CareerRepository } from './career-core/career-repository.js';

let pointer = null;
let saveTimer = 0;
let saveRevision = 0;
let saveChain = Promise.resolve();

const clone = value => structuredClone(value);

function tacticsRoot(node = null) {
  return (node instanceof Element ? node.closest('.tl-tactics-studio') : null)
    || document.querySelector('.tl-tactics-studio');
}

function formationDraft(career) {
  if (!career?.saveId || !career?.clubCode || !career?.formation || !career?.tacticalLayouts) return null;
  return {
    saveId: career.saveId,
    clubCode: career.clubCode,
    formation: career.formation,
    tacticalLayouts: clone(career.tacticalLayouts)
  };
}

function publishSavedCareer(saved) {
  if (!saved) return;
  globalThis.__touchlineCareerDraft = clone(saved);
  globalThis.__touchlineTacticsDraft = clone(saved.tactics || {});
  const draft = formationDraft(saved);
  if (draft) globalThis.__touchlineFormationDraft = draft;
}

function queueDurableSave(delay = 36) {
  const revision = ++saveRevision;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveChain = saveChain.catch(() => undefined).then(async () => {
      if (revision !== saveRevision) return;
      const live = globalThis.__touchlineCareerDraft;
      if (!live?.saveId || !live?.clubCode) return;
      const saved = await CareerRepository.save(clone(live));
      publishSavedCareer(saved);
    });
  }, delay);
}

function clearFreeDragMode() {
  document.documentElement.classList.remove('tl-lineup-free-drag');
}

// The mounted Studio used to ping a hidden legacy range input so the old page
// could mirror tactical values. That old page owns a stale module-scoped career
// and its input handler calls CareerRepository.save(), overwriting the Studio's
// newer formation, XI and manual x/y a few milliseconds later. Keep the hidden
// bridge for compatibility/layout only; it is never allowed to persist tactics.
document.addEventListener('input', event => {
  const legacyControl = event.target.closest?.('.tl-tactics-bridge [data-tactic], .tl-tactics-bridge [data-formation]');
  if (!legacyControl || location.hash !== '#tactics') return;
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);

document.addEventListener('change', event => {
  const legacyControl = event.target.closest?.('.tl-tactics-bridge [data-tactic], .tl-tactics-bridge [data-formation]');
  if (!legacyControl || location.hash !== '#tactics') return;
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);

document.addEventListener('pointerdown', event => {
  if (event.button !== 0) return;
  const player = event.target.closest?.('.tl-tactics-studio .tl-pitch [data-drag-player]');
  if (!player) return;
  pointer = {
    id: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    moved: false
  };
}, true);

document.addEventListener('pointermove', event => {
  if (!pointer || event.pointerId !== pointer.id) return;
  if (!pointer.moved && Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) >= 5) {
    pointer.moved = true;
    document.documentElement.classList.add('tl-lineup-free-drag');
  }
}, true);

window.addEventListener('pointerup', event => {
  if (!pointer || event.pointerId !== pointer.id) return;
  const moved = pointer.moved;
  pointer = null;
  clearFreeDragMode();
  if (moved) queueDurableSave();
}, false);

window.addEventListener('pointercancel', event => {
  if (!pointer || event.pointerId !== pointer.id) return;
  pointer = null;
  clearFreeDragMode();
}, false);

// Formation, tactical instruction, responsibility and role changes publish a
// fresh career draft in their owning controller before the event reaches window.
window.addEventListener('change', event => {
  if (!tacticsRoot(event.target) || event.target.closest?.('.tl-tactics-bridge')) return;
  queueDurableSave();
}, false);

window.addEventListener('click', event => {
  const target = event.target.closest?.('.tl-tactics-studio [data-tl-plan], .tl-tactics-studio [data-tl-focus], .tl-tactics-studio [data-tl-field], .tl-tactics-studio [data-tl-toggle]');
  if (target) queueDurableSave(48);
}, false);

window.addEventListener('pagehide', () => {
  clearTimeout(saveTimer);
  const live = globalThis.__touchlineCareerDraft;
  if (!live?.saveId || !live?.clubCode) return;
  CareerRepository.save(clone(live)).catch(() => undefined);
});

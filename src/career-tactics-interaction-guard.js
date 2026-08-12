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
      const snapshot = clone(live);
      const saved = await CareerRepository.save(snapshot);
      // CareerRepository consumes the global draft while merging. Re-publish the
      // persisted snapshot so the legacy shell can never save an older career.
      publishSavedCareer(saved);
    });
  }, delay);
}

function clearFreeDragMode() {
  document.documentElement.classList.remove('tl-lineup-free-drag');
}

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
    // For an on-pitch player the primary gesture is precise free positioning.
    // Disable hit-testing of the other field players for this pointer sequence,
    // so their labels/avatars can never steal the pitch drop target.
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

// Formation, tactical instruction, responsibility and role changes all publish
// a fresh career draft in the owning controller before the event reaches window.
window.addEventListener('change', event => {
  if (!tacticsRoot(event.target)) return;
  queueDurableSave();
}, false);

// Buttons such as plan/focus switches mutate state on click instead of change.
window.addEventListener('click', event => {
  const target = event.target.closest?.('.tl-tactics-studio [data-tl-plan], .tl-tactics-studio [data-tl-focus], .tl-tactics-studio [data-tl-field], .tl-tactics-studio [data-tl-toggle]');
  if (target) queueDurableSave(48);
}, false);

window.addEventListener('pagehide', () => {
  clearTimeout(saveTimer);
  const live = globalThis.__touchlineCareerDraft;
  if (!live?.saveId || !live?.clubCode) return;
  // IndexedDB work may finish during pagehide in modern browsers. Fire without
  // blocking navigation; localStorage fallback is written synchronously inside save.
  CareerRepository.save(clone(live)).catch(() => undefined);
});

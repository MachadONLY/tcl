let pointer = null;

function clearFreeDragMode() {
  document.documentElement.classList.remove('tl-lineup-free-drag');
}

// The mounted Studio keeps a hidden legacy page only as a compatibility shell.
// That shell must never persist tactics: its module-scoped career can be older
// than the live Studio state and used to overwrite formation/XI/manual x-y.
function blockLegacyTacticsEvent(event) {
  const legacyControl = event.target.closest?.('.tl-tactics-bridge [data-tactic], .tl-tactics-bridge [data-formation]');
  if (!legacyControl || location.hash !== '#tactics') return;
  event.preventDefault();
  event.stopImmediatePropagation();
}

document.addEventListener('input', blockLegacyTacticsEvent, true);
document.addEventListener('change', blockLegacyTacticsEvent, true);

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
    // A starter drag is precise free positioning. While the gesture is active,
    // field-player visuals stop stealing hit tests from the pitch surface.
    document.documentElement.classList.add('tl-lineup-free-drag');
  }
}, true);

function finishPointer(event) {
  if (!pointer || event.pointerId !== pointer.id) return;
  pointer = null;
  clearFreeDragMode();
}

window.addEventListener('pointerup', finishPointer, false);
window.addEventListener('pointercancel', finishPointer, false);
window.addEventListener('blur', () => {
  pointer = null;
  clearFreeDragMode();
});

// Persistence intentionally lives only in career-tactics-studio.js. Do not add
// CareerRepository.save() calls here: a second save controller reintroduces the
// exact race this guard exists to prevent.

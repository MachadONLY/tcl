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

// Keep every XI player hit-testable while dragging. The Studio owns the exact
// semantic rule: empty grass = free positioning; another player = swap. Do not
// disable pointer events on field players here, otherwise player-on-player drops
// collapse into ordinary pitch drops.

// Persistence intentionally lives only in career-tactics-studio.js. Do not add
// CareerRepository.save() calls here: a second save controller reintroduces the
// exact race this guard exists to prevent.

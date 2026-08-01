const RESTORE_WINDOW_MS = 900;

let pendingRestore = null;
let restoreFrame = 0;

function isSquadRoute() {
  return window.location.hash.split("?")[0] === "#squad";
}

function findPlayerRow(playerId) {
  return [...document.querySelectorAll(".career-squad-scroll [data-squad-player]")]
    .find(row => row.dataset.squadPlayer === playerId) || null;
}

function captureScrollAnchor(row) {
  const scroll = row.closest(".career-squad-scroll");
  if (!scroll) return null;

  const scrollRect = scroll.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();

  return {
    playerId: row.dataset.squadPlayer,
    rowViewportOffset: rowRect.top - scrollRect.top,
    fallbackScrollTop: scroll.scrollTop,
    startedAt: performance.now()
  };
}

function clearPendingRestore() {
  pendingRestore = null;
  if (restoreFrame) cancelAnimationFrame(restoreFrame);
  restoreFrame = 0;
}

function restoreScrollAnchor() {
  restoreFrame = 0;
  const snapshot = pendingRestore;
  if (!snapshot || !isSquadRoute()) return;

  if (performance.now() - snapshot.startedAt > RESTORE_WINDOW_MS) {
    clearPendingRestore();
    return;
  }

  const scroll = document.querySelector(".career-squad-scroll");
  const row = findPlayerRow(snapshot.playerId);
  if (!scroll || !row) {
    scheduleRestore();
    return;
  }

  const scrollRect = scroll.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  const currentOffset = rowRect.top - scrollRect.top;
  const correction = currentOffset - snapshot.rowViewportOffset;

  if (Math.abs(correction) > 0.5) {
    scroll.scrollTop += correction;
  } else if (scroll.scrollTop === 0 && snapshot.fallbackScrollTop > 0) {
    scroll.scrollTop = snapshot.fallbackScrollTop;
  }

  scheduleRestore();
}

function scheduleRestore() {
  if (!pendingRestore || restoreFrame) return;
  restoreFrame = requestAnimationFrame(restoreScrollAnchor);
}

function stopRestoreOnUserScroll(event) {
  if (!pendingRestore) return;
  if (event.target.closest?.(".career-squad-scroll")) clearPendingRestore();
}

// Capture only the visual anchor. The original career-mode click handler remains
// fully responsible for changing the selected player, updating the profile and
// persisting the save. No propagation is blocked and no synthetic hashchange is
// emitted, so global navigation controls continue to work normally.
document.addEventListener("click", event => {
  if (!isSquadRoute()) return;

  const row = event.target.closest(".career-squad-scroll [data-squad-player]");
  if (!row) return;

  const snapshot = captureScrollAnchor(row);
  if (!snapshot?.playerId) return;

  pendingRestore = snapshot;
  scheduleRestore();
}, true);

const squadObserver = new MutationObserver(() => {
  if (pendingRestore) scheduleRestore();
});

squadObserver.observe(document.body, { childList: true, subtree: true });

document.addEventListener("wheel", stopRestoreOnUserScroll, { capture: true, passive: true });
document.addEventListener("touchmove", stopRestoreOnUserScroll, { capture: true, passive: true });
window.addEventListener("hashchange", () => {
  if (!isSquadRoute()) clearPendingRestore();
});

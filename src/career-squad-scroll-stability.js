const CAREER_STORAGE_KEY = "touchline.career.mode.v1";
const RESTORE_WINDOW_MS = 900;

let pendingRestore = null;
let restoreFrame = 0;

function isSquadRoute() {
  return window.location.hash.split("?")[0] === "#squad";
}

function readCareerSave() {
  try {
    return JSON.parse(localStorage.getItem(CAREER_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function persistSelectedPlayer(playerId) {
  const save = readCareerSave();
  save.selectedSquadId = playerId;
  localStorage.setItem(CAREER_STORAGE_KEY, JSON.stringify(save));
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

function restoreScrollAnchor() {
  restoreFrame = 0;
  const snapshot = pendingRestore;
  if (!snapshot || !isSquadRoute()) return;

  if (performance.now() - snapshot.startedAt > RESTORE_WINDOW_MS) {
    pendingRestore = null;
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
  if (event.target.closest?.(".career-squad-scroll")) {
    pendingRestore = null;
    if (restoreFrame) cancelAnimationFrame(restoreFrame);
    restoreFrame = 0;
  }
}

document.addEventListener("click", event => {
  if (!isSquadRoute()) return;

  const row = event.target.closest(".career-squad-scroll [data-squad-player]");
  if (!row) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  if (row.classList.contains("selected")) return;

  const snapshot = captureScrollAnchor(row);
  if (!snapshot?.playerId) return;

  document.querySelectorAll(".career-squad-scroll [data-squad-player]")
    .forEach(candidate => candidate.classList.toggle("selected", candidate === row));

  persistSelectedPlayer(snapshot.playerId);
  pendingRestore = snapshot;

  // Rebuilds only the career route while the anchor restoration keeps the
  // selected player at the exact same visual position in the list.
  window.dispatchEvent(new Event("hashchange"));
  scheduleRestore();
}, true);

const squadObserver = new MutationObserver(() => {
  if (pendingRestore) scheduleRestore();
});

squadObserver.observe(document.body, { childList: true, subtree: true });

document.addEventListener("wheel", stopRestoreOnUserScroll, { capture: true, passive: true });
document.addEventListener("touchmove", stopRestoreOnUserScroll, { capture: true, passive: true });
window.addEventListener("hashchange", () => {
  if (!isSquadRoute()) pendingRestore = null;
});

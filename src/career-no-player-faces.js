function removePlayerFaces(root = document) {
  root.querySelectorAll?.(".career-face, .home-v8-player-face, [data-player-face], .player-face").forEach(node => node.remove());
}

let queued = false;
function queueCleanup() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    removePlayerFaces();
  });
}

const observer = new MutationObserver(queueCleanup);
observer.observe(document.body, { childList: true, subtree: true });

document.addEventListener("DOMContentLoaded", queueCleanup, { once: true });
queueCleanup();

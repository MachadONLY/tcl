let targetX = -9999;
let targetY = -9999;
let frame = 0;
let lastGhost = null;

function dragGhost() {
  return document.querySelector('.tl-drag-ghost');
}

function latestPointerSample(event) {
  const samples = event.getCoalescedEvents?.();
  return samples?.length ? samples[samples.length - 1] : event;
}

function drawGhost() {
  frame = 0;
  const ghost = dragGhost();
  if (!ghost) {
    lastGhost = null;
    return;
  }

  if (ghost !== lastGhost) {
    lastGhost = ghost;
    ghost.dataset.preciseDrag = 'true';
  }

  // Pointer input is sampled at native frequency, but painting happens only on
  // the next animation frame. This keeps the avatar buttery smooth without the
  // elastic lag that an interpolated cursor follower introduces.
  ghost.style.setProperty('--tl-drag-x', `${targetX.toFixed(2)}px`);
  ghost.style.setProperty('--tl-drag-y', `${targetY.toFixed(2)}px`);
}

function scheduleGhost() {
  if (!frame) frame = requestAnimationFrame(drawGhost);
}

function capturePointer(event) {
  const sample = latestPointerSample(event);
  targetX = sample.clientX;
  targetY = sample.clientY;
  scheduleGhost();
}

function resetPointer() {
  targetX = -9999;
  targetY = -9999;
  lastGhost = null;
}

document.addEventListener('pointerdown', capturePointer, { capture: true, passive: true });
document.addEventListener('pointermove', capturePointer, { capture: true, passive: true });
document.addEventListener('pointerup', () => requestAnimationFrame(resetPointer), { capture: true, passive: true });
document.addEventListener('pointercancel', resetPointer, { capture: true, passive: true });

const observer = new MutationObserver(() => {
  if (dragGhost()) scheduleGhost();
});

observer.observe(document.documentElement, { childList: true, subtree: true });

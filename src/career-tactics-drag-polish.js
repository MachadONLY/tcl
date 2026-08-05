let targetX = -9999;
let targetY = -9999;
let currentX = -9999;
let currentY = -9999;
let frame = 0;

function dragGhost() {
  return document.querySelector('.tl-drag-ghost');
}

function drawGhost() {
  frame = 0;
  const ghost = dragGhost();
  if (!ghost) {
    currentX = targetX;
    currentY = targetY;
    return;
  }

  if (currentX < -1000 || currentY < -1000) {
    currentX = targetX;
    currentY = targetY;
  } else {
    const easing = 0.58;
    currentX += (targetX - currentX) * easing;
    currentY += (targetY - currentY) * easing;
  }

  ghost.style.setProperty('--tl-drag-x', `${currentX.toFixed(2)}px`);
  ghost.style.setProperty('--tl-drag-y', `${currentY.toFixed(2)}px`);

  if (Math.abs(targetX - currentX) > 0.15 || Math.abs(targetY - currentY) > 0.15) {
    frame = requestAnimationFrame(drawGhost);
  }
}

function scheduleGhost() {
  if (!frame) frame = requestAnimationFrame(drawGhost);
}

function capturePointer(event) {
  targetX = event.clientX;
  targetY = event.clientY;
  scheduleGhost();
}

document.addEventListener('pointerdown', capturePointer, { capture: true, passive: true });
document.addEventListener('pointermove', capturePointer, { capture: true, passive: true });

const observer = new MutationObserver(() => {
  if (dragGhost()) scheduleGhost();
});

observer.observe(document.documentElement, { childList: true, subtree: true });

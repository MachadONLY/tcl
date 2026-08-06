const app = document.querySelector('#app');
const installedRoots = new WeakSet();
let pointerInteraction = null;
let resizeFrame = 0;

function playerIds(container, selector) {
  return [...container.querySelectorAll(selector)].map(node => node.dataset.dragPlayer);
}

function sameList(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sameSquadComposition(root, next) {
  return sameList(
    playerIds(root, '.tl-pitch .tl-player-node[data-drag-player]'),
    playerIds(next, '.tl-pitch .tl-player-node[data-drag-player]')
  ) && sameList(
    playerIds(root, '.tl-bench-list [data-drag-player]'),
    playerIds(next, '.tl-bench-list [data-drag-player]')
  ) && sameList(
    playerIds(root, '.tl-roster-grid.reserves [data-drag-player]'),
    playerIds(next, '.tl-roster-grid.reserves [data-drag-player]')
  );
}

function selectedPlayerId(container) {
  return container.querySelector('[data-drag-player].selected')?.dataset.dragPlayer || null;
}

function syncAttributes(current, next) {
  for (const attribute of [...current.attributes]) {
    if (!next.hasAttribute(attribute.name)) current.removeAttribute(attribute.name);
  }
  for (const attribute of [...next.attributes]) {
    if (current.getAttribute(attribute.name) !== attribute.value) {
      current.setAttribute(attribute.name, attribute.value);
    }
  }
}

function playerKind(node) {
  if (node.classList.contains('tl-player-node')) return 'pitch';
  if (node.classList.contains('tl-squad-card')) return 'card';
  return 'unknown';
}

function syncPlayerElement(current, next) {
  syncAttributes(current, next);
  const currentImage = current.querySelector('img');
  const nextImage = next.querySelector('img');
  if (currentImage && nextImage && currentImage.src !== nextImage.src) currentImage.src = nextImage.src;

  const textSelectors = [
    '.tl-player-label strong', '.tl-player-label small',
    '.tl-squad-copy strong', '.tl-squad-copy small', '.tl-card-overall'
  ];
  for (const selector of textSelectors) {
    const currentText = current.querySelector(selector);
    const nextText = next.querySelector(selector);
    if (currentText && nextText && currentText.textContent !== nextText.textContent) {
      currentText.textContent = nextText.textContent;
    }
  }
}

function syncSelectedClasses(root, next) {
  const selected = selectedPlayerId(next);
  root.querySelectorAll('[data-drag-player]').forEach(node => {
    node.classList.toggle('selected', Boolean(selected) && node.dataset.dragPlayer === selected);
  });
}

function syncInspector(root, next) {
  if (root.dataset.tacticsView === 'lineup') return;
  const currentInspector = root.querySelector('.tl-inspector');
  const nextInspector = next.querySelector('.tl-inspector');
  if (!currentInspector || !nextInspector) return;
  const scrollTop = currentInspector.scrollTop;
  currentInspector.replaceChildren(...[...nextInspector.childNodes].map(node => node.cloneNode(true)));
  currentInspector.scrollTop = scrollTop;
}

function syncPitchPositions(root, next) {
  const currentById = new Map(
    [...root.querySelectorAll('.tl-pitch .tl-player-node[data-drag-player]')]
      .map(node => [node.dataset.dragPlayer, node])
  );
  next.querySelectorAll('.tl-pitch .tl-player-node[data-drag-player]').forEach(nextNode => {
    const current = currentById.get(nextNode.dataset.dragPlayer);
    if (!current) return;
    syncPlayerElement(current, nextNode);
  });
  syncSelectedClasses(root, next);
  syncInspector(root, next);
}

function materializePlayer(nextNode, existingById) {
  const existing = existingById.get(nextNode.dataset.dragPlayer);
  if (!existing || playerKind(existing) !== playerKind(nextNode)) return nextNode.cloneNode(true);
  syncPlayerElement(existing, nextNode);
  return existing;
}

function reconcilePlayerContainer(currentContainer, nextContainer, existingById) {
  if (!currentContainer || !nextContainer) return [];
  const desired = [...nextContainer.querySelectorAll(':scope > [data-drag-player]')]
    .map(nextNode => materializePlayer(nextNode, existingById));

  currentContainer.querySelectorAll(':scope > .tl-empty-roster').forEach(node => node.remove());
  desired.forEach(node => currentContainer.append(node));
  if (!desired.length) {
    const empty = nextContainer.querySelector(':scope > .tl-empty-roster');
    if (empty) currentContainer.append(empty.cloneNode(true));
  }
  return desired;
}

function syncSquadContainers(root, next) {
  const roster = root.querySelector('.tl-roster-grid.reserves');
  const rosterScroll = roster?.scrollLeft || 0;
  const benchScroll = root.querySelector('.tl-bench-list')?.scrollTop || 0;
  const existing = [...root.querySelectorAll('[data-drag-player]')];
  const existingById = new Map(existing.map(node => [node.dataset.dragPlayer, node]));

  const pitch = root.querySelector('.tl-pitch');
  const nextPitch = next.querySelector('.tl-pitch');
  const bench = root.querySelector('.tl-bench-list');
  const nextBench = next.querySelector('.tl-bench-list');
  const nextRoster = next.querySelector('.tl-roster-grid.reserves');

  const desired = new Set([
    ...reconcilePlayerContainer(pitch, nextPitch, existingById),
    ...reconcilePlayerContainer(bench, nextBench, existingById),
    ...reconcilePlayerContainer(roster, nextRoster, existingById)
  ]);
  existing.forEach(node => {
    if (node.isConnected && !desired.has(node)) node.remove();
  });

  const countPairs = [
    ['.tl-bench-dock>header small', '.tl-bench-dock>header small'],
    ['.tl-squad-manager>header small', '.tl-squad-manager>header small']
  ];
  countPairs.forEach(([currentSelector, nextSelector]) => {
    const currentNode = root.querySelector(currentSelector);
    const nextNode = next.querySelector(nextSelector);
    if (currentNode && nextNode) currentNode.textContent = nextNode.textContent;
  });

  syncSelectedClasses(root, next);
  syncInspector(root, next);
  if (roster) roster.scrollLeft = rosterScroll;
  if (bench) bench.scrollTop = benchScroll;
}

function interactionPatch(root, markup) {
  if (!pointerInteraction || pointerInteraction.root !== root) return false;
  const parser = document.createElement('div');
  parser.innerHTML = markup;

  if (!pointerInteraction.moved && sameSquadComposition(root, parser)) {
    syncSelectedClasses(root, parser);
    syncInspector(root, parser);
    return true;
  }

  if (pointerInteraction.moved && sameSquadComposition(root, parser)) {
    syncPitchPositions(root, parser);
    return true;
  }

  if (pointerInteraction.moved) {
    syncSquadContainers(root, parser);
    return true;
  }
  return false;
}

function unlockGeometry(root) {
  root.removeAttribute('data-hard-geometry');
  root.style.removeProperty('--tl-locked-war-height');
  root.style.removeProperty('--tl-locked-pitch-height');
  root.style.removeProperty('--tl-locked-field-height');
  root.style.removeProperty('--tl-locked-rail-height');
}

function lockGeometry(root) {
  if (!root.isConnected || root.dataset.tacticsView !== 'lineup') {
    unlockGeometry(root);
    return;
  }
  const warRoom = root.querySelector('.tl-war-room');
  const pitchStage = root.querySelector('.tl-pitch-stage');
  const field = root.querySelector('.tl-pitch');
  const rail = root.querySelector('.tl-side-rail');
  if (!warRoom || !pitchStage || !field || !rail) return;

  const warHeight = Math.round(warRoom.getBoundingClientRect().height);
  const pitchHeight = Math.round(pitchStage.getBoundingClientRect().height);
  const fieldHeight = Math.round(field.getBoundingClientRect().height);
  const railHeight = Math.round(rail.getBoundingClientRect().height);
  if (Math.min(warHeight, pitchHeight, fieldHeight, railHeight) < 100) return;

  root.style.setProperty('--tl-locked-war-height', `${warHeight}px`);
  root.style.setProperty('--tl-locked-pitch-height', `${pitchHeight}px`);
  root.style.setProperty('--tl-locked-field-height', `${fieldHeight}px`);
  root.style.setProperty('--tl-locked-rail-height', `${railHeight}px`);
  root.dataset.hardGeometry = 'true';
}

function scheduleGeometryLock(root) {
  requestAnimationFrame(() => requestAnimationFrame(() => lockGeometry(root)));
}

function install(root) {
  if (installedRoots.has(root) || root.dataset.liveDom !== 'true') return;
  const descriptor = Object.getOwnPropertyDescriptor(root, 'innerHTML');
  if (!descriptor?.set || !descriptor?.get) return;
  installedRoots.add(root);

  Object.defineProperty(root, 'innerHTML', {
    configurable: true,
    get() {
      return descriptor.get.call(root);
    },
    set(markup) {
      const text = String(markup);
      if (interactionPatch(root, text)) return;
      descriptor.set.call(root, text);
    }
  });

  root.dataset.interactionStable = 'true';
  scheduleGeometryLock(root);
}

function scan() {
  if (location.hash !== '#tactics') return;
  const root = document.querySelector('.tl-tactics-studio');
  if (!root) return;
  install(root);
  if (root.dataset.tacticsView === 'lineup' && root.dataset.hardGeometry !== 'true') {
    scheduleGeometryLock(root);
  }
}

document.addEventListener('pointerdown', event => {
  const player = event.target.closest('.tl-tactics-studio [data-drag-player]');
  if (!player || event.button !== 0) return;
  const root = player.closest('.tl-tactics-studio');
  if (!root) return;
  event.preventDefault();
  pointerInteraction = {
    root,
    pointerId: event.pointerId,
    playerId: player.dataset.dragPlayer,
    startX: event.clientX,
    startY: event.clientY,
    moved: false
  };
}, true);

document.addEventListener('pointermove', event => {
  if (!pointerInteraction || event.pointerId !== pointerInteraction.pointerId) return;
  if (Math.hypot(event.clientX - pointerInteraction.startX, event.clientY - pointerInteraction.startY) >= 5) {
    pointerInteraction.moved = true;
  }
}, true);

function finishPointer(event) {
  if (!pointerInteraction || event.pointerId !== pointerInteraction.pointerId) return;
  setTimeout(() => {
    if (pointerInteraction?.pointerId === event.pointerId) pointerInteraction = null;
  }, 0);
}

document.addEventListener('pointerup', finishPointer, true);
document.addEventListener('pointercancel', finishPointer, true);

new MutationObserver(mutations => {
  let viewChanged = false;
  for (const mutation of mutations) {
    if (mutation.type === 'attributes' && mutation.attributeName === 'data-tactics-view') viewChanged = true;
  }
  scan();
  if (viewChanged) {
    const root = document.querySelector('.tl-tactics-studio');
    if (!root) return;
    unlockGeometry(root);
    scheduleGeometryLock(root);
  }
}).observe(app, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-tactics-view', 'data-live-dom'] });

window.addEventListener('resize', () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    const root = document.querySelector('.tl-tactics-studio');
    if (!root) return;
    unlockGeometry(root);
    scheduleGeometryLock(root);
  });
});
window.addEventListener('hashchange', scan);
scan();

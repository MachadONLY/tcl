const app = document.querySelector('#app');
const innerHTMLDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
const installedRoots = new WeakSet();
const rosterEnhancements = new WeakMap();

const UNIQUE_CLASSES = new Set([
  'tl-stadium-light', 'tl-command-bar', 'tl-command-title', 'tl-shape-switch',
  'tl-command-actions', 'tl-save-state', 'tl-war-room', 'tl-tactic-controls',
  'tl-panel-heading', 'tl-plan-tabs', 'tl-phase-tabs', 'tl-controls-scroll',
  'tl-pitch-stage', 'tl-field-hud', 'tl-pitch', 'tl-pitch-atmosphere',
  'tl-pitch-zones', 'tl-pitch-lines', 'tl-side-rail', 'tl-inspector',
  'tl-bench-dock', 'tl-bench-list', 'tl-squad-manager', 'tl-roster-grid',
  'tl-toast'
]);

function elementKey(node) {
  if (!(node instanceof Element)) return null;
  if (node.matches('[data-drag-player]')) {
    return `player:${node.dataset.zone || 'unknown'}:${node.dataset.dragPlayer}`;
  }

  const keyedAttributes = [
    ['data-tl-tab'], ['data-tl-pitch-phase'], ['data-tl-plan'],
    ['data-tl-field', 'data-tl-value'], ['data-tl-select'], ['data-tl-toggle'],
    ['data-tl-role'], ['data-tl-focus', 'data-focus'], ['data-roster-filter'],
    ['data-tl-formation'], ['data-drop-zone'], ['data-field-formation-control']
  ];
  for (const attributes of keyedAttributes) {
    if (!node.hasAttribute(attributes[0])) continue;
    return attributes.map(name => `${name}:${node.getAttribute(name) || ''}`).join('|');
  }

  const uniqueClass = [...node.classList].find(name => UNIQUE_CLASSES.has(name));
  return uniqueClass ? `class:${uniqueClass}` : null;
}

function sameNodeType(current, next) {
  return current.nodeType === next.nodeType && (
    current.nodeType !== Node.ELEMENT_NODE || current.tagName === next.tagName
  );
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

  if (current instanceof HTMLInputElement && next instanceof HTMLInputElement) {
    current.checked = next.checked;
    current.value = next.value;
  }
  if (current instanceof HTMLSelectElement && next instanceof HTMLSelectElement) {
    current.value = next.value;
  }
}

function morphNode(current, next) {
  if (!sameNodeType(current, next)) {
    current.replaceWith(next.cloneNode(true));
    return;
  }
  if (current.nodeType === Node.TEXT_NODE || current.nodeType === Node.COMMENT_NODE) {
    if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue;
    return;
  }
  syncAttributes(current, next);
  morphChildren(current, next);
  if (current instanceof HTMLSelectElement && next instanceof HTMLSelectElement) {
    current.value = next.value;
  }
}

function morphChildren(currentParent, nextParent) {
  const existing = [...currentParent.childNodes];
  const used = new Set();
  const keyed = new Map();
  for (const child of existing) {
    const key = elementKey(child);
    if (key && !keyed.has(key)) keyed.set(key, child);
  }

  const desired = [];
  let fallbackIndex = 0;
  for (const nextChild of [...nextParent.childNodes]) {
    const key = elementKey(nextChild);
    let match = key ? keyed.get(key) : null;
    if (match && used.has(match)) match = null;

    if (!match) {
      while (fallbackIndex < existing.length) {
        const candidate = existing[fallbackIndex++];
        if (used.has(candidate) || elementKey(candidate)) continue;
        if (sameNodeType(candidate, nextChild)) {
          match = candidate;
          break;
        }
      }
    }

    if (!match) match = nextChild.cloneNode(true);
    else morphNode(match, nextChild);
    used.add(match);
    desired.push(match);
  }

  desired.forEach((node, index) => {
    const reference = currentParent.childNodes[index] || null;
    if (reference !== node) currentParent.insertBefore(node, reference);
  });
  for (const child of [...currentParent.childNodes]) {
    if (!desired.includes(child)) child.remove();
  }
}

function detachPersistentUi(root) {
  const rolesView = root.querySelector('[data-responsibilities-view]');
  const navigation = rolesView?.contains(root.querySelector('[data-tactics-view-nav]'))
    ? null
    : root.querySelector('[data-tactics-view-nav]');
  const viewToast = root.querySelector('[data-three-view-toast]');
  rolesView?.remove();
  navigation?.remove();
  viewToast?.remove();
  return { rolesView, navigation, viewToast };
}

function restorePersistentUi(root, persistent) {
  if (persistent.rolesView) {
    const commandBar = root.querySelector('.tl-command-bar');
    commandBar?.insertAdjacentElement('afterend', persistent.rolesView);
  }
  if (persistent.navigation) {
    const host = root.dataset.tacticsView === 'roles'
      ? root.querySelector('.tl-responsibilities-head')
      : root.querySelector('.tl-side-rail');
    if (host) {
      if (root.dataset.tacticsView === 'roles') host.append(persistent.navigation);
      else host.prepend(persistent.navigation);
    }
  }
  if (persistent.viewToast) root.append(persistent.viewToast);
}

function scrollCandidates(root) {
  const candidates = new Set([
    document.scrollingElement,
    document.documentElement,
    document.body,
    root,
    root.querySelector('.tl-roster-grid.reserves'),
    root.querySelector('.tl-bench-list'),
    root.querySelector('.tl-controls-scroll'),
    root.querySelector('.tl-side-rail'),
    document.querySelector('.cp-work'),
    document.querySelector('.cp-content')
  ].filter(Boolean));

  let ancestor = root.parentElement;
  while (ancestor) {
    candidates.add(ancestor);
    ancestor = ancestor.parentElement;
  }
  return [...candidates];
}

function verticalScroller(root) {
  let node = root.parentElement;
  while (node) {
    const style = getComputedStyle(node);
    if (/(auto|scroll|overlay)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1) return node;
    node = node.parentElement;
  }
  return document.scrollingElement || document.documentElement;
}

function captureGeometry(root) {
  const pitch = root.querySelector('.tl-pitch-stage');
  const field = root.querySelector('.tl-pitch');
  const warRoom = root.querySelector('.tl-war-room');
  return {
    pitchTop: pitch?.getBoundingClientRect().top ?? null,
    pitchLeft: pitch?.getBoundingClientRect().left ?? null,
    fieldTop: field?.getBoundingClientRect().top ?? null,
    warRoomTop: warRoom?.getBoundingClientRect().top ?? null,
    scroller: verticalScroller(root),
    scrolls: scrollCandidates(root).map(element => ({
      element,
      top: element.scrollTop,
      left: element.scrollLeft
    }))
  };
}

function restoreScrollPositions(snapshot) {
  for (const item of snapshot.scrolls) {
    if (!item.element?.isConnected) continue;
    if (item.element.scrollTop !== item.top) item.element.scrollTop = item.top;
    if (item.element.scrollLeft !== item.left) item.element.scrollLeft = item.left;
  }
}

function stabilizeGeometry(root, snapshot) {
  if (!snapshot) return;
  restoreScrollPositions(snapshot);
  const pitch = root.querySelector('.tl-pitch-stage');
  if (pitch && Number.isFinite(snapshot.pitchTop)) {
    const currentTop = pitch.getBoundingClientRect().top;
    const delta = currentTop - snapshot.pitchTop;
    if (Math.abs(delta) > .25 && snapshot.scroller?.isConnected) {
      snapshot.scroller.scrollTop += delta;
    }
  }
  restoreScrollPositions({
    ...snapshot,
    scrolls: snapshot.scrolls.filter(item => item.element !== snapshot.scroller)
  });
}

function morphStudio(root, markup) {
  if (!root.querySelector('.tl-war-room')) {
    innerHTMLDescriptor.set.call(root, markup);
    return;
  }

  const geometry = captureGeometry(root);
  const parser = document.createElement('div');
  parser.innerHTML = markup;
  const persistent = detachPersistentUi(root);
  try {
    morphChildren(root, parser);
  } finally {
    restorePersistentUi(root, persistent);
  }
  stabilizeGeometry(root, geometry);
  requestAnimationFrame(() => {
    stabilizeGeometry(root, geometry);
    enhanceRoster(root);
  });
}

function installLiveDom(root) {
  if (installedRoots.has(root)) return;
  installedRoots.add(root);
  Object.defineProperty(root, 'innerHTML', {
    configurable: true,
    get() {
      return innerHTMLDescriptor.get.call(root);
    },
    set(markup) {
      try {
        morphStudio(root, String(markup));
      } catch (error) {
        console.warn('Touchline live DOM fallback:', error);
        innerHTMLDescriptor.set.call(root, markup);
      }
    }
  });
  root.dataset.liveDom = 'true';
  root.dataset.geometryLock = 'true';
  enhanceRoster(root, true);
}

function rosterPageSize(grid) {
  return Math.max(420, Math.floor(grid.clientWidth * .76));
}

function rosterMaximum(grid) {
  return Math.max(0, grid.scrollWidth - grid.clientWidth);
}

function scrollRoster(grid, direction) {
  const page = rosterPageSize(grid);
  const max = rosterMaximum(grid);
  if (direction < 0) {
    const target = grid.scrollLeft <= page * 1.05 ? 0 : Math.max(0, grid.scrollLeft - page);
    grid.scrollTo({ left: target, behavior: 'smooth' });
    return;
  }
  const remaining = max - grid.scrollLeft;
  const target = remaining <= page * 1.05 ? max : Math.min(max, grid.scrollLeft + page);
  grid.scrollTo({ left: target, behavior: 'smooth' });
}

function updateRosterControls(root) {
  const state = rosterEnhancements.get(root);
  if (!state?.grid?.isConnected) return;
  const { grid, previous, next } = state;
  const max = rosterMaximum(grid);
  previous.disabled = grid.scrollLeft <= 2;
  next.disabled = grid.scrollLeft >= max - 2;
  previous.setAttribute('aria-disabled', String(previous.disabled));
  next.setAttribute('aria-disabled', String(next.disabled));
}

function enhanceRoster(root, reset = false) {
  const grid = root.querySelector('.tl-roster-grid.reserves');
  const header = root.querySelector('.tl-squad-manager > header');
  if (!grid || !header) return;

  let state = rosterEnhancements.get(root);
  if (!state || state.grid !== grid) {
    const tools = document.createElement('div');
    tools.className = 'tl-roster-scroll-tools';
    tools.innerHTML = '<button type="button" data-roster-scroll="previous" aria-label="Jogadores anteriores">‹</button><button type="button" data-roster-scroll="next" aria-label="Próximos jogadores">›</button>';
    header.append(tools);
    const previous = tools.querySelector('[data-roster-scroll="previous"]');
    const next = tools.querySelector('[data-roster-scroll="next"]');
    previous.onclick = () => scrollRoster(grid, -1);
    next.onclick = () => scrollRoster(grid, 1);
    grid.addEventListener('scroll', () => updateRosterControls(root), { passive: true });
    grid.addEventListener('keydown', event => {
      if (event.key === 'Home') grid.scrollTo({ left: 0, behavior: 'smooth' });
      if (event.key === 'End') grid.scrollTo({ left: rosterMaximum(grid), behavior: 'smooth' });
    });
    grid.tabIndex = 0;
    state = { grid, previous, next, filter: '' };
    rosterEnhancements.set(root, state);
    if ('ResizeObserver' in globalThis) {
      new ResizeObserver(() => updateRosterControls(root)).observe(grid);
    }
  }

  const filter = root.querySelector('[data-roster-filter].active')?.dataset.rosterFilter || 'ALL';
  if (reset || state.filter !== filter) {
    state.filter = filter;
    grid.scrollLeft = 0;
  }
  updateRosterControls(root);
}

function scan() {
  if (location.hash !== '#tactics') return;
  const root = document.querySelector('.tl-tactics-studio');
  if (!root) return;
  installLiveDom(root);
  enhanceRoster(root);
}

new MutationObserver(() => queueMicrotask(scan)).observe(app, { childList: true, subtree: true });
window.addEventListener('hashchange', scan);
scan();
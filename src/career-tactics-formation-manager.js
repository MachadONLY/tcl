import { PLAYER_BY_ID } from './career-core/career-core.js';
import { CareerRepository } from './career-core/career-repository.js';

const FORMATION_GROUPS = Object.freeze([
  {
    label: 'Quatro defensores',
    formations: ['4-2-3-1', '4-3-3', '4-4-2', '4-1-4-1', '4-3-2-1', '4-2-2-2', '4-2-1-3', '4-1-2-1-2', '4-4-1-1']
  },
  {
    label: 'Três defensores',
    formations: ['3-4-2-1', '3-5-2', '3-1-4-2']
  },
  {
    label: 'Cinco defensores',
    formations: ['5-3-2', '5-2-1-2', '5-4-1']
  }
]);

const FORMATION_SLOTS = Object.freeze({
  '4-2-3-1': [[50,91],[16,73],[38,77],[62,77],[84,73],[38,57],[62,57],[17,34],[50,39],[83,34],[50,15]],
  '4-3-3': [[50,91],[16,73],[38,77],[62,77],[84,73],[30,53],[50,59],[70,53],[17,27],[50,18],[83,27]],
  '4-4-2': [[50,91],[16,73],[38,77],[62,77],[84,73],[16,46],[39,55],[61,55],[84,46],[36,19],[64,19]],
  '4-1-4-1': [[50,91],[16,73],[38,77],[62,77],[84,73],[50,59],[16,40],[38,44],[62,44],[84,40],[50,15]],
  '4-3-2-1': [[50,91],[16,73],[38,77],[62,77],[84,73],[29,55],[50,61],[71,55],[34,34],[66,34],[50,14]],
  '4-2-2-2': [[50,91],[16,73],[38,77],[62,77],[84,73],[39,57],[61,57],[23,37],[77,37],[36,17],[64,17]],
  '4-2-1-3': [[50,91],[16,73],[38,77],[62,77],[84,73],[39,58],[61,58],[50,40],[17,24],[50,15],[83,24]],
  '4-1-2-1-2': [[50,91],[16,73],[38,77],[62,77],[84,73],[50,61],[31,49],[69,49],[50,34],[36,16],[64,16]],
  '4-4-1-1': [[50,91],[16,73],[38,77],[62,77],[84,73],[16,47],[39,54],[61,54],[84,47],[50,31],[50,14]],
  '3-4-2-1': [[50,91],[24,75],[50,79],[76,75],[14,51],[38,57],[62,57],[86,51],[35,34],[65,34],[50,14]],
  '3-5-2': [[50,91],[24,75],[50,79],[76,75],[13,49],[35,56],[50,49],[65,56],[87,49],[36,18],[64,18]],
  '3-1-4-2': [[50,91],[24,75],[50,79],[76,75],[50,61],[14,43],[38,48],[62,48],[86,43],[36,17],[64,17]],
  '5-3-2': [[50,91],[10,65],[30,76],[50,80],[70,76],[90,65],[28,47],[50,55],[72,47],[36,18],[64,18]],
  '5-2-1-2': [[50,91],[10,65],[30,76],[50,80],[70,76],[90,65],[38,51],[62,51],[50,34],[36,16],[64,16]],
  '5-4-1': [[50,91],[10,65],[30,76],[50,80],[70,76],[90,65],[16,42],[39,50],[61,50],[84,42],[50,14]]
});

const PHASES = Object.freeze(['base', 'possession', 'out']);
const PLANS = Object.freeze(['A', 'B', 'C']);
const MOTION_DURATION = 560;
let enhancementQueued = false;
let applyingFormation = false;
let pendingFormation = null;
let cachedCareer = null;
let saveChain = Promise.resolve();

function allFormations() {
  return FORMATION_GROUPS.flatMap(group => group.formations);
}

function optionsMarkup(selected) {
  return FORMATION_GROUPS.map(group => `<optgroup label="${group.label}">${group.formations.map(formation =>
    `<option value="${formation}" ${formation === selected ? 'selected' : ''}>${formation}</option>`
  ).join('')}</optgroup>`).join('');
}

function planSettings(career, plan) {
  return {
    ...(career.tactics || {}),
    ...(career.tactics?.plans?.[plan] || {})
  };
}

function phasePosition([baseX, baseY], player, phase, tactics, role) {
  let x = baseX;
  let y = baseY;
  if (phase === 'possession') {
    y -= player?.group === 'GK' ? 2 : player?.group === 'DEF' ? 5 : player?.group === 'MID' ? 7 : 4;
    const widthDelta = ((Number(tactics?.width) || 56) - 55) / 8;
    if (x < 40) x -= widthDelta;
    if (x > 60) x += widthDelta;
    if (/Lateral invertido/.test(role || '')) x += x < 50 ? 14 : -14;
    if (/Ponta invertido/.test(role || '')) x += x < 50 ? 10 : -10;
    if (/Falso 9/.test(role || '')) y += 12;
  }
  if (phase === 'out') {
    y += player?.group === 'FWD' ? 10 : player?.group === 'MID' ? 7 : player?.group === 'DEF' ? 3 : 0;
    const compact = (60 - (Number(tactics?.defensiveWidth) || 52)) / 7;
    if (x < 50) x += compact;
    if (x > 50) x -= compact;
  }
  return {
    x: Math.max(6, Math.min(94, +x.toFixed(2))),
    y: Math.max(6, Math.min(94, +y.toFixed(2)))
  };
}

function resetLayoutsForFormation(career, formation) {
  const slots = FORMATION_SLOTS[formation] || FORMATION_SLOTS['4-2-3-1'];
  career.tacticalLayouts = career.tacticalLayouts && typeof career.tacticalLayouts === 'object'
    ? career.tacticalLayouts
    : {};
  for (const plan of PLANS) {
    const tactics = planSettings(career, plan);
    career.tacticalLayouts[plan] ||= {};
    for (const phase of PHASES) {
      career.tacticalLayouts[plan][phase] = Object.fromEntries(career.lineup.map((playerId, index) => {
        const player = PLAYER_BY_ID.get(playerId);
        const role = career.tactics?.roles?.[playerId]?.role || '';
        return [playerId, phasePosition(slots[index] || slots.at(-1), player, phase, tactics, role)];
      }));
    }
  }
}

function visiblePhase(root) {
  const pitch = root.querySelector('.tl-pitch');
  if (pitch?.classList.contains('phase-possession')) return 'possession';
  if (pitch?.classList.contains('phase-out')) return 'out';
  return 'base';
}

function syncFormationSelects(root, formation) {
  root.querySelectorAll('[data-tl-formation], [data-field-formation-control] select').forEach(select => {
    if (select.value !== formation) select.value = formation;
    select.setAttribute('aria-label', `Formação ${formation}`);
  });
}

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

function formationDraft(career) {
  return {
    saveId: career.saveId,
    clubCode: career.clubCode,
    formation: career.formation,
    tacticalLayouts: structuredClone(career.tacticalLayouts)
  };
}

function rememberFormation(career) {
  cachedCareer = structuredClone(career);
  globalThis.__touchlineFormationDraft = formationDraft(career);
}

function currentTargetPosition(career, playerId, index, phase) {
  const plan = career.tactics?.activePlan || 'A';
  const stored = career.tacticalLayouts?.[plan]?.[phase]?.[playerId];
  if (stored && Number.isFinite(stored.x) && Number.isFinite(stored.y)) return stored;
  const slots = FORMATION_SLOTS[career.formation] || FORMATION_SLOTS['4-2-3-1'];
  return phasePosition(
    slots[index] || slots.at(-1),
    PLAYER_BY_ID.get(playerId),
    phase,
    planSettings(career, plan),
    career.tactics?.roles?.[playerId]?.role || ''
  );
}

function patchPitchInstantly(root, career) {
  const pitch = root.querySelector('.tl-pitch');
  const nodes = [...root.querySelectorAll('.tl-pitch .tl-player-node[data-drag-player]')];
  if (!pitch || !nodes.length || !career) return;
  const phase = visiblePhase(root);
  root.classList.add('tl-formation-measuring');
  nodes.forEach(node => {
    const index = career.lineup.indexOf(node.dataset.dragPlayer);
    if (index < 0) return;
    const target = currentTargetPosition(career, node.dataset.dragPlayer, index, phase);
    node.style.setProperty('--x', `${target.x}%`);
    node.style.setProperty('--y', `${target.y}%`);
  });
  syncFormationSelects(root, career.formation);
  void pitch.offsetWidth;
  root.classList.remove('tl-formation-measuring');
}

async function animateFormation(root, career) {
  const pitch = root.querySelector('.tl-pitch');
  const nodes = [...root.querySelectorAll('.tl-pitch .tl-player-node[data-drag-player]')];
  if (!pitch || !nodes.length) return;

  const phase = visiblePhase(root);
  const firstRects = new Map(nodes.map(node => [node.dataset.dragPlayer, node.getBoundingClientRect()]));
  root.classList.add('tl-formation-measuring', 'tl-formation-busy');
  root.setAttribute('aria-busy', 'true');

  nodes.forEach(node => {
    const index = career.lineup.indexOf(node.dataset.dragPlayer);
    if (index < 0) return;
    const target = currentTargetPosition(career, node.dataset.dragPlayer, index, phase);
    node.style.setProperty('--x', `${target.x}%`);
    node.style.setProperty('--y', `${target.y}%`);
    node.dataset.formationMoving = '';
  });
  void pitch.offsetWidth;

  const reduced = prefersReducedMotion();
  const animations = [];
  nodes.forEach((node, index) => {
    const first = firstRects.get(node.dataset.dragPlayer);
    const last = node.getBoundingClientRect();
    if (!first || !last) return;
    const deltaX = first.left - last.left;
    const deltaY = first.top - last.top;
    if (reduced || (Math.abs(deltaX) < .5 && Math.abs(deltaY) < .5)) return;
    const animation = node.animate([
      {
        transform: `translate3d(${deltaX}px, ${deltaY}px, 0) translate(-50%, -50%) scale(1)`,
        filter: 'brightness(1)'
      },
      {
        transform: 'translate3d(0, 0, 0) translate(-50%, -50%) scale(1.04)',
        filter: 'brightness(1.07)',
        offset: .62
      },
      {
        transform: 'translate3d(0, 0, 0) translate(-50%, -50%) scale(1)',
        filter: 'brightness(1)'
      }
    ], {
      duration: MOTION_DURATION,
      delay: Math.min(66, index * 6),
      easing: 'cubic-bezier(.16, 1, .3, 1)',
      fill: 'both'
    });
    animations.push(animation.finished.catch(() => undefined));
  });

  root.classList.remove('tl-formation-measuring');
  await Promise.all(animations);
  nodes.forEach(node => delete node.dataset.formationMoving);
  root.classList.remove('tl-formation-busy');
  root.removeAttribute('aria-busy');
}

function queueFormationSave(career) {
  saveChain = saveChain.catch(() => undefined).then(async () => {
    const draft = globalThis.__touchlineFormationDraft;
    const payload = structuredClone(career);
    if (draft?.saveId === payload.saveId && draft?.clubCode === payload.clubCode) {
      payload.formation = draft.formation;
      payload.tacticalLayouts = structuredClone(draft.tacticalLayouts);
    }
    const saved = await CareerRepository.save(payload);
    rememberFormation(saved);
    return saved;
  });
  return saveChain;
}

async function applyFormation(formation, sourceSelect) {
  if (!FORMATION_SLOTS[formation]) return;
  if (applyingFormation) {
    pendingFormation = formation;
    return;
  }

  const root = sourceSelect?.closest('.tl-tactics-studio') || document.querySelector('.tl-tactics-studio');
  if (!root) return;
  applyingFormation = true;
  try {
    syncFormationSelects(root, formation);
    const sourceCareer = cachedCareer || await CareerRepository.load();
    if (!sourceCareer) return;
    const career = structuredClone(sourceCareer);
    career.formation = formation;
    resetLayoutsForFormation(career, formation);
    rememberFormation(career);

    queueFormationSave(career).catch(() => undefined);
    await animateFormation(root, career);
    syncFormationSelects(root, formation);
  } finally {
    applyingFormation = false;
    scheduleEnhancement();
    if (pendingFormation && pendingFormation !== formation) {
      const queued = pendingFormation;
      pendingFormation = null;
      applyFormation(queued, document.querySelector('[data-field-formation-control] select, [data-tl-formation]'));
    } else {
      pendingFormation = null;
    }
  }
}

function nativeFormationSelect(root) {
  return root.querySelector('.tl-command-bar [data-tl-formation]');
}

function enhanceNativeSelect(root, selected) {
  const select = nativeFormationSelect(root);
  if (!select) return;
  if (select.dataset.completeFormationSelect !== 'true') {
    select.innerHTML = optionsMarkup(selected);
    select.dataset.completeFormationSelect = 'true';
  }
  select.value = selected;
}

function fieldFormationControl(root, selected) {
  const hud = root.querySelector('.tl-field-hud');
  if (!hud) return;
  let control = hud.querySelector('[data-field-formation-control]');
  if (!control) {
    const first = hud.querySelector(':scope > div');
    control = document.createElement('label');
    control.className = 'tl-field-formation-control';
    control.dataset.fieldFormationControl = '';
    control.innerHTML = `<span>Formação</span><select aria-label="Formação do XI">${optionsMarkup(selected)}</select>`;
    first?.append(control);
  }
  control.querySelector('select').value = selected;
}

function enableFullRosterScroll(root) {
  root.querySelectorAll('.tl-roster-grid').forEach(scroller => {
    if (scroller.dataset.fullRosterScroll === 'true') return;
    scroller.dataset.fullRosterScroll = 'true';
    scroller.addEventListener('wheel', event => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || scroller.scrollWidth <= scroller.clientWidth) return;
      event.preventDefault();
      scroller.scrollBy({ left: event.deltaY, behavior: 'smooth' });
    }, { passive: false });
  });
}

function formationSelectFromEvent(event) {
  const select = event.target?.tagName === 'SELECT' ? event.target : null;
  if (!select) return null;
  if (select.matches('[data-tl-formation]')) return select;
  return select.closest('[data-field-formation-control]') ? select : null;
}

function interceptFormationChange(event) {
  const select = formationSelectFromEvent(event);
  if (!select || !allFormations().includes(select.value)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  applyFormation(select.value, select);
}

async function enhance() {
  enhancementQueued = false;
  if (location.hash !== '#tactics') return;
  const root = document.querySelector('.tl-tactics-studio');
  if (!root) return;

  const career = await CareerRepository.load();
  if (!career || location.hash !== '#tactics') return;
  rememberFormation(career);
  const selected = allFormations().includes(career.formation) ? career.formation : '4-2-3-1';
  enhanceNativeSelect(root, selected);
  if (root.dataset.tacticsView === 'lineup') fieldFormationControl(root, selected);
  enableFullRosterScroll(root);
  if (!applyingFormation) patchPitchInstantly(root, career);
}

function scheduleEnhancement() {
  if (enhancementQueued) return;
  enhancementQueued = true;
  requestAnimationFrame(enhance);
}

function handleStudioMutation() {
  const root = document.querySelector('.tl-tactics-studio');
  if (root && cachedCareer && !applyingFormation) patchPitchInstantly(root, cachedCareer);
  scheduleEnhancement();
}

document.addEventListener('change', interceptFormationChange, true);
new MutationObserver(handleStudioMutation).observe(document.querySelector('#app'), { childList: true, subtree: true });
window.addEventListener('hashchange', scheduleEnhancement);
scheduleEnhancement();

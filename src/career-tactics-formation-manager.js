import { PLAYER_BY_ID } from './career-core/career-core.js';
import { CareerRepository } from './career-core/career-repository.js';

const NATIVE_FORMATIONS = new Set([
  '4-2-3-1', '4-3-3', '3-4-2-1', '4-4-2', '4-1-4-1', '3-5-2', '5-3-2'
]);

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

// Slots follow the roster order used by the career core: GK, DEF, MID, FWD.
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
let enhancementQueued = false;
let applyingFormation = false;

function allFormations() {
  return FORMATION_GROUPS.flatMap(group => group.formations);
}

function optionsMarkup(selected) {
  return FORMATION_GROUPS.map(group => `<optgroup label="${group.label}">${group.formations.map(formation =>
    `<option value="${formation}" ${formation === selected ? 'selected' : ''}>${formation}</option>`
  ).join('')}</optgroup>`).join('');
}

function phasePosition([baseX, baseY], player, phase) {
  let x = baseX;
  let y = baseY;
  if (phase === 'possession') {
    y -= player?.group === 'GK' ? 2 : player?.group === 'DEF' ? 5 : player?.group === 'MID' ? 7 : 4;
    if (x < 35) x -= 3;
    if (x > 65) x += 3;
  }
  if (phase === 'out') {
    y += player?.group === 'FWD' ? 9 : player?.group === 'MID' ? 6 : player?.group === 'DEF' ? 3 : 0;
    if (x < 50) x += 3;
    if (x > 50) x -= 3;
  }
  return { x: Math.max(6, Math.min(94, x)), y: Math.max(6, Math.min(94, y)) };
}

function resetLayoutsForFormation(career, formation) {
  const slots = FORMATION_SLOTS[formation] || FORMATION_SLOTS['4-2-3-1'];
  career.tacticalLayouts = career.tacticalLayouts && typeof career.tacticalLayouts === 'object'
    ? career.tacticalLayouts
    : {};
  for (const plan of PLANS) {
    career.tacticalLayouts[plan] ||= {};
    for (const phase of PHASES) {
      career.tacticalLayouts[plan][phase] = Object.fromEntries(career.lineup.map((playerId, index) => {
        const player = PLAYER_BY_ID.get(playerId);
        return [playerId, phasePosition(slots[index] || slots.at(-1), player, phase)];
      }));
    }
  }
}

function remountStudio() {
  const content = document.querySelector('.cp-content');
  const legacyPage = content?.querySelector('.tl-tactics-bridge .cp-page');
  if (!content || !legacyPage) {
    location.reload();
    return;
  }
  content.replaceChildren(legacyPage);
  delete content.dataset.tacticsStudio;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

async function applyExtendedFormation(formation) {
  if (applyingFormation || !FORMATION_SLOTS[formation]) return;
  applyingFormation = true;
  try {
    const career = await CareerRepository.load();
    if (!career) return;
    career.formation = formation;
    resetLayoutsForFormation(career, formation);
    const saved = await CareerRepository.save(career);
    // Protect the new formation if an older debounced studio save finishes during remount.
    globalThis.__touchlineCareerDraft = structuredClone(saved);
    remountStudio();
  } finally {
    applyingFormation = false;
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
    select.addEventListener('change', event => {
      const formation = event.target.value;
      if (!NATIVE_FORMATIONS.has(formation)) applyExtendedFormation(formation);
    });
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
    const select = control.querySelector('select');
    select.addEventListener('change', event => {
      const formation = event.target.value;
      const native = nativeFormationSelect(root);
      if (NATIVE_FORMATIONS.has(formation) && native) {
        native.value = formation;
        native.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        applyExtendedFormation(formation);
      }
    });
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

async function enhance() {
  enhancementQueued = false;
  if (location.hash !== '#tactics') return;
  const root = document.querySelector('.tl-tactics-studio');
  if (!root) return;
  const career = await CareerRepository.load();
  if (!career || location.hash !== '#tactics') return;
  const selected = allFormations().includes(career.formation) ? career.formation : '4-2-3-1';
  enhanceNativeSelect(root, selected);
  if (root.dataset.tacticsView === 'lineup') fieldFormationControl(root, selected);
  enableFullRosterScroll(root);
}

function scheduleEnhancement() {
  if (enhancementQueued) return;
  enhancementQueued = true;
  requestAnimationFrame(enhance);
}

new MutationObserver(scheduleEnhancement).observe(document.querySelector('#app'), { childList: true, subtree: true });
window.addEventListener('hashchange', scheduleEnhancement);
scheduleEnhancement();

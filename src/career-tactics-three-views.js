import { PLAYER_BY_ID, squadFor } from './career-core/career-core.js';
import { CareerRepository, legacyClubSelection } from './career-core/career-repository.js';

const VIEWS = Object.freeze([
  { id: 'lineup', index: '01', label: 'Escalação', description: 'XI, banco e elenco' },
  { id: 'tactics', index: '02', label: 'Modelo de jogo', description: 'Formação e instruções' },
  { id: 'roles', index: '03', label: 'Funções', description: 'Capitão e bolas paradas' }
]);

const RESPONSIBILITIES = Object.freeze([
  { id: 'captain', group: 'Liderança', label: 'Capitão', hint: 'Representa o time e lidera dentro de campo.' },
  { id: 'viceCaptain', group: 'Liderança', label: 'Vice-capitão', hint: 'Assume a braçadeira quando o capitão não joga.' },
  { id: 'penalties', group: 'Bolas paradas', label: 'Pênaltis', hint: 'Primeira opção nas cobranças de pênalti.' },
  { id: 'directFreeKicks', group: 'Bolas paradas', label: 'Faltas diretas', hint: 'Finaliza faltas com possibilidade de chute.' },
  { id: 'indirectFreeKicks', group: 'Bolas paradas', label: 'Faltas indiretas', hint: 'Executa bolas levantadas e jogadas ensaiadas.' },
  { id: 'leftCorners', group: 'Escanteios', label: 'Escanteio esquerdo', hint: 'Responsável pelas cobranças do lado esquerdo.' },
  { id: 'rightCorners', group: 'Escanteios', label: 'Escanteio direito', hint: 'Responsável pelas cobranças do lado direito.' }
]);

const app = document.querySelector('#app');
let activeView = 'lineup';
let currentRoot = null;
let enhanceQueued = false;
let responsibilities = {};
let latestCareer = null;
let toastTimer = null;

const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);
const portrait = player => `/assets/players/2026-27/${player.clubCode.toLowerCase()}-${player.fotmobId}.png`;
const lastName = value => String(value || '').trim().split(/\s+/).at(-1) || '';

function isTacticsRoute() {
  return location.hash === '#tactics';
}

function storageKey(clubCode) {
  return `touchline.tactics.responsibilities.v1.${clubCode}`;
}

function readResponsibilities(clubCode) {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey(clubCode)) || '{}');
    return stored && typeof stored === 'object' ? stored : {};
  } catch {
    return {};
  }
}

function writeResponsibilities(clubCode, value) {
  try {
    localStorage.setItem(storageKey(clubCode), JSON.stringify(value));
  } catch {
    // The screen remains usable when browser storage is unavailable.
  }
}

function sortedSquad(career) {
  return [...squadFor(career.clubCode)].sort((left, right) => {
    const leftStarter = career.lineup.includes(left.id) ? 1 : 0;
    const rightStarter = career.lineup.includes(right.id) ? 1 : 0;
    return rightStarter - leftStarter || right.rating - left.rating || left.name.localeCompare(right.name);
  });
}

function defaultResponsibilities(career) {
  const players = sortedSquad(career);
  const starters = career.lineup.map(id => PLAYER_BY_ID.get(id)).filter(Boolean);
  const outfield = starters.filter(player => player.group !== 'GK').sort((a, b) => b.rating - a.rating);
  const creators = starters.filter(player => player.group === 'MID' || player.group === 'FWD').sort((a, b) => b.rating - a.rating);
  const attackers = starters.filter(player => player.group === 'FWD' || /AM|CAM|RW|LW/.test(player.position)).sort((a, b) => b.rating - a.rating);
  const fallback = outfield[0] || starters[0] || players[0];
  return {
    captain: outfield[0]?.id || fallback?.id,
    viceCaptain: outfield[1]?.id || starters[1]?.id || fallback?.id,
    penalties: attackers[0]?.id || creators[0]?.id || fallback?.id,
    directFreeKicks: creators[0]?.id || fallback?.id,
    indirectFreeKicks: creators[1]?.id || creators[0]?.id || fallback?.id,
    leftCorners: creators[0]?.id || fallback?.id,
    rightCorners: creators[1]?.id || creators[0]?.id || fallback?.id
  };
}

function normalizedResponsibilities(career) {
  const valid = new Set(squadFor(career.clubCode).map(player => player.id));
  const defaults = defaultResponsibilities(career);
  return Object.fromEntries(RESPONSIBILITIES.map(item => [
    item.id,
    valid.has(responsibilities[item.id]) ? responsibilities[item.id] : defaults[item.id]
  ]));
}

function viewNavigation() {
  return `<nav class="tl-primary-view-switch" data-tactics-view-nav aria-label="Áreas da central tática">
    ${VIEWS.map(view => `<button class="${activeView === view.id ? 'active' : ''}" data-tactics-view-button="${view.id}" type="button" aria-pressed="${activeView === view.id}">
      <span>${view.index}</span><strong>${view.label}</strong><small>${view.description}</small>
    </button>`).join('')}
  </nav>`;
}

function playerOptions(career, selectedId) {
  const starters = new Set(career.lineup);
  return sortedSquad(career).map(player => `<option value="${esc(player.id)}" ${player.id === selectedId ? 'selected' : ''}>${starters.has(player.id) ? 'XI · ' : ''}${esc(player.name)} · ${esc(player.position)} · ${player.rating}</option>`).join('');
}

function responsibilityCard(career, item) {
  const player = PLAYER_BY_ID.get(responsibilities[item.id]);
  return `<article class="tl-responsibility-card" data-responsibility-card="${item.id}">
    <header><span>${esc(item.group)}</span><i></i></header>
    <div class="tl-responsibility-player">
      <span class="tl-responsibility-photo">${player ? `<img src="${portrait(player)}" alt="" onerror="this.hidden=true">` : ''}</span>
      <div><h3>${esc(item.label)}</h3><strong>${esc(player?.name || 'Escolher jogador')}</strong><small>${player ? `${esc(player.position)} · ${player.rating} OVR` : esc(item.hint)}</small></div>
    </div>
    <p>${esc(item.hint)}</p>
    <label><span>Responsável</span><select data-responsibility="${item.id}">${playerOptions(career, responsibilities[item.id])}</select></label>
  </article>`;
}

function lineupRoleCard(career, player) {
  const role = career.tactics?.roles?.[player.id] || {};
  const state = career.playerState?.[player.id] || {};
  return `<button class="tl-role-lineup-card" data-open-player-role="${esc(player.id)}" type="button">
    <span><img src="${portrait(player)}" alt="" onerror="this.hidden=true"></span>
    <div><strong>${esc(lastName(player.name))}</strong><small>${esc(role.role || player.position)}</small></div>
    <em>${esc(role.focus || 'Apoiar')}</em><b>${state.condition || 100}%</b>
  </button>`;
}

function rolesPanel(career) {
  const starters = career.lineup.map(id => PLAYER_BY_ID.get(id)).filter(Boolean);
  return `<section class="tl-responsibilities-view" data-responsibilities-view>
    <header class="tl-responsibilities-head">
      <div><span>Responsabilidades da equipe</span><h2>Funções e bolas paradas</h2><p>Defina a hierarquia do vestiário e quem assume cada momento decisivo.</p></div>
      <div><i></i><span>Salvo automaticamente</span></div>
    </header>
    <div class="tl-responsibilities-layout">
      <div class="tl-responsibility-grid">${RESPONSIBILITIES.map(item => responsibilityCard(career, item)).join('')}</div>
      <aside class="tl-role-lineup-panel">
        <header><div><span>XI inicial</span><small>Funções individuais</small></div><button data-go-to-tactics type="button">Ajustar no campo →</button></header>
        <div>${starters.map(player => lineupRoleCard(career, player)).join('')}</div>
        <footer><i></i><p>As funções individuais são ajustadas no Modelo de jogo. Capitão e bolas paradas ficam salvos para este clube.</p></footer>
      </aside>
    </div>
  </section>`;
}

function announce(message) {
  let toast = currentRoot?.querySelector('[data-three-view-toast]');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'tl-three-view-toast';
    toast.dataset.threeViewToast = '';
    currentRoot?.append(toast);
  }
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 1900);
}

function setView(view) {
  if (!VIEWS.some(item => item.id === view)) return;
  activeView = view;
  enhance();
}

function bindViewEvents(root) {
  root.querySelectorAll('[data-tactics-view-button]').forEach(button => {
    button.onclick = () => setView(button.dataset.tacticsViewButton);
  });
  root.querySelector('[data-go-to-tactics]')?.addEventListener('click', () => setView('tactics'));
  root.querySelectorAll('[data-open-player-role]').forEach(button => {
    button.onclick = () => setView('tactics');
  });
  root.querySelectorAll('[data-responsibility]').forEach(select => {
    select.onchange = () => {
      responsibilities = { ...responsibilities, [select.dataset.responsibility]: select.value };
      writeResponsibilities(latestCareer.clubCode, responsibilities);
      renderResponsibilities(root, latestCareer);
      announce('Responsabilidade atualizada');
    };
  });
}

function renderResponsibilities(root, career) {
  root.querySelector('[data-responsibilities-view]')?.remove();
  if (activeView !== 'roles') return;
  const commandBar = root.querySelector('.tl-command-bar');
  if (!commandBar) return;
  commandBar.insertAdjacentHTML('afterend', rolesPanel(career));
  bindViewEvents(root);
}

async function enhance() {
  enhanceQueued = false;
  if (!isTacticsRoute()) return;
  const root = document.querySelector('.tl-tactics-studio');
  if (!root) return;
  currentRoot = root;
  root.dataset.tacticsView = activeView;

  const commandBar = root.querySelector('.tl-command-bar');
  if (!commandBar) return;
  commandBar.querySelector('[data-tactics-view-nav]')?.remove();
  const shapeSwitch = commandBar.querySelector('.tl-shape-switch');
  if (shapeSwitch) shapeSwitch.insertAdjacentHTML('beforebegin', viewNavigation());
  else commandBar.querySelector('.tl-command-title')?.insertAdjacentHTML('afterend', viewNavigation());

  latestCareer = await CareerRepository.load();
  if (!latestCareer || !isTacticsRoute() || currentRoot !== root) return;
  responsibilities = { ...readResponsibilities(latestCareer.clubCode), ...responsibilities };
  responsibilities = normalizedResponsibilities(latestCareer);
  writeResponsibilities(latestCareer.clubCode, responsibilities);
  renderResponsibilities(root, latestCareer);
  bindViewEvents(root);
}

function scheduleEnhance() {
  if (enhanceQueued) return;
  enhanceQueued = true;
  queueMicrotask(enhance);
}

new MutationObserver(scheduleEnhance).observe(app, { childList: true, subtree: true });
window.addEventListener('hashchange', () => {
  if (isTacticsRoute()) activeView = 'lineup';
  scheduleEnhance();
});
scheduleEnhance();

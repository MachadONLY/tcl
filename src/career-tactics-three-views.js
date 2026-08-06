import { PLAYER_BY_ID, squadFor } from './career-core/career-core.js';
import { CareerRepository } from './career-core/career-repository.js';

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

const PLAN_COPY = Object.freeze({ A: 'Plano principal', B: 'Buscar o jogo', C: 'Controlar resultado' });
const app = document.querySelector('#app');
let activeView = 'lineup';
let currentRoot = null;
let enhanceQueued = false;
let enhanceVersion = 0;
let responsibilities = {};
let responsibilitiesClubCode = null;
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

function navigationHost(root) {
  return root.querySelector('.tl-side-rail');
}

function placeNavigation(root) {
  const host = navigationHost(root);
  if (!host) return null;
  let navigation = root.querySelector('[data-tactics-view-nav]');
  if (!navigation) {
    const template = document.createElement('template');
    template.innerHTML = viewNavigation().trim();
    navigation = template.content.firstElementChild;
    host.prepend(navigation);
  } else if (navigation.parentElement !== host || host.firstElementChild !== navigation) {
    host.prepend(navigation);
  }
  return navigation;
}

function syncNavigation(root) {
  root.querySelectorAll('[data-tactics-view-button]').forEach(button => {
    const active = button.dataset.tacticsViewButton === activeView;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

function syncModelContext(root) {
  if (activeView !== 'tactics') return;
  const controls = root.querySelector('.tl-tactic-controls');
  if (!controls) return;
  let context = controls.querySelector('[data-model-context]');
  if (!context) {
    context = document.createElement('div');
    context.className = 'tl-model-context';
    context.dataset.modelContext = '';
    const heading = controls.querySelector('.tl-panel-heading');
    heading?.insertAdjacentElement('afterend', context);
  }

  const nativeSelect = root.querySelector('.tl-command-bar [data-tl-formation]');
  const selectedFormation = nativeSelect?.value || latestCareer?.formation || '4-2-3-1';
  const options = nativeSelect?.innerHTML || `<option value="${esc(selectedFormation)}">${esc(selectedFormation)}</option>`;
  const activePlan = latestCareer?.tactics?.activePlan || root.querySelector('.tl-plan-tabs .active b')?.textContent || 'A';
  const signature = JSON.stringify([activePlan, selectedFormation, options]);
  if (context.dataset.signature === signature) {
    const select = context.querySelector('select');
    if (select && select.value !== selectedFormation) select.value = selectedFormation;
    return;
  }

  context.dataset.signature = signature;
  context.innerHTML = `<div class="tl-model-context-copy"><span>Plano ativo</span><strong>Plano ${esc(activePlan)}</strong><small>${esc(PLAN_COPY[activePlan] || 'Modelo principal')}</small></div>
    <label data-field-formation-control><span>Formação</span><select aria-label="Formação do modelo de jogo">${options}</select></label>`;
  const select = context.querySelector('select');
  if (select) select.value = selectedFormation;
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

function rolesMain(career) {
  return `<section class="tl-responsibilities-main" data-responsibilities-main>
    <header class="tl-responsibilities-head">
      <div class="tl-responsibilities-copy"><span>Responsabilidades da equipe</span><h2>Funções e bolas paradas</h2><p>Defina a hierarquia do vestiário e quem assume cada momento decisivo.</p></div>
      <div class="tl-responsibilities-save"><i></i><span>Salvo automaticamente</span></div>
    </header>
    <div class="tl-responsibility-grid">${RESPONSIBILITIES.map(item => responsibilityCard(career, item)).join('')}</div>
  </section>`;
}

function rolesSide(career) {
  const starters = career.lineup.map(id => PLAYER_BY_ID.get(id)).filter(Boolean);
  return `<section class="tl-role-lineup-panel" data-role-lineup-panel>
    <header><div><span>XI inicial</span><small>Funções individuais</small></div><button data-go-to-tactics type="button">Ajustar →</button></header>
    <div>${starters.map(player => lineupRoleCard(career, player)).join('')}</div>
    <footer><i></i><p>Funções individuais ficam no Modelo de jogo. Capitão e bolas paradas permanecem salvos para este clube.</p></footer>
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

function clearRoles(root) {
  root.querySelector('[data-responsibilities-main]')?.remove();
  root.querySelector('[data-role-lineup-panel]')?.remove();
}

function renderRoles(root, career, force = false) {
  if (activeView !== 'roles') {
    clearRoles(root);
    return;
  }
  const warRoom = root.querySelector('.tl-war-room');
  const rail = root.querySelector('.tl-side-rail');
  if (!warRoom || !rail || !career) return;
  if (!force && warRoom.querySelector('[data-responsibilities-main]') && rail.querySelector('[data-role-lineup-panel]')) return;
  clearRoles(root);
  warRoom.insertAdjacentHTML('beforeend', rolesMain(career));
  rail.insertAdjacentHTML('beforeend', rolesSide(career));
}

function setView(view) {
  if (!VIEWS.some(item => item.id === view) || view === activeView) return;
  activeView = view;
  if (currentRoot) {
    currentRoot.dataset.tacticsView = activeView;
    syncNavigation(currentRoot);
  }
  scheduleEnhance();
}

function bindViewEvents(root) {
  root.querySelectorAll('[data-tactics-view-button]').forEach(button => {
    button.onclick = () => setView(button.dataset.tacticsViewButton);
  });
  root.querySelector('[data-go-to-tactics]')?.addEventListener('click', () => setView('tactics'), { once: true });
  root.querySelectorAll('[data-open-player-role]').forEach(button => {
    button.onclick = () => setView('tactics');
  });
  root.querySelectorAll('[data-responsibility]').forEach(select => {
    select.onchange = () => {
      if (!latestCareer) return;
      responsibilities = { ...responsibilities, [select.dataset.responsibility]: select.value };
      writeResponsibilities(latestCareer.clubCode, responsibilities);
      renderRoles(root, latestCareer, true);
      placeNavigation(root);
      syncNavigation(root);
      bindViewEvents(root);
      announce('Responsabilidade atualizada');
    };
  });
}

async function loadCareerForRoles(root, version) {
  if (latestCareer) return latestCareer;
  const career = await CareerRepository.load();
  if (!career || !isTacticsRoute() || currentRoot !== root || version !== enhanceVersion) return null;
  latestCareer = career;
  return career;
}

function prepareResponsibilities(career) {
  if (!career) return;
  if (responsibilitiesClubCode !== career.clubCode) {
    responsibilitiesClubCode = career.clubCode;
    responsibilities = readResponsibilities(career.clubCode);
  }
  responsibilities = normalizedResponsibilities(career);
  writeResponsibilities(career.clubCode, responsibilities);
}

async function enhance() {
  enhanceQueued = false;
  const version = ++enhanceVersion;
  if (!isTacticsRoute()) return;
  const root = document.querySelector('.tl-tactics-studio');
  if (!root) return;
  currentRoot = root;
  root.dataset.tacticsView = activeView;

  placeNavigation(root);
  syncNavigation(root);
  bindViewEvents(root);

  if (activeView !== 'roles') {
    clearRoles(root);
    if (activeView === 'tactics') syncModelContext(root);
    return;
  }

  const career = await loadCareerForRoles(root, version);
  if (!career || version !== enhanceVersion || currentRoot !== root || activeView !== 'roles') return;
  prepareResponsibilities(career);
  renderRoles(root, career);
  placeNavigation(root);
  syncNavigation(root);
  bindViewEvents(root);
}

function scheduleEnhance() {
  if (enhanceQueued) return;
  enhanceQueued = true;
  requestAnimationFrame(() => {
    enhance().catch(error => {
      enhanceQueued = false;
      console.error('Falha ao montar as views da central tática:', error);
    });
  });
}

new MutationObserver(scheduleEnhance).observe(app, { childList: true, subtree: true });
window.addEventListener('hashchange', () => {
  if (isTacticsRoute()) activeView = 'lineup';
  scheduleEnhance();
});
scheduleEnhance();

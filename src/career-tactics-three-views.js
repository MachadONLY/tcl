import { PLAYER_BY_ID, analyzeTactics, squadFor } from './career-core/career-core.js';
import { CareerRepository } from './career-core/career-repository.js';

const VIEWS = Object.freeze([
  { id: 'lineup', index: '01', label: 'Escalação', description: 'XI, banco e elenco' },
  { id: 'tactics', index: '02', label: 'Modelo de jogo', description: 'Instruções e leitura' },
  { id: 'roles', index: '03', label: 'Funções', description: 'Capitão e bolas paradas' }
]);

const RESPONSIBILITIES = Object.freeze([
  { id: 'captain', group: 'Liderança', label: 'Capitão', shortLabel: 'Capitão', hint: 'Representa o time e lidera dentro de campo.' },
  { id: 'viceCaptain', group: 'Liderança', label: 'Vice-capitão', shortLabel: 'Vice-capitão', hint: 'Assume a braçadeira quando o capitão não joga.' },
  { id: 'penalties', group: 'Bolas paradas', label: 'Pênaltis', shortLabel: 'Pênaltis', hint: 'Primeira opção nas cobranças de pênalti.' },
  { id: 'directFreeKicks', group: 'Bolas paradas', label: 'Faltas diretas', shortLabel: 'Faltas diretas', hint: 'Finaliza faltas com possibilidade de chute.' },
  { id: 'indirectFreeKicks', group: 'Bolas paradas', label: 'Faltas indiretas', shortLabel: 'Faltas indiretas', hint: 'Executa bolas levantadas e jogadas ensaiadas.' },
  { id: 'leftCorners', group: 'Escanteios', label: 'Escanteio esquerdo', shortLabel: 'Escanteio esquerdo', hint: 'Responsável pelas cobranças do lado esquerdo.' },
  { id: 'rightCorners', group: 'Escanteios', label: 'Escanteio direito', shortLabel: 'Escanteio direito', hint: 'Responsável pelas cobranças do lado direito.' }
]);

const METRICS = Object.freeze([
  ['construction', 'Construção'],
  ['control', 'Controle'],
  ['penetration', 'Penetração'],
  ['creation', 'Criação'],
  ['protection', 'Proteção'],
  ['intensity', 'Exigência']
]);

const PLAN_COPY = Object.freeze({ A: 'Plano principal', B: 'Buscar o jogo', C: 'Controlar resultado' });
const app = document.querySelector('#app');
let activeView = 'lineup';
let currentRoot = null;
let enhanceQueued = false;
let enhanceVersion = 0;
let careerLoadPromise = null;
let responsibilities = {};
let responsibilitiesClubCode = null;
let latestCareer = null;
let toastTimer = null;

const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);
const portrait = player => `/assets/players/2026-27/${player.clubCode.toLowerCase()}-${player.fotmobId}.png`;
const clone = value => JSON.parse(JSON.stringify(value));

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

function liveCareer(career) {
  const draft = globalThis.__touchlineTacticsDraft;
  if (!career || !draft || typeof draft !== 'object') return career;
  return { ...career, tactics: clone(draft) };
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

function identityFor(career, analysis) {
  const tactics = career.tactics || {};
  if (tactics.mentality === 'Ofensiva' && Number(tactics.pressing) >= 70) return ['Pressão e domínio', 'Recuperar alto e manter o rival distante da sua área.'];
  if (tactics.afterWin === 'Contra-atacar' && analysis.metrics.penetration >= 68) return ['Transição vertical', 'Acelerar assim que recuperar e atacar o espaço livre.'];
  if (analysis.metrics.control >= 70) return ['Controle com bola', 'Circular com segurança e escolher o momento de acelerar.'];
  if (analysis.metrics.protection >= 76) return ['Estrutura protegida', 'Reduzir espaços e controlar o risco antes de atacar.'];
  return ['Equilíbrio adaptável', 'Alternar controle, progressão e proteção sem depender de um único caminho.'];
}

function modelMetric([key, label], metrics) {
  const value = metrics[key] || 0;
  return `<article class="tl-model-metric"><header><span>${esc(label)}</span><strong>${value}</strong></header><div><i style="--metric:${value}%"></i></div></article>`;
}

function modelSummaryMarkup(career) {
  const players = career.lineup.map(id => PLAYER_BY_ID.get(id)).filter(Boolean);
  const analysis = analyzeTactics(career.tactics, players);
  const [identity, identityCopy] = identityFor(career, analysis);
  const activePlan = career.tactics?.activePlan || 'A';
  const alerts = [...analysis.conflicts, ...analysis.risks.filter(item => !item.startsWith('Nenhum risco'))].slice(0, 3);
  const safeAlerts = alerts.length ? alerts : ['Nenhum conflito estrutural relevante detectado.'];
  return `<section class="tl-model-summary" data-model-summary>
    <header><div><span>Leitura do modelo</span><h3>${esc(identity)}</h3><p>${esc(identityCopy)}</p></div><b>Plano ${esc(activePlan)}</b></header>
    <div class="tl-model-metrics">${METRICS.map(metric => modelMetric(metric, analysis.metrics)).join('')}</div>
    <section class="tl-model-reading positive"><h4>Pontos fortes</h4>${analysis.strengths.map(item => `<p><i></i>${esc(item)}</p>`).join('')}</section>
    <section class="tl-model-reading ${alerts.length ? 'warning' : 'neutral'}"><h4>Riscos e conflitos</h4>${safeAlerts.map(item => `<p><i></i>${esc(item)}</p>`).join('')}</section>
    <footer><i></i><p>Estas escolhas entram diretamente na simulação: posse, volume ofensivo, recuperação, qualidade das chances e desgaste físico.</p></footer>
  </section>`;
}

function renderModelSummary(root, career) {
  const rail = root.querySelector('.tl-side-rail');
  if (!rail || !career) return;
  const signature = JSON.stringify([career.formation, career.lineup, career.tactics]);
  let panel = rail.querySelector('[data-model-summary]');
  if (panel?.dataset.signature === signature) return;
  if (!panel) {
    const template = document.createElement('template');
    template.innerHTML = modelSummaryMarkup(career).trim();
    panel = template.content.firstElementChild;
    rail.append(panel);
  } else {
    const template = document.createElement('template');
    template.innerHTML = modelSummaryMarkup(career).trim();
    panel.replaceWith(template.content.firstElementChild);
    panel = rail.querySelector('[data-model-summary]');
  }
  if (panel) panel.dataset.signature = signature;
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

function rolesMain(career) {
  return `<section class="tl-responsibilities-main" data-responsibilities-main>
    <header class="tl-responsibilities-head">
      <div class="tl-responsibilities-copy"><span>Responsabilidades da equipe</span><h2>Funções e bolas paradas</h2><p>Defina somente quem assume cada momento decisivo da partida.</p></div>
      <div class="tl-responsibilities-save"><i></i><span>Salvo automaticamente</span></div>
    </header>
    <div class="tl-responsibility-grid">${RESPONSIBILITIES.map(item => responsibilityCard(career, item)).join('')}</div>
  </section>`;
}

function responsibilityWarnings(career) {
  const warnings = [];
  if (responsibilities.captain === responsibilities.viceCaptain) warnings.push('Capitão e vice-capitão precisam ser jogadores diferentes.');
  const lineup = new Set(career.lineup);
  const outside = [...new Set(Object.values(responsibilities))].filter(id => id && !lineup.has(id));
  if (outside.length) warnings.push(`${outside.length} responsável${outside.length > 1 ? 'is' : ''} não está${outside.length > 1 ? 'ão' : ''} no XI inicial.`);
  const counts = Object.values(responsibilities).reduce((map, id) => map.set(id, (map.get(id) || 0) + 1), new Map());
  const overloaded = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (overloaded?.[1] >= 4) {
    const player = PLAYER_BY_ID.get(overloaded[0]);
    warnings.push(`${player?.name || 'Um jogador'} concentra ${overloaded[1]} responsabilidades.`);
  }
  return warnings;
}

function responsibilitySummary(career) {
  const warnings = responsibilityWarnings(career);
  return `<section class="tl-role-lineup-panel tl-responsibility-summary" data-role-lineup-panel>
    <header><div><span>Resumo definido</span><small>Quem assume cada decisão</small></div><b>${RESPONSIBILITIES.length}/7</b></header>
    <div class="tl-responsibility-summary-list">${RESPONSIBILITIES.map(item => {
      const player = PLAYER_BY_ID.get(responsibilities[item.id]);
      return `<article><span>${player ? `<img src="${portrait(player)}" alt="" onerror="this.hidden=true">` : ''}</span><div><small>${esc(item.shortLabel)}</small><strong>${esc(player?.name || 'Não definido')}</strong></div><em>${esc(player?.position || '—')}</em></article>`;
    }).join('')}</div>
    <section class="tl-responsibility-health ${warnings.length ? 'warning' : 'ready'}"><h4>${warnings.length ? 'Atenção antes do jogo' : 'Tudo pronto'}</h4>${(warnings.length ? warnings : ['Hierarquia completa e todos os responsáveis disponíveis no XI.']).map(item => `<p><i></i>${esc(item)}</p>`).join('')}</section>
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

function clearModelSummary(root) {
  root.querySelector('[data-model-summary]')?.remove();
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
  rail.insertAdjacentHTML('beforeend', responsibilitySummary(career));
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

async function loadCareerForView(root, version) {
  if (!careerLoadPromise) {
    careerLoadPromise = CareerRepository.load().finally(() => {
      careerLoadPromise = null;
    });
  }
  const career = await careerLoadPromise;
  if (!career || !isTacticsRoute() || currentRoot !== root || version !== enhanceVersion) return null;
  latestCareer = career;
  return liveCareer(career);
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

  if (activeView === 'lineup') {
    clearModelSummary(root);
    clearRoles(root);
    return;
  }

  const career = await loadCareerForView(root, version);
  if (!career || version !== enhanceVersion || currentRoot !== root) return;

  if (activeView === 'tactics') {
    clearRoles(root);
    syncModelContext(root);
    renderModelSummary(root, career);
  } else if (activeView === 'roles') {
    clearModelSummary(root);
    prepareResponsibilities(career);
    renderRoles(root, career);
  }

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

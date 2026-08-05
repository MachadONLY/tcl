import './career-tactics-studio.css';
import {
  PLAYER_BY_ID,
  PLAYER_ROLE_OPTIONS,
  FORMATION_SHAPES,
  TACTIC_OPTIONS,
  analyzeTactics,
  normalizeCareer,
  normalizeTactics
} from './career-core/career-core.js';
import { CareerRepository, legacyClubSelection } from './career-core/career-repository.js';

const GROUP_ORDER = Object.freeze({ GK: 0, DEF: 1, MID: 2, FWD: 3 });
const SCALE_VALUES = Object.freeze([28, 43, 58, 73, 88]);
const SCALE_LABELS = Object.freeze(['Muito baixo', 'Baixo', 'Equilibrado', 'Alto', 'Muito alto']);
const FOCUSES = Object.freeze(['Defender', 'Apoiar', 'Atacar']);

const FORMATION_SLOTS = Object.freeze({
  '4-2-3-1': [[50,91],[16,73],[38,77],[62,77],[84,73],[38,57],[62,57],[17,34],[50,39],[83,34],[50,15]],
  '4-3-3': [[50,91],[16,73],[38,77],[62,77],[84,73],[30,53],[50,59],[70,53],[17,27],[50,18],[83,27]],
  '3-4-2-1': [[50,91],[24,75],[50,79],[76,75],[14,51],[38,57],[62,57],[86,51],[35,34],[65,34],[50,14]],
  '4-4-2': [[50,91],[16,73],[38,77],[62,77],[84,73],[16,46],[39,55],[61,55],[84,46],[36,19],[64,19]],
  '4-1-4-1': [[50,91],[16,73],[38,77],[62,77],[84,73],[50,59],[16,40],[38,44],[62,44],[84,40],[50,15]],
  '3-5-2': [[50,91],[24,75],[50,79],[76,75],[13,49],[35,56],[50,49],[65,56],[87,49],[36,18],[64,18]],
  '5-3-2': [[50,91],[10,65],[30,76],[50,80],[70,76],[90,65],[28,47],[50,55],[72,47],[36,18],[64,18]]
});

const ROLE_COPY = Object.freeze({
  'Goleiro': 'Protege a área e prioriza decisões seguras.',
  'Goleiro líbero': 'Sai da área para cobrir a linha alta e iniciar ataques.',
  'Zagueiro': 'Mantém posição, protege a área e simplifica a saída.',
  'Zagueiro construtor': 'Quebra linhas com passe e conduz a primeira fase.',
  'Zagueiro de cobertura': 'Recua antes dos parceiros para proteger bolas nas costas.',
  'Lateral': 'Dá apoio pelo corredor sem abandonar totalmente a linha defensiva.',
  'Ala': 'Ocupa toda a faixa lateral e oferece profundidade constante.',
  'Lateral invertido': 'Entra por dentro na construção e libera o corredor para o ponta.',
  'Volante': 'Protege a frente da defesa e oferece uma linha de passe segura.',
  'Organizador recuado': 'Comanda a circulação desde a base do meio-campo.',
  'Meia área a área': 'Conecta as duas áreas com volume e chegada.',
  'Meia criativo': 'Recebe entrelinhas e busca o passe que rompe a defesa.',
  'Meia aberto': 'Ajuda a circulação por fora e recompõe o corredor.',
  'Ponta': 'Mantém amplitude e enfrenta o lateral em velocidade.',
  'Ponta invertido': 'Parte de fora e ataca zonas de finalização por dentro.',
  'Centroavante': 'Fixa os zagueiros e ocupa a área.',
  'Atacante móvel': 'Ataca profundidade e troca de corredor para gerar desorganização.',
  'Falso 9': 'Recua para criar superioridade e abre espaço para infiltrações.',
  'Finalizador': 'Economiza movimentos e prioriza chegar em condição de chute.',
  'Segundo atacante': 'Joga ao redor do homem de referência e ataca a segunda bola.'
});

let mounting = false;
let activeTab = 'possession';
let pitchPhase = 'base';
let selectedPlayerId = null;
let currentCareer = null;
let bridgeRoot = null;
let studioRoot = null;

const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);
const clone = value => JSON.parse(JSON.stringify(value));
const lastName = value => String(value || '').trim().split(/\s+/).at(-1) || '';
const portrait = player => `/assets/players/2026-27/${player.clubCode.toLowerCase()}-${player.fotmobId}.png`;

function orderedLineup(career) {
  return career.lineup
    .map((id, sourceIndex) => ({ player: PLAYER_BY_ID.get(id), sourceIndex }))
    .filter(entry => entry.player)
    .sort((left, right) => GROUP_ORDER[left.player.group] - GROUP_ORDER[right.player.group] || left.sourceIndex - right.sourceIndex)
    .map(entry => entry.player);
}

function defaultRole(player) {
  const position = String(player.position || '').toUpperCase();
  if (player.group === 'GK') return 'Goleiro';
  if (player.group === 'DEF') {
    if (/RWB|LWB/.test(position)) return 'Ala';
    if (/RB|LB/.test(position)) return 'Lateral';
    return 'Zagueiro';
  }
  if (player.group === 'MID') {
    if (/RW|LW|RM|LM/.test(position)) return 'Ponta';
    if (/AM|CAM/.test(position)) return 'Meia criativo';
    if (/DM|CDM/.test(position)) return 'Volante';
    return 'Meia área a área';
  }
  return /CF|SS/.test(position) ? 'Atacante móvel' : 'Centroavante';
}

function assignment(player) {
  return currentCareer.tactics.roles?.[player.id] || { role: defaultRole(player), focus: 'Apoiar' };
}

function roleFit(player, role) {
  const position = String(player.position || '').toUpperCase();
  let fit = 74;
  if (player.group === 'GK' && /Goleiro/.test(role)) fit = 94;
  if (player.group === 'DEF' && /Zagueiro/.test(role) && /CB/.test(position)) fit = 94;
  if (player.group === 'DEF' && /Lateral|Ala/.test(role) && /RB|LB|RWB|LWB/.test(position)) fit = 92;
  if (player.group === 'MID' && /Volante|recuado/.test(role) && /DM|CDM|CM/.test(position)) fit = 90;
  if (player.group === 'MID' && /criativo/.test(role) && /AM|CAM|CM/.test(position)) fit = 89;
  if (/Ponta/.test(role) && /RW|LW|RM|LM/.test(position)) fit = 92;
  if (player.group === 'FWD' && /Centroavante|Finalizador/.test(role) && /ST|CF/.test(position)) fit = 94;
  return fit;
}

function phaseSlot(slot, player, index) {
  let [x, y] = slot;
  const role = assignment(player).role;
  if (pitchPhase === 'possession') {
    y -= player.group === 'GK' ? 2 : player.group === 'DEF' ? 5 : player.group === 'MID' ? 7 : 4;
    const widthDelta = (currentCareer.tactics.width - 55) / 8;
    if (x < 40) x -= widthDelta;
    if (x > 60) x += widthDelta;
    if (/Lateral invertido/.test(role)) x += x < 50 ? 14 : -14;
    if (/Ponta invertido/.test(role)) x += x < 50 ? 10 : -10;
    if (/Falso 9/.test(role)) y += 12;
  } else if (pitchPhase === 'out') {
    y += player.group === 'FWD' ? 10 : player.group === 'MID' ? 7 : player.group === 'DEF' ? 3 : 0;
    const compact = (60 - currentCareer.tactics.defensiveWidth) / 7;
    if (x < 50) x += compact;
    if (x > 50) x -= compact;
  }
  return [Math.max(7, Math.min(93, x)), Math.max(8, Math.min(93, y)), index];
}

function playerCard(player, index, slots) {
  const [x, y] = phaseSlot(slots[index] || FORMATION_SLOTS['4-2-3-1'][index], player, index);
  const role = assignment(player);
  const state = currentCareer.playerState[player.id] || {};
  return `<button class="tl-player-node ${selectedPlayerId === player.id ? 'selected' : ''}" data-tl-player="${player.id}" style="--x:${x}%;--y:${y}%" type="button">
    <span class="tl-player-photo"><img src="${portrait(player)}" alt="" onerror="this.hidden=true"/><b>${player.number}</b></span>
    <strong>${esc(lastName(player.name))}</strong>
    <small>${esc(role.role)} · ${esc(role.focus)}</small>
    <i style="--condition:${state.condition || 100}%"></i>
  </button>`;
}

function semanticLevel(key, label) {
  const value = Number(currentCareer.tactics[key]);
  const closest = SCALE_VALUES.reduce((best, option, index) =>
    Math.abs(option - value) < Math.abs(SCALE_VALUES[best] - value) ? index : best, 0);
  return `<div class="tl-setting-block"><div class="tl-setting-title"><span>${label}</span><b>${SCALE_LABELS[closest]}</b></div><div class="tl-segments">${SCALE_VALUES.map((option, index) =>
    `<button class="${index === closest ? 'active' : ''}" data-tl-field="${key}" data-tl-value="${option}" title="${SCALE_LABELS[index]}" type="button"><i></i></button>`
  ).join('')}</div></div>`;
}

function selectSetting(key, label, options) {
  return `<label class="tl-select-setting"><span>${label}</span><select data-tl-select="${key}">${options.map(option =>
    `<option value="${esc(option)}" ${currentCareer.tactics[key] === option ? 'selected' : ''}>${esc(option)}</option>`
  ).join('')}</select></label>`;
}

function possessionControls() {
  return `${selectSetting('buildUp', 'Construção', TACTIC_OPTIONS.buildUp)}
    ${semanticLevel('tempo', 'Ritmo')}
    ${semanticLevel('width', 'Largura ofensiva')}
    ${selectSetting('attackingFocus', 'Foco da progressão', TACTIC_OPTIONS.attackingFocus)}
    ${selectSetting('freedom', 'Liberdade posicional', TACTIC_OPTIONS.freedom)}
    ${selectSetting('chanceCreation', 'Criação de chances', TACTIC_OPTIONS.chanceCreation)}`;
}

function transitionControls() {
  return `${selectSetting('afterWin', 'Após recuperar', TACTIC_OPTIONS.afterWin)}
    ${selectSetting('afterLoss', 'Após perder', TACTIC_OPTIONS.afterLoss)}
    ${selectSetting('distribution', 'Distribuição do goleiro', TACTIC_OPTIONS.distribution)}
    <div class="tl-explainer"><b>O que muda</b><p>Transições alteram quantos ataques rápidos, recuperações altas e perdas perigosas sua equipe produz.</p></div>`;
}

function outOfPossessionControls() {
  return `${selectSetting('defensiveShape', 'Altura do bloco', TACTIC_OPTIONS.defensiveShape)}
    ${semanticLevel('defensiveLine', 'Última linha')}
    ${semanticLevel('pressing', 'Intensidade da pressão')}
    ${semanticLevel('defensiveWidth', 'Largura defensiva')}
    ${selectSetting('pressingTrap', 'Direção da pressão', TACTIC_OPTIONS.pressingTrap)}
    ${selectSetting('tackling', 'Desarmes', TACTIC_OPTIONS.tackling)}
    ${selectSetting('marking', 'Marcação', TACTIC_OPTIONS.marking)}
    <label class="tl-switch"><span><b>Linha de impedimento</b><small>Exige coordenação e uma linha agressiva.</small></span><input type="checkbox" data-tl-toggle="offsideTrap" ${currentCareer.tactics.offsideTrap ? 'checked' : ''}/><i></i></label>`;
}

function controlsPanel() {
  const body = activeTab === 'possession' ? possessionControls() : activeTab === 'transition' ? transitionControls() : outOfPossessionControls();
  return `<aside class="tl-tactic-controls">
    <div class="tl-plan-card"><div><small>PLANO ATIVO</small><strong>${currentCareer.tactics.activePlan}</strong></div><div class="tl-plan-tabs">${['A','B','C'].map(plan =>
      `<button class="${currentCareer.tactics.activePlan === plan ? 'active' : ''}" data-tl-plan="${plan}" type="button">${plan}</button>`
    ).join('')}</div></div>
    ${selectSetting('mentality', 'Mentalidade', TACTIC_OPTIONS.mentality)}
    <nav class="tl-phase-tabs"><button class="${activeTab === 'possession' ? 'active' : ''}" data-tl-tab="possession">Com a bola</button><button class="${activeTab === 'transition' ? 'active' : ''}" data-tl-tab="transition">Transição</button><button class="${activeTab === 'out' ? 'active' : ''}" data-tl-tab="out">Sem a bola</button></nav>
    <div class="tl-controls-scroll">${body}</div>
  </aside>`;
}

function inspector(players) {
  const player = players.find(item => item.id === selectedPlayerId) || players[0];
  if (!player) return '<aside class="tl-inspector"></aside>';
  selectedPlayerId = player.id;
  const role = assignment(player);
  const roles = PLAYER_ROLE_OPTIONS[player.group] || [];
  const fit = roleFit(player, role.role);
  const state = currentCareer.playerState[player.id] || {};
  return `<aside class="tl-inspector">
    <header><img src="${portrait(player)}" alt="" onerror="this.hidden=true"/><div><small>${player.position} · ${player.rating} OVR</small><h2>${esc(player.name)}</h2><span>${state.condition || 100}% de condição</span></div></header>
    <div class="tl-role-select"><span>Função</span><select data-tl-role="${player.id}">${roles.map(option => `<option ${role.role === option ? 'selected' : ''}>${esc(option)}</option>`).join('')}</select></div>
    <div class="tl-focus"><span>Foco</span><div>${FOCUSES.map(focus => `<button class="${role.focus === focus ? 'active' : ''}" data-tl-focus="${player.id}" data-focus="${focus}" type="button">${focus}</button>`).join('')}</div></div>
    <div class="tl-fit"><div><span>Adequação à função</span><b>${fit}%</b></div><i style="--fit:${fit}%"></i></div>
    <div class="tl-role-copy"><b>${esc(role.role)}</b><p>${esc(ROLE_COPY[role.role] || 'A função altera posicionamento, risco e participação nas diferentes fases.')}</p></div>
    <div class="tl-player-impact"><span><small>Em posse</small><b>${role.focus === 'Atacar' ? 'Ataca a última linha' : role.focus === 'Defender' ? 'Protege a base' : 'Conecta setores'}</b></span><span><small>Sem posse</small><b>${role.focus === 'Defender' ? 'Mantém posição' : 'Pressiona e recompõe'}</b></span></div>
  </aside>`;
}

function impactPanel(players) {
  const analysis = analyzeTactics(currentCareer.tactics, players);
  const entries = [
    ['construction','Construção'],['control','Controle'],['penetration','Penetração'],
    ['creation','Criação'],['protection','Proteção'],['intensity','Exigência']
  ];
  return `<section class="tl-impact">
    <div class="tl-impact-metrics">${entries.map(([key,label]) => `<div><span>${label}</span><b>${analysis.metrics[key]}</b><i style="--metric:${analysis.metrics[key]}%"></i></div>`).join('')}</div>
    <div class="tl-impact-notes"><article class="strength"><small>PONTOS FORTES</small>${analysis.strengths.map(item => `<p>✓ ${esc(item)}</p>`).join('')}</article><article class="risk"><small>RISCOS</small>${analysis.risks.map(item => `<p>! ${esc(item)}</p>`).join('')}</article></div>
    ${analysis.conflicts.length ? `<div class="tl-conflicts"><b>Conflitos detectados</b>${analysis.conflicts.map(item => `<p>${esc(item)}</p>`).join('')}</div>` : ''}
  </section>`;
}

function pitch(players) {
  const slots = FORMATION_SLOTS[currentCareer.formation] || FORMATION_SLOTS['4-2-3-1'];
  return `<section class="tl-pitch-card"><div class="tl-pitch-toolbar"><div><small>FORMAÇÃO</small><select data-tl-formation>${Object.keys(FORMATION_SHAPES).map(formation => `<option ${formation === currentCareer.formation ? 'selected' : ''}>${formation}</option>`).join('')}</select></div><nav>${[['base','Base'],['possession','Com bola'],['out','Sem bola']].map(([key,label]) => `<button class="${pitchPhase === key ? 'active' : ''}" data-tl-pitch-phase="${key}" type="button">${label}</button>`).join('')}</nav><button class="tl-auto" data-tl-auto type="button">Recomendar XI</button></div>
    <div class="tl-pitch"><div class="tl-pitch-lines"><i></i><b></b><em></em></div>${players.map((player,index) => playerCard(player,index,slots)).join('')}</div>
    <div class="tl-pitch-legend"><span><i></i> Defender</span><span><i></i> Apoiar</span><span><i></i> Atacar</span></div>
  </section>`;
}

function renderStudio() {
  if (!studioRoot || !currentCareer) return;
  const players = orderedLineup(currentCareer);
  if (!selectedPlayerId || !players.some(player => player.id === selectedPlayerId)) selectedPlayerId = players[0]?.id || null;
  studioRoot.innerHTML = `<div class="tl-studio-head"><div><small>MODELO DE JOGO</small><h1>Central tática</h1><p>Desenhe comportamentos, veja riscos e transforme escolhas em acontecimentos dentro da partida.</p></div><div class="tl-save-state"><i></i><span>Salvo no seu save</span></div></div>
    <div class="tl-studio-grid">${controlsPanel()}${pitch(players)}${inspector(players)}</div>${impactPanel(players)}`;
  bindStudioEvents();
}

function pulseBridge() {
  if (!bridgeRoot || !currentCareer) return;
  globalThis.__touchlineTacticsDraft = clone(currentCareer.tactics);
  const input = bridgeRoot.querySelector('[data-tactic="pressing"]');
  if (!input) return;
  input.value = String(currentCareer.tactics.pressing);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function commitField(key, value) {
  const next = normalizeTactics({ ...currentCareer.tactics, [key]: value });
  const plan = next.activePlan;
  next.plans[plan] = { ...next.plans[plan], ...next };
  delete next.plans[plan].plans;
  delete next.plans[plan].roles;
  delete next.plans[plan].activePlan;
  currentCareer.tactics = normalizeTactics(next);
  pulseBridge();
  renderStudio();
}

function switchPlan(plan) {
  const current = normalizeTactics(currentCareer.tactics);
  const selected = current.plans[plan];
  currentCareer.tactics = normalizeTactics({
    ...current,
    ...selected,
    activePlan: plan,
    plans: current.plans,
    roles: current.roles
  });
  pulseBridge();
  renderStudio();
}

function setRole(playerId, patch) {
  const player = PLAYER_BY_ID.get(playerId);
  if (!player) return;
  const roles = clone(currentCareer.tactics.roles || {});
  roles[playerId] = { role: defaultRole(player), focus: 'Apoiar', ...(roles[playerId] || {}), ...patch };
  currentCareer.tactics = normalizeTactics({ ...currentCareer.tactics, roles });
  pulseBridge();
  renderStudio();
}

function bindStudioEvents() {
  studioRoot.querySelectorAll('[data-tl-tab]').forEach(button => button.onclick = () => { activeTab = button.dataset.tlTab; renderStudio(); });
  studioRoot.querySelectorAll('[data-tl-pitch-phase]').forEach(button => button.onclick = () => { pitchPhase = button.dataset.tlPitchPhase; renderStudio(); });
  studioRoot.querySelectorAll('[data-tl-plan]').forEach(button => button.onclick = () => switchPlan(button.dataset.tlPlan));
  studioRoot.querySelectorAll('[data-tl-field]').forEach(button => button.onclick = () => commitField(button.dataset.tlField, Number(button.dataset.tlValue)));
  studioRoot.querySelectorAll('[data-tl-select]').forEach(select => select.onchange = () => commitField(select.dataset.tlSelect, select.value));
  studioRoot.querySelectorAll('[data-tl-toggle]').forEach(input => input.onchange = () => commitField(input.dataset.tlToggle, input.checked));
  studioRoot.querySelectorAll('[data-tl-player]').forEach(button => button.onclick = () => { selectedPlayerId = button.dataset.tlPlayer; renderStudio(); });
  studioRoot.querySelectorAll('[data-tl-role]').forEach(select => select.onchange = () => setRole(select.dataset.tlRole, { role: select.value }));
  studioRoot.querySelectorAll('[data-tl-focus]').forEach(button => button.onclick = () => setRole(button.dataset.tlFocus, { focus: button.dataset.focus }));
  studioRoot.querySelector('[data-tl-formation]')?.addEventListener('change', event => {
    globalThis.__touchlineTacticsDraft = clone(currentCareer.tactics);
    const legacy = bridgeRoot.querySelector('[data-formation]');
    if (!legacy) return;
    legacy.value = event.target.value;
    legacy.dispatchEvent(new Event('change', { bubbles: true }));
  });
  studioRoot.querySelector('[data-tl-auto]')?.addEventListener('click', () => bridgeRoot.querySelector('[data-auto]')?.click());
}

async function mount() {
  if (mounting || location.hash !== '#tactics') return;
  const content = document.querySelector('.cp-content');
  if (!content || content.dataset.tacticsStudio === 'mounted') return;
  const legacyPage = content.querySelector('.cp-page');
  if (!legacyPage) return;
  mounting = true;
  try {
    const selectedClub = legacyClubSelection() || 'MUN';
    currentCareer = normalizeCareer(await CareerRepository.load(), selectedClub);
    bridgeRoot = document.createElement('div');
    bridgeRoot.className = 'tl-tactics-bridge';
    bridgeRoot.setAttribute('aria-hidden', 'true');
    bridgeRoot.append(legacyPage);
    studioRoot = document.createElement('section');
    studioRoot.className = 'tl-tactics-studio';
    content.replaceChildren(bridgeRoot, studioRoot);
    content.dataset.tacticsStudio = 'mounted';
    globalThis.__touchlineTacticsDraft = clone(currentCareer.tactics);
    renderStudio();
  } finally {
    mounting = false;
  }
}

const observer = new MutationObserver(() => queueMicrotask(mount));
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('hashchange', mount);
mount();

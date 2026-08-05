import './career-tactics-studio.css';
import {
  PLAYER_BY_ID,
  PLAYER_ROLE_OPTIONS,
  FORMATION_SHAPES,
  TACTIC_OPTIONS,
  normalizeCareer,
  normalizeTactics,
  squadFor
} from './career-core/career-core.js';
import { CareerRepository, legacyClubSelection } from './career-core/career-repository.js';

const SCALE_VALUES = Object.freeze([28, 43, 58, 73, 88]);
const SCALE_LABELS = Object.freeze(['Muito baixo', 'Baixo', 'Equilibrado', 'Alto', 'Muito alto']);
const FOCUSES = Object.freeze(['Defender', 'Apoiar', 'Atacar']);
const PHASES = Object.freeze(['base', 'possession', 'out']);
const PLANS = Object.freeze(['A', 'B', 'C']);
const BENCH_LIMIT = 9;

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
let dragSession = null;
let highlightedDrop = null;
let suppressClickUntil = 0;
let saveTimer = null;
let saveState = 'saved';
let toastTimer = null;

const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);
const clone = value => JSON.parse(JSON.stringify(value));
const lastName = value => String(value || '').trim().split(/\s+/).at(-1) || '';
const portrait = player => `/assets/players/2026-27/${player.clubCode.toLowerCase()}-${player.fotmobId}.png`;
const uniqueValid = (ids, valid) => [...new Set(Array.isArray(ids) ? ids : [])].filter(id => valid.has(id));

function roster() {
  return [...squadFor(currentCareer.clubCode)].sort((left, right) =>
    right.rating - left.rating || left.name.localeCompare(right.name)
  );
}

function ensureCareerCollections() {
  currentCareer.tactics = normalizeTactics(currentCareer.tactics);
  const players = roster();
  const valid = new Set(players.map(player => player.id));
  let lineup = uniqueValid(currentCareer.lineup, valid).slice(0, 11);
  for (const player of players) {
    if (lineup.length >= 11) break;
    if (!lineup.includes(player.id)) lineup.push(player.id);
  }

  let bench = uniqueValid(currentCareer.bench, valid)
    .filter(id => !lineup.includes(id))
    .slice(0, BENCH_LIMIT);
  const available = players.filter(player => !lineup.includes(player.id) && !bench.includes(player.id));
  if (!bench.some(id => PLAYER_BY_ID.get(id)?.group === 'GK')) {
    const goalkeeper = available.find(player => player.group === 'GK');
    if (goalkeeper) bench.push(goalkeeper.id);
  }
  for (const player of available) {
    if (bench.length >= BENCH_LIMIT) break;
    if (!bench.includes(player.id)) bench.push(player.id);
  }

  currentCareer.lineup = lineup;
  currentCareer.bench = bench.slice(0, BENCH_LIMIT);
  currentCareer.tacticalLayouts = currentCareer.tacticalLayouts && typeof currentCareer.tacticalLayouts === 'object'
    ? currentCareer.tacticalLayouts
    : {};
  for (const plan of PLANS) {
    currentCareer.tacticalLayouts[plan] ||= {};
    for (const phase of PHASES) currentCareer.tacticalLayouts[plan][phase] ||= {};
  }
}

function lineupPlayers() {
  return currentCareer.lineup.map(id => PLAYER_BY_ID.get(id)).filter(Boolean);
}

function benchPlayers() {
  return currentCareer.bench.map(id => PLAYER_BY_ID.get(id)).filter(Boolean);
}

function reservePlayers() {
  const related = new Set([...currentCareer.lineup, ...currentCareer.bench]);
  return roster().filter(player => !related.has(player.id));
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

function planSettings(plan = currentCareer.tactics.activePlan) {
  if (plan === currentCareer.tactics.activePlan) return currentCareer.tactics;
  return normalizeTactics({
    ...currentCareer.tactics,
    ...(currentCareer.tactics.plans?.[plan] || {}),
    activePlan: plan,
    plans: currentCareer.tactics.plans,
    roles: currentCareer.tactics.roles
  });
}

function defaultPosition(index, player, phase = pitchPhase, plan = currentCareer.tactics.activePlan) {
  const slots = FORMATION_SLOTS[currentCareer.formation] || FORMATION_SLOTS['4-2-3-1'];
  let [x, y] = slots[index] || FORMATION_SLOTS['4-2-3-1'][index] || [50, 50];
  const role = assignment(player).role;
  const tactics = planSettings(plan);
  if (phase === 'possession') {
    y -= player.group === 'GK' ? 2 : player.group === 'DEF' ? 5 : player.group === 'MID' ? 7 : 4;
    const widthDelta = (tactics.width - 55) / 8;
    if (x < 40) x -= widthDelta;
    if (x > 60) x += widthDelta;
    if (/Lateral invertido/.test(role)) x += x < 50 ? 14 : -14;
    if (/Ponta invertido/.test(role)) x += x < 50 ? 10 : -10;
    if (/Falso 9/.test(role)) y += 12;
  } else if (phase === 'out') {
    y += player.group === 'FWD' ? 10 : player.group === 'MID' ? 7 : player.group === 'DEF' ? 3 : 0;
    const compact = (60 - tactics.defensiveWidth) / 7;
    if (x < 50) x += compact;
    if (x > 50) x -= compact;
  }
  return { x: Math.max(6, Math.min(94, x)), y: Math.max(6, Math.min(94, y)) };
}

function layoutBucket(plan = currentCareer.tactics.activePlan, phase = pitchPhase) {
  currentCareer.tacticalLayouts[plan] ||= {};
  currentCareer.tacticalLayouts[plan][phase] ||= {};
  return currentCareer.tacticalLayouts[plan][phase];
}

function positionFor(player, index, phase = pitchPhase, plan = currentCareer.tactics.activePlan) {
  const manual = currentCareer.tacticalLayouts?.[plan]?.[phase]?.[player.id];
  return manual && Number.isFinite(manual.x) && Number.isFinite(manual.y)
    ? { x: manual.x, y: manual.y }
    : defaultPosition(index, player, phase, plan);
}

function statusOf(playerId) {
  if (currentCareer.lineup.includes(playerId)) return 'lineup';
  if (currentCareer.bench.includes(playerId)) return 'bench';
  return 'reserves';
}

function statusLabel(playerId) {
  return { lineup: 'XI inicial', bench: 'Banco', reserves: 'Não relacionado' }[statusOf(playerId)];
}

function playerNode(player, index) {
  const position = positionFor(player, index);
  const role = assignment(player);
  return `<button class="tl-player-node ${selectedPlayerId === player.id ? 'selected' : ''}" data-drag-player="${player.id}" data-drop-player="${player.id}" data-zone="lineup" style="--x:${position.x}%;--y:${position.y}%" type="button" aria-label="${esc(player.name)}">
    <span class="tl-player-photo"><img src="${portrait(player)}" alt="" draggable="false" onerror="this.hidden=true"/></span>
    <strong>${esc(lastName(player.name))}</strong>
    <small>${esc(role.role)}</small>
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
    <div class="tl-explainer"><b>Leitura da transição</b><p>Estas escolhas definem a velocidade da reação quando a posse muda de lado.</p></div>`;
}

function outOfPossessionControls() {
  return `${selectSetting('defensiveShape', 'Altura do bloco', TACTIC_OPTIONS.defensiveShape)}
    ${semanticLevel('defensiveLine', 'Última linha')}
    ${semanticLevel('pressing', 'Intensidade da pressão')}
    ${semanticLevel('defensiveWidth', 'Largura defensiva')}
    ${selectSetting('pressingTrap', 'Direção da pressão', TACTIC_OPTIONS.pressingTrap)}
    ${selectSetting('tackling', 'Desarmes', TACTIC_OPTIONS.tackling)}
    ${selectSetting('marking', 'Marcação', TACTIC_OPTIONS.marking)}
    <label class="tl-switch"><span><b>Linha de impedimento</b><small>Exige coordenação e cobertura da profundidade.</small></span><input type="checkbox" data-tl-toggle="offsideTrap" ${currentCareer.tactics.offsideTrap ? 'checked' : ''}/><i></i></label>`;
}

function controlsPanel() {
  const body = activeTab === 'possession' ? possessionControls() : activeTab === 'transition' ? transitionControls() : outOfPossessionControls();
  return `<aside class="tl-tactic-controls">
    <div class="tl-plan-card"><div><small>Plano de jogo</small><strong>${currentCareer.tactics.activePlan}</strong></div><div class="tl-plan-tabs">${PLANS.map(plan =>
      `<button class="${currentCareer.tactics.activePlan === plan ? 'active' : ''}" data-tl-plan="${plan}" type="button">${plan}</button>`
    ).join('')}</div></div>
    ${selectSetting('mentality', 'Mentalidade', TACTIC_OPTIONS.mentality)}
    <nav class="tl-phase-tabs"><button class="${activeTab === 'possession' ? 'active' : ''}" data-tl-tab="possession">Com a bola</button><button class="${activeTab === 'transition' ? 'active' : ''}" data-tl-tab="transition">Transição</button><button class="${activeTab === 'out' ? 'active' : ''}" data-tl-tab="out">Sem a bola</button></nav>
    <div class="tl-controls-scroll">${body}</div>
  </aside>`;
}

function inspector(players) {
  const all = roster();
  const player = all.find(item => item.id === selectedPlayerId) || players[0] || all[0];
  if (!player) return '<aside class="tl-inspector"></aside>';
  selectedPlayerId = player.id;
  const role = assignment(player);
  const roles = PLAYER_ROLE_OPTIONS[player.group] || [];
  const fit = roleFit(player, role.role);
  const state = currentCareer.playerState[player.id] || {};
  const inLineup = currentCareer.lineup.includes(player.id);
  return `<aside class="tl-inspector">
    <header><img src="${portrait(player)}" alt="" draggable="false" onerror="this.hidden=true"/><div><small>${esc(player.position)} · ${player.rating} OVR</small><h2>${esc(player.name)}</h2><span>${esc(statusLabel(player.id))} · ${state.condition || 100}% de condição</span></div></header>
    <div class="tl-role-select"><span>Função</span><select data-tl-role="${player.id}" ${inLineup ? '' : 'disabled'}>${roles.map(option => `<option ${role.role === option ? 'selected' : ''}>${esc(option)}</option>`).join('')}</select></div>
    <div class="tl-focus"><span>Foco</span><div>${FOCUSES.map(focus => `<button class="${role.focus === focus ? 'active' : ''}" data-tl-focus="${player.id}" data-focus="${focus}" type="button" ${inLineup ? '' : 'disabled'}>${focus}</button>`).join('')}</div></div>
    ${inLineup ? `<div class="tl-fit"><div><span>Adequação à função</span><b>${fit}%</b></div><i style="--fit:${fit}%"></i></div>
    <div class="tl-role-copy"><b>${esc(role.role)}</b><p>${esc(ROLE_COPY[role.role] || 'A função altera posicionamento, risco e participação nas diferentes fases.')}</p></div>` : `<div class="tl-inspector-hint"><b>Fora do XI</b><p>Arraste este jogador sobre um titular para fazer a troca imediatamente.</p></div>`}
  </aside>`;
}

function pitch(players) {
  return `<section class="tl-pitch-card">
    <div class="tl-pitch-toolbar"><label><span>Formação</span><select data-tl-formation>${Object.keys(FORMATION_SHAPES).map(formation => `<option ${formation === currentCareer.formation ? 'selected' : ''}>${formation}</option>`).join('')}</select></label><nav>${[['base','Base'],['possession','Com bola'],['out','Sem bola']].map(([key,label]) => `<button class="${pitchPhase === key ? 'active' : ''}" data-tl-pitch-phase="${key}" type="button">${label}</button>`).join('')}</nav><small>Arraste livremente ou solte sobre outro jogador para trocar</small></div>
    <div class="tl-pitch" data-drop-zone="pitch"><div class="tl-pitch-lines"><i></i><b></b><em></em></div>${players.map(playerNode).join('')}</div>
  </section>`;
}

function squadCard(player, zone) {
  const state = currentCareer.playerState[player.id] || {};
  return `<button class="tl-squad-card ${selectedPlayerId === player.id ? 'selected' : ''}" data-drag-player="${player.id}" data-drop-player="${player.id}" data-zone="${zone}" type="button">
    <span class="tl-squad-photo"><img src="${portrait(player)}" alt="" draggable="false" onerror="this.hidden=true"/></span>
    <span class="tl-squad-copy"><strong>${esc(player.name)}</strong><small>${esc(player.position)} · ${state.condition || 100}% condição</small></span>
    <b>${player.rating}</b>
    <i>${zone === 'bench' ? 'Banco' : 'Fora'}</i>
  </button>`;
}

function squadManager() {
  const bench = benchPlayers();
  const reserves = reservePlayers();
  return `<section class="tl-squad-manager">
    <header><div><small>Gestão da partida</small><h2>Relacionados</h2><p>Arraste jogadores entre o campo, o banco e os não relacionados.</p></div><div><b>${currentCareer.lineup.length}</b><span>XI</span><b>${bench.length}</b><span>Banco</span><b>${reserves.length}</b><span>Fora</span></div></header>
    <div class="tl-roster-section tl-bench-section" data-drop-zone="bench"><div class="tl-roster-title"><h3>Banco de reservas</h3><span>${bench.length}/${BENCH_LIMIT}</span></div><div class="tl-roster-grid bench">${bench.map(player => squadCard(player, 'bench')).join('') || '<p class="tl-empty-roster">Arraste jogadores para formar o banco.</p>'}</div></div>
    <div class="tl-roster-section" data-drop-zone="reserves"><div class="tl-roster-title"><h3>Não relacionados</h3><span>${reserves.length} jogadores</span></div><div class="tl-roster-grid reserves">${reserves.map(player => squadCard(player, 'reserves')).join('') || '<p class="tl-empty-roster">Todo o elenco está relacionado.</p>'}</div></div>
  </section>`;
}

function renderStudio() {
  if (!studioRoot || !currentCareer) return;
  ensureCareerCollections();
  const players = lineupPlayers();
  if (!selectedPlayerId || !roster().some(player => player.id === selectedPlayerId)) selectedPlayerId = players[0]?.id || null;
  studioRoot.innerHTML = `<header class="tl-studio-head"><div><small>Modelo de jogo</small><h1>Táticas</h1><p>Monte os relacionados, desenhe as três fases e defina o comportamento de cada jogador.</p></div><div class="tl-save-state ${saveState}" data-tl-save><i></i><span>${saveState === 'saving' ? 'Salvando alterações…' : 'Alterações salvas'}</span></div></header>
    <div class="tl-studio-grid">${controlsPanel()}${pitch(players)}${inspector(players)}</div>
    ${squadManager()}
    <div class="tl-toast" data-tl-toast role="status"></div>`;
  bindStudioEvents();
}

function updateSaveBadge() {
  const badge = studioRoot?.querySelector('[data-tl-save]');
  if (!badge) return;
  badge.classList.toggle('saving', saveState === 'saving');
  badge.classList.toggle('saved', saveState === 'saved');
  badge.querySelector('span')?.replaceChildren(saveState === 'saving' ? 'Salvando alterações…' : 'Alterações salvas');
}

function persistCareer() {
  saveState = 'saving';
  updateSaveBadge();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    const draft = clone(currentCareer);
    draft.updatedAt = new Date().toISOString();
    globalThis.__touchlineCareerDraft = draft;
    globalThis.__touchlineTacticsDraft = clone(draft.tactics);
    const input = bridgeRoot?.querySelector('[data-tactic="pressing"]');
    if (input) {
      input.value = String(draft.tactics.pressing);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      currentCareer = await CareerRepository.save(draft);
      delete globalThis.__touchlineCareerDraft;
    }
    saveState = 'saved';
    updateSaveBadge();
  }, 120);
}

function commitField(key, value) {
  const next = normalizeTactics({ ...currentCareer.tactics, [key]: value });
  const plan = next.activePlan;
  next.plans[plan] = { ...next.plans[plan], ...next };
  delete next.plans[plan].plans;
  delete next.plans[plan].roles;
  delete next.plans[plan].activePlan;
  currentCareer.tactics = normalizeTactics(next);
  renderStudio();
  persistCareer();
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
  renderStudio();
  persistCareer();
}

function setRole(playerId, patch) {
  const player = PLAYER_BY_ID.get(playerId);
  if (!player || !currentCareer.lineup.includes(playerId)) return;
  const roles = clone(currentCareer.tactics.roles || {});
  roles[playerId] = { role: defaultRole(player), focus: 'Apoiar', ...(roles[playerId] || {}), ...patch };
  currentCareer.tactics = normalizeTactics({ ...currentCareer.tactics, roles });
  renderStudio();
  persistCareer();
}

function changeFormation(formation) {
  if (!FORMATION_SHAPES[formation]) return;
  currentCareer.formation = formation;
  currentCareer.tacticalLayouts[currentCareer.tactics.activePlan] = { base: {}, possession: {}, out: {} };
  renderStudio();
  persistCareer();
}

function clearDropHighlight() {
  highlightedDrop?.classList.remove('tl-drop-target');
  highlightedDrop = null;
}

function highlightDrop(clientX, clientY) {
  clearDropHighlight();
  const element = document.elementFromPoint(clientX, clientY);
  const target = element?.closest('[data-drop-player], [data-drop-zone]');
  if (target && target.dataset.dropPlayer !== dragSession?.playerId) {
    highlightedDrop = target;
    target.classList.add('tl-drop-target');
  }
}

function createDragGhost(source) {
  const ghost = source.cloneNode(true);
  ghost.className = 'tl-drag-ghost';
  ghost.removeAttribute('style');
  ghost.querySelectorAll('[data-drag-player], [data-drop-player]').forEach(node => {
    node.removeAttribute('data-drag-player');
    node.removeAttribute('data-drop-player');
  });
  document.body.append(ghost);
  return ghost;
}

function positionGhost(event) {
  if (!dragSession?.ghost) return;
  dragSession.ghost.style.left = `${event.clientX}px`;
  dragSession.ghost.style.top = `${event.clientY}px`;
}

function beginDrag(event) {
  if (event.button !== 0 || event.target.closest('select,input')) return;
  const source = event.currentTarget;
  const playerId = source.dataset.dragPlayer;
  if (!playerId) return;
  dragSession = {
    playerId,
    source,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    started: false,
    ghost: null
  };
  source.setPointerCapture?.(event.pointerId);
  document.addEventListener('pointermove', moveDrag, { passive: false });
  document.addEventListener('pointerup', finishDrag, { once: true });
  document.addEventListener('pointercancel', cancelDrag, { once: true });
}

function moveDrag(event) {
  if (!dragSession || event.pointerId !== dragSession.pointerId) return;
  const distance = Math.hypot(event.clientX - dragSession.startX, event.clientY - dragSession.startY);
  if (!dragSession.started && distance < 5) return;
  if (!dragSession.started) {
    dragSession.started = true;
    dragSession.ghost = createDragGhost(dragSession.source);
    dragSession.source.classList.add('tl-drag-source');
    document.documentElement.classList.add('tl-is-dragging');
  }
  event.preventDefault();
  positionGhost(event);
  highlightDrop(event.clientX, event.clientY);
}

function endDragVisuals() {
  document.removeEventListener('pointermove', moveDrag);
  dragSession?.source?.classList.remove('tl-drag-source');
  dragSession?.ghost?.remove();
  document.documentElement.classList.remove('tl-is-dragging');
  clearDropHighlight();
}

function showToast(message) {
  const toast = studioRoot?.querySelector('[data-tl-toast]');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2600);
}

function copyFieldPosition(fromId, toId) {
  const fromPlayer = PLAYER_BY_ID.get(fromId);
  const fromIndex = currentCareer.lineup.indexOf(fromId);
  if (!fromPlayer || fromIndex < 0) return;
  for (const plan of PLANS) {
    for (const phase of PHASES) {
      const position = positionFor(fromPlayer, fromIndex, phase, plan);
      const bucket = layoutBucket(plan, phase);
      bucket[toId] = { ...position };
      delete bucket[fromId];
    }
  }
}

function swapLineupPositions(firstId, secondId) {
  const players = lineupPlayers();
  const firstIndex = currentCareer.lineup.indexOf(firstId);
  const secondIndex = currentCareer.lineup.indexOf(secondId);
  const first = players[firstIndex];
  const second = players[secondIndex];
  if (!first || !second) return false;
  for (const plan of PLANS) {
    for (const phase of PHASES) {
      const firstPosition = positionFor(first, firstIndex, phase, plan);
      const secondPosition = positionFor(second, secondIndex, phase, plan);
      const bucket = layoutBucket(plan, phase);
      bucket[firstId] = { ...secondPosition };
      bucket[secondId] = { ...firstPosition };
    }
  }
  return true;
}

function swapPlayers(firstId, secondId) {
  const firstStatus = statusOf(firstId);
  const secondStatus = statusOf(secondId);
  if (firstStatus === 'lineup' && secondStatus === 'lineup') return swapLineupPositions(firstId, secondId);

  if (firstStatus === 'lineup' || secondStatus === 'lineup') {
    const fieldId = firstStatus === 'lineup' ? firstId : secondId;
    const incomingId = firstStatus === 'lineup' ? secondId : firstId;
    const incomingStatus = statusOf(incomingId);
    const fieldIndex = currentCareer.lineup.indexOf(fieldId);
    copyFieldPosition(fieldId, incomingId);
    currentCareer.lineup[fieldIndex] = incomingId;
    if (incomingStatus === 'bench') {
      const benchIndex = currentCareer.bench.indexOf(incomingId);
      currentCareer.bench[benchIndex] = fieldId;
    }
    selectedPlayerId = incomingId;
    return true;
  }

  if (firstStatus === 'bench' && secondStatus === 'bench') {
    const firstIndex = currentCareer.bench.indexOf(firstId);
    const secondIndex = currentCareer.bench.indexOf(secondId);
    [currentCareer.bench[firstIndex], currentCareer.bench[secondIndex]] = [currentCareer.bench[secondIndex], currentCareer.bench[firstIndex]];
    return true;
  }

  if (firstStatus === 'bench' || secondStatus === 'bench') {
    const benchId = firstStatus === 'bench' ? firstId : secondId;
    const reserveId = firstStatus === 'bench' ? secondId : firstId;
    const index = currentCareer.bench.indexOf(benchId);
    currentCareer.bench[index] = reserveId;
    selectedPlayerId = reserveId;
    return true;
  }

  return false;
}

function movePlayerOnPitch(playerId, clientX, clientY) {
  if (statusOf(playerId) !== 'lineup') return false;
  const pitchElement = studioRoot?.querySelector('.tl-pitch');
  if (!pitchElement) return false;
  const bounds = pitchElement.getBoundingClientRect();
  const x = Math.max(6, Math.min(94, ((clientX - bounds.left) / bounds.width) * 100));
  const y = Math.max(6, Math.min(94, ((clientY - bounds.top) / bounds.height) * 100));
  layoutBucket()[playerId] = { x: +x.toFixed(2), y: +y.toFixed(2) };
  selectedPlayerId = playerId;
  return true;
}

function moveToBench(playerId) {
  const status = statusOf(playerId);
  if (status === 'bench') return false;
  if (status === 'lineup') {
    showToast('Para tirar um titular, solte-o sobre um jogador do banco ou do elenco.');
    return false;
  }
  if (currentCareer.bench.length >= BENCH_LIMIT) {
    showToast('O banco já tem nove jogadores. Solte sobre um reserva para trocar.');
    return false;
  }
  currentCareer.bench.push(playerId);
  selectedPlayerId = playerId;
  return true;
}

function moveToReserves(playerId) {
  const status = statusOf(playerId);
  if (status === 'reserves') return false;
  if (status === 'lineup') {
    showToast('O XI precisa manter onze jogadores. Faça a troca soltando sobre outro atleta.');
    return false;
  }
  currentCareer.bench = currentCareer.bench.filter(id => id !== playerId);
  selectedPlayerId = playerId;
  return true;
}

function performDrop(playerId, clientX, clientY) {
  const element = document.elementFromPoint(clientX, clientY);
  const targetPlayer = element?.closest('[data-drop-player]');
  let changed = false;
  if (targetPlayer && targetPlayer.dataset.dropPlayer !== playerId) {
    changed = swapPlayers(playerId, targetPlayer.dataset.dropPlayer);
  } else {
    const zone = element?.closest('[data-drop-zone]')?.dataset.dropZone;
    if (zone === 'pitch') {
      changed = movePlayerOnPitch(playerId, clientX, clientY);
      if (!changed) showToast('Solte o jogador sobre um titular para colocá-lo no XI.');
    } else if (zone === 'bench') changed = moveToBench(playerId);
    else if (zone === 'reserves') changed = moveToReserves(playerId);
  }
  if (changed) {
    renderStudio();
    persistCareer();
  }
}

function finishDrag(event) {
  if (!dragSession || event.pointerId !== dragSession.pointerId) return;
  const session = dragSession;
  endDragVisuals();
  dragSession = null;
  if (session.started) {
    suppressClickUntil = performance.now() + 300;
    performDrop(session.playerId, event.clientX, event.clientY);
  } else {
    selectedPlayerId = session.playerId;
    renderStudio();
  }
}

function cancelDrag() {
  endDragVisuals();
  dragSession = null;
}

function bindStudioEvents() {
  studioRoot.querySelectorAll('[data-tl-tab]').forEach(button => button.onclick = () => { activeTab = button.dataset.tlTab; renderStudio(); });
  studioRoot.querySelectorAll('[data-tl-pitch-phase]').forEach(button => button.onclick = () => { pitchPhase = button.dataset.tlPitchPhase; renderStudio(); });
  studioRoot.querySelectorAll('[data-tl-plan]').forEach(button => button.onclick = () => switchPlan(button.dataset.tlPlan));
  studioRoot.querySelectorAll('[data-tl-field]').forEach(button => button.onclick = () => commitField(button.dataset.tlField, Number(button.dataset.tlValue)));
  studioRoot.querySelectorAll('[data-tl-select]').forEach(select => select.onchange = () => commitField(select.dataset.tlSelect, select.value));
  studioRoot.querySelectorAll('[data-tl-toggle]').forEach(input => input.onchange = () => commitField(input.dataset.tlToggle, input.checked));
  studioRoot.querySelectorAll('[data-tl-role]').forEach(select => select.onchange = () => setRole(select.dataset.tlRole, { role: select.value }));
  studioRoot.querySelectorAll('[data-tl-focus]').forEach(button => button.onclick = () => setRole(button.dataset.tlFocus, { focus: button.dataset.focus }));
  studioRoot.querySelector('[data-tl-formation]')?.addEventListener('change', event => changeFormation(event.target.value));
  studioRoot.querySelectorAll('[data-drag-player]').forEach(element => {
    element.onpointerdown = beginDrag;
    element.onclick = event => {
      if (performance.now() < suppressClickUntil) event.preventDefault();
    };
  });
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
    ensureCareerCollections();
    bridgeRoot = document.createElement('div');
    bridgeRoot.className = 'tl-tactics-bridge';
    bridgeRoot.setAttribute('aria-hidden', 'true');
    bridgeRoot.append(legacyPage);
    studioRoot = document.createElement('section');
    studioRoot.className = 'tl-tactics-studio';
    content.replaceChildren(bridgeRoot, studioRoot);
    content.dataset.tacticsStudio = 'mounted';
    renderStudio();
  } finally {
    mounting = false;
  }
}

const observer = new MutationObserver(() => queueMicrotask(mount));
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('hashchange', mount);
mount();
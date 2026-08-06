import './career-mailbox.css';
import { PLAYER_BY_ID, normalizeCareer } from './career-core/career-core.js';
import { CLUB_BY_CODE } from './career-core/season-2026-27-live.js';
import { CareerRepository, legacyClubSelection } from './career-core/career-repository.js';
import {
  careerInboxItems,
  mailboxSummary,
  markMailboxRead,
  reconcileMailbox,
  respondToMailboxMessage
} from './career-core/mailbox-core.js';

const PLAYER_MANIFEST_URL = '/assets/players/2026-27/manifest.json';
const PLAYER_FALLBACK_URL = '/assets/players/player-placeholder.svg';
const app = typeof document !== 'undefined' ? document.querySelector('#app') : null;
const contexts = new WeakMap();
let manifestPromise = null;
let installQueued = false;
let selectedMessageId = null;
let activeFilter = 'all';
let searchQuery = '';

const CATEGORY_META = Object.freeze({
  board: { label: 'Diretoria', icon: '◇', tone: 'board' },
  player: { label: 'Jogador', icon: '◉', tone: 'player' },
  medical: { label: 'Departamento médico', icon: '+', tone: 'medical' },
  transfer: { label: 'Transferências', icon: '↔', tone: 'transfer' },
  staff: { label: 'Comissão técnica', icon: '⌁', tone: 'staff' },
  match: { label: 'Partida', icon: '⚑', tone: 'match' },
  system: { label: 'Operações', icon: '✓', tone: 'system' },
  club: { label: 'Clube', icon: '•', tone: 'club' }
});

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function loadPlayerManifest() {
  if (manifestPromise) return manifestPromise;
  manifestPromise = fetch(`${PLAYER_MANIFEST_URL}?v=9`, { cache: 'no-store' })
    .then(response => response.ok ? response.json() : { players: {} })
    .then(manifest => manifest?.players ? manifest : { players: {} })
    .catch(() => ({ players: {} }));
  return manifestPromise;
}

function playerPortrait(manifest, player) {
  const record = manifest?.players?.[player?.id];
  return record?.playerId === player?.id && record?.clubCode === player?.clubCode && record?.localPath
    ? record.localPath
    : PLAYER_FALLBACK_URL;
}

function formatMessageDate(message, currentDate) {
  if (message.date === currentDate) return 'Hoje';
  const [year, month, day] = String(message.date || '').split('-').map(Number);
  if (!year || !month || !day) return message.date || '';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC', weekday: 'short', day: '2-digit', month: 'short'
  }).format(new Date(Date.UTC(year, month - 1, day))).replaceAll('.', '');
}

function metaFor(message) {
  return CATEGORY_META[message.category] || CATEGORY_META.club;
}

function initials(value) {
  return String(value || 'TL').split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
}

function senderAvatar(message, manifest, compact = false) {
  const player = PLAYER_BY_ID.get(message.entity?.playerId);
  const meta = metaFor(message);
  if (player) {
    return `<span class="tl-mail-avatar ${compact ? 'is-compact' : ''} has-photo ${meta.tone}">
      <img src="${esc(playerPortrait(manifest, player))}" alt="${esc(player.name)}" data-mail-player-face>
      <i>${esc(meta.icon)}</i>
    </span>`;
  }
  return `<span class="tl-mail-avatar ${compact ? 'is-compact' : ''} ${meta.tone}">
    <b>${esc(message.entity?.initials || initials(message.sender))}</b><i>${esc(meta.icon)}</i>
  </span>`;
}

function priorityLabel(message) {
  if (message.status === 'expired') return '<span class="tl-mail-status is-muted">Expirada</span>';
  if (message.response) return `<span class="tl-mail-status is-resolved">${esc(message.response.label)}</span>`;
  if (message.requiresResponse) return '<span class="tl-mail-status is-required">Resposta necessária</span>';
  if (message.priority === 'urgent') return '<span class="tl-mail-status is-urgent">Urgente</span>';
  if (!message.read) return '<span class="tl-mail-status is-new">Nova</span>';
  return '';
}

function categoryChip(message) {
  const meta = metaFor(message);
  return `<span class="tl-mail-category ${meta.tone}"><i>${esc(meta.icon)}</i>${esc(meta.label)}</span>`;
}

function listItemMarkup(message, career, manifest) {
  return `<button class="tl-mail-row ${message.id === selectedMessageId ? 'is-selected' : ''} ${!message.read ? 'is-unread' : ''} ${message.requiresResponse ? 'is-required' : ''}" data-mail-id="${esc(message.id)}">
    <span class="tl-mail-unread-dot"></span>
    ${senderAvatar(message, manifest, true)}
    <span class="tl-mail-row-copy">
      <small><b>${esc(message.sender)}</b><time>${esc(formatMessageDate(message, career.currentDate))}</time></small>
      <strong>${esc(message.subject)}</strong>
      <p>${esc(message.preview || message.body)}</p>
      <span>${categoryChip(message)}${priorityLabel(message)}</span>
    </span>
  </button>`;
}

function playerCard(message, career, manifest) {
  const player = PLAYER_BY_ID.get(message.entity?.playerId);
  if (!player) return '';
  const state = career.playerState?.[player.id] || {};
  const injury = career.injuries?.[player.id];
  const status = injury?.active
    ? `Lesionado · retorno ${String(injury.returnDate || '').split('-').reverse().join('/')}`
    : state.departurePending
      ? 'Saída acordada'
      : 'Disponível';
  return `<section class="tl-mail-player-card">
    <span class="tl-mail-player-photo"><img src="${esc(playerPortrait(manifest, player))}" alt="${esc(player.name)}" data-mail-player-face></span>
    <div><small>JOGADOR RELACIONADO</small><h3>${esc(player.name)}</h3><p>${esc(player.position)} · ${esc(CLUB_BY_CODE.get(player.clubCode)?.shortName || player.clubCode)}</p></div>
    <dl>
      <div><dt>OVR</dt><dd>${player.rating}</dd></div>
      <div><dt>Condição</dt><dd>${Math.round(Number(state.condition || 100))}%</dd></div>
      <div><dt>Moral</dt><dd>${Math.round(Number(state.morale || 75))}</dd></div>
      <div><dt>Status</dt><dd>${esc(status)}</dd></div>
    </dl>
  </section>`;
}

function contextCard(message, career) {
  const data = message.data || {};
  if (message.kind === 'transfer-offer') {
    const offer = career.transferOffers?.[data.offerId] || data;
    return `<section class="tl-mail-context-card transfer">
      <div><small>VALOR DA PROPOSTA</small><strong>${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'GBP', notation: 'compact', maximumFractionDigits: 1 }).format(Number(offer.amount || data.amount || 0))}</strong></div>
      <div><small>CLUBE INTERESSADO</small><b>${esc(offer.buyer || data.buyer || message.sender)}</b></div>
      <div><small>PRAZO</small><b>${esc(String(offer.deadline || data.deadline || '').split('-').reverse().join('/'))}</b></div>
    </section>`;
  }
  if (message.kind === 'injury') {
    return `<section class="tl-mail-context-card medical">
      <div><small>DIAGNÓSTICO</small><strong>${esc(data.type || 'Em avaliação')}</strong></div>
      <div><small>PREVISÃO</small><b>${Number(data.days || 0)} dias</b></div>
      <div><small>RETORNO ESTIMADO</small><b>${esc(String(data.returnDate || '').split('-').reverse().join('/'))}</b></div>
    </section>`;
  }
  if (message.kind === 'medical-load') {
    const players = (data.playerIds || []).map(id => PLAYER_BY_ID.get(id)).filter(Boolean);
    return `<section class="tl-mail-context-card medical">
      <div><small>ATLETAS EM ALERTA</small><strong>${players.length}</strong></div>
      <div class="wide"><small>RECOMENDAÇÃO</small><b>Reduzir intensidade e priorizar recuperação</b></div>
    </section>`;
  }
  if (message.kind === 'player-minutes') {
    return `<section class="tl-mail-context-card player">
      <div><small>PRAZO PARA RESPOSTA</small><strong>${esc(String(data.deadline || '').split('-').reverse().join('/'))}</strong></div>
      <div class="wide"><small>IMPACTO</small><b>Sua resposta pode alterar moral e confiança do jogador</b></div>
    </section>`;
  }
  if (message.kind === 'opponent-report') {
    const opponent = CLUB_BY_CODE.get(data.opponentCode);
    return `<section class="tl-mail-context-card staff">
      <div><small>PRÓXIMO ADVERSÁRIO</small><strong>${esc(opponent?.shortName || opponent?.name || 'Adversário')}</strong></div>
      <div class="wide"><small>USO DO RELATÓRIO</small><b>Disponível na preparação tática da próxima partida</b></div>
    </section>`;
  }
  return '';
}

function actionsMarkup(message) {
  if (message.response) {
    return `<div class="tl-mail-response"><i>✓</i><span><small>DECISÃO REGISTRADA</small><b>${esc(message.response.label)}</b></span></div>`;
  }
  if (!message.actions?.length) {
    return '<div class="tl-mail-response is-neutral"><i>✓</i><span><small>INFORMATIVO</small><b>Nenhuma ação necessária</b></span></div>';
  }
  return `<div class="tl-mail-actions">${message.actions.map(action =>
    `<button class="${esc(action.kind || 'secondary')}" data-mail-action="${esc(action.id)}" data-mail-message="${esc(message.id)}">${esc(action.label)}</button>`
  ).join('')}</div>`;
}

function messageDetailMarkup(message, career, manifest) {
  if (!message) {
    return `<div class="tl-mail-empty-detail"><span>✉</span><h2>Nenhuma mensagem encontrada</h2><p>Altere os filtros ou limpe a busca para voltar à caixa de entrada.</p></div>`;
  }
  return `<article class="tl-mail-detail ${message.requiresResponse ? 'is-required' : ''}">
    <header class="tl-mail-detail-head">
      <div class="tl-mail-sender">${senderAvatar(message, manifest)}<span><small>${esc(message.senderRole)}</small><b>${esc(message.sender)}</b></span></div>
      <div class="tl-mail-detail-meta">${categoryChip(message)}<time>${esc(formatMessageDate(message, career.currentDate))}</time></div>
    </header>
    ${message.requiresResponse ? '<div class="tl-mail-required-banner"><i>!</i><span><b>Esta mensagem exige uma decisão</b><small>Analise o contexto antes de continuar.</small></span></div>' : ''}
    <div class="tl-mail-detail-body">
      <div class="tl-mail-subject-line">${priorityLabel(message)}<h2>${esc(message.subject)}</h2></div>
      <p class="tl-mail-letter">${esc(message.body)}</p>
      ${playerCard(message, career, manifest)}
      ${contextCard(message, career)}
    </div>
    <footer>${actionsMarkup(message)}</footer>
  </article>`;
}

function filterButton(id, label, count = null) {
  return `<button class="${activeFilter === id ? 'is-active' : ''}" data-mail-filter="${id}">${esc(label)}${count !== null ? `<i>${count}</i>` : ''}</button>`;
}

function inboxMarkup(career, manifest) {
  const summary = mailboxSummary(career);
  const items = careerInboxItems(career, { filter: activeFilter, query: searchQuery });
  if (!items.some(item => item.id === selectedMessageId)) selectedMessageId = items[0]?.id || null;
  const selected = items.find(item => item.id === selectedMessageId) || null;
  return `<div class="tl-mailbox-page">
    <header class="tl-mailbox-header">
      <div><small>COMUNICAÇÕES DO CLUBE</small><h1>Caixa de entrada</h1><p>Informação, decisões e consequências da sua carreira.</p></div>
      <div class="tl-mailbox-summary">
        <span><b>${summary.unread}</b><small>não lidas</small></span>
        <span class="required"><b>${summary.required}</b><small>exigem resposta</small></span>
        <button data-mail-read-all>Marcar todas como lidas</button>
      </div>
    </header>
    <section class="tl-mailbox-shell">
      <aside class="tl-mailbox-list-pane">
        <div class="tl-mailbox-tools">
          <label><span>⌕</span><input type="search" value="${esc(searchQuery)}" placeholder="Buscar mensagens" data-mail-search></label>
          <div class="tl-mailbox-filters">
            ${filterButton('all', 'Todas', summary.total)}
            ${filterButton('required', 'Decisões', summary.required)}
            ${filterButton('unread', 'Não lidas', summary.unread)}
          </div>
          <div class="tl-mailbox-categories">
            ${filterButton('medical', 'Médico')}${filterButton('transfer', 'Transferências')}${filterButton('player', 'Jogadores')}${filterButton('staff', 'Comissão')}
          </div>
        </div>
        <div class="tl-mailbox-list">${items.map(message => listItemMarkup(message, career, manifest)).join('') || '<div class="tl-mailbox-list-empty">Nenhuma mensagem neste filtro.</div>'}</div>
      </aside>
      <section class="tl-mailbox-detail-pane">${messageDetailMarkup(selected, career, manifest)}</section>
    </section>
  </div>`;
}

function wireFaceFallbacks(root) {
  root.querySelectorAll('img[data-mail-player-face]').forEach(image => {
    image.addEventListener('error', () => {
      if (!image.src.endsWith(PLAYER_FALLBACK_URL)) image.src = PLAYER_FALLBACK_URL;
    }, { once: true });
  });
}

async function persistAndRender(content, context) {
  context.career = await CareerRepository.save(context.career);
  content.innerHTML = inboxMarkup(context.career, context.manifest);
  bindInbox(content, context);
}

function bindInbox(content, context) {
  contexts.set(content, context);
  wireFaceFallbacks(content);
  content.querySelectorAll('[data-mail-filter]').forEach(button => {
    button.addEventListener('click', () => {
      activeFilter = button.dataset.mailFilter;
      selectedMessageId = null;
      content.innerHTML = inboxMarkup(context.career, context.manifest);
      bindInbox(content, context);
    });
  });
  content.querySelector('[data-mail-search]')?.addEventListener('input', event => {
    searchQuery = event.target.value;
    selectedMessageId = null;
    content.innerHTML = inboxMarkup(context.career, context.manifest);
    bindInbox(content, context);
    const search = content.querySelector('[data-mail-search]');
    search?.focus();
    search?.setSelectionRange(search.value.length, search.value.length);
  });
  content.querySelectorAll('[data-mail-id]').forEach(button => {
    button.addEventListener('click', async () => {
      selectedMessageId = button.dataset.mailId;
      window.__touchlineMailboxSelection = selectedMessageId;
      markMailboxRead(context.career, selectedMessageId, true);
      await persistAndRender(content, context);
    });
  });
  content.querySelector('[data-mail-read-all]')?.addEventListener('click', async () => {
    context.career.inbox.forEach(message => { message.read = true; });
    await persistAndRender(content, context);
  });
  content.querySelectorAll('[data-mail-action]').forEach(button => {
    button.addEventListener('click', async () => {
      const actionId = button.dataset.mailAction;
      if (['accept-offer', 'reject-offer'].includes(actionId)) {
        const label = actionId === 'accept-offer' ? 'aceitar esta proposta' : 'encerrar esta negociação';
        if (!window.confirm(`Confirmar: ${label}?`)) return;
      }
      const result = respondToMailboxMessage(context.career, button.dataset.mailMessage, actionId);
      context.career = result.career;
      await persistAndRender(content, context);
      if (result.route) window.location.hash = result.route;
    });
  });
}

async function installInboxPage() {
  const heading = [...document.querySelectorAll('.cp-title h1')].find(node => node.textContent?.trim() === 'Inbox');
  const content = heading?.closest('.cp-content');
  if (!content || content.querySelector('.tl-mailbox-page')) return;
  const selectedClub = legacyClubSelection() || 'MUN';
  const [stored, manifest] = await Promise.all([CareerRepository.load(), loadPlayerManifest()]);
  if (!content.isConnected || window.location.hash.replace('#', '') !== 'inbox') return;
  const career = normalizeCareer(stored, selectedClub);
  reconcileMailbox(career);
  selectedMessageId = window.__touchlineMailboxSelection || selectedMessageId || careerInboxItems(career)[0]?.id || null;
  if (selectedMessageId) markMailboxRead(career, selectedMessageId, true);
  const saved = await CareerRepository.save(career);
  content.classList.add('cp-content-mailbox');
  content.innerHTML = inboxMarkup(saved, manifest);
  bindInbox(content, { career: saved, manifest });
}

function homeMessageMarkup(message, career, manifest) {
  const meta = metaFor(message);
  return `<button class="tl-message ${!message.read ? 'is-unread' : ''} ${message.requiresResponse ? 'is-required' : ''}" data-home-mail-id="${esc(message.id)}">
    <i></i>${senderAvatar(message, manifest, true)}
    <span class="tl-message-copy"><small>${esc(message.sender)}<time>${esc(formatMessageDate(message, career.currentDate))}</time></small><b>${esc(message.subject)}</b><p>${esc(message.preview || message.body)}</p><em class="${meta.tone}">${esc(meta.label)}</em>${message.requiresResponse ? '<strong>DECISÃO</strong>' : ''}</span>
  </button>`;
}

async function enhanceHomeMailbox() {
  const list = document.querySelector('.tl-home-v2 .tl-message-list');
  if (!list || list.dataset.mailboxEnhanced === 'true') return;
  list.dataset.mailboxEnhanced = 'true';
  const selectedClub = legacyClubSelection() || 'MUN';
  const [stored, manifest] = await Promise.all([CareerRepository.load(), loadPlayerManifest()]);
  if (!list.isConnected) return;
  const career = normalizeCareer(stored, selectedClub);
  reconcileMailbox(career);
  const messages = careerInboxItems(career, { limit: 4 });
  const summary = mailboxSummary(career);
  list.innerHTML = messages.map(message => homeMessageMarkup(message, career, manifest)).join('');
  const title = list.closest('[data-slide="0"]')?.querySelector('.tl-inbox-title p');
  if (title) title.innerHTML = summary.required
    ? `<b>${summary.required}</b> decisões · ${summary.unread} não lidas`
    : `<b>${summary.unread}</b> não lidas · ${summary.total} mensagens`;
  const unreadTab = list.closest('[data-slide="0"]')?.querySelector('.tl-inbox-tabs span');
  if (unreadTab) unreadTab.innerHTML = `Não lidos <i>${summary.unread}</i>`;
  list.querySelectorAll('[data-home-mail-id]').forEach(button => {
    button.addEventListener('click', () => {
      window.__touchlineMailboxSelection = button.dataset.homeMailId;
      window.location.hash = 'inbox';
    });
  });
  wireFaceFallbacks(list);
}

function scheduleInstall() {
  if (installQueued) return;
  installQueued = true;
  queueMicrotask(async () => {
    installQueued = false;
    await Promise.all([installInboxPage(), enhanceHomeMailbox()]);
  });
}

if (app) {
  const observer = new MutationObserver(scheduleInstall);
  observer.observe(app, { childList: true, subtree: true });
  window.addEventListener('hashchange', scheduleInstall);
  scheduleInstall();
}

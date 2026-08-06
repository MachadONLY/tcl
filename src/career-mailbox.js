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
const SEARCH_DELAY_MS = 90;
const CONFIRM_RESET_MS = 2600;
const app = typeof document !== 'undefined' ? document.querySelector('#app') : null;
const contexts = new WeakMap();
let manifestPromise = null;
let installQueued = false;
let selectedMessageId = null;
let activeFilter = 'all';
let searchQuery = '';
let searchTimer = null;

const CATEGORY_META = Object.freeze({
  board: { label: 'Diretoria', icon: '◇', tone: 'board' },
  player: { label: 'Elenco', icon: '◉', tone: 'player' },
  medical: { label: 'Médico', icon: '+', tone: 'medical' },
  transfer: { label: 'Mercado', icon: '↔', tone: 'transfer' },
  staff: { label: 'Comissão', icon: '⌁', tone: 'staff' },
  match: { label: 'Partida', icon: '⚑', tone: 'match' },
  system: { label: 'Operações', icon: '✓', tone: 'system' },
  club: { label: 'Clube', icon: '•', tone: 'club' }
});

const SVG_ICONS = Object.freeze({
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.75 6.75h14.5v10.5H4.75z"/><path d="m5.25 7.5 6.75 5 6.75-5"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.75" cy="10.75" r="5.75"/><path d="m15.25 15.25 4 4"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.5 12.5 3.3 3.3 7.7-8"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6.5 5.5 5.5-5.5 5.5"/></svg>',
  alert: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5 20 19H4z"/><path d="M12 9v4.5M12 16.5h.01"/></svg>'
});

function icon(name, className = '') {
  return `<span class="tl-mail-icon ${esc(className)}">${SVG_ICONS[name] || ''}</span>`;
}

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

function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'GBP', notation: 'compact', maximumFractionDigits: 1
  }).format(Number(value || 0));
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

function priorityLabel(message, compact = false) {
  const compactClass = compact ? ' is-compact' : '';
  if (message.status === 'expired') return `<span class="tl-mail-status is-muted${compactClass}">Expirada</span>`;
  if (message.response) return `<span class="tl-mail-status is-resolved${compactClass}">${esc(message.response.label)}</span>`;
  if (message.requiresResponse) return `<span class="tl-mail-status is-required${compactClass}">${compact ? 'Decisão' : 'Resposta necessária'}</span>`;
  if (message.priority === 'urgent') return `<span class="tl-mail-status is-urgent${compactClass}">Urgente</span>`;
  if (!message.read) return `<span class="tl-mail-status is-new${compactClass}">Nova</span>`;
  return '';
}

function categoryChip(message, compact = false) {
  const meta = metaFor(message);
  return `<span class="tl-mail-category ${meta.tone} ${compact ? 'is-compact' : ''}"><i>${esc(meta.icon)}</i>${esc(meta.label)}</span>`;
}

function listItemMarkup(message, career, manifest) {
  return `<button class="tl-mail-row ${message.id === selectedMessageId ? 'is-selected' : ''} ${!message.read ? 'is-unread' : ''} ${message.requiresResponse ? 'is-required' : ''}" data-mail-id="${esc(message.id)}" aria-pressed="${message.id === selectedMessageId}">
    <span class="tl-mail-unread-dot"></span>
    ${senderAvatar(message, manifest, true)}
    <span class="tl-mail-row-copy">
      <small><b>${esc(message.sender)}</b><time>${esc(formatMessageDate(message, career.currentDate))}</time></small>
      <strong>${esc(message.subject)}</strong>
      <p>${esc(message.preview || message.body)}</p>
      <span>${categoryChip(message, true)}${priorityLabel(message, true)}</span>
    </span>
    ${icon('chevron', 'tl-mail-row-arrow')}
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
    <div class="tl-mail-player-identity"><small>JOGADOR RELACIONADO</small><h3>${esc(player.name)}</h3><p>${esc(player.position)} · ${esc(CLUB_BY_CODE.get(player.clubCode)?.shortName || player.clubCode)}</p></div>
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
      <div><small>VALOR</small><strong>${formatCurrency(offer.amount || data.amount)}</strong></div>
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
      <div><small>RESPONDER ATÉ</small><strong>${esc(String(data.deadline || '').split('-').reverse().join('/'))}</strong></div>
      <div class="wide"><small>IMPACTO</small><b>Sua resposta altera a moral e a confiança do jogador</b></div>
    </section>`;
  }
  if (message.kind === 'opponent-report') {
    const opponent = CLUB_BY_CODE.get(data.opponentCode);
    return `<section class="tl-mail-context-card staff">
      <div><small>ADVERSÁRIO</small><strong>${esc(opponent?.shortName || opponent?.name || 'Adversário')}</strong></div>
      <div class="wide"><small>PRÓXIMO PASSO</small><b>Levar o relatório para a preparação tática</b></div>
    </section>`;
  }
  return '';
}

function actionsMarkup(message) {
  if (message.response) {
    return `<div class="tl-mail-response">${icon('check')}<span><small>DECISÃO REGISTRADA</small><b>${esc(message.response.label)}</b></span></div>`;
  }
  if (!message.actions?.length) {
    return `<div class="tl-mail-response is-neutral">${icon('check')}<span><small>INFORMATIVO</small><b>Nenhuma ação necessária</b></span></div>`;
  }
  return `<div class="tl-mail-actions">
    <span class="tl-mail-actions-copy"><small>${message.requiresResponse ? 'DECISÃO PENDENTE' : 'PRÓXIMO PASSO'}</small><b>${message.requiresResponse ? 'Escolha uma resposta para continuar' : 'Ação disponível'}</b></span>
    <div>${message.actions.map(action =>
      `<button class="${esc(action.kind || 'secondary')}" data-mail-action="${esc(action.id)}" data-mail-message="${esc(message.id)}" data-mail-label="${esc(action.label)}">${esc(action.label)}</button>`
    ).join('')}</div>
  </div>`;
}

function messageDetailMarkup(message, career, manifest) {
  if (!message) {
    return `<div class="tl-mail-empty-detail">${icon('mail')}<h2>Nenhuma mensagem</h2><p>Altere o filtro ou limpe a busca para voltar à sua caixa postal.</p></div>`;
  }
  return `<article class="tl-mail-detail ${message.requiresResponse ? 'is-required' : ''}" data-mail-detail-id="${esc(message.id)}">
    <header class="tl-mail-detail-head">
      <div class="tl-mail-sender">${senderAvatar(message, manifest)}<span><small>${esc(message.senderRole)}</small><b>${esc(message.sender)}</b></span></div>
      <div class="tl-mail-detail-meta">${categoryChip(message)}<time>${esc(formatMessageDate(message, career.currentDate))}</time></div>
    </header>
    ${message.requiresResponse ? `<div class="tl-mail-required-banner">${icon('alert')}<span><b>Decisão pendente</b><small>Revise os dados abaixo e escolha uma resposta.</small></span></div>` : ''}
    <div class="tl-mail-detail-body">
      <div class="tl-mail-subject-line">${priorityLabel(message)}<h2>${esc(message.subject)}</h2></div>
      <p class="tl-mail-letter">${esc(message.body)}</p>
      <div class="tl-mail-detail-cards">
        ${playerCard(message, career, manifest)}
        ${contextCard(message, career)}
      </div>
    </div>
    <footer>${actionsMarkup(message)}</footer>
  </article>`;
}

function filterButton(id, label, count = null) {
  return `<button class="${activeFilter === id ? 'is-active' : ''}" data-mail-filter="${id}" aria-pressed="${activeFilter === id}">${esc(label)}${count !== null ? `<i>${count}</i>` : ''}</button>`;
}

function currentView(career) {
  const items = careerInboxItems(career, { filter: activeFilter, query: searchQuery });
  if (!items.some(item => item.id === selectedMessageId)) selectedMessageId = items[0]?.id || null;
  return {
    items,
    selected: items.find(item => item.id === selectedMessageId) || null,
    summary: mailboxSummary(career)
  };
}

function inboxMarkup(career, manifest) {
  const { items, selected, summary } = currentView(career);
  return `<div class="tl-mailbox-page">
    <header class="tl-mailbox-header">
      <div class="tl-mailbox-identity">
        <span class="tl-mailbox-mark">${icon('mail')}</span>
        <div><small>CLUBE</small><h1>Mailbox</h1><p>Mensagens, tarefas e decisões da sua carreira.</p></div>
      </div>
      <div class="tl-mailbox-summary">
        <span><b data-mail-summary-unread>${summary.unread}</b><small>não lidas</small></span>
        <span class="required"><b data-mail-summary-required>${summary.required}</b><small>decisões</small></span>
        <button data-mail-read-all>${icon('check')}<span>Marcar como lidas</span></button>
      </div>
    </header>
    <section class="tl-mailbox-shell">
      <aside class="tl-mailbox-list-pane">
        <div class="tl-mailbox-tools">
          <label>${icon('search')}<input type="search" value="${esc(searchQuery)}" placeholder="Buscar na Mailbox" data-mail-search autocomplete="off"></label>
          <div class="tl-mailbox-filters">
            ${filterButton('all', 'Todas', summary.total)}
            ${filterButton('required', 'Tarefas', summary.required)}
            ${filterButton('unread', 'Não lidas', summary.unread)}
          </div>
          <div class="tl-mailbox-categories">
            ${filterButton('medical', 'Médico')}${filterButton('transfer', 'Mercado')}${filterButton('player', 'Elenco')}${filterButton('staff', 'Comissão')}
          </div>
        </div>
        <div class="tl-mailbox-list" data-mail-list>${items.map(message => listItemMarkup(message, career, manifest)).join('') || '<div class="tl-mailbox-list-empty">Nenhuma mensagem neste filtro.</div>'}</div>
      </aside>
      <section class="tl-mailbox-detail-pane" data-mail-detail>${messageDetailMarkup(selected, career, manifest)}</section>
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

function animateDetail(detailPane) {
  const detail = detailPane?.firstElementChild;
  if (!detail) return;
  detail.classList.remove('is-entering');
  void detail.offsetWidth;
  detail.classList.add('is-entering');
  window.setTimeout(() => detail.classList.remove('is-entering'), 240);
}

function updateSummary(content, career) {
  const summary = mailboxSummary(career);
  content.querySelector('[data-mail-summary-unread]')?.replaceChildren(String(summary.unread));
  content.querySelector('[data-mail-summary-required]')?.replaceChildren(String(summary.required));
  content.querySelectorAll('[data-mail-filter]').forEach(button => {
    const count = button.querySelector('i');
    if (!count) return;
    const value = button.dataset.mailFilter === 'all'
      ? summary.total
      : button.dataset.mailFilter === 'required'
        ? summary.required
        : button.dataset.mailFilter === 'unread'
          ? summary.unread
          : null;
    if (value !== null) count.replaceChildren(String(value));
  });
}

function renderMessageDetail(content, context, { animate = true } = {}) {
  const detailPane = content.querySelector('[data-mail-detail]');
  if (!detailPane) return;
  const selected = careerInboxItems(context.career, { filter: activeFilter, query: searchQuery })
    .find(message => message.id === selectedMessageId) || null;
  detailPane.innerHTML = messageDetailMarkup(selected, context.career, context.manifest);
  wireFaceFallbacks(detailPane);
  if (animate) animateDetail(detailPane);
}

function renderListAndDetail(content, context, { preserveScroll = true, animateDetailPane = true } = {}) {
  const list = content.querySelector('[data-mail-list]');
  const detailPane = content.querySelector('[data-mail-detail]');
  if (!list || !detailPane) return;
  const previousScroll = list.scrollTop;
  const { items, selected } = currentView(context.career);
  list.innerHTML = items.map(message => listItemMarkup(message, context.career, context.manifest)).join('') || '<div class="tl-mailbox-list-empty">Nenhuma mensagem neste filtro.</div>';
  detailPane.innerHTML = messageDetailMarkup(selected, context.career, context.manifest);
  content.querySelectorAll('[data-mail-filter]').forEach(button => {
    const active = button.dataset.mailFilter === activeFilter;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  wireFaceFallbacks(list);
  wireFaceFallbacks(detailPane);
  if (preserveScroll) requestAnimationFrame(() => { list.scrollTop = previousScroll; });
  if (animateDetailPane) animateDetail(detailPane);
}

async function saveContext(context) {
  context.career = await CareerRepository.save(context.career);
  return context.career;
}

function selectMessage(content, context, messageId) {
  selectedMessageId = messageId;
  window.__touchlineMailboxSelection = selectedMessageId;
  markMailboxRead(context.career, selectedMessageId, true);
  content.querySelectorAll('[data-mail-id]').forEach(row => {
    const selected = row.dataset.mailId === selectedMessageId;
    row.classList.toggle('is-selected', selected);
    row.classList.toggle('is-unread', selected ? false : row.classList.contains('is-unread'));
    row.setAttribute('aria-pressed', String(selected));
  });
  renderMessageDetail(content, context);
  updateSummary(content, context.career);
  void saveContext(context);
}

function armConfirmation(button) {
  if (button.dataset.mailConfirming === 'true') return true;
  const actionId = button.dataset.mailAction;
  const confirmationLabel = actionId === 'accept-offer' ? 'Confirmar aceite' : 'Confirmar recusa';
  button.dataset.mailConfirming = 'true';
  button.dataset.mailOriginalLabel = button.textContent || button.dataset.mailLabel || '';
  button.classList.add('is-confirming');
  button.replaceChildren(confirmationLabel);
  window.setTimeout(() => {
    if (!button.isConnected || button.dataset.mailConfirming !== 'true') return;
    button.dataset.mailConfirming = 'false';
    button.classList.remove('is-confirming');
    button.replaceChildren(button.dataset.mailOriginalLabel || button.dataset.mailLabel || 'Confirmar');
  }, CONFIRM_RESET_MS);
  return false;
}

async function executeAction(content, context, button) {
  const actionId = button.dataset.mailAction;
  if (['accept-offer', 'reject-offer'].includes(actionId) && !armConfirmation(button)) return;
  button.disabled = true;
  button.classList.add('is-loading');
  const result = respondToMailboxMessage(context.career, button.dataset.mailMessage, actionId);
  context.career = result.career;
  await saveContext(context);
  renderListAndDetail(content, context, { preserveScroll: true });
  updateSummary(content, context.career);
  if (result.route) window.location.hash = result.route;
}

function bindInbox(content, context) {
  contexts.set(content, context);
  wireFaceFallbacks(content);
  content.addEventListener('click', event => {
    const filter = event.target.closest('[data-mail-filter]');
    if (filter) {
      activeFilter = filter.dataset.mailFilter;
      selectedMessageId = null;
      renderListAndDetail(content, context, { preserveScroll: false });
      return;
    }

    const row = event.target.closest('[data-mail-id]');
    if (row) {
      selectMessage(content, context, row.dataset.mailId);
      return;
    }

    if (event.target.closest('[data-mail-read-all]')) {
      context.career.inbox.forEach(message => { message.read = true; });
      void saveContext(context).then(() => {
        renderListAndDetail(content, context, { preserveScroll: true, animateDetailPane: false });
        updateSummary(content, context.career);
      });
      return;
    }

    const action = event.target.closest('[data-mail-action]');
    if (action && !action.disabled) void executeAction(content, context, action);
  });

  content.addEventListener('input', event => {
    if (!event.target.matches('[data-mail-search]')) return;
    searchQuery = event.target.value;
    window.clearTimeout(searchTimer);
    searchTimer = window.setTimeout(() => {
      selectedMessageId = null;
      renderListAndDetail(content, context, { preserveScroll: false, animateDetailPane: false });
    }, SEARCH_DELAY_MS);
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
  const slide = list.closest('[data-slide="0"]');
  slide?.querySelector('.tl-inbox-title h3')?.replaceChildren('Mailbox');
  const title = slide?.querySelector('.tl-inbox-title p');
  if (title) title.innerHTML = summary.required
    ? `<b>${summary.required}</b> decisões · ${summary.unread} não lidas`
    : `<b>${summary.unread}</b> não lidas · ${summary.total} mensagens`;
  const unreadTab = slide?.querySelector('.tl-inbox-tabs span');
  if (unreadTab) unreadTab.innerHTML = `Não lidas <i>${summary.unread}</i>`;
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

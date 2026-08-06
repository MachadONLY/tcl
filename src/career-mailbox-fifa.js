import './career-mailbox-fifa.css';
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

const SCREEN_ID = 'touchline-fifa-mailbox';
const PLAYER_MANIFEST_URL = '/assets/players/2026-27/manifest.json';
const PLAYER_FALLBACK_URL = '/assets/players/player-placeholder.svg';
const CONFIRM_RESET_MS = 2400;

let career = null;
let manifest = { players: {} };
let manifestPromise = null;
let selectedMessageId = null;
let activeTab = 'emails';
let mountQueued = false;
let homeQueued = false;

const ICONS = Object.freeze({
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5h16v11H4z"/><path d="m4.5 7 7.5 5.5L19.5 7"/></svg>',
  openMail: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3.5 10 8.5-5 8.5 5v9.5h-17z"/><path d="m4 10 8 5.5 8-5.5"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8v11h10V8M5.5 6h13M9 6V4.5h6V6"/></svg>',
  restore: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8H3.5V5.5"/><path d="M4 8a8 8 0 1 1-1 7"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5.5 12.5 4 4 9-9"/></svg>',
  alert: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6.5v7M12 17.5h.01"/></svg>'
});

function icon(name) {
  return `<span class="fmb-icon">${ICONS[name] || ICONS.mail}</span>`;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function clubFor(code) {
  return CLUB_BY_CODE.get(code) || CLUB_BY_CODE.values().next().value;
}

function loadPlayerManifest() {
  if (manifestPromise) return manifestPromise;
  manifestPromise = fetch(`${PLAYER_MANIFEST_URL}?v=10`, { cache: 'no-store' })
    .then(response => response.ok ? response.json() : { players: {} })
    .then(payload => payload?.players ? payload : { players: {} })
    .catch(() => ({ players: {} }));
  return manifestPromise;
}

function playerPortrait(player) {
  const record = manifest?.players?.[player?.id];
  return record?.playerId === player?.id && record?.clubCode === player?.clubCode && record?.localPath
    ? record.localPath
    : PLAYER_FALLBACK_URL;
}

function crestPath(code) {
  return `/assets/clubs/2026-27/${String(code || '').toLowerCase()}/crest.png`;
}

function dateValue(message) {
  return Date.parse(message?.createdAt || `${message?.date || '1970-01-01'}T12:00:00Z`) || 0;
}

function sortMessages(messages) {
  return [...messages].sort((left, right) => dateValue(right) - dateValue(left) || String(left.subject).localeCompare(String(right.subject), 'pt-BR'));
}

function activeMessages() {
  if (!career) return [];
  if (activeTab === 'archive') return sortMessages((career.inbox || []).filter(message => message.archived));
  const active = careerInboxItems(career);
  if (activeTab === 'players') return active.filter(message => message.category === 'player');
  return active;
}

function selectDefaultMessage() {
  const messages = activeMessages();
  if (!messages.some(message => message.id === selectedMessageId)) selectedMessageId = messages[0]?.id || null;
  return messages;
}

function selectedMessage(messages = activeMessages()) {
  return messages.find(message => message.id === selectedMessageId) || null;
}

function formatShortDate(message) {
  if (message.date === career?.currentDate) return 'Hoje';
  const [year, month, day] = String(message.date || '').split('-').map(Number);
  if (!year || !month || !day) return String(message.date || '');
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' })
    .format(new Date(Date.UTC(year, month - 1, day)));
}

function managerName() {
  return career?.managerName || career?.profile?.managerName || 'Gabriel Machado';
}

function senderMark(message) {
  const player = PLAYER_BY_ID.get(message?.entity?.playerId);
  if (player) return `<img src="${esc(playerPortrait(player))}" alt="${esc(player.name)}" data-fmb-player-face>`;
  return `<span>${esc(String(message?.sender || 'TL').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase())}</span>`;
}

function messageState(message) {
  if (message.archived) return '<small class="is-archived">ARQUIVADA</small>';
  if (message.requiresResponse) return '<small class="is-task">AÇÃO</small>';
  if (message.response) return `<small class="is-done">${icon('check')}RESOLVIDA</small>`;
  return '';
}

function listRowMarkup(message) {
  const selected = message.id === selectedMessageId;
  return `<button type="button" class="fmb-row ${selected ? 'is-selected' : ''} ${message.read ? 'is-read' : 'is-unread'}" data-fmb-message="${esc(message.id)}" aria-pressed="${selected}">
    <span class="fmb-envelope">${icon(message.read ? 'openMail' : 'mail')}</span>
    <span class="fmb-row-copy">
      <span class="fmb-row-top"><b>${esc(message.sender)}</b><time>${esc(formatShortDate(message))}</time></span>
      <strong>${esc(message.subject)}</strong>
      <span class="fmb-row-bottom"><em>${esc(message.senderRole || 'Clube')}</em>${messageState(message)}</span>
    </span>
  </button>`;
}

function tabMarkup(id, label, count) {
  return `<button type="button" class="${activeTab === id ? 'is-active' : ''}" data-fmb-tab="${id}" aria-selected="${activeTab === id}">${esc(label)}${count ? `<b>${count}</b>` : ''}</button>`;
}

function contextLineMarkup(message) {
  const data = message?.data || {};
  const player = PLAYER_BY_ID.get(message?.entity?.playerId);
  const state = player ? career?.playerState?.[player.id] || {} : null;
  const fragments = [];

  if (player) {
    fragments.push(`<span class="fmb-inline-player"><img src="${esc(playerPortrait(player))}" alt="${esc(player.name)}" data-fmb-player-face><b>${esc(player.name)}</b><small>${esc(player.position)} · OVR ${player.rating} · Condição ${Math.round(Number(state?.condition || 100))}% · Moral ${Math.round(Number(state?.morale || 75))}</small></span>`);
  }

  if (message.kind === 'transfer-offer') {
    const offer = career?.transferOffers?.[data.offerId] || data;
    const amount = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'GBP', notation: 'compact', maximumFractionDigits: 1 }).format(Number(offer.amount || 0));
    fragments.push(`<span><b>Oferta</b><small>${esc(amount)} · ${esc(offer.buyer || message.sender)} · prazo ${esc(String(offer.deadline || '').split('-').reverse().join('/'))}</small></span>`);
  } else if (message.kind === 'medical-load') {
    const names = (data.playerIds || []).map(id => PLAYER_BY_ID.get(id)?.name).filter(Boolean);
    fragments.push(`<span><b>Recomendação médica</b><small>${esc(names.join(', '))} · reduzir carga e priorizar recuperação</small></span>`);
  } else if (message.kind === 'injury') {
    fragments.push(`<span><b>Previsão de retorno</b><small>${esc(String(data.returnDate || '').split('-').reverse().join('/'))} · ${Number(data.days || 0)} dias</small></span>`);
  } else if (message.kind === 'player-minutes') {
    fragments.push(`<span><b>Prazo para resposta</b><small>${esc(String(data.deadline || '').split('-').reverse().join('/'))}</small></span>`);
  } else if (message.kind === 'opponent-report') {
    const opponent = clubFor(data.opponentCode);
    fragments.push(`<span><b>Próximo adversário</b><small>${esc(opponent?.name || 'Adversário')}</small></span>`);
  }

  return fragments.length ? `<div class="fmb-inline-context">${fragments.join('')}</div>` : '';
}

function actionMarkup(message) {
  if (message.archived) return `<button type="button" class="fmb-action is-secondary" data-fmb-restore="${esc(message.id)}">${icon('restore')} Restaurar mensagem</button>`;
  if (message.response) return `<span class="fmb-decision">${icon('check')} ${esc(message.response.label || 'Decisão registrada')}</span>`;
  if (!message.actions?.length) return '<span class="fmb-decision is-muted">Nenhuma ação necessária</span>';
  return message.actions.map(action => `<button type="button" class="fmb-action ${action.kind === 'primary' ? 'is-primary' : action.kind === 'danger' ? 'is-danger' : 'is-secondary'}" data-fmb-action="${esc(action.id)}" data-fmb-message-id="${esc(message.id)}" data-fmb-label="${esc(action.label)}"><span data-fmb-button-label>${esc(action.label)}</span></button>`).join('');
}

function readerMarkup(message) {
  if (!message) return `<div class="fmb-empty"><span>${icon('mail')}</span><h2>Nenhuma mensagem</h2><p>Escolha outra categoria ou aguarde novas comunicações do clube.</p></div>`;
  const greeting = message.category === 'player' ? 'Mister,' : `Olá, ${esc(managerName().split(' ')[0])}.`;
  return `<article class="fmb-reader-card" data-fmb-reader-card>
    <header class="fmb-fields">
      <dl>
        <div><dt>Data</dt><dd>${esc(formatShortDate(message))}</dd></div>
        <div><dt>De</dt><dd>${esc(message.sender)}</dd></div>
        <div><dt>Para</dt><dd>${esc(managerName())}</dd></div>
        <div><dt>Assunto</dt><dd>${esc(message.subject)}</dd></div>
      </dl>
      <div class="fmb-reader-tools">
        ${!message.archived ? `<button type="button" data-fmb-toggle-read="${esc(message.id)}">${icon(message.read ? 'mail' : 'openMail')} ${message.read ? 'Marcar não lida' : 'Marcar lida'}</button>` : ''}
        ${!message.archived ? `<button type="button" class="is-delete" data-fmb-delete="${esc(message.id)}" data-fmb-label="Excluir" data-fmb-confirm-label="Confirmar exclusão">${icon('trash')}<span data-fmb-button-label>Excluir</span></button>` : ''}
      </div>
    </header>
    <div class="fmb-letter">
      <p class="fmb-greeting">${greeting}</p>
      <p>${esc(message.body)}</p>
      ${contextLineMarkup(message)}
      <p class="fmb-signature">Atenciosamente,<br><b>${esc(message.sender)}</b></p>
    </div>
    <footer class="fmb-actions">${actionMarkup(message)}</footer>
  </article>`;
}

function screenMarkup() {
  const summary = mailboxSummary(career);
  const messages = selectDefaultMessage();
  const archivedCount = (career.inbox || []).filter(message => message.archived).length;
  const selected = selectedMessage(messages);
  const club = clubFor(career.clubCode);
  return `<section id="${SCREEN_ID}" class="fmb-screen">
    <div class="fmb-bg" style="--fmb-stadium:url('/assets/clubs/2026-27/${String(career.clubCode).toLowerCase()}/stadium.webp')"></div>
    <header class="fmb-top">
      <div class="fmb-club"><img src="${crestPath(career.clubCode)}" alt="${esc(club?.name || career.clubCode)}"><span><b>${esc(club?.name || career.clubCode)}</b><small>${esc(managerName())}</small></span></div>
      <div class="fmb-title"><small>SEASON ${esc(career.seasonLabel || '2026/27')}</small><h1>Mailbox</h1></div>
      <div class="fmb-summary"><span><b>${summary.unread}</b> não lidas</span><span><b>${summary.required}</b> ações</span><button type="button" data-fmb-read-all>${icon('check')} Ler todas</button></div>
    </header>
    <nav class="fmb-tabs" role="tablist">
      ${tabMarkup('emails', 'Emails', summary.total)}
      ${tabMarkup('players', 'Player Conversations', careerInboxItems(career, { filter: 'player' }).length)}
      ${tabMarkup('archive', 'Message Archive', archivedCount)}
    </nav>
    <div class="fmb-window">
      <aside class="fmb-list-pane">
        <div class="fmb-list-head"><span>Remetente / Assunto</span><span>Data</span></div>
        <div class="fmb-list" data-fmb-list>${messages.map(listRowMarkup).join('') || '<div class="fmb-list-empty">Nenhuma mensagem nesta categoria.</div>'}</div>
      </aside>
      <main class="fmb-reader" data-fmb-reader>${readerMarkup(selected)}</main>
    </div>
    <div class="fmb-toast" role="status" aria-live="polite"></div>
  </section>`;
}

function installImageFallbacks(root) {
  root.querySelectorAll('img[data-fmb-player-face]').forEach(image => image.addEventListener('error', () => {
    if (!image.src.endsWith(PLAYER_FALLBACK_URL)) image.src = PLAYER_FALLBACK_URL;
  }, { once: true }));
}

function renderScreen() {
  if (!career || location.hash !== '#inbox') return;
  document.getElementById(SCREEN_ID)?.remove();
  document.body.insertAdjacentHTML('beforeend', screenMarkup());
  installImageFallbacks(document.getElementById(SCREEN_ID));
}

function renderPanes({ preserveScroll = true, animate = true } = {}) {
  const screen = document.getElementById(SCREEN_ID);
  if (!screen || !career) return;
  const list = screen.querySelector('[data-fmb-list]');
  const reader = screen.querySelector('[data-fmb-reader]');
  if (!list || !reader) return;
  const scrollTop = list.scrollTop;
  const messages = selectDefaultMessage();
  list.innerHTML = messages.map(listRowMarkup).join('') || '<div class="fmb-list-empty">Nenhuma mensagem nesta categoria.</div>';
  reader.innerHTML = readerMarkup(selectedMessage(messages));
  screen.querySelectorAll('[data-fmb-tab]').forEach(button => {
    const active = button.dataset.fmbTab === activeTab;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  });
  installImageFallbacks(screen);
  if (preserveScroll) requestAnimationFrame(() => { list.scrollTop = scrollTop; });
  if (animate) {
    const card = reader.querySelector('[data-fmb-reader-card]');
    card?.classList.add('is-entering');
    window.setTimeout(() => card?.classList.remove('is-entering'), 180);
  }
}

function showToast(text) {
  const toast = document.querySelector(`#${SCREEN_ID} .fmb-toast`);
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add('is-visible');
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toast.classList.remove('is-visible'), 1600);
}

async function saveCareer() {
  career = await CareerRepository.save(career);
}

function armConfirmation(button) {
  if (button.dataset.fmbConfirming === 'true') return true;
  button.dataset.fmbConfirming = 'true';
  button.classList.add('is-confirming');
  button.querySelector('[data-fmb-button-label]')?.replaceChildren(button.dataset.fmbConfirmLabel || 'Confirmar');
  window.setTimeout(() => {
    if (!button.isConnected || button.dataset.fmbConfirming !== 'true') return;
    button.dataset.fmbConfirming = 'false';
    button.classList.remove('is-confirming');
    button.querySelector('[data-fmb-button-label]')?.replaceChildren(button.dataset.fmbLabel || 'Confirmar');
  }, CONFIRM_RESET_MS);
  return false;
}

async function chooseMessage(id) {
  selectedMessageId = id;
  window.__touchlineMailboxSelection = id;
  const canonical = career.inbox.find(message => message.id === id);
  if (canonical && !canonical.archived) markMailboxRead(career, id, true);
  await saveCareer();
  renderPanes({ preserveScroll: true, animate: true });
}

async function executeAction(button) {
  const actionId = button.dataset.fmbAction;
  if (['accept-offer', 'reject-offer'].includes(actionId) && !armConfirmation(button)) return;
  button.disabled = true;
  const result = respondToMailboxMessage(career, button.dataset.fmbMessageId, actionId);
  career = result.career;
  await saveCareer();
  renderPanes({ preserveScroll: true, animate: true });
  if (result.route) location.hash = result.route;
}

async function deleteMessage(button) {
  if (!armConfirmation(button)) return;
  const message = career.inbox.find(item => item.id === button.dataset.fmbDelete);
  if (!message) return;
  message.archived = true;
  message.read = true;
  message.requiresResponse = false;
  message.status = 'dismissed';
  message.response = { actionId: 'dismissed', label: 'Mensagem arquivada', date: career.currentDate };
  const offer = career.transferOffers?.[message.data?.offerId];
  if (offer && ['received', 'countered'].includes(offer.status)) offer.status = 'ignored';
  selectedMessageId = null;
  await saveCareer();
  renderScreen();
  showToast('Mensagem movida para o arquivo');
}

async function restoreMessage(id) {
  const message = career.inbox.find(item => item.id === id);
  if (!message) return;
  message.archived = false;
  message.read = true;
  if (message.status === 'dismissed') message.status = 'open';
  selectedMessageId = null;
  await saveCareer();
  renderScreen();
  showToast('Mensagem restaurada');
}

async function toggleRead(id) {
  const message = career.inbox.find(item => item.id === id);
  if (!message) return;
  markMailboxRead(career, id, !message.read);
  await saveCareer();
  renderPanes({ preserveScroll: true, animate: false });
}

async function readAll() {
  for (const message of career.inbox || []) if (!message.archived) message.read = true;
  await saveCareer();
  renderScreen();
}

function onClick(event) {
  const screen = event.target.closest(`#${SCREEN_ID}`);
  if (!screen) return;
  const tab = event.target.closest('[data-fmb-tab]');
  if (tab) {
    activeTab = tab.dataset.fmbTab;
    selectedMessageId = null;
    renderPanes({ preserveScroll: false, animate: false });
    return;
  }
  const row = event.target.closest('[data-fmb-message]');
  if (row) { void chooseMessage(row.dataset.fmbMessage); return; }
  const action = event.target.closest('[data-fmb-action]');
  if (action && !action.disabled) { void executeAction(action); return; }
  const deleteButton = event.target.closest('[data-fmb-delete]');
  if (deleteButton) { void deleteMessage(deleteButton); return; }
  const restore = event.target.closest('[data-fmb-restore]');
  if (restore) { void restoreMessage(restore.dataset.fmbRestore); return; }
  const toggle = event.target.closest('[data-fmb-toggle-read]');
  if (toggle) { void toggleRead(toggle.dataset.fmbToggleRead); return; }
  if (event.target.closest('[data-fmb-read-all]')) void readAll();
}

function onKeydown(event) {
  if (!document.getElementById(SCREEN_ID)) return;
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    const messages = activeMessages();
    if (!messages.length) return;
    let index = messages.findIndex(message => message.id === selectedMessageId);
    if (index < 0) index = 0;
    index = Math.max(0, Math.min(messages.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)));
    event.preventDefault();
    void chooseMessage(messages[index].id);
    document.querySelector(`[data-fmb-message="${CSS.escape(messages[index].id)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function removeScreen() {
  document.getElementById(SCREEN_ID)?.remove();
}

async function enhanceHomeMailbox() {
  const list = document.querySelector('.tl-home-v2 .tl-message-list');
  if (!list || list.dataset.fifaMailboxEnhanced === 'true') return;
  list.dataset.fifaMailboxEnhanced = 'true';
  const selectedClub = legacyClubSelection();
  if (!selectedClub) return;
  const [stored, playerManifest] = await Promise.all([CareerRepository.load(), loadPlayerManifest()]);
  if (!list.isConnected) return;
  const homeCareer = normalizeCareer(stored, selectedClub);
  reconcileMailbox(homeCareer);
  const previousCareer = career;
  const previousManifest = manifest;
  career = homeCareer;
  manifest = playerManifest;
  const messages = careerInboxItems(homeCareer, { limit: 4 });
  list.innerHTML = messages.map(message => `<button class="tl-message ${message.read ? '' : 'is-unread'}" data-home-fmb-id="${esc(message.id)}"><i></i><span class="tl-message-copy"><small>${esc(message.sender)}<time>${esc(formatShortDate(message))}</time></small><b>${esc(message.subject)}</b><p>${esc(message.preview || message.body)}</p></span></button>`).join('');
  list.querySelectorAll('[data-home-fmb-id]').forEach(button => button.addEventListener('click', () => {
    window.__touchlineMailboxSelection = button.dataset.homeFmbId;
    location.hash = '#inbox';
  }));
  career = previousCareer;
  manifest = previousManifest;
}

function queueHomeEnhancement() {
  if (homeQueued) return;
  homeQueued = true;
  queueMicrotask(async () => {
    homeQueued = false;
    if (location.hash !== '#inbox') await enhanceHomeMailbox();
  });
}

function queueMount() {
  if (mountQueued) return;
  mountQueued = true;
  queueMicrotask(async () => {
    mountQueued = false;
    if (location.hash !== '#inbox') { removeScreen(); queueHomeEnhancement(); return; }
    const selectedClub = legacyClubSelection();
    if (!selectedClub) return;
    const [stored, playerManifest] = await Promise.all([CareerRepository.load(), loadPlayerManifest()]);
    if (location.hash !== '#inbox') return;
    career = normalizeCareer(stored, selectedClub);
    manifest = playerManifest;
    reconcileMailbox(career);
    selectedMessageId = window.__touchlineMailboxSelection || selectedMessageId || careerInboxItems(career)[0]?.id || null;
    if (selectedMessageId) markMailboxRead(career, selectedMessageId, true);
    await saveCareer();
    renderScreen();
  });
}

function start() {
  const app = document.querySelector('#app');
  if (app) new MutationObserver(() => { queueMount(); queueHomeEnhancement(); }).observe(app, { childList: true, subtree: true });
  window.addEventListener('hashchange', queueMount);
  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKeydown);
  queueMount();
  queueHomeEnhancement();
}

start();

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

const SCREEN_ID = 'touchline-career-mailbox';
const PLAYER_MANIFEST_URL = '/assets/players/2026-27/manifest.json';
const PLAYER_FALLBACK_URL = '/assets/players/player-placeholder.svg';
const SEARCH_DELAY_MS = 100;
const CONFIRM_RESET_MS = 2600;

let career = null;
let manifest = { players: {} };
let manifestPromise = null;
let selectedMessageId = null;
let activeFilter = 'all';
let searchQuery = '';
let activeClubCode = null;
let mountPending = false;
let searchTimer = null;
let homeEnhancePending = false;

const CATEGORY_META = Object.freeze({
  board: { label: 'BOARD', icon: '◇', tone: 'board' },
  player: { label: 'SQUAD', icon: '◉', tone: 'player' },
  medical: { label: 'MEDICAL', icon: '+', tone: 'medical' },
  transfer: { label: 'TRANSFER', icon: '↔', tone: 'transfer' },
  staff: { label: 'STAFF', icon: '⌁', tone: 'staff' },
  match: { label: 'MATCH', icon: '⚑', tone: 'match' },
  system: { label: 'OPERATIONS', icon: '✓', tone: 'system' },
  club: { label: 'CLUB', icon: '•', tone: 'club' }
});

const ICONS = Object.freeze({
  mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.75 6.75h14.5v10.5H4.75z"/><path d="m5.25 7.5 6.75 5 6.75-5"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.75" cy="10.75" r="5.75"/><path d="m15.25 15.25 4 4"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.5 12.5 3.3 3.3 7.7-8"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7.25h14v11H5z"/><path d="M8 4.75v4M16 4.75v4M5 10.25h14"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9.5 6.5 5.5 5.5-5.5 5.5"/></svg>',
  alert: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7.25v6.25M12 17.25h.01"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.25 8.25v10h9.5v-10M5.75 6.25h12.5M9.25 6.25V4.75h5.5v1.5M9.75 10.25v5.5M14.25 10.25v5.5"/></svg>',
  unread: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.75 7h14.5v10H4.75z"/><path d="m5.25 7.75 6.75 4.75 6.75-4.75"/><circle cx="18" cy="6" r="2.25"/></svg>',
  filter: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M8 12h8M10.5 17h3"/></svg>'
});

function icon(name) {
  return `<span class="tcm-icon">${ICONS[name] || ICONS.mail}</span>`;
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function loadPlayerManifest() {
  if (manifestPromise) return manifestPromise;
  manifestPromise = fetch(`${PLAYER_MANIFEST_URL}?v=10`, { cache: 'no-store' })
    .then(response => response.ok ? response.json() : { players: {} })
    .then(payload => payload?.players ? payload : { players: {} })
    .catch(() => ({ players: {} }));
  return manifestPromise;
}

function clubFor(code) {
  return CLUB_BY_CODE.get(code) || CLUB_BY_CODE.values().next().value;
}

function playerPortrait(player) {
  const record = manifest?.players?.[player?.id];
  return record?.playerId === player?.id && record?.clubCode === player?.clubCode && record?.localPath
    ? record.localPath
    : PLAYER_FALLBACK_URL;
}

function crestMarkup(code, className = '') {
  const club = clubFor(code);
  const slug = String(code || '').toLowerCase();
  const primary = club?.crest || `/assets/clubs/2026-27/${slug}/crest.svg`;
  const fallback = `/assets/clubs/2026-27/${slug}/crest.png`;
  return `<img class="${className}" src="${esc(primary)}" data-mail-image-fallback="${esc(fallback)}" alt="${esc(club?.name || code)} crest">`;
}

function boardSegments() {
  const filled = Math.max(0, Math.min(4, Math.round((Number(career?.boardConfidence) || 0) / 25)));
  return Array.from({ length: 4 }, (_, index) => `<i class="${index < filled ? 'is-filled' : ''}"></i>`).join('');
}

function formatMessageDate(message) {
  if (message.date === career?.currentDate) return 'TODAY';
  const [year, month, day] = String(message.date || '').split('-').map(Number);
  if (!year || !month || !day) return String(message.date || '').toUpperCase();
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC', day: '2-digit', month: 'short'
  }).format(new Date(Date.UTC(year, month - 1, day))).toUpperCase();
}

function fullMessageDate(message) {
  const [year, month, day] = String(message.date || '').split('-').map(Number);
  if (!year || !month || !day) return String(message.date || '');
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric'
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function metaFor(message) {
  return CATEGORY_META[message?.category] || CATEGORY_META.club;
}

function initials(value) {
  return String(value || 'TL').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
}

function senderAvatar(message, compact = false) {
  const player = PLAYER_BY_ID.get(message?.entity?.playerId);
  const meta = metaFor(message);
  if (player) {
    return `<span class="tcm-avatar ${compact ? 'is-compact' : ''} has-photo ${meta.tone}">
      <img src="${esc(playerPortrait(player))}" alt="${esc(player.name)}" data-mail-player-face>
      <i>${esc(meta.icon)}</i>
    </span>`;
  }
  return `<span class="tcm-avatar ${compact ? 'is-compact' : ''} ${meta.tone}">
    <b>${esc(message?.entity?.initials || initials(message?.sender))}</b><i>${esc(meta.icon)}</i>
  </span>`;
}

function compactStateMarkup(message) {
  if (message?.requiresResponse) return `<span class="tcm-row-state is-task">${icon('alert')}<span>TASK</span></span>`;
  if (message?.response) return `<span class="tcm-row-state is-resolved">${icon('check')}<span>DONE</span></span>`;
  if (!message?.read) return '<span class="tcm-row-state is-new">NEW</span>';
  return '';
}

function listItemMarkup(message) {
  const selected = message.id === selectedMessageId;
  const meta = metaFor(message);
  return `<button type="button" class="tcm-message-row ${selected ? 'is-selected' : ''} ${!message.read ? 'is-unread' : 'is-read'} ${message.requiresResponse ? 'is-required' : ''} ${message.response ? 'is-resolved' : ''}" data-mail-id="${esc(message.id)}" aria-pressed="${selected}">
    <span class="tcm-message-signal" aria-hidden="true"></span>
    ${senderAvatar(message, true)}
    <span class="tcm-message-copy">
      <span class="tcm-message-meta"><b>${esc(message.sender)}</b><time>${esc(formatMessageDate(message))}</time></span>
      <strong>${esc(message.subject)}</strong>
      <p>${esc(message.preview || message.body)}</p>
      <span class="tcm-message-foot"><small>${esc(meta.label)}</small>${compactStateMarkup(message)}</span>
    </span>
    <span class="tcm-message-arrow">${icon('arrow')}</span>
  </button>`;
}

function playerContextMarkup(message) {
  const player = PLAYER_BY_ID.get(message?.entity?.playerId);
  if (!player) return '';
  const state = career?.playerState?.[player.id] || {};
  const injury = career?.injuries?.[player.id];
  const status = injury?.active ? 'Unavailable' : state.departurePending ? 'Departure agreed' : 'Available';
  return `<section class="tcm-player-context">
    <div class="tcm-player-head">
      <span class="tcm-player-photo"><img src="${esc(playerPortrait(player))}" alt="${esc(player.name)}" data-mail-player-face></span>
      <span><small>PLAYER</small><h3>${esc(player.name)}</h3><p>${esc(player.position)} · ${esc(clubFor(player.clubCode)?.shortName || player.clubCode)}</p></span>
    </div>
    <dl>
      <div><dt>OVR</dt><dd>${player.rating}</dd></div>
      <div><dt>FIT</dt><dd>${Math.round(Number(state.condition || 100))}%</dd></div>
      <div><dt>MORALE</dt><dd>${Math.round(Number(state.morale || 75))}</dd></div>
      <div><dt>STATUS</dt><dd>${esc(status)}</dd></div>
    </dl>
  </section>`;
}

function contextMarkup(message) {
  const data = message?.data || {};
  const player = playerContextMarkup(message);
  let specific = '';
  if (message?.kind === 'transfer-offer') {
    const offer = career?.transferOffers?.[data.offerId] || data;
    const amount = new Intl.NumberFormat('en-GB', {
      style: 'currency', currency: 'GBP', notation: 'compact', maximumFractionDigits: 1
    }).format(Number(offer.amount || data.amount || 0));
    specific = `<section class="tcm-fact-panel transfer"><small>TRANSFER OFFER</small><strong>${esc(amount)}</strong><dl><div><dt>CLUB</dt><dd>${esc(offer.buyer || data.buyer || message.sender)}</dd></div><div><dt>DEADLINE</dt><dd>${esc(String(offer.deadline || data.deadline || '').split('-').reverse().join('/'))}</dd></div></dl></section>`;
  } else if (message?.kind === 'injury') {
    specific = `<section class="tcm-fact-panel medical"><small>MEDICAL REPORT</small><strong>${esc(data.type || 'Under assessment')}</strong><dl><div><dt>RECOVERY</dt><dd>${Number(data.days || 0)} days</dd></div><div><dt>RETURN</dt><dd>${esc(String(data.returnDate || '').split('-').reverse().join('/'))}</dd></div></dl></section>`;
  } else if (message?.kind === 'medical-load') {
    const players = (data.playerIds || []).map(id => PLAYER_BY_ID.get(id)).filter(Boolean);
    specific = `<section class="tcm-fact-panel medical"><small>WORKLOAD</small><strong>${players.length} PLAYERS</strong><p>Recovery is recommended before the next fixture.</p></section>`;
  } else if (message?.kind === 'player-minutes') {
    specific = `<section class="tcm-fact-panel player"><small>RESPONSE DUE</small><strong>${esc(String(data.deadline || '').split('-').reverse().join('/'))}</strong><p>Your choice affects morale and future expectations.</p></section>`;
  } else if (message?.kind === 'opponent-report') {
    const opponent = clubFor(data.opponentCode);
    specific = `<section class="tcm-fact-panel staff"><small>NEXT OPPONENT</small><strong>${esc(opponent?.shortName || opponent?.name || 'Opponent')}</strong><p>Open tactics to prepare the match plan.</p></section>`;
  }
  if (!player && !specific) {
    specific = `<section class="tcm-fact-panel neutral"><small>${esc(metaFor(message).label)}</small><strong>${esc(formatMessageDate(message))}</strong><p>Saved in the permanent club record.</p></section>`;
  }
  return `<aside class="tcm-context">${player}${specific}</aside>`;
}

function actionMarkup(message) {
  if (message?.response) return `<div class="tcm-decision-record">${icon('check')}<span><small>DECISION RECORDED</small><b>${esc(message.response.label)}</b></span></div>`;
  if (!message?.actions?.length) return `<div class="tcm-decision-record is-neutral">${icon('check')}<span><small>INFORMATION</small><b>No action required</b></span></div>`;
  return `<div class="tcm-actions">${message.actions.map(action => `<button type="button" class="${esc(action.kind || 'secondary')}" data-mail-action="${esc(action.id)}" data-mail-message="${esc(message.id)}" data-mail-label="${esc(action.label)}"><span data-button-label>${esc(action.label)}</span></button>`).join('')}</div>`;
}

function detailToolbarMarkup(message) {
  return `<div class="tcm-detail-tools">
    <button type="button" data-mail-toggle-read="${esc(message.id)}" title="Mark as unread">${icon('unread')}<span>Unread</span></button>
    <button type="button" class="danger" data-mail-delete="${esc(message.id)}" data-mail-label="Delete" data-mail-confirm-label="Confirm delete" title="Delete message">${icon('trash')}<span data-button-label>Delete</span></button>
  </div>`;
}

function detailMarkup(message) {
  if (!message) return `<div class="tcm-empty-detail"><span>${icon('mail')}</span><small>MAILBOX</small><h2>No message selected</h2><p>Choose a message or change the active filter.</p></div>`;
  const meta = metaFor(message);
  return `<article class="tcm-detail ${message.requiresResponse ? 'is-required' : ''}" data-mail-detail-article>
    <header class="tcm-detail-head">
      <div class="tcm-sender">${senderAvatar(message)}<span><small>${esc(message.senderRole || meta.label)}</small><b>${esc(message.sender)}</b></span></div>
      <div class="tcm-detail-head-right"><div class="tcm-detail-meta"><span>${esc(meta.label)}</span><time>${esc(fullMessageDate(message))}</time></div>${detailToolbarMarkup(message)}</div>
    </header>
    <div class="tcm-detail-scroll"><div class="tcm-detail-grid">
      <section class="tcm-letter">
        <div class="tcm-kicker ${message.requiresResponse ? 'is-task' : ''}">${message.requiresResponse ? `${icon('alert')}<span>DECISION REQUIRED</span>` : `<span>${esc(meta.label)}</span>`}</div>
        <h2>${esc(message.subject)}</h2>
        <p>${esc(message.body)}</p>
      </section>
      ${contextMarkup(message)}
    </div></div>
    <footer>${actionMarkup(message)}</footer>
  </article>`;
}

function filterButton(id, label, count = null) {
  return `<button type="button" class="${activeFilter === id ? 'is-active' : ''}" data-mail-filter="${id}" aria-pressed="${activeFilter === id}"><span>${esc(label)}</span>${count !== null ? `<i>${count}</i>` : ''}</button>`;
}

function currentView() {
  const summary = mailboxSummary(career);
  const items = careerInboxItems(career, { filter: activeFilter, query: searchQuery });
  if (!items.some(item => item.id === selectedMessageId)) selectedMessageId = items[0]?.id || null;
  return { summary, items, selected: items.find(item => item.id === selectedMessageId) || null };
}

function listPaneMarkup(items, summary) {
  return `<aside class="tcm-list-pane">
    <div class="tcm-tools">
      <label>${icon('search')}<input type="search" value="${esc(searchQuery)}" placeholder="Search" data-mail-search autocomplete="off"></label>
      <div class="tcm-filter-line">
        <div class="tcm-primary-filters">${filterButton('all', 'ALL', summary.total)}${filterButton('required', 'TASKS', summary.required)}${filterButton('unread', 'UNREAD', summary.unread)}</div>
        <details class="tcm-filter-menu"><summary>${icon('filter')}<span>FILTER</span></summary><div>${filterButton('medical', 'MEDICAL')}${filterButton('transfer', 'TRANSFER')}${filterButton('player', 'SQUAD')}${filterButton('staff', 'STAFF')}</div></details>
      </div>
    </div>
    <div class="tcm-message-list" data-mail-list>${items.map(listItemMarkup).join('') || '<div class="tcm-list-empty">No messages in this view.</div>'}</div>
  </aside>`;
}

function topbarMarkup(summary) {
  const club = clubFor(career.clubCode);
  return `<header class="tcm-topbar">
    <button class="tcm-club" type="button" data-mail-back aria-label="Back to career hub">${crestMarkup(club.code, 'tcm-club-crest')}<span><b>${esc((club.shortName || club.name).toUpperCase())}</b><em>${boardSegments()}</em></span></button>
    <nav class="tcm-utilities" aria-label="Career utilities">
      <button type="button" data-mail-calendar>${icon('calendar')}<span>Calendar</span></button>
      <button type="button" data-mail-read-all>${icon('check')}<span>Read all</span></button>
      <button type="button" class="is-active" aria-current="page">${icon('mail')}<span>Mailbox</span>${summary.unread ? `<b data-mail-top-unread>${summary.unread}</b>` : '<b data-mail-top-unread hidden>0</b>'}</button><i>R</i>
    </nav>
  </header>`;
}

function renderScreen() {
  if (!career || location.hash !== '#inbox') return;
  const { items, selected, summary } = currentView();
  const existing = document.getElementById(SCREEN_ID);
  const screen = existing || document.createElement('section');
  screen.id = SCREEN_ID;
  screen.className = 'tcm-screen';
  screen.innerHTML = `<div class="tcm-bg" aria-hidden="true"></div><div class="tcm-shade" aria-hidden="true"></div>${topbarMarkup(summary)}<div class="tcm-layout"><div class="tcm-page-head"><div><small>SEASON ${esc(career.seasonLabel || '2026/27')}</small><h1>Mailbox</h1></div><div class="tcm-summary"><span><b data-mail-summary-unread>${summary.unread}</b><small>UNREAD</small></span><span class="required"><b data-mail-summary-required>${summary.required}</b><small>TASKS</small></span></div></div>${listPaneMarkup(items, summary)}<main class="tcm-detail-pane" data-mail-detail>${detailMarkup(selected)}</main></div><footer class="tcm-footer"><button type="button" data-mail-back><kbd>B</kbd> Back</button><button type="button" data-mail-focus-search><kbd>F</kbd> Search</button><button type="button" data-mail-previous><kbd>↑</kbd> Previous</button><button type="button" data-mail-next><kbd>↓</kbd> Next</button><button type="button" data-mail-calendar><kbd>X</kbd> Calendar</button></footer><div class="tcm-toast" role="status" aria-live="polite"></div>`;
  if (!existing) document.body.append(screen);
  installImageFallbacks(screen);
  applyClubBackground(screen, career.clubCode);
}

function installImageFallbacks(root) {
  root.querySelectorAll('img[data-mail-image-fallback]').forEach(image => image.addEventListener('error', () => {
    const fallback = image.dataset.mailImageFallback;
    if (fallback && image.src !== new URL(fallback, location.href).href) image.src = fallback;
  }, { once: true }));
  root.querySelectorAll('img[data-mail-player-face]').forEach(image => image.addEventListener('error', () => {
    if (!image.src.endsWith(PLAYER_FALLBACK_URL)) image.src = PLAYER_FALLBACK_URL;
  }, { once: true }));
}

function applyClubBackground(root, code) {
  const target = root.querySelector('.tcm-bg');
  if (!target) return;
  const slug = String(code).toLowerCase();
  const webp = `/assets/clubs/2026-27/${slug}/stadium.webp`;
  const jpg = `/assets/clubs/2026-27/${slug}/stadium.jpg`;
  target.style.backgroundImage = `url("${webp}")`;
  const probe = new Image();
  probe.onerror = () => { target.style.backgroundImage = `url("${jpg}")`; };
  probe.src = webp;
}

function showToast(message) {
  const toast = document.querySelector(`#${SCREEN_ID} .tcm-toast`);
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toast.classList.remove('is-visible'), 1700);
}

function animateDetail() {
  const article = document.querySelector(`#${SCREEN_ID} [data-mail-detail-article]`);
  if (!article) return;
  article.classList.remove('is-entering');
  void article.offsetWidth;
  article.classList.add('is-entering');
  window.setTimeout(() => article.classList.remove('is-entering'), 210);
}

function updateSummary() {
  const screen = document.getElementById(SCREEN_ID);
  if (!screen || !career) return;
  const summary = mailboxSummary(career);
  screen.querySelector('[data-mail-summary-unread]')?.replaceChildren(String(summary.unread));
  screen.querySelector('[data-mail-summary-required]')?.replaceChildren(String(summary.required));
  const top = screen.querySelector('[data-mail-top-unread]');
  if (top) { top.replaceChildren(String(summary.unread)); top.hidden = summary.unread === 0; }
  screen.querySelectorAll('[data-mail-filter]').forEach(button => {
    const count = button.querySelector('i');
    if (!count) return;
    const value = button.dataset.mailFilter === 'all' ? summary.total : button.dataset.mailFilter === 'required' ? summary.required : button.dataset.mailFilter === 'unread' ? summary.unread : null;
    if (value !== null) count.replaceChildren(String(value));
  });
}

function renderListAndDetail({ preserveScroll = true, animate = true } = {}) {
  const screen = document.getElementById(SCREEN_ID);
  if (!screen || !career) return;
  const list = screen.querySelector('[data-mail-list]');
  const detail = screen.querySelector('[data-mail-detail]');
  if (!list || !detail) return;
  const previousScroll = list.scrollTop;
  const { items, selected } = currentView();
  list.innerHTML = items.map(listItemMarkup).join('') || '<div class="tcm-list-empty">No messages in this view.</div>';
  detail.innerHTML = detailMarkup(selected);
  screen.querySelectorAll('[data-mail-filter]').forEach(button => {
    const active = button.dataset.mailFilter === activeFilter;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  installImageFallbacks(list);
  installImageFallbacks(detail);
  if (preserveScroll) requestAnimationFrame(() => { list.scrollTop = previousScroll; });
  if (animate) animateDetail();
  updateSummary();
}

async function saveCareer() {
  if (career) career = await CareerRepository.save(career);
}

function selectMessage(messageId, { animate = true } = {}) {
  if (!career || !messageId) return;
  selectedMessageId = messageId;
  window.__touchlineMailboxSelection = selectedMessageId;
  markMailboxRead(career, selectedMessageId, true);
  const screen = document.getElementById(SCREEN_ID);
  screen?.querySelectorAll('[data-mail-id]').forEach(row => {
    const selected = row.dataset.mailId === selectedMessageId;
    row.classList.toggle('is-selected', selected);
    if (selected) { row.classList.remove('is-unread'); row.classList.add('is-read'); }
    row.setAttribute('aria-pressed', String(selected));
  });
  const detail = screen?.querySelector('[data-mail-detail]');
  const selected = careerInboxItems(career, { filter: activeFilter, query: searchQuery }).find(message => message.id === selectedMessageId) || null;
  if (detail) { detail.innerHTML = detailMarkup(selected); installImageFallbacks(detail); if (animate) animateDetail(); }
  updateSummary();
  void saveCareer();
}

function stepMessage(step) {
  const items = careerInboxItems(career, { filter: activeFilter, query: searchQuery });
  if (!items.length) return;
  let index = items.findIndex(item => item.id === selectedMessageId);
  if (index < 0) index = 0;
  index = Math.max(0, Math.min(items.length - 1, index + step));
  selectMessage(items[index].id);
  document.querySelector(`#${SCREEN_ID} [data-mail-id="${CSS.escape(items[index].id)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function armConfirmation(button) {
  if (button.dataset.mailConfirming === 'true') return true;
  const actionId = button.dataset.mailAction;
  const confirmationLabel = button.dataset.mailConfirmLabel || (actionId === 'accept-offer' ? 'Confirm accept' : actionId === 'reject-offer' ? 'Confirm reject' : 'Confirm');
  button.dataset.mailConfirming = 'true';
  button.classList.add('is-confirming');
  button.querySelector('[data-button-label]')?.replaceChildren(confirmationLabel);
  window.setTimeout(() => {
    if (!button.isConnected || button.dataset.mailConfirming !== 'true') return;
    button.dataset.mailConfirming = 'false';
    button.classList.remove('is-confirming');
    button.querySelector('[data-button-label]')?.replaceChildren(button.dataset.mailLabel || 'Confirm');
  }, CONFIRM_RESET_MS);
  return false;
}

async function executeAction(button) {
  if (!career) return;
  const actionId = button.dataset.mailAction;
  if (['accept-offer', 'reject-offer'].includes(actionId) && !armConfirmation(button)) return;
  button.disabled = true;
  button.classList.add('is-loading');
  const result = respondToMailboxMessage(career, button.dataset.mailMessage, actionId);
  career = result.career;
  await saveCareer();
  renderListAndDetail({ preserveScroll: true, animate: true });
  if (result.route) location.hash = result.route;
}

async function toggleSelectedRead(messageId) {
  const message = career?.inbox?.find(item => item.id === messageId);
  if (!message) return;
  markMailboxRead(career, messageId, !message.read);
  await saveCareer();
  renderListAndDetail({ preserveScroll: true, animate: false });
  showToast(message.read ? 'Marked as read' : 'Marked as unread');
}

async function deleteMessage(button) {
  const message = career?.inbox?.find(item => item.id === button.dataset.mailDelete);
  if (!message) return;
  if (!armConfirmation(button)) return;
  message.archived = true;
  message.read = true;
  message.requiresResponse = false;
  message.status = 'dismissed';
  message.response = { actionId: 'dismissed', label: 'Message deleted', date: career.currentDate };
  const offer = career.transferOffers?.[message.data?.offerId];
  if (offer && ['received', 'countered'].includes(offer.status)) {
    offer.status = 'ignored';
    offer.resolvedAt = career.currentDate;
  }
  selectedMessageId = null;
  delete window.__touchlineMailboxSelection;
  await saveCareer();
  renderListAndDetail({ preserveScroll: true, animate: true });
  showToast('Message deleted');
}

function removeMailbox() { document.getElementById(SCREEN_ID)?.remove(); }

async function scheduleMount() {
  if (mountPending) return;
  mountPending = true;
  queueMicrotask(async () => {
    mountPending = false;
    if (location.hash !== '#inbox') { removeMailbox(); scheduleHomeEnhancement(); return; }
    const selectedClub = legacyClubSelection();
    if (!selectedClub) { removeMailbox(); return; }
    const [stored, playerManifest] = await Promise.all([CareerRepository.load(), loadPlayerManifest()]);
    if (location.hash !== '#inbox') return;
    career = normalizeCareer(stored, selectedClub);
    manifest = playerManifest;
    reconcileMailbox(career);
    if (activeClubCode !== career.clubCode) {
      activeClubCode = career.clubCode;
      activeFilter = 'all';
      searchQuery = '';
      selectedMessageId = null;
    }
    selectedMessageId = window.__touchlineMailboxSelection || selectedMessageId || careerInboxItems(career)[0]?.id || null;
    if (selectedMessageId) markMailboxRead(career, selectedMessageId, true);
    await saveCareer();
    renderScreen();
  });
}

function homeMessageMarkup(message) {
  const meta = metaFor(message);
  return `<button class="tl-message ${!message.read ? 'is-unread' : ''} ${message.requiresResponse ? 'is-required' : ''}" data-home-mail-id="${esc(message.id)}"><i></i>${senderAvatar(message, true)}<span class="tl-message-copy"><small>${esc(message.sender)}<time>${esc(formatMessageDate(message))}</time></small><b>${esc(message.subject)}</b><p>${esc(message.preview || message.body)}</p><em class="${meta.tone}">${esc(meta.label)}</em>${message.requiresResponse ? '<strong>TASK</strong>' : ''}</span></button>`;
}

async function enhanceHomeMailbox() {
  const list = document.querySelector('.tl-home-v2 .tl-message-list');
  if (!list || list.dataset.mailboxEnhanced === 'true') return;
  list.dataset.mailboxEnhanced = 'true';
  const selectedClub = legacyClubSelection();
  if (!selectedClub) return;
  const [stored, playerManifest] = await Promise.all([CareerRepository.load(), loadPlayerManifest()]);
  if (!list.isConnected) return;
  const homeCareer = normalizeCareer(stored, selectedClub);
  manifest = playerManifest;
  reconcileMailbox(homeCareer);
  const messages = careerInboxItems(homeCareer, { limit: 4 });
  const summary = mailboxSummary(homeCareer);
  const previousCareer = career;
  career = homeCareer;
  list.innerHTML = messages.map(homeMessageMarkup).join('');
  const slide = list.closest('[data-slide="0"]');
  slide?.querySelector('.tl-inbox-title h3')?.replaceChildren('Mailbox');
  const title = slide?.querySelector('.tl-inbox-title p');
  if (title) title.innerHTML = summary.required ? `<b>${summary.required}</b> tasks · ${summary.unread} unread` : `<b>${summary.unread}</b> unread · ${summary.total} messages`;
  const unreadTab = slide?.querySelector('.tl-inbox-tabs span');
  if (unreadTab) unreadTab.innerHTML = `Unread <i>${summary.unread}</i>`;
  list.querySelectorAll('[data-home-mail-id]').forEach(button => button.addEventListener('click', () => {
    window.__touchlineMailboxSelection = button.dataset.homeMailId;
    location.hash = '#inbox';
  }));
  installImageFallbacks(list);
  career = previousCareer;
}

function scheduleHomeEnhancement() {
  if (homeEnhancePending) return;
  homeEnhancePending = true;
  queueMicrotask(async () => { homeEnhancePending = false; await enhanceHomeMailbox(); });
}

function onClick(event) {
  const screen = document.getElementById(SCREEN_ID);
  if (!screen) return;
  const filter = event.target.closest('[data-mail-filter]');
  if (filter) {
    activeFilter = filter.dataset.mailFilter;
    selectedMessageId = null;
    filter.closest('details')?.removeAttribute('open');
    renderListAndDetail({ preserveScroll: false, animate: false });
    return;
  }
  const action = event.target.closest('[data-mail-action]');
  if (action && !action.disabled) { void executeAction(action); return; }
  const deleteButton = event.target.closest('[data-mail-delete]');
  if (deleteButton) { void deleteMessage(deleteButton); return; }
  const readButton = event.target.closest('[data-mail-toggle-read]');
  if (readButton) { void toggleSelectedRead(readButton.dataset.mailToggleRead); return; }
  const row = event.target.closest('[data-mail-id]');
  if (row) { selectMessage(row.dataset.mailId); return; }
  if (event.target.closest('[data-mail-read-all]')) {
    (career.inbox || []).forEach(message => { message.read = true; });
    void saveCareer().then(() => renderListAndDetail({ preserveScroll: true, animate: false }));
    return;
  }
  if (event.target.closest('[data-mail-calendar]')) { location.hash = '#calendar'; return; }
  if (event.target.closest('[data-mail-back]')) { location.hash = '#home'; return; }
  if (event.target.closest('[data-mail-focus-search]')) { screen.querySelector('[data-mail-search]')?.focus(); return; }
  if (event.target.closest('[data-mail-previous]')) { stepMessage(-1); return; }
  if (event.target.closest('[data-mail-next]')) stepMessage(1);
}

function onInput(event) {
  if (!event.target.matches(`#${SCREEN_ID} [data-mail-search]`)) return;
  searchQuery = event.target.value;
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    selectedMessageId = null;
    renderListAndDetail({ preserveScroll: false, animate: false });
  }, SEARCH_DELAY_MS);
}

function onKeydown(event) {
  if (!document.getElementById(SCREEN_ID)) return;
  const typing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
  const key = event.key.toLowerCase();
  if (key === 'escape' && typing) { event.target.blur(); return; }
  if (typing) return;
  if (['escape', 'backspace', 'b'].includes(key)) { event.preventDefault(); location.hash = '#home'; }
  else if (key === 'f') { event.preventDefault(); document.querySelector(`#${SCREEN_ID} [data-mail-search]`)?.focus(); }
  else if (key === 'arrowup') { event.preventDefault(); stepMessage(-1); }
  else if (key === 'arrowdown') { event.preventDefault(); stepMessage(1); }
  else if (key === 'u' && selectedMessageId) { event.preventDefault(); void toggleSelectedRead(selectedMessageId); }
  else if (key === 'x') { event.preventDefault(); location.hash = '#calendar'; }
}

function start() {
  const app = document.querySelector('#app');
  if (app) new MutationObserver(() => {
    scheduleMount();
    scheduleHomeEnhancement();
  }).observe(app, { childList: true, subtree: true });
  window.addEventListener('hashchange', scheduleMount);
  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('keydown', onKeydown);
  scheduleMount();
  scheduleHomeEnhancement();
}

start();

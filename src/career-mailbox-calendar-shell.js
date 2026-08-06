import './career-mailbox-calendar-shell.css';
import { normalizeCareer } from './career-core/career-core.js';
import { CLUB_BY_CODE } from './career-core/season-2026-27-live.js';
import { CareerRepository, legacyClubSelection } from './career-core/career-repository.js';

const SCREEN_ID = 'touchline-fifa-mailbox';
let scheduled = false;
let generation = 0;

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function crestPath(code) {
  return `/assets/clubs/2026-27/${String(code || '').toLowerCase()}/crest.png`;
}

function boardSegments(confidence) {
  const filled = Math.max(0, Math.min(4, Math.round((Number(confidence) || 0) / 25)));
  return Array.from({ length: 4 }, (_, index) => `<i class="${index < filled ? 'is-filled' : ''}"></i>`).join('');
}

function activeUnread(career) {
  return (career?.inbox || []).filter(message => !message.archived && !message.read).length;
}

function headerMarkup(career, club) {
  const unread = activeUnread(career);
  const clubName = (club?.shortName || club?.name || career.clubCode).toUpperCase();
  return `
    <button class="tcc-club fmb-calendar-club" type="button" data-fmb-shell-home aria-label="Voltar à Central">
      <img class="tcc-club-crest" src="${crestPath(career.clubCode)}" alt="${esc(clubName)}">
      <span>
        <b>${esc(clubName)}</b>
        <em>${boardSegments(career.boardConfidence)}</em>
      </span>
    </button>
    <nav class="tcc-utilities fmb-calendar-utilities" aria-label="Utilidades da carreira">
      <button type="button" class="is-active" data-fmb-shell-inbox><span>✉</span> Inbox ${unread ? `<b>${unread}</b>` : ''}</button>
      <button type="button" data-fmb-shell-chat><span>●</span> Chat</button>
      <i>R</i>
    </nav>
  `;
}

function applyStadiumFallback(screen, clubCode) {
  const background = screen.querySelector('.fmb-bg');
  if (!background) return;
  const slug = String(clubCode).toLowerCase();
  const webp = `/assets/clubs/2026-27/${slug}/stadium.webp`;
  const jpg = `/assets/clubs/2026-27/${slug}/stadium.jpg`;
  background.style.backgroundImage = `url("${webp}")`;
  const probe = new Image();
  probe.onerror = () => {
    if (background.isConnected) background.style.backgroundImage = `url("${jpg}")`;
  };
  probe.src = webp;
}

function showMailboxToast(text) {
  const toast = document.querySelector(`#${SCREEN_ID} .fmb-toast`);
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add('is-visible');
  clearTimeout(showMailboxToast.timeout);
  showMailboxToast.timeout = window.setTimeout(() => toast.classList.remove('is-visible'), 1500);
}

function wireHeader(header) {
  if (header.dataset.fmbCalendarShellWired === 'true') return;
  header.dataset.fmbCalendarShellWired = 'true';
  header.addEventListener('click', event => {
    if (event.target.closest('[data-fmb-shell-home]')) {
      location.hash = '#home';
      return;
    }
    if (event.target.closest('[data-fmb-shell-inbox]')) return;
    if (event.target.closest('[data-fmb-shell-chat]')) showMailboxToast('Chat estará disponível em breve.');
  });
}

async function enhanceMailboxShell() {
  scheduled = false;
  if (location.hash !== '#inbox') return;
  const screen = document.getElementById(SCREEN_ID);
  if (!screen) return;

  const run = ++generation;
  const selectedClub = legacyClubSelection();
  if (!selectedClub) return;
  const loaded = await CareerRepository.load();
  if (run !== generation || location.hash !== '#inbox' || !screen.isConnected) return;

  const career = normalizeCareer(loaded, selectedClub);
  const club = CLUB_BY_CODE.get(career.clubCode) || CLUB_BY_CODE.values().next().value;
  screen.style.setProperty('--tcc-club', club?.accent || '#e52b34');
  screen.style.setProperty('--tcc-club-dark', club?.accentDark || '#251214');
  screen.classList.add('fmb-calendar-shell');

  const background = screen.querySelector('.fmb-bg');
  background?.classList.add('tcc-bg');
  let shade = screen.querySelector('.fmb-calendar-shade');
  if (!shade && background) {
    shade = document.createElement('div');
    shade.className = 'fmb-calendar-shade tcc-shade';
    shade.setAttribute('aria-hidden', 'true');
    background.after(shade);
  }
  applyStadiumFallback(screen, career.clubCode);

  const header = screen.querySelector('.fmb-top');
  if (!header) return;
  header.className = 'fmb-top tcc-topbar fmb-calendar-topbar';
  header.innerHTML = headerMarkup(career, club);
  wireHeader(header);
}

function scheduleEnhancement() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(enhanceMailboxShell);
}

const observer = new MutationObserver(scheduleEnhancement);
observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('hashchange', scheduleEnhancement);
scheduleEnhancement();

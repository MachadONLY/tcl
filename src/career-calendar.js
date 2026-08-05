import './career-calendar.css';
import { CLUB_BY_CODE } from './career-core/season-2026-27.js';
import { normalizeCareer, userFixtures } from './career-core/career-core.js';
import { CareerRepository, legacyClubSelection } from './career-core/career-repository.js';

const SCREEN_ID = 'touchline-career-calendar';
const DAY_MS = 86_400_000;
const TRANSFER_WINDOW_CLOSE = '2026-09-01';

let career = null;
let monthAnchor = null;
let selectedFixtureId = null;
let activeClubCode = null;
let mountPending = false;
let observer = null;

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

function utcDate(isoDate) {
  const [year, month, day] = String(isoDate).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function isoDate(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0')
  ].join('-');
}

function monthStart(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function moveMonth(date, delta) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1));
}

function formatMonth(date) {
  return new Intl.DateTimeFormat('en-GB', {
    month: 'long', year: 'numeric', timeZone: 'UTC'
  }).format(date).toUpperCase();
}

function formatFullDate(value) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
  }).format(utcDate(value));
}

function clubFor(code) {
  return CLUB_BY_CODE.get(code) || CLUB_BY_CODE.values().next().value;
}

function crestMarkup(code, className = '') {
  const club = clubFor(code);
  const slug = String(code || '').toLowerCase();
  const primary = club?.crest || `/assets/clubs/2026-27/${slug}/crest.svg`;
  const fallback = `/assets/clubs/2026-27/${slug}/crest.png`;
  return `<img class="${className}" src="${escapeHtml(primary)}" data-calendar-image-fallback="${escapeHtml(fallback)}" alt="${escapeHtml(club?.name || code)} crest">`;
}

function scoreFor(fixture) {
  const result = career?.results?.[fixture.id];
  if (!result) return '';
  return `${result.homeGoals}–${result.awayGoals}`;
}

function fixtureOpponent(fixture) {
  return clubFor(fixture.home === career.clubCode ? fixture.away : fixture.home);
}

function isHomeFixture(fixture) {
  return fixture.home === career.clubCode;
}

function boardSegments() {
  const filled = Math.max(0, Math.min(4, Math.round((Number(career?.boardConfidence) || 0) / 25)));
  return Array.from({ length: 4 }, (_, index) => `<i class="${index < filled ? 'is-filled' : ''}"></i>`).join('');
}

function fixtureMap(fixtures) {
  const map = new Map();
  for (const fixture of fixtures) {
    if (!map.has(fixture.date)) map.set(fixture.date, []);
    map.get(fixture.date).push(fixture);
  }
  return map;
}

function monthCells(fixtures) {
  const first = monthStart(monthAnchor);
  const firstVisible = new Date(first.getTime() - first.getUTCDay() * DAY_MS);
  const byDate = fixtureMap(fixtures);
  const cells = [];

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(firstVisible.getTime() + index * DAY_MS);
    const dateKey = isoDate(date);
    const dateFixtures = byDate.get(dateKey) || [];
    const inMonth = date.getUTCMonth() === first.getUTCMonth();
    const today = dateKey === career.currentDate;
    const past = dateKey < career.currentDate;

    const fixturesMarkup = dateFixtures.map(fixture => {
      const opponent = fixtureOpponent(fixture);
      const home = isHomeFixture(fixture);
      const score = scoreFor(fixture);
      const selected = fixture.id === selectedFixtureId;
      return `<button class="tcc-fixture ${score ? 'is-played' : ''} ${selected ? 'is-selected' : ''}" data-calendar-fixture="${escapeHtml(fixture.id)}" aria-label="${escapeHtml(`${home ? 'Home' : 'Away'} versus ${opponent.name}, ${formatFullDate(fixture.date)}`)}">
        <span class="tcc-fixture-day">${date.getUTCDate()}</span>
        <span class="tcc-fixture-copy"><b>${home ? 'Home' : 'Away'}</b><small>LEAGUE</small></span>
        ${crestMarkup(opponent.code, 'tcc-fixture-crest')}
        ${score ? `<strong class="tcc-fixture-score">${score}</strong>` : ''}
      </button>`;
    }).join('');

    cells.push(`<div class="tcc-day ${inMonth ? '' : 'is-outside'} ${today ? 'is-today' : ''} ${past ? 'is-past' : ''}" data-calendar-date="${dateKey}">
      ${dateFixtures.length ? '' : `<time>${date.getUTCDate()}</time>`}
      ${fixturesMarkup}
    </div>`);
  }

  return cells.join('');
}

function defaultSelectedFixture(fixtures) {
  const inVisibleMonth = fixtures.filter(fixture => {
    const date = utcDate(fixture.date);
    return date.getUTCFullYear() === monthAnchor.getUTCFullYear() && date.getUTCMonth() === monthAnchor.getUTCMonth();
  });
  const existing = inVisibleMonth.find(fixture => fixture.id === selectedFixtureId);
  if (existing) return existing;
  return inVisibleMonth.find(fixture => fixture.date >= career.currentDate)
    || inVisibleMonth.at(-1)
    || fixtures.find(fixture => fixture.date >= career.currentDate)
    || fixtures.at(-1)
    || null;
}

function transferWindowModel() {
  const current = utcDate(career.currentDate);
  const close = utcDate(TRANSFER_WINDOW_CLOSE);
  const days = Math.max(0, Math.ceil((close.getTime() - current.getTime()) / DAY_MS));
  return current <= close
    ? { open: true, label: 'Transfer Window Opened', days }
    : { open: false, label: 'Transfer Window Closed', days: 0 };
}

function selectedPanel(fixtures) {
  const fixture = fixtures.find(item => item.id === selectedFixtureId) || defaultSelectedFixture(fixtures);
  if (fixture && fixture.id !== selectedFixtureId) selectedFixtureId = fixture.id;
  const transfer = transferWindowModel();

  if (!fixture) {
    return `<aside class="tcc-detail">
      <div class="tcc-detail-empty"><small>PREMIER LEAGUE</small><h2>No fixture selected</h2><p>Change month to review the season schedule.</p></div>
      ${transferMarkup(transfer)}
    </aside>`;
  }

  const opponent = fixtureOpponent(fixture);
  const home = isHomeFixture(fixture);
  const score = scoreFor(fixture);
  const venue = home ? clubFor(career.clubCode)?.stadium : opponent?.stadium;

  return `<aside class="tcc-detail" data-calendar-detail>
    <div class="tcc-competition">Premier League</div>
    <time class="tcc-selected-date">${formatFullDate(fixture.date)}</time>
    <div class="tcc-opponent">
      ${crestMarkup(opponent.code, 'tcc-opponent-crest')}
      <h2>${escapeHtml(opponent.shortName || opponent.name)}</h2>
      <p>${home ? 'Home' : 'Away'} · ${escapeHtml(venue || '')}</p>
      ${score ? `<strong>${score}</strong>` : `<span>${fixture.time || '15:00'}</span>`}
    </div>
    ${transferMarkup(transfer)}
  </aside>`;
}

function transferMarkup(transfer) {
  return `<div class="tcc-transfer ${transfer.open ? 'is-open' : 'is-closed'}">
    <small>${transfer.label}</small>
    ${transfer.open
      ? `<b>${transfer.days} ${transfer.days === 1 ? 'Day' : 'Days'}</b><span>Until Window Closes</span>`
      : '<b>Closed</b><span>The next registration window will appear here.</span>'}
  </div>`;
}

function renderCalendar() {
  if (!career || location.hash !== '#calendar') return;
  const fixtures = userFixtures(career).slice().sort((a, b) => a.date.localeCompare(b.date));
  const selected = defaultSelectedFixture(fixtures);
  if (selected) selectedFixtureId = selected.id;
  const club = clubFor(career.clubCode);
  const unread = (career.inbox || []).filter(message => !message.read).length;
  const existing = document.getElementById(SCREEN_ID);
  const screen = existing || document.createElement('section');
  screen.id = SCREEN_ID;
  screen.className = 'tcc-screen';
  screen.style.setProperty('--tcc-club', club?.accent || '#67A633');
  screen.style.setProperty('--tcc-club-dark', club?.accentDark || '#263323');
  screen.innerHTML = `
    <div class="tcc-bg" aria-hidden="true"></div>
    <div class="tcc-shade" aria-hidden="true"></div>
    <header class="tcc-topbar">
      <button class="tcc-club" type="button" data-calendar-back aria-label="Back to career hub">
        ${crestMarkup(club.code, 'tcc-club-crest')}
        <span><b>${escapeHtml((club.shortName || club.name).toUpperCase())}</b><em>${boardSegments()}</em></span>
      </button>
      <nav class="tcc-utilities" aria-label="Career utilities">
        <button type="button" data-calendar-inbox><span>✉</span> Inbox ${unread ? `<b>${unread}</b>` : ''}</button>
        <button type="button" data-calendar-chat><span>●</span> Chat</button>
        <i>R</i>
      </nav>
    </header>

    <div class="tcc-layout">
      <main class="tcc-main">
        <div class="tcc-title-row">
          <div><small>SEASON ${escapeHtml(career.seasonLabel || '2026/27')}</small><h1>Calendar</h1></div>
          <div class="tcc-month-control">
            <button type="button" data-calendar-month="-1" aria-label="Previous month">‹</button>
            <strong>${formatMonth(monthAnchor)}</strong>
            <button type="button" data-calendar-month="1" aria-label="Next month">›</button>
          </div>
        </div>
        <div class="tcc-weekdays" aria-hidden="true">${['SUN','MON','TUE','WED','THU','FRI','SAT'].map(day => `<span>${day}</span>`).join('')}</div>
        <div class="tcc-grid" role="grid" aria-label="${formatMonth(monthAnchor)}">${monthCells(fixtures)}</div>
      </main>
      ${selectedPanel(fixtures)}
    </div>

    <footer class="tcc-footer">
      <button type="button" data-calendar-sim><kbd>A</kbd> Sim To Date</button>
      <button type="button" data-calendar-back><kbd>B</kbd> Back</button>
      <button type="button" data-calendar-view><kbd>X</kbd> View Fixture</button>
      <button type="button" data-calendar-month-cycle><kbd>LT</kbd><kbd>RT</kbd> Month</button>
    </footer>
    <div class="tcc-toast" role="status" aria-live="polite"></div>
  `;

  if (!existing) document.body.append(screen);
  installImageFallbacks(screen);
  applyClubBackground(screen, club.code);
}

function installImageFallbacks(root) {
  root.querySelectorAll('img[data-calendar-image-fallback]').forEach(image => {
    image.addEventListener('error', () => {
      const fallback = image.dataset.calendarImageFallback;
      if (fallback && image.src !== new URL(fallback, location.href).href) image.src = fallback;
    }, { once: true });
  });
}

function applyClubBackground(root, code) {
  const target = root.querySelector('.tcc-bg');
  if (!target) return;
  const slug = String(code).toLowerCase();
  const webp = `/assets/clubs/2026-27/${slug}/stadium.webp`;
  const jpg = `/assets/clubs/2026-27/${slug}/stadium.jpg`;
  target.style.backgroundImage = `url("${webp}")`;
  const probe = new Image();
  probe.onerror = () => { target.style.backgroundImage = `url("${jpg}")`; };
  probe.src = webp;
}

function removeCalendar() {
  document.getElementById(SCREEN_ID)?.remove();
}

function scheduleMount() {
  if (mountPending) return;
  mountPending = true;
  queueMicrotask(async () => {
    mountPending = false;
    if (location.hash !== '#calendar') {
      removeCalendar();
      return;
    }

    const selectedClub = legacyClubSelection();
    if (!selectedClub) {
      removeCalendar();
      return;
    }

    const loaded = await CareerRepository.load();
    if (location.hash !== '#calendar') return;
    career = normalizeCareer(loaded, selectedClub);
    const careerMonth = monthStart(utcDate(career.currentDate));
    if (!monthAnchor || activeClubCode !== career.clubCode) {
      monthAnchor = careerMonth;
      activeClubCode = career.clubCode;
      selectedFixtureId = null;
    }
    renderCalendar();
  });
}

function showToast(message) {
  const toast = document.querySelector(`#${SCREEN_ID} .tcc-toast`);
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toast.classList.remove('is-visible'), 1800);
}

function selectFixtureByStep(step) {
  if (!career) return;
  const fixtures = userFixtures(career).slice().sort((a, b) => a.date.localeCompare(b.date));
  if (!fixtures.length) return;
  let index = fixtures.findIndex(fixture => fixture.id === selectedFixtureId);
  if (index < 0) index = 0;
  index = Math.max(0, Math.min(fixtures.length - 1, index + step));
  const fixture = fixtures[index];
  selectedFixtureId = fixture.id;
  monthAnchor = monthStart(utcDate(fixture.date));
  renderCalendar();
}

function activateSimToDate() {
  const underlying = document.querySelector('#app button[data-continue]');
  if (!underlying) {
    showToast('No date available to simulate.');
    return;
  }
  const enteringMatch = /JOGO|MATCH/i.test(underlying.textContent || '');
  if (enteringMatch) removeCalendar();
  underlying.click();
  if (!enteringMatch) setTimeout(scheduleMount, 80);
}

function viewSelectedFixture() {
  const panel = document.querySelector(`#${SCREEN_ID} [data-calendar-detail]`);
  if (!panel) return;
  panel.classList.remove('is-pulsing');
  requestAnimationFrame(() => panel.classList.add('is-pulsing'));
  showToast('Fixture selected.');
}

function onClick(event) {
  if (!document.getElementById(SCREEN_ID)) return;
  const fixtureButton = event.target.closest('[data-calendar-fixture]');
  if (fixtureButton) {
    selectedFixtureId = fixtureButton.dataset.calendarFixture;
    renderCalendar();
    return;
  }

  const monthButton = event.target.closest('[data-calendar-month]');
  if (monthButton) {
    monthAnchor = moveMonth(monthAnchor, Number(monthButton.dataset.calendarMonth) || 0);
    selectedFixtureId = null;
    renderCalendar();
    return;
  }

  if (event.target.closest('[data-calendar-month-cycle]')) {
    monthAnchor = moveMonth(monthAnchor, 1);
    selectedFixtureId = null;
    renderCalendar();
    return;
  }
  if (event.target.closest('[data-calendar-back]')) {
    location.hash = '#home';
    return;
  }
  if (event.target.closest('[data-calendar-inbox]')) {
    location.hash = '#inbox';
    return;
  }
  if (event.target.closest('[data-calendar-chat]')) {
    showToast('Chat will unlock with the staff communication system.');
    return;
  }
  if (event.target.closest('[data-calendar-sim]')) {
    activateSimToDate();
    return;
  }
  if (event.target.closest('[data-calendar-view]')) viewSelectedFixture();
}

function onKeydown(event) {
  if (!document.getElementById(SCREEN_ID)) return;
  const key = event.key.toLowerCase();
  if (['escape', 'backspace', 'b'].includes(key)) {
    event.preventDefault();
    location.hash = '#home';
  } else if (['pageup', '['].includes(key)) {
    event.preventDefault();
    monthAnchor = moveMonth(monthAnchor, -1);
    selectedFixtureId = null;
    renderCalendar();
  } else if (['pagedown', ']'].includes(key)) {
    event.preventDefault();
    monthAnchor = moveMonth(monthAnchor, 1);
    selectedFixtureId = null;
    renderCalendar();
  } else if (['arrowleft', 'arrowup'].includes(key)) {
    event.preventDefault();
    selectFixtureByStep(-1);
  } else if (['arrowright', 'arrowdown'].includes(key)) {
    event.preventDefault();
    selectFixtureByStep(1);
  } else if (['enter', 'x'].includes(key)) {
    event.preventDefault();
    viewSelectedFixture();
  } else if (key === 'a') {
    event.preventDefault();
    activateSimToDate();
  }
}

function start() {
  observer = new MutationObserver(scheduleMount);
  const app = document.querySelector('#app');
  if (app) observer.observe(app, { childList: true, subtree: true });
  window.addEventListener('hashchange', scheduleMount);
  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKeydown);
  scheduleMount();
}

start();

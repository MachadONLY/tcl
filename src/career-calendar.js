import './career-calendar.css';
import './career-calendar-friendlies.css';
import { CLUB_BY_CODE } from './career-core/season-2026-27.js';
import { normalizeCareer, userFixtures } from './career-core/career-runtime.js';
import {
  cancelFriendly,
  friendlyDateStatus,
  friendlyQuote,
  friendlyResultFor,
  isFriendlyFixture,
  resolveFriendlyClub,
  scheduleFriendly
} from './career-core/friendly-engine.js';
import {
  EUROPEAN_CLUBS,
  EUROPE_COUNTRIES,
  clubsByCountryDivision
} from './career-core/european-club-catalog.js';
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
let modalState = null;

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

function utcDate(isoDate) {
  const [year, month, day] = String(isoDate).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function isoDate(date) {
  return [date.getUTCFullYear(), String(date.getUTCMonth() + 1).padStart(2, '0'), String(date.getUTCDate()).padStart(2, '0')].join('-');
}

function monthStart(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function moveMonth(date, delta) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1));
}

function formatMonth(date) {
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date).toUpperCase();
}

function formatFullDate(value) {
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(utcDate(value));
}

function formatMoney(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'GBP', notation: 'compact', maximumFractionDigits: 1 }).format(value || 0);
}

function initials(value) {
  return String(value || 'FC').split(/\s+/).filter(Boolean).slice(0, 3).map(part => part[0]).join('').toUpperCase();
}

function clubFor(reference) {
  return CLUB_BY_CODE.get(reference) || resolveFriendlyClub(career, reference);
}

function crestMarkup(reference, className = '') {
  const club = clubFor(reference);
  if (CLUB_BY_CODE.has(reference)) {
    const slug = String(reference).toLowerCase();
    const primary = club?.crest || `/assets/clubs/2026-27/${slug}/crest.svg`;
    const fallback = `/assets/clubs/2026-27/${slug}/crest.png`;
    return `<img class="${className}" src="${escapeHtml(primary)}" data-calendar-image-fallback="${escapeHtml(fallback)}" alt="${escapeHtml(club?.name || reference)} crest">`;
  }
  return `<span class="tcc-external-crest ${className}" style="--external-club:${escapeHtml(club?.color || '#69a7bf')}" aria-hidden="true">${escapeHtml(initials(club?.shortName || club?.name))}</span>`;
}

function scoreFor(fixture) {
  const result = friendlyResultFor(career, fixture);
  return result ? `${result.homeGoals}–${result.awayGoals}` : '';
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
    const seasonYear = Number(String(career.seasonLabel).slice(0, 4)) || 2026;
    const inPreseason = dateKey >= `${seasonYear}-07-01` && dateKey <= `${seasonYear}-08-20`;

    const fixturesMarkup = dateFixtures.map(fixture => {
      const opponent = fixtureOpponent(fixture);
      const home = isHomeFixture(fixture);
      const score = scoreFor(fixture);
      const selected = fixture.id === selectedFixtureId;
      const friendly = isFriendlyFixture(fixture);
      return `<button class="tcc-fixture ${friendly ? 'is-friendly' : ''} ${score ? 'is-played' : ''} ${selected ? 'is-selected' : ''}" data-calendar-fixture="${escapeHtml(fixture.id)}" aria-label="${escapeHtml(`${friendly ? 'Amistoso' : home ? 'Casa' : 'Fora'} contra ${opponent.name}, ${formatFullDate(fixture.date)}`)}">
        <span class="tcc-fixture-day">${date.getUTCDate()}</span>
        <span class="tcc-fixture-copy"><b>${friendly ? 'Friendly' : home ? 'Home' : 'Away'}</b><small>${friendly ? 'PRE-SEASON' : 'LEAGUE'}</small></span>
        ${crestMarkup(opponent.id || opponent.code, 'tcc-fixture-crest')}
        ${score ? `<strong class="tcc-fixture-score">${score}</strong>` : ''}
      </button>`;
    }).join('');

    const emptyAction = !dateFixtures.length && inMonth && !past && inPreseason
      ? `<button class="tcc-day-add" type="button" data-calendar-arrange="${dateKey}" aria-label="Marcar amistoso em ${formatFullDate(dateKey)}"><span>＋</span><small>AMISTOSO</small></button>`
      : '';

    cells.push(`<div class="tcc-day ${inMonth ? '' : 'is-outside'} ${today ? 'is-today' : ''} ${past ? 'is-past' : ''} ${emptyAction ? 'is-arrangeable' : ''}" data-calendar-date="${dateKey}">
      ${dateFixtures.length ? '' : `<time>${date.getUTCDate()}</time>`}
      ${fixturesMarkup}${emptyAction}
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
  return current <= close ? { open: true, label: 'Transfer Window Opened', days } : { open: false, label: 'Transfer Window Closed', days: 0 };
}

function selectedPanel(fixtures) {
  const fixture = fixtures.find(item => item.id === selectedFixtureId) || defaultSelectedFixture(fixtures);
  if (fixture && fixture.id !== selectedFixtureId) selectedFixtureId = fixture.id;
  const transfer = transferWindowModel();

  if (!fixture) {
    return `<aside class="tcc-detail">
      <div class="tcc-detail-empty"><small>PRÉ-TEMPORADA</small><h2>Escolha um dia livre</h2><p>Clique em qualquer data disponível entre 1 de julho e 20 de agosto para marcar um amistoso.</p></div>
      ${transferMarkup(transfer)}
    </aside>`;
  }

  const opponent = fixtureOpponent(fixture);
  const home = isHomeFixture(fixture);
  const score = scoreFor(fixture);
  const friendly = isFriendlyFixture(fixture);
  const venue = friendly
    ? fixture.venue === 'neutral' ? 'Campo neutro' : home ? clubFor(career.clubCode)?.stadium : opponent?.name
    : home ? clubFor(career.clubCode)?.stadium : opponent?.stadium;
  const cancellable = friendly && !score && fixture.date >= career.currentDate;

  return `<aside class="tcc-detail ${friendly ? 'is-friendly' : ''}" data-calendar-detail>
    <div class="tcc-competition">${friendly ? 'Friendly Match' : 'Premier League'}</div>
    <time class="tcc-selected-date">${formatFullDate(fixture.date)}</time>
    <div class="tcc-opponent">
      ${crestMarkup(opponent.id || opponent.code, 'tcc-opponent-crest')}
      <h2>${escapeHtml(opponent.shortName || opponent.name)}</h2>
      <p>${friendly ? `${home ? 'Home' : 'Away'} · ${escapeHtml(venue || '')}` : `${home ? 'Home' : 'Away'} · ${escapeHtml(venue || '')}`}</p>
      ${score ? `<strong>${score}</strong>` : `<span>${fixture.time || '15:00'}</span>`}
      ${friendly ? `<small class="tcc-friendly-source">${fixture.source === 'official-2026-preseason' ? 'CALENDÁRIO REAL 2026/27' : 'MARCADO PELO MANAGER'}</small>` : ''}
      ${cancellable ? `<button class="tcc-cancel-friendly" type="button" data-calendar-cancel-friendly="${escapeHtml(fixture.id)}">Cancelar amistoso</button>` : ''}
    </div>
    ${transferMarkup(transfer)}
  </aside>`;
}

function transferMarkup(transfer) {
  return `<div class="tcc-transfer ${transfer.open ? 'is-open' : 'is-closed'}">
    <small>${transfer.label}</small>
    ${transfer.open ? `<b>${transfer.days} ${transfer.days === 1 ? 'Day' : 'Days'}</b><span>Until Window Closes</span>` : '<b>Closed</b><span>The next registration window will appear here.</span>'}
  </div>`;
}

function availableClubs() {
  if (!modalState) return [];
  const query = modalState.query.trim().toLocaleLowerCase('pt-BR');
  return clubsByCountryDivision(modalState.countryCode, modalState.division)
    .filter(club => club.id !== career.clubCode)
    .filter(club => !query || `${club.name} ${club.league}`.toLocaleLowerCase('pt-BR').includes(query));
}

function modalMarkup() {
  if (!modalState) return '';
  const country = EUROPE_COUNTRIES.find(item => item.code === modalState.countryCode) || EUROPE_COUNTRIES[0];
  const divisions = country.divisions;
  if (!divisions.some(item => item.division === modalState.division)) modalState.division = divisions[0]?.division || 1;
  const clubs = availableClubs();
  const selected = modalState.opponentId ? resolveFriendlyClub(career, modalState.opponentId) : null;
  const status = friendlyDateStatus(career, modalState.date, modalState.opponentId);
  const quote = selected ? friendlyQuote(career, selected.id, modalState.venue) : null;

  return `<div class="tcc-friendly-modal" role="dialog" aria-modal="true" aria-labelledby="tcc-friendly-title" data-friendly-modal>
    <button class="tcc-friendly-backdrop" type="button" data-friendly-close aria-label="Fechar"></button>
    <section class="tcc-friendly-dialog">
      <header class="tcc-friendly-header">
        <div><small>FIXTURE SCHEDULE · ${escapeHtml(formatFullDate(modalState.date).toUpperCase())}</small><h2 id="tcc-friendly-title">Arrange Friendly</h2></div>
        <button type="button" data-friendly-close aria-label="Fechar">×</button>
      </header>

      <div class="tcc-friendly-config">
        <label><span>DATE</span><input value="${escapeHtml(modalState.date)}" readonly></label>
        <label><span>VENUE</span><select data-friendly-venue><option value="home" ${modalState.venue==='home'?'selected':''}>Home</option><option value="away" ${modalState.venue==='away'?'selected':''}>Away</option><option value="neutral" ${modalState.venue==='neutral'?'selected':''}>Neutral</option></select></label>
        <label><span>KICK-OFF</span><select data-friendly-time>${['12:30','15:00','17:30','19:30','20:00'].map(time=>`<option ${modalState.time===time?'selected':''}>${time}</option>`).join('')}</select></label>
        <label><span>MATCH RULES</span><select data-friendly-rules><option value="90-minutes" ${modalState.rules==='90-minutes'?'selected':''}>90 Minutes Only</option><option value="penalties" ${modalState.rules==='penalties'?'selected':''}>Penalties if Draw</option></select></label>
      </div>

      <div class="tcc-friendly-browser">
        <nav class="tcc-country-list" aria-label="Países europeus">
          ${EUROPE_COUNTRIES.map(item => `<button type="button" class="${item.code===country.code?'is-active':''}" data-friendly-country="${item.code}"><i style="--country:${item.color}"></i><span>${escapeHtml(item.name)}</span><b>${EUROPEAN_CLUBS.filter(club=>club.countryCode===item.code).length}</b></button>`).join('')}
        </nav>
        <main class="tcc-club-browser">
          <div class="tcc-browser-toolbar">
            <div class="tcc-division-tabs">${divisions.map(item=>`<button type="button" class="${item.division===modalState.division?'is-active':''}" data-friendly-division="${item.division}"><small>DIV ${item.division}</small>${escapeHtml(item.league)}</button>`).join('')}</div>
            <label class="tcc-friendly-search"><span>⌕</span><input type="search" value="${escapeHtml(modalState.query)}" placeholder="Buscar clube" data-friendly-search></label>
          </div>
          <div class="tcc-club-grid">
            ${clubs.map(club => {
              const availability = friendlyDateStatus(career, modalState.date, club.id);
              return `<button type="button" class="tcc-club-option ${club.id===modalState.opponentId?'is-selected':''} ${availability.available?'':'is-unavailable'}" data-friendly-opponent="${escapeHtml(club.id)}" ${availability.available?'':'disabled'}>
                ${crestMarkup(club.id, 'tcc-club-option-crest')}
                <span><b>${escapeHtml(club.name)}</b><small>${escapeHtml(club.league)}</small></span>
                <em>${'★'.repeat(club.reputation)}${'☆'.repeat(5-club.reputation)}</em>
                ${availability.available ? '' : '<i>INDISPONÍVEL</i>'}
              </button>`;
            }).join('') || '<div class="tcc-no-clubs">Nenhum clube encontrado nesta divisão.</div>'}
          </div>
        </main>
        <aside class="tcc-friendly-summary">
          ${selected ? `${crestMarkup(selected.id || selected.code, 'tcc-summary-crest')}<small>${escapeHtml(selected.country)} · ${escapeHtml(selected.league)}</small><h3>${escapeHtml(selected.name)}</h3><div class="tcc-summary-stars">${'★'.repeat(selected.reputation)}${'☆'.repeat(5-selected.reputation)}</div>` : '<div class="tcc-summary-empty"><span>＋</span><h3>Escolha o adversário</h3><p>Países e divisões ficam visíveis ao mesmo tempo para evitar menus escondidos.</p></div>'}
          ${quote ? `<dl><div><dt>FEE</dt><dd>${formatMoney(quote.fee)}</dd></div><div><dt>INCOME</dt><dd>${formatMoney(quote.income)}</dd></div><div><dt>TRAVEL</dt><dd>${formatMoney(quote.travel)}</dd></div><div class="${quote.net>=0?'is-positive':'is-negative'}"><dt>EST. NET</dt><dd>${formatMoney(quote.net)}</dd></div></dl>` : ''}
          <div class="tcc-availability ${status.available?'is-ok':'is-blocked'}"><b>${status.available?'DATA DISPONÍVEL':'CONFLITO DE AGENDA'}</b><p>${status.available?(status.warning||'Os dois clubes estão livres neste dia.'):status.reasons.join(' ')}</p></div>
          <button class="tcc-confirm-friendly" type="button" data-friendly-confirm ${selected&&status.available?'':'disabled'}>CONFIRM FRIENDLY <span>→</span></button>
        </aside>
      </div>
    </section>
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
  screen.className = `tcc-screen ${modalState ? 'has-modal' : ''}`;
  screen.style.setProperty('--tcc-club', club?.accent || '#67A633');
  screen.style.setProperty('--tcc-club-dark', club?.accentDark || '#263323');
  screen.innerHTML = `
    <div class="tcc-bg" aria-hidden="true"></div><div class="tcc-shade" aria-hidden="true"></div>
    <header class="tcc-topbar">
      <button class="tcc-club" type="button" data-calendar-back aria-label="Back to career hub">${crestMarkup(club.code, 'tcc-club-crest')}<span><b>${escapeHtml((club.shortName || club.name).toUpperCase())}</b><em>${boardSegments()}</em></span></button>
      <nav class="tcc-utilities" aria-label="Career utilities"><button type="button" data-calendar-inbox><span>✉</span> Inbox ${unread ? `<b>${unread}</b>` : ''}</button><button type="button" data-calendar-chat><span>●</span> Chat</button><i>R</i></nav>
    </header>
    <div class="tcc-layout">
      <main class="tcc-main">
        <div class="tcc-title-row"><div><small>SEASON ${escapeHtml(career.seasonLabel || '2026/27')} · STARTED 1 JULY</small><h1>Calendar</h1></div><div class="tcc-month-control"><button type="button" data-calendar-month="-1" aria-label="Previous month">‹</button><strong>${formatMonth(monthAnchor)}</strong><button type="button" data-calendar-month="1" aria-label="Next month">›</button></div></div>
        <div class="tcc-weekdays" aria-hidden="true">${['SUN','MON','TUE','WED','THU','FRI','SAT'].map(day => `<span>${day}</span>`).join('')}</div>
        <div class="tcc-grid" role="grid" aria-label="${formatMonth(monthAnchor)}">${monthCells(fixtures)}</div>
      </main>
      ${selectedPanel(fixtures)}
    </div>
    <footer class="tcc-footer"><button type="button" data-calendar-sim><kbd>A</kbd> Sim To Date</button><button type="button" data-calendar-back><kbd>B</kbd> Back</button><button type="button" data-calendar-view><kbd>X</kbd> View Fixture</button><button type="button" data-calendar-month-cycle><kbd>LT</kbd><kbd>RT</kbd> Month</button></footer>
    <div class="tcc-toast" role="status" aria-live="polite"></div>${modalMarkup()}
  `;
  if (!existing) document.body.append(screen);
  installImageFallbacks(screen);
  applyClubBackground(screen, club.code);
  if (modalState) queueMicrotask(() => screen.querySelector('[data-friendly-search]')?.focus({ preventScroll: true }));
}

function installImageFallbacks(root) {
  root.querySelectorAll('img[data-calendar-image-fallback]').forEach(image => image.addEventListener('error', () => {
    const fallback = image.dataset.calendarImageFallback;
    if (fallback && image.src !== new URL(fallback, location.href).href) image.src = fallback;
  }, { once: true }));
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
  modalState = null;
}

function scheduleMount() {
  if (mountPending) return;
  mountPending = true;
  queueMicrotask(async () => {
    mountPending = false;
    if (location.hash !== '#calendar') return removeCalendar();
    const selectedClub = legacyClubSelection();
    if (!selectedClub) return removeCalendar();
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
  showToast.timeout = setTimeout(() => toast.classList.remove('is-visible'), 2200);
}

function openFriendlyModal(date) {
  const initialCountry = EUROPE_COUNTRIES.find(country => country.code === 'ENG') || EUROPE_COUNTRIES[0];
  modalState = { date, countryCode: initialCountry.code, division: initialCountry.divisions[0]?.division || 1, query: '', opponentId: null, venue: 'home', time: '19:30', rules: '90-minutes' };
  renderCalendar();
}

async function persistCareer(message) {
  career = normalizeCareer(await CareerRepository.save(career), career.clubCode);
  window.dispatchEvent(new CustomEvent('touchline:career-updated', { detail: structuredClone(career) }));
  renderCalendar();
  if (message) showToast(message);
}

async function confirmFriendly() {
  if (!modalState?.opponentId) return;
  try {
    const opponent = resolveFriendlyClub(career, modalState.opponentId);
    const fixture = scheduleFriendly(career, modalState);
    selectedFixtureId = fixture.id;
    modalState = null;
    await persistCareer(`Amistoso contra ${opponent.name} confirmado.`);
  } catch (error) {
    showToast(error.message || 'Não foi possível marcar o amistoso.');
  }
}

async function removeFriendly(fixtureId) {
  try {
    const fixture = cancelFriendly(career, fixtureId);
    const opponent = fixtureOpponent(fixture);
    selectedFixtureId = null;
    await persistCareer(`Amistoso contra ${opponent.name} cancelado.`);
  } catch (error) {
    showToast(error.message || 'Não foi possível cancelar o amistoso.');
  }
}

function selectFixtureByStep(step) {
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
  if (!underlying) return showToast('No date available to simulate.');
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
  if (event.target.closest('[data-friendly-close]')) { modalState = null; renderCalendar(); return; }
  const country = event.target.closest('[data-friendly-country]');
  if (country && modalState) { const next = EUROPE_COUNTRIES.find(item => item.code === country.dataset.friendlyCountry); modalState.countryCode = next.code; modalState.division = next.divisions[0]?.division || 1; modalState.opponentId = null; modalState.query = ''; renderCalendar(); return; }
  const division = event.target.closest('[data-friendly-division]');
  if (division && modalState) { modalState.division = Number(division.dataset.friendlyDivision); modalState.opponentId = null; renderCalendar(); return; }
  const opponent = event.target.closest('[data-friendly-opponent]');
  if (opponent && modalState) { modalState.opponentId = opponent.dataset.friendlyOpponent; renderCalendar(); return; }
  if (event.target.closest('[data-friendly-confirm]')) { void confirmFriendly(); return; }
  const cancel = event.target.closest('[data-calendar-cancel-friendly]');
  if (cancel) { void removeFriendly(cancel.dataset.calendarCancelFriendly); return; }
  const arrange = event.target.closest('[data-calendar-arrange]');
  if (arrange) { openFriendlyModal(arrange.dataset.calendarArrange); return; }
  const fixtureButton = event.target.closest('[data-calendar-fixture]');
  if (fixtureButton) { selectedFixtureId = fixtureButton.dataset.calendarFixture; renderCalendar(); return; }
  const monthButton = event.target.closest('[data-calendar-month]');
  if (monthButton) { monthAnchor = moveMonth(monthAnchor, Number(monthButton.dataset.calendarMonth) || 0); selectedFixtureId = null; renderCalendar(); return; }
  if (event.target.closest('[data-calendar-month-cycle]')) { monthAnchor = moveMonth(monthAnchor, 1); selectedFixtureId = null; renderCalendar(); return; }
  if (event.target.closest('[data-calendar-back]')) { location.hash = '#home'; return; }
  if (event.target.closest('[data-calendar-inbox]')) { location.hash = '#inbox'; return; }
  if (event.target.closest('[data-calendar-chat]')) { showToast('Chat will unlock with the staff communication system.'); return; }
  if (event.target.closest('[data-calendar-sim]')) { activateSimToDate(); return; }
  if (event.target.closest('[data-calendar-view]')) viewSelectedFixture();
}

function onInput(event) {
  if (!modalState) return;
  if (event.target.matches('[data-friendly-search]')) {
    modalState.query = event.target.value;
    const selection = event.target.selectionStart;
    renderCalendar();
    const input = document.querySelector('[data-friendly-search]');
    input?.setSelectionRange(selection, selection);
  }
}

function onChange(event) {
  if (!modalState) return;
  if (event.target.matches('[data-friendly-venue]')) modalState.venue = event.target.value;
  else if (event.target.matches('[data-friendly-time]')) modalState.time = event.target.value;
  else if (event.target.matches('[data-friendly-rules]')) modalState.rules = event.target.value;
  else return;
  renderCalendar();
}

function onKeydown(event) {
  if (!document.getElementById(SCREEN_ID)) return;
  const key = event.key.toLowerCase();
  if (modalState) {
    if (key === 'escape') { event.preventDefault(); modalState = null; renderCalendar(); }
    if (key === 'enter' && modalState.opponentId && friendlyDateStatus(career, modalState.date, modalState.opponentId).available) { event.preventDefault(); void confirmFriendly(); }
    return;
  }
  if (['escape', 'backspace', 'b'].includes(key)) { event.preventDefault(); location.hash = '#home'; }
  else if (['pageup', '['].includes(key)) { event.preventDefault(); monthAnchor = moveMonth(monthAnchor, -1); selectedFixtureId = null; renderCalendar(); }
  else if (['pagedown', ']'].includes(key)) { event.preventDefault(); monthAnchor = moveMonth(monthAnchor, 1); selectedFixtureId = null; renderCalendar(); }
  else if (['arrowleft', 'arrowup'].includes(key)) { event.preventDefault(); selectFixtureByStep(-1); }
  else if (['arrowright', 'arrowdown'].includes(key)) { event.preventDefault(); selectFixtureByStep(1); }
  else if (['enter', 'x'].includes(key)) { event.preventDefault(); viewSelectedFixture(); }
  else if (key === 'a') { event.preventDefault(); activateSimToDate(); }
}

function start() {
  observer = new MutationObserver(scheduleMount);
  const app = document.querySelector('#app');
  if (app) observer.observe(app, { childList: true, subtree: true });
  window.addEventListener('hashchange', scheduleMount);
  document.addEventListener('click', onClick);
  document.addEventListener('input', onInput);
  document.addEventListener('change', onChange);
  document.addEventListener('keydown', onKeydown);
  scheduleMount();
}

start();

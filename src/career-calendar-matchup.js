import './career-calendar-matchup.css';
import { CLUB_BY_CODE } from './career-core/season-2026-27.js';
import { normalizeCareer, userFixtures } from './career-core/career-core.js';
import { CareerRepository, legacyClubSelection } from './career-core/career-repository.js';

const SCREEN_ID = 'touchline-career-calendar';
let patchPending = false;
let patchGeneration = 0;
let requestedFixtureId = null;

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));

function clubFor(code) {
  return CLUB_BY_CODE.get(code) || CLUB_BY_CODE.values().next().value;
}

function crestMarkup(code, className = '') {
  const club = clubFor(code);
  const slug = String(code || '').toLowerCase();
  const primary = club?.crest || `/assets/clubs/2026-27/${slug}/crest.svg`;
  const fallback = `/assets/clubs/2026-27/${slug}/crest.png`;
  return `<img class="${className}" src="${escapeHtml(primary)}" data-matchup-image-fallback="${escapeHtml(fallback)}" alt="${escapeHtml(club?.name || code)} crest">`;
}

function installImageFallbacks(root) {
  root.querySelectorAll('img[data-matchup-image-fallback]').forEach(image => {
    image.addEventListener('error', () => {
      const fallback = image.dataset.matchupImageFallback;
      if (fallback && image.src !== new URL(fallback, location.href).href) image.src = fallback;
    }, { once: true });
  });
}

function formatFullDate(value) {
  const [year, month, day] = String(value).split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function goalEvents(result, side) {
  return (Array.isArray(result?.events) ? result.events : [])
    .filter(event => event?.type === 'goal' && event.side === side)
    .sort((left, right) => Number(left.minute || 0) - Number(right.minute || 0));
}

function goalListMarkup(result, side) {
  const events = goalEvents(result, side);
  if (!events.length) return '<span class="tcc-goals-empty" aria-hidden="true">—</span>';

  return events.map(event => `
    <div class="tcc-goal-event">
      <span title="${escapeHtml(event.playerName || 'Goal')}">${escapeHtml(event.playerName || 'Goal')}</span>
      <time>${escapeHtml(event.minute)}′</time>
    </div>
  `).join('');
}

function goalsMarkup(result) {
  if (!result) return '';
  const homeEvents = goalEvents(result, 'home');
  const awayEvents = goalEvents(result, 'away');
  const hasEventData = homeEvents.length + awayEvents.length > 0;
  const scoreHasGoals = Number(result.homeGoals || 0) + Number(result.awayGoals || 0) > 0;

  if (!hasEventData && scoreHasGoals) {
    return '<div class="tcc-goals-unavailable">Goal details unavailable for this saved result.</div>';
  }

  if (!scoreHasGoals) {
    return '<div class="tcc-goals-goalless">No goals</div>';
  }

  return `
    <div class="tcc-matchup-goals" aria-label="Goal scorers">
      <div class="tcc-goals-side is-home">${goalListMarkup(result, 'home')}</div>
      <span class="tcc-goals-divider" aria-hidden="true"></span>
      <div class="tcc-goals-side is-away">${goalListMarkup(result, 'away')}</div>
    </div>
  `;
}

function matchupMarkup(career, fixture) {
  const homeClub = clubFor(fixture.home);
  const awayClub = clubFor(fixture.away);
  const result = career.results?.[fixture.id] || null;
  const venue = homeClub?.stadium || '';
  const center = result
    ? `<strong class="tcc-matchup-score" aria-label="${result.homeGoals} to ${result.awayGoals}"><span>${result.homeGoals}</span><i>–</i><span>${result.awayGoals}</span></strong>`
    : '<strong class="tcc-matchup-versus" aria-label="versus">×</strong>';

  return `
    <div class="tcc-matchup-row">
      <div class="tcc-matchup-club ${fixture.home === career.clubCode ? 'is-controlled' : ''}">
        <small>HOME</small>
        <div class="tcc-matchup-crest-shell">${crestMarkup(homeClub.code, 'tcc-matchup-crest')}</div>
        <h3>${escapeHtml(homeClub.shortName || homeClub.name)}</h3>
      </div>

      <div class="tcc-matchup-center">
        ${center}
        <small>${result ? 'FT' : escapeHtml(fixture.time || '15:00')}</small>
      </div>

      <div class="tcc-matchup-club ${fixture.away === career.clubCode ? 'is-controlled' : ''}">
        <small>AWAY</small>
        <div class="tcc-matchup-crest-shell">${crestMarkup(awayClub.code, 'tcc-matchup-crest')}</div>
        <h3>${escapeHtml(awayClub.shortName || awayClub.name)}</h3>
      </div>
    </div>

    ${goalsMarkup(result)}

    <div class="tcc-matchup-context">
      <span>${escapeHtml(venue)}</span>
      <b>${result ? 'Full time' : escapeHtml(fixture.time || '15:00')}</b>
    </div>
  `;
}

function fixtureIdFromScreen(screen) {
  return requestedFixtureId
    || screen.querySelector('.tcc-fixture.is-selected[data-calendar-fixture]')?.dataset.calendarFixture
    || null;
}

function markSelectedFixture(screen, fixtureId) {
  screen.querySelectorAll('[data-calendar-fixture]').forEach(button => {
    const selected = button.dataset.calendarFixture === fixtureId;
    button.classList.toggle('is-selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}

async function patchMatchup(explicitFixtureId = null) {
  const screen = document.getElementById(SCREEN_ID);
  if (!screen || location.hash !== '#calendar') return;

  const panel = screen.querySelector('.tcc-opponent');
  const fixtureId = explicitFixtureId || fixtureIdFromScreen(screen);
  if (!panel || !fixtureId) return;

  const generation = ++patchGeneration;
  const selectedClub = legacyClubSelection();
  if (!selectedClub) return;

  const career = normalizeCareer(await CareerRepository.load(), selectedClub);
  if (generation !== patchGeneration || !document.getElementById(SCREEN_ID)) return;

  const fixture = userFixtures(career).find(item => item.id === fixtureId);
  if (!fixture) return;

  requestedFixtureId = fixtureId;
  markSelectedFixture(screen, fixtureId);

  const date = screen.querySelector('.tcc-selected-date');
  if (date) {
    date.dateTime = fixture.date;
    date.textContent = formatFullDate(fixture.date);
  }

  panel.dataset.matchupFixtureId = fixtureId;
  panel.classList.add('tcc-matchup');
  panel.innerHTML = matchupMarkup(career, fixture);
  installImageFallbacks(panel);
}

function schedulePatch() {
  if (patchPending) return;
  patchPending = true;
  requestAnimationFrame(() => {
    patchPending = false;
    const screen = document.getElementById(SCREEN_ID);
    if (!screen) return;

    const requestedStillVisible = requestedFixtureId
      && screen.querySelector(`[data-calendar-fixture="${CSS.escape(requestedFixtureId)}"]`);
    if (!requestedStillVisible) requestedFixtureId = null;

    patchMatchup();
  });
}

function selectFixtureFromGrid(event) {
  const button = event.target.closest(`#${SCREEN_ID} [data-calendar-fixture]`);
  if (!button) return;

  // The base calendar only accepts fixtures from the anchor month. Intercepting
  // in capture phase lets overflow-day fixtures remain selectable without
  // changing the month currently being viewed.
  event.preventDefault();
  event.stopImmediatePropagation();

  requestedFixtureId = button.dataset.calendarFixture;
  const screen = document.getElementById(SCREEN_ID);
  if (screen) markSelectedFixture(screen, requestedFixtureId);
  patchMatchup(requestedFixtureId);
}

const observer = new MutationObserver(schedulePatch);
observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener('hashchange', () => {
  requestedFixtureId = null;
  schedulePatch();
});
document.addEventListener('click', selectFixtureFromGrid, true);

schedulePatch();

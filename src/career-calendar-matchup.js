import './career-calendar-matchup.css';
import { CLUB_BY_CODE } from './career-core/season-2026-27.js';
import { normalizeCareer, userFixtures } from './career-core/career-core.js';
import { CareerRepository, legacyClubSelection } from './career-core/career-repository.js';

const SCREEN_ID = 'touchline-career-calendar';
let patchPending = false;
let patchGeneration = 0;

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

function scoreForControlledClub(fixture, result, controlledCode) {
  if (!result) return null;
  const controlledAtHome = fixture.home === controlledCode;
  return {
    controlled: controlledAtHome ? result.homeGoals : result.awayGoals,
    opponent: controlledAtHome ? result.awayGoals : result.homeGoals
  };
}

function matchupMarkup(career, fixture) {
  const controlled = clubFor(career.clubCode);
  const controlledAtHome = fixture.home === career.clubCode;
  const opponentCode = controlledAtHome ? fixture.away : fixture.home;
  const opponent = clubFor(opponentCode);
  const result = career.results?.[fixture.id] || null;
  const score = scoreForControlledClub(fixture, result, career.clubCode);
  const venue = controlledAtHome ? controlled?.stadium : opponent?.stadium;
  const status = result ? 'Full time' : (fixture.time || '15:00');
  const center = score
    ? `<strong class="tcc-matchup-score" aria-label="${score.controlled} to ${score.opponent}"><span>${score.controlled}</span><i>–</i><span>${score.opponent}</span></strong>`
    : '<strong class="tcc-matchup-versus" aria-label="versus">×</strong>';

  return `
    <div class="tcc-matchup-row">
      <div class="tcc-matchup-club is-controlled">
        <div class="tcc-matchup-crest-shell">${crestMarkup(controlled.code, 'tcc-matchup-crest')}</div>
        <h3>${escapeHtml(controlled.shortName || controlled.name)}</h3>
      </div>

      <div class="tcc-matchup-center">
        ${center}
        <small>${result ? 'FT' : escapeHtml(fixture.time || '15:00')}</small>
      </div>

      <div class="tcc-matchup-club">
        <div class="tcc-matchup-crest-shell">${crestMarkup(opponent.code, 'tcc-matchup-crest')}</div>
        <h3>${escapeHtml(opponent.shortName || opponent.name)}</h3>
      </div>
    </div>

    <div class="tcc-matchup-context">
      <span>${controlledAtHome ? 'Home' : 'Away'} · ${escapeHtml(venue || '')}</span>
      <b>${status}</b>
    </div>
  `;
}

async function patchMatchup() {
  const screen = document.getElementById(SCREEN_ID);
  if (!screen || location.hash !== '#calendar') return;

  const selectedButton = screen.querySelector('.tcc-fixture.is-selected[data-calendar-fixture]');
  const panel = screen.querySelector('.tcc-opponent');
  const fixtureId = selectedButton?.dataset.calendarFixture;
  if (!panel || !fixtureId || panel.dataset.matchupFixtureId === fixtureId) return;

  const generation = ++patchGeneration;
  const selectedClub = legacyClubSelection();
  if (!selectedClub) return;

  const career = normalizeCareer(await CareerRepository.load(), selectedClub);
  if (generation !== patchGeneration || !document.getElementById(SCREEN_ID)) return;

  const fixture = userFixtures(career).find(item => item.id === fixtureId);
  if (!fixture) return;

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
    patchMatchup();
  });
}

const observer = new MutationObserver(schedulePatch);
observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener('hashchange', schedulePatch);
document.addEventListener('click', event => {
  if (event.target.closest('[data-calendar-fixture]')) setTimeout(schedulePatch, 0);
});

schedulePatch();

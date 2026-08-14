import './career-calendar-result-sync.css';
import { normalizeCareer, userFixtures } from './career-core/career-runtime.js';
import { friendlyResultFor, isFriendlyFixture } from './career-core/friendly-engine.js';
import { CareerRepository, legacyClubSelection } from './career-core/career-repository.js';

const SCREEN_ID = 'touchline-career-calendar';
let refreshQueued = false;
let generation = 0;

function resultSignature(result) {
  if (!result) return 'pending';
  const goals = (Array.isArray(result.events) ? result.events : [])
    .filter(event => event?.type === 'goal')
    .map(event => `${event.side}:${event.minute}:${event.playerId || event.playerName || ''}`)
    .join('|');
  return `${result.homeGoals}-${result.awayGoals}:${goals}`;
}

function fixtureResult(career, fixture) {
  return friendlyResultFor(career, fixture);
}

function updateFixtureCard(button, fixture, result) {
  if (!(button instanceof HTMLElement)) return;
  const signature = resultSignature(result);
  if (button.dataset.resultSyncSignature === signature) return;
  button.dataset.resultSyncSignature = signature;
  button.classList.toggle('is-played', Boolean(result));

  let score = button.querySelector('.tcc-fixture-score');
  if (result) {
    if (!score) {
      score = document.createElement('strong');
      score.className = 'tcc-fixture-score';
      button.append(score);
    }
    score.textContent = `${result.homeGoals}–${result.awayGoals}`;

    const title = button.querySelector('.tcc-fixture-copy > b');
    const subtitle = button.querySelector('.tcc-fixture-copy > small');
    if (title) title.textContent = 'FT';
    if (subtitle) subtitle.textContent = isFriendlyFixture(fixture) ? 'FRIENDLY' : 'LEAGUE';
    button.setAttribute('aria-label', `${button.getAttribute('aria-label')?.replace(/,?\s*placar.*$/i, '') || 'Partida'}, placar ${result.homeGoals} a ${result.awayGoals}`);
  } else {
    score?.remove();
  }
}

function forceSelectedMatchupRefresh(screen, career, fixtures) {
  const selectedButton = screen.querySelector('.tcc-fixture.is-selected[data-calendar-fixture]');
  const fixtureId = selectedButton?.dataset.calendarFixture;
  if (!fixtureId) return;
  const fixture = fixtures.find(item => item.id === fixtureId);
  if (!fixture) return;
  const result = fixtureResult(career, fixture);
  const signature = `${fixtureId}:${resultSignature(result)}`;
  const panel = screen.querySelector('.tcc-opponent');
  if (!panel || panel.dataset.resultSyncSignature === signature) return;

  panel.dataset.resultSyncSignature = signature;
  // career-calendar-matchup.js intentionally avoids repainting the same fixture.
  // Clearing this id only when the persisted result signature changes makes the
  // existing matchup renderer refresh FT score + scorer/minute data exactly once.
  panel.dataset.matchupFixtureId = '';
  const marker = document.createElement('i');
  marker.hidden = true;
  marker.dataset.calendarResultRefresh = signature;
  screen.append(marker);
  queueMicrotask(() => marker.remove());
}

async function refreshResults() {
  refreshQueued = false;
  if (location.hash !== '#calendar') return;
  const screen = document.getElementById(SCREEN_ID);
  const selectedClub = legacyClubSelection();
  if (!screen || !selectedClub) return;

  const currentGeneration = ++generation;
  const career = normalizeCareer(await CareerRepository.load(), selectedClub);
  if (currentGeneration !== generation || location.hash !== '#calendar') return;
  const activeScreen = document.getElementById(SCREEN_ID);
  if (!activeScreen) return;

  const fixtures = userFixtures(career);
  const fixtureById = new Map(fixtures.map(fixture => [fixture.id, fixture]));
  let screenSignature = '';

  activeScreen.querySelectorAll('[data-calendar-fixture]').forEach(button => {
    const fixture = fixtureById.get(button.dataset.calendarFixture);
    if (!fixture) return;
    const result = fixtureResult(career, fixture);
    updateFixtureCard(button, fixture, result);
    screenSignature += `${fixture.id}:${resultSignature(result)};`;
  });

  activeScreen.dataset.calendarResultSignature = screenSignature;
  forceSelectedMatchupRefresh(activeScreen, career, fixtures);
}

function scheduleRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(refreshResults);
}

const observer = new MutationObserver(records => {
  if (location.hash !== '#calendar') return;
  if (records.some(record => [...record.addedNodes].some(node => node instanceof Element))) scheduleRefresh();
});
observer.observe(document.body, { childList: true, subtree: true });

window.addEventListener('hashchange', scheduleRefresh);
window.addEventListener('pageshow', scheduleRefresh);
window.addEventListener('touchline:career-updated', scheduleRefresh);

scheduleRefresh();

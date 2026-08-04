import './career-home-image-fix.css';
import { CLUB_BY_CODE } from './career-core/season-2026-27.js';
import { nextUserFixture } from './career-core/career-core.js';
import { CareerRepository } from './career-core/career-repository.js';
import { stadiumAssetCandidates } from './career-core/stadium-assets.js';

const app = document.querySelector('#app');
const imageState = new WeakMap();
let refreshQueued = false;
let refreshVersion = 0;

function isCareerHome() {
  const route = window.location.hash.replace('#', '');
  return !route || route === 'home';
}

function absoluteUrl(path) {
  return new URL(path, window.location.href).href;
}

function installFallbackCycle(image, candidates) {
  image.removeAttribute('data-fallback');
  image.dataset.stadiumCandidates = candidates.join('|');
  image.dataset.stadiumCandidateIndex = '0';
  imageState.set(image, { candidates, index: 0 });
}

function useCandidate(image, index) {
  const state = imageState.get(image);
  if (!state || index >= state.candidates.length) return false;
  state.index = index;
  image.dataset.stadiumCandidateIndex = String(index);
  const next = absoluteUrl(state.candidates[index]);
  if (image.src !== next) image.src = state.candidates[index];
  return true;
}

function handleImageError(event) {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || !image.matches('.tl-match-bg[data-stadium-candidates]')) return;
  const state = imageState.get(image);
  if (!state) return;
  useCandidate(image, state.index + 1);
}

function candidatesForClub(clubCode) {
  const standard = stadiumAssetCandidates(clubCode);
  if (clubCode !== 'HUL') return standard;
  return [
    '/assets/clubs/2026-27/hul/stadium-custom.svg',
    ...standard.filter(candidate => !candidate.endsWith('/stadium-custom.svg'))
  ];
}

async function refreshHomeStadium() {
  refreshQueued = false;
  if (!isCareerHome()) return;

  const version = ++refreshVersion;
  const image = document.querySelector('.tl-match-bg');
  if (!image) return;

  const career = await CareerRepository.load();
  if (version !== refreshVersion || !career || !image.isConnected || !isCareerHome()) return;

  const fixture = nextUserFixture(career);
  if (!fixture) return;

  const homeClub = CLUB_BY_CODE.get(fixture.home);
  if (!homeClub) return;

  const candidates = candidatesForClub(homeClub.code);
  if (version !== refreshVersion || !image.isConnected || !isCareerHome()) return;

  installFallbackCycle(image, candidates);
  image.dataset.venueClub = homeClub.code;
  image.alt = homeClub.stadium || homeClub.name;
  useCandidate(image, 0);
}

function scheduleRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  queueMicrotask(refreshHomeStadium);
}

window.addEventListener('error', handleImageError, true);
window.addEventListener('hashchange', scheduleRefresh);

const observer = new MutationObserver(scheduleRefresh);
observer.observe(app, { childList: true, subtree: true });

scheduleRefresh();

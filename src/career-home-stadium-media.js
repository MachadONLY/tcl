import './career-home-image-fix.css';
import { CLUB_BY_CODE } from './career-core/season-2026-27.js';
import { nextUserFixture, normalizeCareer } from './career-core/career-runtime.js';
import { resolveFriendlyClub } from './career-core/friendly-engine.js';
import { CareerRepository, legacyClubSelection } from './career-core/career-repository.js';
import { stadiumAssetCandidates } from './career-core/stadium-assets.js';
import { cachedClubStadiumMedia, resolveClubStadiumMedia } from './career-core/stadium-media-service.js';

const app = document.querySelector('#app');
const EMPTY_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
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

function clearWrongBackground(image) {
  imageState.delete(image);
  image.removeAttribute('data-fallback');
  image.removeAttribute('data-stadium-candidates');
  image.removeAttribute('data-stadium-source');
  image.classList.add('is-stadium-resolving');
  image.src = EMPTY_IMAGE;
}

function installFallbackCycle(image, candidates, metadata = {}) {
  const unique = [...new Set((candidates || []).filter(Boolean))];
  image.removeAttribute('data-fallback');
  image.dataset.stadiumCandidates = unique.join('|');
  image.dataset.stadiumCandidateIndex = '0';
  image.dataset.stadiumSource = metadata.source || 'local';
  imageState.set(image, {
    candidates: unique,
    index: 0,
    club: metadata.club || null,
    homeReference: metadata.homeReference || null,
    retryingOnline: false
  });
}

function useCandidate(image, index) {
  const state = imageState.get(image);
  if (!state || index >= state.candidates.length) return false;
  state.index = index;
  image.dataset.stadiumCandidateIndex = String(index);
  image.classList.add('is-stadium-resolving');
  const next = absoluteUrl(state.candidates[index]);
  if (image.src !== next) image.src = state.candidates[index];
  return true;
}

async function recoverOnlineStadium(image, state) {
  if (!state?.club || state.retryingOnline || !image.isConnected) return;
  state.retryingOnline = true;
  try {
    const media = await resolveClubStadiumMedia(state.club, { bypassCache: true, preferWikipedia: true });
    if (!media?.url || !image.isConnected) return;
    const currentUrls = new Set(state.candidates.map(absoluteUrl));
    if (currentUrls.has(absoluteUrl(media.url))) return;
    installFallbackCycle(image, [media.url], {
      source: media.source,
      club: state.club,
      homeReference: state.homeReference
    });
    image.alt = media.stadiumName || state.club.stadium || `${state.club.name} stadium`;
    useCandidate(image, 0);
  } finally {
    state.retryingOnline = false;
  }
}

function handleImageError(event) {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || !image.matches('.tl-match-bg[data-stadium-candidates]')) return;
  const state = imageState.get(image);
  if (!state) return;
  if (useCandidate(image, state.index + 1)) return;

  image.src = EMPTY_IMAGE;
  image.classList.add('is-stadium-resolving');
  void recoverOnlineStadium(image, state);
}

function handleImageLoad(event) {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || !image.matches('.tl-match-bg')) return;
  if (image.src === absoluteUrl(EMPTY_IMAGE)) return;
  image.classList.remove('is-stadium-resolving');
  image.classList.add('is-stadium-ready');
}

async function refreshHomeStadium() {
  refreshQueued = false;
  if (!isCareerHome()) return;

  const version = ++refreshVersion;
  const image = document.querySelector('.tl-match-bg');
  if (!image) return;

  // The markup may momentarily contain the save club's old image. Blank it before
  // any async work so an away/home switch can never flash the wrong stadium.
  clearWrongBackground(image);

  const selected = legacyClubSelection() || 'MUN';
  const loaded = await CareerRepository.load();
  const career = normalizeCareer(loaded, selected);
  if (version !== refreshVersion || !career || !image.isConnected || !isCareerHome()) return;

  const fixture = nextUserFixture(career);
  if (!fixture) return;

  // Global invariant: the photograph belongs to fixture.home, independently of
  // the user's club, save, competition or friendly venue metadata.
  const homeReference = fixture.home;
  const homeClub = CLUB_BY_CODE.get(homeReference) || resolveFriendlyClub(career, homeReference);
  if (!homeClub?.name) return;

  image.dataset.venueClub = String(homeReference);
  image.dataset.stadiumHomeReference = String(homeReference);
  image.alt = homeClub.stadium || `${homeClub.name} stadium`;

  if (CLUB_BY_CODE.has(homeReference)) {
    const localCandidates = stadiumAssetCandidates(homeReference);
    installFallbackCycle(image, localCandidates, { source: 'local-home-club', club: homeClub, homeReference });
    useCandidate(image, 0);
    return;
  }

  const cached = cachedClubStadiumMedia(homeClub);
  const media = cached || await resolveClubStadiumMedia(homeClub);
  if (version !== refreshVersion || !image.isConnected || !isCareerHome()) return;

  if (!media?.url) {
    // Never substitute the user's stadium or another club's stadium. A dark card
    // is preferable to lying visually about the home venue.
    image.dataset.stadiumSource = 'unresolved-home-club';
    image.classList.add('is-stadium-resolving');
    return;
  }

  image.alt = media.stadiumName || homeClub.stadium || `${homeClub.name} stadium`;
  installFallbackCycle(image, [media.url], {
    source: media.source,
    club: homeClub,
    homeReference
  });
  useCandidate(image, 0);
}

function scheduleRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  queueMicrotask(refreshHomeStadium);
}

window.addEventListener('error', handleImageError, true);
window.addEventListener('load', handleImageLoad, true);
window.addEventListener('hashchange', scheduleRefresh);
window.addEventListener('touchline:career-updated', scheduleRefresh);

const observer = new MutationObserver(scheduleRefresh);
observer.observe(app, { childList: true, subtree: true });

scheduleRefresh();

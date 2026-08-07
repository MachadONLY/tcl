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

function revealWhenLoaded(image, expectedUrl) {
  const reveal = () => {
    if (!image.isConnected || image.src !== expectedUrl || !image.naturalWidth) return;
    image.classList.remove('is-stadium-resolving');
    image.classList.add('is-stadium-ready');
  };

  image.addEventListener('load', reveal, { once: true });
  if (image.complete && image.naturalWidth && image.src === expectedUrl) reveal();
}

function clearWrongBackground(image) {
  imageState.delete(image);
  image.removeAttribute('data-fallback');
  image.removeAttribute('data-stadium-candidates');
  image.removeAttribute('data-stadium-source');
  image.classList.remove('is-stadium-ready');
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
  image.classList.remove('is-stadium-ready');
  image.classList.add('is-stadium-resolving');

  const path = state.candidates[index];
  const expectedUrl = absoluteUrl(path);
  revealWhenLoaded(image, expectedUrl);

  if (image.src !== expectedUrl) image.src = path;
  else if (image.complete && image.naturalWidth) {
    image.classList.remove('is-stadium-resolving');
    image.classList.add('is-stadium-ready');
  }
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
  image.classList.remove('is-stadium-ready');
  image.classList.add('is-stadium-resolving');
  void recoverOnlineStadium(image, state);
}

function handleImageLoad(event) {
  const image = event.target;
  if (!(image instanceof HTMLImageElement) || !image.matches('.tl-match-bg')) return;
  if (image.src === absoluteUrl(EMPTY_IMAGE) || !image.naturalWidth) return;
  image.classList.remove('is-stadium-resolving');
  image.classList.add('is-stadium-ready');
}

async function refreshHomeStadium() {
  refreshQueued = false;
  if (!isCareerHome()) return;

  const version = ++refreshVersion;
  const image = document.querySelector('.tl-match-bg');
  if (!image) return;

  const selected = legacyClubSelection() || 'MUN';
  const loaded = await CareerRepository.load();
  const career = normalizeCareer(loaded, selected);
  if (version !== refreshVersion || !career || !image.isConnected || !isCareerHome()) return;

  const fixture = nextUserFixture(career);
  if (!fixture) return;

  // Universal rule: the fixture's home team owns the background image.
  const homeReference = fixture.home;
  const homeClub = CLUB_BY_CODE.get(homeReference) || resolveFriendlyClub(career, homeReference);
  if (!homeClub?.name) return;

  image.dataset.venueClub = String(homeReference);
  image.dataset.stadiumHomeReference = String(homeReference);
  image.alt = homeClub.stadium || `${homeClub.name} stadium`;

  // Premier League clubs already have verified local stadium photography.
  // Do not blank a correct local image while the save is loading: install the
  // local candidates immediately and reveal as soon as the browser confirms it.
  if (CLUB_BY_CODE.has(homeReference)) {
    const localCandidates = stadiumAssetCandidates(homeReference);
    installFallbackCycle(image, localCandidates, {
      source: 'local-home-club',
      club: homeClub,
      homeReference
    });
    useCandidate(image, 0);
    return;
  }

  // External friendly opponents have no bundled stadium pack. Only at this
  // point do we remove the markup fallback, because it may belong to the save
  // club. We then resolve the actual home club's stadium from verified media.
  const cached = cachedClubStadiumMedia(homeClub);
  if (!cached?.url) clearWrongBackground(image);

  const media = cached || await resolveClubStadiumMedia(homeClub);
  if (version !== refreshVersion || !image.isConnected || !isCareerHome()) return;

  if (!media?.url) {
    image.dataset.stadiumSource = 'unresolved-home-club';
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

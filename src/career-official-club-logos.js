import './career-official-club-logos.css';
import { EUROPEAN_CLUBS } from './career-core/european-club-catalog.js';
import { OFFICIAL_CLUB_LOGO_MANIFEST } from './career-core/official-club-logo-manifest.js';
import { normalizeClubLogoKey, resolveOfficialClubLogo } from './career-core/official-club-logo-service.js';

const TARGET_SELECTORS = [
  '.tcc-external-crest',
  '.cp-external-crest',
  '.tl-team img[src^="data:image/svg+xml"]',
  '.tl-match-center img[src^="data:image/svg+xml"]'
];
const TARGET_SELECTOR = TARGET_SELECTORS.join(',');
const FALLBACK_SELECTOR = TARGET_SELECTORS
  .map(selector => `${selector}[data-official-logo-state="fallback"]`)
  .join(',');

const CLUB_BY_NAME = new Map();
for (const club of EUROPEAN_CLUBS) {
  for (const name of [club.name, club.shortName]) {
    const key = normalizeClubLogoKey(name);
    if (key && !CLUB_BY_NAME.has(key)) CLUB_BY_NAME.set(key, club);
  }
}

const MANIFEST_BY_NAME = new Map();
for (const [id, entry] of Object.entries(OFFICIAL_CLUB_LOGO_MANIFEST)) {
  for (const name of [entry?.name, entry?.sourceName]) {
    const key = normalizeClubLogoKey(name);
    if (key && !MANIFEST_BY_NAME.has(key)) MANIFEST_BY_NAME.set(key, { id, entry });
  }
}

const queued = new WeakSet();

function textOf(root, selector) {
  return root?.querySelector(selector)?.textContent?.trim() || '';
}

function clubNameFromNode(node) {
  const explicit = node.dataset.officialClubName || node.getAttribute('alt');
  if (explicit && !/^crest$/i.test(explicit)) return explicit.replace(/\s+crest$/i, '').trim();

  const clubOption = node.closest('.tcc-club-option');
  if (clubOption) return textOf(clubOption, 'span > b') || textOf(clubOption, 'b');

  const selectedOpponent = node.closest('.tcc-opponent');
  if (selectedOpponent) return textOf(selectedOpponent, 'h2');

  const fixture = node.closest('.tcc-fixture');
  if (fixture) {
    const label = fixture.getAttribute('aria-label') || '';
    const match = label.match(/contra\s+(.+?),\s+(?:segunda|terça|quarta|quinta|sexta|sábado|domingo|\d)/i);
    if (match?.[1]) return match[1].trim();
  }

  const playableTeam = node.closest('.cp-fixture > div, .cp-match header > div, .cp-fulltime span');
  if (playableTeam) return textOf(playableTeam, 'b');

  const playableRow = node.closest('.cp-last > div, .cp-upcoming > div, .cp-calendar article');
  if (playableRow) return textOf(playableRow, 'span > b') || textOf(playableRow, 'span');

  const homeTeam = node.closest('.tl-team');
  if (homeTeam) return textOf(homeTeam, 'h2');

  return '';
}

function metadataFor(name, node) {
  const catalog = CLUB_BY_NAME.get(normalizeClubLogoKey(name));
  if (catalog) return catalog;
  const activeCountry = textOf(document, '.tcc-country-list .is-active span');
  const league = textOf(node.closest('.tcc-club-option'), 'small');
  return {
    id: normalizeClubLogoKey(name).replace(/\s+/g, '-'),
    name,
    shortName: name,
    country: activeCountry,
    league,
    internal: false
  };
}

function staticLogoFor(name, club) {
  const direct = club?.id ? OFFICIAL_CLUB_LOGO_MANIFEST[club.id] : null;
  const byName = MANIFEST_BY_NAME.get(normalizeClubLogoKey(name))?.entry || null;
  const entry = direct || byName;
  if (!entry || typeof entry.logoUrl !== 'string' || !/^https:\/\//i.test(entry.logoUrl)) return null;
  return {
    url: entry.logoUrl,
    source: entry.provider || 'Official club logo manifest',
    providerId: entry.providerId || null,
    resolvedName: entry.sourceName || entry.name || name
  };
}

function imageReady(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function installLogo(node, name, logo, { dynamicFallback = false } = {}) {
  if (!node?.isConnected || !logo?.url) return null;

  const image = node instanceof HTMLImageElement ? node : document.createElement('img');
  if (!(node instanceof HTMLImageElement)) {
    image.className = node.className;
    node.replaceWith(image);
  }

  image.classList.add('tl-official-club-logo');
  image.alt = `${name} crest`;
  image.loading = 'eager';
  image.decoding = 'async';
  image.referrerPolicy = 'no-referrer';
  image.dataset.officialClubName = name;
  image.dataset.officialLogoSource = logo.source || 'official';
  image.dataset.officialLogoState = 'loading';

  const loaded = () => {
    image.dataset.officialLogoState = 'loaded';
    image.removeEventListener('load', loaded);
    image.removeEventListener('error', failed);
  };
  const failed = () => {
    image.removeEventListener('load', loaded);
    image.removeEventListener('error', failed);
    image.dataset.officialLogoState = 'loading';
    if (dynamicFallback) void upgrade(image, { skipStatic: true });
    else image.dataset.officialLogoState = 'fallback';
  };

  image.addEventListener('load', loaded, { once: true });
  image.addEventListener('error', failed, { once: true });
  image.src = logo.url;
  if (image.complete && image.naturalWidth > 0) loaded();
  return image;
}

async function upgrade(node, { skipStatic = false } = {}) {
  if (!node?.isConnected) return;
  const name = clubNameFromNode(node);
  if (!name) {
    node.dataset.officialLogoState = 'missing-name';
    return;
  }

  node.dataset.officialLogoState = 'loading';
  const club = metadataFor(name, node);
  const lookupClub = skipStatic ? { ...club, id: null } : club;
  const logo = await resolveOfficialClubLogo(lookupClub);
  if (!logo?.url || !node.isConnected) {
    node.dataset.officialLogoState = 'fallback';
    return;
  }

  try {
    await imageReady(logo.url);
    if (!node.isConnected) return;
    installLogo(node, name, logo, { dynamicFallback: false });
  } catch {
    node.dataset.officialLogoState = 'fallback';
  }
}

const visibilityObserver = 'IntersectionObserver' in globalThis
  ? new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        visibilityObserver.unobserve(entry.target);
        void upgrade(entry.target);
      }
    }, { rootMargin: '280px 160px' })
  : null;

function queueNode(node) {
  if (!(node instanceof Element) || queued.has(node)) return;
  queued.add(node);

  const name = clubNameFromNode(node);
  if (name) {
    const club = metadataFor(name, node);
    const staticLogo = staticLogoFor(name, club);
    if (staticLogo) {
      installLogo(node, name, staticLogo, { dynamicFallback: true });
      return;
    }
  }

  node.dataset.officialLogoState = 'queued';
  if (visibilityObserver) visibilityObserver.observe(node);
  else void upgrade(node);
}

function scan(root = document) {
  if (root instanceof Element && root.matches(TARGET_SELECTOR)) queueNode(root);
  root.querySelectorAll?.(TARGET_SELECTOR).forEach(queueNode);
}

const domObserver = new MutationObserver(records => {
  for (const record of records) {
    for (const node of record.addedNodes) if (node instanceof Element) scan(node);
  }
});

domObserver.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('online', () => {
  document.querySelectorAll(FALLBACK_SELECTOR).forEach(node => void upgrade(node, { skipStatic: true }));
});

scan();

export { scan as hydrateOfficialClubLogos };

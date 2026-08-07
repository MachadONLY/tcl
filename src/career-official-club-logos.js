import './career-official-club-logos.css';
import { EUROPEAN_CLUBS } from './career-core/european-club-catalog.js';
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

const CLUB_BY_NAME = new Map(EUROPEAN_CLUBS.map(club => [normalizeClubLogoKey(club.name), club]));
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

async function upgrade(node) {
  if (!node?.isConnected) return;
  const name = clubNameFromNode(node);
  if (!name) {
    node.dataset.officialLogoState = 'missing-name';
    return;
  }

  node.dataset.officialLogoState = 'loading';
  const club = metadataFor(name, node);
  const logo = await resolveOfficialClubLogo(club);
  if (!logo?.url || !node.isConnected) {
    node.dataset.officialLogoState = 'fallback';
    return;
  }

  try {
    await imageReady(logo.url);
    if (!node.isConnected) return;
    if (node instanceof HTMLImageElement) {
      node.src = logo.url;
      node.alt = `${name} crest`;
      node.loading = 'lazy';
      node.decoding = 'async';
      node.referrerPolicy = 'no-referrer';
      node.classList.add('tl-official-club-logo');
      node.dataset.officialLogoSource = logo.source;
      node.dataset.officialLogoState = 'loaded';
      return;
    }

    const image = document.createElement('img');
    image.className = `${node.className} tl-official-club-logo`;
    image.src = logo.url;
    image.alt = `${name} crest`;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
    image.dataset.officialLogoSource = logo.source;
    image.dataset.officialLogoState = 'loaded';
    node.replaceWith(image);
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
  document.querySelectorAll(FALLBACK_SELECTOR).forEach(node => void upgrade(node));
});

scan();

export { scan as hydrateOfficialClubLogos };

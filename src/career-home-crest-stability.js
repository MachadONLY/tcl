import './career-home-crest-stability.css';
import { CLUB_BY_CODE } from './career-core/season-2026-27.js';
import { EUROPEAN_CLUBS } from './career-core/european-club-catalog.js';
import { OFFICIAL_CLUB_LOGO_MANIFEST } from './career-core/official-club-logo-manifest.js';
import { normalizeClubLogoKey } from './career-core/official-club-logo-service.js';

const INTERNAL_BY_NAME = new Map();
for (const [code, club] of CLUB_BY_CODE.entries()) {
  for (const value of [club?.name, club?.shortName]) {
    const key = normalizeClubLogoKey(value);
    if (key) INTERNAL_BY_NAME.set(key, { code, club });
  }
}

const EUROPEAN_BY_NAME = new Map();
for (const club of EUROPEAN_CLUBS) {
  for (const value of [club?.name, club?.shortName]) {
    const key = normalizeClubLogoKey(value);
    if (key && !EUROPEAN_BY_NAME.has(key)) EUROPEAN_BY_NAME.set(key, club);
  }
}

const MANIFEST_BY_NAME = new Map();
for (const [id, entry] of Object.entries(OFFICIAL_CLUB_LOGO_MANIFEST)) {
  for (const value of [entry?.name, entry?.sourceName]) {
    const key = normalizeClubLogoKey(value);
    if (key && !MANIFEST_BY_NAME.has(key)) MANIFEST_BY_NAME.set(key, { id, entry });
  }
}

function crestForName(name) {
  const key = normalizeClubLogoKey(name);
  const internal = INTERNAL_BY_NAME.get(key);
  if (internal) {
    return {
      url: `/assets/clubs/2026-27/${internal.code.toLowerCase()}/crest.svg`,
      source: 'local-official'
    };
  }

  const european = EUROPEAN_BY_NAME.get(key);
  const manifest = (european?.id && OFFICIAL_CLUB_LOGO_MANIFEST[european.id])
    || MANIFEST_BY_NAME.get(key)?.entry
    || null;
  if (manifest?.logoUrl && /^https:\/\//i.test(manifest.logoUrl)) {
    return { url: manifest.logoUrl, source: manifest.provider || 'official-manifest' };
  }
  return null;
}

function fallbackNode(name) {
  const fallback = document.createElement('span');
  fallback.className = 'tcc-external-crest tl-home-fallback-crest';
  fallback.dataset.officialClubName = name;
  fallback.dataset.officialLogoState = 'queued';
  fallback.setAttribute('aria-label', `${name} crest`);
  return fallback;
}

function officialImage(name, crest) {
  const image = document.createElement('img');
  image.className = 'tl-home-official-crest';
  image.alt = `${name} crest`;
  image.loading = 'eager';
  image.decoding = 'async';
  image.referrerPolicy = 'no-referrer';
  image.dataset.officialClubName = name;
  image.dataset.officialLogoSource = crest.source;
  image.src = crest.url;
  image.addEventListener('error', () => {
    const shell = image.closest('.tl-home-crest-shell');
    if (shell && image.isConnected) shell.replaceChildren(fallbackNode(name));
  }, { once: true });
  return image;
}

function normalizeTeam(team) {
  if (!(team instanceof HTMLElement)) return;
  const heading = team.querySelector(':scope > h2');
  const subtitle = team.querySelector(':scope > small');
  const name = heading?.textContent?.trim();
  if (!heading || !subtitle || !name) return;

  const key = normalizeClubLogoKey(name);
  if (team.dataset.homeCrestNormalized === key) return;
  team.dataset.homeCrestNormalized = key;

  const shell = document.createElement('span');
  shell.className = 'tl-home-crest-shell';
  const crest = crestForName(name);
  shell.append(crest ? officialImage(name, crest) : fallbackNode(name));

  // Rebuilding the three intended children also removes fragments created by
  // legacy unescaped SVG data URIs (for example visible `alt=...` text).
  team.replaceChildren(shell, heading, subtitle);
}

function scan(root = document) {
  if (root instanceof Element && root.matches('.tl-match-center .tl-team')) normalizeTeam(root);
  root.querySelectorAll?.('.tl-match-center .tl-team').forEach(normalizeTeam);
}

let scanQueued = false;
function scheduleScan() {
  if (scanQueued) return;
  scanQueued = true;
  requestAnimationFrame(() => {
    scanQueued = false;
    scan();
  });
}

const observer = new MutationObserver(records => {
  if (records.some(record => [...record.addedNodes].some(node => node instanceof Element))) scheduleScan();
});
observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener('hashchange', scheduleScan);

scan();

import './career-squad-faces.css';
import { PLAYER_BY_ID } from './career-core/career-core.js';

const MANIFEST_URL = '/assets/players/2026-27/manifest.json';
const FALLBACK_URL = '/assets/players/player-placeholder.svg';
const app = document.querySelector('#app');
let manifestPromise = null;
let queued = false;

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.'’`-]/g, ' ')
    .replace(/\b(jr|junior|sr|ii|iii|iv)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function loadManifest() {
  if (manifestPromise) return manifestPromise;
  manifestPromise = fetch(MANIFEST_URL, { cache: 'no-cache' })
    .then(response => response.ok ? response.json() : { players: {} })
    .catch(() => ({ players: {} }));
  return manifestPromise;
}

function findPortrait(manifest, player) {
  const exact = manifest.players?.[player.id];
  if (exact?.localPath) return exact.localPath;

  const normalized = normalize(player.name);
  const clubRows = Object.values(manifest.players || {}).filter(row => row.clubCode === player.clubCode);
  const matched = clubRows.find(row => normalize(row.name) === normalized);
  return matched?.localPath || FALLBACK_URL;
}

async function enhanceSquad() {
  queued = false;
  const rows = [...document.querySelectorAll('.cp-squad > button[data-player]')];
  if (!rows.length) return;

  const manifest = await loadManifest();
  for (const row of rows) {
    if (row.dataset.faceReady === 'true') continue;
    const player = PLAYER_BY_ID.get(row.dataset.player);
    const playerCell = row.querySelector('.cp-player');
    if (!player || !playerCell) continue;

    const oldNumber = playerCell.querySelector(':scope > i');
    const portrait = document.createElement('span');
    portrait.className = 'cp-player-photo';
    portrait.innerHTML = `<img src="${findPortrait(manifest, player)}" alt="${player.name}" loading="lazy" decoding="async"><small>${player.number}</small>`;
    portrait.querySelector('img').addEventListener('error', event => {
      if (!event.currentTarget.src.endsWith('player-placeholder.svg')) event.currentTarget.src = FALLBACK_URL;
    }, { once: true });

    oldNumber?.replaceWith(portrait);
    row.dataset.faceReady = 'true';
  }
}

function scheduleEnhance() {
  if (queued) return;
  queued = true;
  queueMicrotask(enhanceSquad);
}

const observer = new MutationObserver(scheduleEnhance);
observer.observe(app, { childList: true, subtree: true });
window.addEventListener('hashchange', scheduleEnhance);
scheduleEnhance();

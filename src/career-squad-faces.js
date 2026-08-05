import './career-squad-faces.css';
import { PLAYER_BY_ID } from './career-core/career-core.js';

const MANIFEST_URL = '/assets/players/2026-27/manifest.json';
const FALLBACK_URL = '/assets/players/player-placeholder.svg';
const app = document.querySelector('#app');
let manifestPromise = null;
let queued = false;

function loadManifest() {
  if (manifestPromise) return manifestPromise;
  manifestPromise = fetch(`${MANIFEST_URL}?v=3`, { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error(`manifest HTTP ${response.status}`);
      return response.json();
    })
    .then(manifest => {
      if (manifest.source !== 'fotmob-official-full-squads' || manifest.coverage !== 1) {
        throw new Error('pacote FotMob integral incompleto');
      }
      return manifest;
    })
    .catch(error => {
      console.error('Touchline player faces:', error.message);
      return { players: {} };
    });
  return manifestPromise;
}

function exactPortrait(manifest, player) {
  const record = manifest.players?.[player.id];
  if (!record) return null;
  if (record.playerId !== player.id || record.clubCode !== player.clubCode) return null;
  if (!record.fotmobId || !record.localPath) return null;
  if (record.remoteUrl !== `https://images.fotmob.com/image_resources/playerimages/${record.fotmobId}.png`) return null;
  return record.localPath;
}

function createPortrait(player, source) {
  const portrait = document.createElement('span');
  portrait.className = 'cp-player-photo';

  const image = document.createElement('img');
  image.src = source || FALLBACK_URL;
  image.alt = player.name;
  image.loading = 'lazy';
  image.decoding = 'async';
  image.dataset.fotmobPortrait = source ? 'exact' : 'missing';
  image.addEventListener('error', () => {
    image.src = FALLBACK_URL;
    image.dataset.fotmobPortrait = 'failed';
  }, { once: true });

  portrait.append(image);
  return portrait;
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
    oldNumber?.replaceWith(createPortrait(player, exactPortrait(manifest, player)));
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

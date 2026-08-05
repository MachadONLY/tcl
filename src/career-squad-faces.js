import './career-squad-faces.css';
import { CLUB_BY_CODE } from './career-core/season-2026-27.js';
import { PLAYER_BY_ID } from './career-core/career-core.js';

const MANIFEST_URL = '/assets/players/2026-27/manifest.json';
const FALLBACK_URL = '/assets/players/player-placeholder.svg';
const GROUP_ORDER = Object.freeze({ GK: 0, DEF: 1, MID: 2, FWD: 3 });
const GROUP_LABELS = Object.freeze({ GK: 'Goleiros', DEF: 'Defensores', MID: 'Meio-campistas', FWD: 'Atacantes' });
const app = document.querySelector('#app');
let manifestPromise = null;
let queued = false;

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function loadManifest() {
  if (manifestPromise) return manifestPromise;
  manifestPromise = fetch(`${MANIFEST_URL}?v=7`, { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error(`manifest HTTP ${response.status}`);
      return response.json();
    })
    .then(manifest => {
      if (manifest.source !== 'fotmob-official-full-squads' || manifest.coverage !== 1 || manifest.schemaVersion < 7) {
        throw new Error('pacote oficial de elenco incompleto ou antigo');
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
  if (!record || record.playerId !== player.id || record.clubCode !== player.clubCode) return null;
  return record.fotmobId && record.localPath ? record.localPath : null;
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

function createManagerRow(clubCode) {
  const club = CLUB_BY_CODE.get(clubCode);
  if (!club) return null;
  const row = document.createElement('div');
  row.className = 'cp-squad-coach';
  row.dataset.staff = 'manager';

  const identity = document.createElement('span');
  identity.className = 'cp-player';
  const portrait = document.createElement('span');
  portrait.className = 'cp-player-photo cp-manager-photo';
  const image = document.createElement('img');
  image.src = `/assets/clubs/2026-27/${clubCode.toLowerCase()}/manager.webp`;
  image.alt = club.manager || `Técnico do ${club.name}`;
  image.decoding = 'async';
  image.addEventListener('error', () => {
    image.src = `/assets/clubs/2026-27/${clubCode.toLowerCase()}/crest.png`;
  }, { once: true });
  const name = document.createElement('b');
  name.textContent = club.manager || 'Técnico';
  portrait.append(image);
  identity.append(portrait, name);
  row.append(identity);

  for (const value of ['Técnico', '—', '—', '—', '—', '—', 'Comissão']) {
    const cell = document.createElement('span');
    cell.textContent = value;
    row.append(cell);
  }
  return row;
}

function createGroupHeader(group, count) {
  const header = document.createElement('div');
  header.className = 'cp-squad-section';
  header.dataset.group = group;
  header.innerHTML = `<b>${GROUP_LABELS[group] || group}</b><span>${count}</span>`;
  return header;
}

function orderSquadRows(rows) {
  const squad = rows[0]?.parentElement;
  if (!squad) return;
  const entries = rows
    .map(row => ({ row, player: PLAYER_BY_ID.get(row.dataset.player) }))
    .filter(entry => entry.player);
  if (!entries.length) return;

  const clubCode = entries[0].player.clubCode;
  const managerName = normalize(CLUB_BY_CODE.get(clubCode)?.manager);
  const players = entries
    .filter(entry => normalize(entry.player.name) !== managerName)
    .sort((left, right) =>
      (GROUP_ORDER[left.player.group] ?? 99) - (GROUP_ORDER[right.player.group] ?? 99) ||
      right.player.rating - left.player.rating ||
      left.player.name.localeCompare(right.player.name, 'pt-BR')
    );
  const key = players.map(entry => `${entry.player.id}:${entry.player.group}:${entry.player.rating}`).join('|');
  if (squad.dataset.orderedKey === key) return;

  const fragment = document.createDocumentFragment();
  const manager = createManagerRow(clubCode);
  if (manager) fragment.append(manager);
  for (const group of ['GK', 'DEF', 'MID', 'FWD']) {
    const members = players.filter(entry => entry.player.group === group);
    if (!members.length) continue;
    fragment.append(createGroupHeader(group, members.length));
    for (const member of members) fragment.append(member.row);
  }
  squad.replaceChildren(fragment);
  squad.dataset.orderedKey = key;
}

async function enhanceSquad() {
  queued = false;
  const rows = [...document.querySelectorAll('.cp-squad > button[data-player]')];
  if (!rows.length) return;
  const manifest = await loadManifest();
  for (const row of rows) {
    const player = PLAYER_BY_ID.get(row.dataset.player);
    const playerCell = row.querySelector('.cp-player');
    if (!player || !playerCell) continue;
    if (row.dataset.faceReady !== 'true') {
      const oldNumber = playerCell.querySelector(':scope > i');
      oldNumber?.replaceWith(createPortrait(player, exactPortrait(manifest, player)));
      row.dataset.faceReady = 'true';
    }
  }
  orderSquadRows(rows);
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

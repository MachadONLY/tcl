import { CLUB_BY_CODE, FIXTURES } from './career-core/season-2026-27.js';
import { deriveTable } from './career-core/career-core.js';
import { CareerRepository } from './career-core/career-repository.js';

const app = document.querySelector('#app');
const MIN_ROWS = 8;
const MAX_ROWS = 14;
const ROW_HEIGHT = 49;
const FIXED_LEAGUE_SPACE = 148;

let updateQueued = false;
let resizeObserver = null;
let observedRailBody = null;

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, token => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[token]);

const crestPath = code => `/assets/clubs/2026-27/${String(code).toLowerCase()}/crest.svg`;

function isHomeRoute() {
  const hash = window.location.hash.replace('#', '');
  return !hash || hash === 'home';
}

function resultForClub(fixture, result, code) {
  if (!result) return null;
  const home = fixture.home === code;
  const scored = home ? result.homeGoals : result.awayGoals;
  const conceded = home ? result.awayGoals : result.homeGoals;
  return scored > conceded ? 'W' : scored < conceded ? 'L' : 'D';
}

function formForClub(career, code) {
  return FIXTURES
    .filter(fixture => (fixture.home === code || fixture.away === code) && career.results[fixture.id])
    .sort((first, second) => first.date.localeCompare(second.date))
    .slice(-5)
    .map(fixture => resultForClub(fixture, career.results[fixture.id], code));
}

function desiredRowCount(railBody) {
  const height = railBody?.clientHeight || 0;
  if (!height) return window.matchMedia('(max-height: 760px)').matches ? MIN_ROWS : 12;
  return Math.max(MIN_ROWS, Math.min(MAX_ROWS, Math.floor((height - FIXED_LEAGUE_SPACE) / ROW_HEIGHT)));
}

function renderRows(career, count) {
  return deriveTable(career).slice(0, count).map(row => {
    const club = CLUB_BY_CODE.get(row.code);
    const form = formForClub(career, row.code);
    const displayName = club?.shortName || club?.name || row.name;
    return `<div class="${row.code === career.clubCode ? 'is-user' : ''}" data-club-code="${escapeHtml(row.code)}">
      <i>${row.position}</i>
      <span title="${escapeHtml(club?.name || row.name)}"><img src="${crestPath(row.code)}" alt="">${escapeHtml(displayName)}</span>
      <b>${row.played}</b>
      <em aria-label="Forma recente">${Array.from({ length: 5 }, (_, index) => `<i class="${form[index] || 'N'}"></i>`).join('')}</em>
      <small>${row.gd > 0 ? '+' : ''}${row.gd}</small>
      <strong>${row.points}</strong>
    </div>`;
  }).join('');
}

function attachResizeObserver(railBody) {
  if (!railBody || observedRailBody === railBody || typeof ResizeObserver === 'undefined') return;
  resizeObserver?.disconnect();
  observedRailBody = railBody;
  resizeObserver = new ResizeObserver(scheduleUpdate);
  resizeObserver.observe(railBody);
}

async function updateLeagueTable() {
  updateQueued = false;
  if (!isHomeRoute()) return;

  const railBody = document.querySelector('.tl-home-v2 .tl-rail-body');
  const slide = document.querySelector('.tl-home-v2 .tl-league-slide');
  const standings = slide?.querySelector('.tl-standings');
  if (!railBody || !slide || !standings) return;

  attachResizeObserver(railBody);
  const career = await CareerRepository.load();
  if (!career || !isHomeRoute() || !document.contains(standings)) return;

  const count = desiredRowCount(railBody);
  const signature = `${career.clubCode}|${career.currentDate}|${Object.keys(career.results || {}).length}|${count}`;
  if (standings.dataset.expandedSignature === signature) return;

  standings.dataset.expandedSignature = signature;
  standings.style.setProperty('--tl-table-rows', String(count));
  slide.dataset.visibleTeams = String(count);
  standings.innerHTML = renderRows(career, count);
}

function scheduleUpdate() {
  if (updateQueued) return;
  updateQueued = true;
  queueMicrotask(updateLeagueTable);
}

new MutationObserver(scheduleUpdate).observe(app, { childList: true, subtree: true });
window.addEventListener('hashchange', scheduleUpdate);
window.addEventListener('resize', scheduleUpdate, { passive: true });
window.addEventListener('beforeunload', () => resizeObserver?.disconnect());
scheduleUpdate();

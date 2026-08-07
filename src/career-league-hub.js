import './career-league-hub.css';
import { normalizeCareer } from './career-core/career-core.js';
import { CLUB_BY_CODE } from './career-core/season-2026-27-live.js';
import { CareerRepository, legacyClubSelection } from './career-core/career-repository.js';
import { leagueLeaders, leagueProgress, standingsRows } from './career-core/league-hub-data.js';

const PLAYER_MANIFEST_URL = '/assets/players/2026-27/manifest.json';
const PLAYER_FALLBACK_URL = '/assets/players/player-placeholder.svg';
const VIEW_LABELS = Object.freeze({ table: 'Tabela', scorers: 'Artilheiros', assists: 'Assistências' });
const contexts = new WeakMap();
const app = typeof document !== 'undefined' ? document.querySelector('#app') : null;
let manifestPromise = null;
let queued = false;

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function loadPlayerManifest() {
  if (manifestPromise) return manifestPromise;
  manifestPromise = fetch(`${PLAYER_MANIFEST_URL}?v=8`, { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error(`manifest HTTP ${response.status}`);
      return response.json();
    })
    .then(manifest => manifest?.players ? manifest : { players: {} })
    .catch(error => {
      console.error('Touchline league player faces:', error.message);
      return { players: {} };
    });
  return manifestPromise;
}

function crestPath(code) {
  return `/assets/clubs/2026-27/${String(code || '').toLowerCase()}/crest.png`;
}

function playerPortrait(manifest, player) {
  const record = manifest?.players?.[player.id];
  return record?.playerId === player.id && record?.clubCode === player.clubCode && record?.localPath
    ? record.localPath
    : PLAYER_FALLBACK_URL;
}

function formMarkup(form) {
  if (!form?.length) return '<span class="cp-league-form-empty">—</span>';
  return form.map(result => `<i class="${result}">${result === 'W' ? 'V' : result === 'D' ? 'E' : 'D'}</i>`).join('');
}

function nextFixtureMarkup(row) {
  const fixture = row.nextFixture;
  if (!fixture) return '<span class="cp-league-next-empty">—</span>';
  const home = fixture.home === row.code;
  const opponentCode = home ? fixture.away : fixture.home;
  const opponent = CLUB_BY_CODE.get(opponentCode);
  return `<span class="cp-league-next" title="${esc(opponent?.name || opponentCode)} · ${home ? 'Casa' : 'Fora'}">
    <img src="${crestPath(opponentCode)}" alt="${esc(opponent?.name || opponentCode)}" />
    <small>${home ? 'C' : 'F'}</small>
  </span>`;
}

function progressMarkup(career) {
  const progress = leagueProgress(career);
  return `<span>${progress.clubPlayed}<b>/ ${progress.clubTotal} jogos do clube</b></span>`;
}

function tableMarkup(career) {
  const rows = standingsRows(career);
  return `<section class="cp-panel cp-league-board cp-league-table-panel" data-league-view-panel="table">
    <header class="cp-league-board-heading">
      <div><small>CLASSIFICAÇÃO GERAL</small><h2>Premier League 2026/27</h2></div>
      ${progressMarkup(career)}
    </header>
    <div class="cp-league-table-scroll">
      <div class="cp-league-table">
        <div class="cp-league-table-head">
          <span>Pos</span><span>Clube</span><span>J</span><span>V</span><span>E</span><span>D</span>
          <span>GP</span><span>GC</span><span>SG</span><span>Pts</span><span>Forma</span><span>Próximo</span>
        </div>
        ${rows.map(row => {
          const club = CLUB_BY_CODE.get(row.code);
          return `<div class="cp-league-table-row ${row.code === career.clubCode ? 'is-user-club' : ''}">
            <strong class="cp-league-position">${row.position}</strong>
            <span class="cp-league-club"><img src="${crestPath(row.code)}" alt="" /><b>${esc(club?.name || row.name)}</b></span>
            <span>${row.played}</span><span>${row.wins}</span><span>${row.draws}</span><span>${row.losses}</span>
            <span>${row.gf}</span><span>${row.ga}</span><span>${row.gd}</span><strong class="cp-league-points">${row.points}</strong>
            <span class="cp-league-form">${formMarkup(row.form)}</span>${nextFixtureMarkup(row)}
          </div>`;
        }).join('')}
      </div>
    </div>
  </section>`;
}

function emptyLeadersMarkup(metric) {
  const subject = metric === 'goals' ? 'artilheiros' : 'líderes de assistências';
  return `<div class="cp-league-leaders-empty">
    <span>0</span><h3>A temporada ainda não começou</h3>
    <p>Os ${subject} aparecerão aqui assim que os primeiros gols forem registrados.</p>
  </div>`;
}

function penaltyLabel(value) {
  const total = Number(value || 0);
  return `${total} ${total === 1 ? 'gol' : 'gols'} de pênalti`;
}

function leaderRowsMarkup(career, manifest, metric) {
  const rows = leagueLeaders(career, metric, 30);
  if (!rows.length) return emptyLeadersMarkup(metric);
  const goalsView = metric === 'goals';

  return `<div class="cp-league-leader-list cp-league-leader-list-${metric}">
    ${rows.map((row, index) => {
      const player = row.player;
      const club = CLUB_BY_CODE.get(player.clubCode);
      const portrait = playerPortrait(manifest, player);
      const clubName = club?.shortName || club?.name || player.clubCode;
      return `<div class="cp-league-leader-row-minimal rank-${index + 1}">
        <strong class="cp-league-leader-rank">${index + 1}</strong>
        <span class="cp-league-leader-identity">
          <span class="cp-league-player-face-wrap">
            <span class="cp-league-player-face"><img src="${esc(portrait)}" alt="${esc(player.name)}" data-league-player-face /></span>
            <span class="cp-league-player-club-mark"><img src="${crestPath(player.clubCode)}" alt="${esc(clubName)}" /></span>
          </span>
          <span class="cp-league-leader-copy">
            <b>${esc(player.name)}</b>
            <small><span>${esc(clubName)}</span>${goalsView ? `<i aria-hidden="true">•</i><span>${penaltyLabel(row.penaltyGoals)}</span>` : ''}</small>
          </span>
        </span>
        <strong class="cp-league-leader-total"><span>${row[metric]}</span><small>${goalsView ? 'gols' : 'assistências'}</small></strong>
      </div>`;
    }).join('')}
  </div>`;
}

function leadersMarkup(career, manifest, view) {
  const metric = view === 'assists' ? 'assists' : 'goals';
  const title = view === 'assists' ? 'Assistências' : 'Artilheiros';
  const description = view === 'assists'
    ? 'Os jogadores que mais criaram gols na temporada.'
    : 'Os principais goleadores da Premier League.';
  return `<section class="cp-panel cp-league-board cp-league-leaders-panel" data-league-view-panel="${view}">
    <header class="cp-league-board-heading">
      <div><small>DESTAQUES INDIVIDUAIS</small><h2>${title}</h2><p>${description}</p></div>
      ${progressMarkup(career)}
    </header>
    ${leaderRowsMarkup(career, manifest, metric)}
  </section>`;
}

function updateTabs(page, activeView) {
  page.querySelectorAll('[data-league-view]').forEach(button => {
    const active = button.dataset.leagueView === activeView;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
}

function wireFaceFallbacks(root) {
  root.querySelectorAll('img[data-league-player-face]').forEach(image => {
    image.addEventListener('error', () => {
      if (!image.src.endsWith(PLAYER_FALLBACK_URL)) image.src = PLAYER_FALLBACK_URL;
    }, { once: true });
  });
}

function renderView(page, view) {
  const context = contexts.get(page);
  if (!context || !page.isConnected) return;
  context.activeView = VIEW_LABELS[view] ? view : 'table';
  context.host.innerHTML = context.activeView === 'table'
    ? tableMarkup(context.career)
    : leadersMarkup(context.career, context.manifest, context.activeView);
  updateTabs(page, context.activeView);
  wireFaceFallbacks(context.host);
}

function createTabs(page, title) {
  let tabs = title.querySelector('.cp-league-switch');
  if (tabs) return tabs;
  tabs = document.createElement('div');
  tabs.className = 'cp-league-switch';
  tabs.setAttribute('role', 'tablist');
  tabs.setAttribute('aria-label', 'Visualização da Premier League');
  tabs.innerHTML = Object.entries(VIEW_LABELS).map(([view, label]) =>
    `<button type="button" role="tab" data-league-view="${view}" aria-selected="${view === 'table'}" class="${view === 'table' ? 'active' : ''}">${label}</button>`
  ).join('');
  tabs.addEventListener('click', event => {
    const button = event.target.closest('[data-league-view]');
    if (button) renderView(page, button.dataset.leagueView);
  });
  title.append(tabs);
  return tabs;
}

function updatePageProgress(title, career) {
  const progress = leagueProgress(career);
  const subtitle = title.querySelector('.cp-league-title-copy p');
  if (subtitle) subtitle.textContent = `${progress.clubPlayed} de ${progress.clubTotal} partidas disputadas.`;
}

async function enhanceLeaguePage() {
  queued = false;
  const heading = [...document.querySelectorAll('.cp-title h1')]
    .find(node => node.textContent?.trim() === 'Premier League');
  const page = heading?.closest('.cp-page');
  const title = heading?.closest('.cp-title');
  const host = page?.querySelector('.cp-league-grid');
  if (!page || !title || !host || contexts.has(page)) return;

  page.classList.add('cp-league-page');
  title.classList.add('cp-league-title');
  heading.parentElement?.classList.add('cp-league-title-copy');
  createTabs(page, title);
  host.classList.add('cp-league-hub-body');
  host.setAttribute('aria-live', 'polite');

  const selectedClub = legacyClubSelection() || 'MUN';
  const [storedCareer, manifest] = await Promise.all([
    CareerRepository.load(),
    loadPlayerManifest()
  ]);
  if (!page.isConnected) return;

  const career = normalizeCareer(storedCareer, selectedClub);
  updatePageProgress(title, career);
  contexts.set(page, { career, manifest, host, activeView: 'table' });
  renderView(page, 'table');
}

function scheduleEnhance() {
  if (queued || !app) return;
  queued = true;
  queueMicrotask(enhanceLeaguePage);
}

if (app) {
  const observer = new MutationObserver(scheduleEnhance);
  observer.observe(app, { childList: true, subtree: true });
  window.addEventListener('hashchange', scheduleEnhance);
  scheduleEnhance();
}

export { tableMarkup, leadersMarkup };

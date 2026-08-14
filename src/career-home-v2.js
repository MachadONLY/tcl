import './career-home-v2.css';
import { CLUB_BY_CODE, FIXTURES } from './career-core/season-2026-27.js';
import {
  deriveTable,
  formatDate,
  nextUserFixture,
  normalizeCareer,
  squadFor,
  userFixtures
} from './career-core/career-runtime.js';
import { friendlyResultFor, isFriendlyFixture, resolveFriendlyClub } from './career-core/friendly-engine.js';
import { CareerRepository, legacyClubSelection } from './career-core/career-repository.js';

const ROTATION_MS = 5000;
const HOME_ROUTE = 'home';
const app = document.querySelector('#app');
const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  weekday: 'short',
  day: '2-digit',
  month: 'short'
});
const dayFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'UTC',
  weekday: 'short'
});

let activeSlide = 2;
let rotationTimer = null;
let renderQueued = false;
let renderVersion = 0;
let activeCareer = null;

const slideMeta = Object.freeze([
  { eyebrow: 'CLUBE', title: 'Caixa de entrada', subtitle: 'Mensagens e decisões' },
  { eyebrow: 'MUNDO DO FUTEBOL', title: 'Touchline News', subtitle: 'A história da sua carreira' },
  { eyebrow: 'COMPETIÇÃO', title: 'Premier League', subtitle: 'Tabela e líderes' }
]);

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, token => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[token]);

function initials(value) {
  return String(value || 'FC').split(/\s+/).filter(Boolean).slice(0, 3).map(part => part[0]).join('').toUpperCase();
}

function externalCrestData(clubData) {
  const label = initials(clubData?.shortName || clubData?.name);
  const color = String(clubData?.color || '#43899c').replace('#', '%23');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${color}"/><stop offset="1" stop-color="%23061117"/></linearGradient></defs><circle cx="64" cy="64" r="58" fill="url(%23g)" stroke="%23bfeef2" stroke-opacity=".5" stroke-width="3"/><text x="64" y="70" text-anchor="middle" fill="white" font-family="Arial" font-size="27" font-weight="900">${label}</text></svg>`;
  return `data:image/svg+xml,${svg}`;
}

const club = code => CLUB_BY_CODE.get(code) || (activeCareer ? resolveFriendlyClub(activeCareer, code) : null) || { id: code, name: String(code), shortName: String(code), color: '#43899c' };
const crestPath = code => CLUB_BY_CODE.has(code) ? `/assets/clubs/2026-27/${String(code).toLowerCase()}/crest.svg` : externalCrestData(club(code));
const clubAsset = (code, file) => {
  const safeCode = CLUB_BY_CODE.has(code) ? code : activeCareer?.clubCode || 'MUN';
  return `/assets/clubs/2026-27/${String(safeCode).toLowerCase()}/${file}`;
};

function isHomeRoute() {
  const hash = window.location.hash.replace('#', '');
  return !hash || hash === HOME_ROUTE;
}

function dateFromIso(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(value, amount) {
  const date = dateFromIso(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function daysBetween(first, second) {
  return Math.max(0, Math.round((dateFromIso(second) - dateFromIso(first)) / 86400000));
}

function shortDate(value) {
  return dateFormatter.format(dateFromIso(value)).replace('.', '');
}

function weekday(value) {
  return dayFormatter.format(dateFromIso(value)).replace('.', '').toUpperCase();
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

function timelineDates(career, fixture) {
  const dates = Array.from({ length: 6 }, (_, index) => addDays(career.currentDate, index));
  if (fixture && !dates.includes(fixture.date)) dates[dates.length - 1] = fixture.date;
  return [...new Set(dates)].sort();
}

function preparationValue(career, fixture) {
  const states = career.lineup.map(id => career.playerState[id]).filter(Boolean);
  const condition = states.length
    ? states.reduce((sum, state) => sum + state.condition, 0) / states.length
    : 82;
  const distance = fixture ? daysBetween(career.currentDate, fixture.date) : 0;
  return Math.max(58, Math.min(96, Math.round(condition * 0.72 + Math.min(distance, 8) * 2.2 + 12)));
}

function contextMessages(career, fixture) {
  const selected = new Set(career.lineup);
  const squad = squadFor(career.clubCode);
  const benchPlayer = squad
    .filter(player => !selected.has(player.id))
    .sort((first, second) => second.rating - first.rating)[0] || squad[0];
  const lowestCondition = squad
    .map(player => ({ player, state: career.playerState[player.id] }))
    .filter(entry => entry.state)
    .sort((first, second) => first.state.condition - second.state.condition)
    .slice(0, 3);
  const opponentCode = fixture
    ? (fixture.home === career.clubCode ? fixture.away : fixture.home)
    : null;
  const opponent = opponentCode ? club(opponentCode) : null;
  const generated = [
    {
      id: 'home-player-request', sender: benchPlayer?.name || 'Jogador do elenco',
      subject: 'Quero uma oportunidade na equipe titular',
      body: 'Mister, sinto que estou pronto para ajudar e gostaria de receber minutos na próxima partida.',
      category: 'PESSOAL', tone: 'player', unread: true, time: '18:04'
    },
    {
      id: 'home-medical-report', sender: 'Dra. Helena Costa',
      subject: `${lowestCondition.length || 1} jogadores exigem controle de carga`,
      body: lowestCondition.length
        ? `${lowestCondition.map(entry => entry.player.name).join(', ')} apresentam os menores índices de condição do elenco.`
        : 'A comissão médica recomenda atenção especial à recuperação do grupo.',
      category: 'IMPORTANTE', tone: 'medical', unread: true, time: '16:18'
    },
    {
      id: 'home-opponent-analysis', sender: 'Jason McCarthy',
      subject: opponent ? `O espaço que podemos atacar contra o ${opponent.shortName || opponent.name}` : 'Relatório da comissão técnica',
      body: opponent
        ? `O ${opponent.name} deixa um corredor vulnerável quando perde a posse. Ajustamos o relatório para a preparação.`
        : 'A equipe de análise concluiu o primeiro relatório tático da temporada.',
      category: 'ANÁLISE', tone: 'assistant', unread: true, time: 'Ontem'
    },
    {
      id: 'home-board-message', sender: 'Diretoria Executiva',
      subject: 'Expectativas para a sequência da temporada',
      body: career.objectives?.[0] || 'A diretoria espera evolução esportiva e controle financeiro durante a temporada.',
      category: 'DIRETORIA', tone: 'board', unread: false, time: 'Terça'
    }
  ];

  const persisted = (career.inbox || []).slice(0, 2).map((message, index) => ({
    id: message.id || `persisted-${index}`,
    sender: message.sender,
    subject: message.subject,
    body: message.body,
    category: index === 0 ? 'CLUBE' : 'RELATÓRIO',
    tone: index === 0 ? 'board' : 'assistant',
    unread: !message.read,
    time: message.date === career.currentDate ? 'Hoje' : shortDate(message.date)
  }));

  return [...persisted, ...generated]
    .filter((message, index, array) => array.findIndex(item => item.subject === message.subject) === index)
    .slice(0, 4);
}

function latestUserResult(career) {
  return userFixtures(career)
    .filter(fixture => friendlyResultFor(career, fixture))
    .sort((first, second) => second.date.localeCompare(first.date))[0] || null;
}

function newsStory(career, fixture) {
  const selectedClub = club(career.clubCode);
  const latest = latestUserResult(career);
  if (latest) {
    const result = friendlyResultFor(career, latest);
    const opponentCode = latest.home === career.clubCode ? latest.away : latest.home;
    const opponent = club(opponentCode);
    const form = resultForClub(latest, result, career.clubCode);
    const home = latest.home === career.clubCode;
    const scored = home ? result.homeGoals : result.awayGoals;
    const conceded = home ? result.awayGoals : result.homeGoals;
    const friendly = isFriendlyFixture(latest);
    return {
      category: friendly ? 'PRÉ-TEMPORADA' : form === 'W' ? 'VITÓRIA' : form === 'L' ? 'REAÇÃO' : 'PREMIER LEAGUE',
      title: form === 'W'
        ? `${selectedClub.shortName || selectedClub.name} vence ${opponent.shortName || opponent.name} e ganha força`
        : form === 'L'
          ? `${selectedClub.shortName || selectedClub.name} volta ao trabalho após duelo com ${opponent.shortName || opponent.name}`
          : `${selectedClub.shortName || selectedClub.name} e ${opponent.shortName || opponent.name} terminam empatados`,
      body: friendly
        ? `O placar de ${scored}–${conceded} elevou o ritmo competitivo do elenco sem afetar a tabela da liga.`
        : `O placar de ${scored}–${conceded} já repercute no ambiente do clube. A comissão técnica volta as atenções para a próxima rodada.`,
      image: clubAsset(career.clubCode, 'stadium.webp'),
      fallback: clubAsset(career.clubCode, 'stadium.jpg'),
      time: 'Hoje · 18:05'
    };
  }

  const opponentCode = fixture
    ? (fixture.home === career.clubCode ? fixture.away : fixture.home)
    : null;
  const opponent = opponentCode ? club(opponentCode) : null;
  const friendly = isFriendlyFixture(fixture);
  return {
    category: fixture ? friendly ? 'PRÉ-TEMPORADA' : 'PRÓXIMO JOGO' : 'NOVA TEMPORADA',
    title: fixture
      ? `${selectedClub.shortName || selectedClub.name} fecha a preparação para enfrentar ${opponent.shortName || opponent.name}`
      : `${selectedClub.shortName || selectedClub.name} inicia uma nova temporada`,
    body: fixture
      ? friendly
        ? 'O amistoso será usado para ganhar condição, testar a tática e distribuir minutos antes da estreia oficial.'
        : `O elenco entra na reta final de preparação para a rodada ${fixture.matchweek}. Condição, moral e escolhas táticas podem decidir o confronto.`
      : 'A diretoria, a comissão e o elenco já trabalham nos primeiros objetivos da carreira.',
    image: clubAsset(career.clubCode, 'manager.webp'),
    fallback: clubAsset(career.clubCode, 'stadium.webp'),
    time: 'Hoje · 18:05'
  };
}

function renderTimeline(career, fixture) {
  return timelineDates(career, fixture).map(date => {
    const isToday = date === career.currentDate;
    const isMatch = fixture?.date === date;
    const days = daysBetween(career.currentDate, date);
    const label = isMatch ? isFriendlyFixture(fixture) ? 'AMISTOSO' : 'JOGO' : days === 0 ? 'HOJE' : days % 3 === 0 ? 'RECUPERAÇÃO' : 'TREINO';
    return `<div class="tl-day ${isToday ? 'is-today' : ''} ${isMatch ? 'is-match' : ''}">
      <span>${weekday(date)}</span><b>${date.slice(-2)}</b><small>${label}</small>
    </div>`;
  }).join('');
}

function renderMatchPanel(career, fixture) {
  const selectedClub = club(career.clubCode);
  if (!fixture) {
    return `<section class="tl-match-card tl-season-complete">
      <div><small>TEMPORADA CONCLUÍDA</small><h1>${escapeHtml(selectedClub.name)}</h1>
      <p>A temporada foi concluída. Consulte a classificação final e as estatísticas da carreira.</p></div>
      <button data-home-open="league">Ver classificação final</button>
    </section>`;
  }

  const home = club(fixture.home);
  const away = club(fixture.away);
  const homeInternal = CLUB_BY_CODE.has(fixture.home);
  const awayInternal = CLUB_BY_CODE.has(fixture.away);
  const venue = fixture.venue === 'neutral' ? selectedClub : home;
  const venueText = fixture.venue === 'neutral' ? 'Campo neutro' : venue.stadium || venue.name;
  const distance = daysBetween(career.currentDate, fixture.date);
  const timing = distance === 0 ? 'Hoje' : distance === 1 ? 'Amanhã' : `Em ${distance} dias`;
  const preparation = preparationValue(career, fixture);
  const friendly = isFriendlyFixture(fixture);
  const table = friendly ? [] : deriveTable(career);
  const teamSubtitle = (reference, internal) => reference === career.clubCode
    ? 'Seu clube'
    : friendly || !internal
      ? 'Adversário de pré-temporada'
      : `${table.find(row => row.code === reference)?.position || '—'}º lugar`;
  return `<section class="tl-match-card ${friendly ? 'is-friendly' : ''}">
    <img class="tl-match-bg" src="${clubAsset(venue.code, 'stadium.webp')}" data-fallback="${clubAsset(venue.code, 'stadium.jpg')}" alt="${escapeHtml(venueText)}">
    <div class="tl-match-shade"></div>
    <header class="tl-match-head"><div><small>${friendly ? 'PRÓXIMO AMISTOSO' : 'PRÓXIMO JOGO'}</small><b>${friendly ? 'Friendly Match · Pré-temporada' : `Premier League · Rodada ${fixture.matchweek}`}</b></div><span><i></i>${timing}</span></header>
    <div class="tl-match-center">
      <div class="tl-team"><span><img src="${crestPath(fixture.home)}" alt="${escapeHtml(home.name)}"></span><h2>${escapeHtml(home.shortName || home.name)}</h2><small>${teamSubtitle(fixture.home, homeInternal)}</small></div>
      <div class="tl-kickoff"><small>${formatDate(fixture.date, true)}</small><strong>${fixture.time}</strong><span>${escapeHtml(venueText)}</span></div>
      <div class="tl-team"><span><img src="${crestPath(fixture.away)}" alt="${escapeHtml(away.name)}"></span><h2>${escapeHtml(away.shortName || away.name)}</h2><small>${teamSubtitle(fixture.away, awayInternal)}</small></div>
    </div>
    <footer class="tl-match-foot"><div><span>Preparação</span><b>${preparation}%</b><i><em style="width:${preparation}%"></em></i></div><button data-home-continue>▷ <span>${distance === 0 ? 'Preparar partida' : 'Avançar calendário'}</span></button></footer>
  </section>`;
}

function renderInboxSlide(career, fixture) {
  const messages = contextMessages(career, fixture);
  const unread = messages.filter(message => message.unread).length;
  return `<section class="tl-rail-slide" data-slide="0" aria-hidden="true">
    <div class="tl-inbox-title"><span>✉</span><div><h3>Principal</h3><p><b>${unread}</b> não lidas · ${messages.length} mensagens</p></div><button data-home-open="inbox">⌕</button></div>
    <div class="tl-inbox-tabs"><b>Todos</b><span>Não lidos <i>${unread}</i></span><button data-home-open="inbox">Ver caixa completa</button></div>
    <div class="tl-message-list">${messages.map(message => {
      const avatar = message.sender.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase();
      return `<button class="tl-message ${message.unread ? 'is-unread' : ''}" data-home-open="inbox">
        <i></i><span class="tl-avatar ${message.tone}">${escapeHtml(avatar)}</span>
        <span class="tl-message-copy"><small>${escapeHtml(message.sender)}<time>${escapeHtml(message.time)}</time></small><b>${escapeHtml(message.subject)}</b><p>${escapeHtml(message.body)}</p><em>${escapeHtml(message.category)}</em></span>
      </button>`;
    }).join('')}</div>
  </section>`;
}

function renderNewsSlide(career, fixture) {
  const story = newsStory(career, fixture);
  return `<section class="tl-rail-slide tl-news-slide" data-slide="1" aria-hidden="true">
    <div class="tl-news-image"><img src="${story.image}" data-fallback="${story.fallback}" alt=""><span>TOUCHLINE NEWS</span></div>
    <article><header><b>${escapeHtml(story.category)}</b><time>${escapeHtml(story.time)}</time></header><h3>${escapeHtml(story.title)}</h3><p>${escapeHtml(story.body)}</p><footer><b>News Desk</b><span>Imagem local · temporada 2026/27</span></footer></article>
  </section>`;
}

function renderLeagueSlide(career) {
  const table = deriveTable(career).slice(0, 8);
  return `<section class="tl-rail-slide tl-league-slide" data-slide="2" aria-hidden="true">
    <div class="tl-league-title"><h3>Competição</h3><button data-home-open="league">Ver tudo →</button></div>
    <div class="tl-league-tabs"><b>Classificação</b><button data-home-open="league">Artilheiros</button><button data-home-open="league">Assistências</button></div>
    <div class="tl-standings-head"><span>#</span><span>CLUBE</span><span>J</span><span>FORMA</span><span>SG</span><span>PTS</span></div>
    <div class="tl-standings">${table.map(row => {
      const form = formForClub(career, row.code);
      return `<div class="${row.code === career.clubCode ? 'is-user' : ''}"><i>${row.position}</i><span><img src="${crestPath(row.code)}" alt="">${escapeHtml(club(row.code).shortName || row.name)}</span><b>${row.played}</b><em>${Array.from({ length: 5 }, (_, index) => `<i class="${form[index] || 'N'}"></i>`).join('')}</em><small>${row.gd > 0 ? '+' : ''}${row.gd}</small><strong>${row.points}</strong></div>`;
    }).join('')}</div>
  </section>`;
}

function renderRail(career, fixture) {
  const meta = slideMeta[activeSlide];
  return `<aside class="tl-home-rail" data-home-rail>
    <header class="tl-rail-head">
      <div class="tl-traffic" aria-label="Alternar painel">
        ${slideMeta.map((_, index) => `<button class="${index === activeSlide ? 'is-active' : ''}" data-home-slide="${index}" aria-label="Abrir painel ${index + 1}"><i>${index === activeSlide ? index + 1 : ''}</i></button>`).join('')}
      </div>
      <div class="tl-rail-heading"><small data-rail-eyebrow>${meta.eyebrow}</small><h2 data-rail-title>${meta.title}</h2><p data-rail-subtitle>${meta.subtitle}</p></div>
      <span class="tl-rail-count" data-rail-count>${activeSlide + 1}/3</span>
    </header>
    <div class="tl-rail-progress"><i></i></div>
    <div class="tl-rail-body">${renderInboxSlide(career, fixture)}${renderNewsSlide(career, fixture)}${renderLeagueSlide(career)}</div>
  </aside>`;
}

function renderHomeMarkup(career) {
  activeCareer = career;
  const fixture = nextUserFixture(career);
  return `<div class="tl-home-v2">
    <section class="tl-home-main">
      <div class="tl-calendar-strip"><header><small>CALENDÁRIO</small><b>${formatDate(career.currentDate)}</b></header><div>${renderTimeline(career, fixture)}</div></div>
      ${renderMatchPanel(career, fixture)}
    </section>
    ${renderRail(career, fixture)}
  </div>`;
}

function setSlide(index, restart = true) {
  activeSlide = ((Number(index) % slideMeta.length) + slideMeta.length) % slideMeta.length;
  const rail = document.querySelector('[data-home-rail]');
  if (!rail) return;
  const meta = slideMeta[activeSlide];
  rail.querySelector('[data-rail-eyebrow]')?.replaceChildren(meta.eyebrow);
  rail.querySelector('[data-rail-title]')?.replaceChildren(meta.title);
  rail.querySelector('[data-rail-subtitle]')?.replaceChildren(meta.subtitle);
  rail.querySelector('[data-rail-count]')?.replaceChildren(`${activeSlide + 1}/3`);
  rail.querySelectorAll('[data-home-slide]').forEach(button => button.classList.toggle('is-active', Number(button.dataset.homeSlide) === activeSlide));
  rail.querySelectorAll('[data-slide]').forEach(slide => {
    const active = Number(slide.dataset.slide) === activeSlide;
    slide.classList.toggle('is-active', active);
    slide.setAttribute('aria-hidden', String(!active));
  });
  const progress = rail.querySelector('.tl-rail-progress');
  if (progress) {
    progress.classList.remove('is-running');
    void progress.offsetWidth;
    progress.classList.add('is-running');
  }
  if (restart) startRotation();
}

function startRotation() {
  clearInterval(rotationTimer);
  if (!isHomeRoute() || !document.querySelector('[data-home-rail]')) return;
  rotationTimer = window.setInterval(() => setSlide(activeSlide + 1, false), ROTATION_MS);
}

function bindHome(root) {
  root.querySelectorAll('[data-home-slide]').forEach(button => {
    button.addEventListener('click', () => setSlide(button.dataset.homeSlide));
  });
  root.querySelectorAll('[data-home-open]').forEach(button => {
    button.addEventListener('click', () => {
      window.location.hash = button.dataset.homeOpen;
    });
  });
  root.querySelector('[data-home-continue]')?.addEventListener('click', () => {
    document.querySelector('.cp-top [data-continue]')?.click();
  });
  root.querySelectorAll('img[data-fallback]').forEach(image => {
    image.addEventListener('error', () => {
      const fallback = image.dataset.fallback;
      if (fallback && image.src !== new URL(fallback, window.location.href).href) image.src = fallback;
    }, { once: true });
  });
  const rail = root.querySelector('[data-home-rail]');
  rail?.addEventListener('mouseenter', () => clearInterval(rotationTimer));
  rail?.addEventListener('mouseleave', startRotation);
  setSlide(activeSlide, false);
  startRotation();
}

async function installHome() {
  renderQueued = false;
  if (!isHomeRoute()) {
    clearInterval(rotationTimer);
    document.querySelector('.cp-content')?.classList.remove('cp-content-home-v2');
    return;
  }
  const content = document.querySelector('.cp-content');
  if (!content || content.querySelector('.tl-home-v2')) return;
  const version = ++renderVersion;
  const selected = legacyClubSelection();
  const loaded = await CareerRepository.load();
  const career = normalizeCareer(loaded, selected || 'MUN');
  if (version !== renderVersion || !career || !selected || !isHomeRoute()) return;
  content.classList.add('cp-content-home-v2');
  content.innerHTML = renderHomeMarkup(career);
  bindHome(content);
}

function scheduleInstall() {
  if (renderQueued) return;
  renderQueued = true;
  queueMicrotask(installHome);
}

const observer = new MutationObserver(scheduleInstall);
observer.observe(app, { childList: true, subtree: true });
window.addEventListener('hashchange', scheduleInstall);
window.addEventListener('beforeunload', () => clearInterval(rotationTimer));
scheduleInstall();

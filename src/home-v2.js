import "./home-v2.css";
import { buildNewsDeskFeed } from "./news-desk.js";
import { MATCH_META, TEAMS } from "./mvp-data.js";

const app = document.querySelector("#app");
const MATCHDAY_HASH = "#matchday";

const state = {
  competitionTab: "standings",
  modal: null,
  readMail: new Set()
};

const STANDINGS = [
  [1, "Arsenal", "ARS", 57, 8, 7, 1, 0, 19, 6, 22, ["w", "w", "w", "d", "w"]],
  [2, "Man City", "MCI", 65, 8, 6, 2, 0, 18, 7, 20, ["w", "d", "w", "w", "w"]],
  [3, "Chelsea", "CHE", 61, 8, 6, 1, 1, 17, 8, 19, ["w", "w", "d", "w", "l"]],
  [4, "Man United", "MUN", 66, 8, 5, 3, 0, 16, 8, 18, ["w", "w", "d", "l", "w"], true],
  [5, "Liverpool", "LIV", 64, 8, 5, 2, 1, 15, 9, 17, ["d", "w", "w", "l", "w"]],
  [6, "Newcastle", "NEW", 67, 8, 4, 3, 1, 13, 9, 15, ["w", "l", "d", "w", "d"]],
  [7, "Tottenham", "TOT", 73, 8, 4, 2, 2, 14, 11, 14, ["l", "w", "w", "d", "w"]],
  [8, "Aston Villa", "AVL", 58, 8, 4, 1, 3, 12, 10, 13, ["w", "l", "w", "d", "l"]],
  [9, "Brighton", "BHA", 397, 8, 3, 3, 2, 12, 11, 12, ["d", "w", "l", "d", "w"]],
  [10, "Bournemouth", "BOU", 1044, 8, 3, 2, 3, 11, 11, 11, ["l", "w", "d", "w", "l"]],
  [11, "Fulham", "FUL", 63, 8, 3, 2, 3, 10, 11, 11, ["d", "l", "w", "w", "l"]],
  [12, "Crystal Palace", "CRY", 354, 8, 2, 4, 2, 9, 9, 10, ["d", "d", "w", "l", "d"]],
  [13, "Brentford", "BRE", 402, 8, 3, 1, 4, 11, 13, 10, ["w", "l", "l", "d", "w"]],
  [14, "West Ham", "WHU", 563, 8, 2, 3, 3, 9, 12, 9, ["l", "d", "w", "d", "l"]],
  [15, "Everton", "EVE", 62, 8, 2, 2, 4, 8, 12, 8, ["d", "l", "w", "l", "d"]],
  [16, "Nottingham Forest", "NFO", 351, 8, 2, 1, 5, 8, 14, 7, ["l", "w", "l", "l", "d"]],
  [17, "Wolves", "WOL", 76, 8, 1, 3, 4, 7, 13, 6, ["d", "l", "d", "w", "l"]],
  [18, "Leeds", "LEE", 341, 8, 1, 2, 5, 7, 15, 5, ["l", "d", "l", "w", "l"]],
  [19, "Burnley", "BUR", 328, 8, 1, 1, 6, 6, 17, 4, ["l", "l", "d", "w", "l"]],
  [20, "Sunderland", "SUN", 71, 8, 0, 2, 6, 5, 18, 2, ["l", "d", "l", "l", "l"]]
].map(([pos, name, tla, crestId, p, w, d, l, gf, ga, pts, form, user]) => ({
  pos,
  name,
  tla,
  crest: `https://crests.football-data.org/${crestId}.png`,
  p,
  w,
  d,
  l,
  gf,
  ga,
  gd: gf - ga,
  pts,
  form,
  user: Boolean(user)
}));

const SCORERS = [
  ["Erling Haaland", "Man City", "MCI", 65, 10, 8],
  ["Bukayo Saka", "Arsenal", "ARS", 57, 8, 8],
  ["Cole Palmer", "Chelsea", "CHE", 61, 7, 8],
  ["Benjamin Šeško", "Man United", "MUN", 66, 7, 8, true],
  ["Alexander Isak", "Newcastle", "NEW", 67, 6, 8],
  ["Mohamed Salah", "Liverpool", "LIV", 64, 6, 8],
  ["Bryan Mbeumo", "Man United", "MUN", 66, 5, 8, true],
  ["Ollie Watkins", "Aston Villa", "AVL", 58, 5, 8]
].map(([player, team, tla, crestId, value, matches, user]) => ({
  player,
  team,
  tla,
  crest: `https://crests.football-data.org/${crestId}.png`,
  value,
  matches,
  user: Boolean(user)
}));

const ASSISTS = [
  ["Bruno Fernandes", "Man United", "MUN", 66, 7, 8, true],
  ["Martin Ødegaard", "Arsenal", "ARS", 57, 6, 8],
  ["Cole Palmer", "Chelsea", "CHE", 61, 5, 8],
  ["Kevin De Bruyne", "Man City", "MCI", 65, 5, 8],
  ["Youri Tielemans", "Man United", "MUN", 66, 4, 8, true],
  ["Mohamed Salah", "Liverpool", "LIV", 64, 4, 8],
  ["Anthony Gordon", "Newcastle", "NEW", 67, 4, 8],
  ["Bukayo Saka", "Arsenal", "ARS", 57, 4, 8]
].map(([player, team, tla, crestId, value, matches, user]) => ({
  player,
  team,
  tla,
  crest: `https://crests.football-data.org/${crestId}.png`,
  value,
  matches,
  user: Boolean(user)
}));

const MAILS = [
  {
    id: "lineup",
    sender: "Assistente técnico",
    role: "Comissão técnica",
    initials: "AT",
    tone: "urgent",
    time: "17:42",
    subject: "Equipe titular precisa ser confirmada",
    preview: "A última sessão alterou a condição de três jogadores.",
    body: [
      "Gabriel, terminamos a avaliação do último treino antes de Stamford Bridge.",
      "Šeško e Ugarte completaram a sessão com carga controlada. Dorgu respondeu bem, mas recomendamos revisar a intensidade da pressão para evitar queda física no segundo tempo.",
      "O relatório tático sugere manter Bruno como criador pelo meio e atacar o espaço atrás do lateral direito do Chelsea."
    ],
    action: "Preparar partida",
    openMatchday: true
  },
  {
    id: "medical",
    sender: "Dra. Helena Costa",
    role: "Performance e medicina",
    initials: "HC",
    tone: "medical",
    time: "16:18",
    subject: "Três atletas acima da carga planejada",
    preview: "Todos podem jogar, mas a recomendação de minutos mudou.",
    body: [
      "A sessão terminou sem nova lesão, porém três atletas ficaram acima da faixa de carga planejada.",
      "Ugarte está em 84% de condição, Šeško em 82% e Bruno apresenta fadiga acumulada leve.",
      "Todos podem iniciar, mas a comissão recomenda preparar substituições e reduzir a contra-pressão contínua."
    ],
    action: "Entendido"
  },
  {
    id: "board",
    sender: "Omar Berrada",
    role: "Diretoria executiva",
    initials: "OB",
    tone: "board",
    time: "Ontem",
    subject: "Objetivos e identidade do projeto",
    preview: "A diretoria quer evolução com disciplina esportiva e financeira.",
    body: [
      "A direção está satisfeita com a posição atual e com a evolução da identidade ofensiva.",
      "O objetivo principal permanece a classificação para a Champions League, com integração gradual da academia e disciplina no mercado de janeiro.",
      "O resultado contra o Chelsea terá peso, mas a avaliação continuará considerando processo, desempenho e desenvolvimento do elenco."
    ],
    action: "Arquivar"
  }
];

const NAV = [
  ["central", "Central", "grid"],
  ["inbox", "Caixa de entrada", "mail", "3"],
  ["squad", "Elenco", "users"],
  ["tactics", "Táticas", "tactics"],
  ["training", "Treino", "activity"],
  ["recruitment", "Recrutamento", "search"],
  ["transfers", "Transferências", "repeat"],
  ["calendar", "Calendário", "calendar"],
  ["finances", "Finanças", "wallet"],
  ["academy", "Academia", "academy"]
];

const NEWS = buildNewsDeskFeed({
  table: STANDINGS,
  results: [
    {
      home: "Arsenal",
      away: "Man City",
      homeGoals: 3,
      awayGoals: 0,
      featured: true,
      image: "https://commons.wikimedia.org/wiki/Special:FilePath/Emirates_Stadium_-_East_stand_Club_Level.jpg?width=1400",
      timestamp: "Há 46 min"
    }
  ],
  fixtures: [
    {
      home: "Chelsea",
      away: "Man United",
      userTeam: true,
      summary: "Invicto após oito rodadas, o United chega a Stamford Bridge um ponto atrás do Chelsea. A atuação de Šeško e o controle de Bruno entre as linhas podem decidir o confronto direto pela zona de Champions.",
      image: "https://commons.wikimedia.org/wiki/Special:FilePath/Williams-Brice%20Stadium,%20Manchester%20United%20v.%20Liverpool,%208-3-2024.jpg?width=1600",
      timestamp: "Hoje · 18:05",
      credit: "Foto editorial demonstrativa · Wikimedia Commons"
    }
  ]
});

const FEATURED_NEWS = NEWS.find(item => item.category === "club") || NEWS[0];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function icon(name, size = 18) {
  const paths = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    tactics: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="3"/><path d="M3 7h3v10H3M21 7h-3v10h3"/>',
    activity: '<path d="M3 12h4l2-7 4 14 2-7h6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    repeat: '<path d="m17 1 4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="m7 23-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    wallet: '<path d="M20 7V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h16v10a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V6"/><path d="M16 13h5"/>',
    academy: '<path d="m2 9 10-5 10 5-10 5L2 9Z"/><path d="M6 11v5c3 3 9 3 12 0v-5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    play: '<path d="m8 5 11 7-11 7V5Z"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>'
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.grid}</svg>`;
}

function crest(team, className = "") {
  return `<span class="v2-crest ${className}"><img src="${escapeHtml(team.crest)}" alt="Escudo do ${escapeHtml(team.shortName || team.name)}" referrerpolicy="no-referrer" /><span>${escapeHtml(team.tla || "CLB")}</span></span>`;
}

function miniCrest(item) {
  return `<span class="v2-mini-crest"><img src="${escapeHtml(item.crest)}" alt="" referrerpolicy="no-referrer" /><i>${escapeHtml(item.tla)}</i></span>`;
}

function fixtureDate() {
  const date = new Date(`${MATCH_META.fixtureDate}T12:00:00`);
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(date);
}

function renderNavigation() {
  return NAV.map(([id, label, iconName, badge], index) => `${index === 5 ? '<span class="v2-nav-divider">GESTÃO</span>' : ""}<button class="v2-nav-item ${id === "central" ? "active" : ""}" data-nav="${id}" type="button"><span>${icon(iconName)}</span><b>${label}</b>${badge ? `<i>${badge}</i>` : ""}</button>`).join("");
}

function renderMailbox() {
  return `<aside class="v2-mailbox" id="career-inbox"><header><div><span>CAIXA DE ENTRADA</span><h2>Clube</h2></div><b>${MAILS.length - state.readMail.size}</b></header><div class="v2-mail-list">${MAILS.map(mail => `<button class="v2-mail ${state.readMail.has(mail.id) ? "read" : ""}" data-mail="${mail.id}" type="button"><span class="v2-mail-avatar ${mail.tone}">${mail.initials}</span><span class="v2-mail-copy"><span><strong>${escapeHtml(mail.sender)}</strong><time>${escapeHtml(mail.time)}</time></span><b>${escapeHtml(mail.subject)}</b><small>${escapeHtml(mail.preview)}</small></span>${icon("chevron", 15)}</button>`).join("")}</div></aside>`;
}

function standingsRows(items, full = false) {
  return items.map(team => `<div class="v2-standing-row ${team.user ? "user" : ""} ${full ? "full" : ""}"><span>${team.pos}</span><span class="v2-team">${miniCrest(team)}<strong>${escapeHtml(team.name)}</strong></span><span>${team.p}</span>${full ? `<span>${team.w}</span><span>${team.d}</span><span>${team.l}</span><span>${team.gf}:${team.ga}</span>` : `<span class="v2-form">${team.form.map(result => `<i class="${result}"></i>`).join("")}</span>`}<span>${team.gd > 0 ? "+" : ""}${team.gd}</span><b>${team.pts}</b></div>`).join("");
}

function rankingRows(items, label) {
  return items.map((item, index) => `<div class="v2-ranking-row ${item.user ? "user" : ""}"><span>${index + 1}</span><span class="v2-player">${miniCrest(item)}<span><strong>${escapeHtml(item.player)}</strong><small>${escapeHtml(item.team)}</small></span></span><span>${item.matches}</span><b>${item.value}</b><small>${label}</small></div>`).join("");
}

function competitionRows(tab, full = false) {
  if (tab === "scorers") return rankingRows(full ? SCORERS : SCORERS.slice(0, 5), "gols");
  if (tab === "assists") return rankingRows(full ? ASSISTS : ASSISTS.slice(0, 5), "assist.");
  return standingsRows(full ? STANDINGS : STANDINGS.slice(0, 5), full);
}

function competitionHeader(tab, full = false) {
  if (tab !== "standings") return '<div class="v2-ranking-head"><span>#</span><span>Jogador</span><span>J</span><span>Total</span><span></span></div>';
  return full
    ? '<div class="v2-standing-head full"><span>#</span><span>Clube</span><span>J</span><span>V</span><span>E</span><span>D</span><span>Gols</span><span>SG</span><span>PTS</span></div>'
    : '<div class="v2-standing-head"><span>#</span><span>Clube</span><span>J</span><span>Forma</span><span>SG</span><span>PTS</span></div>';
}

function competitionTabs(modal = false) {
  const attr = modal ? "data-modal-tab" : "data-tab";
  const active = modal && state.modal?.tab ? state.modal.tab : state.competitionTab;
  return [["standings", "Classificação"], ["scorers", "Artilheiros"], ["assists", "Assistências"]].map(([id, label]) => `<button class="${active === id ? "active" : ""}" ${attr}="${id}" type="button">${label}</button>`).join("");
}

function renderCompetition() {
  return `<article class="v2-card v2-competition"><header><div><span>PREMIER LEAGUE</span><h2>Competição</h2></div><button data-open-competition type="button">Ver tudo ${icon("arrow", 15)}</button></header><div class="v2-tabs">${competitionTabs()}</div><div data-competition-body>${competitionHeader(state.competitionTab)}${competitionRows(state.competitionTab)}</div></article>`;
}

function renderMoment() {
  return `<article class="v2-card v2-moment"><header><span>MOMENTO DO CLUBE</span><b>↗ 8%</b></header><div class="v2-moment-score"><strong>10</strong><span>pontos nos últimos 5</span><div><i class="w">V</i><i class="w">V</i><i class="d">E</i><i class="l">D</i><i class="w">V</i></div></div><footer><span><b>14</b> gols marcados</span><span><b>6</b> sofridos</span><span><b>Alta</b> confiança</span></footer></article>`;
}

function renderEditorialNews() {
  const item = FEATURED_NEWS;
  return `<article class="v2-card v2-editorial-news" tabindex="0"><div class="v2-news-image"><img src="${escapeHtml(item.image)}" alt="Manchester United em campo" loading="eager" referrerpolicy="no-referrer" /><span>TOUCHLINE NEWS</span></div><div class="v2-news-story"><div class="v2-news-meta"><span>${escapeHtml(item.label)}</span><time>${escapeHtml(item.timestamp)}</time></div><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.summary)}</p><footer><span>News Desk</span><small>${escapeHtml(item.credit)}</small></footer></div></article>`;
}

function renderHome() {
  const homeTeam = TEAMS[MATCH_META.homeTeamId];
  const awayTeam = TEAMS[MATCH_META.awayTeamId];
  const userTeam = MATCH_META.userTeamIndex === 0 ? homeTeam : awayTeam;

  document.title = "Touchline — Central da carreira";
  document.documentElement.classList.add("career-home-mode");

  app.innerHTML = `<div class="career-v2"><main class="v2-shell"><aside class="v2-sidebar"><div class="v2-brand"><span><i></i><i></i><i></i></span><div><strong>TOUCHLINE</strong><small>CAREER MODE</small></div></div><div class="v2-club">${crest(userTeam, "club")}<div><small>Treinador de</small><strong>${escapeHtml(userTeam.shortName)}</strong></div></div><nav>${renderNavigation()}</nav><div class="v2-manager"><span>GM</span><div><strong>Gabriel Machado</strong><small>Temporada 1</small></div></div></aside><section class="v2-main"><div class="v2-grid"><section class="v2-top"><article class="v2-next-match"><img class="v2-stadium" src="https://commons.wikimedia.org/wiki/Special:FilePath/Stamford_Bridge,_Chelsea.jpg?width=1800" alt="Stamford Bridge" referrerpolicy="no-referrer" /><div class="v2-stadium-shade"></div><header><div><span>PRÓXIMO JOGO</span><strong>${escapeHtml(MATCH_META.competition.name)} · Rodada ${MATCH_META.matchweek}</strong></div><b><i></i>Amanhã</b></header><div class="v2-fixture"><div>${crest(homeTeam, "fixture")}<strong>${escapeHtml(homeTeam.shortName)}</strong><small>3º · 19 pts</small></div><section><span>${fixtureDate()}</span><strong>${MATCH_META.kickoffLocal}</strong><small>${escapeHtml(MATCH_META.venue)}</small></section><div>${crest(awayTeam, "fixture")}<strong>${escapeHtml(awayTeam.shortName)}</strong><small>4º · 18 pts</small></div></div><footer><div><span>Preparação <b>82%</b></span><i><b></b></i></div><button data-open-matchday type="button">${icon("play", 17)} Preparar partida</button></footer></article>${renderMailbox()}</section><section class="v2-bottom"><div data-competition-panel>${renderCompetition()}</div><div class="v2-right-stack">${renderMoment()}${renderEditorialNews()}</div></section></div></section></main><div data-modal-root></div><div class="v2-toast" role="status" aria-live="polite"></div></div>`;

  bindInteractions();
}

function renderMailModal(mail) {
  return `<div class="v2-modal-layer"><button class="v2-scrim" data-close-modal aria-label="Fechar"></button><section class="v2-modal v2-mail-modal" role="dialog" aria-modal="true"><header><button data-close-modal type="button">${icon("close", 18)}</button><span>CAIXA DE ENTRADA</span><time>${escapeHtml(mail.time)}</time></header><div class="v2-modal-title"><span class="v2-mail-avatar large ${mail.tone}">${mail.initials}</span><div><small>${escapeHtml(mail.role)}</small><h2>${escapeHtml(mail.subject)}</h2><p>De <strong>${escapeHtml(mail.sender)}</strong> para Gabriel Machado</p></div></div><div class="v2-modal-body">${mail.body.map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join("")}</div><footer><button data-close-modal type="button">Voltar</button><button class="primary" ${mail.openMatchday ? "data-open-matchday" : "data-close-modal"} type="button">${escapeHtml(mail.action)} ${icon("arrow", 15)}</button></footer></section></div>`;
}

function renderCompetitionModal(tab) {
  return `<div class="v2-modal-layer"><button class="v2-scrim" data-close-modal aria-label="Fechar"></button><section class="v2-modal v2-competition-modal" role="dialog" aria-modal="true"><header><div><span>PREMIER LEAGUE · 2026/27</span><h2>Central da competição</h2></div><button data-close-modal type="button">${icon("close", 18)}</button></header><div class="v2-tabs modal">${competitionTabs(true)}</div><div class="v2-full-table">${competitionHeader(tab, true)}${competitionRows(tab, true)}</div></section></div>`;
}

function renderModal() {
  const root = app.querySelector("[data-modal-root]");
  if (!root) return;
  if (!state.modal) {
    root.innerHTML = "";
    return;
  }

  root.innerHTML = state.modal.type === "mail"
    ? renderMailModal(MAILS.find(mail => mail.id === state.modal.id))
    : renderCompetitionModal(state.modal.tab || state.competitionTab);

  requestAnimationFrame(() => root.querySelector(".v2-modal-layer")?.classList.add("visible"));
}

function openModal(modal) {
  state.modal = modal;
  if (modal.type === "mail") state.readMail.add(modal.id);
  renderModal();
  refreshMailbox();
}

function closeModal() {
  const layer = app.querySelector(".v2-modal-layer");
  layer?.classList.remove("visible");
  window.setTimeout(() => {
    state.modal = null;
    renderModal();
  }, 180);
}

function refreshMailbox() {
  const current = app.querySelector("#career-inbox");
  if (!current) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = renderMailbox();
  current.replaceWith(wrapper.firstElementChild);
}

function refreshCompetition() {
  const target = app.querySelector("[data-competition-panel]");
  if (target) target.innerHTML = renderCompetition();
}

function showToast(message) {
  const toast = app.querySelector(".v2-toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("visible"), 2400);
}

function bindInteractions() {
  app.addEventListener("click", event => {
    if (event.target.closest("[data-open-matchday]")) {
      window.location.hash = MATCHDAY_HASH;
      window.location.reload();
      return;
    }

    if (event.target.closest("[data-close-modal]")) {
      closeModal();
      return;
    }

    const mail = event.target.closest("[data-mail]");
    if (mail) {
      openModal({ type: "mail", id: mail.dataset.mail });
      return;
    }

    if (event.target.closest("[data-open-competition]")) {
      openModal({ type: "competition", tab: state.competitionTab });
      return;
    }

    const tab = event.target.closest("[data-tab]");
    if (tab) {
      state.competitionTab = tab.dataset.tab;
      refreshCompetition();
      return;
    }

    const modalTab = event.target.closest("[data-modal-tab]");
    if (modalTab) {
      state.modal.tab = modalTab.dataset.modalTab;
      renderModal();
      return;
    }

    const nav = event.target.closest("[data-nav]");
    if (nav) {
      if (nav.dataset.nav === "inbox") {
        app.querySelector("#career-inbox")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      const labels = {
        central: "Você já está na Central da carreira.",
        squad: "Elenco será conectado ao banco da carreira.",
        tactics: "Abra Preparar partida para editar o plano tático.",
        training: "Centro de treino será conectado à semana do clube.",
        recruitment: "Rede de olheiros em desenvolvimento.",
        transfers: "Central de transferências em desenvolvimento.",
        calendar: "Calendário completo em desenvolvimento.",
        finances: "Finanças e contratos em desenvolvimento.",
        academy: "Academia em desenvolvimento."
      };
      showToast(labels[nav.dataset.nav] || "Módulo em desenvolvimento.");
    }
  });

  app.addEventListener("error", event => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement)) return;
    image.closest(".v2-crest, .v2-mini-crest, .v2-news-image, .v2-next-match")?.classList.add("image-missing");
    image.hidden = true;
  }, true);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && state.modal) closeModal();
  });
}

if (window.location.hash === MATCHDAY_HASH) {
  document.documentElement.classList.remove("career-home-mode");
  import("./app.js");
} else {
  renderHome();
}

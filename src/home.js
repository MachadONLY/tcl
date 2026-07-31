import "./home.css";
import { buildNewsDeskFeed } from "./news-desk.js";
import { MATCH_META, TEAMS } from "./mvp-data.js";

const app = document.querySelector("#app");
const MATCHDAY_HASH = "#matchday";

const homeState = {
  competitionTab: "standings",
  newsFilter: "all",
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
  ["Morgan Rogers", "Chelsea", "CHE", 61, 5, 8],
  ["Bryan Mbeumo", "Man United", "MUN", 66, 5, 8, true],
  ["Ollie Watkins", "Aston Villa", "AVL", 58, 5, 8],
  ["Dominic Solanke", "Tottenham", "TOT", 73, 4, 8],
  ["João Pedro", "Chelsea", "CHE", 61, 4, 8],
  ["Matheus Cunha", "Man United", "MUN", 66, 4, 8, true]
].map(([player, team, tla, crestId, value, matches, user]) => ({ player, team, tla, crest: `https://crests.football-data.org/${crestId}.png`, value, matches, user: Boolean(user) }));

const ASSISTS = [
  ["Bruno Fernandes", "Man United", "MUN", 66, 7, 8, true],
  ["Martin Ødegaard", "Arsenal", "ARS", 57, 6, 8],
  ["Cole Palmer", "Chelsea", "CHE", 61, 5, 8],
  ["Kevin De Bruyne", "Man City", "MCI", 65, 5, 8],
  ["Youri Tielemans", "Man United", "MUN", 66, 4, 8, true],
  ["Mohamed Salah", "Liverpool", "LIV", 64, 4, 8],
  ["Anthony Gordon", "Newcastle", "NEW", 67, 4, 8],
  ["Bukayo Saka", "Arsenal", "ARS", 57, 4, 8],
  ["Morgan Rogers", "Chelsea", "CHE", 61, 3, 8],
  ["James Maddison", "Tottenham", "TOT", 73, 3, 8],
  ["Bryan Mbeumo", "Man United", "MUN", 66, 3, 8, true],
  ["Kaoru Mitoma", "Brighton", "BHA", 397, 3, 8]
].map(([player, team, tla, crestId, value, matches, user]) => ({ player, team, tla, crest: `https://crests.football-data.org/${crestId}.png`, value, matches, user: Boolean(user) }));

const MAILS = [
  {
    id: "lineup",
    sender: "Assistente técnico",
    senderRole: "Comissão técnica",
    initials: "AT",
    subject: "Equipe titular precisa ser confirmada",
    preview: "A última sessão alterou a condição de três jogadores.",
    time: "17:42",
    tone: "urgent",
    body: [
      "Gabriel, terminamos a avaliação do último treino antes de Stamford Bridge.",
      "Šeško e Ugarte completaram a sessão com carga controlada. Dorgu respondeu bem e está disponível, mas a comissão recomenda revisar a intensidade da pressão para evitar queda física no segundo tempo.",
      "A equipe titular ainda não foi confirmada. O relatório tático sugere manter Bruno como criador pelo meio e atacar o espaço atrás do lateral direito do Chelsea."
    ],
    action: "Preparar partida",
    openMatchday: true
  },
  {
    id: "training",
    sender: "Dr. Helena Costa",
    senderRole: "Performance e medicina",
    initials: "HC",
    subject: "Carga individual: três atletas em atenção",
    preview: "O risco não impede escalação, mas muda a recomendação de minutos.",
    time: "16:18",
    tone: "medical",
    body: [
      "A sessão foi concluída sem nova lesão, porém três atletas ficaram acima da faixa de carga planejada.",
      "Ugarte está em 84% de condição, Šeško em 82% e Bruno apresenta fadiga acumulada leve. Todos podem iniciar, mas recomendamos preparar substituições e reduzir o uso de contra-pressão contínua.",
      "O sistema de treino registrará a decisão para avaliar seu impacto após a partida."
    ],
    action: "Entendido"
  },
  {
    id: "board",
    sender: "Omar Berrada",
    senderRole: "Diretoria executiva",
    initials: "OB",
    subject: "Objetivos e identidade do projeto",
    preview: "A diretoria quer evolução sem abandonar o desenvolvimento do elenco.",
    time: "Ontem",
    tone: "board",
    body: [
      "A direção está satisfeita com a posição atual e com o desenvolvimento da identidade ofensiva.",
      "O objetivo principal permanece a classificação para a Champions League. Também esperamos integração gradual da academia e disciplina financeira no mercado de janeiro.",
      "O resultado contra o Chelsea terá peso esportivo, mas a avaliação seguirá considerando processo, desempenho e evolução do elenco."
    ],
    action: "Arquivar"
  },
  {
    id: "scouting",
    sender: "Equipe de análise",
    senderRole: "Scouting do adversário",
    initials: "EA",
    subject: "Relatório final: Chelsea",
    preview: "Palmer entre linhas e espaço após a subida de James são os pontos-chave.",
    time: "Ontem",
    tone: "analysis",
    body: [
      "O Chelsea deve iniciar em 4-2-3-1 e formar um 3-2-4-1 com a bola.",
      "O maior risco está em Palmer recebendo atrás da primeira linha. Sem a bola, a melhor oportunidade aparece após a subida de Reece James: Cunha pode atacar esse corredor antes da recomposição.",
      "Nossa recomendação é orientar a pressão para a esquerda do Chelsea e buscar a primeira inversão assim que a bola for recuperada."
    ],
    action: "Abrir Matchday",
    openMatchday: true
  }
];

const NAV_GROUPS = [
  { label: "CLUBE", items: [["central", "Central", "grid"], ["inbox", "Caixa de entrada", "mail", "4"], ["squad", "Elenco", "users"], ["tactics", "Táticas", "tactics"], ["training", "Treino", "activity"]] },
  { label: "GESTÃO", items: [["recruitment", "Recrutamento", "search"], ["transfers", "Transferências", "repeat"], ["calendar", "Calendário", "calendar"], ["finances", "Finanças", "wallet"]] },
  { label: "DESENVOLVIMENTO", items: [["academy", "Academia", "academy"], ["staff", "Comissão técnica", "briefcase"]] }
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
      image: "https://commons.wikimedia.org/wiki/Special:FilePath/Emirates_Stadium_-_East_stand_Club_Level.jpg?width=1600",
      timestamp: "Há 46 min"
    },
    {
      home: "Liverpool",
      away: "Tottenham",
      homeGoals: 2,
      awayGoals: 2,
      image: "https://commons.wikimedia.org/wiki/Special:FilePath/Anfield_stadium_in_May_2024.jpg?width=1400",
      timestamp: "Há 2 h"
    },
    {
      home: "Newcastle",
      away: "Aston Villa",
      homeGoals: 2,
      awayGoals: 1,
      image: "https://commons.wikimedia.org/wiki/Special:FilePath/St_James_Park_Newcastle.jpg?width=1400",
      timestamp: "Há 3 h"
    }
  ],
  injuries: [
    {
      player: "Rayan Cherki",
      team: "Man City",
      userTeam: "Man United",
      daysOut: 21,
      image: "https://commons.wikimedia.org/wiki/Special:FilePath/Etihad_Stadium.jpg?width=1400",
      timestamp: "Há 4 h"
    }
  ],
  fixtures: [
    {
      home: "Chelsea",
      away: "Man United",
      userTeam: true,
      summary: "O confronto direto separa duas equipes por um ponto e pode alterar a zona de Champions League antes da rodada 10.",
      image: "https://commons.wikimedia.org/wiki/Special:FilePath/Stamford_Bridge,_Chelsea.jpg?width=1600",
      timestamp: "Hoje"
    }
  ]
});

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function icon(name, size = 19) {
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
    academy: '<path d="m2 9 10-5 10 5-10 5L2 9Z"/><path d="M6 11v5c3 3 9 3 12 0v-5"/><path d="M22 9v6"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18M10 12v2h4v-2"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    play: '<path d="m8 5 11 7-11 7V5Z"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>'
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.grid}</svg>`;
}

function crest(team, className = "") {
  return `<span class="home-crest ${className}"><img src="${escapeHtml(team.crest)}" alt="Escudo do ${escapeHtml(team.shortName || team.name)}" referrerpolicy="no-referrer" /><span>${escapeHtml(team.tla || "CLB")}</span></span>`;
}

function miniCrest(item) {
  return `<span class="mini-crest"><img src="${escapeHtml(item.crest)}" alt="" referrerpolicy="no-referrer" /><i>${escapeHtml(item.tla)}</i></span>`;
}

function formatFixtureDate() {
  const date = new Date(`${MATCH_META.fixtureDate}T12:00:00`);
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(date);
}

function renderNavigation() {
  return NAV_GROUPS.map(group => `<div class="home-nav-group"><span class="home-nav-label">${group.label}</span>${group.items.map(([id, label, iconName, badge]) => `<button class="home-nav-item ${id === "central" ? "active" : ""}" data-home-nav="${id}" type="button"><span class="home-nav-icon">${icon(iconName)}</span><span>${label}</span>${badge ? `<b>${badge}</b>` : ""}</button>`).join("")}</div>`).join("");
}

function renderStandingsRows(items, full = false) {
  return items.map(team => `<div class="standing-row ${team.user ? "user-team" : ""} ${full ? "full" : ""}"><span class="standing-position">${team.pos}</span><span class="standing-club">${miniCrest(team)}<strong>${escapeHtml(team.name)}</strong></span><span>${team.p}</span>${full ? `<span>${team.w}</span><span>${team.d}</span><span>${team.l}</span><span>${team.gf}:${team.ga}</span>` : `<span class="standing-form">${team.form.map(result => `<i class="${result}"></i>`).join("")}</span>`}<span>${team.gd > 0 ? "+" : ""}${team.gd}</span><b>${team.pts}</b></div>`).join("");
}

function renderRankingRows(items, label) {
  return items.map((item, index) => `<div class="ranking-row ${item.user ? "user-team" : ""}"><span>${index + 1}</span><span class="ranking-player">${miniCrest(item)}<span><strong>${escapeHtml(item.player)}</strong><small>${escapeHtml(item.team)}</small></span></span><span>${item.matches}</span><b>${item.value}</b><small>${label}</small></div>`).join("");
}

function competitionItems(tab, full = false) {
  if (tab === "scorers") return renderRankingRows(full ? SCORERS : SCORERS.slice(0, 6), "gols");
  if (tab === "assists") return renderRankingRows(full ? ASSISTS : ASSISTS.slice(0, 6), "assist.");
  return renderStandingsRows(full ? STANDINGS : STANDINGS.slice(0, 6), full);
}

function renderCompetitionHeader(tab, full = false) {
  if (tab === "standings") {
    return full
      ? '<div class="standing-header full"><span>#</span><span>Clube</span><span>J</span><span>V</span><span>E</span><span>D</span><span>Gols</span><span>SG</span><span>PTS</span></div>'
      : '<div class="standing-header"><span>#</span><span>Clube</span><span>J</span><span>Forma</span><span>SG</span><span>PTS</span></div>';
  }
  return '<div class="ranking-header"><span>#</span><span>Jogador</span><span>J</span><span>Total</span><span></span></div>';
}

function renderCompetitionPanel() {
  return `<article class="home-panel standings-panel"><div class="card-heading horizontal"><div><span>PREMIER LEAGUE</span><h2>Competição</h2></div><button data-open-competition type="button">Ver tudo ${icon("arrow", 15)}</button></div><div class="competition-tabs" role="tablist">${[["standings", "Classificação"], ["scorers", "Artilheiros"], ["assists", "Assistências"]].map(([id, label]) => `<button class="${homeState.competitionTab === id ? "active" : ""}" data-competition-tab="${id}" role="tab" aria-selected="${homeState.competitionTab === id}">${label}</button>`).join("")}</div><div data-competition-preview>${renderCompetitionHeader(homeState.competitionTab)}${competitionItems(homeState.competitionTab)}</div></article>`;
}

function renderMailbox() {
  return `<aside class="mailbox-card" id="home-mailbox"><div class="mailbox-heading"><div><span>CAIXA DE ENTRADA</span><h2>Mensagens do clube</h2></div><b>${MAILS.length - homeState.readMail.size}</b></div><div class="mailbox-list">${MAILS.map(mail => `<button class="mail-row ${homeState.readMail.has(mail.id) ? "read" : "unread"}" data-open-mail="${mail.id}" type="button"><span class="mail-avatar ${mail.tone}">${mail.initials}</span><span class="mail-row-copy"><span><strong>${escapeHtml(mail.sender)}</strong><time>${escapeHtml(mail.time)}</time></span><b>${escapeHtml(mail.subject)}</b><small>${escapeHtml(mail.preview)}</small></span><i>${icon("chevron", 15)}</i></button>`).join("")}</div></aside>`;
}

function renderNewsCards(filter = "all") {
  const filtered = filter === "all" ? NEWS : NEWS.filter(item => item.category === filter);
  return filtered.slice(0, 3).map((item, index) => `<article class="news-card ${index === 0 ? "featured" : ""}" tabindex="0"><div class="news-photo"><img src="${escapeHtml(item.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" /><span class="news-photo-fallback">TOUCHLINE</span></div><div class="news-gradient"></div><div class="news-copy"><div class="news-meta"><span>${escapeHtml(item.label)}</span><time>${escapeHtml(item.timestamp)}</time></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.summary)}</p><small>${escapeHtml(item.credit)}</small></div></article>`).join("");
}

function renderCareerHome() {
  const homeTeam = TEAMS[MATCH_META.homeTeamId];
  const awayTeam = TEAMS[MATCH_META.awayTeamId];
  const userTeam = MATCH_META.userTeamIndex === 0 ? homeTeam : awayTeam;

  document.title = "Touchline — Central da carreira";
  document.documentElement.classList.add("career-home-mode");

  app.innerHTML = `<div class="career-home"><main class="home-shell"><aside class="home-sidebar"><div class="home-brand"><span class="home-brand-mark"><i></i><i></i><i></i></span><div><strong>TOUCHLINE</strong><span>CAREER MODE</span></div></div><div class="club-identity">${crest(userTeam, "club")}<div><span>Treinador de</span><strong>${escapeHtml(userTeam.shortName)}</strong></div><button type="button" aria-label="Abrir perfil do clube">${icon("chevron", 16)}</button></div><nav class="home-navigation" aria-label="Navegação principal">${renderNavigation()}</nav><div class="manager-card"><span class="manager-avatar">GM</span><div><strong>Gabriel Machado</strong><span>Manager · Temporada 1</span></div><button data-home-nav="profile" type="button">•••</button></div></aside><section class="home-main"><div class="home-scroll"><section class="home-hero-grid"><article class="next-match-card"><img class="hero-stadium" src="https://commons.wikimedia.org/wiki/Special:FilePath/Stamford_Bridge,_Chelsea.jpg?width=1800" alt="Stamford Bridge" referrerpolicy="no-referrer" /><div class="hero-overlay"></div><div class="hero-head"><div><span>PRÓXIMO JOGO</span><strong>${escapeHtml(MATCH_META.competition.name)} · Rodada ${MATCH_META.matchweek}</strong></div><span class="fixture-status"><i></i> Amanhã</span></div><div class="fixture-showcase"><div class="fixture-side home">${crest(homeTeam, "fixture")}<strong>${escapeHtml(homeTeam.shortName)}</strong><span>3º · 19 pts</span></div><div class="fixture-centre"><span>${formatFixtureDate()}</span><strong>${MATCH_META.kickoffLocal}</strong><small>${escapeHtml(MATCH_META.venue)}</small></div><div class="fixture-side away">${crest(awayTeam, "fixture")}<strong>${escapeHtml(awayTeam.shortName)}</strong><span>4º · 18 pts</span></div></div><div class="hero-footer"><div class="match-readiness"><span><i></i> Preparação <b>82%</b></span><div><i style="width:82%"></i></div></div><button class="prepare-match" data-open-matchday type="button">${icon("play", 18)} Preparar partida</button></div></article>${renderMailbox()}</section><section class="dashboard-row"><div data-competition-panel>${renderCompetitionPanel()}</div><article class="home-panel club-pulse-panel"><div class="card-heading horizontal"><div><span>ÚLTIMOS 5 JOGOS</span><h2>Momento do clube</h2></div><span class="trend-up">↗ 8%</span></div><div class="form-score"><div><strong>10</strong><span>Pontos</span></div><div class="form-streak"><i class="w">V</i><i class="w">V</i><i class="d">E</i><i class="l">D</i><i class="w">V</i></div></div><div class="pulse-metrics"><div><span>Gols marcados</span><strong>14</strong><small>2,0 por jogo</small></div><div><span>Gols sofridos</span><strong>6</strong><small>0,8 por jogo</small></div><div><span>Confiança</span><strong>Alta</strong><small>Elenco engajado</small></div></div><div class="objective-progress"><span><strong>Objetivo da diretoria</strong><small>Classificar para a Champions League</small></span><b>Em curso</b></div></article></section><section class="news-section"><div class="section-title-row"><div><span>MUNDO DO FUTEBOL</span><h2>Notícias</h2><p>Geradas pelo News Desk a partir dos jogos, tabela, lesões e calendário da carreira.</p></div><div class="news-filters" role="tablist" aria-label="Filtros de notícias"><button class="active" data-news-filter="all" role="tab" aria-selected="true">Tudo</button><button data-news-filter="club" role="tab" aria-selected="false">Meu clube</button><button data-news-filter="league" role="tab" aria-selected="false">Liga</button></div></div><div class="news-grid" data-news-grid>${renderNewsCards()}</div></section><footer class="home-legal">O News Desk interpreta somente eventos produzidos pela simulação. Imagens editoriais demonstrativas: Wikimedia Commons.</footer></div></section></main><div data-home-modal-root></div><div class="home-toast" role="status" aria-live="polite"></div></div>`;

  bindHomeInteractions();
}

function renderMailModal(mail) {
  return `<div class="home-modal-layer"><button class="home-modal-scrim" data-close-modal aria-label="Fechar mensagem"></button><section class="mail-modal home-modal" role="dialog" aria-modal="true" aria-labelledby="mail-title"><header class="modal-toolbar"><button class="modal-close" data-close-modal type="button" aria-label="Fechar">${icon("close", 18)}</button><span>CAIXA DE ENTRADA</span><time>${escapeHtml(mail.time)}</time></header><div class="mail-modal-head"><span class="mail-avatar large ${mail.tone}">${mail.initials}</span><div><span>${escapeHtml(mail.senderRole)}</span><h2 id="mail-title">${escapeHtml(mail.subject)}</h2><p>De <strong>${escapeHtml(mail.sender)}</strong> para Gabriel Machado</p></div></div><div class="mail-body">${mail.body.map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join("")}</div><footer class="modal-actions"><button class="modal-secondary" data-close-modal type="button">Voltar à central</button><button class="modal-primary" ${mail.openMatchday ? "data-open-matchday" : "data-close-modal"} type="button">${escapeHtml(mail.action)} ${icon("arrow", 16)}</button></footer></section></div>`;
}

function renderCompetitionModal(tab) {
  return `<div class="home-modal-layer"><button class="home-modal-scrim" data-close-modal aria-label="Fechar competição"></button><section class="competition-modal home-modal" role="dialog" aria-modal="true" aria-labelledby="competition-title"><header class="competition-modal-head"><div><span>PREMIER LEAGUE · 2026/27</span><h2 id="competition-title">Central da competição</h2></div><button class="modal-close" data-close-modal type="button" aria-label="Fechar">${icon("close", 18)}</button></header><div class="competition-tabs modal-tabs" role="tablist">${[["standings", "Classificação"], ["scorers", "Artilheiros"], ["assists", "Assistências"]].map(([id, label]) => `<button class="${tab === id ? "active" : ""}" data-modal-competition-tab="${id}" role="tab" aria-selected="${tab === id}">${label}</button>`).join("")}</div><div class="competition-modal-table" data-modal-competition-body>${renderCompetitionHeader(tab, true)}${competitionItems(tab, true)}</div></section></div>`;
}

function openModal(type, id = null) {
  homeState.modal = { type, id };
  if (type === "mail" && id) homeState.readMail.add(id);
  renderModalRoot();
  refreshMailbox();
}

function renderModalRoot() {
  const root = app.querySelector("[data-home-modal-root]");
  if (!root) return;
  if (!homeState.modal) {
    root.innerHTML = "";
    return;
  }
  root.innerHTML = homeState.modal.type === "mail"
    ? renderMailModal(MAILS.find(mail => mail.id === homeState.modal.id))
    : renderCompetitionModal(homeState.modal.id || homeState.competitionTab);
  requestAnimationFrame(() => root.querySelector(".home-modal-layer")?.classList.add("visible"));
  queueMicrotask(() => root.querySelector(".home-modal button")?.focus());
}

function closeModal() {
  const layer = app.querySelector(".home-modal-layer");
  layer?.classList.remove("visible");
  window.setTimeout(() => {
    homeState.modal = null;
    renderModalRoot();
  }, 180);
}

function refreshMailbox() {
  const current = app.querySelector("#home-mailbox");
  if (!current) return;
  const wrapper = document.createElement("div");
  wrapper.innerHTML = renderMailbox();
  current.replaceWith(wrapper.firstElementChild);
}

function refreshCompetitionPanel() {
  const target = app.querySelector("[data-competition-panel]");
  if (target) target.innerHTML = renderCompetitionPanel();
}

function bindHomeInteractions() {
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

    const mail = event.target.closest("[data-open-mail]");
    if (mail) {
      openModal("mail", mail.dataset.openMail);
      return;
    }

    if (event.target.closest("[data-open-competition]")) {
      openModal("competition", homeState.competitionTab);
      return;
    }

    const tab = event.target.closest("[data-competition-tab]");
    if (tab) {
      homeState.competitionTab = tab.dataset.competitionTab;
      refreshCompetitionPanel();
      return;
    }

    const modalTab = event.target.closest("[data-modal-competition-tab]");
    if (modalTab) {
      homeState.modal.id = modalTab.dataset.modalCompetitionTab;
      renderModalRoot();
      return;
    }

    const filter = event.target.closest("[data-news-filter]");
    if (filter) {
      homeState.newsFilter = filter.dataset.newsFilter;
      app.querySelectorAll("[data-news-filter]").forEach(button => {
        const active = button === filter;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", String(active));
      });
      const grid = app.querySelector("[data-news-grid]");
      if (grid) grid.innerHTML = renderNewsCards(homeState.newsFilter);
      return;
    }

    const nav = event.target.closest("[data-home-nav]");
    if (nav) {
      if (nav.dataset.homeNav === "inbox") {
        app.querySelector("#home-mailbox")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      const labels = {
        central: "Você já está na Central da carreira.",
        squad: "Gestão completa do elenco será conectada sem alterar o Matchday atual.",
        tactics: "Abra Preparar partida para editar o plano tático.",
        training: "O centro de treino será conectado à simulação semanal.",
        recruitment: "A rede de olheiros será ligada ao mercado e às necessidades do elenco.",
        transfers: "A central de transferências será conectada ao mundo vivo.",
        calendar: "O calendário completo será conectado ao avanço da temporada.",
        finances: "Finanças detalhadas serão conectadas a contratos e orçamento.",
        academy: "A academia será integrada ao desenvolvimento de longo prazo.",
        staff: "A comissão técnica ganhará funções e recomendações persistentes.",
        profile: "Perfil do treinador: Gabriel Machado, temporada 1."
      };
      showToast(labels[nav.dataset.homeNav] || "Módulo em construção.");
    }
  });

  app.addEventListener("error", event => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement)) return;
    const holder = image.closest(".home-crest, .mini-crest, .news-photo, .next-match-card");
    if (holder) holder.classList.add("image-missing");
    image.hidden = true;
  }, true);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && homeState.modal) closeModal();
  });
}

let toastTimer = 0;
function showToast(message) {
  const toast = document.querySelector(".home-toast");
  if (!toast) return;
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("visible");
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2800);
}

if (window.location.hash === MATCHDAY_HASH) {
  document.documentElement.classList.remove("career-home-mode");
  import("./app.js");
} else {
  renderCareerHome();
}

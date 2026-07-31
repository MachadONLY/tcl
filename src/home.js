import "./home.css";
import { MATCH_META, TEAMS } from "./mvp-data.js";

const app = document.querySelector("#app");
const MATCHDAY_HASH = "#matchday";

const NEWS = [
  {
    category: "club",
    label: "PRÓXIMO JOGO",
    title: "United encerra a preparação para o duelo em Stamford Bridge",
    summary: "A comissão concentrou o último treino em proteção após perda, compactação e ataque aos corredores.",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Man%20U%20vs%20Chelsea%20ref.jpg?width=1600",
    credit: "Imagem editorial demonstrativa · Wikimedia Commons"
  },
  {
    category: "club",
    label: "BASTIDORES",
    title: "Diretoria reforça confiança no projeto esportivo da temporada",
    summary: "O clube quer consolidar uma identidade reconhecível dentro e fora de casa.",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Manchester%20United%20Old%20Trafford.jpg?width=1400",
    credit: "Imagem editorial demonstrativa · Wikimedia Commons"
  },
  {
    category: "league",
    label: "PREMIER LEAGUE",
    title: "A rodada 9 pode redesenhar a parte de cima da tabela",
    summary: "Chelsea e Manchester United entram separados por apenas um ponto antes do confronto direto.",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Stamford%20Bridge,%20Chelsea%201.jpg?width=1400",
    credit: "Imagem editorial demonstrativa · Wikimedia Commons"
  },
  {
    category: "market",
    label: "MERCADO",
    title: "Scouting amplia observação de meio-campistas jovens e versáteis",
    summary: "O perfil procurado combina resistência à pressão, intensidade e capacidade para atuar em duas funções.",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Old%20Trafford%20inside%202007.jpg?width=1400",
    credit: "Imagem editorial demonstrativa · Wikimedia Commons"
  },
  {
    category: "club",
    label: "ACADEMIA",
    title: "Dois atletas do sub-21 treinam com o elenco principal",
    summary: "A comissão acompanha adaptação física, tomada de decisão e comportamento sem bola.",
    image: "https://commons.wikimedia.org/wiki/Special:FilePath/Manchester%20United%20old%20trafford%20Ank%20Kumar%2005.jpg?width=1400",
    credit: "Imagem editorial demonstrativa · Wikimedia Commons"
  }
];

const TABLE = [
  { pos: 1, name: "Arsenal", tla: "ARS", crest: "https://crests.football-data.org/57.png", p: 8, gd: 13, pts: 22, form: ["w", "w", "w", "d", "w"] },
  { pos: 2, name: "Man City", tla: "MCI", crest: "https://crests.football-data.org/65.png", p: 8, gd: 11, pts: 20, form: ["w", "d", "w", "w", "w"] },
  { pos: 3, name: "Chelsea", tla: "CHE", crest: "https://crests.football-data.org/61.png", p: 8, gd: 9, pts: 19, form: ["w", "w", "d", "w", "l"] },
  { pos: 4, name: "Man United", tla: "MUN", crest: "https://crests.football-data.org/66.png", p: 8, gd: 8, pts: 18, form: ["w", "w", "d", "l", "w"], user: true },
  { pos: 5, name: "Liverpool", tla: "LIV", crest: "https://crests.football-data.org/64.png", p: 8, gd: 6, pts: 17, form: ["d", "w", "w", "l", "w"] },
  { pos: 6, name: "Newcastle", tla: "NEW", crest: "https://crests.football-data.org/67.png", p: 8, gd: 4, pts: 15, form: ["w", "l", "d", "w", "d"] }
];

const NAV_GROUPS = [
  {
    label: "CLUBE",
    items: [
      ["central", "Central", "grid"],
      ["inbox", "Caixa de entrada", "mail", "4"],
      ["squad", "Elenco", "users"],
      ["tactics", "Táticas", "tactics"],
      ["training", "Treino", "activity"]
    ]
  },
  {
    label: "GESTÃO",
    items: [
      ["recruitment", "Recrutamento", "search"],
      ["transfers", "Transferências", "repeat"],
      ["calendar", "Calendário", "calendar"],
      ["finances", "Finanças", "wallet"]
    ]
  },
  {
    label: "DESENVOLVIMENTO",
    items: [
      ["academy", "Academia", "academy"],
      ["staff", "Comissão técnica", "briefcase"]
    ]
  }
];

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
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    play: '<path d="m8 5 11 7-11 7V5Z"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.6 2.4 17.3A2 2 0 0 0 4.1 20h15.8a2 2 0 0 0 1.7-2.7L13.7 3.6a2 2 0 0 0-3.4 0Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41"/>'
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.grid}</svg>`;
}

function crest(team, className = "") {
  return `
    <span class="home-crest ${className}">
      <img src="${escapeHtml(team.crest)}" alt="Escudo do ${escapeHtml(team.shortName || team.name)}" referrerpolicy="no-referrer" />
      <span>${escapeHtml(team.tla || "CLB")}</span>
    </span>
  `;
}

function formatFixtureDate() {
  const date = new Date(`${MATCH_META.fixtureDate}T12:00:00`);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long"
  }).format(date);
}

function renderNavigation() {
  return NAV_GROUPS.map(group => `
    <div class="home-nav-group">
      <span class="home-nav-label">${group.label}</span>
      ${group.items.map(([id, label, iconName, badge]) => `
        <button class="home-nav-item ${id === "central" ? "active" : ""}" data-home-nav="${id}" type="button">
          <span class="home-nav-icon">${icon(iconName)}</span>
          <span>${label}</span>
          ${badge ? `<b>${badge}</b>` : ""}
        </button>
      `).join("")}
    </div>
  `).join("");
}

function renderTable() {
  return TABLE.map(team => `
    <div class="standing-row ${team.user ? "user-team" : ""}">
      <span class="standing-position">${team.pos}</span>
      <span class="standing-club">
        <span class="mini-crest"><img src="${team.crest}" alt="" referrerpolicy="no-referrer" /><i>${team.tla}</i></span>
        <strong>${team.name}</strong>
      </span>
      <span>${team.p}</span>
      <span class="standing-form" aria-label="Forma recente">
        ${team.form.map(result => `<i class="${result}"></i>`).join("")}
      </span>
      <span>${team.gd > 0 ? "+" : ""}${team.gd}</span>
      <b>${team.pts}</b>
    </div>
  `).join("");
}

function renderNewsCards(filter = "all") {
  const filtered = filter === "all" ? NEWS : NEWS.filter(item => item.category === filter);
  const cards = filtered.slice(0, 3);
  return cards.map((item, index) => `
    <article class="news-card ${index === 0 ? "featured" : ""}" tabindex="0">
      <div class="news-photo">
        <img src="${escapeHtml(item.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" />
        <span class="news-photo-fallback">TOUCHLINE</span>
      </div>
      <div class="news-gradient"></div>
      <div class="news-copy">
        <div class="news-meta"><span>${escapeHtml(item.label)}</span><time>Hoje</time></div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.summary)}</p>
        <small>${escapeHtml(item.credit)}</small>
      </div>
    </article>
  `).join("");
}

function renderCareerHome() {
  const homeTeam = TEAMS[MATCH_META.homeTeamId];
  const awayTeam = TEAMS[MATCH_META.awayTeamId];
  const userTeam = MATCH_META.userTeamIndex === 0 ? homeTeam : awayTeam;

  document.title = "Touchline — Central da carreira";
  document.documentElement.classList.add("career-home-mode");

  app.innerHTML = `
    <div class="career-home">
      <main class="home-shell">
        <aside class="home-sidebar">
          <div class="home-brand">
            <span class="home-brand-mark"><i></i><i></i><i></i></span>
            <div><strong>TOUCHLINE</strong><span>CAREER MODE</span></div>
          </div>

          <div class="club-identity">
            ${crest(userTeam, "club")}
            <div><span>Treinador de</span><strong>${escapeHtml(userTeam.shortName)}</strong></div>
            <button type="button" aria-label="Abrir perfil do clube">${icon("chevron", 16)}</button>
          </div>

          <nav class="home-navigation" aria-label="Navegação principal">
            ${renderNavigation()}
          </nav>

          <div class="manager-card">
            <span class="manager-avatar">GM</span>
            <div><strong>Gabriel Machado</strong><span>Manager · Temporada 1</span></div>
            <button data-home-nav="profile" type="button">•••</button>
          </div>
        </aside>

        <section class="home-main">
          <header class="home-topbar">
            <div>
              <p>${icon("sun", 16)} Boa tarde, Gabriel</p>
              <h1>Central da carreira</h1>
            </div>
            <div class="home-top-actions">
              <button class="season-switch" type="button"><span>Temporada</span><strong>2026/27</strong>${icon("chevron", 15)}</button>
              <button class="round-icon" data-home-nav="search" type="button" aria-label="Pesquisar">${icon("search")}</button>
              <button class="round-icon has-alert" data-home-nav="notifications" type="button" aria-label="Notificações">${icon("bell")}</button>
              <button class="continue-day" data-home-nav="continue" type="button"><span>CONTINUAR</span><strong>30 OUT</strong>${icon("arrow", 17)}</button>
            </div>
          </header>

          <div class="home-scroll">
            <section class="home-hero-grid">
              <article class="next-match-card">
                <img class="hero-stadium" src="https://commons.wikimedia.org/wiki/Special:FilePath/Stamford%20Bridge,%20Chelsea.jpg?width=1800" alt="Stamford Bridge" referrerpolicy="no-referrer" />
                <div class="hero-overlay"></div>
                <div class="hero-head">
                  <div><span>PRÓXIMO JOGO</span><strong>${escapeHtml(MATCH_META.competition.name)} · Rodada ${MATCH_META.matchweek}</strong></div>
                  <span class="fixture-status"><i></i> Amanhã</span>
                </div>
                <div class="fixture-showcase">
                  <div class="fixture-side home">${crest(homeTeam, "fixture")}<strong>${escapeHtml(homeTeam.shortName)}</strong><span>3º · 19 pts</span></div>
                  <div class="fixture-centre">
                    <span>${formatFixtureDate()}</span>
                    <strong>${MATCH_META.kickoffLocal}</strong>
                    <small>${escapeHtml(MATCH_META.venue)}</small>
                  </div>
                  <div class="fixture-side away">${crest(awayTeam, "fixture")}<strong>${escapeHtml(awayTeam.shortName)}</strong><span>4º · 18 pts</span></div>
                </div>
                <div class="hero-footer">
                  <div class="match-readiness">
                    <span><i></i> Preparação <b>82%</b></span>
                    <div><i style="width:82%"></i></div>
                  </div>
                  <button class="prepare-match" data-open-matchday type="button">${icon("play", 18)} Preparar partida</button>
                </div>
              </article>

              <aside class="attention-card">
                <div class="card-heading">
                  <div><span>DECISÕES</span><h2>Sua atenção</h2></div>
                  <b>4</b>
                </div>
                <div class="attention-list">
                  <button data-home-nav="lineup" type="button"><span class="attention-icon urgent">${icon("alert", 17)}</span><span><strong>Confirmar a equipe titular</strong><small>Prazo: antes da partida</small></span>${icon("chevron", 16)}</button>
                  <button data-home-nav="training" type="button"><span class="attention-icon">${icon("activity", 17)}</span><span><strong>Ajustar carga do último treino</strong><small>3 jogadores em atenção</small></span>${icon("chevron", 16)}</button>
                  <button data-home-nav="inbox" type="button"><span class="attention-icon">${icon("mail", 17)}</span><span><strong>Responder à diretoria</strong><small>Objetivos da temporada</small></span>${icon("chevron", 16)}</button>
                  <button data-home-nav="scouting" type="button"><span class="attention-icon">${icon("search", 17)}</span><span><strong>Revisar relatório do adversário</strong><small>Atualizado há 2 horas</small></span>${icon("chevron", 16)}</button>
                </div>
              </aside>
            </section>

            <section class="dashboard-row">
              <article class="home-panel standings-panel">
                <div class="card-heading horizontal">
                  <div><span>PREMIER LEAGUE</span><h2>Classificação</h2></div>
                  <button data-home-nav="table" type="button">Tabela completa ${icon("arrow", 15)}</button>
                </div>
                <div class="standing-header"><span>#</span><span>Clube</span><span>J</span><span>Forma</span><span>SG</span><span>PTS</span></div>
                <div class="standings-list">${renderTable()}</div>
              </article>

              <article class="home-panel club-pulse-panel">
                <div class="card-heading horizontal">
                  <div><span>ÚLTIMOS 5 JOGOS</span><h2>Momento do clube</h2></div>
                  <span class="trend-up">↗ 8%</span>
                </div>
                <div class="form-score">
                  <div><strong>10</strong><span>Pontos</span></div>
                  <div class="form-streak"><i class="w">V</i><i class="w">V</i><i class="d">E</i><i class="l">D</i><i class="w">V</i></div>
                </div>
                <div class="pulse-metrics">
                  <div><span>Gols marcados</span><strong>14</strong><small>2,0 por jogo</small></div>
                  <div><span>Gols sofridos</span><strong>6</strong><small>0,8 por jogo</small></div>
                  <div><span>Confiança</span><strong>Alta</strong><small>Elenco engajado</small></div>
                </div>
                <div class="objective-progress">
                  <span><strong>Objetivo da diretoria</strong><small>Classificar para a Champions League</small></span>
                  <b>Em curso</b>
                </div>
              </article>
            </section>

            <section class="news-section">
              <div class="section-title-row">
                <div><span>MUNDO DO FUTEBOL</span><h2>Notícias</h2></div>
                <div class="news-filters" role="tablist" aria-label="Filtros de notícias">
                  <button class="active" data-news-filter="all" role="tab" aria-selected="true">Tudo</button>
                  <button data-news-filter="club" role="tab" aria-selected="false">Meu clube</button>
                  <button data-news-filter="league" role="tab" aria-selected="false">Liga</button>
                  <button data-news-filter="market" role="tab" aria-selected="false">Mercado</button>
                </div>
              </div>
              <div class="news-grid" data-news-grid>${renderNewsCards()}</div>
            </section>

            <section class="dashboard-row lower-row">
              <article class="home-panel week-panel">
                <div class="card-heading horizontal">
                  <div><span>AGENDA</span><h2>Semana do clube</h2></div>
                  <button data-home-nav="calendar" type="button">Abrir calendário ${icon("arrow", 15)}</button>
                </div>
                <div class="week-strip">
                  <div class="done"><span>SEG 26</span><i>${icon("check", 15)}</i><strong>Recuperação</strong><small>Concluído</small></div>
                  <div class="done"><span>TER 27</span><i>${icon("check", 15)}</i><strong>Construção</strong><small>Concluído</small></div>
                  <div class="done"><span>QUA 28</span><i>${icon("check", 15)}</i><strong>Pressão</strong><small>Concluído</small></div>
                  <div class="active"><span>QUI 29</span><i>${icon("activity", 15)}</i><strong>Plano de jogo</strong><small>Hoje · 14:00</small></div>
                  <div><span>SEX 30</span><i>${icon("tactics", 15)}</i><strong>Bolas paradas</strong><small>10:30</small></div>
                  <div class="match"><span>SÁB 31</span><i>${icon("play", 15)}</i><strong>Chelsea</strong><small>15:00 · Fora</small></div>
                  <div><span>DOM 01</span><i>${icon("activity", 15)}</i><strong>Recuperação</strong><small>11:00</small></div>
                </div>
              </article>

              <article class="home-panel finance-panel">
                <div class="card-heading"><div><span>CLUBE</span><h2>Visão executiva</h2></div></div>
                <div class="finance-main"><span>Orçamento de transferências</span><strong>£84,2 mi</strong><small>£375 mil/semana disponíveis em salários</small></div>
                <div class="finance-bars">
                  <div><span>Confiança da diretoria <b>78%</b></span><i><b style="width:78%"></b></i></div>
                  <div><span>Apoio da torcida <b>72%</b></span><i><b style="width:72%"></b></i></div>
                </div>
              </article>
            </section>

            <footer class="home-legal">Imagens editoriais demonstrativas: Wikimedia Commons. Escudos e marcas pertencem aos respectivos titulares.</footer>
          </div>
        </section>
      </main>
      <div class="home-toast" role="status" aria-live="polite"></div>
    </div>
  `;

  bindHomeInteractions();
}

function bindHomeInteractions() {
  app.addEventListener("click", event => {
    const matchButton = event.target.closest("[data-open-matchday]");
    if (matchButton) {
      window.location.hash = MATCHDAY_HASH;
      window.location.reload();
      return;
    }

    const filter = event.target.closest("[data-news-filter]");
    if (filter) {
      const value = filter.dataset.newsFilter;
      app.querySelectorAll("[data-news-filter]").forEach(button => {
        const active = button === filter;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", String(active));
      });
      const grid = app.querySelector("[data-news-grid]");
      if (grid) grid.innerHTML = renderNewsCards(value);
      return;
    }

    const nav = event.target.closest("[data-home-nav]");
    if (nav) {
      const labels = {
        central: "Você já está na Central da carreira.",
        continue: "O calendário avançará quando os sistemas de temporada forem conectados.",
        lineup: "Abra Preparar partida para definir a equipe titular.",
        tactics: "Abra Preparar partida para editar o plano tático.",
        scouting: "O relatório completo está na etapa Análise do pré-jogo.",
        inbox: "Caixa de entrada preparada para a próxima iteração.",
        squad: "Gestão completa do elenco será conectada sem alterar o Matchday atual.",
        training: "O centro de treino será o próximo módulo sistêmico da carreira.",
        recruitment: "Recrutamento e rede de olheiros estão planejados para o modo carreira.",
        transfers: "Central de transferências será conectada ao mundo vivo.",
        calendar: "Calendário completo será conectado ao avanço de temporada.",
        finances: "Finanças detalhadas serão conectadas ao orçamento e contratos.",
        academy: "Academia será integrada ao desenvolvimento de longo prazo.",
        staff: "Comissão técnica será integrada às decisões e recomendações.",
        table: "A competição completa será conectada à simulação de temporada.",
        search: "Busca global será conectada a clubes, atletas e competições.",
        notifications: "Você tem 4 decisões pendentes.",
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

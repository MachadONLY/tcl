const PLAYER_ASSETS = Object.freeze({
  haaland: "/assets/players/2026-27/mci-737066.png",
  saka: "/assets/players/2026-27/ars-961995.png",
  palmer: "/assets/players/2026-27/che-1096353.png",
  rodri: "/assets/players/2026-27/mci-675088.png",
  bruno: "/assets/players/2026-27/mun-422685.png"
});

function icon(name) {
  const paths = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5M9.5 20v-6h5v6"/>',
    career: '<rect x="4" y="7" width="16" height="12" rx="1.5"/><path d="M9 7V5h6v2M4 12h16M10 12v2h4v-2"/>',
    clubs: '<path d="M12 3 20 6v5c0 5.3-3.2 8.3-8 10-4.8-1.7-8-4.7-8-10V6l8-3Z"/><path d="m9 12 2 2 4-5"/>',
    season: '<rect x="4" y="5.5" width="16" height="14.5" rx="1.5"/><path d="M8 3v5M16 3v5M4 10h16"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1A8 8 0 0 0 15 6l-.3-2.6h-4L10.4 6A8 8 0 0 0 8.8 7L6.4 6 4.4 9.5 6.5 11a7 7 0 0 0 0 2l-2.1 1.5 2 3.4 2.4-1A8 8 0 0 0 10.4 18l.3 2.6h4L15 18a8 8 0 0 0 1.6-1l2.4 1 2-3.5-2.1-1.5c.1-.3.1-.7.1-1Z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21c.8-5 3.2-7 7.5-7s6.7 2 7.5 7"/>',
    arrow: '<path d="M5 12h13M14 7l5 5-5 5"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.home}</svg>`;
}

function futureTile({ title, copy, image, imageAlt, className = "" }) {
  return `<article class="tgh-tile tgh-future ${className}" aria-disabled="true">
    <div class="tgh-tile-copy">
      <h2>${title}</h2>
      <span class="tgh-coming-soon">EM BREVE</span>
      <p>${copy}</p>
    </div>
    ${image ? `<img class="tgh-player" src="${image}" alt="${imageAlt}" loading="eager" decoding="async">` : ""}
  </article>`;
}

export function renderGameHome() {
  document.title = "Touchline — Career OS";
  const app = document.querySelector("#app");
  if (!app) return;

  app.innerHTML = `<main class="tgh-home" data-game-home aria-labelledby="tgh-title">
    <div class="tgh-backdrop" aria-hidden="true"></div>
    <div class="tgh-light tgh-light-one" aria-hidden="true"></div>
    <div class="tgh-light tgh-light-two" aria-hidden="true"></div>

    <header class="tgh-topbar">
      <div class="tgh-brand">
        <strong id="tgh-title"><span>TOUCH</span>LINE</strong>
        <small>CAREER OS</small>
      </div>
      <div class="tgh-status" aria-label="Temporada e modo de jogo">
        <span class="tgh-status-icon">${icon("user")}</span>
        <span><small>MODO</small><b>MANAGER CAREER</b></span>
        <i></i>
        <span><small>TEMPORADA</small><b>2026/27</b></span>
      </div>
    </header>

    <section class="tgh-frame">
      <aside class="tgh-sidebar" aria-label="Menu principal">
        <section class="tgh-profile">
          <div class="tgh-profile-avatar"><span>GM</span></div>
          <div class="tgh-profile-copy">
            <small>MANAGER</small>
            <strong>GABRIEL MACHADO</strong>
            <span>BRASIL</span>
          </div>
          <div class="tgh-reputation"><small>REPUTAÇÃO</small><b>INICIANTE</b><span>★<i>★★★★</i></span></div>
        </section>

        <nav class="tgh-nav">
          <div class="tgh-nav-item">${icon("home")}<span>INÍCIO</span></div>
          <div class="tgh-nav-item is-active">${icon("career")}<span>CARREIRA</span></div>
          <div class="tgh-nav-item is-disabled">${icon("clubs")}<span>CLUBES</span><small>EM BREVE</small></div>
          <div class="tgh-nav-item is-disabled">${icon("season")}<span>TEMPORADA</span><small>EM BREVE</small></div>
          <div class="tgh-nav-item is-disabled">${icon("settings")}<span>CONFIGURAÇÕES</span><small>EM BREVE</small></div>
        </nav>

        <section class="tgh-season-card">
          <small>TEMPORADA ATUAL</small>
          <strong>2026/27</strong>
          <span>PREMIER LEAGUE</span>
        </section>
      </aside>

      <section class="tgh-grid" aria-label="Modos e recursos">
        <button class="tgh-tile tgh-create" type="button" data-start-career aria-label="Criar carreira como manager">
          <div class="tgh-create-copy">
            <span class="tgh-kicker">PREMIER LEAGUE 2026/27</span>
            <h1>CRIAR<br>CARREIRA</h1>
            <p>Assuma um clube da Premier League e construa sua história como manager.</p>
            <span class="tgh-create-cta">COMEÇAR AGORA ${icon("arrow")}</span>
          </div>
          <span class="tgh-create-number" aria-hidden="true">01</span>
          <img class="tgh-create-player" src="${PLAYER_ASSETS.haaland}" alt="Erling Haaland" loading="eager" decoding="async">
        </button>

        ${futureTile({
          title: "CENTRO DE NOTÍCIAS",
          copy: "Acompanhe as principais histórias do mundo do futebol.",
          image: PLAYER_ASSETS.saka,
          imageAlt: "Bukayo Saka",
          className: "tgh-news"
        })}

        ${futureTile({
          title: "DESTAQUES DA LIGA",
          copy: "Reviva gols, resultados e momentos decisivos da rodada.",
          image: PLAYER_ASSETS.palmer,
          imageAlt: "Cole Palmer",
          className: "tgh-highlights"
        })}

        ${futureTile({
          title: "TREINO",
          copy: "Desenvolva o elenco e prepare cada semana da temporada.",
          image: PLAYER_ASSETS.rodri,
          imageAlt: "Rodri",
          className: "tgh-training"
        })}

        ${futureTile({
          title: "MERCADO",
          copy: "Negocie contratações e transforme a identidade do clube.",
          image: PLAYER_ASSETS.bruno,
          imageAlt: "Bruno Fernandes",
          className: "tgh-market"
        })}

        ${futureTile({
          title: "ESTATÍSTICAS",
          copy: "Analise desempenho, tabela e evolução da sua equipe.",
          image: PLAYER_ASSETS.saka,
          imageAlt: "Bukayo Saka",
          className: "tgh-stats"
        })}
      </section>
    </section>

    <footer class="tgh-controls">
      <span><b>A</b> Selecionar</span>
      <span><b>ENTER</b> Criar carreira</span>
      <small>TOUCHLINE · CAREER OS</small>
    </footer>
  </main>`;
}

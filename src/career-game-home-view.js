const PLAYER_ASSETS = Object.freeze({
  bruno: "/assets/ui/home/bruno-fernandes-hero.webp",
  haaland: "/assets/players/2026-27/mci-737066.png",
  saka: "/assets/players/2026-27/ars-961995.png",
  palmer: "/assets/players/2026-27/che-1096353.png"
});

function icon(name) {
  const paths = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5M9.5 20v-6h5v6"/>',
    play: '<path d="m9 7 8 5-8 5V7Z"/><circle cx="12" cy="12" r="9"/>',
    online: '<circle cx="12" cy="12" r="3"/><path d="M5.6 18.4a9 9 0 0 1 0-12.8M18.4 5.6a9 9 0 0 1 0 12.8M8.4 15.6a5 5 0 0 1 0-7.2M15.6 8.4a5 5 0 0 1 0 7.2"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="14.5" rx="1.5"/><path d="M8 3v5M16 3v5M4 10h16"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1A8 8 0 0 0 15 6l-.3-2.6h-4L10.4 6A8 8 0 0 0 8.8 7L6.4 6 4.4 9.5 6.5 11a7 7 0 0 0 0 2l-2.1 1.5 2 3.4 2.4-1A8 8 0 0 0 10.4 18l.3 2.6h4L15 18a8 8 0 0 0 1.6-1l2.4 1 2-3.5-2.1-1.5c.1-.3.1-.7.1-1Z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21c.8-5 3.2-7 7.5-7s6.7 2 7.5 7"/>',
    arrow: '<path d="M5 12h13M14 7l5 5-5 5"/>',
    trophy: '<path d="M8 4h8v4a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5v1a4 4 0 0 0 4 4M16 6h3v1a4 4 0 0 1-4 4M12 12v5M8 20h8M9 17h6"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.home}</svg>`;
}

function lockedTile({ title, label, copy, image, alt, className }) {
  return `<article class="tgh-tile tgh-locked ${className}" aria-disabled="true">
    <div class="tgh-card-copy">
      <span class="tgh-eyebrow">${label}</span>
      <h2>${title}</h2>
      <p>${copy}</p>
      <span class="tgh-lock-label">EM BREVE</span>
    </div>
    <img class="tgh-card-player" src="${image}" alt="${alt}" loading="eager" decoding="async">
  </article>`;
}

export function renderGameHome() {
  document.title = "Touchline — Manager Career";
  const app = document.querySelector("#app");
  if (!app) return;

  app.innerHTML = `<main class="tgh-home" data-game-home aria-labelledby="tgh-title">
    <div class="tgh-backdrop" aria-hidden="true"></div>
    <div class="tgh-ambient tgh-ambient-left" aria-hidden="true"></div>
    <div class="tgh-ambient tgh-ambient-right" aria-hidden="true"></div>

    <header class="tgh-topbar">
      <a class="tgh-brand" href="#welcome" aria-label="Touchline">
        <span class="tgh-brand-mark">T</span>
        <span class="tgh-brand-type">
          <strong id="tgh-title"><i>TOUCH</i>LINE</strong>
          <small>MANAGER CAREER</small>
        </span>
      </a>

      <div class="tgh-status" aria-label="Perfil e temporada">
        <span class="tgh-status-user">${icon("user")}</span>
        <span><small>PERFIL</small><b>GABRIEL MACHADO</b></span>
        <i></i>
        <span><small>TEMPORADA</small><b>2026/27</b></span>
      </div>
    </header>

    <section class="tgh-shell">
      <div class="tgh-shell-brand" aria-hidden="true">
        <span class="tgh-brand-mark is-small">T</span>
        <b>TOUCHLINE</b>
      </div>

      <div class="tgh-layout">
        <aside class="tgh-sidebar" aria-label="Menu principal">
          <section class="tgh-profile">
            <div class="tgh-profile-avatar">${icon("user")}</div>
            <div class="tgh-profile-copy">
              <small>MANAGER</small>
              <strong>GABRIEL MACHADO</strong>
              <span>BRASIL · NÍVEL 1</span>
            </div>
          </section>

          <nav class="tgh-nav">
            <div class="tgh-nav-item">${icon("home")}<span>INÍCIO</span></div>
            <div class="tgh-nav-item is-active">${icon("play")}<span>JOGAR</span></div>
            <div class="tgh-nav-item is-disabled">${icon("online")}<span>ONLINE</span></div>
            <div class="tgh-nav-item is-disabled">${icon("calendar")}<span>TEMPORADA</span></div>
            <div class="tgh-nav-item is-disabled">${icon("settings")}<span>CONFIGURAÇÕES</span></div>
          </nav>

          <section class="tgh-side-panel">
            <span class="tgh-side-panel-icon">${icon("trophy")}</span>
            <div>
              <small>COMPETIÇÃO</small>
              <strong>PREMIER LEAGUE</strong>
              <span>20 CLUBES · 2026/27</span>
            </div>
          </section>
        </aside>

        <section class="tgh-grid" aria-label="Modos de jogo">
          <button class="tgh-tile tgh-career" type="button" data-start-career aria-label="Criar carreira como manager">
            <div class="tgh-career-lines" aria-hidden="true"></div>
            <div class="tgh-career-copy">
              <span class="tgh-career-kicker">MODO PRINCIPAL</span>
              <h1>CRIAR<br>CARREIRA</h1>
              <p>Escolha um clube da Premier League e comece sua jornada como manager.</p>
              <span class="tgh-career-cta">COMEÇAR ${icon("arrow")}</span>
            </div>
            <div class="tgh-career-meta">
              <span>PREMIER LEAGUE</span>
              <b>2026/27</b>
            </div>
            <img class="tgh-career-player" src="${PLAYER_ASSETS.bruno}" alt="Bruno Fernandes" loading="eager" decoding="async">
          </button>

          <article class="tgh-tile tgh-league" aria-disabled="true">
            <div class="tgh-card-copy">
              <span class="tgh-eyebrow">A NOVA TEMPORADA</span>
              <h2>PREMIER<br>LEAGUE</h2>
              <p>Os maiores clubes da Inglaterra em uma carreira completa de manager.</p>
              <span class="tgh-lock-label">MODO OFICIAL · 2026/27</span>
            </div>
            <div class="tgh-league-glow" aria-hidden="true"></div>
            <img class="tgh-league-player" src="${PLAYER_ASSETS.haaland}" alt="Erling Haaland" loading="eager" decoding="async">
          </article>

          ${lockedTile({
            title: "CENTRO DE NOTÍCIAS",
            label: "MUNDO DO FUTEBOL",
            copy: "Notícias, transferências e histórias da temporada.",
            image: PLAYER_ASSETS.saka,
            alt: "Bukayo Saka",
            className: "tgh-news"
          })}

          ${lockedTile({
            title: "DESTAQUES DA LIGA",
            label: "RESULTADOS E NÚMEROS",
            copy: "Tabela, artilharia e momentos decisivos de cada rodada.",
            image: PLAYER_ASSETS.palmer,
            alt: "Cole Palmer",
            className: "tgh-highlights"
          })}
        </section>
      </div>
    </section>

    <footer class="tgh-controls">
      <span><b>A</b> SELECIONAR</span>
      <span><b>ENTER</b> CRIAR CARREIRA</span>
      <small>TOUCHLINE · MANAGER CAREER</small>
    </footer>
  </main>`;
}

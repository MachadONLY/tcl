import { CLUBS, SEASON } from "./offline-data.js";
import { activateMedia, localAsset, mediaStack } from "./offline-media.js";

function logoMark() {
  return `<svg class="career-start-logo-mark" viewBox="0 0 120 120" aria-hidden="true">
    <path d="M60 7 105 25v31c0 29-18 48-45 58C33 104 15 85 15 56V25L60 7Z" fill="none" stroke="currentColor" stroke-width="5"/>
    <path d="M32 36h56M60 36v51M39 87h42" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="square"/>
    <circle cx="60" cy="58" r="11" fill="none" stroke="currentColor" stroke-width="4"/>
  </svg>`;
}

function trophyMark() {
  return `<span class="tl-club-card__trophy" aria-hidden="true">
    <svg viewBox="0 0 72 72" fill="none">
      <path d="M23 13h26v8c0 13-5 22-13 26-8-4-13-13-13-26v-8Z" fill="currentColor"/>
      <path d="M22 18H12v6c0 9 6 15 14 15M50 18h10v6c0 9-6 15-14 15" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>
      <path d="M36 46v10M25 61h22" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
      <path d="m20 8 4 5M36 6v7M52 8l-4 5" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
    </svg>
  </span>`;
}

export function setOnboardingMode(active) {
  document.documentElement.classList.toggle("touchline-onboarding-mode", active);
  document.body.classList.toggle("touchline-onboarding-mode", active);
  if (active) document.getElementById("touchline-screen-navigation")?.remove();
}

export function renderWelcome() {
  setOnboardingMode(true);
  document.title = "Touchline — Iniciar carreira";
  const app = document.querySelector("#app");
  if (!app) return;
  app.innerHTML = `<main class="career-start career-start-welcome offline-welcome-v16">
    <div class="career-start-vignette"></div>
    <section class="career-start-brand" aria-labelledby="career-start-title">
      ${logoMark()}<p>THE MANAGER EXPERIENCE</p><h1 id="career-start-title">TOUCHLINE</h1>
      <div class="career-start-rule"><span></span><b>CAREER MODE</b><span></span></div>
      <p class="career-start-season">PREMIER LEAGUE · ${SEASON}</p>
    </section>
    <button class="career-start-enter" type="button" data-start-career>
      <span>INICIAR NOVA CARREIRA</span><small>Construa sua história à beira do campo</small>
    </button>
    <footer class="career-start-footer"><span>TOUCHLINE STUDIOS</span><small>Pressione Enter ou clique para continuar</small></footer>
  </main>`;
}

function railMarkup(manifest, selectedIndex) {
  return CLUBS.map((club, index) => `<button class="tl-club-select__rail-item${index === selectedIndex ? " selected" : ""}"
    type="button" data-club-index="${index}" aria-label="Selecionar ${club.name}">
    <img src="${localAsset(manifest.clubs[club.code].crest)}" alt="" width="64" height="64" decoding="async" draggable="false" />
    <span class="tl-club-select__rail-code">${club.code}</span>
  </button>`).join("");
}

export function selectorMarkup(manifest, selectedIndex) {
  return `<main class="career-club-selection tl-club-select" data-offline-ready="false">
    <div class="tl-club-select__background">${mediaStack("backdrop", "tl-club-select__background-media")}</div>

    <header class="tl-club-select__header">
      <div>
        <span class="tl-club-select__eyebrow">PREMIER LEAGUE · CARREIRA</span>
        <h1>ESCOLHA SEU CLUBE</h1>
        <p>Assuma o comando e conheça o clube onde começa a sua história.</p>
      </div>
      <div class="tl-club-select__season"><span>TEMPORADA</span><strong>${SEASON}</strong></div>
    </header>

    <nav class="tl-club-select__rail" aria-label="Clubes da Premier League ${SEASON}">
      <button class="tl-club-select__rail-arrow" type="button" data-club-step="-1" aria-label="Clube anterior">‹</button>
      <div class="tl-club-select__rail-track">${railMarkup(manifest, selectedIndex)}</div>
      <button class="tl-club-select__rail-arrow" type="button" data-club-step="1" aria-label="Próximo clube">›</button>
    </nav>

    <div class="tl-club-select__stage" data-club-details>
      <section class="tl-club-card" aria-live="polite">
        <article class="tl-club-card__identity">
          <div class="tl-club-tile tl-club-card__crest">
            ${mediaStack("crest", "tl-club-card__crest-media")}
            <h2 data-copy="club-name"></h2>
          </div>

          <div class="tl-club-tile tl-club-card__city">
            ${mediaStack("city", "tl-club-card__city-media")}
            <div class="tl-club-card__overlay tl-club-card__overlay--center">
              <span aria-hidden="true">⌖</span>
              <span class="tl-club-label">LOCALIZAÇÃO</span>
              <strong data-copy="city"></strong>
            </div>
          </div>

          <div class="tl-club-tile tl-club-card__manager">
            ${mediaStack("manager", "tl-club-card__manager-media")}
            <div class="tl-club-card__overlay tl-club-card__overlay--bottom">
              <span class="tl-club-label">TÉCNICO</span>
              <strong data-copy="manager"></strong>
            </div>
          </div>

          <div class="tl-club-tile tl-club-card__titles">
            ${trophyMark()}
            <span class="tl-club-label">TÍTULOS PREMIER LEAGUE</span>
            <strong data-copy="titles"></strong>
          </div>

          <div class="tl-club-tile tl-club-card__stadium">
            ${mediaStack("stadium", "tl-club-card__stadium-media")}
            <div class="tl-club-card__stadium-copy">
              <div><span class="tl-club-label">ESTÁDIO</span><strong data-copy="stadium"></strong></div>
              <div><span class="tl-club-label">CAPACIDADE</span><strong data-copy="capacity"></strong></div>
            </div>
          </div>

          <div class="tl-club-tile tl-club-card__founded">
            <span class="tl-club-label">FUNDAÇÃO</span>
            <strong data-copy="founded"></strong>
          </div>
        </article>

        <article class="tl-club-card__story">
          <div class="tl-club-story__copy">
            <span class="tl-club-label">APELIDO</span>
            <h3 data-copy="nickname"></h3>
            <p data-copy="story"></p>
          </div>
          <div class="tl-club-story__stamp"><span>PREMIER LEAGUE</span><strong>26/27</strong></div>

          <div class="tl-club-story__kits">
            <span class="tl-club-section-heading">UNIFORMES 2026/27</span>
            <div class="tl-club-story__kit">${mediaStack("homeKit", "tl-club-story__kit-media")}<small>CASA</small></div>
            <div class="tl-club-story__kit">${mediaStack("awayKit", "tl-club-story__kit-media")}<small>FORA</small></div>
          </div>

          <div class="tl-club-story__rival">
            <span class="tl-club-section-heading">PRINCIPAL RIVAL</span>
            ${mediaStack("rivalCrest", "tl-club-story__rival-media")}
            <strong data-copy="rival"></strong>
          </div>
        </article>
      </section>
    </div>

    <footer class="tl-club-select__controls">
      <span><b class="tl-club-select__control-key">A</b>SELECIONAR</span>
      <span><b class="tl-club-select__control-key">B</b>VOLTAR</span>
    </footer>
  </main>`;
}

function setCopy(root, key, value) {
  const node = root.querySelector(`[data-copy="${key}"]`);
  if (node && node.textContent !== String(value ?? "")) node.textContent = String(value ?? "");
}

export function updateRail(root, selectedIndex) {
  root.querySelectorAll("[data-club-index]").forEach((item, index) => {
    const selected = index === selectedIndex;
    item.classList.toggle("selected", selected);
    item.setAttribute("aria-current", selected ? "true" : "false");
    item.querySelector("img")?.setAttribute("fetchpriority", selected ? "high" : "auto");
  });
  root.querySelector(`[data-club-index="${selectedIndex}"]`)?.scrollIntoView({ behavior: "auto", inline: "center", block: "nearest" });
}

export function commitClub(root, club, staged) {
  root.style.setProperty("--club-accent", club.accent);
  root.style.setProperty("--club-accent-dark", club.accentDark);
  root.style.setProperty("--club-text", club.text);
  root.dataset.clubCode = club.code;
  root.dataset.offlineReady = "true";
  root.dataset.switching = "false";

  setCopy(root, "club-name", club.shortName || club.name);
  setCopy(root, "city", club.city);
  setCopy(root, "manager", club.manager);
  setCopy(root, "titles", club.titles);
  setCopy(root, "stadium", club.stadium);
  setCopy(root, "capacity", club.capacity);
  setCopy(root, "founded", club.founded);
  setCopy(root, "nickname", club.nickname);
  setCopy(root, "story", club.story);
  setCopy(root, "rival", club.rival);
  activateMedia(staged);
}

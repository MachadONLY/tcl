import { CLUBS, SEASON } from "./offline-data.js";
import { activateMedia, localAsset, mediaStack } from "./offline-media.js";

function logoMark() {
  return `<svg class="career-start-logo-mark" viewBox="0 0 120 120" aria-hidden="true">
    <path d="M60 7 105 25v31c0 29-18 48-45 58C33 104 15 85 15 56V25L60 7Z" fill="none" stroke="currentColor" stroke-width="5"/>
    <path d="M32 36h56M60 36v51M39 87h42" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="square"/>
    <circle cx="60" cy="58" r="11" fill="none" stroke="currentColor" stroke-width="4"/>
  </svg>`;
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
  return CLUBS.map((club, index) => `<button class="club-rail-item${index === selectedIndex ? " selected" : ""}"
    type="button" data-club-index="${index}" aria-label="Selecionar ${club.name}">
    <img src="${localAsset(manifest.clubs[club.code].crest)}" alt="" width="64" height="64" decoding="async" draggable="false" />
    <span>${club.code}</span>
  </button>`).join("");
}

export function selectorMarkup(manifest, selectedIndex) {
  return `<main class="career-start career-club-selection onboarding-premier-v7 onboarding-offline-v16" data-offline-ready="false">
    <header class="club-selection-header">
      <div><span>PREMIER LEAGUE · CARREIRA</span><h1>ESCOLHA SEU CLUBE</h1><p>Assuma o comando e defina onde começa a sua história.</p></div>
      <div class="club-season-badge"><span>TEMPORADA</span><strong>${SEASON}</strong></div>
    </header>
    <nav class="club-rail" aria-label="Clubes da Premier League ${SEASON}">
      <button class="club-rail-arrow" type="button" data-club-step="-1" aria-label="Clube anterior">‹</button>
      <div class="club-rail-track">${railMarkup(manifest, selectedIndex)}</div>
      <button class="club-rail-arrow" type="button" data-club-step="1" aria-label="Próximo clube">›</button>
    </nav>
    <div class="club-selection-details" data-club-details>
      ${mediaStack("backdrop", "club-selection-background")}
      <section class="club-selection-grid">
        <article class="club-identity-card">
          <div class="club-badge-panel">${mediaStack("crest", "club-badge-media")}<h2 data-copy="club-name"></h2></div>
          <div class="club-location-panel">${mediaStack("city", "club-panel-photo")}<span class="club-data-label">LOCALIZAÇÃO</span><strong data-copy="city"></strong></div>
          <div class="club-manager-panel">${mediaStack("manager", "club-panel-photo club-manager-photo")}<div class="club-manager-copy"><span class="club-data-label">TÉCNICO</span><strong data-copy="manager"></strong></div></div>
          <div class="club-titles-panel"><span class="offline-trophy" aria-hidden="true">♛</span><span class="club-data-label">TÍTULOS NACIONAIS</span><strong data-copy="titles"></strong></div>
          <div class="club-stadium-panel">${mediaStack("stadium", "club-panel-photo")}<div><span class="club-data-label">ESTÁDIO</span><strong data-copy="stadium"></strong></div><div><span class="club-data-label">CAPACIDADE</span><strong data-copy="capacity"></strong></div></div>
          <div class="club-founded-panel"><span class="club-data-label">FUNDAÇÃO</span><strong data-copy="founded"></strong></div>
        </article>
        <article class="club-story-card">
          <div class="club-story-copy"><span class="club-data-label">APELIDO</span><h3 data-copy="nickname"></h3><p data-copy="story"></p></div>
          <div class="club-season-stamp"><span>PREMIER LEAGUE</span><strong>26/27</strong></div>
          <div class="club-kits-panel"><span class="club-panel-heading">UNIFORMES 2026/27</span>
            <div class="club-kit-slot">${mediaStack("homeKit", "club-kit-media")}<small>CASA</small></div>
            <div class="club-kit-slot">${mediaStack("awayKit", "club-kit-media")}<small>FORA</small></div>
          </div>
          <div class="club-rival-panel"><span class="club-panel-heading">PRINCIPAL RIVAL</span>${mediaStack("rivalCrest", "club-rival-media")}<strong data-copy="rival"></strong></div>
        </article>
      </section>
    </div>
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

import "./career-onboarding.css";

const CAREER_STORAGE_KEY = "touchline.career.mode.v1";
const SPORTS_DB_KEY = "3";
const DEFAULT_BACKGROUND = "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=2200&q=86";

const CLUBS = [
  {
    code: "ARS", name: "Arsenal", apiName: "Arsenal", crestId: 57,
    city: "London", stadium: "Emirates Stadium", capacity: "60.704", founded: "1886",
    nickname: "The Gunners", manager: "Mikel Arteta", managerWiki: "Mikel_Arteta",
    rival: "Tottenham Hotspur", rivalCode: "TOT", titles: "14",
    accent: "#ef233c", accentDark: "#8c101f", text: "#ffffff",
    home: { base: "#d71920", detail: "#ffffff", pattern: "sleeves" },
    away: { base: "#fff000", detail: "#102b5c", pattern: "trim" },
    story: "Campeão inglês em 2025/26, o Arsenal inicia a defesa do título sob o comando de Mikel Arteta."
  },
  {
    code: "AVL", name: "Aston Villa", apiName: "Aston Villa", crestId: 58,
    city: "Birmingham", stadium: "Villa Park", capacity: "42.918", founded: "1874",
    nickname: "The Villans", manager: "Unai Emery", managerWiki: "Unai_Emery",
    rival: "Birmingham City", rivalCode: null, titles: "7",
    accent: "#7a2048", accentDark: "#431127", text: "#ffffff",
    home: { base: "#7a2048", detail: "#95c9e8", pattern: "sleeves" },
    away: { base: "#f4f2e9", detail: "#7a2048", pattern: "trim" },
    story: "Unai Emery conduz um projeto consolidado, com ambição europeia e identidade competitiva em Villa Park."
  },
  {
    code: "BOU", name: "AFC Bournemouth", shortName: "Bournemouth", apiName: "Bournemouth", crestId: 1044,
    city: "Bournemouth", stadium: "Vitality Stadium", capacity: "11.307", founded: "1899",
    nickname: "The Cherries", manager: "Marco Rose", managerWiki: "Marco_Rose",
    rival: "Southampton", rivalCode: null, titles: "0",
    accent: "#d71920", accentDark: "#6f1015", text: "#ffffff",
    home: { base: "#d71920", detail: "#111111", pattern: "stripes" },
    away: { base: "#e8f5ff", detail: "#101820", pattern: "trim" },
    story: "Marco Rose assume um clube moderno, agressivo e acostumado a desafiar estruturas maiores."
  },
  {
    code: "BRE", name: "Brentford", apiName: "Brentford", crestId: 402,
    city: "London", stadium: "Gtech Community Stadium", capacity: "17.250", founded: "1889",
    nickname: "The Bees", manager: "Keith Andrews", managerWiki: "Keith_Andrews_(footballer)",
    rival: "Fulham", rivalCode: "FUL", titles: "0",
    accent: "#e30613", accentDark: "#76070d", text: "#ffffff",
    home: { base: "#ffffff", detail: "#df1625", pattern: "stripes" },
    away: { base: "#171717", detail: "#f0cf25", pattern: "trim" },
    story: "Dados, recrutamento inteligente e intensidade continuam definindo a identidade dos Bees."
  },
  {
    code: "BHA", name: "Brighton & Hove Albion", shortName: "Brighton", apiName: "Brighton", crestId: 397,
    city: "Brighton", stadium: "American Express Stadium", capacity: "31.876", founded: "1901",
    nickname: "The Seagulls", manager: "Fabian Hürzeler", managerWiki: "Fabian_Hürzeler",
    rival: "Crystal Palace", rivalCode: "CRY", titles: "0",
    accent: "#0057b8", accentDark: "#00326b", text: "#ffffff",
    home: { base: "#ffffff", detail: "#0057b8", pattern: "stripes" },
    away: { base: "#ff6a00", detail: "#101820", pattern: "trim" },
    story: "Um dos projetos mais progressivos da liga, com futebol corajoso e forte desenvolvimento de talentos."
  },
  {
    code: "CHE", name: "Chelsea", apiName: "Chelsea", crestId: 61,
    city: "London", stadium: "Stamford Bridge", capacity: "40.173", founded: "1905",
    nickname: "The Blues", manager: "Xabi Alonso", managerWiki: "Xabi_Alonso",
    rival: "Fulham", rivalCode: "FUL", titles: "6",
    accent: "#034694", accentDark: "#012b5c", text: "#ffffff",
    home: { base: "#034694", detail: "#ffffff", pattern: "trim" },
    away: { base: "#f5f3eb", detail: "#d51d2e", pattern: "stripe-center" },
    story: "Xabi Alonso inicia uma nova era em Stamford Bridge com pressão imediata por títulos."
  },
  {
    code: "COV", name: "Coventry City", shortName: "Coventry", apiName: "Coventry City", crestId: 1076,
    city: "Coventry", stadium: "Coventry Building Society Arena", capacity: "32.609", founded: "1883",
    nickname: "The Sky Blues", manager: "Frank Lampard", managerWiki: "Frank_Lampard",
    rival: "Leicester City", rivalCode: null, titles: "0",
    accent: "#69bfe7", accentDark: "#246c91", text: "#07121a",
    home: { base: "#69bfe7", detail: "#ffffff", pattern: "trim" },
    away: { base: "#181818", detail: "#69bfe7", pattern: "stripe-center" },
    story: "De volta à elite após 25 anos, Coventry chega com Frank Lampard e a energia de um novo começo."
  },
  {
    code: "CRY", name: "Crystal Palace", apiName: "Crystal Palace", crestId: 354,
    city: "London", stadium: "Selhurst Park", capacity: "25.486", founded: "1861",
    nickname: "The Eagles", manager: "Pierre Sage", managerWiki: "Pierre_Sage",
    rival: "Brighton & Hove Albion", rivalCode: "BHA", titles: "0",
    accent: "#1b458f", accentDark: "#0b2249", text: "#ffffff",
    home: { base: "#1b458f", detail: "#c4122e", pattern: "stripes" },
    away: { base: "#f4f0df", detail: "#1b458f", pattern: "sash" },
    story: "Pierre Sage assume um clube intenso, de atmosfera única e com ambição renovada em Londres."
  },
  {
    code: "EVE", name: "Everton", apiName: "Everton", crestId: 62,
    city: "Liverpool", stadium: "Hill Dickinson Stadium", capacity: "52.888", founded: "1878",
    nickname: "The Toffees", manager: "David Moyes", managerWiki: "David_Moyes",
    rival: "Liverpool", rivalCode: "LIV", titles: "9",
    accent: "#003399", accentDark: "#001d58", text: "#ffffff",
    home: { base: "#003399", detail: "#ffffff", pattern: "trim" },
    away: { base: "#f1d9b5", detail: "#112a4a", pattern: "trim" },
    story: "Uma nova casa, uma torcida histórica e David Moyes liderando a reconstrução dos Toffees."
  },
  {
    code: "FUL", name: "Fulham", apiName: "Fulham", crestId: 63,
    city: "London", stadium: "Craven Cottage", capacity: "29.589", founded: "1879",
    nickname: "The Cottagers", manager: "Álvaro Arbeloa", managerWiki: "Álvaro_Arbeloa",
    rival: "Chelsea", rivalCode: "CHE", titles: "0",
    accent: "#e5e5e5", accentDark: "#242424", text: "#111111",
    home: { base: "#ffffff", detail: "#111111", pattern: "sleeves" },
    away: { base: "#d9ff2f", detail: "#111111", pattern: "trim" },
    story: "Álvaro Arbeloa inicia sua passagem na Inglaterra em um dos estádios mais tradicionais do país."
  },
  {
    code: "HUL", name: "Hull City", apiName: "Hull City", crestId: 322,
    city: "Hull", stadium: "MKM Stadium", capacity: "25.586", founded: "1904",
    nickname: "The Tigers", manager: "Sergej Jakirović", managerWiki: "Sergej_Jakirović",
    rival: "Leeds United", rivalCode: "LEE", titles: "0",
    accent: "#f5a623", accentDark: "#8e5200", text: "#111111",
    home: { base: "#f5a623", detail: "#111111", pattern: "stripes" },
    away: { base: "#f3f3f3", detail: "#f5a623", pattern: "trim" },
    story: "Promovido pelos playoffs, Hull retorna à Premier League com a força visual e emocional dos Tigers."
  },
  {
    code: "IPS", name: "Ipswich Town", shortName: "Ipswich", apiName: "Ipswich Town", crestId: 349,
    city: "Ipswich", stadium: "Portman Road", capacity: "30.311", founded: "1878",
    nickname: "The Tractor Boys", manager: "Gary O’Neil", managerWiki: "Gary_O'Neil",
    rival: "Norwich City", rivalCode: null, titles: "1",
    accent: "#0057b8", accentDark: "#00316a", text: "#ffffff",
    home: { base: "#0057b8", detail: "#ffffff", pattern: "trim" },
    away: { base: "#ff5a36", detail: "#111111", pattern: "trim" },
    story: "Gary O’Neil assume um clube de identidade forte, tradição europeia e rivalidade histórica."
  },
  {
    code: "LEE", name: "Leeds United", shortName: "Leeds", apiName: "Leeds United", crestId: 341,
    city: "Leeds", stadium: "Elland Road", capacity: "37.792", founded: "1919",
    nickname: "The Whites", manager: "Daniel Farke", managerWiki: "Daniel_Farke",
    rival: "Manchester United", rivalCode: "MUN", titles: "3",
    accent: "#ffcd00", accentDark: "#164a85", text: "#10294a",
    home: { base: "#ffffff", detail: "#ffcd00", pattern: "trim" },
    away: { base: "#164a85", detail: "#ffcd00", pattern: "trim" },
    story: "Elland Road volta a receber uma temporada de Premier League com Daniel Farke no comando."
  },
  {
    code: "LIV", name: "Liverpool", apiName: "Liverpool", crestId: 64,
    city: "Liverpool", stadium: "Anfield", capacity: "61.276", founded: "1892",
    nickname: "The Reds", manager: "Andoni Iraola", managerWiki: "Andoni_Iraola",
    rival: "Everton", rivalCode: "EVE", titles: "20",
    accent: "#c8102e", accentDark: "#6e0718", text: "#ffffff",
    home: { base: "#c8102e", detail: "#ffffff", pattern: "trim" },
    away: { base: "#f1eee5", detail: "#16827b", pattern: "trim" },
    story: "Andoni Iraola assume Anfield com a missão de combinar intensidade, tradição e uma nova identidade."
  },
  {
    code: "MCI", name: "Manchester City", shortName: "Man City", apiName: "Manchester City", crestId: 65,
    city: "Manchester", stadium: "Etihad Stadium", capacity: "53.400", founded: "1880",
    nickname: "The Citizens", manager: "Enzo Maresca", managerWiki: "Enzo_Maresca",
    rival: "Manchester United", rivalCode: "MUN", titles: "10",
    accent: "#6cabdd", accentDark: "#1d4f73", text: "#07131d",
    home: { base: "#6cabdd", detail: "#ffffff", pattern: "trim" },
    away: { base: "#101010", detail: "#f2cf20", pattern: "stripe-center" },
    story: "Enzo Maresca sucede Pep Guardiola e assume uma das estruturas mais exigentes do futebol mundial."
  },
  {
    code: "MUN", name: "Manchester United", shortName: "Man United", apiName: "Manchester United", crestId: 66,
    city: "Manchester", stadium: "Old Trafford", capacity: "74.310", founded: "1878",
    nickname: "The Red Devils", manager: "Michael Carrick", managerWiki: "Michael_Carrick",
    rival: "Liverpool", rivalCode: "LIV", titles: "20",
    accent: "#da291c", accentDark: "#760f0a", text: "#ffffff",
    home: { base: "#da291c", detail: "#ffffff", pattern: "trim" },
    away: { base: "#f2efe7", detail: "#2a2a2a", pattern: "trim" },
    story: "Michael Carrick lidera o retorno do United à Champions League e uma nova fase em Old Trafford."
  },
  {
    code: "NEW", name: "Newcastle United", shortName: "Newcastle", apiName: "Newcastle United", crestId: 67,
    city: "Newcastle upon Tyne", stadium: "St James’ Park", capacity: "52.305", founded: "1892",
    nickname: "The Magpies", manager: "Técnico a anunciar", managerWiki: null,
    rival: "Sunderland", rivalCode: "SUN", titles: "4",
    accent: "#eeeeee", accentDark: "#181818", text: "#111111",
    home: { base: "#ffffff", detail: "#111111", pattern: "stripes" },
    away: { base: "#4f2d7f", detail: "#f4b942", pattern: "trim" },
    story: "Com o cargo de técnico em aberto, Newcastle oferece um projeto poderoso e uma decisão de enorme peso."
  },
  {
    code: "NFO", name: "Nottingham Forest", shortName: "Nott’m Forest", apiName: "Nottingham Forest", crestId: 351,
    city: "Nottingham", stadium: "The City Ground", capacity: "30.404", founded: "1865",
    nickname: "The Tricky Trees", manager: "Oliver Glasner", managerWiki: "Oliver_Glasner",
    rival: "Derby County", rivalCode: null, titles: "1",
    accent: "#dd0000", accentDark: "#710000", text: "#ffffff",
    home: { base: "#dd0000", detail: "#ffffff", pattern: "trim" },
    away: { base: "#f4df4e", detail: "#12352e", pattern: "trim" },
    story: "Oliver Glasner assume um clube bicampeão europeu que busca estabilidade e protagonismo moderno."
  },
  {
    code: "SUN", name: "Sunderland", apiName: "Sunderland", crestId: 71,
    city: "Sunderland", stadium: "Stadium of Light", capacity: "49.000", founded: "1879",
    nickname: "The Black Cats", manager: "Régis Le Bris", managerWiki: "Régis_Le_Bris",
    rival: "Newcastle United", rivalCode: "NEW", titles: "6",
    accent: "#eb172b", accentDark: "#790812", text: "#ffffff",
    home: { base: "#ffffff", detail: "#eb172b", pattern: "stripes" },
    away: { base: "#1f1f27", detail: "#eb172b", pattern: "trim" },
    story: "Após uma temporada surpreendente, Sunderland entra em 2026/27 com futebol europeu no horizonte."
  },
  {
    code: "TOT", name: "Tottenham Hotspur", shortName: "Tottenham", apiName: "Tottenham Hotspur", crestId: 73,
    city: "London", stadium: "Tottenham Hotspur Stadium", capacity: "62.850", founded: "1882",
    nickname: "Spurs", manager: "Roberto De Zerbi", managerWiki: "Roberto_De_Zerbi",
    rival: "Arsenal", rivalCode: "ARS", titles: "2",
    accent: "#f4f4f4", accentDark: "#132257", text: "#111111",
    home: { base: "#ffffff", detail: "#132257", pattern: "sleeves" },
    away: { base: "#132257", detail: "#c8ff3d", pattern: "trim" },
    story: "Roberto De Zerbi inicia uma reconstrução ambiciosa em um dos palcos mais modernos da liga."
  }
];

const clubByCode = new Map(CLUBS.map(club => [club.code, club]));
const assetCache = new Map();
let selectedIndex = Math.max(0, CLUBS.findIndex(club => club.code === readSave().selectedClubCode));
let stage = location.hash === "#club-select" ? "clubs" : "welcome";
let railElement = null;

function readSave() {
  try {
    return JSON.parse(localStorage.getItem(CAREER_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function crestUrl(club) {
  return `https://crests.football-data.org/${club.crestId}.png`;
}

function logoMark() {
  return `
    <svg class="career-start-logo-mark" viewBox="0 0 120 120" aria-hidden="true">
      <path d="M60 7 105 25v31c0 29-18 48-45 58C33 104 15 85 15 56V25L60 7Z" fill="none" stroke="currentColor" stroke-width="5"/>
      <path d="M32 36h56M60 36v51M39 87h42" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="square"/>
      <circle cx="60" cy="58" r="11" fill="none" stroke="currentColor" stroke-width="4"/>
    </svg>`;
}

function controlIcon(type) {
  if (type === "confirm") return `<span class="career-control-key primary">A</span>`;
  if (type === "back") return `<span class="career-control-key danger">B</span>`;
  return `<span class="career-control-key">↔</span>`;
}

function setOnboardingMode(active) {
  document.documentElement.classList.toggle("touchline-onboarding-mode", active);
  document.body.classList.toggle("touchline-onboarding-mode", active);
  if (active) document.getElementById("touchline-screen-navigation")?.remove();
}

function renderWelcome() {
  stage = "welcome";
  setOnboardingMode(true);
  document.title = "Touchline — Iniciar carreira";
  const app = document.querySelector("#app");
  if (!app) return;
  app.innerHTML = `
    <main class="career-start career-start-welcome" style="--start-bg:url('${DEFAULT_BACKGROUND}')">
      <div class="career-start-vignette"></div>
      <section class="career-start-brand" aria-labelledby="career-start-title">
        ${logoMark()}
        <p>THE MANAGER EXPERIENCE</p>
        <h1 id="career-start-title">TOUCHLINE</h1>
        <div class="career-start-rule"><span></span><b>CAREER MODE</b><span></span></div>
        <p class="career-start-season">PREMIER LEAGUE · 2026/27</p>
      </section>
      <button class="career-start-enter" type="button" data-start-career>
        <span>INICIAR NOVA CARREIRA</span>
        <small>Construa sua história à beira do campo</small>
      </button>
      <footer class="career-start-footer">
        <span>TOUCHLINE STUDIOS</span>
        <small>Pressione Enter ou clique para continuar</small>
      </footer>
    </main>`;
}

function railMarkup() {
  return CLUBS.map((club, index) => `
    <button class="club-rail-item${index === selectedIndex ? " selected" : ""}" type="button" data-club-index="${index}" aria-label="Selecionar ${escapeHtml(club.name)}">
      <img src="${crestUrl(club)}" alt="" loading="${Math.abs(index - selectedIndex) < 5 ? "eager" : "lazy"}" referrerpolicy="no-referrer" />
      <span>${escapeHtml(club.code)}</span>
    </button>`).join("");
}

function kitFallback(kit, label) {
  return `
    <div class="club-kit-fallback" data-pattern="${escapeHtml(kit.pattern)}" style="--kit-base:${kit.base};--kit-detail:${kit.detail}">
      <span class="club-kit-body"></span>
      <span class="club-kit-left"></span>
      <span class="club-kit-right"></span>
    </div>
    <small>${label}</small>`;
}

function kitMarkup(kit, label, image) {
  return image
    ? `<img class="club-kit-image" src="${escapeHtml(image)}" alt="Uniforme ${label.toLowerCase()} 2026/27" referrerpolicy="no-referrer" /><small>${label}</small>`
    : kitFallback(kit, label);
}

function managerMarkup(club, assets) {
  const image = assets?.managerImage;
  return image
    ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(club.manager)}" referrerpolicy="no-referrer" />`
    : `<div class="club-manager-placeholder"><span>${club.manager === "Técnico a anunciar" ? "?" : club.manager.split(/\s+/).slice(0,2).map(part => part[0]).join("")}</span></div>`;
}

function detailMarkup(club, assets = {}) {
  const rival = clubByCode.get(club.rivalCode);
  const badge = assets.badge || crestUrl(club);
  const stadiumImage = assets.stadiumImage || DEFAULT_BACKGROUND;
  const background = assets.fanart || stadiumImage || DEFAULT_BACKGROUND;

  return `
    <div class="club-selection-background" style="--club-background:url('${escapeHtml(background)}')"></div>
    <section class="club-selection-grid" style="--club-accent:${club.accent};--club-accent-dark:${club.accentDark};--club-text:${club.text}">
      <article class="club-identity-card">
        <div class="club-badge-panel">
          <img src="${escapeHtml(badge)}" alt="Escudo do ${escapeHtml(club.name)}" referrerpolicy="no-referrer" />
          <h2>${escapeHtml(club.shortName || club.name)}</h2>
        </div>
        <div class="club-location-panel" style="--stadium-image:url('${escapeHtml(stadiumImage)}')">
          <span class="club-data-label">LOCALIZAÇÃO</span>
          <strong>${escapeHtml(club.city)}</strong>
        </div>
        <div class="club-manager-panel">
          ${managerMarkup(club, assets)}
          <div><span class="club-data-label">TÉCNICO</span><strong>${escapeHtml(club.manager)}</strong></div>
        </div>
        <div class="club-titles-panel">
          <span class="club-trophy-icon">◆</span>
          <span class="club-data-label">TÍTULOS NACIONAIS</span>
          <strong>${escapeHtml(club.titles)}</strong>
        </div>
        <div class="club-stadium-panel" style="--stadium-image:url('${escapeHtml(stadiumImage)}')">
          <div><span class="club-data-label">ESTÁDIO</span><strong>${escapeHtml(club.stadium)}</strong></div>
          <div><span class="club-data-label">CAPACIDADE</span><strong>${escapeHtml(club.capacity)}</strong></div>
        </div>
        <div class="club-founded-panel">
          <span class="club-data-label">FUNDAÇÃO</span>
          <strong>${escapeHtml(club.founded)}</strong>
        </div>
      </article>

      <article class="club-story-card">
        <div class="club-story-copy">
          <span class="club-data-label">APELIDO</span>
          <h3>${escapeHtml(club.nickname)}</h3>
          <p>${escapeHtml(club.story)}</p>
        </div>
        <div class="club-season-stamp"><span>PREMIER LEAGUE</span><strong>26/27</strong></div>
        <div class="club-kits-panel">
          <span class="club-panel-heading">UNIFORMES 2026/27</span>
          <div class="club-kit-slot">${kitMarkup(club.home, "CASA", assets.homeKit)}</div>
          <div class="club-kit-slot">${kitMarkup(club.away, "FORA", assets.awayKit)}</div>
        </div>
        <div class="club-rival-panel">
          <span class="club-panel-heading">PRINCIPAL RIVAL</span>
          ${rival ? `<img src="${crestUrl(rival)}" alt="" referrerpolicy="no-referrer" />` : `<span class="club-rival-symbol">◇</span>`}
          <strong>${escapeHtml(club.rival)}</strong>
        </div>
      </article>
    </section>`;
}

function renderClubSelector() {
  stage = "clubs";
  setOnboardingMode(true);
  document.title = "Touchline — Escolha seu clube";
  const app = document.querySelector("#app");
  if (!app) return;
  const club = CLUBS[selectedIndex];
  app.innerHTML = `
    <main class="career-start career-club-selection">
      <header class="club-selection-header">
        <div>
          <span>INICIAR CARREIRA</span>
          <h1>ESCOLHA SEU CLUBE</h1>
          <p>Selecione o clube da Premier League que você irá comandar.</p>
        </div>
        <div class="club-season-badge"><span>SEASON</span><strong>2026/27</strong></div>
      </header>
      <nav class="club-rail" aria-label="Clubes da Premier League 2026/27">
        <button class="club-rail-arrow" type="button" data-club-step="-1" aria-label="Clube anterior">‹</button>
        <div class="club-rail-track">${railMarkup()}</div>
        <button class="club-rail-arrow" type="button" data-club-step="1" aria-label="Próximo clube">›</button>
      </nav>
      <div class="club-selection-details" data-club-details>${detailMarkup(club, assetCache.get(club.code))}</div>
      <footer class="club-selection-controls">
        <div>${controlIcon("confirm")}<button type="button" data-confirm-club>ASSUMIR O CLUBE</button></div>
        <div>${controlIcon("back")}<button type="button" data-back-welcome>VOLTAR</button></div>
        <span>${controlIcon("move")} Navegar entre clubes</span>
      </footer>
    </main>`;
  railElement = app.querySelector(".club-rail-track");
  focusSelectedRailItem(false);
  enrichSelectedClub();
}

function focusSelectedRailItem(smooth = true) {
  const track = railElement || document.querySelector(".club-rail-track");
  const item = track?.querySelector(`[data-club-index="${selectedIndex}"]`);
  if (!track || !item) return;
  item.scrollIntoView({ behavior: smooth ? "smooth" : "auto", inline: "center", block: "nearest" });
}

function updateSelectedClub(nextIndex, smooth = true) {
  const normalized = (nextIndex + CLUBS.length) % CLUBS.length;
  if (normalized === selectedIndex && document.querySelector("[data-club-details]")) return;
  selectedIndex = normalized;
  document.querySelectorAll("[data-club-index]").forEach((item, index) => item.classList.toggle("selected", index === selectedIndex));
  const club = CLUBS[selectedIndex];
  const details = document.querySelector("[data-club-details]");
  if (details) details.innerHTML = detailMarkup(club, assetCache.get(club.code));
  focusSelectedRailItem(smooth);
  enrichSelectedClub();
}

async function fetchJson(url, timeout = 6500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

function equipmentForSeason(items, type) {
  const candidates = (items || []).filter(item => {
    const season = String(item.strSeason || "").replace(/\s/g, "");
    const itemType = String(item.strType || "").toLowerCase();
    return /2026.*2027|2026-27|26\/27/.test(season) && itemType.includes(type);
  });
  return candidates[0]?.strEquipment || null;
}

async function loadClubAssets(club) {
  if (assetCache.has(club.code)) return assetCache.get(club.code);
  const pending = (async () => {
    const assets = {};
    try {
      const teamSearch = await fetchJson(`https://www.thesportsdb.com/api/v1/json/${SPORTS_DB_KEY}/searchteams.php?t=${encodeURIComponent(club.apiName)}`);
      const team = teamSearch?.teams?.find(item => /England/i.test(item.strCountry || "")) || teamSearch?.teams?.[0];
      if (team) {
        assets.badge = team.strBadge || team.strLogo || null;
        assets.stadiumImage = team.strStadiumThumb || null;
        assets.fanart = team.strFanart1 || team.strFanart2 || team.strStadiumThumb || null;
        if (team.idTeam) {
          const equipment = await fetchJson(`https://www.thesportsdb.com/api/v1/json/${SPORTS_DB_KEY}/lookupequipment.php?id=${team.idTeam}`);
          assets.homeKit = equipmentForSeason(equipment?.equipment, "home");
          assets.awayKit = equipmentForSeason(equipment?.equipment, "away");
        }
      }
    } catch {
      // The static, verified data remains visible when the optional provider is unavailable.
    }

    if (club.managerWiki) {
      try {
        const summary = await fetchJson(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(club.managerWiki)}`);
        assets.managerImage = summary?.thumbnail?.source || summary?.originalimage?.source || null;
      } catch {
        // Initials remain as a reliable fallback.
      }
    }
    return assets;
  })();
  assetCache.set(club.code, pending);
  const resolved = await pending;
  assetCache.set(club.code, resolved);
  return resolved;
}

async function enrichSelectedClub() {
  const club = CLUBS[selectedIndex];
  const codeAtRequest = club.code;
  const assets = await loadClubAssets(club);
  if (stage !== "clubs" || CLUBS[selectedIndex].code !== codeAtRequest) return;
  const details = document.querySelector("[data-club-details]");
  if (details) details.innerHTML = detailMarkup(club, assets);
}

function beginCareer() {
  history.replaceState(null, "", "#club-select");
  renderClubSelector();
}

function confirmClub() {
  const club = CLUBS[selectedIndex];
  const current = readSave();
  const nextSave = {
    ...current,
    onboardingComplete: true,
    selectedClubCode: club.code,
    selectedClubName: club.name,
    selectedClubManager: club.manager,
    careerSeason: "2026/27",
    careerStartedAt: new Date().toISOString()
  };
  delete nextSave.selectedSquadId;
  delete nextSave.xi;
  delete nextSave.playerStatus;
  delete nextSave.contractNegotiations;
  delete nextSave.releasedPlayers;
  localStorage.setItem(CAREER_STORAGE_KEY, JSON.stringify(nextSave));

  const root = document.querySelector(".career-club-selection");
  root?.classList.add("career-club-confirmed");
  setTimeout(() => {
    history.replaceState(null, "", `${location.pathname}${location.search}`);
    location.reload();
  }, 520);
}

function shouldOpenOnboarding() {
  const save = readSave();
  return location.hash === "#welcome" || location.hash === "#club-select" || !save.onboardingComplete;
}

function mount() {
  if (!shouldOpenOnboarding()) return;
  setOnboardingMode(true);
  if (location.hash === "#club-select") renderClubSelector();
  else renderWelcome();
}

document.addEventListener("click", event => {
  if (!document.documentElement.classList.contains("touchline-onboarding-mode")) return;
  const start = event.target.closest("[data-start-career]");
  if (start) return beginCareer();

  const clubItem = event.target.closest("[data-club-index]");
  if (clubItem) return updateSelectedClub(Number(clubItem.dataset.clubIndex));

  const step = event.target.closest("[data-club-step]");
  if (step) return updateSelectedClub(selectedIndex + Number(step.dataset.clubStep));

  if (event.target.closest("[data-confirm-club]")) return confirmClub();
  if (event.target.closest("[data-back-welcome]")) {
    history.replaceState(null, "", "#welcome");
    return renderWelcome();
  }
});

document.addEventListener("keydown", event => {
  if (!document.documentElement.classList.contains("touchline-onboarding-mode")) return;
  if (stage === "welcome" && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    beginCareer();
    return;
  }
  if (stage !== "clubs") return;
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    updateSelectedClub(selectedIndex - 1);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    updateSelectedClub(selectedIndex + 1);
  } else if (event.key === "Enter") {
    event.preventDefault();
    confirmClub();
  } else if (event.key === "Escape") {
    event.preventDefault();
    history.replaceState(null, "", "#welcome");
    renderWelcome();
  }
});

document.addEventListener("wheel", event => {
  if (stage !== "clubs" || !event.target.closest(".club-rail")) return;
  event.preventDefault();
  updateSelectedClub(selectedIndex + (event.deltaY > 0 || event.deltaX > 0 ? 1 : -1));
}, { passive: false });

window.addEventListener("hashchange", () => {
  if (location.hash === "#club-select") renderClubSelector();
  else if (location.hash === "#welcome") renderWelcome();
});

mount();

import "./screen-navigation.css";

const NAV_ID = "touchline-screen-navigation";
const FORWARD_KEY = "touchline:last-forward-destination";

function baseUrl() {
  return `${window.location.origin}${window.location.pathname}${window.location.search}`;
}

function currentScreen() {
  if (window.location.hash === "#matchday") return "Matchday";
  return "Central";
}

function rememberCurrentAsForwardDestination() {
  if (window.location.hash) {
    window.sessionStorage.setItem(FORWARD_KEY, window.location.href);
  }
}

function goHome() {
  if (!window.location.hash) return;
  rememberCurrentAsForwardDestination();
  window.location.assign(baseUrl());
}

function goBack() {
  if (window.location.hash) {
    goHome();
    return;
  }

  if (window.history.length > 1) {
    window.history.back();
  }
}

function goForward() {
  const rememberedDestination = window.sessionStorage.getItem(FORWARD_KEY);

  if (!window.location.hash && rememberedDestination) {
    window.location.assign(rememberedDestination);
    return;
  }

  window.history.forward();
}

function icon(path) {
  return `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      ${path}
    </svg>
  `;
}

function button({ action, label, iconMarkup, disabled = false }) {
  return `
    <button
      class="screen-nav-button"
      type="button"
      data-screen-nav="${action}"
      aria-label="${label}"
      title="${label}"
      ${disabled ? "disabled" : ""}
    >
      ${iconMarkup}
      <span>${label}</span>
    </button>
  `;
}

export function mountScreenNavigation() {
  document.getElementById(NAV_ID)?.remove();

  const isHome = !window.location.hash;
  const root = document.createElement("nav");
  root.id = NAV_ID;
  root.className = "screen-navigation";
  root.setAttribute("aria-label", "Navegação entre telas do jogo");
  root.innerHTML = `
    <div class="screen-nav-location" aria-live="polite">
      <span>TOUCHLINE</span>
      <strong>${currentScreen()}</strong>
    </div>
    <div class="screen-nav-controls">
      ${button({
        action: "back",
        label: "Voltar",
        iconMarkup: icon('<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>'),
        disabled: isHome && window.history.length <= 1
      })}
      ${button({
        action: "home",
        label: "Central",
        iconMarkup: icon('<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>'),
        disabled: isHome
      })}
      ${button({
        action: "forward",
        label: "Avançar",
        iconMarkup: icon('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>'),
        disabled: isHome && !window.sessionStorage.getItem(FORWARD_KEY)
      })}
    </div>
  `;

  root.addEventListener("click", event => {
    const control = event.target.closest("[data-screen-nav]");
    if (!control || control.disabled) return;

    const action = control.dataset.screenNav;
    if (action === "back") goBack();
    if (action === "home") goHome();
    if (action === "forward") goForward();
  });

  document.body.appendChild(root);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountScreenNavigation, { once: true });
} else {
  mountScreenNavigation();
}

window.addEventListener("hashchange", () => {
  window.requestAnimationFrame(mountScreenNavigation);
});

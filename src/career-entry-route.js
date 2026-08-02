const CENTRAL_ENTRY_BYPASS_KEY = "touchline:central-entry-once";

function allowCentralOnce() {
  try {
    window.sessionStorage.setItem(CENTRAL_ENTRY_BYPASS_KEY, "1");
  } catch {
    // The route still works when session storage is unavailable.
  }
}

function consumeCentralBypass() {
  try {
    const allowed = window.sessionStorage.getItem(CENTRAL_ENTRY_BYPASS_KEY) === "1";
    if (allowed) window.sessionStorage.removeItem(CENTRAL_ENTRY_BYPASS_KEY);
    return allowed;
  } catch {
    return false;
  }
}

const isBareEntry = !window.location.hash || window.location.hash === "#";

if (isBareEntry && !consumeCentralBypass()) {
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}#club-select`
  );
}

document.addEventListener("click", event => {
  if (event.target.closest("[data-confirm-club]")) allowCentralOnce();
}, true);

document.addEventListener("keydown", event => {
  if (window.location.hash === "#club-select" && event.key === "Enter") {
    allowCentralOnce();
  }
}, true);

window.__touchlineAllowCentralOnce = allowCentralOnce;

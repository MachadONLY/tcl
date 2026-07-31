import "./home-v3-autoplay.css";

const ROTATION_MS = 5000;
const VIEW_ORDER = ["news", "competition", "inbox"];

function setupWorkspaceAutoplay() {
  if (window.location.hash === "#matchday") return true;

  const workspace = document.querySelector(".v3-workspace");
  if (!workspace) return false;
  if (workspace.dataset.autoplayReady === "true") return true;

  const toolbar = workspace.querySelector(".v3-workspace-toolbar");
  const controls = workspace.querySelector(".v3-window-controls");
  if (!toolbar || !controls) return false;

  workspace.dataset.autoplayReady = "true";

  const progress = document.createElement("span");
  progress.className = "v3-autoplay-progress";
  progress.setAttribute("aria-hidden", "true");
  progress.innerHTML = "<i></i>";
  toolbar.append(progress);

  let timeoutId = 0;
  let currentIndex = Math.max(0, VIEW_ORDER.indexOf(workspace.dataset.activeView || "news"));
  let paused = false;
  let userPause = false;

  function activeButton() {
    return controls.querySelector(`[data-v3-view="${VIEW_ORDER[currentIndex]}"]`);
  }

  function restartProgress() {
    progress.classList.remove("running");
    void progress.offsetWidth;
    if (!paused && !document.hidden) progress.classList.add("running");
  }

  function clearSchedule() {
    window.clearTimeout(timeoutId);
    timeoutId = 0;
  }

  function scheduleNext() {
    clearSchedule();
    restartProgress();

    if (paused || document.hidden) return;

    timeoutId = window.setTimeout(() => {
      currentIndex = (currentIndex + 1) % VIEW_ORDER.length;
      const button = activeButton();
      if (button) {
        workspace.classList.add("auto-advancing");
        button.click();
        window.setTimeout(() => workspace.classList.remove("auto-advancing"), 520);
      }
      scheduleNext();
    }, ROTATION_MS);
  }

  function syncFromView(view) {
    const index = VIEW_ORDER.indexOf(view);
    if (index >= 0) currentIndex = index;
  }

  function pause(reason = "interaction") {
    paused = true;
    if (reason === "interaction") userPause = true;
    clearSchedule();
    progress.classList.remove("running");
    workspace.classList.add("autoplay-paused");
  }

  function resume({ reset = true } = {}) {
    userPause = false;
    paused = false;
    workspace.classList.remove("autoplay-paused");
    if (reset) scheduleNext();
  }

  controls.addEventListener("click", event => {
    const button = event.target.closest("[data-v3-view]");
    if (!button) return;
    syncFromView(button.dataset.v3View);
    if (!workspace.classList.contains("auto-advancing")) scheduleNext();
  });

  workspace.addEventListener("pointerenter", () => pause("hover"));
  workspace.addEventListener("pointerleave", () => {
    paused = false;
    workspace.classList.remove("autoplay-paused");
    scheduleNext();
  });

  workspace.addEventListener("focusin", () => pause("interaction"));
  workspace.addEventListener("focusout", event => {
    if (workspace.contains(event.relatedTarget)) return;
    resume();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      paused = true;
      clearSchedule();
      progress.classList.remove("running");
      return;
    }

    paused = false;
    workspace.classList.remove("autoplay-paused");
    scheduleNext();
  });

  const modalObserver = new MutationObserver(() => {
    const modalOpen = Boolean(document.querySelector(".v2-modal-layer.visible, .home-modal-layer.visible"));
    if (modalOpen) {
      pause("interaction");
    } else if (!userPause) {
      resume();
    }
  });

  modalObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"]
  });

  syncFromView(workspace.dataset.activeView || "news");
  scheduleNext();
  return true;
}

function boot() {
  if (setupWorkspaceAutoplay()) return;

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (setupWorkspaceAutoplay() || attempts > 120) window.clearInterval(timer);
  }, 25);
}

boot();

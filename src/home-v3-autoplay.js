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
  let modalOpen = false;

  function currentButton() {
    return controls.querySelector(`[data-v3-view="${VIEW_ORDER[currentIndex]}"]`);
  }

  function clearSchedule() {
    window.clearTimeout(timeoutId);
    timeoutId = 0;
  }

  function resetProgress() {
    progress.classList.remove("running");
    void progress.offsetWidth;

    if (!document.hidden && !modalOpen) {
      progress.classList.add("running");
    }
  }

  function scheduleNext() {
    clearSchedule();
    resetProgress();

    if (document.hidden || modalOpen) return;

    timeoutId = window.setTimeout(() => {
      currentIndex = (currentIndex + 1) % VIEW_ORDER.length;
      const button = currentButton();

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

  controls.addEventListener("click", event => {
    const button = event.target.closest("[data-v3-view]");
    if (!button) return;

    syncFromView(button.dataset.v3View);

    if (!workspace.classList.contains("auto-advancing")) {
      scheduleNext();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      clearSchedule();
      progress.classList.remove("running");
      return;
    }

    scheduleNext();
  });

  const modalObserver = new MutationObserver(() => {
    const nextModalState = Boolean(
      document.querySelector(".v2-modal-layer.visible, .home-modal-layer.visible")
    );

    if (nextModalState === modalOpen) return;
    modalOpen = nextModalState;
    workspace.classList.toggle("autoplay-paused", modalOpen);

    if (modalOpen) {
      clearSchedule();
      progress.classList.remove("running");
    } else {
      scheduleNext();
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
    if (setupWorkspaceAutoplay() || attempts > 120) {
      window.clearInterval(timer);
    }
  }, 25);
}

boot();

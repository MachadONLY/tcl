import "./career-onboarding-v7-premier.css";

let frame = 0;
let lastCode = "";

function selectedCode(root) {
  return root?.querySelector(".club-rail-item.selected span")?.textContent?.trim().toUpperCase() || "";
}

function tuneHeader(root) {
  const eyebrow = root.querySelector(".club-selection-header > div:first-child > span");
  const title = root.querySelector(".club-selection-header h1");
  const subtitle = root.querySelector(".club-selection-header p");
  const seasonLabel = root.querySelector(".club-season-badge span");

  if (eyebrow) eyebrow.textContent = "PREMIER LEAGUE · CARREIRA";
  if (title) title.textContent = "ESCOLHA SEU CLUBE";
  if (subtitle) subtitle.textContent = "Assuma o comando e defina onde começa a sua história.";
  if (seasonLabel) seasonLabel.textContent = "TEMPORADA";
}

function tuneRail(root) {
  const track = root.querySelector(".club-rail-track");
  const items = [...root.querySelectorAll(".club-rail-item")];
  if (track) track.style.setProperty("--v7-club-count", String(items.length || 20));

  items.forEach(item => {
    const image = item.querySelector("img");
    if (!image) return;
    image.loading = "eager";
    image.decoding = "async";
    image.fetchPriority = item.classList.contains("selected") ? "high" : "auto";
  });
}

function tuneDetails(root) {
  const details = root.querySelector("[data-club-details]");
  const code = selectedCode(root);
  if (!details || !code) return;

  details.dataset.clubCodeV7 = code;
  root.dataset.clubCode = code;

  const grid = details.querySelector(".club-selection-grid");
  grid?.classList.add("club-selection-grid-v7");

  const managerImage = details.querySelector(".club-manager-panel > img, .club-manager-image");
  if (managerImage) {
    managerImage.loading = "eager";
    managerImage.decoding = "async";
    managerImage.fetchPriority = "high";
  }

  details.querySelectorAll(".club-kit-slot").forEach(slot => {
    slot.classList.toggle("has-kit-image", Boolean(slot.querySelector(".club-kit-image")));
    slot.classList.toggle("has-procedural-kit", Boolean(slot.querySelector(".club-kit-fallback")));
  });

  details.querySelectorAll("img").forEach(image => {
    image.decoding = "async";
    if (!image.loading) image.loading = "eager";
  });

  if (lastCode !== code) {
    lastCode = code;
    grid?.animate?.(
      [
        { opacity: .7, transform: "translateY(3px)" },
        { opacity: 1, transform: "translateY(0)" }
      ],
      { duration: 190, easing: "cubic-bezier(.2,.75,.25,1)" }
    );
  }
}

function warmRailImages(root) {
  const run = () => {
    root.querySelectorAll(".club-rail-item img").forEach(image => {
      if (!image.src) return;
      const preload = new Image();
      preload.decoding = "async";
      preload.referrerPolicy = "no-referrer";
      preload.src = image.src;
    });
  };

  if ("requestIdleCallback" in window) window.requestIdleCallback(run, { timeout: 800 });
  else window.setTimeout(run, 120);
}

function applyPremierLayout() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    const root = document.querySelector(".career-club-selection");
    if (!root) return;

    root.classList.add("onboarding-premier-v7");
    tuneHeader(root);
    tuneRail(root);
    tuneDetails(root);

    if (!root.dataset.v7WarmStarted) {
      root.dataset.v7WarmStarted = "true";
      warmRailImages(root);
    }
  });
}

const observer = new MutationObserver(mutations => {
  const relevant = mutations.some(mutation => {
    if (mutation.type === "attributes") {
      return mutation.target instanceof Element && mutation.target.matches(".club-rail-item, [data-club-details]");
    }

    return [...mutation.addedNodes].some(node => node instanceof Element && (
      node.matches?.(".career-club-selection, [data-club-details], .club-selection-grid, .club-kit-image")
      || node.querySelector?.(".career-club-selection, [data-club-details], .club-selection-grid, .club-kit-image")
    ));
  });

  if (relevant) applyPremierLayout();
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["class"]
});

window.addEventListener("resize", applyPremierLayout, { passive: true });
window.visualViewport?.addEventListener("resize", applyPremierLayout, { passive: true });
window.addEventListener("hashchange", applyPremierLayout);
document.addEventListener("click", event => {
  if (event.target.closest("[data-club-index], [data-club-step]")) applyPremierLayout();
}, true);
document.addEventListener("DOMContentLoaded", applyPremierLayout, { once: true });
applyPremierLayout();

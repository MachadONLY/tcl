import "./career-onboarding-v13-manager-card.css";

let scheduledFrame = 0;
let delayedRepairOne = 0;
let delayedRepairTwo = 0;

function managerCopy(panel) {
  return panel?.querySelector(":scope > .club-manager-copy-v5, :scope > div:last-child") || null;
}

function sourceValue(image) {
  if (!(image instanceof HTMLImageElement)) return "";
  return image.currentSrc || image.src || image.getAttribute("src") || "";
}

function sourceScore(image) {
  const source = sourceValue(image);
  let score = 0;

  if (source.startsWith(`${location.origin}/assets/clubs/`) || source.startsWith("/assets/clubs/")) score += 1000;
  if (image.dataset.localPackSource || image.dataset.localPackAsset === "true") score += 700;
  if (image.classList.contains("club-manager-image-v9")) score += 400;
  if (image.classList.contains("club-manager-image")) score += 250;
  if (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) score += 150;
  score += Math.min(120, Math.round((image.naturalWidth || 0) * (image.naturalHeight || 0) / 10000));

  return score;
}

function preferredManagerImage(panel) {
  const images = [...panel.querySelectorAll("img")];
  if (!images.length) return null;
  return images.sort((a, b) => sourceScore(b) - sourceScore(a))[0] || null;
}

function normalizeManagerPanel(panel) {
  if (!(panel instanceof HTMLElement)) return;

  const copy = managerCopy(panel);
  if (copy) copy.classList.add("club-manager-copy-v5", "club-manager-copy-v13");

  const keeper = preferredManagerImage(panel);
  if (!keeper) {
    panel.classList.remove("manager-card-photo-ready-v13");
    panel.classList.add("manager-card-standard-v13");
    return;
  }

  const preferredSource = sourceValue(keeper);

  [...panel.querySelectorAll("img")].forEach(image => {
    if (image !== keeper) image.remove();
  });

  if (preferredSource && sourceValue(keeper) !== preferredSource) keeper.src = preferredSource;

  keeper.classList.add(
    "club-manager-image",
    "club-manager-image-v9",
    "club-manager-image-v13"
  );
  keeper.alt = copy?.querySelector("strong")?.textContent?.trim() || keeper.alt || "Técnico";
  keeper.decoding = "async";
  keeper.loading = "eager";
  keeper.fetchPriority = "high";
  keeper.removeAttribute("width");
  keeper.removeAttribute("height");
  keeper.removeAttribute("referrerpolicy");

  panel.querySelectorAll(":scope > .club-manager-placeholder").forEach(node => node.remove());

  if (copy && keeper.nextElementSibling !== copy) panel.insertBefore(keeper, copy);
  else if (!copy && keeper !== panel.firstElementChild) panel.prepend(keeper);

  panel.classList.add("manager-card-standard-v13", "manager-card-photo-ready-v13");
}

function repairManagerCards() {
  document.querySelectorAll(".club-manager-panel").forEach(normalizeManagerPanel);
}

function scheduleRepair() {
  cancelAnimationFrame(scheduledFrame);
  scheduledFrame = requestAnimationFrame(() => {
    requestAnimationFrame(repairManagerCards);
  });

  window.clearTimeout(delayedRepairOne);
  window.clearTimeout(delayedRepairTwo);
  delayedRepairOne = window.setTimeout(repairManagerCards, 180);
  delayedRepairTwo = window.setTimeout(repairManagerCards, 720);
}

const observer = new MutationObserver(mutations => {
  const relevant = mutations.some(mutation => {
    if (mutation.type === "attributes") {
      return mutation.target instanceof Element
        && Boolean(mutation.target.closest(".club-manager-panel"));
    }

    return [...mutation.addedNodes].some(node => node instanceof Element && (
      node.matches?.(".club-manager-panel, .club-manager-panel img")
      || node.querySelector?.(".club-manager-panel, .club-manager-panel img")
      || node.closest?.(".club-manager-panel")
    ));
  });

  if (relevant) scheduleRepair();
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["src", "class", "data-local-pack"]
});

document.addEventListener("click", event => {
  if (event.target.closest("[data-club-index], [data-club-step]")) scheduleRepair();
}, true);

document.addEventListener("keydown", event => {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") scheduleRepair();
}, true);

window.addEventListener("hashchange", scheduleRepair);
document.addEventListener("DOMContentLoaded", scheduleRepair, { once: true });
scheduleRepair();

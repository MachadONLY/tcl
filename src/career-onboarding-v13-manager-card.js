import "./career-onboarding-v13-manager-card.css";

const MANAGER_FALLBACKS = Object.freeze({
  CHE: "https://upload.wikimedia.org/wikipedia/commons/b/bb/Xabi_Alonso_01.png"
});

let scheduledFrame = 0;
let delayedRepairOne = 0;
let delayedRepairTwo = 0;

function managerCopy(panel) {
  return panel?.querySelector(":scope > .club-manager-copy-v5, :scope > div:last-child") || null;
}

function selectedClubCode() {
  return document.querySelector(".club-rail-item.selected span")?.textContent?.trim().toUpperCase() || "";
}

function sourceValue(image) {
  if (!(image instanceof HTMLImageElement)) return "";
  return image.currentSrc || image.src || image.getAttribute("src") || "";
}

function validImageSource(source) {
  const value = String(source || "").trim();
  return /^(?:https?:|blob:|data:image\/|\/assets\/)/i.test(value);
}

function sourceScore(image) {
  const source = sourceValue(image);
  if (!validImageSource(source)) return Number.NEGATIVE_INFINITY;

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
  const images = [...panel.querySelectorAll("img")]
    .filter(image => validImageSource(sourceValue(image)));
  if (!images.length) return null;
  return images.sort((a, b) => sourceScore(b) - sourceScore(a))[0] || null;
}

function fallbackManagerImage(panel) {
  const source = MANAGER_FALLBACKS[selectedClubCode()];
  if (!source) return null;

  const image = document.createElement("img");
  image.src = source;
  image.dataset.managerFallback = "true";
  const copy = managerCopy(panel);
  panel.insertBefore(image, copy || panel.firstChild);
  return image;
}

function normalizeManagerPanel(panel) {
  if (!(panel instanceof HTMLElement)) return;

  const copy = managerCopy(panel);
  if (copy) copy.classList.add("club-manager-copy-v5", "club-manager-copy-v13");

  let keeper = preferredManagerImage(panel);
  if (!keeper) keeper = fallbackManagerImage(panel);

  panel.classList.add("manager-card-standard-v13");

  if (!keeper || !validImageSource(sourceValue(keeper))) {
    panel.classList.remove("manager-card-photo-ready-v13");
    return;
  }

  [...panel.querySelectorAll("img")].forEach(image => {
    if (image !== keeper) image.remove();
  });

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

  const markReady = () => {
    if (!keeper.isConnected || keeper.naturalWidth <= 0 || keeper.naturalHeight <= 0) return;
    panel.classList.add("manager-card-photo-ready-v13");
    panel.dataset.managerPhotoReady = "true";
  };

  keeper.addEventListener("load", markReady, { once: true });
  keeper.addEventListener("error", () => {
    if (!keeper.isConnected) return;
    panel.classList.remove("manager-card-photo-ready-v13");
    panel.dataset.managerPhotoReady = "false";
  }, { once: true });

  if (keeper.complete && keeper.naturalWidth > 0) markReady();
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

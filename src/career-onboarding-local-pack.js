const MANIFEST_URL = "/assets/clubs/2026-27/manifest.json";

let manifestPromise = null;
let frame = 0;

function loadManifest() {
  if (manifestPromise) return manifestPromise;
  manifestPromise = fetch(MANIFEST_URL, { cache: "force-cache" })
    .then(response => response.ok ? response.json() : null)
    .catch(() => null);
  return manifestPromise;
}

function selectedCode(root) {
  return root?.querySelector(".club-rail-item.selected span")?.textContent?.trim().toUpperCase() || "";
}

function isLocalAsset(source) {
  return typeof source === "string" && source.startsWith("/assets/clubs/2026-27/");
}

function useLocalImage(image, source) {
  if (!(image instanceof HTMLImageElement) || !isLocalAsset(source)) return;
  if (image.dataset.localPackSource === source) return;

  const fallback = image.currentSrc || image.src;
  image.dataset.localPackSource = source;
  if (fallback && fallback !== source && !isLocalAsset(fallback)) image.dataset.localPackFallback = fallback;
  image.decoding = "async";
  image.loading = "eager";

  image.addEventListener("error", () => {
    const remoteFallback = image.dataset.localPackFallback;
    if (!remoteFallback || image.dataset.localPackFailed === "true") return;
    image.dataset.localPackFailed = "true";
    image.src = remoteFallback;
  }, { once: true });

  image.src = source;
}

function useLocalBackground(element, property, source) {
  if (!(element instanceof HTMLElement) || !isLocalAsset(source)) return;
  element.style.setProperty(property, `url("${source}")`);
}

function installKit(slot, source, label) {
  if (!(slot instanceof HTMLElement) || !isLocalAsset(source)) return;
  let image = slot.querySelector(".club-kit-image");
  if (!image) {
    image = document.createElement("img");
    image.className = "club-kit-image";
    image.alt = `Uniforme ${label.toLowerCase()} 2026/27`;
    image.decoding = "async";
    image.loading = "eager";
    const caption = slot.querySelector("small") || document.createElement("small");
    caption.textContent = label;
    slot.replaceChildren(image, caption);
  }
  useLocalImage(image, source);
  slot.classList.add("has-kit-image", "has-local-kit");
  slot.classList.remove("has-procedural-kit");
}

function applyRailPack(root, clubs) {
  root.querySelectorAll(".club-rail-item").forEach(item => {
    const code = item.querySelector("span")?.textContent?.trim().toUpperCase();
    const entry = clubs?.[code];
    if (entry?.crest) useLocalImage(item.querySelector("img"), entry.crest);
  });
}

function applyDetailPack(root, entry) {
  const details = root.querySelector("[data-club-details]");
  if (!details || !entry) return;

  const background = details.querySelector(".club-selection-background");
  if (entry.backdrop || entry.stadium) {
    useLocalBackground(background, "--club-background", entry.backdrop || entry.stadium);
  }

  useLocalBackground(details, "--v5-stadium-image", entry.stadium || entry.backdrop);
  useLocalBackground(details, "--v5-location-image", entry.city || entry.stadium || entry.backdrop);

  const location = details.querySelector(".club-location-panel");
  const stadium = details.querySelector(".club-stadium-panel");
  useLocalBackground(location, "--stadium-image", entry.city || entry.stadium || entry.backdrop);
  useLocalBackground(stadium, "--stadium-image", entry.stadium || entry.backdrop);

  if (entry.crest) useLocalImage(details.querySelector(".club-badge-panel img"), entry.crest);
  if (entry.manager) useLocalImage(details.querySelector(".club-manager-panel > img, .club-manager-image"), entry.manager);

  const slots = details.querySelectorAll(".club-kit-slot");
  if (slots[0] && entry.homeKit) installKit(slots[0], entry.homeKit, "CASA");
  if (slots[1] && entry.awayKit) installKit(slots[1], entry.awayKit, "FORA");

  details.dataset.localPackReady = "true";
}

async function applyLocalPack() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(async () => {
    const root = document.querySelector(".career-club-selection");
    if (!root) return;

    const manifest = await loadManifest();
    const clubs = manifest?.clubs;
    if (!clubs || !Object.keys(clubs).length || !root.isConnected) return;

    applyRailPack(root, clubs);
    const code = selectedCode(root);
    applyDetailPack(root, clubs[code]);
    root.classList.add("onboarding-local-pack-ready");
  });
}

const observer = new MutationObserver(mutations => {
  const relevant = mutations.some(mutation => [...mutation.addedNodes].some(node => node instanceof Element && (
    node.matches?.(".career-club-selection, [data-club-details], .club-selection-grid")
    || node.querySelector?.(".career-club-selection, [data-club-details], .club-selection-grid")
  )));
  if (relevant) applyLocalPack();
});

observer.observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener("click", event => {
  if (event.target.closest("[data-club-index], [data-club-step]")) applyLocalPack();
}, true);
window.addEventListener("hashchange", applyLocalPack);
document.addEventListener("DOMContentLoaded", applyLocalPack, { once: true });
applyLocalPack();

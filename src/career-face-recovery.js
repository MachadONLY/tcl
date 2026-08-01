import { getPlayerFace } from "./player-face-service.js";

function fallbackPortrait(name) {
  const seed = encodeURIComponent(String(name || "Touchline player"));
  return `https://api.dicebear.com/9.x/notionists-neutral/svg?seed=${seed}&backgroundColor=e6efe1&radius=18&scale=92`;
}

function inferName(face) {
  const row = face.closest(".career-squad-row, .career-transfer-row, .career-market-row, .career-shortlist-row");
  const panel = face.closest(".career-player-profile, .career-transfer-profile, .career-offer-profile");
  return (
    face.dataset.playerName ||
    row?.querySelector("strong")?.textContent?.trim() ||
    panel?.querySelector("h2")?.textContent?.trim() ||
    face.querySelector("img")?.alt?.trim() ||
    "Touchline player"
  );
}

function recoverySources(name, current) {
  const resolved = getPlayerFace(name);
  return [...new Set([
    ...(resolved?.photoSources || []),
    resolved?.photo,
    fallbackPortrait(name)
  ].filter(source => source && source !== current))];
}

function installImageRecovery(image, face, name) {
  if (image.dataset.careerRecoveryReady === "true") return;
  image.dataset.careerRecoveryReady = "true";

  image.addEventListener("error", () => {
    const queue = JSON.parse(image.dataset.careerRecoveryQueue || "[]");
    const next = queue.shift();
    image.dataset.careerRecoveryQueue = JSON.stringify(queue);
    if (next) {
      image.src = next;
      return;
    }
    face.classList.remove("has-photo");
    image.remove();
  });

  image.dataset.careerRecoveryQueue = JSON.stringify(recoverySources(name, image.currentSrc || image.src));
}

function ensurePortrait(face) {
  const name = inferName(face);
  face.dataset.playerName = name;
  let image = face.querySelector(":scope > img");

  if (!image) {
    image = document.createElement("img");
    image.alt = name;
    image.decoding = "async";
    image.loading = "eager";
    image.referrerPolicy = "no-referrer";
    image.src = fallbackPortrait(name);
    face.insertBefore(image, face.querySelector(":scope > small") || null);
  }

  face.classList.add("has-photo");
  installImageRecovery(image, face, name);
}

function scan() {
  document.querySelectorAll(".career-face").forEach(ensurePortrait);
}

const observer = new MutationObserver(() => requestAnimationFrame(scan));
observer.observe(document.body, { childList: true, subtree: true });
document.addEventListener("DOMContentLoaded", scan, { once: true });
scan();

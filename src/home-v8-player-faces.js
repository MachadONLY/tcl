import "./home-v8-player-faces.css";
import { getPlayerFace, playerFaceCoverage } from "./player-face-service.js";

const DEFAULT_TEAM = "Manchester United";

function isPlayerRole(value) {
  return /\bjogador\b|\bplayer\b/i.test(String(value || ""));
}

function mountFace(avatar, playerName, teamHint = DEFAULT_TEAM) {
  if (!avatar || !playerName) return;
  if (avatar.dataset.facePlayer === playerName) return;

  const player = getPlayerFace(playerName, teamHint);
  avatar.dataset.facePlayer = playerName;

  if (!player?.photo) {
    avatar.classList.add("v8-face-missing");
    return;
  }

  avatar.classList.remove("v8-face-missing");
  avatar.classList.add("v8-face-loading");
  avatar.dataset.faceSource = player.source || "api-football";
  avatar.title = `${player.name}${player.teamName ? ` · ${player.teamName}` : ""}`;

  const existing = avatar.querySelector(":scope > img.v8-player-face");
  existing?.remove();

  const image = document.createElement("img");
  image.className = "v8-player-face";
  image.alt = `Foto de ${player.name}`;
  image.src = player.photo;
  image.loading = "lazy";
  image.decoding = "async";
  image.referrerPolicy = "no-referrer";

  image.addEventListener("load", () => {
    avatar.classList.remove("v8-face-loading");
    avatar.classList.add("v8-face-ready");
  }, { once: true });

  image.addEventListener("error", () => {
    image.remove();
    avatar.classList.remove("v8-face-loading", "v8-face-ready");
    avatar.classList.add("v8-face-missing");
  }, { once: true });

  const numberBadge = avatar.querySelector(":scope > small");
  avatar.insertBefore(image, numberBadge || null);
}

function decorateMailRows() {
  document.querySelectorAll(".v6-mail-row").forEach(row => {
    const sender = row.querySelector(".v6-mail-sender strong")?.textContent?.trim();
    const role = row.querySelector(".v6-mail-meta i")?.textContent?.trim();
    const avatar = row.querySelector(".v6-mail-avatar");
    if (sender && isPlayerRole(role)) mountFace(avatar, sender);
  });
}

function decorateReader() {
  document.querySelectorAll(".v6-mail-reader").forEach(reader => {
    const sender = reader.querySelector(".v6-reader-from strong")?.textContent?.trim();
    const role = reader.querySelector(".v6-reader-from small")?.textContent?.trim();
    const avatar = reader.querySelector(".v6-reader-from .v6-mail-avatar");
    if (sender && isPlayerRole(role)) mountFace(avatar, sender);
  });
}

function decorateGenericPlayerAvatars() {
  document.querySelectorAll("[data-player-name]").forEach(element => {
    const playerName = element.getAttribute("data-player-name");
    const teamHint = element.getAttribute("data-player-team") || DEFAULT_TEAM;
    const avatar = element.matches(".v6-mail-avatar, [data-player-avatar]")
      ? element
      : element.querySelector("[data-player-avatar]");
    mountFace(avatar, playerName, teamHint);
  });
}

function scan() {
  if (window.location.hash === "#matchday") return;
  decorateMailRows();
  decorateReader();
  decorateGenericPlayerAvatars();
}

function boot() {
  scan();
  const observer = new MutationObserver(() => window.requestAnimationFrame(scan));
  observer.observe(document.body, { childList: true, subtree: true });

  window.touchlinePlayerFaces = Object.freeze({
    getCoverage: playerFaceCoverage,
    refresh: scan
  });
}

boot();

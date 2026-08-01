import "./home-v8-player-faces.css";
import { getPlayerFace, playerFaceCoverage } from "./player-face-service.js";

const DEFAULT_TEAM = "Manchester United";

function resetAvatar(avatar) {
  avatar.querySelectorAll(":scope > img.v8-player-face").forEach(image => image.remove());
  avatar.classList.remove("v8-face-loading", "v8-face-ready", "v8-face-missing");
  delete avatar.dataset.faceSource;
  delete avatar.dataset.faceLoadingFor;
  delete avatar.dataset.faceSignature;
}

function mountFace(avatar, playerName, teamHint = DEFAULT_TEAM) {
  if (!avatar || !playerName) return;

  const player = getPlayerFace(playerName, teamHint);
  if (!player) return;

  const sources = [...new Set(player.photoSources || [player.photo])].filter(Boolean);
  if (!sources.length) return;

  const signature = `${playerName}|${sources.join("|")}`;
  if (
    avatar.dataset.faceSignature === signature &&
    (avatar.classList.contains("v8-face-ready") || avatar.classList.contains("v8-face-loading"))
  ) {
    return;
  }

  resetAvatar(avatar);
  avatar.dataset.faceLoadingFor = playerName;
  avatar.dataset.faceSignature = signature;
  avatar.classList.add("v8-face-loading");
  avatar.title = `${player.name}${player.teamName ? ` · ${player.teamName}` : ""}`;

  const numberBadge = avatar.querySelector(":scope > small");
  let sourceIndex = 0;

  const tryNextSource = () => {
    const source = sources[sourceIndex];
    if (!source) {
      avatar.classList.remove("v8-face-loading", "v8-face-ready");
      avatar.classList.add("v8-face-missing");
      avatar.dataset.facePlayer = playerName;
      delete avatar.dataset.faceLoadingFor;
      return;
    }

    const image = document.createElement("img");
    image.className = "v8-player-face";
    image.alt = `Foto de ${player.name}`;
    image.loading = "eager";
    image.decoding = "async";
    image.referrerPolicy = "no-referrer";

    image.addEventListener("load", () => {
      avatar.querySelectorAll(":scope > img.v8-player-face").forEach(other => {
        if (other !== image) other.remove();
      });
      avatar.classList.remove("v8-face-loading", "v8-face-missing");
      avatar.classList.add("v8-face-ready");
      avatar.dataset.facePlayer = playerName;
      avatar.dataset.faceSource = source;
      avatar.dataset.faceSignature = signature;
      delete avatar.dataset.faceLoadingFor;
    }, { once: true });

    image.addEventListener("error", () => {
      image.remove();
      sourceIndex += 1;
      tryNextSource();
    }, { once: true });

    avatar.insertBefore(image, numberBadge || null);
    image.src = source;
  };

  tryNextSource();
}

function decorateMailRows() {
  document.querySelectorAll(".v6-mail-row").forEach(row => {
    const sender = row.querySelector(".v6-mail-sender strong")?.textContent?.trim();
    const avatar = row.querySelector(".v6-mail-avatar");
    if (sender) mountFace(avatar, sender);
  });
}

function decorateReader() {
  document.querySelectorAll(".v6-mail-reader").forEach(reader => {
    const sender = reader.querySelector(".v6-reader-from strong")?.textContent?.trim();
    const avatar = reader.querySelector(".v6-reader-from .v6-mail-avatar");
    if (sender) mountFace(avatar, sender);
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

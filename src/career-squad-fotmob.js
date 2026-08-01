import { USER_SQUAD } from "./career-mode-data.js";
import { fotmobPortraitUrl, normalizePlayerIdentity } from "./fotmob-player-ids.js";

const squadByName = new Map(USER_SQUAD.map(player => [normalizePlayerIdentity(player.name), player]));
let queued = false;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initials(value) {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || "")
    .join("") || "PL";
}

function roleLabel(position) {
  const value = String(position || "").toUpperCase();
  if (value === "GK") return "Goleiro";
  if (["CB", "RB", "LB", "RWB", "LWB", "DEF"].includes(value)) return "Defensor";
  if (["CDM", "CM", "CAM", "DM", "AM", "MID"].includes(value)) return "Meio-campo";
  if (["RW", "LW", "CF", "ST", "FW", "ATT"].includes(value)) return "Atacante";
  return "Jogador";
}

function findPlayer(name) {
  const normalized = normalizePlayerIdentity(name);
  return squadByName.get(normalized) ||
    [...squadByName.entries()].find(([key]) => key.endsWith(normalized) || normalized.endsWith(key))?.[1] ||
    null;
}

function portraitMarkup(name) {
  const source = fotmobPortraitUrl(name);
  const fallback = initials(name);
  return `<span class="fm-squad-avatar ${source ? "has-source" : "no-source"}" aria-hidden="true">
    <span>${escapeHtml(fallback)}</span>
    ${source ? `<img src="${source}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" />` : ""}
  </span>`;
}

function markImageReady(image) {
  image.closest(".fm-squad-avatar")?.classList.add("loaded");
}

function markImageFailed(image) {
  const avatar = image.closest(".fm-squad-avatar");
  image.remove();
  avatar?.classList.remove("loaded", "has-source");
  avatar?.classList.add("no-source");
}

function enhanceRow(row) {
  if (row.dataset.fotmobSquadReady === "true") return;

  const name = row.dataset.playerName || row.querySelector(".classic-player-copy strong")?.textContent?.trim();
  if (!name) return;

  const player = findPlayer(name);
  const originalPosition = row.dataset.playerPosition || row.querySelector(".classic-position")?.textContent?.trim();
  const position = player?.position || originalPosition || "";
  const rating = Number(row.dataset.playerRating || player?.rating || row.querySelector(".classic-player-ovr")?.textContent) || 0;
  const number = Number(player?.number);
  const status = row.dataset.playerStatus || row.querySelector(".classic-player-copy small")?.textContent?.trim() || "Disponível";

  row.classList.add("fm-squad-row");
  row.dataset.fotmobSquadReady = "true";
  row.innerHTML = `
    ${portraitMarkup(name)}
    <span class="fm-shirt-number">${Number.isFinite(number) && number > 0 ? number : "—"}</span>
    <span class="fm-player-copy">
      <strong>${escapeHtml(name)}</strong>
      <small>${escapeHtml(roleLabel(position))}${status !== "Disponível" ? ` · ${escapeHtml(status)}` : ""}</small>
    </span>
    <span class="fm-player-ovr">${rating || "—"}</span>
    <span class="fm-player-open" aria-hidden="true">→</span>`;

  const image = row.querySelector(".fm-squad-avatar img");
  if (!image) return;

  image.addEventListener("load", () => markImageReady(image), { once: true });
  image.addEventListener("error", () => markImageFailed(image), { once: true });

  if (image.complete) {
    if (image.naturalWidth > 0) markImageReady(image);
    else markImageFailed(image);
  }
}

function enhanceGroup(group) {
  const title = group.querySelector(":scope > header");
  if (title && title.dataset.fotmobGroupReady !== "true") {
    const raw = title.childNodes[0]?.textContent?.trim() || title.textContent?.trim() || "Elenco";
    title.dataset.sectionTitle = raw.replace(/\d+$/, "").trim();
    title.dataset.fotmobGroupReady = "true";
  }
  group.querySelectorAll(":scope > .career-squad-row").forEach(enhanceRow);
}

function enhanceProfile(module) {
  const profile = module.querySelector(".career-player-profile");
  if (!profile) return;
  profile.classList.add("fm-management-panel");

  const kicker = profile.querySelector(".classic-profile-kicker span");
  if (kicker) kicker.textContent = "GESTÃO DO JOGADOR";

  const managementTitle = profile.querySelector(".classic-management-title span");
  if (managementTitle) managementTitle.textContent = "AÇÕES DISPONÍVEIS";
}

function enhanceSquad() {
  const module = document.querySelector(".career-squad-classic");
  if (!module) return;

  module.classList.add("career-squad-fotmob");

  const tableHead = module.querySelector(".career-table-head");
  if (tableHead && tableHead.dataset.fotmobHead !== "true") {
    tableHead.dataset.fotmobHead = "true";
    tableHead.innerHTML = "<span>Jogador</span><span>OVR</span>";
  }

  module.querySelectorAll(".classic-position-group").forEach(enhanceGroup);
  enhanceProfile(module);
}

function queueEnhancement() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    enhanceSquad();
  });
}

const observer = new MutationObserver(queueEnhancement);
observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener("hashchange", queueEnhancement);
queueEnhancement();

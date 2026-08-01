import { USER_SQUAD, formatMoney } from "./career-mode-data.js";

const STORAGE_KEY = "touchline.career.mode.v1";
const playersById = new Map(USER_SQUAD.map(player => [String(player.id), player]));

function isSquadRoute() {
  return window.location.hash.split("?")[0] === "#squad";
}

function readSave() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeSelectedPlayer(playerId) {
  const save = readSave();
  save.selectedSquadId = String(playerId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
  return save;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cleanText(value, fallback = "—") {
  const text = String(value ?? "").trim();
  if (!text || /^(undefined|null|nan(?:\s*anos?)?)$/i.test(text)) return fallback;
  return text;
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

function deterministicContractYears(id) {
  let hash = 0;
  for (const character of String(id || "")) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return 2 + (Math.abs(hash) % 4);
}

function portraitData(row, player) {
  const image = row.querySelector(".fm-squad-avatar img");
  return {
    source: image?.currentSrc || image?.getAttribute("src") || "",
    fallback: cleanText(row.querySelector(".fm-squad-avatar > span")?.textContent, initials(player.name))
  };
}

function portraitMarkup(data) {
  return `<span class="player-console-portrait${data.source ? " has-source" : " no-source"}" aria-hidden="true">
    <span>${escapeHtml(data.fallback)}</span>
    ${data.source ? `<img src="${escapeHtml(data.source)}" alt="" loading="eager" decoding="async" referrerpolicy="no-referrer" />` : ""}
  </span>`;
}

function metric(label, value, emphasis = false) {
  return `<div class="player-console-metric${emphasis ? " emphasis" : ""}">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(value)}</strong>
  </div>`;
}

function command(action, title, detail, tone, icon, playerId) {
  return `<button type="button" class="player-console-command ${tone}" data-classic-player-action="${action}" data-player-id="${escapeHtml(playerId)}">
    <span class="player-console-command-icon" aria-hidden="true">${icon}</span>
    <span class="player-console-command-copy">
      <strong>${escapeHtml(title)}</strong>
      <small>${escapeHtml(detail)}</small>
    </span>
    <span class="player-console-command-arrow" aria-hidden="true">›</span>
  </button>`;
}

function activatePortrait(profile) {
  const image = profile.querySelector(".player-console-portrait img");
  if (!image) return;

  const loaded = () => image.closest(".player-console-portrait")?.classList.add("loaded");
  const failed = () => {
    const portrait = image.closest(".player-console-portrait");
    image.remove();
    portrait?.classList.remove("loaded", "has-source");
    portrait?.classList.add("no-source");
  };

  image.addEventListener("load", loaded, { once: true });
  image.addEventListener("error", failed, { once: true });
  if (image.complete) {
    if (image.naturalWidth > 0) loaded();
    else failed();
  }
}

function renderProfile(row, player, save) {
  const profile = document.querySelector(".career-player-profile");
  if (!profile) return;

  const negotiation = save.contractNegotiations?.[String(player.id)];
  const status = cleanText(save.playerStatus?.[String(player.id)], "Disponível");
  const years = Number(negotiation?.years) || deterministicContractYears(player.id);
  const salary = Number(negotiation?.salary) > 0
    ? `€${Math.round(Number(negotiation.salary) / 1000)}K`
    : formatMoney(player.wage, true);
  const portrait = portraitData(row, player);

  const commands = [
    command("renew", "Renovar contrato", "Negociar novo vínculo", "primary", "↻", player.id),
    command("list", "Colocar à venda", "Abrir para propostas", "neutral", "⇄", player.id),
    command("release", "Rescindir contrato", "Encerrar vínculo", "danger", "×", player.id)
  ].join("");

  profile.dataset.selectedPlayerId = String(player.id);
  profile.dataset.commandCenterVersion = "4";
  profile.classList.add("player-command-center");
  profile.innerHTML = `
    <div class="player-console-topbar">
      <div>
        <span>GESTÃO DO JOGADOR</span>
        <small>PRIMEIRO TIME</small>
      </div>
      <div class="player-console-context">
        <span>${escapeHtml(player.position)}</span>
        <i></i>
        <small>${escapeHtml(cleanText(player.nationality, "—"))}</small>
      </div>
    </div>

    <section class="player-console-identity">
      <div class="player-console-player">
        ${portraitMarkup(portrait)}
        <div class="player-console-title">
          <h2>${escapeHtml(player.name)}</h2>
          <p><i></i>${escapeHtml(status)}</p>
        </div>
      </div>
      <div class="player-console-overall" aria-label="Overall ${escapeHtml(player.rating)}">
        <span>OVERALL</span>
        <strong>${escapeHtml(player.rating)}</strong>
      </div>
    </section>

    <section class="player-console-dashboard" aria-label="Resumo do jogador">
      ${metric("Idade", player.age)}
      ${metric("Salário semanal", salary)}
      ${metric("Contrato", `${years} anos`, true)}
      ${metric("Valor de mercado", formatMoney(player.value, true))}
      ${metric("Potencial", player.potential)}
      ${metric("Situação", status)}
    </section>

    <section class="player-console-actions">
      <div class="player-console-command-grid">${commands}</div>
    </section>
  `;

  profile.classList.remove("player-console-swap");
  void profile.offsetWidth;
  profile.classList.add("player-console-swap");
  activatePortrait(profile);
}

function selectRow(row) {
  const playerId = String(row.dataset.squadPlayer || "");
  const player = playersById.get(playerId);
  if (!player) return;

  document.querySelectorAll(".career-squad-scroll [data-squad-player]")
    .forEach(candidate => candidate.classList.toggle("selected", candidate === row));

  const save = writeSelectedPlayer(playerId);
  renderProfile(row, player, save);
}

// Capture only squad-row clicks. No route rerender, no hashchange and no scroll
// restoration are needed because the list DOM never changes.
document.addEventListener("click", event => {
  if (!isSquadRoute()) return;
  const row = event.target.closest(".career-squad-scroll [data-squad-player]");
  if (!row) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  selectRow(row);
}, true);

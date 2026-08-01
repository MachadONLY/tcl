const COMMAND_CENTER_VERSION = "3";
let commandCenterQueued = false;

function cleanText(value, fallback = "—") {
  const text = String(value ?? "").trim();
  if (!text || /^(undefined|null|nan(?:\s*anos?)?)$/i.test(text)) return fallback;
  return text;
}

function escapeMarkup(value) {
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

function readMetric(profile, label) {
  const normalized = label.toLowerCase();
  const item = [...profile.querySelectorAll(".classic-contract-summary > span")]
    .find(node => node.querySelector("small")?.textContent?.trim().toLowerCase() === normalized);
  return cleanText(item?.querySelector("strong")?.textContent);
}

function selectedSquadRow() {
  return document.querySelector(".career-squad-row.selected");
}

function selectedSquadNumber() {
  return cleanText(selectedSquadRow()?.querySelector(".fm-shirt-number")?.textContent, "—");
}

function selectedSquadPortrait(name) {
  const row = selectedSquadRow();
  const image = row?.querySelector(".fm-squad-avatar img");
  return {
    source: image?.getAttribute("src") || image?.currentSrc || "",
    fallback: cleanText(row?.querySelector(".fm-squad-avatar > span")?.textContent, initials(name))
  };
}

function extractProfile(profile) {
  const position = cleanText(profile.querySelector(".classic-position")?.textContent, "—");
  const nationalityLine = cleanText(profile.querySelector(".classic-profile-kicker small")?.textContent, "");
  const nationality = nationalityLine.includes("·")
    ? cleanText(nationalityLine.split("·").at(-1), "")
    : nationalityLine.replace(new RegExp(`^${position}\\s*`, "i"), "").trim();
  const name = cleanText(profile.querySelector("h2")?.textContent, "Jogador");

  return {
    playerId: profile.dataset.selectedPlayerId || "",
    name,
    position,
    nationality: cleanText(nationality, "Primeiro time"),
    number: selectedSquadNumber(),
    portrait: selectedSquadPortrait(name),
    overall: cleanText(profile.querySelector(".classic-profile-ovr b")?.textContent, "—"),
    status: readMetric(profile, "Situação") || cleanText(profile.querySelector(".classic-profile-identity > div > small")?.textContent, "Disponível"),
    age: readMetric(profile, "Idade"),
    salary: readMetric(profile, "Salário"),
    contract: readMetric(profile, "Contrato"),
    value: readMetric(profile, "Valor"),
    potential: readMetric(profile, "Potencial")
  };
}

function metric(label, value, emphasis = false) {
  return `<div class="player-console-metric${emphasis ? " emphasis" : ""}">
    <span>${escapeMarkup(label)}</span>
    <strong>${escapeMarkup(value)}</strong>
  </div>`;
}

function command({ action, title, detail, tone = "neutral", icon }) {
  return `<button type="button" class="player-console-command ${tone}" data-classic-player-action="${action}" data-player-id="__PLAYER_ID__">
    <span class="player-console-command-icon" aria-hidden="true">${icon}</span>
    <span class="player-console-command-copy">
      <strong>${escapeMarkup(title)}</strong>
      <small>${escapeMarkup(detail)}</small>
    </span>
    <span class="player-console-command-arrow" aria-hidden="true">›</span>
  </button>`;
}

function portraitMarkup(data) {
  return `<span class="player-console-portrait${data.portrait.source ? " has-source" : " no-source"}" aria-hidden="true">
    <span>${escapeMarkup(data.portrait.fallback)}</span>
    ${data.portrait.source ? `<img src="${escapeMarkup(data.portrait.source)}" alt="" loading="eager" decoding="async" referrerpolicy="no-referrer" />` : ""}
  </span>`;
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

function renderCommandCenter(profile) {
  if (!profile || profile.dataset.commandCenterVersion === COMMAND_CENTER_VERSION) return;
  const data = extractProfile(profile);
  if (!data.playerId) return;

  const commands = [
    command({
      action: "renew",
      title: "Renovar contrato",
      detail: "Negociar novo vínculo",
      tone: "primary",
      icon: "↻"
    }),
    command({
      action: "list",
      title: "Colocar à venda",
      detail: "Abrir para propostas",
      icon: "⇄"
    }),
    command({
      action: "release",
      title: "Rescindir contrato",
      detail: "Encerrar vínculo",
      tone: "danger",
      icon: "×"
    })
  ].join("").replaceAll("__PLAYER_ID__", escapeMarkup(data.playerId));

  profile.dataset.commandCenterVersion = COMMAND_CENTER_VERSION;
  profile.classList.add("player-command-center");
  profile.innerHTML = `
    <div class="player-console-topbar">
      <div>
        <span>GESTÃO DO JOGADOR</span>
        <small>PRIMEIRO TIME</small>
      </div>
      <div class="player-console-context">
        <span>${escapeMarkup(data.position)}</span>
        <i></i>
        <small>${escapeMarkup(data.nationality)}</small>
      </div>
    </div>

    <section class="player-console-identity">
      <div class="player-console-player">
        ${portraitMarkup(data)}
        <div class="player-console-title">
          <span class="player-console-squad-number">${data.number === "—" ? "ELENCO" : `CAMISA ${escapeMarkup(data.number)}`}</span>
          <h2>${escapeMarkup(data.name)}</h2>
          <p><i></i>${escapeMarkup(data.status)}</p>
        </div>
      </div>
      <div class="player-console-overall" aria-label="Overall ${escapeMarkup(data.overall)}">
        <span>OVERALL</span>
        <strong>${escapeMarkup(data.overall)}</strong>
      </div>
    </section>

    <section class="player-console-dashboard" aria-label="Resumo do jogador">
      ${metric("Idade", data.age)}
      ${metric("Salário semanal", data.salary)}
      ${metric("Contrato", data.contract, true)}
      ${metric("Valor de mercado", data.value)}
      ${metric("Potencial", data.potential)}
      ${metric("Situação", data.status)}
    </section>

    <section class="player-console-actions">
      <div class="player-console-command-grid">${commands}</div>
    </section>
  `;
  activatePortrait(profile);
}

function enhanceCommandCenter() {
  if (window.location.hash.split("?")[0] !== "#squad") return;
  const profile = document.querySelector(".career-player-profile");
  if (!profile || !profile.querySelector(".classic-profile-identity")) return;
  renderCommandCenter(profile);
}

function queueCommandCenter() {
  if (commandCenterQueued) return;
  commandCenterQueued = true;
  requestAnimationFrame(() => {
    commandCenterQueued = false;
    enhanceCommandCenter();
  });
}

const commandCenterObserver = new MutationObserver(queueCommandCenter);
commandCenterObserver.observe(document.body, { childList: true, subtree: true });
window.addEventListener("hashchange", queueCommandCenter);
document.addEventListener("DOMContentLoaded", queueCommandCenter, { once: true });
queueCommandCenter();

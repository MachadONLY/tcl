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
  for (const character of String(id || "")) {
    hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  }
  return 2 + (Math.abs(hash) % 4);
}

function portraitData(row, player) {
  const image = row.querySelector(".fm-squad-avatar img");
  return {
    source: image?.currentSrc || image?.getAttribute("src") || "",
    fallback: cleanText(
      row.querySelector(".fm-squad-avatar > span")?.textContent,
      initials(player.name)
    )
  };
}

function setText(root, selector, value) {
  const element = root.querySelector(selector);
  if (element && element.textContent !== String(value)) element.textContent = String(value);
}

function setMetric(profile, label, value) {
  const normalized = label.toLowerCase();
  const metric = [...profile.querySelectorAll(".player-console-metric")]
    .find(item => item.querySelector("span")?.textContent?.trim().toLowerCase() === normalized);
  const output = metric?.querySelector("strong");
  if (output && output.textContent !== String(value)) output.textContent = String(value);
}

function updateStatus(profile, status) {
  const statusLine = profile.querySelector(".player-console-title p");
  if (!statusLine) return;

  let dot = statusLine.querySelector("i");
  if (!dot) dot = document.createElement("i");

  const currentText = [...statusLine.childNodes]
    .filter(node => node.nodeType === Node.TEXT_NODE)
    .map(node => node.textContent)
    .join("")
    .trim();

  if (currentText === status && statusLine.firstElementChild === dot) return;
  statusLine.replaceChildren(dot, document.createTextNode(status));
}

function updatePortrait(profile, portrait, playerId) {
  const holder = profile.querySelector(".player-console-portrait");
  if (!holder) return;

  const fallback = holder.querySelector(":scope > span");
  if (fallback && fallback.textContent !== portrait.fallback) {
    fallback.textContent = portrait.fallback;
  }

  const currentImage = holder.querySelector("img");
  const currentSource = currentImage?.currentSrc || currentImage?.getAttribute("src") || "";

  if (!portrait.source) {
    currentImage?.remove();
    holder.classList.remove("loaded", "has-source");
    holder.classList.add("no-source");
    return;
  }

  if (currentSource === portrait.source) {
    holder.classList.add("loaded", "has-source");
    holder.classList.remove("no-source");
    return;
  }

  // Preload the next portrait while the previous one stays visible. Only swap
  // after decoding succeeds, eliminating the empty-frame flash between players.
  const nextImage = new Image();
  nextImage.alt = "";
  nextImage.loading = "eager";
  nextImage.decoding = "async";
  nextImage.referrerPolicy = "no-referrer";
  nextImage.src = portrait.source;

  const commitPortrait = () => {
    if (profile.dataset.selectedPlayerId !== String(playerId)) return;
    const activeImage = holder.querySelector("img");
    if (activeImage) activeImage.replaceWith(nextImage);
    else holder.append(nextImage);
    holder.classList.add("loaded", "has-source");
    holder.classList.remove("no-source");
  };

  const failPortrait = () => {
    if (profile.dataset.selectedPlayerId !== String(playerId)) return;
    currentImage?.remove();
    holder.classList.remove("loaded", "has-source");
    holder.classList.add("no-source");
  };

  if (nextImage.complete && nextImage.naturalWidth > 0) {
    nextImage.decode?.().catch(() => {}).finally(commitPortrait);
    return;
  }

  nextImage.addEventListener("load", () => {
    nextImage.decode?.().catch(() => {}).finally(commitPortrait);
  }, { once: true });
  nextImage.addEventListener("error", failPortrait, { once: true });
}

function updateProfile(row, player, save) {
  const profile = document.querySelector(".career-player-profile.player-command-center");
  if (!profile) return false;

  const negotiation = save.contractNegotiations?.[String(player.id)];
  const status = cleanText(save.playerStatus?.[String(player.id)], "Disponível");
  const years = Number(negotiation?.years) || deterministicContractYears(player.id);
  const salary = Number(negotiation?.salary) > 0
    ? `€${Math.round(Number(negotiation.salary) / 1000)}K`
    : formatMoney(player.wage, true);
  const portrait = portraitData(row, player);

  profile.dataset.selectedPlayerId = String(player.id);

  setText(profile, ".player-console-context > span", player.position);
  setText(profile, ".player-console-context > small", cleanText(player.nationality, "—"));
  setText(profile, ".player-console-title h2", player.name);
  updateStatus(profile, status);
  setText(profile, ".player-console-overall strong", player.rating);

  const overall = profile.querySelector(".player-console-overall");
  if (overall) overall.setAttribute("aria-label", `Overall ${player.rating}`);

  setMetric(profile, "Idade", player.age);
  setMetric(profile, "Salário semanal", salary);
  setMetric(profile, "Contrato", `${years} anos`);
  setMetric(profile, "Valor de mercado", formatMoney(player.value, true));
  setMetric(profile, "Potencial", player.potential);
  setMetric(profile, "Situação", status);

  profile.querySelectorAll("[data-classic-player-action]").forEach(button => {
    button.dataset.playerId = String(player.id);
  });

  updatePortrait(profile, portrait, player.id);
  return true;
}

function selectRow(row) {
  const playerId = String(row.dataset.squadPlayer || "");
  const player = playersById.get(playerId);
  if (!player || row.classList.contains("selected")) return;

  document.querySelectorAll(".career-squad-scroll [data-squad-player]")
    .forEach(candidate => candidate.classList.toggle("selected", candidate === row));

  const save = writeSelectedPlayer(playerId);
  updateProfile(row, player, save);
}

// Squad selection is intentionally local. The route is not rendered again,
// the list DOM is untouched and the scroll container never changes position.
document.addEventListener("click", event => {
  if (!isSquadRoute()) return;
  const row = event.target.closest(".career-squad-scroll [data-squad-player]");
  if (!row) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  selectRow(row);
}, true);

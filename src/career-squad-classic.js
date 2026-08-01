const CAREER_STORAGE_KEY = "touchline.career.mode.v1";
const POSITION_GROUPS = {
  GK: { key: "gk", label: "Goleiros", order: 0 },
  CB: { key: "def", label: "Defensores", order: 1 },
  LB: { key: "def", label: "Defensores", order: 1 },
  RB: { key: "def", label: "Defensores", order: 1 },
  LWB: { key: "def", label: "Defensores", order: 1 },
  RWB: { key: "def", label: "Defensores", order: 1 },
  CDM: { key: "mid", label: "Meio-campistas", order: 2 },
  CM: { key: "mid", label: "Meio-campistas", order: 2 },
  CAM: { key: "mid", label: "Meio-campistas", order: 2 },
  LM: { key: "mid", label: "Meio-campistas", order: 2 },
  RM: { key: "mid", label: "Meio-campistas", order: 2 },
  LW: { key: "att", label: "Atacantes", order: 3 },
  RW: { key: "att", label: "Atacantes", order: 3 },
  CF: { key: "att", label: "Atacantes", order: 3 },
  ST: { key: "att", label: "Atacantes", order: 3 }
};

let queued = false;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function readSave() {
  try {
    return JSON.parse(localStorage.getItem(CAREER_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeSave(save) {
  localStorage.setItem(CAREER_STORAGE_KEY, JSON.stringify(save));
}

function rerenderCareer() {
  window.dispatchEvent(new Event("hashchange"));
}

function positionMeta(position) {
  return POSITION_GROUPS[position] || { key: "other", label: "Outros", order: 4 };
}

function playerRowData(row) {
  const children = [...row.children];
  const nameRoot = row.querySelector(".career-squad-name");
  return {
    row,
    id: row.dataset.squadPlayer || "",
    name: nameRoot?.querySelector("strong")?.textContent?.trim() || "Jogador",
    status: nameRoot?.querySelector("small")?.textContent?.trim() || "Disponível",
    position: children[1]?.textContent?.trim() || "—",
    rating: Number.parseInt(children[2]?.textContent || "0", 10) || 0,
    age: children[3]?.textContent?.trim() || "—",
    salary: children[6]?.textContent?.trim() || "—",
    selected: row.classList.contains("selected")
  };
}

function renderClassicRow(player) {
  const meta = positionMeta(player.position);
  player.row.dataset.positionGroup = meta.key;
  player.row.dataset.playerName = player.name;
  player.row.dataset.playerRating = String(player.rating);
  player.row.innerHTML = `
    <span class="classic-position classic-position-${meta.key}">${escapeHtml(player.position)}</span>
    <span class="classic-player-copy">
      <strong>${escapeHtml(player.name)}</strong>
      <small>${escapeHtml(player.status)}</small>
    </span>
    <span class="classic-player-ovr" aria-label="Overall ${player.rating}">${player.rating}</span>
  `;
}

function rebuildSquadList(module) {
  const scroll = module.querySelector(".career-squad-scroll");
  if (!scroll) return [];

  const save = readSave();
  const released = new Set(save.releasedPlayers || []);
  const players = [...scroll.querySelectorAll(".career-squad-row")]
    .map(playerRowData)
    .filter(player => !released.has(player.id));

  players.sort((a, b) => {
    const groupDifference = positionMeta(a.position).order - positionMeta(b.position).order;
    return groupDifference || b.rating - a.rating || a.name.localeCompare(b.name, "pt-BR");
  });

  scroll.innerHTML = "";
  const grouped = new Map();
  for (const player of players) {
    const meta = positionMeta(player.position);
    if (!grouped.has(meta.key)) grouped.set(meta.key, { meta, players: [] });
    grouped.get(meta.key).players.push(player);
  }

  for (const { meta, players: groupPlayers } of grouped.values()) {
    const group = document.createElement("section");
    group.className = `classic-position-group classic-position-group-${meta.key}`;
    group.innerHTML = `<header><span>${escapeHtml(meta.label)}</span><small>${groupPlayers.length}</small></header>`;
    for (const player of groupPlayers) {
      renderClassicRow(player);
      group.append(player.row);
    }
    scroll.append(group);
  }

  const tableHead = module.querySelector(".career-table-head");
  if (tableHead) tableHead.innerHTML = "<span>POS</span><span>JOGADOR</span><span>OVR</span>";
  return players;
}

function selectedPlayerData(module, players) {
  return players.find(player => player.selected) || players[0] || null;
}

function statValue(profile, label) {
  const entries = [...profile.querySelectorAll(".career-stat-pairs > span")];
  const item = entries.find(entry => entry.querySelector("small")?.textContent?.trim().toLowerCase() === label.toLowerCase());
  return item?.querySelector("strong")?.textContent?.trim() || "—";
}

function rebuildProfile(module, player) {
  const profile = module.querySelector(".career-player-profile");
  if (!profile || !player) return;

  const oldProfile = profile.cloneNode(true);
  const title = oldProfile.querySelector(".career-profile-title");
  const nationalityLine = title?.querySelector("span")?.textContent?.trim() || player.position;
  const potential = statValue(oldProfile, "Potencial");
  const value = statValue(oldProfile, "Valor estimado");
  const baseContract = statValue(oldProfile, "Contrato");
  const save = readSave();
  const negotiation = save.contractNegotiations?.[player.id];
  const contract = negotiation ? `${negotiation.years} anos` : baseContract;
  const salary = negotiation?.salary ? `€${Number(negotiation.salary).toLocaleString("pt-BR")}/sem` : player.salary;
  const status = save.playerStatus?.[player.id] || player.status;

  profile.dataset.selectedPlayerId = player.id;
  profile.innerHTML = `
    <div class="classic-profile-kicker">
      <span>JOGADOR SELECIONADO</span>
      <small>${escapeHtml(nationalityLine)}</small>
    </div>
    <div class="classic-profile-identity">
      <div>
        <span class="classic-position classic-position-${positionMeta(player.position).key}">${escapeHtml(player.position)}</span>
        <h2>${escapeHtml(player.name)}</h2>
        <small>${escapeHtml(status)}</small>
      </div>
      <strong class="classic-profile-ovr"><b>${player.rating}</b><small>OVR</small></strong>
    </div>
    <div class="classic-contract-summary">
      <span><small>Idade</small><strong>${escapeHtml(player.age)}</strong></span>
      <span><small>Salário</small><strong>${escapeHtml(salary)}</strong></span>
      <span><small>Contrato</small><strong>${escapeHtml(contract)}</strong></span>
      <span><small>Valor</small><strong>${escapeHtml(value)}</strong></span>
      <span><small>Potencial</small><strong>${escapeHtml(potential)}</strong></span>
      <span><small>Situação</small><strong>${escapeHtml(status)}</strong></span>
    </div>
    <div class="classic-management-title">
      <span>GESTÃO CONTRATUAL</span>
      <p>Escolha uma ação. As decisões abaixo alteram imediatamente a situação do atleta no clube.</p>
    </div>
    <div class="classic-management-actions">
      <button type="button" class="classic-action classic-action-primary" data-classic-player-action="renew" data-player-id="${escapeHtml(player.id)}">
        <span class="classic-action-icon">↻</span>
        <span><strong>Renovar contrato</strong><small>Negocie duração, salário, papel e bônus.</small></span>
        <b>›</b>
      </button>
      <button type="button" class="classic-action" data-classic-player-action="list" data-player-id="${escapeHtml(player.id)}">
        <span class="classic-action-icon">⇄</span>
        <span><strong>Colocar à venda</strong><small>Disponibilize o jogador no mercado de transferências.</small></span>
        <b>›</b>
      </button>
      <button type="button" class="classic-action classic-action-danger" data-classic-player-action="release" data-player-id="${escapeHtml(player.id)}">
        <span class="classic-action-icon">×</span>
        <span><strong>Rescindir contrato</strong><small>Encerre o vínculo e remova o atleta do elenco.</small></span>
        <b>›</b>
      </button>
    </div>
  `;
}

function rebuildTopArea(module, players) {
  const moduleHeader = module.querySelector(".career-module-header");
  moduleHeader?.querySelector("h1")?.replaceChildren("Elenco");
  moduleHeader?.querySelector("p")?.replaceChildren("Gerencie jogadores, contratos e disponibilidade para transferências.");
  moduleHeader?.querySelector(".career-header-actions")?.remove();

  const budget = module.querySelector(".career-budget-strip");
  if (budget) {
    const counts = players.reduce((result, player) => {
      const key = positionMeta(player.position).key;
      result[key] = (result[key] || 0) + 1;
      return result;
    }, {});
    budget.className = "classic-squad-overview";
    budget.innerHTML = `
      <div><small>ELENCO PRINCIPAL</small><strong>${players.length} jogadores</strong></div>
      <span class="classic-overview-dot classic-position-gk"></span><b>${counts.gk || 0} GOL</b>
      <span class="classic-overview-dot classic-position-def"></span><b>${counts.def || 0} DEF</b>
      <span class="classic-overview-dot classic-position-mid"></span><b>${counts.mid || 0} MEI</b>
      <span class="classic-overview-dot classic-position-att"></span><b>${counts.att || 0} ATA</b>
      <p>Selecione um jogador para gerenciar seu vínculo.</p>
    `;
  }

  module.querySelector(".career-tabs")?.remove();
}

function rebuildSquadModule() {
  if (window.location.hash.split("?")[0] !== "#squad") return;
  const module = document.querySelector(".career-squad-module");
  if (!module || module.dataset.classicSquadReady === "true") return;

  module.dataset.classicSquadReady = "true";
  module.classList.add("career-squad-classic");
  const players = rebuildSquadList(module);
  rebuildTopArea(module, players);
  rebuildProfile(module, selectedPlayerData(module, players));
}

function modalShell(content) {
  const layer = document.createElement("div");
  layer.className = "classic-contract-modal-layer";
  layer.innerHTML = `<div class="classic-contract-scrim" data-classic-modal-close></div>${content}`;
  document.body.append(layer);
  requestAnimationFrame(() => layer.classList.add("visible"));
  return layer;
}

function closeModal() {
  const layer = document.querySelector(".classic-contract-modal-layer");
  if (!layer) return;
  layer.classList.remove("visible");
  setTimeout(() => layer.remove(), 180);
}

function parseSalary(value) {
  const digits = String(value || "").replace(/[^0-9.,]/g, "").replace(".", "").replace(",", ".");
  const number = Number.parseFloat(digits) || 0;
  return String(value).toLowerCase().includes("k") ? Math.round(number * 1000) : Math.round(number);
}

function openRenewalModal(playerId) {
  const profile = document.querySelector(".career-player-profile");
  const name = profile?.querySelector("h2")?.textContent?.trim() || "Jogador";
  const position = profile?.querySelector(".classic-position")?.textContent?.trim() || "—";
  const rating = profile?.querySelector(".classic-profile-ovr b")?.textContent?.trim() || "—";
  const salaryText = [...(profile?.querySelectorAll(".classic-contract-summary > span") || [])]
    .find(item => item.querySelector("small")?.textContent?.trim() === "Salário")
    ?.querySelector("strong")?.textContent || "€100K";
  const currentSalary = Math.max(1000, parseSalary(salaryText));

  modalShell(`
    <section class="classic-contract-modal" role="dialog" aria-modal="true" aria-labelledby="classic-contract-title">
      <header>
        <div><span>NEGOCIAÇÃO CONTRATUAL</span><h2 id="classic-contract-title">${escapeHtml(name)}</h2><p>${escapeHtml(position)} · ${escapeHtml(rating)} OVR</p></div>
        <button type="button" data-classic-modal-close aria-label="Fechar">×</button>
      </header>
      <form data-classic-renew-form data-player-id="${escapeHtml(playerId)}">
        <div class="classic-contract-fields">
          <label><span>Duração</span><select name="years"><option value="1">1 ano</option><option value="2">2 anos</option><option value="3" selected>3 anos</option><option value="4">4 anos</option><option value="5">5 anos</option></select></label>
          <label><span>Salário semanal</span><div class="classic-money-input"><b>€</b><input name="salary" type="number" min="1000" step="1000" value="${Math.round(currentSalary * 1.08)}" required /></div></label>
          <label><span>Papel no elenco</span><select name="role"><option>Crucial</option><option selected>Importante</option><option>Rotação</option><option>Promessa</option></select></label>
          <label><span>Bônus de assinatura</span><div class="classic-money-input"><b>€</b><input name="bonus" type="number" min="0" step="10000" value="${Math.round(currentSalary * 8)}" /></div></label>
        </div>
        <aside class="classic-contract-note"><strong>Resumo da proposta</strong><p>O novo vínculo substitui o contrato atual. Salários maiores facilitam o aceite, enquanto um papel incompatível pode gerar insatisfação.</p></aside>
        <footer><button type="button" data-classic-modal-close>Cancelar</button><button type="submit" class="primary">Enviar proposta</button></footer>
      </form>
    </section>
  `);
}

function openDecisionModal(action, playerId) {
  const profile = document.querySelector(".career-player-profile");
  const name = profile?.querySelector("h2")?.textContent?.trim() || "Jogador";
  const release = action === "release";
  const title = release ? "Rescindir contrato" : "Colocar na lista de transferências";
  const description = release
    ? `O vínculo de ${name} será encerrado e ele deixará o elenco imediatamente. Essa ação não pode ser desfeita.`
    : `${name} ficará disponível para receber propostas de outros clubes. Você poderá retirá-lo da lista posteriormente.`;

  modalShell(`
    <section class="classic-contract-modal classic-decision-modal" role="dialog" aria-modal="true">
      <header><div><span>${release ? "DECISÃO IRREVERSÍVEL" : "STATUS DE TRANSFERÊNCIA"}</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(name)}</p></div><button type="button" data-classic-modal-close>×</button></header>
      <div class="classic-decision-copy"><p>${escapeHtml(description)}</p></div>
      <footer><button type="button" data-classic-modal-close>Cancelar</button><button type="button" class="${release ? "danger" : "primary"}" data-classic-confirm-action="${action}" data-player-id="${escapeHtml(playerId)}">${release ? "Rescindir vínculo" : "Confirmar listagem"}</button></footer>
    </section>
  `);
}

function saveContract(form) {
  const data = new FormData(form);
  const id = form.dataset.playerId;
  const save = readSave();
  save.contractNegotiations = save.contractNegotiations || {};
  save.playerStatus = save.playerStatus || {};
  save.contractNegotiations[id] = {
    years: Number(data.get("years")),
    salary: Number(data.get("salary")),
    role: String(data.get("role")),
    bonus: Number(data.get("bonus")),
    renewedAt: new Date().toISOString()
  };
  save.playerStatus[id] = `Contrato renovado · ${data.get("years")} anos`;
  writeSave(save);
  closeModal();
  rerenderCareer();
}

function confirmDecision(action, playerId) {
  const save = readSave();
  save.playerStatus = save.playerStatus || {};
  if (action === "list") {
    save.playerStatus[playerId] = "Lista de transferências";
  } else {
    save.releasedPlayers = [...new Set([...(save.releasedPlayers || []), playerId])];
    save.playerStatus[playerId] = "Contrato rescindido";
    const remaining = [...document.querySelectorAll(".career-squad-row")].find(row => row.dataset.squadPlayer !== playerId);
    if (remaining) save.selectedSquadId = remaining.dataset.squadPlayer;
  }
  writeSave(save);
  closeModal();
  rerenderCareer();
}

document.addEventListener("click", event => {
  const action = event.target.closest("[data-classic-player-action]");
  if (action) {
    event.preventDefault();
    event.stopImmediatePropagation();
    const type = action.dataset.classicPlayerAction;
    const id = action.dataset.playerId;
    if (type === "renew") openRenewalModal(id);
    else openDecisionModal(type, id);
    return;
  }

  if (event.target.closest("[data-classic-modal-close]")) {
    event.preventDefault();
    closeModal();
    return;
  }

  const confirmation = event.target.closest("[data-classic-confirm-action]");
  if (confirmation) {
    confirmDecision(confirmation.dataset.classicConfirmAction, confirmation.dataset.playerId);
  }
}, true);

document.addEventListener("submit", event => {
  const form = event.target.closest("[data-classic-renew-form]");
  if (!form) return;
  event.preventDefault();
  saveContract(form);
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeModal();
});

function queueRebuild() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    rebuildSquadModule();
  });
}

const observer = new MutationObserver(queueRebuild);
observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener("hashchange", queueRebuild);
document.addEventListener("DOMContentLoaded", queueRebuild, { once: true });
queueRebuild();

import "./career-mode.css";
import {
  CAREER_PLAYERS,
  USER_SQUAD,
  TRANSFER_MARKET,
  CAREER_META,
  FORMATIONS,
  DEFAULT_XI,
  SCOUTS,
  CAREER_MAIL,
  formatMoney,
  playerInitials
} from "./career-mode-data.js";
import { getPlayerFace } from "./player-face-service.js";

const ROUTES = new Set(["inbox","squad","tactics","training","recruitment","transfers","calendar","finances","academy"]);
const STORAGE_KEY = "touchline.career.mode.v1";
const app = document.querySelector("#app");

const defaultState = {
  selectedSquadId: USER_SQUAD[0]?.id || null,
  selectedMarketId: TRANSFER_MARKET[0]?.id || null,
  squadTab: "first-team",
  transferTab: "market",
  shortlist: [],
  offers: [],
  transferBudget: CAREER_META.transferBudget,
  wageBudget: CAREER_META.wageBudget,
  formation: "4-2-3-1",
  xi: [...DEFAULT_XI],
  tactics: { pressing: 64, width: 58, line: 62, tempo: 66, mentality: "Equilibrada" },
  mailRead: [],
  mailDeleted: [],
  selectedMail: CAREER_MAIL[0]?.id || null,
  training: { Seg: "Recuperação", Ter: "Tática", Qua: "Intenso", Qui: "Bolas paradas", Sex: "Leve", Sáb: "Jogo", Dom: "Folga" },
  recruitmentFocuses: [
    { id:"f1",name:"Zagueiro dominante",position:"CB",age:"18–25",region:"Europa",priority:"Alta",scout:"s2",progress:68,matches:8 },
    { id:"f2",name:"Ponta de 1 contra 1",position:"RW",age:"18–23",region:"América do Sul",priority:"Normal",scout:"s3",progress:34,matches:4 }
  ],
  academy: [
    { id:"y1",name:"Elliot Hughes",position:"CM",age:17,rating:64,potential:"82–90",plan:"Meia completo",status:"academy" },
    { id:"y2",name:"Mateo Silva",position:"RW",age:16,rating:62,potential:"84–92",plan:"Ponta invertido",status:"academy" },
    { id:"y3",name:"Noah Okafor Jr.",position:"CB",age:17,rating:65,potential:"80–88",plan:"Zagueiro construtor",status:"academy" }
  ],
  playerStatus: {},
  calendarOffset: 0
};

let state = loadState();
let marketFilters = { search:"", position:"ALL", maxAge:40, minRating:0, maxValue:250000000, club:"ALL", sort:"rating" };
let offerDraft = null;
let toastTimer = null;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return {
      ...structuredClone(defaultState),
      ...saved,
      tactics: { ...defaultState.tactics, ...(saved.tactics || {}) },
      training: { ...defaultState.training, ...(saved.training || {}) }
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function route() {
  return window.location.hash.replace(/^#/, "").split("?")[0];
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function icon(name, size = 18) {
  const paths = {
    back:'<path d="m15 18-6-6 6-6"/>',
    arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
    search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    filter:'<path d="M4 5h16M7 12h10M10 19h4"/>',
    star:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
    mail:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>',
    users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>',
    tactics:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="3"/>',
    repeat:'<path d="m17 1 4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="m7 23-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    trash:'<path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    wallet:'<path d="M20 7V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h16v10a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V6"/><path d="M16 13h5"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    close:'<path d="M6 6l12 12M18 6 6 18"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    scout:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4M11 8v6M8 11h6"/>',
    academy:'<path d="m2 9 10-5 10 5-10 5L2 9Z"/><path d="M6 11v5c3 3 9 3 12 0v-5"/>',
    training:'<path d="M3 12h4l2-7 4 14 2-7h6"/>',
    chevron:'<path d="m9 18 6-6-6-6"/>',
    swap:'<path d="m7 7 3-3 3 3M10 4v11M17 17l-3 3-3-3M14 20V9"/>'
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.arrow}</svg>`;
}

function face(entity, className = "") {
  const resolved = getPlayerFace(entity.name, entity.teamName || "Manchester United");
  const photo = entity.photo || resolved?.photo || null;
  return `<span class="career-face ${className} ${photo ? "has-photo" : ""}">${photo ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(entity.name)}" referrerpolicy="no-referrer" />` : `<b>${playerInitials(entity.name)}</b>`}${entity.number ? `<small>${entity.number}</small>` : ""}</span>`;
}

function ratingTone(rating) {
  if (rating >= 88) return "elite";
  if (rating >= 84) return "great";
  if (rating >= 80) return "good";
  if (rating >= 75) return "solid";
  return "develop";
}

function moduleHeader(title, kicker, description, actions = "") {
  return `<header class="career-module-header"><div><span>${escapeHtml(kicker)}</span><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p></div><div class="career-header-actions">${actions}</div></header>`;
}

function budgetStrip() {
  return `<div class="career-budget-strip"><span><small>Orçamento de transferências</small><strong>${formatMoney(state.transferBudget, true)}</strong></span><i></i><span><small>Folha semanal disponível</small><strong>${formatMoney(state.wageBudget, true)}</strong></span><i></i><span><small>Base de dados</small><strong>${CAREER_META.liveCatalog ? "Premier League sincronizada" : "Save de demonstração"}</strong></span></div>`;
}

function moduleShell(header, body, className = "") {
  return `<section class="career-module ${className}">${header}${body}<div class="career-toast" data-career-toast role="status"></div></section>`;
}

function setActiveNav(current) {
  document.querySelectorAll("[data-nav]").forEach(button => button.classList.toggle("active", button.dataset.nav === current));
}

function showToast(message) {
  const toast = document.querySelector("[data-career-toast]");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2600);
}

function renderCurrentRoute() {
  const current = route();
  if (!ROUTES.has(current)) return;
  const main = document.querySelector(".v2-main");
  if (!main) {
    setTimeout(renderCurrentRoute, 30);
    return;
  }

  document.documentElement.classList.add("career-module-mode");
  main.className = "v2-main career-module-host";
  setActiveNav(current);

  const renderers = {
    inbox: renderInbox,
    squad: renderSquad,
    tactics: renderTactics,
    training: renderTraining,
    recruitment: renderRecruitment,
    transfers: renderTransfers,
    calendar: renderCalendar,
    finances: renderFinances,
    academy: renderAcademy
  };

  main.innerHTML = renderers[current]();
  document.title = `Touchline — ${routeTitle(current)}`;
  bindModuleEvents(main, current);
}

function routeTitle(value) {
  return ({ inbox:"Caixa de entrada",squad:"Elenco",tactics:"Táticas",training:"Treino",recruitment:"Recrutamento",transfers:"Transferências",calendar:"Calendário",finances:"Finanças",academy:"Academia" })[value] || "Carreira";
}

function squadPlayer() {
  return USER_SQUAD.find(player => player.id === state.selectedSquadId) || USER_SQUAD[0];
}

function squadRows(players) {
  return players.map(player => {
    const status = state.playerStatus[player.id] || "Disponível";
    const fitness = 72 + (Number(player.id) % 27);
    const morale = ["Muito feliz","Feliz","Contente","Motivado"][Number(player.id) % 4];
    return `<button class="career-squad-row ${player.id === state.selectedSquadId ? "selected" : ""}" data-squad-player="${player.id}" type="button">
      <span class="career-squad-name">${face(player,"small")}<span><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(status)}</small></span></span>
      <b>${player.position}</b><span class="career-rating ${ratingTone(player.rating)}">${player.rating}</span><span>${player.age}</span>
      <span class="career-meter"><i style="--value:${fitness}%"></i><small>${fitness}%</small></span><span>${morale}</span><span>${formatMoney(player.wage,true)}</span>
    </button>`;
  }).join("");
}

function renderSquad() {
  const selected = squadPlayer();
  const tabs = `<nav class="career-tabs"><button class="${state.squadTab === "first-team" ? "active" : ""}" data-squad-tab="first-team">Primeiro time</button><button class="${state.squadTab === "contracts" ? "active" : ""}" data-squad-tab="contracts">Contratos</button><button class="${state.squadTab === "development" ? "active" : ""}" data-squad-tab="development">Desenvolvimento</button></nav>`;
  const rows = [...USER_SQUAD].sort((a,b) => b.rating - a.rating);
  const actions = `<button class="career-button ghost" data-route="tactics">${icon("tactics")} Editar XI</button><button class="career-button primary" data-auto-select>${icon("check")} Seleção automática</button>`;
  const body = `${budgetStrip()}${tabs}<div class="career-squad-layout"><section class="career-panel career-squad-table"><div class="career-table-head"><span>Jogador</span><span>Pos</span><span>OVR</span><span>Idade</span><span>Condição</span><span>Moral</span><span>Salário</span></div><div class="career-squad-scroll">${squadRows(rows)}</div></section>${renderSquadProfile(selected)}</div>`;
  return moduleShell(moduleHeader("Elenco","GESTÃO ESPORTIVA","Controle funções, contratos, condição e desenvolvimento de cada atleta.",actions),body,"career-squad-module");
}

function renderSquadProfile(player) {
  const status = state.playerStatus[player.id] || "Disponível";
  return `<aside class="career-panel career-player-profile">${face(player,"hero")}<div class="career-profile-title"><div><span>${player.position} · ${player.nationality}</span><h2>${escapeHtml(player.name)}</h2><small>${escapeHtml(status)}</small></div><b class="career-rating ${ratingTone(player.rating)}">${player.rating}<small>OVR</small></b></div><div class="career-stat-pairs"><span><small>Potencial</small><strong>${player.potential}</strong></span><span><small>Valor estimado</small><strong>${formatMoney(player.value,true)}</strong></span><span><small>Salário</small><strong>${formatMoney(player.wage,true)}/sem</strong></span><span><small>Contrato</small><strong>${2 + Number(player.id)%4} anos</strong></span></div><div class="career-profile-form"><span>Forma recente</span><div><i class="w">7.8</i><i class="w">8.1</i><i class="d">7.2</i><i class="w">8.0</i><i class="w">7.6</i></div></div><div class="career-profile-actions"><button data-player-action="xi" data-player-id="${player.id}">${icon("tactics")} Adicionar ao XI</button><button data-player-action="renew" data-player-id="${player.id}">${icon("repeat")} Renovar contrato</button><button class="danger" data-player-action="list" data-player-id="${player.id}">${icon("arrow")} Colocar à venda</button></div></aside>`;
}

function renderTactics() {
  const shape = FORMATIONS[state.formation] || FORMATIONS["4-2-3-1"];
  const xiPlayers = state.xi.map(name => USER_SQUAD.find(player => player.name === name)).filter(Boolean);
  const bench = USER_SQUAD.filter(player => !state.xi.includes(player.name)).sort((a,b) => b.rating - a.rating);
  const pitch = shape.map(([role,x,y],index) => {
    const player = xiPlayers[index] || bench[0];
    return `<div class="career-tactic-slot" style="--x:${x}%;--y:${y}%" data-tactic-slot="${index}" data-role="${role}"><small>${role}</small>${player ? `<button draggable="true" data-drag-player="${player.id}" type="button">${face(player,"pitch")}<span>${escapeHtml(player.name.split(" ").at(-1))}</span><b>${player.rating}</b></button>` : `<span class="empty-slot">+</span>`}</div>`;
  }).join("");
  const body = `<div class="career-tactics-toolbar"><label>Formação<select data-formation>${Object.keys(FORMATIONS).map(name => `<option ${name === state.formation ? "selected" : ""}>${name}</option>`).join("")}</select></label><div class="career-mentality">${["Defensiva","Equilibrada","Ofensiva"].map(item => `<button class="${state.tactics.mentality === item ? "active" : ""}" data-mentality="${item}">${item}</button>`).join("")}</div><button class="career-button ghost" data-tactic-auto>${icon("users")} Melhor XI</button><button class="career-button primary" data-tactic-save>${icon("check")} Salvar plano</button></div><div class="career-tactics-layout"><section class="career-pitch-panel"><div class="career-pitch">${pitch}</div></section><aside class="career-panel career-tactic-controls"><header><span>INSTRUÇÕES DA EQUIPE</span><h2>Modelo de jogo</h2></header>${tacticSlider("Pressão após perda","pressing",state.tactics.pressing,"Bloco passivo","Pressão total")}${tacticSlider("Largura com bola","width",state.tactics.width,"Estreito","Muito amplo")}${tacticSlider("Altura da linha","line",state.tactics.line,"Baixa","Alta")}${tacticSlider("Ritmo de ataque","tempo",state.tactics.tempo,"Paciente","Vertical")}<div class="career-bench"><span>BANCO E RESERVAS</span><div>${bench.map(player => `<button draggable="true" data-drag-player="${player.id}" type="button">${face(player,"tiny")}<span><strong>${escapeHtml(player.name)}</strong><small>${player.position}</small></span><b>${player.rating}</b></button>`).join("")}</div></div></aside></div>`;
  return moduleShell(moduleHeader("Táticas","IDENTIDADE DE JOGO","Arraste jogadores, ajuste a estrutura e salve um plano que será usado no Matchday.",`<button class="career-button ghost" data-route="squad">${icon("users")} Ver elenco</button>`),body,"career-tactics-module");
}

function tacticSlider(label,key,value,min,max) {
  return `<label class="career-tactic-slider"><span><strong>${label}</strong><b>${value}</b></span><input type="range" min="0" max="100" value="${value}" data-tactic-slider="${key}"/><small><i>${min}</i><i>${max}</i></small></label>`;
}

function visibleMarketPlayers() {
  const query = marketFilters.search.trim().toLowerCase();
  let players = TRANSFER_MARKET.filter(player => {
    if (query && !`${player.name} ${player.teamName} ${player.position}`.toLowerCase().includes(query)) return false;
    if (marketFilters.position !== "ALL" && player.position !== marketFilters.position) return false;
    if (player.age > marketFilters.maxAge) return false;
    if (player.rating < marketFilters.minRating) return false;
    if (player.value > marketFilters.maxValue) return false;
    if (marketFilters.club !== "ALL" && player.teamCode !== marketFilters.club) return false;
    return true;
  });
  if (state.transferTab === "shortlist") players = players.filter(player => state.shortlist.includes(player.id));
  const sorters = {
    rating:(a,b)=>b.rating-a.rating,
    value:(a,b)=>b.value-a.value,
    age:(a,b)=>a.age-b.age,
    name:(a,b)=>a.name.localeCompare(b.name)
  };
  return players.sort(sorters[marketFilters.sort] || sorters.rating);
}

function selectedMarketPlayer(players = TRANSFER_MARKET) {
  return players.find(player => player.id === state.selectedMarketId) || players[0] || TRANSFER_MARKET[0];
}

function renderTransfers() {
  const players = visibleMarketPlayers();
  const selected = selectedMarketPlayer(players.length ? players : TRANSFER_MARKET);
  if (selected && !players.some(player => player.id === state.selectedMarketId) && state.transferTab !== "offers") state.selectedMarketId = selected.id;
  const tabs = `<nav class="career-transfer-tabs"><button class="${state.transferTab === "market" ? "active" : ""}" data-transfer-tab="market">Mercado <span>${TRANSFER_MARKET.length}</span></button><button class="${state.transferTab === "shortlist" ? "active" : ""}" data-transfer-tab="shortlist">Lista de escolhidos <span>${state.shortlist.length}</span></button><button class="${state.transferTab === "offers" ? "active" : ""}" data-transfer-tab="offers">Negociações <span>${state.offers.length}</span></button></nav>`;
  const body = `${budgetStrip()}${tabs}${state.transferTab === "offers" ? renderOffers() : `<div class="career-transfer-layout">${renderTransferFilters()}${renderTransferResults(players)}${renderTransferProfile(selected)}</div>`}`;
  return moduleShell(moduleHeader("Central de transferências","MERCADO GLOBAL","Pesquise, observe, salve alvos e conduza propostas completas sem sair da mesma tela.",`<button class="career-button ghost" data-route="recruitment">${icon("scout")} Rede de olheiros</button>`),body,"career-transfer-module");
}

function renderTransferFilters() {
  const clubs = [...new Map(TRANSFER_MARKET.map(player => [player.teamCode,player.teamName])).entries()].sort((a,b)=>a[1].localeCompare(b[1]));
  return `<aside class="career-transfer-filters"><header><span>PESQUISA ATUAL</span><h2>Buscar jogadores</h2></header><label class="career-search-field">${icon("search")}<input data-market-search value="${escapeHtml(marketFilters.search)}" placeholder="Nome, clube ou posição" /></label><label>Posição<select data-market-filter="position"><option value="ALL">Todas</option>${["GK","RB","CB","LB","CDM","CM","CAM","RW","LW","CF","ST"].map(pos=>`<option ${marketFilters.position===pos?"selected":""}>${pos}</option>`).join("")}</select></label><label>Clube<select data-market-filter="club"><option value="ALL">Todos os clubes</option>${clubs.map(([code,name])=>`<option value="${code}" ${marketFilters.club===code?"selected":""}>${escapeHtml(name)}</option>`).join("")}</select></label><label>Idade máxima<span class="career-filter-value" data-filter-output="maxAge">${marketFilters.maxAge}</span><input type="range" min="18" max="40" value="${marketFilters.maxAge}" data-market-range="maxAge"/></label><label>OVR mínimo<span class="career-filter-value" data-filter-output="minRating">${marketFilters.minRating}</span><input type="range" min="0" max="92" value="${marketFilters.minRating}" data-market-range="minRating"/></label><label>Valor máximo<span class="career-filter-value" data-filter-output="maxValue">${formatMoney(marketFilters.maxValue,true)}</span><input type="range" min="10000000" max="250000000" step="5000000" value="${marketFilters.maxValue}" data-market-range="maxValue"/></label><label>Ordenar<select data-market-filter="sort"><option value="rating" ${marketFilters.sort==="rating"?"selected":""}>Maior OVR</option><option value="value" ${marketFilters.sort==="value"?"selected":""}>Maior valor</option><option value="age" ${marketFilters.sort==="age"?"selected":""}>Mais jovens</option><option value="name" ${marketFilters.sort==="name"?"selected":""}>Nome</option></select></label><button class="career-filter-reset" data-market-reset>${icon("repeat")} Limpar busca</button></aside>`;
}

function renderTransferResults(players) {
  return `<section class="career-transfer-results"><header><span><b>${players.length}</b> resultados</span><small>OVR Touchline · valores estimados</small></header><div class="career-transfer-head"><span>Jogador</span><span>Pos</span><span>Idade</span><span>OVR</span><span>Valor</span></div><div class="career-transfer-scroll">${players.length ? players.map(player => `<button class="career-transfer-row ${player.id === state.selectedMarketId ? "selected" : ""}" data-market-player="${player.id}" type="button"><span>${face(player,"small")}<span><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml(player.teamName)}</small></span></span><b>${player.position}</b><i>${player.age}</i><em class="career-rating ${ratingTone(player.rating)}">${player.rating}</em><strong>${formatMoney(player.value,true)}</strong>${state.shortlist.includes(player.id)?`<u title="Na lista de escolhidos">★</u>`:""}</button>`).join("") : `<div class="career-empty"><b>Nenhum jogador encontrado</b><span>Amplie os filtros ou crie um foco de recrutamento.</span></div>`}</div></section>`;
}

function renderTransferProfile(player) {
  if (!player) return `<aside class="career-transfer-profile career-panel"></aside>`;
  const shortlisted = state.shortlist.includes(player.id);
  return `<aside class="career-transfer-profile"><div class="career-transfer-card"><div class="career-transfer-brand"><span>${escapeHtml(player.teamCode)}</span><small>${escapeHtml(player.teamName)}</small></div>${face(player,"transfer")}<div class="career-transfer-name"><span>${player.position} · ${player.age} anos</span><h2>${escapeHtml(player.name)}</h2><small>${player.nationality}</small></div><b class="career-big-rating ${ratingTone(player.rating)}">${player.rating}<small>OVR</small></b></div><div class="career-transfer-details"><span><small>Valor estimado</small><strong>${formatMoney(player.value)}</strong></span><span><small>Salário provável</small><strong>${formatMoney(player.wage)}/sem</strong></span><span><small>Potencial</small><strong>${player.potential}</strong></span><span><small>Contrato restante</small><strong>${1 + Number(player.id)%5} anos</strong></span></div><div class="career-scout-verdict"><span>RELATÓRIO DO OLHEIRO</span><strong>${player.rating >= 86 ? "Elevaria imediatamente o nível do XI" : player.potential >= 88 ? "Alto teto de desenvolvimento" : "Boa opção para aumentar a profundidade"}</strong><p>Compatibilidade de ${78 + Number(player.id)%20}% com o modelo ${state.formation}. Estimativa sujeita à negociação com o clube.</p></div><div class="career-transfer-actions"><button class="${shortlisted?"active":""}" data-shortlist="${player.id}">${icon("star")} ${shortlisted?"Remover da lista":"Salvar na lista"}</button><button class="primary" data-open-offer="${player.id}">${icon("repeat")} Fazer proposta</button></div></aside>`;
}

function renderOffers() {
  if (!state.offers.length) return `<div class="career-offers-empty">${icon("repeat",34)}<h2>Nenhuma negociação ativa</h2><p>Abra um jogador no mercado e envie a primeira proposta.</p><button class="career-button primary" data-transfer-tab="market">Ir ao mercado</button></div>`;
  return `<div class="career-offers-grid">${state.offers.slice().reverse().map(offer => { const player=CAREER_PLAYERS.find(item=>item.id===offer.playerId); return `<article class="career-offer-card"><header>${player?face(player,"small"):""}<div><span>${escapeHtml(player?.teamName||"Clube")}</span><h3>${escapeHtml(player?.name||"Jogador")}</h3></div><b class="${offer.status.toLowerCase()}">${escapeHtml(offer.status)}</b></header><div><span><small>Oferta</small><strong>${formatMoney(offer.fee)}</strong></span><span><small>Salário</small><strong>${formatMoney(offer.wage)}/sem</strong></span><span><small>Contrato</small><strong>${offer.years} anos</strong></span><span><small>Enviada</small><strong>${offer.date}</strong></span></div><p>${escapeHtml(offer.message)}</p>${offer.status==="Contraproposta"?`<button data-accept-counter="${offer.id}" class="career-button primary">Aceitar ${formatMoney(offer.counter,true)}</button>`:""}</article>`; }).join("")}</div>`;
}

function openOffer(player) {
  offerDraft = { playerId:player.id, fee:Math.round(player.value*0.92/500000)*500000, wage:Math.round(player.wage*1.15/5000)*5000, years:4, bonus:2000000, swap:"" };
  const modal = document.createElement("div");
  modal.className = "career-modal-layer visible";
  modal.dataset.offerModal = "";
  modal.innerHTML = `<button class="career-modal-scrim" data-close-career-modal aria-label="Fechar"></button><form class="career-offer-modal" data-offer-form><header><div><span>PROPOSTA DE TRANSFERÊNCIA</span><h2>Negociar por ${escapeHtml(player.name)}</h2></div><button type="button" data-close-career-modal>${icon("close")}</button></header><div class="career-offer-player">${face(player,"hero")}<div><span>${player.position} · ${player.age} anos · ${player.teamName}</span><strong>${player.rating} OVR</strong><small>Valor estimado ${formatMoney(player.value)}</small></div></div><div class="career-offer-fields"><label>Taxa de transferência<input name="fee" type="number" min="0" step="500000" value="${offerDraft.fee}"/><small>Orçamento disponível: ${formatMoney(state.transferBudget)}</small></label><label>Jogador incluído<select name="swap"><option value="">Nenhum</option>${USER_SQUAD.map(item=>`<option value="${item.id}">${escapeHtml(item.name)} · ${formatMoney(item.value,true)}</option>`).join("")}</select></label><label>Salário semanal<input name="wage" type="number" min="10000" step="5000" value="${offerDraft.wage}"/></label><label>Duração<select name="years">${[1,2,3,4,5].map(year=>`<option ${year===4?"selected":""} value="${year}">${year} anos</option>`).join("")}</select></label><label>Bônus de assinatura<input name="bonus" type="number" min="0" step="250000" value="${offerDraft.bonus}"/></label><label>Cláusula de venda futura<select name="sellOn"><option value="0">Sem cláusula</option><option value="5">5%</option><option value="10">10%</option><option value="15">15%</option></select></label></div><footer><button type="button" data-close-career-modal>Cancelar</button><button class="primary" type="submit">Enviar proposta ${icon("arrow")}</button></footer></form>`;
  document.body.append(modal);
}

function renderInbox() {
  const visible = CAREER_MAIL.filter(mail => !state.mailDeleted.includes(mail.id));
  if (!visible.some(mail => mail.id === state.selectedMail)) state.selectedMail = visible[0]?.id || null;
  const selected = visible.find(mail => mail.id === state.selectedMail);
  const unread = visible.filter(mail => !state.mailRead.includes(mail.id)).length;
  const list = visible.map(mail => { const person=getPlayerFace(mail.sender,"Manchester United"); const entity={name:mail.sender,photo:person?.photo}; return `<button class="career-inbox-item ${mail.id===state.selectedMail?"selected":""} ${state.mailRead.includes(mail.id)?"read":"unread"}" data-mail-select="${mail.id}" type="button">${face(entity,"small")}<span><span><strong>${escapeHtml(mail.sender)}</strong><time>${mail.time}</time></span><b>${escapeHtml(mail.subject)}</b><small>${escapeHtml(mail.preview)}</small><i>${escapeHtml(mail.category)}</i></span></button>`; }).join("");
  const body = `<div class="career-full-inbox"><aside class="career-inbox-sidebar"><header><div><span>${icon("mail")}</span><div><h2>Principal</h2><small>${unread} não lidas · ${visible.length} mensagens</small></div></div><button data-mail-read-all title="Marcar todas como lidas">${icon("check")}</button></header><label class="career-search-field">${icon("search")}<input placeholder="Pesquisar mensagens" data-mail-search /></label><div class="career-inbox-list">${list || `<div class="career-empty"><b>Caixa organizada</b><span>Nenhuma mensagem pendente.</span></div>`}</div></aside>${selected?renderMailReader(selected):`<section class="career-mail-reader empty"><h2>Selecione uma mensagem</h2></section>`}</div>`;
  return moduleShell(moduleHeader("Caixa de entrada","COMUNICAÇÕES DO CLUBE","Jogadores, comissão, olheiros e diretoria transformam informação em decisões.",`<button class="career-button ghost" data-mail-read-all>${icon("check")} Marcar tudo</button>`),body,"career-inbox-module");
}

function renderMailReader(mail) {
  const person = getPlayerFace(mail.sender,"Manchester United");
  const entity = {name:mail.sender,photo:person?.photo};
  return `<section class="career-mail-reader"><header><div>${face(entity,"medium")}<span><small>DE</small><strong>${escapeHtml(mail.sender)}</strong><i>${escapeHtml(mail.role)}</i></span></div><div><time>${mail.time}</time><button data-mail-delete="${mail.id}" title="Excluir">${icon("trash")}</button></div></header><main><div class="career-mail-label"><span>${escapeHtml(mail.category)}</span><small>Para Gabriel Machado</small></div><h2>${escapeHtml(mail.subject)}</h2><div class="career-mail-copy">${mail.body.map((paragraph,index)=>index===0?`<strong>${escapeHtml(paragraph)}</strong>`:`<p>${escapeHtml(paragraph)}</p>`).join("")}</div></main><footer><button data-mail-delete="${mail.id}">${icon("trash")} Excluir</button><button class="primary" data-mail-action="${mail.id}">${escapeHtml(mail.action)} ${icon("arrow")}</button></footer></section>`;
}

function renderTraining() {
  const intensity = { "Recuperação":20,"Tática":48,"Intenso":88,"Bolas paradas":52,"Leve":35,"Jogo":100,"Folga":0 };
  const days = Object.entries(state.training).map(([day,session])=>`<article class="career-training-day ${session === "Jogo" ? "match" : ""}"><header><span>${day}</span><b>${intensity[session]}%</b></header><div><i style="--load:${intensity[session]}%"></i></div><select data-training-day="${day}">${Object.keys(intensity).map(option=>`<option ${option===session?"selected":""}>${option}</option>`).join("")}</select><small>${session === "Intenso" ? "Aumenta nitidez, eleva fadiga" : session === "Recuperação" ? "Reduz fadiga e risco" : session === "Jogo" ? "Chelsea · Stamford Bridge" : "Sessão de preparação"}</small></article>`).join("");
  const body = `<div class="career-training-summary"><span><small>Carga semanal</small><strong>${Math.round(Object.values(state.training).reduce((sum,item)=>sum+intensity[item],0)/7)}%</strong></span><span><small>Risco de lesão</small><strong class="good">Baixo</strong></span><span><small>Nitidez média</small><strong>82</strong></span><button class="career-button primary" data-training-save>${icon("check")} Confirmar semana</button></div><div class="career-training-grid">${days}</div><div class="career-training-lower"><section class="career-panel"><header><span>GRUPOS DE DESENVOLVIMENTO</span><h2>Foco individual</h2></header>${USER_SQUAD.slice(0,6).map(player=>`<div class="career-development-row">${face(player,"tiny")}<span><strong>${escapeHtml(player.name)}</strong><small>${player.position} · Potencial ${player.potential}</small></span><select><option>Equilibrado</option><option>Força</option><option>Criação</option><option>Finalização</option></select></div>`).join("")}</section><section class="career-panel career-load-chart"><header><span>PERFORMANCE</span><h2>Carga dos últimos 7 dias</h2></header><div>${[42,66,81,49,34,92,18].map((value,index)=>`<i style="--height:${value}%"><b>${value}</b><small>${["S","T","Q","Q","S","S","D"][index]}</small></i>`).join("")}</div></section></div>`;
  return moduleShell(moduleHeader("Centro de treino","PERFORMANCE","Planeje carga, recuperação, nitidez e desenvolvimento sem microgerenciamento desnecessário.",`<button class="career-button ghost" data-route="squad">${icon("users")} Condição do elenco</button>`),body,"career-training-module");
}

function renderRecruitment() {
  const recommendations = TRANSFER_MARKET.filter(player=>player.age<=25 && player.potential>=87).sort((a,b)=>b.potential-a.potential).slice(0,6);
  const body = `<div class="career-recruitment-overview"><section><span><small>Olheiros ativos</small><strong>${state.recruitmentFocuses.length}/${SCOUTS.length}</strong></span><span><small>Jogadores acompanhados</small><strong>${state.recruitmentFocuses.reduce((sum,item)=>sum+item.matches,0)}</strong></span><span><small>Cobertura</small><strong>42 países</strong></span></section><button class="career-button primary" data-new-focus>${icon("plus")} Novo foco</button><button class="career-button ghost" data-scout-week>${icon("calendar")} Avançar relatório</button></div><div class="career-recruitment-layout"><section class="career-panel career-focus-list"><header><div><span>FOCOS DE RECRUTAMENTO</span><h2>Necessidades do elenco</h2></div></header>${state.recruitmentFocuses.map(focus=>{const scout=SCOUTS.find(item=>item.id===focus.scout);return`<article class="career-focus-card"><header><div><span class="${focus.priority.toLowerCase()}">${focus.priority}</span><h3>${escapeHtml(focus.name)}</h3><small>${focus.position} · ${focus.age} · ${focus.region}</small></div><b>${focus.progress}%</b></header><div><i style="--progress:${focus.progress}%"></i></div><footer><span>${icon("scout")} ${escapeHtml(scout?.name||"Sem olheiro")}</span><small>${focus.matches} correspondências</small><button data-delete-focus="${focus.id}">${icon("trash")}</button></footer></article>`}).join("")}</section><section class="career-panel career-recommendations"><header><div><span>RECOMENDADOS</span><h2>Melhores correspondências</h2></div><button data-route="transfers">Abrir mercado ${icon("arrow")}</button></header>${recommendations.map(player=>`<button data-recruit-player="${player.id}">${face(player,"small")}<span><strong>${escapeHtml(player.name)}</strong><small>${player.teamName} · ${player.position} · ${player.age} anos</small></span><b>${player.rating}<small>OVR</small></b><em>${player.potential}<small>POT</small></em></button>`).join("")}</section><aside class="career-panel career-scout-team"><header><span>DEPARTAMENTO</span><h2>Equipe de olheiros</h2></header>${SCOUTS.map(scout=>`<div><span class="career-staff-avatar">${playerInitials(scout.name)}</span><span><strong>${escapeHtml(scout.name)}</strong><small>${scout.region}</small></span><b>${"★".repeat(scout.judgement)}${"☆".repeat(5-scout.judgement)}</b><i class="${scout.status}">${scout.status==="active"?"Em missão":"Disponível"}</i></div>`).join("")}</aside></div>`;
  return moduleShell(moduleHeader("Recrutamento","GLOBAL TRANSFER NETWORK","Defina necessidades, atribua olheiros e transforme relatórios em uma shortlist acionável.",`<button class="career-button ghost" data-route="transfers">${icon("repeat")} Transferências</button>`),body,"career-recruitment-module");
}

function renderCalendar() {
  const fixtures = [
    ["31 OUT","Chelsea","Fora","Premier League","15:00","upcoming"],
    ["04 NOV","Real Sociedad","Casa","Europa League","20:00","upcoming"],
    ["08 NOV","Tottenham","Casa","Premier League","17:30","upcoming"],
    ["21 NOV","Everton","Fora","Premier League","15:00","upcoming"],
    ["25 NOV","Feyenoord","Fora","Europa League","20:00","upcoming"],
    ["29 NOV","West Ham","Casa","Premier League","16:30","upcoming"]
  ];
  const names=["Arsenal","Chelsea","Real Sociedad","Tottenham","Everton","Feyenoord","West Ham"];
  const month=state.calendarOffset===0?"NOVEMBRO 2026":state.calendarOffset===1?"DEZEMBRO 2026":"OUTUBRO 2026";
  const cells=Array.from({length:35},(_,i)=>{const day=i-1;const event=day===4?"UEL":day===8?"TOT":day===21?"EVE":day===25?"UEL":day===29?"WHU":"";return`<div class="${day<1||day>30?"muted":""} ${event?"has-event":""}"><span>${day>=1&&day<=30?day:""}</span>${event?`<b>${event}</b>`:""}</div>`}).join("");
  const body=`<div class="career-calendar-layout"><section class="career-panel career-month"><header><button data-calendar-shift="-1">${icon("back")}</button><div><span>CALENDÁRIO DO CLUBE</span><h2>${month}</h2></div><button data-calendar-shift="1">${icon("arrow")}</button></header><div class="career-weekdays">${["SEG","TER","QUA","QUI","SEX","SÁB","DOM"].map(item=>`<b>${item}</b>`).join("")}</div><div class="career-month-grid">${cells}</div></section><aside class="career-panel career-fixture-list"><header><span>PRÓXIMOS COMPROMISSOS</span><h2>Agenda</h2></header>${fixtures.map((item,index)=>`<article><time>${item[0]}</time><div><span>${item[3]} · ${item[2]}</span><strong>${item[1]}</strong><small>${item[4]}</small></div><b>${index===0?"PRÓXIMO":""}</b></article>`).join("")}</aside></div>`;
  return moduleShell(moduleHeader("Calendário","TEMPORADA 2026/27","Partidas, viagens, treinos e janelas importantes em uma visão única.",`<button class="career-button primary" data-open-matchday>${icon("arrow")} Próximo jogo</button>`),body,"career-calendar-module");
}

function renderFinances() {
  const wages=USER_SQUAD.reduce((sum,player)=>sum+player.wage,0);
  const max=CAREER_META.wageBudget;
  const body=`<div class="career-finance-cards"><article><span>Orçamento disponível</span><strong>${formatMoney(state.transferBudget)}</strong><small>Transferências</small></article><article><span>Folha salarial</span><strong>${formatMoney(wages)}/sem</strong><small>${Math.round(wages/max*100)}% do limite</small></article><article><span>Resultado projetado</span><strong class="positive">+€38.6M</strong><small>Fim da temporada</small></article><article><span>Fair Play Financeiro</span><strong class="positive">Seguro</strong><small>Margem de €72M</small></article></div><div class="career-finance-layout"><section class="career-panel career-budget-allocation"><header><span>ALOCAÇÃO DE RECURSOS</span><h2>Transferências e salários</h2></header><label><span><strong>Orçamento para contratações</strong><b>${formatMoney(state.transferBudget)}</b></span><input data-budget-slider type="range" min="50000000" max="250000000" step="5000000" value="${state.transferBudget}"/></label><div class="career-budget-bar"><i style="--used:${Math.round(wages/max*100)}%"></i></div><small>Alterações na alocação não modificam a receita total do clube.</small><button class="career-button primary" data-budget-save>${icon("check")} Confirmar orçamento</button></section><section class="career-panel career-wage-table"><header><span>MAIORES SALÁRIOS</span><h2>Folha do elenco</h2></header>${[...USER_SQUAD].sort((a,b)=>b.wage-a.wage).slice(0,8).map(player=>`<div>${face(player,"tiny")}<span><strong>${escapeHtml(player.name)}</strong><small>${player.position}</small></span><b>${formatMoney(player.wage)}/sem</b></div>`).join("")}</section><aside class="career-panel career-income"><header><span>PROJEÇÃO ANUAL</span><h2>Receitas</h2></header>${[["Direitos de transmissão",142000000],["Patrocínios",78000000],["Bilheteria",54000000],["Premiações",37000000],["Comercial",61000000]].map(([label,value])=>`<div><span>${label}</span><strong>${formatMoney(value,true)}</strong></div>`).join("")}</aside></div>`;
  return moduleShell(moduleHeader("Finanças","GESTÃO EXECUTIVA","Acompanhe orçamento, folha, receitas e margem regulatória antes de negociar.",`<button class="career-button ghost" data-route="transfers">${icon("repeat")} Abrir mercado</button>`),body,"career-finances-module");
}

function renderAcademy() {
  const body=`<div class="career-academy-hero"><div><span>ACADEMIA DO CLUBE</span><h2>O próximo jogador da equipe principal pode estar aqui.</h2><p>Desenvolva atletas com planos claros e promova apenas quando a função no elenco fizer sentido.</p></div><div><span><small>Qualidade da academia</small><strong>Excelente</strong></span><span><small>Prospectos</small><strong>${state.academy.filter(item=>item.status==="academy").length}</strong></span><span><small>Promovidos</small><strong>${state.academy.filter(item=>item.status==="promoted").length}</strong></span></div></div><div class="career-academy-grid">${state.academy.map(player=>`<article class="career-youth-card ${player.status}"><header><span class="career-youth-face">${playerInitials(player.name)}</span><div><small>${player.position} · ${player.age} anos</small><h3>${escapeHtml(player.name)}</h3><span>${player.status==="promoted"?"Equipe principal":"Sub-18"}</span></div><b>${player.rating}<small>OVR</small></b></header><div><span><small>Potencial</small><strong>${player.potential}</strong></span><span><small>Plano</small><strong>${escapeHtml(player.plan)}</strong></span></div><label>Plano de desenvolvimento<select data-youth-plan="${player.id}"><option ${player.plan==="Meia completo"?"selected":""}>Meia completo</option><option ${player.plan==="Ponta invertido"?"selected":""}>Ponta invertido</option><option ${player.plan==="Zagueiro construtor"?"selected":""}>Zagueiro construtor</option><option>Equilibrado</option></select></label><button ${player.status==="promoted"?"disabled":""} data-promote-youth="${player.id}">${player.status==="promoted"?`${icon("check")} Promovido`:`${icon("arrow")} Promover ao principal`}</button></article>`).join("")}</div>`;
  return moduleShell(moduleHeader("Academia","DESENVOLVIMENTO DE TALENTOS","Acompanhe potencial, função futura e caminho até o primeiro time.",`<button class="career-button ghost" data-route="squad">${icon("users")} Ver elenco principal</button>`),body,"career-academy-module");
}

function renderNewFocusModal() {
  const layer=document.createElement("div");layer.className="career-modal-layer visible";layer.innerHTML=`<button class="career-modal-scrim" data-close-career-modal></button><form class="career-focus-modal" data-focus-form><header><div><span>NOVO FOCO DE RECRUTAMENTO</span><h2>Definir necessidade</h2></div><button type="button" data-close-career-modal>${icon("close")}</button></header><div><label>Nome do foco<input name="name" required placeholder="Ex.: lateral para o XI"/></label><label>Posição<select name="position">${["GK","RB","CB","LB","CDM","CM","CAM","RW","LW","ST"].map(item=>`<option>${item}</option>`).join("")}</select></label><label>Faixa de idade<select name="age"><option>18–21</option><option>18–25</option><option>22–28</option><option>Qualquer</option></select></label><label>Região<select name="region"><option>Europa</option><option>América do Sul</option><option>África</option><option>Ásia</option><option>Mundo</option></select></label><label>Prioridade<select name="priority"><option>Alta</option><option>Normal</option><option>Contínua</option></select></label><label>Olheiro<select name="scout">${SCOUTS.map(item=>`<option value="${item.id}">${escapeHtml(item.name)} · ${item.region}</option>`).join("")}</select></label></div><footer><button type="button" data-close-career-modal>Cancelar</button><button class="primary" type="submit">Iniciar busca ${icon("arrow")}</button></footer></form>`;document.body.append(layer);
}

function bindModuleEvents(host,current) {
  host.addEventListener("click", event => {
    const routeButton=event.target.closest("[data-route]");if(routeButton){navigate(routeButton.dataset.route);return;}
    if(event.target.closest("[data-open-matchday]")){window.location.hash="#matchday";window.location.reload();return;}

    const squadRow=event.target.closest("[data-squad-player]");if(squadRow){state.selectedSquadId=squadRow.dataset.squadPlayer;persist();renderCurrentRoute();return;}
    const squadTab=event.target.closest("[data-squad-tab]");if(squadTab){state.squadTab=squadTab.dataset.squadTab;persist();renderCurrentRoute();return;}
    const playerAction=event.target.closest("[data-player-action]");if(playerAction){handlePlayerAction(playerAction.dataset.playerAction,playerAction.dataset.playerId);return;}
    if(event.target.closest("[data-auto-select]")){state.xi=[...USER_SQUAD].sort((a,b)=>b.rating-a.rating).slice(0,11).map(player=>player.name);persist();showToast("Melhor XI atualizado pelas notas atuais.");return;}

    const mentality=event.target.closest("[data-mentality]");if(mentality){state.tactics.mentality=mentality.dataset.mentality;persist();renderCurrentRoute();return;}
    if(event.target.closest("[data-tactic-auto]")){state.xi=[...USER_SQUAD].sort((a,b)=>b.rating-a.rating).slice(0,11).map(player=>player.name);persist();renderCurrentRoute();return;}
    if(event.target.closest("[data-tactic-save]")){persist();showToast("Plano tático salvo e conectado ao Matchday.");return;}

    const transferTab=event.target.closest("[data-transfer-tab]");if(transferTab){state.transferTab=transferTab.dataset.transferTab;persist();renderCurrentRoute();return;}
    const marketPlayer=event.target.closest("[data-market-player]");if(marketPlayer){state.selectedMarketId=marketPlayer.dataset.marketPlayer;persist();renderCurrentRoute();return;}
    const shortlist=event.target.closest("[data-shortlist]");if(shortlist){toggleShortlist(shortlist.dataset.shortlist);renderCurrentRoute();return;}
    const offer=event.target.closest("[data-open-offer]");if(offer){const player=TRANSFER_MARKET.find(item=>item.id===offer.dataset.openOffer);if(player)openOffer(player);return;}
    if(event.target.closest("[data-market-reset]")){marketFilters={search:"",position:"ALL",maxAge:40,minRating:0,maxValue:250000000,club:"ALL",sort:"rating"};renderCurrentRoute();return;}
    const counter=event.target.closest("[data-accept-counter]");if(counter){acceptCounter(counter.dataset.acceptCounter);return;}

    const mail=event.target.closest("[data-mail-select]");if(mail){state.selectedMail=mail.dataset.mailSelect;if(!state.mailRead.includes(mail.dataset.mailSelect))state.mailRead.push(mail.dataset.mailSelect);persist();renderCurrentRoute();return;}
    if(event.target.closest("[data-mail-read-all]")){state.mailRead=[...new Set([...state.mailRead,...CAREER_MAIL.map(item=>item.id)])];persist();renderCurrentRoute();return;}
    const mailDelete=event.target.closest("[data-mail-delete]");if(mailDelete){state.mailDeleted.push(mailDelete.dataset.mailDelete);persist();renderCurrentRoute();return;}
    const mailAction=event.target.closest("[data-mail-action]");if(mailAction){handleMailAction(mailAction.dataset.mailAction);return;}

    if(event.target.closest("[data-training-save]")){persist();showToast("Microciclo confirmado. A condição será atualizada após a próxima partida.");return;}
    if(event.target.closest("[data-new-focus]")){renderNewFocusModal();return;}
    if(event.target.closest("[data-scout-week]")){state.recruitmentFocuses=state.recruitmentFocuses.map(item=>({...item,progress:Math.min(100,item.progress+12),matches:item.matches+2}));persist();renderCurrentRoute();return;}
    const deleteFocus=event.target.closest("[data-delete-focus]");if(deleteFocus){state.recruitmentFocuses=state.recruitmentFocuses.filter(item=>item.id!==deleteFocus.dataset.deleteFocus);persist();renderCurrentRoute();return;}
    const recruitPlayer=event.target.closest("[data-recruit-player]");if(recruitPlayer){state.selectedMarketId=recruitPlayer.dataset.recruitPlayer;if(!state.shortlist.includes(recruitPlayer.dataset.recruitPlayer))state.shortlist.push(recruitPlayer.dataset.recruitPlayer);state.transferTab="shortlist";persist();navigate("transfers");return;}
    const calendar=event.target.closest("[data-calendar-shift]");if(calendar){state.calendarOffset=Math.max(-1,Math.min(1,state.calendarOffset+Number(calendar.dataset.calendarShift)));persist();renderCurrentRoute();return;}
    if(event.target.closest("[data-budget-save]")){persist();showToast("Distribuição financeira confirmada.");return;}
    const promote=event.target.closest("[data-promote-youth]");if(promote){const item=state.academy.find(player=>player.id===promote.dataset.promoteYouth);if(item)item.status="promoted";persist();renderCurrentRoute();return;}
  });

  host.addEventListener("input", event => {
    const search=event.target.closest("[data-market-search]");if(search){marketFilters.search=search.value;renderCurrentRoute();queueMicrotask(()=>document.querySelector("[data-market-search]")?.focus());return;}
    const range=event.target.closest("[data-market-range]");if(range){marketFilters[range.dataset.marketRange]=Number(range.value);renderCurrentRoute();return;}
    const tactic=event.target.closest("[data-tactic-slider]");if(tactic){state.tactics[tactic.dataset.tacticSlider]=Number(tactic.value);tactic.closest("label")?.querySelector("span b")?.replaceChildren(document.createTextNode(tactic.value));persist();return;}
    const budget=event.target.closest("[data-budget-slider]");if(budget){state.transferBudget=Number(budget.value);persist();renderCurrentRoute();return;}
  });

  host.addEventListener("change", event => {
    const filter=event.target.closest("[data-market-filter]");if(filter){marketFilters[filter.dataset.marketFilter]=filter.value;renderCurrentRoute();return;}
    const formation=event.target.closest("[data-formation]");if(formation){state.formation=formation.value;persist();renderCurrentRoute();return;}
    const training=event.target.closest("[data-training-day]");if(training){state.training[training.dataset.trainingDay]=training.value;persist();renderCurrentRoute();return;}
    const plan=event.target.closest("[data-youth-plan]");if(plan){const item=state.academy.find(player=>player.id===plan.dataset.youthPlan);if(item)item.plan=plan.value;persist();return;}
  });

  host.addEventListener("dragstart", event => {
    const drag=event.target.closest("[data-drag-player]");if(drag)event.dataTransfer.setData("text/player-id",drag.dataset.dragPlayer);
  });
  host.addEventListener("dragover", event => {if(event.target.closest("[data-tactic-slot]"))event.preventDefault();});
  host.addEventListener("drop", event => {const slot=event.target.closest("[data-tactic-slot]");if(!slot)return;event.preventDefault();const id=event.dataTransfer.getData("text/player-id");const player=USER_SQUAD.find(item=>item.id===id);if(!player)return;const from=state.xi.indexOf(player.name);const to=Number(slot.dataset.tacticSlot);if(from>=0){[state.xi[from],state.xi[to]]=[state.xi[to],state.xi[from]];}else{state.xi[to]=player.name;}persist();renderCurrentRoute();});
}

function handlePlayerAction(action,id) {
  const player=USER_SQUAD.find(item=>item.id===id);if(!player)return;
  if(action==="xi"){if(!state.xi.includes(player.name))state.xi[state.xi.length-1]=player.name;persist();showToast(`${player.name} foi adicionado ao plano principal.`);}
  if(action==="renew"){state.playerStatus[id]="Renovação em andamento";persist();renderCurrentRoute();}
  if(action==="list"){state.playerStatus[id]="Lista de transferências";persist();renderCurrentRoute();}
}

function toggleShortlist(id) {
  state.shortlist=state.shortlist.includes(id)?state.shortlist.filter(item=>item!==id):[...state.shortlist,id];persist();
}

function acceptCounter(id) {
  const offer=state.offers.find(item=>item.id===id);if(!offer)return;
  if(offer.counter>state.transferBudget){showToast("Orçamento insuficiente para aceitar a contraproposta.");return;}
  offer.status="Aceita";offer.fee=offer.counter;offer.message="O clube aceitou os termos. A negociação contratual foi concluída.";state.transferBudget-=offer.counter;persist();renderCurrentRoute();
}

function handleMailAction(id) {
  const map={m1:"squad",m2:"tactics",m3:"tactics",m4:"finances"};navigate(map[id]||"inbox");
}

function navigate(target) {
  if(target==="central"){window.location.hash="";window.location.reload();return;}
  window.location.hash=`#${target}`;
}

function bindGlobalNavigation() {
  document.addEventListener("click", event => {
    const nav=event.target.closest("[data-nav]");
    if(!nav)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    navigate(nav.dataset.nav);
  },true);

  document.addEventListener("click", event => {
    if(event.target.closest("[data-close-career-modal]")){event.target.closest(".career-modal-layer")?.remove();return;}
  });

  document.addEventListener("submit", event => {
    if(event.target.matches("[data-offer-form]")){
      event.preventDefault();const data=new FormData(event.target);const player=TRANSFER_MARKET.find(item=>item.id===offerDraft.playerId);const fee=Number(data.get("fee"));const wage=Number(data.get("wage"));const years=Number(data.get("years"));const ratio=fee/player.value;let status="Recusada",message="O clube considera a proposta muito abaixo da avaliação interna.",counter=null;if(ratio>=1.04){status="Aceita";message="O clube aceitou a proposta. Os termos pessoais foram encaminhados.";}else if(ratio>=.84){status="Contraproposta";counter=Math.round(player.value*1.07/500000)*500000;message=`O clube aceita negociar, mas pede ${formatMoney(counter)}.`;}const offer={id:`o${Date.now()}`,playerId:player.id,fee,wage,years,bonus:Number(data.get("bonus")),swap:String(data.get("swap")||""),status,message,counter,date:new Date().toLocaleDateString("pt-BR")};state.offers.push(offer);if(status==="Aceita"&&fee<=state.transferBudget)state.transferBudget-=fee;state.transferTab="offers";persist();event.target.closest(".career-modal-layer")?.remove();renderCurrentRoute();return;}
    if(event.target.matches("[data-focus-form]")){
      event.preventDefault();const data=new FormData(event.target);state.recruitmentFocuses.push({id:`f${Date.now()}`,name:String(data.get("name")),position:String(data.get("position")),age:String(data.get("age")),region:String(data.get("region")),priority:String(data.get("priority")),scout:String(data.get("scout")),progress:4,matches:0});persist();event.target.closest(".career-modal-layer")?.remove();renderCurrentRoute();
    }
  });
}

bindGlobalNavigation();
window.addEventListener("hashchange",()=>{if(ROUTES.has(route()))renderCurrentRoute();});
if(ROUTES.has(route()))renderCurrentRoute();

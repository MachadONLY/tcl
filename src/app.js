import "./styles.css";

import {
  calculateTeamProfile,
  FORMATIONS,
  MatchEngine,
  PLAYER_ROLE_OPTIONS,
  sanitizePlayerPosition
} from "./match-engine.js";
import { PitchRenderer } from "./pitch-renderer.js";
import * as MvpData from "./mvp-data.js";
import { getProviderStatus, getTeam } from "./football-data.js";

const app = document.querySelector("#app");

const ui = {
  phase: "loading",
  prematchTab: "matchday",
  sceneDirection: "forward",
  animateScene: true,
  rosterFilter: "Todos",
  selectedPlayerId: null,
  selectedRolePlayerId: null,
  positionFeedback: null,
  suppressPitchClickUntil: 0,
  activeSurface: null,
  returnSurface: null,
  dataTab: "summary",
  confirmationOpen: false,
  liveTacticsDraft: null,
  substitutionOut: null,
  substitutionIn: null,
  substitutionError: null,
  postTab: "summary",
  dataStatus: {
    live: false,
    label: "Snapshot local verificado",
    provider: "football-data.org"
  },
  lastBannerEventId: null,
  bannerTimeout: null,
  lineupHistory: []
};

const PREMATCH_SCENES = Object.freeze([
  { id: "matchday", label: "Matchday", short: "MD" },
  { id: "lineup", label: "Elenco", short: "XI" },
  { id: "formation", label: "Esquemas", short: "FM" },
  { id: "roles", label: "Funções", short: "FN" },
  { id: "instructions", label: "Instruções", short: "IN" },
  { id: "opponent", label: "Análise", short: "AN" }
]);

let pitchDrag = null;

let matchData = null;
let engine = null;
let renderer = null;
let matchAnimationFrame = 0;
let matchLastFrameAt = 0;
let latestHandledEventId = 0;

const EVENT_LABELS = {
  kickoff: "Início",
  goal: "Gol",
  shotOnTarget: "Finalização",
  keyPass: "Passe-chave",
  yellowCard: "Amarelo",
  redCard: "Expulsão",
  injury: "Lesão",
  offside: "Impedimento",
  substitution: "Substituição",
  substitutionPrepared: "Troca preparada",
  tacticalChange: "Tática",
  halftime: "Intervalo",
  fulltime: "Fim"
};

const TACTIC_COPY = {
  mentality: {
    low: "Mais jogadores atrás da linha da bola e menor exposição na transição.",
    mid: "Distâncias equilibradas entre criação, pressão e proteção.",
    high: "Mais apoios à frente e ocupação agressiva, com espaço maior às costas."
  },
  width: {
    low: "A equipe aproxima os corredores e cria combinações por dentro.",
    mid: "Amplitude moderada para progredir sem partir o bloco.",
    high: "Pontas e laterais abrem o campo e alongam a defesa rival."
  },
  defensiveLine: {
    low: "A última linha recua, protege profundidade e cede mais território.",
    mid: "Bloco médio com cobertura equilibrada.",
    high: "A linha sobe para compactar, assumindo risco de bola nas costas."
  },
  pressing: {
    low: "O time preserva energia e fecha linhas antes de atacar o portador.",
    mid: "Pressiona gatilhos próximos sem desmontar a estrutura.",
    high: "Mais peças saltam na pressão; recupera alto, mas consome energia."
  },
  tempo: {
    low: "Mais tempo para decidir e menor volume de ações.",
    mid: "Circulação equilibrada entre segurança e aceleração.",
    high: "Decisões mais rápidas, mais progressão e maior chance de erro."
  },
  passingRisk: {
    low: "Prioriza apoios curtos e reduz perdas perigosas.",
    mid: "Mistura circulação e passes verticais conforme o espaço.",
    high: "Procura rupturas cedo e aceita mais perdas em troca de criação."
  }
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function compactName(name, limit = 18) {
  const clean = String(name || "Jogador");
  if (clean.length <= limit) return clean;
  const parts = clean.split(/\s+/);
  if (parts.length > 1) return `${parts[0][0]}. ${parts.at(-1)}`;
  return `${clean.slice(0, limit - 1)}…`;
}

function formatClock(seconds) {
  const totalMinutes = Math.floor(Number(seconds || 0) / 60);
  const remainingSeconds = Math.floor(Number(seconds || 0) % 60);
  return `${String(totalMinutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function minuteLabel(event) {
  if (event.type === "halftime") return "INT";
  if (event.type === "fulltime") return "FIM";
  return `${Number(event.minute ?? 0)}'`;
}

function getUserTeam() {
  return matchData.userTeamIndex === 0 ? matchData.home : matchData.away;
}

function getOpponentTeam() {
  return matchData.userTeamIndex === 0 ? matchData.away : matchData.home;
}

function getUserLineup() {
  return matchData.userTeamIndex === 0 ? matchData.homeLineup : matchData.awayLineup;
}

function setUserLineup(lineup) {
  if (matchData.userTeamIndex === 0) matchData.homeLineup = lineup;
  else matchData.awayLineup = lineup;
}

function getUserTactics() {
  return matchData.userTeamIndex === 0 ? matchData.homeTactics : matchData.awayTactics;
}

function setUserTactics(tactics) {
  if (matchData.userTeamIndex === 0) matchData.homeTactics = tactics;
  else matchData.awayTactics = tactics;
}

function crest(team, size = "") {
  const short = escapeHtml(team.tla || team.shortName?.slice(0, 3) || "CLB");
  const fallback = `<span class="crest-fallback ${size}" ${team.crest ? "hidden" : ""} aria-hidden="true">${short}</span>`;
  if (!team.crest) return fallback;
  return `<span class="crest-wrap ${size}">
    <img
      class="team-crest ${size}"
      src="${escapeHtml(team.crest)}"
      alt="Escudo do ${escapeHtml(team.shortName || team.name)}"
      referrerpolicy="no-referrer"
    />
    ${fallback}
  </span>`;
}

function dataCutoffLabel() {
  const value = MvpData.SNAPSHOT_DATE ||
    MvpData.MATCH_META?.snapshotDate ||
    matchData?.meta?.snapshotDate ||
    "2026-07-30";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.valueOf())
    ? String(value)
    : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
      .format(date)
      .replace(".", "");
}

function playerById(team, id) {
  return team.squad.find(player => String(player.id) === String(id));
}

function defaultRoleForSlot(slot) {
  if (slot === "GK") return "goleiro-líbero";
  if (["RB", "LB", "RWB", "LWB"].includes(slot)) return "lateral apoio";
  if (["CB", "RCB", "LCB"].includes(slot)) return "zagueiro construtor";
  if (slot === "DM") return "volante protetor";
  if (["CM", "RCM", "LCM", "RM", "LM"].includes(slot)) return "área-a-área";
  if (["RW", "LW"].includes(slot)) return "ponta aberto";
  if (["AM", "RAM", "LAM"].includes(slot)) return "meia criativo";
  return "atacante móvel";
}

function allowedRolesForSlot(slot) {
  const candidates = slot === "GK"
    ? ["goleiro-líbero"]
    : ["CB", "RCB", "LCB"].includes(slot)
      ? ["zagueiro construtor"]
      : ["RB", "LB", "RWB", "LWB"].includes(slot)
        ? ["lateral apoio", "lateral ofensivo"]
        : slot === "DM"
          ? ["volante protetor", "organizador", "área-a-área"]
          : ["CM", "RCM", "LCM", "RM", "LM"].includes(slot)
            ? ["organizador", "área-a-área", "volante protetor"]
            : ["RW", "LW"].includes(slot)
              ? ["ponta aberto", "atacante interior", "meia criativo"]
              : ["AM", "RAM", "LAM"].includes(slot)
                ? ["meia criativo", "organizador", "atacante móvel"]
                : ["atacante móvel", "referência"];
  return candidates.filter(role => PLAYER_ROLE_OPTIONS.includes(role));
}

function ensurePlayerRoles(team, lineup, tactics) {
  const formation = FORMATIONS[tactics.formation] || FORMATIONS["4-2-3-1"];
  const current = { ...(tactics.playerRoles || {}) };
  lineup.slice(0, 11).forEach((id, index) => {
    const slot = formation[index]?.role;
    if (!allowedRolesForSlot(slot).includes(current[id])) {
      current[id] = defaultRoleForSlot(slot);
    }
  });
  tactics.playerRoles = current;
  return tactics;
}

function ensureMatchRoles() {
  matchData.homeTactics = ensurePlayerRoles(
    matchData.home,
    matchData.homeLineup,
    matchData.homeTactics
  );
  matchData.awayTactics = ensurePlayerRoles(
    matchData.away,
    matchData.awayLineup,
    matchData.awayTactics
  );
}

function overallFor(player) {
  return Math.round(Number(player?.overall ?? 72));
}

function playerStatus(player) {
  if (player.suspended) return { text: "Suspenso", className: "danger" };
  if (player.injury) return { text: "Em avaliação", className: "warning" };
  if ((player.condition ?? 100) < 75) return { text: "Atenção", className: "warning" };
  if (player.numberStatus === "pending") return { text: "Nº pendente", className: "" };
  return { text: "Disponível", className: "success" };
}

function validateLineup() {
  const team = getUserTeam();
  const lineup = getUserLineup();
  const starters = lineup.map(id => playerById(team, id)).filter(Boolean);
  return {
    eleven: starters.length === 11,
    goalkeeper: starters.some(player => player.positions?.includes("GK") || player.position === "GK"),
    available: starters.every(player => !player.suspended && !player.unavailable),
    captain: Boolean(matchData.captainId || starters.find(player => player.captain)),
    valid: starters.length === 11 &&
      starters.some(player => player.positions?.includes("GK") || player.position === "GK") &&
      starters.every(player => !player.suspended && !player.unavailable)
  };
}

function readinessScore() {
  const validation = validateLineup();
  const team = getUserTeam();
  const players = getUserLineup().map(id => playerById(team, id)).filter(Boolean);
  const meanCondition = players.length
    ? players.reduce((sum, player) => sum + (player.condition ?? 90), 0) / players.length
    : 0;
  const base = (validation.eleven ? 35 : 0) + (validation.goalkeeper ? 20 : 0) +
    (validation.available ? 15 : 0) + (validation.captain ? 10 : 0);
  return Math.round(clamp(base + meanCondition * 0.2, 0, 100));
}

function sourcePill() {
  return `
    <span class="pill ${ui.dataStatus.live ? "success" : "warning"}"
      title="${ui.dataStatus.live
        ? "Clubes e elencos carregados pelo provedor configurado."
        : "Snapshot local pesquisado. Ratings são estimativas internas do protótipo."}">
      <span class="status-dot ${ui.dataStatus.live ? "" : "demo"}"></span>
      ${escapeHtml(ui.dataStatus.label)}
    </span>
  `;
}

function competitionMark() {
  return `
    <span class="competition-mark">
      <img
        class="competition-logo"
        src="https://logo.premierleague.com/img/lion-dark.svg"
        alt="Premier League"
        referrerpolicy="no-referrer"
      />
      <span class="competition-logo-fallback" hidden aria-hidden="true">PL</span>
    </span>
  `;
}

function phaseHeader() {
  const home = matchData.home;
  const away = matchData.away;
  const meta = matchData.meta || {};
  const matchweek = meta.matchweek || 9;
  const season = meta.season || "2026/27";
  return `
    <header class="prematch-header pl-competition-header">
      <span class="pl-ribbon" aria-hidden="true"></span>
      <div class="competition-lockup">
        ${competitionMark()}
        <div class="competition-copy">
          <span>Premier League · ${escapeHtml(season)}</span>
          <strong>Matchday <b>${String(matchweek).padStart(2, "0")}</b></strong>
        </div>
      </div>
      <div class="fixture-identity" aria-label="${escapeHtml(home.shortName)} contra ${escapeHtml(away.shortName)}">
        <div class="fixture-team">
          <div>
            <div class="fixture-team-name">${escapeHtml(home.shortName)}</div>
            <div class="fixture-team-detail">${matchData.userTeamIndex === 0 ? "Seu time" : "Mandante"}</div>
          </div>
          ${crest(home)}
        </div>
        <span class="fixture-vs" aria-hidden="true">×</span>
        <div class="fixture-team away">
          ${crest(away)}
          <div>
            <div class="fixture-team-name">${escapeHtml(away.shortName)}</div>
            <div class="fixture-team-detail">${matchData.userTeamIndex === 1 ? "Seu time" : "Visitante"}</div>
          </div>
        </div>
      </div>
      <div class="header-actions">
        <div class="header-match-meta">
          <span>Matchweek ${matchweek}</span>
          <strong>${escapeHtml(meta.venue || "Stamford Bridge")}</strong>
        </div>
        <button class="primary-button" data-action="open-confirmation">
          Entrar em campo <span aria-hidden="true">→</span>
        </button>
      </div>
    </header>
  `;
}

function renderMiniPitch(team, lineup, tactics, {
  interactive = false,
  selectedId = null,
  opponent = false,
  compact = false,
  showNames = true,
  selectionAction = "select-lineup-player"
} = {}) {
  const formation = FORMATIONS[tactics.formation] || FORMATIONS["4-2-3-1"];
  const pieces = lineup.slice(0, 11).map((id, index) => {
    const player = playerById(team, id);
    const slot = formation[index] || formation.at(-1);
    if (!player) return "";
    const group = slot.role === "GK"
      ? "keeper"
      : ["RB", "RCB", "CB", "LCB", "LB", "RWB", "LWB"].includes(slot.role)
        ? "defence"
        : ["RW", "LW", "RST", "ST", "LST"].includes(slot.role)
          ? "attack"
          : "midfield";
    const roleWeight = group === "keeper" ? 0 : group === "defence" ? 0.45 : group === "midfield" ? 0.72 : 1;
    const mentalityShift = (Number(tactics.mentality) - 50) / 600;
    const lineShift = group === "defence" ? (Number(tactics.defensiveLine) - 50) / 520 : 0;
    const roleName = tactics.playerRoles?.[id] || defaultRoleForSlot(slot.role);
    const roleWidth = roleName === "ponta aberto" || roleName === "lateral ofensivo"
      ? 1.1
      : roleName === "atacante interior" || roleName === "meia criativo"
        ? 0.83
        : 1;
    const customPosition = tactics.playerPositions?.[String(id)] || tactics.playerPositions?.[id];
    const hasCustomPosition = Number.isFinite(Number(customPosition?.x)) &&
      Number.isFinite(Number(customPosition?.y));
    const projectedX = hasCustomPosition
      ? clamp(Number(customPosition.x), 0.03, 0.97)
      : clamp(slot.x + mentalityShift * roleWeight + lineShift, 0.03, 0.97);
    const projectedY = hasCustomPosition
      ? clamp(Number(customPosition.y), 0.04, 0.96)
      : clamp(
        0.5 + (slot.y - 0.5) * (0.72 + Number(tactics.width) / 180) * roleWidth,
        0.04,
        0.96
      );
    const left = 4 + projectedX * 92;
    const top = 5 + projectedY * 90;
    return `
      <button
        class="lineup-piece ${String(selectedId) === String(id) ? "selected" : ""} ${hasCustomPosition ? "custom-position" : ""}"
        style="left:${left}%;top:${top}%"
        ${interactive
          ? `data-action="${selectionAction}" data-player-id="${escapeHtml(id)}" data-drag-player="${escapeHtml(id)}"`
          : "tabindex=\"-1\""}
        aria-label="${escapeHtml(player.name)}, ${escapeHtml(slot.role)}, função ${escapeHtml(roleName)}"
        type="button"
      >
        <span class="piece-disc">${escapeHtml(player.shirtNumber ?? "—")}</span>
        <span class="piece-role">${escapeHtml(slot.role)}</span>
        ${showNames ? `<span class="piece-name">${escapeHtml(compactName(player.name, 23))}<small>${escapeHtml(roleName)}</small></span>` : ""}
      </button>
    `;
  }).join("");

  return `
    <div class="pitch-diorama ${compact ? "compact" : ""}">
      <span class="pitch-light" aria-hidden="true"></span>
      <div
        class="mini-pitch ${opponent ? "opponent-pitch" : ""} ${interactive ? "is-draggable" : ""}"
        data-tactical-pitch="${interactive ? "true" : "false"}"
        aria-label="Formação ${escapeHtml(tactics.formation)}"
      >
        <span class="mini-centre-circle" aria-hidden="true"></span>
        <span class="mini-box left" aria-hidden="true"></span>
        <span class="mini-box right" aria-hidden="true"></span>
        ${pieces}
      </div>
      <span class="pitch-ledge" aria-hidden="true"></span>
    </div>
  `;
}

function rosterRows() {
  const team = getUserTeam();
  const lineup = getUserLineup();
  const filter = ui.rosterFilter;
  const groupMap = {
    Goleiros: "Goalkeeper",
    Defesa: "Defence",
    Meio: "Midfield",
    Ataque: "Offence"
  };
  const filtered = team.squad.filter(player => {
    if (filter === "Todos") return true;
    return player.group === groupMap[filter] || player.positionGroup === groupMap[filter];
  });

  return filtered.map(player => {
    const starter = lineup.some(id => String(id) === String(player.id));
    const selected = String(ui.selectedPlayerId) === String(player.id);
    const status = playerStatus(player);
    const condition = Math.round(player.condition ?? 90);
    const sharpness = Math.round(player.sharpness ?? 82);
    const fit = player.roleFit ?? (starter ? 91 : 84);
    return `
      <tr
        class="roster-row ${starter ? "starter" : ""} ${selected ? "selected" : ""}"
        data-action="select-roster-player"
        data-player-id="${escapeHtml(player.id)}"
        tabindex="0"
        aria-selected="${selected}"
      >
        <td><span class="shirt-number">${escapeHtml(player.shirtNumber ?? "—")}</span></td>
        <td>
          <span class="roster-name">${escapeHtml(player.name)}</span>
          <span class="roster-secondary">${escapeHtml((player.positions || [player.position]).join(" · "))}</span>
        </td>
        <td><span class="position-tag">${escapeHtml(player.position || player.positions?.[0] || "—")}</span></td>
        <td><span class="overall" title="OVR na função — rating interno Touchline, não oficial">${overallFor(player)}</span></td>
        <td>
          <span class="tabular">${condition}%</span>
          <div class="micro-bar ${condition < 75 ? "low" : ""}" aria-hidden="true"><span style="--value:${condition}%"></span></div>
        </td>
        <td>
          <span class="tabular">${sharpness}%</span>
          <div class="micro-bar ${sharpness < 70 ? "low" : ""}" aria-hidden="true"><span style="--value:${sharpness}%"></span></div>
        </td>
        <td><span class="tabular">${Math.round(fit)}%</span></td>
        <td><span class="pill ${status.className}">${escapeHtml(status.text)}</span></td>
      </tr>
    `;
  }).join("");
}

function renderLineupTab() {
  const team = getUserTeam();
  const lineup = getUserLineup();
  const tactics = getUserTactics();
  const selected = playerById(team, ui.selectedPlayerId);
  const selectedStarter = lineup.some(id => String(id) === String(ui.selectedPlayerId));
  const profile = calculateTeamProfile(team, lineup, tactics);
  const filters = ["Todos", "Goleiros", "Defesa", "Meio", "Ataque"];

  return `
    <div class="lineup-layout">
      <section class="selection-zone">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Seu time · estrutura com bola</p>
            <h2>${escapeHtml(tactics.formation)} · Equilibrada</h2>
            <p>Clique em um titular e depois em outro atleta para trocar. A formação preserva o elenco.</p>
          </div>
          <span class="pill success">${profile.fit}% encaixe</span>
        </div>
        ${renderMiniPitch(team, lineup, tactics, {
          interactive: true,
          selectedId: ui.selectedPlayerId
        })}
        <div class="selection-footer">
          <div class="selection-summary">
            <span><strong>${lineup.length}</strong>/11 titulares</span>
            <span><strong>${team.squad.length - lineup.length}</strong> opções</span>
            <span><strong>${profile.overall}</strong> OVR função</span>
          </div>
          <button class="ghost-button" data-action="undo-lineup" ${ui.lineupHistory.length ? "" : "disabled"}>
            Desfazer
          </button>
        </div>
      </section>
      <section class="roster-zone">
        <div class="roster-toolbar">
          <div>
            <h3>Elenco completo</h3>
            <div class="swap-hint">
              ${selected
                ? `${escapeHtml(selected.name)} selecionado · ${selectedStarter ? "escolha quem entra" : "escolha o titular que sai"}`
                : "Selecione dois jogadores para trocar posição ou titularidade"}
            </div>
          </div>
          <div class="roster-filters" aria-label="Filtrar elenco">
            ${filters.map(filter => `
              <button
                class="filter-chip ${ui.rosterFilter === filter ? "active" : ""}"
                data-action="filter-roster"
                data-filter="${filter}"
                aria-pressed="${ui.rosterFilter === filter}"
              >${filter}</button>
            `).join("")}
          </div>
        </div>
        <div class="roster-table-wrap">
          <table class="roster-table">
            <thead>
              <tr>
                <th>Nº</th>
                <th>Jogador</th>
                <th>Posição</th>
                <th title="Rating interno por função">OVR</th>
                <th>Condição</th>
                <th>Ritmo</th>
                <th>Encaixe</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>${rosterRows()}</tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}

function tacticLevel(key, value) {
  if (key === "counterpress") return value ? "high" : "low";
  if (value < 44) return "low";
  if (value > 62) return "high";
  return "mid";
}

function tacticExplanation(tactics) {
  const priorities = ["mentality", "defensiveLine", "pressing", "width", "tempo", "passingRisk"];
  const strongest = priorities
    .map(key => ({ key, distance: Math.abs(Number(tactics[key]) - 50) }))
    .sort((a, b) => b.distance - a.distance)[0];
  const copy = TACTIC_COPY[strongest.key]?.[tacticLevel(strongest.key, tactics[strongest.key])];
  return copy || "Os ajustes alteram ocupação, decisões, custo físico e risco de cada ação.";
}

function segmentControl(key, options, current, scope = "prematch") {
  return `
    <div class="segmented-control" style="--segments:${options.length}">
      ${options.map(option => `
        <button
          class="segment-button ${String(current) === String(option.value) ? "active" : ""}"
          data-action="set-tactic"
          data-key="${key}"
          data-value="${escapeHtml(option.value)}"
          data-scope="${scope}"
          aria-pressed="${String(current) === String(option.value)}"
        >${escapeHtml(option.label)}</button>
      `).join("")}
    </div>
  `;
}

function tacticControls(tactics, scope = "prematch") {
  const range = (key, label, low, high) => `
    <div class="range-control">
      <label for="${scope}-${key}">
        ${label}
        <output id="${scope}-${key}-output">${Math.round(tactics[key])}</output>
      </label>
      <input
        id="${scope}-${key}"
        type="range"
        min="25"
        max="80"
        step="1"
        value="${Number(tactics[key])}"
        data-action="range-tactic"
        data-key="${key}"
        data-scope="${scope}"
      />
      <div class="range-legend"><span>${low}</span><span>${high}</span></div>
    </div>
  `;

  return `
    <div class="control-section">
      <div class="control-section-header">
        <h3>Estrutura base</h3>
        <p>As posições mudam no campo</p>
      </div>
      ${segmentControl("formation", [
        { label: "4–2–3–1", value: "4-2-3-1" },
        { label: "4–3–3", value: "4-3-3" },
        { label: "4–4–2", value: "4-4-2" },
        { label: "3–4–2–1", value: "3-4-2-1" }
      ], tactics.formation, scope)}
    </div>
    <div class="control-section">
      <div class="control-section-header">
        <h3>Com bola</h3>
        <p>Risco, ocupação e velocidade</p>
      </div>
      ${segmentControl("mentality", [
        { label: "Cautelosa", value: 38 },
        { label: "Equilibrada", value: 52 },
        { label: "Agressiva", value: 68 }
      ], tactics.mentality, scope)}
      <div class="slider-grid" style="margin-top:10px">
        ${range("width", "Largura", "Estreita", "Ampla")}
        ${range("tempo", "Ritmo", "Paciente", "Rápido")}
        ${range("passingRisk", "Risco do passe", "Seguro", "Vertical")}
        ${range("defensiveLine", "Altura da linha", "Baixa", "Alta")}
      </div>
    </div>
    <div class="control-section">
      <div class="control-section-header">
        <h3>Sem bola e transição</h3>
        <p>Pressão custa energia</p>
      </div>
      <div class="slider-grid">
        ${range("pressing", "Intensidade de pressão", "Contida", "Alta")}
        <div>
          ${segmentControl("counterpress", [
            { label: "Recompor", value: false },
            { label: "Contra-pressionar", value: true }
          ], tactics.counterpress, scope)}
          <div class="tactic-explanation">${escapeHtml(tacticExplanation(tactics))}</div>
        </div>
      </div>
    </div>
  `;
}

function renderRoleEditor(team, lineup, tactics, scope = "prematch") {
  const formation = FORMATIONS[tactics.formation] || FORMATIONS["4-2-3-1"];
  return `
    <div class="control-section role-editor">
      <div class="control-section-header">
        <h3>Funções individuais</h3>
        <p>Cada função muda zona, apoio, risco e custo físico</p>
      </div>
      <div class="role-grid">
        ${lineup.slice(0, 11).map((id, index) => {
          const player = playerById(team, id);
          const slot = formation[index]?.role || player?.primaryPosition || "CM";
          const selectedRole = tactics.playerRoles?.[id] || defaultRoleForSlot(slot);
          const options = allowedRolesForSlot(slot);
          return `
            <label class="role-row">
              <span class="role-player">
                <span class="role-shirt">${escapeHtml(player?.shirtNumber ?? "—")}</span>
                <span><strong>${escapeHtml(compactName(player?.name, 21))}</strong><small>${escapeHtml(slot)}</small></span>
              </span>
              <select
                data-action="set-player-role"
                data-scope="${scope}"
                data-player-id="${escapeHtml(id)}"
                aria-label="Função de ${escapeHtml(player?.name)}"
              >
                ${options.map(role => `<option value="${escapeHtml(role)}" ${selectedRole === role ? "selected" : ""}>${escapeHtml(role)}</option>`).join("")}
              </select>
            </label>
          `;
        }).join("")}
      </div>
      <div class="tactic-explanation">
        Exemplo: lateral ofensivo ocupa uma zona mais alta e larga, oferece progressão e perde mais energia. Volante protetor recua e reduz risco.
      </div>
    </div>
  `;
}

function renderTacticsTab() {
  const team = getUserTeam();
  const lineup = getUserLineup();
  const tactics = getUserTactics();
  const profile = calculateTeamProfile(team, lineup, tactics);
  return `
    <div class="tactics-layout">
      <section class="tactic-visual">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Visualizador tático</p>
            <h2>${escapeHtml(tactics.formation)}</h2>
            <p>A posição de cada peça responde à formação, largura e altura do bloco.</p>
          </div>
          <span class="pill success">Plano principal</span>
        </div>
        ${renderMiniPitch(team, lineup, tactics)}
        <div class="profile-strip">
          ${[
            ["Geral", profile.overall],
            ["Defesa", profile.defence],
            ["Meio", profile.midfield],
            ["Ataque", profile.attack],
            ["Encaixe", `${profile.fit}%`]
          ].map(([label, value]) => `
            <div class="profile-metric"><strong>${value}</strong><span>${label}</span></div>
          `).join("")}
        </div>
      </section>
      <section class="tactic-controls">
        ${tacticControls(tactics)}
        ${renderRoleEditor(team, lineup, tactics)}
      </section>
    </div>
  `;
}

function normalizedOpponentReport() {
  const opponent = getOpponentTeam();
  const raw = getUserTeam().opponentReport ||
    getUserTeam().scoutingReport ||
    matchData.opponentReport;
  if (raw) {
    const phaseProfile = opponent.strengthProfile || {};
    return {
      confidence: raw.confidence === "prototype" ? "do modelo interno" : (raw.confidence || "alta"),
      formation: raw.expectedFormation,
      plan: raw.summary || [
        raw.recommendedPlan?.withBall,
        raw.recommendedPlan?.withoutBall
      ].filter(Boolean).join(" "),
      planStyle: raw.recommendedPlan?.withBall ? "Plano provável" : undefined,
      strengths: (raw.strengths || []).map(item => typeof item === "string"
        ? item
        : `${item.title}: ${item.evidence} ${item.implication || ""}`.trim()),
      vulnerabilities: (raw.vulnerabilities || []).map(item => typeof item === "string"
        ? item
        : `${item.title}: ${item.evidence} ${item.opportunity || ""}`.trim()),
      phases: {
        Construção: phaseProfile.buildup ?? 80,
        Criação: phaseProfile.chanceCreation ?? 80,
        Pressão: phaseProfile.highPress ?? 80,
        Área: phaseProfile.boxDefense ?? 80,
        Transição: phaseProfile.defensiveTransition ?? 80
      },
      keyPlayers: (raw.keyPlayerIds || []).map(id => playerById(opponent, id)).filter(Boolean)
    };
  }
  return {
    confidence: "Alta",
    formation: matchData.userTeamIndex === 0 ? matchData.awayTactics.formation : matchData.homeTactics.formation,
    plan: "Busca controlar o centro e acelerar quando o ponta recebe de frente.",
    strengths: [
      "Criação entre linhas com o meia se aproximando do atacante.",
      "Recuperação rápida após perda no corredor central."
    ],
    vulnerabilities: [
      "Espaço atrás do lateral quando ele avança junto ao ponta.",
      "A última linha pode ser atacada por passes diagonais rápidos."
    ],
    phases: {
      "Construção": 82,
      "Criação": 86,
      "Pressão": 81,
      "Área": 79,
      "Transição": 84
    },
    keyPlayers: opponent.squad.slice().sort((a, b) => overallFor(b) - overallFor(a)).slice(0, 3)
  };
}

function renderOpponentTab() {
  const opponent = getOpponentTeam();
  const lineup = matchData.userTeamIndex === 0 ? matchData.awayLineup : matchData.homeLineup;
  const tactics = matchData.userTeamIndex === 0 ? matchData.awayTactics : matchData.homeTactics;
  const report = normalizedOpponentReport();
  const phases = report.phases || report.phaseStrengths || {};
  const keyPlayers = (report.keyPlayers || []).map(item =>
    typeof item === "object" ? item : playerById(opponent, item)
  ).filter(Boolean);

  return `
    <div class="opponent-layout">
      <section class="opponent-visual">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Estrutura provável</p>
            <h2>${escapeHtml(tactics.formation)} · ${escapeHtml(opponent.shortName)}</h2>
          </div>
          <span class="pill">Confiança ${escapeHtml(report.confidence || "alta")}</span>
        </div>
        ${renderMiniPitch(opponent, lineup, tactics, { opponent: true })}
        <div class="confidence-row">
          <span class="muted" style="font-size:9px">Relatório derivado do elenco e plano configurado.</span>
          <span class="pill success">${escapeHtml(report.planStyle || "Plano provável")}</span>
        </div>
      </section>
      <section class="opponent-report">
        <div class="report-intro">
          <p class="eyebrow">O que muda sua decisão</p>
          <h2>Como o ${escapeHtml(opponent.shortName)} tenta vencer</h2>
          <p>${escapeHtml(report.plan || report.summary || "Controle do centro, aceleração nos corredores e pressão imediata após a perda.")}</p>
        </div>
        <div class="phase-strengths">
          ${Object.entries(phases).slice(0, 5).map(([label, value]) => `
            <div class="phase-strength"><strong>${Math.round(value)}</strong><span>${escapeHtml(label)}</span></div>
          `).join("")}
        </div>
        <div class="report-columns">
          <article class="report-block">
            <h3>Forças observáveis</h3>
            <ul class="insight-list">
              ${(report.strengths || []).slice(0, 2).map((text, index) => `
                <li><span class="insight-index">${index + 1}</span><span>${escapeHtml(text)}</span></li>
              `).join("")}
            </ul>
          </article>
          <article class="report-block">
            <h3>Onde atacar</h3>
            <ul class="insight-list">
              ${(report.vulnerabilities || []).slice(0, 2).map((text, index) => `
                <li><span class="insight-index">${index + 1}</span><span>${escapeHtml(text)}</span></li>
              `).join("")}
            </ul>
          </article>
          <article class="report-block key-players">
            <h3>Jogadores que alteram o plano</h3>
            <div class="key-player-grid">
              ${keyPlayers.map(player => `
                <div class="key-player">
                  <strong>${escapeHtml(player.name)}</strong>
                  <span>${escapeHtml((player.positions || [player.position]).join(" · "))} · OVR função ${overallFor(player)}</span>
                </div>
              `).join("")}
            </div>
          </article>
        </div>
      </section>
    </div>
  `;
}

function prematchStatusLabel() {
  const validation = validateLineup();
  if (!validation.eleven) return "XI incompleto";
  if (!validation.goalkeeper || !validation.available) return "Revisão necessária";
  const positions = getUserTactics().playerPositions || {};
  const customCount = getUserLineup()
    .filter(id => positions[String(id)] || positions[id])
    .length;
  return customCount ? `${customCount} ajuste${customCount === 1 ? "" : "s"} de posição` : "Plano pronto";
}

function renderMatchdayScene() {
  const home = matchData.home;
  const away = matchData.away;
  const meta = matchData.meta || {};
  const userTeam = getUserTeam();
  const lineup = getUserLineup();
  const tactics = getUserTactics();
  const profile = calculateTeamProfile(userTeam, lineup, tactics);
  return `
    <div class="matchday-scene scene-canvas">
      <section class="matchday-hero">
        <div class="matchday-watermark" aria-hidden="true">09</div>
        <div class="matchday-competition-line">
          ${competitionMark()}
          <span>Premier League · Matchweek ${escapeHtml(meta.matchweek || 9)}</span>
          <b>Protótipo não oficial</b>
        </div>
        <div class="matchday-title-block">
          <p>31 OCT 2026 · ${escapeHtml(meta.venue || "Stamford Bridge")}</p>
          <h1>MATCHDAY</h1>
          <span>${escapeHtml(meta.kickoffLocal || "15:00")} PROVISIONAL</span>
        </div>
        <div class="matchday-fixture">
          <article class="matchday-club home">
            ${crest(home, "large")}
            <div><span>${escapeHtml(home.tla)}</span><strong>${escapeHtml(home.shortName)}</strong></div>
          </article>
          <div class="matchday-versus"><span>MW ${escapeHtml(meta.matchweek || 9)}</span><strong>×</strong><small>Stamford Bridge</small></div>
          <article class="matchday-club away">
            ${crest(away, "large")}
            <div><span>${escapeHtml(away.tla)}</span><strong>${escapeHtml(away.shortName)}</strong></div>
          </article>
        </div>
        <div class="matchday-actions">
          <button class="primary-button matchday-primary" data-action="prematch-tab" data-tab="lineup">
            Preparar o XI <span aria-hidden="true">→</span>
          </button>
          <button class="secondary-button" data-action="open-confirmation">Revisar e entrar</button>
          <span class="direct-status"><i aria-hidden="true"></i>${prematchStatusLabel()}</span>
        </div>
        <p class="matchday-legal">Fixture oficial sujeito a alteração · simulação Touchline · snapshot ${dataCutoffLabel()}</p>
      </section>
      <section class="matchday-stage-preview" aria-label="Prévia do seu plano">
        <div class="stage-caption">
          <span>Seu plano</span>
          <strong>${escapeHtml(tactics.formation)}</strong>
          <small>${profile.fit}% de encaixe</small>
        </div>
        ${renderMiniPitch(userTeam, lineup, tactics, { compact: true, showNames: false })}
        <div class="stage-scoreline">
          <span><b>${profile.overall}</b> Geral</span>
          <span><b>${profile.defence}</b> Defesa</span>
          <span><b>${profile.attack}</b> Ataque</span>
        </div>
      </section>
    </div>
  `;
}

function rosterCards() {
  const team = getUserTeam();
  const lineup = getUserLineup();
  const groups = {
    Goleiros: "Goalkeeper",
    Defesa: "Defence",
    Meio: "Midfield",
    Ataque: "Offence"
  };
  return team.squad
    .filter(player => ui.rosterFilter === "Todos" ||
      player.group === groups[ui.rosterFilter] ||
      player.positionGroup === groups[ui.rosterFilter])
    .map(player => {
      const starter = lineup.some(id => String(id) === String(player.id));
      const selected = String(ui.selectedPlayerId) === String(player.id);
      return `
        <button
          class="squad-player ${starter ? "starter" : ""} ${selected ? "selected" : ""}"
          data-action="select-roster-player"
          data-player-id="${escapeHtml(player.id)}"
          aria-pressed="${selected}"
        >
          <span class="squad-shirt">${escapeHtml(player.shirtNumber ?? "—")}</span>
          <span class="squad-player-copy">
            <strong>${escapeHtml(compactName(player.name, 24))}</strong>
            <small>${escapeHtml((player.positions || [player.position]).slice(0, 2).join(" · "))} · ${Math.round(player.condition ?? 90)}%</small>
          </span>
          <span class="squad-ovr"><b>${overallFor(player)}</b><small>OVR</small></span>
        </button>
      `;
    }).join("");
}

function renderBenchStrip(team, lineup) {
  const lineupSet = new Set(lineup.map(String));
  const reserves = team.squad.filter(player => !lineupSet.has(String(player.id)));
  return `
    <div class="bench-strip" aria-label="Banco e reservas">
      <span class="bench-label">Banco</span>
      <div class="bench-scroll">
        ${reserves.map(player => `
          <button
            class="bench-player ${String(ui.selectedPlayerId) === String(player.id) ? "selected" : ""}"
            data-action="select-roster-player"
            data-player-id="${escapeHtml(player.id)}"
            title="${escapeHtml(player.name)}"
          >
            <span>${escapeHtml(player.shirtNumber ?? "—")}</span>
            <strong>${escapeHtml(compactName(player.name, 13))}</strong>
            <small>${overallFor(player)}</small>
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function renderSquadScene() {
  const team = getUserTeam();
  const lineup = getUserLineup();
  const tactics = getUserTactics();
  const selected = playerById(team, ui.selectedPlayerId);
  const profile = calculateTeamProfile(team, lineup, tactics);
  const filters = ["Todos", "Goleiros", "Defesa", "Meio", "Ataque"];
  return `
    <div class="squad-scene scene-canvas">
      <section class="tactical-stage">
        <div class="scene-heading">
          <div>
            <p class="eyebrow">XI inicial · ${escapeHtml(tactics.formation)}</p>
            <h2>Monte seu time no campo</h2>
          </div>
          <div class="scene-actions">
            <span class="fit-badge"><b>${profile.fit}%</b> encaixe</span>
            <button class="ghost-button" data-action="undo-lineup" ${ui.lineupHistory.length ? "" : "disabled"}>Desfazer</button>
          </div>
        </div>
        <div class="pitch-instruction">
          <span class="drag-orb" aria-hidden="true"></span>
          Arraste uma peça para ajustar sua zona · clique em dois jogadores para trocar
          ${ui.positionFeedback ? `<b>${escapeHtml(ui.positionFeedback)}</b>` : ""}
        </div>
        ${renderMiniPitch(team, lineup, tactics, {
          interactive: true,
          selectedId: ui.selectedPlayerId
        })}
        ${renderBenchStrip(team, lineup)}
      </section>
      <aside class="context-inspector squad-inspector">
        <header class="inspector-header">
          <div>
            <p class="eyebrow">Elenco completo</p>
            <h3>${selected ? escapeHtml(compactName(selected.name, 25)) : "25 jogadores"}</h3>
          </div>
          <span class="lineup-count">${lineup.length}/11</span>
        </header>
        <div class="roster-filters" aria-label="Filtrar elenco">
          ${filters.map(filter => `
            <button
              class="filter-chip ${ui.rosterFilter === filter ? "active" : ""}"
              data-action="filter-roster"
              data-filter="${filter}"
              aria-pressed="${ui.rosterFilter === filter}"
            >${filter}</button>
          `).join("")}
        </div>
        <div class="squad-list">${rosterCards()}</div>
      </aside>
    </div>
  `;
}

function formationCard(name, label, subtitle) {
  const tactics = getUserTactics();
  return `
    <button
      class="formation-card ${tactics.formation === name ? "active" : ""}"
      data-action="set-tactic"
      data-key="formation"
      data-value="${name}"
      data-scope="prematch"
      aria-pressed="${tactics.formation === name}"
    >
      <span class="formation-dots" data-shape="${name}" aria-hidden="true"></span>
      <span><strong>${label}</strong><small>${subtitle}</small></span>
      <i aria-hidden="true"></i>
    </button>
  `;
}

function compactTacticRange(tactics, key, label, low, high) {
  return `
    <label class="compact-range" for="scene-${key}">
      <span><strong>${label}</strong><output id="scene-${key}-output">${Math.round(tactics[key])}</output></span>
      <input
        id="scene-${key}"
        type="range"
        min="25"
        max="80"
        step="1"
        value="${Number(tactics[key])}"
        data-action="range-tactic"
        data-key="${key}"
        data-scope="prematch"
      />
      <small><span>${low}</span><span>${high}</span></small>
    </label>
  `;
}

function renderFormationScene() {
  const team = getUserTeam();
  const lineup = getUserLineup();
  const tactics = getUserTactics();
  const profile = calculateTeamProfile(team, lineup, tactics);
  const customCount = profile.customPositions || 0;
  return `
    <div class="formation-scene scene-canvas">
      <section class="tactical-stage">
        <div class="scene-heading">
          <div><p class="eyebrow">Estrutura</p><h2>${escapeHtml(tactics.formation)} · sua ocupação</h2></div>
          <div class="scene-actions">
            <span class="fit-badge"><b>${profile.fit}%</b> encaixe</span>
            <button class="ghost-button" data-action="reset-player-positions" ${customCount ? "" : "disabled"}>Restaurar slots</button>
          </div>
        </div>
        <div class="pitch-instruction"><span class="drag-orb" aria-hidden="true"></span>Arraste dentro da zona válida; deslocamentos extremos reduzem coesão.</div>
        ${renderMiniPitch(team, lineup, tactics, {
          interactive: true,
          selectedId: ui.selectedPlayerId
        })}
        <div class="shape-meter">
          <span><b>${profile.cohesion ?? profile.fit}%</b> Coesão</span>
          <span><b>${profile.defence}</b> Proteção</span>
          <span><b>${profile.transition}</b> Transição</span>
          <span><b>${customCount}</b> Ajustes manuais</span>
        </div>
      </section>
      <aside class="context-inspector formation-inspector">
        <header class="inspector-header"><div><p class="eyebrow">Esquemas</p><h3>Escolha a base</h3></div></header>
        <div class="formation-grid">
          ${formationCard("4-2-3-1", "4–2–3–1", "Controle entrelinhas")}
          ${formationCard("4-3-3", "4–3–3", "Amplitude e pressão")}
          ${formationCard("4-4-2", "4–4–2", "Duas linhas compactas")}
          ${formationCard("3-4-2-1", "3–4–2–1", "Superioridade na saída")}
        </div>
        <div class="shape-controls">
          ${compactTacticRange(tactics, "width", "Largura", "Estreita", "Ampla")}
          ${compactTacticRange(tactics, "defensiveLine", "Altura do bloco", "Baixo", "Alto")}
        </div>
      </aside>
    </div>
  `;
}

const ROLE_GUIDANCE = Object.freeze({
  "goleiro-líbero": "Ataca a profundidade e inicia curto.",
  "zagueiro construtor": "Rompe linhas com passe, assumindo mais risco.",
  "lateral apoio": "Equilibra amplitude, passe e cobertura.",
  "lateral ofensivo": "Ganha altura e largura; custa mais energia.",
  "volante protetor": "Protege a frente da área e reduz perdas.",
  "organizador": "Atrai a bola e acelera a progressão.",
  "área-a-área": "Percorre setores e pressiona com intensidade.",
  "ponta aberto": "Fixa a largura e cria corredor por dentro.",
  "atacante interior": "Parte de fora para atacar a área.",
  "meia criativo": "Recebe entre linhas e procura o último passe.",
  "atacante móvel": "Sai da referência e ataca intervalos.",
  "referência": "Fixa zagueiros e sustenta jogo direto."
});

function renderRolesScene() {
  const team = getUserTeam();
  const lineup = getUserLineup();
  const tactics = getUserTactics();
  const formation = FORMATIONS[tactics.formation] || FORMATIONS["4-2-3-1"];
  const selectedId = ui.selectedRolePlayerId || lineup[8] || lineup[0];
  const index = Math.max(0, lineup.findIndex(id => String(id) === String(selectedId)));
  const player = playerById(team, lineup[index]);
  const slot = formation[index]?.role || player?.position || "CM";
  const currentRole = tactics.playerRoles?.[player?.id] || defaultRoleForSlot(slot);
  const roles = allowedRolesForSlot(slot);
  return `
    <div class="roles-scene scene-canvas">
      <section class="tactical-stage">
        <div class="scene-heading">
          <div><p class="eyebrow">Funções individuais</p><h2>Comportamento nasce da função</h2></div>
          <span class="direct-status"><i aria-hidden="true"></i>Impacto ativo no motor</span>
        </div>
        <div class="pitch-instruction"><span class="select-orb" aria-hidden="true"></span>Selecione uma peça para editar sua função.</div>
        ${renderMiniPitch(team, lineup, tactics, {
          interactive: true,
          selectedId: player?.id,
          selectionAction: "select-role-player"
        })}
        <div class="player-selector-strip">
          ${lineup.map((id, playerIndex) => {
            const option = playerById(team, id);
            return `
              <button
                class="${String(option?.id) === String(player?.id) ? "active" : ""}"
                data-action="select-role-player"
                data-player-id="${escapeHtml(option?.id)}"
              ><b>${escapeHtml(option?.shirtNumber ?? "—")}</b><span>${escapeHtml(compactName(option?.name, 11))}</span><small>${escapeHtml(formation[playerIndex]?.role || "")}</small></button>
            `;
          }).join("")}
        </div>
      </section>
      <aside class="context-inspector role-inspector">
        <header class="player-focus">
          <span class="focus-shirt">${escapeHtml(player?.shirtNumber ?? "—")}</span>
          <div><p>${escapeHtml(slot)} · OVR ${overallFor(player)}</p><h3>${escapeHtml(player?.name || "Jogador")}</h3><span>${escapeHtml(currentRole)}</span></div>
        </header>
        <div class="focus-metrics">
          <span><small>Condição</small><b>${Math.round(player?.condition ?? 90)}%</b></span>
          <span><small>Ritmo</small><b>${Math.round(player?.sharpness ?? 82)}%</b></span>
          <span><small>Encaixe</small><b>${Math.round(player?.roleFit ?? 86)}%</b></span>
        </div>
        <div class="role-choice-list">
          <p class="eyebrow">Escolher função</p>
          ${roles.map(role => `
            <button
              class="role-choice ${currentRole === role ? "active" : ""}"
              data-action="set-role-button"
              data-player-id="${escapeHtml(player?.id)}"
              data-role="${escapeHtml(role)}"
              aria-pressed="${currentRole === role}"
            >
              <span><strong>${escapeHtml(role)}</strong><small>${escapeHtml(ROLE_GUIDANCE[role] || "Comportamento tático específico.")}</small></span>
              <i aria-hidden="true"></i>
            </button>
          `).join("")}
        </div>
        <div class="role-impact-note"><span aria-hidden="true">↗</span>${escapeHtml(ROLE_GUIDANCE[currentRole] || "")}</div>
      </aside>
    </div>
  `;
}

function renderInstructionsScene() {
  const team = getUserTeam();
  const lineup = getUserLineup();
  const tactics = getUserTactics();
  const profile = calculateTeamProfile(team, lineup, tactics);
  return `
    <div class="instructions-scene scene-canvas">
      <section class="tactical-stage instruction-stage">
        <div class="scene-heading">
          <div><p class="eyebrow">Plano de jogo</p><h2>${tactics.mentality > 60 ? "Agressivo" : tactics.mentality < 44 ? "Cauteloso" : "Equilibrado"} · ${escapeHtml(tactics.formation)}</h2></div>
          <span class="direct-status"><i aria-hidden="true"></i>Simulação conectada</span>
        </div>
        ${renderMiniPitch(team, lineup, tactics, { showNames: false })}
        <div class="instruction-profile">
          <span><small>Ataque</small><b style="--level:${profile.attack}%"></b><strong>${profile.attack}</strong></span>
          <span><small>Controle</small><b style="--level:${profile.midfield}%"></b><strong>${profile.midfield}</strong></span>
          <span><small>Defesa</small><b style="--level:${profile.defence}%"></b><strong>${profile.defence}</strong></span>
        </div>
      </section>
      <aside class="context-inspector instruction-inspector">
        <header class="inspector-header"><div><p class="eyebrow">Instruções</p><h3>Ajuste o comportamento</h3></div></header>
        <div class="preset-grid">
          <button data-action="apply-tactic-preset" data-preset="control">Controle</button>
          <button data-action="apply-tactic-preset" data-preset="press">Pressão alta</button>
          <button data-action="apply-tactic-preset" data-preset="transition">Transição</button>
        </div>
        <div class="instruction-section">
          <span class="instruction-label">Mentalidade</span>
          ${segmentControl("mentality", [
            { label: "Cautelosa", value: 38 },
            { label: "Equilibrada", value: 52 },
            { label: "Agressiva", value: 68 }
          ], tactics.mentality, "prematch")}
        </div>
        <div class="compact-range-stack">
          ${compactTacticRange(tactics, "tempo", "Ritmo", "Paciente", "Rápido")}
          ${compactTacticRange(tactics, "passingRisk", "Risco do passe", "Seguro", "Vertical")}
          ${compactTacticRange(tactics, "pressing", "Pressão", "Contida", "Intensa")}
          ${compactTacticRange(tactics, "width", "Largura", "Estreita", "Ampla")}
          ${compactTacticRange(tactics, "defensiveLine", "Linha defensiva", "Baixa", "Alta")}
        </div>
        <div class="transition-switch">
          <span><strong>Após perder a bola</strong><small>Energia × recuperação territorial</small></span>
          ${segmentControl("counterpress", [
            { label: "Recompor", value: false },
            { label: "Contra-pressão", value: true }
          ], tactics.counterpress, "prematch")}
        </div>
        <div class="role-impact-note"><span aria-hidden="true">↗</span>${escapeHtml(tacticExplanation(tactics))}</div>
      </aside>
    </div>
  `;
}

function renderOpponentScene() {
  const opponent = getOpponentTeam();
  const lineup = matchData.userTeamIndex === 0 ? matchData.awayLineup : matchData.homeLineup;
  const tactics = matchData.userTeamIndex === 0 ? matchData.awayTactics : matchData.homeTactics;
  const report = normalizedOpponentReport();
  const keyPlayers = (report.keyPlayers || []).map(item =>
    typeof item === "object" ? item : playerById(opponent, item)
  ).filter(Boolean).slice(0, 3);
  return `
    <div class="opponent-scene scene-canvas">
      <section class="tactical-stage opponent-stage">
        <div class="scene-heading">
          <div><p class="eyebrow">Análise do rival</p><h2>${escapeHtml(opponent.shortName)} · ${escapeHtml(tactics.formation)}</h2></div>
          <span class="fit-badge">Confiança ${escapeHtml(report.confidence || "alta")}</span>
        </div>
        ${renderMiniPitch(opponent, lineup, tactics, { opponent: true })}
        <div class="opponent-callouts">
          ${(report.strengths || []).slice(0, 1).map(text => `<span class="danger"><b>Força</b>${escapeHtml(text)}</span>`).join("")}
          ${(report.vulnerabilities || []).slice(0, 1).map(text => `<span class="opportunity"><b>Espaço</b>${escapeHtml(text)}</span>`).join("")}
        </div>
      </section>
      <aside class="context-inspector opponent-inspector">
        <header class="inspector-header"><div><p class="eyebrow">Scout report</p><h3>Como o rival joga</h3></div>${crest(opponent, "small")}</header>
        <p class="opponent-plan">${escapeHtml(report.plan || "Controle do centro e aceleração pelos corredores.")}</p>
        <div class="rival-phase-grid">
          ${Object.entries(report.phases || {}).slice(0, 5).map(([label, value]) => `
            <span><b>${Math.round(value)}</b><small>${escapeHtml(label)}</small></span>
          `).join("")}
        </div>
        <div class="rival-block">
          <p class="eyebrow">Onde atacar</p>
          ${(report.vulnerabilities || []).slice(0, 2).map((text, index) => `
            <div><b>0${index + 1}</b><span>${escapeHtml(text)}</span></div>
          `).join("")}
        </div>
        <div class="rival-block key">
          <p class="eyebrow">Atenção</p>
          ${keyPlayers.map(player => `
            <div><span class="mini-shirt">${escapeHtml(player.shirtNumber ?? "—")}</span><span><strong>${escapeHtml(player.name)}</strong><small>${escapeHtml((player.positions || [player.position]).slice(0, 2).join(" · "))} · OVR ${overallFor(player)}</small></span></div>
          `).join("")}
        </div>
      </aside>
    </div>
  `;
}

function renderPrematchScene() {
  if (ui.prematchTab === "matchday") return renderMatchdayScene();
  if (ui.prematchTab === "formation") return renderFormationScene();
  if (ui.prematchTab === "roles") return renderRolesScene();
  if (ui.prematchTab === "instructions") return renderInstructionsScene();
  if (ui.prematchTab === "opponent") return renderOpponentScene();
  return renderSquadScene();
}

function renderPrematch() {
  const activeIndex = PREMATCH_SCENES.findIndex(scene => scene.id === ui.prematchTab);
  const content = renderPrematchScene();
  const meta = matchData.meta || {};

  app.innerHTML = `
    <div class="app-viewport">
      <main class="app-shell">
        <section class="prematch-screen">
          ${phaseHeader()}
          <div class="prematch-body">
            <nav class="prematch-navigation" aria-label="Preparação da partida">
              <div class="scene-tabs">
                ${PREMATCH_SCENES.map((scene, index) => `
                  <button
                    class="scene-tab ${ui.prematchTab === scene.id ? "active" : ""}"
                    data-action="prematch-tab"
                    data-tab="${scene.id}"
                    aria-pressed="${ui.prematchTab === scene.id}"
                  ><span>${scene.short}</span><strong>${scene.label}</strong><small>0${index + 1}</small></button>
                `).join("")}
              </div>
              <div class="scene-context">
                <span>Premier League · MW ${escapeHtml(meta.matchweek || 9)}</span>
                <strong>${prematchStatusLabel()}</strong>
              </div>
            </nav>
            <div class="prematch-panel ${ui.animateScene ? `scene-${ui.sceneDirection}` : "scene-static"}" data-scene="${escapeHtml(ui.prematchTab)}" style="--scene-index:${Math.max(0, activeIndex)}">
              ${content}
            </div>
          </div>
        </section>
        <div id="surface-root"></div>
      </main>
    </div>
  `;

  ui.animateScene = false;
  if (ui.confirmationOpen) renderConfirmation();
}

function renderConfirmation() {
  const surface = document.querySelector("#surface-root");
  if (!surface) return;
  const validation = validateLineup();
  const team = getUserTeam();
  const opponent = getOpponentTeam();
  const tactics = getUserTactics();
  const lineupPlayers = getUserLineup().map(id => playerById(team, id)).filter(Boolean);
  const lowestCondition = lineupPlayers.slice().sort((a, b) => (a.condition ?? 100) - (b.condition ?? 100))[0];
  surface.innerHTML = `
    <div class="surface-layer">
      <button class="surface-scrim" data-action="close-confirmation" aria-label="Voltar à preparação"></button>
      <section class="workspace compact" role="dialog" aria-modal="true" aria-labelledby="confirmation-title">
        <header class="workspace-header">
          <div class="workspace-header-copy">
            <p class="eyebrow">Confirmação pré-jogo</p>
            <h2 id="confirmation-title">Seu plano está pronto</h2>
            <p>As mudanças ainda podem ser revistas antes do apito inicial.</p>
          </div>
          <button class="icon-button" data-action="close-confirmation" aria-label="Fechar">×</button>
        </header>
        <div class="workspace-body">
          <div class="confirmation-score">
            ${crest(opponent)}
            <span class="confirmation-vs">${escapeHtml(opponent.shortName)} × ${escapeHtml(team.shortName)}</span>
            ${crest(team)}
          </div>
          <div class="confirmation-grid">
            <div class="confirmation-item"><span>Formação</span><strong>${escapeHtml(tactics.formation)}</strong></div>
            <div class="confirmation-item"><span>Plano</span><strong>${tactics.mentality > 60 ? "Agressivo" : tactics.mentality < 44 ? "Cauteloso" : "Equilibrado"}</strong></div>
            <div class="confirmation-item"><span>Menor condição</span><strong>${escapeHtml(lowestCondition?.name || "—")} · ${Math.round(lowestCondition?.condition || 0)}%</strong></div>
          </div>
          <ul class="validation-list">
            <li><span class="validation-icon">${validation.eleven ? "✓" : "!"}</span> Exatamente 11 titulares selecionados</li>
            <li><span class="validation-icon">${validation.goalkeeper ? "✓" : "!"}</span> Goleiro e estrutura defensiva válidos</li>
            <li><span class="validation-icon">${validation.available ? "✓" : "!"}</span> Nenhum atleta indisponível entre os titulares</li>
            <li><span class="validation-icon">i</span> Ratings são estimativas internas; elenco com snapshot em ${dataCutoffLabel()}</li>
          </ul>
        </div>
        <footer class="workspace-footer">
          <button class="secondary-button" data-action="close-confirmation">Voltar e ajustar</button>
          <button class="primary-button" data-action="start-match" ${validation.valid ? "" : "disabled"}>
            Começar partida <span aria-hidden="true">→</span>
          </button>
        </footer>
      </section>
    </div>
  `;
  document.querySelector(".prematch-screen")?.setAttribute("inert", "");
  queueMicrotask(() => surface.querySelector(".workspace button")?.focus());
}

function createEngine() {
  engine = new MatchEngine({
    home: matchData.home,
    away: matchData.away,
    homeLineup: matchData.homeLineup,
    awayLineup: matchData.awayLineup,
    homeTactics: matchData.homeTactics,
    awayTactics: matchData.awayTactics,
    seed: matchData.seed || MvpData.MATCH_META?.seed || 20260730,
    realDurationSeconds: 120,
    aiTeamIndexes: [1 - matchData.userTeamIndex],
    strictInvariants: true
  });
  latestHandledEventId = 0;
  engine.subscribe(({ type, payload }) => {
    if (type === "event" && payload.event) handleEngineEvent(payload.event);
  });
}

function renderScoreTeam(team, side) {
  return `
    <div class="score-team ${side === "away" ? "away" : ""}">
      <span>${escapeHtml(team.shortName)}</span>
      ${crest(team, "small")}
    </div>
  `;
}

function renderMatchBase() {
  const snapshot = engine.getSnapshot();
  const home = matchData.home;
  const away = matchData.away;
  app.innerHTML = `
    <div class="app-viewport">
      <main class="app-shell">
        <section class="match-screen">
          <header class="match-hud">
            <div class="match-context">
              ${competitionMark()}
              <div class="match-context-copy">
                <strong>${escapeHtml(MvpData.MATCH_META?.competition?.name || "Premier League")} · Matchweek ${escapeHtml(matchData.meta?.matchweek || 9)}</strong>
                <span>${escapeHtml(matchData.meta?.venue || "Stamford Bridge")} · protótipo não oficial</span>
              </div>
            </div>
            <div class="scoreboard">
              ${renderScoreTeam(home, "home")}
              <div class="score-centre">
                <div class="score-line">
                  <span id="home-score">${snapshot.score[0]}</span>
                  <span class="score-divider">×</span>
                  <span id="away-score">${snapshot.score[1]}</span>
                </div>
                <div class="match-clock">
                  <span id="clock-live-dot" class="clock-live-dot ${snapshot.paused ? "paused" : ""}"></span>
                  <span id="match-clock">${formatClock(snapshot.clockSeconds)}</span>
                  <span id="match-phase-label">1º tempo</span>
                </div>
              </div>
              ${renderScoreTeam(away, "away")}
            </div>
            <div class="hud-controls">
              <button class="icon-button" id="pause-button" data-action="toggle-pause" aria-label="Pausar ou retomar">
                ${snapshot.paused ? "▶" : "Ⅱ"}
              </button>
              <div class="speed-control" aria-label="Velocidade">
                ${[1, 2, 4].map(speed => `
                  <button
                    class="speed-button ${snapshot.speed === speed ? "active" : ""}"
                    data-action="set-speed"
                    data-speed="${speed}"
                    aria-pressed="${snapshot.speed === speed}"
                  >
                    ${speed}×
                  </button>
                `).join("")}
              </div>
            </div>
          </header>
          <div class="pitch-stage">
            <canvas class="pitch-canvas" id="pitch-canvas" tabindex="0" aria-label="Campo da partida em visão tática"></canvas>
            <div id="live-event" class="live-event" role="status"></div>
            <div id="pending-chip"></div>
          </div>
          <div class="match-action-dock">
            <div class="action-group">
              <button class="action-tile primary" data-action="open-surface" data-surface="tactics">
                Área técnica <span class="shortcut">T</span>
              </button>
              <button class="action-tile" data-action="open-surface" data-surface="squad">
                Jogadores
              </button>
              <button class="action-tile" data-action="open-surface" data-surface="substitutions">
                Substituições <span class="shortcut">S</span>
              </button>
            </div>
            <div class="data-trigger">
              <button class="action-tile" data-action="open-surface" data-surface="data">
                Dados da partida <span class="shortcut">D</span>
              </button>
            </div>
          </div>
        </section>
        <div id="surface-root"></div>
      </main>
    </div>
  `;

  const canvas = document.querySelector("#pitch-canvas");
  renderer?.destroy();
  renderer = new PitchRenderer(canvas);
  renderer.connect(engine);
  updateMatchHud();
}

function startMatchLoop() {
  cancelAnimationFrame(matchAnimationFrame);
  matchLastFrameAt = performance.now();
  const frame = now => {
    const delta = Math.min(0.1, Math.max(0, (now - matchLastFrameAt) / 1000));
    matchLastFrameAt = now;
    engine?.tick(delta);
    updateMatchHud();
    if (engine?.getSnapshot().phase === "fulltime") {
      finishMatch();
      return;
    }
    matchAnimationFrame = requestAnimationFrame(frame);
  };
  matchAnimationFrame = requestAnimationFrame(frame);
}

function startMatch() {
  ui.confirmationOpen = false;
  ui.phase = "match";
  ui.activeSurface = null;
  ui.selectedPlayerId = null;
  createEngine();
  renderMatchBase();
  engine.start();
  startMatchLoop();
}

function phaseLabel(snapshot) {
  if (snapshot.phase === "fulltime") return "Encerrada";
  if (snapshot.phase === "halftime") return "Intervalo";
  if (snapshot.clockSeconds >= 45 * 60) return "2º tempo";
  if (snapshot.paused) return "Pausado";
  return "1º tempo";
}

function updateMatchHud() {
  if (!engine || ui.phase !== "match") return;
  const snapshot = engine.getSnapshot();
  const homeScore = document.querySelector("#home-score");
  const awayScore = document.querySelector("#away-score");
  const clock = document.querySelector("#match-clock");
  const label = document.querySelector("#match-phase-label");
  const dot = document.querySelector("#clock-live-dot");
  const pause = document.querySelector("#pause-button");
  if (homeScore) homeScore.textContent = snapshot.score[0];
  if (awayScore) awayScore.textContent = snapshot.score[1];
  if (clock) clock.textContent = formatClock(snapshot.clockSeconds);
  if (label) label.textContent = phaseLabel(snapshot);
  if (dot) dot.classList.toggle("paused", snapshot.paused);
  if (pause) pause.textContent = snapshot.paused ? "▶" : "Ⅱ";
  document.querySelectorAll(".speed-button").forEach(button => {
    const active = Number(button.dataset.speed) === snapshot.speed;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  const userTeamState = snapshot.teams[matchData.userTeamIndex];
  const pending = document.querySelector("#pending-chip");
  if (pending) {
    const messages = [];
    if (userTeamState.pendingTactics) messages.push("Plano aguardando interrupção");
    if (userTeamState.pendingSubstitution) messages.push("Troca aguardando interrupção");
    pending.innerHTML = messages.length
      ? `<span class="pending-chip"><span class="status-dot"></span>${messages.join(" · ")}</span>`
      : "";
  }

  const newest = snapshot.events[0];
  if (newest && newest.id > latestHandledEventId) handleEngineEvent(newest);
}

function showEventBanner(event) {
  const banner = document.querySelector("#live-event");
  if (!banner) return;
  const visibleTypes = new Set(["goal", "redCard", "yellowCard", "injury", "substitution", "tacticalChange"]);
  if (!visibleTypes.has(event.type)) return;
  const title = event.type === "goal"
    ? `${minuteLabel(event)} · GOL`
    : `${minuteLabel(event)} · ${EVENT_LABELS[event.type] || event.type}`;
  banner.className = `live-event visible ${event.type === "goal" ? "goal" : ""}`;
  banner.innerHTML = `<strong>${escapeHtml(title)}</strong><span>${escapeHtml(event.description)}</span>`;
  clearTimeout(ui.bannerTimeout);
  ui.bannerTimeout = setTimeout(() => banner.classList.remove("visible"), event.type === "goal" ? 3600 : 2400);
}

function handleEngineEvent(event) {
  if (!event || event.id <= latestHandledEventId) return;
  latestHandledEventId = event.id;
  showEventBanner(event);

  if (event.type === "halftime" && ui.phase === "match") {
    engine.setPaused(true);
    ui.activeSurface = "halftime";
    renderActiveSurface();
  }

  if (event.type === "injury" && event.teamIndex === matchData.userTeamIndex && ui.phase === "match") {
    engine.setPaused(true);
    ui.substitutionOut = event.playerId;
    ui.substitutionIn = null;
    ui.activeSurface = "substitutions";
    renderActiveSurface();
  }
}

function setPaused(value) {
  if (!engine) return;
  engine.setPaused(value);
  updateMatchHud();
}

function openSurface(name) {
  if (!engine || ui.phase !== "match") return;
  engine.setPaused(true);
  ui.lastFocus = document.activeElement;
  ui.returnSurface = null;
  ui.activeSurface = name;
  ui.substitutionOut = null;
  ui.substitutionIn = null;
  ui.substitutionError = null;
  if (name === "tactics") {
    ui.liveTacticsDraft = clone(engine.getSnapshot().teams[matchData.userTeamIndex].tactics);
  }
  renderActiveSurface();
  updateMatchHud();
}

function closeSurface() {
  if (ui.activeSurface === "halftime") return;
  if (ui.returnSurface) {
    ui.activeSurface = ui.returnSurface;
    ui.returnSurface = null;
    renderActiveSurface();
    return;
  }
  ui.activeSurface = null;
  const root = document.querySelector("#surface-root");
  if (root) root.innerHTML = "";
  document.querySelector(".match-screen")?.removeAttribute("inert");
  ui.lastFocus?.focus?.();
}

function liveProfileRows(profile) {
  return [
    ["Geral", profile.overall],
    ["Defesa", profile.defence],
    ["Meio-campo", profile.midfield],
    ["Ataque", profile.attack],
    ["Encaixe", `${profile.fit}%`]
  ].map(([label, value]) => `
    <div class="live-profile-row"><span>${label}</span><strong>${value}</strong></div>
  `).join("");
}

function renderLiveTacticsSurface() {
  const snapshot = engine.getSnapshot();
  const teamState = snapshot.teams[matchData.userTeamIndex];
  const team = teamState.team;
  const draft = ui.liveTacticsDraft || clone(teamState.tactics);
  const profile = calculateTeamProfile(team, teamState.players.map(player => player.id), draft);
  return `
    <section class="workspace" role="dialog" aria-modal="true" aria-labelledby="live-tactics-title">
      <header class="workspace-header">
        <div class="workspace-header-copy">
          <p class="eyebrow">Partida pausada · ${formatClock(snapshot.clockSeconds)}</p>
          <h2 id="live-tactics-title">Área técnica</h2>
          <p>Mudanças estruturais entram na próxima interrupção e aparecem no campo.</p>
        </div>
        <button class="icon-button" data-action="close-surface" aria-label="Fechar">×</button>
      </header>
      <div class="workspace-body">
        <div class="live-tactics-grid">
          <aside class="live-team-summary">
            <div class="live-team-summary-header">
              ${crest(team, "small")}
              <div><strong>${escapeHtml(team.shortName)}</strong><span>${escapeHtml(draft.formation)} · plano em jogo</span></div>
            </div>
            <div class="live-profile-list">${liveProfileRows(profile)}</div>
            <div class="pending-plan">
              ${teamState.pendingTactics
                ? "Existe um plano preparado. Confirmar novamente substituirá o ajuste pendente."
                : "Ajuste os controles e prepare o plano. O jogo não muda por texto: as peças convergem às novas zonas."}
            </div>
          </aside>
          <div>
            ${tacticControls(draft, "live")}
            ${renderRoleEditor(team, teamState.players.map(player => player.id), draft, "live")}
          </div>
        </div>
      </div>
      <footer class="workspace-footer">
        <button class="secondary-button" data-action="reset-live-tactics">Reverter rascunho</button>
        <button class="primary-button" data-action="apply-live-tactics">Preparar para a próxima parada</button>
      </footer>
    </section>
  `;
}

function squadStatusForState(playerState) {
  if (playerState.redCard) return { text: "Expulso", className: "danger" };
  if (playerState.injured) return { text: "Lesionado", className: "warning" };
  if (playerState.yellowCards) return { text: `${playerState.yellowCards} amarelo`, className: "warning" };
  return { text: "Em campo", className: "success" };
}

function renderLiveSquadSurface() {
  const snapshot = engine.getSnapshot();
  const teamState = snapshot.teams[matchData.userTeamIndex];
  const all = [
    ...teamState.players.map(player => ({ ...player.player, matchState: player, inField: true })),
    ...teamState.bench.map(player => ({ ...player, matchState: null, inField: false }))
  ];
  return `
    <section class="workspace" role="dialog" aria-modal="true" aria-labelledby="squad-title">
      <header class="workspace-header">
        <div class="workspace-header-copy">
          <p class="eyebrow">Condição ao vivo</p>
          <h2 id="squad-title">Jogadores</h2>
          <p>Número, função, energia e contribuição usam o estado atual da partida.</p>
        </div>
        <button class="icon-button" data-action="close-surface" aria-label="Fechar">×</button>
      </header>
      <div class="workspace-body" style="padding:0">
        <table class="roster-table">
          <thead>
            <tr><th>Nº</th><th>Jogador</th><th>Função</th><th>OVR</th><th>Energia</th><th>Nota</th><th>Estado</th></tr>
          </thead>
          <tbody>
            ${all.map(player => {
              const state = player.matchState;
              const status = state ? squadStatusForState(state) : { text: "Banco", className: "" };
              const energy = Math.round(state?.stamina ?? player.condition ?? 90);
              return `
                <tr class="roster-row ${player.inField ? "starter" : ""}">
                  <td><span class="shirt-number">${escapeHtml(player.shirtNumber ?? "—")}</span></td>
                  <td><span class="roster-name">${escapeHtml(player.name)}</span><span class="roster-secondary">${escapeHtml((player.positions || [player.position]).join(" · "))}</span></td>
                  <td><span class="position-tag">${escapeHtml(state?.role || player.position || "—")}</span></td>
                  <td><span class="overall">${overallFor(player)}</span></td>
                  <td><span class="tabular">${energy}%</span><div class="micro-bar ${energy < 65 ? "low" : ""}"><span style="--value:${energy}%"></span></div></td>
                  <td><strong class="tabular">${state ? Number(state.stats.rating).toFixed(1) : "—"}</strong></td>
                  <td><span class="pill ${status.className}">${status.text}</span></td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
      <footer class="workspace-footer">
        <span class="muted" style="font-size:9px">OVR é um resumo interno por função; não decide sozinho o rendimento.</span>
        <button class="secondary-button" data-action="close-surface">Fechar</button>
      </footer>
    </section>
  `;
}

function renderSubstitutionSurface() {
  const snapshot = engine.getSnapshot();
  const team = snapshot.teams[matchData.userTeamIndex];
  const outgoing = team.players.find(player => String(player.id) === String(ui.substitutionOut));
  const incoming = team.bench.find(player => String(player.id) === String(ui.substitutionIn));
  const used = team.substitutionsUsed ?? team.substitutionCount ?? 0;
  const blocked = Boolean(team.pendingSubstitution) || used >= 5;
  return `
    <section class="workspace" role="dialog" aria-modal="true" aria-labelledby="sub-title">
      <header class="workspace-header">
        <div class="workspace-header-copy">
          <p class="eyebrow">${used}/5 trocas utilizadas · ${formatClock(snapshot.clockSeconds)}</p>
          <h2 id="sub-title">Preparar substituição</h2>
          <p>Escolha quem sai e quem entra. A troca será aplicada numa interrupção válida.</p>
        </div>
        <button class="icon-button" data-action="close-surface" aria-label="Fechar">×</button>
      </header>
      <div class="workspace-body">
        <div class="substitution-grid">
          <div class="player-select-list">
            <div class="select-list-header">Sai de campo</div>
            ${team.players.filter(player => !player.redCard).map(player => `
              <button
                class="sub-player ${String(ui.substitutionOut) === String(player.id) ? "selected" : ""}"
                data-action="select-sub-out"
                data-player-id="${escapeHtml(player.id)}"
              >
                <span class="sub-player-number">${escapeHtml(player.player.shirtNumber ?? "—")}</span>
                <span class="sub-player-copy"><strong>${escapeHtml(player.player.name)}</strong><span>${escapeHtml(player.role)} · nota ${Number(player.stats.rating).toFixed(1)}</span></span>
                <span class="condition-number">${Math.round(player.stamina)}%</span>
              </button>
            `).join("")}
          </div>
          <div class="sub-arrow" aria-hidden="true">→</div>
          <div class="player-select-list">
            <div class="select-list-header">Entra do banco</div>
            ${team.bench.map(player => `
              <button
                class="sub-player ${String(ui.substitutionIn) === String(player.id) ? "selected" : ""}"
                data-action="select-sub-in"
                data-player-id="${escapeHtml(player.id)}"
              >
                <span class="sub-player-number">${escapeHtml(player.shirtNumber ?? "—")}</span>
                <span class="sub-player-copy"><strong>${escapeHtml(player.name)}</strong><span>${escapeHtml((player.positions || [player.position]).join(" · "))} · OVR ${overallFor(player)}</span></span>
                <span class="condition-number">${Math.round(player.condition ?? 92)}%</span>
              </button>
            `).join("")}
          </div>
        </div>
        ${outgoing && incoming ? `
          <div class="sub-comparison">
            <div><span>Energia</span><strong>${Math.round(outgoing.stamina)}% → ${Math.round(incoming.condition ?? 92)}%</strong></div>
            <div><span>OVR na função</span><strong>${overallFor(outgoing.player)} → ${overallFor(incoming)}</strong></div>
            <div><span>Função herdada</span><strong>${escapeHtml(outgoing.role)}</strong></div>
          </div>
        ` : ""}
        ${ui.substitutionError ? `<p class="surface-alert" role="alert">${escapeHtml(ui.substitutionError)}</p>` : ""}
      </div>
      <footer class="workspace-footer">
        <span class="muted" style="font-size:9px">${team.pendingSubstitution ? "Já existe uma troca aguardando interrupção." : "A peça nova herda o slot; seus atributos e energia passam a valer."}</span>
        <button class="primary-button" data-action="queue-substitution" ${outgoing && incoming && !blocked ? "" : "disabled"}>
          Confirmar troca
        </button>
      </footer>
    </section>
  `;
}

function possessionPercent(snapshot) {
  const total = snapshot.teams.reduce((sum, team) => sum + team.stats.possessionSeconds, 0);
  if (!total) return [50, 50];
  const home = Math.round(snapshot.teams[0].stats.possessionSeconds / total * 100);
  return [home, 100 - home];
}

function statDefinitions(snapshot) {
  const home = snapshot.teams[0].stats;
  const away = snapshot.teams[1].stats;
  const possession = possessionPercent(snapshot);
  const passPct = team => team.passesAttempted
    ? Math.round(team.passesCompleted / team.passesAttempted * 100)
    : 0;
  return [
    ["Posse", `${possession[0]}%`, `${possession[1]}%`, possession[0]],
    ["Finalizações", home.shots, away.shots, home.shots / Math.max(1, home.shots + away.shots) * 100],
    ["No alvo", home.shotsOnTarget, away.shotsOnTarget, home.shotsOnTarget / Math.max(1, home.shotsOnTarget + away.shotsOnTarget) * 100],
    ["xG", home.xG.toFixed(2), away.xG.toFixed(2), home.xG / Math.max(0.01, home.xG + away.xG) * 100],
    ["Precisão passe", `${passPct(home)}%`, `${passPct(away)}%`, passPct(home) / Math.max(1, passPct(home) + passPct(away)) * 100],
    ["Escanteios", home.corners, away.corners, home.corners / Math.max(1, home.corners + away.corners) * 100],
    ["Faltas", home.fouls, away.fouls, home.fouls / Math.max(1, home.fouls + away.fouls) * 100],
    ["Impedimentos", home.offsides, away.offsides, home.offsides / Math.max(1, home.offsides + away.offsides) * 100],
    ["Amarelos", home.yellowCards, away.yellowCards, home.yellowCards / Math.max(1, home.yellowCards + away.yellowCards) * 100],
    ["Vermelhos", home.redCards, away.redCards, home.redCards / Math.max(1, home.redCards + away.redCards) * 100]
  ];
}

function renderStats(snapshot) {
  return `
    <div class="stats-grid">
      ${statDefinitions(snapshot).map(([label, home, away, width]) => `
        <div class="stat-comparison">
          <span class="stat-name">${label}</span>
          <div class="stat-values"><span>${home}</span><span>${away}</span></div>
          <div class="stat-track" style="--left:${clamp(width, 0, 100)}%"><span></span><span></span></div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderTimeline(snapshot, limit = 60) {
  const interesting = snapshot.events
    .filter(event => !["keyPass", "substitutionPrepared"].includes(event.type))
    .slice(0, limit);
  if (!interesting.length) {
    return `<p class="muted">Os eventos estruturados aparecerão aqui conforme a partida se desenvolve.</p>`;
  }
  return `
    <div class="timeline">
      ${interesting.map(event => `
        <div class="timeline-event">
          <span class="event-minute">${minuteLabel(event)}</span>
          <span class="event-team-dot ${event.teamIndex === 0 ? "home" : event.teamIndex === 1 ? "away" : ""}"></span>
          <span>${escapeHtml(event.description)}</span>
          <span class="event-type">${escapeHtml(EVENT_LABELS[event.type] || event.type)}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function renderDataSurface() {
  const snapshot = engine.getSnapshot();
  return `
    <section class="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="data-title">
      <header class="sheet-header">
        <div class="tabs">
          <button class="tab-button ${ui.dataTab === "summary" ? "active" : ""}" data-action="data-tab" data-tab="summary" aria-pressed="${ui.dataTab === "summary"}" id="data-title">Resumo</button>
          <button class="tab-button ${ui.dataTab === "timeline" ? "active" : ""}" data-action="data-tab" data-tab="timeline" aria-pressed="${ui.dataTab === "timeline"}">Linha do tempo</button>
        </div>
        <button class="icon-button" data-action="close-surface" aria-label="Fechar">×</button>
      </header>
      <div class="sheet-content">
        ${ui.dataTab === "timeline" ? renderTimeline(snapshot) : renderStats(snapshot)}
      </div>
    </section>
  `;
}

function halftimeInsight(snapshot) {
  const user = snapshot.teams[matchData.userTeamIndex].stats;
  const opponent = snapshot.teams[1 - matchData.userTeamIndex].stats;
  if (user.xG + 0.25 < opponent.xG) {
    return "O rival chegou a zonas melhores. Recuar ligeiramente a linha ou reduzir o risco pode proteger as perdas antes de acelerar.";
  }
  if (user.shots > opponent.shots && user.goals <= opponent.goals) {
    return "O volume existe, mas a qualidade das chances ainda é baixa. Mais largura pode abrir o corredor para finalizar de frente.";
  }
  return "O jogo está equilibrado. O maior risco agora é a queda de energia: pressão mais alta cria recuperações, mas cobra o segundo tempo.";
}

function renderHalftimeSurface() {
  const snapshot = engine.getSnapshot();
  const stats = statDefinitions(snapshot).slice(0, 4);
  return `
    <section class="workspace compact" role="dialog" aria-modal="true" aria-labelledby="halftime-title">
      <header class="workspace-header">
        <div class="workspace-header-copy">
          <p class="eyebrow">45:00 · intervalo</p>
          <h2 id="halftime-title">Leitura do primeiro tempo</h2>
          <p>O relógio está parado. Ajuste o plano ou retome quando estiver pronto.</p>
        </div>
      </header>
      <div class="workspace-body">
        <div class="halftime-score">
          ${crest(matchData.home, "small")}
          <span class="halftime-number">${snapshot.score[0]} × ${snapshot.score[1]}</span>
          ${crest(matchData.away, "small")}
        </div>
        <div class="confirmation-grid">
          ${stats.slice(0, 3).map(([label, home, away]) => `
            <div class="confirmation-item"><span>${label}</span><strong>${home} × ${away}</strong></div>
          `).join("")}
        </div>
        <div class="halftime-insight"><strong>Diagnóstico:</strong> ${escapeHtml(halftimeInsight(snapshot))}</div>
      </div>
      <footer class="workspace-footer">
        <button class="secondary-button" data-action="halftime-tactics">Ajustar time</button>
        <button class="primary-button" data-action="resume-second-half">Voltar ao jogo</button>
      </footer>
    </section>
  `;
}

function renderActiveSurface() {
  const root = document.querySelector("#surface-root");
  if (!root) return;
  if (!ui.activeSurface) {
    root.innerHTML = "";
    return;
  }
  const content = ui.activeSurface === "tactics"
    ? renderLiveTacticsSurface()
    : ui.activeSurface === "squad"
      ? renderLiveSquadSurface()
      : ui.activeSurface === "substitutions"
        ? renderSubstitutionSurface()
        : ui.activeSurface === "data"
          ? renderDataSurface()
          : renderHalftimeSurface();
  root.innerHTML = `
    <div class="surface-layer ${ui.activeSurface === "data" ? "bottom-surface" : ""}">
      <button class="surface-scrim" ${ui.activeSurface === "halftime" ? "disabled" : "data-action=\"close-surface\""} aria-label="Fechar painel"></button>
      ${content}
    </div>
  `;
  document.querySelector(".match-screen")?.setAttribute("inert", "");
  queueMicrotask(() => root.querySelector(".workspace button, .bottom-sheet button")?.focus?.());
}

function finishMatch() {
  if (ui.phase === "postmatch") return;
  cancelAnimationFrame(matchAnimationFrame);
  ui.phase = "postmatch";
  ui.activeSurface = null;
  renderer?.destroy();
  renderer = null;
  renderPostmatch();
}

function teamParticipants(team, teamIndex) {
  const participants = [
    ...team.players,
    ...team.substitutionHistory.map(change => change.outgoingState).filter(Boolean)
  ];
  const unique = new Map();
  participants.forEach(player => unique.set(String(player.id), { ...player, teamIndex }));
  return [...unique.values()];
}

function manOfMatch(snapshot) {
  const all = snapshot.teams.flatMap((team, teamIndex) => teamParticipants(team, teamIndex));
  return all.sort((a, b) => Number(b.stats.rating) - Number(a.stats.rating))[0];
}

function postCauses(snapshot) {
  const user = snapshot.teams[matchData.userTeamIndex];
  const opponent = snapshot.teams[1 - matchData.userTeamIndex];
  const causes = [];
  if (user.stats.xG > opponent.stats.xG + 0.3) {
    causes.push(`O seu plano produziu ${user.stats.xG.toFixed(2)} xG contra ${opponent.stats.xG.toFixed(2)}, chegando a zonas de maior valor.`);
  } else if (user.stats.xG + 0.3 < opponent.stats.xG) {
    causes.push(`O rival criou as chances mais valiosas: ${opponent.stats.xG.toFixed(2)} xG. A proteção após perda foi o principal ponto de atenção.`);
  } else {
    causes.push("A qualidade das chances foi equilibrada; a eficiência das finalizações teve peso maior no resultado.");
  }
  const possession = possessionPercent(snapshot);
  const userPossession = possession[matchData.userTeamIndex];
  causes.push(userPossession > 55
    ? `Com ${userPossession}% de posse, sua equipe controlou mais sequências, mas o risco do passe definiu onde elas terminaram.`
    : `Com ${userPossession}% de posse, seu time passou mais tempo reagindo e dependeu das transições.`);
  const userTeam = snapshot.teams[matchData.userTeamIndex];
  const avgEnergy = userTeam.players.reduce((sum, player) => sum + player.stamina, 0) / Math.max(1, userTeam.players.length);
  causes.push(`A energia média terminou em ${Math.round(avgEnergy)}%; ritmo e pressão afetaram diretamente a distância e a velocidade das peças.`);
  return causes;
}

function ratingsRows(snapshot) {
  return snapshot.teams
    .flatMap((team, teamIndex) => teamParticipants(team, teamIndex))
    .sort((a, b) => b.stats.rating - a.stats.rating)
    .slice(0, 14)
    .map(player => `
    <tr>
      <td>${escapeHtml(player.player.name)}</td>
      <td>${escapeHtml(snapshot.teams[player.teamIndex].team.shortName)}</td>
      <td>${escapeHtml(player.role)}</td>
      <td>${player.stats.goals || "—"}</td>
      <td class="${player.stats.rating >= 7 ? "rating-good" : ""}">${Number(player.stats.rating).toFixed(1)}</td>
    </tr>
  `).join("");
}

function goalScorers(snapshot, teamIndex) {
  return snapshot.events
    .filter(event => event.type === "goal" && event.teamIndex === teamIndex)
    .slice()
    .reverse()
    .map(event => `${event.description.replace(/^Gol de /, "").replace(/\.$/, "")} ${event.minute}'`)
    .join(", ") || "—";
}

function renderPostmatch() {
  const snapshot = engine.getSnapshot();
  const mom = manOfMatch(snapshot);
  const momTeam = snapshot.teams[mom.teamIndex].team;
  const possession = possessionPercent(snapshot);
  const events = snapshot.events.filter(event =>
    ["goal", "yellowCard", "redCard", "injury", "substitution"].includes(event.type)
  );
  app.innerHTML = `
    <div class="app-viewport">
      <main class="app-shell">
        <section class="postmatch-screen">
          <div class="postmatch-inner">
            <div class="postmatch-topbar">
              <div class="brand-lockup">
                <span class="brand-symbol" aria-hidden="true"></span>
                <div class="brand-copy"><strong>Matchday</strong><span>Relatório final</span></div>
              </div>
              <div class="header-actions">
                <button class="secondary-button" data-action="back-to-prep">Voltar à preparação</button>
                <button class="primary-button" data-action="play-again">Jogar novamente</button>
              </div>
            </div>
            <div class="postmatch-title">
              <p class="eyebrow">Fim de jogo · partida única</p>
              <h1>${snapshot.score[0] === snapshot.score[1] ? "Um jogo decidido nos detalhes" : "A partida contou uma história própria"}</h1>
            </div>
            <div class="final-score">
              <div class="final-team">
                <div><strong>${escapeHtml(matchData.home.shortName)}</strong><span>${escapeHtml(goalScorers(snapshot, 0))}</span></div>
                ${crest(matchData.home, "large")}
              </div>
              <div class="final-result">${snapshot.score[0]} × ${snapshot.score[1]}</div>
              <div class="final-team away">
                <div><strong>${escapeHtml(matchData.away.shortName)}</strong><span>${escapeHtml(goalScorers(snapshot, 1))}</span></div>
                ${crest(matchData.away, "large")}
              </div>
            </div>
            <div class="postmatch-stats">
              ${[
                ["Posse", `${possession[0]}% × ${possession[1]}%`],
                ["Finalizações", `${snapshot.teams[0].stats.shots} × ${snapshot.teams[1].stats.shots}`],
                ["No alvo", `${snapshot.teams[0].stats.shotsOnTarget} × ${snapshot.teams[1].stats.shotsOnTarget}`],
                ["xG", `${snapshot.teams[0].stats.xG.toFixed(2)} × ${snapshot.teams[1].stats.xG.toFixed(2)}`],
                ["Eventos-chave", events.length]
              ].map(([label, value]) => `<div class="post-stat"><span>${label}</span><strong>${value}</strong></div>`).join("")}
            </div>
            <div class="postmatch-columns">
              <div>
                <article class="post-card">
                  <h2>Melhor em campo</h2>
                  <div class="man-of-match">
                    <span class="mom-number">${escapeHtml(mom.player.shirtNumber ?? "—")}</span>
                    <div><strong>${escapeHtml(mom.player.name)}</strong><span>${escapeHtml(momTeam.shortName)} · nota ${Number(mom.stats.rating).toFixed(1)}</span></div>
                  </div>
                  <ul class="cause-list">
                    ${postCauses(snapshot).map((cause, index) => `
                      <li><span class="insight-index">${index + 1}</span><span>${escapeHtml(cause)}</span></li>
                    `).join("")}
                  </ul>
                </article>
                <article class="post-card" style="margin-top:10px">
                  <h2>Eventos da partida</h2>
                  ${renderTimeline(snapshot, 14)}
                </article>
              </div>
              <article class="post-card">
                <h2>Notas dos jogadores</h2>
                <table class="ratings-table">
                  <thead><tr><th>Jogador</th><th>Clube</th><th>Função</th><th>Gols</th><th>Nota</th></tr></thead>
                  <tbody>${ratingsRows(snapshot)}</tbody>
                </table>
              </article>
            </div>
          </div>
        </section>
      </main>
    </div>
  `;
}

function swapPlayers(firstId, secondId) {
  const lineup = [...getUserLineup()];
  const firstIndex = lineup.findIndex(id => String(id) === String(firstId));
  const secondIndex = lineup.findIndex(id => String(id) === String(secondId));
  ui.lineupHistory.push([...lineup]);
  if (ui.lineupHistory.length > 20) ui.lineupHistory.shift();

  if (firstIndex >= 0 && secondIndex >= 0) {
    [lineup[firstIndex], lineup[secondIndex]] = [lineup[secondIndex], lineup[firstIndex]];
  } else if (firstIndex >= 0) {
    lineup[firstIndex] = secondId;
  } else if (secondIndex >= 0) {
    lineup[secondIndex] = firstId;
  } else {
    ui.lineupHistory.pop();
    return;
  }
  setUserLineup(lineup);
}

function selectPrematchPlayer(id) {
  if (ui.selectedPlayerId == null) {
    ui.selectedPlayerId = id;
  } else if (String(ui.selectedPlayerId) === String(id)) {
    ui.selectedPlayerId = null;
  } else {
    swapPlayers(ui.selectedPlayerId, id);
    ui.selectedPlayerId = null;
  }
  renderPrematch();
}

function castTacticValue(key, raw) {
  if (key === "formation") return String(raw);
  if (key === "counterpress") return String(raw) === "true";
  return Number(raw);
}

function updateTactic(scope, key, raw, rerender = true) {
  const value = castTacticValue(key, raw);
  if (scope === "live") {
    ui.liveTacticsDraft = {
      ...ui.liveTacticsDraft,
      [key]: value,
      ...(key === "formation" ? { playerPositions: {} } : {})
    };
    ensurePlayerRoles(
      engine.getSnapshot().teams[matchData.userTeamIndex].team,
      engine.getSnapshot().teams[matchData.userTeamIndex].players.map(player => player.id),
      ui.liveTacticsDraft
    );
    if (rerender) renderActiveSurface();
  } else {
    const tactics = {
      ...getUserTactics(),
      [key]: value,
      ...(key === "formation" ? { playerPositions: {} } : {})
    };
    ensurePlayerRoles(getUserTeam(), getUserLineup(), tactics);
    setUserTactics(tactics);
    if (rerender) renderPrematch();
  }
}

function updatePlayerRole(scope, playerId, role) {
  if (!PLAYER_ROLE_OPTIONS.includes(role)) return;
  if (scope === "live") {
    ui.liveTacticsDraft = {
      ...ui.liveTacticsDraft,
      playerRoles: {
        ...(ui.liveTacticsDraft.playerRoles || {}),
        [playerId]: role
      }
    };
    renderActiveSurface();
    return;
  }
  const tactics = {
    ...getUserTactics(),
    playerRoles: {
      ...(getUserTactics().playerRoles || {}),
      [playerId]: role
    }
  };
  setUserTactics(tactics);
  renderPrematch();
}

function applyTacticPreset(name) {
  const presets = {
    control: {
      mentality: 52,
      width: 57,
      tempo: 48,
      passingRisk: 44,
      defensiveLine: 53,
      pressing: 55,
      counterpress: true
    },
    press: {
      mentality: 64,
      width: 62,
      tempo: 68,
      passingRisk: 57,
      defensiveLine: 70,
      pressing: 76,
      counterpress: true
    },
    transition: {
      mentality: 58,
      width: 66,
      tempo: 72,
      passingRisk: 66,
      defensiveLine: 43,
      pressing: 48,
      counterpress: false
    }
  };
  const preset = presets[name];
  if (!preset) return;
  const tactics = ensurePlayerRoles(getUserTeam(), getUserLineup(), {
    ...getUserTactics(),
    ...preset
  });
  setUserTactics(tactics);
  renderPrematch();
}

function resetPlayerPositions() {
  setUserTactics({
    ...getUserTactics(),
    playerPositions: {}
  });
  ui.positionFeedback = "Slots restaurados";
  renderPrematch();
}

function storeDraggedPosition(playerId, candidate) {
  const lineup = getUserLineup();
  const index = lineup.findIndex(id => String(id) === String(playerId));
  if (index < 0) return;
  const tactics = getUserTactics();
  const formation = FORMATIONS[tactics.formation] || FORMATIONS["4-2-3-1"];
  const slot = formation[index] || formation.at(-1);
  const sanitized = sanitizePlayerPosition(candidate, slot.role, slot);
  const player = playerById(getUserTeam(), playerId);
  setUserTactics({
    ...tactics,
    playerPositions: {
      ...(tactics.playerPositions || {}),
      [String(playerId)]: { x: sanitized.x, y: sanitized.y }
    }
  });
  ui.positionFeedback = sanitized.clamped
    ? `${compactName(player?.name, 18)} ficou no limite da sua zona`
    : `${compactName(player?.name, 18)} reposicionado`;
  ui.selectedPlayerId = playerId;
}

function resumeSecondHalf() {
  ui.activeSurface = null;
  ui.returnSurface = null;
  const root = document.querySelector("#surface-root");
  if (root) root.innerHTML = "";
  document.querySelector(".match-screen")?.removeAttribute("inert");
  if (typeof engine.resumeFromHalftime === "function") engine.resumeFromHalftime();
  else {
    engine.state.phase = "secondHalf";
    engine.state.paused = false;
  }
  updateMatchHud();
}

function resetToPreparation() {
  cancelAnimationFrame(matchAnimationFrame);
  renderer?.destroy();
  renderer = null;
  engine = null;
  matchData = MvpData.createMvpMatchData();
  ensureMatchRoles();
  ui.phase = "prematch";
  ui.prematchTab = "matchday";
  ui.sceneDirection = "backward";
  ui.animateScene = true;
  ui.selectedPlayerId = null;
  ui.selectedRolePlayerId = null;
  ui.positionFeedback = null;
  ui.confirmationOpen = false;
  ui.lineupHistory = [];
  renderPrematch();
}

function handleClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const action = target.dataset.action;
  if (
    target.closest("[data-drag-player]") &&
    Date.now() < ui.suppressPitchClickUntil
  ) return;

  if (action === "prematch-tab") {
    const currentIndex = PREMATCH_SCENES.findIndex(scene => scene.id === ui.prematchTab);
    const nextIndex = PREMATCH_SCENES.findIndex(scene => scene.id === target.dataset.tab);
    ui.sceneDirection = nextIndex >= currentIndex ? "forward" : "backward";
    ui.animateScene = true;
    ui.prematchTab = target.dataset.tab;
    ui.selectedPlayerId = null;
    renderPrematch();
  } else if (action === "filter-roster") {
    ui.rosterFilter = target.dataset.filter;
    renderPrematch();
  } else if (action === "select-roster-player" || action === "select-lineup-player") {
    selectPrematchPlayer(target.dataset.playerId);
  } else if (action === "select-role-player") {
    ui.selectedRolePlayerId = target.dataset.playerId;
    ui.selectedPlayerId = target.dataset.playerId;
    renderPrematch();
  } else if (action === "set-role-button") {
    updatePlayerRole("prematch", target.dataset.playerId, target.dataset.role);
  } else if (action === "reset-player-positions") {
    resetPlayerPositions();
  } else if (action === "apply-tactic-preset") {
    applyTacticPreset(target.dataset.preset);
  } else if (action === "undo-lineup") {
    const previous = ui.lineupHistory.pop();
    if (previous) setUserLineup(previous);
    ui.selectedPlayerId = null;
    renderPrematch();
  } else if (action === "set-tactic") {
    updateTactic(target.dataset.scope, target.dataset.key, target.dataset.value);
  } else if (action === "open-confirmation") {
    ui.lastFocus = target;
    ui.confirmationOpen = true;
    renderConfirmation();
  } else if (action === "close-confirmation") {
    ui.confirmationOpen = false;
    const root = document.querySelector("#surface-root");
    if (root) root.innerHTML = "";
    document.querySelector(".prematch-screen")?.removeAttribute("inert");
    ui.lastFocus?.focus?.();
  } else if (action === "start-match") {
    startMatch();
  } else if (action === "toggle-pause") {
    if (ui.activeSurface) closeSurface();
    setPaused(!engine.getSnapshot().paused);
  } else if (action === "set-speed") {
    engine.setSpeed(Number(target.dataset.speed));
    updateMatchHud();
  } else if (action === "open-surface") {
    openSurface(target.dataset.surface);
  } else if (action === "close-surface") {
    closeSurface();
  } else if (action === "reset-live-tactics") {
    ui.liveTacticsDraft = clone(engine.getSnapshot().teams[matchData.userTeamIndex].tactics);
    renderActiveSurface();
  } else if (action === "apply-live-tactics") {
    engine.queueTactics(matchData.userTeamIndex, ui.liveTacticsDraft);
    closeSurface();
    updateMatchHud();
  } else if (action === "select-sub-out") {
    ui.substitutionOut = target.dataset.playerId;
    ui.substitutionError = null;
    renderActiveSurface();
  } else if (action === "select-sub-in") {
    ui.substitutionIn = target.dataset.playerId;
    ui.substitutionError = null;
    renderActiveSurface();
  } else if (action === "queue-substitution") {
    const result = engine.queueSubstitution(
      matchData.userTeamIndex,
      ui.substitutionOut,
      ui.substitutionIn
    );
    if (result?.ok) closeSurface();
    else {
      ui.substitutionError = result?.reason || "A troca não pôde ser preparada.";
      renderActiveSurface();
    }
    updateMatchHud();
  } else if (action === "data-tab") {
    ui.dataTab = target.dataset.tab;
    renderActiveSurface();
  } else if (action === "halftime-tactics") {
    ui.liveTacticsDraft = clone(engine.getSnapshot().teams[matchData.userTeamIndex].tactics);
    ui.returnSurface = "halftime";
    ui.activeSurface = "tactics";
    renderActiveSurface();
  } else if (action === "resume-second-half") {
    resumeSecondHalf();
  } else if (action === "play-again" || action === "back-to-prep") {
    resetToPreparation();
  }
}

function handleInput(event) {
  const target = event.target.closest('[data-action="range-tactic"]');
  if (!target) return;
  const output = document.querySelector(`#${target.id}-output`);
  if (output) output.textContent = target.value;
  updateTactic(target.dataset.scope, target.dataset.key, target.value, false);
}

function handleChange(event) {
  const range = event.target.closest('[data-action="range-tactic"]');
  if (range) {
    if (range.dataset.scope === "live") renderActiveSurface();
    else renderPrematch();
    return;
  }
  const target = event.target.closest('[data-action="set-player-role"]');
  if (!target) return;
  updatePlayerRole(target.dataset.scope, target.dataset.playerId, target.value);
}

function handleKeyboard(event) {
  if (event.defaultPrevented) return;
  if (event.key === "Escape") {
    if (ui.confirmationOpen) {
      ui.confirmationOpen = false;
      document.querySelector("#surface-root").innerHTML = "";
      document.querySelector(".prematch-screen")?.removeAttribute("inert");
    } else if (ui.activeSurface && ui.activeSurface !== "halftime") {
      closeSurface();
    }
    return;
  }
  if (
    ui.phase !== "match" ||
    event.target.closest?.("button, input, select, textarea, a, [contenteditable='true']")
  ) return;
  const key = event.key.toLowerCase();
  if (event.code === "Space") {
    event.preventDefault();
    if (ui.activeSurface === "halftime") return;
    if (ui.activeSurface) closeSurface();
    if (ui.activeSurface) return;
    setPaused(!engine.getSnapshot().paused);
  } else if (["1", "2", "4"].includes(key)) {
    engine.setSpeed(Number(key));
  } else if (key === "t") {
    openSurface("tactics");
  } else if (key === "s") {
    openSurface("substitutions");
  } else if (key === "d") {
    openSurface("data");
  }
}

function handlePitchPointerDown(event) {
  if (ui.phase !== "prematch") return;
  if (Number.isFinite(event.button) && event.button !== 0) return;
  const piece = event.target.closest?.("[data-drag-player]");
  const pitch = piece?.closest?.('[data-tactical-pitch="true"]');
  if (!piece || !pitch) return;
  const rect = pitch.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  pitchDrag = {
    pointerId: event.pointerId,
    piece,
    pitch,
    rect,
    playerId: piece.dataset.dragPlayer,
    startX: Number(event.clientX),
    startY: Number(event.clientY),
    x: null,
    y: null,
    moved: false
  };
  piece.setPointerCapture?.(event.pointerId);
}

function handlePitchPointerMove(event) {
  if (!pitchDrag) return;
  if (
    pitchDrag.pointerId != null &&
    event.pointerId != null &&
    event.pointerId !== pitchDrag.pointerId
  ) return;
  const dx = Number(event.clientX) - pitchDrag.startX;
  const dy = Number(event.clientY) - pitchDrag.startY;
  if (!pitchDrag.moved && Math.hypot(dx, dy) < 4) return;
  pitchDrag.moved = true;
  event.preventDefault();
  const localLeft = clamp(
    (Number(event.clientX) - pitchDrag.rect.left) / pitchDrag.rect.width,
    0.068,
    0.932
  );
  const localTop = clamp(
    (Number(event.clientY) - pitchDrag.rect.top) / pitchDrag.rect.height,
    0.086,
    0.914
  );
  pitchDrag.x = clamp((localLeft - 0.04) / 0.92, 0.03, 0.97);
  pitchDrag.y = clamp((localTop - 0.05) / 0.90, 0.04, 0.96);
  pitchDrag.piece.classList.add("dragging");
  pitchDrag.piece.style.left = `${4 + pitchDrag.x * 92}%`;
  pitchDrag.piece.style.top = `${5 + pitchDrag.y * 90}%`;
}

function finishPitchDrag(event, cancelled = false) {
  if (!pitchDrag) return;
  if (
    pitchDrag.pointerId != null &&
    event.pointerId != null &&
    event.pointerId !== pitchDrag.pointerId
  ) return;
  const completed = pitchDrag;
  pitchDrag = null;
  completed.piece.releasePointerCapture?.(completed.pointerId);
  completed.piece.classList.remove("dragging");
  if (!cancelled && completed.moved && completed.x != null && completed.y != null) {
    storeDraggedPosition(completed.playerId, { x: completed.x, y: completed.y });
    ui.suppressPitchClickUntil = Date.now() + 420;
    renderPrematch();
  }
}

async function hydrateProviderData() {
  try {
    const status = await getProviderStatus();
    if (!status.configured) return;
    const [homeApi, awayApi] = await Promise.all([
      getTeam(matchData.home.id),
      getTeam(matchData.away.id)
    ]);
    if (
      homeApi.source === "live" &&
      awayApi.source === "live" &&
      typeof MvpData.mergeTeamWithApi === "function"
    ) {
      matchData.home = MvpData.mergeTeamWithApi(matchData.home.id, homeApi, {
        providerConfigured: true,
        provider: status.provider
      });
      matchData.away = MvpData.mergeTeamWithApi(matchData.away.id, awayApi, {
        providerConfigured: true,
        provider: status.provider
      });
    }
    ui.dataStatus = {
      live: homeApi.source === "live" && awayApi.source === "live",
      label: homeApi.source === "live" && awayApi.source === "live"
        ? "Provedor conectado"
        : "Snapshot local verificado",
      provider: status.provider || "football-data.org"
    };
  } catch (error) {
    console.info("Provider opcional indisponível; o snapshot local permanece ativo.", error);
  }
}

async function init() {
  app.innerHTML = `
    <div class="app-viewport">
      <main class="app-shell">
        <div class="loading-screen">
          <div class="loading-mark">
            <span class="loading-ball" aria-hidden="true"></span>
            <span>Preparando a partida…</span>
          </div>
        </div>
      </main>
    </div>
  `;
  matchData = MvpData.createMvpMatchData();
  await hydrateProviderData();
  ensureMatchRoles();
  ui.phase = "prematch";
  renderPrematch();
}

app.addEventListener("click", handleClick);
app.addEventListener("input", handleInput);
app.addEventListener("change", handleChange);
app.addEventListener("pointerdown", handlePitchPointerDown);
app.addEventListener("pointermove", handlePitchPointerMove);
app.addEventListener("pointerup", event => finishPitchDrag(event));
app.addEventListener("pointercancel", event => finishPitchDrag(event, true));
app.addEventListener("error", event => {
  const image = event.target;
  if (image instanceof HTMLImageElement && image.classList.contains("competition-logo")) {
    image.hidden = true;
    const fallback = image.nextElementSibling;
    if (fallback?.classList.contains("competition-logo-fallback")) fallback.hidden = false;
    return;
  }
  if (!(image instanceof HTMLImageElement) || !image.classList.contains("team-crest")) return;
  image.hidden = true;
  const fallback = image.nextElementSibling;
  if (fallback?.classList.contains("crest-fallback")) fallback.hidden = false;
}, true);
app.addEventListener("keydown", event => {
  const piece = event.target.closest?.("[data-drag-player]");
  if (piece && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
    event.preventDefault();
    const playerId = piece.dataset.dragPlayer;
    const lineup = getUserLineup();
    const index = lineup.findIndex(id => String(id) === String(playerId));
    const tactics = getUserTactics();
    const formation = FORMATIONS[tactics.formation] || FORMATIONS["4-2-3-1"];
    const slot = formation[index] || formation.at(-1);
    const current = tactics.playerPositions?.[String(playerId)] || slot;
    const step = event.shiftKey ? 0.045 : 0.022;
    storeDraggedPosition(playerId, {
      x: Number(current.x) + (event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0),
      y: Number(current.y) + (event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0)
    });
    renderPrematch();
    requestAnimationFrame(() => {
      [...app.querySelectorAll("[data-drag-player]")]
        .find(candidate => String(candidate.dataset.dragPlayer) === String(playerId))
        ?.focus();
    });
    return;
  }
  const row = event.target.closest?.(".roster-row[data-action]");
  if (row && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    selectPrematchPlayer(row.dataset.playerId);
  }
});
document.addEventListener("keydown", handleKeyboard);

init().catch(error => {
  console.error(error);
  app.innerHTML = `
    <div class="app-viewport">
      <main class="app-shell">
        <div class="loading-screen">
          <div class="loading-mark">
            <strong>Não foi possível preparar a partida.</strong>
            <span>${escapeHtml(error.message)}</span>
          </div>
        </div>
      </main>
    </div>
  `;
});

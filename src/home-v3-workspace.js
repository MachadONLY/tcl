import "./home-v3-workspace.css";

const VIEW_META = {
  inbox: {
    title: "Caixa de entrada",
    eyebrow: "CLUBE",
    description: "Mensagens e decisões"
  },
  news: {
    title: "Touchline News",
    eyebrow: "MUNDO DO FUTEBOL",
    description: "A história da sua carreira"
  },
  competition: {
    title: "Premier League",
    eyebrow: "COMPETIÇÃO",
    description: "Tabela e líderes"
  }
};

function createViewButton(view, label, badge = "") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `v3-window-dot ${view}`;
  button.dataset.v3View = view;
  button.setAttribute("aria-label", label);
  button.setAttribute("aria-pressed", "false");
  button.title = label;

  const visual = document.createElement("span");
  visual.className = "v3-dot-visual";
  button.append(visual);

  if (badge) {
    const counter = document.createElement("i");
    counter.textContent = badge;
    counter.setAttribute("aria-hidden", "true");
    button.append(counter);
  }

  return button;
}

function createPane(view, node) {
  const pane = document.createElement("section");
  pane.className = `v3-workspace-pane v3-pane-${view}`;
  pane.dataset.v3Pane = view;
  pane.setAttribute("aria-hidden", "true");
  pane.append(node);
  return pane;
}

function enhanceHome() {
  if (window.location.hash === "#matchday") return true;

  const root = document.querySelector(".career-v2");
  if (!root) return false;
  if (root.dataset.v3WorkspaceReady === "true") return true;

  const grid = root.querySelector(".v2-grid");
  const matchCard = root.querySelector(".v2-next-match");
  const mailbox = root.querySelector(".v2-mailbox");
  const competition = root.querySelector("[data-competition-panel]");
  const news = root.querySelector(".v2-editorial-news");

  if (!grid || !matchCard || !mailbox || !competition || !news) return false;

  root.dataset.v3WorkspaceReady = "true";

  const unread = mailbox.querySelector(":scope > header > b")?.textContent?.trim() || "";

  const layout = document.createElement("section");
  layout.className = "v3-career-layout";

  const matchStage = document.createElement("section");
  matchStage.className = "v3-match-stage";
  matchStage.append(matchCard);

  const workspace = document.createElement("aside");
  workspace.className = "v3-workspace";
  workspace.setAttribute("aria-label", "Central de informações da carreira");

  const toolbar = document.createElement("header");
  toolbar.className = "v3-workspace-toolbar";
  toolbar.innerHTML = `
    <div class="v3-window-controls" role="group" aria-label="Alternar conteúdo da central"></div>
    <div class="v3-workspace-heading">
      <span data-v3-eyebrow></span>
      <strong data-v3-title></strong>
      <small data-v3-description></small>
    </div>
    <span class="v3-view-index" aria-hidden="true"><b data-v3-index>2</b>/3</span>
  `;

  const controls = toolbar.querySelector(".v3-window-controls");
  controls.append(
    createViewButton("inbox", "Abrir caixa de entrada", unread),
    createViewButton("news", "Abrir notícias"),
    createViewButton("competition", "Abrir competição")
  );

  const body = document.createElement("div");
  body.className = "v3-workspace-body";
  body.append(
    createPane("inbox", mailbox),
    createPane("news", news),
    createPane("competition", competition)
  );

  workspace.append(toolbar, body);
  layout.append(matchStage, workspace);
  grid.replaceChildren(layout);

  let currentView = "news";

  function setView(view, animate = true) {
    if (!VIEW_META[view]) return;
    currentView = view;

    workspace.classList.toggle("v3-no-transition", !animate);
    workspace.dataset.activeView = view;

    const order = ["inbox", "news", "competition"];
    const activeIndex = order.indexOf(view);

    workspace.querySelectorAll("[data-v3-view]").forEach(button => {
      const active = button.dataset.v3View === view;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    workspace.querySelectorAll("[data-v3-pane]").forEach(pane => {
      const paneIndex = order.indexOf(pane.dataset.v3Pane);
      const active = pane.dataset.v3Pane === view;
      pane.classList.toggle("active", active);
      pane.classList.toggle("before", paneIndex < activeIndex);
      pane.classList.toggle("after", paneIndex > activeIndex);
      pane.setAttribute("aria-hidden", String(!active));
    });

    const meta = VIEW_META[view];
    toolbar.querySelector("[data-v3-eyebrow]").textContent = meta.eyebrow;
    toolbar.querySelector("[data-v3-title]").textContent = meta.title;
    toolbar.querySelector("[data-v3-description]").textContent = meta.description;
    toolbar.querySelector("[data-v3-index]").textContent = String(activeIndex + 1);

    window.requestAnimationFrame(() => workspace.classList.remove("v3-no-transition"));
  }

  controls.addEventListener("click", event => {
    const button = event.target.closest("[data-v3-view]");
    if (button) setView(button.dataset.v3View);
  });

  controls.addEventListener("keydown", event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const order = ["inbox", "news", "competition"];
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextIndex = (order.indexOf(currentView) + direction + order.length) % order.length;
    setView(order[nextIndex]);
    controls.querySelector(`[data-v3-view="${order[nextIndex]}"]`)?.focus();
  });

  root.addEventListener("click", event => {
    if (event.target.closest('[data-nav="inbox"]')) setView("inbox");
    if (event.target.closest("[data-open-competition]")) setView("competition");
  }, true);

  setView("news", false);
  return true;
}

function boot() {
  if (enhanceHome()) return;

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (enhanceHome() || attempts > 80) window.clearInterval(timer);
  }, 25);
}

boot();

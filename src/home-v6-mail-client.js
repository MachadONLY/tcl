import "./home-v6-mail-client.css";

const READ_KEY = "touchline.clubMail.read.v1";
const DELETED_KEY = "touchline.clubMail.deleted.v1";

const CLUB_MAIL = [
  {
    id: "mainoo-opportunity",
    sender: "Kobbie Mainoo",
    role: "Jogador · Meio-campista",
    initials: "KM",
    number: "37",
    time: "18:04",
    date: "Hoje",
    priority: "Pessoal",
    tone: "player",
    subject: "Quero uma oportunidade na equipe principal",
    preview: "Mister, sinto que estou pronto para ajudar mais e gostaria de conversar sobre meus minutos.",
    greeting: "Mister,",
    paragraphs: [
      "Queria falar diretamente com você antes da próxima partida. Tenho trabalhado forte nos treinos e sinto que estou pronto para ajudar mais a equipe.",
      "Entendo que a concorrência no meio-campo é alta e respeito todas as decisões, mas acredito que posso oferecer energia, controle sob pressão e intensidade na recuperação da bola.",
      "Gostaria de ter uma oportunidade na equipe principal, mesmo que inicialmente seja entrando durante o jogo. Quero mostrar que posso assumir mais responsabilidade nesta temporada."
    ],
    signoff: "Kobbie",
    attachment: { label: "Relatório de treino", meta: "Últimas 4 semanas · 1,2 MB", type: "PDF" },
    primaryAction: "Conversar com jogador"
  },
  {
    id: "fitness-availability",
    sender: "Dra. Helena Costa",
    role: "Preparação física",
    initials: "HC",
    time: "16:18",
    date: "Hoje",
    priority: "Importante",
    tone: "medical",
    subject: "Três jogadores não estão aptos para iniciar",
    preview: "Shaw, Mount e Ugarte exigem controle de carga antes do jogo contra o Chelsea.",
    greeting: "Gabriel,",
    paragraphs: [
      "Finalizamos a avaliação física após a sessão desta tarde. Luke Shaw e Mason Mount não atingiram os critérios mínimos para iniciar a partida.",
      "Manuel Ugarte está disponível, mas apresenta fadiga acumulada e recomendamos limitar sua participação a aproximadamente 55 minutos. Bruno Fernandes também deve ter a carga monitorada durante o segundo tempo.",
      "A recomendação da equipe de performance é ajustar a escalação inicial e preparar uma substituição preventiva no meio-campo."
    ],
    signoff: "Dra. Helena Costa\nPerformance e medicina",
    attachment: { label: "Disponibilidade do elenco", meta: "Relatório médico · 864 KB", type: "MED" },
    primaryAction: "Revisar escalação"
  },
  {
    id: "assistant-chelsea",
    sender: "Jason McCarthy",
    role: "Assistente técnico",
    initials: "JM",
    time: "Ontem",
    date: "30 de outubro",
    priority: "Análise",
    tone: "staff",
    subject: "O espaço que podemos atacar em Stamford Bridge",
    preview: "O Chelsea deixa um corredor vulnerável quando o lateral avança e Palmer fecha por dentro.",
    greeting: "Gabriel,",
    paragraphs: [
      "Revimos os últimos quatro jogos do Chelsea e encontramos um padrão consistente no lado direito da defesa deles.",
      "Quando Reece James avança, o zagueiro é obrigado a defender uma área muito grande. Cunha pode receber por dentro e liberar Dorgu no corredor, especialmente após recuperações no setor central.",
      "Também recomendo orientar nossa pressão para o lado esquerdo deles. Isso reduz o acesso de Palmer entre as linhas e aumenta a chance de recuperarmos a bola de frente para o gol."
    ],
    signoff: "Jason",
    attachment: { label: "Chelsea · padrões defensivos", meta: "12 clipes · 04:36", type: "VID" },
    primaryAction: "Abrir análise"
  },
  {
    id: "board-expectation",
    sender: "Omar Berrada",
    role: "Diretoria executiva",
    initials: "OB",
    time: "Terça",
    date: "27 de outubro",
    priority: "Diretoria",
    tone: "board",
    subject: "Expectativas para a sequência da temporada",
    preview: "A posição atual é positiva, mas o clube espera consistência e classificação para a Champions League.",
    greeting: "Gabriel,",
    paragraphs: [
      "A direção reconhece a evolução recente da equipe e a resposta positiva do elenco ao seu modelo de jogo.",
      "Nossa expectativa principal continua sendo a classificação para a Champions League. O resultado em Stamford Bridge será importante, mas a avaliação do trabalho seguirá considerando desempenho, desenvolvimento de jovens e disciplina financeira.",
      "Esperamos que as próximas semanas consolidem o clube entre as quatro primeiras posições."
    ],
    signoff: "Omar Berrada\nChief Executive Officer",
    attachment: { label: "Objetivos da temporada", meta: "Documento da diretoria · 420 KB", type: "DOC" },
    primaryAction: "Confirmar leitura"
  }
];

const icon = {
  inbox: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4zM4 7l8 6 8-6"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>',
  archive: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v13H4zM3 4h18v4H3zM9 12h6"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  paperclip: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 12 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l8-8"/></svg>'
};

function loadSet(key) {
  try {
    const value = JSON.parse(window.localStorage.getItem(key) || "[]");
    return new Set(Array.isArray(value) ? value : []);
  } catch {
    return new Set();
  }
}

const mailState = {
  filter: "all",
  query: "",
  read: loadSet(READ_KEY),
  deleted: loadSet(DELETED_KEY),
  selected: null
};

function persistState() {
  window.localStorage.setItem(READ_KEY, JSON.stringify([...mailState.read]));
  window.localStorage.setItem(DELETED_KEY, JSON.stringify([...mailState.deleted]));
}

function visibleMail() {
  return CLUB_MAIL.filter(mail => {
    if (mailState.deleted.has(mail.id)) return false;
    if (mailState.filter === "unread" && mailState.read.has(mail.id)) return false;
    const haystack = `${mail.sender} ${mail.role} ${mail.subject} ${mail.preview}`.toLowerCase();
    return haystack.includes(mailState.query.toLowerCase().trim());
  });
}

function avatar(mail, large = false) {
  return `<span class="v6-mail-avatar ${mail.tone} ${large ? "large" : ""}"><b>${mail.initials}</b>${mail.number ? `<small>${mail.number}</small>` : ""}</span>`;
}

function renderMailRows() {
  const items = visibleMail();
  if (!items.length) {
    return `<div class="v6-mail-empty"><span>${icon.inbox}</span><strong>Nenhuma mensagem aqui</strong><small>Novas conversas do elenco, comissão e diretoria aparecerão nesta caixa.</small><button data-v6-reset type="button">Mostrar todas</button></div>`;
  }

  return items.map(mail => {
    const unread = !mailState.read.has(mail.id);
    return `<article class="v6-mail-row ${unread ? "unread" : "read"}" data-v6-mail-id="${mail.id}">
      <button class="v6-mail-open" data-v6-open="${mail.id}" type="button" aria-label="Abrir e-mail de ${mail.sender}: ${mail.subject}">
        <span class="v6-unread-dot" aria-hidden="true"></span>
        ${avatar(mail)}
        <span class="v6-mail-summary">
          <span class="v6-mail-sender"><strong>${mail.sender}</strong><time>${mail.time}</time></span>
          <b>${mail.subject}</b>
          <small>${mail.preview}</small>
          <span class="v6-mail-meta"><i>${mail.role}</i><em>${mail.priority}</em></span>
        </span>
      </button>
      <button class="v6-row-delete" data-v6-delete="${mail.id}" type="button" aria-label="Excluir e-mail de ${mail.sender}" title="Excluir">${icon.trash}</button>
    </article>`;
  }).join("");
}

function renderClient() {
  const unread = CLUB_MAIL.filter(mail => !mailState.deleted.has(mail.id) && !mailState.read.has(mail.id)).length;
  return `<section class="v6-mail-client" aria-label="Caixa de entrada do clube">
    <header class="v6-mail-client-head">
      <div class="v6-folder-title"><span>${icon.inbox}</span><div><strong>Principal</strong><small><b data-v6-unread-count>${unread}</b> não lidas · ${CLUB_MAIL.length - mailState.deleted.size} mensagens</small></div></div>
      <div class="v6-head-actions">
        <button data-v6-search-toggle type="button" aria-label="Pesquisar mensagens" title="Pesquisar">${icon.search}</button>
        <button data-v6-read-all type="button" aria-label="Marcar todas como lidas" title="Marcar todas como lidas">${icon.check}</button>
      </div>
    </header>
    <div class="v6-search-row" data-v6-search-row hidden>
      ${icon.search}<input data-v6-search type="search" placeholder="Pesquisar remetente ou assunto" autocomplete="off" />
      <button data-v6-search-close type="button" aria-label="Fechar pesquisa">${icon.close}</button>
    </div>
    <nav class="v6-mail-filters" aria-label="Filtros da caixa de entrada">
      <button class="${mailState.filter === "all" ? "active" : ""}" data-v6-filter="all" type="button">Todos</button>
      <button class="${mailState.filter === "unread" ? "active" : ""}" data-v6-filter="unread" type="button">Não lidos <span>${unread}</span></button>
      <i></i>
      <button class="v6-clean-read" data-v6-clear-read type="button">${icon.trash} Limpar lidos</button>
    </nav>
    <div class="v6-mail-list" data-v6-mail-list>${renderMailRows()}</div>
    <footer class="v6-mail-status"><span><i></i> Comunicações internas do clube</span><small>Atualizado agora</small></footer>
  </section>`;
}

function updateDotCounter() {
  const unread = CLUB_MAIL.filter(mail => !mailState.deleted.has(mail.id) && !mailState.read.has(mail.id)).length;
  const dot = document.querySelector(".v3-window-dot.inbox > i");
  if (!dot) return;
  dot.textContent = String(unread);
  dot.hidden = unread === 0;
}

function mountClient() {
  if (window.location.hash === "#matchday") return true;
  const pane = document.querySelector(".v3-pane-inbox");
  if (!pane) return false;
  if (pane.dataset.v6Mounted === "true") return true;

  pane.dataset.v6Mounted = "true";
  pane.replaceChildren();
  pane.insertAdjacentHTML("beforeend", renderClient());
  bindClient(pane);
  updateDotCounter();
  return true;
}

function refreshClient(pane = document.querySelector(".v3-pane-inbox")) {
  const list = pane?.querySelector("[data-v6-mail-list]");
  if (list) list.innerHTML = renderMailRows();

  const unread = CLUB_MAIL.filter(mail => !mailState.deleted.has(mail.id) && !mailState.read.has(mail.id)).length;
  pane?.querySelector("[data-v6-unread-count]")?.replaceChildren(document.createTextNode(String(unread)));
  pane?.querySelectorAll("[data-v6-filter]").forEach(button => button.classList.toggle("active", button.dataset.v6Filter === mailState.filter));
  const unreadFilter = pane?.querySelector('[data-v6-filter="unread"] span');
  if (unreadFilter) unreadFilter.textContent = String(unread);
  updateDotCounter();
}

function deleteMessage(id, pane) {
  mailState.deleted.add(id);
  persistState();
  const row = pane.querySelector(`[data-v6-mail-id="${CSS.escape(id)}"]`);
  row?.classList.add("removing");
  window.setTimeout(() => refreshClient(pane), 230);
}

function clearRead(pane) {
  CLUB_MAIL.forEach(mail => {
    if (mailState.read.has(mail.id)) mailState.deleted.add(mail.id);
  });
  persistState();
  pane.querySelectorAll(".v6-mail-row.read").forEach((row, index) => {
    window.setTimeout(() => row.classList.add("removing"), index * 35);
  });
  window.setTimeout(() => refreshClient(pane), 260);
}

function bindClient(pane) {
  pane.addEventListener("click", event => {
    const open = event.target.closest("[data-v6-open]");
    if (open) {
      openMessage(open.dataset.v6Open, pane);
      return;
    }

    const remove = event.target.closest("[data-v6-delete]");
    if (remove) {
      deleteMessage(remove.dataset.v6Delete, pane);
      return;
    }

    const filter = event.target.closest("[data-v6-filter]");
    if (filter) {
      mailState.filter = filter.dataset.v6Filter;
      refreshClient(pane);
      return;
    }

    if (event.target.closest("[data-v6-read-all]")) {
      CLUB_MAIL.forEach(mail => mailState.read.add(mail.id));
      persistState();
      refreshClient(pane);
      return;
    }

    if (event.target.closest("[data-v6-clear-read]")) {
      clearRead(pane);
      return;
    }

    if (event.target.closest("[data-v6-search-toggle]")) {
      const row = pane.querySelector("[data-v6-search-row]");
      row.hidden = false;
      row.querySelector("input")?.focus();
      return;
    }

    if (event.target.closest("[data-v6-search-close]")) {
      const row = pane.querySelector("[data-v6-search-row]");
      row.hidden = true;
      mailState.query = "";
      const input = row.querySelector("input");
      if (input) input.value = "";
      refreshClient(pane);
      return;
    }

    if (event.target.closest("[data-v6-reset]")) {
      mailState.filter = "all";
      mailState.query = "";
      refreshClient(pane);
    }
  });

  pane.addEventListener("input", event => {
    if (!event.target.matches("[data-v6-search]")) return;
    mailState.query = event.target.value;
    refreshClient(pane);
  });
}

function attachment(mail) {
  if (!mail.attachment) return "";
  return `<div class="v6-attachment-block"><span>Anexo</span><button type="button"><i>${mail.attachment.type}</i><span><strong>${mail.attachment.label}</strong><small>${mail.attachment.meta}</small></span><b>•••</b></button></div>`;
}

function openMessage(id, pane) {
  const mail = CLUB_MAIL.find(item => item.id === id);
  if (!mail) return;

  mailState.read.add(id);
  mailState.selected = id;
  persistState();
  refreshClient(pane);

  const layer = document.createElement("div");
  layer.className = "v2-modal-layer v6-mail-reader-layer visible";
  layer.innerHTML = `<button class="v6-reader-scrim" data-v6-close-reader aria-label="Fechar mensagem"></button>
    <article class="v6-mail-reader" role="dialog" aria-modal="true" aria-labelledby="v6-reader-title">
      <header class="v6-reader-topbar">
        <div><span>${icon.inbox}</span><strong>Mensagem do clube</strong></div>
        <div class="v6-reader-tools">
          <button data-v6-reader-archive type="button" aria-label="Arquivar mensagem" title="Arquivar">${icon.archive}</button>
          <button data-v6-reader-delete="${mail.id}" type="button" aria-label="Excluir mensagem" title="Excluir">${icon.trash}</button>
          <button data-v6-close-reader type="button" aria-label="Fechar mensagem" title="Fechar">${icon.close}</button>
        </div>
      </header>
      <section class="v6-reader-envelope">
        <div class="v6-reader-from">${avatar(mail, true)}<div><span>De</span><strong>${mail.sender}</strong><small>${mail.role}</small></div></div>
        <div class="v6-reader-date"><span>${mail.date}</span><time>${mail.time}</time></div>
      </section>
      <main class="v6-reader-content">
        <div class="v6-reader-labels"><span>${mail.priority}</span><small>Para Gabriel Machado</small></div>
        <h2 id="v6-reader-title">${mail.subject}</h2>
        <div class="v6-reader-copy"><p>${mail.greeting}</p>${mail.paragraphs.map(text => `<p>${text}</p>`).join("")}<p class="v6-signoff">${mail.signoff.replaceAll("\n", "<br>")}</p></div>
        ${attachment(mail)}
      </main>
      <footer class="v6-reader-footer">
        <button class="v6-reader-secondary" data-v6-reader-archive type="button">${icon.archive} Arquivar</button>
        <button class="v6-reader-primary" data-v6-reader-primary type="button">${mail.primaryAction} ${icon.arrow}</button>
      </footer>
    </article>`;

  document.body.append(layer);
  window.requestAnimationFrame(() => layer.classList.add("entered"));
  layer.querySelector(".v6-mail-reader")?.focus();

  const close = () => {
    layer.classList.remove("entered");
    window.setTimeout(() => layer.remove(), 220);
  };

  layer.addEventListener("click", event => {
    if (event.target.closest("[data-v6-close-reader]")) {
      close();
      return;
    }

    if (event.target.closest("[data-v6-reader-delete]")) {
      mailState.deleted.add(mail.id);
      persistState();
      refreshClient(pane);
      close();
      return;
    }

    if (event.target.closest("[data-v6-reader-archive]")) {
      mailState.deleted.add(mail.id);
      persistState();
      refreshClient(pane);
      close();
      return;
    }

    if (event.target.closest("[data-v6-reader-primary]")) close();
  });

  const onKeydown = event => {
    if (event.key !== "Escape") return;
    close();
    document.removeEventListener("keydown", onKeydown);
  };
  document.addEventListener("keydown", onKeydown);
}

function boot() {
  if (mountClient()) return;
  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (mountClient() || attempts > 120) window.clearInterval(timer);
  }, 25);
}

boot();

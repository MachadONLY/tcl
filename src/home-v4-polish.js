import "./home-v4-polish.css";

const DELETED_MAIL_KEY = "touchline.deletedMail.v1";

const EXTRA_ROWS = {
  standings: [
    { pos: 6, name: "Newcastle", tla: "NEW", crest: 67, played: 8, form: ["w", "l", "d", "w", "d"], gd: 4, value: 15 },
    { pos: 7, name: "Tottenham", tla: "TOT", crest: 73, played: 8, form: ["l", "w", "w", "d", "w"], gd: 3, value: 14 },
    { pos: 8, name: "Aston Villa", tla: "AVL", crest: 58, played: 8, form: ["w", "l", "w", "d", "l"], gd: 2, value: 13 }
  ],
  scorers: [
    { pos: 6, player: "Mohamed Salah", club: "Liverpool", tla: "LIV", crest: 64, played: 8, value: 6, label: "gols" },
    { pos: 7, player: "Bryan Mbeumo", club: "Man United", tla: "MUN", crest: 66, played: 8, value: 5, label: "gols", user: true },
    { pos: 8, player: "Ollie Watkins", club: "Aston Villa", tla: "AVL", crest: 58, played: 8, value: 5, label: "gols" }
  ],
  assists: [
    { pos: 6, player: "Mohamed Salah", club: "Liverpool", tla: "LIV", crest: 64, played: 8, value: 4, label: "assist." },
    { pos: 7, player: "Anthony Gordon", club: "Newcastle", tla: "NEW", crest: 67, played: 8, value: 4, label: "assist." },
    { pos: 8, player: "Bukayo Saka", club: "Arsenal", tla: "ARS", crest: 57, played: 8, value: 4, label: "assist." }
  ]
};

const trashIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
  </svg>
`;

const readIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 6h18v12H3zM4 8l8 6 8-6" />
  </svg>
`;

function readDeletedMail() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(DELETED_MAIL_KEY) || "[]");
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

const deletedMail = readDeletedMail();

function persistDeletedMail() {
  window.localStorage.setItem(DELETED_MAIL_KEY, JSON.stringify([...deletedMail]));
}

function updateInboxCounters(mailbox) {
  const visibleRows = [...mailbox.querySelectorAll(".v4-mail-item")].filter(row => !row.classList.contains("removing"));
  const unread = visibleRows.filter(row => !row.querySelector(".v2-mail")?.classList.contains("read")).length;
  const total = visibleRows.length;

  mailbox.querySelector("[data-v4-mail-count]")?.replaceChildren(document.createTextNode(`${total} ${total === 1 ? "mensagem" : "mensagens"}`));

  const headerCounter = mailbox.querySelector(":scope > header > b");
  if (headerCounter) headerCounter.textContent = String(unread);

  const windowCounter = document.querySelector(".v3-window-dot.inbox > i");
  if (windowCounter) {
    windowCounter.textContent = String(unread);
    windowCounter.hidden = unread === 0;
  }

  mailbox.classList.toggle("is-empty", total === 0);
  const emptyState = mailbox.querySelector(".v4-mail-empty");
  if (emptyState) emptyState.hidden = total !== 0;
}

function deleteMail(id, source) {
  if (!id) return;
  deletedMail.add(id);
  persistDeletedMail();

  const mailbox = document.querySelector(".v3-pane-inbox .v2-mailbox");
  const row = mailbox?.querySelector(`.v4-mail-item[data-v4-mail-id="${CSS.escape(id)}"]`);

  if (row) {
    row.classList.add("removing");
    window.setTimeout(() => {
      row.remove();
      updateInboxCounters(mailbox);
    }, 240);
  }

  if (source === "modal") {
    document.querySelector(".v2-mail-modal [data-close-modal]")?.click();
  }
}

function markAllRead(mailbox) {
  mailbox.querySelectorAll(".v2-mail").forEach(mail => mail.classList.add("read"));
  updateInboxCounters(mailbox);
}

function clearReadMail(mailbox) {
  const rows = [...mailbox.querySelectorAll(".v4-mail-item")];
  const readRows = rows.filter(row => row.querySelector(".v2-mail")?.classList.contains("read"));

  readRows.forEach((row, index) => {
    const id = row.dataset.v4MailId;
    if (id) deletedMail.add(id);
    window.setTimeout(() => row.classList.add("removing"), index * 45);
    window.setTimeout(() => row.remove(), 240 + index * 45);
  });

  persistDeletedMail();
  window.setTimeout(() => updateInboxCounters(mailbox), 300 + readRows.length * 45);
}

function createInboxToolbar(mailbox) {
  const toolbar = document.createElement("div");
  toolbar.className = "v4-mail-toolbar";
  toolbar.innerHTML = `
    <div class="v4-mail-folder">
      <span class="v4-mail-folder-icon">${readIcon}</span>
      <span><strong>Principal</strong><small data-v4-mail-count></small></span>
    </div>
    <div class="v4-mail-actions">
      <button type="button" data-v4-mark-read title="Marcar todas como lidas">${readIcon}<span>Marcar lidas</span></button>
      <button type="button" data-v4-clear-read title="Apagar mensagens lidas">${trashIcon}<span>Limpar lidas</span></button>
    </div>
  `;

  toolbar.querySelector("[data-v4-mark-read]")?.addEventListener("click", () => markAllRead(mailbox));
  toolbar.querySelector("[data-v4-clear-read]")?.addEventListener("click", () => clearReadMail(mailbox));
  return toolbar;
}

function createInboxFooter() {
  const footer = document.createElement("footer");
  footer.className = "v4-inbox-footer";
  footer.innerHTML = `
    <span class="v4-inbox-check">✓</span>
    <span><strong>Caixa organizada</strong><small>As mensagens importantes ficam sempre no topo.</small></span>
  `;

  const empty = document.createElement("div");
  empty.className = "v4-mail-empty";
  empty.hidden = true;
  empty.innerHTML = `
    <span>${readIcon}</span>
    <strong>Sua caixa está limpa</strong>
    <small>Novas mensagens da comissão e da diretoria aparecerão aqui.</small>
  `;

  footer.append(empty);
  return footer;
}

function enhanceMailbox(mailbox) {
  if (!mailbox || mailbox.dataset.v4Enhanced === "true") return;
  mailbox.dataset.v4Enhanced = "true";

  const title = mailbox.querySelector(":scope > header h2");
  if (title) title.textContent = "Mensagens";

  const list = mailbox.querySelector(".v2-mail-list");
  if (!list) return;

  mailbox.querySelector(":scope > header")?.after(createInboxToolbar(mailbox));
  list.after(createInboxFooter());

  [...list.querySelectorAll(":scope > .v2-mail")].forEach(mail => {
    const id = mail.dataset.mail || "";
    if (deletedMail.has(id)) {
      mail.remove();
      return;
    }

    const shell = document.createElement("div");
    shell.className = "v4-mail-item";
    shell.dataset.v4MailId = id;
    mail.before(shell);
    shell.append(mail);

    const unreadDot = document.createElement("span");
    unreadDot.className = "v4-mail-unread";
    unreadDot.setAttribute("aria-hidden", "true");
    shell.prepend(unreadDot);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "v4-mail-delete";
    deleteButton.title = "Apagar mensagem";
    deleteButton.setAttribute("aria-label", "Apagar mensagem");
    deleteButton.innerHTML = trashIcon;
    deleteButton.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      deleteMail(id, "row");
    });
    shell.append(deleteButton);
  });

  updateInboxCounters(mailbox);
}

function miniCrest(item) {
  return `
    <span class="v2-mini-crest">
      <img src="https://crests.football-data.org/${item.crest}.png" alt="" referrerpolicy="no-referrer" />
      <i>${item.tla}</i>
    </span>
  `;
}

function standingsRow(item) {
  return `
    <div class="v2-standing-row v4-extra-row">
      <span>${item.pos}</span>
      <span class="v2-team">${miniCrest(item)}<strong>${item.name}</strong></span>
      <span>${item.played}</span>
      <span class="v2-form">${item.form.map(result => `<i class="${result}"></i>`).join("")}</span>
      <span>${item.gd > 0 ? "+" : ""}${item.gd}</span>
      <b>${item.value}</b>
    </div>
  `;
}

function rankingRow(item) {
  return `
    <div class="v2-ranking-row v4-extra-row ${item.user ? "user" : ""}">
      <span>${item.pos}</span>
      <span class="v2-player">${miniCrest(item)}<span><strong>${item.player}</strong><small>${item.club}</small></span></span>
      <span>${item.played}</span>
      <b>${item.value}</b>
      <small>${item.label}</small>
    </div>
  `;
}

function activeCompetitionTab(panel) {
  const active = panel.querySelector(".v2-tabs button.active");
  if (active?.hasAttribute("data-tab")) return active.getAttribute("data-tab");
  return "standings";
}

function enhanceCompetition(panel) {
  if (!panel) return;
  const body = panel.querySelector("[data-competition-body]");
  if (!body) return;

  const tab = activeCompetitionTab(panel);
  if (body.dataset.v4Tab === tab && body.querySelectorAll(".v4-extra-row").length === 3) return;

  body.querySelectorAll(".v4-extra-row").forEach(row => row.remove());
  const rows = EXTRA_ROWS[tab] || EXTRA_ROWS.standings;
  body.insertAdjacentHTML("beforeend", rows.map(tab === "standings" ? standingsRow : rankingRow).join(""));
  body.dataset.v4Tab = tab;
  body.style.setProperty("--v4-row-count", String(body.querySelectorAll(".v2-standing-row, .v2-ranking-row").length));
}

function enhanceMailModal(modal) {
  if (!modal || modal.dataset.v4Enhanced === "true") return;
  modal.dataset.v4Enhanced = "true";

  const subject = modal.querySelector(".v2-modal-title h2")?.textContent?.trim();
  const matchingMail = [...document.querySelectorAll(".v4-mail-item")].find(row => {
    return row.querySelector(".v2-mail-copy > b")?.textContent?.trim() === subject;
  });
  const id = matchingMail?.dataset.v4MailId;

  const header = modal.querySelector(":scope > header");
  const footer = modal.querySelector(":scope > footer");

  const received = document.createElement("div");
  received.className = "v4-modal-received";
  received.innerHTML = `<span>Mensagem do clube</span><small>Recebida e armazenada na sua carreira</small>`;
  header?.after(received);

  if (footer && id) {
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "v4-modal-delete";
    deleteButton.innerHTML = `${trashIcon}<span>Apagar</span>`;
    deleteButton.addEventListener("click", () => deleteMail(id, "modal"));
    footer.prepend(deleteButton);
  }
}

function scan() {
  enhanceMailbox(document.querySelector(".v3-pane-inbox .v2-mailbox"));
  enhanceCompetition(document.querySelector(".v3-pane-competition [data-competition-panel]"));
  enhanceMailModal(document.querySelector(".v2-mail-modal"));
}

function boot() {
  if (window.location.hash === "#matchday") return;
  scan();

  const observer = new MutationObserver(() => window.requestAnimationFrame(scan));
  observer.observe(document.body, { childList: true, subtree: true });
}

boot();

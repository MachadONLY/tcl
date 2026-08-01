import "./home-v5-senior-inbox.css";

function refineInbox() {
  if (window.location.hash === "#matchday") return true;

  const workspace = document.querySelector(".v3-workspace");
  const mailbox = document.querySelector(".v3-pane-inbox .v2-mailbox");
  if (!workspace || !mailbox) return false;

  workspace.classList.add("v5-workspace-refined");

  if (mailbox.dataset.v5Refined !== "true") {
    mailbox.dataset.v5Refined = "true";

    const markRead = mailbox.querySelector("[data-v4-mark-read] span");
    const clearRead = mailbox.querySelector("[data-v4-clear-read] span");
    if (markRead) markRead.textContent = "Marcar tudo";
    if (clearRead) clearRead.textContent = "Excluir lidas";

    mailbox.querySelector("[data-v4-mark-read]")?.setAttribute("aria-label", "Marcar todas as mensagens como lidas");
    mailbox.querySelector("[data-v4-clear-read]")?.setAttribute("aria-label", "Excluir todas as mensagens lidas");

    mailbox.querySelectorAll(".v4-mail-item").forEach((item, index) => {
      item.style.setProperty("--mail-index", String(index));
      const mail = item.querySelector(".v2-mail");
      const sender = mail?.querySelector(".v2-mail-copy > span strong")?.textContent?.trim() || "Mensagem";
      const subject = mail?.querySelector(".v2-mail-copy > b")?.textContent?.trim() || "Abrir mensagem";
      mail?.setAttribute("aria-label", `${sender}: ${subject}`);
    });
  }

  const modal = document.querySelector(".v2-mail-modal");
  if (modal && modal.dataset.v5Refined !== "true") {
    modal.dataset.v5Refined = "true";
    modal.setAttribute("aria-label", "Leitura de mensagem do clube");

    const received = modal.querySelector(".v4-modal-received");
    if (received) {
      const label = received.querySelector("span");
      const detail = received.querySelector("small");
      if (label) label.textContent = "Mensagem interna";
      if (detail) detail.textContent = "Comunicação oficial do clube";
    }
  }

  return true;
}

function boot() {
  if (refineInbox()) {
    const observer = new MutationObserver(() => window.requestAnimationFrame(refineInbox));
    observer.observe(document.body, { childList: true, subtree: true });
    return;
  }

  let attempts = 0;
  const timer = window.setInterval(() => {
    attempts += 1;
    if (refineInbox() || attempts > 120) {
      window.clearInterval(timer);
      if (attempts <= 120) {
        const observer = new MutationObserver(() => window.requestAnimationFrame(refineInbox));
        observer.observe(document.body, { childList: true, subtree: true });
      }
    }
  }, 25);
}

boot();

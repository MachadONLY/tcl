let queued = false;

function isBroken(value) {
  const text = String(value || "").trim();
  return !text || /^(nan|undefined|null)$/i.test(text) || /nan|undefined|null/i.test(text);
}

function isNumericOnly(value) {
  return /^\d+(?:[.,]\d+)?$/.test(String(value || "").trim());
}

function polishPlayerSummary() {
  const panel = document.querySelector(".career-squad-fotmob .career-player-profile");
  if (!panel) return;

  const values = new Map(
    [...panel.querySelectorAll(".classic-contract-summary > span")].map(item => [
      item.querySelector("small")?.textContent?.trim().toLowerCase(),
      item.querySelector("strong")
    ])
  );

  const contract = values.get("contrato");
  if (contract && isBroken(contract.textContent)) contract.textContent = "A definir";

  const status = values.get("situação");
  if (status && (isBroken(status.textContent) || isNumericOnly(status.textContent))) {
    status.textContent = "Disponível";
  }

  const age = values.get("idade");
  if (age && (isBroken(age.textContent) || Number(age.textContent) < 15 || Number(age.textContent) > 50)) {
    age.textContent = "—";
  }

  for (const label of ["salário", "valor", "potencial"]) {
    const node = values.get(label);
    if (node && isBroken(node.textContent)) node.textContent = "—";
  }

  const identityStatus = panel.querySelector(".classic-profile-identity > div > small");
  if (identityStatus && (isBroken(identityStatus.textContent) || isNumericOnly(identityStatus.textContent))) {
    identityStatus.textContent = "Disponível";
  }
}

function queuePolish() {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => {
    queued = false;
    polishPlayerSummary();
  });
}

const observer = new MutationObserver(queuePolish);
observer.observe(document.body, { childList: true, subtree: true, characterData: true });
window.addEventListener("hashchange", queuePolish);
queuePolish();

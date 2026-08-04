const PL_PURPLE = "/assets/competitions/premier-league/logo-purple.svg";
const PL_WHITE = "/assets/competitions/premier-league/logo-white.svg";

function image(src, className, label) {
  const node = document.createElement("img");
  node.src = src;
  node.className = className;
  node.alt = label;
  node.decoding = "async";
  node.draggable = false;
  return node;
}

function useCanonicalClubCrests(root = document) {
  root
    .querySelectorAll('img[src*="/assets/clubs/2026-27/"][src$="/crest.svg"]')
    .forEach(node => {
      node.src = node.src.replace(/\/crest\.svg(?:\?.*)?$/, "/crest.png");
    });
}

function decorateTopbar(root = document) {
  const target = root.querySelector(".cp-top > div:first-child");
  if (!target || target.querySelector("[data-premier-league-brand]")) return;
  const mark = image(PL_PURPLE, "cp-pl-topbar-logo", "Premier League");
  mark.dataset.premierLeagueBrand = "topbar";
  target.prepend(mark);
}

function decorateLeaguePage(root = document) {
  const heading = [...root.querySelectorAll(".cp-title h1")]
    .find(node => node.textContent?.trim() === "Premier League");
  const title = heading?.closest(".cp-title");
  if (!title || title.querySelector("[data-premier-league-brand]")) return;
  const mark = image(PL_PURPLE, "cp-pl-page-logo", "Premier League");
  mark.dataset.premierLeagueBrand = "competition-page";
  title.append(mark);
}

function decorateMatchday(root = document) {
  const match = root.querySelector(".cp-match");
  if (!match || match.querySelector("[data-premier-league-brand]")) return;
  const mark = image(PL_WHITE, "cp-pl-match-logo", "Premier League");
  mark.dataset.premierLeagueBrand = "matchday";
  match.append(mark);
}

function applyBranding() {
  const root = document.querySelector("#app");
  if (!root) return;
  useCanonicalClubCrests(root);
  decorateTopbar(root);
  decorateLeaguePage(root);
  decorateMatchday(root);
}

const app = document.querySelector("#app");
if (app) {
  const observer = new MutationObserver(applyBranding);
  observer.observe(app, { childList: true, subtree: true });
  applyBranding();
}

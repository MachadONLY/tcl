import "./home-v2-cleanup.css";
import "./home-v2-alignment.css";

function removeClubMoment() {
  document.querySelector(".career-v2 .v2-moment")?.remove();
}

removeClubMoment();

const app = document.querySelector("#app");
if (app) {
  const observer = new MutationObserver(removeClubMoment);
  observer.observe(app, { childList: true, subtree: true });
}

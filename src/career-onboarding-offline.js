import "./career-onboarding.css";
import "./career-onboarding-v7-premier.css";
import "./career-onboarding-offline.css";
import { CLUBS, CLUB_BY_CODE, SEASON } from "./onboarding/offline-data.js";
import { decodeClub, loadManifest, prewarm, stageClubMedia } from "./onboarding/offline-media.js";
import { commitClub, renderWelcome, selectorMarkup, setOnboardingMode, updateRail } from "./onboarding/offline-view.js";

const CAREER_STORAGE_KEY = "touchline.career.mode.v1";
let stage = "welcome";
let selectedIndex = 0;
let selectionVersion = 0;
let activeSelection = Promise.resolve();
let wheelLockedUntil = 0;

function readSave() {
  try { return JSON.parse(localStorage.getItem(CAREER_STORAGE_KEY) || "{}"); }
  catch { return {}; }
}

async function selectClub(index, { initial = false } = {}) {
  const root = document.querySelector(".career-club-selection");
  if (!root) return;
  const manifest = await loadManifest();
  selectedIndex = (index + CLUBS.length) % CLUBS.length;
  const club = CLUBS[selectedIndex];
  const entry = manifest.clubs[club.code];
  const version = ++selectionVersion;

  updateRail(root, selectedIndex);
  root.dataset.switching = initial ? "false" : "true";

  const task = decodeClub(entry)
    .then(() => stageClubMedia(root, club, entry, initial))
    .then(staged => {
      if (version !== selectionVersion || !root.isConnected) return;
      requestAnimationFrame(() => {
        if (version !== selectionVersion || !root.isConnected) return;
        commitClub(root, club, staged);
      });
    })
    .catch(error => {
      if (version !== selectionVersion) return;
      root.dataset.switching = "error";
      root.dataset.switchError = error.message;
    });

  activeSelection = task;
  return task;
}

async function renderSelector() {
  stage = "clubs";
  setOnboardingMode(true);
  document.title = "Touchline — Escolha seu clube";
  const app = document.querySelector("#app");
  if (!app) return;

  const saved = CLUB_BY_CODE.get(readSave().selectedClubCode)?.index;
  selectedIndex = Number.isInteger(saved) ? saved : selectedIndex;
  const manifest = await loadManifest();
  const club = CLUBS[selectedIndex];
  const entry = manifest.clubs[club.code];

  await decodeClub(entry);
  app.innerHTML = selectorMarkup(manifest, selectedIndex);
  const root = app.querySelector(".career-club-selection");
  const staged = await stageClubMedia(root, club, entry, true);
  commitClub(root, club, staged);
  updateRail(root, selectedIndex);
  prewarm(manifest, selectedIndex);
}

async function beginCareer() {
  history.replaceState(null, "", "#club-select");
  const button = document.querySelector("[data-start-career]");
  if (button) button.disabled = true;
  try { await renderSelector(); }
  catch (error) {
    if (button) button.disabled = false;
    document.documentElement.dataset.onboardingError = error.message;
  }
}

async function confirmClub() {
  await activeSelection;
  const club = CLUBS[selectedIndex];
  const current = readSave();
  const next = {
    ...current,
    onboardingComplete: true,
    selectedClubCode: club.code,
    selectedClubName: club.name,
    selectedClubManager: club.manager,
    careerSeason: SEASON,
    careerStartedAt: new Date().toISOString()
  };
  ["selectedSquadId", "xi", "playerStatus", "contractNegotiations", "releasedPlayers"].forEach(key => delete next[key]);
  localStorage.setItem(CAREER_STORAGE_KEY, JSON.stringify(next));
  document.querySelector(".career-club-selection")?.classList.add("career-club-confirmed");
  window.setTimeout(() => {
    history.replaceState(null, "", `${location.pathname}${location.search}`);
    location.reload();
  }, 320);
}

function handleClick(event) {
  if (!document.documentElement.classList.contains("touchline-onboarding-mode")) return;
  if (event.target.closest("[data-start-career]")) return void beginCareer();
  const item = event.target.closest("[data-club-index]");
  if (item) return void selectClub(Number(item.dataset.clubIndex));
  const step = event.target.closest("[data-club-step]");
  if (step) return void selectClub(selectedIndex + Number(step.dataset.clubStep));
  if (event.target.closest("[data-confirm-club]")) return void confirmClub();
}

function handleKeydown(event) {
  if (!document.documentElement.classList.contains("touchline-onboarding-mode")) return;
  if (stage === "welcome" && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    return void beginCareer();
  }
  if (stage !== "clubs") return;
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    event.preventDefault();
    return void selectClub(selectedIndex + (event.key === "ArrowRight" ? 1 : -1));
  }
  if (event.key === "Enter") {
    event.preventDefault();
    return void confirmClub();
  }
  if (event.key === "Escape") {
    event.preventDefault();
    history.replaceState(null, "", "#welcome");
    stage = "welcome";
    renderWelcome();
  }
}

function handleWheel(event) {
  if (stage !== "clubs" || !event.target.closest(".club-rail")) return;
  event.preventDefault();
  const now = performance.now();
  if (now < wheelLockedUntil) return;
  wheelLockedUntil = now + 140;
  void selectClub(selectedIndex + (event.deltaY > 0 || event.deltaX > 0 ? 1 : -1));
}

function shouldOpenOnboarding() {
  const save = readSave();
  return location.hash === "#welcome" || location.hash === "#club-select" || !save.onboardingComplete;
}

async function registerOfflineWorker() {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;
  try { await navigator.serviceWorker.register("/touchline-sw.js", { scope: "/" }); }
  catch { /* local assets still work without a worker */ }
}

function mount() {
  if (!shouldOpenOnboarding()) return;
  setOnboardingMode(true);
  if (location.hash === "#club-select") void renderSelector();
  else renderWelcome();
}

document.addEventListener("click", handleClick);
document.addEventListener("keydown", handleKeydown);
document.addEventListener("wheel", handleWheel, { passive: false });
window.addEventListener("hashchange", () => {
  if (location.hash === "#club-select") void renderSelector();
  else if (location.hash === "#welcome") { stage = "welcome"; renderWelcome(); }
});

void registerOfflineWorker();
mount();

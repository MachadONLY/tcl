import "./career-onboarding.css";
import "./career-club-selector.css";
import { CLUBS, CLUB_BY_CODE, SEASON } from "./onboarding/offline-data.js";
import { loadManifest, prewarm, stageClubMedia } from "./onboarding/offline-media.js";
import { commitClub, renderWelcome, selectorMarkup, setOnboardingMode, updateRail } from "./onboarding/offline-view.js";

const CAREER_STORAGE_KEY = "touchline.career.mode.v1";
let stage = "welcome";
let selectedIndex = 0;
let committedIndex = 0;
let selectionVersion = 0;
let activeSelection = Promise.resolve();
let wheelLockedUntil = 0;

function readSave() {
  try { return JSON.parse(localStorage.getItem(CAREER_STORAGE_KEY) || "{}"); }
  catch { return {}; }
}

async function selectClub(index) {
  const root = document.querySelector(".tl-club-select");
  if (!root) return;
  const manifest = await loadManifest();
  const requestedIndex = (index + CLUBS.length) % CLUBS.length;
  const club = CLUBS[requestedIndex];
  const entry = manifest.clubs[club.code];
  const version = ++selectionVersion;

  selectedIndex = requestedIndex;
  updateRail(root, requestedIndex);
  root.dataset.switching = "true";
  root.dataset.requestedClubCode = club.code;
  delete root.dataset.switchError;

  const task = stageClubMedia(root, club, entry)
    .then(staged => {
      if (version !== selectionVersion || !root.isConnected) return false;
      commitClub(root, club, staged);
      committedIndex = requestedIndex;
      selectedIndex = requestedIndex;
      prewarm(manifest, requestedIndex);
      return true;
    })
    .catch(error => {
      if (version !== selectionVersion || !root.isConnected) return false;
      selectedIndex = committedIndex;
      updateRail(root, committedIndex);
      root.dataset.switching = "error";
      root.dataset.switchError = error.message;
      root.dataset.requestedClubCode = CLUBS[committedIndex].code;
      return false;
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
  committedIndex = selectedIndex;
  const manifest = await loadManifest();
  const club = CLUBS[selectedIndex];
  const entry = manifest.clubs[club.code];

  app.innerHTML = selectorMarkup(manifest, selectedIndex);
  const root = app.querySelector(".tl-club-select");
  const staged = await stageClubMedia(root, club, entry);
  commitClub(root, club, staged);
  committedIndex = selectedIndex;
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
  const club = CLUBS[committedIndex];
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
  document.querySelector(".tl-club-select")?.classList.add("career-club-confirmed");
  window.setTimeout(() => {
    history.replaceState(null, "", `${location.pathname}${location.search}`);
    location.reload();
  }, 320);
}

function backToWelcome() {
  selectionVersion += 1;
  history.replaceState(null, "", "#welcome");
  stage = "welcome";
  renderWelcome();
}

function handleClick(event) {
  if (!document.documentElement.classList.contains("touchline-onboarding-mode")) return;
  if (event.target.closest("[data-start-career]")) return void beginCareer();
  const item = event.target.closest("[data-club-index]");
  if (item) return void selectClub(Number(item.dataset.clubIndex));
  const step = event.target.closest("[data-club-step]");
  if (step) return void selectClub(selectedIndex + Number(step.dataset.clubStep));
  if (event.target.closest("[data-confirm-club]")) return void confirmClub();
  if (event.target.closest("[data-back-welcome]")) return backToWelcome();
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
    return backToWelcome();
  }
}

function handleWheel(event) {
  if (stage !== "clubs" || !event.target.closest(".tl-club-select__rail")) return;
  event.preventDefault();
  const now = performance.now();
  if (now < wheelLockedUntil) return;
  wheelLockedUntil = now + 120;
  void selectClub(selectedIndex + (event.deltaY > 0 || event.deltaX > 0 ? 1 : -1));
}

function shouldOpenOnboarding() {
  const save = readSave();
  return location.hash === "#welcome" || location.hash === "#club-select" || !save.onboardingComplete;
}

async function clearDevelopmentWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.unregister()));
  } catch {}
  try {
    if (!("caches" in globalThis)) return;
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith("touchline-")).map(key => caches.delete(key)));
  } catch {}
}

async function manageOfflineWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (import.meta.env.DEV) {
    await clearDevelopmentWorker();
    return;
  }
  if (!import.meta.env.PROD) return;
  try {
    const registration = await navigator.serviceWorker.register("/touchline-sw.js", { scope: "/" });
    await registration.update();
  } catch {}
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
  selectionVersion += 1;
  if (location.hash === "#club-select") void renderSelector();
  else if (location.hash === "#welcome") { stage = "welcome"; renderWelcome(); }
});

void manageOfflineWorker();
mount();

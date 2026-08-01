const CLUB_KITS = Object.freeze({
  "manchester united": { primary: "#da291c", secondary: "#111411", accent: "#fbe122" },
  "man united": { primary: "#da291c", secondary: "#111411", accent: "#fbe122" },
  arsenal: { primary: "#d71920", secondary: "#ffffff", accent: "#063672" },
  "aston villa": { primary: "#670e36", secondary: "#95bfe5", accent: "#f4d500" },
  bournemouth: { primary: "#d71920", secondary: "#111111", accent: "#ffffff" },
  brentford: { primary: "#d71920", secondary: "#ffffff", accent: "#111111" },
  brighton: { primary: "#0057b8", secondary: "#ffffff", accent: "#ffcd00" },
  burnley: { primary: "#6c1d45", secondary: "#99d6ea", accent: "#f7e300" },
  chelsea: { primary: "#034694", secondary: "#ffffff", accent: "#db0011" },
  "crystal palace": { primary: "#1b458f", secondary: "#c4122e", accent: "#ffffff" },
  everton: { primary: "#003399", secondary: "#ffffff", accent: "#f4d03f" },
  fulham: { primary: "#ffffff", secondary: "#111111", accent: "#cc0000" },
  leeds: { primary: "#ffffff", secondary: "#1d428a", accent: "#ffcd00" },
  liverpool: { primary: "#c8102e", secondary: "#00b2a9", accent: "#f6eb61" },
  "manchester city": { primary: "#6cabdd", secondary: "#ffffff", accent: "#1c2c5b" },
  "man city": { primary: "#6cabdd", secondary: "#ffffff", accent: "#1c2c5b" },
  newcastle: { primary: "#111111", secondary: "#ffffff", accent: "#41b6e6" },
  nottingham: { primary: "#e53233", secondary: "#ffffff", accent: "#111111" },
  sunderland: { primary: "#eb172b", secondary: "#ffffff", accent: "#111111" },
  tottenham: { primary: "#ffffff", secondary: "#132257", accent: "#00a2e0" },
  "west ham": { primary: "#7a263a", secondary: "#1bb1e7", accent: "#f3d459" },
  wolves: { primary: "#fdb913", secondary: "#111111", accent: "#ffffff" }
});

const DEFAULT_USER_CLUB = "Manchester United";
let scanQueued = false;

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function currentUserClub() {
  const label = document.querySelector(".v2-club-card strong, .v2-club-card b, [data-user-club]");
  return String(label?.textContent || label?.dataset?.userClub || DEFAULT_USER_CLUB).trim() || DEFAULT_USER_CLUB;
}

function currentClubBadge() {
  const image = document.querySelector(".v2-club-card img, .v2-club-card picture img, [data-user-club-crest]");
  const src = image?.currentSrc || image?.src || image?.dataset?.userClubCrest || "";
  return src ? `url("${String(src).replaceAll('"', '%22')}")` : "none";
}

function isUserSquadContext(face) {
  return Boolean(face.closest(
    ".career-squad-module, .career-tactics-module, .career-training-module, " +
    ".career-player-profile, .career-mail-reader, .career-mail-row, .career-academy-module"
  ));
}

function inferClub(face) {
  if (isUserSquadContext(face)) return currentUserClub();

  const row = face.closest(".career-transfer-row, .career-market-row, .career-shortlist-row, .career-offer-profile");
  return String(
    face.dataset.teamName ||
    row?.dataset.teamName ||
    row?.querySelector("[data-team-name]")?.textContent ||
    row?.querySelector(".career-player-club, .career-transfer-club")?.textContent ||
    currentUserClub()
  ).trim();
}

function kitFor(clubName) {
  const normalized = normalize(clubName);
  const direct = CLUB_KITS[normalized];
  if (direct) return direct;
  const key = Object.keys(CLUB_KITS).find(candidate => normalized.includes(candidate) || candidate.includes(normalized));
  return CLUB_KITS[key] || CLUB_KITS["manchester united"];
}

function realPortraitHasLoaded(face) {
  const image = face.querySelector(":scope > img");
  if (!image) return false;
  const source = String(image.currentSrc || image.src || "");
  return Boolean(
    source &&
    !source.startsWith("data:image/svg+xml") &&
    image.complete &&
    image.naturalWidth > 0
  );
}

function ensureKitLayer(face) {
  const club = inferClub(face);
  const identity = normalize(club) || "manchester united";
  const kit = kitFor(club);

  if (realPortraitHasLoaded(face)) {
    face.classList.remove("generated-player-face", "photo-failed");
    face.classList.add("has-photo", "photo-ready");
  }

  face.dataset.saveClub = club;
  face.style.setProperty("--kit-primary", kit.primary);
  face.style.setProperty("--kit-secondary", kit.secondary);
  face.style.setProperty("--kit-accent", kit.accent);
  face.style.setProperty("--kit-badge", isUserSquadContext(face) ? currentClubBadge() : "none");

  let layer = face.querySelector(":scope > .career-save-kit");
  if (!layer) {
    layer = document.createElement("span");
    layer.className = "career-save-kit";
    layer.setAttribute("aria-hidden", "true");
    layer.innerHTML = '<span class="career-save-kit-badge"></span>';
    face.append(layer);
  }

  layer.dataset.club = identity;
  face.classList.add("save-kit-ready");
}

function scan() {
  document.querySelectorAll(".career-face").forEach(ensureKitLayer);
}

function queueScan() {
  if (scanQueued) return;
  scanQueued = true;
  requestAnimationFrame(() => {
    scanQueued = false;
    scan();
  });
}

const observer = new MutationObserver(queueScan);
observer.observe(document.body, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ["src", "class"]
});
document.addEventListener("DOMContentLoaded", queueScan, { once: true });
queueScan();

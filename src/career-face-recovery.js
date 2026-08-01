import { getPlayerFace } from "./player-face-service.js";

const PROXY_PATH = "/api/player-face";
const moraleLabels = ["Muito feliz", "Motivado", "Confiante", "Contente", "Focado"];

function normalize(value) {
  return String(value || "").trim();
}

function hash(value) {
  let result = 2166136261;
  for (const character of String(value || "Touchline")) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return Math.abs(result >>> 0);
}

function initials(name) {
  return normalize(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || "")
    .join("") || "PL";
}

function embeddedFallback(name) {
  const label = initials(name);
  const safeName = normalize(name)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="420" viewBox="0 0 360 420" role="img" aria-label="${safeName}"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#eef6e9"/><stop offset="1" stop-color="#d8e8d0"/></linearGradient><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#252c22"/><stop offset="1" stop-color="#111510"/></linearGradient></defs><rect width="360" height="420" rx="38" fill="url(#a)"/><circle cx="180" cy="137" r="69" fill="#b8cab0"/><path d="M86 369c6-92 40-139 94-139s88 47 94 139" fill="url(#b)"/><path d="M142 204c11 15 24 23 38 23s27-8 38-23v53c-9 14-22 21-38 21s-29-7-38-21z" fill="#a7bc9e"/><circle cx="180" cy="342" r="40" fill="#65a83c"/><text x="180" y="354" text-anchor="middle" font-family="Arial,sans-serif" font-size="37" font-weight="800" fill="#fff">${label}</text></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function inferName(face) {
  const row = face.closest(".career-squad-row, .career-transfer-row, .career-market-row, .career-shortlist-row, .career-mail-row");
  const panel = face.closest(".career-player-profile, .career-transfer-profile, .career-offer-profile, .career-mail-reader");
  return normalize(
    face.dataset.playerName ||
    row?.querySelector("strong")?.textContent ||
    panel?.querySelector("h2")?.textContent ||
    face.querySelector("img")?.alt ||
    "Premier League player"
  );
}

function inferProviderId(face, image) {
  const direct = normalize(face.dataset.providerId || face.dataset.playerId).replace(/\D/g, "");
  if (direct) return direct;

  const candidates = [
    image?.getAttribute("src"),
    image?.currentSrc,
    ...(safeJson(image?.dataset.originalSources) || [])
  ].filter(Boolean);

  for (const source of candidates) {
    const match = String(source).match(/(?:players\/full\/|players\/)(\d+)(?:\.png)?/i);
    if (match?.[1]) return match[1];
  }
  return "";
}

function safeJson(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function portraitSize(face) {
  if (face.classList.contains("hero") || face.classList.contains("transfer")) return 420;
  if (face.classList.contains("medium")) return 180;
  return 112;
}

function collectSources(name, image) {
  const resolved = getPlayerFace(name);
  const existing = [
    image?.getAttribute("src"),
    image?.currentSrc,
    ...safeJson(image?.dataset.originalSources),
    ...(resolved?.photoSources || []),
    resolved?.photo
  ];
  return [...new Set(existing.filter(source => source && !String(source).startsWith(PROXY_PATH) && !String(source).startsWith("data:")))];
}

function buildProxyUrl(name, providerId, sources, size) {
  const params = new URLSearchParams({ name, size: String(size) });
  if (providerId) params.set("providerId", providerId);
  if (sources[0]) params.set("src", sources[0]);
  sources.slice(1, 8).forEach(source => params.append("fallback", source));
  return `${PROXY_PATH}?${params.toString()}`;
}

function ensureFallbackLabel(face, name) {
  let label = face.querySelector(":scope > b");
  if (!label) {
    label = document.createElement("b");
    label.className = "career-face-fallback-label";
    face.insertBefore(label, face.firstChild);
  }
  label.textContent = initials(name);
  label.setAttribute("aria-hidden", "true");
}

function installImage(face, name) {
  ensureFallbackLabel(face, name);

  let image = face.querySelector(":scope > img");
  if (!image) {
    image = document.createElement("img");
    image.alt = name;
    face.insertBefore(image, face.querySelector(":scope > small") || null);
  }

  if (image.dataset.touchlinePortraitReady === "true") return;
  image.dataset.touchlinePortraitReady = "true";

  const sources = collectSources(name, image);
  image.dataset.originalSources = JSON.stringify(sources);
  const providerId = inferProviderId(face, image);
  const proxyUrl = buildProxyUrl(name, providerId, sources, portraitSize(face));

  image.alt = name;
  image.decoding = "async";
  image.loading = face.classList.contains("hero") || face.classList.contains("transfer") ? "eager" : "lazy";
  image.referrerPolicy = "no-referrer";
  image.fetchPriority = face.classList.contains("hero") ? "high" : "auto";

  image.addEventListener("load", () => {
    face.classList.add("has-photo", "photo-ready");
    face.classList.remove("photo-failed");
  });

  image.addEventListener("error", () => {
    if (image.dataset.embeddedFallback === "true") {
      face.classList.remove("has-photo", "photo-ready");
      face.classList.add("photo-failed");
      image.remove();
      return;
    }
    image.dataset.embeddedFallback = "true";
    image.src = embeddedFallback(name);
  });

  face.classList.add("has-photo", "photo-loading");
  image.src = proxyUrl;
}

function ensurePortrait(face) {
  const name = inferName(face);
  face.dataset.playerName = name;
  installImage(face, name);
}

function polishSquadData(row) {
  const name = normalize(row.querySelector(".career-squad-name strong")?.textContent || row.querySelector("strong")?.textContent);
  const seed = hash(name);
  const fitness = 74 + (seed % 25);
  const directChildren = [...row.children];
  const meter = row.querySelector(".career-meter");
  const meterLabel = meter?.querySelector("small");
  const meterBar = meter?.querySelector("i");

  if (meterLabel && (!Number.isFinite(Number.parseFloat(meterLabel.textContent)) || meterLabel.textContent.includes("NaN"))) {
    meterLabel.textContent = `${fitness}%`;
  }
  if (meterBar && (!meterBar.style.getPropertyValue("--value") || meterBar.style.getPropertyValue("--value").includes("NaN"))) {
    meterBar.style.setProperty("--value", `${fitness}%`);
  }

  const morale = directChildren[5];
  if (morale && ["", "undefined", "null", "nan"].includes(normalize(morale.textContent).toLowerCase())) {
    morale.textContent = moraleLabels[seed % moraleLabels.length];
  }
}

function scan() {
  document.querySelectorAll(".career-face").forEach(ensurePortrait);
  document.querySelectorAll(".career-squad-row").forEach(polishSquadData);
}

let scanQueued = false;
function queueScan() {
  if (scanQueued) return;
  scanQueued = true;
  requestAnimationFrame(() => {
    scanQueued = false;
    scan();
  });
}

const observer = new MutationObserver(queueScan);
observer.observe(document.body, { childList: true, subtree: true });
document.addEventListener("DOMContentLoaded", queueScan, { once: true });
queueScan();

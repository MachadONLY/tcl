import { CLUBS } from "./offline-data.js";

const MANIFEST_URL = "/assets/clubs/2026-27/manifest.json";
const REQUIRED_ROLES = Object.freeze([
  "crest", "city", "stadium", "manager", "homeKit", "awayKit", "rivalCrest"
]);
const decodeCache = new Map();
let manifestPromise;

function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function localAsset(value) {
  const source = String(value || "").trim();
  return source.startsWith("/assets/clubs/2026-27/") ? source : "";
}

function assertEntry(club, entry) {
  if (!entry) throw new Error(`mídia ausente para ${club.code}`);
  for (const role of REQUIRED_ROLES) {
    if (!localAsset(entry[role])) throw new Error(`${role} não local em ${club.code}`);
  }
  if (normalize(entry.managerName) !== normalize(club.manager)) {
    throw new Error(`técnico divergente em ${club.code}`);
  }
}

export function loadManifest() {
  if (manifestPromise) return manifestPromise;
  manifestPromise = fetch(MANIFEST_URL, { cache: "force-cache" })
    .then(response => {
      if (!response.ok) throw new Error(`manifest HTTP ${response.status}`);
      return response.json();
    })
    .then(manifest => {
      if (!manifest?.clubs) throw new Error("manifesto offline ausente");
      CLUBS.forEach(club => assertEntry(club, manifest.clubs[club.code]));
      return manifest;
    });
  return manifestPromise;
}

export function decodeImage(value) {
  const source = localAsset(value);
  if (!source) return Promise.reject(new Error(`asset remoto bloqueado: ${value}`));
  if (decodeCache.has(source)) return decodeCache.get(source);

  const pending = new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = async () => {
      try { await image.decode?.(); } catch { /* onload confirms a renderable image */ }
      if (image.naturalWidth > 0 && image.naturalHeight > 0) resolve(source);
      else reject(new Error(`imagem vazia: ${source}`));
    };
    image.onerror = () => reject(new Error(`imagem inválida: ${source}`));
    image.src = source;
    if (image.complete && image.naturalWidth > 0) resolve(source);
  }).catch(error => {
    decodeCache.delete(source);
    throw error;
  });

  decodeCache.set(source, pending);
  return pending;
}

export async function decodeClub(entry) {
  await Promise.all(REQUIRED_ROLES.map(role => decodeImage(entry[role])));
  if (entry.backdrop) await decodeImage(entry.backdrop);
  return entry;
}

function dimensions(role) {
  if (role === "crest" || role === "rivalCrest") return [420, 420];
  if (role === "manager") return [620, 760];
  if (role === "homeKit" || role === "awayKit") return [620, 620];
  return [1280, 720];
}

async function stageOne(root, role, source, alt, initial) {
  const stack = root.querySelector(`[data-media="${role}"]`);
  if (!stack) throw new Error(`pilha de mídia ausente: ${role}`);

  const activeIndex = Number(stack.dataset.active || 0);
  const nextIndex = initial ? activeIndex : activeIndex ^ 1;
  const images = stack.querySelectorAll(":scope > img");
  const current = images[activeIndex];
  const next = images[nextIndex];
  const [width, height] = dimensions(role);
  const absolute = new URL(source, location.href).href;

  next.alt = alt || "";
  next.width = width;
  next.height = height;
  next.fetchPriority = role === "crest" || role === "manager" ? "high" : "auto";
  if (next.src !== absolute) next.src = source;

  if (!(next.complete && next.naturalWidth > 0 && next.naturalHeight > 0)) {
    try { await next.decode(); }
    catch {
      await new Promise((resolve, reject) => {
        next.addEventListener("load", resolve, { once: true });
        next.addEventListener("error", () => reject(new Error(`falha ao decodificar ${source}`)), { once: true });
      });
    }
  }
  if (next.naturalWidth <= 0 || next.naturalHeight <= 0) {
    throw new Error(`imagem sem dimensões: ${source}`);
  }
  return { stack, current, next, nextIndex };
}

export function mediaStack(role, className = "") {
  return `<span class="offline-media-stack ${className}" data-media="${role}" data-active="0" aria-hidden="true">
    <img alt="" decoding="async" draggable="false" />
    <img alt="" decoding="async" draggable="false" />
  </span>`;
}

export async function stageClubMedia(root, club, entry, initial = false) {
  const jobs = [
    ["backdrop", entry.backdrop || entry.stadium, ""],
    ["crest", entry.crest, `Escudo do ${club.name}`],
    ["city", entry.city, club.city],
    ["manager", entry.manager, club.manager],
    ["stadium", entry.stadium, club.stadium],
    ["homeKit", entry.homeKit, `Uniforme principal do ${club.name}`],
    ["awayKit", entry.awayKit, `Uniforme reserva do ${club.name}`],
    ["rivalCrest", entry.rivalCrest, `Escudo do ${club.rival}`]
  ];
  return Promise.all(jobs.map(args => stageOne(root, ...args, initial)));
}

export function activateMedia(staged) {
  for (const { stack, current, next, nextIndex } of staged) {
    next.classList.add("is-active");
    if (current && current !== next) current.classList.remove("is-active");
    stack.dataset.active = String(nextIndex);
  }
}

function idle(callback) {
  if ("requestIdleCallback" in window) window.requestIdleCallback(callback, { timeout: 1200 });
  else window.setTimeout(callback, 120);
}

export function prewarm(manifest, selectedIndex) {
  idle(async () => {
    const ordered = CLUBS.map((club, index) => ({
      club,
      distance: Math.min(Math.abs(index - selectedIndex), CLUBS.length - Math.abs(index - selectedIndex))
    })).sort((a, b) => a.distance - b.distance);

    for (const { club } of ordered) {
      try { await decodeClub(manifest.clubs[club.code]); } catch { /* visible selection reports errors */ }
      await new Promise(resolve => window.setTimeout(resolve, 0));
    }
  });
}

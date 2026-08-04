import { CLUBS } from "./offline-data.js";

const MANIFEST_URL = "/assets/clubs/2026-27/manifest.json";
const REQUIRED_ROLES = Object.freeze([
  "crest", "city", "stadium", "manager", "homeKit", "awayKit", "rivalCrest"
]);
const decodeCache = new Map();
const prewarmedClubs = new Set();
let manifestPromise;
let prewarmGeneration = 0;
let stageSequence = 0;

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
      try { await image.decode?.(); } catch { /* onload already confirms a renderable image */ }
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
  return entry;
}

function dimensions(role) {
  if (role === "crest" || role === "rivalCrest") return [420, 420];
  if (role === "manager") return [620, 760];
  if (role === "homeKit" || role === "awayKit") return [620, 620];
  return [1280, 720];
}

export function mediaStack(role, className = "") {
  return `<span class="offline-media-stack ${className}" data-media="${role}" data-active="0" aria-hidden="true">
    <img alt="" decoding="async" draggable="false" />
    <img alt="" decoding="async" draggable="false" />
  </span>`;
}

function awaitElementDecode(image, source) {
  const absolute = new URL(source, location.href).href;
  if (image.src !== absolute) image.src = source;
  if (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
    return image.decode?.().catch(() => undefined) || Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const loaded = async () => {
      cleanup();
      try { await image.decode?.(); } catch { /* load already confirms renderability */ }
      image.naturalWidth > 0 ? resolve() : reject(new Error(`imagem vazia: ${source}`));
    };
    const failed = () => {
      cleanup();
      reject(new Error(`imagem inválida: ${source}`));
    };
    const cleanup = () => {
      image.removeEventListener("load", loaded);
      image.removeEventListener("error", failed);
    };
    image.addEventListener("load", loaded, { once: true });
    image.addEventListener("error", failed, { once: true });
  });
}

async function prepareStack(root, job, token) {
  const stack = root.querySelector(`[data-media="${job.role}"]`);
  if (!stack) throw new Error(`pilha de mídia ausente: ${job.role}`);

  const images = stack.querySelectorAll(":scope > img");
  const activeIndex = Number(stack.dataset.active || 0);
  const nextIndex = activeIndex ^ 1;
  const current = images[activeIndex];
  const next = images[nextIndex];
  const [width, height] = dimensions(job.role);

  next.dataset.stageToken = token;
  next.alt = job.alt || "";
  next.width = width;
  next.height = height;
  next.fetchPriority = job.role === "crest" || job.role === "manager" ? "high" : "auto";
  await awaitElementDecode(next, job.source);

  const absolute = new URL(job.source, location.href).href;
  if (next.dataset.stageToken !== token || next.src !== absolute) {
    throw new DOMException("staging superseded", "AbortError");
  }
  return { stack, current, next, nextIndex, token };
}

/*
 * Each selection first decodes detached images, then prepares only the hidden
 * half of every fixed-size media stack. A newer selection can supersede that
 * hidden buffer safely; only a fully decoded, still-current set is activated.
 */
export async function stageClubMedia(root, club, entry) {
  const jobs = [
    ["backdrop", entry.stadium, ""],
    ["crest", entry.crest, `Escudo do ${club.name}`],
    ["city", entry.city, club.city],
    ["manager", entry.manager, club.manager],
    ["stadium", entry.stadium, club.stadium],
    ["homeKit", entry.homeKit, `Uniforme principal do ${club.name}`],
    ["awayKit", entry.awayKit, `Uniforme reserva do ${club.name}`],
    ["rivalCrest", entry.rivalCrest, `Escudo do ${club.rival}`]
  ].map(([role, source, alt]) => ({ role, source: localAsset(source), alt }));

  await Promise.all(jobs.map(job => decodeImage(job.source)));
  const token = `${club.code}-${++stageSequence}`;
  const prepared = await Promise.all(jobs.map(job => prepareStack(root, job, token)));
  return { root, prepared, token };
}

export function activateMedia(staged) {
  for (const { stack, current, next, nextIndex, token } of staged.prepared) {
    if (next.dataset.stageToken !== token || !next.complete || next.naturalWidth <= 0) {
      throw new DOMException("staging superseded", "AbortError");
    }
  }
  for (const { stack, current, next, nextIndex } of staged.prepared) {
    next.classList.add("is-active");
    current?.classList.remove("is-active");
    stack.dataset.active = String(nextIndex);
  }
}

function idle(callback) {
  if ("requestIdleCallback" in window) window.requestIdleCallback(callback, { timeout: 900 });
  else window.setTimeout(() => callback({ didTimeout: true, timeRemaining: () => 0 }), 80);
}

/* Warm nearby clubs first, then one club per idle slice to avoid startup jank. */
export function prewarm(manifest, selectedIndex) {
  const generation = ++prewarmGeneration;
  const ordered = CLUBS.map((club, index) => ({
    club,
    distance: Math.min(Math.abs(index - selectedIndex), CLUBS.length - Math.abs(index - selectedIndex))
  })).sort((a, b) => a.distance - b.distance);
  let cursor = 0;

  const pump = () => idle(async () => {
    if (generation !== prewarmGeneration) return;
    while (cursor < ordered.length && prewarmedClubs.has(ordered[cursor].club.code)) cursor += 1;
    if (cursor >= ordered.length) return;

    const club = ordered[cursor++].club;
    try {
      await decodeClub(manifest.clubs[club.code]);
      prewarmedClubs.add(club.code);
    } catch {
      /* The visible selection reports actionable media errors. */
    }
    if (cursor < ordered.length) pump();
  });

  pump();
}

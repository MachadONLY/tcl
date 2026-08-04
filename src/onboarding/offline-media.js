import { CLUBS } from "./offline-data.js";

const MANIFEST_URL = "/assets/clubs/2026-27/manifest.json";
const REQUIRED_ROLES = Object.freeze([
  "crest", "city", "stadium", "manager", "homeKit", "awayKit", "rivalCrest"
]);
const CUSTOM_STADIUM_BY_CLUB = Object.freeze({
  HUL: "/assets/clubs/2026-27/hul/stadium-custom.svg"
});
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

function applyLocalOverrides(manifest) {
  for (const [clubCode, stadium] of Object.entries(CUSTOM_STADIUM_BY_CLUB)) {
    const entry = manifest?.clubs?.[clubCode];
    if (!entry) continue;
    entry.stadium = stadium;
    entry.backdrop = stadium;
    entry.sources = {
      ...(entry.sources || {}),
      stadium: "user-supplied-local-asset"
    };
  }
  return manifest;
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
  manifestPromise = fetch(MANIFEST_URL, { cache: "no-cache" })
    .then(response => {
      if (!response.ok) throw new Error(`manifest HTTP ${response.status}`);
      return response.json();
    })
    .then(manifest => {
      applyLocalOverrides(manifest);
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
      try { await image.decode?.(); } catch { /* onload confirms renderability */ }
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

export function mediaStack(role, className = "") {
  return `<span class="offline-media-stack ${className}" data-media="${role}" aria-hidden="true"></span>`;
}

async function prepareDetachedImage(job, token) {
  const image = new Image();
  const [width, height] = dimensions(job.role);

  image.alt = job.alt || "";
  image.width = width;
  image.height = height;
  image.decoding = "async";
  image.draggable = false;
  image.fetchPriority = job.role === "crest" || job.role === "manager" ? "high" : "auto";
  image.dataset.stageToken = token;
  image.dataset.mediaRole = job.role;
  image.src = job.source;

  if (!(image.complete && image.naturalWidth > 0 && image.naturalHeight > 0)) {
    await new Promise((resolve, reject) => {
      const loaded = () => {
        cleanup();
        resolve();
      };
      const failed = () => {
        cleanup();
        reject(new Error(`imagem inválida: ${job.source}`));
      };
      const cleanup = () => {
        image.removeEventListener("load", loaded);
        image.removeEventListener("error", failed);
      };
      image.addEventListener("load", loaded, { once: true });
      image.addEventListener("error", failed, { once: true });
    });
  }

  try { await image.decode?.(); } catch { /* load already confirmed renderability */ }
  if (image.naturalWidth <= 0 || image.naturalHeight <= 0) {
    throw new Error(`imagem vazia: ${job.source}`);
  }
  return image;
}

/*
 * Every selection owns a completely detached image batch. Concurrent clicks
 * never share or overwrite a hidden DOM slot. Only the controller's latest,
 * fully decoded batch is committed to the visible stacks.
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

  for (const job of jobs) {
    if (!job.source) throw new Error(`${club.code}.${job.role} não local`);
  }

  const token = `${club.code}-${++stageSequence}`;
  const prepared = await Promise.all(jobs.map(async job => {
    const stack = root.querySelector(`[data-media="${job.role}"]`);
    if (!stack) throw new Error(`pilha de mídia ausente: ${job.role}`);
    const image = await prepareDetachedImage(job, token);
    return { stack, image, role: job.role, source: job.source, token };
  }));

  return { root, clubCode: club.code, prepared, token };
}

export function activateMedia(staged) {
  if (!staged?.root?.isConnected) throw new DOMException("root detached", "AbortError");

  for (const item of staged.prepared) {
    const { image, role, source, token } = item;
    if (token !== staged.token || image.dataset.stageToken !== staged.token) {
      throw new DOMException("staging superseded", "AbortError");
    }
    if (!image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
      throw new Error(`imagem não decodificada: ${role} ${source}`);
    }
  }

  const previous = [];
  for (const { stack, image } of staged.prepared) {
    for (const stale of stack.querySelectorAll(":scope > img:not(.is-active)")) stale.remove();
    const current = stack.querySelector(":scope > img.is-active");
    if (current) previous.push(current);
    image.classList.add("is-active");
    stack.append(image);
  }

  for (const oldImage of previous) oldImage.classList.remove("is-active");
  staged.root.dataset.mediaClubCode = staged.clubCode;

  window.setTimeout(() => {
    for (const oldImage of previous) {
      if (!oldImage.classList.contains("is-active")) oldImage.remove();
    }
  }, 120);
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
      /* Visible selection reports actionable media errors. */
    }
    if (cursor < ordered.length) pump();
  });

  pump();
}

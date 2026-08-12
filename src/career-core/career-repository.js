import { reconcileCareerData } from './result-integrity.js';
import { reconcileMailbox } from './mailbox-core.js';

const DB_NAME = "touchline-career-v5";
const DB_VERSION = 1;
const STORE_NAME = "saves";
const FALLBACK_PREFIX = "touchline.career.v5.";
const LOCAL_FALLBACK_SOFT_LIMIT = 3_600_000;

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in globalThis)) return reject(new Error("IndexedDB unavailable"));
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) database.createObjectStore(STORE_NAME, { keyPath: "saveId" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Unable to open career database"));
  });
}

async function withStore(mode, operation) {
  const database = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      const request = operation(store);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error || new Error("Career storage operation failed"));
      transaction.onabort = () => reject(transaction.error || new Error("Career storage transaction aborted"));
    });
  } finally {
    database.close();
  }
}

function fallbackKey(saveId) {
  return `${FALLBACK_PREFIX}${saveId}`;
}

function readFallback(saveId) {
  try {
    const value = JSON.parse(localStorage.getItem(fallbackKey(saveId)) || "null");
    return value?.fallbackSummaryOnly ? null : value;
  } catch {
    return null;
  }
}

function compactFallback(save) {
  return {
    schemaVersion: save.schemaVersion,
    saveId: save.saveId,
    clubCode: save.clubCode,
    clubName: save.clubName || save.clubCode,
    managerName: save.managerName,
    seasonId: save.seasonId,
    seasonLabel: save.seasonLabel,
    currentDate: save.currentDate,
    status: save.status,
    createdAt: save.createdAt,
    updatedAt: save.updatedAt,
    fallbackSummaryOnly: true,
    storageMode: "indexeddb-primary"
  };
}

function writeFallback(save) {
  try {
    const serialized = JSON.stringify(save);
    if (serialized.length <= LOCAL_FALLBACK_SOFT_LIMIT) {
      localStorage.setItem(fallbackKey(save.saveId), serialized);
      return "full";
    }
    localStorage.setItem(fallbackKey(save.saveId), JSON.stringify(compactFallback(save)));
    return "summary";
  } catch {
    try {
      localStorage.setItem(fallbackKey(save.saveId), JSON.stringify(compactFallback(save)));
      return "summary";
    } catch {
      return "failed";
    }
  }
}

function syncFormationDraftFromCareer(career) {
  if (!career || typeof career !== "object") return;
  if (!career.saveId || !career.clubCode || !career.formation || !career.tacticalLayouts) return;
  globalThis.__touchlineFormationDraft = {
    saveId: career.saveId,
    clubCode: career.clubCode,
    formation: career.formation,
    tacticalLayouts: structuredClone(career.tacticalLayouts)
  };
}

function consumeCareerDraft(save) {
  const draft = globalThis.__touchlineCareerDraft;
  if (!draft || typeof draft !== "object") return save;
  if (draft.saveId !== save.saveId || draft.clubCode !== save.clubCode) return save;
  // A tactics-screen career draft contains the freshest manual player coordinates.
  // Promote those coordinates before mergeFormationDraft can read an older draft.
  syncFormationDraftFromCareer(draft);
  delete globalThis.__touchlineCareerDraft;
  return {
    ...save,
    ...structuredClone(draft),
    tactics: { ...(save.tactics || {}), ...(draft.tactics || {}) },
    results: { ...(save.results || {}), ...(draft.results || {}) },
    playerState: { ...(save.playerState || {}), ...(draft.playerState || {}) },
    playerStats: { ...(save.playerStats || {}), ...(draft.playerStats || {}) },
    world: draft.world ? structuredClone(draft.world) : save.world
  };
}

function mergeFormationDraft(save) {
  const draft = globalThis.__touchlineFormationDraft;
  if (!save || !draft || typeof draft !== "object") return save;
  if (draft.saveId !== save.saveId || draft.clubCode !== save.clubCode) return save;
  if (!draft.formation || !draft.tacticalLayouts) return save;
  return { ...save, formation: draft.formation, tacticalLayouts: structuredClone(draft.tacticalLayouts) };
}

function reconcileStoredCareer(save) {
  if (!save) return save;
  const snapshot = structuredClone(save);
  reconcileCareerData(snapshot);
  reconcileMailbox(snapshot);
  return snapshot;
}

export const CareerRepository = Object.freeze({
  async load(saveId = "primary") {
    try {
      const saved = await withStore("readonly", store => store.get(saveId));
      return reconcileStoredCareer(mergeFormationDraft(saved || readFallback(saveId)));
    } catch {
      return reconcileStoredCareer(mergeFormationDraft(readFallback(saveId)));
    }
  },

  async save(save) {
    const merged = reconcileStoredCareer(mergeFormationDraft(consumeCareerDraft(save)));
    const snapshot = structuredClone({ ...merged, updatedAt: new Date().toISOString() });
    const fallbackMode = writeFallback(snapshot);
    try {
      await withStore("readwrite", store => store.put(snapshot));
    } catch (error) {
      if (fallbackMode !== "full") throw error;
      // A complete localStorage fallback already contains the same transactional snapshot.
    }
    return snapshot;
  },

  async remove(saveId = "primary") {
    if (globalThis.__touchlineFormationDraft?.saveId === saveId) delete globalThis.__touchlineFormationDraft;
    try { localStorage.removeItem(fallbackKey(saveId)); } catch {}
    try { await withStore("readwrite", store => store.delete(saveId)); } catch {}
  }
});

export function legacyClubSelection() {
  try {
    const legacy = JSON.parse(localStorage.getItem("touchline.career.mode.v1") || "null");
    return legacy?.selectedClubCode || null;
  } catch {
    return null;
  }
}
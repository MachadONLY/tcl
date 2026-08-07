export const MANAGER_PROFILE_KEY = "touchline.manager.profile.v1";
export const LEGACY_CAREER_KEY = "touchline.career.mode.v1";
export const CAREER_FALLBACK_KEY = "touchline.career.v2.primary";

const VALID_ROUTES = new Set(["home", "squad", "tactics", "calendar", "league", "inbox", "club"]);
const DEFAULT_MANAGER_NAME = "Gabriel Machado";
const DEFAULT_COUNTRY = "Brasil";

function nowIso() {
  return new Date().toISOString();
}

function parseJson(value, fallback = null) {
  try {
    return JSON.parse(value || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function readLocal(key, fallback = null) {
  try {
    return parseJson(localStorage.getItem(key), fallback);
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function normalizeRoute(route) {
  return VALID_ROUTES.has(route) ? route : "home";
}

function baseProfile(createdAt = nowIso()) {
  return {
    schemaVersion: 1,
    profileId: "manager-primary",
    managerName: DEFAULT_MANAGER_NAME,
    country: DEFAULT_COUNTRY,
    level: 1,
    xp: 0,
    activeSaveId: null,
    activeClubCode: null,
    activeClubName: null,
    seasonLabel: "2026/27",
    currentDate: null,
    lastRoute: "home",
    storagePersistent: null,
    createdAt,
    updatedAt: createdAt,
    lastPlayedAt: null
  };
}

function normalizeProfile(profile) {
  const fallback = baseProfile(profile?.createdAt || nowIso());
  return {
    ...fallback,
    ...(profile && typeof profile === "object" ? profile : {}),
    schemaVersion: 1,
    profileId: String(profile?.profileId || fallback.profileId),
    managerName: String(profile?.managerName || DEFAULT_MANAGER_NAME).trim() || DEFAULT_MANAGER_NAME,
    country: String(profile?.country || DEFAULT_COUNTRY).trim() || DEFAULT_COUNTRY,
    level: Math.max(1, Number(profile?.level) || 1),
    xp: Math.max(0, Number(profile?.xp) || 0),
    lastRoute: normalizeRoute(profile?.lastRoute)
  };
}

export function readManagerProfile() {
  const stored = readLocal(MANAGER_PROFILE_KEY);
  const profile = normalizeProfile(stored);
  if (!stored) writeLocal(MANAGER_PROFILE_KEY, profile);
  return profile;
}

export function writeManagerProfile(patch = {}) {
  const current = readManagerProfile();
  const next = normalizeProfile({
    ...current,
    ...patch,
    updatedAt: nowIso()
  });
  writeLocal(MANAGER_PROFILE_KEY, next);
  return next;
}

export function readCareerSummary() {
  const profile = readManagerProfile();
  const legacy = readLocal(LEGACY_CAREER_KEY, {}) || {};
  const career = readLocal(CAREER_FALLBACK_KEY, null);
  const clubCode = career?.clubCode || legacy.selectedClubCode || profile.activeClubCode || null;
  const clubName = legacy.selectedClubName || profile.activeClubName || clubCode;
  const hasCareer = Boolean(
    clubCode && (
      career?.saveId === "primary" ||
      legacy.onboardingComplete ||
      profile.activeSaveId === "primary"
    )
  );

  return {
    hasCareer,
    saveId: career?.saveId || profile.activeSaveId || (hasCareer ? "primary" : null),
    clubCode,
    clubName,
    managerName: career?.managerName || profile.managerName,
    seasonLabel: career?.seasonLabel || legacy.careerSeason || profile.seasonLabel || "2026/27",
    currentDate: career?.currentDate || profile.currentDate || null,
    updatedAt: career?.updatedAt || profile.updatedAt || null,
    lastRoute: normalizeRoute(profile.lastRoute),
    profile,
    career
  };
}

export function activateCareerProfile(career, clubName = null) {
  if (!career?.clubCode) return readManagerProfile();
  return writeManagerProfile({
    managerName: career.managerName || readManagerProfile().managerName,
    activeSaveId: career.saveId || "primary",
    activeClubCode: career.clubCode,
    activeClubName: clubName || career.clubName || career.clubCode,
    seasonLabel: career.seasonLabel || "2026/27",
    currentDate: career.currentDate || null,
    lastRoute: "home",
    lastPlayedAt: nowIso()
  });
}

export function syncManagerProfileFromCareer(career) {
  if (!career?.clubCode) return readManagerProfile();
  return writeManagerProfile({
    managerName: career.managerName || readManagerProfile().managerName,
    activeSaveId: career.saveId || "primary",
    activeClubCode: career.clubCode,
    seasonLabel: career.seasonLabel || "2026/27",
    currentDate: career.currentDate || null,
    lastPlayedAt: nowIso()
  });
}

export function recordCareerRoute(route) {
  const nextRoute = normalizeRoute(route);
  const summary = readCareerSummary();
  if (!summary.hasCareer) return summary.profile;
  return writeManagerProfile({
    lastRoute: nextRoute,
    lastPlayedAt: nowIso(),
    currentDate: summary.currentDate,
    activeSaveId: summary.saveId,
    activeClubCode: summary.clubCode,
    activeClubName: summary.clubName
  });
}

export function markStoragePersistence(granted) {
  return writeManagerProfile({ storagePersistent: Boolean(granted) });
}

export function clearActiveCareerProfile() {
  return writeManagerProfile({
    activeSaveId: null,
    activeClubCode: null,
    activeClubName: null,
    currentDate: null,
    lastRoute: "home",
    lastPlayedAt: null
  });
}

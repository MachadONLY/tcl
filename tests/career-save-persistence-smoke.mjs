import assert from "node:assert/strict";

const values = new Map();
globalThis.localStorage = {
  getItem(key) { return values.has(key) ? values.get(key) : null; },
  setItem(key, value) { values.set(key, String(value)); },
  removeItem(key) { values.delete(key); },
  clear() { values.clear(); }
};

const {
  CAREER_FALLBACK_KEY,
  LEGACY_CAREER_KEY,
  MANAGER_PROFILE_KEY,
  activateCareerProfile,
  ensureLegacyCareerPointer,
  readCareerSummary,
  readManagerProfile,
  recordCareerRoute
} = await import("../src/career-save-profile.js");

const profile = readManagerProfile();
assert.equal(profile.managerName, "Gabriel Machado");
assert.equal(profile.lastRoute, "home");
assert.ok(localStorage.getItem(MANAGER_PROFILE_KEY));
assert.equal(readCareerSummary().hasCareer, false);

const career = {
  schemaVersion: 3,
  saveId: "primary",
  clubCode: "MUN",
  managerName: "Gabriel Machado",
  seasonLabel: "2026/27",
  currentDate: "2026-08-15",
  createdAt: "2026-08-06T20:00:00.000Z",
  updatedAt: "2026-08-06T20:05:00.000Z"
};

localStorage.setItem(CAREER_FALLBACK_KEY, JSON.stringify(career));
localStorage.setItem(LEGACY_CAREER_KEY, JSON.stringify({
  onboardingComplete: true,
  selectedClubCode: "MUN",
  selectedClubName: "Manchester United",
  careerSeason: "2026/27"
}));
activateCareerProfile(career, "Manchester United");

let summary = readCareerSummary();
assert.equal(summary.hasCareer, true);
assert.equal(summary.clubCode, "MUN");
assert.equal(summary.clubName, "Manchester United");
assert.equal(summary.currentDate, "2026-08-15");

recordCareerRoute("calendar");
summary = readCareerSummary();
assert.equal(summary.lastRoute, "calendar");

localStorage.removeItem(LEGACY_CAREER_KEY);
summary = ensureLegacyCareerPointer();
assert.equal(summary.hasCareer, true);
assert.equal(summary.legacy.selectedClubCode, "MUN");
assert.equal(summary.legacy.onboardingComplete, true);

localStorage.removeItem(LEGACY_CAREER_KEY);
localStorage.removeItem(CAREER_FALLBACK_KEY);
summary = readCareerSummary();
assert.equal(summary.hasCareer, false, "profile metadata alone must not create a phantom career");

console.log(JSON.stringify({
  ok: true,
  managerName: profile.managerName,
  resumedRoute: "calendar",
  durableStores: ["IndexedDB", "localStorage"]
}, null, 2));

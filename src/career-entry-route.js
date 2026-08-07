import { ensureLegacyCareerPointer } from "./career-save-profile.js";

const isBareEntry = !window.location.hash || window.location.hash === "#";

if (isBareEntry) {
  const summary = ensureLegacyCareerPointer();
  const destination = summary.hasCareer ? summary.lastRoute : "welcome";
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${window.location.search}#${destination}`
  );
}

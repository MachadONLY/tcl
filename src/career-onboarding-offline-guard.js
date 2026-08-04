// The club selector is a packaged game screen: runtime media must stay local.
const nativeFetch = window.fetch.bind(window);
const BLOCKED_HOSTS = new Set([
  "www.thesportsdb.com",
  "r2.thesportsdb.com",
  "en.wikipedia.org",
  "upload.wikimedia.org",
  "commons.wikimedia.org",
  "images.fotmob.com",
  "crests.football-data.org",
  "assets.adidas.com",
  "r.jina.ai",
  "images.weserv.nl",
  "resources.premierleague.pulselive.com",
  "www.footyheadlines.com"
]);

window.fetch = function touchlineOfflineAwareFetch(input, init) {
  let url;
  try {
    url = new URL(typeof input === "string" ? input : input?.url, window.location.href);
  } catch {
    return nativeFetch(input, init);
  }

  const onboardingActive = document.documentElement.classList.contains("touchline-onboarding-mode")
    || window.location.hash === "#club-select"
    || window.location.hash === "#welcome";

  if (onboardingActive && BLOCKED_HOSTS.has(url.hostname)) {
    return Promise.reject(new TypeError(`Touchline onboarding is offline-only: ${url.hostname}`));
  }

  return nativeFetch(input, init);
};

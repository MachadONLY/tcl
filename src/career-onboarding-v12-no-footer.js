import "./career-onboarding-v12-no-footer.css";

let scheduledFrame = 0;

function removeClubSelectorFooter() {
  const root = document.querySelector(".career-club-selection");
  if (!root) return;

  root.classList.add("no-onboarding-footer");

  const controls = new Set([
    ...root.querySelectorAll(".club-selection-controls"),
    ...root.querySelectorAll("footer")
  ]);

  controls.forEach(element => {
    if (!(element instanceof HTMLElement)) return;
    if (
      element.matches(".club-selection-controls")
      || element.querySelector("[data-confirm-club]")
      || element.querySelector("[data-back-welcome]")
    ) {
      element.remove();
    }
  });
}

function scheduleRemoval() {
  cancelAnimationFrame(scheduledFrame);
  scheduledFrame = requestAnimationFrame(() => {
    removeClubSelectorFooter();
    requestAnimationFrame(removeClubSelectorFooter);
  });
}

const observer = new MutationObserver(mutations => {
  const relevant = mutations.some(mutation =>
    [...mutation.addedNodes].some(node => node instanceof Element && (
      node.matches?.(".career-club-selection, .club-selection-controls, footer")
      || node.querySelector?.(".career-club-selection, .club-selection-controls, footer")
    ))
  );

  if (relevant) scheduleRemoval();
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true
});

window.addEventListener("hashchange", scheduleRemoval);
document.addEventListener("DOMContentLoaded", scheduleRemoval, { once: true });
scheduleRemoval();

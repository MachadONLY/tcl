import "./career-onboarding-v4.css";

let frame = 0;

function applyViewportFit() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    document.documentElement.style.setProperty("--touchline-viewport-height", `${window.innerHeight}px`);

    const root = document.querySelector(".career-club-selection");
    if (!root) return;
    root.classList.add("onboarding-fit-v4");

    const details = root.querySelector("[data-club-details]");
    details?.classList.add("club-details-v4");

    const grid = details?.querySelector(".club-selection-grid");
    if (!details || !grid) return;

    const overflow = Math.max(0, grid.scrollHeight - details.clientHeight);
    root.classList.toggle("onboarding-fit-v4-tight", overflow > 1 || window.innerHeight < 820);
  });
}

const observer = new MutationObserver(mutations => {
  const relevant = mutations.some(mutation => [...mutation.addedNodes].some(node => {
    if (!(node instanceof Element)) return false;
    return node.matches?.(".career-club-selection, [data-club-details], .club-selection-grid")
      || node.querySelector?.(".career-club-selection, [data-club-details], .club-selection-grid");
  }));
  if (relevant) applyViewportFit();
});

observer.observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener("resize", applyViewportFit, { passive: true });
window.visualViewport?.addEventListener("resize", applyViewportFit, { passive: true });
window.addEventListener("hashchange", applyViewportFit);
document.addEventListener("DOMContentLoaded", applyViewportFit, { once: true });
applyViewportFit();

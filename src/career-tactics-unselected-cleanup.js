const app = document.querySelector('#app');
const TITLE = 'Não relacionados';
let cleanupQueued = false;

function cleanUnselectedHeader() {
  cleanupQueued = false;
  if (location.hash !== '#tactics') return;

  const root = document.querySelector('.tl-tactics-studio');
  const header = root?.querySelector('.tl-squad-manager > header');
  if (!header) return;

  const scrollTools = header.querySelector('.tl-roster-scroll-tools');
  scrollTools?.remove();
  const currentTitle = header.querySelector('[data-unselected-title]');
  const alreadyClean = Boolean(currentTitle)
    && currentTitle.textContent === TITLE
    && !header.querySelector('nav, small, [data-roster-filter], .tl-roster-scroll-tools');

  if (!alreadyClean) {
    const title = currentTitle || document.createElement('span');
    title.dataset.unselectedTitle = '';
    title.textContent = TITLE;
    header.replaceChildren(title);
  }

  root.querySelectorAll('[data-roster-filter]').forEach(button => button.remove());
  root.querySelectorAll('.tl-roster-scroll-tools').forEach(tools => tools.remove());
}

function horizontalReserveWheel(event) {
  if (location.hash !== '#tactics') return;
  const lane = event.target instanceof Element
    ? event.target.closest('.tl-roster-grid.reserves')
    : null;
  if (!lane || lane.scrollWidth <= lane.clientWidth + 1) return;

  const dominantDelta = Math.abs(event.deltaX) >= Math.abs(event.deltaY)
    ? event.deltaX
    : event.deltaY;
  if (!dominantDelta) return;

  const before = lane.scrollLeft;
  lane.scrollLeft += dominantDelta;
  if (Math.abs(lane.scrollLeft - before) > .5) event.preventDefault();
}

function scheduleCleanup() {
  if (cleanupQueued) return;
  cleanupQueued = true;
  queueMicrotask(cleanUnselectedHeader);
}

new MutationObserver(scheduleCleanup).observe(app, { childList: true, subtree: true });
app.addEventListener('wheel', horizontalReserveWheel, { passive: false });
window.addEventListener('hashchange', scheduleCleanup);
scheduleCleanup();

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
  const currentTitle = header.querySelector('[data-unselected-title]');
  const alreadyClean = Boolean(currentTitle)
    && currentTitle.textContent === TITLE
    && !header.querySelector('nav, small, [data-roster-filter]');

  if (!alreadyClean) {
    const title = currentTitle || document.createElement('span');
    title.dataset.unselectedTitle = '';
    title.textContent = TITLE;
    header.replaceChildren(title);
    if (scrollTools) header.append(scrollTools);
  }

  root.querySelectorAll('[data-roster-filter]').forEach(button => button.remove());
}

function scheduleCleanup() {
  if (cleanupQueued) return;
  cleanupQueued = true;
  queueMicrotask(cleanUnselectedHeader);
}

new MutationObserver(scheduleCleanup).observe(app, { childList: true, subtree: true });
window.addEventListener('hashchange', scheduleCleanup);
scheduleCleanup();

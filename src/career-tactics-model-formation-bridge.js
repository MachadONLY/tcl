const app = document.querySelector('#app');

function primaryFormationSelect(root) {
  return root.querySelector('.tl-field-hud [data-tl-formation]')
    || root.querySelector('.tl-command-bar [data-tl-formation]');
}

function modelFormationSelect(target) {
  if (!(target instanceof HTMLSelectElement)) return null;
  return target.closest('[data-model-context]') ? target : null;
}

function routeModelFormation(event) {
  const modelSelect = modelFormationSelect(event.target);
  if (!modelSelect) return;
  const root = modelSelect.closest('.tl-tactics-studio');
  const primary = root && primaryFormationSelect(root);
  if (!primary || primary === modelSelect || primary.value === modelSelect.value) return;
  primary.value = modelSelect.value;
  primary.dispatchEvent(new Event('change', { bubbles: true }));
}

function syncModelFormation(root) {
  const primary = primaryFormationSelect(root);
  const model = root.querySelector('[data-model-context] select');
  if (primary && model && model.value !== primary.value) model.value = primary.value;
}

app.addEventListener('change', routeModelFormation, true);
new MutationObserver(() => {
  const root = document.querySelector('.tl-tactics-studio');
  if (root) syncModelFormation(root);
}).observe(app, { childList: true, subtree: true });

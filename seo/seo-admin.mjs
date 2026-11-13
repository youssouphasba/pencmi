// Admin overrides of the title, description and indexing of public pages.
import { apiRequest, el } from '../messaging/messaging-ui.mjs';
import { accountError } from '../compte/account-ui.mjs';

export function mountSeoOverrides(root, defaults = {}) {
  const status = el('p', { role: 'status' });
  const list = el('div', { 'aria-live': 'polite' });
  root.replaceChildren(el('p', { class: 'seo-preview-card', text: 'Chaque page publique a un titre et une description intégrés. Enregistrez un réglage pour les remplacer (titre 10 à 70 caractères, description 50 à 170) ou pour retirer une page des moteurs de recherche. Supprimer le réglage rétablit le texte intégré.' }), status, list);
  const load = async (notice = '') => {
    list.textContent = 'Chargement…';
    try {
      const overrides = await apiRequest('/admin/seo/meta');
      const byPath = new Map(overrides.map((item) => [item.path, item]));
      const paths = [...new Set([...Object.keys(defaults), ...overrides.map((item) => item.path)])].sort();
      list.replaceChildren(...paths.map((path) => row(path, defaults[path], byPath.get(path))));
      status.textContent = notice;
    } catch (error) { accountError(list, error, () => load()); }
  };
  const row = (path, base = {}, override) => {
    const title = el('input', { name: 'title', value: override?.title ?? base.title ?? '', minLength: 10, maxLength: 70, required: true });
    const description = el('textarea', { name: 'description', rows: 2, minLength: 50, maxLength: 170, value: override?.description ?? base.description ?? '' });
    const noindex = el('input', { type: 'checkbox', name: 'noindex', checked: Boolean(override?.noindex) });
    const counter = el('small', {});
    const count = () => { counter.textContent = `${title.value.trim().length}/70 · ${description.value.trim().length}/170`; };
    title.addEventListener('input', count); description.addEventListener('input', count); count();
    const form = el('form', { class: 'seo-preview-card', noValidate: true },
      el('h2', { text: path }),
      el('p', { text: override ? 'Réglage personnalisé en ligne.' : 'Texte intégré au site.' }),
      el('label', {}, 'Titre ', title), el('label', {}, 'Description ', description), counter,
      el('label', {}, noindex, ' Ne pas indexer cette page'),
      el('div', { class: 'ds-cluster' },
        el('button', { class: 'ds-button ds-button-primary', type: 'submit', text: 'Enregistrer' }),
        override ? el('button', { class: 'ds-button ds-button-outline', type: 'button', text: 'Rétablir le texte intégré', onClick: async () => {
          try { await apiRequest(`/admin/seo/meta/${encodeURIComponent(override.id)}`, { method: 'DELETE' }); await load(`Texte intégré rétabli pour ${path}.`); }
          catch (error) { status.textContent = error.message || 'Suppression impossible.'; }
        } }) : null));
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const body = { path, title: title.value.trim(), description: description.value.trim(), noindex: noindex.checked };
      if (body.title.length < 10 || body.title.length > 70) { status.textContent = `${path} : le titre doit faire 10 à 70 caractères.`; title.focus(); return; }
      if (body.description.length < 50 || body.description.length > 170) { status.textContent = `${path} : la description doit faire 50 à 170 caractères.`; description.focus(); return; }
      try { await apiRequest('/admin/seo/meta', { method: 'PUT', body }); await load(`Réglage enregistré pour ${path}.`); }
      catch (error) { status.textContent = error.message || 'Enregistrement impossible.'; }
    });
    return form;
  };
  return load();
}

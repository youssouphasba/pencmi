import { apiRequest, el, formatDateTime, hasSession, loginHref } from '../messaging/messaging-ui.mjs';
import { ensureSavedStyles } from './enhance.mjs';

const MODULES = { real_estate: 'Immobilier', hotels: 'Hôtels', vehicles: 'Voitures', trips: 'Voyages' };
const PAGE_SIZE = 20;
const price = (row) => (row.price === null || row.price === undefined ? null : `${Number(row.price).toLocaleString('fr-FR')} ${row.currency || 'FCFA'}`);

export function mountFavorites(root, { module, title, browseHref, browseLabel = 'Voir les annonces' }) {
  ensureSavedStyles();
  const heading = el('h1', { text: title });
  if (!hasSession()) {
    root.replaceChildren(el('section', { class: 'pm-panel' }, heading, el('p', { text: 'Connectez-vous pour retrouver vos favoris.' }), el('a', { class: 'btn btn-primary', href: loginHref(), text: 'Se connecter' })));
    return;
  }
  const state = { page: 1, module: module || '' };
  const body = el('div', { 'aria-live': 'polite' });
  root.replaceChildren(el('div', { class: 'sv-page' },
    el('div', { class: 'sv-toolbar' }, heading,
      module ? null : el('label', { class: 'pm-field' }, el('span', { text: 'Univers' }), el('select', { name: 'module', onChange: (event) => { state.module = event.currentTarget.value; state.page = 1; void load(); } },
        el('option', { value: '', text: 'Tous' }), Object.entries(MODULES).map(([value, text]) => el('option', { value, text }))))),
    body));

  async function load() {
    body.replaceChildren(el('p', { class: 'pm-muted', text: 'Chargement des favoris…' }));
    const query = new URLSearchParams({ page: String(state.page), limit: String(PAGE_SIZE) });
    if (state.module) query.set('module', state.module);
    try {
      const result = await apiRequest(`/favorites?${query}`, { includeMeta: true });
      // Removing the last row of a last page must not leave an empty page behind.
      if (!result.data.length && state.page > 1) { state.page -= 1; return load(); }
      draw(result.data, result.meta || {});
    } catch (error) {
      body.replaceChildren(el('div', { class: 'pm-panel', role: 'alert' }, el('p', { text: error.message || 'Chargement impossible.' }),
        el('button', { class: 'btn btn-light', type: 'button', text: 'Réessayer', onClick: () => void load() })));
    }
  }

  function row(item) {
    const failure = el('p', { class: 'pm-status pm-error', role: 'alert', hidden: true });
    const remove = el('button', { class: 'btn btn-ghost', type: 'button', text: 'Retirer des favoris', onClick: async () => {
      remove.disabled = true;
      failure.hidden = true;
      try {
        await apiRequest(`/favorites/${encodeURIComponent(item.module)}/${encodeURIComponent(item.listingId)}`, { method: 'DELETE' });
        await load();
      } catch (error) {
        failure.textContent = error.message || 'Suppression impossible. Réessayez.';
        failure.hidden = false;
        remove.disabled = false;
      }
    } });
    return el('li', { class: `sv-card${item.photo ? '' : ' is-plain'}` },
      item.photo ? el('img', { src: item.photo, alt: '', loading: 'lazy' }) : null,
      el('div', {},
        el('h2', { text: item.available ? item.title : 'Annonce indisponible' }),
        el('p', {}, el('span', { class: 'sv-badge', text: MODULES[item.module] || item.module }), item.available ? null : ' ', item.available ? null : el('span', { class: 'sv-badge is-off', text: 'Plus en ligne' })),
        item.available ? el('p', { class: 'pm-muted', text: [item.city, item.category].filter(Boolean).join(' · ') }) : el('p', { class: 'pm-muted', text: 'Cette annonce n’est plus visible. Vous pouvez la retirer de vos favoris.' }),
        item.available && price(item) ? el('p', {}, el('strong', { text: price(item) })) : null,
        item.available && item.module === 'trips' ? el('p', { class: 'pm-muted', text: item.nextDeparture ? `Prochain départ : ${formatDateTime(item.nextDeparture)}` : 'Aucun départ à venir pour le moment.' }) : null,
        el('div', { class: 'sv-actions' }, item.available && item.url?.startsWith('/') ? el('a', { class: 'btn btn-light', href: item.url, text: 'Voir l’annonce' }) : null, remove),
        failure));
  }

  function draw(rows, meta) {
    if (!rows.length) {
      body.replaceChildren(el('div', { class: 'pm-panel' }, el('h2', { text: 'Vous n’avez encore ajouté aucun favori.' }), browseHref ? el('a', { class: 'btn btn-primary', href: browseHref, text: browseLabel }) : null));
      return;
    }
    const totalPages = meta.totalPages || 1;
    body.replaceChildren(
      el('p', { class: 'pm-muted', text: `${meta.total ?? rows.length} favori${(meta.total ?? rows.length) > 1 ? 's' : ''}` }),
      el('ul', { class: 'sv-list' }, rows.map(row)),
      totalPages > 1 ? el('nav', { class: 'pm-pagination', 'aria-label': 'Pages de favoris' },
        el('button', { class: 'btn btn-light', type: 'button', text: 'Précédent', disabled: state.page <= 1, onClick: () => { state.page -= 1; void load(); } }),
        el('span', { text: `Page ${state.page} sur ${totalPages}` }),
        el('button', { class: 'btn btn-light', type: 'button', text: 'Suivant', disabled: state.page >= totalPages, onClick: () => { state.page += 1; void load(); } })) : null);
  }
  void load();
}

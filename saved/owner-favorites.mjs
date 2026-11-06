import { apiRequest, el, hasSession, loginHref } from '../messaging/messaging-ui.mjs';
import { ensureSavedStyles } from './enhance.mjs';

/** Totals per listing of the owner. Who saved a listing is not known to this page, nor to its API. */
export function mountOwnerFavorites(root, { module }) {
  ensureSavedStyles();
  if (!hasSession()) {
    root.replaceChildren(el('section', { class: 'pm-panel' }, el('p', { text: 'Connectez-vous pour voir vos favoris reçus.' }), el('a', { class: 'btn btn-primary', href: loginHref(), text: 'Se connecter' })));
    return;
  }
  const state = { period: '30' };
  const body = el('div', { 'aria-live': 'polite' });
  root.replaceChildren(el('div', { class: 'sv-page' },
    el('label', { class: 'pm-field' }, el('span', { text: 'Période' }), el('select', { name: 'period', onChange: (event) => { state.period = event.currentTarget.value; void load(); } },
      [['today', 'Aujourd’hui'], ['7', '7 derniers jours'], ['30', '30 derniers jours'], ['90', '90 derniers jours']].map(([value, text]) => el('option', { value, text, selected: value === state.period })))),
    body));

  async function load() {
    body.replaceChildren(el('p', { class: 'pm-muted', text: 'Chargement des favoris…' }));
    try {
      const report = await apiRequest(`/dashboard/stats/report?module=${encodeURIComponent(module)}&period=${encodeURIComponent(state.period)}`);
      const rows = report.options.filter((row) => report.favorites.byListing[row.id]).sort((a, b) => report.favorites.byListing[b.id] - report.favorites.byListing[a.id]);
      body.replaceChildren(
        el('p', {}, el('strong', { text: `${report.favorites.inPeriod.toLocaleString('fr-FR')} sur la période` }), ` · ${report.favorites.allTime.toLocaleString('fr-FR')} au total`),
        rows.length ? el('table', { class: 'pm-table' }, el('thead', {}, el('tr', {}, ['Annonce', 'Favoris sur la période'].map((text) => el('th', { scope: 'col', text })))),
          el('tbody', {}, rows.map((row) => el('tr', {}, el('td', { 'data-label': 'Annonce', text: row.deleted ? `${row.title} (supprimée)` : row.title }), el('td', { 'data-label': 'Favoris sur la période', text: String(report.favorites.byListing[row.id]) })))))
          : el('div', { class: 'pm-panel' }, el('h2', { text: 'Aucune annonce ajoutée en favori sur cette période.' })));
    } catch (error) {
      body.replaceChildren(el('div', { class: 'pm-panel', role: 'alert' }, el('p', { text: error.message || 'Chargement impossible.' }),
        el('button', { class: 'btn btn-light', type: 'button', text: 'Réessayer', onClick: () => void load() })));
    }
  }
  void load();
}

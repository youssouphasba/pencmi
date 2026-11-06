import { apiRequest, el, hasSession, loginHref } from '../messaging/messaging-ui.mjs';
import { ensureSavedStyles } from './enhance.mjs';

const MODULES = { real_estate: 'Immobilier', hotels: 'Hôtels', vehicles: 'Voitures', trips: 'Voyages' };
const select = (name, label, options) => ({ name, label, options });
const text = (name, label) => ({ name, label, type: 'text' });
const number = (name, label, min = 0) => ({ name, label, type: 'number', min });
const FIELDS = {
  real_estate: [
    select('transaction', 'Transaction', [['location', 'Location'], ['vente', 'Vente'], ['achat', 'Achat']]),
    select('propertyType', 'Type de bien', ['appartement', 'maison', 'villa', 'terrain', 'studio', 'chambre', 'bureau', 'commerce'].map((value) => [value, value[0].toUpperCase() + value.slice(1)])),
    text('city', 'Ville ou quartier'), number('minPrice', 'Prix minimum (FCFA)'), number('maxPrice', 'Prix maximum (FCFA)'), number('minSurface', 'Surface minimum (m²)'),
  ],
  hotels: [text('city', 'Destination'), select('propertyType', 'Type d’hébergement', 'hotelTypes')],
  vehicles: [
    select('vehicleMode', 'Type d’annonce', [['sale', 'Vente'], ['rental', 'Location'], ['chauffeur', 'Avec chauffeur']]),
    text('brand', 'Marque'), text('model', 'Modèle'), text('city', 'Ville'), number('minPrice', 'Budget minimum (FCFA)'), number('maxPrice', 'Budget maximum (FCFA)'), number('minYear', 'Année minimum', 1900),
    select('fuel', 'Carburant', ['Essence', 'Diesel', 'Hybride', 'Électrique'].map((value) => [value, value])),
    select('gearbox', 'Boîte de vitesse', ['Automatique', 'Manuelle'].map((value) => [value, value])),
  ],
  trips: [
    text('departureCity', 'Départ'), text('arrivalCity', 'Arrivée'), { name: 'date', label: 'Date', type: 'date' }, number('passengers', 'Passagers', 1), number('minPrice', 'Prix minimum (FCFA)'), number('maxPrice', 'Prix maximum (FCFA)'),
    select('vehicleType', 'Type de transport', 'tripTypes'),
    select('timeOfDay', 'Moment du départ', [['morning', 'Matin (6 h à 12 h)'], ['afternoon', 'Après-midi (12 h à 17 h)'], ['evening', 'Soir (17 h à 21 h)'], ['night', 'Nuit (21 h à 6 h)']]),
  ],
};
const NOTE = { hotels: 'Le prix et les dates ne sont pas proposés : le stock des établissements ne permet pas encore une comparaison fiable.' };
const PAGE_SIZE = 20;

async function optionLists() {
  const [{ hotelCatalog }, { tripTypes }] = await Promise.all([import('../publier/hotel-publication.mjs'), import('../voyages/trip-content.mjs')]);
  return { hotelTypes: Object.entries(hotelCatalog.types), tripTypes: Object.entries(tripTypes) };
}

function describe(module, filters, lists) {
  return FIELDS[module].filter((field) => filters?.[field.name] !== undefined).map((field) => {
    const options = typeof field.options === 'string' ? lists[field.options] : field.options;
    const value = filters[field.name];
    return `${field.label} : ${options?.find(([key]) => String(key).toLowerCase() === String(value).toLowerCase())?.[1] ?? value}`;
  }).join(' · ');
}

/** `module` set: the alerts of one universe, with the form. Without it: every alert of the account. */
export function mountAlerts(root, { module, title }) {
  ensureSavedStyles();
  const heading = el('h1', { text: title });
  if (!hasSession()) {
    root.replaceChildren(el('section', { class: 'pm-panel' }, heading, el('p', { text: 'Connectez-vous pour gérer vos alertes.' }), el('a', { class: 'btn btn-primary', href: loginHref(), text: 'Se connecter' })));
    return;
  }
  const state = { page: 1, module: module || '', editing: null, lists: { hotelTypes: [], tripTypes: [] } };
  const notice = el('p', { class: 'pm-muted', role: 'status' });
  const formArea = el('div', {});
  const body = el('div', { 'aria-live': 'polite' });
  root.replaceChildren(el('div', { class: 'sv-page' },
    el('div', { class: 'sv-toolbar' }, heading, module ? null : el('label', { class: 'pm-field' }, el('span', { text: 'Univers' }), el('select', { name: 'module', onChange: (event) => { state.module = event.currentTarget.value; state.page = 1; void load(); } },
      el('option', { value: '', text: 'Tous' }), Object.entries(MODULES).map(([value, label]) => el('option', { value, text: label }))))),
    notice, formArea, body));

  function field(definition, value) {
    if (definition.options) {
      const options = typeof definition.options === 'string' ? state.lists[definition.options] : definition.options;
      return el('label', { class: 'pm-field' }, el('span', { text: definition.label }), el('select', { name: definition.name },
        el('option', { value: '', text: 'Peu importe' }), options.map(([key, label]) => el('option', { value: key, text: label, selected: String(key).toLowerCase() === String(value ?? '').toLowerCase() }))));
    }
    return el('label', { class: 'pm-field' }, el('span', { text: definition.label }), el('input', { name: definition.name, type: definition.type, ...(definition.min !== undefined ? { min: definition.min } : {}), value: value ?? '' }));
  }

  function drawForm(alert) {
    const target = alert?.module || module;
    if (!target) { formArea.replaceChildren(); return; }
    state.editing = alert || null;
    const status = el('p', { class: 'pm-status', role: 'status' });
    const submit = el('button', { class: 'btn btn-primary', type: 'submit', text: alert ? 'Enregistrer les modifications' : 'Créer l’alerte' });
    const form = el('form', { class: 'sv-form', noValidate: true, onSubmit: async (event) => {
      event.preventDefault();
      if (submit.disabled) return;
      const data = new FormData(form);
      const filters = {};
      for (const definition of FIELDS[target]) {
        const value = String(data.get(definition.name) ?? '').trim();
        if (value) filters[definition.name] = definition.type === 'number' ? Number(value) : value;
      }
      submit.disabled = true;
      status.className = 'pm-status';
      status.textContent = 'Enregistrement…';
      try {
        const name = String(data.get('name') ?? '').trim();
        if (alert) await apiRequest(`/saved-alerts/${encodeURIComponent(alert.id)}`, { method: 'PATCH', body: { name, filters } });
        else await apiRequest('/saved-alerts', { method: 'POST', body: { module: target, name, filters } });
        drawForm(null);
        await load();
      } catch (error) {
        status.className = 'pm-status pm-error';
        status.textContent = error.fields?.length ? `${error.message} (${error.fields.map((row) => row.path).join(', ')})` : error.message || 'Enregistrement impossible. Vos saisies sont conservées.';
        submit.disabled = false;
      }
    } },
    el('h2', { text: alert ? 'Modifier l’alerte' : `Nouvelle alerte ${MODULES[target].toLowerCase()}` }),
    NOTE[target] ? el('p', { class: 'pm-muted', text: NOTE[target] }) : null,
    el('label', { class: 'pm-field' }, el('span', { text: 'Nom de l’alerte' }), el('input', { name: 'name', required: true, maxLength: 120, value: alert?.name ?? '' })),
    el('div', { class: 'sv-fields' }, FIELDS[target].map((definition) => field(definition, alert?.filters?.[definition.name]))),
    el('div', { class: 'sv-actions' }, submit, alert ? el('button', { class: 'btn btn-ghost', type: 'button', text: 'Annuler', onClick: () => drawForm(null) }) : null),
    status);
    formArea.replaceChildren(form);
    if (alert) form.scrollIntoView({ block: 'nearest' });
  }

  async function load() {
    body.replaceChildren(el('p', { class: 'pm-muted', text: 'Chargement des alertes…' }));
    const query = new URLSearchParams({ page: String(state.page), limit: String(PAGE_SIZE) });
    if (state.module) query.set('module', state.module);
    try {
      const result = await apiRequest(`/saved-alerts?${query}`, { includeMeta: true });
      if (!result.data.length && state.page > 1) { state.page -= 1; return load(); }
      draw(result.data, result.meta || {});
    } catch (error) {
      body.replaceChildren(el('div', { class: 'pm-panel', role: 'alert' }, el('p', { text: error.message || 'Chargement impossible.' }),
        el('button', { class: 'btn btn-light', type: 'button', text: 'Réessayer', onClick: () => void load() })));
    }
  }

  function row(alert) {
    const failure = el('p', { class: 'pm-status pm-error', role: 'alert', hidden: true });
    const results = el('div', {});
    const act = (work) => async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      failure.hidden = true;
      try {
        await work();
      } catch (error) {
        failure.textContent = error.message || 'Action impossible. Réessayez.';
        failure.hidden = false;
        button.disabled = false;
      }
    };
    const showResults = async (page = 1) => {
      results.replaceChildren(el('p', { class: 'pm-muted', text: 'Recherche des annonces…' }));
      const found = await apiRequest(`/saved-alerts/${encodeURIComponent(alert.id)}/matches?page=${page}&limit=10`, { includeMeta: true });
      const meta = found.meta || {};
      results.replaceChildren(found.data.length
        ? el('div', {}, el('p', { class: 'pm-muted', text: `${meta.total ?? found.data.length} annonce(s) en ligne correspondent aujourd’hui.` }),
          el('ul', { class: 'sv-list' }, found.data.map((item) => el('li', {}, item.url?.startsWith('/') ? el('a', { href: item.url, text: item.title }) : el('span', { text: item.title })))),
          meta.totalPages > 1 ? el('nav', { class: 'pm-pagination', 'aria-label': 'Pages de résultats' },
            el('button', { class: 'btn btn-light', type: 'button', text: 'Précédent', disabled: page <= 1, onClick: act(() => showResults(page - 1)) }),
            el('span', { text: `Page ${page} sur ${meta.totalPages}` }),
            el('button', { class: 'btn btn-light', type: 'button', text: 'Suivant', disabled: page >= meta.totalPages, onClick: act(() => showResults(page + 1)) })) : null)
        : el('p', { class: 'pm-muted', text: 'Aucune annonce en ligne ne correspond pour le moment.' }));
    };
    return el('li', { class: 'sv-card is-plain' }, el('div', {},
      el('h2', { text: alert.name }),
      el('p', {}, el('span', { class: 'sv-badge', text: MODULES[alert.module] || alert.module }), ' ', el('span', { class: `sv-badge ${alert.active ? 'is-on' : 'is-off'}`, text: alert.active ? 'Active' : 'En pause' })),
      alert.usable ? el('p', { class: 'pm-muted', text: describe(alert.module, alert.filters, state.lists) }) : el('p', { class: 'pm-muted', text: 'Ancien format : cette alerte peut seulement être supprimée.' }),
      el('div', { class: 'sv-actions' },
        alert.usable ? el('button', { class: 'btn btn-light', type: 'button', text: 'Voir les résultats', onClick: act(() => showResults()) }) : null,
        alert.usable && alert.searchUrl?.startsWith('/') ? el('a', { class: 'btn btn-ghost', href: alert.searchUrl, text: 'Ouvrir la recherche' }) : null,
        alert.usable ? el('button', { class: 'btn btn-ghost', type: 'button', text: 'Modifier', onClick: () => drawForm(alert) }) : null,
        alert.usable ? el('button', { class: 'btn btn-ghost', type: 'button', text: alert.active ? 'Mettre en pause' : 'Réactiver', onClick: act(async () => { await apiRequest(`/saved-alerts/${encodeURIComponent(alert.id)}`, { method: 'PATCH', body: { active: !alert.active } }); await load(); }) }) : null,
        el('button', { class: 'btn btn-ghost', type: 'button', text: 'Supprimer', onClick: act(async () => { await apiRequest(`/saved-alerts/${encodeURIComponent(alert.id)}`, { method: 'DELETE' }); if (state.editing?.id === alert.id) drawForm(null); await load(); }) })),
      failure, results));
  }

  function draw(rows, meta) {
    if (!rows.length) {
      body.replaceChildren(el('div', { class: 'pm-panel' }, el('h2', { text: 'Vous n’avez aucune alerte pour le moment.' }),
        module ? null : el('div', { class: 'sv-actions' }, [['/immobilier/alertes', 'Immobilier'], ['/hotels/alertes', 'Hôtels'], ['/voitures/alertes', 'Voitures'], ['/voyages/alertes', 'Voyages']].map(([href, text]) => el('a', { class: 'btn btn-light', href, text: `Créer une alerte : ${text}` })))));
      return;
    }
    const totalPages = meta.totalPages || 1;
    body.replaceChildren(
      el('ul', { class: 'sv-list' }, rows.map(row)),
      totalPages > 1 ? el('nav', { class: 'pm-pagination', 'aria-label': 'Pages d’alertes' },
        el('button', { class: 'btn btn-light', type: 'button', text: 'Précédent', disabled: state.page <= 1, onClick: () => { state.page -= 1; void load(); } }),
        el('span', { text: `Page ${state.page} sur ${totalPages}` }),
        el('button', { class: 'btn btn-light', type: 'button', text: 'Suivant', disabled: state.page >= totalPages, onClick: () => { state.page += 1; void load(); } })) : null);
  }

  void (async () => {
    state.lists = await optionLists().catch(() => state.lists);
    drawForm(null);
    try {
      const capabilities = await apiRequest('/saved-alerts/capabilities');
      notice.textContent = capabilities.internalNotifications
        ? 'Vous recevez une notification dans votre compte quand une nouvelle annonce correspond. Aucun email n’est envoyé.'
        : 'Vos recherches sont enregistrées. Les notifications automatiques ne sont pas encore activées : consultez les résultats depuis cette page.';
    } catch {
      notice.textContent = 'Vos recherches sont enregistrées. Consultez les résultats depuis cette page.';
    }
    await load();
  })();
}

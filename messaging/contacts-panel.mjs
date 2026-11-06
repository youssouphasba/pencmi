import { apiRequest, ensureStyles, el, formatDateTime, hasSession, loginHref } from './messaging-ui.mjs';

const LABELS = {
  internal_message: 'Message interne', form: 'Formulaire de contact', visit_request: 'Demande de visite',
  reservation_request: 'Demande de réservation', rental_request: 'Demande de location', chauffeur_request: 'Demande de chauffeur',
  seat_request: 'Demande de place', whatsapp: 'WhatsApp', phone: 'Téléphone', email: 'Email',
};
const SOURCES = {
  real_estate: ['internal_message', 'visit_request'],
  hotels: ['internal_message', 'reservation_request'],
  vehicles: ['internal_message', 'form', 'rental_request', 'chauffeur_request'],
  trips: ['internal_message', 'seat_request'],
};
const PAGE_SIZE = 20;

const detailLines = (details) => details ? [
  details.clientPhone && `Téléphone : ${details.clientPhone}`,
  details.clientEmail && `Email : ${details.clientEmail}`,
  details.requestedSeats && `Places demandées : ${details.requestedSeats}`,
  details.guests && `Voyageurs : ${details.guests}`,
  details.message,
].filter(Boolean) : [];

/** Recorded contacts only: an absent record shows as absent, never as a contact made. */
export function mountContacts(root, { module, messagesHref }) {
  ensureStyles();
  if (!hasSession()) {
    root.replaceChildren(el('section', { class: 'pm-panel' }, el('p', { text: 'Connectez-vous pour voir vos contacts.' }), el('a', { class: 'btn btn-primary', href: loginHref(), text: 'Se connecter' })));
    return;
  }
  const state = { page: 1, source: '' };
  const body = el('div', { 'aria-live': 'polite' });
  root.replaceChildren(el('div', { class: 'pm-contacts' },
    el('label', { class: 'pm-field pm-contact-filter' }, el('span', { text: 'Source' }), el('select', { name: 'source', onChange: (event) => {
      state.source = event.currentTarget.value;
      state.page = 1;
      void load();
    } }, el('option', { value: '', text: 'Toutes' }), SOURCES[module].map((value) => el('option', { value, text: LABELS[value] })))),
    body,
    el('p', { class: 'pm-muted', text: 'Seuls les messages et les demandes enregistrés sont comptés. Les appels et les ouvertures de WhatsApp ou d’email ne le sont pas.' })));

  async function load() {
    body.replaceChildren(el('p', { class: 'pm-muted', text: 'Chargement des contacts…' }));
    const query = new URLSearchParams({ module, page: String(state.page), limit: String(PAGE_SIZE) });
    if (state.source) query.set('source', state.source);
    try {
      const result = await apiRequest(`/dashboard/contacts?${query}`, { includeMeta: true });
      draw(result.data, result.meta || {});
    } catch (error) {
      body.replaceChildren(el('div', { class: 'pm-panel', role: 'alert' }, el('p', { text: error.message || 'Chargement impossible.' }),
        el('button', { class: 'btn btn-light', type: 'button', text: 'Réessayer', onClick: () => void load() })));
    }
  }

  function draw(rows, meta) {
    if (!rows.length) {
      body.replaceChildren(el('div', { class: 'pm-panel' }, el('h2', { text: state.source ? 'Aucun contact pour cette source.' : 'Aucun contact reçu pour le moment.' })));
      return;
    }
    const totalPages = meta.totalPages || 1;
    body.replaceChildren(
      el('p', { class: 'pm-muted', text: `${meta.total ?? rows.length} contact${(meta.total ?? rows.length) > 1 ? 's' : ''}` }),
      el('table', { class: 'pm-table' },
        el('thead', {}, el('tr', {}, ['Source', 'Annonce', 'Client', 'Détails', 'Date'].map((text) => el('th', { scope: 'col', text })))),
        el('tbody', {}, rows.map((row) => el('tr', {},
          el('td', { 'data-label': 'Source', text: LABELS[row.source] || row.source }),
          el('td', { 'data-label': 'Annonce', text: row.listingTitle || 'Annonce indisponible' }),
          el('td', { 'data-label': 'Client', text: row.details?.clientName || 'Non renseigné' }),
          el('td', { 'data-label': 'Détails' },
            detailLines(row.details).map((text) => el('p', { text })),
            row.details?.conversationId && messagesHref ? el('a', { href: `${messagesHref}?conversation=${encodeURIComponent(row.details.conversationId)}`, text: 'Ouvrir la conversation' }) : null),
          el('td', { 'data-label': 'Date', text: formatDateTime(row.createdAt) }))))),
      totalPages > 1 ? el('nav', { class: 'pm-pagination', 'aria-label': 'Pages de contacts' },
        el('button', { class: 'btn btn-light', type: 'button', text: 'Précédent', disabled: state.page <= 1, onClick: () => { state.page -= 1; void load(); } }),
        el('span', { text: `Page ${state.page} sur ${totalPages}` }),
        el('button', { class: 'btn btn-light', type: 'button', text: 'Suivant', disabled: state.page >= totalPages, onClick: () => { state.page += 1; void load(); } })) : null,
    );
  }

  void load();
}

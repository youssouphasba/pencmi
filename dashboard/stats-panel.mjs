import { apiRequest, el, ensureStyles, hasSession, loginHref } from '../messaging/messaging-ui.mjs';

const UNAVAILABLE = 'Donnée indisponible';
const STATUS = { new: 'Nouvelles', pending: 'En cours', accepted: 'Acceptées', refused: 'Refusées', cancelled: 'Annulées', expired: 'Expirées', completed: 'Terminées', requires_more_info: 'Informations demandées' };
const LISTING_STATUS = { draft: 'Brouillons', pending_review: 'En attente de validation', active: 'Actives', refused: 'Refusées', suspended: 'Suspendues', expired: 'Expirées', deleted: 'Supprimées' };
const SOURCE = { form: 'Formulaire de contact', whatsapp: 'WhatsApp', phone: 'Téléphone', email: 'Email' };
const TYPE = { visit: 'Demandes de visite', reservation: 'Demandes de réservation', rental: 'Demandes de location', chauffeur: 'Demandes de chauffeur', seat: 'Demandes de place' };
const MODULES = {
  real_estate: { active: 'Annonces actives', listing: 'Annonce', listings: 'Annonces', requests: 'Demandes de visite', publish: 'Publiez une annonce pour commencer à recevoir des demandes.' },
  hotels: { active: 'Hébergements actifs', listing: 'Hébergement', listings: 'Hébergements', requests: 'Demandes de réservation', publish: 'Publiez un hébergement pour commencer à recevoir des demandes.' },
  vehicles: { active: 'Annonces actives', listing: 'Annonce', listings: 'Annonces', requests: 'Demandes reçues', publish: 'Publiez une annonce pour commencer à recevoir des demandes.' },
  trips: { active: 'Trajets actifs', listing: 'Trajet', listings: 'Trajets', requests: 'Demandes de place', publish: 'Publiez un trajet pour commencer à recevoir des demandes.' },
};
const number = (value) => Number(value).toLocaleString('fr-FR');
const percent = (value) => `${(value * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
const dayLabel = (date) => new Date(`${date}T00:00:00Z`).toLocaleDateString('fr-FR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' });

function kpi(title, value, note) {
  return el('article', { class: 'ps-kpi' }, el('h3', { text: title }),
    el('div', { class: value === null ? 'kpi-empty ps-unavailable' : 'kpi-value', text: value === null ? UNAVAILABLE : value }),
    note ? el('small', { text: note }) : null);
}

function rows(entries, labels) {
  return el('ul', {}, entries.map(([key, value]) => el('li', { class: 'ps-row' }, el('span', { text: labels?.[key] || key }), el('strong', { text: number(value) }))));
}

function card(title, ...children) {
  return el('section', { class: 'ps-card' }, el('h2', { text: title }), ...children);
}

/** Native SVG: one bar per real day. A period without activity says so rather than drawing a flat chart. */
function chart(title, series, key) {
  const total = series.reduce((sum, row) => sum + row[key], 0);
  if (!total) return card(title, el('p', { class: 'pm-muted', text: 'Aucune activité sur cette période.' }));
  const svgNs = 'http://www.w3.org/2000/svg';
  const peak = Math.max(...series.map((row) => row[key]));
  const svg = document.createElementNS(svgNs, 'svg');
  svg.setAttribute('class', 'ps-chart');
  svg.setAttribute('viewBox', `0 0 ${series.length * 10} 100`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${title} : ${number(total)} au total sur ${series.length} jour${series.length > 1 ? 's' : ''}, maximum ${number(peak)} par jour.`);
  series.forEach((row, index) => {
    if (!row[key]) return;
    const height = Math.max(3, (row[key] / peak) * 96);
    const bar = document.createElementNS(svgNs, 'rect');
    bar.setAttribute('x', String(index * 10 + 1));
    bar.setAttribute('width', '8');
    bar.setAttribute('y', String(100 - height));
    bar.setAttribute('height', String(height));
    const label = document.createElementNS(svgNs, 'title');
    label.textContent = `${dayLabel(row.date)} : ${number(row[key])}`;
    bar.append(label);
    svg.append(bar);
  });
  return card(title, el('p', { class: 'pm-muted', text: `${number(total)} au total` }), svg,
    el('div', { class: 'ps-chart-range' }, el('span', { text: dayLabel(series[0].date) }), el('span', { text: dayLabel(series.at(-1).date) })),
    el('details', {}, el('summary', { text: 'Voir les chiffres par jour' }),
      el('table', {}, el('tbody', {}, series.filter((row) => row[key]).map((row) => el('tr', {}, el('td', { text: dayLabel(row.date) }), el('td', { text: number(row[key]) })))))));
}

function moduleKpis(module, data, words) {
  const cards = [
    kpi(words.active, number(data.listings.byStatus.active || 0)),
    kpi(words.requests, number(data.requests.total), 'Reçues sur la période'),
    kpi('Demandes acceptées', number(data.requests.accepted)),
    kpi('Demandes à traiter', number(data.requests.pending)),
    kpi('Taux d’acceptation', data.acceptanceRate.value === null ? null : percent(data.acceptanceRate.value),
      data.acceptanceRate.value === null ? 'Aucune demande sur la période' : `${number(data.acceptanceRate.accepted)} sur ${number(data.acceptanceRate.received)} demandes`),
    kpi('Contacts directs', number(data.contacts.direct), 'Appels, WhatsApp, emails'),
    kpi('Conversations ouvertes', number(data.messages.conversationsOpened)),
    kpi('Messages reçus', number(data.messages.inbound)),
    kpi('Favoris reçus', number(data.favorites.inPeriod), `${number(data.favorites.allTime)} au total`),
  ];
  if (module === 'hotels') cards.push(
    kpi('Chambres actives', number(data.hotels.rooms.active), `${number(data.hotels.rooms.total)} au total`),
    kpi('Nuits réservées', number(data.hotels.allocatedRoomNights), 'Sur la période'));
  if (module === 'trips') cards.push(
    kpi('Places demandées', number(data.trips.requestedSeats)),
    kpi('Places réservées', number(data.trips.allocatedSeats), 'Sur la période'));
  return cards;
}

function draw(body, module, data, words) {
  const noActivity = !data.requests.total && !data.contacts.direct && !data.messages.inbound && !data.messages.conversationsOpened;
  body.replaceChildren(
    el('section', { class: 'ps-kpis', 'aria-label': 'Indicateurs' }, moduleKpis(module, data, words)),
    noActivity ? el('p', { class: 'ps-card', text: 'Rien à signaler sur cette période : aucune demande, aucun contact, aucun message.' }) : null,
    el('div', { class: 'ps-grid' },
      chart(`${words.requests} par jour`, data.series, 'requests'),
      chart('Contacts directs par jour', data.series, 'contacts'),
      chart('Messages reçus par jour', data.series, 'inboundMessages'),
      card(`${words.listings} par statut`, Object.keys(data.listings.byStatus).length ? rows(Object.entries(data.listings.byStatus), LISTING_STATUS) : el('p', { class: 'pm-muted', text: 'Aucune.' }),
        data.listings.deleted ? el('p', { class: 'pm-muted', text: `${number(data.listings.deleted)} supprimée(s).` }) : null),
      data.requests.total ? card('Demandes par statut', rows(Object.entries(data.requests.byStatus), STATUS)) : null,
      Object.keys(data.requests.byType).length > 1 ? card('Demandes par type', rows(Object.entries(data.requests.byType), TYPE)) : null,
      data.contacts.direct ? card('Contacts directs par canal', rows(Object.entries(data.contacts.bySource), SOURCE)) : null,
      data.hotels?.topRooms.length ? card('Chambres les plus demandées', rows(data.hotels.topRooms.map((row) => [row.name, row.requests]))) : null,
      data.activeWithoutActivity.length && !data.listingId ? card(`${words.active} sans activité`, el('ul', {}, data.activeWithoutActivity.slice(0, 10).map((row) => el('li', { text: row.title }))),
        data.activeWithoutActivity.length > 10 ? el('p', { class: 'pm-muted', text: `Et ${number(data.activeWithoutActivity.length - 10)} autre(s).` }) : null) : null),
    data.trips?.historicalUnallocatedRequests ? el('p', { class: 'ps-card', text: `${number(data.trips.historicalUnallocatedRequests)} ancienne(s) demande(s) acceptée(s) ne sont pas comptées dans les places réservées.` }) : null,
    data.topListings.rows.length ? card(`${words.listings} classés par demandes reçues`,
      el('div', { class: 'ps-table-wrap' }, el('table', { class: 'ps-table' },
        el('thead', {}, el('tr', {}, [words.listing, 'Demandes', 'Contacts', 'Messages'].map((text) => el('th', { scope: 'col', text })))),
        el('tbody', {}, data.topListings.rows.map((row) => el('tr', {},
          el('td', { text: row.deleted ? `${row.title} (supprimée)` : row.title }), el('td', { text: number(row.requests) }), el('td', { text: number(row.contacts) }), el('td', { text: number(row.inboundMessages) }))))))) : null,
    card('Mesures indisponibles', el('ul', {}, data.unavailable.map((row) => el('li', {}, el('strong', { text: `${row.label} : ` }), el('span', { text: `${UNAVAILABLE}. ${row.reason}` }))))),
  );
}

/** The page of one universe. Figures only ever come from the owner's report. */
export function mountStats(root, { module }) {
  ensureStyles();
  if (!document.querySelector('link[data-pencmi-stats]')) document.head.append(el('link', { rel: 'stylesheet', href: new URL('./stats-panel.css', import.meta.url).href, 'data-pencmi-stats': 'true' }));
  const words = MODULES[module];
  const signIn = (text) => el('div', { class: 'pm-panel', role: 'alert' }, el('p', { text }), el('a', { class: 'btn btn-primary', href: loginHref(), text: 'Se connecter' }));
  if (!hasSession()) {
    root.replaceChildren(signIn('Connectez-vous pour voir vos statistiques.'));
    return;
  }
  const state = { period: '30', listingId: '', request: 0 };
  const listingSelect = el('select', { name: 'listingId', disabled: true, onChange: (event) => { state.listingId = event.currentTarget.value; void load(); } }, el('option', { value: '', text: 'Toutes' }));
  const body = el('div', { 'aria-live': 'polite' });
  root.replaceChildren(el('div', { class: 'ps-panel' },
    el('form', { class: 'ps-filters', onSubmit: (event) => event.preventDefault() },
      el('label', { class: 'pm-field' }, el('span', { text: 'Période' }), el('select', { name: 'period', onChange: (event) => { state.period = event.currentTarget.value; void load(); } },
        [['today', 'Aujourd’hui'], ['7', '7 derniers jours'], ['30', '30 derniers jours'], ['90', '90 derniers jours']].map(([value, text]) => el('option', { value, text, selected: value === state.period })))),
      el('label', { class: 'pm-field' }, el('span', { text: words.listing }), listingSelect)),
    body));

  async function load() {
    const ticket = ++state.request;
    body.replaceChildren(el('p', { class: 'pm-muted', text: 'Chargement des statistiques…' }));
    const query = new URLSearchParams({ module, period: state.period });
    if (state.listingId) query.set('listingId', state.listingId);
    let data;
    try {
      data = await apiRequest(`/dashboard/stats/report?${query}`);
    } catch (error) {
      // A slower answer to a previous filter must not replace the current one.
      if (ticket !== state.request) return;
      if (error.status === 401 || error.name === 'SessionRefreshError') {
        body.replaceChildren(signIn('Votre session a expiré. Reconnectez-vous pour voir vos statistiques.'));
        return;
      }
      body.replaceChildren(el('div', { class: 'pm-panel', role: 'alert' }, el('p', { text: error.message || 'Chargement impossible.' }),
        el('button', { class: 'btn btn-light', type: 'button', text: 'Réessayer', onClick: () => void load() })));
      return;
    }
    if (ticket !== state.request) return;
    listingSelect.replaceChildren(el('option', { value: '', text: 'Toutes' }), ...data.options.map((row) => el('option', { value: row.id, text: row.deleted ? `${row.title} (supprimée)` : row.title, selected: row.id === state.listingId })));
    listingSelect.disabled = !data.options.length;
    if (!data.options.length) {
      body.replaceChildren(el('div', { class: 'pm-panel' }, el('h2', { text: 'Aucune statistique pour le moment.' }), el('p', { class: 'pm-muted', text: words.publish })));
      return;
    }
    draw(body, module, data, words);
  }
  void load();
}

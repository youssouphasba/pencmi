// Platform statistics over 7, 30 or 90 days. Values reach the page through textContent.
import { apiRequest, el } from '../messaging/messaging-ui.mjs';
import { accountError } from '../compte/account-ui.mjs';

const MODULES = { real_estate: 'Immobilier', hotels: 'Hôtels', vehicles: 'Voitures', trips: 'Voyages', messages: 'Messages', users: 'Comptes', content: 'Contenus', support: 'Support', system: 'Système' };
const REQUESTS = { visit: 'Visites immobilières', hotel: 'Réservations d’hôtel', rental: 'Locations de voiture', chauffeur: 'Chauffeurs', trip: 'Places de voyage' };
const VERIFICATIONS = { pending: 'En attente', accepted: 'Validées', refused: 'Refusées', requires_more_info: 'Corrections demandées' };
const number = (value) => new Intl.NumberFormat('fr-FR').format(value ?? 0);

const kpi = (label, value, note) => el('article', { class: 'admin-kpi-card' }, el('span', { text: label }), el('div', { class: 'admin-kpi-value', text: number(value) }), note ? el('small', { text: note }) : null);
function table(caption, columns, rows) {
  return el('section', { class: 'admin-table-shell admin-section' }, el('div', { class: 'admin-scroll' },
    el('table', { class: 'admin-table' }, el('caption', { text: caption }),
      el('thead', {}, el('tr', {}, columns.map((text) => el('th', { scope: 'col', text })))),
      el('tbody', {}, rows.length ? rows.map((row) => el('tr', {}, row.map((cell, index) => index ? el('td', { text: cell }) : el('th', { scope: 'row', text: cell }))))
        : el('tr', {}, el('td', { colSpan: columns.length, text: 'Aucune donnée sur la période.' }))))));
}

export function mountAdminStatistics(root) {
  const period = el('select', { 'aria-label': 'Période' }, [7, 30, 90].map((days) => el('option', { value: String(days), text: `${days} derniers jours`, selected: days === 30 })));
  const target = el('div', { 'aria-live': 'polite' });
  root.replaceChildren(el('section', { class: 'admin-filter-row' }, el('label', {}, 'Période', period)), target);
  const load = async () => {
    target.textContent = 'Chargement…';
    try {
      const [stats, overview] = await Promise.all([apiRequest(`/admin/statistics?days=${period.value}`), apiRequest('/admin/overview')]);
      const requests = Object.entries(REQUESTS).map(([key, label]) => [key, label, stats.requests[key]]);
      const totalRequests = requests.reduce((sum, [, , row]) => sum + row.total, 0);
      target.replaceChildren(
        el('h2', { text: 'Totaux actuels' }),
        el('section', { class: 'admin-kpi-grid admin-section' },
          kpi('Comptes', overview.users), kpi('Annonceurs', overview.advertisers),
          kpi('Annonces en ligne', Object.values(overview.listingCounts || {}).reduce((sum, row) => sum + (row.active || 0), 0)),
          kpi('Annonces à valider', Object.values(overview.listingCounts || {}).reduce((sum, row) => sum + (row.pending || 0), 0)),
          kpi('Signalements', overview.reports), kpi('Emails en échec', overview.failedEmails)),
        el('h2', { text: `Sur les ${stats.days} derniers jours` }),
        el('section', { class: 'admin-kpi-grid admin-section' },
          kpi('Inscriptions', stats.signups.total, `${number(stats.signups.clients)} clients, ${number(stats.signups.professionals)} pros`),
          kpi('Nouvelles annonces', stats.newListings.total), kpi('Demandes envoyées', totalRequests),
          kpi('Messages', stats.messages), kpi('Signalements reçus', stats.reports.opened, `${number(stats.reports.closed)} traités`)),
        table('Demandes par type', ['Type', 'Envoyées', 'En attente', 'Acceptées', 'Refusées', 'Annulées', 'Taux d’acceptation'],
          requests.map(([, label, row]) => [label, number(row.total), number(row.waiting), number(row.accepted), number(row.refused), number(row.cancelled), row.acceptanceRate === null ? '—' : `${row.acceptanceRate} %`])),
        table('Nouvelles annonces par univers', ['Univers', 'Annonces créées'],
          ['real_estate', 'hotels', 'vehicles', 'trips'].map((key) => [MODULES[key], number(stats.newListings[key])])),
        table('Contacts générés par univers', ['Univers', 'Contacts'], Object.entries(stats.contacts).map(([key, value]) => [MODULES[key] || key, number(value)])),
        table('Vérifications de professionnels', ['Statut', 'Demandes'], Object.entries(stats.verifications).map(([key, value]) => [VERIFICATIONS[key] || key, number(value)])),
        table('Événements suivis les plus fréquents', ['Événement', 'Univers', 'Nombre'], stats.topEvents.map((row) => [row.eventType, MODULES[row.module] || row.module, number(row.count)])),
        el('details', { class: 'admin-section' }, el('summary', { text: 'Inscriptions jour par jour' }),
          table('Inscriptions par jour', ['Jour', 'Inscriptions'], stats.signups.series.map((row) => [new Date(`${row.day}T12:00:00Z`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }), number(row.signups)]))),
      );
    } catch (error) { accountError(target, error, load); }
  };
  period.addEventListener('change', load);
  return load();
}

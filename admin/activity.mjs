import { apiRequest, el, formatDateTime } from '../messaging/messaging-ui.mjs';
import { accountError } from '../compte/account-ui.mjs';
const columns = {
  contacts: { path: 'contacts', fields: { module: 'Module', source: 'Source', targetId: 'Annonce', ownerUserId: 'Annonceur', createdAt: 'Date' } },
  notifications: { path: 'notifications', fields: { module: 'Module', type: 'Type', status: 'Statut', priority: 'Priorité', createdAt: 'Date' } },
  emailLogs: { path: 'email-activity', fields: { toEmail: 'Destinataire', templateKey: 'Modèle', subject: 'Sujet', status: 'Statut', createdAt: 'Créé', sentAt: 'Envoyé' } },
};
const labels = {
  real_estate: 'Immobilier', hotels: 'Hôtels', vehicles: 'Voitures', trips: 'Voyages',
  system: 'Système', users: 'Comptes', messages: 'Messages', support: 'Support',
  unread: 'Non lue', read: 'Lue', archived: 'Archivée', pending: 'En attente', sent: 'Envoyé',
  failed: 'Échoué', cancelled: 'Annulé', low: 'Faible', normal: 'Normale', important: 'Importante', urgent: 'Urgente',
};
function display(key, value) {
  if (value == null || value === '') return '—';
  if (key.endsWith('At')) return formatDateTime(value);
  return ['module', 'status', 'priority'].includes(key) ? labels[value] || value : value;
}
export function mountAdminActivity(root, kind) {
  const { path, fields } = columns[kind];
  const entries = Object.entries(fields);
  async function load(page = 1) {
    root.textContent = 'Chargement…';
    try {
      const { data, meta } = await apiRequest(`/admin/${path}?page=${page}&limit=20`, { includeMeta: true });
      const table = data.length ? el('div', { class: 'admin-table-shell admin-section' }, el('div', { class: 'admin-scroll' },
        el('table', { class: 'admin-table' },
          el('thead', {}, el('tr', {}, entries.map(([, name]) => el('th', { scope: 'col', text: name })))),
          el('tbody', {}, data.map(row => el('tr', {}, entries.map(([key]) => el('td', { text: display(key, row[key]) }))))))))
        : el('p', { role: 'status', text: 'Aucune activité enregistrée.' });
      const button = (text, next) => el('button', { class: 'btn btn-light', type: 'button', text, onClick: () => load(next) });
      root.replaceChildren(table, meta.totalPages > 1 ? el('nav', { class: 'admin-actions', 'aria-label': 'Pagination' },
        page > 1 ? button('Précédent', page - 1) : null, el('span', { text: `Page ${page} sur ${meta.totalPages}` }),
        page < meta.totalPages ? button('Suivant', page + 1) : null) : null);
    } catch (error) { accountError(root, error, () => load(page)); }
  }
  void load();
}

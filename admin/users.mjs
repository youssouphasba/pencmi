import { apiRequest, el, formatDateTime } from '../messaging/messaging-ui.mjs';
import { accountError, roleLabels } from '../compte/account-ui.mjs';

const statusLabels = { active: 'Actif', pending_verification: 'En attente de vérification', suspended: 'Suspendu' };
const REASON_LIMIT = 500;

/** Accounts list with working filters and the suspend / reactivate decision. */
export function mountAdminUsers(root, { currentUserId, refreshCounts } = {}) {
  let users = [];
  const search = el('input', { type: 'search', placeholder: 'Nom, email ou téléphone', autocomplete: 'off' });
  const role = el('select', {}, el('option', { value: '', text: 'Tous' }),
    Object.entries(roleLabels).map(([value, text]) => el('option', { value, text })));
  const status = el('select', {}, el('option', { value: '', text: 'Tous' }),
    Object.entries(statusLabels).map(([value, text]) => el('option', { value, text })));
  const filters = el('section', { class: 'admin-filter-row' },
    el('label', {}, 'Recherche', search), el('label', {}, 'Rôle', role), el('label', {}, 'Statut', status));
  const feedback = el('p', { role: 'status', 'aria-live': 'polite' });
  const result = el('div');
  const dialog = el('dialog', { class: 'moderation-dialog', 'aria-labelledby': 'admin-user-dialog-title' });
  dialog.addEventListener('close', () => dialog.replaceChildren());
  for (const input of [search, role, status]) input.addEventListener('input', render);

  const name = user => [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Utilisateur';

  function visible() {
    const text = search.value.trim().toLowerCase();
    return users.filter(user => (!role.value || user.role === role.value)
      && (!status.value || user.status === status.value)
      && (!text || [name(user), user.email, user.phone].some(value => String(value || '').toLowerCase().includes(text))));
  }

  function action(user) {
    if (user.role === 'admin' || user.id === currentUserId) return el('span', { text: '—' });
    if (user.status === 'active') return el('button', { class: 'btn btn-light', type: 'button', text: 'Suspendre', onClick: () => decide(user, 'suspended') });
    if (user.status === 'suspended') return el('button', { class: 'btn btn-light', type: 'button', text: 'Réactiver', onClick: () => decide(user, 'active') });
    return el('span', { text: '—' });
  }

  function render() {
    const rows = visible();
    const headers = ['Utilisateur', 'Rôle', 'Statut', 'Email', 'Téléphone', 'Ville', 'Inscription', 'Action'];
    result.replaceChildren(
      el('p', { text: `${rows.length} compte${rows.length > 1 ? 's' : ''} sur ${users.length}` }),
      rows.length ? el('div', { class: 'admin-table-shell admin-section' }, el('div', { class: 'admin-scroll' },
        el('table', { class: 'admin-table' },
          el('thead', {}, el('tr', {}, headers.map(text => el('th', { scope: 'col', text })))),
          el('tbody', {}, rows.map(user => el('tr', {},
            el('td', { text: name(user) }), el('td', { text: roleLabels[user.role] || user.role }),
            el('td', { text: statusLabels[user.status] || user.status }), el('td', { text: user.email || '—' }),
            el('td', { text: user.phone || '—' }), el('td', { text: user.city || '—' }),
            el('td', { text: formatDateTime(user.createdAt) }), el('td', {}, action(user))))))))
        : el('p', { role: 'status', text: 'Aucun compte ne correspond à ces filtres.' }));
  }

  function decide(user, next) {
    if (dialog.open) return;
    const suspending = next === 'suspended';
    const reason = el('textarea', { rows: 4, maxLength: REASON_LIMIT, required: suspending });
    const error = el('p', { role: 'alert' });
    const cancel = el('button', { class: 'btn btn-light', type: 'button', text: 'Annuler', onClick: () => dialog.close() });
    const confirm = el('button', { class: 'btn btn-primary', type: 'submit', text: suspending ? 'Suspendre le compte' : 'Réactiver le compte' });
    const form = el('form', { onSubmit: async event => {
      event.preventDefault();
      if (suspending && !reason.value.trim()) { error.textContent = 'Indiquez le motif de la suspension.'; reason.focus(); return; }
      confirm.disabled = cancel.disabled = true;
      error.textContent = '';
      try {
        const body = { status: next, ...(reason.value.trim() ? { reason: reason.value.trim() } : {}) };
        const done = await apiRequest(`/admin/users/${encodeURIComponent(user.id)}/status`, { method: 'PATCH', body });
        // The list may have been reloaded while the dialog was open: update the current row, not a stale copy.
        for (const row of users) if (row.id === user.id) row.status = done.status;
        dialog.close();
        const listings = done.listingsChanged
          ? ` ${done.listingsChanged} annonce${done.listingsChanged > 1 ? 's' : ''} ${suspending ? 'retirée' : 'remise'}${done.listingsChanged > 1 ? 's' : ''} ${suspending ? 'du site' : 'en ligne'}.` : '';
        feedback.textContent = `${name(user)} : compte ${suspending ? 'suspendu' : 'réactivé'}.${listings}`;
        render();
        void refreshCounts?.();
      } catch (failure) {
        error.textContent = failure?.message || 'Action impossible. Réessayez.';
        confirm.disabled = cancel.disabled = false;
        if (failure?.status === 409 || failure?.status === 404) void load();
      }
    } },
      el('header', { class: 'moderation-dialog-header' },
        el('h2', { id: 'admin-user-dialog-title', text: suspending ? `Suspendre ${name(user)} ?` : `Réactiver ${name(user)} ?` })),
      el('p', { text: suspending
        ? 'Le compte ne pourra plus se connecter, ses sessions seront fermées et ses annonces en ligne seront retirées du site.'
        : 'Le compte pourra de nouveau se connecter. Les annonces retirées lors de la suspension seront remises en ligne.' }),
      el('label', {}, suspending ? 'Motif (obligatoire)' : 'Note (facultative)', reason),
      error, el('div', { class: 'moderation-actions' }, cancel, confirm));
    dialog.replaceChildren(form);
    dialog.showModal();
    reason.focus();
  }

  async function load() {
    result.textContent = 'Chargement…';
    try {
      users = await apiRequest('/admin/users');
      render();
    } catch (error) { accountError(result, error, load); }
  }

  root.replaceChildren(filters, feedback, result, dialog);
  void load();
}

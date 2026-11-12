import { apiRequest } from '../messaging/messaging-ui.mjs';
import { tokenSession } from '../auth/token-session.mjs';
import { el, accountError } from './account-ui.mjs';

const requestLabels = {
  visits: 'Visites immobilières', stays: 'Séjours', rentals: 'Locations',
  chauffeurServices: 'Services avec chauffeur', trips: 'Voyages',
};

export async function mountBusinessEmailPreference(root) {
  try {
    const user = await apiRequest('/users/me');
    const checkbox = el('input', { type: 'checkbox', checked: user.businessEmailsEnabled === true });
    const feedback = el('p', { role: 'status' });
    root.replaceChildren(
      el('label', {}, checkbox, el('span', { text: 'Recevoir les emails de suivi des messages, demandes et annonces' })),
      el('p', { text: 'Une adresse vérifiée est nécessaire. Ce réglage ne concerne pas les emails de sécurité.' }),
      feedback,
    );
    checkbox.onchange = async () => {
      const enabled = checkbox.checked;
      checkbox.disabled = true;
      try {
        const result = await apiRequest('/users/me/business-email-preference', { method: 'PATCH', body: { enabled } });
        if (result?.businessEmailsEnabled !== enabled) throw Error('Le réglage n’a pas été confirmé.');
        feedback.textContent = 'Préférence enregistrée.';
      } catch (error) {
        checkbox.checked = !enabled;
        accountError(feedback, error);
      } finally { checkbox.disabled = false; }
    };
  } catch (error) { accountError(root, error, () => mountBusinessEmailPreference(root)); }
}

export async function mountAccountDeletion(root, onDeleted) {
  root.textContent = 'Chargement…';
  try {
    const [user, result] = await Promise.all([apiRequest('/users/me'), apiRequest('/users/me/deletion-blockers')]);
    if (user.role === 'admin') { root.textContent = 'La suppression depuis cet espace est réservée aux comptes non administrateurs.'; return; }
    if (result.blockedByRequests) {
      const counts = Object.entries(result.counts).filter(([, count]) => count > 0);
      root.replaceChildren(el('p', { text: 'Clôturez vos demandes en cours avant de supprimer votre compte.' }),
        el('ul', {}, counts.map(([kind, count]) => el('li', { text: `${requestLabels[kind]} : ${count}` }))),
        el('button', { type: 'button', class: 'btn btn-light', text: 'Actualiser', onClick: () => mountAccountDeletion(root, onDeleted) }));
      return;
    }
    const open = el('button', { type: 'button', class: 'btn btn-light', text: 'Supprimer mon compte' });
    const password = el('input', { type: 'password', required: true, maxLength: 1024, autocomplete: 'current-password' });
    const confirm = el('button', { type: 'submit', class: 'btn btn-primary', text: 'Confirmer la suppression' });
    const cancel = el('button', { type: 'button', class: 'btn btn-light', text: 'Annuler' });
    const feedback = el('div', { role: 'status' });
    const form = el('form', { class: 'ae-form' },
      el('h2', { text: 'Confirmer la suppression du compte' }),
      el('p', { text: 'Cette action est définitive. Vos annonces seront retirées et toutes vos sessions seront fermées. L’historique des échanges et des demandes est conservé.' }),
      el('label', {}, el('span', { text: 'Mot de passe actuel' }), password),
      el('div', { class: 'ae-actions' }, cancel, confirm), feedback);
    const dialog = el('dialog', { class: 'ae-confirm-dialog', 'aria-label': 'Confirmer la suppression du compte' }, form);
    open.onclick = () => { dialog.showModal(); password.focus(); };
    cancel.onclick = () => dialog.close();
    dialog.onclose = () => { form.reset(); feedback.replaceChildren(); open.focus(); };
    dialog.oncancel = event => { if (confirm.disabled) event.preventDefault(); };
    form.onsubmit = async event => {
      event.preventDefault();
      if (confirm.disabled) return;
      const before = tokenSession.snapshot();
      confirm.disabled = cancel.disabled = true;
      feedback.textContent = 'Suppression en cours…';
      try {
        const result = await apiRequest('/users/me/delete-account', { method: 'POST', body: { currentPassword: password.value } });
        if (result?.deleted !== true) throw Error('La suppression n’a pas été confirmée.');
        await tokenSession.invalidate(before);
        dialog.close();
        onDeleted();
      } catch (error) { accountError(feedback, error); }
      finally { confirm.disabled = cancel.disabled = false; }
    };
    root.replaceChildren(open, dialog);
  } catch (error) { accountError(root, error, () => mountAccountDeletion(root, onDeleted)); }
}

import { apiRequest } from '../messaging/messaging-ui.mjs';
import { el, accountError } from './account-ui.mjs';

export async function mountEmailVerification(root) {
  root.textContent = 'Chargement…';
  try {
    const [user, capabilities] = await Promise.all([
      apiRequest('/users/me'), apiRequest('/auth/email-verification/capabilities'),
    ]);
    if (user.emailVerified) { root.textContent = 'Email vérifié'; return; }
    if (!capabilities.emailVerification) { root.textContent = 'La vérification email n’est pas disponible pour le moment.'; return; }
    if (!user.email) { root.textContent = 'Aucune adresse email associée au compte.'; return; }
    const feedback = el('p', { role: 'status' });
    const button = el('button', { type: 'button', class: 'btn btn-light', text: 'Recevoir un lien de vérification' });
    root.replaceChildren(el('p', { text: user.email }), button, feedback);
    button.onclick = async () => {
      if (button.disabled) return;
      button.disabled = true;
      try {
        const result = await apiRequest('/auth/email-verification/request', { method: 'POST' });
        feedback.textContent = result.verified ? 'Email vérifié' : result.message;
      } catch (error) {
        feedback.textContent = error.message || 'Demande impossible. Réessayez.';
      } finally { button.disabled = false; }
    };
  } catch (error) { accountError(root, error, () => mountEmailVerification(root)); }
}

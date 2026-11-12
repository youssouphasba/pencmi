import { getPublicationApiBase } from '../publier/real-estate-api.mjs';
import { el } from '../compte/account-ui.mjs';

const root = document.querySelector('[data-verification-root]');
const token = new URLSearchParams(location.hash.slice(1)).get('token') || '';
if (location.hash) history.replaceState(history.state, '', location.pathname + location.search);
const feedback = el('p', { role: 'status' });
const button = el('button', { class: 'btn btn-primary', type: 'button', text: 'Confirmer mon adresse email' });
root.replaceChildren(el('h1', { text: 'Vérifier mon adresse email' }), feedback, button);
if (!/^[a-f0-9]{64}$/i.test(token)) {
  feedback.textContent = 'Ce lien est invalide. Demandez un nouveau lien depuis les paramètres de votre compte.';
  button.remove();
}
button.onclick = async () => {
  if (button.disabled) return;
  button.disabled = true;
  feedback.textContent = 'Vérification en cours…';
  try {
    const response = await fetch(`${getPublicationApiBase()}/auth/email-verification/confirm`, {
      method: 'POST', credentials: 'same-origin', referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }), signal: AbortSignal.timeout(20000),
    });
    const result = await response.json();
    if (!response.ok) throw Error(result?.error?.message || 'La vérification a échoué.');
    if ((result?.data ?? result)?.verified !== true) throw Error('La confirmation du serveur est invalide. Réessayez.');
    feedback.textContent = 'Votre adresse email est vérifiée.';
    button.remove();
    root.append(el('a', { href: '/login/', class: 'btn btn-primary', text: 'Accéder à mon espace' }));
  } catch (error) {
    feedback.textContent = error.message || 'Connexion interrompue. Réessayez.';
    button.disabled = false;
  }
};

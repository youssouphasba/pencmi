import { getPublicationApiBase } from '../publier/real-estate-api.mjs';

export const recoveryCopy = Object.freeze({
  unavailable: 'La récupération du mot de passe n’est pas disponible pour le moment.',
  unavailableHelp: 'Contacter le support',
  loading: 'Vérification de disponibilité…',
  network: 'Connexion interrompue. Réessayez sans fermer cette page.',
  invalid: 'Ce lien est invalide. Demandez un nouveau lien.',
  mismatch: 'Les mots de passe ne correspondent pas.',
  policy: '12 caractères minimum, avec une majuscule, une minuscule, un chiffre et un symbole. Maximum 72 octets.',
  success: 'Votre mot de passe a été modifié. Reconnectez-vous sur vos appareils.',
});

let resetToken;
if (typeof window !== 'undefined' && /^\/reset-password\/?$/.test(location.pathname)) {
  resetToken = new URLSearchParams(location.hash.slice(1)).get('token') || '';
  if (location.hash) history.replaceState(history.state, '', location.pathname + location.search);
}

async function request(path, body) {
  const base = getPublicationApiBase();
  if (!base) throw Error(recoveryCopy.network);
  let response;
  try {
    response = await fetch(`${base}/auth/${path}`, {
      method: body ? 'POST' : 'GET', credentials: 'omit', referrerPolicy: 'no-referrer',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
  } catch { throw Error(recoveryCopy.network); }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message;
    throw Error(Array.isArray(message) ? message.join(' ') : message || recoveryCopy.network);
  }
  return payload?.data ?? payload;
}

export async function mountRecovery(root, mode) {
  root.textContent = recoveryCopy.loading;
  const reset = mode === 'resetPassword';
  try {
    const capabilities = await request('recovery-capabilities');
    if (!capabilities?.passwordRecovery) {
      root.innerHTML = '<p></p><a class="btn btn-primary" href="/contact/"></a>';
      root.querySelector('p').textContent = recoveryCopy.unavailable;
      root.querySelector('a').textContent = recoveryCopy.unavailableHelp;
      return;
    }
    if (reset && !/^[a-f0-9]{64}$/i.test(resetToken)) {
      root.innerHTML = '<p role="alert"></p><a class="btn btn-primary" href="/forgot-password/">Demander un nouveau lien</a>';
      root.querySelector('p').textContent = recoveryCopy.invalid;
      return;
    }
    root.innerHTML = `<form class="auth-form">
      ${reset ? '<label class="auth-field"><span>Nouveau mot de passe</span><input name="password" type="password" required minlength="12" maxlength="72" autocomplete="new-password"></label><label class="auth-field"><span>Confirmer le mot de passe</span><input name="confirmation" type="password" required autocomplete="new-password"></label><p data-policy></p>' : '<label class="auth-field"><span>Adresse email de votre compte</span><input name="identifier" type="email" required maxlength="254" autocomplete="email"></label>'}
      <button class="btn btn-primary" type="submit">${reset ? 'Réinitialiser le mot de passe' : 'Recevoir un lien de réinitialisation'}</button>
      <p role="alert" data-error hidden></p><p role="status" data-result hidden></p>
    </form>`;
    if (reset) root.querySelector('[data-policy]').textContent = recoveryCopy.policy;
    const form = root.querySelector('form');
    let busy = false;
    form.addEventListener('submit', async event => {
      event.preventDefault();
      if (busy) return;
      const error = form.querySelector('[data-error]');
      const result = form.querySelector('[data-result]');
      error.hidden = true; result.hidden = true;
      const data = new FormData(form);
      const password = String(data.get('password') || '');
      if (reset && (password !== data.get('confirmation') || new TextEncoder().encode(password).length > 72)) {
        error.textContent = password !== data.get('confirmation') ? recoveryCopy.mismatch : recoveryCopy.policy;
        error.hidden = false; return;
      }
      busy = true;
      form.setAttribute('aria-busy', 'true');
      form.querySelectorAll('input, button').forEach(element => { element.disabled = true; });
      try {
        const response = await request(reset ? 'reset-password' : 'forgot-password', reset
          ? { token: resetToken, password } : { identifier: String(data.get('identifier')).trim() });
        result.textContent = reset ? recoveryCopy.success : response.message;
        result.hidden = false;
        if (reset) {
          resetToken = '';
          form.querySelectorAll('input, button').forEach(element => element.remove());
          const link = document.createElement('a');
          link.className = 'btn btn-primary'; link.href = '/login/'; link.textContent = 'Se connecter';
          form.append(link);
        }
      } catch (failure) {
        error.textContent = failure.message; error.hidden = false;
      } finally {
        busy = false; form.setAttribute('aria-busy', 'false');
        form.querySelectorAll('input, button').forEach(element => { element.disabled = false; });
      }
    });
  } catch (error) {
    root.innerHTML = '<p role="alert"></p><button type="button" class="btn btn-primary">Réessayer</button>';
    root.querySelector('p').textContent = error.message;
    root.querySelector('button').onclick = () => void mountRecovery(root, mode);
  }
}

// Visitors can browse listings, but sending a request (visit, booking, rental, seats, contact)
// needs an account. A click on a request button by a visitor opens this invitation instead
// of the form; after signing in or registering, the visitor comes back to the same listing.
const REQUEST_BUTTONS = '[data-open-visit], [data-open-reservation], [data-open-contact]';

function signedIn() {
  try { return Boolean(localStorage.getItem('pencmi_access_token')); } catch { return false; }
}

function invitation() {
  let dialog = document.querySelector('.account-required');
  if (dialog) return dialog;
  const style = document.createElement('style');
  style.textContent = `
    .account-required { width: min(420px, calc(100% - 24px)); padding: 22px; border: 0; border-radius: 18px; color: #0f172a;
      box-shadow: 0 24px 60px rgba(15, 23, 42, .3); font-family: Inter, system-ui, sans-serif; }
    .account-required::backdrop { background: rgba(15, 23, 42, .45); }
    .account-required h2 { margin: 0 0 8px; font-size: 1.2rem; color: #0f2a5f; }
    .account-required p { margin: 0 0 18px; color: #475569; line-height: 1.5; }
    .account-required .ar-actions { display: grid; gap: 8px; }
    .account-required a, .account-required button { display: grid; place-items: center; min-height: 46px; border-radius: 12px; font: inherit; font-weight: 700; text-decoration: none; cursor: pointer; }
    .account-required .ar-primary { color: #fff; background: #1d4ed8; border: 0; }
    .account-required .ar-secondary { color: #1d4ed8; background: #e8f0fe; border: 0; }
    .account-required .ar-close { color: #64748b; background: none; border: 0; }`;
  document.head.append(style);
  dialog = document.createElement('dialog');
  dialog.className = 'account-required';
  dialog.setAttribute('aria-labelledby', 'account-required-title');
  const next = encodeURIComponent(location.pathname + location.search);
  dialog.innerHTML = `
    <h2 id="account-required-title">Connectez-vous pour envoyer votre demande</h2>
    <p>Un compte gratuit permet à l’annonceur de vous répondre et de suivre votre demande dans votre espace.</p>
    <div class="ar-actions">
      <a class="ar-primary" href="/login/?next=${next}">Se connecter</a>
      <a class="ar-secondary" href="/register/?next=${next}">Créer un compte gratuit</a>
      <button class="ar-close" type="button">Continuer à consulter</button>
    </div>`;
  dialog.querySelector('.ar-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  document.body.append(dialog);
  return dialog;
}

// Capture phase: runs before the page's own handler that would open the form.
document.addEventListener('click', event => {
  const button = event.target.closest?.(REQUEST_BUTTONS);
  if (!button || signedIn()) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  invitation().showModal();
}, true);

// Signed in: fill the request form's contact fields from the account (only empty fields).
let account;
async function me() {
  account ||= (async () => {
    const base = (window.PencmiConfig?.apiBaseUrl || window.PencmiRuntimeConfig?.apiBaseUrl || '').replace(/\/+$/, '');
    const token = localStorage.getItem('pencmi_access_token');
    if (!base || !token) return null;
    const response = await fetch(`${base}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null);
    return payload?.data ?? payload;
  })().catch(() => null);
  return account;
}
document.addEventListener('click', event => {
  if (!event.target.closest?.(REQUEST_BUTTONS) || !signedIn()) return;
  void me().then(user => {
    if (!user) return;
    const values = { clientName: [user.firstName, user.lastName].filter(Boolean).join(' '), clientPhone: user.phone, clientEmail: user.email };
    requestAnimationFrame(() => {
      for (const [name, value] of Object.entries(values)) {
        if (!value) continue;
        document.querySelectorAll(`input[name="${name}"]`).forEach(input => { if (!input.value) { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); } });
      }
    });
  });
});

import { accountRoutes, navigationLabels, safeNext } from './navigation.mjs';
import { publicationRequest } from '../publier/real-estate-api.mjs';

let user;
function updateLinks() {
  if (!user) return;
  for (const link of document.querySelectorAll('a[href]')) {
    const url = new URL(link.href, location.href);
    if (url.origin === location.origin && /^\/register\/?$/.test(url.pathname) && link.closest('header')) {
      link.hidden = true;
      link.style.display = 'none';
    }
    if (url.origin !== location.origin || !/^\/login\/?$/.test(url.pathname)) continue;
    const next = url.searchParams.get('next');
    link.href = next?.startsWith('/publier') ? safeNext(next, '/publier/') : accountRoutes[user.role] || '/dashboard/';
    if (!next || next.startsWith('/dashboard')) link.textContent = navigationLabels.account;
  }
}

async function refresh() {
  if (!localStorage.getItem('pencmi_access_token')) return;
  try {
    user = await publicationRequest('/auth/me');
    updateLinks();
  } catch {}
}

void refresh();
window.addEventListener('pageshow', () => void refresh());
window.addEventListener('storage', event => {
  // A sign-in inside Guindi's panel must not reload the page under the conversation;
  // the launcher refreshes the page when the panel closes.
  if (event.key === 'pencmi_access_token' && !document.body.classList.contains('guindi-open')) location.reload();
});
new MutationObserver(records => {
  if (records.some(record => [...record.addedNodes].some(node => node.nodeType === 1))) updateLinks();
}).observe(document.body, { childList: true, subtree: true });

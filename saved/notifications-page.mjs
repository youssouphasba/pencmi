import { apiRequest, el, formatDateTime, hasSession, loginHref } from '../messaging/messaging-ui.mjs';
import { ensureSavedStyles } from './enhance.mjs';

/** The notifications of the account, with links only to pages of this site. */
export function mountNotifications(root) {
  ensureSavedStyles();
  if (!hasSession()) {
    root.replaceChildren(el('section', { class: 'pm-panel' }, el('p', { text: 'Connectez-vous pour voir vos notifications.' }), el('a', { class: 'btn btn-primary', href: loginHref(), text: 'Se connecter' })));
    return;
  }
  const failure = el('p', { class: 'pm-status pm-error', role: 'alert', hidden: true });
  const body = el('div', { 'aria-live': 'polite' });
  const readAll = el('button', { class: 'btn btn-light', type: 'button', text: 'Tout marquer comme lu', onClick: () => act(readAll, () => apiRequest('/notifications/read-all', { method: 'PATCH' })) });
  root.replaceChildren(el('div', { class: 'sv-page' }, el('div', { class: 'sv-actions' }, readAll), failure, body));

  async function act(button, work) {
    button.disabled = true;
    failure.hidden = true;
    try {
      await work();
      await load();
    } catch (error) {
      failure.textContent = error.message || 'Action impossible. Réessayez.';
      failure.hidden = false;
    } finally {
      button.disabled = false;
    }
  }

  async function load() {
    body.replaceChildren(el('p', { class: 'pm-muted', text: 'Chargement des notifications…' }));
    try {
      const rows = await apiRequest('/notifications');
      readAll.hidden = !rows.some((row) => row.status === 'unread');
      body.replaceChildren(rows.length ? el('ul', { class: 'sv-list' }, rows.map((row) => {
        const mark = el('button', { class: 'btn btn-ghost', type: 'button', text: 'Marquer comme lu', onClick: () => act(mark, () => apiRequest(`/notifications/${encodeURIComponent(row.id)}/read`, { method: 'PATCH' })) });
        const unread = row.status === 'unread';
        const safe = typeof row.targetUrl === 'string' && /^\/(?!\/)/.test(row.targetUrl);
        return el('li', { class: `sv-card is-plain${unread ? ' sv-unread' : ''}` }, el('div', {},
          el('h3', { text: row.title }), el('p', { text: row.message }), el('p', { class: 'pm-muted', text: `${formatDateTime(row.createdAt)}${unread ? ' · Non lue' : ''}` }),
          el('div', { class: 'sv-actions' }, safe ? el('a', { class: 'btn btn-light', href: row.targetUrl, text: 'Ouvrir' }) : null, unread ? mark : null)));
      })) : el('div', { class: 'pm-panel' }, el('h2', { text: 'Aucune notification pour le moment.' })));
    } catch (error) {
      body.replaceChildren(el('div', { class: 'pm-panel', role: 'alert' }, el('p', { text: error.message || 'Chargement impossible.' }),
        el('button', { class: 'btn btn-light', type: 'button', text: 'Réessayer', onClick: () => void load() })));
    }
  }
  void load();
}

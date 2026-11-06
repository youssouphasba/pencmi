import { apiRequest, ensureStyles, el, hasSession, loginHref, messageForm, messageList } from './messaging-ui.mjs';

/**
 * "Envoyer un message" on a public listing. Nothing is shown when the channel is off,
 * and a message only counts as sent once the API has confirmed it.
 */
export function mountListingMessaging(container, { module, listingId, listingTitle, enabled }) {
  if (!container || enabled !== true) return;
  ensureStyles();
  if (!hasSession()) {
    container.replaceChildren(el('a', { class: 'btn btn-primary', href: loginHref(), text: 'Se connecter pour envoyer un message' }));
    return;
  }
  const history = el('div', { class: 'pm-history' });
  const failure = el('p', { class: 'pm-status pm-error', role: 'alert', hidden: true });
  let conversationId = null;
  let messages = [];

  const draw = () => {
    history.replaceChildren(messages.length ? messageList(messages) : el('p', { class: 'pm-muted', text: 'Votre premier message ouvrira la conversation avec l’annonceur.' }));
    history.scrollTop = history.scrollHeight;
  };
  const form = messageForm({
    label: 'Votre message',
    send: async (body, requestId) => {
      const message = conversationId
        ? await apiRequest(`/messages/conversations/${encodeURIComponent(conversationId)}/messages`, { method: 'POST', body: { body, requestId } })
        : await apiRequest('/messages/conversations', { method: 'POST', body: { module, listingId, body, requestId } });
      const sent = message.message || message;
      conversationId = message.conversationId || conversationId;
      if (!messages.some((row) => row.id === sent.id)) messages = [...messages, { ...sent, mine: true }];
      draw();
    },
  });
  const load = async () => {
    failure.hidden = true;
    history.replaceChildren(el('p', { class: 'pm-muted', text: 'Chargement de la conversation…' }));
    try {
      const conversation = await apiRequest(`/messages/conversations/by-listing?module=${encodeURIComponent(module)}&listingId=${encodeURIComponent(listingId)}`);
      conversationId = conversation?.id || null;
      messages = conversation?.messages || [];
      draw();
      if (conversationId) await apiRequest(`/messages/conversations/${encodeURIComponent(conversationId)}/read`, { method: 'PATCH' }).catch(() => null);
    } catch (error) {
      history.replaceChildren();
      failure.textContent = error.status === 401 ? 'Votre session a expiré. Reconnectez-vous pour continuer.' : error.message || 'Chargement impossible.';
      failure.hidden = false;
      form.hidden = true;
      failure.append(' ', error.status === 401
        ? el('a', { href: loginHref(), text: 'Se connecter' })
        : el('button', { class: 'btn btn-ghost', type: 'button', text: 'Réessayer', onClick: () => { form.hidden = false; void load(); } }));
      return;
    }
    form.hidden = false;
  };
  const dialog = el('dialog', { class: 'pm-dialog', 'aria-labelledby': 'pm-dialog-title' },
    el('div', { class: 'pm-dialog-head' },
      el('h2', { id: 'pm-dialog-title', text: 'Message à l’annonceur' }),
      el('button', { class: 'btn btn-ghost', type: 'button', text: 'Fermer', onClick: () => dialog.close() })),
    listingTitle ? el('p', { class: 'pm-muted', text: listingTitle }) : null,
    history, failure, form);
  const open = el('button', { class: 'btn btn-primary', type: 'button', text: 'Envoyer un message', onClick: () => {
    dialog.showModal();
    void load();
  } });
  dialog.addEventListener('close', () => open.focus());
  container.replaceChildren(open, dialog);
}

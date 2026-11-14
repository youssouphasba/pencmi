import { publicationRequest, publicationOperationId } from '../publier/real-estate-api.mjs';
import { tokenSession } from '../auth/token-session.mjs';

export { publicationRequest as apiRequest, publicationOperationId as newRequestId };

export const hasSession = () => Boolean(tokenSession.snapshot().accessToken);

export function loginHref() {
  return `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
}

/** Text only ever goes through textContent: user content cannot become HTML. */
// Optional pieces of UI are often written as `condition ? node : null`. The DOM's own
// append()/replaceChildren() would print those as the text "null": drop them instead.
if (!globalThis.__pencmiSafeAppend) {
  globalThis.__pencmiSafeAppend = true;
  const keep = (item) => item !== null && item !== undefined && item !== false;
  for (const proto of [Element.prototype, Document.prototype, DocumentFragment.prototype]) {
    for (const name of ['append', 'prepend', 'replaceChildren']) {
      const original = proto[name];
      if (typeof original !== 'function') continue;
      proto[name] = function (...nodes) { return original.apply(this, nodes.filter(keep)); };
    }
  }
}

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key in node && key !== 'list') node[key] = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children.flat().filter((child) => child !== null && child !== undefined && child !== false));
  return node;
}

export function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('fr-FR', { timeZone: 'Africa/Dakar', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function ensureStyles() {
  if (document.querySelector('link[data-pencmi-messaging]')) return;
  document.head.append(el('link', { rel: 'stylesheet', href: new URL('./messaging.css', import.meta.url).href, 'data-pencmi-messaging': 'true' }));
}

/**
 * One message form: the request id survives a failure so that a retry cannot
 * create a second message, and it only changes when the text changes.
 */
export function messageForm({ label, submitLabel = 'Envoyer', send }) {
  const textarea = el('textarea', { name: 'body', required: true, maxLength: 6000, rows: 3 });
  const button = el('button', { class: 'btn btn-primary', type: 'submit', text: submitLabel });
  const status = el('p', { class: 'pm-status', role: 'status' });
  let requestId = null;
  let requestBody = null;
  const form = el('form', { class: 'pm-form', noValidate: true, onSubmit: async (event) => {
    event.preventDefault();
    if (button.disabled) return;
    const body = textarea.value.trim();
    if (!body) {
      status.className = 'pm-status pm-error';
      status.textContent = 'Écrivez votre message.';
      return;
    }
    if (body !== requestBody) {
      requestId = newId();
      requestBody = body;
    }
    button.disabled = true;
    status.className = 'pm-status';
    status.textContent = 'Envoi en cours…';
    try {
      await send(body, requestId);
      textarea.value = '';
      requestId = null;
      requestBody = null;
      status.textContent = 'Message envoyé.';
    } catch (error) {
      status.className = 'pm-status pm-error';
      status.textContent = error.message || 'Envoi impossible. Votre message est conservé : réessayez.';
    } finally {
      button.disabled = false;
    }
  } }, el('label', { class: 'pm-field' }, el('span', { text: label }), textarea), el('div', { class: 'pm-form-actions' }, button), status);
  return form;
}

const newId = () => publicationOperationId();

export function messageList(messages, { hasOlder, onOlder } = {}) {
  return el('ol', { class: 'pm-messages', 'aria-label': 'Messages' },
    hasOlder ? el('li', { class: 'pm-older' }, el('button', { class: 'btn btn-ghost', type: 'button', text: 'Afficher les messages précédents', onClick: onOlder })) : null,
    messages.map((message) => el('li', { class: `pm-message${message.mine ? ' is-mine' : ''}` },
      el('p', { class: 'pm-message-body', text: message.body }),
      el('div', { class: 'pm-message-meta' },
        el('time', { dateTime: message.createdAt, text: messageTime(message.createdAt) }),
        !message.mine && message.id ? el('a', { href: `/signaler/?${new URLSearchParams({ module: 'messages', targetType: 'message', targetId: message.id })}`, text: 'Signaler', class: 'pm-message-report' }) : null))));
}

// "07:06" today, "13 nov., 18:20" otherwise (Dakar time).
function messageTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const zone = { timeZone: 'Africa/Dakar' };
  const day = (d) => new Intl.DateTimeFormat('fr-FR', { ...zone, dateStyle: 'short' }).format(d);
  const time = new Intl.DateTimeFormat('fr-FR', { ...zone, hour: '2-digit', minute: '2-digit' }).format(date);
  if (day(date) === day(new Date())) return time;
  return `${new Intl.DateTimeFormat('fr-FR', { ...zone, day: 'numeric', month: 'short' }).format(date)}, ${time}`;
}

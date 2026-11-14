// Requests received by hotels, vehicles and trips: actions that reach the client.
// - "Demander des informations" asks for the question; "Refuser" offers an optional reason.
//   The words go to the client's messages, then the page's own status change runs.
// - Each request gets "Écrire au client", which writes in the conversation linked to it.
import { publicationRequest } from '../publier/real-estate-api.mjs';

const KINDS = [
  { status: 'data-reservation-status', id: 'data-reservation-id', type: () => 'hotel', messages: '/dashboard/hotels/messages/' },
  { status: 'data-vehicle-request-status', id: 'data-vehicle-request-id', type: button => button.getAttribute('data-vehicle-request-type') === 'chauffeur' ? 'chauffeur' : 'rental', messages: '/dashboard/voitures/messages/' },
  { status: 'data-trip-request-status', id: 'data-trip-request-id', type: () => 'trip', messages: '/dashboard/voyages/messages/' },
];
const DIALOGS = {
  requires_more_info: { title: 'Demander des précisions', label: 'Votre question', placeholder: 'Ex. : à quelle heure arriverez-vous ?', submit: 'Envoyer et demander', required: true, prefix: 'Pour votre demande : ' },
  refused: { title: 'Refuser la demande', label: 'Un mot pour le client (facultatif)', placeholder: 'Ex. : nous sommes complets à ces dates, désolé.', submit: 'Refuser la demande', required: false, prefix: '' },
  message: { title: 'Écrire au client', label: 'Votre message', placeholder: 'Écrivez votre message…', submit: 'Envoyer', required: true, prefix: '' },
};

function kindOf(button) {
  return KINDS.find(kind => button.hasAttribute(kind.status));
}

function requestId() {
  if (window.crypto?.randomUUID && window.isSecureContext) return window.crypto.randomUUID();
  const bytes = window.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function styles() {
  if (document.querySelector('style[data-request-actions]')) return;
  const style = document.createElement('style');
  style.dataset.requestActions = '';
  style.textContent = `
    .ra-dialog { width: min(480px, calc(100% - 24px)); padding: 20px; border: 0; border-radius: 18px; color: #0f172a; box-shadow: 0 24px 60px rgba(15,23,42,.3); font-family: Inter, system-ui, sans-serif; }
    .ra-dialog::backdrop { background: rgba(15,23,42,.45); }
    .ra-dialog h2 { margin: 0 0 14px; font-size: 1.15rem; color: #0f2a5f; }
    .ra-dialog label { display: grid; gap: 6px; font-weight: 600; font-size: .9rem; color: #334155; }
    .ra-dialog textarea { width: 100%; min-height: 110px; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 10px; font: inherit; font-size: 16px; font-weight: 400; resize: vertical; }
    .ra-error { margin: 10px 0 0; color: #b91c1c; font-size: .9rem; } .ra-error:empty { display: none; }
    .ra-actions { display: grid; grid-template-columns: 1fr 1.4fr; gap: 8px; margin-top: 14px; }
    .ra-actions button { min-height: 44px; border-radius: 10px; font: inherit; font-weight: 700; cursor: pointer; }
    .ra-cancel { color: #334155; background: #fff; border: 1px solid #e2e8f0; }
    .ra-submit { color: #fff; background: #1d4ed8; border: 0; }
    .ra-submit:disabled { opacity: .55; cursor: wait; }
    .ra-write { min-height: 36px; padding: 0 4px; color: #1d4ed8; background: none; border: 0; font: inherit; font-weight: 700; cursor: pointer; }
    .ra-toast { position: fixed; left: 50%; bottom: 84px; z-index: 95; display: flex; gap: 14px; align-items: center; max-width: calc(100% - 32px); padding: 12px 16px;
      color: #fff; background: #0f2a5f; border-radius: 12px; box-shadow: 0 12px 30px rgba(15,23,42,.3); transform: translateX(-50%); font: 500 .92rem Inter, system-ui, sans-serif; }
    .ra-toast a { color: #bfdbfe; font-weight: 700; white-space: nowrap; }`;
  document.head.append(style);
}

function toast(text, href) {
  document.querySelector('.ra-toast')?.remove();
  const node = document.createElement('div');
  node.className = 'ra-toast';
  node.setAttribute('role', 'status');
  const label = document.createElement('span');
  label.textContent = text;
  node.append(label);
  if (href) { const link = document.createElement('a'); link.href = href; link.textContent = 'Voir la conversation'; node.append(link); }
  document.body.append(node);
  setTimeout(() => node.remove(), 7000);
}

/** Opens the dialog; resolves with the trimmed text, or null if cancelled. */
function ask(mode) {
  styles();
  const config = DIALOGS[mode];
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = 'ra-dialog';
    dialog.innerHTML = `<h2></h2><form><label><span></span><textarea maxlength="1900"></textarea></label><p class="ra-error" role="alert"></p>
      <div class="ra-actions"><button class="ra-cancel" type="button">Annuler</button><button class="ra-submit" type="submit"></button></div></form>`;
    dialog.querySelector('h2').textContent = config.title;
    dialog.querySelector('label span').textContent = config.label;
    const area = dialog.querySelector('textarea');
    area.placeholder = config.placeholder;
    area.required = config.required;
    dialog.querySelector('.ra-submit').textContent = config.submit;
    const finish = value => { dialog.close(); dialog.remove(); resolve(value); };
    dialog.querySelector('.ra-cancel').addEventListener('click', () => finish(null));
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(null); });
    dialog.querySelector('form').addEventListener('submit', event => { event.preventDefault(); finish(area.value.trim()); });
    document.body.append(dialog);
    dialog.showModal();
    area.focus();
  });
}

async function send(type, id, body) {
  return publicationRequest(`/dashboard/requests/${type}/${encodeURIComponent(id)}/messages`, { method: 'POST', body: { body, requestId: requestId() } });
}

// Status buttons that need words: intercept before the page's own handler.
document.addEventListener('click', async event => {
  const button = event.target.closest?.('button');
  const kind = button && kindOf(button);
  if (!kind) return;
  const status = button.getAttribute(kind.status);
  if (!DIALOGS[status] || button.dataset.raConfirmed) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const text = await ask(status);
  if (text === null) return;
  if (text) {
    try { await send(kind.type(button), button.getAttribute(kind.id), DIALOGS[status].prefix + text); }
    catch (error) { toast(error.status === 409 ? 'Ce client n’a pas de compte : prévenez-le par téléphone ou email.' : (error.message || 'Le message n’est pas parti.')); }
  }
  button.dataset.raConfirmed = '1';
  button.click(); // the page's own handler now changes the status
  delete button.dataset.raConfirmed;
}, true);

// "Écrire au client" on every request that has actions.
function addWriteButtons() {
  for (const kind of KINDS) {
    document.querySelectorAll(`button[${kind.status}]`).forEach(statusButton => {
      const container = statusButton.closest('td, .hotel-row-actions, .vehicle-row-actions, .trip-row-actions') || statusButton.parentElement;
      if (!container || container.querySelector('.ra-write')) return;
      const write = document.createElement('button');
      write.type = 'button';
      write.className = 'ra-write';
      write.textContent = '💬 Écrire au client';
      write.addEventListener('click', async () => {
        const text = await ask('message');
        if (!text) return;
        try {
          const sent = await send(kind.type(statusButton), statusButton.getAttribute(kind.id), text);
          toast('Message envoyé au client.', sent?.conversationId ? `${kind.messages}?conversation=${encodeURIComponent(sent.conversationId)}` : '');
        } catch (error) {
          toast(error.status === 409 ? 'Ce client n’a pas de compte : contactez-le par téléphone ou email.' : (error.message || 'Le message n’est pas parti.'));
        }
      });
      container.prepend(write);
    });
  }
}

styles();
let queued = false;
new MutationObserver(() => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { queued = false; addWriteButtons(); });
}).observe(document.documentElement, { childList: true, subtree: true });
addWriteButtons();

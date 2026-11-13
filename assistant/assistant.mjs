import { publicationRequest } from '../publier/real-estate-api.mjs';
import { accountRoutes } from '../auth/navigation.mjs';
import { copy, labels, values } from './copy.mjs';

const root = document.getElementById('assistant');
const el = (tag, text, attrs = {}) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
};
const header = el('header');
header.append(el('a', copy.home, { href: '/' }), el('h1', copy.title));
root.append(header);
const status = el('p', copy.loading, { role: 'status' });
root.append(status);
let history = [];
let busy = false;
let account = '/compte/';
let form, input, send;
const timeline = el('section', undefined, { 'aria-label': copy.title, 'aria-live': 'polite' });
const fmt = value => typeof value === 'boolean' ? (value ? 'Oui' : 'Non') : values[String(value)] || String(value);
function fields(value, depth = 0, proposal = false) {
  const box = el('div', undefined, { class: 'fields' });
  if (depth > 5 || value === null || value === undefined) return box;
  if (Array.isArray(value)) {
    if (!value.length) box.append(el('p', copy.empty));
    for (const item of value.slice(0, 20)) box.append(fields(item, depth + 1, proposal));
  } else if (typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (!proposal && !labels[key]) continue;
      if (item === null || item === undefined) continue;
      const row = el('div', undefined, { class: 'field' });
      row.append(el('strong', labels[key] || key));
      if (typeof item === 'object') row.append(fields(item, depth + 1, proposal));
      else row.append(el('span', fmt(item)));
      box.append(row);
    }
    if (!proposal && typeof value.id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value.id)) {
      const choose = el('button', copy.choose, { type: 'button', class: 'secondary' });
      choose.addEventListener('click', () => {
        input.value = `${copy.reference} : ${value.id}. `;
        input.focus();
      });
      box.append(choose);
    }
  } else box.append(el('span', fmt(value)));
  return box;
}
function lock(value) {
  busy = value;
  send.disabled = value;
  input.readOnly = value;
  form.setAttribute('aria-busy', String(value));
  for (const button of timeline.querySelectorAll('button')) button.disabled = value;
}
function show(data) {
  const section = el('article');
  section.append(el('h2', data.label || copy.reply));
  if (data.kind === 'proposal') {
    section.append(el('p', copy.proposed), fields(data.args, 0, true));
    const controls = el('div', undefined, { class: 'actions' });
    const confirm = el('button', copy.confirm, { type: 'button' });
    const cancel = el('button', copy.cancel, { type: 'button', class: 'secondary' });
    controls.append(confirm, cancel);
    section.append(controls);
    cancel.onclick = () => controls.remove();
    confirm.onclick = async () => {
      if (busy) return;
      if (Date.parse(data.expiresAt) <= Date.now()) { controls.replaceWith(el('p', copy.expired)); return; }
      lock(true);
      try {
        const result = await publicationRequest('/assistant/confirm', { method: 'POST', body: { confirmation: data.confirmation, approved: true } });
        controls.replaceWith(el('p', copy.success));
        show(result);
      } catch (error) {
        controls.replaceWith(el('p', error.message || copy.failure, { role: 'alert' }));
      } finally { lock(false); }
    };
  } else if (data.kind === 'reply') section.append(el('p', data.text));
  else {
    section.append(el('p', data.completed ? copy.success : copy.result));
    const result = data.result?.data ?? data.result;
    section.append(fields(result));
    if (data.result?.meta) section.append(fields(data.result.meta));
    section.append(el('a', copy.more, { href: account }));
  }
  timeline.append(section);
}
async function start() {
  try {
    const user = await publicationRequest('/auth/me');
    account = accountRoutes[user.role] || '/compte/';
    header.append(el('a', copy.back, { href: account }));
    const capabilities = await publicationRequest('/assistant/capabilities');
    if (!capabilities.enabled) { status.textContent = copy.disabled; return; }
    status.remove();
    root.append(timeline);
    form = el('form');
    const messageLabel = el('label', copy.message, { for: 'assistant-message' });
    input = el('textarea', undefined, { id: 'assistant-message', rows: '4', maxlength: '2000', required: '', placeholder: copy.placeholder });
    const consentLabel = el('label', undefined, { class: 'consent' });
    const consent = el('input', undefined, { type: 'checkbox', required: '' });
    consentLabel.append(consent, el('span', copy.consent));
    const controls = el('div', undefined, { class: 'actions' });
    send = el('button', copy.send, { type: 'submit' });
    const clear = el('button', copy.clear, { type: 'button', class: 'secondary' });
    clear.onclick = () => { if (!busy) { history = []; timeline.replaceChildren(); input.value = ''; } };
    controls.append(send, clear);
    const errorBox = el('p', '', { role: 'alert' });
    form.append(messageLabel, input, consentLabel, controls, errorBox);
    root.append(form);
    form.onsubmit = async event => {
      event.preventDefault();
      if (busy || !form.reportValidity()) return;
      const message = input.value.trim();
      if (!message) return;
      errorBox.textContent = '';
      lock(true);
      send.textContent = copy.waiting;
      try {
        const result = await publicationRequest('/assistant/chat', { method: 'POST', body: { message, history: history.slice(-3), consent: consent.checked } });
        history.push(message);
        timeline.append(el('p', message, { class: 'user-message' }));
        show(result);
        input.value = '';
      } catch (error) { errorBox.textContent = error.message || copy.failure; }
      finally { lock(false); send.textContent = copy.send; input.focus(); }
    };
  } catch (error) {
    status.textContent = error.status === 401 || !localStorage.getItem('pencmi_access_token') ? '' : error.message;
    root.append(el('a', copy.login, { href: '/login/?next=%2Fassistant%2F' }));
  }
}
void start();

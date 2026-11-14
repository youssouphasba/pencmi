import { publicationRequest, getPublicationApiBase } from '../publier/real-estate-api.mjs';
import { tokenSession } from '../auth/token-session.mjs';
import { accountRoutes } from '../auth/navigation.mjs';
import { copy, labels, values } from './copy.mjs';

// Messaging layout: header, scrolling conversation, composer pinned to the bottom.
// Every server string is rendered as text nodes: no HTML from the API or the model is ever interpreted.
const root = document.getElementById('assistant');
const el = (tag, text, attrs = {}) => {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = text;
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
};
const storage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* optional convenience */ } },
};
const MAX_HISTORY = 12;
// Opened from the floating button: shown in a panel over another page.
const EMBED = new URLSearchParams(location.search).get('embed') === '1' && window.parent !== window;
if (EMBED) document.documentElement.classList.add('embed');
const closePanel = () => window.parent.postMessage('guindi:close', location.origin);
let history = [];
// The conversation survives page changes within the tab (sessionStorage, one key per account).
let log = [];          // replayable entries: { u: text } or { t: turn }
let settled = {};      // proposal confirmation -> 'done' | 'cancelled' | error message
let storeKey = null;
function persist() {
  if (!storeKey) return;
  try { sessionStorage.setItem(storeKey, JSON.stringify({ history, log: log.slice(-40), settled })); } catch { /* storage is optional */ }
}
function restore() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(storeKey) || 'null');
    if (!saved) return;
    history = Array.isArray(saved.history) ? saved.history.slice(-MAX_HISTORY) : [];
    log = Array.isArray(saved.log) ? saved.log : [];
    settled = saved.settled && typeof saved.settled === 'object' ? saved.settled : {};
  } catch { /* ignore a corrupted entry */ }
}
let busy = false;
let account = '/compte/';
let help = [];
let input, send, errorBox, suggestionsRow, sheet;

const fmt = value => typeof value === 'boolean' ? (value ? 'Oui' : 'Non') : values[String(value)] || String(value);
const money = (amount, currency = 'XOF') => Number.isFinite(Number(amount)) && amount !== null && amount !== ''
  ? `${new Intl.NumberFormat('fr-FR').format(Number(amount))} ${currency === 'XOF' ? 'FCFA' : currency || ''}`.trim() : '';
const date = value => {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(parsed) : '';
};
const safeId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
// Visitors talk to Guindi without a token; signed-in accounts go through the session-aware client.
const signedIn = () => Boolean(storage.get('pencmi_access_token'));
async function api(path, body) {
  if (signedIn()) return publicationRequest(path, body === undefined ? {} : { method: 'POST', body });
  const response = await fetch(getPublicationApiBase() + path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(payload?.error?.message || payload?.message || copy.failure), { status: response.status });
  return payload?.data ?? payload;
}
const detailPaths = { real_estate: '/immobilier/annonce/', hotels: '/hotels/detail/', vehicles: '/voitures/detail/', trips: '/voyages/detail/' };

// ---------- Shell ----------
const header = el('header', undefined, { class: 'chat-header' });
const back = el(EMBED ? 'button' : 'a', undefined, EMBED ? { class: 'icon-button', type: 'button', 'aria-label': copy.close } : { class: 'icon-button', href: '/', 'aria-label': copy.back });
back.append(el('span', EMBED ? '✕' : '←', { 'aria-hidden': 'true' }));
if (EMBED) {
  back.addEventListener('click', closePanel);
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !sheet?.open) closePanel(); });
}
const identity = el('div', undefined, { class: 'chat-identity' });
const avatar = el('span', '✦', { class: 'avatar', 'aria-hidden': 'true' });
const names = el('div');
names.append(el('h1', copy.title), el('p', copy.subtitle));
identity.append(avatar, names);
const tools = el('div', undefined, { class: 'chat-tools' });
header.append(back, identity, tools);
const thread = el('main', undefined, { class: 'chat-thread', 'aria-label': copy.conversation, 'aria-live': 'polite' });
const status = el('p', copy.loading, { role: 'status', class: 'chat-status' });
thread.append(status);
root.append(header, thread);

function scrollToEnd() { thread.scrollTo({ top: thread.scrollHeight, behavior: 'smooth' }); }

// ---------- Formatting of Guindi's text: **bold** and "- " lists ----------
function inline(parent, text) {
  text.split(/(\*\*[^*]+\*\*)/g).forEach(part => {
    if (/^\*\*[^*]+\*\*$/.test(part)) parent.append(el('strong', part.slice(2, -2)));
    else if (part) parent.append(document.createTextNode(part.replace(/\*\*/g, '')));
  });
}
function formatted(text) {
  const box = document.createDocumentFragment();
  let list = null;
  for (const raw of String(text).split('\n')) {
    const line = raw.trimEnd();
    const item = line.match(/^\s*[-•*]\s+(.*)$/);
    if (item) {
      if (!list) { list = el('ul'); box.append(list); }
      const li = el('li'); inline(li, item[1]); list.append(li);
      continue;
    }
    list = null;
    if (!line.trim()) continue;
    const p = el('p'); inline(p, line.replace(/^#{1,6}\s+/, '')); box.append(p);
  }
  return box;
}

// ---------- Messages ----------
function row(who) {
  const node = el('div', undefined, { class: `msg ${who}` });
  if (who === 'assistant') node.append(el('span', '✦', { class: 'avatar small', 'aria-hidden': 'true' }));
  const body = el('div', undefined, { class: 'msg-body' });
  node.append(body);
  thread.append(node);
  return body;
}
function bubble(text, who) {
  const body = row(who);
  const b = el('div', undefined, { class: 'bubble' });
  if (who === 'assistant') b.append(formatted(text)); else b.append(el('p', text));
  body.append(b);
  return body.parentElement;
}
function typing() {
  const body = row('assistant');
  const b = el('div', undefined, { class: 'bubble typing', 'aria-label': copy.thinking });
  b.append(el('span'), el('span'), el('span'));
  body.append(b);
  return body.parentElement;
}

function listingCard(item, module) {
  const m = item.metadata || {};
  let heading, place, price;
  if (module === 'trips') {
    heading = [item.departureCity, item.arrivalCity].filter(Boolean).join(' → ') || item.title;
    place = [date(item.departureDate), item.departureTime, item.availableSeats != null ? `${item.availableSeats} ${copy.seatsLeft}` : ''].filter(Boolean).join(', ');
    price = item.pricePerSeat != null ? `${money(item.pricePerSeat, item.currency)} ${copy.perSeat}` : '';
  } else if (module === 'hotels') {
    heading = item.name;
    place = [item.city, m.stars ? `${m.stars} ${copy.stars}` : ''].filter(Boolean).join(', ');
    price = m.priceFrom != null ? `${copy.from} ${money(m.priceFrom, item.currency)} ${copy.perNight}` : '';
  } else if (module === 'vehicles') {
    heading = item.title || [m.brand, m.model, m.year].filter(Boolean).join(' ');
    place = [item.city, values[item.vehicleMode]].filter(Boolean).join(', ');
    price = m.pricePerDay != null ? `${money(m.pricePerDay, item.currency)} ${copy.perDay}`
      : m.pricePerTrip != null ? `${money(m.pricePerTrip, item.currency)} ${copy.perTrip}` : money(item.price ?? m.price, item.currency);
  } else {
    heading = item.title;
    place = [item.neighborhood, item.city].filter(Boolean).join(', ');
    price = money(item.price, item.currency);
  }
  const href = safeId(item.id) && detailPaths[module] ? `${detailPaths[module]}?id=${encodeURIComponent(item.id)}` : null;
  const card = el(href ? 'a' : 'div', undefined, { class: 'chat-card', ...(href ? { href, target: EMBED ? '_top' : '_blank', rel: 'noopener' } : {}) });
  card.append(el('strong', heading || copy.untitled));
  if (place) card.append(el('span', place, { class: 'muted' }));
  if (price) card.append(el('span', price, { class: 'price' }));
  if (href) card.append(el('span', copy.view, { class: 'card-link' }));
  return card;
}

/** Labelled rendering for private results (requests, alerts, notifications…). Technical ids are hidden. */
function fields(value, depth = 0, proposal = false) {
  const box = el('div', undefined, { class: 'fields' });
  if (depth > 4 || value === null || value === undefined) return box;
  if (Array.isArray(value)) {
    if (!value.length) box.append(el('p', copy.empty, { class: 'muted' }));
    for (const item of value.slice(0, 20)) {
      const entry = fields(item, depth + 1, proposal);
      if (typeof item === 'object' && depth === 0) entry.classList.add('record');
      box.append(entry);
    }
  } else if (typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (item === null || item === undefined || item === '') continue;
      if (proposal && key === 'details' && typeof item === 'object') { box.append(...fields(item, depth + 1, proposal).children); continue; }
      if (!labels[key] || /(^id$|Id$)/.test(key)) continue;
      const line = el('div', undefined, { class: 'field' });
      line.append(el('span', labels[key], { class: 'field-label' }));
      if (typeof item === 'object') line.append(fields(item, depth + 1, proposal));
      else line.append(el('span', /At$|Date$|^check(In|Out)$/.test(key) && date(item) ? date(item) : fmt(item)));
      box.append(line);
    }
  } else box.append(el('span', fmt(value)));
  return box;
}

function attach(node) {
  const body = row('assistant');
  body.append(node);
  return body.parentElement;
}

function resultBlock(block) {
  // The FAQ only feeds Guindi's answer: its raw result is not shown.
  if (block.tool === 'faq') return null;
  const data = block.result?.data ?? block.result;
  if (block.module && (block.tool === 'search' || block.tool === 'listing')) {
    const list = Array.isArray(data) ? data : data ? [data] : [];
    if (!list.length) return attach(el('div', copy.noMatch, { class: 'bubble muted' }));
    const strip = el('div', undefined, { class: 'card-strip', role: 'list', 'aria-label': block.label });
    for (const item of list.slice(0, 12)) { const card = listingCard(item, block.module); card.setAttribute('role', 'listitem'); strip.append(card); }
    return attach(strip);
  }
  const panel = el('div', undefined, { class: 'bubble panel' });
  panel.append(el('p', block.label, { class: 'panel-title' }), fields(data), el('a', copy.more, { href: account, class: 'text-link', ...(EMBED ? { target: '_top' } : {}) }));
  return attach(panel);
}

function proposalBlock(block) {
  const panel = el('div', undefined, { class: 'bubble proposal' });
  panel.append(el('p', block.label, { class: 'panel-title' }), fields(block.args, 0, true), el('p', copy.proposed, { class: 'muted small' }));
  const outcome = settled[block.confirmation];
  if (outcome) {
    panel.append(outcome === 'done' ? el('p', `✓ ${copy.success}`, { class: 'success' })
      : outcome === 'cancelled' ? el('p', copy.cancelled, { class: 'muted small' }) : el('p', outcome, { role: 'alert' }));
    return attach(panel);
  }
  if (Date.parse(block.expiresAt) <= Date.now()) { panel.append(el('p', copy.expired, { class: 'muted small' })); return attach(panel); }
  const actions = el('div', undefined, { class: 'proposal-actions' });
  const confirm = el('button', copy.confirm, { type: 'button', class: 'button primary' });
  const cancel = el('button', copy.cancel, { type: 'button', class: 'button ghost' });
  actions.append(cancel, confirm);
  panel.append(actions);
  cancel.addEventListener('click', () => {
    actions.replaceWith(el('p', copy.cancelled, { class: 'muted small' }));
    settled[block.confirmation] = 'cancelled';
    remember('assistant', `[${copy.cancelledMemo} : ${block.label}]`);
  });
  confirm.addEventListener('click', async () => {
    if (busy) return;
    if (Date.parse(block.expiresAt) <= Date.now()) { actions.replaceWith(el('p', copy.expired, { role: 'alert' })); return; }
    lock(true);
    try {
      const result = await publicationRequest('/assistant/confirm', { method: 'POST', body: { confirmation: block.confirmation, approved: true } });
      actions.replaceWith(el('p', `✓ ${copy.success}`, { class: 'success' }));
      settled[block.confirmation] = 'done';
      remember('assistant', result.memo);
    } catch (error) {
      actions.replaceWith(el('p', error.message || copy.failure, { role: 'alert' }));
      settled[block.confirmation] = error.message || copy.failure;
      persist();
    } finally { lock(false); scrollToEnd(); }
  });
  return attach(panel);
}

// Sign-in inside the conversation: the visitor stays here and the pending request resumes.
function loginBlock(block) {
  const panel = el('div', undefined, { class: 'bubble panel login-panel' });
  if (signedIn()) { panel.append(el('p', `✓ ${copy.signedIn}`, { class: 'success' })); return attach(panel); }
  const identifier = el('input', undefined, { type: 'text', autocomplete: 'username', required: '', 'aria-label': copy.identifier, placeholder: copy.identifier });
  const password = el('input', undefined, { type: 'password', autocomplete: 'current-password', required: '', 'aria-label': copy.password, placeholder: copy.password });
  const submitButton = el('button', copy.login, { type: 'submit', class: 'button primary' });
  const feedback = el('p', '', { role: 'alert', class: 'small' });
  const target = EMBED ? { target: '_top' } : {};
  const here = EMBED ? (() => { try { return window.parent.location.pathname; } catch { return '/'; } })() : '/assistant/';
  const register = el('a', copy.register, { href: `/register/?next=${encodeURIComponent(here)}`, class: 'button ghost', ...target });
  const links = el('p', undefined, { class: 'small login-links' });
  links.append(el('a', copy.forgot, { href: '/forgot-password/', ...target }));
  const form = el('form', undefined, { class: 'login-form' });
  form.append(el('p', block.reason, { class: 'panel-title' }), identifier, password, el('div', undefined, { class: 'login-actions' }, ), feedback, links);
  form.querySelector('.login-actions').append(submitButton, register);
  panel.append(form);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitButton.disabled) return;
    submitButton.disabled = true; feedback.textContent = '';
    try {
      const response = await fetch(getPublicationApiBase() + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: identifier.value.trim(), password: password.value }) });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error?.message || payload?.message || copy.loginFailed);
      await tokenSession.install(payload?.data ?? payload);
      const user = await publicationRequest('/auth/me');
      adoptAccount(user);
      form.replaceWith(el('p', `✓ ${copy.signedIn}${user.firstName ? `, ${user.firstName}` : ''}.`, { class: 'success' }));
      if (EMBED) window.parent.postMessage('guindi:signed-in', location.origin);
      const pending = [...log].reverse().find(entry => entry.u)?.u;
      if (pending) void submit(pending, { resume: true });
    } catch (error) {
      feedback.textContent = error.message || copy.loginFailed;
      submitButton.disabled = false;
    }
  });
  return attach(panel);
}

/** After signing in, the visitor's conversation becomes the account's conversation. */
function adoptAccount(user) {
  const previousKey = storeKey;
  account = accountRoutes[user.role] || '/compte/';
  storeKey = user?.id ? `pencmi_guindi_${user.id}` : null;
  try { if (previousKey && previousKey !== storeKey) sessionStorage.removeItem(previousKey); } catch { /* optional */ }
  persist();
}

function showTurn(turn) {
  if (turn.text) bubble(turn.text, 'assistant');
  for (const block of turn.blocks || []) {
    if (block.type === 'proposal') proposalBlock(block);
    else if (block.type === 'login') loginBlock(block);
    else if (block.type === 'error') attach(el('div', `${block.label} : ${block.message}`, { class: 'bubble error', role: 'alert' }));
    else resultBlock(block);
  }
}

// ---------- Conversation state ----------
function remember(role, content) {
  if (!content) return;
  history.push({ role, content: String(content).slice(0, 8000) });
  history = history.slice(-MAX_HISTORY);
  persist();
}
function lock(value) {
  busy = value;
  send.disabled = value;
  input.readOnly = value;
  for (const button of thread.querySelectorAll('button')) button.disabled = value;
}
function greet() {
  bubble(copy.greeting, 'assistant');
  suggestionsRow.hidden = false;
}
function resetConversation() {
  if (busy) return;
  history = []; log = []; settled = {};
  try { sessionStorage.removeItem(storeKey); } catch { /* optional */ }
  thread.replaceChildren();
  errorBox.textContent = '';
  greet();
}

async function submit(message, { resume = false } = {}) {
  if (busy || !message) return;
  errorBox.textContent = '';
  suggestionsRow.hidden = true;
  // After signing in, the last request is sent again without repeating the user's bubble.
  const mine = resume ? null : bubble(message, 'user');
  const dots = typing();
  input.value = ''; autoGrow();
  lock(true);
  scrollToEnd();
  try {
    const turn = await api('/assistant/chat', { message: resume ? `${message} (je suis maintenant connecté)` : message, history, consent: true });
    dots.remove();
    if (resume) log.push({ t: turn }); else log.push({ u: message }, { t: turn });
    remember('user', message);
    remember('assistant', turn.memo || turn.text);
    showTurn(turn);
  } catch (error) {
    dots.remove(); mine?.remove();
    if (!resume) { input.value = message; autoGrow(); }
    errorBox.textContent = error.message || copy.failure;
  } finally { lock(false); input.focus(); scrollToEnd(); }
}

function autoGrow() {
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 132)}px`;
}

// ---------- Help sheet ----------
function buildSheet() {
  const dialog = el('dialog', undefined, { class: 'sheet', 'aria-labelledby': 'sheet-title' });
  const head = el('div', undefined, { class: 'sheet-head' });
  const close = el('button', '✕', { type: 'button', class: 'icon-button', 'aria-label': copy.close });
  head.append(el('h2', copy.capabilitiesTitle, { id: 'sheet-title' }), close);
  dialog.append(head, el('p', copy.confirmNote, { class: 'muted small sheet-note' }));
  for (const group of help) {
    const section = el('section', undefined, { class: 'sheet-group' });
    section.append(el('h3', group.title));
    for (const item of group.items) {
      const example = item.examples[0];
      const option = el('button', undefined, { type: 'button', class: 'sheet-item' });
      option.append(el('span', item.text, { class: 'sheet-item-text' }), el('span', `« ${example} »`, { class: 'sheet-item-example' }));
      option.addEventListener('click', () => { dialog.close(); input.value = example; autoGrow(); input.focus(); });
      section.append(option);
    }
    dialog.append(section);
  }
  dialog.append(el('p', copy.cannot, { class: 'muted small sheet-note' }));
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  document.body.append(dialog);
  return dialog;
}

// ---------- Start ----------
async function start() {
  try {
    if (signedIn()) {
      const user = await publicationRequest('/auth/me');
      storeKey = user?.id ? `pencmi_guindi_${user.id}` : null;
      account = accountRoutes[user.role] || '/compte/';
    } else {
      storeKey = 'pencmi_guindi_visitor';
      account = '/';
    }
    if (storeKey) restore();
    if (!EMBED) try {
      const previous = new URL(document.referrer);
      back.href = previous.origin === location.origin && !previous.pathname.startsWith('/assistant') ? previous.pathname + previous.search : account;
    } catch { back.href = account; }
    const capabilities = await api('/assistant/capabilities');
    if (!capabilities.enabled) { status.textContent = copy.disabled; return; }
    help = Array.isArray(capabilities.help) ? capabilities.help.filter(group => group.items?.length) : [];
    status.remove();

    const helpButton = el('button', '?', { type: 'button', class: 'icon-button', 'aria-label': copy.helpButton });
    const clear = el('button', '↺', { type: 'button', class: 'icon-button', 'aria-label': copy.clear });
    tools.append(helpButton, clear);
    sheet = buildSheet();
    helpButton.addEventListener('click', () => sheet.showModal());
    clear.addEventListener('click', resetConversation);

    const composer = el('footer', undefined, { class: 'chat-composer' });
    suggestionsRow = el('div', undefined, { class: 'suggestions', 'aria-label': copy.suggestions });
    for (const group of help.slice(0, 4)) {
      const text = group.items[0].examples[0];
      const chip = el('button', text, { type: 'button', class: 'chip' });
      chip.addEventListener('click', () => void submit(text));
      suggestionsRow.append(chip);
    }
    errorBox = el('p', '', { role: 'alert', class: 'chat-error' });
    const form = el('form', undefined, { class: 'composer-row' });
    input = el('textarea', undefined, { rows: '1', maxlength: '2000', placeholder: copy.placeholder, 'aria-label': copy.message, enterkeyhint: 'send' });
    send = el('button', undefined, { type: 'submit', class: 'send', 'aria-label': copy.send });
    send.append(el('span', '➤', { 'aria-hidden': 'true' }));
    form.append(input, send);
    composer.append(suggestionsRow, errorBox, form);
    root.append(composer);

    input.addEventListener('input', autoGrow);
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); form.requestSubmit(); }
    });
    form.addEventListener('submit', event => { event.preventDefault(); void submit(input.value.trim()); });
    greet();
    if (log.length) {
      suggestionsRow.hidden = true;
      for (const entry of log) { if (entry.u) bubble(entry.u, 'user'); else if (entry.t) showTurn(entry.t); }
      thread.scrollTop = thread.scrollHeight;
    }
  } catch (error) {
    status.textContent = error.status === 401 || !storage.get('pencmi_access_token') ? copy.loginRequired : error.message;
    thread.append(el('a', copy.login, { href: '/login/?next=%2Fassistant%2F', class: 'button primary' }));
  }
}
void start();

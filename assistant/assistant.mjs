import { publicationRequest } from '../publier/real-estate-api.mjs';
import { accountRoutes } from '../auth/navigation.mjs';
import { copy, labels, values } from './copy.mjs';

// Every server string is rendered with textContent: no HTML from the API or the model is ever interpreted.
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
let history = [];
let busy = false;
let account = '/compte/';
let form, input, send, consent, errorBox, intro, help = [];

const header = el('header', undefined, { class: 'assistant-header' });
const brand = el('a', 'Péncmi', { href: '/', class: 'brand' });
const title = el('h1', copy.title);
const nav = el('nav', undefined, { 'aria-label': copy.navigation });
header.append(brand, title, nav);
const status = el('p', copy.loading, { role: 'status', class: 'status' });
const timeline = el('section', undefined, { class: 'timeline', 'aria-label': copy.conversation, 'aria-live': 'polite' });
root.append(header, status);

const fmt = value => typeof value === 'boolean' ? (value ? 'Oui' : 'Non') : values[String(value)] || String(value);
const money = (amount, currency = 'XOF') => Number.isFinite(Number(amount)) && amount !== null && amount !== ''
  ? `${new Intl.NumberFormat('fr-FR').format(Number(amount))} ${currency === 'XOF' ? 'FCFA' : currency || ''}`.trim() : '';
const date = value => {
  const parsed = value ? new Date(value) : null;
  return parsed && !Number.isNaN(parsed.getTime()) ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(parsed) : '';
};
const safeId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(value);
const detailPaths = { real_estate: '/immobilier/annonce/', hotels: '/hotels/detail/', vehicles: '/voitures/detail/', trips: '/voyages/detail/' };

function scrollToEnd() { timeline.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }

/** Card summary of a published listing, per universe. */
function listingCard(item, module) {
  const m = item.metadata || {};
  const card = el('article', undefined, { class: 'listing-card' });
  let heading, place, price, extra;
  if (module === 'trips') {
    heading = item.title || [item.departureCity, item.arrivalCity].filter(Boolean).join(' → ');
    place = [item.departureCity, item.arrivalCity].filter(Boolean).join(' → ');
    price = item.pricePerSeat != null ? `${money(item.pricePerSeat, item.currency)} ${copy.perSeat}` : '';
    extra = [date(item.departureDate), item.departureTime, item.availableSeats != null ? `${item.availableSeats} ${copy.seatsLeft}` : ''].filter(Boolean).join(' · ');
  } else if (module === 'hotels') {
    heading = item.name;
    place = [item.city, item.region].filter(Boolean).join(', ');
    price = m.priceFrom != null ? `${copy.from} ${money(m.priceFrom, item.currency)} ${copy.perNight}` : '';
    extra = [m.stars ? '★'.repeat(Math.min(5, Number(m.stars) || 0)) : '', values[item.propertyType] || ''].filter(Boolean).join(' · ');
  } else if (module === 'vehicles') {
    heading = item.title || [m.brand, m.model, m.year].filter(Boolean).join(' ');
    place = item.city;
    price = m.pricePerDay != null ? `${money(m.pricePerDay, item.currency)} ${copy.perDay}`
      : m.pricePerTrip != null ? `${money(m.pricePerTrip, item.currency)} ${copy.perTrip}` : money(item.price ?? m.price, item.currency);
    extra = [values[item.vehicleMode] || '', m.fuel, m.gearbox].filter(Boolean).join(' · ');
  } else {
    heading = item.title;
    place = [item.neighborhood, item.city].filter(Boolean).join(', ');
    price = money(item.price, item.currency);
    extra = [values[item.transaction] || item.transaction, values[item.propertyType] || item.propertyType].filter(Boolean).join(' · ');
  }
  card.append(el('h3', heading || copy.untitled));
  if (place) card.append(el('p', place, { class: 'muted' }));
  if (extra) card.append(el('p', extra, { class: 'muted' }));
  if (price) card.append(el('p', price, { class: 'price' }));
  const actions = el('div', undefined, { class: 'card-actions' });
  if (safeId(item.id) && detailPaths[module]) {
    actions.append(el('a', copy.view, { href: `${detailPaths[module]}?id=${encodeURIComponent(item.id)}`, class: 'btn-link', target: '_blank', rel: 'noopener' }));
  }
  const ask = el('button', copy.askAbout, { type: 'button', class: 'secondary small' });
  ask.addEventListener('click', () => { input.value = `${copy.askPrefix} « ${heading || copy.untitled} »`; input.focus(); });
  actions.append(ask);
  card.append(actions);
  return card;
}

/** Generic, labelled rendering for private results (requests, alerts, notifications…). Ids are hidden. */
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
      if (!labels[key] || (!proposal && /(^id$|Id$)/.test(key))) continue;
      const row = el('div', undefined, { class: 'field' });
      row.append(el('span', labels[key], { class: 'field-label' }));
      if (typeof item === 'object') row.append(fields(item, depth + 1, proposal));
      else row.append(el('span', /At$|Date$|^check(In|Out)$/.test(key) && date(item) ? date(item) : fmt(item)));
      box.append(row);
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

function remember(role, content) {
  if (!content) return;
  history.push({ role, content: String(content).slice(0, 8000) });
  history = history.slice(-MAX_HISTORY);
}

function bubble(text, who) {
  const node = el('div', undefined, { class: `bubble ${who}` });
  node.append(el('p', text));
  timeline.append(node);
  return node;
}

function resultBlock(block) {
  const section = el('section', undefined, { class: 'block' });
  section.append(el('h2', block.label));
  const body = block.result?.data ?? block.result;
  const items = Array.isArray(body) ? body : null;
  if (block.module && (block.tool === 'search' || block.tool === 'listing')) {
    const list = items ?? (body ? [body] : []);
    if (!list.length) section.append(el('p', copy.noMatch, { class: 'muted' }));
    const grid = el('div', undefined, { class: 'cards' });
    for (const item of list.slice(0, 12)) grid.append(listingCard(item, block.module));
    section.append(grid);
    const total = block.result?.meta?.total;
    if (Number(total) > list.length) section.append(el('p', `${list.length} ${copy.of} ${total} ${copy.results}`, { class: 'muted' }));
  } else {
    section.append(fields(body));
    section.append(el('a', copy.more, { href: account, class: 'btn-link' }));
  }
  return section;
}

function proposalBlock(block) {
  const section = el('section', undefined, { class: 'block proposal' });
  section.append(el('h2', block.label), el('p', copy.proposed, { class: 'muted' }), fields(block.args, 0, true));
  const controls = el('div', undefined, { class: 'actions' });
  const confirm = el('button', copy.confirm, { type: 'button' });
  const cancel = el('button', copy.cancel, { type: 'button', class: 'secondary' });
  controls.append(confirm, cancel);
  section.append(controls);
  cancel.addEventListener('click', () => {
    controls.replaceWith(el('p', copy.cancelled, { class: 'muted' }));
    remember('assistant', `[${copy.cancelledMemo} : ${block.label}]`);
  });
  confirm.addEventListener('click', async () => {
    if (busy) return;
    if (Date.parse(block.expiresAt) <= Date.now()) { controls.replaceWith(el('p', copy.expired, { role: 'alert' })); return; }
    lock(true);
    try {
      const result = await publicationRequest('/assistant/confirm', { method: 'POST', body: { confirmation: block.confirmation, approved: true } });
      controls.replaceWith(el('p', copy.success, { class: 'success' }));
      remember('assistant', result.memo);
      timeline.append(resultBlock({ ...result, label: result.label }));
    } catch (error) {
      controls.replaceWith(el('p', error.message || copy.failure, { role: 'alert' }));
    } finally { lock(false); scrollToEnd(); }
  });
  return section;
}

function showTurn(turn) {
  if (turn.text) bubble(turn.text, 'assistant');
  for (const block of turn.blocks || []) {
    if (block.type === 'proposal') timeline.append(proposalBlock(block));
    else if (block.type === 'error') timeline.append(el('p', `${block.label} : ${block.message}`, { role: 'alert', class: 'block-error' }));
    else timeline.append(resultBlock(block));
  }
}

async function submit(message) {
  if (busy || !message) return;
  if (!consent.checked) { errorBox.textContent = copy.consentRequired; consent.focus(); return; }
  errorBox.textContent = '';
  intro?.remove(); intro = null;
  const mine = bubble(message, 'user');
  const thinking = bubble(copy.thinking, 'assistant pending');
  lock(true);
  scrollToEnd();
  try {
    const turn = await publicationRequest('/assistant/chat', { method: 'POST', body: { message, history, consent: true } });
    thinking.remove();
    remember('user', message);
    remember('assistant', turn.memo || turn.text);
    showTurn(turn);
    input.value = '';
  } catch (error) {
    thinking.remove(); mine.remove();
    errorBox.textContent = error.message || copy.failure;
  } finally { lock(false); input.focus(); scrollToEnd(); }
}

function chip(text) {
  const button = el('button', text, { type: 'button', class: 'chip' });
  button.addEventListener('click', () => { input.value = text; input.focus(); });
  return button;
}

/** Everything Guindi can do for this role, built from the server's list of usable tools. */
function capabilityList() {
  const box = el('div', undefined, { class: 'capabilities' });
  for (const group of help) {
    const section = el('section', undefined, { class: 'capability-group' });
    section.append(el('h3', group.title));
    const list = el('ul');
    for (const item of group.items) {
      const entry = el('li');
      const line = el('p', item.text);
      if (item.confirmationRequired) line.append(' ', el('span', copy.withConfirmation, { class: 'badge' }));
      const examples = el('div', undefined, { class: 'suggestions' });
      for (const example of item.examples.slice(0, 2)) examples.append(chip(example));
      entry.append(line, examples);
      list.append(entry);
    }
    section.append(list);
    box.append(section);
  }
  box.append(el('p', copy.cannot, { class: 'muted small-text' }));
  return box;
}

function introPanel() {
  const panel = el('div', undefined, { class: 'intro' });
  panel.append(el('p', copy.intro));
  const quick = el('div', undefined, { class: 'suggestions' });
  // One example per group gives a quick tour of the main families of requests.
  for (const group of help.slice(0, 4)) quick.append(chip(group.items[0].examples[0]));
  const more = el('details', undefined, { class: 'capability-details' });
  more.append(el('summary', copy.capabilities), capabilityList());
  panel.append(quick, more, el('p', copy.limits, { class: 'muted small-text' }));
  return panel;
}

function showHelp() {
  if (busy) return;
  if (intro) { intro.querySelector('details').open = true; intro.scrollIntoView({ behavior: 'smooth' }); return; }
  const block = el('section', undefined, { class: 'block' });
  block.append(el('h2', copy.capabilitiesTitle), capabilityList());
  timeline.append(block);
  scrollToEnd();
}

async function start() {
  try {
    const user = await publicationRequest('/auth/me');
    account = accountRoutes[user.role] || '/compte/';
    nav.append(el('a', copy.back, { href: account }));
    const capabilities = await publicationRequest('/assistant/capabilities');
    if (!capabilities.enabled) { status.textContent = copy.disabled; return; }
    help = Array.isArray(capabilities.help) ? capabilities.help.filter(group => group.items?.length) : [];
    status.remove();
    const helpButton = el('button', copy.helpButton, { type: 'button', class: 'secondary small' });
    helpButton.addEventListener('click', showHelp);
    nav.prepend(helpButton);
    intro = introPanel();
    root.append(intro, timeline);
    form = el('form', undefined, { class: 'composer' });
    input = el('textarea', undefined, { id: 'assistant-message', rows: '2', maxlength: '2000', placeholder: copy.placeholder, 'aria-label': copy.message });
    const consentLabel = el('label', undefined, { class: 'consent' });
    consent = el('input', undefined, { type: 'checkbox' });
    consent.checked = storage.get('pencmi_assistant_consent') === '1';
    consent.addEventListener('change', () => storage.set('pencmi_assistant_consent', consent.checked ? '1' : '0'));
    consentLabel.append(consent, el('span', copy.consent));
    const controls = el('div', undefined, { class: 'actions' });
    send = el('button', copy.send, { type: 'submit' });
    const clear = el('button', copy.clear, { type: 'button', class: 'secondary' });
    clear.addEventListener('click', () => {
      if (busy) return;
      history = []; timeline.replaceChildren(); input.value = ''; errorBox.textContent = '';
      if (!intro) { intro = introPanel(); timeline.before(intro); }
    });
    controls.append(send, clear);
    errorBox = el('p', '', { role: 'alert' });
    form.append(input, controls, consentLabel, errorBox);
    root.append(form);
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); form.requestSubmit(); }
    });
    form.addEventListener('submit', event => { event.preventDefault(); void submit(input.value.trim()); });
  } catch (error) {
    status.textContent = error.status === 401 || !storage.get('pencmi_access_token') ? copy.loginRequired : error.message;
    root.append(el('a', copy.login, { href: '/login/?next=%2Fassistant%2F', class: 'btn-link' }));
  }
}
void start();

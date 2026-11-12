import { apiRequest, formatDateTime } from '../../messaging/messaging-ui.mjs';
import { accountError, accountStyles, el, sessionRequired } from '../../compte/account-ui.mjs';
import { supportStatuses } from '../../compte/support-copy.mjs';

const root = document.querySelector('#content-root');
const id = new URLSearchParams(location.search).get('id');
const detail = document.body.dataset.contentPage === 'adminSupportDetail';
const content = el('div', { class: 'safety-report-stack' });
const link = (href, text) => el('a', { class: 'btn btn-light', href, text });
const button = (text, onClick) => el('button', { class: 'btn btn-light', type: 'button', text, onClick });
const card = (...children) => el('section', { class: 'ae-section safety-report-card' }, ...children);
const option = (status) => el('option', { value: status, text: supportStatuses[status] });
const label = (text, node) => el('label', {}, el('span', { text }), node);
accountStyles();
root.replaceChildren(el('main', { class: 'safety-main' },
  el('h1', { text: detail ? 'Détail du ticket' : 'Support' }),
  el('nav', { class: 'safety-actions' }, link('/admin/', 'Administration'), detail ? link('/admin/support/', 'Tous les tickets') : null), content));
if (!sessionRequired(content)) {
  if (detail) void loadTicket();
  else loadQueue();
}

function loadQueue() {
  const filter = el('select', {}, el('option', { value: '', text: 'Tous les statuts' }), Object.keys(supportStatuses).map(option));
  const items = el('div', { class: 'safety-report-stack' });
  let generation = 0;
  async function load(page = 1) {
    const current = ++generation;
    const query = new URLSearchParams({ page, limit: 20 });
    if (filter.value) query.set('status', filter.value);
    items.textContent = 'Chargement…';
    try {
      const { data, meta } = await apiRequest(`/support/admin/tickets?${query}`, { includeMeta: true });
      if (current !== generation) return;
      items.replaceChildren(...data.map(ticket => card(el('h2', { text: ticket.subject }),
        el('p', { text: `${supportStatuses[ticket.status]} · ${formatDateTime(ticket.updatedAt)}` }),
        link(`/admin/support/detail/?id=${encodeURIComponent(ticket.id)}`, 'Ouvrir'))));
      if (!data.length) items.append(el('p', { text: 'Aucun ticket pour ce statut.' }));
      if (meta.totalPages > 1) items.append(el('nav', { class: 'safety-actions', 'aria-label': 'Pagination' },
        page > 1 ? button('Précédent', () => load(page - 1)) : null, el('span', { text: `Page ${page} sur ${meta.totalPages}` }),
        page < meta.totalPages ? button('Suivant', () => load(page + 1)) : null));
    } catch (error) {
      if (current === generation) accountError(items, error, () => load(page));
    }
  }
  filter.onchange = () => load();
  content.replaceChildren(el('div', { class: 'safety-filter-row' }, label('Statut', filter)), items);
  void load();
}

function command(caption, field, title, run) {
  const submit = el('button', { class: 'btn btn-primary', text: title, type: 'submit' });
  const feedback = el('div', { role: 'status' });
  const form = el('form', { class: 'ae-form' }, label(caption, field), submit, feedback);
  form.onsubmit = async event => {
    event.preventDefault();
    if (submit.disabled || !form.reportValidity()) return;
    submit.disabled = field.disabled = true;
    try {
      await run(field.value);
      await loadTicket();
    } catch (error) { accountError(feedback, error); }
    finally { submit.disabled = field.disabled = false; }
  };
  return card(form);
}

async function loadTicket() {
  if (!id || !/^[\w-]{1,128}$/.test(id)) { content.textContent = 'Aucun ticket sélectionné.'; return; }
  const path = `/support/admin/tickets/${encodeURIComponent(id)}`;
  content.textContent = 'Chargement…';
  try {
    const ticket = await apiRequest(path);
    content.replaceChildren(card(el('h2', { text: ticket.subject }), el('p', { text: supportStatuses[ticket.status] })),
      ...ticket.messages.map(message => card(
        el('small', { text: `${message.senderUserId === ticket.userId ? 'Demandeur' : 'Support'} · ${formatDateTime(message.createdAt)}` }),
        el('p', { text: message.body }))),
      ticket.canReply ? command('Réponse', el('textarea', { required: true, maxLength: 10000, rows: 5 }), 'Envoyer la réponse', async value => {
        const reply = await apiRequest(path + '/messages', { method: 'POST', body: { body: value.trim() } });
        if (!reply?.id) throw Error('La réponse n’a pas été confirmée.');
      }) : null,
      ticket.actions.length ? command('Nouveau statut', el('select', {}, ticket.actions.map(option)), 'Changer le statut', async status => {
        const result = await apiRequest(path + '/status', { method: 'PATCH', body: { status } });
        if (result?.status !== status) throw Error('Le statut n’a pas été confirmé.');
      }) : null);
  } catch (error) { accountError(content, error, loadTicket); }
}

import { apiRequest, formatDateTime } from '../messaging/messaging-ui.mjs';
import { accountError, accountStyles, el, sessionRequired } from '../compte/account-ui.mjs';
import { reportModules, reportReasons, reportStatuses, reportTargets } from './reports-copy.mjs';

const link = (href, text) => el('a', { href, text, class: 'btn btn-light' });
const button = (text, onClick) => el('button', { text, onClick, type: 'button', class: 'btn btn-light' });
const label = (text, input) => el('label', {}, el('span', { text }), input);
const options = (choices, first) => el('select', {}, first ? el('option', { value: '', text: first }) : null,
  Object.entries(choices).map(([value, text]) => el('option', { value, text })));
const card = (...children) => el('article', { class: 'ae-section safety-report-card' }, ...children);
const value = (name, text) => el('p', {}, el('strong', { text: name + ' : ' }), el('span', { text: text || '—' }));
const detailHref = id => `/admin/reports/detail/?id=${encodeURIComponent(id)}`;

export async function mountSafetyPage(root, page) {
  accountStyles();
  const admin = page?.startsWith('admin') || page?.startsWith('moderation');
  const received = page === 'advertiserReports';
  const title = ({
    report: 'Signaler un problème', clientReports: 'Mes signalements', advertiserReports: 'Signalements reçus',
    adminReports: 'Signalements', adminReportDetail: 'Détail du signalement', moderation: 'Modération',
    moderationMessages: 'Messages signalés', moderationListings: 'Annonces signalées', moderationUsers: 'Profils signalés',
  })[page] || 'Signalements';
  const content = el('div', { class: 'safety-report-stack' });
  root.replaceChildren(el('main', { class: 'safety-main' },
    el('header', { class: 'safety-header' }, el('h1', { text: title })),
    el('nav', { class: 'safety-actions' }, link(admin ? '/admin/' : received ? '/dashboard/' : '/compte/', 'Retour à mon espace'),
      admin ? link('/admin/validation/', 'Modérer les annonces') : null,
      admin && page !== 'adminReports' ? link('/admin/reports/', 'Tous les signalements') : null,
      page === 'report' ? link('/compte/signalements/', 'Mes signalements') : null), content));
  if (sessionRequired(content)) return;
  if (page === 'report') return renderReportForm(content);
  if (page === 'adminReportDetail') return renderDetail(content);
  return renderList(content, admin ? 'admin' : received ? 'received' : 'mine',
    { moderationMessages: 'message', moderationListings: 'listing', moderationUsers: 'advertiser' }[page]);
}

function renderReportForm(root) {
  const query = new URLSearchParams(location.search);
  const hasTarget = ['module', 'targetType', 'targetId'].some(key => query.has(key));
  const target = hasTarget ? {
    module: query.get('module'), targetType: query.get('targetType'), targetId: query.get('targetId'),
  } : { module: 'system', targetType: 'other', targetId: 'platform' };
  if (!Object.hasOwn(reportModules, target.module) || !Object.hasOwn(reportTargets, target.targetType)
    || !/^[\w-]{1,128}$/.test(target.targetId || '')) {
    root.textContent = 'La cible du signalement est invalide.';
    return;
  }
  const reason = options(reportReasons, 'Choisir un motif');
  reason.required = true;
  const message = el('textarea', { maxLength: 2000, rows: 5 });
  const feedback = el('div', { role: 'status' });
  const send = el('button', { type: 'submit', class: 'btn btn-primary', text: 'Envoyer le signalement' });
  const form = el('form', { class: 'ae-form' },
    value('Cible', `${reportModules[target.module]} · ${reportTargets[target.targetType]}`),
    label('Motif', reason), label('Message complémentaire', message), send, feedback);
  form.onsubmit = async event => {
    event.preventDefault();
    if (send.disabled || !form.reportValidity()) return;
    send.disabled = reason.disabled = message.disabled = true;
    feedback.textContent = 'Envoi en cours…';
    try {
      const result = await apiRequest('/reports', { method: 'POST', body: { ...target, reason: reason.value, message: message.value } });
      if (!result?.id) throw Error('La réception du signalement n’a pas été confirmée.');
      root.replaceChildren(card(el('p', { role: 'status', text: 'Votre signalement a été transmis.' }),
        link('/compte/signalements/', 'Suivre mes signalements')));
    } catch (error) { accountError(feedback, error); }
    finally { send.disabled = reason.disabled = message.disabled = false; }
  };
  root.replaceChildren(card(form));
}

function renderList(root, scope, type) {
  const modules = options(reportModules, 'Tous les modules');
  const statuses = options(reportStatuses, 'Tous les statuts');
  const targets = options(reportTargets, 'Toutes les cibles');
  if (type) targets.value = type;
  const results = el('div', { class: 'safety-report-stack' });
  let generation = 0;
  async function load(page = 1) {
    const current = ++generation;
    const params = new URLSearchParams({ page, limit: 20 });
    for (const [name, field] of [['module', modules], ['status', statuses], ['targetType', targets]])
      if (field.value) params.set(name, field.value);
    results.textContent = 'Chargement…';
    try {
      const { data, meta } = await apiRequest(`/reports/${scope}?${params}`, { includeMeta: true });
      if (current !== generation) return;
      results.replaceChildren(...data.map(row => card(
        el('h2', { text: reportReasons[row.reason] || row.reason }),
        value('Cible', `${reportModules[row.module] || row.module} · ${reportTargets[row.targetType] || row.targetType}`),
        value('Statut', reportStatuses[row.status] || row.status), value('Mis à jour', formatDateTime(row.updatedAt)),
        row.decisions?.[0]?.messageToUser ? value('Message de Péncmi', row.decisions[0].messageToUser) : null,
        scope === 'admin' ? link(detailHref(row.id), 'Ouvrir') : null,
      )));
      if (!data.length) results.append(el('p', { role: 'status', text: 'Aucun signalement pour ces critères.' }));
      if (meta.totalPages > 1) results.append(el('nav', { class: 'safety-actions', 'aria-label': 'Pagination' },
        page > 1 ? button('Précédent', () => load(page - 1)) : null,
        el('span', { text: `Page ${page} sur ${meta.totalPages}` }),
        page < meta.totalPages ? button('Suivant', () => load(page + 1)) : null));
    } catch (error) {
      if (current === generation) accountError(results, error, () => load(page));
    }
  }
  for (const field of [modules, statuses, targets]) field.onchange = () => load();
  root.replaceChildren(el('div', { class: 'safety-filter-row' }, label('Module', modules), label('Statut', statuses), label('Cible', targets)), results);
  return load();
}

async function renderDetail(root) {
  const id = new URLSearchParams(location.search).get('id');
  if (!id || !/^[\w-]{1,128}$/.test(id)) { root.textContent = 'Aucun signalement sélectionné.'; return; }
  const path = `/reports/admin/${encodeURIComponent(id)}`;
  root.textContent = 'Chargement…';
  try {
    const report = await apiRequest(path);
    const fields = card(el('h2', { text: 'Signalement' }),
      value('Motif', reportReasons[report.reason] || report.reason), value('Statut', reportStatuses[report.status]),
      value('Module', reportModules[report.module]), value('Type', reportTargets[report.targetType]),
      value('Identifiant de la cible', report.targetId), value('Déclarant', report.reporterUserId),
      value('Compte concerné', report.advertiserId), value('Commentaire', report.message),
      report.reportedMessage ? value(report.reportedMessage.hiddenAt ? 'Message masqué' : 'Message signalé', report.reportedMessage.body) : null);
    const history = card(el('h2', { text: 'Historique des décisions' }),
      ...report.decisions.map(decision => el('div', { class: 'safety-history-item' },
        value('Décision', reportStatuses[decision.action] || (decision.action === 'message_hidden' ? 'Message masqué' : decision.action)), value('Date', formatDateTime(decision.createdAt)),
        value('Note interne', decision.internalNote), decision.messageToUser ? value('Message transmis', decision.messageToUser) : null)));
    root.replaceChildren(fields, history);
    if (report.canHideMessage) {
      const reason = el('textarea', { required: true, rows: 3, maxLength: 1000 });
      const feedback = el('div', { role: 'status' });
      const submit = el('button', { class: 'btn btn-light', text: 'Masquer le message', type: 'submit' });
      const form = el('form', { class: 'ae-form' }, label('Motif interne du masquage', reason), submit, feedback);
      form.onsubmit = async event => {
        event.preventDefault();
        if (submit.disabled || !form.reportValidity()) return;
        submit.disabled = true;
        try {
          const result = await apiRequest(path + '/hide-message', { method: 'PATCH', body: { note: reason.value } });
          if (result?.hidden !== true) throw Error('Le masquage n’a pas été confirmé.');
          await renderDetail(root);
        } catch (error) { accountError(feedback, error); }
        finally { submit.disabled = false; }
      };
      root.insertBefore(card(form), history);
    }
    const actions = report.actions.filter(action => action !== 'correction_requested' || report.advertiserId);
    if (!actions.length) return;
    const state = options(Object.fromEntries(actions.map(action => [action, reportStatuses[action]])));
    const note = el('textarea', { rows: 3, maxLength: 1000, required: true });
    const publicMessage = el('textarea', { rows: 3, maxLength: 1000 });
    const publicLabel = label('Message au compte concerné', publicMessage);
    const sync = () => {
      publicMessage.required = state.value === 'correction_requested';
      publicLabel.hidden = !publicMessage.required;
    };
    state.onchange = sync;
    sync();
    const feedback = el('div', { role: 'status' });
    const submit = el('button', { class: 'btn btn-primary', text: 'Enregistrer la décision', type: 'submit' });
    const form = el('form', { class: 'ae-form' }, label('Nouveau statut', state), label('Note interne', note), publicLabel, submit, feedback);
    form.onsubmit = async event => {
      event.preventDefault();
      if (submit.disabled || !form.reportValidity()) return;
      submit.disabled = true;
      try {
        const result = await apiRequest(path + '/status', { method: 'PATCH', body: {
          status: state.value, note: note.value, ...(publicMessage.required ? { messageToAdvertiser: publicMessage.value } : {}),
        } });
        if (result?.status !== state.value) throw Error('La décision n’a pas été confirmée.');
        await renderDetail(root);
      } catch (error) { accountError(feedback, error); }
      finally { submit.disabled = false; }
    };
    root.insertBefore(card(el('h2', { text: 'Traiter le signalement' }), form), history);
  } catch (error) { accountError(root, error, () => renderDetail(root)); }
}

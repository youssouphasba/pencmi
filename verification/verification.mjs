// Professional verification: the professional sends documents, an admin reviews them.
// Text from the server only ever reaches the page through textContent (see el()).
import { apiRequest, el, formatDateTime } from '../messaging/messaging-ui.mjs';
import { accountError } from '../compte/account-ui.mjs';

const STATUS = {
  pending: 'En cours d’examen',
  accepted: 'Validée',
  refused: 'Refusée',
  requires_more_info: 'Correction demandée',
  cancelled: 'Annulée',
};
const ROLES = {
  advertiser_individual: 'Particulier annonceur',
  real_estate_agency: 'Agence immobilière',
  hotel_manager: 'Hôtel',
  vehicle_renter: 'Loueur de voitures',
  vehicle_dealer: 'Vendeur de voitures',
  chauffeur: 'Chauffeur',
  transport_provider: 'Transporteur',
};
const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';

const href = (path) => {
  if (window.location.protocol !== 'file:') return path;
  const prefix = '../'.repeat(Number(document.body.dataset.routeDepth || '2'));
  return `${prefix}${path.replace(/^\//, '')}`;
};
const status = (value) => el('span', { class: 'verification-status-badge', text: STATUS[value] || value });
const name = (user) =>
  user?.professionalProfile?.businessName || [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Compte';

function shell(admin, title, subtitle, content) {
  const links = admin
    ? [['Vérifications', '/admin/verification/'], ['Back-office', '/admin/']]
    : [['Vérification', '/dashboard/verification/'], ['Dashboard', '/dashboard/']];
  return el('div', { class: 'verification-shell' },
    el('aside', { class: admin ? 'admin-sidebar' : 'dashboard-sidebar' },
      el('div', { class: 'dashboard-brand' }, el('span', { text: 'P' }),
        el('div', {}, el('strong', { text: 'Péncmi' }), el('small', { text: admin ? 'Admin vérification' : 'Vérification' }))),
      el('nav', { class: admin ? 'admin-nav' : 'dashboard-nav' },
        links.map(([label, path], index) => el('a', { href: href(path), 'aria-current': index === 0 ? 'page' : null }, el('span', { text: label }))))),
    el('main', { class: 'verification-main' },
      el('header', { class: 'verification-header' }, el('div', {}, el('h1', { text: title }), el('p', { text: subtitle }))),
      content));
}

/* ---------- Professional ---------- */

function ownerForm(state, reload) {
  const message = el('p', { class: 'verification-message', role: 'status' });
  const rows = state.requiredDocuments.map((type) => ({ type, required: true }));
  const optional = el('select', { 'aria-label': 'Ajouter un document facultatif' },
    el('option', { value: '', text: 'Ajouter un document facultatif…' }),
    state.documentTypes.filter(({ type }) => !state.requiredDocuments.includes(type))
      .map(({ type, label }) => el('option', { value: type, text: label })));
  const list = el('div', { class: 'verification-section' });
  const label = (type) => state.documentTypes.find((item) => item.type === type)?.label || type;
  const field = ({ type, required }) => {
    const input = el('input', { type: 'file', accept: ACCEPT, name: type, required });
    return el('div', { class: 'document-placeholder' },
      el('label', {}, el('strong', { text: `${label(type)}${required ? ' (obligatoire)' : ''}` }), input),
      required ? null : el('button', { class: 'btn btn-ghost', type: 'button', text: 'Retirer', onClick: (event) => event.target.closest('.document-placeholder').remove() }));
  };
  rows.forEach((row) => list.append(field(row)));
  optional.addEventListener('change', () => {
    if (!optional.value) return;
    if (list.querySelectorAll('input[type=file]').length >= state.maxDocuments) {
      message.textContent = `${state.maxDocuments} documents au maximum.`;
      message.classList.add('is-visible');
    } else list.append(field({ type: optional.value, required: false }));
    optional.value = '';
  });
  const submit = el('button', { class: 'btn btn-primary', type: 'submit', text: 'Envoyer pour vérification' });
  const form = el('form', { class: 'verification-card verification-section', novalidate: true },
    el('h2', { text: 'Envoyer vos documents' }),
    el('p', { text: 'PDF, JPEG, PNG ou WebP, 5 Mo maximum par fichier. Vos documents restent privés : seule l’équipe Péncmi les consulte, et ils sont supprimés dès la décision prise.' }),
    list, el('div', { class: 'verification-actions' }, optional, submit), message);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const inputs = [...list.querySelectorAll('input[type=file]')];
    const missing = inputs.filter((input) => input.required && !input.files.length);
    const tooBig = inputs.find((input) => input.files[0]?.size > 5 * 1024 * 1024);
    message.classList.add('is-visible');
    if (missing.length) { message.textContent = `Ajoutez : ${missing.map((input) => label(input.name)).join(', ')}.`; missing[0].focus(); return; }
    if (tooBig) { message.textContent = `${label(tooBig.name)} dépasse 5 Mo.`; tooBig.focus(); return; }
    const body = new FormData();
    for (const input of inputs) if (input.files[0]) body.append(input.name, input.files[0]);
    submit.disabled = true;
    message.textContent = 'Envoi en cours…';
    try {
      await apiRequest('/verification/requests', { method: 'POST', body });
      await reload();
    } catch (error) {
      message.textContent = error.message || 'Envoi impossible. Réessayez.';
      submit.disabled = false;
    }
  });
  return form;
}

function ownerView(state, reload) {
  if (!state.eligible)
    return el('section', { class: 'verification-empty-state verification-section' },
      el('h2', { text: 'Réservé aux comptes professionnels' }),
      el('p', { text: 'La vérification concerne les annonceurs. Un compte client n’en a pas besoin.' }));
  const latest = state.latest;
  const summary = el('section', { class: 'verification-grid' },
    el('article', { class: 'verification-progress-card' }, el('h2', { text: 'Badge' }),
      el('div', { class: 'trust-score-value', text: state.verified ? 'Vérifié' : 'Non vérifié' }),
      el('p', { text: state.verified ? 'Le badge « Professionnel vérifié » apparaît sur vos annonces et votre profil.' : 'Le badge apparaît après validation de vos documents par l’équipe Péncmi.' })),
    el('article', { class: 'verification-progress-card' }, el('h2', { text: 'Dernière demande' }),
      latest ? status(latest.status) : el('div', { class: 'trust-score-value', text: 'Aucune' }),
      el('p', { text: latest ? `Envoyée le ${formatDateTime(latest.createdAt)}${latest.reviewedAt ? `, traitée le ${formatDateTime(latest.reviewedAt)}` : ''}.` : 'Vous n’avez encore envoyé aucun document.' })));
  const parts = [summary];
  if (latest) {
    parts.push(el('section', { class: 'verification-card verification-section' },
      el('h2', { text: 'Documents envoyés' }),
      el('ul', {}, latest.documents.map((document) => el('li', { text: document.label }))),
      latest.reason ? el('p', { class: 'verification-message is-visible', role: 'note', text: `Message de l’équipe Péncmi : ${latest.reason}` }) : null,
      latest.status === 'pending' ? el('p', { text: 'L’équipe examine vos documents. Vous serez notifié de la décision.' }) : null));
  }
  if (!state.verified && latest?.status !== 'pending') parts.push(ownerForm(state, reload));
  return el('div', {}, parts);
}

function mountOwner(root) {
  const target = el('section', { 'aria-live': 'polite' });
  root.replaceChildren(shell(false, 'Vérification du profil', 'Faites vérifier votre activité pour afficher le badge « Professionnel vérifié ».', target));
  const load = async () => {
    target.textContent = 'Chargement…';
    try {
      target.replaceChildren(ownerView(await apiRequest('/verification/me'), load));
    } catch (error) {
      accountError(target, error, load);
    }
  };
  return load();
}

/* ---------- Admin ---------- */

async function download(requestId, document, button) {
  button.disabled = true;
  try {
    const blob = await apiRequest(`/admin/verification/requests/${encodeURIComponent(requestId)}/documents/${encodeURIComponent(document.id)}`, { binary: true });
    const url = URL.createObjectURL(blob);
    const extension = blob.type === 'application/pdf' ? 'pdf' : blob.type.split('/')[1] || 'bin';
    const link = el('a', { href: url, download: `${document.documentType}.${extension}` });
    window.document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  } catch (error) {
    button.after(el('span', { role: 'alert', text: ` ${error.message || 'Téléchargement impossible.'}` }));
  } finally {
    button.disabled = false;
  }
}

function adminDetail(request, back) {
  const user = request.user;
  const profile = user.professionalProfile || {};
  const facts = [
    ['Professionnel', name(user)],
    ['Type de compte', ROLES[user.role] || user.role],
    ['Email', `${user.email || '—'}${user.emailVerified ? ' (vérifié)' : ''}`],
    ['Téléphone', user.phone || profile.professionalPhone || '—'],
    ['Ville', profile.city || '—'],
    ['Adresse', profile.address || '—'],
    ['Site web', profile.website || '—'],
    ['Compte créé le', formatDateTime(user.createdAt)],
    ['Statut du compte', user.status],
  ];
  const message = el('p', { class: 'verification-message', role: 'status' });
  const parts = [
    el('button', { class: 'btn btn-ghost', type: 'button', text: '← Retour à la liste', onClick: back }),
    el('section', { class: 'verification-card verification-section' },
      el('h2', { text: name(user) }), status(request.status),
      el('dl', {}, facts.flatMap(([term, value]) => [el('dt', { text: term }), el('dd', { text: value })]))),
    el('section', { class: 'verification-card verification-section' },
      el('h2', { text: 'Documents' }),
      el('ul', {}, request.documents.map((document) => el('li', {},
        el('span', { text: `${document.label} ` }),
        document.available
          ? el('button', { class: 'btn btn-light', type: 'button', text: 'Télécharger', onClick: (event) => download(request.id, document, event.currentTarget) })
          : el('em', { text: '(supprimé après décision)' })))),
      el('p', { text: 'Chaque téléchargement est journalisé. Ouvrez les fichiers avec votre lecteur habituel ; ne les transférez pas.' })),
  ];
  if (request.status === 'pending') {
    const decision = el('select', { name: 'decision', required: true },
      el('option', { value: 'accepted', text: 'Valider : afficher le badge' }),
      el('option', { value: 'requires_more_info', text: 'Demander une correction' }),
      el('option', { value: 'refused', text: 'Refuser' }));
    const reason = el('textarea', { name: 'reason', maxLength: 500, placeholder: 'Motif transmis au professionnel (obligatoire sauf validation)' });
    const submit = el('button', { class: 'btn btn-primary', type: 'submit', text: 'Enregistrer la décision' });
    const form = el('form', { class: 'verification-card verification-section verification-modal' },
      el('h2', { text: 'Décision' }), el('label', {}, 'Action', decision), el('label', {}, 'Motif', reason),
      el('div', { class: 'verification-actions' }, submit), message);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      message.classList.add('is-visible');
      if (decision.value !== 'accepted' && !reason.value.trim()) { message.textContent = 'Indiquez le motif au professionnel.'; reason.focus(); return; }
      submit.disabled = true;
      message.textContent = 'Enregistrement…';
      try {
        await apiRequest(`/admin/verification/requests/${encodeURIComponent(request.id)}`, {
          method: 'PATCH', body: { decision: decision.value, reason: reason.value.trim() || undefined },
        });
        back();
      } catch (error) {
        message.textContent = error.message || 'Enregistrement impossible.';
        submit.disabled = false;
      }
    });
    parts.push(form);
  } else if (request.status === 'accepted' && user.professionalVerified) {
    const reason = el('textarea', { name: 'reason', maxLength: 500, required: true, placeholder: 'Motif transmis au professionnel' });
    const submit = el('button', { class: 'btn btn-light', type: 'submit', text: 'Retirer le badge' });
    const form = el('form', { class: 'verification-card verification-section verification-modal' },
      el('h2', { text: 'Retirer le badge' }), el('label', {}, 'Motif', reason), el('div', { class: 'verification-actions' }, submit), message);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      message.classList.add('is-visible');
      if (!reason.value.trim()) { message.textContent = 'Indiquez le motif.'; reason.focus(); return; }
      submit.disabled = true;
      try {
        await apiRequest(`/admin/verification/users/${encodeURIComponent(user.id)}/revoke`, { method: 'POST', body: { reason: reason.value.trim() } });
        back();
      } catch (error) {
        message.textContent = error.message || 'Retrait impossible.';
        submit.disabled = false;
      }
    });
    parts.push(form);
  }
  if (request.reason) parts.push(el('p', { class: 'verification-message is-visible', role: 'note', text: `Motif enregistré : ${request.reason}` }));
  return el('div', {}, parts);
}

function mountAdmin(root) {
  const target = el('section', { 'aria-live': 'polite' });
  const filter = el('select', { 'aria-label': 'Statut' }, Object.entries(STATUS).map(([value, text]) => el('option', { value, text })));
  root.replaceChildren(shell(true, 'Vérifications', 'Examinez les documents des professionnels et décidez de leur badge.',
    el('div', {}, el('section', { class: 'verification-filter-row' }, el('label', {}, 'Statut', filter)), target)));
  const list = async (page = 1) => {
    target.textContent = 'Chargement…';
    try {
      const { data, meta } = await apiRequest(`/admin/verification/requests?status=${filter.value}&page=${page}&limit=20`, { includeMeta: true });
      if (!data.length) { target.replaceChildren(el('p', { class: 'verification-empty-state verification-section', role: 'status', text: 'Aucune demande dans cette catégorie.' })); return; }
      const nav = meta.totalPages > 1 ? el('nav', { class: 'verification-actions', 'aria-label': 'Pagination' },
        page > 1 ? el('button', { class: 'btn btn-light', type: 'button', text: 'Précédent', onClick: () => list(page - 1) }) : null,
        el('span', { text: `Page ${page} sur ${meta.totalPages}` }),
        page < meta.totalPages ? el('button', { class: 'btn btn-light', type: 'button', text: 'Suivant', onClick: () => list(page + 1) }) : null) : null;
      target.replaceChildren(el('section', { class: 'verification-table-shell verification-section' }, el('div', { class: 'verification-scroll' },
        el('table', { class: 'verification-table' },
          el('thead', {}, el('tr', {}, ['Professionnel', 'Type', 'Documents', 'Envoyée le', ''].map((text) => el('th', { scope: 'col', text })))),
          el('tbody', {}, data.map((row) => el('tr', {},
            el('td', { text: name(row.user) }), el('td', { text: ROLES[row.user?.role] || row.user?.role || '' }),
            el('td', { text: String(row.documentCount) }), el('td', { text: formatDateTime(row.createdAt) }),
            el('td', {}, el('button', { class: 'btn btn-light', type: 'button', text: 'Examiner', onClick: () => open(row.id, page) })))))))), nav);
    } catch (error) {
      accountError(target, error, () => list(page));
    }
  };
  const open = async (id, page) => {
    target.textContent = 'Chargement…';
    try {
      target.replaceChildren(adminDetail(await apiRequest(`/admin/verification/requests/${encodeURIComponent(id)}`), () => list(page)));
      target.querySelector('h2')?.focus?.();
    } catch (error) {
      accountError(target, error, () => open(id, page));
    }
  };
  filter.addEventListener('change', () => list(1));
  return list(1);
}

const root = document.querySelector('#verification-root');
if (root) {
  const page = document.body.dataset.verificationPage || 'dashboard';
  void (page.startsWith('admin') ? mountAdmin(root) : mountOwner(root));
}

// Public content pages and their administration. Text from the server or the admin only
// reaches the page through textContent (el()), never as HTML.
import { apiRequest, el, formatDateTime } from '../messaging/messaging-ui.mjs';
import { accountError } from '../compte/account-ui.mjs';
import { getPublicationApiBase } from '../publier/real-estate-api.mjs';
import { DEFAULT_FAQ, DEFAULT_PAGES, FAQ_CATEGORY_LABELS, PAGE_ACTIONS, PAGE_SLUGS } from './content-defaults.mjs';

const FOOTER = [
  ['Conditions d’utilisation', '/conditions'], ['Confidentialité', '/confidentialite'], ['Mentions légales', '/mentions-legales'],
  ['Aide', '/aide'], ['Contact', '/contact'], ['Sécurité', '/securite'], ['Règles de publication', '/regles-publication'],
  ['Conseils anti-arnaque', '/conseils-anti-arnaque'],
];
const PAGE_NAMES = {
  conditions: 'Conditions d’utilisation', confidentialite: 'Politique de confidentialité', 'mentions-legales': 'Mentions légales',
  securite: 'Conseils de sécurité', 'regles-publication': 'Règles de publication', 'conseils-anti-arnaque': 'Conseils anti-arnaque',
};
const ADMIN_PAGE_SLUG = { adminSecurityTips: 'securite', adminPublishingRules: 'regles-publication', adminAntiScam: 'conseils-anti-arnaque' };

const href = (path) => {
  if (window.location.protocol !== 'file:') return path;
  const prefix = '../'.repeat(Number(document.body.dataset.routeDepth || '1'));
  return path === '/' ? `${prefix}index.html` : `${prefix}${path.replace(/^\//, '')}/`;
};
const anchor = (text) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function publicGet(path) {
  const base = getPublicationApiBase();
  if (!base) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${base}${path}`, { signal: controller.signal });
    if (!response.ok) return null;
    return (await response.json())?.data ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Paragraphs are separated by a blank line; lines starting with "- " form a list. */
export function renderBody(body = '') {
  return body.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean).map((block) => {
    const lines = block.split('\n').map((line) => line.trim());
    return lines.every((line) => line.startsWith('- '))
      ? el('ul', {}, lines.map((line) => el('li', { text: line.slice(2) })))
      : el('p', { text: lines.join(' ') });
  });
}

function header() {
  return el('header', { class: 'content-header' },
    el('a', { class: 'brand', href: href('/'), 'aria-label': 'Accueil Péncmi' },
      el('span', { class: 'brand-mark', text: 'P' }), el('span', {}, el('strong', { text: 'Péncmi' }), el('small', { text: 'Informations et aide' }))));
}
const footer = () => el('footer', { class: 'content-footer' }, el('div', { class: 'content-actions' }, FOOTER.map(([text, path]) => el('a', { href: href(path), text }))));
const publicShell = (...main) => [header(), el('main', { class: 'content-main' }, main), footer()];
const hero = (title, subtitle) => el('section', { class: 'content-hero' }, el('h1', { text: title }), subtitle ? el('p', { text: subtitle }) : null);

async function mountPublicPage(root, slug) {
  const fallback = DEFAULT_PAGES[slug];
  const page = (await publicGet(`/content/pages/${slug}`)) || fallback;
  const sections = page.sections || [];
  const action = PAGE_ACTIONS[slug];
  document.title = `${page.title} - Péncmi`;
  root.replaceChildren(...publicShell(
    hero(page.title, page.subtitle),
    el('div', { class: 'legal-layout' },
      el('aside', { class: 'legal-toc' }, el('strong', { text: 'Sommaire' }),
        el('nav', { 'aria-label': 'Sommaire' }, sections.map((section) => el('a', { href: `#${anchor(section.heading)}`, text: section.heading })))),
      el('div', { class: 'content-section-list' },
        page === fallback && fallback.warning ? el('div', { class: 'content-warning', role: 'note', text: fallback.warning }) : null,
        sections.map((section) => el('section', { class: 'content-card', id: anchor(section.heading) }, el('h2', { text: section.heading }), renderBody(section.body))),
        action ? el('div', { class: 'content-actions' }, el('a', { class: 'btn btn-primary', href: href(action.href), text: action.label })) : null)),
  ));
}

async function mountHelp(root) {
  const items = (await publicGet('/content/faq')) || DEFAULT_FAQ;
  const search = el('input', { type: 'search', placeholder: 'Rechercher une question…', 'aria-label': 'Rechercher dans l’aide' });
  const results = el('div', { 'aria-live': 'polite' });
  const normalize = (text) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const draw = () => {
    const query = normalize(search.value.trim());
    const matches = items.filter((item) => !query || normalize(`${item.question} ${item.answer}`).includes(query));
    const groups = Object.entries(FAQ_CATEGORY_LABELS).map(([key, label]) => [label, matches.filter((item) => (item.category || 'other') === key)])
      .concat([['Autres questions', matches.filter((item) => !FAQ_CATEGORY_LABELS[item.category])]])
      .filter(([, list]) => list.length);
    results.replaceChildren(...(groups.length ? groups.map(([label, list]) => el('section', { class: 'content-card' },
      el('h2', { text: label }), list.map((item) => el('details', {}, el('summary', { text: item.question }), renderBody(item.answer)))))
      : [el('p', { class: 'content-card', role: 'status', text: 'Aucune question ne correspond. Écrivez-nous depuis la page Contact.' })]));
  };
  search.addEventListener('input', draw);
  root.replaceChildren(...publicShell(
    hero('Comment pouvons-nous vous aider ?', 'Trouvez rapidement une réponse selon votre besoin.'),
    el('section', { class: 'content-card help-search' }, el('label', { class: 'content-field' }, el('span', { text: 'Recherche' }), search)),
    results,
    el('div', { class: 'content-actions' }, el('a', { class: 'btn btn-primary', href: href('/contact'), text: 'Contacter l’équipe' })),
  ));
  draw();
}

async function mountSupport(root, title, subtitle) {
  const target = el('section', { class: 'content-card' });
  root.replaceChildren(...publicShell(hero(title, subtitle), target));
  const { mountAccountSupport } = await import('../compte/account-support.mjs');
  mountAccountSupport(target);
}

/* ---------- Admin ---------- */

function adminShell(current, title, subtitle, content) {
  const nav = [['Contenus', '/admin/content/', 'adminContent'], ['Pages', '/admin/content/pages/', 'adminPages'], ['FAQ', '/admin/content/faq/', 'adminFaq'], ['Back-office', '/admin/', 'admin']];
  return el('div', { class: 'content-admin-shell' },
    el('aside', { class: 'admin-sidebar' },
      el('div', { class: 'dashboard-brand' }, el('span', { text: 'P' }), el('div', {}, el('strong', { text: 'Péncmi' }), el('small', { text: 'Admin contenus' }))),
      el('nav', { class: 'admin-nav' }, nav.map(([text, path, key]) => el('a', { href: href(path), 'aria-current': key === current ? 'page' : null }, el('span', { text }))))),
    el('main', { class: 'content-admin-main' },
      el('header', { class: 'content-admin-header' }, el('div', {}, el('h1', { text: title }), subtitle ? el('p', { text: subtitle }) : null)),
      content));
}

function mountAdminPages(root, current) {
  const target = el('section', { 'aria-live': 'polite' });
  root.replaceChildren(adminShell(current, current === 'adminContent' ? 'Contenus' : 'Pages publiques',
    'Modifiez les textes du site sans toucher au code. Tant qu’une page n’est pas publiée ici, le site affiche son texte par défaut.', target));
  const load = async () => {
    target.textContent = 'Chargement…';
    try {
      const pages = await apiRequest('/admin/content/pages');
      const faq = current === 'adminContent' ? await apiRequest('/admin/content/faq') : null;
      target.replaceChildren(el('div', { class: 'content-table-shell' }, el('div', { class: 'content-scroll' },
        el('table', { class: 'content-table' },
          el('thead', {}, el('tr', {}, ['Page', 'État', 'Modifiée le', ''].map((text) => el('th', { scope: 'col', text })))),
          el('tbody', {}, pages.map((page) => el('tr', {},
            el('td', { text: PAGE_NAMES[page.slug] || page.slug }),
            el('td', { text: !page.saved ? 'Texte par défaut' : page.status === 'active' ? 'Publiée' : 'Brouillon (texte par défaut en ligne)' }),
            el('td', { text: page.updatedAt ? formatDateTime(page.updatedAt) : '—' }),
            el('td', {}, el('a', { class: 'btn btn-light', href: `${href('/admin/content/pages/edit/')}?slug=${encodeURIComponent(page.slug)}`, text: 'Modifier' })))))))),
        faq ? el('p', { class: 'content-card' }, `FAQ : ${faq.length} question(s) enregistrée(s)${faq.length ? '' : ', le centre d’aide affiche les questions par défaut'}. `,
          el('a', { href: href('/admin/content/faq/'), text: 'Gérer la FAQ' })) : null);
    } catch (error) { accountError(target, error, load); }
  };
  return load();
}

function sectionEditor(section = { heading: '', body: '' }) {
  const row = el('fieldset', { class: 'content-card admin-editor' },
    el('legend', { text: 'Section' }),
    el('label', { class: 'content-field' }, el('span', { text: 'Titre de la section' }), el('input', { name: 'heading', value: section.heading, maxLength: 160, required: true })),
    el('label', { class: 'content-field' }, el('span', { text: 'Texte (ligne vide = nouveau paragraphe, « - » en début de ligne = liste)' }),
      el('textarea', { name: 'body', rows: 6, maxLength: 8000, value: section.body })));
  const move = (delta) => {
    const sibling = delta < 0 ? row.previousElementSibling : row.nextElementSibling;
    if (sibling) delta < 0 ? sibling.before(row) : sibling.after(row);
  };
  row.append(el('div', { class: 'content-actions' },
    el('button', { class: 'btn btn-ghost', type: 'button', text: 'Monter', onClick: () => move(-1) }),
    el('button', { class: 'btn btn-ghost', type: 'button', text: 'Descendre', onClick: () => move(1) }),
    el('button', { class: 'btn btn-ghost', type: 'button', text: 'Supprimer la section', onClick: () => row.remove() })));
  return row;
}

function mountPageEditor(root, current, slug) {
  const target = el('section', { 'aria-live': 'polite' });
  root.replaceChildren(adminShell(current, `Modifier : ${PAGE_NAMES[slug] || slug}`, 'Enregistrez en brouillon pour préparer, publiez pour mettre en ligne. Chaque enregistrement garde la version précédente.', target));
  if (!PAGE_NAMES[slug]) { target.replaceChildren(el('p', { role: 'alert', text: 'Page inconnue.' })); return; }
  const fill = (page, saved) => {
    const title = el('input', { name: 'title', value: page.title || '', maxLength: 160, required: true });
    const subtitle = el('input', { name: 'subtitle', value: page.subtitle || '', maxLength: 400 });
    const sections = el('div', {}, (page.sections || []).map((section) => sectionEditor(section)));
    const message = el('p', { class: 'content-message', role: 'status' });
    const submitWith = async (status) => {
      const body = {
        title: title.value.trim(), subtitle: subtitle.value.trim() || undefined, status,
        sections: [...sections.querySelectorAll('fieldset')].map((row) => ({ heading: row.querySelector('[name=heading]').value.trim(), body: row.querySelector('[name=body]').value.trim() })),
      };
      message.classList.add('is-visible');
      const empty = [...sections.querySelectorAll('[name=heading]')].find((input) => !input.value.trim());
      if (!body.title) { message.textContent = 'Le titre est obligatoire.'; title.focus(); return; }
      if (empty) { message.textContent = 'Chaque section doit avoir un titre.'; empty.focus(); return; }
      message.textContent = 'Enregistrement…';
      try {
        await apiRequest(`/admin/content/pages/${slug}`, { method: 'PUT', body });
        await load(status === 'active' ? 'Page publiée : elle est en ligne.' : 'Brouillon enregistré. Le site affiche toujours la version publiée ou le texte par défaut.');
      } catch (error) { message.textContent = error.message || 'Enregistrement impossible.'; }
    };
    const versions = saved?.versions?.length ? el('section', { class: 'content-card' }, el('h2', { text: 'Versions précédentes' }),
      el('ul', {}, saved.versions.map((version) => el('li', {}, `${formatDateTime(version.createdAt)} — ${version.title} `,
        el('button', { class: 'btn btn-ghost', type: 'button', text: 'Charger dans l’éditeur', onClick: async (event) => {
          event.currentTarget.disabled = true;
          try { fill(await apiRequest(`/admin/content/pages/${slug}/versions/${encodeURIComponent(version.id)}`), saved); message.classList.add('is-visible'); }
          catch (error) { event.currentTarget.after(el('span', { role: 'alert', text: ` ${error.message}` })); }
        } }))))) : null;
    const form = el('form', { class: 'content-form' },
      el('p', { class: 'content-card', text: saved ? `État : ${saved.status === 'active' ? 'publiée' : 'brouillon'}, modifiée le ${formatDateTime(saved.updatedAt)}.` : 'Cette page n’a jamais été enregistrée : l’éditeur part du texte par défaut affiché sur le site.' }),
      el('label', { class: 'content-field' }, el('span', { text: 'Titre de la page' }), title),
      el('label', { class: 'content-field' }, el('span', { text: 'Sous-titre' }), subtitle),
      sections,
      el('div', { class: 'content-actions' },
        el('button', { class: 'btn btn-light', type: 'button', text: 'Ajouter une section', onClick: () => { const row = sectionEditor(); sections.append(row); row.querySelector('input').focus(); } }),
        el('button', { class: 'btn btn-light', type: 'button', text: 'Enregistrer en brouillon', onClick: () => submitWith('draft') }),
        el('button', { class: 'btn btn-primary', type: 'submit', text: 'Publier' }),
        el('a', { class: 'btn btn-ghost', href: href(`/${slug}`), target: '_blank', rel: 'noopener', text: 'Voir la page' })),
      message);
    form.addEventListener('submit', (event) => { event.preventDefault(); void submitWith('active'); });
    target.replaceChildren(form, versions || '');
    return message;
  };
  const load = async (notice) => {
    target.textContent = 'Chargement…';
    try {
      // The helper returns the whole envelope when data is null: a page never saved has no slug.
      const response = await apiRequest(`/admin/content/pages/${slug}`);
      const saved = response?.slug ? response : null;
      const message = fill(saved || DEFAULT_PAGES[slug], saved);
      if (notice) { message.textContent = notice; message.classList.add('is-visible'); }
    } catch (error) { accountError(target, error, () => load()); }
  };
  return load();
}

function mountFaqAdmin(root) {
  const target = el('section', { 'aria-live': 'polite' });
  root.replaceChildren(adminShell('adminFaq', 'FAQ du centre d’aide', 'Tant qu’aucune question n’est enregistrée, le centre d’aide affiche les questions par défaut.', target));
  const categories = (value) => el('select', { name: 'category' }, el('option', { value: '', text: 'Sans catégorie' }),
    Object.entries(FAQ_CATEGORY_LABELS).map(([key, label]) => el('option', { value: key, text: label, selected: key === value })));
  const editor = (item, onDone) => {
    const question = el('input', { name: 'question', value: item?.question || '', maxLength: 300, required: true });
    const answer = el('textarea', { name: 'answer', rows: 4, maxLength: 4000, value: item?.answer || '' });
    const category = categories(item?.category);
    const position = el('input', { name: 'position', type: 'number', min: 0, max: 10000, value: String(item?.position ?? 0) });
    const active = el('input', { name: 'active', type: 'checkbox', checked: item ? item.active : true });
    const message = el('p', { class: 'content-message', role: 'status' });
    const form = el('form', { class: 'content-card admin-editor' },
      el('h2', { text: item ? 'Modifier la question' : 'Nouvelle question' }),
      el('label', { class: 'content-field' }, el('span', { text: 'Question' }), question),
      el('label', { class: 'content-field' }, el('span', { text: 'Réponse' }), answer),
      el('label', { class: 'content-field' }, el('span', { text: 'Catégorie' }), category),
      el('label', { class: 'content-field' }, el('span', { text: 'Ordre d’affichage' }), position),
      el('label', {}, active, ' Visible dans le centre d’aide'),
      el('div', { class: 'content-actions' },
        el('button', { class: 'btn btn-primary', type: 'submit', text: 'Enregistrer' }),
        item ? el('button', { class: 'btn btn-ghost', type: 'button', text: 'Annuler', onClick: () => onDone() }) : null),
      message);
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      message.classList.add('is-visible');
      if (question.value.trim().length < 3 || !answer.value.trim()) { message.textContent = 'La question et la réponse sont obligatoires.'; question.focus(); return; }
      try {
        await apiRequest(item ? `/admin/content/faq/${encodeURIComponent(item.id)}` : '/admin/content/faq', {
          method: item ? 'PATCH' : 'POST',
          body: { question: question.value.trim(), answer: answer.value.trim(), category: category.value || undefined, position: Number(position.value) || 0, active: active.checked },
        });
        onDone(item ? 'Question modifiée.' : 'Question ajoutée.');
      } catch (error) { message.textContent = error.message || 'Enregistrement impossible.'; }
    });
    return form;
  };
  const load = async (notice) => {
    target.textContent = 'Chargement…';
    try {
      const items = await apiRequest('/admin/content/faq');
      const status = el('p', { class: 'content-message is-visible', role: 'status', text: notice || '' });
      const importDefaults = !items.length ? el('button', { class: 'btn btn-light', type: 'button', text: 'Partir des questions par défaut', onClick: async (event) => {
        event.currentTarget.disabled = true;
        try {
          for (const [position, item] of DEFAULT_FAQ.entries()) await apiRequest('/admin/content/faq', { method: 'POST', body: { ...item, position: position * 10, active: true } });
          await load(`${DEFAULT_FAQ.length} questions importées.`);
        } catch (error) { status.textContent = error.message || 'Import interrompu.'; await load(status.textContent); }
      } }) : null;
      const list = el('div', {}, items.map((item) => {
        const card = el('article', { class: 'content-card' },
          el('h2', { text: item.question }),
          el('p', { text: `${FAQ_CATEGORY_LABELS[item.category] || 'Sans catégorie'} · ordre ${item.position} · ${item.active ? 'visible' : 'masquée'}` }),
          renderBody(item.answer),
          el('div', { class: 'content-actions' },
            el('button', { class: 'btn btn-light', type: 'button', text: 'Modifier', onClick: () => card.replaceWith(editor(item, load)) }),
            el('button', { class: 'btn btn-ghost', type: 'button', text: 'Supprimer', onClick: async () => {
              if (!window.confirm('Supprimer cette question ?')) return;
              try { await apiRequest(`/admin/content/faq/${encodeURIComponent(item.id)}`, { method: 'DELETE' }); await load('Question supprimée.'); }
              catch (error) { status.textContent = error.message || 'Suppression impossible.'; }
            } })));
        return card;
      }));
      target.replaceChildren(status, importDefaults || '', editor(null, load), list);
    } catch (error) { accountError(target, error, () => load()); }
  };
  return load();
}

const root = document.querySelector('#content-root');
if (root) {
  const page = document.body.dataset.contentPage || 'help';
  const params = new URLSearchParams(window.location.search);
  if (PAGE_SLUGS[page]) void mountPublicPage(root, PAGE_SLUGS[page]);
  else if (page === 'help') void mountHelp(root);
  else if (page === 'contact') void mountSupport(root, 'Contacter Péncmi', 'Envoyez-nous votre demande, notre équipe vous répondra dès que possible.');
  else if (page === 'support' || page === 'supportDetail') void mountSupport(root, 'Support', 'Suivez vos demandes envoyées à l’équipe Péncmi.');
  else if (page === 'adminFaq') void mountFaqAdmin(root);
  else if (page === 'adminPageEdit') void mountPageEditor(root, 'adminPages', params.get('slug') || '');
  else if (ADMIN_PAGE_SLUG[page]) void mountPageEditor(root, 'adminPages', ADMIN_PAGE_SLUG[page]);
  else void mountAdminPages(root, page === 'adminPages' ? 'adminPages' : 'adminContent');
}

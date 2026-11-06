import { apiRequest, ensureStyles, el, formatDateTime, loginHref, messageForm, messageList, hasSession } from './messaging-ui.mjs';

const MODULE_LABELS = { real_estate: 'Immobilier', hotels: 'Hôtels', vehicles: 'Voitures', trips: 'Voyages' };
const PAGE_SIZE = 20;

/** A real inbox over the shared API: `owner` is one universe of an advertiser, `participant` a client's whole inbox. */
export function mountInbox(root, { scope = 'owner', module, emptyTitle = 'Aucune conversation pour le moment.', emptyText = '' }) {
  ensureStyles();
  if (!hasSession()) {
    root.replaceChildren(el('section', { class: 'pm-panel' }, el('p', { text: 'Connectez-vous pour voir vos messages.' }), el('a', { class: 'btn btn-primary', href: loginHref(), text: 'Se connecter' })));
    return;
  }
  const state = { page: 1, q: '', moduleFilter: module || '', conversation: null, totalPages: 1, total: 0 };
  const list = el('div', { class: 'pm-list', 'aria-live': 'polite' });
  const thread = el('section', { class: 'pm-thread', 'aria-label': 'Conversation' });
  const inbox = el('div', { class: 'pm-inbox' }, el('div', { class: 'pm-list-pane' },
    el('form', { class: 'pm-filters', role: 'search', onSubmit: (event) => {
      event.preventDefault();
      state.q = new FormData(event.currentTarget).get('q')?.toString().trim() || '';
      state.page = 1;
      void loadList();
    } },
    scope === 'owner'
      ? [el('label', { class: 'pm-field' }, el('span', { text: 'Rechercher une annonce' }), el('input', { type: 'search', name: 'q', maxLength: 120 })), el('button', { class: 'btn btn-light', type: 'submit', text: 'Rechercher' })]
      : el('label', { class: 'pm-field' }, el('span', { text: 'Univers' }), el('select', { name: 'module', onChange: (event) => {
        state.moduleFilter = event.currentTarget.value;
        state.page = 1;
        void loadList();
      } }, el('option', { value: '', text: 'Tous' }), Object.entries(MODULE_LABELS).map(([value, text]) => el('option', { value, text }))))),
    list), thread);
  root.replaceChildren(inbox);

  const showThread = (visible) => inbox.classList.toggle('is-reading', visible);

  async function loadList() {
    list.replaceChildren(el('p', { class: 'pm-muted', text: 'Chargement des conversations…' }));
    const query = new URLSearchParams({ page: String(state.page), limit: String(PAGE_SIZE) });
    if (scope === 'owner') query.set('scope', 'owner');
    if (state.moduleFilter) query.set('module', state.moduleFilter);
    if (state.q) query.set('q', state.q);
    try {
      const result = await apiRequest(`/messages/conversations?${query}`, { includeMeta: true });
      state.totalPages = result.meta?.totalPages || 1;
      state.total = result.meta?.total ?? result.data.length;
      drawList(result.data);
    } catch (error) {
      list.replaceChildren(el('div', { class: 'pm-panel', role: 'alert' }, el('p', { text: error.message || 'Chargement impossible.' }),
        el('button', { class: 'btn btn-light', type: 'button', text: 'Réessayer', onClick: () => void loadList() })));
    }
  }

  function drawList(rows) {
    if (!rows.length) {
      list.replaceChildren(el('div', { class: 'pm-panel' }, el('h2', { text: state.q ? 'Aucune conversation pour cette recherche.' : emptyTitle }), emptyText && !state.q ? el('p', { class: 'pm-muted', text: emptyText }) : null));
      return;
    }
    list.replaceChildren(
      el('p', { class: 'pm-muted', text: `${state.total} conversation${state.total > 1 ? 's' : ''}` }),
      el('ul', { class: 'pm-conversations' }, rows.map((row) => el('li', {}, el('button', {
        class: `pm-conversation${row.id === state.conversation?.id ? ' is-active' : ''}`,
        type: 'button',
        'aria-current': row.id === state.conversation?.id ? 'true' : undefined,
        onClick: () => void openConversation(row.id),
      },
      el('span', { class: 'pm-conversation-title', text: row.listingTitle || 'Annonce indisponible' }),
      el('span', { class: 'pm-muted', text: [row.counterpartName, scope === 'owner' ? '' : MODULE_LABELS[row.module]].filter(Boolean).join(' · ') }),
      el('span', { class: 'pm-preview', text: row.messages?.[0]?.body || 'Aucun message' }),
      el('span', { class: 'pm-conversation-meta' }, el('small', { text: formatDateTime(row.messages?.[0]?.createdAt || row.updatedAt) }),
        row.unreadCount ? el('span', { class: 'pm-unread', text: `${row.unreadCount} non lu${row.unreadCount > 1 ? 's' : ''}` }) : null))))),
      state.totalPages > 1 ? el('nav', { class: 'pm-pagination', 'aria-label': 'Pages de conversations' },
        el('button', { class: 'btn btn-light', type: 'button', text: 'Précédent', disabled: state.page <= 1, onClick: () => { state.page -= 1; void loadList(); } }),
        el('span', { text: `Page ${state.page} sur ${state.totalPages}` }),
        el('button', { class: 'btn btn-light', type: 'button', text: 'Suivant', disabled: state.page >= state.totalPages, onClick: () => { state.page += 1; void loadList(); } })) : null,
    );
  }

  async function openConversation(id) {
    showThread(true);
    thread.replaceChildren(el('p', { class: 'pm-muted', text: 'Chargement de la conversation…' }));
    try {
      state.conversation = await apiRequest(`/messages/conversations/${encodeURIComponent(id)}`);
    } catch (error) {
      thread.replaceChildren(el('div', { class: 'pm-panel', role: 'alert' }, el('p', { text: error.message || 'Conversation indisponible.' }),
        el('button', { class: 'btn btn-light', type: 'button', text: 'Réessayer', onClick: () => void openConversation(id) })));
      return;
    }
    drawThread();
    // Read state follows the API: if this fails, the conversation simply stays unread.
    const read = await apiRequest(`/messages/conversations/${encodeURIComponent(id)}/read`, { method: 'PATCH' }).then(() => true, () => false);
    if (read) await loadList();
  }

  async function loadOlder() {
    const conversation = state.conversation;
    const older = await apiRequest(`/messages/conversations/${encodeURIComponent(conversation.id)}?before=${encodeURIComponent(conversation.messages[0].id)}`);
    conversation.messages = [...older.messages, ...conversation.messages];
    conversation.hasOlderMessages = older.hasOlderMessages;
    drawThread();
  }

  function drawThread() {
    const conversation = state.conversation;
    const form = messageForm({
      label: 'Votre réponse',
      send: async (body, requestId) => {
        const message = await apiRequest(`/messages/conversations/${encodeURIComponent(conversation.id)}/messages`, { method: 'POST', body: { body, requestId } });
        if (!conversation.messages.some((row) => row.id === message.id)) conversation.messages.push({ ...message, mine: true });
        thread.querySelector('.pm-messages-wrap').replaceChildren(messageList(conversation.messages, { hasOlder: conversation.hasOlderMessages, onOlder: () => void loadOlder() }));
        await loadList();
      },
    });
    thread.replaceChildren(
      el('div', { class: 'pm-thread-head' },
        el('button', { class: 'btn btn-ghost pm-back', type: 'button', text: 'Retour à la liste', onClick: () => showThread(false) }),
        el('div', {}, el('h2', { text: conversation.listingTitle || 'Annonce indisponible' }), conversation.counterpartName ? el('p', { class: 'pm-muted', text: conversation.counterpartName }) : null)),
      el('div', { class: 'pm-messages-wrap' }, messageList(conversation.messages, { hasOlder: conversation.hasOlderMessages, onOlder: () => void loadOlder() })),
      form,
    );
  }

  thread.replaceChildren(el('p', { class: 'pm-muted pm-thread-empty', text: 'Sélectionnez une conversation pour la lire et répondre.' }));
  void loadList();
  const linked = new URLSearchParams(window.location.search).get('conversation');
  if (linked) void openConversation(linked);
}

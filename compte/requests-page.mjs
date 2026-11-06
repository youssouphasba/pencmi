import {
  apiRequest,
  hasSession,
  loginHref,
  el,
  ensureStyles,
  formatDateTime,
} from '../messaging/messaging-ui.mjs';
import {
  requestTypes,
  requestStatuses,
  requestFields,
} from './request-copy.mjs';

const safeLink = (value) =>
  typeof value === 'string' && /^\/(?![\/\\])[^\\]*$/.test(value);
const dateFields = new Set([
  'checkIn',
  'checkOut',
  'preferredDate',
  'startDate',
  'endDate',
  'serviceDate',
  'departureDate',
]);
function valueText(key, value) {
  if (key === 'departureAt') return formatDateTime(value);
  if (dateFields.has(key))
    return new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Africa/Dakar',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(value));
  if (key === 'quotedPricePerSeat')
    return `${Number(value).toLocaleString('fr-FR')} FCFA`;
  return typeof value === 'boolean' ? (value ? 'Oui' : 'Non') : String(value);
}

function errorView(root, error, retry) {
  const expired = error?.status === 401 || !hasSession();
  root.replaceChildren(
    el(
      'section',
      { class: 'pm-panel', role: 'alert' },
      el('p', {
        text: expired
          ? 'Connectez-vous pour consulter vos demandes. Votre session a peut-être expiré.'
          : error?.status === 404
            ? 'Cette demande n’est pas disponible dans votre compte.'
            : error?.message || 'Chargement impossible. Réessayez.',
      }),
      expired
        ? el('a', {
            class: 'btn btn-primary',
            href: loginHref(),
            text: 'Se connecter',
          })
        : el('button', {
            class: 'btn btn-light',
            type: 'button',
            text: 'Réessayer',
            onClick: retry,
          }),
    ),
  );
}

function facts(request) {
  const details = request.details || {};
  const entries = Object.entries(details).filter(
    ([key, value]) =>
      value !== null &&
      value !== undefined &&
      value !== '' &&
      requestFields[key] &&
      !(
        details.departureAt && ['departureDate', 'departureTime'].includes(key)
      ),
  );
  return el(
    'dl',
    { class: 'cr-facts' },
    entries.map(([key, value]) =>
      el(
        'div',
        {},
        el('dt', { text: requestFields[key] }),
        el('dd', { text: valueText(key, value) }),
      ),
    ),
  );
}

function card(request, full) {
  return el(
    'article',
    { class: 'cr-request' },
    el(
      'header',
      {},
      el('h2', { text: request.listing.title }),
      el('span', {
        class: 'client-status-badge',
        text: requestStatuses[request.status] || 'Statut non reconnu',
      }),
    ),
    el('p', {
      class: 'pm-muted',
      text: `Envoyée le ${formatDateTime(request.createdAt)}`,
    }),
    facts(request),
    full
      ? el(
          'section',
          {},
          el('h3', { text: 'Votre demande' }),
          el('p', { text: request.message || 'Aucun message complémentaire.' }),
          el(
            'dl',
            { class: 'cr-facts' },
            [
              ['Nom', request.contact?.name],
              ['Téléphone', request.contact?.phone],
              ['Email', request.contact?.email],
            ]
              .filter(([, value]) => value)
              .map(([label, value]) =>
                el(
                  'div',
                  {},
                  el('dt', { text: label }),
                  el('dd', { text: value }),
                ),
              ),
          ),
          el('p', {
            class: 'pm-muted',
            text: `Dernière mise à jour : ${formatDateTime(request.updatedAt)}`,
          }),
        )
      : null,
    el(
      'div',
      { class: 'client-actions' },
      !full && safeLink(request.detailUrl)
        ? el('a', {
            class: 'btn btn-primary',
            href: request.detailUrl,
            text: 'Voir la demande',
          })
        : null,
      safeLink(request.listing.url)
        ? el('a', {
            class: 'btn btn-light',
            href: request.listing.url,
            text: 'Voir l’annonce',
          })
        : el('span', {
            class: 'pm-muted',
            text: 'La fiche publique n’est plus disponible.',
          }),
      full && safeLink(request.conversationUrl)
        ? el('a', {
            class: 'btn btn-light',
            href: request.conversationUrl,
            text: 'Ouvrir la conversation',
          })
        : null,
    ),
  );
}

export function mountClientRequests(root, type) {
  ensureStyles();
  const config = requestTypes[type];
  if (!config) return;
  let page = Math.max(
    1,
    Number(new URLSearchParams(location.search).get('page')) || 1,
  );
  const id = new URLSearchParams(location.search).get('id');
  let busy = false;
  async function load() {
    if (busy) return;
    if (!hasSession()) return errorView(root, null, load);
    busy = true;
    root.replaceChildren(
      el('p', { role: 'status', text: 'Chargement de vos demandes…' }),
    );
    try {
      if (id) {
        const request = await apiRequest(
          `/compte/requests/${type}/${encodeURIComponent(id)}`,
        );
        root.replaceChildren(
          el('a', {
            class: 'btn btn-light',
            href: `/compte/${config.page}/`,
            text: 'Toutes mes demandes',
          }),
          card(request, true),
        );
      } else {
        const result = await apiRequest(
          `/compte/requests?type=${type}&page=${page}&limit=20`,
          { includeMeta: true },
        );
        root.replaceChildren(
          result.data.length
            ? el(
                'div',
                { class: 'cr-list' },
                result.data.map((request) => card(request, false)),
              )
            : el(
                'section',
                { class: 'pm-panel' },
                el('h2', { text: config.empty }),
                el('a', {
                  class: 'btn btn-primary',
                  href: config.search,
                  text: 'Rechercher une annonce',
                }),
              ),
        );
        const meta = result.meta;
        if (meta?.totalPages > 1)
          root.append(
            el(
              'nav',
              { class: 'client-actions', 'aria-label': 'Pages de demandes' },
              el('button', {
                type: 'button',
                class: 'btn btn-light',
                text: 'Précédent',
                disabled: page <= 1,
                onClick: () => {
                  page--;
                  void load();
                },
              }),
              el('span', {
                text: `Page ${page} sur ${meta.totalPages} · ${meta.total} demandes`,
              }),
              el('button', {
                type: 'button',
                class: 'btn btn-light',
                text: 'Suivant',
                disabled: page >= meta.totalPages,
                onClick: () => {
                  page++;
                  void load();
                },
              }),
            ),
          );
      }
    } catch (error) {
      errorView(root, error, load);
    } finally {
      busy = false;
    }
  }
  void load();
}

export function mountRequestSummary(root) {
  async function load() {
    if (!hasSession()) return errorView(root, null, load);
    root.replaceChildren(
      el('p', { text: 'Chargement du récapitulatif des demandes…' }),
    );
    try {
      const summary = await apiRequest('/compte/requests/summary');
      if (!root.isConnected) return;
      for (const [type, total] of Object.entries(summary.totals))
        document
          .querySelector(`[data-request-total="${type}"]`)
          ?.replaceChildren(document.createTextNode(String(total)));
      root.replaceChildren();
    } catch (error) {
      errorView(root, error, load);
    }
  }
  void load();
}

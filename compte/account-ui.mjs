import {
  el,
  hasSession,
  loginHref,
  ensureStyles,
} from '../messaging/messaging-ui.mjs';
import { getPublicationApiBase } from '../publier/real-estate-api.mjs';

export { el };
export function accountStyles() {
  ensureStyles();
  if (!document.querySelector('[data-account-editor-styles]'))
    document.head.append(
      el('link', {
        rel: 'stylesheet',
        href: new URL('./account-editor.css', import.meta.url).href,
        'data-account-editor-styles': true,
      }),
    );
}
export function accountError(root, error, retry) {
  const needsLogin =
    !hasSession() || error?.status === 401 || error?.code === 'SESSION_INVALID';
  root.replaceChildren(
    el('p', {
      role: 'alert',
      // A visitor who never signed in must not be told their session "expired".
      text: !hasSession()
        ? 'Connectez-vous pour accéder à cette page.'
        : needsLogin
          ? 'Votre session a expiré. Reconnectez-vous.'
          : error?.message || 'Chargement impossible. Réessayez.',
    }),
    needsLogin
      ? el('a', {
          class: 'btn btn-primary',
          href: loginHref(),
          text: 'Se connecter',
        })
      : retry
        ? el('button', {
            class: 'btn btn-light',
            type: 'button',
            text: 'Réessayer',
            onClick: retry,
          })
        : null,
  );
}
export function sessionRequired(root) {
  if (hasSession()) return false;
  accountError(root, null);
  return true;
}
export function profileImageUrl(value) {
  if (!value) return null;
  try {
    const base = new URL(getPublicationApiBase(), location.origin);
    const url = new URL(value, base.origin);
    const prefix = base.pathname.replace(/\/+$/, '') + '/files/public/';
    if (
      url.origin !== base.origin ||
      !url.pathname.startsWith(prefix) ||
      !/^[a-zA-Z0-9_-]{1,120}$/.test(url.pathname.slice(prefix.length)) ||
      url.search ||
      url.hash
    )
      return null;
    return url.href;
  } catch {
    return null;
  }
}

export const roleLabels = {
  client: 'Client',
  advertiser_individual: 'Annonceur particulier',
  real_estate_agency: 'Agence immobilière',
  hotel_manager: 'Hébergement',
  vehicle_renter: 'Loueur de voitures',
  vehicle_dealer: 'Garage automobile',
  chauffeur: 'Chauffeur professionnel',
  transport_provider: 'Transporteur',
  admin: 'Administration',
};

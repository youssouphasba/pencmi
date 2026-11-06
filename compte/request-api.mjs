import {
  publicationRequest,
  publicationOperationId,
  getPublicationApiBase,
} from '../publier/real-estate-api.mjs';
import { hasSession } from '../messaging/messaging-ui.mjs';

const PAGES = {
  hotel: 'reservations',
  visit: 'visites',
  rental: 'locations',
  chauffeur: 'chauffeur',
  trip: 'trajets',
};

export async function sendClientRequest(type, path, body) {
  const authenticated = hasSession();
  let receipt;
  if (authenticated)
    receipt = await publicationRequest(path, { method: 'POST', body });
  else {
    const base = getPublicationApiBase();
    if (!base) throw new Error('L’URL de l’API n’est pas configurée.');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok)
        throw Object.assign(
          new Error(
            payload?.error?.message ||
              'Envoi impossible. Vos informations sont conservées.',
          ),
          { status: response.status },
        );
      receipt = payload?.data ?? payload;
    } finally {
      clearTimeout(timer);
    }
  }
  if (!receipt?.id)
    throw new Error(
      'La réception n’a pas été confirmée. Réessayez avec cette même demande.',
    );
  return {
    ...receipt,
    accountUrl: authenticated
      ? `/compte/${PAGES[type]}/?id=${encodeURIComponent(receipt.id)}`
      : null,
  };
}

export function createRequestSender(type, path) {
  let key, requestId;
  return (body) => {
    const next = JSON.stringify(body);
    if (next !== key) {
      key = next;
      requestId = publicationOperationId();
    }
    return sendClientRequest(type, path, { ...body, requestId });
  };
}

export function appendRequestLink(root, receipt) {
  if (!receipt.accountUrl) return;
  const link = document.createElement('a');
  link.className = 'btn btn-light';
  link.href = receipt.accountUrl;
  link.textContent = 'Suivre ma demande';
  root.append(link);
}

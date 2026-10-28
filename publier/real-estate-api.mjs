import { tokenSession } from '../auth/token-session.mjs';

export function getPublicationApiBase(platform = window) {
  const configured = platform.document.body.dataset.apiBaseUrl || platform.PencmiConfig?.apiBaseUrl
    || platform.PencmiRuntimeConfig?.apiBaseUrl || (platform.PencmiRuntimeConfig?.backendUrl ? `${platform.PencmiRuntimeConfig.backendUrl}/api/v1` : '')
    || platform.PencmiApiBaseUrl || platform.localStorage.getItem('pencmi_api_base_url');
  if (configured) return configured.replace(/\/+$/, '');
  if (!/^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(platform.location.hostname)) return `${platform.location.origin}/api/v1`;
  return '';
}

export async function publicationRequest(path, { method = 'GET', body, binary = false } = {}, retry = true) {
  const base = getPublicationApiBase();
  const token = tokenSession.snapshot().accessToken;
  if (!token) throw Object.assign(new Error('Veuillez vous connecter à votre espace annonceur.'), { status: 401 });
  if (!base) throw new Error('L’URL de l’API n’est pas configurée.');
  const headers = { Authorization: `Bearer ${token}` };
  const multipart = body instanceof FormData;
  if (body && !multipart) headers['Content-Type'] = 'application/json';
  let response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  try {
    response = await fetch(`${base}${path}`, { method, headers, signal: controller.signal, body: body ? (multipart ? body : JSON.stringify(body)) : undefined });
  } catch {
    throw new Error('Connexion interrompue. Vos données sont conservées : réessayez l’enregistrement.');
  } finally {
    clearTimeout(timeout);
  }
  if (response.status === 401 && retry) {
    await tokenSession.refresh(base, token);
    return publicationRequest(path, { method, body, binary }, false);
  }
  if (response.ok && binary) return response.blob();
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error(payload?.error?.message || payload?.message || 'Enregistrement impossible.'), {
    status: response.status, fields: payload?.error?.details?.fields || payload?.fields || [],
  });
  return payload?.data ?? payload;
}

export function publicationOperationId(cryptoProvider = crypto) {
  if (cryptoProvider.randomUUID) return cryptoProvider.randomUUID();
  const bytes = cryptoProvider.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function publicationPayload(draft) {
  return { title: draft.content.title, description: draft.content.description,
    transaction: draft.transaction || undefined, propertyType: draft.propertyType || undefined,
    metadata: { location: draft.location, pricing: draft.pricing, features: draft.features, conditions: draft.conditions,
      documents: draft.documents.map(({ type, available }) => ({ type, available })), contactPreferences: draft.contactPreferences },
  };
}

export function publicationFromListing(listing, defaults) {
  const metadata = listing.metadata || {};
  const publication = metadata.publication || {};
  return { ...defaults, ...publication, status: listing.status, transaction: listing.transaction || undefined,
    propertyType: listing.propertyType || undefined, content: { title: listing.title || '', description: listing.description || '' },
    location: { ...defaults.location, region: metadata.region, city: listing.city, district: listing.neighborhood || '', ...publication.location },
    pricing: { ...defaults.pricing, price: listing.price ?? metadata.price ?? undefined, ...publication.pricing },
    features: { surface: metadata.surface, bedrooms: metadata.bedrooms, bathrooms: metadata.bathrooms, ...publication.features },
    documents: defaults.documents.map(doc => ({ ...doc, available: publication.documents?.find(item => item.type === doc.type)?.available || false })),
    contactPreferences: { ...defaults.contactPreferences, ...publication.contactPreferences },
    photos: listing.photos || [],
    legacyPhotos: Array.isArray(metadata.photos) && !metadata.photoIds?.length ? metadata.photos : [],
  };
}

export function fieldLocation(path) {
  const clean = path.replace(/^metadata\./, '');
  if (clean === 'title' || clean === 'description') return { step: 6, path: `content.${clean}` };
  const root = clean.split('.')[0];
  return { step: { transaction: 0, propertyType: 1, location: 2, pricing: 3, features: 4, photos: 5,
    conditions: 7, documents: 8, contactPreferences: 9 }[root] ?? 0, path: clean };
}

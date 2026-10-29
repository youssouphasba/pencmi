export const vehicleModes = {
  sale: 'Vente',
  rental: 'Location',
  chauffeur: 'Avec chauffeur',
};
export const vehicleStatuses = {
  draft: 'Brouillon',
  pending_review: 'En attente de validation',
  active: 'Active',
  refused: 'Refusée',
  suspended: 'Suspendue',
  expired: 'Expirée',
  deleted: 'Supprimée',
};
export const vehicleCopy = {
  documents: 'Documents déclarés par l’annonceur, non vérifiés par Péncmi.',
  documentUpload:
    'Le dépôt de documents privés n’est pas disponible pour le moment.',
  requestReceived:
    'Votre demande a été reçue. Les dates et la prestation restent à confirmer par l’annonceur.',
  contactReceived: 'Votre message a été transmis à l’annonceur.',
  submitted: 'Votre annonce est en attente de validation.',
  photoLimits:
    'JPEG, PNG ou WebP · 5 Mo par photo · 30 photos maximum · quota de 150 Mo.',
};
export function vehicleEscape(value = '') {
  return String(value ?? '').replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ],
  );
}
export function vehiclePrice(listing) {
  if (listing.price === undefined || listing.price === null)
    return 'Prix non renseigné';
  const pricing =
    listing.metadata?.publication?.pricing || listing.metadata || {};
  const unit =
    listing.vehicleMode === 'rental'
      ? ' / jour'
      : listing.vehicleMode === 'chauffeur'
        ? pricing.chauffeurPriceUnit === 'service'
          ? ' / service'
          : ' / trajet'
        : '';
  return `${new Intl.NumberFormat('fr-SN').format(listing.price)} FCFA${unit}`;
}
export function vehicleSafeUrl(value) {
  try {
    if (typeof value !== 'string' || !value.trim()) return '';
    const configured =
      globalThis.PencmiConfig?.apiBaseUrl ||
      globalThis.PencmiRuntimeConfig?.apiBaseUrl;
    const url = new URL(
      value,
      configured ? new URL(configured).origin : globalThis.location?.origin,
    );
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

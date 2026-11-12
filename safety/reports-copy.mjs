export const reportReasons = {
  suspicious_listing: 'Annonce suspecte', wrong_price: 'Prix incohérent', fake_photos: 'Fausses photos',
  misleading_content: 'Contenu trompeur', bad_contact: 'Mauvais contact', unavailable: 'Annonce indisponible',
  abusive_behavior: 'Comportement abusif', fraud_attempt: 'Tentative d’arnaque',
  suspicious_payment_request: 'Demande de paiement suspecte', inappropriate_message: 'Message inapproprié',
  identity_impersonation: 'Usurpation d’identité', fake_property: 'Bien inexistant', fake_vehicle: 'Véhicule inexistant',
  fake_hotel: 'Hébergement inexistant', fake_trip: 'Trajet inexistant', documents_suspicious: 'Documents suspects', other: 'Autre',
};
export const reportStatuses = {
  new: 'Envoyé', in_progress: 'En cours d’examen', correction_requested: 'Correction demandée',
  resolved: 'Résolu', rejected: 'Rejeté', archived: 'Archivé',
};
export const reportModules = {
  real_estate: 'Immobilier', hotels: 'Hôtels', vehicles: 'Voitures', trips: 'Voyages',
  messages: 'Messages', users: 'Utilisateurs', system: 'Plateforme',
};
export const reportTargets = {
  listing: 'Annonce', advertiser: 'Annonceur', user: 'Utilisateur', message: 'Message', conversation: 'Conversation', other: 'Autre',
};

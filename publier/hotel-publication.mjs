export const hotelCatalog = {
  steps: ['Type d’hébergement', 'Informations générales', 'Localisation', 'Chambres ou logements', 'Prix', 'Photos', 'Commodités', 'Conditions', 'Disponibilités', 'Mode de gestion', 'Moyens de contact', 'Prévisualisation', 'Soumission'],
  types: { hotel: 'Hôtel', auberge: 'Auberge', residence: 'Résidence', appartement_meuble: 'Appartement meublé', maison_hotes: 'Maison d’hôtes', villa: 'Villa', campement: 'Campement', chambre_habitant: 'Chambre chez l’habitant' },
  amenities: ['Wi-Fi', 'Parking', 'Piscine', 'Restaurant', 'Petit-déjeuner', 'Réception 24h/24', 'Sécurité', 'Groupe électrogène', 'Climatisation', 'Jardin', 'Terrasse', 'Vue mer', 'Salle de conférence', 'Navette aéroport', 'Service de chambre', 'Blanchisserie', 'Cuisine commune', 'Bar', 'Salle de sport'],
  roomAmenities: ['Climatisation', 'Ventilateur', 'Salle de bain privée', 'Eau chaude', 'Télévision', 'Wi-Fi', 'Mini frigo', 'Bureau', 'Armoire', 'Coffre-fort', 'Balcon', 'Vue mer', 'Cuisine équipée'],
  conditions: ['Annulation gratuite', 'Paiement sur place', 'Acompte demandé', 'Réservation sans paiement immédiat', 'Enfants acceptés', 'Animaux acceptés', 'Couples acceptés', 'Pièce d’identité demandée', 'Caution demandée'],
  contacts: { whatsappEnabled: 'WhatsApp', phoneEnabled: 'Appel téléphonique', emailEnabled: 'Email', internalMessagingEnabled: 'Messagerie interne', contactFormEnabled: 'Formulaire de demande', reservationRequestEnabled: 'Demande de réservation', emailNotificationsEnabled: 'Notifications email' },
  calendar: { open: 'Ouvert', closed: 'Fermé', full: 'Complet', maintenance: 'Maintenance' },
  status: { draft: 'Brouillon', pending_review: 'En attente de validation', active: 'Actif', refused: 'Refusé', suspended: 'Suspendu', expired: 'Expiré', deleted: 'Supprimé' },
};
export const escapeHotel = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
export function emptyHotelDraft() {
  return { name: '', city: '', region: '', address: '', description: '', metadata: { general: {}, location: { hideExactAddress: true }, amenities: [], conditions: { options: [] }, management: { mode: 'manual', showRemainingRoomsToClients: false }, contactPreferences: {} }, rooms: [] };
}
export function hotelPayload(draft, externalInventory = false) {
  const { name, propertyType, city, region, address, description, metadata, rooms } = draft;
  return { name, propertyType: propertyType || undefined, city, region, address, description, metadata, ...(externalInventory ? {} : { rooms }) };
}
export function hotelFromServer(property) {
  const empty = emptyHotelDraft();
  const publication = property.metadata?.publication || property.contactSettings?.publication || {};
  return { ...empty, name: property.name || '', propertyType: property.propertyType || undefined, city: property.city || '', region: property.region || '', address: property.address || '', description: property.description || '',
    metadata: { ...empty.metadata, ...publication, general: { ...empty.metadata.general, ...publication.general }, conditions: { options: [], ...publication.conditions }, management: { mode: 'manual', showRemainingRoomsToClients: false, ...publication.management } }, rooms: property.rooms || [] };
}
export function hotelFieldStep(path) {
  if (path === 'propertyType') return 0;
  if (['name', 'description'].includes(path) || path.startsWith('metadata.general')) return 1;
  if (['city', 'region', 'address'].includes(path) || path.startsWith('metadata.location')) return 2;
  if (path.startsWith('rooms')) return path.includes('.rates') || path.includes('.basePrice') ? 4 : path.includes('.calendar') ? 8 : 3;
  return path.startsWith('metadata.contactPreferences') ? 10 : path.startsWith('metadata.conditions') ? 7 : 0;
}

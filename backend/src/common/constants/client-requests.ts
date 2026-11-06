export const CLIENT_REQUEST_DESTINATIONS = {
  hotel: { module: 'hotels', page: 'reservations' },
  visit: { module: 'real_estate', page: 'visites' },
  rental: { module: 'vehicles', page: 'locations' },
  chauffeur: { module: 'vehicles', page: 'chauffeur' },
  trip: { module: 'trips', page: 'trajets' },
} as const;

export const CLIENT_REQUEST_TYPES = [
  'hotel',
  'visit',
  'rental',
  'chauffeur',
  'trip',
] as const;
export type ClientRequestType = (typeof CLIENT_REQUEST_TYPES)[number];

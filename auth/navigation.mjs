export const accountRoutes = Object.freeze({
  client: '/compte/',
  advertiser_individual: '/dashboard/',
  real_estate_agency: '/dashboard/immobilier/',
  hotel_manager: '/dashboard/hotels/',
  vehicle_renter: '/dashboard/voitures/',
  vehicle_dealer: '/dashboard/voitures/',
  chauffeur: '/dashboard/voitures/',
  transport_provider: '/dashboard/voyages/',
  admin: '/admin/',
});

export const navigationLabels = Object.freeze({
  account: 'Mon espace', overview: 'Vue d’ensemble', listings: 'Mes annonces',
  hotels: 'Mes hébergements', trips: 'Mes trajets', messages: 'Messages',
  requests: 'Demandes', contacts: 'Contacts', profile: 'Mon profil',
  publish: 'Publier une annonce', home: 'Accueil du site', menu: 'Navigation de mon espace',
});

export function safeNext(value, fallback, origin = location.origin) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin || /^\/(login|register)(\/|$)/.test(url.pathname)) return fallback;
    return url.pathname + url.search + url.hash;
  } catch { return fallback; }
}

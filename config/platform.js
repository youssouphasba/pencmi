const PencmiModules = {
  realEstate: "real_estate",
  hotels: "hotels",
  vehicles: "vehicles",
  vehicleSale: "vehicle_sale",
  vehicleRental: "vehicle_rental",
  vehicleChauffeur: "vehicle_chauffeur",
  trips: "trips",
  general: "general",
  system: "system"
};

const PencmiStatuses = {
  draft: "draft",
  pendingReview: "pending_review",
  active: "active",
  inactive: "inactive",
  verified: "verified",
  refused: "refused",
  suspended: "suspended",
  expired: "expired",
  deleted: "deleted"
};

const PencmiRouteAccess = {
  public: "public",
  authenticated: "authenticated",
  advertiser: "advertiser",
  admin: "admin"
};

const PencmiRoutes = {
  home: "/",
  login: "/login",
  register: "/register",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  publish: "/publier",
  realEstate: "/immobilier",
  realEstateDetail: "/immobilier/annonce/:id",
  hotels: "/hotels",
  hotelDetail: "/hotels/:id",
  vehicles: "/voitures",
  vehicleDetail: "/voitures/:id",
  trips: "/voyages",
  tripDetail: "/voyages/:id",
  account: "/compte",
  dashboard: "/dashboard",
  admin: "/admin",
  support: "/support",
  contact: "/contact",
  safety: "/securite",
  reports: "/signaler"
};

const PencmiPublicRoutes = [
  "/",
  "/immobilier",
  "/immobilier/annonce/:id",
  "/immobilier/location",
  "/immobilier/vente",
  "/immobilier/achat",
  "/immobilier/terrains",
  "/immobilier/appartements",
  "/immobilier/maisons",
  "/immobilier/villas",
  "/immobilier/studios",
  "/immobilier/ville/:villeSlug",
  "/immobilier/region/:regionSlug",
  "/immobilier/quartier/:quartierSlug",
  "/hotels",
  "/hotels/:id",
  "/hotels/hotel",
  "/hotels/auberge",
  "/hotels/residence",
  "/hotels/appartement-meuble",
  "/hotels/ville/:villeSlug",
  "/hotels/region/:regionSlug",
  "/voitures",
  "/voitures/:id",
  "/voitures/achat",
  "/voitures/vente",
  "/voitures/location",
  "/voitures/avec-chauffeur",
  "/voitures/marque/:brandSlug",
  "/voitures/marque/:brandSlug/:modelSlug",
  "/voitures/ville/:villeSlug",
  "/voitures/region/:regionSlug",
  "/voyages",
  "/voyages/:id",
  "/voyages/:departSlug-vers-:arriveeSlug",
  "/voyages/bus",
  "/voyages/car",
  "/voyages/minibus",
  "/voyages/sept-places",
  "/voyages/covoiturage",
  "/voyages/ville/:villeSlug",
  "/voyages/gare/:gareSlug",
  "/conditions",
  "/confidentialite",
  "/mentions-legales",
  "/aide",
  "/contact",
  "/securite",
  "/regles-publication",
  "/conseils-anti-arnaque",
  "/support"
];

const PencmiPrivateRoutes = [
  "/compte",
  "/compte/profil",
  "/compte/messages",
  "/compte/favoris",
  "/compte/alertes",
  "/compte/notifications",
  "/compte/reservations",
  "/compte/visites",
  "/compte/locations",
  "/compte/chauffeur",
  "/compte/trajets",
  "/compte/signalements",
  "/compte/parametres",
  "/dashboard",
  "/dashboard/profil",
  "/dashboard/settings",
  "/dashboard/notifications",
  "/dashboard/reports",
  "/dashboard/verification",
  "/dashboard/immobilier",
  "/dashboard/hotels",
  "/dashboard/hotels/integration",
  "/dashboard/hotels/integration/setup",
  "/dashboard/hotels/integration/api",
  "/dashboard/hotels/integration/webhooks",
  "/dashboard/hotels/integration/sync-settings",
  "/dashboard/hotels/integration/mapping",
  "/dashboard/hotels/integration/logs",
  "/dashboard/hotels/integration/errors",
  "/dashboard/hotels/integration/test",
  "/dashboard/hotels/integration/security",
  "/dashboard/voitures",
  "/dashboard/voyages",
  "/dashboard/billing"
];

const PencmiAdminRoutes = [
  "/admin",
  "/admin/users",
  "/admin/annonceurs",
  "/admin/listings",
  "/admin/validation",
  "/admin/reports",
  "/admin/messages",
  "/admin/contacts",
  "/admin/notifications",
  "/admin/email-logs",
  "/admin/statistiques",
  "/admin/settings",
  "/admin/content",
  "/admin/seo",
  "/admin/geo",
  "/admin/monetization",
  "/admin/support",
  "/admin/hotel-integrations",
  "/admin/hotel-integrations/partners",
  "/admin/hotel-integrations/api-keys",
  "/admin/hotel-integrations/webhooks",
  "/admin/hotel-integrations/logs",
  "/admin/hotel-integrations/errors",
  "/admin/hotel-integrations/audit",
  "/admin/hotel-integrations/settings"
];

const PencmiLabels = {
  brandName: "Péncmi",
  modules: {
    real_estate: "Immobilier",
    hotels: "Hôtels & Auberges",
    vehicles: "Voitures",
    vehicle_sale: "Vente voiture",
    vehicle_rental: "Location voiture",
    vehicle_chauffeur: "Voiture avec chauffeur",
    trips: "Voyages interurbains",
    general: "Général",
    system: "Système"
  },
  emptyStates: {
    listings: "Aucune annonce disponible pour le moment.",
    messages: "Aucun message pour le moment.",
    notifications: "Aucune notification pour le moment.",
    reports: "Aucun signalement pour le moment.",
    statistics: "Aucune statistique disponible pour le moment.",
    invoices: "Aucune facture disponible pour le moment.",
    content: "Contenu en cours de préparation."
  }
};

const PencmiNavigation = {
  publicHeader: [
    { label: "Immobilier", href: "/immobilier" },
    { label: "Hôtels", href: "/hotels" },
    { label: "Voitures", href: "/voitures" },
    { label: "Voyages", href: "/voyages" }
  ],
  publicFooter: [
    { label: "Conditions", href: "/conditions" },
    { label: "Confidentialité", href: "/confidentialite" },
    { label: "Mentions légales", href: "/mentions-legales" },
    { label: "Aide", href: "/aide" },
    { label: "Sécurité", href: "/securite" },
    { label: "Contact", href: "/contact" }
  ]
};

const PencmiSeoConstants = {
  baseUrl: "https://www.pencmi.com",
  privatePrefixes: ["/admin", "/dashboard", "/compte", "/login", "/register", "/forgot-password", "/reset-password", "/publier", "/favoris"],
  noindexPaths: ["/signaler", "/support/detail", "/immobilier/alertes", "/hotels/alertes", "/voitures/alertes", "/voyages/alertes"]
};

const PencmiGeoConstants = {
  files: ["/llms.txt", "/ai.txt", "/about-pencmi.txt", "/data/platform-summary.json", "/data/public-entities.json", "/data/public-routes.json"]
};

function pencmiPathDepth() {
  return Number(document.body?.dataset?.routeDepth || "0");
}

function pencmiRelativeRoot() {
  const depth = pencmiPathDepth();
  return depth ? "../".repeat(depth) : "./";
}

function pencmiRouteHref(path = "/") {
  if (typeof window === "undefined" || window.location.protocol !== "file:") return path;
  const prefix = pencmiRelativeRoot();
  if (path === "/") return `${prefix}index.html`;
  if (path.startsWith("/login?")) return `${prefix}login/${path.slice("/login".length)}`;
  if (path.startsWith("/publier?")) return `${prefix}publier/${path.slice("/publier".length)}`;
  if (path.includes("?")) {
    const [base, query] = path.split("?");
    return `${pencmiRouteHref(base)}?${query}`;
  }
  return `${prefix}${path.replace(/^\//, "")}/`;
}

window.PencmiConfig = {
  modules: PencmiModules,
  statuses: PencmiStatuses,
  routeAccess: PencmiRouteAccess,
  routes: PencmiRoutes,
  publicRoutes: PencmiPublicRoutes,
  privateRoutes: PencmiPrivateRoutes,
  adminRoutes: PencmiAdminRoutes,
  labels: PencmiLabels,
  navigation: PencmiNavigation,
  seo: PencmiSeoConstants,
  geo: PencmiGeoConstants,
  routeHref: pencmiRouteHref
};

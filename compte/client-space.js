const clientMessages = [];
const clientFavorites = [];
const clientAlerts = [];
const clientNotifications = [];
const clientHotelReservations = [];
const clientRealEstateVisits = [];
const clientVehicleRentals = [];
const clientChauffeurRequests = [];
const clientTripRequests = [];

const clientRoutes = {
  overview: "/compte",
  profile: "/compte/profil",
  messages: "/compte/messages",
  favorites: "/compte/favoris",
  alerts: "/compte/alertes",
  notifications: "/compte/notifications",
  reports: "/compte/signalements",
  reservations: "/compte/reservations",
  visits: "/compte/visites",
  rentals: "/compte/locations",
  chauffeur: "/compte/chauffeur",
  trips: "/compte/trajets",
  settings: "/compte/parametres",
  realEstate: "/immobilier",
  hotels: "/hotels",
  vehicles: "/voitures",
  voyages: "/voyages",
  realEstateFavorites: "/favoris/immobilier",
  hotelFavorites: "/favoris/hotels",
  vehicleFavorites: "/favoris/voitures",
  tripFavorites: "/favoris/voyages",
  realEstateAlerts: "/immobilier/alertes",
  hotelAlerts: "/hotels/alertes",
  vehicleAlerts: "/voitures/alertes",
  tripAlerts: "/voyages/alertes"
};

const CLIENT_ACCESS_TOKEN_STORAGE_KEY = "pencmi_access_token";
const CLIENT_REFRESH_TOKEN_STORAGE_KEY = "pencmi_refresh_token";
const CLIENT_SESSION_STORAGE_KEY = "pencmi_current_session";
const CLIENT_API_BASE_STORAGE_KEY = "pencmi_api_base_url";

const clientModuleLabels = {
  real_estate: "Immobilier",
  hotels: "Hôtels",
  vehicles: "Voitures",
  vehicle_rental: "Location voiture",
  vehicle_chauffeur: "Chauffeur",
  trips: "Voyages"
};

const clientStatusLabels = {
  new: "Nouvelle",
  pending: "En attente",
  accepted: "Acceptée",
  refused: "Refusée",
  cancelled: "Annulée",
  completed: "Terminée",
  expired: "Expirée"
};

function clientRouteHref(path) {
  if (window.location.protocol !== "file:") return path;
  const depth = Number(document.body.dataset.routeDepth || "1");
  const prefix = "../".repeat(depth);
  const routes = {
    "/compte": `${prefix}compte/`,
    "/compte/profil": `${prefix}compte/profil/`,
    "/compte/messages": `${prefix}compte/messages/`,
    "/compte/favoris": `${prefix}compte/favoris/`,
    "/compte/alertes": `${prefix}compte/alertes/`,
    "/compte/notifications": `${prefix}compte/notifications/`,
    "/compte/signalements": `${prefix}compte/signalements/`,
    "/compte/reservations": `${prefix}compte/reservations/`,
    "/compte/visites": `${prefix}compte/visites/`,
    "/compte/locations": `${prefix}compte/locations/`,
    "/compte/chauffeur": `${prefix}compte/chauffeur/`,
    "/compte/trajets": `${prefix}compte/trajets/`,
    "/compte/parametres": `${prefix}compte/parametres/`,
    "/immobilier": `${prefix}immobilier/`,
    "/hotels": `${prefix}hotels/`,
    "/voitures": `${prefix}voitures/`,
    "/voyages": `${prefix}voyages/`,
    "/favoris/immobilier": `${prefix}favoris/immobilier/`,
    "/favoris/hotels": `${prefix}favoris/hotels/`,
    "/favoris/voitures": `${prefix}favoris/voitures/`,
    "/favoris/voyages": `${prefix}favoris/voyages/`,
    "/immobilier/alertes": `${prefix}immobilier/alertes/`,
    "/hotels/alertes": `${prefix}hotels/alertes/`,
    "/voitures/alertes": `${prefix}voitures/alertes/`,
    "/voyages/alertes": `${prefix}voyages/alertes/`
  };
  if (path === "/login") return `${prefix}login/`;
  return routes[path] || path;
}

function clientApiBaseUrl() {
  return String(window.PencmiConfig?.apiBaseUrl || window.PencmiRuntimeConfig?.apiBaseUrl || window.PencmiApiBaseUrl || window.localStorage.getItem(CLIENT_API_BASE_STORAGE_KEY) || "").replace(/\/+$/, "");
}

async function clientLogout() {
  const baseUrl = clientApiBaseUrl();
  const token = window.localStorage.getItem(CLIENT_ACCESS_TOKEN_STORAGE_KEY) || "";
  if (baseUrl && token) {
    await fetch(`${baseUrl}/auth/logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }).catch(() => null);
  }
  window.localStorage.removeItem(CLIENT_ACCESS_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(CLIENT_REFRESH_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(CLIENT_SESSION_STORAGE_KEY);
  window.location.href = clientRouteHref("/login");
}

function formatClientStatus(status) {
  return clientStatusLabels[status] || "En attente";
}

function formatModuleLabel(module) {
  return clientModuleLabels[module] || "Péncmi";
}

function buildClientRequestUrl(module, id = "") {
  const routes = {
    real_estate: clientRoutes.visits,
    hotels: clientRoutes.reservations,
    vehicles: clientRoutes.rentals,
    vehicle_rental: clientRoutes.rentals,
    vehicle_chauffeur: clientRoutes.chauffeur,
    trips: clientRoutes.trips
  };
  const path = routes[module] || clientRoutes.overview;
  return id ? `${path}?id=${encodeURIComponent(id)}` : path;
}

function filterClientItems(items, predicate = () => true) {
  return items.filter(predicate);
}

function sortByRecent(items) {
  return [...items].sort((first, second) => new Date(second.createdAt || second.updatedAt || 0) - new Date(first.createdAt || first.updatedAt || 0));
}

function ClientAccountLayout(content, currentPage = "overview", title = "Mon compte", subtitle = "Suivez vos demandes, favoris, messages et alertes depuis un seul espace.") {
  return `
    <div class="client-account-shell">
      ${ClientSidebar(currentPage)}
      <main class="client-main">
        <header class="client-header">
          <div>
            <button class="btn btn-ghost client-menu-toggle" type="button" data-open-client-sidebar>Menu</button>
            <h1>${title}</h1>
            <p>${subtitle}</p>
          </div>
          <div class="client-header-actions"><a class="btn btn-light" href="${clientRouteHref(clientRoutes.notifications)}">Notifications <span class="notification-badge">0</span></a><button class="btn btn-ghost" type="button" data-client-logout>Se déconnecter</button></div>
        </header>
        ${content}
      </main>
    </div>
  `;
}

function ClientSidebar(currentPage = "overview") {
  const nav = [
    ["Vue d’ensemble", clientRoutes.overview, "overview"],
    ["Profil", clientRoutes.profile, "profile"],
    ["Messages", clientRoutes.messages, "messages", 0],
    ["Favoris", clientRoutes.favorites, "favorites"],
    ["Alertes", clientRoutes.alerts, "alerts"],
    ["Notifications", clientRoutes.notifications, "notifications", 0],
    ["Signalements", clientRoutes.reports, "reports", 0],
    ["Réservations hôtels", clientRoutes.reservations, "reservations", 0],
    ["Visites immobilières", clientRoutes.visits, "visits", 0],
    ["Locations voitures", clientRoutes.rentals, "rentals", 0],
    ["Chauffeur", clientRoutes.chauffeur, "chauffeur", 0],
    ["Trajets interurbains", clientRoutes.trips, "trips", 0],
    ["Paramètres", clientRoutes.settings, "settings"]
  ];

  return `
    <aside class="client-sidebar" id="client-sidebar">
      <div class="dashboard-brand"><span>P</span><div><strong>Péncmi</strong><small>Espace client</small></div></div>
      <nav class="client-nav">${nav.map(([label, href, key, badge]) => `<a href="${clientRouteHref(href)}"${key === currentPage ? ' aria-current="page"' : ""}><span>${label}</span>${typeof badge === "number" ? `<span class="notification-badge">${badge}</span>` : ""}</a>`).join("")}</nav>
    </aside>
  `;
}

function ClientOverviewPage() {
  const summaries = [
    ["Messages non lus", clientMessages.reduce((total, item) => total + item.unreadCount, 0)],
    ["Favoris", clientFavorites.length],
    ["Alertes actives", clientAlerts.filter((item) => item.enabled).length],
    ["Réservations hôtels en attente", clientHotelReservations.length],
    ["Visites immobilières", clientRealEstateVisits.length],
    ["Locations voitures", clientVehicleRentals.length],
    ["Demandes chauffeur", clientChauffeurRequests.length],
    ["Trajets interurbains", clientTripRequests.length],
    ["Notifications non lues", clientNotifications.length]
  ];
  const shortcuts = [
    ["Voir mes favoris", clientRoutes.favorites],
    ["Voir mes messages", clientRoutes.messages],
    ["Voir mes alertes", clientRoutes.alerts],
    ["Rechercher un bien", clientRoutes.realEstate],
    ["Rechercher un hôtel", clientRoutes.hotels],
    ["Rechercher une voiture", clientRoutes.vehicles],
    ["Rechercher un trajet", clientRoutes.voyages]
  ];

  return ClientAccountLayout(`
    <section class="client-summary-grid">${summaries.map(([label, value]) => ClientSummaryCard(label, value)).join("")}</section>
    <section class="client-section client-card">
      <h2>Accès rapides</h2>
      <div class="client-shortcuts">${shortcuts.map(([label, href]) => `<a class="btn btn-light" href="${clientRouteHref(href)}">${label}</a>`).join("")}</div>
    </section>
    ${ClientEmptyState("Aucune activité pour le moment.", "Vos demandes, messages et favoris apparaîtront ici.")}
  `);
}

function ClientSummaryCard(label, value = 0) {
  return `<article class="client-summary-card"><span>${label}</span><div class="client-summary-value">${value}</div></article>`;
}

function ClientMessagesPage() {
  return ClientAccountLayout(`
    <section class="client-card">
      <div class="client-filter-row">${["Tous", "Immobilier", "Hôtels", "Voitures", "Voyages", "Non lus"].map((label, index) => `<button type="button" aria-pressed="${index === 0}">${label}</button>`).join("")}</div>
    </section>
    ${clientMessages.length ? ClientConversationList(clientMessages) : ClientEmptyState("Vous n’avez aucun message pour le moment.", "", `<a class="btn btn-primary" href="${clientRouteHref(clientRoutes.realEstate)}">Explorer Péncmi</a>`)}
    ${ClientConversationThread()}
  `, "messages", "Messages", "Retrouvez vos conversations avec les annonceurs immobiliers, hôtels, loueurs, garages, chauffeurs et transporteurs.");
}

function ClientConversationList(items) {
  return `
    <section class="client-table-shell client-section">
      <div class="client-scroll">
        <table class="client-table">
          <thead><tr><th>Module</th><th>Annonce ou service</th><th>Dernier message</th><th>Statut</th><th>Date</th></tr></thead>
          <tbody>${sortByRecent(items).map((item) => `<tr><td>${ClientModuleBadge(item.module)}</td><td>${item.listingTitle || ""}</td><td>${item.lastMessage || ""}</td><td>${item.unreadCount ? "Non lu" : "Lu"}</td><td>${item.updatedAt || ""}</td></tr>`).join("")}</tbody>
        </table>
      </div>
    </section>
  `;
}

function ClientConversationThread() {
  return `<section class="client-card client-section"><h2>Conversation ouverte</h2><p>Sélectionnez une conversation pour afficher les messages et répondre.</p><label class="client-field"><span>Réponse</span><input type="text" disabled placeholder="Aucune conversation sélectionnée"></label></section>`;
}

function ClientFavoritesPage() {
  const actions = `<div class="client-actions"><a class="btn btn-light" href="${clientRouteHref(clientRoutes.realEstate)}">Voir les annonces immobilières</a><a class="btn btn-light" href="${clientRouteHref(clientRoutes.hotels)}">Voir les hébergements</a><a class="btn btn-light" href="${clientRouteHref(clientRoutes.vehicles)}">Voir les voitures</a><a class="btn btn-light" href="${clientRouteHref(clientRoutes.voyages)}">Voir les trajets</a></div>`;
  return ClientAccountLayout(`
    ${ClientTabs(["Tous", "Immobilier", "Hôtels", "Voitures", "Voyages"])}
    <section class="client-card"><div class="client-actions"><a class="btn btn-ghost" href="${clientRouteHref(clientRoutes.realEstateFavorites)}">Immobilier</a><a class="btn btn-ghost" href="${clientRouteHref(clientRoutes.hotelFavorites)}">Hôtels</a><a class="btn btn-ghost" href="${clientRouteHref(clientRoutes.vehicleFavorites)}">Voitures</a><a class="btn btn-ghost" href="${clientRouteHref(clientRoutes.tripFavorites)}">Voyages</a></div></section>
    ${clientFavorites.length ? ClientGenericTable(["Type", "Titre", "Localisation", "Prix", "Date d’ajout", "Actions"], clientFavorites) : ClientEmptyState("Vous n’avez encore ajouté aucun favori.", "", actions)}
  `, "favorites", "Mes favoris", "Retrouvez vos biens, hébergements, voitures et trajets sauvegardés.");
}

function ClientAlertsPage() {
  const actions = `<div class="client-actions"><a class="btn btn-light" href="${clientRouteHref(clientRoutes.realEstateAlerts)}">Créer une alerte immobilier</a><a class="btn btn-light" href="${clientRouteHref(clientRoutes.hotelAlerts)}">Créer une alerte hôtel</a><a class="btn btn-light" href="${clientRouteHref(clientRoutes.vehicleAlerts)}">Créer une alerte voiture</a><a class="btn btn-light" href="${clientRouteHref(clientRoutes.tripAlerts)}">Créer une alerte trajet</a></div>`;
  return ClientAccountLayout(`
    ${ClientTabs(["Toutes", "Immobilier", "Hôtels", "Voitures", "Voyages"])}
    ${clientAlerts.length ? ClientGenericTable(["Nom", "Module", "Critères", "Fréquence", "Statut", "Date", "Actions"], clientAlerts) : ClientEmptyState("Vous n’avez aucune alerte pour le moment.", "", actions)}
  `, "alerts", "Mes alertes", "Gérez vos recherches sauvegardées et alertes sur tous les modules Péncmi.");
}

function ClientNotificationsPage() {
  return ClientAccountLayout(`
    <section class="client-card">
      <div class="client-filter-row">${["Toutes", "Non lues", "Immobilier", "Hôtels", "Voitures", "Voyages", "Système"].map((label, index) => `<button type="button" aria-pressed="${index === 0}">${label}</button>`).join("")}</div>
      <div class="client-actions"><button class="btn btn-light" type="button">Tout marquer comme lu</button></div>
    </section>
    ${clientNotifications.length ? ClientGenericTable(["Module", "Priorité", "Statut", "Date", "Action"], clientNotifications) : ClientEmptyState("Aucune notification pour le moment.")}
  `, "notifications", "Notifications", "Consultez vos notifications internes, leur priorité et les actions associées.");
}

function ClientHotelReservationsPage() {
  return ClientRequestPage("reservations", "Réservations hôtels", "Vous n’avez aucune demande de réservation hôtel pour le moment.", "Rechercher un hébergement", clientRoutes.hotels, ["Établissement", "Chambre ou logement", "Dates", "Nuits", "Personnes", "Prix estimé", "Statut", "Date", "Actions"], clientHotelReservations);
}

function ClientRealEstateVisitsPage() {
  return ClientRequestPage("visits", "Visites immobilières", "Vous n’avez aucune visite immobilière pour le moment.", "Voir les biens immobiliers", clientRoutes.realEstate, ["Bien immobilier", "Ville", "Quartier", "Annonceur", "Date demandée", "Date proposée", "Heure", "Statut", "Actions"], clientRealEstateVisits);
}

function ClientVehicleRentalsPage() {
  return ClientRequestPage("rentals", "Locations voitures", "Vous n’avez aucune demande de location voiture pour le moment.", "Voir les voitures à louer", clientRoutes.vehicles, ["Véhicule", "Loueur", "Ville", "Récupération", "Retour", "Durée", "Prix estimé", "Caution", "Statut", "Actions"], clientVehicleRentals);
}

function ClientChauffeurRequestsPage() {
  return ClientRequestPage("chauffeur", "Demandes chauffeur", "Vous n’avez aucune demande de chauffeur pour le moment.", "Trouver une voiture avec chauffeur", clientRoutes.vehicles, ["Véhicule ou chauffeur", "Lieu de départ", "Destination", "Date", "Heure", "Type de service", "Prix estimé", "Statut", "Actions"], clientChauffeurRequests);
}

function ClientTripRequestsPage() {
  return ClientRequestPage("trips", "Trajets interurbains", "Vous n’avez aucune demande de place pour le moment.", "Rechercher un trajet", clientRoutes.voyages, ["Départ", "Arrivée", "Date", "Heure", "Places demandées", "Bagages", "Transporteur", "Statut", "Actions"], clientTripRequests);
}

function ClientRequestPage(currentPage, title, emptyTitle, actionLabel, actionHref, columns, items) {
  return ClientAccountLayout(`
    ${items.length ? ClientGenericTable(columns, items) : ClientEmptyState(emptyTitle, "", `<a class="btn btn-primary" href="${clientRouteHref(actionHref)}">${actionLabel}</a>`)}
  `, currentPage, title, "Suivez le statut, les messages et les actions disponibles pour vos demandes.");
}

function ClientProfilePage() {
  return ClientAccountLayout(`
    <form class="client-card" data-client-form>
      <div class="client-form-grid">
        <label class="client-field"><span>Prénom</span><input type="text" autocomplete="given-name"></label>
        <label class="client-field"><span>Nom</span><input type="text" autocomplete="family-name"></label>
        <label class="client-field"><span>Téléphone</span><input type="tel" autocomplete="tel"></label>
        <label class="client-field"><span>Email</span><input type="email" autocomplete="email"></label>
        <label class="client-field"><span>Photo de profil</span><input type="file" accept="image/*"></label>
        <label class="client-field"><span>Ville</span><input type="text" autocomplete="address-level2"></label>
        <label class="client-field"><span>Langue préférée</span><select><option>Français</option><option>Wolof</option><option>Anglais</option></select></label>
      </div>
      <div class="client-message" data-client-success>Votre profil a été mis à jour.</div>
      <div class="client-actions"><button class="btn btn-primary" type="submit">Enregistrer les modifications</button></div>
    </form>
  `, "profile", "Profil", "Gérez vos informations personnelles et votre langue préférée.");
}

function ClientSettingsPage() {
  return ClientAccountLayout(`
    <form class="client-card" data-client-form>
      <section class="client-settings-section"><h2>Sécurité</h2><label class="client-field"><span>Changer mot de passe</span><input type="password" autocomplete="new-password"></label><div class="client-actions"><button class="btn btn-light" type="button">Vérifier email</button><button class="btn btn-light" type="button">Vérifier téléphone</button></div></section>
      <section class="client-settings-section"><h2>Notifications</h2>${["Notifications internes", "Notifications email", "Alertes de recherche", "Rappels", "Messages importants"].map(ClientCheckbox).join("")}</section>
      <section class="client-settings-section"><h2>Emails</h2><p>Emails importants non désactivables : demande envoyée, demande acceptée, demande refusée, annulation, sécurité du compte.</p>${["Alertes de recherche", "Recommandations", "Rappels", "Baisse de prix", "Marketing futur"].map(ClientCheckbox).join("")}</section>
      <section class="client-settings-section"><h2>Confidentialité</h2>${["Afficher mon téléphone aux annonceurs", "Autoriser les annonceurs à me répondre par email", "Autoriser les annonceurs à me contacter par téléphone si je l’ai fourni"].map(ClientCheckbox).join("")}</section>
      <section class="client-settings-section"><h2>Suppression du compte</h2><button class="btn danger-button" type="button" data-open-client-modal>Supprimer mon compte</button></section>
      <div class="client-message" data-client-success>Vos paramètres ont été mis à jour.</div>
      <div class="client-actions"><button class="btn btn-primary" type="submit">Enregistrer les modifications</button></div>
    </form>
    <div class="client-modal-backdrop" data-client-modal><div class="client-modal"><h2>Confirmer la suppression</h2><p>Aucun compte n’est supprimé maintenant. Cette action est prévue pour une future intégration sécurisée.</p><div class="client-actions"><button class="btn btn-ghost" type="button" data-close-client-modal>Annuler</button><button class="btn danger-button" type="button">Supprimer mon compte</button></div></div></div>
  `, "settings", "Paramètres", "Configurez la sécurité, les notifications, les emails et la confidentialité de votre compte.");
}

function ClientCheckbox(label) {
  return `<label class="client-option"><input type="checkbox"><span>${label}</span></label>`;
}

function ClientTabs(labels) {
  return `<section class="client-card"><div class="client-tabs">${labels.map((label, index) => `<button type="button" aria-pressed="${index === 0}">${label}</button>`).join("")}</div></section>`;
}

function ClientGenericTable(columns, items) {
  return `
    <section class="client-table-shell client-section">
      <div class="client-scroll">
        <table class="client-table">
          <thead><tr>${columns.map((column) => `<th>${column}</th>`).join("")}</tr></thead>
          <tbody>${items.map(() => `<tr>${columns.map(() => "<td></td>").join("")}</tr>`).join("")}</tbody>
        </table>
      </div>
    </section>
  `;
}

function ClientEmptyState(title, text = "", action = "") {
  return `<section class="client-empty-state client-section"><h2>${title}</h2>${text ? `<p>${text}</p>` : ""}${action ? `<div class="client-actions">${action}</div>` : ""}</section>`;
}

function ClientStatusBadge(status) {
  return `<span class="client-status-badge">${formatClientStatus(status)}</span>`;
}

function ClientModuleBadge(module) {
  return `<span class="client-module-badge">${formatModuleLabel(module)}</span>`;
}

function bindClientSpace() {
  document.querySelector("[data-open-client-sidebar]")?.addEventListener("click", () => {
    document.querySelector("#client-sidebar")?.classList.toggle("is-open");
  });

  document.querySelectorAll("[data-client-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      form.querySelector("[data-client-success]")?.classList.add("is-visible");
    });
  });

  document.querySelector("[data-open-client-modal]")?.addEventListener("click", () => {
    document.querySelector("[data-client-modal]")?.classList.add("is-open");
  });

  document.querySelector("[data-close-client-modal]")?.addEventListener("click", () => {
    document.querySelector("[data-client-modal]")?.classList.remove("is-open");
  });

  document.querySelector("[data-client-logout]")?.addEventListener("click", () => {
    void clientLogout();
  });
}

function renderClientSpace() {
  const root = document.querySelector("#client-account-root");
  if (!root) return;
  const page = document.body.dataset.clientPage || "overview";
  const pages = {
    overview: ClientOverviewPage,
    profile: ClientProfilePage,
    messages: ClientMessagesPage,
    favorites: ClientFavoritesPage,
    alerts: ClientAlertsPage,
    notifications: ClientNotificationsPage,
    reservations: ClientHotelReservationsPage,
    visits: ClientRealEstateVisitsPage,
    rentals: ClientVehicleRentalsPage,
    chauffeur: ClientChauffeurRequestsPage,
    trips: ClientTripRequestsPage,
    settings: ClientSettingsPage
  };
  root.innerHTML = (pages[page] || ClientOverviewPage)();
  bindClientSpace();
}

document.addEventListener("DOMContentLoaded", renderClientSpace);

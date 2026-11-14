const clientMessages = [];
let clientUnreadLoaded = false;
const clientCounts = {};

const clientRoutes = {
  home: "/",
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
    "/": `${prefix}index.html`,
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
    <div class="client-topbar">
      <a class="client-topbar-brand" href="${clientRouteHref(clientRoutes.home)}" aria-label="Accueil du site Péncmi"><img src="/Logo%20pencmi.jpeg" alt="" width="40" height="40"><strong>Péncmi</strong></a>
      <nav class="client-topbar-links" aria-label="Site Péncmi">
        <a href="${clientRouteHref(clientRoutes.realEstate)}">Immobilier</a><a href="${clientRouteHref(clientRoutes.hotels)}">Hôtels</a><a href="${clientRouteHref(clientRoutes.vehicles)}">Voitures</a><a href="${clientRouteHref(clientRoutes.voyages)}">Voyages</a>
      </nav>
      <div class="client-topbar-actions">
        <a class="client-topbar-bell" href="${clientRouteHref(clientRoutes.notifications)}" aria-label="Notifications${clientCounts.unreadNotifications ? ` (${clientCounts.unreadNotifications} non lues)` : ""}"><span aria-hidden="true">🔔</span><span class="client-topbar-bell-label">Notifications</span>${clientCounts.unreadNotifications ? `<span class="notification-badge">${clientCounts.unreadNotifications}</span>` : ""}</a>
        <a class="btn btn-primary client-topbar-home" href="${clientRouteHref(clientRoutes.home)}">← Retour au site</a>
      </div>
    </div>
    <div class="client-account-shell">
      ${ClientSidebar(currentPage)}
      <main class="client-main">
        <header class="client-header">
          <div class="client-header-title">
            <button class="btn btn-ghost client-menu-toggle" type="button" data-open-client-sidebar aria-label="Ouvrir le menu" aria-controls="client-sidebar" aria-expanded="false">☰<span class="client-menu-label"> Menu</span></button>
            <div>
              <h1>${title}</h1>
              <p>${subtitle}</p>
            </div>
          </div>
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
    ["Messages", clientRoutes.messages, "messages", clientUnreadLoaded ? clientMessages.reduce((total, item) => total + item.unreadCount, 0) : undefined],
    ["Favoris", clientRoutes.favorites, "favorites"],
    ["Alertes", clientRoutes.alerts, "alerts"],
    ["Notifications", clientRoutes.notifications, "notifications"],
    ["Signalements", clientRoutes.reports, "reports"],
    ["Réservations hôtels", clientRoutes.reservations, "reservations"],
    ["Visites immobilières", clientRoutes.visits, "visits"],
    ["Locations voitures", clientRoutes.rentals, "rentals"],
    ["Chauffeur", clientRoutes.chauffeur, "chauffeur"],
    ["Trajets interurbains", clientRoutes.trips, "trips"],
    ["Paramètres", clientRoutes.settings, "settings"]
  ];

  return `
    <div class="client-sidebar-backdrop" data-close-client-sidebar hidden></div>
    <aside class="client-sidebar" id="client-sidebar">
      <button class="client-sidebar-close" type="button" data-close-client-sidebar aria-label="Fermer le menu">✕</button>
      <a class="dashboard-brand" href="${clientRouteHref(clientRoutes.home)}" aria-label="Accueil du site Péncmi"><span>P</span><div><strong>Péncmi</strong><small>Espace client</small></div></a>
      <nav class="client-nav">${nav.map(([label, href, key, badge]) => `<a href="${clientRouteHref(href)}"${key === currentPage ? ' aria-current="page"' : ""}><span>${label}</span>${typeof badge === "number" ? `<span class="notification-badge">${badge}</span>` : ""}</a>`).join("")}</nav>
      <button class="client-sidebar-logout" type="button" data-client-logout>Se déconnecter</button>
    </aside>
  `;
}

function ClientOverviewPage() {
  // Each tile is a link to the matching page, so the overview needs no separate shortcut lists.
  const summaries = [
    ["Messages non lus", clientUnreadLoaded ? clientMessages.reduce((total, item) => total + item.unreadCount, 0) : "—", clientRoutes.messages],
    ["Favoris", clientCounts.favorites ?? "—", clientRoutes.favorites],
    ["Alertes actives", clientCounts.activeAlerts ?? "—", clientRoutes.alerts],
    ["Notifications", clientCounts.unreadNotifications ?? "—", clientRoutes.notifications],
  ];
  const requests = [
    ["Hôtels", "hotel", clientRoutes.reservations],
    ["Visites", "visit", clientRoutes.visits],
    ["Locations", "rental", clientRoutes.rentals],
    ["Chauffeur", "chauffeur", clientRoutes.chauffeur],
    ["Trajets", "trip", clientRoutes.trips],
  ];
  const searches = [
    ["Un bien immobilier", clientRoutes.realEstate],
    ["Un hôtel", clientRoutes.hotels],
    ["Une voiture", clientRoutes.vehicles],
    ["Un trajet", clientRoutes.voyages],
  ];

  return ClientAccountLayout(`
    <section class="client-summary-grid" aria-label="Mon activité">${summaries.map(([label, value, href]) => ClientSummaryCard(label, value, href)).join("")}</section>
    <div id="pencmi-request-summary-status" role="status"></div>
    <section class="client-section">
      <h2 class="client-section-title">Mes demandes</h2>
      <div class="client-summary-grid client-request-grid">${requests.map(([label, type, href]) => ClientSummaryCard(label, `<span data-request-total="${type}">—</span>`, href)).join("")}</div>
    </section>
    <section class="client-section">
      <h2 class="client-section-title">Rechercher</h2>
      <div class="client-search-chips">${searches.map(([label, href]) => `<a href="${clientRouteHref(href)}">${label}</a>`).join("")}</div>
    </section>
  `);
}

function ClientSummaryCard(label, value = 0, href) {
  const inner = `<span>${label}</span><div class="client-summary-value">${value}</div>`;
  return href ? `<a class="client-summary-card" href="${clientRouteHref(href)}">${inner}</a>` : `<article class="client-summary-card">${inner}</article>`;
}

function ClientMessagesPage() {
  return ClientAccountLayout(`<div id="pencmi-inbox"></div>`, "messages", "Messages", "Retrouvez vos conversations avec les annonceurs immobiliers, hôtels, loueurs, garages, chauffeurs et transporteurs.");
}

function ClientFavoritesPage() {
  return ClientAccountLayout(`<div id="pencmi-favorites"></div>`, "favorites", "Mes favoris", "Retrouvez vos biens, hébergements, voitures et trajets sauvegardés.");
}

function ClientAlertsPage() {
  return ClientAccountLayout(`<div id="pencmi-alerts"></div>`, "alerts", "Mes alertes", "Gérez vos recherches sauvegardées sur tous les univers Péncmi.");
}

function ClientNotificationsPage() {
  return ClientAccountLayout(`<div id="pencmi-notifications"></div>`, "notifications", "Notifications", "Consultez vos notifications internes et les actions associées.");
}

function ClientHotelReservationsPage() {
  return ClientRequestPage("reservations", "Réservations hôtels", "hotel");
}

function ClientRealEstateVisitsPage() {
  return ClientRequestPage("visits", "Visites immobilières", "visit");
}

function ClientVehicleRentalsPage() {
  return ClientRequestPage("rentals", "Locations voitures", "rental");
}

function ClientChauffeurRequestsPage() {
  return ClientRequestPage("chauffeur", "Demandes chauffeur", "chauffeur");
}

function ClientTripRequestsPage() {
  return ClientRequestPage("trips", "Trajets interurbains", "trip");
}

function ClientRequestPage(currentPage, title, type) {
  return ClientAccountLayout(`
    <div id="pencmi-client-requests" data-request-type="${type}"></div>
  `, currentPage, title, "Suivez le statut, les messages et les actions disponibles pour vos demandes.");
}

function ClientProfilePage() {
  return ClientAccountLayout('<div id="pencmi-account-profile"></div>', "profile", "Profil", "Gérez vos informations personnelles et votre photo.");
}

function ClientSettingsPage() {
  return ClientAccountLayout('<div id="pencmi-account-settings"></div>', "settings", "Paramètres", "Sécurité et gestion de votre compte.");
}

function ClientCheckbox(label) {
  return `<label class="client-option"><input type="checkbox"><span>${label}</span></label>`;
}

function ClientTabs(labels) {
  return `<section class="client-card"><div class="client-tabs">${labels.map((label, index) => `<button type="button" aria-pressed="${index === 0}">${label}</button>`).join("")}</div></section>`;
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
  // Mobile menu: closes with the ✕ button, a tap outside, the Escape key or a choice.
  const sidebar = document.querySelector("#client-sidebar");
  const toggle = document.querySelector("[data-open-client-sidebar]");
  const backdrop = document.querySelector(".client-sidebar-backdrop");
  const setSidebar = (open) => {
    if (!sidebar) return;
    sidebar.classList.toggle("is-open", open);
    if (backdrop) backdrop.hidden = !open;
    toggle?.setAttribute("aria-expanded", String(open));
    document.body.classList.toggle("client-menu-open", open);
    if (open) sidebar.querySelector("a, button")?.focus();
    else toggle?.focus();
  };
  toggle?.addEventListener("click", () => setSidebar(!sidebar?.classList.contains("is-open")));
  document.querySelectorAll("[data-close-client-sidebar]").forEach((button) => button.addEventListener("click", () => setSidebar(false)));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && sidebar?.classList.contains("is-open")) setSidebar(false);
  });

  document.querySelectorAll("[data-client-form]").forEach((form) => {
    form.querySelectorAll('input, select, textarea, button').forEach((control) => { control.disabled = true; });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
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
  const inbox = document.querySelector("#pencmi-inbox");
  if (inbox) void import("../messaging/inbox.mjs").then(({ mountInbox }) => mountInbox(inbox, { scope: "participant", emptyTitle: "Vous n’avez aucun message pour le moment.", emptyText: "Écrivez à un annonceur depuis une annonce où la messagerie est activée." }));
  const favorites = document.querySelector("#pencmi-favorites");
  if (favorites) void import("../saved/favorites-page.mjs").then(({ mountFavorites }) => mountFavorites(favorites, { title: "Tous mes favoris" }));
  const alerts = document.querySelector("#pencmi-alerts");
  if (alerts) void import("../saved/alerts-page.mjs").then(({ mountAlerts }) => mountAlerts(alerts, { title: "Toutes mes alertes" }));
  const notifications = document.querySelector("#pencmi-notifications");
  if (notifications) void import("../saved/notifications-page.mjs").then(({ mountNotifications }) => mountNotifications(notifications));
  const requests = document.querySelector('#pencmi-client-requests');
  if (requests) void import('./requests-page.mjs').then(({ mountClientRequests }) => mountClientRequests(requests, requests.dataset.requestType));
  const summary = document.querySelector('#pencmi-request-summary-status');
  if (summary) void import('./requests-page.mjs').then(({ mountRequestSummary }) => mountRequestSummary(summary));
  const profile = document.querySelector('#pencmi-account-profile');
  if (profile) void import('./profile-page.mjs').then(({ mountAccountProfile }) => mountAccountProfile(profile));
  const settings = document.querySelector('#pencmi-account-settings');
  if (settings) void import('./settings-page.mjs').then(({ mountAccountSettings }) => mountAccountSettings(settings));
}

/** Unread counts of the most recent conversations, shown only once the API has answered. */
async function loadClientUnread() {
  try {
    const { apiRequest, hasSession } = await import("../messaging/messaging-ui.mjs");
    if (!hasSession()) return;
    clientMessages.splice(0, clientMessages.length, ...await apiRequest("/messages/conversations?limit=100"));
    clientUnreadLoaded = true;
    const [favorites, alerts, notifications] = await Promise.all([
      apiRequest("/favorites?limit=1", { includeMeta: true }),
      apiRequest("/saved-alerts?limit=100"),
      apiRequest("/notifications"),
    ]);
    clientCounts.favorites = favorites.meta?.total ?? null;
    clientCounts.activeAlerts = alerts.filter((item) => item.active).length;
    clientCounts.unreadNotifications = notifications.filter((item) => item.status === "unread").length;
    if (document.body.dataset.clientPage === "overview") renderClientSpace();
  } catch {
    clientUnreadLoaded = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderClientSpace();
  void loadClientUnread();
});

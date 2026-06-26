const vehicleDashboardRoutes = {
  overview: "/dashboard/voitures",
  listings: "/dashboard/voitures/annonces",
  messages: "/dashboard/voitures/messages",
  contacts: "/dashboard/voitures/contacts",
  statistics: "/dashboard/voitures/statistiques",
  contactSettings: "/dashboard/voitures/contact-settings",
  emailSettings: "/dashboard/voitures/email-settings",
  publish: "/publier?category=voiture"
};

const vehicleDashboardData = {
  listings: [],
  messages: [],
  contacts: [],
  requests: [],
  stats: null,
  loading: true,
  error: ""
};

const VEHICLE_ACCESS_TOKEN_STORAGE_KEY = "pencmi_access_token";
const VEHICLE_REFRESH_TOKEN_STORAGE_KEY = "pencmi_refresh_token";
const VEHICLE_SESSION_STORAGE_KEY = "pencmi_current_session";

function vehicleApiBaseUrl() {
  return String(window.PencmiConfig?.apiBaseUrl || window.PencmiRuntimeConfig?.apiBaseUrl || window.PencmiApiBaseUrl || window.localStorage.getItem("pencmi_api_base_url") || "").replace(/\/+$/, "");
}

function vehicleAccessToken() {
  return window.localStorage.getItem(VEHICLE_ACCESS_TOKEN_STORAGE_KEY) || "";
}

async function vehicleLogout() {
  const baseUrl = vehicleApiBaseUrl();
  const token = vehicleAccessToken();
  if (baseUrl && token) {
    await fetch(`${baseUrl}/auth/logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }).catch(() => null);
  }
  window.localStorage.removeItem(VEHICLE_ACCESS_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(VEHICLE_REFRESH_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(VEHICLE_SESSION_STORAGE_KEY);
  window.location.href = vehicleDashboardRouteHref("/login");
}

function vehicleListFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

async function vehicleApiRequest(path) {
  const baseUrl = vehicleApiBaseUrl();
  const token = vehicleAccessToken();
  if (!baseUrl || !token) {
    throw new Error("Connexion annonceur requise.");
  }
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message || "Chargement impossible.");
  }
  return payload?.data ?? payload;
}

function formatVehicleDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fr-FR");
}

function vehicleDashboardRouteHref(path) {
  if (window.location.protocol !== "file:" && /^\/voitures\/[^/]+$/.test(path)) {
    return `/voitures/detail/?id=${encodeURIComponent(path.slice("/voitures/".length))}`;
  }
  if (window.location.protocol !== "file:") {
    return path;
  }
  const page = document.body.dataset.vehicleDashboardPage;
  const fromRoot = page === "overview";
  const prefix = fromRoot ? "./" : "../";
  const map = {
    [vehicleDashboardRoutes.overview]: fromRoot ? "./" : "../",
    [vehicleDashboardRoutes.listings]: `${prefix}annonces/`,
    [vehicleDashboardRoutes.messages]: `${prefix}messages/`,
    [vehicleDashboardRoutes.contacts]: `${prefix}contacts/`,
    [vehicleDashboardRoutes.statistics]: `${prefix}statistiques/`,
    [vehicleDashboardRoutes.contactSettings]: `${prefix}contact-settings/`,
    [vehicleDashboardRoutes.emailSettings]: `${prefix}email-settings/`,
    [vehicleDashboardRoutes.publish]: fromRoot ? "../../publier/?category=voiture" : "../../../publier/?category=voiture"
  };
  return map[path] || path;
}

function VehiclesDashboardLayout(content, currentPage) {
  return `
    <div class="vehicle-dashboard-layout">
      <div class="vehicle-dashboard-shell">
        ${VehiclesDashboardSidebar(currentPage)}
        <section class="vehicle-dashboard-main">${content}</section>
      </div>
    </div>
  `;
}

function VehiclesDashboardSidebar(currentPage) {
  const listingCount = String(vehicleDashboardData.listings.length || 0);
  const contactCount = String(vehicleDashboardData.requests.length || 0);
  const items = [
    ["Vue d’ensemble", vehicleDashboardRoutes.overview, "overview"],
    ["Annonces", vehicleDashboardRoutes.listings, "listings", listingCount],
    ["Messages", vehicleDashboardRoutes.messages, "messages"],
    ["Contacts", vehicleDashboardRoutes.contacts, "contacts", contactCount],
    ["Statistiques", vehicleDashboardRoutes.statistics, "statistics"],
    ["Moyens de contact", vehicleDashboardRoutes.contactSettings, "contactSettings"],
    ["Emails automatiques", vehicleDashboardRoutes.emailSettings, "emailSettings"]
  ];
  return `<aside class="dashboard-sidebar" id="vehicle-sidebar"><div class="dashboard-brand"><span>P</span><div><strong>Péncmi</strong><small>Annonceur voitures</small></div></div><nav class="dashboard-nav">${items.map(([label, href, key, badge]) => `<a href="${vehicleDashboardRouteHref(href)}"${key === currentPage ? ' aria-current="page"' : ""}><span>${label}</span>${badge ? `<span class="notification-badge">${badge}</span>` : ""}</a>`).join("")}</nav></aside>`;
}

function DashboardHeader(title, subtitle, actions = "") {
  const bell = typeof NotificationBell === "function" ? NotificationBell() : `<a class="btn btn-ghost" href="${vehicleDashboardRouteHref("/dashboard/notifications")}">Notifications</a>`;
  return `<header class="vehicle-dashboard-header"><div><button class="btn btn-ghost dashboard-menu-toggle" type="button" data-open-sidebar>Menu</button><h1>${title}</h1><p>${subtitle}</p></div><div class="dashboard-header-actions">${bell}${actions}<button class="btn btn-ghost" type="button" data-dashboard-logout>Se déconnecter</button></div></header>`;
}

function KpiCard(title, value) {
  return `<article class="kpi-card"><span class="kpi-icon">VO</span><h3>${title}</h3>${value ? `<div class="kpi-value">${value}</div>` : `<div class="kpi-empty">Aucune donnée disponible</div>`}</article>`;
}

function EmptyState(title, text = "", action = "") {
  return `<section class="vehicle-empty-dashboard"><div><h2>${title}</h2>${text ? `<p>${text}</p>` : ""}${action ? `<div class="vehicle-empty-actions">${action}</div>` : ""}</div></section>`;
}

function VehiclesDashboardPage() {
  if (vehicleDashboardData.loading) {
    return VehiclesDashboardLayout(`${DashboardHeader("Dashboard voitures", "Chargement de vos données annonceur.")}${EmptyState("Chargement en cours.")}`, "overview");
  }
  if (vehicleDashboardData.error) {
    return VehiclesDashboardLayout(`${DashboardHeader("Dashboard voitures", "Vos données annonceur.")}${EmptyState(vehicleDashboardData.error)}`, "overview");
  }
  const activeListings = vehicleDashboardData.listings.filter((listing) => listing.status === "active").length;
  const pendingListings = vehicleDashboardData.listings.filter((listing) => listing.status === "pending_review").length;
  const kpis = [
    ["Annonces actives", activeListings],
    ["Annonces en attente", pendingListings],
    ["Demandes location/chauffeur", vehicleDashboardData.requests.length],
    ["Messages reçus", vehicleDashboardData.messages.length],
    ["Contacts", vehicleDashboardData.contacts.length]
  ];
  return VehiclesDashboardLayout(`
    ${DashboardHeader("Dashboard voitures", "Suivez vos annonces, contacts, messages et performances.", `<a class="btn btn-primary" href="${vehicleDashboardRouteHref(vehicleDashboardRoutes.publish)}">Publier une voiture</a>`)}
    <section class="vehicle-kpi-grid">${kpis.map(([title, value]) => KpiCard(title, String(value))).join("")}</section>
    ${vehicleDashboardData.listings.length || vehicleDashboardData.requests.length ? "" : EmptyState("Aucune donnée disponible pour le moment.")}
  `, "overview");
}

function VehicleListingsDashboardPage() {
  return VehiclesDashboardLayout(`
    ${DashboardHeader("Mes annonces voitures", "Gérez vos véhicules publiés et leurs performances.", `<a class="btn btn-primary" href="${vehicleDashboardRouteHref(vehicleDashboardRoutes.publish)}">Publier ma première voiture</a>`)}
    ${vehicleDashboardData.listings.length ? VehicleListingsTable() : EmptyState("Vous n’avez aucune annonce voiture pour le moment.", "", `<a class="btn btn-primary" href="${vehicleDashboardRouteHref(vehicleDashboardRoutes.publish)}">Publier ma première voiture</a>`)}
  `, "listings");
}

function VehicleListingsTable() {
  return `<section class="vehicle-table-wrap"><table class="vehicle-table"><thead><tr><th>Voiture</th><th>Statut</th><th>Ville</th><th>Type</th><th>Prix</th><th>Demandes</th><th>Actions</th></tr></thead><tbody>${vehicleDashboardData.listings.map((listing) => {
    const requests = vehicleDashboardData.requests.filter((request) => request.listing?.id === listing.id).length;
    return `<tr><td>${listing.title}</td><td>${listing.status}</td><td>${listing.city || ""}</td><td>${listing.vehicleMode || ""}</td><td>${listing.price || ""}</td><td>${requests}</td><td><a class="btn btn-ghost" href="${vehicleDashboardRouteHref(`/voitures/${listing.id}`)}">Voir</a></td></tr>`;
  }).join("")}</tbody></table></section>`;
}

function VehicleMessagesPage() {
  return VehiclesDashboardLayout(`${DashboardHeader("Messages voitures", "Suivez les conversations clients, le véhicule concerné et vos réponses.")}${EmptyState("Aucun message reçu pour le moment.", "Les messages clients liés à vos véhicules apparaîtront ici.")}`, "messages");
}

function VehicleContactsPage() {
  const sources = ["WhatsApp", "Téléphone", "Email", "Message interne", "Formulaire"];
  return VehiclesDashboardLayout(`
    ${DashboardHeader("Contacts reçus", "Suivez les contacts générés par vos annonces voitures.")}
    <section class="vehicle-dashboard-card"><h2>Sources prévues</h2><div class="vehicle-chip-row">${sources.map((source) => `<span class="vehicle-chip">${source}</span>`).join("")}</div></section>
    ${vehicleDashboardData.requests.length ? `<section class="vehicle-table-wrap"><table class="vehicle-table"><thead><tr><th>Client</th><th>Annonce</th><th>Type</th><th>Début</th><th>Fin</th><th>Message</th><th>Statut</th><th>Date</th></tr></thead><tbody>${vehicleDashboardData.requests.map((request) => `<tr><td>${request.clientName || "Client"}</td><td>${request.listing?.title || "Annonce"}</td><td>${request.requestType || request.listing?.vehicleMode || ""}</td><td>${formatVehicleDate(request.startDate || request.serviceDate)}</td><td>${formatVehicleDate(request.endDate)}</td><td>${request.message || ""}</td><td>${request.status}</td><td>${formatVehicleDate(request.createdAt)}</td></tr>`).join("")}</tbody></table></section>` : EmptyState("Aucun contact reçu pour le moment.")}
  `, "contacts");
}

function VehicleStatisticsPage() {
  const kpis = ["Vues", "Clics détails", "Favoris", "Contacts", "Messages", "Clics WhatsApp", "Clics téléphone", "Clics email", "Taux vue → contact", "Délai moyen de réponse"];
  return VehiclesDashboardLayout(`
    ${DashboardHeader("Statistiques voitures", "Analysez les performances détaillées de vos annonces.")}
    <section class="vehicle-kpi-grid">${kpis.map((title) => KpiCard(title)).join("")}</section>
    ${EmptyState("Aucune statistique disponible pour le moment.")}
    <div class="dashboard-grid"><section class="vehicle-dashboard-card"><h2>Annonces les plus consultées</h2><div class="vehicle-chart-placeholder">Bloc graphique prévu</div></section><section class="vehicle-dashboard-card"><h2>Annonces sans contact</h2><div class="vehicle-chart-placeholder">Bloc prévu</div></section><section class="vehicle-dashboard-card"><h2>Annonces à améliorer</h2><div class="vehicle-chart-placeholder">Bloc prévu</div></section></div>
  `, "statistics");
}

function VehicleContactSettingsPage() {
  const notificationTriggers = ["Nouveau message", "Nouveau formulaire", "Nouveau contact"];
  return VehiclesDashboardLayout(`
    ${DashboardHeader("Moyens de contact", "Configurez les contacts et notifications email pour vos annonces voitures.", `<a class="btn btn-light" href="${vehicleDashboardRouteHref(vehicleDashboardRoutes.emailSettings)}">Emails automatiques</a>`)}
    <section class="vehicle-dashboard-card">
      <h2>Paramètres de contact voitures</h2>
      <div class="vehicle-form-grid">
        ${["WhatsApp", "Téléphone", "Email", "Messagerie interne", "Formulaire", "Notifications email", "Emails automatiques client"].map((item) => `<label class="choice-card"><input type="checkbox"><span>${item}</span></label>`).join("")}
        <label class="vehicle-form-field"><span>Numéro WhatsApp</span><input type="tel"></label>
        <label class="vehicle-form-field"><span>Numéro téléphone</span><input type="tel"></label>
        <label class="vehicle-form-field"><span>Email de contact</span><input type="email"></label>
        <label class="vehicle-form-field"><span>Email de notification</span><input type="email"></label>
        <label class="vehicle-form-field"><span>Méthode préférée</span><select><option>WhatsApp</option><option>Téléphone</option><option>Email</option><option>Message interne</option><option>Formulaire</option></select></label>
      </div>
      <div class="vehicle-form-actions"><button class="btn btn-primary" type="button" data-save-contact-settings>Enregistrer</button></div>
      <p id="vehicle-contact-settings-message" hidden>Vos moyens de contact ont été mis à jour.</p>
    </section>
    <section class="vehicle-dashboard-card">
      <h2>Résumé et aperçu client</h2>
      <p class="dashboard-muted">Les boutons visibles s’adaptent au type d’annonce : vente, location ou chauffeur.</p>
      <div class="vehicle-chip-row">${["Contacter le vendeur", "Demander une location", "Demander un chauffeur", "Envoyer un message", "Appeler", "WhatsApp", "Email"].map((item) => `<span class="vehicle-chip">${item}</span>`).join("")}</div>
    </section>
    <section class="vehicle-dashboard-card">
      <h2>Notifications email prévues</h2>
      <p class="dashboard-muted">Objet futur : Nouveau contact sur votre annonce voiture Péncmi.</p>
      <div class="vehicle-chip-row">${notificationTriggers.map((trigger) => `<span class="vehicle-chip">${trigger}</span>`).join("")}</div>
      <p class="dashboard-muted">L’email contiendra le véhicule concerné, le type de contact, un extrait du message et un lien vers le dashboard.</p>
    </section>
  `, "contactSettings");
}

function renderDashboard() {
  const page = document.body.dataset.vehicleDashboardPage;
  const pages = {
    overview: VehiclesDashboardPage,
    listings: VehicleListingsDashboardPage,
    messages: VehicleMessagesPage,
    contacts: VehicleContactsPage,
    statistics: VehicleStatisticsPage,
    contactSettings: VehicleContactSettingsPage
  };
  document.querySelector("#vehicle-dashboard-root").innerHTML = pages[page]();
  document.querySelector("[data-open-sidebar]")?.addEventListener("click", () => document.querySelector("#vehicle-sidebar").classList.toggle("is-open"));
  document.querySelector("[data-dashboard-logout]")?.addEventListener("click", () => {
    void vehicleLogout();
  });
  document.querySelector("[data-save-contact-settings]")?.addEventListener("click", () => {
    document.querySelector("#vehicle-contact-settings-message").hidden = false;
  });
}

async function loadVehicleDashboardData() {
  vehicleDashboardData.loading = true;
  vehicleDashboardData.error = "";
  renderDashboard();
  try {
    const [listingsPayload, rentalPayload, chauffeurPayload] = await Promise.all([
      vehicleApiRequest("/dashboard/voitures"),
      vehicleApiRequest("/dashboard/voitures/rental-requests"),
      vehicleApiRequest("/dashboard/voitures/chauffeur-requests"),
    ]);
    const rentalRequests = vehicleListFromPayload(rentalPayload).map((request) => ({ ...request, requestType: "location" }));
    const chauffeurRequests = vehicleListFromPayload(chauffeurPayload).map((request) => ({ ...request, requestType: "chauffeur" }));
    vehicleDashboardData.listings = vehicleListFromPayload(listingsPayload);
    vehicleDashboardData.requests = [...rentalRequests, ...chauffeurRequests].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  } catch (error) {
    vehicleDashboardData.error = error instanceof Error ? error.message : "Chargement impossible.";
  } finally {
    vehicleDashboardData.loading = false;
    renderDashboard();
  }
}

void loadVehicleDashboardData();

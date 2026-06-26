const tripDashboardRoutes = {
  overview: "/dashboard/voyages",
  listings: "/dashboard/voyages/trajets",
  messages: "/dashboard/voyages/messages",
  reservations: "/dashboard/voyages/reservations",
  contacts: "/dashboard/voyages/contacts",
  statistics: "/dashboard/voyages/statistiques",
  contactSettings: "/dashboard/voyages/contact-settings",
  emailSettings: "/dashboard/voyages/email-settings",
  publish: "/publier?category=voyage"
};

const tripDashboardData = {
  trips: [],
  messages: [],
  reservations: [],
  contacts: [],
  stats: null,
  loading: true,
  error: ""
};

const TRIP_ACCESS_TOKEN_STORAGE_KEY = "pencmi_access_token";
const TRIP_REFRESH_TOKEN_STORAGE_KEY = "pencmi_refresh_token";
const TRIP_SESSION_STORAGE_KEY = "pencmi_current_session";

function tripApiBaseUrl() {
  return String(window.PencmiConfig?.apiBaseUrl || window.PencmiRuntimeConfig?.apiBaseUrl || window.PencmiApiBaseUrl || window.localStorage.getItem("pencmi_api_base_url") || "").replace(/\/+$/, "");
}

function tripAccessToken() {
  return window.localStorage.getItem(TRIP_ACCESS_TOKEN_STORAGE_KEY) || "";
}

async function tripLogout() {
  const baseUrl = tripApiBaseUrl();
  const token = tripAccessToken();
  if (baseUrl && token) {
    await fetch(`${baseUrl}/auth/logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }).catch(() => null);
  }
  window.localStorage.removeItem(TRIP_ACCESS_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(TRIP_REFRESH_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(TRIP_SESSION_STORAGE_KEY);
  window.location.href = tripDashboardRouteHref("/login");
}

function tripListFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

async function tripApiRequest(path, options = {}) {
  const baseUrl = tripApiBaseUrl();
  const token = tripAccessToken();
  if (!baseUrl || !token) {
    throw new Error("Connexion annonceur requise.");
  }
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message || "Chargement impossible.");
  }
  return payload?.data ?? payload;
}

const tripReservationStatusLabels = {
  new: "Nouvelle",
  pending: "En attente",
  accepted: "Acceptée",
  refused: "Refusée",
  cancelled: "Annulée",
  completed: "Terminée",
  requires_more_info: "Infos demandées"
};

function formatTripReservationStatus(status) {
  return tripReservationStatusLabels[status] || "À traiter";
}

function formatTripDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fr-FR");
}

function tripDashboardRouteHref(path) {
  if (window.location.protocol !== "file:" && /^\/voyages\/[^/]+$/.test(path)) {
    return `/voyages/detail/?id=${encodeURIComponent(path.slice("/voyages/".length))}`;
  }
  if (window.location.protocol !== "file:") {
    return path;
  }
  const page = document.body.dataset.tripDashboardPage;
  const fromRoot = page === "overview";
  const prefix = fromRoot ? "./" : "../";
  const map = {
    [tripDashboardRoutes.overview]: fromRoot ? "./" : "../",
    [tripDashboardRoutes.listings]: `${prefix}trajets/`,
    [tripDashboardRoutes.messages]: `${prefix}messages/`,
    [tripDashboardRoutes.reservations]: `${prefix}reservations/`,
    [tripDashboardRoutes.contacts]: `${prefix}contacts/`,
    [tripDashboardRoutes.statistics]: `${prefix}statistiques/`,
    [tripDashboardRoutes.contactSettings]: `${prefix}contact-settings/`,
    [tripDashboardRoutes.emailSettings]: `${prefix}email-settings/`,
    [tripDashboardRoutes.publish]: fromRoot ? "../../publier/?category=voyage" : "../../../publier/?category=voyage"
  };
  return map[path] || path;
}

function TripsDashboardLayout(content, currentPage) {
  return `<div class="trip-dashboard-layout"><div class="trip-dashboard-shell">${TripsDashboardSidebar(currentPage)}<section class="trip-dashboard-main">${content}</section></div></div>`;
}

function TripsDashboardSidebar(currentPage) {
  const listingCount = String(tripDashboardData.trips.length || 0);
  const reservationCount = String(tripDashboardData.reservations.length || 0);
  const items = [
    ["Vue d’ensemble", tripDashboardRoutes.overview, "overview"],
    ["Trajets", tripDashboardRoutes.listings, "listings", listingCount],
    ["Messages", tripDashboardRoutes.messages, "messages"],
    ["Demandes de place", tripDashboardRoutes.reservations, "reservations", reservationCount],
    ["Contacts", tripDashboardRoutes.contacts, "contacts", reservationCount],
    ["Statistiques", tripDashboardRoutes.statistics, "statistics"],
    ["Moyens de contact", tripDashboardRoutes.contactSettings, "contactSettings"],
    ["Emails automatiques", tripDashboardRoutes.emailSettings, "emailSettings"]
  ];
  return `<aside class="dashboard-sidebar" id="trip-sidebar"><div class="dashboard-brand"><span>P</span><div><strong>Péncmi</strong><small>Annonceur voyages</small></div></div><nav class="dashboard-nav">${items.map(([label, href, key, badge]) => `<a href="${tripDashboardRouteHref(href)}"${key === currentPage ? ' aria-current="page"' : ""}><span>${label}</span>${badge ? `<span class="notification-badge">${badge}</span>` : ""}</a>`).join("")}</nav></aside>`;
}

function DashboardHeader(title, subtitle, actions = "") {
  const bell = typeof NotificationBell === "function" ? NotificationBell() : `<a class="btn btn-ghost" href="${tripDashboardRouteHref("/dashboard/notifications")}">Notifications</a>`;
  return `<header class="trip-dashboard-header"><div><button class="btn btn-ghost dashboard-menu-toggle" type="button" data-open-sidebar>Menu</button><h1>${title}</h1><p>${subtitle}</p></div><div class="dashboard-header-actions">${bell}${actions}<button class="btn btn-ghost" type="button" data-dashboard-logout>Se déconnecter</button></div></header>`;
}

function KpiCard(title, value) {
  return `<article class="kpi-card"><span class="kpi-icon">TR</span><h3>${title}</h3>${value ? `<div class="kpi-value">${value}</div>` : `<div class="kpi-empty">Aucune donnée disponible</div>`}</article>`;
}

function EmptyState(title, text = "", action = "") {
  return `<section class="trip-empty-dashboard"><div><h2>${title}</h2>${text ? `<p>${text}</p>` : ""}${action ? `<div class="trip-empty-actions">${action}</div>` : ""}</div></section>`;
}

function TripsDashboardPage() {
  if (tripDashboardData.loading) {
    return TripsDashboardLayout(`${DashboardHeader("Dashboard voyages", "Chargement de vos données annonceur.")}${EmptyState("Chargement en cours.")}`, "overview");
  }
  if (tripDashboardData.error) {
    return TripsDashboardLayout(`${DashboardHeader("Dashboard voyages", "Vos données annonceur.")}${EmptyState(tripDashboardData.error)}`, "overview");
  }
  const activeTrips = tripDashboardData.trips.filter((trip) => trip.status === "active").length;
  const pendingTrips = tripDashboardData.trips.filter((trip) => trip.status === "pending_review").length;
  const requestedSeats = tripDashboardData.reservations.reduce((total, request) => total + Number(request.requestedSeats || 0), 0);
  const kpis = [
    ["Trajets actifs", activeTrips],
    ["Trajets en attente", pendingTrips],
    ["Demandes de place", tripDashboardData.reservations.length],
    ["Places demandées", requestedSeats],
    ["Messages reçus", tripDashboardData.messages.length],
    ["Contacts", tripDashboardData.contacts.length]
  ];
  return TripsDashboardLayout(`
    ${DashboardHeader("Dashboard voyages", "Suivez vos trajets, demandes, contacts, messages et performances.", `<a class="btn btn-primary" href="${tripDashboardRouteHref(tripDashboardRoutes.publish)}">Publier un trajet</a>`)}
    <section class="trip-kpi-grid">${kpis.map(([title, value]) => KpiCard(title, String(value))).join("")}</section>
    ${tripDashboardData.trips.length || tripDashboardData.reservations.length ? "" : EmptyState("Aucune donnée disponible pour le moment.")}
  `, "overview");
}

function TripListingsDashboardPage() {
  return TripsDashboardLayout(`
    ${DashboardHeader("Mes trajets", "Gérez vos trajets publiés, leurs places et leurs performances.", `<a class="btn btn-primary" href="${tripDashboardRouteHref(tripDashboardRoutes.publish)}">Publier mon premier trajet</a>`)}
    ${tripDashboardData.trips.length ? TripListingsTable() : EmptyState("Vous n’avez aucun trajet publié pour le moment.", "", `<a class="btn btn-primary" href="${tripDashboardRouteHref(tripDashboardRoutes.publish)}">Publier mon premier trajet</a>`)}
  `, "listings");
}

function TripListingsTable() {
  return `<section class="trip-table-wrap"><table class="trip-table"><thead><tr><th>Trajet</th><th>Statut</th><th>Départ</th><th>Arrivée</th><th>Date</th><th>Heure</th><th>Places</th><th>Demandes</th><th>Actions</th></tr></thead><tbody>${tripDashboardData.trips.map((trip) => {
    const requests = tripDashboardData.reservations.filter((request) => request.trip?.id === trip.id).length;
    return `<tr><td>${trip.title}</td><td>${trip.status}</td><td>${trip.departureCity || ""}</td><td>${trip.arrivalCity || ""}</td><td>${formatTripDate(trip.departureDate)}</td><td>${trip.departureTime || ""}</td><td>${trip.availableSeats || ""}</td><td>${requests}</td><td><a class="btn btn-ghost" href="${tripDashboardRouteHref(`/voyages/${trip.id}`)}">Voir</a></td></tr>`;
  }).join("")}</tbody></table></section>`;
}

function TripMessagesPage() {
  return TripsDashboardLayout(`${DashboardHeader("Messages voyages", "Suivez les conversations clients, les trajets concernés et vos réponses.")}${EmptyState("Aucun message reçu pour le moment.", "Les messages clients liés à vos trajets apparaîtront ici.")}`, "messages");
}

function TripReservationsPage() {
  return TripsDashboardLayout(`
    ${DashboardHeader("Demandes de place", "Gérez les demandes de réservation reçues sur vos trajets.")}
    ${tripDashboardData.reservations.length ? `<section class="trip-table-wrap"><table class="trip-table"><thead><tr><th>Client</th><th>Trajet</th><th>Places demandées</th><th>Bagages</th><th>Message</th><th>Statut</th><th>Date</th><th>Actions</th></tr></thead><tbody>${tripDashboardData.reservations.map(TripReservationRow).join("")}</tbody></table></section>` : EmptyState("Aucune demande de place pour le moment.")}
  `, "reservations");
}

function TripReservationRow(request) {
  return `
    <tr>
      <td>${request.clientName || "Client"}</td>
      <td>${request.trip?.title || "Trajet"}</td>
      <td>${request.requestedSeats || ""}</td>
      <td>${request.luggage ? "Oui" : "Non"}</td>
      <td>${request.message || ""}</td>
      <td>${formatTripReservationStatus(request.status)}</td>
      <td>${formatTripDate(request.createdAt)}</td>
      <td>
        <div class="trip-row-actions">
          <button class="btn btn-primary" type="button" data-trip-request-status="accepted" data-trip-request-id="${request.id}">Accepter</button>
          <button class="btn btn-ghost" type="button" data-trip-request-status="requires_more_info" data-trip-request-id="${request.id}">Demander des infos</button>
          <button class="btn btn-ghost" type="button" data-trip-request-status="refused" data-trip-request-id="${request.id}">Refuser</button>
          <button class="btn btn-ghost" type="button" data-trip-request-status="completed" data-trip-request-id="${request.id}">Terminer</button>
        </div>
      </td>
    </tr>
  `;
}

async function updateTripReservationStatus(id, status) {
  const updated = await tripApiRequest(`/dashboard/voyages/seat-requests/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
  tripDashboardData.reservations = tripDashboardData.reservations.map((request) => request.id === id ? updated : request);
  renderDashboard();
}

function TripContactsPage() {
  const sources = ["WhatsApp", "Téléphone", "Email", "Message interne", "Formulaire", "Demande de place"];
  return TripsDashboardLayout(`
    ${DashboardHeader("Contacts reçus", "Suivez les contacts générés par vos trajets.")}
    <section class="trip-dashboard-card"><h2>Sources prévues</h2><div class="trip-chip-row">${sources.map((source) => `<span class="trip-chip">${source}</span>`).join("")}</div></section>
    ${tripDashboardData.reservations.length ? `<section class="trip-table-wrap"><table class="trip-table"><thead><tr><th>Client</th><th>Trajet</th><th>Téléphone</th><th>Email</th><th>Places</th><th>Message</th><th>Source</th><th>Date</th></tr></thead><tbody>${tripDashboardData.reservations.map((request) => `<tr><td>${request.clientName || "Client"}</td><td>${request.trip?.title || "Trajet"}</td><td>${request.clientPhone || ""}</td><td>${request.clientEmail || ""}</td><td>${request.requestedSeats || ""}</td><td>${request.message || ""}</td><td>Demande de place</td><td>${formatTripDate(request.createdAt)}</td></tr>`).join("")}</tbody></table></section>` : EmptyState("Aucun contact reçu pour le moment.")}
  `, "contacts");
}

function TripStatisticsPage() {
  const kpis = ["Vues", "Clics détails", "Favoris", "Contacts", "Messages", "Demandes de place", "Places demandées", "Clics WhatsApp", "Clics téléphone", "Clics email", "Taux vue → demande", "Taux vue → contact", "Délai moyen de réponse"];
  return TripsDashboardLayout(`
    ${DashboardHeader("Statistiques voyages", "Analysez les performances détaillées de vos trajets.")}
    <section class="trip-kpi-grid">${kpis.map((title) => KpiCard(title)).join("")}</section>
    ${EmptyState("Aucune statistique disponible pour le moment.")}
    <div class="dashboard-grid"><section class="trip-dashboard-card"><h2>Trajets les plus consultés</h2><div class="trip-chart-placeholder">Bloc graphique prévu</div></section><section class="trip-dashboard-card"><h2>Trajets sans contact</h2><div class="trip-chart-placeholder">Bloc prévu</div></section><section class="trip-dashboard-card"><h2>Trajets à améliorer</h2><div class="trip-chart-placeholder">Bloc prévu</div></section></div>
  `, "statistics");
}

function TripContactSettingsPage() {
  const notificationTriggers = ["Nouveau message", "Nouvelle demande de place", "Nouveau formulaire", "Nouveau contact"];
  return TripsDashboardLayout(`
    ${DashboardHeader("Moyens de contact", "Configurez les contacts et notifications email pour vos trajets.", `<a class="btn btn-light" href="${tripDashboardRouteHref(tripDashboardRoutes.emailSettings)}">Emails automatiques</a>`)}
    <section class="trip-dashboard-card">
      <h2>Paramètres de contact voyages</h2>
      <div class="trip-form-grid">
        ${["WhatsApp", "Téléphone", "Email", "Messagerie interne", "Formulaire", "Demande de place", "Notifications email", "Emails automatiques client"].map((item) => `<label class="choice-card"><input type="checkbox"><span>${item}</span></label>`).join("")}
        <label class="trip-form-field"><span>Numéro WhatsApp</span><input type="tel"></label>
        <label class="trip-form-field"><span>Numéro téléphone</span><input type="tel"></label>
        <label class="trip-form-field"><span>Email de contact</span><input type="email"></label>
        <label class="trip-form-field"><span>Email de notification</span><input type="email"></label>
        <label class="trip-form-field"><span>Méthode préférée</span><select><option>WhatsApp</option><option>Téléphone</option><option>Email</option><option>Message interne</option><option>Formulaire</option></select></label>
      </div>
      <div class="trip-form-actions"><button class="btn btn-primary" type="button" data-save-contact-settings>Enregistrer</button></div>
      <p id="trip-contact-settings-message" hidden>Vos moyens de contact ont été mis à jour.</p>
    </section>
    <section class="trip-dashboard-card">
      <h2>Résumé et aperçu client</h2>
      <p class="dashboard-muted">Les boutons visibles côté client dépendent des canaux activés.</p>
      <div class="trip-chip-row">${["Demander une place", "Envoyer un message", "Appeler", "WhatsApp"].map((item) => `<span class="trip-chip">${item}</span>`).join("")}</div>
    </section>
    <section class="trip-dashboard-card">
      <h2>Notifications email prévues</h2>
      <p class="dashboard-muted">Objet futur : Nouvelle demande sur votre trajet Péncmi.</p>
      <div class="trip-chip-row">${notificationTriggers.map((trigger) => `<span class="trip-chip">${trigger}</span>`).join("")}</div>
      <p class="dashboard-muted">L’email contiendra le trajet concerné, le type de demande, un extrait du message et un lien vers le dashboard.</p>
    </section>
  `, "contactSettings");
}

function renderDashboard() {
  const page = document.body.dataset.tripDashboardPage;
  const pages = {
    overview: TripsDashboardPage,
    listings: TripListingsDashboardPage,
    messages: TripMessagesPage,
    reservations: TripReservationsPage,
    contacts: TripContactsPage,
    statistics: TripStatisticsPage,
    contactSettings: TripContactSettingsPage
  };
  document.querySelector("#trip-dashboard-root").innerHTML = pages[page]();
  document.querySelector("[data-open-sidebar]")?.addEventListener("click", () => document.querySelector("#trip-sidebar").classList.toggle("is-open"));
  document.querySelector("[data-dashboard-logout]")?.addEventListener("click", () => {
    void tripLogout();
  });
  document.querySelector("[data-save-contact-settings]")?.addEventListener("click", () => {
    document.querySelector("#trip-contact-settings-message").hidden = false;
  });
  document.querySelectorAll("[data-trip-request-status]").forEach((button) => {
    button.addEventListener("click", () => {
      button.disabled = true;
      void updateTripReservationStatus(button.dataset.tripRequestId, button.dataset.tripRequestStatus).catch(() => {
        button.disabled = false;
      });
    });
  });
}

async function loadTripDashboardData() {
  tripDashboardData.loading = true;
  tripDashboardData.error = "";
  renderDashboard();
  try {
    const [tripsPayload, reservationsPayload] = await Promise.all([
      tripApiRequest("/dashboard/voyages"),
      tripApiRequest("/dashboard/voyages/seat-requests"),
    ]);
    tripDashboardData.trips = tripListFromPayload(tripsPayload);
    tripDashboardData.reservations = tripListFromPayload(reservationsPayload);
  } catch (error) {
    tripDashboardData.error = error instanceof Error ? error.message : "Chargement impossible.";
  } finally {
    tripDashboardData.loading = false;
    renderDashboard();
  }
}

void loadTripDashboardData();

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
  conversation: null,
  loading: true,
  error: ""
};
const tripDashboardEscape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tripDashboardDisplay = value => typeof value === 'string' ? tripDashboardEscape(value) : Array.isArray(value) ? value.map(tripDashboardDisplay) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, tripDashboardDisplay(item)])) : value;
let tripTablePage = 1;
let tripDashboardContent;

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
  const { publicationRequest } = await import('../../publier/real-estate-api.mjs');
  return publicationRequest(path, { ...options, body: typeof options.body === 'string' ? JSON.parse(options.body) : options.body });
}

const tripReservationStatusLabels = {
  new: "Nouvelle",
  pending: "En attente",
  accepted: "Acceptée",
  refused: "Refusée",
  cancelled: "Annulée",
  completed: "Terminée",
  expired: "Expirée",
  requires_more_info: "Infos demandées"
};

function formatTripReservationStatus(status) {
  return tripReservationStatusLabels[status] || "À traiter";
}

function formatTripDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fr-FR", { timeZone: 'Africa/Dakar' });
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
    ["Contacts", tripDashboardRoutes.contacts, "contacts", String(tripDashboardData.contacts.length)],
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
    ["Messages reçus", tripDashboardData.stats?.inboundMessages ?? null],
    ["Contacts directs", tripDashboardData.stats?.directContacts ?? null]
  ];
  return TripsDashboardLayout(`
    ${DashboardHeader("Dashboard voyages", "Suivez vos trajets, demandes, contacts, messages et performances.", `<a class="btn btn-primary" href="${tripDashboardRouteHref(tripDashboardRoutes.publish)}">Publier un trajet</a>`)}
    <section class="trip-kpi-grid">${kpis.map(([title, value]) => KpiCard(title, value == null ? "" : String(value))).join("")}</section>
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
  const count = Math.ceil(tripDashboardData.trips.length / 20);
  return `<section class="trip-table-wrap"><table class="trip-table"><thead><tr><th>Trajet</th><th>Statut</th><th>Départ</th><th>Arrivée</th><th>Date</th><th>Heure</th><th>Places</th><th>Prix / personne</th><th>Demandes</th><th>Actions</th></tr></thead><tbody>${tripDashboardData.trips.slice((tripTablePage - 1) * 20, tripTablePage * 20).map((trip) => {
    const requests = tripDashboardData.reservations.filter((request) => request.trip?.id === trip.id).length;
    trip = tripDashboardDisplay(trip);
    const editable = ['draft', 'refused', 'active', 'pending_review'].includes(trip.status);
    return `<tr><td>${trip.title || 'Sans titre'}${trip.moderationReason ? `<p>${trip.moderationReason}</p>` : ''}${TripOccurrenceRows(trip)}</td><td>${tripDashboardContent?.tripStatuses[trip.status] || trip.status}</td><td>${trip.departureCity || ""}</td><td>${trip.arrivalCity || ""}</td><td>${formatTripDate(trip.departureDate)}</td><td>${trip.departureTime || ""}</td><td>${trip.availableSeats ?? ""}</td><td>${trip.pricePerSeat != null ? `${trip.pricePerSeat} FCFA` : 'Non renseigné'}</td><td>${requests}</td><td>${trip.status === 'active' ? `<a class="btn btn-ghost" href="${tripDashboardRouteHref(`/voyages/${trip.id}`)}">Voir</a>` : ''}${editable ? `<a class="btn btn-light" href="/publier/?category=voyage&id=${encodeURIComponent(trip.id)}">${trip.status === 'draft' ? 'Reprendre' : 'Modifier'}</a>${['draft', 'refused'].includes(trip.status) ? `<button class="btn btn-primary" data-trip-action="submit" data-id="${trip.id}">Soumettre</button>` : ''}<button class="btn btn-ghost" data-trip-action="delete" data-id="${trip.id}">Supprimer</button>` : ''}</td></tr>`;
  }).join("")}</tbody></table></section><div class="trip-row-actions">${tripTablePage > 1 ? '<button class="btn btn-light" data-trip-page="-1">Précédent</button>' : ''}<span>Page ${tripTablePage} sur ${count}</span>${tripTablePage < count ? '<button class="btn btn-light" data-trip-page="1">Suivant</button>' : ''}</div>`;
}

function TripOccurrenceRows(trip) {
  return `<details><summary>Départs et places</summary>${(trip.occurrences||[]).map(row=>`<p>${formatTripDate(row.serviceDate)} ${new Date(row.departureAt).toLocaleTimeString('fr-FR',{timeZone:'Africa/Dakar',hour:'2-digit',minute:'2-digit'})} · ${row.remainingSeats} restantes / ${row.offeredSeats} proposées · ${row.confirmedSeats} allouées${row.cancelledAt?' · annulé':new Date(row.departureAt)<=new Date()?' · départ passé':` <button class="btn btn-ghost" data-cancel-trip-occurrence="${row.id}" data-trip-id="${trip.id}">Annuler ce départ</button>`}</p>`).join('')||'<p>Aucun départ matérialisé.</p>'}</details>`;
}

function TripMessagesPage() {
  return TripsDashboardLayout(`${DashboardHeader('Messages voyages','Vos conversations liées aux trajets.')}<div id="pencmi-inbox"></div>`, 'messages');
}

function TripReservationsPage() {
  return TripsDashboardLayout(`
    ${DashboardHeader("Demandes de place", "Gérez les demandes de réservation reçues sur vos trajets.")}
    ${tripDashboardData.reservations.length ? `<section class="trip-table-wrap"><table class="trip-table"><thead><tr><th>Client</th><th>Trajet</th><th>Places demandées</th><th>Bagages</th><th>Message</th><th>Statut</th><th>Date</th><th>Actions</th></tr></thead><tbody>${tripDashboardData.reservations.map(TripReservationRow).join("")}</tbody></table></section>` : EmptyState("Aucune demande de place pour le moment.")}
  `, "reservations");
}

function TripReservationRow(request) {
  request = tripDashboardDisplay(request);
  return `
    <tr data-trip-request-row="${request.id}">
      <td>${request.clientName || "Client"}</td>
      <td>${request.trip?.title || "Trajet"}${request.occurrence ? `<br>${formatTripDate(request.occurrence.serviceDate)} ${new Date(request.occurrence.departureAt).toLocaleTimeString('fr-FR',{timeZone:'Africa/Dakar',hour:'2-digit',minute:'2-digit'})}` : '<br>Demande historique sans occurrence'}</td>
      <td>${request.requestedSeats || ""}${request.quotedPricePerSeat != null ? `<br>${request.quotedPricePerSeat} FCFA / personne` : ''}${request.allocatedSeats === null ? '<br>Allocation historique non connue' : ''}${request.quotedPricePerSeat != null && request.occurrence && request.quotedPricePerSeat !== request.occurrence.pricePerSeat ? '<br>Tarif modifié : nouvelle demande nécessaire' : ''}</td>
      <td>${request.luggage ? "Oui" : "Non"}</td>
      <td>${request.message || ""}</td>
      <td>${formatTripReservationStatus(request.status)}</td>
      <td>${formatTripDate(request.createdAt)}</td>
      <td>
        <div class="trip-row-actions">
          ${['new','pending','requires_more_info'].includes(request.status) && request.allocatedSeats !== null && request.occurrence && request.quotedPricePerSeat === request.occurrence.pricePerSeat && !request.occurrence.cancelledAt && new Date(request.occurrence.departureAt)>new Date() && request.trip?.status==='active' ? `<button class="btn btn-primary" data-trip-request-status="accepted" data-trip-request-id="${request.id}">Confirmer les places</button>` : ''}
          ${request.status==='accepted' && request.occurrence && new Date(request.occurrence.departureAt)<=new Date()?`<button class="btn btn-light" data-trip-request-status="completed" data-trip-request-id="${request.id}">Terminer</button>`:''}
          ${['new', 'pending', 'requires_more_info'].includes(request.status) ? `
          <button class="btn btn-ghost" type="button" data-trip-request-status="requires_more_info" data-trip-request-id="${request.id}">Demander des infos</button>
          <button class="btn btn-ghost" type="button" data-trip-request-status="refused" data-trip-request-id="${request.id}">Refuser</button>
          <button class="btn btn-ghost" type="button" data-trip-request-status="pending" data-trip-request-id="${request.id}">Mettre en attente</button>` : ''}
          ${['new', 'pending', 'requires_more_info', 'accepted'].includes(request.status) ? `<button class="btn btn-ghost" data-trip-request-status="cancelled" data-trip-request-id="${request.id}">Annuler</button>` : ''}
        </div>
      </td>
    </tr>
  `;
}

async function updateTripReservationStatus(id, status) {
  await tripApiRequest(`/dashboard/voyages/seat-requests/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
  await loadTripDashboardData();
}

function TripContactsPage() {
  return TripsDashboardLayout(`${DashboardHeader('Contacts reçus','Les contacts enregistrés sur vos trajets.')}<div id="pencmi-contacts"></div>`, 'contacts');
}

function TripStatisticsPage() {
  return TripsDashboardLayout(`${DashboardHeader('Statistiques voyages','Vos demandes, places, contacts et messages réellement enregistrés.')}<div id="pencmi-stats"></div>`,'statistics');
}

function TripContactSettingsPage() {
  return TripsDashboardLayout(`
    ${DashboardHeader('Moyens de contact', 'Contacts de vos trajets')}
    <section class="trip-dashboard-card"><h2>Contacts par trajet</h2><p>Modifiez les moyens de contact dans le trajet concerné.</p><a class="btn btn-light" href="${tripDashboardRouteHref(tripDashboardRoutes.listings)}">Mes trajets</a></section>
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
  document.querySelector("#trip-dashboard-root").innerHTML = tripDashboardData.loading ? TripsDashboardLayout(EmptyState('Chargement en cours.'), page) : tripDashboardData.error ? TripsDashboardLayout(EmptyState(tripDashboardEscape(tripDashboardData.error), '', '<button class="btn btn-light" data-retry-trip>Réessayer</button>'), page) : pages[page]();
  document.querySelector('[data-retry-trip]')?.addEventListener('click', () => void loadTripDashboardData());
  document.querySelectorAll('[data-cancel-trip-occurrence]').forEach(button=>button.onclick=async()=>{const reason=window.prompt('Motif de l’annulation du départ et de ses demandes');if(!reason?.trim())return;button.disabled=true;try{await tripApiRequest(`/dashboard/voyages/${encodeURIComponent(button.dataset.tripId)}/occurrences/${encodeURIComponent(button.dataset.cancelTripOccurrence)}/cancel`,{method:'POST',body:{reason}});await loadTripDashboardData();}catch(error){window.alert(error.message);button.disabled=false;}});
  document.querySelectorAll('[data-trip-page]').forEach(button => button.onclick = () => { tripTablePage += Number(button.dataset.tripPage); renderDashboard(); });
  document.querySelectorAll('[data-trip-action]').forEach(button => button.onclick = async () => {
    if (button.dataset.tripAction === 'delete' && !window.confirm('Supprimer ce trajet ?')) return;
    button.disabled = true;
    try {
      await tripApiRequest(`/dashboard/voyages/${encodeURIComponent(button.dataset.id)}${button.dataset.tripAction === 'submit' ? '/submit' : ''}`, { method: button.dataset.tripAction === 'submit' ? 'POST' : 'DELETE' });
      await loadTripDashboardData();
    } catch (error) { window.alert(error.message); button.disabled = false; }
  });
  document.querySelector("[data-open-sidebar]")?.addEventListener("click", () => document.querySelector("#trip-sidebar").classList.toggle("is-open"));
  document.querySelector("[data-dashboard-logout]")?.addEventListener("click", () => {
    void tripLogout();
  });
  document.querySelectorAll("[data-trip-request-status]").forEach((button) => {
    button.addEventListener("click", () => {
      button.disabled = true;
      void updateTripReservationStatus(button.dataset.tripRequestId, button.dataset.tripRequestStatus).catch((error) => {
        button.disabled = false;
        window.alert(error.message || "La mise à jour de la demande a échoué.");
      });
    });
  });
}

async function loadTripDashboardData() {
  tripDashboardData.loading = true;
  tripDashboardData.error = "";
  renderDashboard();
  try {
    tripDashboardContent ||= await import('../../voyages/trip-content.mjs');
    const all = async path => { const rows = []; for (let page = 1; ; page++) { const result = await tripApiRequest(`${path}?page=${page}&limit=100`, { includeMeta: true }); rows.push(...tripListFromPayload(result?.data ?? result)); if (page >= (result.meta?.totalPages || 1)) return rows; } };
    const [tripsPayload, reservationsPayload, contacts, stats] = await Promise.all([all('/dashboard/voyages'), all('/dashboard/voyages/seat-requests'),all('/dashboard/voyages/contacts'),tripApiRequest('/dashboard/voyages/statistics')]);
    tripDashboardData.contacts=contacts;tripDashboardData.stats=stats;
    tripDashboardData.trips = tripListFromPayload(tripsPayload);
    tripDashboardData.reservations = tripListFromPayload(reservationsPayload);
  } catch (error) {
    tripDashboardData.error = error instanceof Error ? error.message : "Chargement impossible.";
  } finally {
    tripDashboardData.loading = false;
    renderDashboard();
    mountTripMessaging();
  }
}

function mountTripMessaging() {
  const inbox = document.querySelector("#pencmi-inbox");
  if (inbox) void import("../../messaging/inbox.mjs").then(({ mountInbox }) => mountInbox(inbox, { scope: "owner", module: "trips", emptyTitle: "Aucun message reçu pour le moment." }));
  const contacts = document.querySelector("#pencmi-contacts");
  if (contacts) void import("../../messaging/contacts-panel.mjs").then(({ mountContacts }) => mountContacts(contacts, { module: "trips", messagesHref: tripDashboardRouteHref(tripDashboardRoutes.messages) }));
  const stats = document.querySelector("#pencmi-stats");
  if (stats) void import("../stats-panel.mjs").then(({ mountStats }) => mountStats(stats, { module: "trips" }));
}

void loadTripDashboardData();

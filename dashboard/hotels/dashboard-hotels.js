const hotelDashboardRoutes = {
  overview: "/dashboard/hotels",
  listings: "/dashboard/hotels/annonces",
  availability: "/dashboard/hotels/availability",
  messages: "/dashboard/hotels/messages",
  reservations: "/dashboard/hotels/reservations",
  contacts: "/dashboard/hotels/contacts",
  statistics: "/dashboard/hotels/statistiques",
  contactSettings: "/dashboard/hotels/contact-settings",
  emailSettings: "/dashboard/hotels/email-settings",
  integration: "/dashboard/hotels/integration",
  publish: "/publier?category=hotel"
};

const hotelDashboardData = {
  hotels: [],
  availability: [],
  messages: [],
  reservations: [],
  reservationsPage: 1,
  reservationsMeta: null,
  contacts: [],
  stats: null,
  loading: true,
  error: ""
};

const HOTEL_ACCESS_TOKEN_STORAGE_KEY = "pencmi_access_token";
const HOTEL_REFRESH_TOKEN_STORAGE_KEY = "pencmi_refresh_token";
const HOTEL_SESSION_STORAGE_KEY = "pencmi_current_session";
const hotelDashboardEscape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const hotelEditHref = (id, step = 0) => `/publier/?category=hotel&id=${encodeURIComponent(id)}&step=${step}`;
function HotelStatusBadge(status) {
  const labels = { draft: 'Brouillon', pending_review: 'En attente de validation', active: 'Actif', refused: 'Refusé', suspended: 'Suspendu', expired: 'Expiré', deleted: 'Supprimé' };
  return `<span class="hotel-status-badge">${hotelDashboardEscape(labels[status] || status)}</span>`;
}

function hotelApiBaseUrl() {
  return String(window.PencmiConfig?.apiBaseUrl || window.PencmiRuntimeConfig?.apiBaseUrl || window.PencmiApiBaseUrl || window.localStorage.getItem("pencmi_api_base_url") || "").replace(/\/+$/, "");
}

function hotelAccessToken() {
  return window.localStorage.getItem(HOTEL_ACCESS_TOKEN_STORAGE_KEY) || "";
}

async function hotelLogout() {
  const baseUrl = hotelApiBaseUrl();
  const token = hotelAccessToken();
  if (baseUrl && token) {
    await fetch(`${baseUrl}/auth/logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }).catch(() => null);
  }
  window.localStorage.removeItem(HOTEL_ACCESS_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(HOTEL_REFRESH_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(HOTEL_SESSION_STORAGE_KEY);
  window.location.href = hotelDashboardRouteHref("/login");
}

function listFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

async function hotelApiRequest(path, options = {}) {
  const { publicationRequest } = await import('/publier/real-estate-api.mjs');
  return publicationRequest(path, { ...options, body: typeof options.body === 'string' ? JSON.parse(options.body) : options.body });
}

let hotelReservationCatalog;

function formatHotelReservationStatus(status) {
  return hotelReservationCatalog?.hotelRequestLabels[status] || "À traiter";
}

function formatHotelDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fr-FR", { timeZone: 'Africa/Dakar' });
}

function hotelDashboardRouteHref(path) {
  if (window.location.protocol !== "file:" && /^\/hotels\/[^/]+$/.test(path)) {
    return `/hotels/detail/?id=${encodeURIComponent(path.slice("/hotels/".length))}`;
  }
  if (window.location.protocol !== "file:") {
    return path;
  }
  const page = document.body.dataset.hotelDashboardPage;
  const fromRoot = page === "overview";
  const prefix = fromRoot ? "./" : "../";
  const map = {
    [hotelDashboardRoutes.overview]: fromRoot ? "./" : "../",
    [hotelDashboardRoutes.listings]: `${prefix}annonces/`,
    [hotelDashboardRoutes.availability]: `${prefix}availability/`,
    [hotelDashboardRoutes.messages]: `${prefix}messages/`,
    [hotelDashboardRoutes.reservations]: `${prefix}reservations/`,
    [hotelDashboardRoutes.contacts]: `${prefix}contacts/`,
    [hotelDashboardRoutes.statistics]: `${prefix}statistiques/`,
    [hotelDashboardRoutes.contactSettings]: `${prefix}contact-settings/`,
    [hotelDashboardRoutes.emailSettings]: `${prefix}email-settings/`,
    [hotelDashboardRoutes.integration]: `${prefix}integration/`,
    [hotelDashboardRoutes.publish]: fromRoot ? "../../publier/?category=hotel" : "../../../publier/?category=hotel"
  };
  return map[path] || path;
}

function HotelsDashboardLayout(content, currentPage) {
  return `
    <div class="hotel-dashboard-layout">
      <div class="hotel-dashboard-shell">
        ${HotelsDashboardSidebar(currentPage)}
        <section class="hotel-dashboard-main">${content}</section>
      </div>
    </div>
  `;
}

function HotelsDashboardSidebar(currentPage) {
  const listingCount = String(hotelDashboardData.hotels.length || 0);
  const reservationCount = String(hotelDashboardData.reservationsMeta?.total ?? hotelDashboardData.reservations.length);
  const items = [
    ["Vue d’ensemble", hotelDashboardRoutes.overview, "overview"],
    ["Hébergements", hotelDashboardRoutes.listings, "listings", listingCount],
    ["Disponibilités", hotelDashboardRoutes.availability, "availability"],
    ["Messages", hotelDashboardRoutes.messages, "messages"],
    ["Réservations", hotelDashboardRoutes.reservations, "reservations", reservationCount],
    ["Contacts", hotelDashboardRoutes.contacts, "contacts", reservationCount],
    ["Statistiques", hotelDashboardRoutes.statistics, "statistics"],
    ["Moyens de contact", hotelDashboardRoutes.contactSettings, "contactSettings"],
    ["Emails automatiques", hotelDashboardRoutes.emailSettings, "emailSettings"],
    ["Intégration logiciel hôtelier", hotelDashboardRoutes.integration, "integration"]
  ];
  return `
    <aside class="dashboard-sidebar" id="hotel-sidebar">
      <div class="dashboard-brand"><span>P</span><div><strong>Péncmi</strong><small>Annonceur hôtels</small></div></div>
      <nav class="dashboard-nav">${items.map(([label, href, key, badge]) => `<a href="${hotelDashboardRouteHref(href)}"${key === currentPage ? ' aria-current="page"' : ""}><span>${label}</span>${badge ? `<span class="notification-badge">${badge}</span>` : ""}</a>`).join("")}</nav>
    </aside>
  `;
}

function DashboardHeader(title, subtitle, actions = "") {
  const bell = typeof NotificationBell === "function" ? NotificationBell() : `<a class="btn btn-ghost" href="${hotelDashboardRouteHref("/dashboard/notifications")}">Notifications</a>`;
  return `
    <header class="hotel-dashboard-header">
      <div><button class="btn btn-ghost dashboard-menu-toggle" type="button" data-open-sidebar>Menu</button><h1>${title}</h1><p>${subtitle}</p></div>
      <div class="dashboard-header-actions">${bell}${actions}<button class="btn btn-ghost" type="button" data-dashboard-logout>Se déconnecter</button></div>
    </header>
  `;
}

function KpiCard(title, value) {
  return `<article class="kpi-card"><span class="kpi-icon">HT</span><h3>${title}</h3>${value ? `<div class="kpi-value">${value}</div>` : `<div class="kpi-empty">Aucune donnée disponible</div>`}</article>`;
}

function EmptyState(title, text = "", action = "") {
  return `<section class="hotel-empty-dashboard"><div><h2>${title}</h2>${text ? `<p>${text}</p>` : ""}${action}</div></section>`;
}

function AvailabilityStatusBadge(status) {
  const labels = {
    available: "Disponible",
    limited: "Limité",
    full: "Complet",
    closed: "Fermé",
    maintenance: "Maintenance",
    on_request: "Sur demande"
  };
  return `<span class="hotel-status-badge">${labels[status] || "À renseigner"}</span>`;
}

function HotelAvailabilityDashboard() {
  const rooms = hotelDashboardData.hotels.flatMap(hotel => hotel.rooms || []);
  const missing = rooms.filter(room => !room.availability?.length).length;
  return `<section class="hotel-dashboard-card"><h2>Disponibilités</h2><p>${missing} catégorie(s) sans calendrier renseigné.</p><a class="btn btn-light" href="${hotelDashboardRoutes.availability}">Gérer les disponibilités</a></section>`;
}

function AvailabilityAlerts() {
  const drafts = hotelDashboardData.hotels.filter(hotel => hotel.status === 'draft');
  return `<section class="hotel-dashboard-card"><h2>Brouillons</h2>${drafts.map(hotel => `<p><a href="${hotelEditHref(hotel.id)}">${hotelDashboardEscape(hotel.name || 'Hébergement sans nom')}</a></p>`).join('') || '<p>Aucun brouillon.</p>'}</section>`;
}

function HotelsDashboardPage() {
  if (hotelDashboardData.loading) {
    return HotelsDashboardLayout(`${DashboardHeader("Dashboard hôtels", "Chargement de vos données annonceur.")}${EmptyState("Chargement en cours.")}`, "overview");
  }
  if (hotelDashboardData.error) {
    return HotelsDashboardLayout(`${DashboardHeader("Dashboard hôtels", "Vos données annonceur.")}${EmptyState(hotelDashboardData.error)}`, "overview");
  }
  const activeHotels = hotelDashboardData.hotels.filter((hotel) => hotel.status === "active").length;
  const pendingHotels = hotelDashboardData.hotels.filter((hotel) => hotel.status === "pending_review").length;
  const pendingReservations = hotelDashboardData.reservations.filter((item) => ["new", "pending"].includes(item.status)).length;
  const kpis = [
    ["Hébergements actifs", activeHotels],
    ["Hébergements en attente", pendingHotels],
    ["Demandes de réservation", hotelDashboardData.reservations.length],
    ["Réservations à confirmer", pendingReservations],
    ["Messages reçus", hotelDashboardData.messages.length],
    ["Contacts", hotelDashboardData.contacts.length]
  ];
  return HotelsDashboardLayout(`
    ${DashboardHeader("Dashboard hôtels", "Suivez vos hébergements, disponibilités, demandes et performances.", `<a class="btn btn-primary" href="${hotelDashboardRouteHref(hotelDashboardRoutes.publish)}">Publier un hébergement</a>`)}
    <section class="hotel-kpi-grid">${kpis.map(([title, value]) => KpiCard(title, String(value))).join("")}</section>
    ${hotelDashboardData.hotels.length || hotelDashboardData.reservations.length ? "" : EmptyState("Aucune donnée disponible pour le moment.")}
    <div class="dashboard-grid"><section>${HotelAvailabilityDashboard()}</section><section>${AvailabilityAlerts()}</section></div>
  `, "overview");
}

function HotelListingsDashboardPage() {
  return HotelsDashboardLayout(`
    ${DashboardHeader("Mes hébergements", "Gérez vos hôtels, auberges, résidences et logements publiés.", `<a class="btn btn-primary" href="${hotelDashboardRouteHref(hotelDashboardRoutes.publish)}">Publier mon premier hébergement</a>`)}
    ${hotelDashboardData.hotels.length ? HotelListingsTable() : EmptyState("Vous n’avez aucun hébergement publié pour le moment.", "", `<a class="btn btn-primary" href="${hotelDashboardRouteHref(hotelDashboardRoutes.publish)}">Publier mon premier hébergement</a>`)}
  `, "listings");
}

function HotelListingsTable() {
  return `<section class="hotel-table-wrap"><table class="hotel-table"><thead><tr><th>Hébergement</th><th>Statut</th><th>Ville</th><th>Type</th><th>Chambres</th><th>Demandes</th><th>Actions</th></tr></thead><tbody>${hotelDashboardData.hotels.map((hotel) => {
    const requests = hotelDashboardData.reservations.filter((request) => request.property?.id === hotel.id).length;
    return `<tr><td>${hotelDashboardEscape(hotel.name || 'Hébergement sans nom')}</td><td>${HotelStatusBadge(hotel.status)}</td><td>${hotelDashboardEscape(hotel.city)}</td><td>${hotelDashboardEscape(hotel.propertyType)}</td><td>${Array.isArray(hotel.rooms) ? hotel.rooms.length : 0}</td><td>${requests}</td><td><a class="btn btn-light" href="${hotelEditHref(hotel.id)}">${hotel.status === 'draft' ? 'Reprendre' : 'Modifier'}</a>${hotel.status === 'active' ? `<a class="btn btn-ghost" href="${hotelDashboardRouteHref(`/hotels/${hotel.id}`)}">Voir</a>` : ''}<a class="btn btn-ghost" href="${hotelEditHref(hotel.id, 8)}">Disponibilités</a></td></tr>`;
  }).join("")}</tbody></table></section>`;
}

function HotelAvailabilityCalendar() {
  return hotelDashboardData.hotels.map(hotel => `<section class="hotel-dashboard-card"><h2>${hotelDashboardEscape(hotel.name || 'Hébergement sans nom')}</h2><a class="btn btn-primary" href="${hotelEditHref(hotel.id, 8)}">Modifier les disponibilités</a><a class="btn btn-light" href="${hotelEditHref(hotel.id, 4)}">Modifier les tarifs</a>${(hotel.rooms || []).map(room => `<h3>${hotelDashboardEscape(room.name)}</h3>${room.availability?.length ? `<div class="hotel-table-wrap"><table class="hotel-table"><thead><tr><th>Date</th><th>État</th><th>Stock initial</th><th>Unités allouées</th><th>Stock restant</th><th>Ventes</th></tr></thead><tbody>${room.availability.map(day => `<tr><td>${formatHotelDate(day.date)}</td><td>${hotelDashboardEscape(({ open: 'Ouvert', closed: 'Fermé', full: 'Complet', maintenance: 'Maintenance' })[day.status] || 'À confirmer')}</td><td>${Number(day.available)}</td><td>${Number(day.allocatedUnits) || 0}</td><td>${day.remainingUnits === null || day.remainingUnits === undefined ? 'À confirmer' : Number(day.remainingUnits)}</td><td>${room.restrictions?.some(item => item.date === day.date && item.stopSell) ? 'Suspendues' : 'Sur demande'}</td></tr>`).join('')}</tbody></table></div>` : '<p>Disponibilité à confirmer.</p>'}`).join('')}</section>`).join('') || EmptyState('Aucun hébergement enregistré.');
}

function HotelAvailabilityPage() {
  return HotelsDashboardLayout(`
    ${DashboardHeader("Disponibilités", "Gérez les dates, prix, stocks et statuts de vos chambres.")}
    ${HotelAvailabilityCalendar()}
  `, "availability");
}

function HotelMessagesPage() {
  return HotelsDashboardLayout(`${DashboardHeader("Messages hôtels", "Suivez les conversations clients et les réponses annonceur.")}${EmptyState("Aucun message reçu pour le moment.", "Les conversations liées à vos hébergements apparaîtront ici.")}`, "messages");
}

function HotelReservationsPage() {
  const meta = hotelDashboardData.reservationsMeta;
  return HotelsDashboardLayout(`
    ${DashboardHeader("Demandes de réservation", "Gérez les demandes de réservation reçues sur vos hébergements.")}
    ${hotelDashboardData.reservations.length ? `<section class="hotel-table-wrap"><table class="hotel-table"><thead><tr><th>Client</th><th>Hébergement / chambre</th><th>Arrivée</th><th>Départ</th><th>Voyageurs / unités</th><th>Message</th><th>Statut et stock</th><th>Date</th><th>Actions</th></tr></thead><tbody>${hotelDashboardData.reservations.map(HotelReservationRow).join("")}</tbody></table></section>` : EmptyState("Aucune demande de réservation pour le moment.")}
    ${meta?.totalPages > 1 ? `<nav class="hotel-row-actions" aria-label="Pages des demandes"><button class="btn btn-light" type="button" data-reservations-page="${hotelDashboardData.reservationsPage - 1}" ${hotelDashboardData.loading || hotelDashboardData.reservationsPage <= 1 ? 'disabled' : ''}>Précédent</button><span>Page ${hotelDashboardData.reservationsPage} sur ${Number(meta.totalPages)}</span><button class="btn btn-light" type="button" data-reservations-page="${hotelDashboardData.reservationsPage + 1}" ${hotelDashboardData.loading || hotelDashboardData.reservationsPage >= meta.totalPages ? 'disabled' : ''}>Suivant</button></nav>` : ''}
  `, "reservations");
}

function HotelReservationRow(request) {
  const escape = hotelDashboardEscape;
  const actions = hotelReservationCatalog?.hotelRequestActions || {};
  const confirmation = request.confirmation || {};
  const warning = confirmation.confirmed ? 'Stock alloué pour ce séjour.' : confirmation.message || 'Disponibilité à confirmer.';
  return `
    <tr>
      <td>${escape(request.clientName || "Client")}<br>${escape(request.clientPhone || request.clientEmail || '')}</td>
      <td>${escape(request.property?.name || "Hébergement")}<br>${escape(request.room?.name || 'Catégorie non renseignée')}</td>
      <td>${formatHotelDate(request.checkIn)}</td>
      <td>${formatHotelDate(request.checkOut)}</td>
      <td>${Number(request.guests) || '—'} / ${Number(request.units) || '—'}</td>
      <td>${escape(request.message || "")}</td>
      <td>${escape(formatHotelReservationStatus(request.status))}<p>${escape(warning)}</p>${confirmation.remainingUnits !== null && confirmation.remainingUnits !== undefined ? `<p>Stock restant : ${Number(confirmation.remainingUnits)}</p>` : ''}${request.events?.length ? `<details><summary>Historique</summary>${request.events.map(event => `<p>${escape(formatHotelReservationStatus(event.toStatus))} · ${formatHotelDate(event.createdAt)}${event.note ? `<br>${escape(event.note)}` : ''}</p>`).join('')}</details>` : ''}</td>
      <td>${formatHotelDate(request.createdAt)}</td>
      <td>
        <div class="hotel-row-actions">
          ${(request.allowedActions || []).filter(status => actions[status]).map(status => `<button class="btn ${status === 'accepted' ? 'btn-primary' : 'btn-ghost'}" type="button" data-reservation-status="${status}" data-reservation-id="${escape(request.id)}">${actions[status]}</button>`).join('')}
        </div>
        ${request.allowedActions?.length ? '<label>Note de suivi<textarea data-reservation-note maxlength="1000" rows="2"></textarea></label>' : ''}
        <p data-reservation-feedback role="status"></p>
      </td>
    </tr>
  `;
}

async function updateHotelReservationStatus(id, status, note) {
  await hotelApiRequest(`/dashboard/hotels/reservations/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status, note: note || undefined })
  });
  await loadHotelDashboardData();
}

function HotelContactsPage() {
  const sources = ["WhatsApp", "Téléphone", "Email", "Message interne", "Formulaire", "Demande de réservation"];
  return HotelsDashboardLayout(`
    ${DashboardHeader("Contacts reçus", "Suivez les contacts générés par vos hébergements.")}
    <section class="hotel-dashboard-card"><h2>Sources prévues</h2><div class="hotel-chip-row">${sources.map((source) => `<span class="hotel-chip">${source}</span>`).join("")}</div></section>
    ${hotelDashboardData.reservations.length ? `<section class="hotel-table-wrap"><table class="hotel-table"><thead><tr><th>Client</th><th>Hébergement</th><th>Téléphone</th><th>Email</th><th>Message</th><th>Source</th><th>Date</th></tr></thead><tbody>${hotelDashboardData.reservations.map((request) => `<tr><td>${hotelDashboardEscape(request.clientName || "Client")}</td><td>${hotelDashboardEscape(request.property?.name || "Hébergement")}</td><td>${hotelDashboardEscape(request.clientPhone || "")}</td><td>${hotelDashboardEscape(request.clientEmail || "")}</td><td>${hotelDashboardEscape(request.message || "")}</td><td>Demande de réservation</td><td>${formatHotelDate(request.createdAt)}</td></tr>`).join("")}</tbody></table></section>` : EmptyState("Aucun contact reçu pour le moment.")}
  `, "contacts");
}

function HotelStatisticsPage() {
  const kpis = ["Vues", "Clics détails", "Favoris", "Contacts", "Messages", "Demandes de réservation", "Réservations acceptées", "Taux d’occupation", "Taux vue → réservation", "Taux vue → contact", "Délai moyen de réponse"];
  return HotelsDashboardLayout(`
    ${DashboardHeader("Statistiques hôtels", "Analysez les performances de vos hébergements et chambres.")}
    <section class="hotel-kpi-grid">${kpis.map((title) => KpiCard(title)).join("")}</section>
    ${EmptyState("Aucune statistique disponible pour le moment.")}
    <div class="dashboard-grid"><section class="hotel-dashboard-card"><h2>Hébergements les plus consultés</h2><div class="hotel-chart-placeholder">Bloc graphique prévu</div></section><section class="hotel-dashboard-card"><h2>Chambres les plus demandées</h2><div class="hotel-chart-placeholder">Bloc graphique prévu</div></section><section class="hotel-dashboard-card"><h2>Hébergements sans contact</h2><div class="hotel-chart-placeholder">Bloc prévu</div></section><section class="hotel-dashboard-card"><h2>Disponibilités non mises à jour</h2><div class="hotel-chart-placeholder">Bloc prévu</div></section></div>
  `, "statistics");
}

function HotelContactSettingsPage() {
  return HotelsDashboardLayout(`
    ${DashboardHeader('Moyens de contact', 'Contacts de vos hébergements.')}
    ${hotelDashboardData.hotels.map(hotel => `<section class="hotel-dashboard-card"><h2>${hotelDashboardEscape(hotel.name || 'Hébergement sans nom')}</h2><a class="btn btn-primary" href="${hotelEditHref(hotel.id, 10)}">Configurer les moyens de contact</a></section>`).join('') || EmptyState('Aucun hébergement enregistré.')}
  `, "contactSettings");
}

function renderDashboard() {
  const page = document.body.dataset.hotelDashboardPage;
  const pages = {
    overview: HotelsDashboardPage,
    listings: HotelListingsDashboardPage,
    availability: HotelAvailabilityPage,
    messages: HotelMessagesPage,
    reservations: HotelReservationsPage,
    contacts: HotelContactsPage,
    statistics: HotelStatisticsPage,
    contactSettings: HotelContactSettingsPage
  };
  document.querySelector("#hotel-dashboard-root").innerHTML = pages[page]();
  document.querySelector("[data-open-sidebar]")?.addEventListener("click", () => document.querySelector("#hotel-sidebar").classList.toggle("is-open"));
  document.querySelector("[data-dashboard-logout]")?.addEventListener("click", () => {
    void hotelLogout();
  });
  document.querySelectorAll("[data-reservation-status]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = button.closest('tr');
      const buttons = [...row.querySelectorAll('[data-reservation-status]')];
      buttons.forEach(item => { item.disabled = true; });
      row.querySelector('[data-reservation-feedback]').textContent = 'Mise à jour…';
      void updateHotelReservationStatus(button.dataset.reservationId, button.dataset.reservationStatus, row.querySelector('[data-reservation-note]')?.value.trim()).catch(error => {
        buttons.forEach(item => { item.disabled = false; });
        const feedback = row.querySelector('[data-reservation-feedback]');
        feedback.setAttribute('role', 'alert');
        feedback.textContent = error.message || "La mise à jour de la demande a échoué. Réessayez.";
      });
    });
  });
  document.querySelectorAll('[data-reservations-page]').forEach(button => button.addEventListener('click', () => {
    if (hotelDashboardData.loading) return;
    hotelDashboardData.reservationsPage = Number(button.dataset.reservationsPage);
    void loadHotelDashboardData();
  }));
}

async function loadHotelDashboardData() {
  hotelDashboardData.loading = true;
  hotelDashboardData.error = "";
  renderDashboard();
  try {
    hotelReservationCatalog ||= await import('/hotels/reservation.mjs');
    const [hotelsPayload, reservationsPayload] = await Promise.all([
      hotelApiRequest("/dashboard/hotels"),
      hotelApiRequest(`/dashboard/hotels/reservations?page=${hotelDashboardData.reservationsPage}&limit=20`, { includeMeta: true }),
    ]);
    hotelDashboardData.hotels = listFromPayload(hotelsPayload);
    hotelDashboardData.reservations = listFromPayload(reservationsPayload);
    hotelDashboardData.reservationsMeta = reservationsPayload?.meta || null;
  } catch (error) {
    hotelDashboardData.error = error instanceof Error ? error.message : "Chargement impossible.";
  } finally {
    hotelDashboardData.loading = false;
    renderDashboard();
  }
}

void loadHotelDashboardData();

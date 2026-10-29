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
let vehicleDashboardPresentation;
const vehicleDashboardEscape = value => vehicleDashboardPresentation.vehicleEscape(value);

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

async function vehicleApiRequest(path, options = {}) {
  const { publicationRequest } = await import('../../publier/real-estate-api.mjs');
  return publicationRequest(path, { ...options, body: typeof options.body === 'string' ? JSON.parse(options.body) : options.body });
}

async function vehicleApiList(path) {
  const result = [];
  for (let page = 1; ; page++) {
    const payload = await vehicleApiRequest(`${path}?limit=100&page=${page}`, { includeMeta: true });
    result.push(...vehicleListFromPayload(payload));
    if (!payload.meta?.totalPages || page >= payload.meta.totalPages) return result;
  }
}

const vehicleRequestStatusLabels = {
  new: "Nouvelle",
  pending: "En attente",
  accepted: "Acceptée",
  refused: "Refusée",
  cancelled: "Annulée",
  completed: "Terminée",
  requires_more_info: "Infos demandées"
};
const vehicleRequestTransitions = {
  new: ['accepted', 'requires_more_info', 'refused', 'cancelled'],
  pending: ['accepted', 'requires_more_info', 'refused', 'cancelled'],
  requires_more_info: ['accepted', 'pending', 'refused', 'cancelled'],
  accepted: ['completed', 'cancelled'],
};
const vehicleRequestActionLabels = { accepted: 'Accepter', requires_more_info: 'Demander des infos', refused: 'Refuser', cancelled: 'Annuler', completed: 'Terminer', pending: 'Mettre en attente' };

function formatVehicleRequestStatus(status) {
  return vehicleRequestStatusLabels[status] || "À traiter";
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
  const contactCount = String(vehicleDashboardData.requests.length + vehicleDashboardData.contacts.length || 0);
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
  return `<section class="vehicle-empty-dashboard"><div><h2>${vehicleDashboardEscape(title)}</h2>${text ? `<p>${vehicleDashboardEscape(text)}</p>` : ""}${action ? `<div class="vehicle-empty-actions">${action}</div>` : ""}</div></section>`;
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
    ${DashboardHeader("Mes annonces voitures", "Gérez vos véhicules publiés et leurs performances.", `<a class="btn btn-primary" href="${vehicleDashboardRouteHref(vehicleDashboardRoutes.publish)}">Publier une voiture</a>`)}
    ${vehicleDashboardData.listings.length ? VehicleListingsTable() : EmptyState("Vous n’avez aucune annonce voiture pour le moment.", "", `<a class="btn btn-primary" href="${vehicleDashboardRouteHref(vehicleDashboardRoutes.publish)}">Publier ma première voiture</a>`)}
  `, "listings");
}

function VehicleListingsTable() {
  return `<section class="vehicle-table-wrap"><table class="vehicle-table"><thead><tr><th>Voiture</th><th>Statut</th><th>Ville</th><th>Type</th><th>Prix</th><th>Demandes</th><th>Actions</th></tr></thead><tbody>${vehicleDashboardData.listings.map((listing) => {
    const requests = vehicleDashboardData.requests.filter((request) => request.listing?.id === listing.id).length;
    const esc = vehicleDashboardEscape, id = encodeURIComponent(listing.id);
    return `<tr><td>${esc(listing.title || 'Brouillon sans titre')}</td><td>${esc(vehicleDashboardPresentation.vehicleStatuses[listing.status] || listing.status)}</td><td>${esc(listing.city)}</td><td>${esc(vehicleDashboardPresentation.vehicleModes[listing.vehicleMode])}</td><td>${esc(vehicleDashboardPresentation.vehiclePrice(listing))}</td><td>${requests}</td><td><div class="vehicle-row-actions"><a class="btn btn-light" href="/publier/?category=voiture&id=${id}">${listing.status === 'draft' ? 'Reprendre' : 'Modifier'}</a>${listing.status === 'active' ? `<a class="btn btn-ghost" href="${vehicleDashboardRouteHref(`/voitures/${id}`)}">Voir</a>` : ''}<button class="btn btn-ghost" data-delete-vehicle="${esc(listing.id)}" type="button">Supprimer</button></div></td></tr>`;
  }).join("")}</tbody></table></section>`;
}

function VehicleMessagesPage() {
  return VehiclesDashboardLayout(`${DashboardHeader("Messages voitures", "Suivez les conversations clients, le véhicule concerné et vos réponses.")}${EmptyState("Aucun message reçu pour le moment.", "Les messages clients liés à vos véhicules apparaîtront ici.")}`, "messages");
}

function VehicleContactsPage() {
  return VehiclesDashboardLayout(`
    ${DashboardHeader("Contacts reçus", "Suivez les contacts générés par vos annonces voitures.")}
    ${vehicleDashboardData.contacts.length ? `<section class="vehicle-table-wrap"><table class="vehicle-table"><thead><tr><th>Client</th><th>Annonce</th><th>Coordonnées</th><th>Message</th><th>Date</th></tr></thead><tbody>${vehicleDashboardData.contacts.map(contact => { const data = contact.metadata || {}; const esc = vehicleDashboardEscape; return `<tr><td>${esc(data.clientName)}</td><td>${esc(data.listingTitle)}</td><td>${esc([data.clientPhone, data.clientEmail].filter(Boolean).join(' · '))}</td><td>${esc(data.message)}</td><td>${formatVehicleDate(contact.createdAt)}</td></tr>`; }).join('')}</tbody></table></section>` : ''}
    ${vehicleDashboardData.requests.length ? `<section class="vehicle-table-wrap"><table class="vehicle-table"><thead><tr><th>Client</th><th>Annonce</th><th>Type</th><th>Début</th><th>Fin</th><th>Message</th><th>Statut</th><th>Date</th><th>Actions</th></tr></thead><tbody>${vehicleDashboardData.requests.map(VehicleRequestRow).join("")}</tbody></table></section>` : vehicleDashboardData.contacts.length ? '' : EmptyState("Aucun contact reçu pour le moment.")}
  `, "contacts");
}

function VehicleRequestRow(request) {
  const esc = vehicleDashboardEscape;
  return `
    <tr>
      <td>${esc(request.clientName || "Client")}<br>${esc([request.clientPhone, request.clientEmail].filter(Boolean).join(' · '))}</td>
      <td>${esc(request.listing?.title || "Annonce")}</td>
      <td>${esc(request.requestType || request.listing?.vehicleMode || "")}</td>
      <td>${formatVehicleDate(request.startDate || request.serviceDate)}</td>
      <td>${formatVehicleDate(request.endDate)}</td>
      <td>${esc(request.message)}</td>
      <td>${formatVehicleRequestStatus(request.status)}</td>
      <td>${formatVehicleDate(request.createdAt)}</td>
      <td>
        <div class="vehicle-row-actions">
          ${(vehicleRequestTransitions[request.status] || []).map(status => `<button class="btn ${status === 'accepted' ? 'btn-primary' : 'btn-ghost'}" type="button" data-vehicle-request-status="${status}" data-vehicle-request-type="${esc(request.requestType)}" data-vehicle-request-id="${esc(request.id)}">${vehicleRequestActionLabels[status]}</button>`).join('')}
        </div>
      </td>
    </tr>
  `;
}

async function updateVehicleRequestStatus(id, requestType, status) {
  const path = requestType === "chauffeur" ? "chauffeur-requests" : "rental-requests";
  const updated = await vehicleApiRequest(`/dashboard/voitures/${path}/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
  vehicleDashboardData.requests = vehicleDashboardData.requests.map((request) => request.id === id ? { ...updated, requestType } : request);
  renderDashboard();
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
  return VehiclesDashboardLayout(`${DashboardHeader('Moyens de contact', '')}<section class="vehicle-dashboard-card"><h2>Contacts par annonce</h2>${vehicleDashboardData.listings.length ? vehicleDashboardData.listings.map(listing => `<p><a class="btn btn-light" href="/publier/?category=voiture&id=${encodeURIComponent(listing.id)}&step=9">${vehicleDashboardEscape(listing.title || 'Brouillon sans titre')}</a></p>`).join('') : EmptyState('Aucune annonce à configurer.')}</section>`, 'contactSettings');
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
  document.querySelector("#vehicle-dashboard-root").innerHTML = vehicleDashboardData.loading || vehicleDashboardData.error
    ? VehiclesDashboardLayout(`${DashboardHeader('Mon espace voitures', '')}${EmptyState(vehicleDashboardData.error || 'Chargement en cours.')}`, page)
    : (pages[page] || VehiclesDashboardPage)();
  document.querySelector("[data-open-sidebar]")?.addEventListener("click", () => document.querySelector("#vehicle-sidebar").classList.toggle("is-open"));
  document.querySelector("[data-dashboard-logout]")?.addEventListener("click", () => {
    void vehicleLogout();
  });
  document.querySelectorAll('[data-delete-vehicle]').forEach(button => button.onclick = async () => {
    if (!window.confirm('Supprimer cette annonce ?')) return;
    button.disabled = true;
    try { await vehicleApiRequest(`/dashboard/voitures/${encodeURIComponent(button.dataset.deleteVehicle)}`, { method: 'DELETE' }); await loadVehicleDashboardData(); }
    catch (error) { button.disabled = false; window.alert(error.message); }
  });
  document.querySelectorAll("[data-vehicle-request-status]").forEach((button) => {
    button.addEventListener("click", () => {
      button.disabled = true;
      void updateVehicleRequestStatus(button.dataset.vehicleRequestId, button.dataset.vehicleRequestType, button.dataset.vehicleRequestStatus).catch(() => {
        button.disabled = false;
        window.alert("La mise à jour de la demande a échoué. Vérifiez la connexion puis réessayez.");
      });
    });
  });
}

async function loadVehicleDashboardData() {
  vehicleDashboardData.loading = true;
  vehicleDashboardData.error = "";
  renderDashboard();
  try {
    const [listingsPayload, rentalPayload, chauffeurPayload, contacts] = await Promise.all([
      vehicleApiList("/dashboard/voitures"),
      vehicleApiList("/dashboard/voitures/rental-requests"),
      vehicleApiList("/dashboard/voitures/chauffeur-requests"),
      vehicleApiRequest('/dashboard/contacts?module=vehicles'),
    ]);
    const rentalRequests = vehicleListFromPayload(rentalPayload).map((request) => ({ ...request, requestType: "location" }));
    const chauffeurRequests = vehicleListFromPayload(chauffeurPayload).map((request) => ({ ...request, requestType: "chauffeur" }));
    vehicleDashboardData.listings = vehicleListFromPayload(listingsPayload);
    vehicleDashboardData.contacts = vehicleListFromPayload(contacts).filter(contact => contact.source === 'form');
    vehicleDashboardData.requests = [...rentalRequests, ...chauffeurRequests].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  } catch (error) {
    vehicleDashboardData.error = error instanceof Error ? error.message : "Chargement impossible.";
  } finally {
    vehicleDashboardData.loading = false;
    renderDashboard();
  }
}

void import('../../voitures/vehicle-content.mjs').then(module => { vehicleDashboardPresentation = module; return loadVehicleDashboardData(); });

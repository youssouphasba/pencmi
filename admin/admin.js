const adminRoutes = {
  overview: "/admin",
  users: "/admin/users",
  advertisers: "/admin/annonceurs",
  listings: "/admin/listings",
  listingsRealEstate: "/admin/listings/immobilier",
  listingsHotels: "/admin/listings/hotels",
  listingsVehicles: "/admin/listings/voitures",
  listingsTrips: "/admin/listings/voyages",
  validation: "/admin/validation",
  reports: "/admin/reports",
  moderation: "/admin/moderation",
  messages: "/admin/messages",
  contacts: "/admin/contacts",
  notifications: "/admin/notifications",
  emailLogs: "/admin/email-logs",
  statistics: "/admin/statistiques",
  verification: "/admin/verification",
  content: "/admin/content",
  seo: "/admin/seo",
  geo: "/admin/geo",
  monetization: "/admin/monetization",
  hotelIntegrations: "/admin/hotel-integrations",
  settings: "/admin/settings",
  home: "/",
  login: "/login?next=/admin",
};

const ACCESS_TOKEN_STORAGE_KEY = "pencmi_access_token";
const REFRESH_TOKEN_STORAGE_KEY = "pencmi_refresh_token";
const API_BASE_STORAGE_KEY = "pencmi_api_base_url";

const adminState = {
  currentUser: null,
  overview: null,
  users: [],
  advertisers: [],
  listings: {
    realEstate: [],
    hotels: [],
    vehicles: [],
    trips: [],
  },
  reports: [],
  messages: [],
  contacts: [],
  notifications: [],
  emailLogs: [],
  loading: true,
  error: "",
};

const adminModuleLabels = {
  real_estate: "Immobilier",
  hotels: "Hôtels",
  vehicles: "Voitures",
  trips: "Voyages",
  system: "Système",
};

const adminStatusLabels = {
  active: "Actif",
  draft: "Brouillon",
  pending_review: "En attente",
  pending_verification: "En attente",
  refused: "Refusé",
  suspended: "Suspendu",
  expired: "Expiré",
  deleted: "Supprimé",
  new: "Nouveau",
  in_progress: "En cours",
  resolved: "Résolu",
  rejected: "Rejeté",
  archived: "Archivé",
};

function adminRouteHref(path) {
  if (window.location.protocol !== "file:") return path;
  const depth = Number(document.body.dataset.routeDepth || "1");
  const prefix = "../".repeat(depth);
  if (path === "/") return `${prefix}index.html`;
  if (path.startsWith("/login?")) return `${prefix}login/${path.slice("/login".length)}`;
  return `${prefix}${path.replace(/^\//, "")}/`;
}

function getApiBaseUrl() {
  return String(
    window.PencmiConfig?.apiBaseUrl ||
    window.PencmiRuntimeConfig?.apiBaseUrl ||
    window.PencmiApiBaseUrl ||
    window.localStorage.getItem(API_BASE_STORAGE_KEY) ||
    ""
  ).replace(/\/+$/, "");
}

function getAccessToken() {
  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) || "";
}

function getRefreshToken() {
  return window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY) || "";
}

function setTokens(tokens) {
  if (tokens?.accessToken) window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, tokens.accessToken);
  if (tokens?.refreshToken) window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, tokens.refreshToken);
}

function clearTokens() {
  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
}

async function refreshAccessToken() {
  const baseUrl = getApiBaseUrl();
  const refreshToken = getRefreshToken();
  if (!baseUrl || !refreshToken) throw new Error("Connexion admin requise.");

  const response = await fetch(`${baseUrl}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    clearTokens();
    throw new Error(payload?.error?.message || "Connexion admin requise.");
  }

  const tokens = payload?.data ?? payload;
  setTokens(tokens);
  return tokens;
}

async function apiRequest(path, options = {}, canRetry = true) {
  const baseUrl = getApiBaseUrl();
  const token = getAccessToken();
  if (!baseUrl) throw new Error("API admin non configurée.");

  if (!token) {
    if (getRefreshToken() && canRetry) {
      await refreshAccessToken();
      return apiRequest(path, options, false);
    }
    throw new Error("Connexion admin requise.");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json().catch(() => null);
  if (response.status === 401 && canRetry && getRefreshToken()) {
    await refreshAccessToken();
    return apiRequest(path, options, false);
  }

  if (!response.ok) throw new Error(payload?.error?.message || "Chargement admin impossible.");
  return payload?.data ?? payload;
}

async function optionalApiRequest(path) {
  return apiRequest(path).catch(() => null);
}

function listFrom(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function formatRole(role) {
  const labels = {
    client: "Client",
    advertiser_individual: "Annonceur particulier",
    real_estate_agency: "Agence immobilière",
    hotel_manager: "Hôtel",
    vehicle_renter: "Loueur",
    vehicle_dealer: "Garage",
    chauffeur: "Chauffeur",
    transport_provider: "Transporteur",
    admin: "Admin",
  };
  return labels[role] || role || "";
}

function formatStatus(status) {
  return adminStatusLabels[status] || status || "";
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function formatMetric(value) {
  return Number(value || 0).toLocaleString("fr-FR");
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function AdminUnauthorizedState(message = "Accès non autorisé") {
  const isLoginRequired = message === "Connexion admin requise.";
  const target = isLoginRequired ? adminRoutes.login : adminRoutes.home;
  const label = isLoginRequired ? "Se connecter" : "Retour à l’accueil";
  return `<section class="admin-empty-state"><h2>${escapeHtml(message)}</h2><a class="btn btn-primary" href="${adminRouteHref(target)}">${label}</a></section>`;
}

function AdminLayout(content, currentPage = "overview", title = "Administration Péncmi", subtitle = "Gérez les utilisateurs, annonces, signalements et performances de la plateforme.") {
  return `
    <div class="admin-shell">
      ${AdminSidebar(currentPage)}
      <main class="admin-main">
        ${AdminHeader(title, subtitle)}
        ${content}
      </main>
    </div>
  `;
}

function AdminSidebar(currentPage = "overview") {
  const groups = [
    {
      title: "Pilotage",
      items: [
        ["Vue d’ensemble", adminRoutes.overview, "overview"],
        ["Statistiques", adminRoutes.statistics, "statistics"],
        ["Paramètres", adminRoutes.settings, "settings"],
      ],
    },
    {
      title: "Comptes",
      items: [
        ["Utilisateurs", adminRoutes.users, "users", adminState.users.length],
        ["Annonceurs", adminRoutes.advertisers, "advertisers", adminState.advertisers.length],
        ["Vérification", adminRoutes.verification, "verification", 0],
      ],
    },
    {
      title: "Annonces",
      items: [
        ["Toutes les annonces", adminRoutes.listings, "listings", getAllListings().length],
        ["Immobilier", adminRoutes.listingsRealEstate, "listingsRealEstate", adminState.listings.realEstate.length],
        ["Hôtels", adminRoutes.listingsHotels, "listingsHotels", adminState.listings.hotels.length],
        ["Voitures", adminRoutes.listingsVehicles, "listingsVehicles", adminState.listings.vehicles.length],
        ["Voyages", adminRoutes.listingsTrips, "listingsTrips", adminState.listings.trips.length],
        ["Validation", adminRoutes.validation, "validation", countPendingListings()],
      ],
    },
    {
      title: "Sécurité",
      items: [
        ["Signalements", adminRoutes.reports, "reports", adminState.reports.length],
        ["Modération", adminRoutes.moderation, "moderation", 0],
        ["Messages", adminRoutes.messages, "messages", adminState.messages.length],
        ["Contacts", adminRoutes.contacts, "contacts", adminState.contacts.length],
      ],
    },
    {
      title: "Plateforme",
      items: [
        ["Notifications", adminRoutes.notifications, "notifications", adminState.notifications.length],
        ["Emails", adminRoutes.emailLogs, "emailLogs", adminState.emailLogs.length],
        ["Contenus", adminRoutes.content, "content", 0],
        ["SEO", adminRoutes.seo, "seo", 0],
        ["GEO", adminRoutes.geo, "geo", 0],
        ["Monétisation", adminRoutes.monetization, "monetization", 0],
        ["Support", "/admin/support", "support", 0],
        ["Intégrations hôtels", adminRoutes.hotelIntegrations, "hotelIntegrations", 0],
      ],
    },
  ];

  return `
    <aside class="admin-sidebar" id="admin-sidebar">
      <div class="dashboard-brand"><span>P</span><div><strong>Péncmi</strong><small>Back-office admin</small></div></div>
      <nav class="admin-nav">
        ${groups.map((group) => `
          <section class="admin-nav-group">
            <h2>${group.title}</h2>
            ${group.items.map(([label, href, key, badge]) => `<a href="${adminRouteHref(href)}"${key === currentPage ? ' aria-current="page"' : ""}><span>${label}</span>${typeof badge === "number" ? `<span class="notification-badge">${formatMetric(badge)}</span>` : ""}</a>`).join("")}
          </section>
        `).join("")}
      </nav>
    </aside>
  `;
}

function AdminHeader(title, subtitle) {
  return `
    <header class="admin-header">
      <div>
        <button class="btn btn-ghost admin-menu-toggle" type="button" data-open-admin-sidebar>Menu</button>
        <h1>${title}</h1>
        <p>${subtitle}</p>
      </div>
      <div class="admin-header-actions"><a class="btn btn-ghost" href="${adminRouteHref(adminRoutes.home)}">Retour à l’accueil</a></div>
    </header>
  `;
}

function getAllListings() {
  return [
    ...adminState.listings.realEstate.map((item) => ({ ...item, module: "real_estate" })),
    ...adminState.listings.hotels.map((item) => ({ ...item, module: "hotels" })),
    ...adminState.listings.vehicles.map((item) => ({ ...item, module: "vehicles" })),
    ...adminState.listings.trips.map((item) => ({ ...item, module: "trips" })),
  ];
}

function countPendingListings() {
  return getAllListings().filter((item) => item.status === "pending_review").length;
}

function AdminOverviewPage() {
  const overview = adminState.overview || {};
  const allListings = getAllListings();
  const activeListings = allListings.filter((item) => item.status === "active").length;
  const kpis = [
    ["Utilisateurs", overview.users ?? adminState.users.length],
    ["Annonceurs", overview.advertisers ?? adminState.advertisers.length],
    ["Toutes les annonces", allListings.length],
    ["Annonces actives", activeListings],
    ["Annonces en attente", overview.pendingRealEstate ?? countPendingListings()],
    ["Signalements", overview.reports ?? adminState.reports.length],
    ["Messages", adminState.messages.length],
    ["Contacts", adminState.contacts.length],
    ["Notifications", adminState.notifications.length],
    ["Emails échoués", adminState.emailLogs.filter((item) => item.status === "failed").length],
    ["Vérifications", 0],
    ["Intégrations hôtels", 0],
  ];

  return AdminLayout(`
    <section class="admin-kpi-grid">${kpis.map(([label, value]) => AdminKpiCard(label, value)).join("")}</section>
    <section class="admin-grid admin-section">
      ${AdminModuleCard("Immobilier", adminState.listings.realEstate.length, adminRoutes.listingsRealEstate)}
      ${AdminModuleCard("Hôtels", adminState.listings.hotels.length, adminRoutes.listingsHotels)}
      ${AdminModuleCard("Voitures", adminState.listings.vehicles.length, adminRoutes.listingsVehicles)}
      ${AdminModuleCard("Voyages", adminState.listings.trips.length, adminRoutes.listingsTrips)}
      ${AdminModuleCard("Signalements", adminState.reports.length, adminRoutes.reports)}
      ${AdminModuleCard("Validation", countPendingListings(), adminRoutes.validation)}
    </section>
  `);
}

function AdminKpiCard(label, value = 0) {
  return `<article class="admin-kpi-card"><span>${label}</span><div class="admin-kpi-value">${formatMetric(value)}</div></article>`;
}

function AdminModuleCard(title, count, href) {
  return `<article class="admin-card"><h2>${title}</h2><p>${formatMetric(count)} élément${Number(count) > 1 ? "s" : ""}</p><a class="btn btn-light" href="${adminRouteHref(href)}">Ouvrir</a></article>`;
}

function AdminUsersPage() {
  const rows = adminState.users.map((user) => [
    [user.firstName, user.lastName].filter(Boolean).join(" ") || "Utilisateur",
    formatRole(user.role),
    formatStatus(user.status),
    user.email || "",
    user.phone || "",
    user.city || "",
    formatDate(user.createdAt),
  ]);
  return AdminDataPage("users", "Utilisateurs", "Comptes présents sur la plateforme.", AdminUserFilters(), ["Utilisateur", "Rôle", "Statut", "Email", "Téléphone", "Ville", "Inscription"], rows, "Aucun utilisateur trouvé.");
}

function AdminAdvertisersPage() {
  const rows = adminState.advertisers.map((user) => [
    user.professionalProfile?.businessName || [user.firstName, user.lastName].filter(Boolean).join(" ") || "Annonceur",
    formatRole(user.role),
    user.professionalProfile?.city || user.city || "",
    formatMetric(user.listingsCount),
    user.email || "",
    user.phone || "",
  ]);
  return AdminDataPage("advertisers", "Annonceurs", "Professionnels et comptes annonceurs.", AdminAdvertiserFilters(), ["Annonceur", "Type", "Ville", "Annonces", "Email", "Téléphone"], rows, "Aucun annonceur trouvé.");
}

function normalizeListingTitle(item) {
  return item.title || item.name || item.propertyName || item.vehicleTitle || "Annonce";
}

function normalizeOwnerName(item) {
  return item.owner?.professionalProfile?.businessName || item.owner?.businessName || item.professionalProfile?.businessName || [item.owner?.firstName, item.owner?.lastName].filter(Boolean).join(" ") || "";
}

function normalizeListingRows(items, moduleKey) {
  return items.map((item) => [
    normalizeListingTitle(item),
    adminModuleLabels[moduleKey] || moduleKey,
    normalizeOwnerName(item),
    item.city || item.departureCity || "",
    formatStatus(item.status),
    formatDate(item.createdAt),
  ]);
}

function AdminListingsPage() {
  const rows = [
    ...normalizeListingRows(adminState.listings.realEstate, "real_estate"),
    ...normalizeListingRows(adminState.listings.hotels, "hotels"),
    ...normalizeListingRows(adminState.listings.vehicles, "vehicles"),
    ...normalizeListingRows(adminState.listings.trips, "trips"),
  ];
  return AdminDataPage("listings", "Toutes les annonces", "Supervisez les annonces de tous les modules Péncmi.", AdminListingFilters(), ["Titre", "Module", "Annonceur", "Ville", "Statut", "Publication"], rows, "Aucune annonce disponible.");
}

function AdminListingsByModulePage(moduleKey, title, items, currentPage) {
  return AdminDataPage(currentPage, title, "Consultez les annonces de ce module.", AdminListingFilters(), ["Titre", "Annonceur", "Ville", "Statut", "Publication"], normalizeListingRows(items, moduleKey).map((row) => [row[0], row[2], row[3], row[4], row[5]]), "Aucune annonce disponible.");
}

function AdminValidationPage() {
  const pending = getAllListings().filter((item) => item.status === "pending_review");
  const rows = normalizeListingRows(pending, "real_estate");
  return AdminDataPage("validation", "Validation des annonces", "Traitez les annonces en attente de validation.", AdminListingFilters(), ["Titre", "Module", "Annonceur", "Ville", "Statut", "Publication"], rows, "Aucune annonce en attente de validation.");
}

function AdminReportsPage() {
  const rows = adminState.reports.map((item) => [item.module || "", item.targetType || "", item.reason || "", formatStatus(item.status), item.priority || "", formatDate(item.createdAt)]);
  return AdminDataPage("reports", "Signalements", "Gérez les signalements sur les annonces, utilisateurs, messages et conversations.", AdminReportFilters(), ["Module", "Cible", "Motif", "Statut", "Priorité", "Date"], rows, "Aucun signalement pour le moment.");
}

function AdminMessagesPage() {
  return AdminDataPage("messages", "Messages signalés", "Supervisez les messages signalés ou nécessitant modération.", AdminModuleFilters(), ["Module", "Conversation", "Expéditeur", "Statut", "Date"], [], "Aucun message signalé.");
}

function AdminContactsPage() {
  return AdminDataPage("contacts", "Contacts générés", "Suivez les contacts générés par source et par module.", AdminModuleFilters(), ["Module", "Annonce", "Source", "Annonceur", "Date", "Statut"], [], "Aucun contact enregistré pour le moment.");
}

function AdminNotificationsPage() {
  return AdminDataPage("notifications", "Notifications internes", "Supervisez les notifications internes envoyées aux clients, annonceurs et admins.", AdminModuleFilters(), ["Audience", "Module", "Type", "Statut", "Priorité", "Date"], [], "Aucune notification disponible.");
}

function AdminEmailLogsPage() {
  return AdminDataPage("emailLogs", "Logs emails", "Consultez les emails prévus, envoyés, échoués ou annulés.", AdminEmailFilters(), ["Destinataire", "Module", "Type", "Sujet", "Statut", "Date"], [], "Aucun email enregistré pour le moment.");
}

function AdminStatisticsPage() {
  const rows = [
    ["Utilisateurs", adminState.users.length],
    ["Annonceurs", adminState.advertisers.length],
    ["Annonces", getAllListings().length],
    ["Signalements", adminState.reports.length],
    ["Messages", adminState.messages.length],
    ["Contacts", adminState.contacts.length],
  ];
  return AdminLayout(`
    ${AdminStatisticsFilters()}
    <section class="admin-kpi-grid admin-section">${rows.map(([label, value]) => AdminKpiCard(label, value)).join("")}</section>
  `, "statistics", "Statistiques globales", "Analysez les volumes et performances globales de Péncmi.");
}

function AdminSettingsPage() {
  const sections = [
    ["Paramètres généraux", ["Validation manuelle des annonces", "Notifications admin", "Suivi des erreurs"]],
    ["Sécurité", ["Accès admin", "Journal d’audit", "Sessions administrateur"]],
    ["Modération", ["Signalements", "Messages signalés", "Annonces suspendues"]],
    ["Contenus", ["Pages légales", "FAQ", "Conseils de sécurité"]],
  ];
  return AdminLayout(`
    <form class="admin-card" data-admin-form>
      ${sections.map(([title, options]) => `<section class="admin-settings-section"><h2>${title}</h2>${options.map(AdminOption).join("")}</section>`).join("")}
      <div class="admin-message" data-admin-success>Les paramètres ont été enregistrés.</div>
      <div class="admin-actions"><button class="btn btn-primary" type="submit">Enregistrer les paramètres</button></div>
    </form>
  `, "settings", "Paramètres admin", "Configurez les règles de validation, modération, notifications et sécurité.");
}

function AdminPlaceholderPage(currentPage, title, subtitle) {
  return AdminLayout(`
    ${AdminModuleFilters()}
    ${AdminEmptyState("Aucune donnée disponible pour le moment.")}
  `, currentPage, title, subtitle);
}

function AdminDataPage(currentPage, title, subtitle, filters, columns, rows, emptyTitle) {
  return AdminLayout(`
    ${filters}
    ${rows.length ? AdminTable(columns, rows) : AdminEmptyState(emptyTitle)}
  `, currentPage, title, subtitle);
}

function AdminTable(columns, rows) {
  return `
    <section class="admin-table-shell admin-section">
      <div class="admin-scroll">
        <table class="admin-table">
          <thead><tr>${columns.map((column) => `<th>${column}</th>`).join("")}</tr></thead>
          <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
        </table>
      </div>
    </section>
  `;
}

function AdminUserFilters() {
  return `<section class="admin-filter-row"><label>Rôle<select><option>Tous</option></select></label><label>Statut<select><option>Tous</option></select></label><label>Ville<input type="text"></label><label>Date d’inscription<input type="date"></label></section>`;
}

function AdminAdvertiserFilters() {
  return `<section class="admin-filter-row"><label>Type<select><option>Tous</option></select></label><label>Ville<input type="text"></label><label>Vérification<select><option>Tous</option></select></label></section>`;
}

function AdminListingFilters() {
  return `<section class="admin-filter-row"><label>Module<select><option>Tous</option><option>Immobilier</option><option>Hôtels</option><option>Voitures</option><option>Voyages</option></select></label><label>Statut<select><option>Tous</option><option>En attente</option><option>Actif</option><option>Suspendu</option></select></label><label>Ville<input type="text"></label><label>Date<input type="date"></label></section>`;
}

function AdminReportFilters() {
  return `<section class="admin-filter-row"><label>Module<select><option>Tous</option></select></label><label>Statut<select><option>Tous</option></select></label><label>Priorité<select><option>Toutes</option></select></label></section>`;
}

function AdminModuleFilters() {
  return `<section class="admin-filter-row"><label>Module<select><option>Tous</option><option>Immobilier</option><option>Hôtels</option><option>Voitures</option><option>Voyages</option><option>Système</option></select></label><label>Statut<select><option>Tous</option></select></label><label>Période<input type="date"></label></section>`;
}

function AdminEmailFilters() {
  return `<section class="admin-filter-row"><label>Module<select><option>Tous</option></select></label><label>Statut<select><option>Tous</option><option>Échoué</option><option>Envoyé</option></select></label><label>Période<input type="date"></label></section>`;
}

function AdminStatisticsFilters() {
  return `<section class="admin-filter-row"><label>Période<select><option>7 jours</option><option>30 jours</option><option>90 jours</option></select></label><label>Module<select><option>Tous</option></select></label><label>Ville<input type="text"></label></section>`;
}

function AdminEmptyState(title, text = "") {
  return `<section class="admin-empty-state admin-section"><h2>${title}</h2>${text ? `<p>${text}</p>` : ""}</section>`;
}

function AdminOption(label) {
  return `<label class="admin-option"><input type="checkbox"><span>${label}</span></label>`;
}

function bindAdmin() {
  document.querySelector("[data-open-admin-sidebar]")?.addEventListener("click", () => {
    document.querySelector("#admin-sidebar")?.classList.toggle("is-open");
  });

  document.querySelectorAll("[data-admin-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      form.querySelector("[data-admin-success]")?.classList.add("is-visible");
    });
  });
}

async function loadAdminData() {
  adminState.loading = true;
  adminState.error = "";

  try {
    const currentUser = await apiRequest("/auth/me");
    adminState.currentUser = currentUser;
    if (currentUser.role !== "admin") {
      adminState.error = "Accès non autorisé";
      return;
    }

    const [overview, users, advertisers, realEstateListings, hotels, vehicles, trips, reports] = await Promise.all([
      optionalApiRequest("/admin/overview"),
      optionalApiRequest("/admin/users"),
      optionalApiRequest("/admin/advertisers"),
      optionalApiRequest("/admin/listings/real-estate"),
      optionalApiRequest("/hotels"),
      optionalApiRequest("/voitures"),
      optionalApiRequest("/voyages"),
      optionalApiRequest("/admin/reports"),
    ]);

    adminState.overview = overview || {};
    adminState.users = listFrom(users);
    adminState.advertisers = listFrom(advertisers);
    adminState.listings.realEstate = listFrom(realEstateListings);
    adminState.listings.hotels = listFrom(hotels);
    adminState.listings.vehicles = listFrom(vehicles);
    adminState.listings.trips = listFrom(trips);
    adminState.reports = listFrom(reports);
  } catch (error) {
    adminState.error = error instanceof Error ? error.message : "Chargement admin impossible.";
  } finally {
    adminState.loading = false;
  }
}

async function renderAdmin() {
  const root = document.querySelector("#admin-root");
  if (!root) return;

  await loadAdminData();
  if (adminState.error) {
    root.innerHTML = AdminUnauthorizedState(adminState.error);
    return;
  }

  const page = document.body.dataset.adminPage || "overview";
  const pages = {
    overview: AdminOverviewPage,
    users: AdminUsersPage,
    advertisers: AdminAdvertisersPage,
    listings: AdminListingsPage,
    listingsRealEstate: () => AdminListingsByModulePage("real_estate", "Annonces immobilier", adminState.listings.realEstate, "listingsRealEstate"),
    listingsHotels: () => AdminListingsByModulePage("hotels", "Annonces hôtels", adminState.listings.hotels, "listingsHotels"),
    listingsVehicles: () => AdminListingsByModulePage("vehicles", "Annonces voitures", adminState.listings.vehicles, "listingsVehicles"),
    listingsTrips: () => AdminListingsByModulePage("trips", "Annonces voyages", adminState.listings.trips, "listingsTrips"),
    validation: AdminValidationPage,
    reports: AdminReportsPage,
    messages: AdminMessagesPage,
    contacts: AdminContactsPage,
    notifications: AdminNotificationsPage,
    emailLogs: AdminEmailLogsPage,
    statistics: AdminStatisticsPage,
    verification: () => AdminPlaceholderPage("verification", "Vérification", "Suivez les demandes de vérification des utilisateurs, annonceurs et annonces."),
    content: () => AdminPlaceholderPage("content", "Contenus administrables", "Gérez les pages, FAQ, règles de publication et contenus éditoriaux."),
    seo: () => AdminPlaceholderPage("seo", "SEO", "Gérez les métadonnées, slugs, redirections et sitemaps."),
    geo: () => AdminPlaceholderPage("geo", "GEO", "Gérez les contenus destinés aux moteurs IA."),
    monetization: () => AdminPlaceholderPage("monetization", "Monétisation", "Gérez les plans, boosts, sponsorisations et facturation."),
    hotelIntegrations: () => AdminPlaceholderPage("hotelIntegrations", "Intégrations hôtels", "Suivez les partenaires, clés API, webhooks et synchronisations."),
    moderation: () => AdminPlaceholderPage("moderation", "Modération", "Suivez les annonces, messages et utilisateurs à risque."),
    support: () => AdminPlaceholderPage("support", "Support", "Suivez les tickets et catégories support."),
    settings: AdminSettingsPage,
  };

  root.innerHTML = (pages[page] || AdminOverviewPage)();
  bindAdmin();
}

document.addEventListener("DOMContentLoaded", () => {
  void renderAdmin();
});

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
  hotelIntegrations: "/admin/hotel-integrations/partners",
  settings: "/admin/settings",
  home: "/",
  login: "/login?next=/admin",
};

const ACCESS_TOKEN_STORAGE_KEY = "pencmi_access_token";
const REFRESH_TOKEN_STORAGE_KEY = "pencmi_refresh_token";
const API_BASE_STORAGE_KEY = "pencmi_api_base_url";
const SESSION_STORAGE_KEY = "pencmi_current_session";
const tokenSessionModule = window.PencmiTokenSession
  ? Promise.resolve({ tokenSession: window.PencmiTokenSession })
  : import(new URL("../auth/token-session.mjs", document.currentScript.src));

const adminState = {
  currentUser: null,
  overview: null,
  users: [],
  advertisers: [],
  reports: [],
  messages: [],
  contacts: [],
  notifications: [],
  emailLogs: [],
  loading: true,
  error: "",
  errorCode: "",
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

function clearTokens() {
  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
}

async function logoutAdmin() {
  const baseUrl = getApiBaseUrl();
  const token = getAccessToken();
  if (baseUrl && token) {
    await fetch(`${baseUrl}/auth/logout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }).catch(() => null);
  }
  clearTokens();
  window.location.href = adminRouteHref(adminRoutes.login);
}

async function refreshAccessToken(failedAccessToken = getAccessToken()) {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) throw new Error("API admin non configurée.");
  const { tokenSession } = await tokenSessionModule;
  return tokenSession.refresh(baseUrl, failedAccessToken);
}

async function apiRequest(path, options = {}, canRetry = true) {
  const baseUrl = getApiBaseUrl();
  const token = getAccessToken();
  if (!baseUrl) throw new Error("API admin non configurée.");
  const requestCredentials = { accessToken: token, refreshToken: getRefreshToken() };

  if (!token) {
    if (getRefreshToken() && canRetry) {
      await refreshAccessToken(token);
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
    await refreshAccessToken(token);
    return apiRequest(path, options, false);
  }

  if (!response.ok) {
    if (response.status === 401) {
      const { tokenSession } = await tokenSessionModule;
      await tokenSession.invalidate(requestCredentials);
    }
    throw new Error(payload?.error?.message || "Chargement admin impossible.");
  }
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
  return value == null ? "—" : Number(value).toLocaleString("fr-FR");
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function AdminUnauthorizedState(message = "Accès non autorisé", requiresLogin = false) {
  const isLoginRequired = requiresLogin || !getAccessToken() || message === "Connexion admin requise.";
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
        ["Utilisateurs", adminRoutes.users, "users", adminState.overview?.users],
        ["Annonceurs", adminRoutes.advertisers, "advertisers", adminState.overview?.advertisers],
        ["Vérification", adminRoutes.verification, "verification", 0],
      ],
    },
    {
      title: "Annonces",
      items: [
        ["Toutes les annonces", adminRoutes.listings, "listings", listingCount()],
        ["Immobilier", adminRoutes.listingsRealEstate, "listingsRealEstate", listingCount("real_estate")],
        ["Hôtels", adminRoutes.listingsHotels, "listingsHotels", listingCount("hotels")],
        ["Voitures", adminRoutes.listingsVehicles, "listingsVehicles", listingCount("vehicles")],
        ["Voyages", adminRoutes.listingsTrips, "listingsTrips", listingCount("trips")],
        ["Validation", adminRoutes.validation, "validation", listingCount(null, "pending")],
      ],
    },
    {
      title: "Sécurité",
      items: [
        ["Signalements", adminRoutes.reports, "reports", adminState.overview?.reports],
        ["Modération", adminRoutes.moderation, "moderation", 0],
        ["Messages signalés", "/admin/moderation/messages", "messages"],
        ["Contacts", adminRoutes.contacts, "contacts", adminState.overview?.contacts],
      ],
    },
    {
      title: "Plateforme",
      items: [
        ["Notifications", adminRoutes.notifications, "notifications", adminState.overview?.notifications],
        ["Emails", adminRoutes.emailLogs, "emailLogs", adminState.overview?.failedEmails],
        ["Contenus", adminRoutes.content, "content", 0],
        ["SEO", adminRoutes.seo, "seo", 0],
        ["Guindi (assistant IA)", "/assistant", "assistant"],
        ["GEO", adminRoutes.geo, "geo", 0],
        ["Monétisation", adminRoutes.monetization, "monetization", 0],
        ["Support", "/admin/support", "support", 0],
        ["Intégrations hôtels", adminRoutes.hotelIntegrations, "hotelIntegrations", 0],
      ],
    },
  ];

  return `
    <aside class="admin-sidebar" id="admin-sidebar">
      <button class="btn btn-light admin-menu-toggle" type="button" data-close-admin-sidebar>Fermer le menu</button>
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
        <button class="btn btn-ghost admin-menu-toggle" type="button" data-open-admin-sidebar aria-controls="admin-sidebar" aria-expanded="false">Menu</button>
        <h1>${title}</h1>
        ${subtitle ? `<p>${subtitle}</p>` : ''}
      </div>
      <div class="admin-header-actions"><a class="btn btn-ghost" href="${adminRouteHref(adminRoutes.home)}">Retour à l’accueil</a><button class="btn btn-light" type="button" data-admin-logout>Se déconnecter</button></div>
    </header>
  `;
}

function listingCount(module, field = "total") {
  const counts = adminState.overview?.listingCounts;
  if (!counts) return null;
  if (module) return counts[module]?.[field] ?? null;
  return Object.values(counts).reduce((sum, value) => sum + value[field], 0);
}

function AdminOverviewPage() {
  const overview = adminState.overview || {};
  const kpis = [
    ["Utilisateurs", overview.users ?? adminState.users.length],
    ["Annonceurs", overview.advertisers ?? adminState.advertisers.length],
    ["Toutes les annonces", listingCount()],
    ["Annonces actives", listingCount(null, "active")],
    ["Annonces en attente", listingCount(null, "pending")],
    ["Signalements", overview.reports ?? adminState.reports.length],
    ["Messages visibles", overview.messages],
    ["Contacts", overview.contacts],
    ["Notifications", overview.notifications],
    ["Emails échoués", overview.failedEmails],
  ];

  return AdminLayout(`
    <section class="admin-kpi-grid">${kpis.map(([label, value]) => AdminKpiCard(label, value)).join("")}</section>
    <section class="admin-grid admin-section">
      ${AdminModuleCard("Immobilier", listingCount("real_estate"), adminRoutes.listingsRealEstate)}
      ${AdminModuleCard("Hôtels", listingCount("hotels"), adminRoutes.listingsHotels)}
      ${AdminModuleCard("Voitures", listingCount("vehicles"), adminRoutes.listingsVehicles)}
      ${AdminModuleCard("Voyages", listingCount("trips"), adminRoutes.listingsTrips)}
      ${AdminModuleCard("Signalements", overview.reports, adminRoutes.reports)}
      ${AdminModuleCard("Validation", listingCount(null, "pending"), adminRoutes.validation)}
    </section>
  `);
}

function AdminKpiCard(label, value = null) {
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

const moderationPages = {
  listings: { title: "Toutes les annonces" },
  validation: { title: "Validation des annonces", pendingOnly: true },
  listingsRealEstate: { title: "Annonces immobilières", module: "real_estate" },
  listingsHotels: { title: "Annonces hôtels", module: "hotels" },
  listingsVehicles: { title: "Annonces voitures", module: "vehicles" },
  listingsTrips: { title: "Annonces voyages", module: "trips" },
};

function AdminReportsPage() {
  const rows = adminState.reports.map((item) => [item.module || "", item.targetType || "", item.reason || "", formatStatus(item.status), item.priority || "", formatDate(item.createdAt)]);
  return AdminDataPage("reports", "Signalements", "Gérez les signalements sur les annonces, utilisateurs, messages et conversations.", AdminReportFilters(), ["Module", "Cible", "Motif", "Statut", "Priorité", "Date"], rows, "Aucun signalement pour le moment.");
}

function AdminMessagesPage() {
  return AdminLayout('<a class="btn btn-light" href="/admin/moderation/messages/">Ouvrir les messages signalés</a>', 'messages', 'Messages signalés', '');
}

const activityPages = { contacts: 'Contacts générés', notifications: 'Notifications internes', emailLogs: 'Journal des emails' };

function AdminStatisticsPage() {
  const overview = adminState.overview || {};
  const rows = [
    ["Utilisateurs", overview.users],
    ["Annonceurs", overview.advertisers],
    ["Annonces", listingCount()],
    ["Signalements", overview.reports],
    ["Messages visibles", overview.messages],
    ["Contacts", overview.contacts],
  ];
  return AdminLayout(`
    <section class="admin-kpi-grid admin-section">${rows.map(([label, value]) => AdminKpiCard(label, value)).join("")}</section>
  `, "statistics", "Statistiques globales", "Totaux enregistrés sur Péncmi.");
}

function AdminSettingsPage() {
  return AdminLayout(AdminEmptyState("Aucun paramètre global modifiable depuis cet écran."), "settings", "Paramètres admin", "");
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
  document.querySelector("[data-admin-logout]")?.addEventListener("click", () => {
    void logoutAdmin();
  });

}

function setAdminSidebar(open) {
  document.querySelector('#admin-sidebar')?.classList.toggle('is-open', open);
  const trigger = document.querySelector('[data-open-admin-sidebar]');
  trigger?.setAttribute('aria-expanded', String(open));
  if (open) document.querySelector('[data-close-admin-sidebar]')?.focus();
  else trigger?.focus();
}

document.addEventListener('click', (event) => {
  if (event.target.closest?.('[data-open-admin-sidebar]')) setAdminSidebar(true);
  if (event.target.closest?.('[data-close-admin-sidebar]')) setAdminSidebar(false);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !document.querySelector('dialog[open]') && document.querySelector('#admin-sidebar.is-open')) setAdminSidebar(false);
});

async function loadAdminData(page) {
  adminState.loading = true;
  adminState.error = "";

  try {
    const currentUser = await apiRequest("/auth/me");
    adminState.currentUser = currentUser;
    if (currentUser.role !== "admin") {
      adminState.error = "Accès non autorisé";
      return;
    }

    const [overview, users, advertisers] = await Promise.all([
      optionalApiRequest("/admin/overview"),
      null,
      page === 'advertisers' ? apiRequest("/admin/advertisers") : null,
    ]);
    adminState.overview = overview;
    adminState.users = listFrom(users);
    adminState.advertisers = listFrom(advertisers);
  } catch (error) {
    adminState.error = error instanceof Error ? error.message : "Chargement admin impossible.";
    adminState.errorCode = error?.code || "";
  } finally {
    adminState.loading = false;
  }
}

async function renderAdmin() {
  const root = document.querySelector("#admin-root");
  if (!root) return;

  const page = document.body.dataset.adminPage || "overview";
  await loadAdminData(page);
  if (adminState.error) {
    root.innerHTML = AdminUnauthorizedState(adminState.error, ["SESSION_INVALID", "REFRESH_UNCERTAIN", "SESSION_CHANGED", "COORDINATION_UNAVAILABLE"].includes(adminState.errorCode));
    return;
  }

  if (Object.hasOwn(moderationPages, page)) {
    const options = moderationPages[page];
    root.innerHTML = AdminLayout('<section id="moderation-queue" aria-label="Annonces"></section>', page, options.title, '');
    bindAdmin();
    const queue = root.querySelector('#moderation-queue');
    try {
      const { mountModerationQueue } = await import('./moderation-queue.mjs');
      mountModerationQueue(queue, { ...options, modules: adminModuleLabels, statuses: adminStatusLabels,
        refreshCounts: async () => {
          adminState.overview = await optionalApiRequest('/admin/overview');
          root.querySelector('#admin-sidebar').outerHTML = AdminSidebar(page);
          root.querySelector('[data-open-admin-sidebar]')?.setAttribute('aria-expanded', 'false');
        },
      });
    } catch {
      queue.textContent = 'Impossible de charger la file de modération.';
    }
    return;
  }
  if (Object.hasOwn(activityPages, page)) {
    root.innerHTML = AdminLayout('<section id="admin-activity"></section>', page, activityPages[page], '');
    bindAdmin();
    const target = root.querySelector('#admin-activity');
    try {
      const { mountAdminActivity } = await import('./activity.mjs');
      mountAdminActivity(target, page);
    } catch {
      target.textContent = 'Impossible de charger cette page.';
    }
    return;
  }
  if (page === 'statistics') {
    root.innerHTML = AdminLayout('<section id="admin-statistics" aria-label="Statistiques"></section>', page, 'Statistiques globales', 'Activité de la plateforme sur la période choisie.');
    bindAdmin();
    const target = root.querySelector('#admin-statistics');
    try {
      const { mountAdminStatistics } = await import('./statistics.mjs');
      mountAdminStatistics(target);
    } catch {
      target.textContent = 'Impossible de charger cette page.';
    }
    return;
  }
  if (page === 'users') {
    root.innerHTML = AdminLayout('<section id="admin-users" aria-label="Comptes"></section>', page, 'Utilisateurs', 'Comptes présents sur la plateforme.');
    bindAdmin();
    const target = root.querySelector('#admin-users');
    try {
      const { mountAdminUsers } = await import('./users.mjs');
      mountAdminUsers(target, { currentUserId: adminState.currentUser?.id });
    } catch {
      target.textContent = 'Impossible de charger cette page.';
    }
    return;
  }
  const pages = {
    overview: AdminOverviewPage,
    users: AdminUsersPage,
    advertisers: AdminAdvertisersPage,
    reports: AdminReportsPage,
    messages: AdminMessagesPage,
    statistics: AdminStatisticsPage,
    verification: () => AdminPlaceholderPage("verification", "Vérification", "Suivez les demandes de vérification des utilisateurs, annonceurs et annonces."),
    content: () => AdminPlaceholderPage("content", "Contenus administrables", "Gérez les pages, FAQ, règles de publication et contenus éditoriaux."),
    seo: () => AdminPlaceholderPage("seo", "SEO", "Gérez les métadonnées, slugs, redirections et sitemaps."),
    geo: () => AdminPlaceholderPage("geo", "GEO", "Gérez les contenus destinés aux moteurs IA."),
    monetization: () => AdminPlaceholderPage("monetization", "Monétisation", "Gérez les plans, boosts, sponsorisations et facturation."),
    hotelIntegrations: () => AdminPlaceholderPage("hotelIntegrations", "Intégrations hôtels", "Suivez les partenaires de synchronisation et leurs webhooks."),
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

const routes = {
  publish: "/publier?category=immobilier",
  realEstate: "/immobilier",
  overview: "/dashboard/immobilier",
  listings: "/dashboard/immobilier/annonces",
  messages: "/dashboard/immobilier/messages",
  contacts: "/dashboard/immobilier/contacts",
  visits: "/dashboard/immobilier/visites",
  favorites: "/dashboard/immobilier/favoris",
  stats: "/dashboard/immobilier/statistiques",
  contactSettings: "/dashboard/immobilier/contact-settings",
  emailSettings: "/dashboard/immobilier/email-settings",
  profile: "/dashboard/profil",
  login: "/login?next=/dashboard/immobilier",
};

let dashboardStats = null;
let listingPerformanceStats = [];
let recentVisitRequests = [];
let selectedPeriod = "30";
let dashboardLoading = true;
let dashboardError = "";

const ACCESS_TOKEN_STORAGE_KEY = "pencmi_access_token";
const REFRESH_TOKEN_STORAGE_KEY = "pencmi_refresh_token";
const SESSION_STORAGE_KEY = "pencmi_current_session";

const sidebarItems = [
  ["Vue d’ensemble", routes.overview],
  ["Mes annonces", routes.listings, "listings"],
  ["Messages", routes.messages, "messages"],
  ["Contacts", routes.contacts, "contacts"],
  ["Demandes de visite", routes.visits, "visits"],
  ["Favoris reçus", routes.favorites],
  ["Statistiques", routes.stats, "stats"],
  ["Moyens de contact", routes.contactSettings, "contactSettings"],
  ["Emails automatiques", routes.emailSettings, "failedEmails"],
  ["Mon profil", routes.profile],
];

const kpiDefinitions = [
  ["Annonces actives", "activeListings", "AN"],
  ["Annonces en attente", "pendingListings", "AT"],
  ["Annonces suspendues", "suspendedListings", "SU"],
  ["Demandes de visite", "visitRequests", "DV"],
  ["Contacts", "contacts", "CO"],
  ["Messages", "messages", "MS"],
];

function routeHref(path) {
  if (window.location.protocol !== "file:") return path;

  const depth = Number(document.body?.dataset?.routeDepth || "2");
  const prefix = "../".repeat(depth);

  if (path === "/immobilier") return `${prefix}immobilier/`;
  if (path.startsWith("/publier")) return `${prefix}publier/?category=immobilier`;
  if (path.startsWith("/login?")) return `${prefix}login/${path.slice("/login".length)}`;
  if (path.includes("?")) {
    const [base, query] = path.split("?");
    return `${routeHref(base)}?${query}`;
  }
  if (path.startsWith("/dashboard/")) return `${prefix}${path.replace(/^\//, "")}/`;
  if (path.startsWith("/immobilier/annonce/")) {
    return `${prefix}immobilier/annonce/?id=${encodeURIComponent(path.slice("/immobilier/annonce/".length))}`;
  }

  return path;
}

function getApiBaseUrl() {
  return String(window.PencmiConfig?.apiBaseUrl || window.PencmiRuntimeConfig?.apiBaseUrl || "").replace(/\/+$/, "");
}

function getAccessToken() {
  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) || "";
}

async function logoutDashboard() {
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
  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(SESSION_STORAGE_KEY);
  window.location.href = routeHref("/login");
}

async function apiRequest(path) {
  const baseUrl = getApiBaseUrl();
  const token = getAccessToken();

  if (!baseUrl || !token) {
    throw new Error("Session annonceur indisponible.");
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

function formatMetric(value) {
  return Number(value || 0).toLocaleString("fr-FR");
}

function dashboardEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function formatStatus(status) {
  const labels = {
    draft: "Brouillon",
    pending_review: "En attente",
    active: "Active",
    suspended: "Suspendue",
    expired: "Expirée",
    deleted: "Supprimée",
    new: "Nouvelle",
    pending: "En attente",
    accepted: "Acceptée",
    refused: "Refusée",
    cancelled: "Annulée",
    completed: "Terminée",
  };
  return labels[status] || "À renseigner";
}

function formatPropertyType(type) {
  const labels = {
    appartement: "Appartement",
    maison: "Maison",
    villa: "Villa",
    terrain: "Terrain",
    studio: "Studio",
    chambre: "Chambre",
    bureau: "Bureau",
    commerce: "Commerce",
  };
  return labels[type] || type || "";
}

function completionScore(listing) {
  const metadata = listing.metadata || {};
  const checks = [
    Boolean(metadata.photos?.length),
    Boolean(listing.title),
    Boolean(listing.description),
    Boolean(listing.city),
    Boolean(listing.propertyType),
    Boolean(listing.transaction),
    Boolean(listing.neighborhood),
    Boolean(metadata.surface),
    Boolean(metadata.bedrooms || metadata.bedrooms === 0),
    Boolean(metadata.bathrooms || metadata.bathrooms === 0),
  ];

  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function mapListingPerformance(listing, report) {
  return {
    listingId: listing.id,
    title: listing.title,
    status: listing.status,
    city: listing.city,
    propertyType: formatPropertyType(listing.propertyType),
    visitRequests: report.requestsByListing?.[listing.id] || 0,
    completionScore: completionScore(listing),
    updatedAt: listing.updatedAt,
  };
}

function buildDashboardStats(report) {
  return {
    activeListings: report.listings.byStatus.active || 0,
    pendingListings: report.listings.byStatus.pending_review || 0,
    suspendedListings: report.listings.byStatus.suspended || 0,
    visitRequests: report.requests.total,
    pendingVisits: report.requests.pending,
    contacts: report.contacts.direct,
    messages: report.messages.inbound,
  };
}

function RealEstateDashboardLayout() {
  document.querySelector("#dashboard-layout").innerHTML = `
    <div class="dashboard-shell">
      ${DashboardSidebar()}
      <main class="dashboard-main">
        ${DashboardHeader()}
        ${DashboardPeriodFilter()}
        ${DashboardOverview()}
      </main>
    </div>
  `;

  bindDashboardEvents();
}

function DashboardSidebar() {
  const badges = {
    messages: dashboardStats?.messages || 0,
    contacts: dashboardStats?.contacts || 0,
    visits: dashboardStats?.pendingVisits || 0,
    listings: listingPerformanceStats.filter((listing) => listing.status !== "active").length,
    stats: 0,
    contactSettings: 0,
    failedEmails: 0,
  };

  return `
    <aside class="dashboard-sidebar" id="dashboard-sidebar">
      <div class="dashboard-brand">
        <span>P</span>
        <div>
          <strong>Péncmi</strong>
          <small>Annonceur immobilier</small>
        </div>
      </div>
      <nav class="dashboard-nav" aria-label="Navigation dashboard">
        ${sidebarItems.map(([label, href, badgeKey], index) => `
          <a href="${routeHref(href)}"${index === 0 ? ' aria-current="page"' : ""}>
            <span>${label}</span>
            ${badgeKey ? `<span class="notification-badge">${badges[badgeKey] || 0}</span>` : ""}
          </a>
        `).join("")}
      </nav>
    </aside>
  `;
}

function DashboardHeader() {
  return `
    <header class="dashboard-header">
      <div>
        <button class="btn btn-ghost dashboard-menu-toggle" type="button" data-open-sidebar>Menu</button>
        <h1>Dashboard immobilier</h1>
        <p>Gérez vos annonces et vos demandes réelles.</p>
      </div>
      <div class="dashboard-header-actions">
        <a class="btn btn-primary" href="${routeHref(routes.publish)}">Publier une annonce</a>
        <a class="btn btn-light" href="${routeHref(routes.realEstate)}">Voir le site</a>
        <button class="btn btn-ghost" type="button" data-dashboard-logout>Se déconnecter</button>
      </div>
    </header>
  `;
}

function DashboardPeriodFilter() {
  return `
    <section class="period-filter" aria-label="Filtre de période">
      <strong>Période d’analyse</strong>
      <select data-period-filter>
        <option value="today"${selectedPeriod === "today" ? " selected" : ""}>Aujourd’hui</option>
        <option value="7"${selectedPeriod === "7" ? " selected" : ""}>7 jours</option>
        <option value="30"${selectedPeriod === "30" ? " selected" : ""}>30 jours</option>
        <option value="90"${selectedPeriod === "90" ? " selected" : ""}>90 jours</option>
      </select>
    </section>
  `;
}

function DashboardOverview() {
  if (dashboardLoading) {
    return `<section class="dashboard-section">${EmptyDashboardState("Chargement du dashboard...")}</section>`;
  }

  if (dashboardError) {
    return `<section class="dashboard-section">${EmptyDashboardState(dashboardError, "Se connecter", routes.login)}</section>`;
  }

  return `
    <section class="dashboard-section">
      <div class="dashboard-section-header">
        <h2>KPI principaux</h2>
      </div>
      <div class="kpi-grid">${kpiDefinitions.map(KpiCard).join("")}</div>
    </section>

    <section class="dashboard-section">
      <div class="dashboard-section-header">
        <h2>Mes annonces</h2>
      </div>
      ${ListingPerformanceTable()}
      <div class="listing-performance-cards">${listingPerformanceStats.map(ListingPerformanceCard).join("")}</div>
    </section>

    <section class="dashboard-section">
      <div class="dashboard-grid">
        ${RecentVisitRequestsList()}
        ${TopListingsCard()}
        ${DashboardFavoritesOverview()}
      </div>
    </section>
  `;
}

function KpiCard([title, key, icon]) {
  return `
    <article class="kpi-card">
      <span class="kpi-icon">${icon}</span>
      <h3>${title}</h3>
      <div class="kpi-value">${formatMetric(dashboardStats?.[key] || 0)}</div>
    </article>
  `;
}

function ListingPerformanceTable() {
  if (!listingPerformanceStats.length) {
    return EmptyDashboardState("Vous n’avez aucune annonce immobilière pour le moment.", "Publier ma première annonce", routes.publish);
  }

  return `
    <div class="performance-table-wrap">
      <table class="performance-table">
        <thead>
          <tr>
            <th>Annonce</th>
            <th>Statut</th>
            <th>Ville</th>
            <th>Type</th>
            <th>Demandes sur la période</th>
            <th>Score</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>${listingPerformanceStats.map((listing) => `
          <tr>
            <td>${dashboardEscape(listing.title)}</td>
            <td>${ListingStatusBadge(listing.status)}</td>
            <td>${dashboardEscape(listing.city)}</td>
            <td>${dashboardEscape(listing.propertyType)}</td>
            <td>${formatMetric(listing.visitRequests)}</td>
            <td>${ListingCompletionScore(listing.completionScore)}</td>
            <td>
              <a href="${routeHref(`/immobilier/annonce/${listing.listingId}`)}">Voir</a>
            </td>
          </tr>
        `).join("")}</tbody>
      </table>
    </div>
  `;
}

function ListingPerformanceCard(listing) {
  return `
    <article class="dashboard-card">
      <h3>${dashboardEscape(listing.title)}</h3>
      <p>${ListingStatusBadge(listing.status)} ${dashboardEscape(listing.city)}</p>
      <p>Demandes sur la période : ${formatMetric(listing.visitRequests)}</p>
      ${ListingCompletionScore(listing.completionScore)}
    </article>
  `;
}

function ListingCompletionScore(score) {
  const value = Number(score || 0);
  return `
    <div class="completion-meter">
      <span>Annonce complétée à ${value}%</span>
      <div class="completion-track"><div class="completion-bar" style="width:${value}%"></div></div>
    </div>
  `;
}

function RecentVisitRequestsList() {
  return `
    <section class="dashboard-card">
      <div class="dashboard-section-header">
        <h3>Demandes de visite</h3>
        <a href="${routeHref(routes.visits)}">Voir tout</a>
      </div>
      ${recentVisitRequests.length ? recentVisitRequests.map((visit) => `
        <article>
          <strong>${dashboardEscape(visit.clientName || "Client")}</strong>
          <p>${dashboardEscape(visit.listingTitle)}</p>
          <p>${formatDate(visit.preferredDate)}</p>
          ${VisitStatusBadge(visit.status)}
        </article>
      `).join("") : EmptyDashboardState("Aucune demande de visite pour le moment.")}
    </section>
  `;
}

function TopListingsCard() {
  const topListings = listingPerformanceStats.filter((listing) => listing.visitRequests).sort((left, right) => right.visitRequests - left.visitRequests).slice(0, 3);
  return `
    <section class="dashboard-card">
      <h3>Annonces les plus demandées</h3>
      ${topListings.length ? topListings.map((listing) => `<p>${dashboardEscape(listing.title)} · ${formatMetric(listing.visitRequests)} demandes</p>`).join("") : EmptyDashboardState("Aucune demande sur cette période.")}
    </section>
  `;
}

function DashboardFavoritesOverview() {
  return `
    <section class="dashboard-card">
      <h3>Favoris reçus</h3>
      <p>Donnée indisponible : les favoris et les vues ne sont pas encore mesurés.</p>
    </section>
  `;
}

function EmptyDashboardState(text = "Aucune donnée disponible pour le moment.", actionLabel = "", actionHref = "") {
  return `
    <div class="empty-dashboard-state">
      <div>
        <strong>${text}</strong>
        ${actionLabel ? `<p><a class="btn btn-primary" href="${routeHref(actionHref)}">${actionLabel}</a></p>` : ""}
      </div>
    </div>
  `;
}

function ListingStatusBadge(status) {
  return `<span class="status-badge">${formatStatus(status)}</span>`;
}

function VisitStatusBadge(status) {
  return `<span class="status-badge">${formatStatus(status)}</span>`;
}

function bindDashboardEvents() {
  document.querySelector("[data-open-sidebar]")?.addEventListener("click", () => {
    document.querySelector("#dashboard-sidebar")?.classList.toggle("is-open");
  });

  document.querySelector("[data-dashboard-logout]")?.addEventListener("click", () => {
    void logoutDashboard();
  });

  document.querySelector("[data-period-filter]")?.addEventListener("change", (event) => {
    selectedPeriod = event.currentTarget.value;
    void loadDashboardData();
  });
}

async function loadDashboardData() {
  dashboardLoading = true;
  dashboardError = "";
  RealEstateDashboardLayout();

  try {
    const [listingsPayload, visitsPayload, report] = await Promise.all([
      apiRequest("/dashboard/immobilier"),
      apiRequest("/dashboard/immobilier/visits"),
      apiRequest(`/dashboard/stats/report?module=real_estate&period=${encodeURIComponent(selectedPeriod)}`),
    ]);

    const listings = listingsPayload?.data || listingsPayload || [];
    const visits = visitsPayload?.data || visitsPayload || [];

    listingPerformanceStats = listings.map((listing) => mapListingPerformance(listing, report));
    recentVisitRequests = visits.slice(0, 5).map((visit) => ({
      clientName: visit.clientName,
      listingTitle: visit.listing?.title || "Annonce",
      preferredDate: visit.preferredDate,
      status: visit.status,
    }));
    dashboardStats = buildDashboardStats(report);
  } catch (error) {
    dashboardError = error instanceof Error ? error.message : "Chargement impossible.";
  } finally {
    dashboardLoading = false;
    RealEstateDashboardLayout();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  void loadDashboardData();
});

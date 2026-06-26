const adminRoutes = {
  overview: "/admin",
  users: "/admin/users",
  advertisers: "/admin/annonceurs",
  listings: "/admin/listings",
  listingsRealEstate: "/admin/listings/immobilier",
  home: "/",
  login: "/login?next=/admin",
};

const ACCESS_TOKEN_STORAGE_KEY = "pencmi_access_token";

let adminState = {
  currentUser: null,
  overview: null,
  users: [],
  advertisers: [],
  realEstateListings: [],
  loading: true,
  error: "",
};

function adminRouteHref(path) {
  if (window.location.protocol !== "file:") return path;
  const depth = Number(document.body.dataset.routeDepth || "1");
  const prefix = "../".repeat(depth);
  const routes = {
    "/": `${prefix}index.html`,
    "/admin": `${prefix}admin/`,
    "/admin/users": `${prefix}admin/users/`,
    "/admin/annonceurs": `${prefix}admin/annonceurs/`,
    "/admin/listings": `${prefix}admin/listings/`,
    "/admin/listings/immobilier": `${prefix}admin/listings/immobilier/`,
    "/login?next=/admin": `${prefix}login/?next=/admin`,
  };
  return routes[path] || path;
}

function getApiBaseUrl() {
  return String(window.PencmiConfig?.apiBaseUrl || window.PencmiRuntimeConfig?.apiBaseUrl || "").replace(/\/+$/, "");
}

function getAccessToken() {
  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) || "";
}

async function apiRequest(path) {
  const baseUrl = getApiBaseUrl();
  const token = getAccessToken();

  if (!baseUrl || !token) {
    throw new Error("Connexion admin requise.");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message || "Chargement admin impossible.");
  }

  return payload?.data ?? payload;
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
  const labels = {
    active: "Actif",
    pending_review: "En attente",
    pending_verification: "En attente",
    suspended: "Suspendu",
    expired: "Expiré",
    deleted: "Supprimé",
    draft: "Brouillon",
  };
  return labels[status] || status || "";
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function formatMetric(value) {
  return Number(value || 0).toLocaleString("fr-FR");
}

function AdminUnauthorizedState(message = "Accès non autorisé") {
  return `<section class="admin-empty-state"><h2>${message}</h2><a class="btn btn-primary" href="${adminRouteHref(adminRoutes.home)}">Retour à l’accueil</a></section>`;
}

function AdminSidebar(currentPage = "overview") {
  const nav = [
    ["Vue d’ensemble", adminRoutes.overview, "overview"],
    ["Utilisateurs", adminRoutes.users, "users"],
    ["Annonceurs", adminRoutes.advertisers, "advertisers"],
    ["Annonces immobilier", adminRoutes.listingsRealEstate, "listingsRealEstate"],
  ];

  return `
    <aside class="admin-sidebar" id="admin-sidebar">
      <div class="dashboard-brand"><span>P</span><div><strong>Péncmi</strong><small>Back-office admin</small></div></div>
      <nav class="admin-nav">${nav.map(([label, href, key]) => `<a href="${adminRouteHref(href)}"${key === currentPage ? ' aria-current="page"' : ""}><span>${label}</span></a>`).join("")}</nav>
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

function AdminLayout(content, currentPage, title, subtitle) {
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

function AdminOverviewPage() {
  const overview = adminState.overview || {};
  const cards = [
    ["Utilisateurs", overview.users],
    ["Annonceurs", overview.advertisers],
    ["Annonces immobilier", overview.realEstate],
    ["Immobilier actif", overview.activeRealEstate],
    ["Immobilier en attente", overview.pendingRealEstate],
    ["Signalements", overview.reports],
  ];

  return AdminLayout(`
    <section class="admin-kpi-grid">
      ${cards.map(([label, value]) => `<article class="admin-kpi-card"><span>${label}</span><div class="admin-kpi-value">${formatMetric(value)}</div></article>`).join("")}
    </section>
  `, "overview", "Administration Péncmi", "Vue consolidée des comptes et des annonces.");
}

function AdminUsersPage() {
  return AdminLayout(`
    ${adminState.users.length ? `
      <section class="admin-table-shell admin-section">
        <div class="admin-scroll">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Rôle</th>
                <th>Statut</th>
                <th>Email</th>
                <th>Téléphone</th>
                <th>Ville</th>
                <th>Inscription</th>
              </tr>
            </thead>
            <tbody>
              ${adminState.users.map((user) => `
                <tr>
                  <td>${[user.firstName, user.lastName].filter(Boolean).join(" ") || "Utilisateur"}</td>
                  <td>${formatRole(user.role)}</td>
                  <td>${formatStatus(user.status)}</td>
                  <td>${user.email || ""}</td>
                  <td>${user.phone || ""}</td>
                  <td>${user.city || ""}</td>
                  <td>${formatDate(user.createdAt)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </section>
    ` : `<section class="admin-empty-state admin-section"><h2>Aucun utilisateur trouvé.</h2></section>`}
  `, "users", "Utilisateurs", "Comptes présents sur la plateforme.");
}

function AdminAdvertisersPage() {
  return AdminLayout(`
    ${adminState.advertisers.length ? `
      <section class="admin-table-shell admin-section">
        <div class="admin-scroll">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Annonceur</th>
                <th>Type</th>
                <th>Ville</th>
                <th>Annonces</th>
                <th>Email</th>
                <th>Téléphone</th>
              </tr>
            </thead>
            <tbody>
              ${adminState.advertisers.map((user) => `
                <tr>
                  <td>${user.professionalProfile?.businessName || [user.firstName, user.lastName].filter(Boolean).join(" ") || "Annonceur"}</td>
                  <td>${formatRole(user.role)}</td>
                  <td>${user.professionalProfile?.city || user.city || ""}</td>
                  <td>${formatMetric(user.listingsCount)}</td>
                  <td>${user.email || ""}</td>
                  <td>${user.phone || ""}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </section>
    ` : `<section class="admin-empty-state admin-section"><h2>Aucun annonceur trouvé.</h2></section>`}
  `, "advertisers", "Annonceurs", "Professionnels et comptes annonceurs.");
}

function AdminRealEstateListingsPage() {
  return AdminLayout(`
    ${adminState.realEstateListings.length ? `
      <section class="admin-table-shell admin-section">
        <div class="admin-scroll">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Titre</th>
                <th>Type</th>
                <th>Transaction</th>
                <th>Ville</th>
                <th>Annonceur</th>
                <th>Statut</th>
                <th>Demandes</th>
                <th>Publication</th>
              </tr>
            </thead>
            <tbody>
              ${adminState.realEstateListings.map((listing) => `
                <tr>
                  <td>${listing.title}</td>
                  <td>${listing.propertyType || ""}</td>
                  <td>${listing.transaction || ""}</td>
                  <td>${listing.city || ""}</td>
                  <td>${listing.owner?.professionalProfile?.businessName || [listing.owner?.firstName, listing.owner?.lastName].filter(Boolean).join(" ") || "Annonceur"}</td>
                  <td>${formatStatus(listing.status)}</td>
                  <td>${formatMetric(listing.visitRequests?.length || 0)}</td>
                  <td>${formatDate(listing.createdAt)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </section>
    ` : `<section class="admin-empty-state admin-section"><h2>Aucune annonce immobilière disponible.</h2></section>`}
  `, "listingsRealEstate", "Annonces immobilier", "Liste réelle des annonces immobilières.");
}

function bindAdmin() {
  document.querySelector("[data-open-admin-sidebar]")?.addEventListener("click", () => {
    document.querySelector("#admin-sidebar")?.classList.toggle("is-open");
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

    const [overview, users, advertisers, realEstateListings] = await Promise.all([
      apiRequest("/admin/overview"),
      apiRequest("/admin/users"),
      apiRequest("/admin/advertisers"),
      apiRequest("/admin/listings/real-estate"),
    ]);

    adminState.overview = overview;
    adminState.users = users || [];
    adminState.advertisers = advertisers || [];
    adminState.realEstateListings = realEstateListings || [];
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
    listingsRealEstate: AdminRealEstateListingsPage,
    listings: AdminRealEstateListingsPage,
  };

  root.innerHTML = (pages[page] || AdminOverviewPage)();
  bindAdmin();
}

document.addEventListener("DOMContentLoaded", () => {
  void renderAdmin();
});

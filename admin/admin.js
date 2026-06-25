const adminUsers = [];
const adminAdvertisers = [];
const adminListings = [];
const adminReports = [];
const adminMessages = [];
const adminContacts = [];
const adminNotifications = [];
const adminEmailLogs = [];
const adminStats = null;
const adminAccess = {
  currentUser: null,
  requiredRole: "admin"
};

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
  home: "/"
};

const adminModuleLabels = {
  real_estate: "Immobilier",
  hotels: "Hôtels",
  vehicles: "Voitures",
  vehicle_sale: "Voitures vente",
  vehicle_rental: "Voitures location",
  vehicle_chauffeur: "Voiture avec chauffeur",
  trips: "Voyages",
  system: "Système"
};

const adminStatusLabels = {
  draft: "Brouillon",
  pending_review: "En attente",
  active: "Active",
  refused: "Refusée",
  suspended: "Suspendue",
  expired: "Expirée",
  deleted: "Supprimée",
  pending_verification: "En attente de vérification",
  new: "Nouveau",
  in_progress: "En cours",
  resolved: "Résolu",
  rejected: "Rejeté",
  archived: "Archivé"
};

const reportPriorityLabels = {
  low: "Faible",
  normal: "Normale",
  important: "Importante",
  urgent: "Urgente"
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
    "/admin/listings/hotels": `${prefix}admin/listings/hotels/`,
    "/admin/listings/voitures": `${prefix}admin/listings/voitures/`,
    "/admin/listings/voyages": `${prefix}admin/listings/voyages/`,
    "/admin/validation": `${prefix}admin/validation/`,
    "/admin/reports": `${prefix}admin/reports/`,
    "/admin/moderation": `${prefix}admin/moderation/`,
    "/admin/messages": `${prefix}admin/messages/`,
    "/admin/contacts": `${prefix}admin/contacts/`,
    "/admin/notifications": `${prefix}admin/notifications/`,
    "/admin/email-logs": `${prefix}admin/email-logs/`,
    "/admin/statistiques": `${prefix}admin/statistiques/`,
    "/admin/verification": `${prefix}admin/verification/`,
    "/admin/content": `${prefix}admin/content/`,
    "/admin/seo": `${prefix}admin/seo/`,
    "/admin/geo": `${prefix}admin/geo/`,
    "/admin/monetization": `${prefix}admin/monetization/`,
    "/admin/hotel-integrations": `${prefix}admin/hotel-integrations/`,
    "/admin/settings": `${prefix}admin/settings/`
  };
  return routes[path] || path;
}

function getAdminModuleLabel(module) {
  return adminModuleLabels[module] || "Péncmi";
}

function getAdminStatusLabel(status) {
  return adminStatusLabels[status] || "En attente";
}

function getReportPriorityLabel(priority) {
  return reportPriorityLabels[priority] || "Normale";
}

function filterAdminListings(items, predicate = () => true) {
  return items.filter(predicate);
}

function filterAdminUsers(items, predicate = () => true) {
  return items.filter(predicate);
}

function filterAdminReports(items, predicate = () => true) {
  return items.filter(predicate);
}

function buildAdminTargetUrl(targetType, targetId = "") {
  const routes = {
    listing: adminRoutes.listings,
    user: adminRoutes.users,
    message: adminRoutes.messages,
    conversation: adminRoutes.messages,
    report: adminRoutes.reports
  };
  const path = routes[targetType] || adminRoutes.overview;
  return targetId ? `${path}?id=${encodeURIComponent(targetId)}` : path;
}

function getAdminLoginRedirect(path = "/admin") {
  return `/login?next=${encodeURIComponent(path)}`;
}

function canAccessAdmin(user = adminAccess.currentUser) {
  return Boolean(user && user.role === adminAccess.requiredRole);
}

function AdminUnauthorizedState() {
  return `<section class="admin-empty-state"><h2>Accès non autorisé</h2><p>Votre rôle ne permet pas d’accéder au back-office admin.</p><a class="btn btn-primary" href="${adminRouteHref(adminRoutes.home)}">Retour à l’accueil</a></section>`;
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
  const nav = [
    ["Vue d’ensemble", adminRoutes.overview, "overview"],
    ["Utilisateurs", adminRoutes.users, "users", 0],
    ["Annonceurs", adminRoutes.advertisers, "advertisers", 0],
    ["Toutes les annonces", adminRoutes.listings, "listings"],
    ["Immobilier", adminRoutes.listingsRealEstate, "listingsRealEstate"],
    ["Hôtels", adminRoutes.listingsHotels, "listingsHotels"],
    ["Voitures", adminRoutes.listingsVehicles, "listingsVehicles"],
    ["Voyages", adminRoutes.listingsTrips, "listingsTrips"],
    ["Validation", adminRoutes.validation, "validation", 0],
    ["Signalements", adminRoutes.reports, "reports", 0],
    ["Modération", adminRoutes.moderation, "moderation", 0],
    ["Messages", adminRoutes.messages, "messages", 0],
    ["Contacts", adminRoutes.contacts, "contacts"],
    ["Notifications", adminRoutes.notifications, "notifications"],
    ["Emails", adminRoutes.emailLogs, "emailLogs", 0],
    ["Statistiques", adminRoutes.statistics, "statistics"],
    ["Vérification", adminRoutes.verification, "verification", 0],
    ["Contenus", adminRoutes.content, "content", 0],
    ["SEO", adminRoutes.seo, "seo", 0],
    ["GEO", adminRoutes.geo, "geo", 0],
    ["Monétisation", adminRoutes.monetization, "monetization", 0],
    ["Intégrations hôtels", adminRoutes.hotelIntegrations, "hotelIntegrations", 0],
    ["Paramètres", adminRoutes.settings, "settings"]
  ];

  return `
    <aside class="admin-sidebar" id="admin-sidebar">
      <div class="dashboard-brand"><span>P</span><div><strong>Péncmi</strong><small>Back-office admin</small></div></div>
      <nav class="admin-nav">${nav.map(([label, href, key, badge]) => `<a href="${adminRouteHref(href)}"${key === currentPage ? ' aria-current="page"' : ""}><span>${label}</span>${typeof badge === "number" ? `<span class="notification-badge">${badge}</span>` : ""}</a>`).join("")}</nav>
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

function AdminOverviewPage() {
  const kpis = [
    "Utilisateurs inscrits",
    "Annonceurs actifs",
    "Annonces actives",
    "Annonces en attente",
    "Annonces refusées",
    "Annonces suspendues",
    "Signalements ouverts",
    "Messages signalés",
    "Emails échoués",
    "Contacts générés",
    "Demandes clients",
    "Annonces publiées aujourd’hui"
  ];
  const sections = ["Annonces à valider", "Signalements récents", "Nouveaux annonceurs", "Emails en échec", "Activité récente"];

  return AdminLayout(`
    <section class="admin-kpi-grid">${kpis.map((label) => AdminKpiCard(label, 0)).join("")}</section>
    <section class="admin-grid admin-section">${sections.map((title) => `<article class="admin-card"><h2>${title}</h2><p>Aucune donnée disponible pour le moment.</p></article>`).join("")}</section>
    ${AdminEmptyState("Aucune activité pour le moment.")}
  `);
}

function AdminKpiCard(label, value = 0) {
  return `<article class="admin-kpi-card"><span>${label}</span><div class="admin-kpi-value">${value}</div></article>`;
}

function AdminUsersPage() {
  return AdminDataPage("users", "Utilisateurs", "Gérez les comptes, rôles, statuts et vérifications.", AdminUserFilters(), ["Utilisateur", "Rôle", "Statut", "Email", "Téléphone", "Ville", "Date d’inscription", "Vérifications", "Actions"], filterAdminUsers(adminUsers), "Aucun utilisateur trouvé.");
}

function AdminAdvertisersPage() {
  return AdminDataPage("advertisers", "Annonceurs", "Vérifiez les particuliers, agences, hôtels, loueurs, garages, chauffeurs et transporteurs.", AdminAdvertiserFilters(), ["Nom", "Type", "Ville", "Annonces", "Vérification", "Email", "Téléphone", "Date d’inscription", "Actions"], adminAdvertisers, "Aucun annonceur trouvé.");
}

function AdminListingsPage() {
  return AdminDataPage("listings", "Toutes les annonces", "Supervisez les annonces de tous les modules Péncmi.", AdminListingFilters(), ["Titre", "Module", "Annonceur", "Ville", "Statut", "Publication", "Signalements", "Vues", "Contacts", "Actions"], filterAdminListings(adminListings), "Aucune annonce disponible.");
}

function AdminListingsByModulePage(moduleKey, title, columns, currentPage) {
  const items = filterAdminListings(adminListings, (item) => item.module === moduleKey);
  return AdminDataPage(currentPage, title, "Consultez les annonces filtrées pour ce module.", AdminListingFilters(), columns, items, "Aucune annonce disponible.");
}

function AdminValidationPage() {
  const pendingListings = filterAdminListings(adminListings, (item) => item.status === "pending_review");
  return AdminLayout(`
    ${AdminListingFilters()}
    ${pendingListings.length ? AdminTable(["Module", "Titre", "Annonceur", "Date de soumission", "Score de complétion", "Documents", "Actions"], pendingListings) : AdminEmptyState("Aucune annonce en attente de validation.")}
    ${AdminDecisionModal()}
  `, "validation", "Validation des annonces", "Traitez les annonces en attente de validation et enregistrez vos décisions.");
}

function AdminReportsPage() {
  return AdminDataPage("reports", "Signalements", "Gérez les signalements sur les annonces, utilisateurs, messages et conversations.", AdminReportFilters(), ["Type", "Module", "Élément concerné", "Auteur", "Motif", "Statut", "Priorité", "Date", "Actions"], filterAdminReports(adminReports), "Aucun signalement pour le moment.");
}

function AdminMessagesPage() {
  return AdminDataPage("messages", "Messages signalés", "Supervisez uniquement les messages signalés ou nécessitant modération.", AdminModuleFilters(), ["Module", "Conversation", "Expéditeur", "Destinataire", "Extrait", "Statut", "Signalement", "Date", "Actions"], adminMessages, "Aucun message signalé.");
}

function AdminContactsPage() {
  return AdminDataPage("contacts", "Contacts générés", "Suivez les contacts générés par WhatsApp, téléphone, email, messages, formulaires et demandes.", AdminModuleFilters(), ["Module", "Annonce", "Source", "Annonceur", "Date", "Statut"], adminContacts, "Aucun contact enregistré pour le moment.");
}

function AdminNotificationsPage() {
  return AdminDataPage("notifications", "Notifications internes", "Supervisez les notifications internes envoyées aux clients, annonceurs et admins.", AdminModuleFilters(), ["Audience", "Module", "Type", "Statut", "Priorité", "Date", "Lien cible"], adminNotifications, "Aucune notification disponible.");
}

function AdminEmailLogsPage() {
  return AdminDataPage("emailLogs", "Logs emails", "Consultez les emails prévus, envoyés, échoués ou annulés.", AdminEmailFilters(), ["Destinataire", "Module", "Type d’email", "Sujet", "Statut", "Création", "Envoi", "Erreur", "Actions"], adminEmailLogs, "Aucun email enregistré pour le moment.");
}

function AdminStatisticsPage() {
  const metrics = ["Utilisateurs inscrits", "Annonceurs actifs", "Annonces par module", "Annonces publiées", "Annonces validées", "Annonces refusées", "Annonces suspendues", "Contacts générés", "Messages envoyés", "Demandes de réservation", "Demandes de visite", "Demandes de location", "Demandes de place", "Favoris", "Alertes créées", "Signalements"];
  return AdminLayout(`
    ${AdminStatisticsFilters()}
    ${adminStats ? `<section class="admin-kpi-grid">${metrics.map((label) => AdminKpiCard(label, 0)).join("")}</section>` : AdminEmptyState("Aucune statistique disponible pour le moment.")}
  `, "statistics", "Statistiques globales", "Analysez les volumes et performances globales de Péncmi.");
}

function AdminSettingsPage() {
  const sections = [
    ["Paramètres généraux", ["Nom de la plateforme", "Ville principale", "Langue par défaut"]],
    ["Validation annonces", ["Validation manuelle obligatoire", "Validation automatique possible plus tard", "Modules concernés", "Motifs de refus prédéfinis"]],
    ["Vérification annonceurs", ["Badge vérifié", "Documents professionnels", "Identité", "Téléphone", "Email"]],
    ["Signalements", ["Seuil de signalements avant suspension automatique future", "Priorité des signalements", "Règles de modération"]],
    ["Notifications", ["Annonces en attente", "Signalements", "Emails échoués", "Comptes suspects"]],
    ["Emails", ["Logs email", "Relance plus tard", "Suivi des erreurs"]],
    ["Sécurité", ["Accès admin", "Sessions admin futures", "Journal d’audit futur"]]
  ];
  return AdminLayout(`
    <form class="admin-card" data-admin-form>
      ${sections.map(([title, options]) => `<section class="admin-settings-section"><h2>${title}</h2>${options.map(AdminOption).join("")}</section>`).join("")}
      <div class="admin-message" data-admin-success>Les paramètres ont été enregistrés.</div>
      <div class="admin-actions"><button class="btn btn-primary" type="submit">Enregistrer les paramètres</button></div>
    </form>
  `, "settings", "Paramètres admin", "Configurez les règles de validation, vérification, signalements, notifications, emails et sécurité.");
}

function AdminDataPage(currentPage, title, subtitle, filters, columns, items, emptyTitle) {
  return AdminLayout(`
    ${filters}
    ${items.length ? AdminTable(columns, items) : AdminEmptyState(emptyTitle)}
  `, currentPage, title, subtitle);
}

function AdminTable(columns, items) {
  return `
    <section class="admin-table-shell admin-section">
      <div class="admin-scroll">
        <table class="admin-table">
          <thead><tr>${columns.map((column) => `<th>${column}</th>`).join("")}</tr></thead>
          <tbody>${items.map(() => `<tr>${columns.map(() => "<td></td>").join("")}</tr>`).join("")}</tbody>
        </table>
      </div>
    </section>
  `;
}

function AdminUserFilters() {
  return `<section class="admin-filter-row"><label>Rôle<select><option>Tous</option></select></label><label>Statut<select><option>Tous</option></select></label><label>Vérification<select><option>Tous</option><option>Vérifié</option><option>Non vérifié</option></select></label><label>Ville<input type="text"></label><label>Date d’inscription<input type="date"></label></section>`;
}

function AdminAdvertiserFilters() {
  return `<section class="admin-filter-row"><label>Type<select><option>Tous</option><option>Particulier</option><option>Agence immobilière</option><option>Hôtel / Auberge / Résidence</option><option>Loueur de voitures</option><option>Garage automobile</option><option>Chauffeur professionnel</option><option>Transporteur</option></select></label><label>Ville<input type="text"></label><label>Vérification<select><option>Tous</option><option>Vérifié</option><option>Non vérifié</option></select></label></section>`;
}

function AdminListingFilters() {
  return `<section class="admin-filter-row"><label>Module<select><option>Tous</option><option>Immobilier</option><option>Hôtels</option><option>Voitures</option><option>Voyages</option></select></label><label>Statut<select><option>Tous</option><option>Brouillon</option><option>En attente</option><option>Active</option><option>Refusée</option><option>Suspendue</option><option>Expirée</option><option>Supprimée</option></select></label><label>Ville<input type="text"></label><label>Date<input type="date"></label></section>`;
}

function AdminReportFilters() {
  return `<section class="admin-filter-row"><label>Type<select><option>Tous</option><option>Annonce suspecte</option><option>Faux prix</option><option>Fausses photos</option><option>Bien indisponible</option><option>Message abusif</option><option>Utilisateur suspect</option><option>Autre</option></select></label><label>Statut<select><option>Tous</option><option>Nouveau</option><option>En cours</option><option>Résolu</option><option>Rejeté</option><option>Archivé</option></select></label><label>Priorité<select><option>Toutes</option><option>Faible</option><option>Normale</option><option>Importante</option><option>Urgente</option></select></label></section>`;
}

function AdminModuleFilters() {
  return `<section class="admin-filter-row"><label>Module<select><option>Tous</option><option>Immobilier</option><option>Hôtels</option><option>Voitures</option><option>Voyages</option><option>Système</option></select></label><label>Statut<select><option>Tous</option></select></label><label>Période<input type="date"></label></section>`;
}

function AdminEmailFilters() {
  return `<section class="admin-filter-row"><label>Module<select><option>Tous</option></select></label><label>Statut<select><option>Tous</option><option>En attente</option><option>Envoyé</option><option>Échoué</option><option>Annulé</option></select></label><label>Type<select><option>Tous</option></select></label><label>Période<input type="date"></label></section>`;
}

function AdminStatisticsFilters() {
  return `<section class="admin-filter-row"><label>Période<select><option>7 jours</option><option>30 jours</option><option>90 jours</option></select></label><label>Module<select><option>Tous</option></select></label><label>Ville<input type="text"></label><label>Type d’annonceur<select><option>Tous</option></select></label></section>`;
}

function AdminStatusBadge(status) {
  return `<span class="admin-status-badge">${getAdminStatusLabel(status)}</span>`;
}

function AdminModuleBadge(module) {
  return `<span class="admin-module-badge">${getAdminModuleLabel(module)}</span>`;
}

function AdminPriorityBadge(priority) {
  return `<span class="admin-priority-badge">${getReportPriorityLabel(priority)}</span>`;
}

function AdminDecisionModal() {
  return `
    <div class="admin-modal-backdrop" data-admin-modal>
      <div class="admin-modal">
        <h2>Refuser l’annonce</h2>
        <label>Motif<select><option>Informations insuffisantes</option><option>Photos manquantes</option><option>Prix incohérent</option><option>Contenu suspect</option><option>Catégorie incorrecte</option><option>Document manquant</option><option>Autre</option></select></label>
        <label>Message à l’annonceur<textarea></textarea></label>
        <div class="admin-message" data-admin-success>La décision a été enregistrée.</div>
        <div class="admin-actions"><button class="btn btn-ghost" type="button" data-close-admin-modal>Annuler</button><button class="btn btn-primary" type="button" data-admin-decision>Refuser l’annonce</button></div>
      </div>
    </div>
  `;
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

  document.querySelector("[data-close-admin-modal]")?.addEventListener("click", () => {
    document.querySelector("[data-admin-modal]")?.classList.remove("is-open");
  });

  document.querySelector("[data-admin-decision]")?.addEventListener("click", () => {
    document.querySelector("[data-admin-success]")?.classList.add("is-visible");
  });
}

function renderAdmin() {
  const root = document.querySelector("#admin-root");
  if (!root) return;
  const page = document.body.dataset.adminPage || "overview";
  const pages = {
    overview: AdminOverviewPage,
    users: AdminUsersPage,
    advertisers: AdminAdvertisersPage,
    listings: AdminListingsPage,
    listingsRealEstate: () => AdminListingsByModulePage("real_estate", "Annonces immobilier", ["Type de bien", "Transaction", "Ville", "Prix", "Annonceur", "Statut", "Documents", "Signalements"], "listingsRealEstate"),
    listingsHotels: () => AdminListingsByModulePage("hotels", "Annonces hôtels", ["Type d’hébergement", "Ville", "Chambres", "Disponibilités", "Prix à partir de", "Statut", "Annonceur", "Signalements"], "listingsHotels"),
    listingsVehicles: () => AdminListingsByModulePage("vehicles", "Annonces voitures", ["Marque", "Modèle", "Type", "Ville", "Prix", "Statut", "Annonceur", "Signalements"], "listingsVehicles"),
    listingsTrips: () => AdminListingsByModulePage("trips", "Annonces voyages", ["Départ", "Arrivée", "Date", "Type de véhicule", "Places", "Prix", "Statut", "Transporteur", "Signalements"], "listingsTrips"),
    validation: AdminValidationPage,
    reports: AdminReportsPage,
    messages: AdminMessagesPage,
    contacts: AdminContactsPage,
    notifications: AdminNotificationsPage,
    emailLogs: AdminEmailLogsPage,
    statistics: AdminStatisticsPage,
    settings: AdminSettingsPage
  };
  root.innerHTML = (pages[page] || AdminOverviewPage)();
  bindAdmin();
}

document.addEventListener("DOMContentLoaded", renderAdmin);

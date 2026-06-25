const verificationRequests = [];
const verificationDocuments = [];
const verificationNotifications = [];
const verificationEmailEvents = [];

const verificationRoutes = {
  dashboard: "/dashboard/verification",
  documents: "/dashboard/verification/documents",
  status: "/dashboard/verification/status",
  admin: "/admin/verification",
  adminUsers: "/admin/verification/users",
  adminAdvertisers: "/admin/verification/advertisers",
  adminListings: "/admin/verification/listings"
};

const verificationStatusLabels = {
  not_started: "Non commencé",
  in_progress: "En cours",
  pending_review: "En attente de validation",
  verified: "Vérifié",
  refused: "Refusé",
  expired: "Expiré",
  suspended: "Suspendu"
};

const verificationBadgeLabels = {
  profile_verified: "Profil vérifié",
  advertiser_verified: "Annonceur vérifié",
  professional_verified: "Professionnel vérifié",
  listing_verified: "Annonce vérifiée",
  documents_verified: "Documents vérifiés",
  property_verified: "Bien vérifié",
  agency_verified: "Agence vérifiée",
  hotel_verified: "Hôtel vérifié",
  availability_tracked: "Disponibilités suivies",
  vehicle_verified: "Véhicule vérifié",
  garage_verified: "Garage vérifié",
  renter_verified: "Loueur vérifié",
  chauffeur_verified: "Chauffeur vérifié",
  transport_provider_verified: "Transporteur vérifié",
  trip_verified: "Trajet vérifié"
};

const verificationDocumentLabels = {
  identity: "Pièce d’identité",
  address_proof: "Justificatif d’adresse",
  business_registration: "Registre de commerce",
  ninea: "NINEA",
  professional_card: "Carte professionnelle",
  property_title: "Titre foncier",
  lease: "Bail",
  deliberation: "Délibération",
  nicad: "NICAD",
  vehicle_registration: "Carte grise",
  insurance: "Assurance",
  technical_inspection: "Visite technique",
  customs_clearance: "Dédouanement",
  driving_license: "Permis de conduire",
  transport_authorization: "Autorisation transport",
  hotel_operation_document: "Document d’exploitation",
  other: "Autre document"
};

function verificationRouteHref(path) {
  if (window.location.protocol !== "file:") return path;
  const depth = Number(document.body.dataset.routeDepth || "2");
  const prefix = "../".repeat(depth);
  const routes = {
    "/dashboard/verification": `${prefix}dashboard/verification/`,
    "/dashboard/verification/documents": `${prefix}dashboard/verification/documents/`,
    "/dashboard/verification/status": `${prefix}dashboard/verification/status/`,
    "/admin/verification": `${prefix}admin/verification/`,
    "/admin/verification/users": `${prefix}admin/verification/users/`,
    "/admin/verification/advertisers": `${prefix}admin/verification/advertisers/`,
    "/admin/verification/listings": `${prefix}admin/verification/listings/`,
    "/dashboard": `${prefix}dashboard/`,
    "/admin": `${prefix}admin/`
  };
  return routes[path] || path;
}

function getVerificationStatusLabel(status) {
  return verificationStatusLabels[status] || "Non commencé";
}

function getVerificationBadgeLabel(badge) {
  return verificationBadgeLabels[badge] || "Badge de confiance";
}

function getRequiredDocumentsByRole(role = "advertiser_individual") {
  const documents = {
    advertiser_individual: ["identity", "address_proof"],
    real_estate_agency: ["identity", "business_registration", "professional_card"],
    hotel_manager: ["identity", "business_registration", "hotel_operation_document"],
    vehicle_renter: ["identity", "business_registration", "vehicle_registration", "insurance"],
    vehicle_dealer: ["identity", "business_registration", "vehicle_registration"],
    chauffeur: ["identity", "driving_license", "vehicle_registration", "insurance", "technical_inspection"],
    transport_provider: ["identity", "business_registration", "vehicle_registration", "insurance", "transport_authorization"]
  };
  return documents[role] || documents.advertiser_individual;
}

function getRequiredDocumentsByModule(module = "general") {
  const documents = {
    real_estate: ["property_title", "lease", "deliberation", "nicad"],
    hotels: ["business_registration", "hotel_operation_document"],
    vehicles: ["vehicle_registration", "insurance", "technical_inspection", "customs_clearance"],
    vehicle_sale: ["vehicle_registration", "insurance", "technical_inspection", "customs_clearance"],
    vehicle_rental: ["vehicle_registration", "insurance", "technical_inspection"],
    vehicle_chauffeur: ["driving_license", "vehicle_registration", "insurance", "technical_inspection"],
    trips: ["business_registration", "vehicle_registration", "insurance", "transport_authorization"],
    general: ["identity", "address_proof"]
  };
  return documents[module] || documents.general;
}

function calculateTrustScore(input = {}) {
  const checks = [
    input.emailVerified,
    input.phoneVerified,
    input.profileCompleted,
    input.documentsProvided,
    input.documentsValidated,
    input.listingCompleted,
    input.photosPresent,
    input.contactMethodsEnabled,
    !input.hasReports,
    input.accountIsOlder
  ];
  const score = checks.filter(Boolean).length * 10;
  return Math.max(0, Math.min(100, score));
}

function buildVerificationTargetUrl(targetType, targetId = "") {
  const routes = {
    user: "/admin/verification/users",
    advertiser: "/admin/verification/advertisers",
    listing: "/admin/verification/listings",
    document: "/admin/verification"
  };
  const path = routes[targetType] || verificationRoutes.dashboard;
  return targetId ? `${path}?id=${encodeURIComponent(targetId)}` : path;
}

function VerificationDashboardPage() {
  const trustScore = calculateTrustScore({});
  return VerificationLayout(`
    <section class="verification-grid">
      ${VerificationProgressCard("Statut du compte", "Non commencé", "Les informations de vérification apparaîtront ici dès qu’une demande sera créée.")}
      ${TrustScoreCard(trustScore)}
      ${VerificationProgressCard("Badges obtenus", "0", "Aucun badge de confiance n’est affiché sans validation.")}
    </section>
    <section class="verification-card verification-section">
      <h2>Éléments de vérification</h2>
      <div class="verification-badge-row">
        ${["Email non vérifié", "Téléphone non vérifié", "Identité non vérifiée", "Profil professionnel non vérifié"].map((label) => `<span class="trust-badge is-muted">${label}</span>`).join("")}
      </div>
      <div class="verification-actions verification-section">
        <button class="btn btn-light" type="button">Vérifier email</button>
        <button class="btn btn-light" type="button">Vérifier téléphone</button>
        <a class="btn btn-primary" href="${verificationRouteHref(verificationRoutes.documents)}">Envoyer documents</a>
        <a class="btn btn-ghost" href="${verificationRouteHref(verificationRoutes.status)}">Voir statut</a>
      </div>
    </section>
    ${VerificationEmptyState("Aucune demande de vérification pour le moment.", "Complétez vos informations pour renforcer la confiance des clients.")}
  `, "dashboard", "Vérification du compte", "Complétez vos informations pour renforcer la confiance des clients.");
}

function VerificationDocumentsPage() {
  const documentGroups = [
    ["Documents communs", ["identity", "address_proof"]],
    ["Professionnels", ["business_registration", "ninea", "professional_card", "other"]],
    ["Agence immobilière", ["business_registration", "professional_card", "other"]],
    ["Hôtel / Auberge / Résidence", ["business_registration", "hotel_operation_document", "other"]],
    ["Loueur de voitures / Garage", ["business_registration", "vehicle_registration", "insurance"]],
    ["Chauffeur professionnel", ["driving_license", "vehicle_registration", "insurance", "technical_inspection"]],
    ["Transporteur", ["business_registration", "vehicle_registration", "insurance", "transport_authorization"]]
  ];

  return VerificationLayout(`
    <section class="verification-grid">
      ${documentGroups.map(([title, docs]) => `<article class="verification-card"><h2>${title}</h2><div class="verification-section">${docs.map((doc) => DocumentUploadPlaceholder(doc)).join("")}</div></article>`).join("")}
    </section>
    ${VerificationDocumentList(verificationDocuments)}
  `, "documents", "Documents de vérification", "Préparez les documents selon votre type de compte. Aucun upload réel n’est effectué maintenant.");
}

function VerificationStatusPage() {
  return VerificationLayout(`
    <section class="verification-grid">
      ${["Demande envoyée", "Correction demandée", "Document refusé", "Badge obtenu", "Compte suspendu"].map((title) => VerificationProgressCard(title, "Non commencé", "Les notifications internes et emails système futurs seront liés à cet événement.")).join("")}
    </section>
    ${verificationRequests.length ? VerificationRequestList(verificationRequests) : VerificationEmptyState("Aucun statut de vérification disponible pour le moment.", "Votre demande de vérification nécessite une correction si l’admin demande une modification.")}
  `, "status", "Statut de vérification", "Suivez l’avancement de vos demandes, corrections et badges de confiance.");
}

function VerificationLayout(content, currentPage, title, subtitle) {
  const nav = [
    ["Vue d’ensemble", verificationRoutes.dashboard, "dashboard"],
    ["Documents", verificationRoutes.documents, "documents"],
    ["Statut", verificationRoutes.status, "status"]
  ];
  return `
    <div class="verification-shell">
      <aside class="dashboard-sidebar">
        <div class="dashboard-brand"><span>P</span><div><strong>Péncmi</strong><small>Vérification</small></div></div>
        <nav class="dashboard-nav">${nav.map(([label, href, key]) => `<a href="${verificationRouteHref(href)}"${key === currentPage ? ' aria-current="page"' : ""}><span>${label}</span><span class="notification-badge">0</span></a>`).join("")}</nav>
      </aside>
      <main class="verification-main">
        <header class="verification-header"><div><h1>${title}</h1><p>${subtitle}</p></div><div class="verification-header-actions"><a class="btn btn-ghost" href="${verificationRouteHref("/dashboard")}">Dashboard</a></div></header>
        ${content}
      </main>
    </div>
  `;
}

function VerificationProgressCard(title, value, text) {
  return `<article class="verification-progress-card"><h2>${title}</h2><div class="trust-score-value">${value}</div><p>${text}</p></article>`;
}

function VerificationBadge(badge, muted = false) {
  return `<span class="trust-badge${muted ? " is-muted" : ""}">${getVerificationBadgeLabel(badge)}</span>`;
}

function TrustScoreCard(score = 0) {
  return `<article class="trust-score-card"><h2>Score de confiance</h2><div class="trust-score-value">${score}%</div><p>Le score interne tient compte des vérifications, documents, complétion, contacts et signalements.</p></article>`;
}

function DocumentUploadPlaceholder(documentType) {
  return `<div class="document-placeholder"><strong>${verificationDocumentLabels[documentType] || verificationDocumentLabels.other}</strong><span>Champ prévu pour document. Aucun fichier réel n’est stocké maintenant.</span><button class="btn btn-light" type="button">Prévoir le document</button></div>`;
}

function VerificationDocumentList(items = []) {
  return items.length ? VerificationTable(["Document", "Statut", "Message admin", "Date"], items) : VerificationEmptyState("Aucun document envoyé pour le moment.");
}

function VerificationRequestCard(request) {
  return `<article class="verification-card"><h2>${request.targetType}</h2>${VerificationStatusBadge(request.status)}<p>${request.adminMessage || ""}</p></article>`;
}

function VerificationRequestList(items = []) {
  return `<section class="verification-grid verification-section">${items.map(VerificationRequestCard).join("")}</section>`;
}

function AdminVerificationPage() {
  const kpis = ["Comptes à vérifier", "Annonceurs à vérifier", "Annonces à vérifier", "Documents en attente", "Documents refusés", "Vérifications terminées"];
  return AdminVerificationLayout(`
    <section class="verification-grid">${kpis.map((label) => VerificationProgressCard(label, 0, "Aucune donnée disponible pour le moment.")).join("")}</section>
    ${VerificationEmptyState("Aucune vérification en attente pour le moment.")}
  `, "admin", "Vérifications", "Supervisez les comptes, annonceurs, annonces et documents à vérifier.");
}

function AdminVerificationUsersPage() {
  return AdminVerificationDataPage("adminUsers", "Vérification utilisateurs", ["Utilisateur", "Rôle", "Email", "Téléphone", "Statut vérification", "Documents", "Actions"], verificationRequests.filter((request) => request.targetType === "user"), "Aucun utilisateur à vérifier.");
}

function AdminVerificationAdvertisersPage() {
  return AdminVerificationDataPage("adminAdvertisers", "Vérification annonceurs", ["Annonceur", "Type professionnel", "Module", "Documents", "Statut", "Date de demande", "Actions"], verificationRequests.filter((request) => request.targetType === "advertiser"), "Aucun annonceur à vérifier.");
}

function AdminVerificationListingsPage() {
  return AdminVerificationDataPage("adminListings", "Vérification annonces", ["Annonce", "Module", "Annonceur", "Documents liés", "Statut", "Score de confiance", "Actions"], verificationRequests.filter((request) => request.targetType === "listing"), "Aucune annonce à vérifier.");
}

function AdminVerificationDataPage(currentPage, title, columns, items, emptyTitle) {
  return AdminVerificationLayout(`
    <section class="verification-filter-row"><label>Module<select><option>Tous</option><option>Immobilier</option><option>Hôtels</option><option>Voitures</option><option>Voyages</option></select></label><label>Statut<select><option>Tous</option><option>En attente</option><option>Vérifié</option><option>Refusé</option></select></label></section>
    ${items.length ? VerificationTable(columns, items) : VerificationEmptyState(emptyTitle)}
    ${VerificationDecisionModal()}
  `, currentPage, title, "Approuvez, refusez, demandez une correction ou suspendez une vérification.");
}

function AdminVerificationLayout(content, currentPage, title, subtitle) {
  const nav = [
    ["Vue d’ensemble", verificationRoutes.admin, "admin"],
    ["Utilisateurs", verificationRoutes.adminUsers, "adminUsers"],
    ["Annonceurs", verificationRoutes.adminAdvertisers, "adminAdvertisers"],
    ["Annonces", verificationRoutes.adminListings, "adminListings"]
  ];
  return `
    <div class="verification-shell">
      <aside class="admin-sidebar">
        <div class="dashboard-brand"><span>P</span><div><strong>Péncmi</strong><small>Admin vérification</small></div></div>
        <nav class="admin-nav">${nav.map(([label, href, key]) => `<a href="${verificationRouteHref(href)}"${key === currentPage ? ' aria-current="page"' : ""}><span>${label}</span><span class="notification-badge">0</span></a>`).join("")}</nav>
      </aside>
      <main class="verification-main">
        <header class="verification-header"><div><h1>${title}</h1><p>${subtitle}</p></div><div class="verification-header-actions"><a class="btn btn-ghost" href="${verificationRouteHref("/admin")}">Back-office</a></div></header>
        ${content}
      </main>
    </div>
  `;
}

function VerificationDecisionModal() {
  return `
    <div class="verification-modal-backdrop" data-verification-modal>
      <div class="verification-modal">
        <h2>Décision de vérification</h2>
        <label>Action<select><option>Approuver</option><option>Refuser</option><option>Demander correction</option><option>Suspendre</option></select></label>
        <label>Motif<select><option>Document illisible</option><option>Document manquant</option><option>Document expiré</option><option>Information incohérente</option><option>Activité non vérifiable</option><option>Photos insuffisantes</option><option>Prix incohérent</option><option>Contact incomplet</option><option>Localisation insuffisante</option><option>Autre</option></select></label>
        <label>Message personnalisé<textarea></textarea></label>
        <div class="verification-message" data-verification-success>La décision de vérification a été enregistrée.</div>
        <div class="verification-actions"><button class="btn btn-ghost" type="button" data-close-verification-modal>Annuler</button><button class="btn btn-primary" type="button" data-verification-decision>Enregistrer la décision</button></div>
      </div>
    </div>
  `;
}

function VerificationStatusBadge(status) {
  return `<span class="verification-status-badge">${getVerificationStatusLabel(status)}</span>`;
}

function VerificationEmptyState(title, text = "") {
  return `<section class="verification-empty-state verification-section"><h2>${title}</h2>${text ? `<p>${text}</p>` : ""}</section>`;
}

function VerificationTable(columns, items) {
  return `
    <section class="verification-table-shell verification-section">
      <div class="verification-scroll">
        <table class="verification-table">
          <thead><tr>${columns.map((column) => `<th>${column}</th>`).join("")}</tr></thead>
          <tbody>${items.map(() => `<tr>${columns.map(() => "<td></td>").join("")}</tr>`).join("")}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderVerificationPage() {
  const root = document.querySelector("#verification-root");
  if (!root) return;
  const page = document.body.dataset.verificationPage;
  const pages = {
    dashboard: VerificationDashboardPage,
    documents: VerificationDocumentsPage,
    status: VerificationStatusPage,
    admin: AdminVerificationPage,
    adminUsers: AdminVerificationUsersPage,
    adminAdvertisers: AdminVerificationAdvertisersPage,
    adminListings: AdminVerificationListingsPage
  };
  root.innerHTML = (pages[page] || VerificationDashboardPage)();
  document.querySelector("[data-verification-decision]")?.addEventListener("click", () => document.querySelector("[data-verification-success]")?.classList.add("is-visible"));
  document.querySelector("[data-close-verification-modal]")?.addEventListener("click", () => document.querySelector("[data-verification-modal]")?.classList.remove("is-open"));
}

document.addEventListener("DOMContentLoaded", renderVerificationPage);

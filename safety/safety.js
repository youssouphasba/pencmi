const reports = [];
const moderationDecisions = [];
const moderationRules = [
  "Si une annonce reçoit 3 signalements importants, la marquer à examiner.",
  "Si une annonce reçoit 5 signalements urgents, la masquer temporairement plus tard.",
  "Si un utilisateur reçoit plusieurs signalements, demander une vérification.",
  "Si un email automatique échoue plusieurs fois, alerter l’admin.",
  "Si un contact est invalide, demander correction."
];

const safetyRoutes = {
  report: "/signaler",
  clientReports: "/compte/signalements",
  advertiserReports: "/dashboard/reports",
  adminReports: "/admin/reports",
  adminReportDetail: "/admin/reports/detail",
  moderation: "/admin/moderation",
  moderationMessages: "/admin/moderation/messages",
  moderationListings: "/admin/moderation/listings",
  moderationUsers: "/admin/moderation/users",
  home: "/"
};

const reportReasonLabels = {
  suspicious_listing: "Annonce suspecte",
  wrong_price: "Prix incohérent",
  fake_photos: "Fausses photos",
  misleading_content: "Contenu trompeur",
  bad_contact: "Mauvais contact",
  unavailable: "Annonce déjà indisponible",
  abusive_behavior: "Comportement abusif",
  fraud_attempt: "Tentative d’arnaque",
  suspicious_payment_request: "Demande de paiement suspecte",
  inappropriate_message: "Message inapproprié",
  identity_impersonation: "Usurpation d’identité",
  fake_property: "Bien inexistant",
  fake_vehicle: "Véhicule inexistant",
  fake_hotel: "Hébergement inexistant",
  fake_trip: "Trajet inexistant",
  documents_suspicious: "Documents suspects",
  other: "Autre"
};

const reportStatusLabels = {
  new: "Envoyé",
  in_progress: "En cours d’examen",
  correction_requested: "Correction demandée",
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

const safetyTipsByModule = {
  real_estate: ["Visitez le bien avant tout engagement.", "Vérifiez l’identité de l’annonceur.", "Méfiez-vous des demandes d’argent suspectes."],
  hotels: ["Vérifiez les conditions avant de réserver.", "Confirmez les dates et la disponibilité avec l’établissement.", "Gardez une trace des échanges."],
  vehicles: ["Vérifiez les documents du véhicule.", "Inspectez le véhicule avant paiement.", "Méfiez-vous des prix trop bas."],
  trips: ["Confirmez le lieu et l’heure de départ.", "Gardez le contact du transporteur.", "Évitez les paiements suspects."],
  messages: ["Ne partagez pas de code confidentiel.", "Signalez les messages abusifs.", "Gardez une trace des échanges."],
  users: ["Vérifiez l’identité de votre interlocuteur.", "Évitez les paiements suspects.", "Signalez tout comportement abusif."]
};

function safetyRouteHref(path) {
  if (window.location.protocol !== "file:") return path;
  const depth = Number(document.body.dataset.routeDepth || "1");
  const prefix = "../".repeat(depth);
  const routes = {
    "/": `${prefix}index.html`,
    "/signaler": `${prefix}signaler/`,
    "/compte/signalements": `${prefix}compte/signalements/`,
    "/dashboard/reports": `${prefix}dashboard/reports/`,
    "/admin/reports": `${prefix}admin/reports/`,
    "/admin/reports/detail": `${prefix}admin/reports/detail/`,
    "/admin/moderation": `${prefix}admin/moderation/`,
    "/admin/moderation/messages": `${prefix}admin/moderation/messages/`,
    "/admin/moderation/listings": `${prefix}admin/moderation/listings/`,
    "/admin/moderation/users": `${prefix}admin/moderation/users/`
  };
  return routes[path] || path;
}

function getReportReasonLabel(reason) {
  return reportReasonLabels[reason] || "Autre";
}

function getReportStatusLabel(status) {
  return reportStatusLabels[status] || "Envoyé";
}

function getReportPriorityLabel(priority) {
  return reportPriorityLabels[priority] || "Normale";
}

function getSafetyTipsByModule(module = "real_estate") {
  return safetyTipsByModule[module] || safetyTipsByModule.real_estate;
}

function buildReportTargetUrl(targetType, targetId = "") {
  const routes = {
    listing: safetyRoutes.adminReports,
    user: "/admin/moderation/users",
    advertiser: "/admin/annonceurs",
    message: "/admin/moderation/messages",
    conversation: "/admin/moderation/messages",
    document: "/admin/verification",
    other: safetyRoutes.adminReports
  };
  const path = routes[targetType] || safetyRoutes.adminReports;
  return targetId ? `${path}?id=${encodeURIComponent(targetId)}` : path;
}

function filterReports(items, predicate = () => true) {
  return items.filter(predicate);
}

function sortReportsByPriority(items) {
  const order = { urgent: 0, important: 1, normal: 2, low: 3 };
  return [...items].sort((first, second) => (order[first.priority] ?? 2) - (order[second.priority] ?? 2));
}

function ReportButton(label = "Signaler") {
  return `<button class="btn btn-ghost" type="button" data-open-report>${label}</button>`;
}

function ReportModal() {
  return `
    <div class="report-modal-backdrop" id="report-modal" aria-hidden="true">
      <section class="report-modal" role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
        <h2 id="report-modal-title">Signaler un problème</h2>
        <p>Expliquez le problème rencontré. L’équipe Péncmi pourra examiner votre signalement.</p>
        ${ReportReasonSelect()}
        <label>Message complémentaire<textarea></textarea></label>
        <div class="report-message" data-report-success>Votre signalement a été transmis.</div>
        <div class="safety-actions"><button class="btn btn-ghost" type="button" data-close-report>Annuler</button><button class="btn btn-primary" type="button" data-send-report>Envoyer le signalement</button></div>
      </section>
    </div>
  `;
}

function ReportReasonSelect() {
  return `<label>Motif<select>${Object.entries(reportReasonLabels).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label>`;
}

function SafetyTipsBox(module = "real_estate") {
  return `
    <section class="safety-tips-box">
      <h2>Conseils de sécurité</h2>
      <ul>${getSafetyTipsByModule(module).map((tip) => `<li>${tip}</li>`).join("")}</ul>
      ${ReportButton("Signaler un problème")}
    </section>
  `;
}

function SafetyLayout(content, currentPage, title, subtitle, mode = "client") {
  const nav = mode === "admin"
    ? [["Signalements", safetyRoutes.adminReports, "adminReports"], ["Modération", safetyRoutes.moderation, "moderation"], ["Messages", safetyRoutes.moderationMessages, "messages"], ["Annonces", safetyRoutes.moderationListings, "listings"], ["Utilisateurs", safetyRoutes.moderationUsers, "users"]]
    : [["Mes signalements", safetyRoutes.clientReports, "clientReports"]];
  const sidebarClass = mode === "admin" ? "admin-sidebar" : "dashboard-sidebar";
  const navClass = mode === "admin" ? "admin-nav" : "dashboard-nav";
  return `
    <div class="${mode === "admin" ? "moderation-shell" : "safety-shell"}">
      <aside class="${sidebarClass}">
        <div class="dashboard-brand"><span>P</span><div><strong>Péncmi</strong><small>${mode === "admin" ? "Modération" : "Signalements"}</small></div></div>
        <nav class="${navClass}">${nav.map(([label, href, key]) => `<a href="${safetyRouteHref(href)}"${key === currentPage ? ' aria-current="page"' : ""}><span>${label}</span><span class="notification-badge">0</span></a>`).join("")}</nav>
      </aside>
      <main class="${mode === "admin" ? "moderation-main" : "safety-content"}">
        <header class="safety-header"><div><h1>${title}</h1><p>${subtitle}</p></div><div class="safety-header-actions"><a class="btn btn-ghost" href="${safetyRouteHref(safetyRoutes.home)}">Retour à l’accueil</a></div></header>
        ${content}
      </main>
    </div>
  `;
}

function ClientReportsPage() {
  return SafetyLayout(`
    ${reports.length ? ReportsTable(["Module", "Élément signalé", "Motif", "Statut", "Date", "Dernière mise à jour"], reports) : EmptyReportsState("Vous n’avez envoyé aucun signalement pour le moment.")}
  `, "clientReports", "Mes signalements", "Suivez les problèmes que vous avez signalés à Péncmi.");
}

function AdvertiserReportsPage() {
  return SafetyLayout(`
    ${reports.length ? ReportsTable(["Annonce concernée", "Module", "Motif général", "Statut", "Date", "Action demandée"], reports) : EmptyReportsState("Aucun signalement reçu pour le moment.")}
  `, "advertiserReports", "Signalements reçus", "Suivez les signalements liés à vos annonces ou messages sans afficher l’identité complète du client.", "advertiser");
}

function AdminReportsPage() {
  return SafetyLayout(`
    ${ReportFilters()}
    ${reports.length ? ReportsTable(["ID signalement", "Module", "Type de cible", "Élément concerné", "Auteur", "Annonceur", "Motif", "Priorité", "Statut", "Date", "Actions"], sortReportsByPriority(reports)) : EmptyReportsState("Aucun signalement pour le moment.")}
  `, "adminReports", "Signalements", "Traitez les signalements sur les annonces, messages, profils et documents.", "admin");
}

function AdminReportDetailPage() {
  return SafetyLayout(`
    <section class="safety-card">
      <h2>Informations du signalement</h2>
      <p>Aucun signalement sélectionné pour le moment.</p>
      <div class="safety-actions"><button class="btn btn-light" type="button">Marquer en cours</button><button class="btn btn-light" type="button">Demander une correction</button><button class="btn btn-light" type="button">Masquer l’annonce</button><button class="btn btn-light" type="button">Suspendre l’utilisateur</button><button class="btn btn-primary" type="button" data-open-moderation>Ajouter une note interne</button></div>
    </section>
    ${ModerationTimeline()}
    ${ModerationDecisionModal()}
  `, "adminReports", "Détail signalement", "Consultez la cible, le motif, l’historique et les décisions admin.", "admin");
}

function AdminModerationListingsPage() {
  return ModerationPage("listings", "Modération des annonces", ["Annonce", "Module", "Signalements", "Risque", "Statut", "Action"], "Aucune annonce à modérer.");
}

function AdminModerationMessagesPage() {
  return ModerationPage("messages", "Modération des messages", ["Conversation", "Expéditeur", "Destinataire", "Module", "Extrait", "Motif", "Date", "Statut", "Actions"], "Aucun message signalé.");
}

function AdminModerationUsersPage() {
  return ModerationPage("users", "Modération des utilisateurs", ["Utilisateur", "Rôle", "Signalements", "Statut du compte", "Date d’inscription", "Actions"], "Aucun utilisateur signalé.");
}

function AdminModerationPage() {
  return SafetyLayout(`
    <section class="safety-card"><h2>Règles de sécurité futures</h2><ul>${moderationRules.map((rule) => `<li>${rule}</li>`).join("")}</ul></section>
    ${EmptyReportsState("Aucune action de modération en attente.")}
  `, "moderation", "Modération", "Préparez les règles et actions de sécurité sans les exécuter réellement.", "admin");
}

function ModerationPage(currentPage, title, columns, emptyTitle) {
  return SafetyLayout(`
    ${ReportFilters()}
    ${reports.length ? ReportsTable(columns, reports) : EmptyReportsState(emptyTitle)}
    ${ModerationDecisionModal()}
  `, currentPage, title, "Repérez les contenus à risque et préparez les décisions de modération.", "admin");
}

function ReportStatusBadge(status) {
  return `<span class="report-status-badge">${getReportStatusLabel(status)}</span>`;
}

function ReportPriorityBadge(priority) {
  return `<span class="report-priority-badge">${getReportPriorityLabel(priority)}</span>`;
}

function ModerationDecisionModal() {
  return `
    <div class="moderation-modal-backdrop" data-moderation-modal>
      <section class="moderation-modal" role="dialog" aria-modal="true">
        <h2>Décision de modération</h2>
        <label>Action<select><option>Avertissement</option><option>Demande de correction</option><option>Masquage annonce</option><option>Suspension annonce</option><option>Réactivation annonce</option><option>Suspension utilisateur</option><option>Réactivation utilisateur</option><option>Rejet signalement</option><option>Résolution signalement</option><option>Archivage</option></select></label>
        <label>Motif<textarea></textarea></label>
        <label>Message à l’utilisateur ou annonceur<textarea></textarea></label>
        <label>Note interne<textarea></textarea></label>
        <div class="moderation-message" data-moderation-success>La décision de modération a été préparée.</div>
        <div class="safety-actions"><button class="btn btn-ghost" type="button" data-close-moderation>Annuler</button><button class="btn btn-primary" type="button" data-save-moderation>Enregistrer la décision</button></div>
      </section>
    </div>
  `;
}

function ModerationTimeline() {
  return `<section class="safety-card safety-section"><h2>Historique des actions</h2><div class="moderation-timeline">${moderationDecisions.length ? moderationDecisions.map(() => `<div class="moderation-timeline-item"></div>`).join("") : `<p>Aucune décision enregistrée pour le moment.</p>`}</div></section>`;
}

function EmptyReportsState(title) {
  return `<section class="safety-empty-state"><h2>${title}</h2></section>`;
}

function ReportFilters() {
  return `<section class="safety-filter-row"><label>Module<select><option>Tous</option><option>Immobilier</option><option>Hôtels</option><option>Voitures</option><option>Voyages</option><option>Messages</option><option>Utilisateurs</option><option>Système</option></select></label><label>Type de cible<select><option>Tous</option><option>Annonce</option><option>Utilisateur</option><option>Annonceur</option><option>Message</option><option>Conversation</option><option>Document</option><option>Autre</option></select></label><label>Motif<select><option>Tous</option></select></label><label>Priorité<select><option>Toutes</option><option>Faible</option><option>Normale</option><option>Importante</option><option>Urgente</option></select></label><label>Statut<select><option>Tous</option><option>Nouveau</option><option>En cours</option><option>Correction demandée</option><option>Résolu</option><option>Rejeté</option><option>Archivé</option></select></label><label>Période<input type="date"></label></section>`;
}

function ReportsTable(columns, items) {
  return `<section class="safety-table-shell"><div class="safety-scroll"><table class="safety-table"><thead><tr>${columns.map((column) => `<th>${column}</th>`).join("")}</tr></thead><tbody>${items.map(() => `<tr>${columns.map(() => "<td></td>").join("")}</tr>`).join("")}</tbody></table></div></section>`;
}

function ReportPage() {
  return `
    <main class="safety-main">
      <section class="safety-card">
        <h1>Signaler un problème</h1>
        <p>Expliquez le problème rencontré. L’équipe Péncmi pourra examiner votre signalement.</p>
        ${ReportModal()}
        <div class="safety-actions">${ReportButton("Signaler")}</div>
      </section>
    </main>
  `;
}

function renderSafetyPage() {
  const root = document.querySelector("#safety-root");
  if (!root) return;
  const page = document.body.dataset.safetyPage;
  const pages = {
    report: ReportPage,
    clientReports: ClientReportsPage,
    advertiserReports: AdvertiserReportsPage,
    adminReports: AdminReportsPage,
    adminReportDetail: AdminReportDetailPage,
    moderation: AdminModerationPage,
    moderationMessages: AdminModerationMessagesPage,
    moderationListings: AdminModerationListingsPage,
    moderationUsers: AdminModerationUsersPage
  };
  root.innerHTML = (pages[page] || ReportPage)();
  bindReportModal(document);
  bindModerationModal(document);
}

function bindReportModal(scope = document) {
  scope.querySelectorAll("[data-open-report]").forEach((button) => button.addEventListener("click", () => scope.querySelector("#report-modal")?.classList.add("is-open")));
  scope.querySelector("[data-close-report]")?.addEventListener("click", () => scope.querySelector("#report-modal")?.classList.remove("is-open"));
  scope.querySelector("[data-send-report]")?.addEventListener("click", () => scope.querySelector("[data-report-success]")?.classList.add("is-visible"));
}

function bindModerationModal(scope = document) {
  scope.querySelector("[data-open-moderation]")?.addEventListener("click", () => scope.querySelector("[data-moderation-modal]")?.classList.add("is-open"));
  scope.querySelector("[data-close-moderation]")?.addEventListener("click", () => scope.querySelector("[data-moderation-modal]")?.classList.remove("is-open"));
  scope.querySelector("[data-save-moderation]")?.addEventListener("click", () => scope.querySelector("[data-moderation-success]")?.classList.add("is-visible"));
}

document.addEventListener("DOMContentLoaded", renderSafetyPage);

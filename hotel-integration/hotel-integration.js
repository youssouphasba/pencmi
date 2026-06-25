const hotelIntegrationConnections = [];
const hotelIntegrationApiKeys = [];
const hotelIntegrationWebhooks = [];
const hotelIntegrationMappings = [];
const hotelIntegrationLogs = [];
const hotelIntegrationConflicts = [];

const hotelIntegrationRoutes = {
  overview: "/dashboard/hotels/integration",
  setup: "/dashboard/hotels/integration/setup",
  api: "/dashboard/hotels/integration/api",
  webhooks: "/dashboard/hotels/integration/webhooks",
  syncSettings: "/dashboard/hotels/integration/sync-settings",
  mapping: "/dashboard/hotels/integration/mapping",
  logs: "/dashboard/hotels/integration/logs",
  errors: "/dashboard/hotels/integration/errors",
  test: "/dashboard/hotels/integration/test",
  security: "/dashboard/hotels/integration/security",
  hotelDashboard: "/dashboard/hotels"
};

const adminHotelIntegrationRoutes = {
  overview: "/admin/hotel-integrations",
  partners: "/admin/hotel-integrations/partners",
  apiKeys: "/admin/hotel-integrations/api-keys",
  webhooks: "/admin/hotel-integrations/webhooks",
  logs: "/admin/hotel-integrations/logs",
  errors: "/admin/hotel-integrations/errors",
  audit: "/admin/hotel-integrations/audit",
  settings: "/admin/hotel-integrations/settings",
  admin: "/admin"
};

const hotelIntegrationDefaults = {
  sourceOfTruthText: "Source principale : logiciel interne de l’hôtel",
  syncedDataNotice: "Cette donnée est synchronisée depuis votre logiciel interne. Certaines informations doivent être modifiées depuis votre logiciel principal.",
  lockedInfoNotice: "Cette information vient de votre logiciel interne. Modifiez-la depuis votre logiciel principal.",
  confirmAvailabilityNotice: "L’établissement confirmera la disponibilité.",
  emptyIntegration: "Aucune intégration hôtel configurée pour le moment.",
  emptyLogs: "Aucun log de synchronisation pour le moment.",
  emptyErrors: "Aucune erreur de synchronisation pour le moment.",
  maskedApiKey: "pk_hotel_****************",
  apiPermissions: [
    "hotel.property.write",
    "hotel.rooms.write",
    "hotel.rates.write",
    "hotel.availability.write",
    "hotel.restrictions.write",
    "hotel.requests.read",
    "hotel.messages.read",
    "hotel.webhooks.manage"
  ],
  webhookEvents: [
    "hotel.reservation_request.created",
    "hotel.reservation_request.cancelled",
    "hotel.message.created",
    "hotel.contact.created",
    "hotel.sync.warning",
    "hotel.listing.approved",
    "hotel.listing.refused",
    "hotel.report.created",
    "hotel.verification.approved",
    "hotel.verification.refused"
  ],
  endpoints: [
    ["Établissement", "PUT /api/hotel-partner/v1/property/{externalPropertyId}"],
    ["Établissement", "GET /api/hotel-partner/v1/property/{externalPropertyId}"],
    ["Chambres", "PUT /api/hotel-partner/v1/property/{externalPropertyId}/rooms/{externalRoomId}"],
    ["Chambres", "GET /api/hotel-partner/v1/property/{externalPropertyId}/rooms"],
    ["Chambres", "PATCH /api/hotel-partner/v1/property/{externalPropertyId}/rooms/{externalRoomId}/status"],
    ["Prix", "POST /api/hotel-partner/v1/rates"],
    ["Prix", "POST /api/hotel-partner/v1/rates/bulk"],
    ["Disponibilités", "POST /api/hotel-partner/v1/availability"],
    ["Disponibilités", "POST /api/hotel-partner/v1/availability/bulk"],
    ["Restrictions", "POST /api/hotel-partner/v1/restrictions"],
    ["Restrictions", "POST /api/hotel-partner/v1/restrictions/bulk"],
    ["Demandes clients", "GET /api/hotel-partner/v1/reservation-requests"],
    ["Demandes clients", "PATCH /api/hotel-partner/v1/reservation-requests/{requestId}/status"],
    ["Messages", "GET /api/hotel-partner/v1/messages"],
    ["Messages", "POST /api/hotel-partner/v1/messages/{conversationId}/reply"],
    ["Événements", "GET /api/hotel-partner/v1/events"],
    ["Événements", "POST /api/hotel-partner/v1/events/{eventId}/acknowledge"]
  ],
  payloadExamples: {
    property: {
      externalPropertyId: "EXTERNAL_PROPERTY_ID",
      name: "Nom de l’établissement",
      type: "hotel",
      city: "Ville",
      country: "SN",
      description: "Description administrable",
      phone: "+221XXXXXXXXX",
      email: "contact@example.com",
      amenities: ["wifi", "parking"],
      status: "active"
    },
    room: {
      externalPropertyId: "EXTERNAL_PROPERTY_ID",
      externalRoomId: "EXTERNAL_ROOM_ID",
      name: "Nom de la chambre",
      roomType: "standard",
      capacity: 2,
      bedCount: 1,
      bedTypes: ["double"],
      amenities: ["wifi"],
      status: "active"
    },
    availability: {
      externalPropertyId: "EXTERNAL_PROPERTY_ID",
      externalRoomId: "EXTERNAL_ROOM_ID",
      date: "YYYY-MM-DD",
      availableUnits: 0,
      status: "available",
      lastUpdatedBySource: "partner_system"
    },
    rate: {
      externalPropertyId: "EXTERNAL_PROPERTY_ID",
      externalRoomId: "EXTERNAL_ROOM_ID",
      date: "YYYY-MM-DD",
      pricePerNight: 0,
      currency: "XOF"
    }
  }
};

function hotelIntegrationEscape(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function buildHotelIntegrationRoute(path) {
  if (window.location.protocol !== "file:") return path;
  const depth = Number(document.body?.dataset?.routeDepth || "3");
  const prefix = "../".repeat(depth);
  if (path.includes("?")) {
    const [base, query] = path.split("?");
    return `${buildHotelIntegrationRoute(base)}?${query}`;
  }
  if (path === "/") return `${prefix}index.html`;
  return `${prefix}${path.replace(/^\//, "")}/`;
}

function getHotelIntegrationStatusLabel(status = "not_configured") {
  const labels = {
    not_configured: "Non configurée",
    draft: "Brouillon",
    testing: "En test",
    active: "Active",
    paused: "En pause",
    error: "Erreur",
    suspended: "Suspendue"
  };
  return labels[status] || labels.not_configured;
}

function getHotelSourceOfTruthLabel(source = "hotel_internal_software") {
  const labels = {
    hotel_internal_software: "Logiciel interne de l’hôtel",
    pencmi: "Péncmi",
    manual_confirm_required: "Confirmation manuelle requise"
  };
  return labels[source] || labels.hotel_internal_software;
}

function getHotelSyncFrequencyLabel(frequency = "manual") {
  const labels = {
    realtime: "Temps réel",
    every_5_minutes: "Toutes les 5 minutes",
    every_15_minutes: "Toutes les 15 minutes",
    every_30_minutes: "Toutes les 30 minutes",
    hourly: "Toutes les heures",
    daily: "Tous les jours",
    manual: "Manuel"
  };
  return labels[frequency] || labels.manual;
}

function getHotelWebhookEventLabel(event = "") {
  return event.replace(/^hotel\./, "").replaceAll("_", " ").replaceAll(".", " / ");
}

function maskHotelApiKey(value = "") {
  if (!value) return hotelIntegrationDefaults.maskedApiKey;
  return `${value.slice(0, 9)}${"*".repeat(16)}`;
}

function formatHotelLastSyncLabel(value) {
  if (!value) return "Aucune synchronisation";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function validateHotelExternalId(value = "") {
  return /^[A-Za-z0-9_.:-]{3,80}$/.test(String(value).trim());
}

function validateHotelFieldMapping(mapping = {}) {
  return Boolean(mapping.partnerField && mapping.pencmiField && mapping.dataType);
}

function resolveHotelConflictByStrategy(conflict = {}, strategy = "hotel_system_wins") {
  const decisions = {
    hotel_system_wins: "appliquer valeur logiciel interne",
    pencmi_wins_if_allowed: "appliquer valeur Péncmi si autorisé",
    manual_review: "mettre en attente",
    show_confirm_required: "afficher disponibilité à confirmer",
    hide_until_resolved: "masquer temporairement"
  };
  return { ...conflict, resolution: strategy, decision: decisions[strategy] || decisions.hotel_system_wins };
}

function getHotelPublicSyncLabel(syncState = {}) {
  const labels = {
    availability_synced: "Disponibilité synchronisée",
    updated_recently: "Données mises à jour récemment",
    confirm_required: "Disponibilité à confirmer",
    sync_unavailable: "Synchronisation indisponible"
  };
  return labels[syncState.publicLabel] || labels.confirm_required;
}

function shouldShowConfirmRequired(syncState = {}) {
  return !syncState.isSynced || ["stale", "error", "unknown"].includes(syncState.reliability);
}

function HotelIntegrationStatusBadge(status = "not_configured") {
  const variant = status === "active" ? "success" : status === "error" || status === "suspended" ? "danger" : "warning";
  return `<span class="hotel-integration-badge ${variant}">${getHotelIntegrationStatusLabel(status)}</span>`;
}

function HotelSourceOfTruthBadge(source = "hotel_internal_software") {
  return `<span class="hotel-integration-badge">${getHotelSourceOfTruthLabel(source)}</span>`;
}

function HotelPublicSyncBadge(syncState = {}) {
  const warning = shouldShowConfirmRequired(syncState);
  return `<span class="hotel-public-sync-badge${warning ? " warning" : ""}">${getHotelPublicSyncLabel(syncState)}</span>`;
}

function HotelAvailabilityReliabilityLabel(syncState = {}) {
  return shouldShowConfirmRequired(syncState) ? "Disponibilité à confirmer" : "Données mises à jour récemment";
}

function HotelConfirmAvailabilityNotice(syncState = {}) {
  return shouldShowConfirmRequired(syncState) ? `<div class="hotel-integration-notice">${hotelIntegrationDefaults.confirmAvailabilityNotice}</div>` : "";
}

function HotelIntegrationEmptyState(title = hotelIntegrationDefaults.emptyIntegration, action = "") {
  return `<section class="hotel-integration-card"><h2>${hotelIntegrationEscape(title)}</h2>${action}</section>`;
}

function HotelIntegrationKpi(label, value = "0") {
  return `<article class="hotel-integration-kpi"><span>${hotelIntegrationEscape(label)}</span><strong>${hotelIntegrationEscape(value)}</strong></article>`;
}

function HotelApiKeyCard() {
  return `<section class="hotel-integration-card"><h2>Clé API hôtel</h2><p><code>${hotelIntegrationDefaults.maskedApiKey}</code></p><p class="dashboard-muted">Aucune vraie clé API n’est créée maintenant.</p><div class="hotel-chip-row"><button class="btn btn-primary" type="button">Créer clé</button><button class="btn btn-light" type="button">Régénérer</button><button class="btn btn-ghost" type="button">Révoquer</button></div></section>`;
}

function HotelApiPermissionSelector() {
  return `<section class="hotel-integration-card"><h2>Permissions</h2><div class="hotel-integration-form-grid">${hotelIntegrationDefaults.apiPermissions.map((permission) => `<label class="choice-card"><input type="checkbox"><span>${permission}</span></label>`).join("")}</div></section>`;
}

function HotelWebhookEventSelector() {
  return `<div class="hotel-integration-form-grid">${hotelIntegrationDefaults.webhookEvents.map((event) => `<label class="choice-card"><input type="checkbox"><span>${event}</span></label>`).join("")}</div>`;
}

function HotelWebhookCard() {
  return `<section class="hotel-integration-card"><h2>Webhook sortant</h2><div class="hotel-integration-form-grid"><label class="hotel-integration-field"><span>URL webhook</span><input type="url" placeholder="https://"></label><label class="hotel-integration-field"><span>Secret de signature</span><input type="text" placeholder="whsec_****************"></label></div>${HotelWebhookEventSelector()}<div class="hotel-chip-row"><button class="btn btn-primary" type="button">Ajouter webhook</button><button class="btn btn-light" type="button">Tester webhook</button><button class="btn btn-ghost" type="button">Voir logs</button></div></section>`;
}

function HotelFieldMappingEditor() {
  const rows = [
    ["room_name", "name", "string", "Oui", "À configurer"],
    ["room_code", "externalRoomId", "string", "Oui", "À configurer"],
    ["available_qty", "availableUnits", "number", "Oui", "À configurer"],
    ["night_price", "pricePerNight", "number", "Oui", "À configurer"],
    ["currency_code", "currency", "string", "Oui", "À configurer"],
    ["min_stay", "minStay", "number", "Non", "À configurer"],
    ["closed_to_arrival", "closedToArrival", "boolean", "Non", "À configurer"]
  ];
  return HotelSyncTable(["Champ logiciel interne", "Champ Péncmi", "Type", "Obligatoire", "Statut"], rows);
}

function HotelSyncLogTable(items = hotelIntegrationLogs) {
  return items.length ? HotelSyncTable(["Date", "Direction", "Objet", "Identifiant externe", "Statut", "Durée", "Message", "Détail"], items) : HotelIntegrationEmptyState(hotelIntegrationDefaults.emptyLogs);
}

function HotelSyncConflictTable(items = hotelIntegrationConflicts) {
  return items.length ? HotelSyncTable(["Type d’erreur", "Objet", "Identifiant externe", "Valeur Péncmi", "Valeur logiciel interne", "Décision", "Statut", "Date"], items) : HotelIntegrationEmptyState(hotelIntegrationDefaults.emptyErrors);
}

function HotelSyncTable(columns = [], rows = []) {
  return `<section class="hotel-integration-table-wrap"><table class="hotel-integration-table"><thead><tr>${columns.map((column) => `<th>${hotelIntegrationEscape(column)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${hotelIntegrationEscape(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></section>`;
}

function HotelIntegrationLayout(content, currentPage = "overview", title = "Intégration logiciel hôtelier", subtitle = "Connectez votre logiciel interne à Péncmi pour synchroniser vos chambres, prix, disponibilités et demandes clients.") {
  return `<div class="hotel-integration-shell"><div class="hotel-integration-layout">${HotelIntegrationSidebar(currentPage)}<main class="hotel-integration-main"><header class="hotel-integration-header"><div><h1>${hotelIntegrationEscape(title)}</h1><p>${hotelIntegrationEscape(subtitle)}</p></div><a class="btn btn-ghost" href="${buildHotelIntegrationRoute(hotelIntegrationRoutes.hotelDashboard)}">Dashboard hôtels</a></header>${content}</main></div></div>`;
}

function HotelIntegrationSidebar(currentPage = "overview") {
  const items = [
    ["Vue d’ensemble", hotelIntegrationRoutes.overview, "overview"],
    ["Configuration", hotelIntegrationRoutes.setup, "setup"],
    ["API hôtel", hotelIntegrationRoutes.api, "api"],
    ["Webhooks", hotelIntegrationRoutes.webhooks, "webhooks"],
    ["Synchronisation", hotelIntegrationRoutes.syncSettings, "syncSettings"],
    ["Mapping", hotelIntegrationRoutes.mapping, "mapping"],
    ["Logs", hotelIntegrationRoutes.logs, "logs"],
    ["Erreurs", hotelIntegrationRoutes.errors, "errors"],
    ["Test", hotelIntegrationRoutes.test, "test"],
    ["Sécurité", hotelIntegrationRoutes.security, "security"]
  ];
  return `<aside class="dashboard-sidebar"><div class="dashboard-brand"><span>P</span><div><strong>Péncmi</strong><small>Intégration hôtel</small></div></div><nav class="dashboard-nav">${items.map(([label, href, key]) => `<a href="${buildHotelIntegrationRoute(href)}"${key === currentPage ? ' aria-current="page"' : ""}><span>${label}</span><span class="notification-badge">0</span></a>`).join("")}</nav></aside>`;
}

function HotelIntegrationDashboard() {
  const cards = [
    ["Configuration", hotelIntegrationRoutes.setup],
    ["API hôtel", hotelIntegrationRoutes.api],
    ["Webhooks", hotelIntegrationRoutes.webhooks],
    ["Synchronisation", hotelIntegrationRoutes.syncSettings],
    ["Mapping", hotelIntegrationRoutes.mapping],
    ["Logs", hotelIntegrationRoutes.logs],
    ["Sécurité", hotelIntegrationRoutes.security],
    ["Test", hotelIntegrationRoutes.test]
  ];
  return HotelIntegrationLayout(`<section class="hotel-integration-card"><div class="hotel-integration-notice">${hotelIntegrationDefaults.sourceOfTruthText}</div>${HotelIntegrationStatusBadge("not_configured")} ${HotelSourceOfTruthBadge("hotel_internal_software")}</section><section class="hotel-integration-grid">${["Chambres synchronisées", "Prix synchronisés", "Disponibilités synchronisées", "Webhooks actifs", "Erreurs récentes", "Clé API active"].map((label) => HotelIntegrationKpi(label)).join("")}</section>${HotelIntegrationEmptyState(hotelIntegrationDefaults.emptyIntegration, `<a class="btn btn-primary" href="${buildHotelIntegrationRoute(hotelIntegrationRoutes.setup)}">Configurer l’intégration</a>`)}<section class="hotel-integration-grid">${cards.map(([label, href]) => `<article class="hotel-integration-card"><h2>${label}</h2><p>Structure prête pour la connexion backend future.</p><a class="btn btn-light" href="${buildHotelIntegrationRoute(href)}">Ouvrir</a></article>`).join("")}</section>`, "overview");
}

function HotelIntegrationSetupWizard() {
  const steps = ["Présentation", "Choix du mode d’intégration", "Source principale", "Données à synchroniser", "Webhooks sortants", "Mapping des champs", "Sécurité", "Test", "Activation"];
  return HotelIntegrationLayout(`<section class="hotel-integration-card"><div class="hotel-integration-notice">${hotelIntegrationDefaults.sourceOfTruthText}</div><div class="hotel-chip-row">${steps.map((step, index) => `<span class="hotel-chip">${index + 1}. ${step}</span>`).join("")}</div></section><section class="hotel-integration-card"><h2>Mode d’intégration</h2><div class="hotel-integration-form-grid">${["API directe", "Import fichier", "Webhook uniquement", "Synchronisation contrôlée"].map((mode) => `<label class="choice-card"><input type="radio" name="integration-mode"><span>${mode}</span></label>`).join("")}</div><p class="dashboard-muted">Seule la connexion directe avec le logiciel interne de l’hôtel est préparée ici.</p></section>`, "setup", "Assistant de configuration", "Préparez la connexion sans activer de synchronisation réelle.");
}

function HotelIntegrationApiPage() {
  return HotelIntegrationLayout(`${HotelApiKeyCard()}${HotelApiPermissionSelector()}<section class="hotel-integration-card"><h2>Endpoints API futurs</h2>${HotelSyncTable(["Groupe", "Endpoint"], hotelIntegrationDefaults.endpoints)}</section><section class="hotel-integration-card"><h2>Exemples de payload</h2>${Object.entries(hotelIntegrationDefaults.payloadExamples).map(([key, value]) => `<h3>${hotelIntegrationEscape(key)}</h3><pre class="hotel-integration-code">${hotelIntegrationEscape(JSON.stringify(value, null, 2))}</pre>`).join("")}</section>`, "api", "API hôtel", "Documentez les contrats prévus pour recevoir les données du logiciel interne.");
}

function HotelIntegrationWebhooksPage() {
  return HotelIntegrationLayout(`${HotelWebhookCard()}<section class="hotel-integration-card"><h2>Signature webhook</h2><pre class="hotel-integration-code">X-Pencmi-Event-Id\nX-Pencmi-Timestamp\nX-Pencmi-Signature\nX-Pencmi-Attempt</pre></section>`, "webhooks", "Webhooks sortants", "Préparez l’envoi des événements Péncmi vers le logiciel hôtelier.");
}

function HotelIntegrationSyncSettingsPage() {
  const frequencies = ["realtime", "every_5_minutes", "every_15_minutes", "every_30_minutes", "hourly", "daily", "manual"];
  return HotelIntegrationLayout(`<section class="hotel-integration-card"><div class="hotel-integration-notice">${hotelIntegrationDefaults.sourceOfTruthText}</div><div class="hotel-integration-form-grid"><label class="hotel-integration-field"><span>Source principale</span><select><option>${getHotelSourceOfTruthLabel("hotel_internal_software")}</option></select></label><label class="hotel-integration-field"><span>Fréquence</span><select>${frequencies.map((item) => `<option>${getHotelSyncFrequencyLabel(item)}</option>`).join("")}</select></label><label class="hotel-integration-field"><span>Conflit</span><select><option>Le logiciel interne gagne</option><option>Revue manuelle</option><option>Afficher disponibilité à confirmer</option></select></label><label class="hotel-integration-field"><span>Modification manuelle</span><select><option>Désactivée pour les données synchronisées</option><option>Autorisée sur certains champs</option><option>Mode mixte</option></select></label></div></section><section class="hotel-integration-card"><h2>Données synchronisées</h2><div class="hotel-integration-form-grid">${["Établissement", "Chambres", "Prix", "Disponibilités", "Restrictions", "Statuts"].map((item) => `<label class="choice-card"><input type="checkbox"><span>${item}</span></label>`).join("")}</div></section>`, "syncSettings", "Paramètres de synchronisation", "Définissez les règles futures sans synchroniser réellement.");
}

function HotelIntegrationMappingPage() {
  return HotelIntegrationLayout(`<section class="hotel-integration-card"><h2>Mapping des champs</h2>${HotelFieldMappingEditor()}</section>`, "mapping", "Mapping", "Reliez les champs du logiciel interne aux champs Péncmi.");
}

function HotelIntegrationLogsPage() {
  return HotelIntegrationLayout(`<section class="hotel-integration-card"><h2>Logs</h2>${HotelSyncLogTable()}</section>`, "logs", "Logs de synchronisation", "Suivez les échanges futurs entre le logiciel hôtelier et Péncmi.");
}

function HotelIntegrationErrorsPage() {
  return HotelIntegrationLayout(`<section class="hotel-integration-card"><h2>Erreurs et conflits</h2><div class="hotel-integration-notice">Règle par défaut : le logiciel interne gagne.</div>${HotelSyncConflictTable()}</section>`, "errors", "Erreurs et conflits", "Préparez la résolution des erreurs sans appliquer de décision réelle.");
}

function HotelIntegrationTestPage() {
  const tests = ["Tester la clé API", "Tester un payload établissement", "Tester un payload chambre", "Tester un payload disponibilité", "Tester un payload prix", "Tester un webhook sortant", "Simuler une demande de réservation", "Voir la réponse attendue"];
  return HotelIntegrationLayout(`<section class="hotel-integration-card"><div class="hotel-integration-notice">Mode test uniquement. Aucune donnée réelle ne sera synchronisée.</div><div class="hotel-chip-row">${tests.map((test) => `<button class="btn btn-light" type="button">${test}</button>`).join("")}</div></section>`, "test", "Test d’intégration", "Validez les contrats sans synchronisation réelle.");
}

function HotelIntegrationSecurityPage() {
  return HotelIntegrationLayout(`<section class="hotel-integration-card"><h2>Sécurité</h2><div class="hotel-integration-form-grid">${["Clé API par hôtel", "Permissions strictes", "Accès limité aux données de l’hôtel", "Logs complets", "Quotas futurs", "Rate limiting futur", "Révocation", "Rotation", "Signature webhook"].map((item) => `<label class="choice-card"><input type="checkbox"><span>${item}</span></label>`).join("")}</div><div class="hotel-chip-row"><button class="btn btn-light" type="button">Régénérer</button><button class="btn btn-ghost" type="button">Révoquer</button></div></section>`, "security", "Sécurité", "Préparez les contrôles d’accès et signatures futures.");
}

function AdminHotelIntegrationLayout(content, currentPage = "overview", title = "Intégrations hôtels", subtitle = "Supervisez les connexions directes entre logiciels hôteliers et Péncmi.") {
  return `<div class="admin-hotel-integration-shell"><div class="admin-hotel-integration-layout">${AdminHotelIntegrationSidebar(currentPage)}<main class="admin-hotel-integration-main"><header class="admin-hotel-integration-header"><div><h1>${hotelIntegrationEscape(title)}</h1><p>${hotelIntegrationEscape(subtitle)}</p></div><a class="btn btn-ghost" href="${buildHotelIntegrationRoute(adminHotelIntegrationRoutes.admin)}">Admin</a></header>${content}</main></div></div>`;
}

function AdminHotelIntegrationSidebar(currentPage = "overview") {
  const items = [
    ["Vue d’ensemble", adminHotelIntegrationRoutes.overview, "overview"],
    ["Partenaires", adminHotelIntegrationRoutes.partners, "partners"],
    ["Clés API", adminHotelIntegrationRoutes.apiKeys, "apiKeys"],
    ["Webhooks", adminHotelIntegrationRoutes.webhooks, "webhooks"],
    ["Logs", adminHotelIntegrationRoutes.logs, "logs"],
    ["Erreurs", adminHotelIntegrationRoutes.errors, "errors"],
    ["Audit", adminHotelIntegrationRoutes.audit, "audit"],
    ["Paramètres", adminHotelIntegrationRoutes.settings, "settings"]
  ];
  return `<aside class="admin-sidebar"><div class="dashboard-brand"><span>P</span><div><strong>Péncmi</strong><small>Admin intégrations hôtels</small></div></div><nav class="admin-nav">${items.map(([label, href, key]) => `<a href="${buildHotelIntegrationRoute(href)}"${key === currentPage ? ' aria-current="page"' : ""}><span>${label}</span><span class="notification-badge">0</span></a>`).join("")}</nav></aside>`;
}

function AdminHotelIntegrationsDashboard() {
  return AdminHotelIntegrationLayout(`<section class="admin-hotel-integration-grid">${["Hôtels connectés", "Intégrations actives", "Intégrations en test", "Intégrations en erreur", "Webhooks échoués", "Clés API actives", "Dernières synchronisations", "Conflits ouverts"].map((label) => HotelIntegrationKpi(label)).join("")}</section>${HotelIntegrationEmptyState("Aucune intégration hôtel pour le moment.")}`, "overview");
}

function AdminHotelIntegrationPartnersPage() {
  return AdminHotelIntegrationLayout(`${HotelIntegrationEmptyState("Aucun partenaire hôtel connecté pour le moment.")}${HotelSyncTable(["Hôtel", "Type d’établissement", "Statut intégration", "Source principale", "Dernière synchronisation", "Erreurs", "Webhooks actifs", "Actions"], [])}`, "partners", "Partenaires hôtels", "Suivez les établissements connectés.");
}

function AdminHotelIntegrationApiKeysPage() {
  return AdminHotelIntegrationLayout(`${HotelApiKeyCard()}${HotelIntegrationEmptyState("Aucune clé API hôtel active pour le moment.")}`, "apiKeys", "Clés API hôtels", "Supervisez les accès API sans afficher de vraie clé.");
}

function AdminHotelIntegrationWebhooksPage() {
  return AdminHotelIntegrationLayout(`${HotelIntegrationEmptyState("Aucun webhook hôtel configuré pour le moment.")}`, "webhooks", "Webhooks hôtels", "Supervisez les webhooks sortants.");
}

function AdminHotelIntegrationLogsPage() {
  return AdminHotelIntegrationLayout(HotelSyncLogTable(), "logs", "Logs intégrations hôtels", "Consultez les échanges prévus.");
}

function AdminHotelIntegrationErrorsPage() {
  return AdminHotelIntegrationLayout(HotelSyncConflictTable(), "errors", "Erreurs intégrations hôtels", "Suivez les conflits ouverts.");
}

function AdminHotelIntegrationAuditPage() {
  return AdminHotelIntegrationLayout(HotelIntegrationEmptyState("Aucun événement d’audit pour le moment."), "audit", "Audit intégrations hôtels", "Préparez la traçabilité admin.");
}

function AdminHotelIntegrationSettingsPage() {
  return AdminHotelIntegrationLayout(`<section class="admin-hotel-integration-card"><h2>Paramètres</h2><div class="hotel-integration-form-grid"><label class="hotel-integration-field"><span>Stratégie par défaut</span><select><option>Le logiciel interne gagne</option></select></label><label class="hotel-integration-field"><span>Mode dégradé</span><select><option>Afficher disponibilité à confirmer</option><option>Masquer les chambres</option><option>Empêcher l’envoi de demande</option></select></label></div></section>`, "settings", "Paramètres intégrations hôtels", "Définissez les valeurs par défaut futures.");
}

function renderHotelIntegrationPage() {
  const root = document.querySelector("#hotel-integration-root");
  if (!root) return;
  const page = document.body.dataset.hotelIntegrationPage || "overview";
  const pages = {
    overview: HotelIntegrationDashboard,
    setup: HotelIntegrationSetupWizard,
    api: HotelIntegrationApiPage,
    webhooks: HotelIntegrationWebhooksPage,
    syncSettings: HotelIntegrationSyncSettingsPage,
    mapping: HotelIntegrationMappingPage,
    logs: HotelIntegrationLogsPage,
    errors: HotelIntegrationErrorsPage,
    test: HotelIntegrationTestPage,
    security: HotelIntegrationSecurityPage
  };
  root.innerHTML = (pages[page] || HotelIntegrationDashboard)();
}

function renderAdminHotelIntegrationPage() {
  const root = document.querySelector("#admin-hotel-integration-root");
  if (!root) return;
  const page = document.body.dataset.adminHotelIntegrationPage || "overview";
  const pages = {
    overview: AdminHotelIntegrationsDashboard,
    partners: AdminHotelIntegrationPartnersPage,
    apiKeys: AdminHotelIntegrationApiKeysPage,
    webhooks: AdminHotelIntegrationWebhooksPage,
    logs: AdminHotelIntegrationLogsPage,
    errors: AdminHotelIntegrationErrorsPage,
    audit: AdminHotelIntegrationAuditPage,
    settings: AdminHotelIntegrationSettingsPage
  };
  root.innerHTML = (pages[page] || AdminHotelIntegrationsDashboard)();
}

document.addEventListener("DOMContentLoaded", () => {
  renderHotelIntegrationPage();
  renderAdminHotelIntegrationPage();
});

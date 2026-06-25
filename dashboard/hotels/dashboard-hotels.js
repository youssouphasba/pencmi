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
  contacts: [],
  stats: null
};

function hotelDashboardRouteHref(path) {
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
  const items = [
    ["Vue d’ensemble", hotelDashboardRoutes.overview, "overview"],
    ["Hébergements", hotelDashboardRoutes.listings, "listings", "0"],
    ["Disponibilités", hotelDashboardRoutes.availability, "availability", "0"],
    ["Messages", hotelDashboardRoutes.messages, "messages", "0"],
    ["Réservations", hotelDashboardRoutes.reservations, "reservations", "0"],
    ["Contacts", hotelDashboardRoutes.contacts, "contacts", "0"],
    ["Statistiques", hotelDashboardRoutes.statistics, "statistics", "0"],
    ["Moyens de contact", hotelDashboardRoutes.contactSettings, "contactSettings", "0"],
    ["Emails automatiques", hotelDashboardRoutes.emailSettings, "emailSettings", "0"],
    ["Intégration logiciel hôtelier", hotelDashboardRoutes.integration, "integration", "0"]
  ];
  return `
    <aside class="dashboard-sidebar" id="hotel-sidebar">
      <div class="dashboard-brand"><span>P</span><div><strong>Péncmi</strong><small>Annonceur hôtels</small></div></div>
      <nav class="dashboard-nav">${items.map(([label, href, key, badge]) => `<a href="${hotelDashboardRouteHref(href)}"${key === currentPage ? ' aria-current="page"' : ""}><span>${label}</span>${badge ? `<span class="notification-badge">${badge}</span>` : ""}</a>`).join("")}</nav>
    </aside>
  `;
}

function DashboardHeader(title, subtitle, actions = "") {
  const bell = typeof NotificationBell === "function" ? NotificationBell() : `<a class="btn btn-ghost" href="${hotelDashboardRouteHref("/dashboard/notifications")}">Notifications <span class="notification-badge">0</span></a>`;
  return `
    <header class="hotel-dashboard-header">
      <div><button class="btn btn-ghost dashboard-menu-toggle" type="button" data-open-sidebar>Menu</button><h1>${title}</h1><p>${subtitle}</p></div>
      <div class="dashboard-header-actions">${bell}${actions}</div>
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
  return `<span class="hotel-status-badge">${labels[status] || status || "À renseigner"}</span>`;
}

function HotelAvailabilityDashboard() {
  return `<section class="hotel-dashboard-card"><h2>Disponibilités à mettre à jour</h2><p class="dashboard-muted">Aucune alerte de disponibilité pour le moment.</p></section>`;
}

function AvailabilityAlerts() {
  const alerts = ["Réservation à confirmer", "Disponibilité faible", "Chambre complète", "Chambre en maintenance", "Arrivée client aujourd’hui", "Départ client aujourd’hui", "Calendrier non mis à jour", "Prix manquant", "Chambre sans photo", "Chambre sans équipements"];
  return `<section class="hotel-dashboard-card"><h2>Alertes prévues</h2><div class="hotel-chip-row">${alerts.map((alert) => `<span class="hotel-chip">${alert}</span>`).join("")}</div></section>`;
}

function HotelsDashboardPage() {
  const kpis = [
    "Hébergements actifs",
    "Hébergements en attente",
    "Chambres disponibles aujourd’hui",
    "Chambres occupées",
    "Chambres en attente de confirmation",
    "Chambres complètes",
    "Réservations à confirmer",
    "Arrivées du jour",
    "Départs du jour",
    "Taux d’occupation",
    "Revenu estimé",
    "Vues totales",
    "Favoris",
    "Messages reçus",
    "Contacts",
    "Demandes de réservation",
    "Délai moyen de réponse",
    "Disponibilités à mettre à jour"
  ];
  return HotelsDashboardLayout(`
    ${DashboardHeader("Dashboard hôtels", "Suivez vos hébergements, disponibilités, demandes et performances.", `<a class="btn btn-primary" href="${hotelDashboardRouteHref(hotelDashboardRoutes.publish)}">Publier un hébergement</a>`)}
    <section class="hotel-kpi-grid">${kpis.map((title) => KpiCard(title)).join("")}</section>
    ${EmptyState("Aucune donnée disponible pour le moment.")}
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
  return `<section class="hotel-table-wrap"><table class="hotel-table"><thead><tr><th>Hébergement</th><th>Statut</th><th>Ville</th><th>Prix à partir de</th><th>Chambres</th><th>Disponibilités</th><th>Vues</th><th>Favoris</th><th>Messages</th><th>Demandes</th><th>Score</th><th>Actions</th></tr></thead><tbody></tbody></table></section>`;
}

function HotelAvailabilityCalendar() {
  return `<section class="hotel-dashboard-card"><h2>Calendrier de disponibilités</h2><div class="hotel-chart-placeholder">Calendrier prévu par chambre, date, stock, prix et statut</div></section>`;
}

function RoomAvailabilityManager() {
  return `<section class="hotel-dashboard-card"><h2>Gestion des chambres</h2><div class="hotel-chip-row">${["Modifier disponibilité", "Bloquer une période", "Ouvrir une période", "Modifier le prix", "Marquer complet", "Marquer en maintenance"].map((action) => `<button class="btn btn-ghost" type="button">${action}</button>`).join("")}</div></section>`;
}

function HotelAvailabilityPage() {
  return HotelsDashboardLayout(`
    ${DashboardHeader("Disponibilités", "Gérez les dates, prix, stocks, saisons et statuts de vos chambres.", `<button class="btn btn-primary" type="button">Ajouter des disponibilités</button>`)}
    ${HotelAvailabilityCalendar()}
    ${RoomAvailabilityManager()}
    ${EmptyState("Aucune disponibilité renseignée pour le moment.", "", `<button class="btn btn-primary" type="button">Ajouter des disponibilités</button>`)}
  `, "availability");
}

function HotelMessagesPage() {
  return HotelsDashboardLayout(`${DashboardHeader("Messages hôtels", "Suivez les conversations clients et les réponses annonceur.")}${EmptyState("Aucun message reçu pour le moment.", "Les conversations liées à vos hébergements apparaîtront ici.")}`, "messages");
}

function HotelReservationsPage() {
  return HotelsDashboardLayout(`
    ${DashboardHeader("Demandes de réservation", "Gérez les demandes de réservation reçues sur vos hébergements.")}
    ${hotelDashboardData.reservations.length ? `<section class="hotel-table-wrap"><table class="hotel-table"><thead><tr><th>Client</th><th>Hébergement</th><th>Chambre</th><th>Arrivée</th><th>Départ</th><th>Nuits</th><th>Personnes</th><th>Chambres</th><th>Prix estimé</th><th>Message</th><th>Statut</th><th>Actions</th></tr></thead><tbody></tbody></table></section>` : EmptyState("Aucune demande de réservation pour le moment.")}
  `, "reservations");
}

function HotelContactsPage() {
  const sources = ["WhatsApp", "Téléphone", "Email", "Message interne", "Formulaire", "Demande de réservation"];
  return HotelsDashboardLayout(`
    ${DashboardHeader("Contacts reçus", "Suivez les contacts générés par vos hébergements.")}
    <section class="hotel-dashboard-card"><h2>Sources prévues</h2><div class="hotel-chip-row">${sources.map((source) => `<span class="hotel-chip">${source}</span>`).join("")}</div></section>
    ${EmptyState("Aucun contact reçu pour le moment.")}
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
  const notificationTriggers = ["Nouveau message", "Nouvelle demande de réservation", "Nouveau formulaire", "Nouveau contact", "Réservation acceptée", "Réservation annulée"];
  return HotelsDashboardLayout(`
    ${DashboardHeader("Moyens de contact", "Configurez les contacts et notifications email pour vos hébergements.", `<a class="btn btn-light" href="${hotelDashboardRouteHref(hotelDashboardRoutes.emailSettings)}">Emails automatiques</a>`)}
    <section class="hotel-dashboard-card">
      <h2>Paramètres de contact hôtels</h2>
      <div class="hotel-form-grid">
        ${["WhatsApp", "Téléphone", "Email", "Messagerie interne", "Formulaire", "Demande de réservation", "Notifications email", "Emails automatiques client"].map((item) => `<label class="choice-card"><input type="checkbox"><span>${item}</span></label>`).join("")}
        <label class="hotel-form-field"><span>Numéro WhatsApp</span><input type="tel"></label>
        <label class="hotel-form-field"><span>Numéro téléphone</span><input type="tel"></label>
        <label class="hotel-form-field"><span>Email de contact</span><input type="email"></label>
        <label class="hotel-form-field"><span>Email de notification</span><input type="email"></label>
        <label class="hotel-form-field"><span>Méthode préférée</span><select><option>WhatsApp</option><option>Téléphone</option><option>Email</option><option>Message interne</option><option>Formulaire</option></select></label>
      </div>
      <div class="hotel-form-actions"><button class="btn btn-primary" type="button" data-save-contact-settings>Enregistrer</button></div>
      <p id="contact-settings-message" hidden>Vos moyens de contact ont été mis à jour.</p>
    </section>
    <section class="hotel-dashboard-card">
      <h2>Résumé et aperçu client</h2>
      <p class="dashboard-muted">Les boutons visibles côté client dépendront des moyens activés.</p>
      <div class="hotel-chip-row">${["Demander une réservation", "Envoyer un message", "Appeler", "WhatsApp", "Email"].map((item) => `<span class="hotel-chip">${item}</span>`).join("")}</div>
    </section>
    <section class="hotel-dashboard-card">
      <h2>Notifications email prévues</h2>
      <p class="dashboard-muted">Objet futur : Nouveau contact sur votre hébergement Péncmi.</p>
      <div class="hotel-chip-row">${notificationTriggers.map((trigger) => `<span class="hotel-chip">${trigger}</span>`).join("")}</div>
      <p class="dashboard-muted">L’email contiendra le nom de l’hébergement, la chambre concernée, le type de demande, un extrait du message et un lien vers le dashboard.</p>
    </section>
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
  document.querySelector("[data-save-contact-settings]")?.addEventListener("click", () => {
    document.querySelector("#contact-settings-message").hidden = false;
  });
}

renderDashboard();

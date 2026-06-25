const tripDashboardRoutes = {
  overview: "/dashboard/voyages",
  listings: "/dashboard/voyages/trajets",
  messages: "/dashboard/voyages/messages",
  reservations: "/dashboard/voyages/reservations",
  contacts: "/dashboard/voyages/contacts",
  statistics: "/dashboard/voyages/statistiques",
  contactSettings: "/dashboard/voyages/contact-settings",
  emailSettings: "/dashboard/voyages/email-settings",
  publish: "/publier?category=voyage"
};

const tripDashboardData = {
  trips: [],
  messages: [],
  reservations: [],
  contacts: [],
  stats: null
};

function tripDashboardRouteHref(path) {
  if (window.location.protocol !== "file:") {
    return path;
  }
  const page = document.body.dataset.tripDashboardPage;
  const fromRoot = page === "overview";
  const prefix = fromRoot ? "./" : "../";
  const map = {
    [tripDashboardRoutes.overview]: fromRoot ? "./" : "../",
    [tripDashboardRoutes.listings]: `${prefix}trajets/`,
    [tripDashboardRoutes.messages]: `${prefix}messages/`,
    [tripDashboardRoutes.reservations]: `${prefix}reservations/`,
    [tripDashboardRoutes.contacts]: `${prefix}contacts/`,
    [tripDashboardRoutes.statistics]: `${prefix}statistiques/`,
    [tripDashboardRoutes.contactSettings]: `${prefix}contact-settings/`,
    [tripDashboardRoutes.emailSettings]: `${prefix}email-settings/`,
    [tripDashboardRoutes.publish]: fromRoot ? "../../publier/?category=voyage" : "../../../publier/?category=voyage"
  };
  return map[path] || path;
}

function TripsDashboardLayout(content, currentPage) {
  return `<div class="trip-dashboard-layout"><div class="trip-dashboard-shell">${TripsDashboardSidebar(currentPage)}<section class="trip-dashboard-main">${content}</section></div></div>`;
}

function TripsDashboardSidebar(currentPage) {
  const items = [
    ["Vue d’ensemble", tripDashboardRoutes.overview, "overview"],
    ["Trajets", tripDashboardRoutes.listings, "listings", "0"],
    ["Messages", tripDashboardRoutes.messages, "messages", "0"],
    ["Demandes de place", tripDashboardRoutes.reservations, "reservations", "0"],
    ["Contacts", tripDashboardRoutes.contacts, "contacts", "0"],
    ["Statistiques", tripDashboardRoutes.statistics, "statistics", "0"],
    ["Moyens de contact", tripDashboardRoutes.contactSettings, "contactSettings", "0"],
    ["Emails automatiques", tripDashboardRoutes.emailSettings, "emailSettings", "0"]
  ];
  return `<aside class="dashboard-sidebar" id="trip-sidebar"><div class="dashboard-brand"><span>P</span><div><strong>Péncmi</strong><small>Annonceur voyages</small></div></div><nav class="dashboard-nav">${items.map(([label, href, key, badge]) => `<a href="${tripDashboardRouteHref(href)}"${key === currentPage ? ' aria-current="page"' : ""}><span>${label}</span>${badge ? `<span class="notification-badge">${badge}</span>` : ""}</a>`).join("")}</nav></aside>`;
}

function DashboardHeader(title, subtitle, actions = "") {
  const bell = typeof NotificationBell === "function" ? NotificationBell() : `<a class="btn btn-ghost" href="${tripDashboardRouteHref("/dashboard/notifications")}">Notifications <span class="notification-badge">0</span></a>`;
  return `<header class="trip-dashboard-header"><div><button class="btn btn-ghost dashboard-menu-toggle" type="button" data-open-sidebar>Menu</button><h1>${title}</h1><p>${subtitle}</p></div><div class="dashboard-header-actions">${bell}${actions}</div></header>`;
}

function KpiCard(title, value) {
  return `<article class="kpi-card"><span class="kpi-icon">TR</span><h3>${title}</h3>${value ? `<div class="kpi-value">${value}</div>` : `<div class="kpi-empty">Aucune donnée disponible</div>`}</article>`;
}

function EmptyState(title, text = "", action = "") {
  return `<section class="trip-empty-dashboard"><div><h2>${title}</h2>${text ? `<p>${text}</p>` : ""}${action ? `<div class="trip-empty-actions">${action}</div>` : ""}</div></section>`;
}

function TripsDashboardPage() {
  const kpis = ["Trajets actifs", "Trajets en attente", "Trajets complets", "Vues totales", "Favoris", "Messages reçus", "Contacts", "Demandes de réservation", "Places demandées", "Clics WhatsApp", "Clics téléphone", "Taux vue → demande", "Délai moyen de réponse", "Meilleurs trajets", "Trajets à améliorer"];
  return TripsDashboardLayout(`
    ${DashboardHeader("Dashboard voyages", "Suivez vos trajets, demandes, contacts, messages et performances.", `<a class="btn btn-primary" href="${tripDashboardRouteHref(tripDashboardRoutes.publish)}">Publier un trajet</a>`)}
    <section class="trip-kpi-grid">${kpis.map((title) => KpiCard(title)).join("")}</section>
    ${EmptyState("Aucune donnée disponible pour le moment.")}
  `, "overview");
}

function TripListingsDashboardPage() {
  return TripsDashboardLayout(`
    ${DashboardHeader("Mes trajets", "Gérez vos trajets publiés, leurs places et leurs performances.", `<a class="btn btn-primary" href="${tripDashboardRouteHref(tripDashboardRoutes.publish)}">Publier mon premier trajet</a>`)}
    ${tripDashboardData.trips.length ? TripListingsTable() : EmptyState("Vous n’avez aucun trajet publié pour le moment.", "", `<a class="btn btn-primary" href="${tripDashboardRouteHref(tripDashboardRoutes.publish)}">Publier mon premier trajet</a>`)}
  `, "listings");
}

function TripListingsTable() {
  return `<section class="trip-table-wrap"><table class="trip-table"><thead><tr><th>Trajet</th><th>Statut</th><th>Départ</th><th>Arrivée</th><th>Date</th><th>Heure</th><th>Prix</th><th>Places</th><th>Demandes</th><th>Vues</th><th>Favoris</th><th>Score</th><th>Actions</th></tr></thead><tbody></tbody></table></section>`;
}

function TripMessagesPage() {
  return TripsDashboardLayout(`${DashboardHeader("Messages voyages", "Suivez les conversations clients, les trajets concernés et vos réponses.")}${EmptyState("Aucun message reçu pour le moment.", "Les messages clients liés à vos trajets apparaîtront ici.")}`, "messages");
}

function TripReservationsPage() {
  return TripsDashboardLayout(`
    ${DashboardHeader("Demandes de place", "Gérez les demandes de réservation reçues sur vos trajets.")}
    ${tripDashboardData.reservations.length ? `<section class="trip-table-wrap"><table class="trip-table"><thead><tr><th>Client</th><th>Trajet</th><th>Places demandées</th><th>Bagages</th><th>Message</th><th>Statut</th><th>Date</th><th>Actions</th></tr></thead><tbody></tbody></table></section>` : EmptyState("Aucune demande de place pour le moment.")}
  `, "reservations");
}

function TripContactsPage() {
  const sources = ["WhatsApp", "Téléphone", "Email", "Message interne", "Formulaire", "Demande de place"];
  return TripsDashboardLayout(`
    ${DashboardHeader("Contacts reçus", "Suivez les contacts générés par vos trajets.")}
    <section class="trip-dashboard-card"><h2>Sources prévues</h2><div class="trip-chip-row">${sources.map((source) => `<span class="trip-chip">${source}</span>`).join("")}</div></section>
    ${EmptyState("Aucun contact reçu pour le moment.")}
  `, "contacts");
}

function TripStatisticsPage() {
  const kpis = ["Vues", "Clics détails", "Favoris", "Contacts", "Messages", "Demandes de place", "Places demandées", "Clics WhatsApp", "Clics téléphone", "Clics email", "Taux vue → demande", "Taux vue → contact", "Délai moyen de réponse"];
  return TripsDashboardLayout(`
    ${DashboardHeader("Statistiques voyages", "Analysez les performances détaillées de vos trajets.")}
    <section class="trip-kpi-grid">${kpis.map((title) => KpiCard(title)).join("")}</section>
    ${EmptyState("Aucune statistique disponible pour le moment.")}
    <div class="dashboard-grid"><section class="trip-dashboard-card"><h2>Trajets les plus consultés</h2><div class="trip-chart-placeholder">Bloc graphique prévu</div></section><section class="trip-dashboard-card"><h2>Trajets sans contact</h2><div class="trip-chart-placeholder">Bloc prévu</div></section><section class="trip-dashboard-card"><h2>Trajets à améliorer</h2><div class="trip-chart-placeholder">Bloc prévu</div></section></div>
  `, "statistics");
}

function TripContactSettingsPage() {
  const notificationTriggers = ["Nouveau message", "Nouvelle demande de place", "Nouveau formulaire", "Nouveau contact"];
  return TripsDashboardLayout(`
    ${DashboardHeader("Moyens de contact", "Configurez les contacts et notifications email pour vos trajets.", `<a class="btn btn-light" href="${tripDashboardRouteHref(tripDashboardRoutes.emailSettings)}">Emails automatiques</a>`)}
    <section class="trip-dashboard-card">
      <h2>Paramètres de contact voyages</h2>
      <div class="trip-form-grid">
        ${["WhatsApp", "Téléphone", "Email", "Messagerie interne", "Formulaire", "Demande de place", "Notifications email", "Emails automatiques client"].map((item) => `<label class="choice-card"><input type="checkbox"><span>${item}</span></label>`).join("")}
        <label class="trip-form-field"><span>Numéro WhatsApp</span><input type="tel"></label>
        <label class="trip-form-field"><span>Numéro téléphone</span><input type="tel"></label>
        <label class="trip-form-field"><span>Email de contact</span><input type="email"></label>
        <label class="trip-form-field"><span>Email de notification</span><input type="email"></label>
        <label class="trip-form-field"><span>Méthode préférée</span><select><option>WhatsApp</option><option>Téléphone</option><option>Email</option><option>Message interne</option><option>Formulaire</option></select></label>
      </div>
      <div class="trip-form-actions"><button class="btn btn-primary" type="button" data-save-contact-settings>Enregistrer</button></div>
      <p id="trip-contact-settings-message" hidden>Vos moyens de contact ont été mis à jour.</p>
    </section>
    <section class="trip-dashboard-card">
      <h2>Résumé et aperçu client</h2>
      <p class="dashboard-muted">Les boutons visibles côté client dépendent des canaux activés.</p>
      <div class="trip-chip-row">${["Demander une place", "Envoyer un message", "Appeler", "WhatsApp"].map((item) => `<span class="trip-chip">${item}</span>`).join("")}</div>
    </section>
    <section class="trip-dashboard-card">
      <h2>Notifications email prévues</h2>
      <p class="dashboard-muted">Objet futur : Nouvelle demande sur votre trajet Péncmi.</p>
      <div class="trip-chip-row">${notificationTriggers.map((trigger) => `<span class="trip-chip">${trigger}</span>`).join("")}</div>
      <p class="dashboard-muted">L’email contiendra le trajet concerné, le type de demande, un extrait du message et un lien vers le dashboard.</p>
    </section>
  `, "contactSettings");
}

function renderDashboard() {
  const page = document.body.dataset.tripDashboardPage;
  const pages = {
    overview: TripsDashboardPage,
    listings: TripListingsDashboardPage,
    messages: TripMessagesPage,
    reservations: TripReservationsPage,
    contacts: TripContactsPage,
    statistics: TripStatisticsPage,
    contactSettings: TripContactSettingsPage
  };
  document.querySelector("#trip-dashboard-root").innerHTML = pages[page]();
  document.querySelector("[data-open-sidebar]")?.addEventListener("click", () => document.querySelector("#trip-sidebar").classList.toggle("is-open"));
  document.querySelector("[data-save-contact-settings]")?.addEventListener("click", () => {
    document.querySelector("#trip-contact-settings-message").hidden = false;
  });
}

renderDashboard();

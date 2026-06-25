const vehicleDashboardRoutes = {
  overview: "/dashboard/voitures",
  listings: "/dashboard/voitures/annonces",
  messages: "/dashboard/voitures/messages",
  contacts: "/dashboard/voitures/contacts",
  statistics: "/dashboard/voitures/statistiques",
  contactSettings: "/dashboard/voitures/contact-settings",
  emailSettings: "/dashboard/voitures/email-settings",
  publish: "/publier?category=voiture"
};

const vehicleDashboardData = {
  listings: [],
  messages: [],
  contacts: [],
  stats: null
};

function vehicleDashboardRouteHref(path) {
  if (window.location.protocol !== "file:") {
    return path;
  }
  const page = document.body.dataset.vehicleDashboardPage;
  const fromRoot = page === "overview";
  const prefix = fromRoot ? "./" : "../";
  const map = {
    [vehicleDashboardRoutes.overview]: fromRoot ? "./" : "../",
    [vehicleDashboardRoutes.listings]: `${prefix}annonces/`,
    [vehicleDashboardRoutes.messages]: `${prefix}messages/`,
    [vehicleDashboardRoutes.contacts]: `${prefix}contacts/`,
    [vehicleDashboardRoutes.statistics]: `${prefix}statistiques/`,
    [vehicleDashboardRoutes.contactSettings]: `${prefix}contact-settings/`,
    [vehicleDashboardRoutes.emailSettings]: `${prefix}email-settings/`,
    [vehicleDashboardRoutes.publish]: fromRoot ? "../../publier/?category=voiture" : "../../../publier/?category=voiture"
  };
  return map[path] || path;
}

function VehiclesDashboardLayout(content, currentPage) {
  return `
    <div class="vehicle-dashboard-layout">
      <div class="vehicle-dashboard-shell">
        ${VehiclesDashboardSidebar(currentPage)}
        <section class="vehicle-dashboard-main">${content}</section>
      </div>
    </div>
  `;
}

function VehiclesDashboardSidebar(currentPage) {
  const items = [
    ["Vue d’ensemble", vehicleDashboardRoutes.overview, "overview"],
    ["Annonces", vehicleDashboardRoutes.listings, "listings", "0"],
    ["Messages", vehicleDashboardRoutes.messages, "messages", "0"],
    ["Contacts", vehicleDashboardRoutes.contacts, "contacts", "0"],
    ["Statistiques", vehicleDashboardRoutes.statistics, "statistics", "0"],
    ["Moyens de contact", vehicleDashboardRoutes.contactSettings, "contactSettings", "0"],
    ["Emails automatiques", vehicleDashboardRoutes.emailSettings, "emailSettings", "0"]
  ];
  return `<aside class="dashboard-sidebar" id="vehicle-sidebar"><div class="dashboard-brand"><span>P</span><div><strong>Péncmi</strong><small>Annonceur voitures</small></div></div><nav class="dashboard-nav">${items.map(([label, href, key, badge]) => `<a href="${vehicleDashboardRouteHref(href)}"${key === currentPage ? ' aria-current="page"' : ""}><span>${label}</span>${badge ? `<span class="notification-badge">${badge}</span>` : ""}</a>`).join("")}</nav></aside>`;
}

function DashboardHeader(title, subtitle, actions = "") {
  const bell = typeof NotificationBell === "function" ? NotificationBell() : `<a class="btn btn-ghost" href="${vehicleDashboardRouteHref("/dashboard/notifications")}">Notifications <span class="notification-badge">0</span></a>`;
  return `<header class="vehicle-dashboard-header"><div><button class="btn btn-ghost dashboard-menu-toggle" type="button" data-open-sidebar>Menu</button><h1>${title}</h1><p>${subtitle}</p></div><div class="dashboard-header-actions">${bell}${actions}</div></header>`;
}

function KpiCard(title, value) {
  return `<article class="kpi-card"><span class="kpi-icon">VO</span><h3>${title}</h3>${value ? `<div class="kpi-value">${value}</div>` : `<div class="kpi-empty">Aucune donnée disponible</div>`}</article>`;
}

function EmptyState(title, text = "", action = "") {
  return `<section class="vehicle-empty-dashboard"><div><h2>${title}</h2>${text ? `<p>${text}</p>` : ""}${action ? `<div class="vehicle-empty-actions">${action}</div>` : ""}</div></section>`;
}

function VehiclesDashboardPage() {
  const kpis = ["Annonces actives", "Annonces en attente", "Vues totales", "Favoris", "Messages reçus", "Contacts", "Clics WhatsApp", "Clics téléphone", "Clics email", "Taux vue → contact", "Délai moyen de réponse", "Meilleures annonces", "Annonces à améliorer"];
  return VehiclesDashboardLayout(`
    ${DashboardHeader("Dashboard voitures", "Suivez vos annonces, contacts, messages et performances.", `<a class="btn btn-primary" href="${vehicleDashboardRouteHref(vehicleDashboardRoutes.publish)}">Publier une voiture</a>`)}
    <section class="vehicle-kpi-grid">${kpis.map((title) => KpiCard(title)).join("")}</section>
    ${EmptyState("Aucune donnée disponible pour le moment.")}
  `, "overview");
}

function VehicleListingsDashboardPage() {
  return VehiclesDashboardLayout(`
    ${DashboardHeader("Mes annonces voitures", "Gérez vos véhicules publiés et leurs performances.", `<a class="btn btn-primary" href="${vehicleDashboardRouteHref(vehicleDashboardRoutes.publish)}">Publier ma première voiture</a>`)}
    ${vehicleDashboardData.listings.length ? VehicleListingsTable() : EmptyState("Vous n’avez aucune annonce voiture pour le moment.", "", `<a class="btn btn-primary" href="${vehicleDashboardRouteHref(vehicleDashboardRoutes.publish)}">Publier ma première voiture</a>`)}
  `, "listings");
}

function VehicleListingsTable() {
  return `<section class="vehicle-table-wrap"><table class="vehicle-table"><thead><tr><th>Voiture</th><th>Statut</th><th>Ville</th><th>Prix</th><th>Vues</th><th>Favoris</th><th>Contacts</th><th>Messages</th><th>Score de complétion</th><th>Actions</th></tr></thead><tbody></tbody></table></section>`;
}

function VehicleMessagesPage() {
  return VehiclesDashboardLayout(`${DashboardHeader("Messages voitures", "Suivez les conversations clients, le véhicule concerné et vos réponses.")}${EmptyState("Aucun message reçu pour le moment.", "Les messages clients liés à vos véhicules apparaîtront ici.")}`, "messages");
}

function VehicleContactsPage() {
  const sources = ["WhatsApp", "Téléphone", "Email", "Message interne", "Formulaire"];
  return VehiclesDashboardLayout(`
    ${DashboardHeader("Contacts reçus", "Suivez les contacts générés par vos annonces voitures.")}
    <section class="vehicle-dashboard-card"><h2>Sources prévues</h2><div class="vehicle-chip-row">${sources.map((source) => `<span class="vehicle-chip">${source}</span>`).join("")}</div></section>
    ${EmptyState("Aucun contact reçu pour le moment.")}
  `, "contacts");
}

function VehicleStatisticsPage() {
  const kpis = ["Vues", "Clics détails", "Favoris", "Contacts", "Messages", "Clics WhatsApp", "Clics téléphone", "Clics email", "Taux vue → contact", "Délai moyen de réponse"];
  return VehiclesDashboardLayout(`
    ${DashboardHeader("Statistiques voitures", "Analysez les performances détaillées de vos annonces.")}
    <section class="vehicle-kpi-grid">${kpis.map((title) => KpiCard(title)).join("")}</section>
    ${EmptyState("Aucune statistique disponible pour le moment.")}
    <div class="dashboard-grid"><section class="vehicle-dashboard-card"><h2>Annonces les plus consultées</h2><div class="vehicle-chart-placeholder">Bloc graphique prévu</div></section><section class="vehicle-dashboard-card"><h2>Annonces sans contact</h2><div class="vehicle-chart-placeholder">Bloc prévu</div></section><section class="vehicle-dashboard-card"><h2>Annonces à améliorer</h2><div class="vehicle-chart-placeholder">Bloc prévu</div></section></div>
  `, "statistics");
}

function VehicleContactSettingsPage() {
  const notificationTriggers = ["Nouveau message", "Nouveau formulaire", "Nouveau contact"];
  return VehiclesDashboardLayout(`
    ${DashboardHeader("Moyens de contact", "Configurez les contacts et notifications email pour vos annonces voitures.", `<a class="btn btn-light" href="${vehicleDashboardRouteHref(vehicleDashboardRoutes.emailSettings)}">Emails automatiques</a>`)}
    <section class="vehicle-dashboard-card">
      <h2>Paramètres de contact voitures</h2>
      <div class="vehicle-form-grid">
        ${["WhatsApp", "Téléphone", "Email", "Messagerie interne", "Formulaire", "Notifications email", "Emails automatiques client"].map((item) => `<label class="choice-card"><input type="checkbox"><span>${item}</span></label>`).join("")}
        <label class="vehicle-form-field"><span>Numéro WhatsApp</span><input type="tel"></label>
        <label class="vehicle-form-field"><span>Numéro téléphone</span><input type="tel"></label>
        <label class="vehicle-form-field"><span>Email de contact</span><input type="email"></label>
        <label class="vehicle-form-field"><span>Email de notification</span><input type="email"></label>
        <label class="vehicle-form-field"><span>Méthode préférée</span><select><option>WhatsApp</option><option>Téléphone</option><option>Email</option><option>Message interne</option><option>Formulaire</option></select></label>
      </div>
      <div class="vehicle-form-actions"><button class="btn btn-primary" type="button" data-save-contact-settings>Enregistrer</button></div>
      <p id="vehicle-contact-settings-message" hidden>Vos moyens de contact ont été mis à jour.</p>
    </section>
    <section class="vehicle-dashboard-card">
      <h2>Résumé et aperçu client</h2>
      <p class="dashboard-muted">Les boutons visibles s’adaptent au type d’annonce : vente, location ou chauffeur.</p>
      <div class="vehicle-chip-row">${["Contacter le vendeur", "Demander une location", "Demander un chauffeur", "Envoyer un message", "Appeler", "WhatsApp", "Email"].map((item) => `<span class="vehicle-chip">${item}</span>`).join("")}</div>
    </section>
    <section class="vehicle-dashboard-card">
      <h2>Notifications email prévues</h2>
      <p class="dashboard-muted">Objet futur : Nouveau contact sur votre annonce voiture Péncmi.</p>
      <div class="vehicle-chip-row">${notificationTriggers.map((trigger) => `<span class="vehicle-chip">${trigger}</span>`).join("")}</div>
      <p class="dashboard-muted">L’email contiendra le véhicule concerné, le type de contact, un extrait du message et un lien vers le dashboard.</p>
    </section>
  `, "contactSettings");
}

function renderDashboard() {
  const page = document.body.dataset.vehicleDashboardPage;
  const pages = {
    overview: VehiclesDashboardPage,
    listings: VehicleListingsDashboardPage,
    messages: VehicleMessagesPage,
    contacts: VehicleContactsPage,
    statistics: VehicleStatisticsPage,
    contactSettings: VehicleContactSettingsPage
  };
  document.querySelector("#vehicle-dashboard-root").innerHTML = pages[page]();
  document.querySelector("[data-open-sidebar]")?.addEventListener("click", () => document.querySelector("#vehicle-sidebar").classList.toggle("is-open"));
  document.querySelector("[data-save-contact-settings]")?.addEventListener("click", () => {
    document.querySelector("#vehicle-contact-settings-message").hidden = false;
  });
}

renderDashboard();

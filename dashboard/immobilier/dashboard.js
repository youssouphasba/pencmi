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
  profile: "/dashboard/profil"
};

const dashboardStats = null;
const listingPerformanceStats = [];
const recentMessages = [];
const recentContacts = [];
const recentVisitRequests = [];
const topListings = [];
const listingsToImprove = [];
let selectedPeriod = "30";

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
  ["Mon profil", routes.profile]
];

const kpiDefinitions = [
  ["Annonces actives", "activeListings", "AN"],
  ["Annonces en attente", "pendingListings", "AT"],
  ["Vues totales", "totalViews", "VU"],
  ["Clics détails", "detailClicks", "CD"],
  ["Favoris ajoutés", "favorites", "FA"],
  ["Messages reçus", "messages", "MS"],
  ["Contacts reçus", "contacts", "CO"],
  ["Demandes de visite", "visitRequests", "DV"],
  ["Clics WhatsApp", "whatsappClicks", "WA"],
  ["Clics téléphone", "phoneClicks", "TE"],
  ["Clics email", "emailClicks", "EM"],
  ["Taux vue → contact", "viewToContactRate", "TC", "percentage"],
  ["Délai moyen de réponse", "averageResponseTimeMinutes", "DR", "time"],
  ["Conversations non lues", "unreadConversations", "NL"]
];

function routeHref(path) {
  if (window.location.protocol !== "file:") {
    return path;
  }

  const depth = Number(document.body?.dataset?.routeDepth || "2");
  const prefix = "../".repeat(depth);

  if (path === "/immobilier") {
    return `${prefix}immobilier/`;
  }

  if (path.startsWith("/publier")) {
    return `${prefix}publier/?category=immobilier`;
  }

  if (path.includes("?")) {
    const [base, query] = path.split("?");
    return `${routeHref(base)}?${query}`;
  }

  if (path.startsWith("/dashboard/")) {
    return `${prefix}${path.replace(/^\//, "")}/`;
  }

  return path;
}

function formatMetric(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return Number(value).toLocaleString("fr-FR");
}

function formatPercentage(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return `${Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}%`;
}

function formatResponseTime(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (value < 60) {
    return `${value} min`;
  }

  return `${Math.round(value / 60)} h`;
}

function formatDate(value) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function calculateConversionRate(contacts, views) {
  if (!contacts || !views) {
    return 0;
  }

  return Math.round((contacts / views) * 1000) / 10;
}

function getStatusLabel(status) {
  const labels = {
    draft: "Brouillon",
    pending_review: "En attente de validation",
    active: "Active",
    suspended: "Suspendue",
    expired: "Expirée",
    deleted: "Supprimée",
    new: "Nouveau",
    read: "Lu",
    replied: "Répondu",
    archived: "Archivé",
    closed: "Clôturé",
    proposed: "Visite proposée",
    confirmed: "Confirmée",
    cancelled: "Annulée",
    completed: "Terminée",
    pending: "En attente",
    sent: "Envoyé",
    failed: "Échec"
  };

  return labels[status] || status || "";
}

function getListingRecommendations(listing) {
  if (!listing) {
    return [];
  }

  const recommendations = [];

  if (!listing.photoCount) recommendations.push("Ajouter plus de photos");
  if (!listing.hasDescription) recommendations.push("Compléter la description");
  if (!listing.district) recommendations.push("Ajouter le quartier");
  if (!listing.surface) recommendations.push("Renseigner la surface");
  if (!listing.hasConditions) recommendations.push("Ajouter les conditions");
  if (!listing.whatsappEnabled) recommendations.push("Activer WhatsApp");
  if (!listing.internalMessagingEnabled) recommendations.push("Activer la messagerie interne");
  if (!listing.emailNotificationsEnabled) recommendations.push("Activer les notifications email");
  if (listing.unreadMessages) recommendations.push("Répondre aux messages en attente");
  if (!listing.availableFrom) recommendations.push("Mettre à jour la disponibilité");
  if (!listing.priceChecked) recommendations.push("Vérifier le prix");
  if (!listing.hasDocuments) recommendations.push("Ajouter les documents disponibles");

  return recommendations;
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
    messages: recentMessages.length,
    contacts: recentContacts.length,
    visits: recentVisitRequests.length,
    listings: 0,
    stats: 0,
    contactSettings: 0,
    failedEmails: 0
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
  const bell = typeof NotificationBell === "function" ? NotificationBell() : `<a class="btn btn-ghost" href="../notifications/">Notifications <span class="notification-badge">0</span></a>`;
  return `
    <header class="dashboard-header">
      <div>
        <button class="btn btn-ghost dashboard-menu-toggle" type="button" data-open-sidebar>Menu</button>
        <h1>Dashboard immobilier</h1>
        <p>Gérez vos annonces, vos contacts et vos performances.</p>
      </div>
      <div>
        <div class="dashboard-header-actions">
          ${bell}
          <a class="btn btn-primary" href="${routeHref(routes.publish)}">Publier une annonce</a>
          <a class="btn btn-light" href="${routeHref(routes.realEstate)}">Voir le site</a>
        </div>
        <div class="dashboard-profile-actions">
          <a class="btn btn-ghost" href="${routes.profile}">Profil</a>
          <a class="btn btn-ghost" href="${routes.contactSettings}">Paramètres</a>
          <a class="btn btn-ghost" href="/logout">Déconnexion</a>
        </div>
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
  return `
    <section class="dashboard-section">
      <div class="dashboard-section-header">
        <h2>KPI principaux</h2>
      </div>
      <div class="kpi-grid">${kpiDefinitions.map(KpiCard).join("")}</div>
    </section>

    <section class="dashboard-section">
      <div class="dashboard-section-header">
        <h2>Performance récente</h2>
      </div>
      ${ListingPerformanceTable()}
      <div class="listing-performance-cards">${listingPerformanceStats.map(ListingPerformanceCard).join("") || EmptyDashboardState("Vous n’avez aucune annonce immobilière pour le moment.", "Publier ma première annonce", routes.publish)}</div>
    </section>

    <section class="dashboard-section">
      <div class="dashboard-grid">
        ${RecentMessagesList()}
        ${RecentContactsList()}
        ${RecentVisitRequestsList()}
        ${AdvertiserRecommendations()}
        ${TopListingsCard()}
        ${DashboardFavoritesOverview()}
      </div>
    </section>
  `;
}

function KpiCard([title, key, icon, format]) {
  const value = dashboardStats?.[key];
  const formattedValue = format === "percentage" ? formatPercentage(value) : format === "time" ? formatResponseTime(value) : formatMetric(value);

  return `
    <article class="kpi-card">
      <span class="kpi-icon">${icon}</span>
      <h3>${title}</h3>
      ${formattedValue ? `<div class="kpi-value">${formattedValue}</div>` : `<div class="kpi-empty">Aucune donnée disponible</div>`}
    </article>
  `;
}

function ListingPerformanceTable() {
  if (!listingPerformanceStats.length) {
    return `<div class="performance-table-wrap">${EmptyDashboardState("Vous n’avez aucune annonce immobilière pour le moment.", "Publier ma première annonce", routes.publish)}</div>`;
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
            <th>Vues</th>
            <th>Clics détails</th>
            <th>Favoris</th>
            <th>Messages</th>
            <th>Contacts</th>
            <th>Demandes de visite</th>
            <th>Taux de contact</th>
            <th>Score</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>${listingPerformanceStats.map((listing) => `
          <tr>
            <td>${listing.title}</td>
            <td>${ListingStatusBadge(listing.status)}</td>
            <td>${listing.city || ""}</td>
            <td>${listing.propertyType || ""}</td>
            <td>${formatMetric(listing.views)}</td>
            <td>${formatMetric(listing.detailClicks)}</td>
            <td>${formatMetric(listing.favorites)}</td>
            <td>${formatMetric(listing.messages)}</td>
            <td>${formatMetric(listing.contacts)}</td>
            <td>${formatMetric(listing.visitRequests)}</td>
            <td>${formatPercentage(listing.contactRate)}</td>
            <td>${ListingCompletionScore(listing.completionScore)}</td>
            <td>
              <a href="/immobilier/annonce/${listing.listingId}">Voir</a>
              <a href="/publier?category=immobilier&id=${listing.listingId}">Modifier</a>
              <button type="button">Désactiver</button>
              <a href="/dashboard/immobilier/statistiques?listing=${listing.listingId}">Statistiques</a>
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
      <h3>${listing.title}</h3>
      <p>${ListingStatusBadge(listing.status)} ${listing.city || ""}</p>
      <p>Vues : ${formatMetric(listing.views)} · Contacts : ${formatMetric(listing.contacts)}</p>
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

function AdvertiserRecommendations() {
  const recommendations = listingsToImprove.flatMap(getListingRecommendations);

  return `
    <section class="dashboard-card">
      <h3>Annonces à améliorer</h3>
      ${recommendations.length ? `<ul>${recommendations.map((item) => `<li>${item}</li>`).join("")}</ul>` : `<p class="dashboard-muted">Vos annonces sont bien complétées pour le moment.</p>`}
    </section>
  `;
}

function RecentMessagesList() {
  return `
    <section class="dashboard-card">
      <div class="dashboard-section-header">
        <h3>Messages récents</h3>
        <a href="${routes.messages}">Voir tout</a>
      </div>
      ${recentMessages.length ? recentMessages.map((message) => `
        <article>
          <strong>${message.clientName || "Client"}</strong>
          <p>${message.preview}</p>
          ${MessageStatusBadge(message.status)}
          ${EmailNotificationStatus(message.emailNotification)}
          <a class="btn btn-ghost" href="/dashboard/immobilier/messages/${message.conversationId}">Répondre</a>
        </article>
      `).join("") : EmptyDashboardState("Aucun message reçu pour le moment.")}
    </section>
  `;
}

function RecentContactsList() {
  return `
    <section class="dashboard-card">
      <div class="dashboard-section-header">
        <h3>Contacts récents</h3>
        <a href="${routes.contacts}">Voir tout</a>
      </div>
      ${recentContacts.length ? recentContacts.map((contact) => `
        <article>
          ${ContactSourceBadge(contact.source)}
          <p>${contact.listingTitle}</p>
          ${MessageStatusBadge(contact.status)}
        </article>
      `).join("") : EmptyDashboardState("Aucun contact reçu pour le moment.")}
    </section>
  `;
}

function RecentVisitRequestsList() {
  return `
    <section class="dashboard-card">
      <div class="dashboard-section-header">
        <h3>Demandes de visite</h3>
        <a href="${routes.visits}">Voir tout</a>
      </div>
      ${recentVisitRequests.length ? recentVisitRequests.map((visit) => `
        <article>
          <strong>${visit.clientName || "Client"}</strong>
          <p>${visit.listingTitle}</p>
          ${VisitStatusBadge(visit.status)}
          <div class="dashboard-mobile-actions">
            <button class="btn btn-ghost" type="button">Proposer un créneau</button>
            <button class="btn btn-ghost" type="button">Confirmer</button>
            <button class="btn btn-ghost" type="button">Annuler</button>
            <button class="btn btn-ghost" type="button">Répondre</button>
          </div>
        </article>
      `).join("") : EmptyDashboardState("Aucune demande de visite pour le moment.")}
    </section>
  `;
}

function TopListingsCard() {
  return `
    <section class="dashboard-card">
      <h3>Meilleures annonces</h3>
      ${topListings.length ? topListings.map((listing) => `<p>${listing.title}</p>`).join("") : EmptyDashboardState("Aucune statistique disponible pour le moment.")}
    </section>
  `;
}

function DashboardFavoritesOverview() {
  return `
    <section class="dashboard-card">
      <h3>Favoris reçus</h3>
      ${dashboardStats?.favorites ? `<p>${formatMetric(dashboardStats.favorites)} favoris ajoutés</p>` : EmptyDashboardState("Aucune annonce ajoutée en favori pour le moment.")}
    </section>
  `;
}

function EmptyDashboardState(text = "Aucune donnée disponible pour le moment.", actionLabel = "", actionHref = "") {
  return `
    <div class="empty-dashboard-state">
      <div>
        <strong>${text}</strong>
        ${actionLabel ? `<p><a class="btn btn-primary" href="${routeHref(actionHref)}">${actionLabel}</a></p>` : `<p>Aucune donnée disponible</p>`}
      </div>
    </div>
  `;
}

function EmailNotificationStatus(notification) {
  if (!notification) {
    return "";
  }

  return `<span class="status-badge">${getStatusLabel(notification.status)}</span>`;
}

function ContactSourceBadge(source) {
  const labels = {
    whatsapp: "WhatsApp",
    phone: "Téléphone",
    email: "Email",
    internal_message: "Message interne",
    form: "Formulaire",
    visit_request: "Demande de visite"
  };

  return `<span class="source-badge">${labels[source] || source}</span>`;
}

function ListingStatusBadge(status) {
  return `<span class="status-badge">${getStatusLabel(status)}</span>`;
}

function MessageStatusBadge(status) {
  return `<span class="status-badge">${getStatusLabel(status)}</span>`;
}

function VisitStatusBadge(status) {
  return `<span class="status-badge">${getStatusLabel(status)}</span>`;
}

function bindDashboardEvents() {
  document.querySelector("[data-open-sidebar]")?.addEventListener("click", () => {
    document.querySelector("#dashboard-sidebar").classList.toggle("is-open");
  });

  document.querySelector("[data-period-filter]")?.addEventListener("change", (event) => {
    selectedPeriod = event.currentTarget.value;
    RealEstateDashboardLayout();
  });
}

RealEstateDashboardLayout();

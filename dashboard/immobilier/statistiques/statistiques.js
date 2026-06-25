const routes = {
  dashboard: "/dashboard/immobilier",
  listings: "/dashboard/immobilier/annonces",
  messages: "/dashboard/immobilier/messages",
  contacts: "/dashboard/immobilier/contacts",
  visits: "/dashboard/immobilier/visites",
  favorites: "/dashboard/immobilier/favoris",
  stats: "/dashboard/immobilier/statistiques",
  contactSettings: "/dashboard/immobilier/contact-settings",
  profile: "/dashboard/profil"
};

const stats = null;

function routeHref(path) {
  if (window.location.protocol !== "file:") {
    return path;
  }
  if (path === routes.dashboard) return "../";
  if (path === routes.listings) return "../annonces/";
  if (path === routes.visits) return "../visites/";
  if (path === routes.favorites) return "../favoris/";
  if (path === routes.contactSettings) return "../contact-settings/";
  if (path === routes.stats) return "./";
  return path;
}

function DashboardSidebar() {
  const items = [["Vue d’ensemble", routes.dashboard], ["Mes annonces", routes.listings], ["Messages", routes.messages, "0"], ["Contacts", routes.contacts, "0"], ["Demandes de visite", routes.visits, "0"], ["Favoris reçus", routes.favorites], ["Statistiques", routes.stats], ["Moyens de contact", routes.contactSettings], ["Mon profil", routes.profile]];
  return `<aside class="dashboard-sidebar" id="dashboard-sidebar"><div class="dashboard-brand"><span>P</span><div><strong>Péncmi</strong><small>Annonceur immobilier</small></div></div><nav class="dashboard-nav">${items.map(([label, href, badge]) => `<a href="${routeHref(href)}"${href === routes.stats ? ' aria-current="page"' : ""}><span>${label}</span>${badge ? `<span class="notification-badge">${badge}</span>` : ""}</a>`).join("")}</nav></aside>`;
}

function KpiCard(title, key) {
  return `<article class="kpi-card"><span class="kpi-icon">ST</span><h3>${title}</h3>${stats?.[key] ? `<div class="kpi-value">${stats[key]}</div>` : `<div class="kpi-empty">Aucune donnée disponible</div>`}</article>`;
}

function StatisticsPage() {
  document.querySelector("#statistics-page").innerHTML = `
    <div class="dashboard-shell">
      ${DashboardSidebar()}
      <main class="dashboard-main">
        <header class="dashboard-header"><div><button class="btn btn-ghost dashboard-menu-toggle" type="button" data-open-sidebar>Menu</button><h1>Statistiques</h1><p>Analysez les vues, contacts, favoris et performances de vos annonces.</p></div></header>
        <section class="stats-filters">
          <select><option>Aujourd’hui</option><option>7 jours</option><option>30 jours</option><option>90 jours</option></select>
          <input placeholder="Annonce">
          <input placeholder="Ville">
          <select><option>Type de bien</option></select>
          <select><option>Transaction</option><option>Location</option><option>Vente</option><option>Achat</option></select>
        </section>
        <section class="kpi-grid">
          ${KpiCard("Vues totales", "totalViews")}
          ${KpiCard("Clics détails", "detailClicks")}
          ${KpiCard("Contacts", "contacts")}
          ${KpiCard("Messages", "messages")}
          ${KpiCard("Demandes de visite", "visitRequests")}
          ${KpiCard("Favoris", "favorites")}
          ${KpiCard("Clics WhatsApp", "whatsappClicks")}
          ${KpiCard("Clics téléphone", "phoneClicks")}
          ${KpiCard("Clics email", "emailClicks")}
          ${KpiCard("Taux vue → contact", "viewToContactRate")}
          ${KpiCard("Taux détail → contact", "detailToContactRate")}
          ${KpiCard("Délai moyen de réponse", "averageResponseTimeMinutes")}
        </section>
        ${EmptyState()}
        <section class="charts-grid">
          ${ChartCard("Évolution des vues")}
          ${ChartCard("Évolution des contacts")}
          ${ChartCard("Répartition des sources de contact")}
          ${ChartCard("Meilleures annonces")}
          ${ChartCard("Annonces sans contact")}
          ${ChartCard("Annonces à améliorer")}
          ${ChartCard("Performance par annonce")}
        </section>
      </main>
    </div>
  `;
  document.querySelector("[data-open-sidebar]")?.addEventListener("click", () => document.querySelector("#dashboard-sidebar").classList.toggle("is-open"));
}

function ChartCard(title) {
  return `<article class="chart-card"><h2>${title}</h2><div class="chart-placeholder">Bloc graphique prévu</div></article>`;
}

function EmptyState() {
  return `<section class="empty-stats"><h2>Aucune statistique disponible pour le moment.</h2><p>Les statistiques apparaîtront lorsque vos annonces recevront des vues ou des contacts.</p></section>`;
}

StatisticsPage();

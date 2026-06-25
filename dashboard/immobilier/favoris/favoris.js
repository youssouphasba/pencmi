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

const favoriteRows = [];
const favoriteStats = null;

function routeHref(path) {
  if (window.location.protocol !== "file:") {
    return path;
  }
  if (path === routes.dashboard) return "../";
  if (path === routes.listings) return "../annonces/";
  if (path === routes.visits) return "../visites/";
  if (path === routes.stats) return "../statistiques/";
  if (path === routes.contactSettings) return "../contact-settings/";
  if (path === routes.favorites) return "./";
  return path;
}

function DashboardSidebar() {
  const items = [
    ["Vue d’ensemble", routes.dashboard],
    ["Mes annonces", routes.listings],
    ["Messages", routes.messages, "0"],
    ["Contacts", routes.contacts, "0"],
    ["Demandes de visite", routes.visits, "0"],
    ["Favoris reçus", routes.favorites],
    ["Statistiques", routes.stats],
    ["Moyens de contact", routes.contactSettings],
    ["Mon profil", routes.profile]
  ];
  return `<aside class="dashboard-sidebar" id="dashboard-sidebar"><div class="dashboard-brand"><span>P</span><div><strong>Péncmi</strong><small>Annonceur immobilier</small></div></div><nav class="dashboard-nav">${items.map(([label, href, badge]) => `<a href="${routeHref(href)}"${href === routes.favorites ? ' aria-current="page"' : ""}><span>${label}</span>${badge ? `<span class="notification-badge">${badge}</span>` : ""}</a>`).join("")}</nav></aside>`;
}

function KpiCard(title, value) {
  return `<article class="kpi-card"><span class="kpi-icon">FA</span><h3>${title}</h3>${value ? `<div class="kpi-value">${value}</div>` : `<div class="kpi-empty">Aucune donnée disponible</div>`}</article>`;
}

function FavoriteStatsPage() {
  document.querySelector("#favorite-stats-page").innerHTML = `
    <div class="dashboard-shell">
      ${DashboardSidebar()}
      <main class="dashboard-main">
        <header class="dashboard-header"><div><button class="btn btn-ghost dashboard-menu-toggle" type="button" data-open-sidebar>Menu</button><h1>Favoris reçus</h1><p>Suivez les annonces sauvegardées par les clients.</p></div></header>
        <section class="kpi-grid">
          ${KpiCard("Total favoris", favoriteStats?.total)}
          ${KpiCard("Annonces favorites", favoriteStats?.listings)}
          ${KpiCard("Évolution 7 jours", favoriteStats?.last7)}
          ${KpiCard("Évolution 30 jours", favoriteStats?.last30)}
        </section>
        <section class="filter-card">
          <select><option>Période</option></select>
          <input placeholder="Annonce">
          <input placeholder="Ville">
          <select><option>Type de bien</option></select>
        </section>
        ${favoriteRows.length ? FavoriteTable() : EmptyState()}
      </main>
    </div>
  `;
  document.querySelector("[data-open-sidebar]")?.addEventListener("click", () => document.querySelector("#dashboard-sidebar").classList.toggle("is-open"));
}

function FavoriteTable() {
  return `<section class="favorite-table"><table><thead><tr><th>Annonce</th><th>Ville</th><th>Type</th><th>Transaction</th><th>Favoris</th><th>Évolution</th><th>Vues</th><th>Contacts</th><th>Taux favoris → contact</th><th>Actions</th></tr></thead><tbody></tbody></table></section>`;
}

function EmptyState() {
  return `<section class="empty-card"><div><h2>Aucune annonce ajoutée en favori pour le moment.</h2><p>Les favoris apparaîtront ici dès que vos annonces seront sauvegardées par des clients.</p><a class="btn btn-primary" href="${routeHref(routes.listings)}">Voir mes annonces</a></div></section>`;
}

FavoriteStatsPage();

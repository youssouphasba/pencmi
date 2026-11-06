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
    ["Messages", routes.messages],
    ["Contacts", routes.contacts],
    ["Demandes de visite", routes.visits],
    ["Favoris reçus", routes.favorites],
    ["Statistiques", routes.stats],
    ["Moyens de contact", routes.contactSettings],
    ["Mon profil", routes.profile]
  ];
  return `<aside class="dashboard-sidebar" id="dashboard-sidebar"><div class="dashboard-brand"><span>P</span><div><strong>Péncmi</strong><small>Annonceur immobilier</small></div></div><nav class="dashboard-nav">${items.map(([label, href, badge]) => `<a href="${routeHref(href)}"${href === routes.favorites ? ' aria-current="page"' : ""}><span>${label}</span>${badge ? `<span class="notification-badge">${badge}</span>` : ""}</a>`).join("")}</nav></aside>`;
}

function FavoriteStatsPage() {
  document.querySelector("#favorite-stats-page").innerHTML = `
    <div class="dashboard-shell">
      ${DashboardSidebar()}
      <main class="dashboard-main">
        <header class="dashboard-header"><div><button class="btn btn-ghost dashboard-menu-toggle" type="button" data-open-sidebar>Menu</button><h1>Favoris reçus</h1><p>Suivez les annonces sauvegardées par les clients.</p></div></header>
        <section class="empty-card"><div><h2>Donnée indisponible</h2><p>Les favoris ne sont pas encore enregistrés sur le serveur : aucun chiffre ne peut être affiché pour le moment.</p></div></section>
      </main>
    </div>
  `;
  document.querySelector("[data-open-sidebar]")?.addEventListener("click", () => document.querySelector("#dashboard-sidebar").classList.toggle("is-open"));
}

FavoriteStatsPage();

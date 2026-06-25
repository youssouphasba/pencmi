const routes = {
  home: "/",
  realEstate: "/immobilier",
  alerts: "/immobilier/alertes",
  login: "/login?next=/favoris/immobilier"
};

const isAuthenticated = true;
const favoriteListings = [];

function routeHref(path) {
  if (window.location.protocol !== "file:") {
    return path;
  }
  if (path === routes.home) return "../../index.html";
  if (path === routes.realEstate) return "../../immobilier/";
  if (path === routes.alerts) return "../../immobilier/alertes/";
  return path;
}

function ClientHeader() {
  document.querySelector("#client-favorites-header").innerHTML = `
    <a class="brand" href="${routeHref(routes.home)}" aria-label="Accueil Péncmi">
      <span class="brand-mark">P</span>
      <span><strong>Péncmi</strong><small>Favoris immobiliers</small></span>
    </a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="main-menu" aria-label="Ouvrir le menu">
      <span></span><span></span><span></span>
    </button>
    <div class="header-panel" id="main-menu">
      <nav class="main-nav" aria-label="Navigation principale">
        <a href="${routeHref(routes.realEstate)}">Immobilier</a>
        <a href="${routeHref(routes.alerts)}">Alertes</a>
      </nav>
      <div class="header-actions">
        <a class="btn btn-ghost" href="${routes.login}">Connexion</a>
      </div>
    </div>
  `;

  const toggle = document.querySelector(".menu-toggle");
  const panel = document.querySelector(".header-panel");
  toggle.addEventListener("click", () => {
    const isOpen = panel.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
}

function EmptyState() {
  return `
    <section class="client-empty-card">
      <div>
        <h2>Vous n’avez encore ajouté aucune annonce immobilière en favori.</h2>
        <p>Ajoutez des annonces en favori pour les retrouver facilement plus tard.</p>
        <a class="btn btn-primary" href="${routeHref(routes.realEstate)}">Voir les annonces immobilières</a>
      </div>
    </section>
  `;
}

function FavoritesTable() {
  return `
    <section class="client-list-card">
      <table>
        <thead>
          <tr><th>Annonce</th><th>Ville</th><th>Type</th><th>Transaction</th><th>Prix</th><th>Actions</th></tr>
        </thead>
        <tbody></tbody>
      </table>
    </section>
  `;
}

function ClientFavoritesPage() {
  if (!isAuthenticated) {
    window.location.href = routes.login;
    return;
  }

  document.querySelector("#client-favorites-page").innerHTML = `
    <section class="client-page-head">
      <h1>Mes favoris immobiliers</h1>
      <p>Retrouvez les biens que vous avez sauvegardés.</p>
    </section>
    <section class="client-filter-card" aria-label="Filtres favoris immobiliers">
      <input type="search" placeholder="Ville">
      <select><option>Type de bien</option></select>
      <select><option>Transaction</option><option>Location</option><option>Vente</option><option>Achat</option></select>
      <input type="search" placeholder="Prix">
    </section>
    ${favoriteListings.length ? FavoritesTable() : EmptyState()}
  `;
}

ClientHeader();
ClientFavoritesPage();

const routes = {
  home: "/",
  realEstate: "/immobilier",
  alerts: "/immobilier/alertes",
  login: "/login?next=/favoris/immobilier"
};


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

function ClientFavoritesPage() {
  const root = document.querySelector("#client-favorites-page");
  void import("../../saved/favorites-page.mjs").then(({ mountFavorites }) => mountFavorites(root, { module: "real_estate", title: "Mes favoris immobiliers", browseHref: routeHref(routes.realEstate) }), () => { root.textContent = "Chargement impossible. Rechargez la page."; });
}

ClientHeader();
ClientFavoritesPage();

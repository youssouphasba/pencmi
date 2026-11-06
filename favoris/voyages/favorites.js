const routes = {
  home: "/",
  trips: "/voyages",
  login: "/login?next=/favoris/voyages"
};


function routeHref(path) {
  if (window.location.protocol !== "file:") {
    return path;
  }
  if (path === routes.home) return "../../index.html";
  if (path === routes.trips) return "../../voyages/";
  return path;
}

function Header() {
  document.querySelector("#trip-favorites-header").innerHTML = `<a class="brand" href="${routeHref(routes.home)}"><span class="brand-mark">P</span><span><strong>Péncmi</strong><small>Favoris voyages</small></span></a><div class="header-actions"><a class="btn btn-ghost" href="${routes.login}">Connexion</a></div>`;
}

function TripFavoritesPage() {
  const root = document.querySelector("#trip-favorites-page");
  void import("../../saved/favorites-page.mjs").then(({ mountFavorites }) => mountFavorites(root, { module: "trips", title: "Mes trajets favoris", browseHref: routeHref(routes.trips) }), () => { root.textContent = "Chargement impossible. Rechargez la page."; });
}

Header();
TripFavoritesPage();

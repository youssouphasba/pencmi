const routes = {
  home: "/",
  vehicles: "/voitures",
  login: "/login?next=/favoris/voitures"
};


function routeHref(path) {
  if (window.location.protocol !== "file:") {
    return path;
  }
  if (path === routes.home) return "../../index.html";
  if (path === routes.vehicles) return "../../voitures/";
  return path;
}

function Header() {
  document.querySelector("#vehicle-favorites-header").innerHTML = `<a class="brand" href="${routeHref(routes.home)}"><span class="brand-mark">P</span><span><strong>Péncmi</strong><small>Favoris voitures</small></span></a><div class="header-actions"><a class="btn btn-ghost" href="${routes.login}">Connexion</a></div>`;
}

function VehicleFavoritesPage() {
  const root = document.querySelector("#vehicle-favorites-page");
  void import("../../saved/favorites-page.mjs").then(({ mountFavorites }) => mountFavorites(root, { module: "vehicles", title: "Mes voitures favorites", browseHref: routeHref(routes.vehicles) }), () => { root.textContent = "Chargement impossible. Rechargez la page."; });
}

Header();
VehicleFavoritesPage();

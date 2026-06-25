const routes = {
  home: "/",
  vehicles: "/voitures",
  login: "/login?next=/favoris/voitures"
};

const isAuthenticated = true;
const favoriteVehicles = [];

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

function EmptyState() {
  return `<section class="vehicle-empty"><div><h1>Mes voitures favorites</h1><h2>Vous n’avez encore ajouté aucune voiture en favori.</h2><div class="vehicle-empty-actions"><a class="btn btn-primary" href="${routeHref(routes.vehicles)}">Voir les voitures</a></div></div></section>`;
}

function VehicleFavoritesPage() {
  if (!isAuthenticated) {
    window.location.href = routes.login;
    return;
  }
  document.querySelector("#vehicle-favorites-page").innerHTML = favoriteVehicles.length ? `<section class="vehicle-list"></section>` : EmptyState();
}

Header();
VehicleFavoritesPage();

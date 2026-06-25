const routes = {
  home: "/",
  trips: "/voyages",
  login: "/login?next=/favoris/voyages"
};

const isAuthenticated = true;
const favoriteTrips = [];

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

function EmptyState() {
  return `<section class="trip-empty"><div><h1>Mes trajets favoris</h1><h2>Vous n’avez encore ajouté aucun trajet en favori.</h2><div class="trip-empty-actions"><a class="btn btn-primary" href="${routeHref(routes.trips)}">Voir les trajets</a></div></div></section>`;
}

function TripFavoritesPage() {
  if (!isAuthenticated) {
    window.location.href = routes.login;
    return;
  }
  document.querySelector("#trip-favorites-page").innerHTML = favoriteTrips.length ? `<section class="trip-list"></section>` : EmptyState();
}

Header();
TripFavoritesPage();

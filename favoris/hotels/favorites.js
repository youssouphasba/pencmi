const routes = {
  home: "/",
  hotels: "/hotels",
  login: "/login?next=/favoris/hotels"
};

const isAuthenticated = true;
const favoriteHotels = [];

function routeHref(path) {
  if (window.location.protocol !== "file:") {
    return path;
  }
  if (path === routes.home) return "../../index.html";
  if (path === routes.hotels) return "../../hotels/";
  return path;
}

function Header() {
  document.querySelector("#hotel-favorites-header").innerHTML = `
    <a class="brand" href="${routeHref(routes.home)}"><span class="brand-mark">P</span><span><strong>Péncmi</strong><small>Favoris hôtels</small></span></a>
    <div class="header-actions"><a class="btn btn-ghost" href="${routes.login}">Connexion</a></div>
  `;
}

function EmptyState() {
  return `<section class="hotel-empty"><div><h1>Vous n’avez encore ajouté aucun hébergement en favori.</h1><p>Ajoutez des hébergements en favori pour les retrouver plus tard.</p><div class="hotel-empty-actions"><a class="btn btn-primary" href="${routeHref(routes.hotels)}">Voir les hébergements</a></div></div></section>`;
}

function ClientHotelFavoritesPage() {
  if (!isAuthenticated) {
    window.location.href = routes.login;
    return;
  }
  document.querySelector("#hotel-favorites-page").innerHTML = favoriteHotels.length ? `<section class="hotel-list"></section>` : EmptyState();
}

Header();
ClientHotelFavoritesPage();

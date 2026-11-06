const routes = {
  home: "/",
  hotels: "/hotels",
  login: "/login?next=/favoris/hotels"
};


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

function ClientHotelFavoritesPage() {
  const root = document.querySelector("#hotel-favorites-page");
  void import("../../saved/favorites-page.mjs").then(({ mountFavorites }) => mountFavorites(root, { module: "hotels", title: "Mes hébergements favoris", browseHref: routeHref(routes.hotels) }), () => { root.textContent = "Chargement impossible. Rechargez la page."; });
}

Header();
ClientHotelFavoritesPage();

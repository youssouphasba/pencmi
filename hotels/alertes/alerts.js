const routes = {
  home: "/",
  hotels: "/hotels",
  login: "/login?next=/hotels/alertes"
};


function routeHref(path) {
  if (window.location.protocol !== "file:") {
    return path;
  }
  if (path === routes.home) return "../../index.html";
  if (path === routes.hotels) return "../";
  return path;
}

function Header() {
  document.querySelector("#hotel-alerts-header").innerHTML = `
    <a class="brand" href="${routeHref(routes.home)}"><span class="brand-mark">P</span><span><strong>Péncmi</strong><small>Alertes hôtels</small></span></a>
    <div class="header-actions"><a class="btn btn-ghost" href="${routes.login}">Connexion</a></div>
  `;
}

function HotelAlertsPage() {
  const root = document.querySelector("#hotel-alerts-page");
  void import("../../saved/alerts-page.mjs").then(({ mountAlerts }) => mountAlerts(root, { module: "hotels", title: "Mes alertes hôtels" }), () => { root.textContent = "Chargement impossible. Rechargez la page."; });
}

Header();
HotelAlertsPage();

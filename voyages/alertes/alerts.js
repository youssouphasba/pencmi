const routes = {
  home: "/",
  trips: "/voyages",
  login: "/login?next=/voyages/alertes"
};


function routeHref(path) {
  if (window.location.protocol !== "file:") {
    return path;
  }
  if (path === routes.home) return "../../index.html";
  if (path === routes.trips) return "../";
  return path;
}

function Header() {
  document.querySelector("#trip-alerts-header").innerHTML = `<a class="brand" href="${routeHref(routes.home)}"><span class="brand-mark">P</span><span><strong>Péncmi</strong><small>Alertes trajets</small></span></a><div class="header-actions"><a class="btn btn-ghost" href="${routes.login}">Connexion</a></div>`;
}

function TripAlertsPage() {
  const root = document.querySelector("#trip-alerts-page");
  void import("../../saved/alerts-page.mjs").then(({ mountAlerts }) => mountAlerts(root, { module: "trips", title: "Mes alertes voyages" }), () => { root.textContent = "Chargement impossible. Rechargez la page."; });
}

Header();
TripAlertsPage();

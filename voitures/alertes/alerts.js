const routes = {
  home: "/",
  vehicles: "/voitures",
  login: "/login?next=/voitures/alertes"
};


function routeHref(path) {
  if (window.location.protocol !== "file:") {
    return path;
  }
  if (path === routes.home) return "../../index.html";
  if (path === routes.vehicles) return "../";
  return path;
}

function Header() {
  document.querySelector("#vehicle-alerts-header").innerHTML = `<a class="brand" href="${routeHref(routes.home)}"><span class="brand-mark">P</span><span><strong>Péncmi</strong><small>Alertes voitures</small></span></a><div class="header-actions"><a class="btn btn-ghost" href="${routes.login}">Connexion</a></div>`;
}

function VehicleAlertsPage() {
  const root = document.querySelector("#vehicle-alerts-page");
  void import("../../saved/alerts-page.mjs").then(({ mountAlerts }) => mountAlerts(root, { module: "vehicles", title: "Mes alertes voitures" }), () => { root.textContent = "Chargement impossible. Rechargez la page."; });
}

Header();
VehicleAlertsPage();

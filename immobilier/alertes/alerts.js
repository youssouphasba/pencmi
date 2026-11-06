const routes = {
  home: "/",
  realEstate: "/immobilier",
  favorites: "/favoris/immobilier",
  login: "/login?next=/immobilier/alertes"
};


function routeHref(path) {
  if (window.location.protocol !== "file:") {
    return path;
  }
  if (path === routes.home) return "../../index.html";
  if (path === routes.realEstate) return "../";
  if (path === routes.favorites) return "../../favoris/immobilier/";
  return path;
}

function AlertsHeader() {
  document.querySelector("#alerts-header").innerHTML = `
    <a class="brand" href="${routeHref(routes.home)}" aria-label="Accueil Péncmi">
      <span class="brand-mark">P</span>
      <span><strong>Péncmi</strong><small>Alertes immobilières</small></span>
    </a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="main-menu" aria-label="Ouvrir le menu">
      <span></span><span></span><span></span>
    </button>
    <div class="header-panel" id="main-menu">
      <nav class="main-nav" aria-label="Navigation principale">
        <a href="${routeHref(routes.realEstate)}">Immobilier</a>
        <a href="${routeHref(routes.favorites)}">Favoris</a>
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

function SavedSearchAlertsPage() {
  const root = document.querySelector("#alerts-page");
  void import("../../saved/alerts-page.mjs").then(({ mountAlerts }) => mountAlerts(root, { module: "real_estate", title: "Mes alertes immobilières" }), () => { root.textContent = "Chargement impossible. Rechargez la page."; });
}

AlertsHeader();
SavedSearchAlertsPage();

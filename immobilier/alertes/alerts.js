const routes = {
  home: "/",
  realEstate: "/immobilier",
  favorites: "/favoris/immobilier",
  login: "/login?next=/immobilier/alertes"
};

const isAuthenticated = true;
const savedSearchAlerts = [];

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

function EmptyState() {
  return `
    <section class="alerts-empty">
      <div>
        <h2>Vous n’avez aucune alerte immobilière pour le moment.</h2>
        <p>Créez une alerte pour être informé lorsqu’une annonce correspond à vos critères.</p>
        <button class="btn btn-primary" type="button" data-open-alert-modal>Créer une alerte</button>
      </div>
    </section>
  `;
}

function AlertsTable() {
  return `
    <section class="alerts-list">
      <table>
        <thead>
          <tr><th>Alerte</th><th>Transaction</th><th>Type</th><th>Localisation</th><th>Budget</th><th>Fréquence</th><th>Statut</th><th>Actions</th></tr>
        </thead>
        <tbody></tbody>
      </table>
    </section>
  `;
}

function CreateAlertModal() {
  return `
    <div class="modal-backdrop" id="create-alert-modal" aria-hidden="true">
      <section class="alert-form-card" role="dialog" aria-modal="true" aria-labelledby="create-alert-title">
        <h2 id="create-alert-title">Créer une alerte</h2>
        <form class="alert-form-grid">
          <label>Nom de l’alerte<input type="text" placeholder="Exemple : Appartement à Dakar"></label>
          <label>Transaction<select><option>Location</option><option>Vente</option><option>Achat</option></select></label>
          <label>Type de bien<select><option>Appartement</option><option>Maison</option><option>Villa</option><option>Terrain</option><option>Studio</option></select></label>
          <label>Localisation<input type="text" placeholder="Ville, quartier ou région"></label>
          <label>Budget maximum<input type="number" min="0" placeholder="FCFA"></label>
          <label>Surface minimum<input type="number" min="0" placeholder="m²"></label>
          <label>Fréquence<select><option>Immédiatement</option><option>Chaque jour</option><option>Chaque semaine</option></select></label>
          <label>Statut<select><option>Activée</option><option>Désactivée</option></select></label>
        </form>
        <div class="alert-form-actions">
          <button class="btn btn-ghost" type="button" data-close-alert-modal>Annuler</button>
          <button class="btn btn-primary" type="button">Créer l’alerte</button>
        </div>
      </section>
    </div>
  `;
}

function SavedSearchAlertsPage() {
  if (!isAuthenticated) {
    window.location.href = routes.login;
    return;
  }

  document.querySelector("#alerts-page").innerHTML = `
    <section class="alerts-head">
      <div>
        <h1>Mes alertes immobilières</h1>
        <p>Recevez une alerte lorsqu’une annonce correspond à vos critères.</p>
      </div>
      <button class="btn btn-primary" type="button" data-open-alert-modal>Créer une alerte</button>
    </section>
    ${savedSearchAlerts.length ? AlertsTable() : EmptyState()}
    ${CreateAlertModal()}
  `;

  bindAlertModal();
}

function bindAlertModal() {
  const modal = document.querySelector("#create-alert-modal");
  document.querySelectorAll("[data-open-alert-modal]").forEach((button) => {
    button.addEventListener("click", () => {
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
    });
  });
  document.querySelector("[data-close-alert-modal]")?.addEventListener("click", () => {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  });
}

AlertsHeader();
SavedSearchAlertsPage();

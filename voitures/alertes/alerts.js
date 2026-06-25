const routes = {
  home: "/",
  vehicles: "/voitures",
  login: "/login?next=/voitures/alertes"
};

const isAuthenticated = true;
const vehicleAlerts = [];

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

function CreateAlertModal() {
  return `
    <div class="modal-backdrop" id="vehicle-alert-modal" aria-hidden="true">
      <section class="vehicle-modal-card" role="dialog" aria-modal="true" aria-labelledby="vehicle-alert-title">
        <h2 id="vehicle-alert-title">Créer une alerte voiture</h2>
        <div class="vehicle-form-grid">
          <label class="vehicle-form-field"><span>Type d’annonce</span><select><option>Vente</option><option>Location</option><option>Avec chauffeur</option></select></label>
          <label class="vehicle-form-field"><span>Marque</span><input type="text"></label>
          <label class="vehicle-form-field"><span>Modèle</span><input type="text"></label>
          <label class="vehicle-form-field"><span>Ville</span><input type="text"></label>
          <label class="vehicle-form-field"><span>Budget maximum</span><input type="number" min="0"></label>
          <label class="vehicle-form-field"><span>Année minimum</span><input type="number" min="1900"></label>
          <label class="vehicle-form-field"><span>Kilométrage maximum</span><input type="number" min="0"></label>
          <label class="vehicle-form-field"><span>Carburant</span><select><option>Essence</option><option>Diesel</option><option>Hybride</option><option>Électrique</option><option>GPL</option></select></label>
          <label class="vehicle-form-field"><span>Boîte de vitesse</span><select><option>Manuelle</option><option>Automatique</option></select></label>
        </div>
        <div class="vehicle-form-actions"><button class="btn btn-ghost" type="button" data-close-modal>Annuler</button><button class="btn btn-primary" type="button">Créer une alerte</button></div>
      </section>
    </div>
  `;
}

function EmptyState() {
  return `<section class="vehicle-empty"><div><h1>Vous n’avez aucune alerte voiture pour le moment.</h1><p>Sauvegardez une recherche pour recevoir une alerte selon vos critères.</p><div class="vehicle-empty-actions"><button class="btn btn-primary" type="button" data-open-modal>Créer une alerte</button><a class="btn btn-ghost" href="${routeHref(routes.vehicles)}">Voir les voitures</a></div></div></section>`;
}

function VehicleAlertsPage() {
  if (!isAuthenticated) {
    window.location.href = routes.login;
    return;
  }
  document.querySelector("#vehicle-alerts-page").innerHTML = `${vehicleAlerts.length ? `<section class="vehicle-list"></section>` : EmptyState()}${CreateAlertModal()}`;
  document.querySelector("[data-open-modal]")?.addEventListener("click", () => document.querySelector("#vehicle-alert-modal").classList.add("is-open"));
  document.querySelector("[data-close-modal]")?.addEventListener("click", () => document.querySelector("#vehicle-alert-modal").classList.remove("is-open"));
}

Header();
VehicleAlertsPage();

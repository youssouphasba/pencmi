const routes = {
  home: "/",
  trips: "/voyages",
  login: "/login?next=/voyages/alertes"
};

const isAuthenticated = true;
const tripAlerts = [];

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

function CreateAlertModal() {
  return `
    <div class="modal-backdrop" id="trip-alert-modal" aria-hidden="true">
      <section class="trip-modal-card" role="dialog" aria-modal="true" aria-labelledby="trip-alert-title">
        <h2 id="trip-alert-title">Créer une alerte trajet</h2>
        <div class="trip-form-grid">
          <label class="trip-form-field"><span>Ville de départ</span><input type="text"></label>
          <label class="trip-form-field"><span>Ville d’arrivée</span><input type="text"></label>
          <label class="trip-form-field"><span>Date</span><input type="date"></label>
          <label class="trip-form-field"><span>Nombre de passagers</span><input type="number" min="1" value="1"></label>
          <label class="trip-form-field"><span>Budget maximum</span><input type="number" min="0"></label>
          <label class="trip-form-field"><span>Type de véhicule</span><select><option>Bus</option><option>Car</option><option>Minibus</option><option>7 places</option><option>Covoiturage</option></select></label>
          <label class="trip-form-field"><span>Heure souhaitée</span><select><option>Matin</option><option>Après-midi</option><option>Soir</option><option>Nuit</option></select></label>
        </div>
        <div class="trip-form-actions"><button class="btn btn-ghost" type="button" data-close-modal>Annuler</button><button class="btn btn-primary" type="button">Créer une alerte</button></div>
      </section>
    </div>
  `;
}

function EmptyState() {
  return `<section class="trip-empty"><div><h1>Vous n’avez aucune alerte trajet pour le moment.</h1><p>Sauvegardez une recherche pour être informé dès qu’un trajet correspond à vos critères.</p><div class="trip-empty-actions"><button class="btn btn-primary" type="button" data-open-modal>Créer une alerte</button><a class="btn btn-ghost" href="${routeHref(routes.trips)}">Voir les trajets</a></div></div></section>`;
}

function TripAlertsPage() {
  if (!isAuthenticated) {
    window.location.href = routes.login;
    return;
  }
  document.querySelector("#trip-alerts-page").innerHTML = `${tripAlerts.length ? `<section class="trip-list"></section>` : EmptyState()}${CreateAlertModal()}`;
  document.querySelector("[data-open-modal]")?.addEventListener("click", () => document.querySelector("#trip-alert-modal").classList.add("is-open"));
  document.querySelector("[data-close-modal]")?.addEventListener("click", () => document.querySelector("#trip-alert-modal").classList.remove("is-open"));
}

Header();
TripAlertsPage();

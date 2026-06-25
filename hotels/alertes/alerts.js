const routes = {
  home: "/",
  hotels: "/hotels",
  login: "/login?next=/hotels/alertes"
};

const isAuthenticated = true;
const hotelAlerts = [];

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

function CreateAlertModal() {
  return `
    <div class="modal-backdrop" id="hotel-alert-modal" aria-hidden="true">
      <section class="hotel-modal-card" role="dialog" aria-modal="true" aria-labelledby="alert-title">
        <h2 id="alert-title">Créer une alerte hôtel</h2>
        <div class="hotel-form-grid">
          <label class="hotel-form-field"><span>Nom de l’alerte</span><input type="text"></label>
          <label class="hotel-form-field"><span>Destination</span><input type="text"></label>
          <label class="hotel-form-field"><span>Date d’arrivée</span><input type="date"></label>
          <label class="hotel-form-field"><span>Date de départ</span><input type="date"></label>
          <label class="hotel-form-field"><span>Budget maximum</span><input type="number" min="0"></label>
          <label class="hotel-form-field"><span>Type d’hébergement</span><select><option>Hôtel</option><option>Auberge</option><option>Résidence</option><option>Appartement meublé</option></select></label>
        </div>
        <div class="hotel-form-actions"><button class="btn btn-ghost" type="button" data-close-modal>Annuler</button><button class="btn btn-primary" type="button">Créer une alerte</button></div>
      </section>
    </div>
  `;
}

function EmptyState() {
  return `<section class="hotel-empty"><div><h1>Vous n’avez aucune alerte hôtel pour le moment.</h1><p>Créez une alerte par destination, dates, budget ou type d’hébergement.</p><div class="hotel-empty-actions"><button class="btn btn-primary" type="button" data-open-modal>Créer une alerte</button><a class="btn btn-ghost" href="${routeHref(routes.hotels)}">Voir les hébergements</a></div></div></section>`;
}

function HotelAlertsPage() {
  if (!isAuthenticated) {
    window.location.href = routes.login;
    return;
  }
  document.querySelector("#hotel-alerts-page").innerHTML = `${hotelAlerts.length ? `<section class="hotel-list"></section>` : EmptyState()}${CreateAlertModal()}`;
  document.querySelector("[data-open-modal]")?.addEventListener("click", () => document.querySelector("#hotel-alert-modal").classList.add("is-open"));
  document.querySelector("[data-close-modal]")?.addEventListener("click", () => document.querySelector("#hotel-alert-modal").classList.remove("is-open"));
}

Header();
HotelAlertsPage();

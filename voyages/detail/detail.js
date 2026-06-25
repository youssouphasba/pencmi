const routes = {
  home: "/",
  trips: "/voyages",
  alerts: "/voyages/alertes",
  login: "/login"
};

const tripDetail = null;

function routeHref(path) {
  if (window.location.protocol !== "file:") {
    return path;
  }
  if (path === routes.home) return "../../index.html";
  if (path === routes.trips) return "../";
  if (path === routes.alerts) return "../alertes/";
  return path;
}

function Header() {
  document.querySelector("#trip-detail-header").innerHTML = `
    <a class="brand" href="${routeHref(routes.home)}"><span class="brand-mark">P</span><span><strong>Péncmi</strong><small>Détail trajet</small></span></a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="main-menu" aria-label="Ouvrir le menu"><span></span><span></span><span></span></button>
    <div class="header-panel" id="main-menu"><nav class="main-nav"><a href="${routeHref(routes.trips)}">Voyages</a><a href="${routeHref(routes.alerts)}">Alertes</a></nav><div class="header-actions"><a class="btn btn-ghost" href="${routes.login}">Se connecter</a></div></div>
  `;
  const toggle = document.querySelector(".menu-toggle");
  const panel = document.querySelector(".header-panel");
  toggle.addEventListener("click", () => {
    const isOpen = panel.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
}

function TripFavoriteButton() {
  return `<button class="favorite-button" type="button" aria-label="Ajouter aux favoris">+</button>`;
}

function TripReservationRequestModal() {
  return `
    <div class="modal-backdrop" id="trip-reservation-modal" aria-hidden="true">
      <section class="trip-modal-card" role="dialog" aria-modal="true" aria-labelledby="trip-reservation-title">
        <h2 id="trip-reservation-title">Demander une place</h2>
        <div class="trip-form-grid">
          <label class="trip-form-field"><span>Nom</span><input type="text"></label>
          <label class="trip-form-field"><span>Téléphone</span><input type="tel"></label>
          <label class="trip-form-field"><span>Email</span><input type="email"></label>
          <label class="trip-form-field"><span>Places souhaitées</span><input type="number" min="1" value="1"></label>
          <label class="choice-card"><input type="checkbox"><span>Bagages</span></label>
          <label class="trip-form-field"><span>Message</span><textarea></textarea></label>
        </div>
        <div class="trip-form-actions"><button class="btn btn-ghost" type="button" data-close-reservation>Annuler</button><button class="btn btn-primary" type="button" data-send-reservation>Envoyer la demande</button></div>
        <p id="trip-reservation-confirmation" hidden>Votre demande de place a été envoyée.</p>
      </section>
    </div>
  `;
}

function TripContactModal() {
  return `
    <div class="modal-backdrop" id="trip-contact-modal" aria-hidden="true">
      <section class="trip-modal-card" role="dialog" aria-modal="true" aria-labelledby="trip-contact-title">
        <h2 id="trip-contact-title">Envoyer un message</h2>
        <div class="trip-form-grid">
          <label class="trip-form-field"><span>Nom</span><input type="text"></label>
          <label class="trip-form-field"><span>Téléphone</span><input type="tel"></label>
          <label class="trip-form-field"><span>Email</span><input type="email"></label>
          <label class="trip-form-field"><span>Message</span><textarea>Bonjour, je suis intéressé par ce trajet. Y a-t-il encore des places disponibles ?</textarea></label>
        </div>
        <div class="trip-form-actions"><button class="btn btn-ghost" type="button" data-close-contact>Annuler</button><button class="btn btn-primary" type="button">Envoyer</button></div>
      </section>
    </div>
  `;
}

function TrustVerificationBlock(detail = {}) {
  const badges = detail.verificationBadges || [];
  return `
    <section class="trip-detail-card">
      <h2>Confiance et vérification</h2>
      ${badges.length ? `<div class="trip-chip-row">${badges.map((badge) => `<span class="trip-chip">${badge}</span>`).join("")}</div>` : `<div class="trip-chip-row"><span class="trip-chip">Annonce non vérifiée</span></div>`}
      <p>${badges.length ? "Les badges affichés correspondent aux éléments validés par Péncmi." : "Cette annonce n’a pas encore été vérifiée par Péncmi."}</p>
      <p>Péncmi affiche les informations fournies par l’annonceur. Vérifiez toujours les détails importants avant tout engagement.</p>
    </section>
  `;
}

function NotFound() {
  return `<section class="trip-empty"><div><h1>Trajet introuvable</h1><p>Le trajet demandé n’est pas disponible pour le moment.</p><div class="trip-empty-actions"><a class="btn btn-primary" href="${routeHref(routes.trips)}">Retour aux trajets</a><a class="btn btn-ghost" href="${routeHref(routes.alerts)}">Créer une alerte</a></div></div></section>`;
}

function TripDetailPage() {
  if (!tripDetail) {
    document.querySelector("#trip-detail-page").innerHTML = `${NotFound()}${TripReservationRequestModal()}${TripContactModal()}${typeof ReportModal === "function" ? ReportModal() : ""}`;
    bindModals();
    if (typeof bindReportModal === "function") bindReportModal(document);
    return;
  }

  document.querySelector("#trip-detail-page").innerHTML = `
    <div class="trip-detail-grid">
      <div>
        <section class="trip-detail-card"><h1>${tripDetail.title}</h1><div class="trip-card-line"><div><span>${tripDetail.departureTime || ""}</span><strong>${tripDetail.departureCity}</strong><small>${tripDetail.departurePoint || ""}</small></div><div class="trip-line-dot"></div><div><span>${tripDetail.estimatedArrivalTime || ""}</span><strong>${tripDetail.arrivalCity}</strong><small>${tripDetail.arrivalPoint || ""}</small></div></div><div class="trip-detail-actions">${TripFavoriteButton()}<button class="btn btn-ghost">Partager</button>${typeof ReportButton === "function" ? ReportButton("Signaler") : `<button class="btn btn-ghost">Signaler</button>`}<button class="btn btn-light" data-open-contact>Envoyer un message</button><button class="btn btn-primary" data-open-reservation>Demander une place</button></div></section>
        <section class="trip-detail-card"><h2>Informations véhicule</h2></section>
        <section class="trip-detail-card"><h2>Conditions</h2></section>
        ${TrustVerificationBlock(tripDetail)}
        ${typeof SafetyTipsBox === "function" ? SafetyTipsBox("trips") : ""}
        <section class="trip-detail-card"><h2>Description</h2></section>
      </div>
      <aside class="trip-detail-card"><h2>Profil conducteur ou transporteur</h2><p>Nom, type, photo, badge vérifié, note future, nombre de trajets et délai moyen de réponse seront affichés ici.</p></aside>
    </div>
    ${TripReservationRequestModal()}
    ${TripContactModal()}
    ${typeof ReportModal === "function" ? ReportModal() : ""}
  `;
  bindModals();
  if (typeof bindReportModal === "function") bindReportModal(document);
}

function bindModals() {
  document.querySelector("[data-open-reservation]")?.addEventListener("click", () => document.querySelector("#trip-reservation-modal").classList.add("is-open"));
  document.querySelector("[data-close-reservation]")?.addEventListener("click", () => document.querySelector("#trip-reservation-modal").classList.remove("is-open"));
  document.querySelector("[data-send-reservation]")?.addEventListener("click", () => {
    document.querySelector("#trip-reservation-confirmation").hidden = false;
  });
  document.querySelector("[data-open-contact]")?.addEventListener("click", () => document.querySelector("#trip-contact-modal").classList.add("is-open"));
  document.querySelector("[data-close-contact]")?.addEventListener("click", () => document.querySelector("#trip-contact-modal").classList.remove("is-open"));
}

Header();
TripDetailPage();

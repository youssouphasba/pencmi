const routes = {
  home: "/",
  hotels: "/hotels",
  alerts: "/hotels/alertes",
  login: "/login"
};

const hotelDetail = null;
const roomOptions = [];

function routeHref(path) {
  if (window.location.protocol !== "file:") {
    return path;
  }
  if (path === routes.home) return "../../index.html";
  if (path === routes.hotels) return "../";
  if (path === routes.alerts) return "../alertes/";
  return path;
}

function Header() {
  document.querySelector("#hotel-detail-header").innerHTML = `
    <a class="brand" href="${routeHref(routes.home)}" aria-label="Accueil Péncmi"><span class="brand-mark">P</span><span><strong>Péncmi</strong><small>Détail hébergement</small></span></a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="main-menu" aria-label="Ouvrir le menu"><span></span><span></span><span></span></button>
    <div class="header-panel" id="main-menu"><nav class="main-nav" aria-label="Navigation principale"><a href="${routeHref(routes.hotels)}">Hôtels</a><a href="${routeHref(routes.alerts)}">Alertes</a></nav><div class="header-actions"><a class="btn btn-ghost" href="${routes.login}">Se connecter</a></div></div>
  `;
  const toggle = document.querySelector(".menu-toggle");
  const panel = document.querySelector(".header-panel");
  toggle.addEventListener("click", () => {
    const isOpen = panel.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
}

function HotelPhotoGallery() {
  return `<section class="hotel-detail-card"><div class="hotel-photo-placeholder">Galerie photos prévue</div></section>`;
}

function RoomOptionCard(room) {
  return `
    <article class="hotel-detail-card">
      <h2>${room.name}</h2>
      <p>${room.description || ""}</p>
      <div class="hotel-chip-row"><span class="hotel-chip">${room.status}</span></div>
      <button class="btn btn-primary" type="button" data-open-reservation>Demander une réservation</button>
    </article>
  `;
}

function HotelRoomOptions() {
  return `
    <section class="hotel-detail-card">
      <h2>Chambres et logements disponibles</h2>
      ${roomOptions.length ? `<div class="hotel-room-grid">${roomOptions.map(RoomOptionCard).join("")}</div>` : `<p>Aucune chambre ou logement renseigné pour le moment.</p>`}
    </section>
  `;
}

function HotelFavoriteButton() {
  return `<button class="favorite-button" type="button" aria-label="Ajouter aux favoris">+</button>`;
}

function HotelPublicSyncBadge(syncState = {}) {
  if (!syncState || !syncState.isSynced) return "";
  const stale = ["stale", "error", "unknown"].includes(syncState.reliability);
  const label = stale ? "Disponibilité à confirmer" : "Disponibilité synchronisée";
  return `<span class="hotel-public-sync-badge${stale ? " warning" : ""}">${label}</span>`;
}

function HotelConfirmAvailabilityNotice(syncState = {}) {
  if (!syncState || !syncState.isSynced || ["stale", "error", "unknown"].includes(syncState.reliability)) {
    return `<section class="hotel-detail-card"><h2>Disponibilité à confirmer</h2><p>L’établissement confirmera la disponibilité.</p></section>`;
  }
  return `<section class="hotel-detail-card"><h2>Données mises à jour récemment</h2><p>Les disponibilités affichées sont synchronisées.</p></section>`;
}

function ReservationSummary() {
  return `
    <section class="hotel-detail-card">
      <h2>Résumé de la demande</h2>
      <p>Établissement, chambre choisie, dates, nombre de nuits, personnes, prix estimé, disponibilité et conditions principales seront résumés ici.</p>
    </section>
  `;
}

function TrustVerificationBlock(detail = {}) {
  const badges = detail.verificationBadges || [];
  return `
    <section class="hotel-detail-card">
      <h2>Confiance et vérification</h2>
      ${badges.length ? `<div class="hotel-chip-row">${badges.map((badge) => `<span class="hotel-chip">${badge}</span>`).join("")}</div>` : `<div class="hotel-chip-row"><span class="hotel-chip">Annonce non vérifiée</span></div>`}
      <p>${badges.length ? "Les badges affichés correspondent aux éléments validés par Péncmi." : "Cette annonce n’a pas encore été vérifiée par Péncmi."}</p>
      <p>Péncmi affiche les informations fournies par l’annonceur. Vérifiez toujours les détails importants avant tout engagement.</p>
    </section>
  `;
}

function HotelReservationRequestModal() {
  return `
    <div class="modal-backdrop" id="reservation-modal" aria-hidden="true">
      <section class="hotel-modal-card" role="dialog" aria-modal="true" aria-labelledby="reservation-title">
        <h2 id="reservation-title">Demander une réservation</h2>
        <div class="hotel-form-grid">
          <label class="hotel-form-field"><span>Nom</span><input type="text"></label>
          <label class="hotel-form-field"><span>Téléphone</span><input type="tel"></label>
          <label class="hotel-form-field"><span>Email</span><input type="email"></label>
          <label class="hotel-form-field"><span>Chambre ou logement choisi</span><select><option>À sélectionner</option></select></label>
          <label class="hotel-form-field"><span>Date d’arrivée</span><input type="date"></label>
          <label class="hotel-form-field"><span>Date de départ</span><input type="date"></label>
          <label class="hotel-form-field"><span>Adultes</span><input type="number" min="1" value="1"></label>
          <label class="hotel-form-field"><span>Enfants</span><input type="number" min="0" value="0"></label>
          <label class="hotel-form-field"><span>Nombre de chambres</span><input type="number" min="1" value="1"></label>
          <label class="hotel-form-field"><span>Message</span><textarea></textarea></label>
        </div>
        ${ReservationSummary()}
        <div class="hotel-form-actions"><button class="btn btn-ghost" type="button" data-close-modal>Annuler</button><button class="btn btn-primary" type="button" data-send-request>Envoyer la demande</button></div>
        <p id="reservation-message" hidden>Votre demande a été envoyée. L’établissement vous confirmera la disponibilité.</p>
      </section>
    </div>
  `;
}

function HotelContactModal() {
  return `
    <div class="modal-backdrop" id="contact-modal" aria-hidden="true">
      <section class="hotel-modal-card" role="dialog" aria-modal="true" aria-labelledby="contact-title">
        <h2 id="contact-title">Envoyer un message</h2>
        <div class="hotel-form-grid single"><label class="hotel-form-field"><span>Message</span><textarea></textarea></label></div>
        <div class="hotel-form-actions"><button class="btn btn-ghost" type="button" data-close-contact>Annuler</button><button class="btn btn-primary" type="button">Envoyer</button></div>
      </section>
    </div>
  `;
}

function NotFound() {
  return `
    <section class="hotel-empty">
      <div>
        <h1>Hébergement introuvable</h1>
        <p>L’hébergement demandé n’est pas disponible pour le moment.</p>
        <div class="hotel-empty-actions"><a class="btn btn-primary" href="${routeHref(routes.hotels)}">Retour aux hébergements</a><a class="btn btn-ghost" href="${routeHref(routes.alerts)}">Créer une alerte</a></div>
      </div>
    </section>
  `;
}

function HotelDetailPage() {
  if (!hotelDetail) {
    document.querySelector("#hotel-detail-page").innerHTML = `${NotFound()}${HotelReservationRequestModal()}${HotelContactModal()}${typeof ReportModal === "function" ? ReportModal() : ""}`;
    bindModals();
    if (typeof bindReportModal === "function") bindReportModal(document);
    return;
  }

  document.querySelector("#hotel-detail-page").innerHTML = `
    <div class="hotel-detail-grid">
      <div>
        ${HotelPhotoGallery()}
        <section class="hotel-detail-card"><h1>${hotelDetail.name}</h1>${HotelPublicSyncBadge(hotelDetail.syncState)}<p>${hotelDetail.description || ""}</p><div class="hotel-detail-actions">${HotelFavoriteButton()}<button class="btn btn-ghost">Partager</button>${typeof ReportButton === "function" ? ReportButton("Signaler") : `<button class="btn btn-ghost">Signaler</button>`}<button class="btn btn-light" data-open-contact>Envoyer un message</button><button class="btn btn-primary" data-open-reservation>Demander une réservation</button></div></section>
        ${HotelConfirmAvailabilityNotice(hotelDetail.syncState)}
        ${HotelRoomOptions()}
        ${TrustVerificationBlock(hotelDetail)}
        ${typeof SafetyTipsBox === "function" ? SafetyTipsBox("hotels") : ""}
        <section class="hotel-detail-card"><h2>Commodités de l’établissement</h2></section>
        <section class="hotel-detail-card"><h2>Conditions</h2></section>
      </div>
      <aside class="hotel-detail-card"><h2>Profil annonceur</h2><p>Informations de l’établissement prévues.</p></aside>
    </div>
    ${HotelReservationRequestModal()}
    ${HotelContactModal()}
    ${typeof ReportModal === "function" ? ReportModal() : ""}
  `;
  bindModals();
  if (typeof bindReportModal === "function") bindReportModal(document);
}

function bindModals() {
  document.querySelectorAll("[data-open-reservation]").forEach((button) => button.addEventListener("click", () => document.querySelector("#reservation-modal").classList.add("is-open")));
  document.querySelector("[data-close-modal]")?.addEventListener("click", () => document.querySelector("#reservation-modal").classList.remove("is-open"));
  document.querySelector("[data-send-request]")?.addEventListener("click", () => {
    document.querySelector("#reservation-message").hidden = false;
  });
  document.querySelector("[data-open-contact]")?.addEventListener("click", () => document.querySelector("#contact-modal").classList.add("is-open"));
  document.querySelector("[data-close-contact]")?.addEventListener("click", () => document.querySelector("#contact-modal").classList.remove("is-open"));
}

Header();
HotelDetailPage();

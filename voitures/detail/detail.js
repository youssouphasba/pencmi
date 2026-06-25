const routes = {
  home: "/",
  vehicles: "/voitures",
  alerts: "/voitures/alertes",
  login: "/login"
};

const vehicleDetail = null;

function routeHref(path) {
  if (window.location.protocol !== "file:") {
    return path;
  }
  if (path === routes.home) return "../../index.html";
  if (path === routes.vehicles) return "../";
  if (path === routes.alerts) return "../alertes/";
  return path;
}

function Header() {
  document.querySelector("#vehicle-detail-header").innerHTML = `
    <a class="brand" href="${routeHref(routes.home)}"><span class="brand-mark">P</span><span><strong>Péncmi</strong><small>Détail voiture</small></span></a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="main-menu" aria-label="Ouvrir le menu"><span></span><span></span><span></span></button>
    <div class="header-panel" id="main-menu"><nav class="main-nav"><a href="${routeHref(routes.vehicles)}">Voitures</a><a href="${routeHref(routes.alerts)}">Alertes</a></nav><div class="header-actions"><a class="btn btn-ghost" href="${routes.login}">Se connecter</a></div></div>
  `;
  const toggle = document.querySelector(".menu-toggle");
  const panel = document.querySelector(".header-panel");
  toggle.addEventListener("click", () => {
    const isOpen = panel.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
}

function VehiclePhotoGallery() {
  return `<section class="vehicle-detail-card"><div class="vehicle-photo-placeholder">Galerie photos prévue</div></section>`;
}

function VehicleFavoriteButton() {
  return `<button class="favorite-button" type="button" aria-label="Ajouter aux favoris">+</button>`;
}

function VehicleContactModal() {
  return `
    <div class="modal-backdrop" id="vehicle-contact-modal" aria-hidden="true">
      <section class="vehicle-modal-card" role="dialog" aria-modal="true" aria-labelledby="vehicle-contact-title">
        <h2 id="vehicle-contact-title">Contacter l’annonceur</h2>
        <div class="vehicle-form-grid">
          <label class="vehicle-form-field"><span>Nom</span><input type="text"></label>
          <label class="vehicle-form-field"><span>Téléphone</span><input type="tel"></label>
          <label class="vehicle-form-field"><span>Email</span><input type="email"></label>
          <label class="vehicle-form-field"><span>Message</span><textarea>Bonjour, je suis intéressé par ce véhicule. Est-il toujours disponible ?</textarea></label>
        </div>
        <div class="vehicle-form-actions"><button class="btn btn-ghost" type="button" data-close-contact>Annuler</button><button class="btn btn-primary" type="button" data-send-message>Envoyer</button></div>
        <p id="vehicle-contact-confirmation" hidden>Votre message a été envoyé à l’annonceur.</p>
      </section>
    </div>
  `;
}

function TrustVerificationBlock(detail = {}) {
  const badges = detail.verificationBadges || [];
  return `
    <section class="vehicle-detail-card">
      <h2>Confiance et vérification</h2>
      ${badges.length ? `<div class="vehicle-chip-row">${badges.map((badge) => `<span class="vehicle-chip">${badge}</span>`).join("")}</div>` : `<div class="vehicle-chip-row"><span class="vehicle-chip">Annonce non vérifiée</span></div>`}
      <p>${badges.length ? "Les badges affichés correspondent aux éléments validés par Péncmi." : "Cette annonce n’a pas encore été vérifiée par Péncmi."}</p>
      <p>Péncmi affiche les informations fournies par l’annonceur. Vérifiez toujours les détails importants avant tout engagement.</p>
    </section>
  `;
}

function NotFound() {
  return `<section class="vehicle-empty"><div><h1>Annonce introuvable</h1><p>L’annonce demandée n’est pas disponible pour le moment.</p><div class="vehicle-empty-actions"><a class="btn btn-primary" href="${routeHref(routes.vehicles)}">Retour aux voitures</a><a class="btn btn-ghost" href="${routeHref(routes.alerts)}">Créer une alerte</a></div></div></section>`;
}

function VehicleDetailPage() {
  if (!vehicleDetail) {
    document.querySelector("#vehicle-detail-page").innerHTML = `${NotFound()}${VehicleContactModal()}${typeof ReportModal === "function" ? ReportModal() : ""}`;
    bindModal();
    if (typeof bindReportModal === "function") bindReportModal(document);
    return;
  }

  document.querySelector("#vehicle-detail-page").innerHTML = `
    <div class="vehicle-detail-grid">
      <div>
        ${VehiclePhotoGallery()}
        <section class="vehicle-detail-card"><h1>${vehicleDetail.title}</h1><p>${vehicleDetail.description || ""}</p><div class="vehicle-detail-actions">${VehicleFavoriteButton()}<button class="btn btn-ghost">Partager</button>${typeof ReportButton === "function" ? ReportButton("Signaler") : `<button class="btn btn-ghost">Signaler</button>`}<button class="btn btn-primary" data-open-contact>Contacter</button></div></section>
        <section class="vehicle-detail-card"><h2>Équipements</h2></section>
        <section class="vehicle-detail-card"><h2>Documents disponibles</h2></section>
        ${TrustVerificationBlock(vehicleDetail)}
        ${typeof SafetyTipsBox === "function" ? SafetyTipsBox("vehicles") : ""}
        <section class="vehicle-detail-card"><h2>Conditions de location</h2></section>
        <section class="vehicle-detail-card"><h2>Annonces similaires</h2></section>
      </div>
      <aside class="vehicle-detail-card"><h2>Profil vendeur ou loueur</h2><p>Informations annonceur prévues.</p></aside>
    </div>
    ${VehicleContactModal()}
    ${typeof ReportModal === "function" ? ReportModal() : ""}
  `;
  bindModal();
  if (typeof bindReportModal === "function") bindReportModal(document);
}

function bindModal() {
  document.querySelector("[data-open-contact]")?.addEventListener("click", () => document.querySelector("#vehicle-contact-modal").classList.add("is-open"));
  document.querySelector("[data-close-contact]")?.addEventListener("click", () => document.querySelector("#vehicle-contact-modal").classList.remove("is-open"));
  document.querySelector("[data-send-message]")?.addEventListener("click", () => {
    document.querySelector("#vehicle-contact-confirmation").hidden = false;
  });
}

Header();
VehicleDetailPage();

const routes = {
  home: "/",
  realEstate: "/immobilier",
  hotels: "/hotels",
  vehicles: "/voitures",
  trips: "/voyages",
  login: "/login",
  register: "/register",
  favorites: "/login?next=/favoris/immobilier",
  alerts: "/login?next=/immobilier/alertes",
  publishRealEstate: "/login?next=/publier?category=immobilier"
};

const currentListing = null;

function routeHref(path) {
  if (window.location.protocol !== "file:") {
    return path;
  }

  if (path === "/") {
    return "../../index.html";
  }

  if (path === "/immobilier") {
    return "../";
  }

  if (path.startsWith("/immobilier?")) {
    return `../${path.slice("/immobilier".length)}`;
  }

  return path;
}

function buildLoginRedirect(next = window.location.pathname) {
  return `/login?next=${encodeURIComponent(next)}`;
}

function formatPriceFCFA(value, period) {
  if (!value) {
    return "";
  }

  const suffix = period === "month" ? " / mois" : period === "day" ? " / jour" : "";
  return `${Number(value).toLocaleString("fr-FR")} FCFA${suffix}`;
}

function formatPropertyType(type) {
  const labels = {
    appartement: "Appartement",
    maison: "Maison",
    villa: "Villa",
    terrain: "Terrain",
    studio: "Studio",
    chambre: "Chambre",
    bureau: "Bureau",
    commerce: "Commerce"
  };

  return labels[type] || "";
}

function formatTransaction(transaction) {
  const labels = {
    location: "Location",
    vente: "Vente",
    achat: "Achat"
  };

  return labels[transaction] || "";
}

function formatLocation(listing) {
  return [listing?.district, listing?.city, listing?.department, listing?.region].filter(Boolean).join(", ");
}

function getEnabledContactMethods(preferences = {}) {
  return [
    ["internalMessagingEnabled", "Envoyer un message", "message"],
    ["phoneEnabled", "Appeler", "phone"],
    ["whatsappEnabled", "WhatsApp", "whatsapp"],
    ["emailEnabled", "Email", "email"],
    ["visitRequestEnabled", "Demander une visite", "visit"]
  ].filter(([key]) => preferences[key]);
}

function trackListingEvent(eventType, listingId = "") {
  return { eventType, listingId, createdAt: new Date().toISOString() };
}

function RealEstateHeader() {
  document.querySelector("#real-estate-header").innerHTML = `
    <a class="brand" href="${routeHref(routes.home)}" aria-label="Accueil Péncmi">
      <span class="brand-mark">P</span>
      <span>
        <strong>Péncmi</strong>
        <small>Immobilier</small>
      </span>
    </a>

    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="main-menu" aria-label="Ouvrir le menu">
      <span></span>
      <span></span>
      <span></span>
    </button>

    <div class="header-panel" id="main-menu">
      <nav class="main-nav" aria-label="Navigation principale">
        <a href="${routeHref(routes.home)}">Accueil</a>
        <a href="${routeHref(routes.realEstate)}" aria-current="page">Immobilier</a>
        <a href="${routes.hotels}">Hôtels</a>
        <a href="${routes.vehicles}">Voitures</a>
        <a href="${routes.trips}">Voyages interurbains</a>
      </nav>
      <div class="header-actions">
        <a class="btn btn-ghost" href="${routes.login}">Se connecter</a>
        <a class="btn btn-light" href="${routes.register}">Créer mon espace</a>
        <a class="btn btn-ghost" href="${routes.favorites}">Mes favoris</a>
        <a class="btn btn-primary" href="${routes.publishRealEstate}">Publier une annonce</a>
      </div>
    </div>
  `;

  const toggle = document.querySelector(".menu-toggle");
  const panel = document.querySelector(".header-panel");

  toggle.addEventListener("click", () => {
    const isOpen = panel.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute("aria-label", isOpen ? "Fermer le menu" : "Ouvrir le menu");
  });
}

function RealEstatePhotoGallery(listing) {
  const photos = listing?.photos || [];

  if (!photos.length) {
    return `
      <section class="detail-card photo-gallery">
        <div class="photo-placeholder">Aucune photo disponible</div>
      </section>
    `;
  }

  return `
    <section class="detail-card photo-gallery">
      <img src="${listing.coverPhoto || photos[0]}" alt="">
      <div class="badge-row">
        <span class="badge">${listing.photoCount || photos.length} photos</span>
        <button class="btn btn-ghost" type="button">Plein écran</button>
      </div>
      <div class="gallery-thumbnails">
        ${photos.map(() => `<span class="gallery-thumb"></span>`).join("")}
      </div>
    </section>
  `;
}

function ListingMainInfo(listing) {
  const badges = [
    formatTransaction(listing.transaction),
    formatPropertyType(listing.propertyType),
    listing.isVerified ? "Annonce vérifiée" : ""
  ].filter(Boolean);

  return `
    <section class="detail-card main-info">
      <div class="badge-row">${badges.map((badge) => `<span class="badge">${badge}</span>`).join("")}</div>
      <h1>${listing.title}</h1>
      ${listing.price ? `<div class="price">${formatPriceFCFA(listing.price, listing.pricePeriod)}</div>` : ""}
      ${formatLocation(listing) ? `<p>${formatLocation(listing)}</p>` : ""}
      ${listing.updatedAt || listing.createdAt ? `<p>Mis à jour le ${listing.updatedAt || listing.createdAt}</p>` : ""}
      <div class="action-row">
        ${FavoriteButton(false)}
        ${ShareListingButton()}
        <button class="btn btn-ghost" type="button" data-open-report>Signaler l’annonce</button>
      </div>
    </section>
  `;
}

function PropertyFeaturesGrid(listing) {
  const features = [
    ["Surface", listing.surface ? `${listing.surface} m²` : ""],
    ["Chambres", listing.bedrooms],
    ["Salles de bain", listing.bathrooms],
    ["Pièces", listing.rooms],
    ["Étage", listing.floor],
    ["Nombre d’étages", listing.totalFloors],
    ["Meublé", listing.furnished === true ? "Oui" : listing.furnished === false ? "Non" : ""],
    ["Parking", listing.parking ? "Oui" : ""],
    ["Balcon", listing.balcony ? "Oui" : ""],
    ["Terrasse", listing.terrace ? "Oui" : ""],
    ["Piscine", listing.pool ? "Oui" : ""],
    ["Climatisation", listing.airConditioning ? "Oui" : ""],
    ["Gardien", listing.securityGuard ? "Oui" : ""],
    ["Groupe électrogène", listing.generator ? "Oui" : ""],
    ["Compteur SENELEC individuel", listing.individualElectricityMeter ? "Oui" : ""],
    ["Eau disponible", listing.waterAvailable ? "Oui" : ""]
  ].filter(([, value]) => value !== "" && value !== undefined && value !== null);

  return `
    <section class="detail-card">
      <h2>Caractéristiques</h2>
      ${features.length ? `<div class="detail-grid">${features.map(([label, value]) => `<div class="detail-item"><span>${label}</span><strong>${value}</strong></div>`).join("")}</div>` : "<p>Aucune caractéristique disponible pour le moment.</p>"}
    </section>
  `;
}

function DescriptionSection(listing) {
  return `
    <section class="detail-card">
      <h2>Description</h2>
      <p>${listing.description || "Aucune description disponible pour le moment."}</p>
    </section>
  `;
}

function TrustVerificationBlock(listing = {}) {
  const badges = listing.verificationBadges || [];
  return `
    <section class="detail-card">
      <h2>Confiance et vérification</h2>
      ${badges.length ? `<div class="badge-row">${badges.map((badge) => `<span class="badge">${badge}</span>`).join("")}</div>` : `<div class="badge-row"><span class="badge">Annonce non vérifiée</span></div>`}
      <p>${badges.length ? "Les badges affichés correspondent aux éléments validés par Péncmi." : "Cette annonce n’a pas encore été vérifiée par Péncmi."}</p>
      <p>Péncmi affiche les informations fournies par l’annonceur. Vérifiez toujours les détails importants avant tout engagement.</p>
    </section>
  `;
}

function FinancialConditions(listing) {
  const conditions = [
    ["Prix", formatPriceFCFA(listing.price, listing.pricePeriod)],
    ["Caution", formatPriceFCFA(listing.deposit)],
    ["Avance", formatPriceFCFA(listing.advancePayment)],
    ["Commission agence", formatPriceFCFA(listing.agencyFee)],
    ["Charges", formatPriceFCFA(listing.charges)],
    ["Négociable", listing.negotiable === true ? "Oui" : listing.negotiable === false ? "Non" : ""],
    ["Disponible à partir du", listing.availableFrom]
  ].filter(([, value]) => value);

  return `
    <section class="detail-card">
      <h2>Conditions</h2>
      ${conditions.length ? `<div class="detail-grid">${conditions.map(([label, value]) => `<div class="detail-item"><span>${label}</span><strong>${value}</strong></div>`).join("")}</div>` : "<p>Aucune condition renseignée pour le moment.</p>"}
    </section>
  `;
}

function PropertyDocuments(listing) {
  const documents = (listing.documents || []).filter((document) => document.available);

  return `
    <section class="detail-card">
      <h2>Documents disponibles</h2>
      ${documents.length ? `<div class="detail-grid">${documents.map((document) => `<div class="detail-item"><span>${document.type}</span><strong>${document.label}</strong></div>`).join("")}</div>` : "<p>Aucun document renseigné pour le moment.</p>"}
    </section>
  `;
}

function LocationSection(listing) {
  const locationItems = [
    ["Région", listing.region],
    ["Département", listing.department],
    ["Ville", listing.city],
    ["Quartier", listing.district],
    ["Zone approximative", listing.isApproximateLocation ? "Localisation approximative" : ""]
  ].filter(([, value]) => value);

  return `
    <section class="detail-card">
      <h2>Localisation</h2>
      ${locationItems.length ? `<div class="detail-grid">${locationItems.map(([label, value]) => `<div class="detail-item"><span>${label}</span><strong>${value}</strong></div>`).join("")}</div>` : "<p>Aucune localisation détaillée disponible pour le moment.</p>"}
      <div class="map-placeholder">Carte bientôt disponible</div>
    </section>
  `;
}

function FavoriteButton(active = false) {
  return `
    <a class="btn btn-ghost" href="${routes.favorites}">
      ${active ? "Retiré des favoris" : "Ajouter aux favoris"}
    </a>
  `;
}

function ShareListingButton() {
  return `<button class="btn btn-ghost" type="button" data-share-listing>Partager</button>`;
}

function contactButton(method) {
  if (method[2] === "message") {
    return `<button class="btn btn-ghost" type="button" data-open-message>${method[1]}</button>`;
  }

  if (method[2] === "visit") {
    return `<button class="btn btn-ghost" type="button" data-open-visit>${method[1]}</button>`;
  }

  return `<button class="btn btn-ghost" type="button">${method[1]}</button>`;
}

function AdvertiserContactCard(listing) {
  const advertiser = listing.advertiser || {};
  const methods = getEnabledContactMethods(listing.contactPreferences);

  return `
    <aside class="contact-card">
      <h2>Annonceur</h2>
      <div class="advertiser-avatar">${advertiser.name ? advertiser.name.slice(0, 1).toUpperCase() : "P"}</div>
      ${advertiser.name ? `<strong>${advertiser.name}</strong>` : ""}
      ${advertiser.type ? `<p>${advertiser.type}</p>` : ""}
      ${advertiser.city ? `<p>${advertiser.city}</p>` : ""}
      ${advertiser.isVerified ? `<span class="badge">Annonceur vérifié</span>` : ""}
      ${advertiser.listingsCount ? `<p>${advertiser.listingsCount} annonces</p>` : ""}
      ${advertiser.joinedAt ? `<p>Inscrit depuis ${advertiser.joinedAt}</p>` : ""}
      <div class="contact-actions">
        ${methods.map(contactButton).join("") || "<p>Aucun moyen de contact activé pour le moment.</p>"}
      </div>
      ${FavoriteButton(false)}
    </aside>
  `;
}

function ContactAdvertiserModal() {
  return `
    <div class="modal-backdrop" data-modal>
      <div class="modal-panel">
        <h2>Envoyer un message à l’annonceur</h2>
        <form class="modal-form">
          <input type="text" name="name" placeholder="Nom">
          <input type="tel" name="phone" placeholder="Téléphone">
          <input type="email" name="email" placeholder="Email">
          <textarea name="message">Bonjour, je suis intéressé par ce bien. Est-il toujours disponible ?</textarea>
          <div class="modal-actions">
            <button class="btn btn-primary" type="button" data-confirm-message>Envoyer le message</button>
            <button class="btn btn-ghost" type="button" data-close-modal>Fermer</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function MessageConfirmation() {
  return `<p>Votre message a été envoyé à l’annonceur.</p>`;
}

function VisitRequestModal() {
  return `
    <div class="modal-backdrop" data-modal>
      <div class="modal-panel">
        <h2>Demander une visite</h2>
        <form class="modal-form">
          <input type="text" name="name" placeholder="Nom">
          <input type="tel" name="phone" placeholder="Téléphone">
          <input type="email" name="email" placeholder="Email">
          <input type="date" name="requestedDate">
          <input type="time" name="requestedTime">
          <textarea name="message" placeholder="Message"></textarea>
          <div class="modal-actions">
            <button class="btn btn-primary" type="button" data-confirm-visit>Envoyer la demande</button>
            <button class="btn btn-ghost" type="button" data-close-modal>Fermer</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function VisitRequestConfirmation() {
  return `<p>Votre demande de visite a été envoyée.</p>`;
}

function ReportListingModal() {
  return `
    <div class="modal-backdrop" data-modal>
      <div class="modal-panel">
        <h2>Signaler l’annonce</h2>
        <form class="modal-form">
          <select name="reason">
            <option value="suspicious">Annonce suspecte</option>
            <option value="wrong_price">Prix incohérent</option>
            <option value="fake_photos">Fausses photos</option>
            <option value="unavailable">Bien déjà loué ou vendu</option>
            <option value="wrong_contact">Mauvais contact</option>
            <option value="other">Autre</option>
          </select>
          <textarea name="message" placeholder="Votre message"></textarea>
          <div class="modal-actions">
            <button class="btn btn-primary" type="button" data-confirm-report>Envoyer le signalement</button>
            <button class="btn btn-ghost" type="button" data-close-modal>Fermer</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function ReportConfirmation() {
  return `<p>Merci, votre signalement a été transmis.</p>`;
}

function SimilarListingsSection() {
  return `
    <section class="detail-card">
      <h2>Annonces similaires</h2>
      <p class="similar-empty">Aucune annonce similaire disponible pour le moment.</p>
    </section>
  `;
}

function MobileStickyContactBar(listing) {
  const methods = getEnabledContactMethods(listing.contactPreferences);
  const primary = methods.slice(0, 2);

  if (!primary.length) {
    return "";
  }

  return `<div class="mobile-contact-bar">${primary.map(contactButton).join("")}</div>`;
}

function ListingNotFoundState() {
  return `
    <section class="not-found-card">
      <h1>Annonce introuvable</h1>
      <p>Cette annonce n’est pas disponible pour le moment.</p>
      <div class="empty-actions">
        <a class="btn btn-primary" href="${routeHref(routes.realEstate)}">Retour aux annonces</a>
        <a class="btn btn-light" href="${routes.alerts}">Créer une alerte</a>
      </div>
    </section>
  `;
}

function RealEstateListingDetailPage(listing) {
  if (!listing) {
    document.querySelector("#listing-detail-page").innerHTML = ListingNotFoundState();
    return;
  }

  trackListingEvent("view", listing.id);

  document.querySelector("#listing-detail-page").innerHTML = `
    <div class="detail-layout">
      <div class="detail-main">
        ${RealEstatePhotoGallery(listing)}
        ${ListingMainInfo(listing)}
        ${PropertyFeaturesGrid(listing)}
        ${DescriptionSection(listing)}
        ${TrustVerificationBlock(listing)}
        ${typeof SafetyTipsBox === "function" ? SafetyTipsBox("real_estate") : ""}
        ${FinancialConditions(listing)}
        ${PropertyDocuments(listing)}
        ${LocationSection(listing)}
        ${SimilarListingsSection()}
      </div>
      ${AdvertiserContactCard(listing)}
    </div>
    ${MobileStickyContactBar(listing)}
  `;

  bindDetailActions(listing);
}

function openModal(content) {
  document.querySelector("#modal-root").innerHTML = content;
  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", closeModal);
  });
}

function closeModal() {
  document.querySelector("#modal-root").innerHTML = "";
}

function bindDetailActions(listing) {
  document.querySelectorAll("[data-open-message]").forEach((button) => {
    button.addEventListener("click", () => {
      trackListingEvent("message_modal_open", listing.id);
      openModal(ContactAdvertiserModal());
      document.querySelector("[data-confirm-message]").addEventListener("click", () => {
        trackListingEvent("message_sent", listing.id);
        document.querySelector(".modal-panel").innerHTML = MessageConfirmation();
      });
    });
  });

  document.querySelectorAll("[data-open-visit]").forEach((button) => {
    button.addEventListener("click", () => {
      trackListingEvent("visit_request_open", listing.id);
      openModal(VisitRequestModal());
      document.querySelector("[data-confirm-visit]").addEventListener("click", () => {
        trackListingEvent("visit_request_sent", listing.id);
        document.querySelector(".modal-panel").innerHTML = VisitRequestConfirmation();
      });
    });
  });

  document.querySelectorAll("[data-open-report]").forEach((button) => button.addEventListener("click", () => {
    trackListingEvent("report", listing.id);
    openModal(ReportListingModal());
    document.querySelector("[data-confirm-report]").addEventListener("click", () => {
      document.querySelector(".modal-panel").innerHTML = ReportConfirmation();
    });
  }));

  document.querySelector("[data-share-listing]")?.addEventListener("click", () => {
    trackListingEvent("share", listing.id);
  });
}

RealEstateHeader();
RealEstateListingDetailPage(currentListing);

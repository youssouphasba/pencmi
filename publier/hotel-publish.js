const hotelCategory = new URLSearchParams(window.location.search).get("category") === "hotel";

if (hotelCategory) {
  const hotelRoutes = {
    home: "/",
    hotels: "/hotels",
    dashboard: "/dashboard/hotels",
    listings: "/dashboard/hotels/annonces"
  };

  const hotelSteps = [
    "Type d’hébergement",
    "Informations générales",
    "Localisation",
    "Chambres ou logements",
    "Prix",
    "Photos",
    "Commodités",
    "Conditions",
    "Disponibilités",
    "Mode de gestion",
    "Moyens de contact",
    "Prévisualisation",
    "Soumission"
  ];

  const hotelTypes = ["Hôtel", "Auberge", "Résidence", "Appartement meublé", "Maison d’hôtes", "Villa", "Campement", "Chambre chez l’habitant"];
  const hotelAmenities = ["Wi-Fi", "Parking", "Piscine", "Restaurant", "Petit-déjeuner", "Réception 24h/24", "Sécurité", "Groupe électrogène", "Climatisation", "Jardin", "Terrasse", "Vue mer", "Salle de conférence", "Navette aéroport", "Service de chambre", "Blanchisserie", "Cuisine commune", "Bar", "Salle de sport"];
  const roomAmenities = ["Climatisation", "Ventilateur", "Salle de bain privée", "Eau chaude", "Télévision", "Wi-Fi", "Mini frigo", "Bureau", "Armoire", "Coffre-fort", "Balcon", "Vue mer", "Lit double", "Deux lits simples", "Lit enfant", "Cuisine équipée"];
  const contactOptions = [["whatsappEnabled", "WhatsApp"], ["phoneEnabled", "Appel téléphonique"], ["emailEnabled", "Email"], ["internalMessagingEnabled", "Messagerie interne"], ["contactFormEnabled", "Formulaire de demande"], ["reservationRequestEnabled", "Demande de réservation"], ["emailNotificationsEnabled", "Notifications email"]];

  let currentHotelStep = 0;
  let hotelStatusMessage = "";
  let hotelDraft = {
    type: "",
    general: {},
    location: {},
    roomOptions: [],
    prices: {},
    photos: [],
    amenities: [],
    conditions: {},
    availability: {},
    availabilitySettings: {
      mode: "semi_automatic",
      allowTemporaryLock: true,
      temporaryLockDurationMinutes: 30,
      updateStockOnAcceptedReservation: true,
      showRemainingRoomsToClients: true
    },
    contactPreferences: {
      whatsappEnabled: false,
      phoneEnabled: false,
      emailEnabled: false,
      internalMessagingEnabled: false,
      contactFormEnabled: false,
      reservationRequestEnabled: false,
      emailNotificationsEnabled: false
    }
  };

  function routeHref(path) {
    if (window.location.protocol !== "file:") return path;
    if (path === hotelRoutes.home) return "../index.html";
    if (path === hotelRoutes.hotels) return "../hotels/";
    if (path === hotelRoutes.dashboard) return "../dashboard/hotels/";
    if (path === hotelRoutes.listings) return "../dashboard/hotels/annonces/";
    return path;
  }

  function setHotelValue(path, value) {
    const keys = path.split(".");
    let target = hotelDraft;
    keys.slice(0, -1).forEach((key) => {
      target[key] = target[key] || {};
      target = target[key];
    });
    target[keys[keys.length - 1]] = value;
  }

  function HotelAmenitiesSelector() {
    return `<div class="checkbox-list">${hotelAmenities.map((item) => `<label class="choice-card"><input type="checkbox" data-amenity="${item}"${hotelDraft.amenities.includes(item) ? " checked" : ""}><span>${item}</span></label>`).join("")}</div>`;
  }

  function RoomAmenitiesSelector() {
    return `<div class="checkbox-list">${roomAmenities.map((item) => `<label class="choice-card"><input type="checkbox"><span>${item}</span></label>`).join("")}</div>`;
  }

  function RoomOptionEditor() {
    return `
      <section class="step-card">
        <h2>Chambres ou logements</h2>
        <div class="form-grid">
          <label class="form-field"><span>Nom</span><input type="text" placeholder="Chambre standard"></label>
          <label class="form-field"><span>Capacité maximale</span><input type="number" min="1"></label>
          <label class="form-field"><span>Adultes</span><input type="number" min="1"></label>
          <label class="form-field"><span>Enfants</span><input type="number" min="0"></label>
          <label class="form-field"><span>Nombre de lits</span><input type="number" min="1"></label>
          <label class="form-field"><span>Type de lit</span><select><option>Lit double</option><option>Deux lits simples</option><option>Queen</option><option>King</option><option>Mixte</option></select></label>
          <label class="form-field"><span>Prix par nuit</span><input type="number" min="0"></label>
          <label class="form-field"><span>Nombre total d’unités</span><input type="number" min="0"></label>
        </div>
        <h3>Équipements de la chambre</h3>
        ${RoomAmenitiesSelector()}
      </section>
    `;
  }

  function BookingRulesSettings() {
    return `
      <section class="step-card">
        <h2>Mode de gestion des disponibilités</h2>
        <p>Choisissez comment Péncmi doit gérer les disponibilités de vos chambres. Vous pouvez modifier ce choix à tout moment.</p>
        <div class="option-grid">
          <label class="choice-card"><input type="radio" name="mode" data-path="availabilitySettings.mode" value="manual"${hotelDraft.availabilitySettings.mode === "manual" ? " checked" : ""}><span>Manuel</span></label>
          <label class="choice-card"><input type="radio" name="mode" data-path="availabilitySettings.mode" value="semi_automatic"${hotelDraft.availabilitySettings.mode === "semi_automatic" ? " checked" : ""}><span>Semi-automatique</span></label>
          <label class="choice-card"><input type="radio" name="mode" data-path="availabilitySettings.mode" value="automatic"${hotelDraft.availabilitySettings.mode === "automatic" ? " checked" : ""}><span>Automatique</span></label>
        </div>
        <div class="checkbox-list">
          <label class="choice-card"><input type="checkbox" data-path="availabilitySettings.allowTemporaryLock"${hotelDraft.availabilitySettings.allowTemporaryLock ? " checked" : ""}><span>Activer le blocage temporaire pendant une demande</span></label>
          <label class="form-field"><span>Durée du blocage</span><select data-path="availabilitySettings.temporaryLockDurationMinutes"><option value="15">15 minutes</option><option value="30" selected>30 minutes</option><option value="60">1 heure</option><option value="1440">24 heures</option></select></label>
        </div>
      </section>
    `;
  }

  function HotelAvailabilityCalendar() {
    return `<section class="step-card"><h2>Disponibilités</h2><div class="photo-dropzone"><div><strong>Calendrier de disponibilité prévu</strong><p>Ajoutez les dates ouvertes, bloquées, complètes ou en maintenance.</p></div></div></section>`;
  }

  function stepContent() {
    const regions = (window.SENEGAL_LOCATIONS || []).map((item) => `<option>${item.region}</option>`).join("");
    const steps = [
      `<section class="step-card"><h2>Type d’hébergement</h2><div class="option-grid">${hotelTypes.map((type) => `<label class="choice-card"><input type="radio" name="hotelType" data-path="type" value="${type}"${hotelDraft.type === type ? " checked" : ""}><span>${type}</span></label>`).join("")}</div></section>`,
      `<section class="step-card"><h2>Informations générales</h2><div class="form-grid"><label class="form-field"><span>Nom de l’établissement</span><input data-path="general.name" type="text"></label><label class="form-field"><span>Classement étoiles</span><select data-path="general.stars"><option>Non classé</option><option>1 étoile</option><option>2 étoiles</option><option>3 étoiles</option><option>4 étoiles</option><option>5 étoiles</option></select></label><label class="form-field"><span>Nombre total de chambres</span><input data-path="general.totalRooms" type="number" min="0"></label><label class="form-field"><span>Arrivée</span><input data-path="general.checkInTime" type="time"></label><label class="form-field"><span>Départ</span><input data-path="general.checkOutTime" type="time"></label><label class="form-field full"><span>Description</span><textarea data-path="general.description"></textarea></label></div></section>`,
      `<section class="step-card"><h2>Localisation</h2><div class="form-grid"><label class="form-field"><span>Région</span><select data-path="location.region"><option value="">Sélectionner une région</option>${regions}</select></label><label class="form-field"><span>Ville</span><input data-path="location.city" type="text"></label><label class="form-field"><span>Quartier</span><input data-path="location.district" type="text"></label><label class="form-field full"><span>Adresse ou indication</span><input data-path="location.addressHint" type="text"></label><label class="choice-card"><input type="checkbox" data-path="location.approximate"><span>Localisation approximative</span></label><label class="choice-card"><input type="checkbox" data-path="location.hideExactAddress"><span>Masquer l’adresse exacte</span></label></div></section>`,
      RoomOptionEditor(),
      `<section class="step-card"><h2>Prix</h2><div class="form-grid"><label class="form-field"><span>Prix à partir de</span><input data-path="prices.priceFrom" type="number" min="0"></label><label class="form-field"><span>Devise</span><input value="FCFA" disabled></label><label class="form-field"><span>Période</span><select data-path="prices.period"><option>Par nuit</option><option>Par semaine</option><option>Par mois</option></select></label></div></section>`,
      `<section class="step-card"><h2>Photos</h2><div class="photo-dropzone"><div><strong>Upload multiple prévu</strong><p>Photo principale, aperçu, ordre, suppression et limite future de 30 photos.</p><input type="file" multiple accept=".jpg,.jpeg,.png,.webp"></div></div></section>`,
      `<section class="step-card"><h2>Commodités de l’établissement</h2>${HotelAmenitiesSelector()}</section>`,
      `<section class="step-card"><h2>Conditions</h2><div class="checkbox-list">${["Annulation gratuite", "Paiement sur place", "Acompte demandé", "Réservation sans paiement immédiat", "Enfants acceptés", "Animaux acceptés", "Couples acceptés", "Pièce d’identité demandée", "Caution demandée"].map((item) => `<label class="choice-card"><input type="checkbox"><span>${item}</span></label>`).join("")}</div><label class="form-field"><span>Frais supplémentaires éventuels</span><textarea></textarea></label></section>`,
      HotelAvailabilityCalendar(),
      BookingRulesSettings(),
      `<section class="step-card"><h2>Moyens de contact</h2><div class="checkbox-list">${contactOptions.map(([key, label]) => `<label class="choice-card"><input type="checkbox" data-path="contactPreferences.${key}"${hotelDraft.contactPreferences[key] ? " checked" : ""}><span>${label}</span></label>`).join("")}</div><div class="form-grid"><label class="form-field"><span>Numéro WhatsApp</span><input type="tel"></label><label class="form-field"><span>Numéro téléphone</span><input type="tel"></label><label class="form-field"><span>Email de contact</span><input type="email"></label><label class="form-field"><span>Email de notification</span><input type="email"></label></div></section>`,
      `<section class="step-card"><h2>Prévisualisation</h2><div class="preview-box"><div class="preview-photo">Aperçu de l’hébergement</div><strong>${hotelDraft.general.name || "Nom de l’établissement"}</strong><span>${hotelDraft.type || "Type d’hébergement"}</span><p>${hotelDraft.general.description || "Description non renseignée."}</p></div></section>`,
      `<section class="step-card"><h2>Soumission</h2><p>Votre hébergement sera soumis avec le statut en attente de validation.</p><button class="btn btn-primary" type="button" data-submit-hotel>Soumettre l’hébergement</button></section>`
    ];
    return steps[currentHotelStep];
  }

  function hasContactMethod() {
    return contactOptions.some(([key]) => hotelDraft.contactPreferences[key]);
  }

  function validateHotelSubmit() {
    if (!hotelDraft.type) return "Veuillez sélectionner un type d’hébergement.";
    if (!hotelDraft.general.name) return "Veuillez renseigner le nom de l’établissement.";
    if (!hotelDraft.location.city) return "Veuillez renseigner la ville.";
    if (!hasContactMethod()) return "Veuillez activer au moins un moyen de contact.";
    return "";
  }

  function PublishHotelPage(error = "") {
    const progress = Math.round(((currentHotelStep + 1) / hotelSteps.length) * 100);
    document.querySelector("#publish-header").innerHTML = `
      <a class="brand" href="${routeHref(hotelRoutes.home)}"><span class="brand-mark">P</span><span><strong>Péncmi</strong><small>Publication hôtel</small></span></a>
      <div class="header-actions"><a class="btn btn-ghost" href="${routeHref(hotelRoutes.hotels)}">Hôtels</a><a class="btn btn-light" href="${routeHref(hotelRoutes.dashboard)}">Dashboard hôtels</a></div>
    `;
    document.querySelector("#publish-page").innerHTML = `
      <div class="publish-shell">
        <section class="publish-main">
          <div class="publish-top"><h1>Publier un hébergement</h1><p>Étape ${currentHotelStep + 1} sur 13</p><div class="progress-track"><div class="progress-bar" style="width:${progress}%"></div></div></div>
          <div class="stepper">${hotelSteps.map((step, index) => `<span class="step-pill${index === currentHotelStep ? " is-active" : ""}">${index + 1}. ${step}</span>`).join("")}</div>
          ${stepContent()}
          ${error ? `<div class="form-error">${error}</div>` : ""}
          ${hotelStatusMessage ? `<div class="status-message">${hotelStatusMessage}</div>` : ""}
          <div class="publish-nav"><div class="publish-nav-group"><button class="btn btn-ghost" type="button" data-prev-hotel${currentHotelStep === 0 ? " disabled" : ""}>Retour</button><button class="btn btn-light" type="button" data-draft-hotel>Enregistrer en brouillon</button></div><div class="publish-nav-group"><button class="btn btn-ghost" type="button" data-preview-hotel>Prévisualiser</button><button class="btn btn-primary" type="button" data-next-hotel>${currentHotelStep < hotelSteps.length - 1 ? "Suivant" : "Soumettre"}</button></div></div>
        </section>
        <aside class="draft-summary"><h2>Résumé</h2><div class="completion-score">Mode conseillé : Semi-automatique</div><div class="summary-list"><div class="summary-item"><span>Type</span><strong>${hotelDraft.type || "Non renseigné"}</strong></div><div class="summary-item"><span>Établissement</span><strong>${hotelDraft.general.name || "Non renseigné"}</strong></div><div class="summary-item"><span>Ville</span><strong>${hotelDraft.location.city || "Non renseignée"}</strong></div></div></aside>
      </div>
    `;
    bindHotelPublishEvents();
  }

  function bindHotelPublishEvents() {
    document.querySelectorAll("[data-path]").forEach((input) => {
      input.addEventListener("change", () => {
        const value = input.type === "checkbox" ? input.checked : input.value;
        setHotelValue(input.dataset.path, value);
        hotelStatusMessage = "";
        PublishHotelPage();
      });
    });
    document.querySelectorAll("[data-amenity]").forEach((input) => {
      input.addEventListener("change", () => {
        hotelDraft.amenities = input.checked ? [...hotelDraft.amenities, input.dataset.amenity] : hotelDraft.amenities.filter((item) => item !== input.dataset.amenity);
        PublishHotelPage();
      });
    });
    document.querySelector("[data-prev-hotel]")?.addEventListener("click", () => {
      currentHotelStep = Math.max(0, currentHotelStep - 1);
      PublishHotelPage();
    });
    document.querySelector("[data-next-hotel]")?.addEventListener("click", () => {
      if (currentHotelStep === hotelSteps.length - 1) {
        const error = validateHotelSubmit();
        if (error) {
          PublishHotelPage(error);
          return;
        }
        hotelStatusMessage = "Votre hébergement a été soumis avec succès.";
        PublishHotelPage();
        return;
      }
      currentHotelStep += 1;
      PublishHotelPage();
    });
    document.querySelector("[data-preview-hotel]")?.addEventListener("click", () => {
      currentHotelStep = 11;
      PublishHotelPage();
    });
    document.querySelector("[data-draft-hotel]")?.addEventListener("click", () => {
      hotelStatusMessage = "Brouillon enregistré.";
      PublishHotelPage();
    });
  }

  setTimeout(() => PublishHotelPage(), 0);
}

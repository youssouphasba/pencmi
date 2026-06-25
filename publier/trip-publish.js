const tripCategory = new URLSearchParams(window.location.search).get("category") === "voyage";

if (tripCategory) {
  const tripRoutes = {
    home: "/",
    trips: "/voyages",
    dashboard: "/dashboard/voyages",
    listings: "/dashboard/voyages/trajets"
  };

  const tripSteps = [
    "Type de trajet",
    "Départ et arrivée",
    "Date et horaires",
    "Véhicule",
    "Places et prix",
    "Conditions",
    "Description",
    "Moyens de contact",
    "Prévisualisation",
    "Soumission"
  ];

  const vehicleTypes = ["Bus", "Car", "Minibus", "7 places", "Voiture particulière", "Covoiturage", "Véhicule avec chauffeur"];
  const conditionOptions = ["Bagages acceptés", "Gros bagages acceptés", "Enfants acceptés", "Animaux acceptés", "Non-fumeur", "Départ direct", "Arrêts limités", "Annulation possible", "Paiement sur place", "Réservation sans paiement immédiat"];
  const contactOptions = [["whatsappEnabled", "WhatsApp"], ["phoneEnabled", "Appel téléphonique"], ["emailEnabled", "Email"], ["internalMessagingEnabled", "Messagerie interne"], ["contactFormEnabled", "Formulaire"], ["reservationRequestEnabled", "Demande de réservation"], ["emailNotificationsEnabled", "Notifications email"]];

  let currentTripStep = 0;
  let tripStatusMessage = "";
  let tripDraft = {
    vehicleType: "",
    route: {},
    schedule: {},
    vehicle: {},
    pricing: {},
    conditions: [],
    content: {},
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
    if (path === tripRoutes.home) return "../index.html";
    if (path === tripRoutes.trips) return "../voyages/";
    if (path === tripRoutes.dashboard) return "../dashboard/voyages/";
    if (path === tripRoutes.listings) return "../dashboard/voyages/trajets/";
    return path;
  }

  function setTripValue(path, value) {
    const keys = path.split(".");
    let target = tripDraft;
    keys.slice(0, -1).forEach((key) => {
      target[key] = target[key] || {};
      target = target[key];
    });
    target[keys[keys.length - 1]] = value;
  }

  function optionsGrid(values, path, currentValue = "") {
    return `<div class="option-grid">${values.map((value) => `<label class="choice-card"><input type="radio" name="${path}" data-path="${path}" value="${value}"${currentValue === value ? " checked" : ""}><span>${value}</span></label>`).join("")}</div>`;
  }

  function checkList(values) {
    return `<div class="checkbox-list">${values.map((value) => `<label class="choice-card"><input type="checkbox" data-condition="${value}"${tripDraft.conditions.includes(value) ? " checked" : ""}><span>${value}</span></label>`).join("")}</div>`;
  }

  function stepContent() {
    const steps = [
      `<section class="step-card"><h2>Type de trajet</h2>${optionsGrid(vehicleTypes, "vehicleType", tripDraft.vehicleType)}</section>`,
      `<section class="step-card"><h2>Départ et arrivée</h2><div class="form-grid"><label class="form-field"><span>Ville de départ</span><input data-path="route.departureCity" type="text"></label><label class="form-field"><span>Gare ou point de départ</span><input data-path="route.departurePoint" type="text"></label><label class="form-field"><span>Ville d’arrivée</span><input data-path="route.arrivalCity" type="text"></label><label class="form-field"><span>Gare ou point d’arrivée</span><input data-path="route.arrivalPoint" type="text"></label><label class="form-field full"><span>Quartiers ou points de rendez-vous</span><textarea data-path="route.meetingPoints"></textarea></label><label class="choice-card"><input type="checkbox" data-path="route.approximate"><span>Localisation approximative si utile</span></label></div></section>`,
      `<section class="step-card"><h2>Date et horaires</h2><div class="form-grid"><label class="form-field"><span>Date du voyage</span><input data-path="schedule.date" type="date"></label><label class="form-field"><span>Heure de départ</span><input data-path="schedule.departureTime" type="time"></label><label class="form-field"><span>Heure d’arrivée estimée</span><input data-path="schedule.arrivalTime" type="time"></label><label class="choice-card"><input type="checkbox" data-path="schedule.regular"><span>Trajet régulier</span></label><label class="form-field"><span>Jours de circulation</span><input data-path="schedule.regularDays" type="text"></label><label class="form-field"><span>Période de validité</span><input data-path="schedule.validityPeriod" type="text"></label></div></section>`,
      `<section class="step-card"><h2>Véhicule</h2><div class="form-grid"><label class="form-field"><span>Type de véhicule</span><select data-path="vehicle.type">${vehicleTypes.map((type) => `<option>${type}</option>`).join("")}</select></label><label class="form-field"><span>Marque</span><input data-path="vehicle.brand" type="text"></label><label class="form-field"><span>Modèle</span><input data-path="vehicle.model" type="text"></label><label class="form-field"><span>Nombre total de places</span><input data-path="vehicle.totalSeats" type="number" min="1"></label><label class="choice-card"><input type="checkbox" data-path="vehicle.airConditioning"><span>Climatisation</span></label><label class="choice-card"><input type="checkbox" data-path="vehicle.hidePlate"><span>Immatriculation masquée si nécessaire</span></label></div></section>`,
      `<section class="step-card"><h2>Places et prix</h2><div class="form-grid"><label class="form-field"><span>Places disponibles</span><input data-path="pricing.availableSeats" type="number" min="1"></label><label class="form-field"><span>Prix par personne</span><input data-path="pricing.pricePerSeat" type="number" min="0"></label><label class="form-field"><span>Devise</span><input value="FCFA" disabled></label><label class="choice-card"><input type="checkbox" data-path="pricing.luggageIncluded"><span>Bagages inclus</span></label><label class="form-field"><span>Supplément bagage</span><input data-path="pricing.luggageFee" type="number" min="0"></label><label class="choice-card"><input type="checkbox" data-path="pricing.negotiable"><span>Prix négociable</span></label></div></section>`,
      `<section class="step-card"><h2>Conditions</h2>${checkList(conditionOptions)}</section>`,
      `<section class="step-card"><h2>Description</h2><div class="form-grid single"><label class="form-field"><span>Titre du trajet</span><input data-path="content.title" type="text"></label><label class="form-field"><span>Description</span><textarea data-path="content.description"></textarea></label><label class="form-field"><span>Consignes particulières</span><textarea data-path="content.instructions"></textarea></label></div></section>`,
      `<section class="step-card"><h2>Moyens de contact</h2><div class="checkbox-list">${contactOptions.map(([key, label]) => `<label class="choice-card"><input type="checkbox" data-path="contactPreferences.${key}"${tripDraft.contactPreferences[key] ? " checked" : ""}><span>${label}</span></label>`).join("")}</div><div class="form-grid"><label class="form-field"><span>Numéro WhatsApp</span><input type="tel"></label><label class="form-field"><span>Numéro téléphone</span><input type="tel"></label><label class="form-field"><span>Email de contact</span><input type="email"></label><label class="form-field"><span>Email de notification</span><input type="email"></label></div></section>`,
      `<section class="step-card"><h2>Prévisualisation</h2><div class="preview-box"><strong>${tripDraft.content.title || "Titre du trajet"}</strong><span>${[tripDraft.route.departureCity, tripDraft.route.arrivalCity].filter(Boolean).join(" → ") || "Départ → arrivée"}</span><p>${tripDraft.content.description || "Description non renseignée."}</p></div></section>`,
      `<section class="step-card"><h2>Soumission</h2><p>Votre trajet sera soumis avec le statut en attente de validation.</p><button class="btn btn-primary" type="button" data-submit-trip>Soumettre le trajet</button></section>`
    ];
    return steps[currentTripStep];
  }

  function hasContactMethod() {
    return contactOptions.some(([key]) => tripDraft.contactPreferences[key]);
  }

  function validateTripSubmit() {
    if (!tripDraft.vehicleType) return "Veuillez sélectionner un type de trajet.";
    if (!tripDraft.route.departureCity || !tripDraft.route.arrivalCity) return "Veuillez renseigner le départ et l’arrivée.";
    if (!tripDraft.schedule.date || !tripDraft.schedule.departureTime) return "Veuillez renseigner la date et l’heure de départ.";
    if (!tripDraft.pricing.availableSeats || !tripDraft.pricing.pricePerSeat) return "Veuillez renseigner les places et le prix.";
    if (!hasContactMethod()) return "Veuillez activer au moins un moyen de contact.";
    return "";
  }

  function PublishTripPage(error = "") {
    const progress = Math.round(((currentTripStep + 1) / tripSteps.length) * 100);
    document.querySelector("#publish-header").innerHTML = `<a class="brand" href="${routeHref(tripRoutes.home)}"><span class="brand-mark">P</span><span><strong>Péncmi</strong><small>Publication voyage</small></span></a><div class="header-actions"><a class="btn btn-ghost" href="${routeHref(tripRoutes.trips)}">Voyages</a><a class="btn btn-light" href="${routeHref(tripRoutes.dashboard)}">Dashboard voyages</a></div>`;
    document.querySelector("#publish-page").innerHTML = `
      <div class="publish-shell">
        <section class="publish-main">
          <div class="publish-top"><h1>Publier un trajet</h1><p>Étape ${currentTripStep + 1} sur 10</p><div class="progress-track"><div class="progress-bar" style="width:${progress}%"></div></div></div>
          <div class="stepper">${tripSteps.map((step, index) => `<span class="step-pill${index === currentTripStep ? " is-active" : ""}">${index + 1}. ${step}</span>`).join("")}</div>
          ${stepContent()}
          ${error ? `<div class="form-error">${error}</div>` : ""}
          ${tripStatusMessage ? `<div class="status-message">${tripStatusMessage}</div>` : ""}
          <div class="publish-nav"><div class="publish-nav-group"><button class="btn btn-ghost" type="button" data-prev-trip${currentTripStep === 0 ? " disabled" : ""}>Retour</button><button class="btn btn-light" type="button" data-draft-trip>Enregistrer en brouillon</button></div><div class="publish-nav-group"><button class="btn btn-ghost" type="button" data-preview-trip>Prévisualiser</button><button class="btn btn-primary" type="button" data-next-trip>${currentTripStep < tripSteps.length - 1 ? "Suivant" : "Soumettre"}</button></div></div>
        </section>
        <aside class="draft-summary"><h2>Résumé</h2><div class="summary-list"><div class="summary-item"><span>Type</span><strong>${tripDraft.vehicleType || "Non renseigné"}</strong></div><div class="summary-item"><span>Trajet</span><strong>${[tripDraft.route.departureCity, tripDraft.route.arrivalCity].filter(Boolean).join(" → ") || "Non renseigné"}</strong></div><div class="summary-item"><span>Places</span><strong>${tripDraft.pricing.availableSeats || "Non renseigné"}</strong></div></div></aside>
      </div>
    `;
    bindTripPublishEvents();
  }

  function bindTripPublishEvents() {
    document.querySelectorAll("[data-path]").forEach((input) => {
      input.addEventListener("change", () => {
        const value = input.type === "checkbox" ? input.checked : input.value;
        setTripValue(input.dataset.path, value);
        tripStatusMessage = "";
        PublishTripPage();
      });
    });
    document.querySelectorAll("[data-condition]").forEach((input) => {
      input.addEventListener("change", () => {
        tripDraft.conditions = input.checked ? [...tripDraft.conditions, input.dataset.condition] : tripDraft.conditions.filter((item) => item !== input.dataset.condition);
        PublishTripPage();
      });
    });
    document.querySelector("[data-prev-trip]")?.addEventListener("click", () => {
      currentTripStep = Math.max(0, currentTripStep - 1);
      PublishTripPage();
    });
    document.querySelector("[data-next-trip]")?.addEventListener("click", () => {
      if (currentTripStep === tripSteps.length - 1) {
        const error = validateTripSubmit();
        if (error) {
          PublishTripPage(error);
          return;
        }
        tripStatusMessage = "Votre trajet a été soumis avec succès.";
        PublishTripPage();
        return;
      }
      currentTripStep += 1;
      PublishTripPage();
    });
    document.querySelector("[data-preview-trip]")?.addEventListener("click", () => {
      currentTripStep = 8;
      PublishTripPage();
    });
    document.querySelector("[data-draft-trip]")?.addEventListener("click", () => {
      tripStatusMessage = "Brouillon enregistré.";
      PublishTripPage();
    });
  }

  setTimeout(() => PublishTripPage(), 0);
}

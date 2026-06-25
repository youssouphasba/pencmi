const vehicleCategory = new URLSearchParams(window.location.search).get("category") === "voiture";

if (vehicleCategory) {
  const vehicleRoutes = {
    home: "/",
    vehicles: "/voitures",
    dashboard: "/dashboard/voitures",
    listings: "/dashboard/voitures/annonces"
  };

  const vehicleSteps = [
    "Type d’annonce",
    "Marque et modèle",
    "Informations véhicule",
    "Localisation",
    "Prix",
    "Photos",
    "Équipements",
    "Documents",
    "Description",
    "Moyens de contact",
    "Prévisualisation",
    "Soumission"
  ];

  const vehicleBrands = ["Toyota", "Hyundai", "Kia", "Peugeot", "Renault", "Mercedes-Benz", "BMW", "Audi", "Volkswagen", "Ford", "Nissan", "Mitsubishi", "Suzuki", "Honda", "Chevrolet", "Citroën", "Dacia", "Land Rover", "Lexus", "Mazda", "Opel", "Fiat", "Jeep", "Autre"];
  const vehicleEquipment = ["Climatisation", "Caméra de recul", "Radar de recul", "GPS", "Bluetooth", "Cuir", "Toit ouvrant", "Jantes aluminium", "4 roues motrices", "Airbags", "ABS"];
  const vehicleDocuments = ["Carte grise", "Assurance", "Visite technique", "Dédouanement", "Carnet d’entretien", "Facture disponible"];
  const contactOptions = [["whatsappEnabled", "WhatsApp"], ["phoneEnabled", "Appel téléphonique"], ["emailEnabled", "Email"], ["internalMessagingEnabled", "Messagerie interne"], ["contactFormEnabled", "Formulaire"], ["emailNotificationsEnabled", "Notifications email"]];

  let currentVehicleStep = 0;
  let vehicleStatusMessage = "";
  let vehicleDraft = {
    listingType: "",
    identity: {},
    info: {},
    location: {},
    pricing: {},
    equipment: [],
    documents: [],
    content: {},
    contactPreferences: {
      whatsappEnabled: false,
      phoneEnabled: false,
      emailEnabled: false,
      internalMessagingEnabled: false,
      contactFormEnabled: false,
      emailNotificationsEnabled: false
    }
  };

  function routeHref(path) {
    if (window.location.protocol !== "file:") return path;
    if (path === vehicleRoutes.home) return "../index.html";
    if (path === vehicleRoutes.vehicles) return "../voitures/";
    if (path === vehicleRoutes.dashboard) return "../dashboard/voitures/";
    if (path === vehicleRoutes.listings) return "../dashboard/voitures/annonces/";
    return path;
  }

  function setVehicleValue(path, value) {
    const keys = path.split(".");
    let target = vehicleDraft;
    keys.slice(0, -1).forEach((key) => {
      target[key] = target[key] || {};
      target = target[key];
    });
    target[keys[keys.length - 1]] = value;
  }

  function optionsGrid(values, path, currentValue = "") {
    return `<div class="option-grid">${values.map((value) => `<label class="choice-card"><input type="radio" name="${path}" data-path="${path}" value="${value}"${currentValue === value ? " checked" : ""}><span>${value}</span></label>`).join("")}</div>`;
  }

  function checkList(values, storeKey) {
    return `<div class="checkbox-list">${values.map((value) => `<label class="choice-card"><input type="checkbox" data-list="${storeKey}" value="${value}"${vehicleDraft[storeKey].includes(value) ? " checked" : ""}><span>${value}</span></label>`).join("")}</div>`;
  }

  function stepContent() {
    const regions = (window.SENEGAL_LOCATIONS || []).map((item) => `<option>${item.region}</option>`).join("");
    const steps = [
      `<section class="step-card"><h2>Type d’annonce</h2>${optionsGrid(["Vente", "Location", "Avec chauffeur"], "listingType", vehicleDraft.listingType)}</section>`,
      `<section class="step-card"><h2>Marque et modèle</h2><div class="form-grid"><label class="form-field"><span>Marque</span><select data-path="identity.brand"><option value="">Marque</option>${vehicleBrands.map((brand) => `<option>${brand}</option>`).join("")}</select></label><label class="form-field"><span>Modèle</span><input data-path="identity.model" type="text"></label><label class="form-field"><span>Version</span><input data-path="identity.version" type="text"></label><label class="form-field"><span>Année</span><input data-path="identity.year" type="number" min="1900"></label></div></section>`,
      `<section class="step-card"><h2>Informations véhicule</h2><div class="form-grid"><label class="form-field"><span>Kilométrage</span><input data-path="info.mileage" type="number" min="0"></label><label class="form-field"><span>Carburant</span><select data-path="info.fuel"><option>Essence</option><option>Diesel</option><option>Hybride</option><option>Électrique</option><option>GPL</option></select></label><label class="form-field"><span>Boîte de vitesse</span><select data-path="info.gearbox"><option>Manuelle</option><option>Automatique</option></select></label><label class="form-field"><span>Type de véhicule</span><select data-path="info.category"><option>Citadine</option><option>Berline</option><option>SUV</option><option>4x4</option><option>Pick-up</option><option>Monospace</option><option>Utilitaire</option><option>Camion</option><option>Bus</option><option>Minibus</option><option>Moto</option><option>Autre</option></select></label><label class="form-field"><span>Nombre de places</span><input data-path="info.seats" type="number" min="1"></label><label class="form-field"><span>Couleur</span><input data-path="info.color" type="text"></label><label class="form-field"><span>État</span><select data-path="info.condition"><option>Neuf</option><option>Occasion</option><option>Importé</option><option>Déjà immatriculé au Sénégal</option><option>À dédouaner</option></select></label><label class="form-field"><span>Puissance</span><input data-path="info.power" type="text"></label></div></section>`,
      `<section class="step-card"><h2>Localisation</h2><div class="form-grid"><label class="form-field"><span>Région</span><select data-path="location.region"><option value="">Sélectionner une région</option>${regions}</select></label><label class="form-field"><span>Ville</span><input data-path="location.city" type="text"></label><label class="form-field"><span>Quartier</span><input data-path="location.district" type="text"></label><label class="form-field full"><span>Adresse ou indication</span><input data-path="location.addressHint" type="text"></label><label class="choice-card"><input type="checkbox" data-path="location.approximate"><span>Localisation approximative</span></label></div></section>`,
      `<section class="step-card"><h2>Prix</h2><div class="form-grid"><label class="form-field"><span>Prix total</span><input data-path="pricing.price" type="number" min="0"></label><label class="choice-card"><input type="checkbox" data-path="pricing.negotiable"><span>Prix négociable</span></label><label class="form-field"><span>Prix par jour</span><input data-path="pricing.pricePerDay" type="number" min="0"></label><label class="form-field"><span>Prix par semaine</span><input data-path="pricing.pricePerWeek" type="number" min="0"></label><label class="form-field"><span>Prix par mois</span><input data-path="pricing.pricePerMonth" type="number" min="0"></label><label class="form-field"><span>Caution</span><input data-path="pricing.deposit" type="number" min="0"></label><label class="form-field"><span>Kilométrage inclus</span><input data-path="pricing.includedMileage" type="text"></label><label class="form-field"><span>Prix par course</span><input data-path="pricing.pricePerTrip" type="number" min="0"></label><label class="form-field full"><span>Zones couvertes / services proposés</span><textarea data-path="pricing.coveredAreas"></textarea></label></div></section>`,
      `<section class="step-card"><h2>Photos</h2><div class="photo-dropzone"><div><strong>Upload multiple prévu</strong><p>Photo principale, aperçu, ordre, suppression et limite future de 30 photos.</p><input type="file" multiple accept=".jpg,.jpeg,.png,.webp"></div></div></section>`,
      `<section class="step-card"><h2>Équipements</h2>${checkList(vehicleEquipment, "equipment")}</section>`,
      `<section class="step-card"><h2>Documents</h2>${checkList(vehicleDocuments, "documents")}</section>`,
      `<section class="step-card"><h2>Description</h2><div class="form-grid single"><label class="form-field"><span>Titre</span><input data-path="content.title" type="text"></label><label class="form-field"><span>Description</span><textarea data-path="content.description"></textarea></label></div></section>`,
      `<section class="step-card"><h2>Moyens de contact</h2><div class="checkbox-list">${contactOptions.map(([key, label]) => `<label class="choice-card"><input type="checkbox" data-path="contactPreferences.${key}"${vehicleDraft.contactPreferences[key] ? " checked" : ""}><span>${label}</span></label>`).join("")}</div><div class="form-grid"><label class="form-field"><span>Numéro WhatsApp</span><input type="tel"></label><label class="form-field"><span>Numéro téléphone</span><input type="tel"></label><label class="form-field"><span>Email de contact</span><input type="email"></label><label class="form-field"><span>Email de notification</span><input type="email"></label></div></section>`,
      `<section class="step-card"><h2>Prévisualisation</h2><div class="preview-box"><div class="preview-photo">Aperçu véhicule</div><strong>${vehicleDraft.content.title || "Titre de l’annonce"}</strong><span>${[vehicleDraft.identity.brand, vehicleDraft.identity.model].filter(Boolean).join(" ") || "Marque et modèle"}</span><p>${vehicleDraft.content.description || "Description non renseignée."}</p></div></section>`,
      `<section class="step-card"><h2>Soumission</h2><p>Votre annonce voiture sera soumise avec le statut en attente de validation.</p><button class="btn btn-primary" type="button" data-submit-vehicle>Soumettre l’annonce</button></section>`
    ];
    return steps[currentVehicleStep];
  }

  function hasContactMethod() {
    return contactOptions.some(([key]) => vehicleDraft.contactPreferences[key]);
  }

  function validateVehicleSubmit() {
    if (!vehicleDraft.listingType) return "Veuillez sélectionner un type d’annonce.";
    if (!vehicleDraft.identity.brand || !vehicleDraft.identity.model) return "Veuillez renseigner la marque et le modèle.";
    if (!vehicleDraft.location.city) return "Veuillez renseigner la ville.";
    if (!vehicleDraft.content.title) return "Veuillez ajouter un titre.";
    if (!hasContactMethod()) return "Veuillez activer au moins un moyen de contact.";
    return "";
  }

  function PublishVehiclePage(error = "") {
    const progress = Math.round(((currentVehicleStep + 1) / vehicleSteps.length) * 100);
    document.querySelector("#publish-header").innerHTML = `<a class="brand" href="${routeHref(vehicleRoutes.home)}"><span class="brand-mark">P</span><span><strong>Péncmi</strong><small>Publication voiture</small></span></a><div class="header-actions"><a class="btn btn-ghost" href="${routeHref(vehicleRoutes.vehicles)}">Voitures</a><a class="btn btn-light" href="${routeHref(vehicleRoutes.dashboard)}">Dashboard voitures</a></div>`;
    document.querySelector("#publish-page").innerHTML = `
      <div class="publish-shell">
        <section class="publish-main">
          <div class="publish-top"><h1>Publier une voiture</h1><p>Étape ${currentVehicleStep + 1} sur 12</p><div class="progress-track"><div class="progress-bar" style="width:${progress}%"></div></div></div>
          <div class="stepper">${vehicleSteps.map((step, index) => `<span class="step-pill${index === currentVehicleStep ? " is-active" : ""}">${index + 1}. ${step}</span>`).join("")}</div>
          ${stepContent()}
          ${error ? `<div class="form-error">${error}</div>` : ""}
          ${vehicleStatusMessage ? `<div class="status-message">${vehicleStatusMessage}</div>` : ""}
          <div class="publish-nav"><div class="publish-nav-group"><button class="btn btn-ghost" type="button" data-prev-vehicle${currentVehicleStep === 0 ? " disabled" : ""}>Retour</button><button class="btn btn-light" type="button" data-draft-vehicle>Enregistrer en brouillon</button></div><div class="publish-nav-group"><button class="btn btn-ghost" type="button" data-preview-vehicle>Prévisualiser</button><button class="btn btn-primary" type="button" data-next-vehicle>${currentVehicleStep < vehicleSteps.length - 1 ? "Suivant" : "Soumettre"}</button></div></div>
        </section>
        <aside class="draft-summary"><h2>Résumé</h2><div class="summary-list"><div class="summary-item"><span>Type</span><strong>${vehicleDraft.listingType || "Non renseigné"}</strong></div><div class="summary-item"><span>Véhicule</span><strong>${[vehicleDraft.identity.brand, vehicleDraft.identity.model].filter(Boolean).join(" ") || "Non renseigné"}</strong></div><div class="summary-item"><span>Ville</span><strong>${vehicleDraft.location.city || "Non renseignée"}</strong></div></div></aside>
      </div>
    `;
    bindVehiclePublishEvents();
  }

  function bindVehiclePublishEvents() {
    document.querySelectorAll("[data-path]").forEach((input) => {
      input.addEventListener("change", () => {
        const value = input.type === "checkbox" ? input.checked : input.value;
        setVehicleValue(input.dataset.path, value);
        vehicleStatusMessage = "";
        PublishVehiclePage();
      });
    });
    document.querySelectorAll("[data-list]").forEach((input) => {
      input.addEventListener("change", () => {
        const key = input.dataset.list;
        vehicleDraft[key] = input.checked ? [...vehicleDraft[key], input.value] : vehicleDraft[key].filter((item) => item !== input.value);
        PublishVehiclePage();
      });
    });
    document.querySelector("[data-prev-vehicle]")?.addEventListener("click", () => {
      currentVehicleStep = Math.max(0, currentVehicleStep - 1);
      PublishVehiclePage();
    });
    document.querySelector("[data-next-vehicle]")?.addEventListener("click", () => {
      if (currentVehicleStep === vehicleSteps.length - 1) {
        const error = validateVehicleSubmit();
        if (error) {
          PublishVehiclePage(error);
          return;
        }
        vehicleStatusMessage = "Votre annonce voiture a été soumise avec succès.";
        PublishVehiclePage();
        return;
      }
      currentVehicleStep += 1;
      PublishVehiclePage();
    });
    document.querySelector("[data-preview-vehicle]")?.addEventListener("click", () => {
      currentVehicleStep = 10;
      PublishVehiclePage();
    });
    document.querySelector("[data-draft-vehicle]")?.addEventListener("click", () => {
      vehicleStatusMessage = "Brouillon enregistré.";
      PublishVehiclePage();
    });
  }

  setTimeout(() => PublishVehiclePage(), 0);
}

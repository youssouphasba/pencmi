const routes = {
  home: "/",
  realEstate: "/immobilier",
  hotels: "/hotels",
  vehicles: "/voitures",
  trips: "/voyages",
  dashboard: "/dashboard",
  dashboardListings: "/dashboard/listings/immobilier",
  loginRedirect: "/login?next=/publier?category=immobilier"
};

const publishSteps = [
  "Type d’annonce",
  "Type de bien",
  "Localisation",
  "Prix",
  "Caractéristiques",
  "Photos",
  "Description",
  "Conditions",
  "Documents",
  "Moyens de contact",
  "Prévisualisation",
  "Soumission"
];

const propertyTypes = ["appartement", "maison", "villa", "terrain", "studio", "chambre", "bureau", "commerce"];
const featureOptions = [
  ["furnished", "Meublé"],
  ["parking", "Parking"],
  ["balcony", "Balcon"],
  ["terrace", "Terrasse"],
  ["pool", "Piscine"],
  ["airConditioning", "Climatisation"],
  ["securityGuard", "Gardien"],
  ["generator", "Groupe électrogène"],
  ["individualElectricityMeter", "Compteur SENELEC individuel"],
  ["waterAvailable", "Eau disponible"]
];
const documentOptions = [
  ["titre_foncier", "Titre foncier"],
  ["bail", "Bail"],
  ["deliberation", "Délibération"],
  ["nicad", "NICAD"],
  ["plan", "Plan du terrain"],
  ["building_permit", "Autorisation de construire"],
  ["other", "Autre document"]
];
const contactOptions = [
  ["whatsappEnabled", "WhatsApp"],
  ["phoneEnabled", "Appel téléphonique"],
  ["emailEnabled", "Email"],
  ["internalMessagingEnabled", "Messagerie interne Péncmi"],
  ["contactFormEnabled", "Formulaire de demande"],
  ["visitRequestEnabled", "Demande de visite"]
];

let currentStep = 0;
let statusMessage = "";
let draft = {
  status: "draft",
  location: { country: "SN", isApproximateLocation: false },
  pricing: { currency: "FCFA", pricePeriod: "month", negotiable: false },
  features: {},
  photos: [],
  content: {},
  conditions: {},
  documents: documentOptions.map(([type, label]) => ({ type, label, available: false })),
  contactPreferences: {
    whatsappEnabled: false,
    phoneEnabled: false,
    emailEnabled: false,
    internalMessagingEnabled: false,
    contactFormEnabled: false,
    visitRequestEnabled: false,
    emailNotificationsEnabled: false
  }
};

function routeHref(path) {
  if (window.location.protocol !== "file:") {
    return path;
  }

  if (path === "/") {
    return "../index.html";
  }

  if (path === "/immobilier") {
    return "../immobilier/";
  }

  if (path === "/dashboard" || path.startsWith("/dashboard/listings/immobilier")) {
    return "../dashboard/immobilier/";
  }

  return path;
}

function buildPublishRedirect() {
  return routes.loginRedirect;
}

function formatPriceFCFA(value) {
  return value ? `${Number(value).toLocaleString("fr-FR")} FCFA` : "";
}

function normalizePhoneNumber(value) {
  return String(value || "").replace(/[^\d+]/g, "");
}

function validateEmail(value) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function slugLabel(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function calculateListingCompletionScore(listing) {
  const checks = [
    Boolean(listing.transaction),
    Boolean(listing.propertyType),
    Boolean(listing.location?.region),
    Boolean(listing.location?.city),
    Boolean(listing.pricing?.price),
    Boolean(listing.content?.title),
    Boolean(listing.content?.description),
    Boolean(listing.photos?.length),
    Object.values(listing.features || {}).some(Boolean),
    Object.values(listing.conditions || {}).some(Boolean),
    Object.values(listing.contactPreferences || {}).some(Boolean),
    !listing.contactPreferences?.internalMessagingEnabled || Boolean(listing.contactPreferences?.notificationEmail)
  ];

  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function validatePublishStep(stepIndex) {
  if (stepIndex === 0 && !draft.transaction) {
    return "Veuillez sélectionner un type d’annonce.";
  }

  if (stepIndex === 1 && !draft.propertyType) {
    return "Veuillez sélectionner un type de bien.";
  }

  if (stepIndex === 2 && (!draft.location?.region || !draft.location?.city)) {
    return "Veuillez renseigner la région et la ville.";
  }

  if (stepIndex === 3 && !draft.pricing?.price) {
    return "Veuillez renseigner un prix.";
  }

  if (stepIndex === 6 && !draft.content?.title) {
    return "Veuillez ajouter un titre.";
  }

  if (stepIndex === 9 && !hasContactMethod()) {
    return "Veuillez choisir au moins un moyen de contact.";
  }

  return "";
}

function hasContactMethod() {
  return contactOptions.some(([key]) => draft.contactPreferences[key]);
}

function optionLabel(value) {
  const labels = {
    location: "Location",
    vente: "Vente",
    achat: "Achat",
    appartement: "Appartement",
    maison: "Maison",
    villa: "Villa",
    terrain: "Terrain",
    studio: "Studio",
    chambre: "Chambre",
    bureau: "Bureau",
    commerce: "Commerce",
    month: "Par mois",
    day: "Par jour",
    total: "Prix total"
  };

  return labels[value] || value || "Non renseigné";
}

function setNested(path, value) {
  const keys = path.split(".");
  let target = draft;

  keys.slice(0, -1).forEach((key) => {
    target[key] = target[key] || {};
    target = target[key];
  });

  target[keys[keys.length - 1]] = value;
}

function PublishHeader() {
  document.querySelector("#publish-header").innerHTML = `
    <a class="brand" href="${routeHref(routes.home)}" aria-label="Accueil Péncmi">
      <span class="brand-mark">P</span>
      <span>
        <strong>Péncmi</strong>
        <small>Publication immobilière</small>
      </span>
    </a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="main-menu" aria-label="Ouvrir le menu">
      <span></span><span></span><span></span>
    </button>
    <div class="header-panel" id="main-menu">
      <nav class="main-nav" aria-label="Navigation principale">
        <a href="${routeHref(routes.home)}">Accueil</a>
        <a href="${routeHref(routes.realEstate)}">Immobilier</a>
        <a href="${routes.hotels}">Hôtels</a>
        <a href="${routes.vehicles}">Voitures</a>
        <a href="${routes.trips}">Voyages interurbains</a>
      </nav>
      <div class="header-actions">
        <a class="btn btn-ghost" href="${routes.dashboard}">Mon espace</a>
        <a class="btn btn-light" href="${routes.dashboardListings}">Mes annonces</a>
      </div>
    </div>
  `;

  const toggle = document.querySelector(".menu-toggle");
  const panel = document.querySelector(".header-panel");

  toggle.addEventListener("click", () => {
    const isOpen = panel.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
}

function PublishStepper() {
  return `
    <div class="stepper">
      ${publishSteps.map((step, index) => `<span class="step-pill${index === currentStep ? " is-active" : ""}">${index + 1}. ${step}</span>`).join("")}
    </div>
  `;
}

function FormErrorMessage(message) {
  return message ? `<div class="form-error">${message}</div>` : "";
}

function choiceGroup(name, values, selectedValue, path) {
  return `<div class="option-grid">${values.map((value) => `
    <label class="choice-card">
      <input type="radio" name="${name}" value="${value}" data-path="${path}"${selectedValue === value ? " checked" : ""}>
      <span>${optionLabel(value)}</span>
    </label>
  `).join("")}</div>`;
}

function StepTransactionType() {
  return `
    <section class="step-card">
      <h2>Quel type d’annonce souhaitez-vous publier ?</h2>
      ${choiceGroup("transaction", ["location", "vente", "achat"], draft.transaction, "transaction")}
    </section>
  `;
}

function StepPropertyType() {
  return `
    <section class="step-card">
      <h2>Quel type de bien proposez-vous ?</h2>
      ${choiceGroup("propertyType", propertyTypes, draft.propertyType, "propertyType")}
    </section>
  `;
}

function locationOptions(values, selectedValue = "") {
  return values.map((value) => `<option value="${value}"${selectedValue === value ? " selected" : ""}>${value}</option>`).join("");
}

function getSelectedRegion() {
  return SENEGAL_LOCATIONS.find((location) => location.region === draft.location.region);
}

function RegionSelect() {
  return `
    <select data-path="location.region">
      <option value="">Sélectionner une région</option>
      ${locationOptions(SENEGAL_LOCATIONS.map((location) => location.region), draft.location.region)}
    </select>
  `;
}

function DepartmentSelect() {
  const departments = getSelectedRegion()?.departments || [];
  return `
    <select data-path="location.department">
      <option value="">Département</option>
      ${locationOptions(departments, draft.location.department)}
    </select>
  `;
}

function CitySelect() {
  const cities = getSelectedRegion()?.cities || [];
  return `
    <select data-path="location.city">
      <option value="">Ville</option>
      ${locationOptions(cities, draft.location.city)}
    </select>
  `;
}

function DistrictInput() {
  return `<input type="text" data-path="location.district" value="${draft.location.district || ""}" placeholder="Quartier">`;
}

function ApproximateLocationToggle() {
  return `
    <label class="choice-card">
      <input type="checkbox" data-path="location.isApproximateLocation"${draft.location.isApproximateLocation ? " checked" : ""}>
      <span>Masquer l’adresse exacte aux visiteurs</span>
    </label>
  `;
}

function SenegalLocationSelector() {
  return `
    <div class="form-grid">
      <label class="form-field"><span>Région</span>${RegionSelect()}</label>
      <label class="form-field"><span>Département</span>${DepartmentSelect()}</label>
      <label class="form-field"><span>Ville</span>${CitySelect()}</label>
      <label class="form-field"><span>Quartier</span>${DistrictInput()}</label>
      <label class="form-field full"><span>Adresse ou indication</span><input type="text" data-path="location.addressHint" value="${draft.location.addressHint || ""}" placeholder="Repère, axe ou indication utile"></label>
      <label class="form-field"><span>Latitude</span><input type="number" step="any" data-path="location.latitude" value="${draft.location.latitude || ""}"></label>
      <label class="form-field"><span>Longitude</span><input type="number" step="any" data-path="location.longitude" value="${draft.location.longitude || ""}"></label>
      <div class="form-field full">${ApproximateLocationToggle()}</div>
    </div>
  `;
}

function StepLocation() {
  return `
    <section class="step-card">
      <h2>Où se trouve le bien ?</h2>
      ${SenegalLocationSelector()}
    </section>
  `;
}

function StepPricing() {
  return `
    <section class="step-card">
      <h2>Quel est le prix ?</h2>
      <div class="form-grid">
        <label class="form-field"><span>Prix</span><input type="number" min="0" data-path="pricing.price" value="${draft.pricing.price || ""}"></label>
        <label class="form-field"><span>Devise</span><input type="text" value="FCFA" disabled></label>
        <label class="form-field"><span>Période</span><select data-path="pricing.pricePeriod">
          <option value="month"${draft.pricing.pricePeriod === "month" ? " selected" : ""}>Par mois</option>
          <option value="day"${draft.pricing.pricePeriod === "day" ? " selected" : ""}>Par jour</option>
          <option value="total"${draft.pricing.pricePeriod === "total" ? " selected" : ""}>Prix total</option>
        </select></label>
        <label class="choice-card"><input type="checkbox" data-path="pricing.negotiable"${draft.pricing.negotiable ? " checked" : ""}><span>Prix négociable</span></label>
      </div>
    </section>
  `;
}

function StepFeatures() {
  const numericFields = [
    ["surface", "Surface"],
    ["rooms", "Nombre de pièces"],
    ["bedrooms", "Nombre de chambres"],
    ["bathrooms", "Nombre de salles de bain"],
    ["floor", "Étage"],
    ["totalFloors", "Nombre total d’étages"]
  ];

  return `
    <section class="step-card">
      <h2>Ajoutez les caractéristiques du bien</h2>
      <div class="form-grid">
        ${numericFields.map(([key, label]) => `<label class="form-field"><span>${label}</span><input type="number" min="0" data-path="features.${key}" value="${draft.features[key] || ""}"></label>`).join("")}
      </div>
      <div class="checkbox-list">
        ${featureOptions.map(([key, label]) => `<label class="choice-card"><input type="checkbox" data-path="features.${key}"${draft.features[key] ? " checked" : ""}><span>${label}</span></label>`).join("")}
      </div>
    </section>
  `;
}

function StepPhotos() {
  return `
    <section class="step-card">
      <h2>Ajoutez des photos</h2>
      <p>Ajoutez des photos claires du bien pour augmenter vos chances d’être contacté.</p>
      <div class="photo-dropzone">
        <div>
          <strong>Sélection ou glisser-déposer prévu</strong>
          <p>Les annonces avec photos reçoivent plus de contacts.</p>
          <input type="file" multiple accept=".jpg,.jpeg,.png,.webp">
        </div>
      </div>
    </section>
  `;
}

function StepDescription() {
  return `
    <section class="step-card">
      <h2>Décrivez votre bien</h2>
      <div class="form-grid single">
        <label class="form-field"><span>Titre de l’annonce</span><input type="text" data-path="content.title" value="${draft.content.title || ""}" placeholder="Exemple : Appartement F3 lumineux à Dakar"></label>
        <label class="form-field"><span>Description</span><textarea data-path="content.description" maxlength="1200" placeholder="Décrivez le bien, le quartier, les conditions et les points forts.">${draft.content.description || ""}</textarea></label>
      </div>
      <p>${(draft.content.description || "").length}/1200 caractères</p>
    </section>
  `;
}

function StepConditions() {
  const fields = [
    ["deposit", "Caution"],
    ["advancePayment", "Avance"],
    ["agencyFee", "Commission agence"],
    ["charges", "Charges"],
    ["extraFees", "Frais supplémentaires"]
  ];

  return `
    <section class="step-card">
      <h2>Ajoutez les conditions</h2>
      <div class="form-grid">
        ${fields.map(([key, label]) => `<label class="form-field"><span>${label}</span><input type="number" min="0" data-path="conditions.${key}" value="${draft.conditions[key] || ""}"></label>`).join("")}
        <label class="form-field"><span>Disponible à partir de</span><input type="date" data-path="conditions.availableFrom" value="${draft.conditions.availableFrom || ""}"></label>
      </div>
      <div class="checkbox-list">
        <label class="choice-card"><input type="checkbox" data-path="conditions.noAgencyFee"${draft.conditions.noAgencyFee ? " checked" : ""}><span>Pas de commission agence</span></label>
        <label class="choice-card"><input type="checkbox" data-path="conditions.chargesIncluded"${draft.conditions.chargesIncluded ? " checked" : ""}><span>Charges incluses</span></label>
        <label class="choice-card"><input type="checkbox" data-path="conditions.availableImmediately"${draft.conditions.availableImmediately ? " checked" : ""}><span>Disponible immédiatement</span></label>
      </div>
    </section>
  `;
}

function StepDocuments() {
  return `
    <section class="step-card">
      <h2>Documents disponibles</h2>
      <p>Indiquez les documents disponibles pour rassurer les clients.</p>
      <div class="checkbox-list">
        ${draft.documents.map((document, index) => `<label class="choice-card"><input type="checkbox" data-document-index="${index}"${document.available ? " checked" : ""}><span>${document.label}</span></label>`).join("")}
      </div>
    </section>
  `;
}

function StepContactPreferences() {
  const preferences = draft.contactPreferences;

  return `
    <section class="step-card">
      <h2>Comment les clients peuvent-ils vous contacter ?</h2>
      <div class="checkbox-list">
        ${contactOptions.map(([key, label]) => `<label class="choice-card"><input type="checkbox" data-path="contactPreferences.${key}"${preferences[key] ? " checked" : ""}><span>${label}</span></label>`).join("")}
      </div>
      <div class="form-grid">
        <label class="form-field"><span>Numéro WhatsApp</span><input type="tel" data-path="contactPreferences.whatsappNumber" value="${preferences.whatsappNumber || ""}"></label>
        <label class="form-field"><span>Numéro de téléphone</span><input type="tel" data-path="contactPreferences.phoneNumber" value="${preferences.phoneNumber || ""}"></label>
        <label class="form-field"><span>Email de contact</span><input type="email" data-path="contactPreferences.contactEmail" value="${preferences.contactEmail || ""}"></label>
        <label class="form-field"><span>Email de notification</span><input type="email" data-path="contactPreferences.notificationEmail" value="${preferences.notificationEmail || ""}"></label>
      </div>
      <div class="checkbox-list">
        <label class="choice-card"><input type="checkbox" data-path="contactPreferences.emailNotificationsEnabled"${preferences.emailNotificationsEnabled ? " checked" : ""}><span>Recevoir une notification par email quand un client m’écrit</span></label>
        <label class="choice-card"><input type="checkbox" data-copy-contact-email><span>Utiliser le même email pour le contact et les notifications</span></label>
      </div>
    </section>
  `;
}

function StepPreview() {
  return `
    <section class="step-card">
      <h2>Prévisualisez votre annonce</h2>
      <p>Vérifiez les informations avant de soumettre votre annonce.</p>
      <div class="preview-box">
        <div class="preview-photo">Aperçu photo principale</div>
        <strong>${draft.content.title || "Titre de l’annonce"}</strong>
        <span>${formatPriceFCFA(draft.pricing.price) || "Prix non renseigné"}</span>
        <span>${[draft.location.city, draft.location.district].filter(Boolean).join(", ") || "Localisation non renseignée"}</span>
        <span>${optionLabel(draft.propertyType)} · ${optionLabel(draft.transaction)}</span>
        <p>${draft.content.description || "Description non renseignée."}</p>
        <div class="badge-row">${contactOptions.filter(([key]) => draft.contactPreferences[key]).map(([, label]) => `<span class="badge">${label}</span>`).join("")}</div>
        <button class="btn btn-ghost" type="button">Ajouter aux favoris</button>
      </div>
    </section>
  `;
}

function StepSubmit() {
  const submitted = draft.status === "pending_review";

  return `
    <section class="step-card">
      <h2>Soumettre l’annonce</h2>
      ${submitted ? `
        <div class="status-message">
          <strong>Votre annonce a été soumise avec succès.</strong>
          <p>Elle apparaîtra dans votre espace annonceur avec le statut en attente de validation.</p>
          <a class="btn btn-primary" href="${routes.dashboardListings}">Voir mes annonces</a>
        </div>
      ` : `
        <p>Votre annonce sera enregistrée plus tard avec le statut en attente de validation.</p>
        <button class="btn btn-primary" type="button" data-submit-listing>Soumettre l’annonce</button>
      `}
    </section>
  `;
}

function ListingCompletionScore() {
  const score = calculateListingCompletionScore(draft);
  draft.completionScore = score;
  return `<div class="completion-score">Annonce complétée à ${score}%</div>`;
}

function ListingDraftSummary() {
  const enabledContacts = contactOptions.filter(([key]) => draft.contactPreferences[key]).map(([, label]) => label);

  return `
    <aside class="draft-summary" id="draft-summary">
      <h2>Résumé</h2>
      ${ListingCompletionScore()}
      <div class="summary-list">
        <div class="summary-item"><span>Statut</span><strong>Brouillon</strong></div>
        <div class="summary-item"><span>Type d’annonce</span><strong>${optionLabel(draft.transaction)}</strong></div>
        <div class="summary-item"><span>Type de bien</span><strong>${optionLabel(draft.propertyType)}</strong></div>
        <div class="summary-item"><span>Ville</span><strong>${draft.location.city || "Non renseignée"}</strong></div>
        <div class="summary-item"><span>Prix</span><strong>${formatPriceFCFA(draft.pricing.price) || "Non renseigné"}</strong></div>
        <div class="summary-item"><span>Photos</span><strong>${draft.photos.length}</strong></div>
        <div class="summary-item"><span>Contacts</span><strong>${enabledContacts.join(", ") || "Aucun"}</strong></div>
      </div>
    </aside>
  `;
}

function PublishNavigationButtons() {
  return `
    <div class="publish-nav">
      <div class="publish-nav-group">
        <button class="btn btn-ghost" type="button" data-prev-step${currentStep === 0 ? " disabled" : ""}>Retour</button>
        <button class="btn btn-light" type="button" data-save-draft>Enregistrer en brouillon</button>
      </div>
      <div class="publish-nav-group">
        <button class="btn btn-ghost" type="button" data-preview-step>Prévisualiser</button>
        ${currentStep < publishSteps.length - 1 ? `<button class="btn btn-primary" type="button" data-next-step>Suivant</button>` : `<button class="btn btn-primary" type="button" data-submit-listing>Soumettre l’annonce</button>`}
      </div>
    </div>
  `;
}

function currentStepContent() {
  const components = [
    StepTransactionType,
    StepPropertyType,
    StepLocation,
    StepPricing,
    StepFeatures,
    StepPhotos,
    StepDescription,
    StepConditions,
    StepDocuments,
    StepContactPreferences,
    StepPreview,
    StepSubmit
  ];

  return components[currentStep]();
}

function PublishRealEstatePage(errorMessage = "") {
  const progress = Math.round(((currentStep + 1) / publishSteps.length) * 100);

  document.querySelector("#publish-page").innerHTML = `
    <div class="publish-shell">
      <section class="publish-main">
        <div class="publish-top">
          <h1>Publier une annonce immobilière</h1>
          <p>Étape ${currentStep + 1} sur 12</p>
          <div class="progress-track"><div class="progress-bar" style="width:${progress}%"></div></div>
          <button class="btn btn-ghost mobile-summary-toggle" type="button" data-toggle-summary>Voir le résumé</button>
        </div>
        ${PublishStepper()}
        ${currentStepContent()}
        ${FormErrorMessage(errorMessage)}
        ${statusMessage ? `<div class="status-message">${statusMessage}</div>` : ""}
        ${PublishNavigationButtons()}
      </section>
      ${ListingDraftSummary()}
    </div>
  `;

  bindPublishEvents();
}

function coerceValue(input) {
  if (input.type === "checkbox") {
    return input.checked;
  }

  if (input.type === "number") {
    return input.value ? Number(input.value) : undefined;
  }

  return input.value;
}

function bindDraftInputs() {
  document.querySelectorAll("[data-path]").forEach((input) => {
    input.addEventListener("change", () => {
      setNested(input.dataset.path, coerceValue(input));

      if (input.dataset.path === "location.region") {
        draft.location.department = "";
        draft.location.city = "";
      }

      statusMessage = "";
      PublishRealEstatePage();
    });
  });

  document.querySelectorAll("[data-document-index]").forEach((input) => {
    input.addEventListener("change", () => {
      draft.documents[Number(input.dataset.documentIndex)].available = input.checked;
      PublishRealEstatePage();
    });
  });

  document.querySelector("[data-copy-contact-email]")?.addEventListener("change", (event) => {
    if (event.currentTarget.checked) {
      draft.contactPreferences.notificationEmail = draft.contactPreferences.contactEmail || "";
      PublishRealEstatePage();
    }
  });
}

function bindPublishEvents() {
  bindDraftInputs();

  document.querySelector("[data-next-step]")?.addEventListener("click", () => {
    const error = validatePublishStep(currentStep);
    if (error) {
      PublishRealEstatePage(error);
      return;
    }

    currentStep = Math.min(currentStep + 1, publishSteps.length - 1);
    statusMessage = "";
    PublishRealEstatePage();
  });

  document.querySelector("[data-prev-step]")?.addEventListener("click", () => {
    currentStep = Math.max(currentStep - 1, 0);
    statusMessage = "";
    PublishRealEstatePage();
  });

  document.querySelector("[data-preview-step]")?.addEventListener("click", () => {
    currentStep = 10;
    statusMessage = "";
    PublishRealEstatePage();
  });

  document.querySelector("[data-save-draft]")?.addEventListener("click", () => {
    draft.status = "draft";
    statusMessage = "Brouillon enregistré.";
    PublishRealEstatePage();
  });

  document.querySelectorAll("[data-submit-listing]").forEach((button) => {
    button.addEventListener("click", () => {
      const requiredSteps = [0, 1, 2, 3, 6, 9];
      const error = requiredSteps.map(validatePublishStep).find(Boolean);
      if (error) {
        PublishRealEstatePage(error);
        return;
      }

      draft.status = "pending_review";
      currentStep = 11;
      statusMessage = "";
      PublishRealEstatePage();
    });
  });

  document.querySelector("[data-toggle-summary]")?.addEventListener("click", () => {
    document.querySelector("#draft-summary").classList.toggle("is-open");
  });
}

PublishHeader();
PublishRealEstatePage();

const routes = {
  home: "/",
  realEstate: "/immobilier",
  hotels: "/hotels",
  vehicles: "/voitures",
  trips: "/voyages",
  dashboard: "/dashboard",
  dashboardListings: "/dashboard/immobilier/annonces",
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
const publicationModule = import(new URL('./real-estate-api.mjs', document.currentScript.src).href);
let listingId = new URLSearchParams(location.search).get('id');
let creationRequestId;
let publicationBusy = false;
let publicationReady = false;
let publicationErrors = [];
let publicationNeedsLogin = false;
const photoPreviews = new Map();
const pendingPhotoUploads = new Map();
const publicationStatusLabels = { draft: 'Brouillon', pending_review: 'En attente de validation', active: 'Active',
  refused: 'Refusée', suspended: 'Suspendue', expired: 'Expirée', deleted: 'Supprimée' };
function escapePublication(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
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

  return labels[value] || escapePublication(value) || "Non renseigné";
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
  return `<input type="text" data-path="location.district" value="${escapePublication(draft.location.district)}" placeholder="Quartier">`;
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
      <label class="form-field full"><span>Adresse ou indication</span><input type="text" data-path="location.addressHint" value="${escapePublication(draft.location.addressHint)}" placeholder="Repère, axe ou indication utile"></label>
      <label class="form-field"><span>Latitude</span><input type="number" step="any" data-path="location.latitude" value="${escapePublication(draft.location.latitude ?? '')}"></label>
      <label class="form-field"><span>Longitude</span><input type="number" step="any" data-path="location.longitude" value="${escapePublication(draft.location.longitude ?? '')}"></label>
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
        <label class="form-field"><span>Prix</span><input type="number" min="0" step="1" data-path="pricing.price" value="${escapePublication(draft.pricing.price ?? '')}"></label>
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
        ${numericFields.map(([key, label]) => `<label class="form-field"><span>${label}</span><input type="number" min="0" data-path="features.${key}" value="${escapePublication(draft.features[key] ?? '')}"></label>`).join("")}
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
          <strong>Sélectionner des photos</strong>
          <p>JPEG, PNG ou WebP · 5 Mo par photo · 12 photos maximum</p>
          <input type="file" data-photo-upload multiple accept="image/jpeg,image/png,image/webp" aria-label="Ajouter des photos">
        </div>
      </div>
      <div class="publication-photos">${draft.photos.map((photo, index) => `
        <figure class="publication-photo">
          ${photoPreviews.has(photo.id) ? `<img src="${escapePublication(photoPreviews.get(photo.id))}" alt="Photo ${index + 1}">` : '<span>Chargement de la photo…</span>'}
          <figcaption>${index === 0 ? 'Photo principale' : `Photo ${index + 1}`}</figcaption>
          <div class="photo-actions">
            <button type="button" class="btn btn-ghost" data-photo-move="${photo.id}" data-direction="-1" aria-label="Déplacer avant" title="Déplacer avant" ${index === 0 ? 'disabled' : ''}>←</button>
            <button type="button" class="btn btn-ghost" data-photo-move="${photo.id}" data-direction="1" aria-label="Déplacer après" title="Déplacer après" ${index === draft.photos.length - 1 ? 'disabled' : ''}>→</button>
            <button type="button" class="btn btn-ghost" data-photo-replace="${photo.id}">Remplacer</button>
            <button type="button" class="btn btn-ghost" data-photo-delete="${photo.id}">Supprimer</button>
          </div>
        </figure>`).join('')}</div>
    </section>
  `;
}

function StepDescription() {
  return `
    <section class="step-card">
      <h2>Décrivez votre bien</h2>
      <div class="form-grid single">
        <label class="form-field"><span>Titre de l’annonce</span><input type="text" maxlength="200" data-path="content.title" value="${escapePublication(draft.content.title)}" placeholder="Exemple : Appartement F3 lumineux à Dakar"></label>
        <label class="form-field"><span>Description</span><textarea data-path="content.description" maxlength="1200" placeholder="Décrivez le bien, le quartier, les conditions et les points forts.">${escapePublication(draft.content.description)}</textarea></label>
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
        ${fields.map(([key, label]) => `<label class="form-field"><span>${label}</span><input type="number" min="0" data-path="conditions.${key}" value="${escapePublication(draft.conditions[key] ?? '')}"></label>`).join("")}
        <label class="form-field"><span>Disponible à partir de</span><input type="date" data-path="conditions.availableFrom" value="${escapePublication(draft.conditions.availableFrom)}"></label>
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
      <p>Indiquez uniquement les documents disponibles. Aucun document n’est téléversé ni vérifié à cette étape.</p>
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
        <label class="form-field"><span>Numéro WhatsApp</span><input type="tel" data-path="contactPreferences.whatsappNumber" value="${escapePublication(preferences.whatsappNumber)}"></label>
        <label class="form-field"><span>Numéro de téléphone</span><input type="tel" data-path="contactPreferences.phoneNumber" value="${escapePublication(preferences.phoneNumber)}"></label>
        <label class="form-field"><span>Email de contact</span><input type="email" data-path="contactPreferences.contactEmail" value="${escapePublication(preferences.contactEmail)}"></label>
        <label class="form-field"><span>Email de notification</span><input type="email" data-path="contactPreferences.notificationEmail" value="${escapePublication(preferences.notificationEmail)}"></label>
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
        <div class="preview-photo">${photoPreviews.has(draft.photos[0]?.id) ? `<img src="${escapePublication(photoPreviews.get(draft.photos[0].id))}" alt="Photo principale">` : 'Aucune photo'}</div>
        <strong>${escapePublication(draft.content.title || "Titre de l’annonce")}</strong>
        <span>${formatPriceFCFA(draft.pricing.price) || "Prix non renseigné"}</span>
        <span>${escapePublication([draft.location.city, draft.location.district].filter(Boolean).join(", ") || "Localisation non renseignée")}</span>
        <span>${optionLabel(draft.propertyType)} · ${optionLabel(draft.transaction)}</span>
        <p>${escapePublication(draft.content.description || "Description non renseignée.")}</p>
        <div class="badge-row">${contactOptions.filter(([key]) => draft.contactPreferences[key]).map(([, label]) => `<span class="badge">${label}</span>`).join("")}</div>
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
        <p>Votre annonce sera examinée avant d’apparaître dans les résultats publics.</p>
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
        <div class="summary-item"><span>Statut</span><strong>${publicationStatusLabels[draft.status] || 'Brouillon'}</strong></div>
        <div class="summary-item"><span>Type d’annonce</span><strong>${optionLabel(draft.transaction)}</strong></div>
        <div class="summary-item"><span>Type de bien</span><strong>${optionLabel(draft.propertyType)}</strong></div>
        <div class="summary-item"><span>Ville</span><strong>${escapePublication(draft.location.city || "Non renseignée")}</strong></div>
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
          <h1>${listingId ? 'Modifier mon annonce immobilière' : 'Publier une annonce immobilière'}</h1>
          <p>Étape ${currentStep + 1} sur 12</p>
          <div class="progress-track"><div class="progress-bar" style="width:${progress}%"></div></div>
          <button class="btn btn-ghost mobile-summary-toggle" type="button" data-toggle-summary>Voir le résumé</button>
        </div>
        ${PublishStepper()}
        ${currentStepContent()}
        ${publicationBusy ? '<p class="publication-loading" role="status">Traitement en cours…</p>' : ''}
        ${FormErrorMessage(escapePublication(errorMessage))}
        ${publicationNeedsLogin ? `<a class="btn btn-light" target="_blank" rel="noopener" href="/login?next=${encodeURIComponent(location.pathname + location.search)}">Se reconnecter</a>` : ''}
        ${statusMessage ? `<div class="status-message" role="status">${escapePublication(statusMessage)}</div>` : ""}
        ${PublishNavigationButtons()}
      </section>
      ${ListingDraftSummary()}
    </div>
  `;

  bindPublishEvents();
  document.querySelector('#publish-page').setAttribute('aria-busy', String(publicationBusy));
  if (publicationBusy || !publicationReady) document.querySelectorAll('#publish-page button, #publish-page input, #publish-page select, #publish-page textarea').forEach(element => { element.disabled = true; });
  if (!publicationBusy && !publicationReady) {
    const retry = document.createElement('button');
    retry.type = 'button';
    retry.className = 'btn btn-light';
    retry.textContent = 'Réessayer le chargement';
    retry.addEventListener('click', initializeRealEstatePublication);
    document.querySelector('.publish-main').append(retry);
  }
  publicationErrors.forEach(error => {
    if (error.step !== currentStep) return;
    const field = document.querySelector(`[data-path="${CSS.escape(error.path)}"]`);
    const message = document.createElement('small');
    message.className = 'publication-field-error';
    message.textContent = error.message;
    if (!field) {
      document.querySelector('.step-card').append(message);
      return;
    }
    field.setAttribute('aria-invalid', 'true');
    field.after(message);
  });
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
    input.addEventListener("input", () => {
      setNested(input.dataset.path, coerceValue(input));
      statusMessage = '';
    });
    input.addEventListener("change", () => {
      setNested(input.dataset.path, coerceValue(input));

      if (input.dataset.path === "location.region") {
        draft.location.department = "";
        draft.location.city = "";
      }

      if (input.dataset.path === 'location.region') PublishRealEstatePage();
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

  document.querySelector("[data-save-draft]")?.addEventListener("click", () => runPublicationOperation(async () => {
    await savePublication();
    statusMessage = 'Brouillon enregistré.';
  }));

  document.querySelectorAll("[data-submit-listing]").forEach((button) => {
    button.addEventListener("click", () => runPublicationOperation(async () => {
      await savePublication();
      const { publicationRequest } = await publicationModule;
      const saved = await publicationRequest(`/dashboard/immobilier/${listingId}/submit`, { method: 'POST' });
      draft.status = saved.status;
      currentStep = 11;
      statusMessage = "";
    }));
  });

  document.querySelector("[data-toggle-summary]")?.addEventListener("click", () => {
    document.querySelector("#draft-summary").classList.toggle("is-open");
  });
  bindPhotoEvents();
}

async function savePublication() {
  if (!publicationReady) throw new Error('Veuillez charger votre annonce avant de la modifier.');
  const { publicationRequest, publicationPayload, publicationOperationId } = await publicationModule;
  const body = publicationPayload(draft);
  if (!listingId) {
    creationRequestId ||= sessionStorage.getItem('pencmi_real_estate_creation') || publicationOperationId();
    sessionStorage.setItem('pencmi_real_estate_creation', creationRequestId);
    const created = await publicationRequest('/dashboard/immobilier', { method: 'POST', body: { ...body, requestId: creationRequestId } });
    listingId = created.id;
    const url = new URL(location.href);
    url.searchParams.set('id', listingId);
    history.replaceState(null, '', url);
    sessionStorage.removeItem('pencmi_real_estate_creation');
  }
  const saved = await publicationRequest(`/dashboard/immobilier/${listingId}`, { method: 'PATCH', body });
  draft.status = saved.status;
}

async function runPublicationOperation(operation) {
  if (publicationBusy) return;
  publicationBusy = true;
  statusMessage = '';
  publicationErrors = [];
  publicationNeedsLogin = false;
  PublishRealEstatePage();
  let message = '';
  try { await operation(); }
  catch (error) {
    message = error.message;
    publicationNeedsLogin = error.status === 401 || ['SESSION_INVALID', 'COORDINATION_UNAVAILABLE', 'REFRESH_UNCERTAIN'].includes(error.code);
    const { fieldLocation } = await publicationModule;
    publicationErrors = (error.fields || []).map(field => ({ ...fieldLocation(field.path), message: field.message }));
    if (publicationErrors.length) currentStep = publicationErrors[0].step;
  } finally {
    publicationBusy = false;
    PublishRealEstatePage(message);
  }
}

async function loadPhotoPreviews() {
  const { publicationRequest } = await publicationModule;
  for (const [id, url] of photoPreviews) {
    if (draft.photos.some(photo => photo.id === id)) continue;
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    photoPreviews.delete(id);
  }
  for (const photo of draft.photos) {
    if (photoPreviews.has(photo.id)) continue;
    if (photo.legacy) {
      photoPreviews.set(photo.id, photo.url);
      continue;
    }
    const blob = await publicationRequest(`/files/${photo.id}/content`, { binary: true });
    photoPreviews.set(photo.id, URL.createObjectURL(blob));
  }
}

async function uploadPublicationPhotos(files, replacePhotoId) {
  const { publicationRequest, publicationOperationId } = await publicationModule;
  await savePublication();
  for (const file of files) {
    const key = `${replacePhotoId || ''}:${file.name}:${file.size}:${file.lastModified}`;
    const uploadId = pendingPhotoUploads.get(key) || publicationOperationId();
    pendingPhotoUploads.set(key, uploadId);
    const body = new FormData();
    body.append('photo', file);
    body.append('uploadId', uploadId);
    if (replacePhotoId) body.append('replacePhotoId', replacePhotoId);
    await publicationRequest(`/dashboard/immobilier/${listingId}/photos`, { method: 'POST', body });
    const saved = await publicationRequest(`/dashboard/immobilier/${listingId}`);
    draft.photos = saved.photos;
    draft.status = saved.status;
    pendingPhotoUploads.delete(key);
  }
  await loadPhotoPreviews();
}

function bindPhotoEvents() {
  document.querySelector('[data-photo-upload]')?.addEventListener('change', event => {
    const files = [...event.target.files];
    if (files.length) runPublicationOperation(() => uploadPublicationPhotos(files));
  });
  document.querySelectorAll('[data-photo-delete]').forEach(button => button.addEventListener('click', () => runPublicationOperation(async () => {
    const { publicationRequest } = await publicationModule;
    const id = button.dataset.photoDelete;
    await publicationRequest(`/dashboard/immobilier/${listingId}/photos/${id}`, { method: 'DELETE' });
    draft.photos = draft.photos.filter(photo => photo.id !== id);
    draft.status = 'draft';
    if (photoPreviews.get(id)?.startsWith('blob:')) URL.revokeObjectURL(photoPreviews.get(id));
    photoPreviews.delete(id);
  })));
  document.querySelectorAll('[data-photo-move]').forEach(button => button.addEventListener('click', () => runPublicationOperation(async () => {
    const photos = [...draft.photos];
    const from = photos.findIndex(photo => photo.id === button.dataset.photoMove);
    const to = from + Number(button.dataset.direction);
    if (to < 0 || to >= photos.length) return;
    [photos[from], photos[to]] = [photos[to], photos[from]];
    const { publicationRequest } = await publicationModule;
    await publicationRequest(`/dashboard/immobilier/${listingId}/photos/order`, { method: 'PATCH', body: { photoIds: photos.map(photo => photo.id) } });
    draft.photos = photos;
    draft.status = 'draft';
  })));
  document.querySelectorAll('[data-photo-replace]').forEach(button => button.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.addEventListener('change', () => { if (input.files.length) runPublicationOperation(() => uploadPublicationPhotos([...input.files], button.dataset.photoReplace)); });
    input.click();
  }));
}

async function initializeRealEstatePublication() {
  document.body.dataset.realEstatePublication = '';
  PublishHeader();
  await runPublicationOperation(async () => {
    const { publicationRequest, publicationFromListing } = await publicationModule;
    if (!localStorage.getItem('pencmi_access_token')) {
      location.replace(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    if (!listingId) { publicationReady = true; return; }
    const saved = await publicationRequest(`/dashboard/immobilier/${encodeURIComponent(listingId)}`);
    draft = publicationFromListing(saved, draft);
    await loadPhotoPreviews();
    publicationReady = true;
  });
}

if (!new URLSearchParams(location.search).get('category') || new URLSearchParams(location.search).get('category') === 'immobilier') {
  initializeRealEstatePublication();
}

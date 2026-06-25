const routes = {
  dashboard: "/dashboard/immobilier",
  listings: "/dashboard/immobilier/annonces",
  messages: "/dashboard/immobilier/messages",
  contacts: "/dashboard/immobilier/contacts",
  visits: "/dashboard/immobilier/visites",
  favorites: "/dashboard/immobilier/favoris",
  stats: "/dashboard/immobilier/statistiques",
  contactSettings: "/dashboard/immobilier/contact-settings"
};

const editSections = [
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
  "Prévisualisation"
];

const propertyTypes = ["appartement", "maison", "villa", "terrain", "studio", "chambre", "bureau", "commerce"];
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

let activeSection = 0;
let statusMessage = "";
let listingExists = true;
let listingDraft = {
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
  if (path === routes.dashboard) return "../../";
  if (path === routes.listings) return "../";
  if (path === routes.visits) return "../../visites/";
  if (path === routes.favorites) return "../../favoris/";
  if (path === routes.stats) return "../../statistiques/";
  if (path === routes.contactSettings) return "../../contact-settings/";
  return path;
}

function DashboardSidebar() {
  const items = [
    ["Vue d’ensemble", routes.dashboard],
    ["Mes annonces", routes.listings],
    ["Messages", routes.messages, "0"],
    ["Contacts", routes.contacts, "0"],
    ["Demandes de visite", routes.visits, "0"],
    ["Favoris reçus", routes.favorites],
    ["Statistiques", routes.stats],
    ["Moyens de contact", routes.contactSettings]
  ];

  return `<aside class="dashboard-sidebar" id="dashboard-sidebar"><div class="dashboard-brand"><span>P</span><div><strong>Péncmi</strong><small>Annonceur immobilier</small></div></div><nav class="dashboard-nav">${items.map(([label, href, badge]) => `<a href="${routeHref(href)}"${href === routes.listings ? ' aria-current="page"' : ""}><span>${label}</span>${badge ? `<span class="notification-badge">${badge}</span>` : ""}</a>`).join("")}</nav></aside>`;
}

function setNested(path, value) {
  const keys = path.split(".");
  let target = listingDraft;
  keys.slice(0, -1).forEach((key) => {
    target[key] = target[key] || {};
    target = target[key];
  });
  target[keys[keys.length - 1]] = value;
}

function coerceValue(input) {
  if (input.type === "checkbox") return input.checked;
  if (input.type === "number") return input.value ? Number(input.value) : undefined;
  return input.value;
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

function calculateCompletionScore() {
  const checks = [
    Boolean(listingDraft.transaction),
    Boolean(listingDraft.propertyType),
    Boolean(listingDraft.location?.city),
    Boolean(listingDraft.location?.district),
    Boolean(listingDraft.pricing?.price),
    Boolean(listingDraft.features?.surface),
    Boolean(listingDraft.features?.bedrooms),
    Boolean(listingDraft.content?.title),
    Boolean(listingDraft.content?.description),
    Boolean(listingDraft.photos?.length),
    Object.values(listingDraft.conditions || {}).some(Boolean),
    Object.values(listingDraft.contactPreferences || {}).some(Boolean),
    listingDraft.documents?.some((document) => document.available)
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

function validateRequiredFields() {
  if (!listingDraft.transaction) return "Veuillez sélectionner un type d’annonce.";
  if (!listingDraft.propertyType) return "Veuillez sélectionner un type de bien.";
  if (!listingDraft.location?.city) return "Veuillez renseigner la ville.";
  if (!listingDraft.pricing?.price) return "Veuillez renseigner un prix.";
  if (!listingDraft.content?.title) return "Veuillez ajouter un titre.";
  if (!contactOptions.some(([key]) => listingDraft.contactPreferences[key])) return "Veuillez choisir au moins un moyen de contact.";
  return "";
}

function KpiCard(title, value) {
  return `<article class="kpi-card"><span class="kpi-icon">%</span><h3>${title}</h3><div class="kpi-value">${value}</div></article>`;
}

function textInput(path, label, type = "text", placeholder = "") {
  const value = path.split(".").reduce((target, key) => target?.[key], listingDraft) || "";
  return `<label class="form-field"><span>${label}</span><input type="${type}" data-path="${path}" value="${value}" placeholder="${placeholder}"></label>`;
}

function choiceGroup(name, values, selectedValue, path) {
  return `<div class="option-grid">${values.map((value) => `<label class="choice-card"><input type="radio" name="${name}" value="${value}" data-path="${path}"${selectedValue === value ? " checked" : ""}><span>${optionLabel(value)}</span></label>`).join("")}</div>`;
}

function EditSectionContent() {
  const regionOptions = (window.SENEGAL_LOCATIONS || []).map((location) => `<option value="${location.region}"${listingDraft.location.region === location.region ? " selected" : ""}>${location.region}</option>`).join("");
  const selectedRegion = (window.SENEGAL_LOCATIONS || []).find((location) => location.region === listingDraft.location.region);
  const cityOptions = (selectedRegion?.cities || []).map((city) => `<option value="${city}"${listingDraft.location.city === city ? " selected" : ""}>${city}</option>`).join("");
  const sections = [
    `<section class="step-card"><h2>Type d’annonce</h2>${choiceGroup("transaction", ["location", "vente", "achat"], listingDraft.transaction, "transaction")}</section>`,
    `<section class="step-card"><h2>Type de bien</h2>${choiceGroup("propertyType", propertyTypes, listingDraft.propertyType, "propertyType")}</section>`,
    `<section class="step-card"><h2>Localisation</h2><div class="form-grid"><label class="form-field"><span>Région</span><select data-path="location.region"><option value="">Sélectionner une région</option>${regionOptions}</select></label><label class="form-field"><span>Ville</span><select data-path="location.city"><option value="">Ville</option>${cityOptions}</select></label>${textInput("location.district", "Quartier")}${textInput("location.addressHint", "Adresse ou indication")}</div></section>`,
    `<section class="step-card"><h2>Prix</h2><div class="form-grid">${textInput("pricing.price", "Prix", "number")}<label class="form-field"><span>Période</span><select data-path="pricing.pricePeriod"><option value="month">Par mois</option><option value="day">Par jour</option><option value="total">Prix total</option></select></label><label class="choice-card"><input type="checkbox" data-path="pricing.negotiable"${listingDraft.pricing.negotiable ? " checked" : ""}><span>Prix négociable</span></label></div></section>`,
    `<section class="step-card"><h2>Caractéristiques</h2><div class="form-grid">${textInput("features.surface", "Surface", "number")}${textInput("features.rooms", "Nombre de pièces", "number")}${textInput("features.bedrooms", "Nombre de chambres", "number")}${textInput("features.bathrooms", "Nombre de salles de bain", "number")}</div></section>`,
    `<section class="step-card"><h2>Photos</h2><div class="photo-dropzone"><div><strong>Gestion des photos prévue</strong><p>Ajoutez ou remplacez les photos de l’annonce.</p><input type="file" multiple accept=".jpg,.jpeg,.png,.webp"></div></div></section>`,
    `<section class="step-card"><h2>Description</h2><div class="form-grid single">${textInput("content.title", "Titre de l’annonce")}<label class="form-field"><span>Description</span><textarea data-path="content.description" maxlength="1200" placeholder="Décrivez le bien, le quartier et les conditions.">${listingDraft.content.description || ""}</textarea></label></div></section>`,
    `<section class="step-card"><h2>Conditions</h2><div class="form-grid">${textInput("conditions.deposit", "Caution", "number")}${textInput("conditions.advancePayment", "Avance", "number")}${textInput("conditions.agencyFee", "Commission agence", "number")}${textInput("conditions.availableFrom", "Disponible à partir de", "date")}</div></section>`,
    `<section class="step-card"><h2>Documents</h2><div class="checkbox-list">${listingDraft.documents.map((document, index) => `<label class="choice-card"><input type="checkbox" data-document-index="${index}"${document.available ? " checked" : ""}><span>${document.label}</span></label>`).join("")}</div></section>`,
    `<section class="step-card"><h2>Moyens de contact</h2><div class="checkbox-list">${contactOptions.map(([key, label]) => `<label class="choice-card"><input type="checkbox" data-path="contactPreferences.${key}"${listingDraft.contactPreferences[key] ? " checked" : ""}><span>${label}</span></label>`).join("")}</div><div class="form-grid">${textInput("contactPreferences.whatsappNumber", "Numéro WhatsApp", "tel")}${textInput("contactPreferences.phoneNumber", "Numéro de téléphone", "tel")}${textInput("contactPreferences.contactEmail", "Email de contact", "email")}${textInput("contactPreferences.notificationEmail", "Email de notification", "email")}</div></section>`,
    `<section class="step-card"><h2>Prévisualisation</h2><div class="preview-box"><div class="preview-photo">Aperçu photo principale</div><strong>${listingDraft.content.title || "Titre de l’annonce"}</strong><span>${listingDraft.pricing.price ? Number(listingDraft.pricing.price).toLocaleString("fr-FR") + " FCFA" : "Prix non renseigné"}</span><span>${[listingDraft.location.city, listingDraft.location.district].filter(Boolean).join(", ") || "Localisation non renseignée"}</span><span>${optionLabel(listingDraft.propertyType)} · ${optionLabel(listingDraft.transaction)}</span><p>${listingDraft.content.description || "Description non renseignée."}</p></div></section>`
  ];
  return sections[activeSection];
}

function ListingCompletionScore() {
  const score = calculateCompletionScore();
  return `<div class="completion-score">Score de complétion : ${score}%</div>`;
}

function AdvertiserRecommendations() {
  const recommendations = [];
  if (!listingDraft.photos.length) recommendations.push("Ajouter plus de photos");
  if (!listingDraft.content.description) recommendations.push("Compléter la description");
  if (!listingDraft.location.district) recommendations.push("Ajouter le quartier");
  if (!listingDraft.pricing.price) recommendations.push("Vérifier le prix");
  if (!listingDraft.contactPreferences.whatsappEnabled) recommendations.push("Activer WhatsApp");
  if (!listingDraft.contactPreferences.visitRequestEnabled) recommendations.push("Activer la demande de visite");

  return `
    <section class="edit-side-card">
      <h2>Améliorations</h2>
      ${ListingCompletionScore()}
      <ul class="recommendation-list">${recommendations.map((item) => `<li>${item}</li>`).join("") || "<li>Aucune recommandation prioritaire.</li>"}</ul>
    </section>
  `;
}

function ListingNotFound() {
  return `
    <div class="dashboard-shell">
      ${DashboardSidebar()}
      <main class="dashboard-main edit-dashboard-main">
        <section class="not-found-card">
          <div>
            <h1>Annonce introuvable</h1>
            <p>L’annonce demandée n’est pas disponible ou n’a pas encore été chargée.</p>
            <a class="btn btn-primary" href="${routeHref(routes.listings)}">Retour à mes annonces</a>
          </div>
        </section>
      </main>
    </div>
  `;
}

function EditRealEstateListingPage(errorMessage = "") {
  if (!listingExists) {
    document.querySelector("#edit-listing-page").innerHTML = ListingNotFound();
    return;
  }

  document.querySelector("#edit-listing-page").innerHTML = `
    <div class="dashboard-shell">
      ${DashboardSidebar()}
      <main class="dashboard-main edit-dashboard-main">
        <header class="edit-toolbar">
          <div>
            <button class="btn btn-ghost dashboard-menu-toggle" type="button" data-open-sidebar>Menu</button>
            <h1>Modifier l’annonce</h1>
            <p>Mettez à jour les informations de votre bien.</p>
          </div>
          <div class="edit-actions">
            <a class="btn btn-ghost" href="${routeHref(routes.listings)}">Annuler</a>
            <button class="btn btn-light" type="button" data-save-draft>Enregistrer en brouillon</button>
            <button class="btn btn-ghost" type="button" data-preview>Prévisualiser</button>
            <button class="btn btn-primary" type="button" data-save-listing>Enregistrer les modifications</button>
          </div>
        </header>
        <section class="edit-shell">
          <article class="edit-main-card">
            <div class="edit-tabs">${editSections.map((section, index) => `<button type="button" class="${index === activeSection ? "is-active" : ""}" data-section="${index}">${section}</button>`).join("")}</div>
            ${EditSectionContent()}
            ${errorMessage ? `<div class="form-error">${errorMessage}</div>` : ""}
            ${statusMessage ? `<div class="status-message">${statusMessage}</div>` : ""}
          </article>
          ${AdvertiserRecommendations()}
        </section>
      </main>
    </div>
  `;

  bindEditEvents();
}

function bindEditEvents() {
  document.querySelector("[data-open-sidebar]")?.addEventListener("click", () => {
    document.querySelector("#dashboard-sidebar").classList.toggle("is-open");
  });
  document.querySelectorAll("[data-section]").forEach((button) => {
    button.addEventListener("click", () => {
      activeSection = Number(button.dataset.section);
      statusMessage = "";
      EditRealEstateListingPage();
    });
  });
  document.querySelectorAll("[data-path]").forEach((input) => {
    input.addEventListener("change", () => {
      setNested(input.dataset.path, coerceValue(input));
      if (input.dataset.path === "location.region") {
        listingDraft.location.city = "";
      }
      statusMessage = "";
      EditRealEstateListingPage();
    });
  });
  document.querySelectorAll("[data-document-index]").forEach((input) => {
    input.addEventListener("change", () => {
      listingDraft.documents[Number(input.dataset.documentIndex)].available = input.checked;
      EditRealEstateListingPage();
    });
  });
  document.querySelector("[data-preview]")?.addEventListener("click", () => {
    activeSection = editSections.length - 1;
    statusMessage = "";
    EditRealEstateListingPage();
  });
  document.querySelector("[data-save-draft]")?.addEventListener("click", () => {
    listingDraft.status = "draft";
    statusMessage = "Brouillon enregistré.";
    EditRealEstateListingPage();
  });
  document.querySelector("[data-save-listing]")?.addEventListener("click", () => {
    const error = validateRequiredFields();
    if (error) {
      EditRealEstateListingPage(error);
      return;
    }
    statusMessage = "Les modifications ont été enregistrées.";
    EditRealEstateListingPage();
  });
}

EditRealEstateListingPage();

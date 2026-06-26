const routes = {
  home: "/",
  realEstate: "/immobilier",
  hotels: "/hotels",
  vehicles: "/voitures",
  trips: "/voyages",
  login: "/login",
  register: "/register",
  publishRealEstate: "/login?next=/publier?category=immobilier",
  agencies: "/immobilier/agences",
  alerts: "/login?next=/immobilier/alertes",
  favorites: "/login?next=/favoris",
  realEstateFavorites: "/login?next=/favoris/immobilier",
  savedSearches: "/compte/recherches",
  dashboardListings: "/login?next=/dashboard/listings/immobilier",
  dashboardMessages: "/login?next=/dashboard/messages",
  dashboardContacts: "/login?next=/dashboard/contacts",
  dashboardStats: "/login?next=/dashboard/immobilier/statistiques",
  help: "/aide",
  terms: "/conditions",
  privacy: "/confidentialite",
  legal: "/mentions-legales",
  contact: "/contact"
};

function routeHref(path) {
  if (window.location.protocol !== "file:") {
    return path;
  }

  const depth = Number(document.body?.dataset?.routeDepth || "1");
  const prefix = "../".repeat(depth);

  if (path === "/") {
    return `${prefix}index.html`;
  }

  if (path === "/immobilier") {
    return `${prefix}immobilier/`;
  }

  if (path.startsWith("/immobilier?")) {
    return `${prefix}immobilier/${path.slice("/immobilier".length)}`;
  }

  if (path.startsWith("/immobilier/")) {
    if (path.startsWith("/immobilier/annonce/")) {
      return `${prefix}immobilier/annonce/?id=${encodeURIComponent(path.slice("/immobilier/annonce/".length))}`;
    }

    return `${prefix}immobilier/${path.slice("/immobilier/".length)}/`;
  }

  if (path.startsWith("/login?next=/publier")) {
    return `${prefix}publier/?category=immobilier`;
  }

  if (path.startsWith("/login?next=/dashboard") || path.startsWith("/dashboard/immobilier")) {
    return `${prefix}dashboard/immobilier/`;
  }

  return path;
}

function navigateTo(path) {
  window.location.href = routeHref(path);
}

const propertyTypes = ["Appartement", "Maison", "Villa", "Terrain", "Studio", "Chambre", "Bureau", "Commerce"];
const mainCities = ["Dakar", "Thiès", "Mbour", "Saly", "Saint-Louis", "Touba", "Kaolack", "Ziguinchor", "Rufisque", "Pikine", "Guédiawaye", "Diamniadio", "Lac Rose", "Somone", "Cap Skirring"];
const realEstateListings = [];
const agencies = [];

const quickTabs = [
  ["Acheter", "/immobilier?transaction=achat"],
  ["Louer", "/immobilier?transaction=location"],
  ["Terrains", "/immobilier?type=terrain"],
  ["Meublés", "/immobilier?furnished=true"],
  ["Agences", routes.agencies],
  ["Favoris", routes.favorites],
  ["Publier", routes.publishRealEstate]
];

const contactSources = [
  ["whatsappEnabled", "WhatsApp"],
  ["phoneEnabled", "Appeler"],
  ["emailEnabled", "Email"],
  ["internalMessagingEnabled", "Envoyer un message"],
  ["contactFormEnabled", "Formulaire"],
  ["visitRequestEnabled", "Demander une visite"]
];
const futurePublishSteps = ["transaction", "propertyType", "location", "price", "features", "photos", "description", "conditions", "documents", "contactPreferences", "preview", "submission"];
const futureAdvertiserRoutes = [
  "/dashboard/listings",
  "/dashboard/listings/immobilier",
  "/dashboard/messages",
  "/dashboard/messages/:conversationId",
  "/dashboard/contacts",
  "/dashboard/contact-settings",
  "/dashboard/leads",
  "/dashboard/stats",
  "/dashboard/immobilier",
  "/dashboard/immobilier/annonces",
  "/dashboard/immobilier/messages",
  "/dashboard/immobilier/contacts",
  "/dashboard/immobilier/visites",
  "/dashboard/immobilier/favoris",
  "/dashboard/immobilier/statistiques",
  "/dashboard/immobilier/contact-settings"
];

const futureDashboardComponents = [
  "RealEstateDashboardOverview",
  "KpiCard",
  "ListingPerformanceTable",
  "ContactSourceChart",
  "ConversionRateCard",
  "ResponseTimeCard",
  "TopListingsCard",
  "ListingCompletionScore",
  "AdvertiserRecommendations",
  "RecentLeadsList",
  "RecentMessagesList"
];

const filterOptions = {
  transactions: ["Location", "Achat", "Vente"],
  propertyTypes,
  bedrooms: ["1 chambre", "2 chambres", "3 chambres", "4 chambres et plus"],
  bathrooms: ["1", "2", "3 et plus"],
  housingOptions: ["Meublé", "Non meublé", "Parking", "Gardien", "Climatisation", "Balcon", "Terrasse", "Piscine", "Groupe électrogène", "Compteur SENELEC individuel", "Eau disponible"],
  senegalOptions: ["Caution", "Avance", "Commission agence", "Zone non inondable", "Proche route principale", "Proche école", "Proche marché", "Proche mosquée", "Titre foncier", "Bail", "Délibération", "NICAD disponible", "Terrain viabilisé", "Terrain clôturé"],
  advertiserTypes: ["Particulier", "Agence", "Promoteur", "Annonce vérifiée"],
  sortOptions: ["Plus récentes", "Prix croissant", "Prix décroissant", "Surface croissante", "Surface décroissante"]
};

function normalizeValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-");
}

function buildRealEstateSearchUrl(filters) {
  const params = new URLSearchParams();
  const locationParams = buildLocationQuery(filters);

  Object.entries(filters).forEach(([key, value]) => {
    if (value && !["country", "region", "department", "city", "district", "radius", "nearMe"].includes(key)) {
      params.set(key, normalizeValue(value));
    }
  });

  locationParams.forEach((value, key) => {
    params.set(key, value);
  });

  const query = params.toString();
  return query ? `${routes.realEstate}?${query}` : routes.realEstate;
}

function parseRealEstateSearchParams(search = window.location.search) {
  const params = new URLSearchParams(search);
  return {
    transaction: params.get("transaction") || "",
    type: params.get("type") || "",
    city: params.get("city") || params.get("location") || "",
    maxPrice: params.get("maxPrice") || "",
    furnished: params.get("furnished") || ""
  };
}

function formatPriceFCFA(value) {
  if (!value) {
    return "";
  }

  return `${Number(value).toLocaleString("fr-FR")} FCFA`;
}

function formatPropertyFeatures(listing) {
  return [
    listing.surface ? `${listing.surface} m²` : "",
    listing.bedrooms ? `${listing.bedrooms} ch.` : "",
    listing.bathrooms ? `${listing.bathrooms} sdb` : "",
    listing.furnished ? "Meublé" : ""
  ].filter(Boolean).join(" · ");
}

function optionElements(values, selectedValue = "") {
  return values
    .map((value) => `<option value="${normalizeValue(value)}"${normalizeValue(selectedValue) === normalizeValue(value) ? " selected" : ""}>${value}</option>`)
    .join("");
}

function locationOptionElements(values, selectedValue = "") {
  return values
    .map((value) => `<option value="${slugifyLocation(value)}"${selectedValue === slugifyLocation(value) ? " selected" : ""}>${value}</option>`)
    .join("");
}

function radiusOptionElements(selectedValue = "") {
  return RADIUS_OPTIONS
    .map((option) => `<option value="${option.value}"${selectedValue === option.value ? " selected" : ""}>${option.label}</option>`)
    .join("");
}

function checkboxList(values, name) {
  return values
    .map((value) => `
      <label class="check-option">
        <input type="checkbox" name="${name}" value="${normalizeValue(value)}">
        <span>${value}</span>
      </label>
    `)
    .join("");
}

function RegionSelect(selectedValue = "") {
  return `
    <select name="region" data-location-region>
      <option value="">Tout le Sénégal / Région</option>
      <option value="SN"${selectedValue === "SN" ? " selected" : ""}>Tout le Sénégal</option>
      ${locationOptionElements(SENEGAL_LOCATIONS.map((location) => location.region), selectedValue)}
    </select>
  `;
}

function DepartmentSelect(regionSlug = "", selectedValue = "") {
  const region = findLocationRegion(regionSlug);
  const departments = region ? region.departments : [];

  return `
    <select name="department" data-location-department>
      <option value="">Département</option>
      ${locationOptionElements(departments, selectedValue)}
    </select>
  `;
}

function CitySelect(regionSlug = "", selectedValue = "") {
  const region = findLocationRegion(regionSlug);
  const cities = region ? region.cities : mainCities;

  return `
    <select name="city" data-location-city>
      <option value="">Ville</option>
      ${locationOptionElements(cities, selectedValue)}
    </select>
  `;
}

function DistrictInput(selectedValue = "") {
  return `<input name="district" type="search" value="${selectedValue}" placeholder="Quartier">`;
}

function RadiusSelect(selectedValue = "") {
  return `
    <select name="radius">
      ${radiusOptionElements(selectedValue)}
    </select>
  `;
}

function SenegalLocationSelector() {
  const currentLocation = parseLocationParams();
  const selectedRegion = currentLocation.country === "SN" ? "SN" : currentLocation.region;

  return `
    <div class="filter-grid location-selector" data-location-selector>
      <label class="field-label">Où recherchez-vous ?</label>
      ${RegionSelect(selectedRegion)}
      ${DepartmentSelect(currentLocation.region, currentLocation.department)}
      ${CitySelect(currentLocation.region, currentLocation.city)}
      ${DistrictInput(currentLocation.district)}
      ${RadiusSelect(currentLocation.radius)}
      <label class="check-option">
        <input type="checkbox" name="nearMe" value="true"${currentLocation.nearMe ? " checked" : ""}>
        <span>Autour de moi</span>
      </label>
      <label class="check-option">
        <input type="checkbox" name="aroundCity" value="true">
        <span>Autour d’une ville</span>
      </label>
    </div>
  `;
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
        <a class="btn btn-primary" href="${routeHref(routes.publishRealEstate)}">Publier une annonce</a>
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

function RealEstateHeroSearch() {
  const currentFilters = parseRealEstateSearchParams();

  document.querySelector("#real-estate-hero").innerHTML = `
    <div class="hero-inner">
      <div class="hero-copy">
        <h1>Trouvez votre bien immobilier au Sénégal</h1>
        <p>Maisons, appartements, terrains, studios et biens meublés à louer ou à acheter.</p>
      </div>
      <form class="property-search" id="property-search">
        <div class="field">
          <label for="transaction">Type de projet</label>
          <select id="transaction" name="transaction">
            <option value="achat"${currentFilters.transaction === "achat" ? " selected" : ""}>Acheter</option>
            <option value="location"${currentFilters.transaction === "location" ? " selected" : ""}>Louer</option>
          </select>
        </div>
        <div class="field">
          <label for="type">Type de bien</label>
          <select id="type" name="type">
            ${optionElements(propertyTypes, currentFilters.type)}
          </select>
        </div>
        <div class="field">
          <label for="location">Ville ou quartier</label>
          <input id="location" name="location" type="search" list="main-cities" value="${currentFilters.city}" placeholder="Dakar, Saly, Thiès">
          <datalist id="main-cities">
            ${mainCities.map((city) => `<option value="${city}"></option>`).join("")}
          </datalist>
        </div>
        <div class="field">
          <label for="maxPrice">Budget maximum</label>
          <input id="maxPrice" name="maxPrice" type="number" inputmode="numeric" min="0" value="${currentFilters.maxPrice}" placeholder="500000">
        </div>
        <button class="btn btn-primary" type="submit">Rechercher</button>
      </form>
    </div>
  `;

  document.querySelector("#property-search").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    navigateTo(buildRealEstateSearchUrl({
      transaction: form.get("transaction"),
      type: form.get("type"),
      city: form.get("location"),
      maxPrice: form.get("maxPrice")
    }));
  });
}

function RealEstateQuickTabs() {
  document.querySelector("#real-estate-tabs").innerHTML = quickTabs
    .map(([label, href]) => `<a href="${routeHref(href)}">${label}</a>`)
    .join("");
}

function RealEstateFilters() {
  return `
    <aside class="filters-panel" id="filters-panel" aria-label="Filtres immobiliers">
      <div class="filters-heading">
        <h3>Filtres</h3>
        <button class="btn btn-ghost drawer-close" type="button" data-close-filters>Fermer</button>
      </div>
      <form id="filters-form">
        <fieldset class="filter-group">
          <legend>Transaction</legend>
          <div class="filter-grid">
            <select name="transaction">
              <option value="">Toutes</option>
              ${optionElements(filterOptions.transactions)}
            </select>
          </div>
        </fieldset>

        <fieldset class="filter-group">
          <legend>Type de bien</legend>
          <div class="filter-grid">
            <select name="type">
              <option value="">Tous les biens</option>
              ${optionElements(filterOptions.propertyTypes)}
            </select>
          </div>
        </fieldset>

        <fieldset class="filter-group">
          <legend>Localisation</legend>
          ${SenegalLocationSelector()}
        </fieldset>

        <fieldset class="filter-group">
          <legend>Prix</legend>
          <div class="filter-grid">
            <input name="minPrice" type="number" inputmode="numeric" min="0" placeholder="Prix minimum">
            <input name="maxPrice" type="number" inputmode="numeric" min="0" placeholder="Prix maximum">
          </div>
        </fieldset>

        <fieldset class="filter-group">
          <legend>Surface</legend>
          <div class="filter-grid">
            <input name="minSurface" type="number" inputmode="numeric" min="0" placeholder="Surface minimum">
            <input name="maxSurface" type="number" inputmode="numeric" min="0" placeholder="Surface maximum">
          </div>
        </fieldset>

        <fieldset class="filter-group">
          <legend>Chambres</legend>
          <div class="option-list">${checkboxList(filterOptions.bedrooms, "bedrooms")}</div>
        </fieldset>

        <fieldset class="filter-group">
          <legend>Salles de bain</legend>
          <div class="option-list">${checkboxList(filterOptions.bathrooms, "bathrooms")}</div>
        </fieldset>

        <fieldset class="filter-group">
          <legend>Options logement</legend>
          <div class="option-list">${checkboxList(filterOptions.housingOptions, "housingOptions")}</div>
        </fieldset>

        <fieldset class="filter-group">
          <legend>Spécifique Sénégal</legend>
          <div class="option-list">${checkboxList(filterOptions.senegalOptions, "senegalOptions")}</div>
        </fieldset>

        <fieldset class="filter-group">
          <legend>Annonceur</legend>
          <div class="option-list">${checkboxList(filterOptions.advertiserTypes, "advertiserTypes")}</div>
        </fieldset>

        <fieldset class="filter-group">
          <legend>Tri</legend>
          <div class="filter-grid">
            <select name="sort">${optionElements(filterOptions.sortOptions)}</select>
          </div>
        </fieldset>

        <button class="btn btn-primary" type="submit">Appliquer les filtres</button>
      </form>
    </aside>
  `;
}

function MobileFilterDrawer() {
  const panel = document.querySelector("#filters-panel");
  const openButton = document.querySelector("[data-open-filters]");
  const closeButton = document.querySelector("[data-close-filters]");

  openButton.addEventListener("click", () => {
    panel.classList.add("is-open");
  });

  closeButton.addEventListener("click", () => {
    panel.classList.remove("is-open");
  });
}

function FavoriteButton({ active = false, href = routes.favorites } = {}) {
  return `
    <a class="favorite-button${active ? " is-active" : ""}" href="${href}" aria-label="${active ? "Retirer des favoris" : "Ajouter aux favoris"}">
      <span aria-hidden="true">♡</span>
    </a>
  `;
}

function SavedSearchButton() {
  return `<a class="btn btn-light" href="${routes.alerts}">Créer une alerte</a>`;
}

function FavoritesLink() {
  return `<a class="btn btn-ghost" href="${routes.favorites}">Mes favoris</a>`;
}

function SavedSearchEmptyState() {
  return `
    <div class="empty-state">
      <div>
        <h3>Aucune recherche sauvegardée pour le moment.</h3>
        <p>Les recherches sauvegardées et les alertes seront disponibles depuis l’espace client.</p>
        ${SavedSearchButton()}
      </div>
    </div>
  `;
}

function MessageButton(enabled) {
  return enabled ? `<a class="btn btn-ghost" href="${routes.login}">Envoyer un message</a>` : "";
}

function ContactAdvertiserModal() {
  return "";
}

function ConversationList() {
  return "";
}

function ConversationThread() {
  return "";
}

function EmailNotificationStatus() {
  return "";
}

function UnreadMessagesBadge(count = 0) {
  return count ? `<span class="unread-badge">${count}</span>` : "";
}

function RealEstateListingCard(listing) {
  const contactButtons = contactSources
    .filter(([source]) => listing.advertiser?.contactPreferences?.[source])
    .map(([source, label]) => source === "internalMessagingEnabled" ? MessageButton(true) : `<button class="btn btn-ghost" type="button">${label}</button>`)
    .join("");

  return `
    <article class="listing-card">
      <div class="listing-media"></div>
      <div>
        <span>${listing.transaction}</span>
        <span>${listing.type}</span>
        ${listing.verified ? "<span>Vérifié</span>" : ""}
      </div>
      <h3>${listing.title}</h3>
      <p>${listing.city}${listing.district ? `, ${listing.district}` : ""}</p>
      <strong>${formatPriceFCFA(listing.price)}</strong>
      <p>${formatPropertyFeatures(listing)}</p>
      <a class="btn btn-primary" href="${routeHref(`/immobilier/annonce/${listing.id}`)}">Voir détails</a>
      ${FavoriteButton({ active: listing.isFavorite, href: routes.favorites })}
      <div>${contactButtons}</div>
    </article>
  `;
}

function RealEstateEmptyState() {
  return `
    <div class="empty-state">
      <div>
        <h3>Aucune annonce immobilière disponible pour le moment.</h3>
        <p>Les résultats seront affichés ici dès que des annonces réelles seront disponibles depuis l’API ou la base de données.</p>
        <div class="empty-actions">
          <a class="btn btn-ghost" href="#property-search">Modifier ma recherche</a>
          ${SavedSearchButton()}
        </div>
      </div>
    </div>
  `;
}

function RealEstateResultsLayout() {
  const listings = realEstateListings.map(RealEstateListingCard).join("");

  document.querySelector("#real-estate-results").innerHTML = `
    <div class="results-toolbar">
      <div>
        <h2>Annonces immobilières</h2>
        <p>${realEstateListings.length} annonce disponible</p>
      </div>
      <div class="results-actions">
        <button class="btn btn-ghost filter-toggle" type="button" data-open-filters>Filtres</button>
        <button class="btn btn-ghost map-toggle" type="button" data-toggle-map>Voir la carte</button>
        ${FavoritesLink()}
        ${SavedSearchButton()}
      </div>
    </div>

    <div class="results-layout">
      ${RealEstateFilters()}
      <div class="results-list">${realEstateListings.length ? listings : RealEstateEmptyState()}</div>
      <aside class="map-panel" id="map-panel" aria-label="Carte des biens">
        <div class="map-placeholder"></div>
      </aside>
    </div>
  `;

  document.querySelector("#filters-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    data.country = data.region === "SN" ? "SN" : "";
    data.region = data.region === "SN" ? "" : data.region;
    data.nearMe = data.nearMe === "true";
    navigateTo(buildRealEstateSearchUrl(data));
  });

  document.querySelector("[data-toggle-map]").addEventListener("click", () => {
    document.querySelector("#map-panel").classList.toggle("is-open");
  });

  MobileFilterDrawer();
  bindSenegalLocationSelector();
}

function bindSenegalLocationSelector() {
  const selector = document.querySelector("[data-location-selector]");
  const regionSelect = document.querySelector("[data-location-region]");
  const departmentSelect = document.querySelector("[data-location-department]");
  const citySelect = document.querySelector("[data-location-city]");

  if (!selector || !regionSelect || !departmentSelect || !citySelect) {
    return;
  }

  regionSelect.addEventListener("change", () => {
    const regionSlug = regionSelect.value === "SN" ? "" : regionSelect.value;
    const region = findLocationRegion(regionSlug);
    const departments = region ? region.departments : [];
    const cities = region ? region.cities : mainCities;

    departmentSelect.innerHTML = `<option value="">Département</option>${locationOptionElements(departments)}`;
    citySelect.innerHTML = `<option value="">Ville</option>${locationOptionElements(cities)}`;
  });
}

function RealEstateAdvertiserCTA() {
  document.querySelector("#real-estate-advertiser").innerHTML = `
    <div class="advertiser-inner">
      <div>
        <h2>Vous avez un bien à louer ou à vendre ?</h2>
        <p>Publiez votre annonce, recevez des demandes et gérez vos contacts depuis votre espace.</p>
        <div class="advertiser-actions">
          <a class="btn btn-primary" href="${routeHref(routes.publishRealEstate)}">Publier une annonce</a>
          <a class="btn btn-light" href="${routes.register}">Créer mon espace</a>
        </div>
      </div>
      <div class="advertiser-benefits">
        <span>Publier un bien</span>
        <span>Gérer les demandes</span>
        <span>Discuter avec les clients</span>
        <span>Choisir les moyens de contact</span>
      </div>
    </div>
  `;
}

function RealEstateAgenciesSection() {
  document.querySelector("#real-estate-agencies").innerHTML = `
    <div class="agencies-inner">
      <h2>Agences immobilières</h2>
      <p>Retrouvez prochainement les agences, promoteurs et professionnels présents sur Péncmi.</p>
      <span class="agency-empty">Aucune agence disponible pour le moment.</span>
      <div class="agencies-actions">
        <a class="btn btn-light" href="${routes.agencies}">Voir les agences</a>
      </div>
    </div>
  `;
}

function RealEstateFooter() {
  const columns = [
    {
      title: "Immobilier",
      links: [
        ["Acheter", "/immobilier?transaction=achat"],
        ["Louer", "/immobilier?transaction=location"],
        ["Terrains", "/immobilier?type=terrain"],
        ["Meublés", "/immobilier?furnished=true"],
        ["Agences", routes.agencies],
        ["Favoris", routes.realEstateFavorites],
        ["Alertes", routes.alerts]
      ]
    },
    {
      title: "Espace annonceur",
      links: [
        ["Publier une annonce", routes.publishRealEstate],
        ["Mes annonces", routes.dashboardListings],
        ["Messages", routes.dashboardMessages],
        ["Contacts", routes.dashboardContacts],
        ["Statistiques", routes.dashboardStats]
      ]
    },
    {
      title: "Aide et légal",
      links: [
        ["Aide", routes.help],
        ["Conditions", routes.terms],
        ["Confidentialité", routes.privacy],
        ["Mentions légales", routes.legal],
        ["Contact", routes.contact]
      ]
    }
  ];

  document.querySelector("#real-estate-footer").innerHTML = `
    <div class="footer-grid">
      <div class="footer-brand">
        <strong>Péncmi</strong>
        <p>Portail sénégalais pour logement, hôtels, voitures et voyages interurbains.</p>
      </div>
      ${columns.map((column) => `
        <div class="footer-column">
          <h3>${column.title}</h3>
          ${column.links.map(([label, href]) => `<a href="${routeHref(href)}">${label}</a>`).join("")}
        </div>
      `).join("")}
    </div>
    <div class="footer-bottom">© 2026 Péncmi. Tous droits réservés.</div>
  `;
}

RealEstateHeader();
RealEstateHeroSearch();
RealEstateQuickTabs();
RealEstateResultsLayout();
RealEstateAdvertiserCTA();
RealEstateAgenciesSection();
RealEstateFooter();

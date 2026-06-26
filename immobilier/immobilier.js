const routes = {
  home: "/",
  realEstate: "/immobilier",
  login: "/login",
  register: "/register",
  publishRealEstate: "/login?next=/publier?category=immobilier",
  agencies: "/immobilier/agences",
  alerts: "/login?next=/immobilier/alertes",
  favorites: "/login?next=/favoris/immobilier",
};

const propertyTypes = [
  "Appartement",
  "Maison",
  "Villa",
  "Terrain",
  "Studio",
  "Chambre",
  "Bureau",
  "Commerce",
];

const mainCities = [
  "Dakar",
  "Thiès",
  "Mbour",
  "Saly",
  "Saint-Louis",
  "Touba",
  "Kaolack",
  "Ziguinchor",
  "Rufisque",
  "Pikine",
  "Guédiawaye",
  "Diamniadio",
  "Lac Rose",
  "Somone",
  "Cap Skirring",
];

const quickTabs = [
  ["Acheter", "/immobilier?transaction=achat"],
  ["Louer", "/immobilier?transaction=location"],
  ["Terrains", "/immobilier?type=terrain"],
  ["Meublés", "/immobilier?furnished=true"],
  ["Agences", routes.agencies],
  ["Favoris", routes.favorites],
  ["Publier", routes.publishRealEstate],
];

const state = {
  filters: null,
  listings: [],
  displayedListings: [],
  agencies: [],
  loading: true,
  error: "",
};

function routeHref(path) {
  if (window.PencmiConfig?.routeHref) {
    return window.PencmiConfig.routeHref(path);
  }

  if (window.location.protocol !== "file:") {
    return path;
  }

  const depth = Number(document.body?.dataset?.routeDepth || "1");
  const prefix = "../".repeat(depth);

  if (path === "/") return `${prefix}index.html`;
  if (path === "/immobilier") return `${prefix}immobilier/`;
  if (path.startsWith("/immobilier?")) return `${prefix}immobilier/${path.slice("/immobilier".length)}`;
  if (path.startsWith("/immobilier/annonce/")) {
    return `${prefix}immobilier/annonce/?id=${encodeURIComponent(path.slice("/immobilier/annonce/".length))}`;
  }
  if (path.startsWith("/login?next=/publier")) return `${prefix}publier/?category=immobilier`;
  if (path.startsWith("/login?")) return `${prefix}login/${path.slice("/login".length)}`;
  return path;
}

function getApiBaseUrl() {
  return String(window.PencmiConfig?.apiBaseUrl || window.PencmiRuntimeConfig?.apiBaseUrl || "").replace(/\/+$/, "");
}

function normalizeValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

function capitalize(value) {
  const text = String(value || "").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

function formatPriceFCFA(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return `${Number(value).toLocaleString("fr-FR")} FCFA`;
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
    commerce: "Commerce",
  };

  return labels[type] || capitalize(type);
}

function formatTransaction(transaction) {
  const labels = {
    achat: "Achat",
    vente: "Vente",
    location: "Location",
  };

  return labels[transaction] || capitalize(transaction);
}

function formatAdvertiserType(role) {
  const labels = {
    real_estate_agency: "Agence immobilière",
    advertiser_individual: "Annonceur particulier",
  };

  return labels[role] || "Annonceur";
}

function formatPropertyFeatures(listing) {
  return [
    listing.surface ? `${listing.surface} m²` : "",
    listing.bedrooms ? `${listing.bedrooms} ch.` : "",
    listing.bathrooms ? `${listing.bathrooms} sdb` : "",
    listing.furnished ? "Meublé" : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function parseSearchParams(search = window.location.search) {
  const params = new URLSearchParams(search);
  return {
    transaction: params.get("transaction") || "",
    type: params.get("type") || "",
    city: params.get("city") || params.get("location") || "",
    maxPrice: params.get("maxPrice") || "",
    furnished: params.get("furnished") || "",
  };
}

function buildSearchUrl(filters) {
  const params = new URLSearchParams();

  if (filters.transaction) params.set("transaction", filters.transaction);
  if (filters.type) params.set("type", filters.type);
  if (filters.city) params.set("city", filters.city);
  if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
  if (filters.furnished) params.set("furnished", filters.furnished);

  const query = params.toString();
  return query ? `${routes.realEstate}?${query}` : routes.realEstate;
}

function buildApiQuery(filters) {
  const params = new URLSearchParams();

  if (filters.transaction) params.set("transaction", filters.transaction);
  if (filters.type) params.set("propertyType", filters.type);
  if (filters.city) params.set("city", filters.city);

  return params.toString();
}

async function apiRequest(path) {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new Error("API immobilier indisponible.");
  }

  const response = await fetch(`${baseUrl}${path}`);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error?.message || "Chargement des annonces impossible.");
  }

  return payload?.data ?? payload;
}

function listFromApiPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function mapListing(listing) {
  const metadata = listing.metadata || {};
  const professionalProfile = listing.owner?.professionalProfile || {};
  const photos = Array.isArray(metadata.photos) ? metadata.photos.filter(Boolean) : [];
  const advertiserName =
    professionalProfile.businessName ||
    [listing.owner?.firstName, listing.owner?.lastName].filter(Boolean).join(" ") ||
    "Annonceur";

  return {
    id: listing.id,
    slug: listing.slug,
    title: listing.title,
    city: listing.city,
    district: listing.neighborhood,
    price: metadata.price ?? listing.price ?? null,
    transaction: listing.transaction || "",
    propertyType: listing.propertyType || "",
    surface: metadata.surface,
    bedrooms: metadata.bedrooms,
    bathrooms: metadata.bathrooms,
    furnished: Boolean(metadata.furnished),
    views: Number(metadata.views || 0),
    favorites: Number(metadata.favorites || 0),
    coverPhoto: metadata.coverPhoto || photos[0] || "",
    advertiser: {
      name: advertiserName,
      type: formatAdvertiserType(listing.owner?.role),
      city: professionalProfile.city || listing.owner?.city || "",
      verified: Boolean(professionalProfile.verified),
      logoUrl: professionalProfile.logoUrl || "",
    },
  };
}

function buildAgencies(listings) {
  const seen = new Set();

  return listings
    .filter((listing) => listing.advertiser.name)
    .map((listing) => ({
      name: listing.advertiser.name,
      city: listing.advertiser.city,
      type: listing.advertiser.type,
      verified: listing.advertiser.verified,
      logoUrl: listing.advertiser.logoUrl,
    }))
    .filter((agency) => {
      const key = `${agency.name}::${agency.city}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function applyClientFilters(listings, filters) {
  const maxPrice = Number(filters.maxPrice || 0);

  return listings.filter((listing) => {
    if (filters.furnished === "true" && !listing.furnished) return false;
    if (maxPrice && Number(listing.price || 0) > maxPrice) return false;
    return true;
  });
}

function optionElements(values, selectedValue = "") {
  return values
    .map((value) => {
      const normalized = normalizeValue(value);
      const selected = normalized === selectedValue ? " selected" : "";
      return `<option value="${normalized}"${selected}>${value}</option>`;
    })
    .join("");
}

function RealEstateHeader() {
  const root = document.querySelector("#real-estate-header");
  if (!root) return;

  root.innerHTML = `
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
        <a href="/hotels">Hôtels</a>
        <a href="/voitures">Voitures</a>
        <a href="/voyages">Voyages interurbains</a>
      </nav>
      <div class="header-actions">
        <a class="btn btn-ghost" href="${routeHref(routes.login)}">Se connecter</a>
        <a class="btn btn-light" href="${routeHref(routes.register)}">Créer mon espace</a>
        <a class="btn btn-primary" href="${routeHref(routes.publishRealEstate)}">Publier une annonce</a>
      </div>
    </div>
  `;

  const toggle = root.querySelector(".menu-toggle");
  const panel = root.querySelector(".header-panel");

  toggle?.addEventListener("click", () => {
    const isOpen = panel.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
}

function RealEstateHeroSearch() {
  const filters = state.filters;
  const root = document.querySelector("#real-estate-hero");
  if (!root) return;

  root.innerHTML = `
    <div class="hero-inner">
      <div class="hero-copy">
        <h1>Trouvez votre bien immobilier au Sénégal</h1>
        <p>Maisons, appartements, terrains, studios et biens meublés à louer ou à acheter.</p>
      </div>
      <form class="property-search" id="property-search">
        <div class="field">
          <label for="transaction">Type de projet</label>
          <select id="transaction" name="transaction">
            <option value="achat"${filters.transaction === "achat" ? " selected" : ""}>Acheter</option>
            <option value="location"${filters.transaction === "location" ? " selected" : ""}>Louer</option>
            <option value="vente"${filters.transaction === "vente" ? " selected" : ""}>Vente</option>
          </select>
        </div>
        <div class="field">
          <label for="type">Type de bien</label>
          <select id="type" name="type">
            <option value="">Tous les biens</option>
            ${optionElements(propertyTypes, filters.type)}
          </select>
        </div>
        <div class="field">
          <label for="location">Ville ou quartier</label>
          <input id="location" name="city" type="search" list="main-cities" value="${filters.city}" placeholder="Dakar, Saly, Thiès">
          <datalist id="main-cities">
            ${mainCities.map((city) => `<option value="${city}"></option>`).join("")}
          </datalist>
        </div>
        <div class="field">
          <label for="maxPrice">Budget maximum</label>
          <input id="maxPrice" name="maxPrice" type="number" inputmode="numeric" min="0" value="${filters.maxPrice}" placeholder="500000">
        </div>
        <button class="btn btn-primary" type="submit">Rechercher</button>
      </form>
    </div>
  `;

  root.querySelector("#property-search")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    window.location.href = routeHref(
      buildSearchUrl({
        transaction: String(form.get("transaction") || ""),
        type: String(form.get("type") || ""),
        city: String(form.get("city") || ""),
        maxPrice: String(form.get("maxPrice") || ""),
      }),
    );
  });
}

function RealEstateQuickTabs() {
  const root = document.querySelector("#real-estate-tabs");
  if (!root) return;

  root.innerHTML = quickTabs
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
              <option value="achat"${state.filters.transaction === "achat" ? " selected" : ""}>Achat</option>
              <option value="location"${state.filters.transaction === "location" ? " selected" : ""}>Location</option>
              <option value="vente"${state.filters.transaction === "vente" ? " selected" : ""}>Vente</option>
            </select>
          </div>
        </fieldset>

        <fieldset class="filter-group">
          <legend>Type de bien</legend>
          <div class="filter-grid">
            <select name="type">
              <option value="">Tous les biens</option>
              ${optionElements(propertyTypes, state.filters.type)}
            </select>
          </div>
        </fieldset>

        <fieldset class="filter-group">
          <legend>Localisation</legend>
          <div class="filter-grid">
            <select name="city">
              <option value="">Toutes les villes</option>
              ${mainCities.map((city) => `<option value="${city}"${state.filters.city === city ? " selected" : ""}>${city}</option>`).join("")}
            </select>
          </div>
        </fieldset>

        <fieldset class="filter-group">
          <legend>Prix</legend>
          <div class="filter-grid">
            <input name="maxPrice" type="number" inputmode="numeric" min="0" value="${state.filters.maxPrice}" placeholder="Prix maximum">
          </div>
        </fieldset>

        <fieldset class="filter-group">
          <legend>Options</legend>
          <div class="option-list">
            <label class="check-option">
              <input type="checkbox" name="furnished" value="true"${state.filters.furnished === "true" ? " checked" : ""}>
              <span>Meublé</span>
            </label>
          </div>
        </fieldset>

        <button class="btn btn-primary" type="submit">Appliquer les filtres</button>
      </form>
    </aside>
  `;
}

function FavoriteButton() {
  return `
    <a class="favorite-button" href="${routeHref(routes.favorites)}" aria-label="Ajouter aux favoris">
      <span aria-hidden="true">♡</span>
    </a>
  `;
}

function SavedSearchButton() {
  return `<a class="btn btn-light" href="${routeHref(routes.alerts)}">Créer une alerte</a>`;
}

function RealEstateListingCard(listing) {
  const media = listing.coverPhoto
    ? `<img src="${listing.coverPhoto}" alt="${listing.title}" style="width:100%;height:220px;object-fit:cover;border-radius:8px;">`
    : `<div class="map-placeholder" style="min-height:220px;">Aucune photo disponible</div>`;

  const badges = [
    formatTransaction(listing.transaction),
    formatPropertyType(listing.propertyType),
    listing.advertiser.verified ? "Vérifié" : "",
  ].filter(Boolean);

  return `
    <article class="dashboard-card" style="display:grid;gap:14px;margin-bottom:16px;">
      <div>${media}</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        ${badges.map((badge) => `<span class="status-badge">${badge}</span>`).join("")}
      </div>
      <div style="display:grid;gap:8px;">
        <h3 style="margin:0;color:var(--blue-dark);">${listing.title}</h3>
        <p style="margin:0;color:var(--muted);">${[listing.district, listing.city].filter(Boolean).join(", ")}</p>
        ${listing.price ? `<strong style="font-size:1.1rem;color:var(--blue-dark);">${formatPriceFCFA(listing.price)}</strong>` : ""}
        ${formatPropertyFeatures(listing) ? `<p style="margin:0;color:var(--muted);">${formatPropertyFeatures(listing)}</p>` : ""}
        <p style="margin:0;color:var(--muted);">Annonceur : ${listing.advertiser.name}</p>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;">
        <a class="btn btn-primary" href="${routeHref(`/immobilier/annonce/${listing.id}`)}">Voir détails</a>
        ${FavoriteButton()}
      </div>
    </article>
  `;
}

function RealEstateEmptyState(message = "Aucune annonce immobilière disponible pour le moment.") {
  return `
    <div class="empty-state">
      <div>
        <h3>${message}</h3>
        <p>Les résultats s’affichent ici dès qu’une annonce correspond à votre recherche.</p>
        <div class="empty-actions">
          <a class="btn btn-ghost" href="#property-search">Modifier ma recherche</a>
          ${SavedSearchButton()}
        </div>
      </div>
    </div>
  `;
}

function AgenciesSection() {
  const root = document.querySelector("#real-estate-agencies");
  if (!root) return;

  if (!state.agencies.length) {
    root.innerHTML = `
      <div class="agencies-inner">
        <h2>Annonceurs immobiliers</h2>
        <p>Aucun annonceur publié pour le moment.</p>
      </div>
    `;
    return;
  }

  root.innerHTML = `
    <div class="agencies-inner">
      <h2>Annonceurs immobiliers</h2>
      <p>Les professionnels publiés apparaissent ici automatiquement.</p>
      <div class="listing-performance-cards" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-top:18px;">
        ${state.agencies.map((agency) => `
          <article class="dashboard-card">
            <div style="display:flex;align-items:center;gap:12px;">
              ${agency.logoUrl ? `<img src="${agency.logoUrl}" alt="${agency.name}" style="width:48px;height:48px;object-fit:contain;border-radius:8px;border:1px solid var(--line);">` : `<div class="brand-mark" style="width:48px;height:48px;">${agency.name.slice(0, 1).toUpperCase()}</div>`}
              <div>
                <strong>${agency.name}</strong>
                <p style="margin:4px 0 0;color:var(--muted);">${agency.type}${agency.city ? ` · ${agency.city}` : ""}</p>
              </div>
            </div>
            ${agency.verified ? `<div style="margin-top:12px;"><span class="status-badge">Vérifié</span></div>` : ""}
          </article>
        `).join("")}
      </div>
    </div>
  `;
}

function RealEstateAdvertiserCTA() {
  const root = document.querySelector("#real-estate-advertiser");
  if (!root) return;

  root.innerHTML = `
    <div class="advertiser-inner">
      <div>
        <h2>Vous avez un bien à louer ou à vendre ?</h2>
        <p>Publiez votre annonce et gérez vos demandes depuis votre espace annonceur.</p>
        <div class="advertiser-actions">
          <a class="btn btn-primary" href="${routeHref(routes.publishRealEstate)}">Publier une annonce</a>
          <a class="btn btn-light" href="${routeHref(routes.register)}">Créer mon espace</a>
        </div>
      </div>
      <div class="advertiser-benefits">
        <span>Publier un bien</span>
        <span>Recevoir des demandes</span>
        <span>Suivre les visites</span>
        <span>Gérer vos contacts</span>
      </div>
    </div>
  `;
}

function RealEstateFooter() {
  const root = document.querySelector("#real-estate-footer");
  if (!root) return;

  root.innerHTML = `
    <div class="footer-grid">
      <div class="footer-brand">
        <strong>Péncmi</strong>
        <p>Plateforme sénégalaise pour l’immobilier, les hôtels, les voitures et les voyages interurbains.</p>
      </div>
      <div class="footer-column">
        <h3>Immobilier</h3>
        <a href="${routeHref("/immobilier?transaction=achat")}">Acheter</a>
        <a href="${routeHref("/immobilier?transaction=location")}">Louer</a>
        <a href="${routeHref("/immobilier?type=terrain")}">Terrains</a>
        <a href="${routeHref(routes.favorites)}">Favoris</a>
      </div>
      <div class="footer-column">
        <h3>Annonceur</h3>
        <a href="${routeHref(routes.publishRealEstate)}">Publier une annonce</a>
        <a href="${routeHref("/dashboard/immobilier")}">Dashboard immobilier</a>
      </div>
      <div class="footer-column">
        <h3>Support</h3>
        <a href="/aide">Aide</a>
        <a href="/contact">Contact</a>
        <a href="/mentions-legales">Mentions légales</a>
        <a href="/confidentialite">Confidentialité</a>
      </div>
    </div>
    <div class="footer-bottom">© 2026 Péncmi. Tous droits réservés.</div>
  `;
}

function bindFilters() {
  document.querySelector("[data-open-filters]")?.addEventListener("click", () => {
    document.querySelector("#filters-panel")?.classList.add("is-open");
  });

  document.querySelector("[data-close-filters]")?.addEventListener("click", () => {
    document.querySelector("#filters-panel")?.classList.remove("is-open");
  });

  document.querySelector("[data-toggle-map]")?.addEventListener("click", () => {
    document.querySelector("#map-panel")?.classList.toggle("is-open");
  });

  document.querySelector("#filters-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextFilters = {
      transaction: String(form.get("transaction") || ""),
      type: String(form.get("type") || ""),
      city: String(form.get("city") || ""),
      maxPrice: String(form.get("maxPrice") || ""),
      furnished: form.get("furnished") ? "true" : "",
    };
    window.location.href = routeHref(buildSearchUrl(nextFilters));
  });
}

function ResultsLayout() {
  const root = document.querySelector("#real-estate-results");
  if (!root) return;

  let content = RealEstateEmptyState();
  if (state.loading) {
    content = RealEstateEmptyState("Chargement des annonces...");
  } else if (state.error) {
    content = RealEstateEmptyState(state.error);
  } else if (state.displayedListings.length) {
    content = state.displayedListings.map(RealEstateListingCard).join("");
  }

  root.innerHTML = `
    <div class="results-toolbar">
      <div>
        <h2>Annonces immobilières</h2>
        <p>${state.loading ? "Chargement..." : `${state.displayedListings.length} annonce${state.displayedListings.length > 1 ? "s" : ""} disponible${state.displayedListings.length > 1 ? "s" : ""}`}</p>
      </div>
      <div class="results-actions">
        <button class="btn btn-ghost filter-toggle" type="button" data-open-filters>Filtres</button>
        <button class="btn btn-ghost map-toggle" type="button" data-toggle-map>Voir la carte</button>
        <a class="btn btn-ghost" href="${routeHref(routes.favorites)}">Mes favoris</a>
        ${SavedSearchButton()}
      </div>
    </div>

    <div class="results-layout">
      ${RealEstateFilters()}
      <div class="results-list">${content}</div>
      <aside class="map-panel" id="map-panel" aria-label="Zone d’information">
        <div class="map-placeholder">
          <div>
            <strong>Recherche active</strong>
            <p style="margin:8px 0 0;">${state.filters.city || "Tout le Sénégal"}${state.filters.transaction ? ` · ${formatTransaction(state.filters.transaction)}` : ""}${state.filters.type ? ` · ${formatPropertyType(state.filters.type)}` : ""}</p>
          </div>
        </div>
      </aside>
    </div>
  `;

  bindFilters();
}

async function loadListings() {
  state.loading = true;
  state.error = "";
  ResultsLayout();

  try {
    const query = buildApiQuery(state.filters);
    const payload = await apiRequest(`/immobilier${query ? `?${query}` : ""}`);
    state.listings = listFromApiPayload(payload).map(mapListing);
    state.displayedListings = applyClientFilters(state.listings, state.filters);
    state.agencies = buildAgencies(state.listings);
  } catch (error) {
    state.listings = [];
    state.displayedListings = [];
    state.agencies = [];
    state.error = error instanceof Error ? error.message : "Chargement impossible.";
  } finally {
    state.loading = false;
    ResultsLayout();
    AgenciesSection();
  }
}

function initializePage() {
  state.filters = parseSearchParams();
  RealEstateHeader();
  RealEstateHeroSearch();
  RealEstateQuickTabs();
  ResultsLayout();
  RealEstateAdvertiserCTA();
  AgenciesSection();
  RealEstateFooter();
  void loadListings();
}

document.addEventListener("DOMContentLoaded", initializePage);

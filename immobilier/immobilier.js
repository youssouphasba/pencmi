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
  meta: { page: 1, total: 0, totalPages: 1 },
  mapOpen: readMapPreference(),
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

function escapeValue(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : 0;
}

// The map code is only fetched when a visitor opens the map. Every page of the
// section loads this script from a different depth, hence the script-relative URL.
const searchScriptSrc = document.currentScript?.src || "";
let mapScriptPromise = null;

function loadMapScript() {
  if (window.PencmiMap) return Promise.resolve();
  if (!mapScriptPromise) {
    mapScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = new URL("../config/senegal-map.js", searchScriptSrc || window.location.href).href;
      script.onload = resolve;
      script.onerror = () => reject(new Error("Carte indisponible"));
      document.head.append(script);
    }).catch((error) => {
      mapScriptPromise = null;
      throw error;
    });
  }
  return mapScriptPromise;
}

// The map choice follows the visitor from page to page of the results.
function readMapPreference() {
  try {
    return window.sessionStorage.getItem("pencmi.map") === "open";
  } catch {
    return false;
  }
}

function saveMapPreference(open) {
  try {
    window.sessionStorage.setItem("pencmi.map", open ? "open" : "closed");
  } catch {
    // Storage can be unavailable (private mode); the map still works for this page.
  }
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
  // Landing pages such as /immobilier/location preset a filter; the address wins over it.
  const params = new URLSearchParams(document.body?.dataset?.searchPreset || "");
  new URLSearchParams(search).forEach((value, key) => params.set(key, value));
  return {
    transaction: params.get("transaction") || "",
    type: params.get("type") || "",
    city: params.get("city") || params.get("location") || "",
    maxPrice: positiveInteger(params.get("maxPrice")) ? String(positiveInteger(params.get("maxPrice"))) : "",
    furnished: params.get("furnished") === "true" ? "true" : "",
    page: positiveInteger(params.get("page")) || 1,
  };
}

function buildSearchUrl(filters) {
  const params = new URLSearchParams();

  if (filters.transaction) params.set("transaction", filters.transaction);
  if (filters.type) params.set("type", filters.type);
  if (filters.city) params.set("city", filters.city);
  if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
  if (filters.furnished) params.set("furnished", filters.furnished);
  if (filters.page > 1) params.set("page", String(filters.page));

  const query = params.toString();
  return query ? `${routes.realEstate}?${query}` : routes.realEstate;
}

function buildApiQuery(filters) {
  const params = new URLSearchParams();

  if (filters.transaction) params.set("transaction", filters.transaction);
  if (filters.type) params.set("propertyType", filters.type);
  if (filters.city) params.set("city", filters.city);
  if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
  if (filters.furnished === "true") params.set("furnished", "true");
  if (filters.page > 1) params.set("page", String(filters.page));

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

  return { data: payload?.data ?? payload, meta: payload?.meta || null };
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
    furnished: Boolean(metadata.features?.furnished),
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
          <input id="location" name="city" type="search" list="main-cities" value="${escapeValue(filters.city)}" placeholder="Dakar, Saly, Thiès">
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

function SavedSearchButton() {
  return `<a class="btn btn-light" href="${routeHref(routes.alerts)}">Créer une alerte</a>`;
}

function RealEstateListingCard(listing) {
  const media = listing.coverPhoto
    ? `<img src="${escapeValue(listing.coverPhoto)}" alt="${escapeValue(listing.title)}" style="width:100%;height:220px;object-fit:cover;border-radius:8px;">`
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
        <h3 style="margin:0;color:var(--blue-dark);">${escapeValue(listing.title)}</h3>
        <p style="margin:0;color:var(--muted);">${escapeValue([listing.district, listing.city].filter(Boolean).join(", "))}</p>
        ${listing.price ? `<strong style="font-size:1.1rem;color:var(--blue-dark);">${formatPriceFCFA(listing.price)}</strong>` : ""}
        ${formatPropertyFeatures(listing) ? `<p style="margin:0;color:var(--muted);">${formatPropertyFeatures(listing)}</p>` : ""}
        <p style="margin:0;color:var(--muted);">Annonceur : ${escapeValue(listing.advertiser.name)}</p>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;">
        <a class="btn btn-primary" href="${escapeValue(routeHref(`/immobilier/annonce/${listing.id}`))}">Voir détails</a>
        <span data-favorite-module="real_estate" data-favorite-id="${escapeValue(listing.id)}"></span>
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
              ${agency.logoUrl ? `<img src="${escapeValue(agency.logoUrl)}" alt="${escapeValue(agency.name)}" style="width:48px;height:48px;object-fit:contain;border-radius:8px;border:1px solid var(--line);">` : `<div class="brand-mark" style="width:48px;height:48px;">${escapeValue(agency.name.slice(0, 1).toUpperCase())}</div>`}
              <div>
                <strong>${escapeValue(agency.name)}</strong>
                <p style="margin:4px 0 0;color:var(--muted);">${agency.type}${agency.city ? ` · ${escapeValue(agency.city)}` : ""}</p>
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
    state.mapOpen = !state.mapOpen;
    saveMapPreference(state.mapOpen);
    ResultsLayout();
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

function ResultsPagination() {
  const { page, totalPages } = state.meta;
  if (state.loading || state.error || totalPages <= 1) return "";

  const link = (label, target) =>
    `<a class="btn btn-light" href="${escapeValue(routeHref(buildSearchUrl({ ...state.filters, page: target })))}">${label}</a>`;

  return `
    <nav class="results-pagination" aria-label="Pages de résultats">
      ${page > 1 ? link("Précédent", Math.min(page - 1, totalPages)) : ""}
      <span>Page ${page} sur ${totalPages}</span>
      ${page < totalPages ? link("Suivant", page + 1) : ""}
    </nav>
  `;
}

function ResultsMapPanel() {
  if (!state.mapOpen) return "";
  return `
    <section class="map-panel" id="map-panel" aria-label="Carte des annonces">
      <p class="map-note" role="status">Chargement de la carte...</p>
    </section>
  `;
}

async function renderResultsMap() {
  const panel = document.querySelector("#map-panel");
  if (!panel) return;

  const items = state.listings.map((listing) => ({
    city: listing.city,
    title: listing.title,
    href: routeHref(`/immobilier/annonce/${listing.id}`),
    detail: listing.price ? formatPriceFCFA(listing.price) : "",
  }));

  try {
    await loadMapScript();
    if (panel.isConnected) await window.PencmiMap.mount(panel, items, { focusCity: state.filters.city });
  } catch {
    const note = document.createElement("p");
    note.className = "map-note";
    note.setAttribute("role", "alert");
    note.textContent = "La carte ne peut pas être affichée pour le moment. Les annonces restent disponibles dans la liste.";
    panel.replaceChildren(note);
  }
}

function ResultsLayout() {
  const root = document.querySelector("#real-estate-results");
  if (!root) return;

  let content = RealEstateEmptyState();
  if (state.loading) {
    content = RealEstateEmptyState("Chargement des annonces...");
  } else if (state.error) {
    content = RealEstateEmptyState(state.error);
  } else if (state.listings.length) {
    content = state.listings.map(RealEstateListingCard).join("");
  }

  const total = state.meta.total;

  root.innerHTML = `
    <div class="results-toolbar">
      <div>
        <h2>Annonces immobilières</h2>
        <p>${state.loading ? "Chargement..." : `${total} annonce${total > 1 ? "s" : ""} disponible${total > 1 ? "s" : ""}`}</p>
      </div>
      <div class="results-actions">
        <button class="btn btn-ghost filter-toggle" type="button" data-open-filters>Filtres</button>
        <button class="btn btn-ghost map-toggle" type="button" data-toggle-map aria-expanded="${state.mapOpen}" aria-controls="map-panel">${state.mapOpen ? "Masquer la carte" : "Voir la carte"}</button>
        <a class="btn btn-ghost" href="${routeHref(routes.favorites)}">Mes favoris</a>
        ${SavedSearchButton()}
      </div>
    </div>

    <div data-save-search="real_estate"></div>
    <div class="results-layout">
      ${RealEstateFilters()}
      <div class="results-list">${ResultsMapPanel()}${content}${ResultsPagination()}</div>
    </div>
  `;

  bindFilters();
  void renderResultsMap();
}

async function loadListings() {
  state.loading = true;
  state.error = "";
  ResultsLayout();

  try {
    const query = buildApiQuery(state.filters);
    const { data, meta } = await apiRequest(`/immobilier${query ? `?${query}` : ""}`);
    state.listings = listFromApiPayload(data).map(mapListing);
    state.meta = {
      page: Number(meta?.page) || state.filters.page,
      total: Number(meta?.total ?? state.listings.length),
      totalPages: Number(meta?.totalPages) || 1,
    };
    state.agencies = buildAgencies(state.listings);
  } catch (error) {
    state.listings = [];
    state.meta = { page: 1, total: 0, totalPages: 1 };
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
void import("../saved/enhance.mjs").catch(() => {});

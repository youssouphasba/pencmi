const vehicleRoutes = {
  home: "/",
  vehicles: "/voitures",
  alerts: "/voitures/alertes",
  favorites: "/favoris/voitures",
  publish: "/publier?category=voiture",
  dashboard: "/dashboard/voitures",
  login: "/login",
};

let vehicleState = {
  all: [],
  filtered: [],
};

function vehicleRouteHref(path) {
  return window.PencmiConfig?.routeHref ? window.PencmiConfig.routeHref(path) : path;
}

function vehicleMetadata(listing) {
  return listing.metadata || {};
}

function vehicleImage(listing) {
  return pencmiListingPhotos(vehicleMetadata(listing))[0] || "";
}

function vehicleAdvertiser(listing) {
  return pencmiBuildAdvertiser(listing.owner);
}

function vehicleQueryValues() {
  const params = pencmiQueryParams();
  return {
    query: params.get("query") || "",
    city: params.get("city") || "",
    type: params.get("type") || params.get("vehicleMode") || "",
    brand: params.get("brand") || "",
    model: params.get("model") || "",
    minPrice: params.get("minPrice") || "",
    maxPrice: params.get("maxPrice") || "",
    fuel: params.get("fuel") || "",
    gearbox: params.get("gearbox") || "",
  };
}

function setVehicleQuery(nextValues) {
  const params = new URLSearchParams();
  Object.entries(nextValues).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      params.set(key, String(value).trim());
    }
  });
  window.location.href = `${vehicleRouteHref(vehicleRoutes.vehicles)}${params.toString() ? `?${params.toString()}` : ""}`;
}

function vehiclesHeader() {
  document.querySelector("#vehicles-header").innerHTML = `
    <a class="brand" href="${vehicleRouteHref(vehicleRoutes.home)}" aria-label="Accueil Péncmi"><span class="brand-mark">P</span><span><strong>Péncmi</strong><small>Voitures</small></span></a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="vehicles-menu" aria-label="Ouvrir le menu"><span></span><span></span><span></span></button>
    <div class="header-panel" id="vehicles-menu">
      <nav class="main-nav" aria-label="Navigation principale"><a href="${vehicleRouteHref("/immobilier")}">Immobilier</a><a href="${vehicleRouteHref("/hotels")}">Hôtels</a><a href="${vehicleRouteHref(vehicleRoutes.vehicles)}" aria-current="page">Voitures</a><a href="${vehicleRouteHref(vehicleRoutes.favorites)}">Favoris</a><a href="${vehicleRouteHref(vehicleRoutes.alerts)}">Alertes</a></nav>
      <div class="header-actions"><a class="btn btn-ghost" href="${vehicleRouteHref(vehicleRoutes.login)}">Se connecter</a><a class="btn btn-primary" href="${vehicleRouteHref(vehicleRoutes.publish)}">Publier une voiture</a></div>
    </div>
  `;

  const toggle = document.querySelector(".menu-toggle");
  const panel = document.querySelector(".header-panel");
  toggle?.addEventListener("click", () => {
    const isOpen = panel.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
}

function vehiclesHero() {
  const values = vehicleQueryValues();
  document.querySelector("#vehicle-hero").innerHTML = `
    <div class="vehicle-hero-inner">
      <h1>Trouvez une voiture au Sénégal</h1>
      <p>Achetez, louez ou trouvez une voiture avec chauffeur selon votre budget et votre ville.</p>
      <form class="vehicle-search-card" id="vehicle-search-form">
        <label class="vehicle-field"><span>Type</span><select name="type"><option value="">Tous</option><option value="sale"${values.type === "sale" ? " selected" : ""}>Achat / vente</option><option value="rental"${values.type === "rental" ? " selected" : ""}>Location</option><option value="chauffeur"${values.type === "chauffeur" ? " selected" : ""}>Avec chauffeur</option></select></label>
        <label class="vehicle-field"><span>Marque</span><input name="brand" type="search" value="${values.brand}" placeholder="Toyota, Hyundai..."></label>
        <label class="vehicle-field"><span>Modèle</span><input name="model" type="search" value="${values.model}" placeholder="Prado, Tucson..."></label>
        <label class="vehicle-field"><span>Ville ou région</span><input name="city" type="search" value="${values.city}" placeholder="Dakar, Saly..."></label>
        <label class="vehicle-field"><span>Budget maximum</span><input name="maxPrice" type="number" min="0" value="${values.maxPrice}" placeholder="FCFA"></label>
        <button class="btn btn-primary" type="submit">Rechercher</button>
      </form>
    </div>
  `;

  document.querySelector("#vehicle-search-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setVehicleQuery({
      type: formData.get("type"),
      brand: formData.get("brand"),
      model: formData.get("model"),
      city: formData.get("city"),
      maxPrice: formData.get("maxPrice"),
      minPrice: vehicleQueryValues().minPrice,
      fuel: vehicleQueryValues().fuel,
      gearbox: vehicleQueryValues().gearbox,
      query: vehicleQueryValues().query,
    });
  });
}

function vehicleQuickSuggestions() {
  const suggestions = [
    ["Toyota Prado", "/voitures?brand=Toyota&model=Prado"],
    ["Hyundai Tucson", "/voitures?brand=Hyundai&model=Tucson"],
    ["Location voiture Dakar", "/voitures?type=rental&city=Dakar"],
    ["Voiture avec chauffeur", "/voitures?type=chauffeur"],
    ["SUV au Sénégal", "/voitures?query=SUV"],
    ["Citadine économique", "/voitures?query=citadine"],
  ];
  document.querySelector("#vehicle-quick-tabs").innerHTML = suggestions.map(([label, href]) => `<a href="${vehicleRouteHref(href)}">${label}</a>`).join("");
}

function vehicleFiltersMarkup() {
  const values = vehicleQueryValues();
  return `
    <aside class="vehicle-filters">
      <form id="vehicle-filter-form">
        <fieldset class="vehicle-filter-group"><legend>Recherche</legend><div class="vehicle-filter-grid"><input name="query" value="${values.query}" placeholder="Titre ou description"><input name="city" value="${values.city}" placeholder="Ville"></div></fieldset>
        <fieldset class="vehicle-filter-group"><legend>Type d’annonce</legend><select name="type"><option value="">Tous les types</option><option value="sale"${values.type === "sale" ? " selected" : ""}>Achat / vente</option><option value="rental"${values.type === "rental" ? " selected" : ""}>Location</option><option value="chauffeur"${values.type === "chauffeur" ? " selected" : ""}>Avec chauffeur</option></select></fieldset>
        <fieldset class="vehicle-filter-group"><legend>Marque et modèle</legend><div class="vehicle-filter-grid"><input name="brand" value="${values.brand}" placeholder="Marque"><input name="model" value="${values.model}" placeholder="Modèle"></div></fieldset>
        <fieldset class="vehicle-filter-group"><legend>Budget</legend><div class="vehicle-filter-grid"><input name="minPrice" type="number" min="0" value="${values.minPrice}" placeholder="Minimum"><input name="maxPrice" type="number" min="0" value="${values.maxPrice}" placeholder="Maximum"></div></fieldset>
        <fieldset class="vehicle-filter-group"><legend>Carburant</legend><select name="fuel"><option value="">Tous</option><option value="Essence"${values.fuel === "Essence" ? " selected" : ""}>Essence</option><option value="Diesel"${values.fuel === "Diesel" ? " selected" : ""}>Diesel</option><option value="Hybride"${values.fuel === "Hybride" ? " selected" : ""}>Hybride</option></select></fieldset>
        <fieldset class="vehicle-filter-group"><legend>Boîte</legend><select name="gearbox"><option value="">Toutes</option><option value="Automatique"${values.gearbox === "Automatique" ? " selected" : ""}>Automatique</option><option value="Manuelle"${values.gearbox === "Manuelle" ? " selected" : ""}>Manuelle</option></select></fieldset>
        <div class="vehicle-card-actions"><button class="btn btn-primary" type="submit">Appliquer</button><a class="btn btn-ghost" href="${vehicleRouteHref(vehicleRoutes.vehicles)}">Réinitialiser</a></div>
      </form>
    </aside>
  `;
}

function vehicleCard(listing) {
  const metadata = vehicleMetadata(listing);
  const advertiser = vehicleAdvertiser(listing);
  return `
    <article class="vehicle-card">
      <div class="vehicle-card-photo">${vehicleImage(listing) ? `<img src="${vehicleImage(listing)}" alt="${listing.title}" style="width:100%;height:100%;object-fit:cover;">` : "Aucune image"}</div>
      <div class="vehicle-card-body">
        <h3>${metadata.brand || ""} ${metadata.model || listing.title}</h3>
        <p>${[listing.vehicleMode, listing.city, metadata.year].filter(Boolean).join(" · ")}</p>
        <div class="vehicle-chip-row">
          ${listing.price ? `<span class="vehicle-chip">${pencmiFormatPrice(listing.price, listing.currency || "FCFA")}</span>` : ""}
          ${metadata.fuel ? `<span class="vehicle-chip">${metadata.fuel}</span>` : ""}
          ${metadata.gearbox ? `<span class="vehicle-chip">${metadata.gearbox}</span>` : ""}
          ${advertiser.verified ? `<span class="vehicle-chip">Vérifié</span>` : ""}
        </div>
        <div class="vehicle-card-actions">
          <a class="btn btn-light" href="${vehicleRouteHref(`/voitures/${listing.id}`)}">Voir détails</a>
          <a class="btn btn-primary" href="${vehicleRouteHref(`/voitures/${listing.id}`)}#contact">Contacter</a>
        </div>
      </div>
    </article>
  `;
}

function vehicleEmptyState() {
  return `<section class="vehicle-empty"><div><h2>Aucune voiture disponible pour le moment.</h2><p>Vous pouvez modifier votre recherche ou créer une alerte pour être informé plus tard.</p><div class="vehicle-empty-actions"><a class="btn btn-ghost" href="${vehicleRouteHref(vehicleRoutes.vehicles)}">Modifier ma recherche</a><a class="btn btn-primary" href="${vehicleRouteHref(vehicleRoutes.alerts)}">Créer une alerte</a></div></div></section>`;
}

function vehiclesPage() {
  const values = vehicleQueryValues();
  const filtersLabel = [values.brand, values.model, values.city, values.type].filter(Boolean).join(" · ");
  document.querySelector("#vehicle-results").innerHTML = `
    <div class="vehicle-results-layout">
      ${vehicleFiltersMarkup()}
      <section class="vehicle-list">
        <section class="vehicle-detail-card" style="margin-bottom:16px;"><h2>Résultats</h2><p>${vehicleState.filtered.length} véhicule${vehicleState.filtered.length > 1 ? "s" : ""}${filtersLabel ? ` pour ${filtersLabel}` : ""}</p></section>
        ${vehicleState.filtered.length ? vehicleState.filtered.map(vehicleCard).join("") : vehicleEmptyState()}
      </section>
      <aside class="vehicle-map"><div class="vehicle-map-placeholder">Localisation et points de retrait prévus ici.</div></aside>
    </div>
  `;

  document.querySelector("#vehicle-filter-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setVehicleQuery({
      query: formData.get("query"),
      city: formData.get("city"),
      type: formData.get("type"),
      brand: formData.get("brand"),
      model: formData.get("model"),
      minPrice: formData.get("minPrice"),
      maxPrice: formData.get("maxPrice"),
      fuel: formData.get("fuel"),
      gearbox: formData.get("gearbox"),
    });
  });
}

function vehiclesFooter() {
  document.querySelector("#vehicles-footer").innerHTML = `
    <div class="footer-grid">
      <div class="footer-brand"><strong>Péncmi</strong><p>Voitures à vendre, à louer et avec chauffeur au Sénégal.</p></div>
      <div class="footer-column"><h3>Clients</h3><a href="${vehicleRouteHref(vehicleRoutes.vehicles)}">Rechercher</a><a href="${vehicleRouteHref(vehicleRoutes.favorites)}">Favoris</a><a href="${vehicleRouteHref(vehicleRoutes.alerts)}">Alertes</a></div>
      <div class="footer-column"><h3>Annonceurs</h3><a href="${vehicleRouteHref(vehicleRoutes.publish)}">Publier</a><a href="${vehicleRouteHref(vehicleRoutes.dashboard)}">Dashboard voitures</a></div>
      <div class="footer-column"><h3>Péncmi</h3><a href="${vehicleRouteHref(vehicleRoutes.home)}">Accueil</a><a href="${vehicleRouteHref("/hotels")}">Hôtels</a></div>
    </div>
    <div class="footer-bottom">© 2026 Péncmi. Tous droits réservés.</div>
  `;
}

function filterVehicles(listings) {
  const values = vehicleQueryValues();
  const normalizedQuery = pencmiNormalizeText(values.query);
  const normalizedCity = pencmiNormalizeText(values.city);
  const normalizedBrand = pencmiNormalizeText(values.brand);
  const normalizedModel = pencmiNormalizeText(values.model);
  const normalizedFuel = pencmiNormalizeText(values.fuel);
  const normalizedGearbox = pencmiNormalizeText(values.gearbox);
  const minPrice = Number(values.minPrice || 0);
  const maxPrice = Number(values.maxPrice || 0);

  return listings.filter((listing) => {
    const metadata = vehicleMetadata(listing);
    const haystack = pencmiNormalizeText([
      listing.title,
      listing.description,
      listing.city,
      listing.vehicleMode,
      metadata.brand,
      metadata.model,
      metadata.category,
    ].filter(Boolean).join(" "));
    const price = Number(listing.price || metadata.price || 0);

    if (normalizedQuery && !haystack.includes(normalizedQuery)) return false;
    if (normalizedCity && pencmiNormalizeText(listing.city) !== normalizedCity) return false;
    if (values.type && pencmiNormalizeText(listing.vehicleMode) !== pencmiNormalizeText(values.type)) return false;
    if (normalizedBrand && pencmiNormalizeText(metadata.brand) !== normalizedBrand) return false;
    if (normalizedModel && pencmiNormalizeText(metadata.model) !== normalizedModel) return false;
    if (minPrice && (!price || price < minPrice)) return false;
    if (maxPrice && price > maxPrice) return false;
    if (normalizedFuel && pencmiNormalizeText(metadata.fuel) !== normalizedFuel) return false;
    if (normalizedGearbox && pencmiNormalizeText(metadata.gearbox) !== normalizedGearbox) return false;
    return true;
  });
}

async function loadVehicles() {
  const values = vehicleQueryValues();
  const apiParams = new URLSearchParams();
  if (values.city) apiParams.set("city", values.city);
  if (values.type) apiParams.set("vehicleMode", values.type);
  const payload = await pencmiApiRequest(`/voitures${apiParams.toString() ? `?${apiParams.toString()}` : ""}`);
  const data = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.items) ? payload.items : [];
  vehicleState.all = data;
  vehicleState.filtered = filterVehicles(data);
}

document.addEventListener("DOMContentLoaded", async () => {
  vehiclesHeader();
  vehiclesHero();
  vehicleQuickSuggestions();
  try {
    await loadVehicles();
  } catch {
    vehicleState.all = [];
    vehicleState.filtered = [];
  }
  vehiclesPage();
  vehiclesFooter();
});

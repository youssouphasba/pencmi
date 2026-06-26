const tripRoutes = {
  home: "/",
  trips: "/voyages",
  alerts: "/voyages/alertes",
  favorites: "/favoris/voyages",
  publish: "/publier?category=voyage",
  dashboard: "/dashboard/voyages",
  login: "/login",
};

let tripState = {
  all: [],
  filtered: [],
};

function tripRouteHref(path) {
  return window.PencmiConfig?.routeHref ? window.PencmiConfig.routeHref(path) : path;
}

function tripMetadata(listing) {
  return listing.metadata || {};
}

function tripAdvertiser(listing) {
  return pencmiBuildAdvertiser(listing.owner);
}

function tripQueryValues() {
  const params = pencmiQueryParams();
  return {
    query: params.get("query") || "",
    depart: params.get("depart") || params.get("departureCity") || "",
    arrivee: params.get("arrivee") || params.get("arrivalCity") || "",
    date: params.get("date") || "",
    passengers: params.get("passengers") || "1",
    vehicleType: params.get("vehicleType") || "",
    minPrice: params.get("minPrice") || "",
    maxPrice: params.get("maxPrice") || "",
    timeOfDay: params.get("timeOfDay") || "",
  };
}

function setTripQuery(nextValues) {
  const params = new URLSearchParams();
  Object.entries(nextValues).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      params.set(key, String(value).trim());
    }
  });
  window.location.href = `${tripRouteHref(tripRoutes.trips)}${params.toString() ? `?${params.toString()}` : ""}`;
}

function tripsHeader() {
  document.querySelector("#trips-header").innerHTML = `
    <a class="brand" href="${tripRouteHref(tripRoutes.home)}" aria-label="Accueil Péncmi"><span class="brand-mark">P</span><span><strong>Péncmi</strong><small>Voyages interurbains</small></span></a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="trips-menu" aria-label="Ouvrir le menu"><span></span><span></span><span></span></button>
    <div class="header-panel" id="trips-menu">
      <nav class="main-nav" aria-label="Navigation principale"><a href="${tripRouteHref("/immobilier")}">Immobilier</a><a href="${tripRouteHref("/hotels")}">Hôtels</a><a href="${tripRouteHref("/voitures")}">Voitures</a><a href="${tripRouteHref(tripRoutes.trips)}" aria-current="page">Voyages</a><a href="${tripRouteHref(tripRoutes.favorites)}">Favoris</a><a href="${tripRouteHref(tripRoutes.alerts)}">Alertes</a></nav>
      <div class="header-actions"><a class="btn btn-ghost" href="${tripRouteHref(tripRoutes.login)}">Se connecter</a><a class="btn btn-primary" href="${tripRouteHref(tripRoutes.publish)}">Publier un trajet</a></div>
    </div>
  `;

  const toggle = document.querySelector(".menu-toggle");
  const panel = document.querySelector(".header-panel");
  toggle?.addEventListener("click", () => {
    const isOpen = panel.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
}

function tripHero() {
  const values = tripQueryValues();
  document.querySelector("#trip-hero").innerHTML = `
    <div class="trip-hero-inner">
      <h1>Trouvez un trajet entre les villes du Sénégal</h1>
      <p>Recherchez un bus, un car, un minibus, un 7 places ou un trajet partagé selon votre destination.</p>
      <form class="trip-search-card" id="trip-search-form">
        <label class="trip-field"><span>Ville de départ</span><input name="depart" type="search" value="${values.depart}" placeholder="Dakar"></label>
        <label class="trip-field"><span>Ville d’arrivée</span><input name="arrivee" type="search" value="${values.arrivee}" placeholder="Touba"></label>
        <label class="trip-field"><span>Date du voyage</span><input name="date" type="date" value="${values.date}"></label>
        <label class="trip-field"><span>Passagers</span><input name="passengers" type="number" min="1" value="${values.passengers}"></label>
        <button class="btn btn-primary" type="submit">Rechercher</button>
      </form>
    </div>
  `;

  document.querySelector("#trip-search-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setTripQuery({
      depart: formData.get("depart"),
      arrivee: formData.get("arrivee"),
      date: formData.get("date"),
      passengers: formData.get("passengers"),
      vehicleType: tripQueryValues().vehicleType,
      minPrice: tripQueryValues().minPrice,
      maxPrice: tripQueryValues().maxPrice,
      timeOfDay: tripQueryValues().timeOfDay,
      query: tripQueryValues().query,
    });
  });
}

function tripQuickSuggestions() {
  const suggestions = [
    ["Dakar → Touba", "/voyages?depart=Dakar&arrivee=Touba"],
    ["Dakar → Thiès", "/voyages?depart=Dakar&arrivee=Thiès"],
    ["Dakar → Saint-Louis", "/voyages?depart=Dakar&arrivee=Saint-Louis"],
    ["Dakar → Kaolack", "/voyages?depart=Dakar&arrivee=Kaolack"],
    ["Dakar → Ziguinchor", "/voyages?depart=Dakar&arrivee=Ziguinchor"],
    ["Thiès → Mbour", "/voyages?depart=Thiès&arrivee=Mbour"],
  ];
  document.querySelector("#trip-quick-tabs").innerHTML = suggestions.map(([label, href]) => `<a href="${tripRouteHref(href)}">${label}</a>`).join("");
}

function tripFiltersMarkup() {
  const values = tripQueryValues();
  return `
    <aside class="trip-filters">
      <form id="trip-filter-form">
        <fieldset class="trip-filter-group"><legend>Recherche</legend><div class="trip-filter-grid"><input name="query" value="${values.query}" placeholder="Transporteur, ville ou point"><input name="depart" value="${values.depart}" placeholder="Départ"><input name="arrivee" value="${values.arrivee}" placeholder="Arrivée"></div></fieldset>
        <fieldset class="trip-filter-group"><legend>Type de trajet</legend><select name="vehicleType"><option value="">Tous</option><option value="bus"${values.vehicleType === "bus" ? " selected" : ""}>Bus</option><option value="car"${values.vehicleType === "car" ? " selected" : ""}>Car</option><option value="minibus"${values.vehicleType === "minibus" ? " selected" : ""}>Minibus</option><option value="sept_places"${values.vehicleType === "sept_places" ? " selected" : ""}>7 places</option><option value="covoiturage"${values.vehicleType === "covoiturage" ? " selected" : ""}>Covoiturage</option></select></fieldset>
        <fieldset class="trip-filter-group"><legend>Date et horaire</legend><div class="trip-filter-grid"><input name="date" type="date" value="${values.date}"><select name="timeOfDay"><option value="">Tous</option><option value="morning"${values.timeOfDay === "morning" ? " selected" : ""}>Matin</option><option value="afternoon"${values.timeOfDay === "afternoon" ? " selected" : ""}>Après-midi</option><option value="evening"${values.timeOfDay === "evening" ? " selected" : ""}>Soir</option><option value="night"${values.timeOfDay === "night" ? " selected" : ""}>Nuit</option></select></div></fieldset>
        <fieldset class="trip-filter-group"><legend>Prix</legend><div class="trip-filter-grid"><input name="minPrice" type="number" min="0" value="${values.minPrice}" placeholder="Minimum"><input name="maxPrice" type="number" min="0" value="${values.maxPrice}" placeholder="Maximum"></div></fieldset>
        <div class="trip-card-actions"><button class="btn btn-primary" type="submit">Appliquer</button><a class="btn btn-ghost" href="${tripRouteHref(tripRoutes.trips)}">Réinitialiser</a></div>
      </form>
    </aside>
  `;
}

function tripCard(listing) {
  const metadata = tripMetadata(listing);
  const advertiser = tripAdvertiser(listing);
  return `
    <article class="trip-card">
      <div class="trip-card-line">
        <div><span>${listing.departureTime || ""}</span><strong>${listing.departureCity}</strong><small>${listing.departurePoint || ""}</small></div>
        <div class="trip-line-dot"></div>
        <div><span>${metadata.estimatedArrivalTime || ""}</span><strong>${listing.arrivalCity}</strong><small>${listing.arrivalPoint || ""}</small></div>
      </div>
      <div class="trip-chip-row">
        ${listing.vehicleType ? `<span class="trip-chip">${listing.vehicleType}</span>` : ""}
        ${listing.availableSeats ? `<span class="trip-chip">${listing.availableSeats} places</span>` : ""}
        ${listing.pricePerSeat ? `<span class="trip-chip">${pencmiFormatPrice(listing.pricePerSeat, listing.currency || "FCFA")}</span>` : ""}
        ${advertiser.verified ? `<span class="trip-chip">Vérifié</span>` : ""}
      </div>
      <div class="trip-card-actions">
        <a class="btn btn-light" href="${tripRouteHref(`/voyages/${listing.id}`)}">Voir détails</a>
        <a class="btn btn-primary" href="${tripRouteHref(`/voyages/${listing.id}`)}#reservation">Demander une place</a>
      </div>
    </article>
  `;
}

function tripEmptyState() {
  return `<section class="trip-empty"><div><h2>Aucun trajet disponible pour le moment.</h2><p>Vous pouvez modifier votre recherche ou créer une alerte pour être informé plus tard.</p><div class="trip-empty-actions"><a class="btn btn-ghost" href="${tripRouteHref(tripRoutes.trips)}">Modifier ma recherche</a><a class="btn btn-primary" href="${tripRouteHref(tripRoutes.alerts)}">Créer une alerte</a></div></div></section>`;
}

function tripsPage() {
  const values = tripQueryValues();
  const label = [values.depart, values.arrivee, values.vehicleType].filter(Boolean).join(" · ");
  document.querySelector("#trip-results").innerHTML = `
    <div class="trip-results-layout">
      ${tripFiltersMarkup()}
      <section class="trip-list">
        <section class="trip-detail-card" style="margin-bottom:16px;"><h2>Résultats</h2><p>${tripState.filtered.length} trajet${tripState.filtered.length > 1 ? "s" : ""}${label ? ` pour ${label}` : ""}</p></section>
        ${tripState.filtered.length ? tripState.filtered.map(tripCard).join("") : tripEmptyState()}
      </section>
      <aside class="trip-map"><div class="trip-map-placeholder">Carte et points de départ prévus ici.</div></aside>
    </div>
  `;

  document.querySelector("#trip-filter-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setTripQuery({
      query: formData.get("query"),
      depart: formData.get("depart"),
      arrivee: formData.get("arrivee"),
      date: formData.get("date"),
      passengers: tripQueryValues().passengers,
      vehicleType: formData.get("vehicleType"),
      minPrice: formData.get("minPrice"),
      maxPrice: formData.get("maxPrice"),
      timeOfDay: formData.get("timeOfDay"),
    });
  });
}

function tripsFooter() {
  document.querySelector("#trips-footer").innerHTML = `
    <div class="footer-grid">
      <div class="footer-brand"><strong>Péncmi</strong><p>Trajets interurbains, bus, cars, minibus et covoiturage au Sénégal.</p></div>
      <div class="footer-column"><h3>Clients</h3><a href="${tripRouteHref(tripRoutes.trips)}">Rechercher</a><a href="${tripRouteHref(tripRoutes.favorites)}">Favoris</a><a href="${tripRouteHref(tripRoutes.alerts)}">Alertes</a></div>
      <div class="footer-column"><h3>Annonceurs</h3><a href="${tripRouteHref(tripRoutes.publish)}">Publier</a><a href="${tripRouteHref(tripRoutes.dashboard)}">Dashboard voyages</a></div>
      <div class="footer-column"><h3>Péncmi</h3><a href="${tripRouteHref(tripRoutes.home)}">Accueil</a><a href="${tripRouteHref("/voitures")}">Voitures</a></div>
    </div>
    <div class="footer-bottom">© 2026 Péncmi. Tous droits réservés.</div>
  `;
}

function tripHourCategory(timeValue) {
  if (!timeValue) return "";
  const hour = Number(String(timeValue).split(":")[0]);
  if (Number.isNaN(hour)) return "";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}

function filterTrips(listings) {
  const values = tripQueryValues();
  const normalizedQuery = pencmiNormalizeText(values.query);
  const normalizedDepart = pencmiNormalizeText(values.depart);
  const normalizedArrivee = pencmiNormalizeText(values.arrivee);
  const minPrice = Number(values.minPrice || 0);
  const maxPrice = Number(values.maxPrice || 0);

  return listings.filter((listing) => {
    const metadata = tripMetadata(listing);
    const haystack = pencmiNormalizeText([
      listing.title,
      listing.departureCity,
      listing.arrivalCity,
      listing.departurePoint,
      listing.arrivalPoint,
      metadata.transporterName,
      metadata.description,
    ].filter(Boolean).join(" "));
    const price = Number(listing.pricePerSeat || 0);

    if (normalizedQuery && !haystack.includes(normalizedQuery)) return false;
    if (normalizedDepart && pencmiNormalizeText(listing.departureCity) !== normalizedDepart) return false;
    if (normalizedArrivee && pencmiNormalizeText(listing.arrivalCity) !== normalizedArrivee) return false;
    if (values.vehicleType && pencmiNormalizeText(listing.vehicleType) !== pencmiNormalizeText(values.vehicleType)) return false;
    if (values.date && pencmiFormatDate(listing.departureDate) !== pencmiFormatDate(values.date)) return false;
    if (minPrice && (!price || price < minPrice)) return false;
    if (maxPrice && price > maxPrice) return false;
    if (values.timeOfDay && tripHourCategory(listing.departureTime) !== values.timeOfDay) return false;
    return true;
  });
}

async function loadTrips() {
  const values = tripQueryValues();
  const apiParams = new URLSearchParams();
  if (values.depart) apiParams.set("departureCity", values.depart);
  if (values.arrivee) apiParams.set("arrivalCity", values.arrivee);
  const payload = await pencmiApiRequest(`/voyages${apiParams.toString() ? `?${apiParams.toString()}` : ""}`);
  const data = Array.isArray(payload) ? payload : payload.data || [];
  tripState.all = data;
  tripState.filtered = filterTrips(data);
}

document.addEventListener("DOMContentLoaded", async () => {
  tripsHeader();
  tripHero();
  tripQuickSuggestions();
  try {
    await loadTrips();
  } catch {
    tripState.all = [];
    tripState.filtered = [];
  }
  tripsPage();
  tripsFooter();
});

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
  meta: null,
  error: '',
};

const tripEscape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tripDisplay = value => typeof value === 'string' ? tripEscape(value) : Array.isArray(value) ? value.map(tripDisplay) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, tripDisplay(item)])) : value;
let tripContent;

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
    page: params.get('page') || '1',
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
  const values = tripDisplay(tripQueryValues());
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
  const values = tripDisplay(tripQueryValues());
  return `
    <aside class="trip-filters">
      <form id="trip-filter-form">
        <fieldset class="trip-filter-group"><legend>Recherche</legend><div class="trip-filter-grid"><input name="query" value="${values.query}" placeholder="Titre, ville ou point"><input name="depart" value="${values.depart}" placeholder="Départ"><input name="arrivee" value="${values.arrivee}" placeholder="Arrivée"></div></fieldset>
        <fieldset class="trip-filter-group"><legend>Type de trajet</legend><select name="vehicleType"><option value="">Tous</option>${Object.entries(tripContent.tripTypes).map(([code, label]) => `<option value="${code}"${values.vehicleType === code ? ' selected' : ''}>${tripEscape(label)}</option>`).join('')}</select></fieldset>
        <fieldset class="trip-filter-group"><legend>Date et horaire</legend><div class="trip-filter-grid"><input name="date" type="date" value="${values.date}"><select name="timeOfDay"><option value="">Tous</option><option value="morning"${values.timeOfDay === "morning" ? " selected" : ""}>Matin</option><option value="afternoon"${values.timeOfDay === "afternoon" ? " selected" : ""}>Après-midi</option><option value="evening"${values.timeOfDay === "evening" ? " selected" : ""}>Soir</option><option value="night"${values.timeOfDay === "night" ? " selected" : ""}>Nuit</option></select></div></fieldset>
        <fieldset class="trip-filter-group"><legend>Prix</legend><div class="trip-filter-grid"><input name="minPrice" type="number" min="0" value="${values.minPrice}" placeholder="Minimum"><input name="maxPrice" type="number" min="0" value="${values.maxPrice}" placeholder="Maximum"></div></fieldset>
        <div class="trip-card-actions"><button class="btn btn-primary" type="submit">Appliquer</button><a class="btn btn-ghost" href="${tripRouteHref(tripRoutes.trips)}">Réinitialiser</a></div>
      </form>
    </aside>
  `;
}

function tripCard(listing) {
  listing = tripDisplay(listing);
  const metadata = tripMetadata(listing);
  const advertiser = tripAdvertiser(listing);
  return `
    <article class="trip-card">
      <div class="trip-card-line">
        <div><span>${listing.departureTime || ""}</span><strong>${listing.departureCity}</strong><small>${listing.departurePoint || ""}</small></div>
        <div class="trip-line-dot"></div>
        <div><span>${metadata.estimatedArrivalTime ? `${metadata.estimatedArrivalTime}${metadata.arrivalNextDay ? ' (lendemain)' : ''} · estimée` : ''}</span><strong>${listing.arrivalCity}</strong><small>${listing.arrivalPoint || ""}</small></div>
      </div>
      <div class="trip-chip-row">
        ${listing.vehicleType ? `<span class="trip-chip">${tripContent.tripTypes[listing.vehicleType] || listing.vehicleType}</span>` : ""}
        ${listing.availableSeats ? `<span class="trip-chip">${listing.availableSeats} places</span>` : ""}
        ${listing.pricePerSeat ? `<span class="trip-chip">${pencmiFormatPrice(listing.pricePerSeat, listing.currency || "FCFA")}</span>` : ""}
        ${advertiser.verified ? `<span class="trip-chip">Vérifié</span>` : ""}
      </div>
      <p>Places déclarées, à confirmer avec le transporteur.</p><div class="trip-card-actions">
        <a class="btn btn-light" href="${tripRouteHref(`/voyages/${listing.id}`)}">Voir détails</a>
        ${metadata.contactPreferences?.reservationRequestEnabled !== false ? `<a class="btn btn-primary" href="${tripRouteHref(`/voyages/${listing.id}`)}#reservation">Demander une place</a>` : ''}
      </div>
    </article>
  `;
}

function tripEmptyState() {
  return `<section class="trip-empty"><div><h2>Aucun trajet disponible pour le moment.</h2><p>Vous pouvez modifier votre recherche ou créer une alerte pour être informé plus tard.</p><div class="trip-empty-actions"><a class="btn btn-ghost" href="${tripRouteHref(tripRoutes.trips)}">Modifier ma recherche</a><a class="btn btn-primary" href="${tripRouteHref(tripRoutes.alerts)}">Créer une alerte</a></div></div></section>`;
}

function tripsPage() {
  const values = tripQueryValues();
  const label = tripEscape([values.depart, values.arrivee, values.vehicleType].filter(Boolean).join(" · "));
  document.querySelector("#trip-results").innerHTML = `
    <div class="trip-results-layout">
      ${tripFiltersMarkup()}
      <section class="trip-list">
        <section class="trip-detail-card" style="margin-bottom:16px;"><h2>Résultats</h2><p>${tripState.meta?.total ?? tripState.filtered.length} trajet(s)${label ? ` pour ${label}` : ""}</p></section>
        ${tripState.error ? `<p role="alert">${tripEscape(tripState.error)}</p><button class="btn btn-light" data-trip-retry>Réessayer</button>` : tripState.filtered.length ? tripState.filtered.map(tripCard).join("") : tripEmptyState()}
        <div class="trip-card-actions">${Number(values.page) > 1 ? '<button class="btn btn-light" data-trip-page="-1">Précédent</button>' : ''}${Number(values.page) < (tripState.meta?.totalPages || 1) ? '<button class="btn btn-light" data-trip-page="1">Suivant</button>' : ''}</div>
      </section>
    </div>
  `;

  document.querySelectorAll('[data-trip-page]').forEach(button => button.onclick = () => setTripQuery({ ...values, page: Number(values.page) + Number(button.dataset.tripPage) }));
  document.querySelector('[data-trip-retry]')?.addEventListener('click', () => location.reload());

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

async function loadTrips() {
  const values = tripQueryValues();
  const apiParams = new URLSearchParams();
  if (values.depart) apiParams.set("departureCity", values.depart);
  if (values.arrivee) apiParams.set("arrivalCity", values.arrivee);
  for (const key of ['query', 'date', 'passengers', 'vehicleType', 'minPrice', 'maxPrice', 'timeOfDay', 'page']) if (values[key]) apiParams.set(key, values[key]);
  const payload = await pencmiApiRequest(`/voyages?${apiParams}`, { includeMeta: true });
  const data = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.items) ? payload.items : [];
  tripState.all = data;
  tripState.filtered = data;
  tripState.meta = payload?.meta || null;
}

document.addEventListener("DOMContentLoaded", async () => {
  tripContent = await import('./trip-content.mjs');
  tripsHeader();
  tripHero();
  tripQuickSuggestions();
  try {
    await loadTrips();
  } catch (error) {
    tripState.error = error.message || 'Chargement impossible.';
    tripState.all = [];
    tripState.filtered = [];
  }
  tripsPage();
  tripsFooter();
});

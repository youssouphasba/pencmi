const hotelRoutes = {
  home: "/",
  hotels: "/hotels",
  alerts: "/hotels/alertes",
  favorites: "/favoris/hotels",
  publish: "/publier?category=hotel",
  dashboard: "/dashboard/hotels",
  login: "/login",
};

let hotelState = {
  all: [],
  filtered: [],
};

function hotelRouteHref(path) {
  return window.PencmiConfig?.routeHref ? window.PencmiConfig.routeHref(path) : path;
}

function hotelMetadata(listing) {
  return listing.metadata || {};
}

function hotelImage(listing) {
  return pencmiListingPhotos(hotelMetadata(listing))[0] || "";
}

function hotelAdvertiser(listing) {
  return pencmiBuildAdvertiser(listing.owner);
}

function hotelNightlyPrice(listing) {
  const metadata = hotelMetadata(listing);
  return metadata.nightlyPrice || metadata.priceFrom || null;
}

function hotelStars(listing) {
  return Number(hotelMetadata(listing).stars || 0);
}

function hotelAmenityList(listing) {
  return Array.isArray(hotelMetadata(listing).amenities) ? hotelMetadata(listing).amenities : [];
}

function hotelConditionList(listing) {
  return Array.isArray(hotelMetadata(listing).conditions) ? hotelMetadata(listing).conditions : [];
}

function hotelSearchValues() {
  const params = pencmiQueryParams();
  return {
    query: params.get("query") || "",
    city: params.get("city") || "",
    type: params.get("type") || params.get("propertyType") || "",
    minPrice: params.get("minPrice") || "",
    maxPrice: params.get("maxPrice") || "",
    stars: params.get("stars") || "",
    amenity: params.get("amenity") || "",
    checkIn: params.get("checkIn") || "",
    checkOut: params.get("checkOut") || "",
    adults: params.get("adults") || "1",
    children: params.get("children") || "0",
    rooms: params.get("rooms") || "1",
  };
}

function setHotelQuery(nextValues) {
  const params = new URLSearchParams();
  Object.entries(nextValues).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      params.set(key, String(value).trim());
    }
  });
  window.location.href = `${hotelRouteHref(hotelRoutes.hotels)}${params.toString() ? `?${params.toString()}` : ""}`;
}

function hotelHeader() {
  document.querySelector("#hotels-header").innerHTML = `
    <a class="brand" href="${hotelRouteHref(hotelRoutes.home)}" aria-label="Accueil Péncmi">
      <span class="brand-mark">P</span>
      <span><strong>Péncmi</strong><small>Hôtels & Auberges</small></span>
    </a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="hotels-menu" aria-label="Ouvrir le menu"><span></span><span></span><span></span></button>
    <div class="header-panel" id="hotels-menu">
      <nav class="main-nav" aria-label="Navigation principale">
        <a href="${hotelRouteHref("/immobilier")}">Immobilier</a>
        <a href="${hotelRouteHref(hotelRoutes.hotels)}" aria-current="page">Hôtels</a>
        <a href="${hotelRouteHref(hotelRoutes.favorites)}">Favoris</a>
        <a href="${hotelRouteHref(hotelRoutes.alerts)}">Alertes</a>
      </nav>
      <div class="header-actions">
        <a class="btn btn-ghost" href="${hotelRouteHref(hotelRoutes.login)}">Se connecter</a>
        <a class="btn btn-primary" href="${hotelRouteHref(hotelRoutes.publish)}">Publier un hébergement</a>
      </div>
    </div>
  `;

  const toggle = document.querySelector(".menu-toggle");
  const panel = document.querySelector(".header-panel");
  toggle?.addEventListener("click", () => {
    const isOpen = panel.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
}

function hotelHero() {
  const values = hotelSearchValues();
  document.querySelector("#hotel-hero").innerHTML = `
    <div class="hotel-hero-inner">
      <h1>Trouvez un hôtel, une auberge ou une résidence au Sénégal</h1>
      <p>Comparez les hébergements selon votre ville, votre budget, vos dates et vos besoins.</p>
      <form class="hotel-search-card" id="hotel-search-form">
        <label class="hotel-field"><span>Destination</span><input name="query" type="search" value="${values.query || values.city}" placeholder="Ville, quartier ou région"></label>
        <label class="hotel-field"><span>Arrivée</span><input name="checkIn" type="date" value="${values.checkIn}"></label>
        <label class="hotel-field"><span>Départ</span><input name="checkOut" type="date" value="${values.checkOut}"></label>
        <label class="hotel-field"><span>Adultes</span><input name="adults" type="number" min="1" value="${values.adults}"></label>
        <label class="hotel-field"><span>Enfants</span><input name="children" type="number" min="0" value="${values.children}"></label>
        <label class="hotel-field"><span>Chambres</span><input name="rooms" type="number" min="1" value="${values.rooms}"></label>
        <button class="btn btn-primary" type="submit">Rechercher</button>
      </form>
    </div>
  `;

  document.querySelector("#hotel-search-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setHotelQuery({
      query: formData.get("query"),
      checkIn: formData.get("checkIn"),
      checkOut: formData.get("checkOut"),
      adults: formData.get("adults"),
      children: formData.get("children"),
      rooms: formData.get("rooms"),
      city: "",
      type: hotelSearchValues().type,
      minPrice: hotelSearchValues().minPrice,
      maxPrice: hotelSearchValues().maxPrice,
      stars: hotelSearchValues().stars,
      amenity: hotelSearchValues().amenity,
    });
  });
}

function hotelQuickSuggestions() {
  const suggestions = [
    ["Hôtel à Dakar", "/hotels?city=Dakar&type=hotel"],
    ["Auberge à Saint-Louis", "/hotels?city=Saint-Louis&type=auberge"],
    ["Résidence à Saly", "/hotels?city=Saly&type=residence"],
    ["Appartement meublé à Mbour", "/hotels?city=Mbour&type=appartement_meuble"],
    ["Séjour à Cap Skirring", "/hotels?city=Cap%20Skirring"],
  ];
  document.querySelector("#hotel-quick-tabs").innerHTML = suggestions
    .map(([label, href]) => `<a href="${hotelRouteHref(href)}">${label}</a>`)
    .join("");
}

function hotelFiltersMarkup() {
  const values = hotelSearchValues();
  return `
    <aside class="hotel-filters" id="hotel-filters">
      <form id="hotel-filter-form">
        <fieldset class="hotel-filter-group">
          <legend>Recherche</legend>
          <div class="hotel-filter-grid">
            <input name="query" value="${values.query}" placeholder="Nom, ville ou quartier">
            <input name="city" value="${values.city}" placeholder="Ville">
          </div>
        </fieldset>
        <fieldset class="hotel-filter-group">
          <legend>Type d’hébergement</legend>
          <select name="type">
            <option value="">Tous les types</option>
            <option value="hotel"${values.type === "hotel" ? " selected" : ""}>Hôtel</option>
            <option value="auberge"${values.type === "auberge" ? " selected" : ""}>Auberge</option>
            <option value="residence"${values.type === "residence" ? " selected" : ""}>Résidence</option>
            <option value="appartement_meuble"${values.type === "appartement_meuble" ? " selected" : ""}>Appartement meublé</option>
          </select>
        </fieldset>
        <fieldset class="hotel-filter-group">
          <legend>Budget par nuit</legend>
          <div class="hotel-filter-grid">
            <input name="minPrice" type="number" min="0" value="${values.minPrice}" placeholder="Minimum">
            <input name="maxPrice" type="number" min="0" value="${values.maxPrice}" placeholder="Maximum">
          </div>
        </fieldset>
        <fieldset class="hotel-filter-group">
          <legend>Classement</legend>
          <select name="stars">
            <option value="">Toutes les catégories</option>
            <option value="1"${values.stars === "1" ? " selected" : ""}>1 étoile et plus</option>
            <option value="2"${values.stars === "2" ? " selected" : ""}>2 étoiles et plus</option>
            <option value="3"${values.stars === "3" ? " selected" : ""}>3 étoiles et plus</option>
            <option value="4"${values.stars === "4" ? " selected" : ""}>4 étoiles et plus</option>
            <option value="5"${values.stars === "5" ? " selected" : ""}>5 étoiles</option>
          </select>
        </fieldset>
        <fieldset class="hotel-filter-group">
          <legend>Commodité clé</legend>
          <select name="amenity">
            <option value="">Toutes</option>
            <option value="Wi-Fi"${values.amenity === "Wi-Fi" ? " selected" : ""}>Wi‑Fi</option>
            <option value="Piscine"${values.amenity === "Piscine" ? " selected" : ""}>Piscine</option>
            <option value="Restaurant"${values.amenity === "Restaurant" ? " selected" : ""}>Restaurant</option>
            <option value="Climatisation"${values.amenity === "Climatisation" ? " selected" : ""}>Climatisation</option>
            <option value="Parking"${values.amenity === "Parking" ? " selected" : ""}>Parking</option>
          </select>
        </fieldset>
        <div class="hotel-card-actions">
          <button class="btn btn-primary" type="submit">Appliquer</button>
          <a class="btn btn-ghost" href="${hotelRouteHref(hotelRoutes.hotels)}">Réinitialiser</a>
        </div>
      </form>
    </aside>
  `;
}

function hotelCard(listing) {
  const metadata = hotelMetadata(listing);
  const image = hotelImage(listing);
  const advertiser = hotelAdvertiser(listing);
  const amenities = hotelAmenityList(listing).slice(0, 3);
  const rooms = Array.isArray(listing.rooms) ? listing.rooms.length : 0;

  return `
    <article class="hotel-card">
      <div class="hotel-card-photo">
        ${image ? `<img src="${image}" alt="${listing.name}" style="width:100%;height:100%;object-fit:cover;">` : "Aucune image"}
      </div>
      <div class="hotel-card-body">
        <h3>${listing.name}</h3>
        <p>${[listing.propertyType, listing.city, metadata.district].filter(Boolean).join(" · ")}</p>
        <div class="hotel-chip-row">
          ${metadata.stars ? `<span class="hotel-chip">${metadata.stars} étoiles</span>` : ""}
          ${rooms ? `<span class="hotel-chip">${rooms} chambre${rooms > 1 ? "s" : ""}</span>` : ""}
          ${advertiser.verified ? `<span class="hotel-chip">Vérifié</span>` : ""}
        </div>
        ${amenities.length ? `<div class="hotel-chip-row">${amenities.map((item) => `<span class="hotel-chip">${item}</span>`).join("")}</div>` : ""}
        <div class="hotel-card-actions">
          <strong>${pencmiFormatPrice(hotelNightlyPrice(listing), listing.currency || "FCFA")}</strong>
          <a class="btn btn-light" href="${hotelRouteHref(`/hotels/${listing.id}`)}">Voir détails</a>
          <a class="btn btn-primary" href="${hotelRouteHref(`/hotels/${listing.id}`)}#reservation">Réserver</a>
        </div>
      </div>
    </article>
  `;
}

function hotelEmptyState() {
  return `
    <section class="hotel-empty">
      <div>
        <h2>Aucun hébergement disponible pour le moment.</h2>
        <p>Vous pouvez modifier votre recherche ou créer une alerte pour être informé plus tard.</p>
        <div class="hotel-empty-actions">
          <a class="btn btn-ghost" href="${hotelRouteHref(hotelRoutes.hotels)}">Modifier ma recherche</a>
          <a class="btn btn-primary" href="${hotelRouteHref(hotelRoutes.alerts)}">Créer une alerte</a>
        </div>
      </div>
    </section>
  `;
}

function hotelResultsSummary() {
  const values = hotelSearchValues();
  const parts = [values.query || values.city, values.type, values.stars ? `${values.stars}+ étoiles` : ""].filter(Boolean);
  return `
    <section class="hotel-detail-card" style="margin-bottom:16px;">
      <h2>Résultats</h2>
      <p>${hotelState.filtered.length} hébergement${hotelState.filtered.length > 1 ? "s" : ""} ${parts.length ? `pour ${parts.join(" · ")}` : "disponible(s)"}</p>
    </section>
  `;
}

function hotelsPage() {
  document.querySelector("#hotel-results").innerHTML = `
    <div class="hotel-results-layout">
      ${hotelFiltersMarkup()}
      <section class="hotel-list">
        ${hotelResultsSummary()}
        ${hotelState.filtered.length ? hotelState.filtered.map(hotelCard).join("") : hotelEmptyState()}
      </section>
      <aside class="hotel-map">
        <div class="hotel-map-placeholder">Carte et zones de séjour prévues ici.</div>
      </aside>
    </div>
  `;

  document.querySelector("#hotel-filter-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setHotelQuery({
      query: formData.get("query"),
      city: formData.get("city"),
      type: formData.get("type"),
      minPrice: formData.get("minPrice"),
      maxPrice: formData.get("maxPrice"),
      stars: formData.get("stars"),
      amenity: formData.get("amenity"),
      checkIn: hotelSearchValues().checkIn,
      checkOut: hotelSearchValues().checkOut,
      adults: hotelSearchValues().adults,
      children: hotelSearchValues().children,
      rooms: hotelSearchValues().rooms,
    });
  });
}

function hotelsFooter() {
  document.querySelector("#hotels-footer").innerHTML = `
    <div class="footer-grid">
      <div class="footer-brand"><strong>Péncmi</strong><p>Hôtels, auberges, résidences et appartements meublés au Sénégal.</p></div>
      <div class="footer-column"><h3>Clients</h3><a href="${hotelRouteHref(hotelRoutes.hotels)}">Rechercher</a><a href="${hotelRouteHref(hotelRoutes.favorites)}">Favoris</a><a href="${hotelRouteHref(hotelRoutes.alerts)}">Alertes</a></div>
      <div class="footer-column"><h3>Annonceurs</h3><a href="${hotelRouteHref(hotelRoutes.publish)}">Publier</a><a href="${hotelRouteHref(hotelRoutes.dashboard)}">Dashboard hôtels</a></div>
      <div class="footer-column"><h3>Péncmi</h3><a href="${hotelRouteHref(hotelRoutes.home)}">Accueil</a><a href="${hotelRouteHref("/immobilier")}">Immobilier</a></div>
    </div>
    <div class="footer-bottom">© 2026 Péncmi. Tous droits réservés.</div>
  `;
}

function filterHotels(listings) {
  const values = hotelSearchValues();
  const normalizedQuery = pencmiNormalizeText(values.query);
  const normalizedCity = pencmiNormalizeText(values.city);
  const minPrice = Number(values.minPrice || 0);
  const maxPrice = Number(values.maxPrice || 0);
  const stars = Number(values.stars || 0);
  const normalizedAmenity = pencmiNormalizeText(values.amenity);

  return listings.filter((listing) => {
    const metadata = hotelMetadata(listing);
    const haystack = pencmiNormalizeText([
      listing.name,
      listing.propertyType,
      listing.city,
      listing.region,
      listing.address,
      listing.description,
      metadata.district,
    ].filter(Boolean).join(" "));
    const price = Number(hotelNightlyPrice(listing) || 0);
    const amenities = hotelAmenityList(listing).map(pencmiNormalizeText);

    if (normalizedQuery && !haystack.includes(normalizedQuery)) {
      return false;
    }
    if (normalizedCity && pencmiNormalizeText(listing.city) !== normalizedCity) {
      return false;
    }
    if (values.type && pencmiNormalizeText(listing.propertyType) !== pencmiNormalizeText(values.type)) {
      return false;
    }
    if (minPrice && (!price || price < minPrice)) {
      return false;
    }
    if (maxPrice && price > maxPrice) {
      return false;
    }
    if (stars && hotelStars(listing) < stars) {
      return false;
    }
    if (normalizedAmenity && !amenities.includes(normalizedAmenity)) {
      return false;
    }

    return true;
  });
}

async function loadHotels() {
  const query = hotelSearchValues();
  const apiParams = new URLSearchParams();
  if (query.city) {
    apiParams.set("city", query.city);
  }
  if (query.type) {
    apiParams.set("propertyType", query.type);
  }

  const payload = await pencmiApiRequest(`/hotels${apiParams.toString() ? `?${apiParams.toString()}` : ""}`);
  const data = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.items) ? payload.items : [];
  hotelState.all = data;
  hotelState.filtered = filterHotels(data);
}

document.addEventListener("DOMContentLoaded", async () => {
  hotelHeader();
  hotelHero();
  hotelQuickSuggestions();
  try {
    await loadHotels();
  } catch {
    hotelState.all = [];
    hotelState.filtered = [];
  }
  hotelsPage();
  hotelsFooter();
});

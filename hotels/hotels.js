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
  meta: null,
  error: "",
};
let hotelTypeLabels = {};

function hotelRouteHref(path) {
  return window.PencmiConfig?.routeHref ? window.PencmiConfig.routeHref(path) : path;
}

const hotelEscape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
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
  return metadata.nightlyPrice ?? metadata.priceFrom ?? null;
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

// Stay searched by the visitor. Dakar time is UTC, so the UTC date is "today".
function hotelStaySearch() {
  const values = hotelSearchValues();
  const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value);
  const count = (value, min, max) => Math.min(max, Math.max(min, Math.trunc(Number(value)) || min));
  if (!values.checkIn && !values.checkOut) return { stay: null, error: "" };
  if (!isDate(values.checkIn) || !isDate(values.checkOut)) {
    return { stay: null, error: "Indiquez la date d’arrivée et la date de départ pour vérifier les disponibilités." };
  }
  if (values.checkOut <= values.checkIn) {
    return { stay: null, error: "La date de départ doit suivre la date d’arrivée." };
  }
  if (values.checkIn < new Date().toISOString().slice(0, 10)) {
    return { stay: null, error: "La date d’arrivée ne peut pas être passée." };
  }
  return {
    stay: {
      checkIn: values.checkIn,
      checkOut: values.checkOut,
      guests: count(Number(values.adults) + Number(values.children), 1, 100),
      rooms: count(values.rooms, 1, 10),
    },
    error: "",
  };
}

function hotelDateLabel(value) {
  const [year, month, day] = String(value).split("-");
  return `${day}/${month}/${year}`;
}

function hotelStayLine(listing) {
  const stay = listing.stay;
  if (!stay) return "Disponibilité à confirmer";
  const nights = `${stay.nights} nuit${stay.nights > 1 ? "s" : ""}`;
  const units = stay.units > 1 ? ` · ${stay.units} chambres` : "";
  const total = stay.estimatedTotal !== null && stay.estimatedTotal !== undefined
    ? ` · environ ${pencmiFormatPrice(stay.estimatedTotal, "FCFA")} le séjour`
    : "";
  return stay.status === "on_request"
    ? `Disponible pour vos dates · ${nights}${units}${total}`
    : `Disponibilité à confirmer pour vos dates · ${nights}${units}${total}`;
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
        <label class="hotel-field"><span>Destination</span><input name="query" type="search" value="${hotelEscape(values.query || values.city)}" placeholder="Ville, quartier ou région"></label>
        <label class="hotel-field"><span>Arrivée</span><input name="checkIn" type="date" min="${new Date().toISOString().slice(0, 10)}" value="${hotelEscape(values.checkIn)}"></label>
        <label class="hotel-field"><span>Départ</span><input name="checkOut" type="date" min="${new Date().toISOString().slice(0, 10)}" value="${hotelEscape(values.checkOut)}"></label>
        <label class="hotel-field"><span>Adultes</span><input name="adults" type="number" min="1" value="${hotelEscape(values.adults)}"></label>
        <label class="hotel-field"><span>Enfants</span><input name="children" type="number" min="0" value="${hotelEscape(values.children)}"></label>
        <label class="hotel-field"><span>Chambres</span><input name="rooms" type="number" min="1" value="${hotelEscape(values.rooms)}"></label>
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
            <input name="query" value="${hotelEscape(values.query)}" placeholder="Nom, ville ou quartier">
            <input name="city" value="${hotelEscape(values.city)}" placeholder="Ville">
          </div>
        </fieldset>
        <fieldset class="hotel-filter-group">
          <legend>Type d’hébergement</legend>
          <select name="type">
            <option value="">Tous les types</option>
            ${Object.entries(hotelTypeLabels).map(([type, label]) => `<option value="${hotelEscape(type)}"${values.type === type ? ' selected' : ''}>${hotelEscape(label)}</option>`).join('')}
          </select>
        </fieldset>
        <fieldset class="hotel-filter-group">
          <legend>Budget par nuit</legend>
          <div class="hotel-filter-grid">
            <input name="minPrice" type="number" min="0" value="${hotelEscape(values.minPrice)}" placeholder="Minimum">
            <input name="maxPrice" type="number" min="0" value="${hotelEscape(values.maxPrice)}" placeholder="Maximum">
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
        ${image ? `<img src="${hotelEscape(image)}" alt="${hotelEscape(listing.name)}" style="width:100%;height:100%;object-fit:cover;">` : "Aucune photo disponible"}
      </div>
      <div class="hotel-card-body">
        <h3>${hotelEscape(listing.name)}</h3>
        <p>${hotelEscape([hotelTypeLabels[listing.propertyType] || listing.propertyType, listing.city, metadata.district].filter(Boolean).join(" · "))}</p>
        <div class="hotel-chip-row">
          ${metadata.stars ? `<span class="hotel-chip">${hotelEscape(metadata.stars)} étoiles</span>` : ""}
          ${rooms ? `<span class="hotel-chip">${rooms} chambre${rooms > 1 ? "s" : ""}</span>` : ""}
          ${advertiser.verified ? `<span class="hotel-chip">Vérifié</span>` : ""}
        </div>
        ${amenities.length ? `<div class="hotel-chip-row">${amenities.map((item) => `<span class="hotel-chip">${hotelEscape(item)}</span>`).join("")}</div>` : ""}
        <p>${hotelEscape(hotelStayLine(listing))}</p>
        <div class="hotel-card-actions">
          <strong>${pencmiFormatPrice(hotelNightlyPrice(listing), listing.currency || "FCFA")}</strong>
          <a class="btn btn-light" href="${hotelRouteHref(`/hotels/${listing.id}`)}">Voir détails</a>
          <span data-favorite-module="hotels" data-favorite-id="${hotelEscape(listing.id)}"></span>
          <a class="btn btn-primary" href="${hotelRouteHref(`/hotels/${listing.id}`)}#reservation">Demander une réservation</a>
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


// Map of the results: the shared map code is only fetched when the visitor opens it.
const hotelScriptSrc = document.currentScript?.src || "";
let hotelMapOpen = (() => { try { return sessionStorage.getItem("pencmi.map") === "open"; } catch { return false; } })();

function hotelMapToggle(onChange) {
  const button = document.querySelector("[data-toggle-map]");
  if (!button) return;
  button.addEventListener("click", () => {
    hotelMapOpen = !hotelMapOpen;
    try { sessionStorage.setItem("pencmi.map", hotelMapOpen ? "open" : "closed"); } catch { /* storage unavailable */ }
    onChange();
  });
}

function hotelMapMarkup(cardClass) {
  const button = `<p style="margin:10px 0 0;"><button class="btn btn-ghost" type="button" data-toggle-map aria-expanded="${hotelMapOpen}">${hotelMapOpen ? "Masquer la carte" : "Voir la carte"}</button></p>`;
  const panel = hotelMapOpen ? `<section class="${cardClass}" data-listing-map aria-label="Carte des résultats" style="margin-bottom:16px;padding:10px;"><p role="status">Chargement de la carte...</p></section>` : "";
  return { button, panel };
}

async function hotelRenderMap(items, options) {
  const panel = document.querySelector("[data-listing-map]");
  if (!panel) return;
  try {
    if (!window.PencmiMap) {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = new URL("../config/senegal-map.js", hotelScriptSrc || window.location.href).href;
        script.onload = resolve;
        script.onerror = reject;
        document.head.append(script);
      });
    }
    if (panel.isConnected) await window.PencmiMap.mount(panel, items, options);
  } catch {
    const note = document.createElement("p");
    note.setAttribute("role", "alert");
    note.textContent = "La carte ne peut pas être affichée pour le moment. Les résultats restent disponibles dans la liste.";
    panel.replaceChildren(note);
  }
}

function hotelMapItems() {
  return hotelState.filtered.map((listing) => ({
    city: listing.city,
    title: listing.name,
    href: hotelRouteHref(`/hotels/${listing.id}`),
    detail: pencmiFormatPrice(hotelNightlyPrice(listing), listing.currency || "FCFA"),
  }));
}

function hotelTotal() {
  return hotelState.meta?.total ?? hotelState.filtered.length;
}

function hotelPagination() {
  const meta = hotelState.meta;
  if (!meta || !(meta.totalPages > 1)) return "";
  return `<nav class="hotel-card-actions" aria-label="Pagination">${meta.page > 1 ? `<button class="btn btn-ghost" type="button" data-hotel-page="${meta.page - 1}">Précédent</button>` : ""}<span>Page ${meta.page} sur ${meta.totalPages}</span>${meta.page < meta.totalPages ? `<button class="btn btn-ghost" type="button" data-hotel-page="${meta.page + 1}">Suivant</button>` : ""}</nav>`;
}

function hotelResultsSummary() {
  const values = hotelSearchValues();
  const { stay, error } = hotelStaySearch();
  const parts = [values.query || values.city, values.type, values.stars ? `${values.stars}+ étoiles` : ""].filter(Boolean);
  return `
    <section class="hotel-detail-card" style="margin-bottom:16px;">
      <h2>Résultats</h2>
      <div data-save-search="hotels"></div>
      <p>${hotelTotal()} hébergement${hotelTotal() > 1 ? "s" : ""} ${parts.length ? `pour ${parts.join(" · ")}` : "disponible(s)"}</p>
      ${stay ? `<p>Séjour du ${hotelEscape(hotelDateLabel(stay.checkIn))} au ${hotelEscape(hotelDateLabel(stay.checkOut))} · ${stay.guests} voyageur${stay.guests > 1 ? "s" : ""} · ${stay.rooms} chambre${stay.rooms > 1 ? "s" : ""}. Les établissements complets ou fermés sur ces dates ne sont pas affichés.</p>` : ""}
      ${error || hotelState.error ? `<p role="alert">${hotelEscape(error || hotelState.error)}</p>` : ""}
      ${hotelMapMarkup("hotel-detail-card").button}
    </section>
    ${hotelMapMarkup("hotel-detail-card").panel}
  `;
}

function hotelsPage() {
  document.querySelector("#hotel-results").innerHTML = `
    <div class="hotel-results-layout">
      ${hotelFiltersMarkup()}
      <section class="hotel-list">
        ${hotelResultsSummary()}
        ${hotelState.filtered.length ? hotelState.filtered.map(hotelCard).join("") : hotelEmptyState()}
        ${hotelPagination()}
      </section>
    </div>
  `;

  hotelMapToggle(hotelsPage);
  document.querySelectorAll("[data-hotel-page]").forEach((button) => {
    button.addEventListener("click", () => {
      const url = new URL(window.location.href);
      url.searchParams.set("page", button.dataset.hotelPage);
      window.location.href = url;
    });
  });
  void hotelRenderMap(hotelMapItems(), { focusCity: hotelSearchValues().city, note: "Les hébergements de cette page sont regroupés par ville." });

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

async function loadHotels() {
  const query = hotelSearchValues();
  const apiParams = new URLSearchParams();
  if (query.city) {
    apiParams.set("city", query.city);
  }
  if (query.type) {
    apiParams.set("propertyType", query.type);
  }
  // Every filter is applied by the API on the whole search, not on the page shown.
  for (const key of ["query", "minPrice", "maxPrice", "stars", "amenity"]) {
    if (query[key]) apiParams.set(key, query[key]);
  }
  const page = Math.trunc(Number(pencmiQueryValue("page", "1")));
  if (page > 1) apiParams.set("page", String(page));
  const { stay } = hotelStaySearch();
  if (stay) {
    Object.entries(stay).forEach(([key, value]) => apiParams.set(key, String(value)));
  }

  const payload = await pencmiApiRequest(`/hotels${apiParams.toString() ? `?${apiParams.toString()}` : ""}`, { includeMeta: true });
  const data = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : Array.isArray(payload?.items) ? payload.items : [];
  hotelState.all = data;
  hotelState.filtered = data;
  hotelState.meta = payload?.meta || null;
}

document.addEventListener("DOMContentLoaded", async () => {
  const { hotelCatalog } = await import('../publier/hotel-publication.mjs');
  hotelTypeLabels = hotelCatalog.types;
  hotelHeader();
  hotelHero();
  hotelQuickSuggestions();
  try {
    await loadHotels();
  } catch (error) {
    hotelState.all = [];
    hotelState.filtered = [];
    hotelState.error = error instanceof Error && error.message ? error.message : "Chargement impossible.";
  }
  hotelsPage();
  hotelsFooter();
});
void import("../saved/enhance.mjs").catch(() => {});

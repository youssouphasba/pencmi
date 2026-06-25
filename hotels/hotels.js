const routes = {
  home: "/",
  hotels: "/hotels",
  alerts: "/hotels/alertes",
  favorites: "/favoris/hotels",
  publish: "/publier?category=hotel",
  dashboard: "/dashboard/hotels",
  login: "/login"
};

const hotelListings = [];

const hotelTypes = [
  "Hôtel",
  "Auberge",
  "Résidence",
  "Appartement meublé",
  "Maison d’hôtes",
  "Villa",
  "Campement",
  "Chambre chez l’habitant"
];

const hotelAmenities = [
  "Wi-Fi",
  "Parking",
  "Piscine",
  "Restaurant",
  "Petit-déjeuner",
  "Réception 24h/24",
  "Sécurité",
  "Groupe électrogène",
  "Climatisation",
  "Jardin",
  "Terrasse",
  "Vue mer",
  "Salle de conférence",
  "Navette aéroport",
  "Service de chambre",
  "Blanchisserie",
  "Cuisine commune",
  "Bar",
  "Salle de sport"
];

const hotelConditions = [
  "Annulation gratuite",
  "Paiement sur place",
  "Réservation sans paiement immédiat",
  "Petit-déjeuner inclus",
  "Animaux acceptés",
  "Non-fumeur",
  "Couples acceptés",
  "Enfants acceptés"
];

function routeHref(path) {
  if (window.location.protocol !== "file:") {
    return path;
  }

  const depth = Number(document.body?.dataset?.routeDepth || "1");
  const prefix = "../".repeat(depth);
  if (path === routes.home) return `${prefix}index.html`;
  if (path === routes.hotels) return `${prefix}hotels/`;
  if (path.startsWith("/hotels?")) return `${prefix}hotels/${path.slice("/hotels".length)}`;
  if (path.startsWith("/hotels/")) return `${prefix}hotels/${path.slice("/hotels/".length)}/`;
  if (path === routes.alerts) return `${prefix}hotels/alertes/`;
  if (path === routes.favorites) return `${prefix}favoris/hotels/`;
  if (path === routes.publish) return `${prefix}publier/?category=hotel`;
  if (path === routes.dashboard) return `${prefix}dashboard/hotels/`;
  return path;
}

function HotelsHeader() {
  document.querySelector("#hotels-header").innerHTML = `
    <a class="brand" href="${routeHref(routes.home)}" aria-label="Accueil Péncmi">
      <span class="brand-mark">P</span>
      <span><strong>Péncmi</strong><small>Hôtels & Auberges</small></span>
    </a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="main-menu" aria-label="Ouvrir le menu"><span></span><span></span><span></span></button>
    <div class="header-panel" id="main-menu">
      <nav class="main-nav" aria-label="Navigation principale">
        <a href="../immobilier/">Immobilier</a>
        <a href="${routeHref(routes.hotels)}" aria-current="page">Hôtels</a>
        <a href="${routeHref(routes.favorites)}">Favoris</a>
        <a href="${routeHref(routes.alerts)}">Alertes</a>
      </nav>
      <div class="header-actions">
        <a class="btn btn-ghost" href="${routes.login}">Se connecter</a>
        <a class="btn btn-primary" href="${routeHref(routes.publish)}">Publier un hébergement</a>
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

function HotelSearchHero() {
  document.querySelector("#hotel-hero").innerHTML = `
    <div class="hotel-hero-inner">
      <h1>Trouvez un hôtel, une auberge ou une résidence au Sénégal</h1>
      <p>Comparez les hébergements selon votre ville, votre budget, vos dates et vos besoins.</p>
      <form class="hotel-search-card">
        <label class="hotel-field"><span>Destination</span><input name="destination" type="search" placeholder="Ville, quartier ou région"></label>
        <label class="hotel-field"><span>Arrivée</span><input name="checkIn" type="date"></label>
        <label class="hotel-field"><span>Départ</span><input name="checkOut" type="date"></label>
        <label class="hotel-field"><span>Adultes</span><input name="adults" type="number" min="1" value="1"></label>
        <label class="hotel-field"><span>Enfants</span><input name="children" type="number" min="0" value="0"></label>
        <label class="hotel-field"><span>Chambres</span><input name="rooms" type="number" min="1" value="1"></label>
        <button class="btn btn-primary" type="submit">Rechercher</button>
      </form>
    </div>
  `;
}

function HotelQuickSuggestions() {
  const suggestions = [
    ["Hôtel à Dakar", "/hotels?city=dakar&type=hotel"],
    ["Auberge à Saint-Louis", "/hotels?city=saint-louis&type=auberge"],
    ["Résidence à Saly", "/hotels?city=saly&type=residence"],
    ["Appartement meublé à Mbour", "/hotels?city=mbour&type=appartement_meuble"],
    ["Séjour à Cap Skirring", "/hotels?city=cap-skirring"]
  ];
  document.querySelector("#hotel-quick-tabs").innerHTML = suggestions.map(([label, href]) => `<a href="${routeHref(href)}">${label}</a>`).join("");
}

function checkOptions(options) {
  return `<div class="hotel-check-list">${options.map((option) => `<label><input type="checkbox"> ${option}</label>`).join("")}</div>`;
}

function HotelFilters() {
  const regions = (window.SENEGAL_LOCATIONS || []).map((item) => item.region);
  return `
    <aside class="hotel-filters" id="hotel-filters">
      <fieldset class="hotel-filter-group"><legend>Localisation</legend><div class="hotel-filter-grid"><select><option>Tout le Sénégal</option>${regions.map((region) => `<option>${region}</option>`).join("")}</select><input placeholder="Ville"><input placeholder="Quartier"><select><option>Rayon</option><option>5 km</option><option>10 km</option><option>15 km</option><option>20 km</option><option>30 km</option><option>50 km</option></select><label><input type="checkbox"> Autour de moi</label></div></fieldset>
      <fieldset class="hotel-filter-group"><legend>Type d’hébergement</legend>${checkOptions(hotelTypes)}</fieldset>
      <fieldset class="hotel-filter-group"><legend>Prix</legend><div class="hotel-filter-grid"><input type="number" placeholder="Prix minimum"><input type="number" placeholder="Prix maximum"><select><option>Prix par nuit</option><option>Prix par semaine</option><option>Prix par mois</option></select></div></fieldset>
      <fieldset class="hotel-filter-group"><legend>Classement</legend>${checkOptions(["1 étoile", "2 étoiles", "3 étoiles", "4 étoiles", "5 étoiles", "Non classé"])}</fieldset>
      <fieldset class="hotel-filter-group"><legend>Capacité</legend><div class="hotel-filter-grid"><input type="number" placeholder="Nombre de chambres"><input type="number" placeholder="Nombre de lits"><input type="number" placeholder="Nombre de personnes"><label><input type="checkbox"> Chambres familiales</label></div></fieldset>
      <fieldset class="hotel-filter-group"><legend>Commodités</legend>${checkOptions(hotelAmenities)}</fieldset>
      <fieldset class="hotel-filter-group"><legend>Conditions</legend>${checkOptions(hotelConditions)}</fieldset>
      <fieldset class="hotel-filter-group"><legend>Tri</legend><select><option>Plus récents</option><option>Prix croissant</option><option>Prix décroissant</option><option>Mieux notés</option><option>Plus proches</option><option>Plus populaires</option></select></fieldset>
    </aside>
  `;
}

function HotelFavoriteButton() {
  return `<button class="favorite-button" type="button" aria-label="Ajouter aux favoris">+</button>`;
}

function HotelPublicSyncBadge(syncState = {}) {
  if (!syncState || !syncState.isSynced) return "";
  const stale = ["stale", "error", "unknown"].includes(syncState.reliability);
  const label = stale ? "Disponibilité à confirmer" : "Disponibilité synchronisée";
  return `<span class="hotel-public-sync-badge${stale ? " warning" : ""}">${label}</span>`;
}

function HotelAvailabilityReliabilityLabel(syncState = {}) {
  if (!syncState || !syncState.isSynced) return "L’établissement confirmera la disponibilité";
  return ["stale", "error", "unknown"].includes(syncState.reliability) ? "Dernière mise à jour ancienne" : "Données mises à jour récemment";
}

function HotelListingCard(hotel) {
  return `
    <article class="hotel-card">
      <div class="hotel-card-photo">Photo principale</div>
      <div class="hotel-card-body">
        <h3>${hotel.name}</h3>
        <p>${hotel.type} · ${hotel.city || ""}${hotel.district ? `, ${hotel.district}` : ""}</p>
        <div class="hotel-chip-row"><span class="hotel-chip">${hotel.availabilityStatus || "Disponibilité à confirmer avec l’établissement"}</span>${HotelPublicSyncBadge(hotel.syncState)}</div>
        <p class="dashboard-muted">${HotelAvailabilityReliabilityLabel(hotel.syncState)}</p>
        <div class="hotel-card-actions">
          ${HotelFavoriteButton()}
          <a class="btn btn-light" href="./detail/">Voir détails</a>
          <button class="btn btn-primary" type="button">Demander une réservation</button>
        </div>
      </div>
    </article>
  `;
}

function EmptyState() {
  return `
    <section class="hotel-empty">
      <div>
        <h2>Aucun hébergement disponible pour le moment.</h2>
        <p>Vous pouvez modifier votre recherche ou créer une alerte pour être informé plus tard.</p>
        <div class="hotel-empty-actions">
          <button class="btn btn-ghost" type="button">Modifier ma recherche</button>
          <a class="btn btn-primary" href="${routeHref(routes.alerts)}">Créer une alerte</a>
        </div>
      </div>
    </section>
  `;
}

function HotelsPage() {
  document.querySelector("#hotel-results").innerHTML = `
    <div class="hotel-results-layout">
      ${HotelFilters()}
      <section class="hotel-list">${hotelListings.length ? hotelListings.map(HotelListingCard).join("") : EmptyState()}</section>
      <aside class="hotel-map"><div class="hotel-map-placeholder">Zone carte prévue</div></aside>
    </div>
  `;
}

function HotelsFooter() {
  document.querySelector("#hotels-footer").innerHTML = `
    <div class="footer-grid">
      <div class="footer-brand"><strong>Péncmi</strong><p>Hôtels, auberges, résidences et appartements meublés au Sénégal.</p></div>
      <div class="footer-column"><h3>Clients</h3><a href="${routeHref(routes.hotels)}">Rechercher</a><a href="${routeHref(routes.favorites)}">Favoris</a><a href="${routeHref(routes.alerts)}">Alertes</a></div>
      <div class="footer-column"><h3>Annonceurs</h3><a href="${routeHref(routes.publish)}">Publier</a><a href="${routeHref(routes.dashboard)}">Dashboard hôtels</a></div>
      <div class="footer-column"><h3>Péncmi</h3><a href="../index.html">Accueil</a><a href="../immobilier/">Immobilier</a></div>
    </div>
    <div class="footer-bottom">© 2026 Péncmi. Tous droits réservés.</div>
  `;
}

HotelsHeader();
HotelSearchHero();
HotelQuickSuggestions();
HotelsPage();
HotelsFooter();

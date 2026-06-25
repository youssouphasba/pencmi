const routes = {
  home: "/",
  trips: "/voyages",
  alerts: "/voyages/alertes",
  favorites: "/favoris/voyages",
  publish: "/publier?category=voyage",
  dashboard: "/dashboard/voyages",
  login: "/login"
};

const tripListings = [];

const vehicleTypes = ["Bus", "Car", "Minibus", "7 places", "Voiture particulière", "Covoiturage", "Véhicule avec chauffeur"];
const comfortOptions = ["Climatisation", "Siège confortable", "Véhicule récent", "Arrêts limités", "Départ direct", "Recharge téléphone", "Musique autorisée", "Non-fumeur"];

function routeHref(path) {
  if (window.location.protocol !== "file:") {
    return path;
  }

  const depth = Number(document.body?.dataset?.routeDepth || "1");
  const prefix = "../".repeat(depth);
  if (path === routes.home) return `${prefix}index.html`;
  if (path === routes.trips) return `${prefix}voyages/`;
  if (path.startsWith("/voyages?")) return `${prefix}voyages/${path.slice("/voyages".length)}`;
  if (path.startsWith("/voyages/")) return `${prefix}voyages/${path.slice("/voyages/".length)}/`;
  if (path === routes.alerts) return `${prefix}voyages/alertes/`;
  if (path === routes.favorites) return `${prefix}favoris/voyages/`;
  if (path === routes.publish) return `${prefix}publier/?category=voyage`;
  if (path === routes.dashboard) return `${prefix}dashboard/voyages/`;
  return path;
}

function TripsHeader() {
  document.querySelector("#trips-header").innerHTML = `
    <a class="brand" href="${routeHref(routes.home)}" aria-label="Accueil Péncmi"><span class="brand-mark">P</span><span><strong>Péncmi</strong><small>Voyages interurbains</small></span></a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="main-menu" aria-label="Ouvrir le menu"><span></span><span></span><span></span></button>
    <div class="header-panel" id="main-menu">
      <nav class="main-nav" aria-label="Navigation principale"><a href="../immobilier/">Immobilier</a><a href="../hotels/">Hôtels</a><a href="../voitures/">Voitures</a><a href="${routeHref(routes.trips)}" aria-current="page">Voyages</a><a href="${routeHref(routes.favorites)}">Favoris</a><a href="${routeHref(routes.alerts)}">Alertes</a></nav>
      <div class="header-actions"><a class="btn btn-ghost" href="${routes.login}">Se connecter</a><a class="btn btn-primary" href="${routeHref(routes.publish)}">Publier un trajet</a></div>
    </div>
  `;
  const toggle = document.querySelector(".menu-toggle");
  const panel = document.querySelector(".header-panel");
  toggle.addEventListener("click", () => {
    const isOpen = panel.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
}

function TripSearchHero() {
  document.querySelector("#trip-hero").innerHTML = `
    <div class="trip-hero-inner">
      <h1>Trouvez un trajet entre les villes du Sénégal</h1>
      <p>Recherchez un bus, un car, un minibus, un 7 places ou un trajet partagé selon votre destination.</p>
      <form class="trip-search-card">
        <label class="trip-field"><span>Ville de départ</span><input type="search" placeholder="Dakar"></label>
        <label class="trip-field"><span>Ville d’arrivée</span><input type="search" placeholder="Touba"></label>
        <label class="trip-field"><span>Date du voyage</span><input type="date"></label>
        <label class="trip-field"><span>Passagers</span><input type="number" min="1" value="1"></label>
        <button class="btn btn-primary" type="submit">Rechercher</button>
      </form>
    </div>
  `;
}

function TripQuickSuggestions() {
  const suggestions = [
    ["Dakar → Touba", "/voyages?depart=dakar&arrivee=touba"],
    ["Dakar → Thiès", "/voyages?depart=dakar&arrivee=thies"],
    ["Dakar → Saint-Louis", "/voyages?depart=dakar&arrivee=saint-louis"],
    ["Dakar → Kaolack", "/voyages?depart=dakar&arrivee=kaolack"],
    ["Dakar → Ziguinchor", "/voyages?depart=dakar&arrivee=ziguinchor"],
    ["Thiès → Mbour", "/voyages?depart=thies&arrivee=mbour"]
  ];
  document.querySelector("#trip-quick-tabs").innerHTML = suggestions.map(([label, href]) => `<a href="${routeHref(href)}">${label}</a>`).join("");
}

function checkOptions(options) {
  return `<div class="trip-check-list">${options.map((option) => `<label><input type="checkbox"> ${option}</label>`).join("")}</div>`;
}

function TripFilters() {
  return `
    <aside class="trip-filters">
      <fieldset class="trip-filter-group"><legend>Type de trajet</legend>${checkOptions(vehicleTypes)}</fieldset>
      <fieldset class="trip-filter-group"><legend>Départ et arrivée</legend><div class="trip-filter-grid"><input placeholder="Ville de départ"><input placeholder="Ville d’arrivée"><input placeholder="Gare routière de départ"><input placeholder="Gare routière d’arrivée"><input placeholder="Point de rendez-vous"><input placeholder="Point de dépose"></div></fieldset>
      <fieldset class="trip-filter-group"><legend>Date et heure</legend><div class="trip-filter-grid"><input type="date">${checkOptions(["Départ le matin", "Départ l’après-midi", "Départ le soir", "Départ la nuit"])}</div></fieldset>
      <fieldset class="trip-filter-group"><legend>Prix</legend><div class="trip-filter-grid"><input type="number" placeholder="Prix minimum"><input type="number" placeholder="Prix maximum"><select><option>Prix par personne</option></select></div></fieldset>
      <fieldset class="trip-filter-group"><legend>Places</legend><div class="trip-filter-grid"><input type="number" placeholder="Places disponibles"><input type="number" placeholder="Passagers">${checkOptions(["Bagages acceptés", "Gros bagages acceptés"])}</div></fieldset>
      <fieldset class="trip-filter-group"><legend>Confort</legend>${checkOptions(comfortOptions)}</fieldset>
      <fieldset class="trip-filter-group"><legend>Transporteur</legend>${checkOptions(["Particulier", "Chauffeur professionnel", "Agence de transport", "Gare routière", "Transporteur vérifié"])}</fieldset>
      <fieldset class="trip-filter-group"><legend>Tri</legend><select><option>Départ le plus tôt</option><option>Départ le plus tard</option><option>Prix croissant</option><option>Prix décroissant</option><option>Plus rapide</option><option>Plus proche du départ</option><option>Plus de places disponibles</option></select></fieldset>
    </aside>
  `;
}

function TripFavoriteButton() {
  return `<button class="favorite-button" type="button" aria-label="Ajouter aux favoris">+</button>`;
}

function TripListingCard(trip) {
  return `
    <article class="trip-card">
      <div class="trip-card-line"><div><span>${trip.departureTime || ""}</span><strong>${trip.departureCity}</strong><small>${trip.departurePoint || ""}</small></div><div class="trip-line-dot"></div><div><span>${trip.estimatedArrivalTime || ""}</span><strong>${trip.arrivalCity}</strong><small>${trip.arrivalPoint || ""}</small></div></div>
      <div class="trip-chip-row"><span class="trip-chip">${trip.vehicleType}</span><span class="trip-chip">${trip.availableSeats || ""} places</span></div>
      <div class="trip-card-actions">${TripFavoriteButton()}<a class="btn btn-light" href="./detail/">Voir détails</a><button class="btn btn-primary" type="button">Demander une place</button></div>
    </article>
  `;
}

function EmptyState() {
  return `<section class="trip-empty"><div><h2>Aucun trajet disponible pour le moment.</h2><p>Vous pouvez modifier votre recherche ou créer une alerte pour être informé plus tard.</p><div class="trip-empty-actions"><button class="btn btn-ghost" type="button">Modifier ma recherche</button><a class="btn btn-primary" href="${routeHref(routes.alerts)}">Créer une alerte</a></div></div></section>`;
}

function TripsPage() {
  document.querySelector("#trip-results").innerHTML = `
    <div class="trip-results-layout">
      ${TripFilters()}
      <section class="trip-list">${tripListings.length ? tripListings.map(TripListingCard).join("") : EmptyState()}</section>
      <aside class="trip-map"><div class="trip-map-placeholder">Zone carte ou trajet prévue</div></aside>
    </div>
  `;
}

function TripsFooter() {
  document.querySelector("#trips-footer").innerHTML = `
    <div class="footer-grid">
      <div class="footer-brand"><strong>Péncmi</strong><p>Trajets interurbains, bus, cars, minibus et covoiturage au Sénégal.</p></div>
      <div class="footer-column"><h3>Clients</h3><a href="${routeHref(routes.trips)}">Rechercher</a><a href="${routeHref(routes.favorites)}">Favoris</a><a href="${routeHref(routes.alerts)}">Alertes</a></div>
      <div class="footer-column"><h3>Annonceurs</h3><a href="${routeHref(routes.publish)}">Publier</a><a href="${routeHref(routes.dashboard)}">Dashboard voyages</a></div>
      <div class="footer-column"><h3>Péncmi</h3><a href="../index.html">Accueil</a><a href="../voitures/">Voitures</a></div>
    </div>
    <div class="footer-bottom">© 2026 Péncmi. Tous droits réservés.</div>
  `;
}

TripsHeader();
TripSearchHero();
TripQuickSuggestions();
TripsPage();
TripsFooter();

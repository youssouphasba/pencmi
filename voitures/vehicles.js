const routes = {
  home: "/",
  vehicles: "/voitures",
  alerts: "/voitures/alertes",
  favorites: "/favoris/voitures",
  publish: "/publier?category=voiture",
  dashboard: "/dashboard/voitures",
  login: "/login"
};

const vehicleListings = [];

const vehicleBrands = ["Toyota", "Hyundai", "Kia", "Peugeot", "Renault", "Mercedes-Benz", "BMW", "Audi", "Volkswagen", "Ford", "Nissan", "Mitsubishi", "Suzuki", "Honda", "Chevrolet", "Citroën", "Dacia", "Land Rover", "Lexus", "Mazda", "Opel", "Fiat", "Jeep", "Autre"];
const vehicleOptions = ["Climatisation", "Caméra de recul", "Radar de recul", "GPS", "Bluetooth", "Toit ouvrant", "Cuir", "Jantes aluminium", "4 roues motrices", "Régulateur de vitesse", "Airbags", "ABS", "Direction assistée"];
const vehicleDocuments = ["Carte grise", "Assurance", "Visite technique", "Dédouanement", "Carnet d’entretien", "Facture disponible"];

function routeHref(path) {
  if (window.location.protocol !== "file:") {
    return path;
  }

  const depth = Number(document.body?.dataset?.routeDepth || "1");
  const prefix = "../".repeat(depth);
  if (path === routes.home) return `${prefix}index.html`;
  if (path === routes.vehicles) return `${prefix}voitures/`;
  if (path.startsWith("/voitures?")) return `${prefix}voitures/${path.slice("/voitures".length)}`;
  if (path.startsWith("/voitures/")) return `${prefix}voitures/${path.slice("/voitures/".length)}/`;
  if (path === routes.alerts) return `${prefix}voitures/alertes/`;
  if (path === routes.favorites) return `${prefix}favoris/voitures/`;
  if (path === routes.publish) return `${prefix}publier/?category=voiture`;
  if (path === routes.dashboard) return `${prefix}dashboard/voitures/`;
  return path;
}

function VehiclesHeader() {
  document.querySelector("#vehicles-header").innerHTML = `
    <a class="brand" href="${routeHref(routes.home)}" aria-label="Accueil Péncmi"><span class="brand-mark">P</span><span><strong>Péncmi</strong><small>Voitures</small></span></a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="main-menu" aria-label="Ouvrir le menu"><span></span><span></span><span></span></button>
    <div class="header-panel" id="main-menu">
      <nav class="main-nav" aria-label="Navigation principale"><a href="../immobilier/">Immobilier</a><a href="../hotels/">Hôtels</a><a href="${routeHref(routes.vehicles)}" aria-current="page">Voitures</a><a href="${routeHref(routes.favorites)}">Favoris</a><a href="${routeHref(routes.alerts)}">Alertes</a></nav>
      <div class="header-actions"><a class="btn btn-ghost" href="${routes.login}">Se connecter</a><a class="btn btn-primary" href="${routeHref(routes.publish)}">Publier une voiture</a></div>
    </div>
  `;
  const toggle = document.querySelector(".menu-toggle");
  const panel = document.querySelector(".header-panel");
  toggle.addEventListener("click", () => {
    const isOpen = panel.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
}

function VehicleSearchHero() {
  document.querySelector("#vehicle-hero").innerHTML = `
    <div class="vehicle-hero-inner">
      <h1>Trouvez une voiture au Sénégal</h1>
      <p>Achetez, louez ou trouvez une voiture avec chauffeur selon votre budget et votre ville.</p>
      <form class="vehicle-search-card">
        <label class="vehicle-field"><span>Type de recherche</span><select><option>Acheter</option><option>Louer</option><option>Avec chauffeur</option></select></label>
        <label class="vehicle-field"><span>Marque</span><input type="search" placeholder="Toyota, Hyundai..."></label>
        <label class="vehicle-field"><span>Modèle</span><input type="search" placeholder="Prado, Tucson..."></label>
        <label class="vehicle-field"><span>Ville ou région</span><input type="search" placeholder="Dakar, Saly..."></label>
        <label class="vehicle-field"><span>Budget maximum</span><input type="number" min="0" placeholder="FCFA"></label>
        <button class="btn btn-primary" type="submit">Rechercher</button>
      </form>
    </div>
  `;
}

function VehicleQuickSuggestions() {
  const suggestions = [
    ["Toyota Prado", "/voitures?brand=toyota&model=prado"],
    ["Hyundai Tucson", "/voitures?brand=hyundai&model=tucson"],
    ["Location voiture Dakar", "/voitures?type=location&city=dakar"],
    ["Voiture avec chauffeur", "/voitures?type=chauffeur"],
    ["4x4 au Sénégal", "/voitures?category=4x4"],
    ["Citadine pas chère", "/voitures?category=citadine"]
  ];
  document.querySelector("#vehicle-quick-tabs").innerHTML = suggestions.map(([label, href]) => `<a href="${routeHref(href)}">${label}</a>`).join("");
}

function checkOptions(options) {
  return `<div class="vehicle-check-list">${options.map((option) => `<label><input type="checkbox"> ${option}</label>`).join("")}</div>`;
}

function VehicleFilters() {
  const regions = (window.SENEGAL_LOCATIONS || []).map((item) => item.region);
  return `
    <aside class="vehicle-filters">
      <fieldset class="vehicle-filter-group"><legend>Type d’annonce</legend>${checkOptions(["Achat", "Vente", "Location", "Avec chauffeur"])}</fieldset>
      <fieldset class="vehicle-filter-group"><legend>Localisation</legend><div class="vehicle-filter-grid"><select><option>Tout le Sénégal</option>${regions.map((region) => `<option>${region}</option>`).join("")}</select><input placeholder="Ville"><input placeholder="Quartier"><select><option>Rayon</option><option>5 km</option><option>10 km</option><option>20 km</option><option>50 km</option><option>100 km</option></select><label><input type="checkbox"> Autour de moi</label></div></fieldset>
      <fieldset class="vehicle-filter-group"><legend>Marque</legend><select><option>Marque</option>${vehicleBrands.map((brand) => `<option>${brand}</option>`).join("")}</select></fieldset>
      <fieldset class="vehicle-filter-group"><legend>Modèle</legend><input placeholder="Modèle"></fieldset>
      <fieldset class="vehicle-filter-group"><legend>Prix</legend><div class="vehicle-filter-grid"><input type="number" placeholder="Prix minimum"><input type="number" placeholder="Prix maximum"><select><option>Prix d’achat</option><option>Prix par jour</option><option>Prix par semaine</option><option>Prix par mois</option></select></div></fieldset>
      <fieldset class="vehicle-filter-group"><legend>Année</legend><div class="vehicle-filter-grid"><input type="number" placeholder="Année minimum"><input type="number" placeholder="Année maximum"></div></fieldset>
      <fieldset class="vehicle-filter-group"><legend>Kilométrage</legend><div class="vehicle-filter-grid"><input type="number" placeholder="Kilométrage minimum"><input type="number" placeholder="Kilométrage maximum"></div></fieldset>
      <fieldset class="vehicle-filter-group"><legend>Carburant</legend>${checkOptions(["Essence", "Diesel", "Hybride", "Électrique", "GPL"])}</fieldset>
      <fieldset class="vehicle-filter-group"><legend>Boîte de vitesse</legend>${checkOptions(["Manuelle", "Automatique"])}</fieldset>
      <fieldset class="vehicle-filter-group"><legend>Type de véhicule</legend>${checkOptions(["Citadine", "Berline", "SUV", "4x4", "Pick-up", "Monospace", "Utilitaire", "Camion", "Bus", "Minibus", "Moto", "Autre"])}</fieldset>
      <fieldset class="vehicle-filter-group"><legend>Nombre de places</legend>${checkOptions(["2 places", "4 places", "5 places", "7 places", "9 places", "Plus de 9 places"])}</fieldset>
      <fieldset class="vehicle-filter-group"><legend>État du véhicule</legend>${checkOptions(["Neuf", "Occasion", "Importé", "Déjà immatriculé au Sénégal", "À dédouaner", "Accidenté", "Non accidenté"])}</fieldset>
      <fieldset class="vehicle-filter-group"><legend>Options</legend>${checkOptions(vehicleOptions)}</fieldset>
      <fieldset class="vehicle-filter-group"><legend>Documents</legend>${checkOptions(vehicleDocuments)}</fieldset>
      <fieldset class="vehicle-filter-group"><legend>Annonceur</legend>${checkOptions(["Particulier", "Garage", "Agence de location", "Chauffeur professionnel", "Annonce vérifiée"])}</fieldset>
      <fieldset class="vehicle-filter-group"><legend>Tri</legend><select><option>Plus récentes</option><option>Prix croissant</option><option>Prix décroissant</option><option>Kilométrage croissant</option><option>Année décroissante</option><option>Plus proches</option></select></fieldset>
    </aside>
  `;
}

function VehicleFavoriteButton() {
  return `<button class="favorite-button" type="button" aria-label="Ajouter aux favoris">+</button>`;
}

function VehicleListingCard(vehicle) {
  return `
    <article class="vehicle-card">
      <div class="vehicle-card-photo">Photo principale</div>
      <div class="vehicle-card-body">
        <h3>${vehicle.brand} ${vehicle.model}</h3>
        <p>${vehicle.year || ""} · ${vehicle.mileage || ""} · ${vehicle.fuel || ""} · ${vehicle.gearbox || ""}</p>
        <div class="vehicle-chip-row"><span class="vehicle-chip">${vehicle.listingType}</span><span class="vehicle-chip">${vehicle.city || ""}</span></div>
        <div class="vehicle-card-actions">${VehicleFavoriteButton()}<a class="btn btn-light" href="./detail/">Voir détails</a><button class="btn btn-primary" type="button">Contacter</button></div>
      </div>
    </article>
  `;
}

function EmptyState() {
  return `<section class="vehicle-empty"><div><h2>Aucune voiture disponible pour le moment.</h2><p>Vous pouvez modifier votre recherche ou créer une alerte pour être informé plus tard.</p><div class="vehicle-empty-actions"><button class="btn btn-ghost" type="button">Modifier ma recherche</button><a class="btn btn-primary" href="${routeHref(routes.alerts)}">Créer une alerte</a></div></div></section>`;
}

function VehiclesPage() {
  document.querySelector("#vehicle-results").innerHTML = `
    <div class="vehicle-results-layout">
      ${VehicleFilters()}
      <section class="vehicle-list">${vehicleListings.length ? vehicleListings.map(VehicleListingCard).join("") : EmptyState()}</section>
      <aside class="vehicle-map"><div class="vehicle-map-placeholder">Zone carte ou localisation prévue</div></aside>
    </div>
  `;
}

function VehiclesFooter() {
  document.querySelector("#vehicles-footer").innerHTML = `
    <div class="footer-grid">
      <div class="footer-brand"><strong>Péncmi</strong><p>Voitures à vendre, à louer et avec chauffeur au Sénégal.</p></div>
      <div class="footer-column"><h3>Clients</h3><a href="${routeHref(routes.vehicles)}">Rechercher</a><a href="${routeHref(routes.favorites)}">Favoris</a><a href="${routeHref(routes.alerts)}">Alertes</a></div>
      <div class="footer-column"><h3>Annonceurs</h3><a href="${routeHref(routes.publish)}">Publier</a><a href="${routeHref(routes.dashboard)}">Dashboard voitures</a></div>
      <div class="footer-column"><h3>Péncmi</h3><a href="../index.html">Accueil</a><a href="../hotels/">Hôtels</a></div>
    </div>
    <div class="footer-bottom">© 2026 Péncmi. Tous droits réservés.</div>
  `;
}

VehiclesHeader();
VehicleSearchHero();
VehicleQuickSuggestions();
VehiclesPage();
VehiclesFooter();

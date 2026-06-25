const routes = {
  realEstate: "/immobilier",
  hotels: "/hotels",
  vehicles: "/voitures",
  trips: "/voyages",
  search: "/search",
  login: "/login",
  register: "/register",
  publish: "/login?next=/publier",
  partner: "/login?next=/dashboard",
  help: "/aide",
  terms: "/conditions",
  privacy: "/confidentialite",
  legal: "/mentions-legales",
  contact: "/contact",
  dashboardListings: "/dashboard/listings",
  dashboardMessages: "/dashboard/messages",
  dashboardContacts: "/dashboard/contacts",
  dashboardContactSettings: "/dashboard/contact-settings"
};

const editableHomeContentDefaults = {
  footerBrand: {
    name: "Péncmi",
    description: "Portail pour logement, hôtels, voitures et voyages interurbains."
  },
  footerColumns: [
    {
      title: "Univers",
      links: [
        ["Immobilier", routes.realEstate],
        ["Hôtels & Auberges", routes.hotels],
        ["Voitures", routes.vehicles],
        ["Voyages interurbains", routes.trips]
      ]
    },
    {
      title: "Annonceurs",
      links: [
        ["Publier une annonce", routes.publish],
        ["Espace partenaire", routes.partner],
        ["Se connecter", routes.login],
        ["Aide", routes.help]
      ]
    },
    {
      title: "Informations",
      links: [
        ["Conditions d’utilisation", routes.terms],
        ["Confidentialité", routes.privacy],
        ["Mentions légales", routes.legal],
        ["Contact", routes.contact],
        ["Sécurité", "/securite"],
        ["Règles de publication", "/regles-publication"],
        ["Conseils anti-arnaque", "/conseils-anti-arnaque"]
      ]
    }
  ],
  footerBottom: "© 2026 Péncmi. Tous droits réservés."
};

function routeHref(path) {
  if (window.location.protocol !== "file:") {
    return path;
  }

  if (path === "/") {
    return "./index.html";
  }

  if (path === "/immobilier") {
    return "./immobilier/";
  }

  if (path === "/hotels") {
    return "./hotels/";
  }

  if (path.startsWith("/hotels?")) {
    return `./hotels/${path.slice("/hotels".length)}`;
  }

  if (path === "/voitures") {
    return "./voitures/";
  }

  if (path.startsWith("/voitures?")) {
    return `./voitures/${path.slice("/voitures".length)}`;
  }

  if (path === "/voyages") {
    return "./voyages/";
  }

  if (path.startsWith("/voyages?")) {
    return `./voyages/${path.slice("/voyages".length)}`;
  }

  if (path.startsWith("/immobilier?")) {
    return `./immobilier/${path.slice("/immobilier".length)}`;
  }

  if (path === "/login") {
    return "./login/";
  }

  const staticRoutes = {
    "/conditions": "./conditions/",
    "/confidentialite": "./confidentialite/",
    "/mentions-legales": "./mentions-legales/",
    "/aide": "./aide/",
    "/contact": "./contact/",
    "/securite": "./securite/",
    "/regles-publication": "./regles-publication/",
    "/conseils-anti-arnaque": "./conseils-anti-arnaque/",
    "/support": "./support/"
  };

  if (staticRoutes[path]) {
    return staticRoutes[path];
  }

  if (path === "/register") {
    return "./register/";
  }

  if (path === "/login?next=/dashboard" || path.startsWith("/login?next=/dashboard")) {
    return "./login/?next=/dashboard";
  }

  if (path === "/login?next=/publier" || path.startsWith("/login?next=/publier")) {
    return "./publier/?category=immobilier";
  }

  return path;
}

function navigateTo(path) {
  window.location.href = routeHref(path);
}

const categories = [
  {
    title: "Immobilier",
    icon: "IM",
    text: "Louer, acheter ou vendre une maison, un appartement, un terrain ou un studio au Sénégal.",
    button: "Voir les biens",
    href: routes.realEstate
  },
  {
    title: "Hôtels & Auberges",
    icon: "HT",
    text: "Réserver un hôtel, une auberge, une résidence ou un appartement meublé.",
    button: "Trouver un séjour",
    href: routes.hotels
  },
  {
    title: "Voitures",
    icon: "VO",
    text: "Louer, acheter ou vendre une voiture avec ou sans chauffeur.",
    button: "Voir les voitures",
    href: routes.vehicles
  },
  {
    title: "Voyages interurbains",
    icon: "TR",
    text: "Trouver un trajet entre les villes du Sénégal : bus, car, minibus ou 7 places.",
    button: "Chercher un trajet",
    href: routes.trips
  }
];

const listingSections = [
  {
    key: "realEstate",
    title: "Immobilier",
    subtitle: "Maisons, appartements, terrains et studios à découvrir.",
    href: routes.realEstate,
    emptyText: "Aucune annonce immobilière disponible pour le moment.",
    items: [],
    renderCard: RealEstateCard
  },
  {
    key: "hotels",
    title: "Hôtels & Auberges",
    subtitle: "Hôtels, auberges, résidences et séjours partout au Sénégal.",
    href: routes.hotels,
    emptyText: "Aucun hébergement disponible pour le moment.",
    items: [],
    renderCard: HotelCard
  },
  {
    key: "vehicles",
    title: "Voitures",
    subtitle: "Voitures à louer, à acheter ou avec chauffeur.",
    href: routes.vehicles,
    emptyText: "Aucune voiture disponible pour le moment.",
    items: [],
    renderCard: VehicleCard
  },
  {
    key: "trips",
    title: "Voyages interurbains",
    subtitle: "Trajets entre les villes du Sénégal : bus, car, minibus ou 7 places.",
    href: routes.trips,
    emptyText: "Aucun trajet disponible pour le moment.",
    items: [],
    renderCard: TripCard
  }
];

const advantages = [
  {
    title: "Offres organisées",
    text: "Retrouvez les annonces par univers : immobilier, hôtels, voitures et voyages interurbains."
  },
  {
    title: "Recherche simple",
    text: "Trouvez rapidement une offre selon votre ville, votre budget ou votre besoin."
  },
  {
    title: "Mise en relation directe",
    text: "Contactez les annonceurs selon les moyens qu’ils ont activés."
  }
];

const professionalBenefits = [
  "Publier vos annonces",
  "Recevoir des demandes",
  "Discuter avec les clients",
  "Choisir vos moyens de contact"
];

const searchKeywords = {
  realEstate: ["appartement", "maison", "villa", "terrain", "studio", "chambre", "louer", "vendre", "vente", "achat", "acheter", "meuble"],
  hotels: ["hotel", "auberge", "residence", "nuit", "sejour", "etoiles"],
  vehicles: ["voiture", "auto", "vehicule", "toyota", "prado", "hyundai", "kia", "peugeot", "renault", "mercedes", "4x4", "chauffeur"],
  trips: ["voyage", "trajet", "bus", "car", "minibus", "7 places", "dakar touba", "dakar thies", "dakar saint-louis", "dakar mbour", "dakar kaolack", "dakar ziguinchor"]
};

const citySlugs = ["dakar", "touba", "thies", "saint-louis", "mbour", "kaolack", "ziguinchor", "saly"];

function normalizeText(value) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/\ba\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsKeyword(query, keywords) {
  return keywords.some((keyword) => query.includes(keyword));
}

function cleanQuery(query) {
  return normalizeText(query)
    .replace(/\s+/g, " ")
    .trim();
}

function cleanRealEstateQuery(query) {
  return cleanQuery(query)
    .replace(/\b(vendre|vente|acheter|achat|a louer|louer)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildUrl(path, params) {
  const queryString = Object.entries(params)
    .filter(([, value]) => value)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");

  return queryString ? `${path}?${queryString}` : path;
}

function extractRouteCities(query) {
  const cities = citySlugs.filter((city) => query.includes(city));
  return [...new Set(cities)].slice(0, 2);
}

function getSearchDestination(query) {
  const normalizedQuery = normalizeText(query);

  if (!normalizedQuery) {
    return routes.search;
  }

  const cities = extractRouteCities(normalizedQuery);
  const isKnownRoute = cities.length >= 2;
  const isTrip = containsKeyword(normalizedQuery, searchKeywords.trips) || isKnownRoute;
  const isHotel = containsKeyword(normalizedQuery, searchKeywords.hotels);
  const isVehicle = containsKeyword(normalizedQuery, searchKeywords.vehicles);
  const isRealEstate = containsKeyword(normalizedQuery, searchKeywords.realEstate);
  const sanitizedQuery = cleanQuery(normalizedQuery);

  if (isKnownRoute && !normalizedQuery.startsWith("voyage")) {
    return buildUrl(routes.trips, { depart: cities[0], arrivee: cities[1] });
  }

  if (isTrip) {
    return buildUrl(routes.trips, { query: sanitizedQuery });
  }

  if (isHotel) {
    const starsMatch = normalizedQuery.match(/\b([1-5])\s*(etoile|etoiles)\b/);
    return buildUrl(routes.hotels, {
      query: sanitizedQuery,
      stars: starsMatch ? starsMatch[1] : ""
    });
  }

  if (isVehicle) {
    return buildUrl(routes.vehicles, {
      query: sanitizedQuery,
      type: normalizedQuery.includes("location voiture") ? "location" : ""
    });
  }

  if (isRealEstate) {
    const type = normalizedQuery.includes("vendre") || normalizedQuery.includes("vente") ? "vente" : "";
    return buildUrl(routes.realEstate, { query: cleanRealEstateQuery(normalizedQuery), type });
  }

  return buildUrl(routes.search, { query: sanitizedQuery });
}

function Header() {
  const toggle = document.querySelector(".menu-toggle");
  const panel = document.querySelector(".header-panel");

  toggle.addEventListener("click", () => {
    const isOpen = panel.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute("aria-label", isOpen ? "Fermer le menu" : "Ouvrir le menu");
  });
}

function HeroSearch() {
  const form = document.querySelector("#hero-search");
  const input = document.querySelector("#search-input");
  const suggestions = document.querySelectorAll(".quick-suggestions button");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    navigateTo(getSearchDestination(input.value));
  });

  suggestions.forEach((button) => {
    button.addEventListener("click", () => {
      const query = button.dataset.query;
      input.value = query;
      navigateTo(getSearchDestination(query));
    });
  });
}

function CategoryCard(category) {
  return `
    <article class="category-card">
      <span class="card-icon" aria-hidden="true">${category.icon}</span>
      <h2>${category.title}</h2>
      <p>${category.text}</p>
      <a class="btn btn-light" href="${routeHref(category.href)}">${category.button}</a>
    </article>
  `;
}

function CategoryGrid() {
  document.querySelector("#category-grid").innerHTML = categories.map(CategoryCard).join("");
}

function SectionHeader(section) {
  return `
    <div class="section-header">
      <div>
        <h2>${section.title}</h2>
        <p>${section.subtitle}</p>
      </div>
      <a class="btn btn-ghost" href="${routeHref(section.href)}">Voir tout</a>
    </div>
  `;
}

function EmptyState(text) {
  return `<div class="empty-state">${text}</div>`;
}

function HorizontalListingSection(section) {
  const cards = section.items.map(section.renderCard).join("");
  const content = section.items.length ? `<div class="horizontal-list">${cards}</div>` : EmptyState(section.emptyText);

  return `
    <section class="listing-section" aria-labelledby="${section.key}-title">
      ${SectionHeader(section).replace("<h2>", `<h2 id="${section.key}-title">`)}
      ${content}
    </section>
  `;
}

function RealEstateCard(listing) {
  return `
    <article class="listing-card">
      <img src="${listing.image}" alt="">
      <p>${listing.category}</p>
      <h3>${listing.title}</h3>
      <span>${listing.city}${listing.district ? `, ${listing.district}` : ""}</span>
      <strong>${listing.price}</strong>
      ${listing.verified ? "<span>Vérifié</span>" : ""}
      <a href="${listing.href}">Voir détails</a>
    </article>
  `;
}

function HotelCard(listing) {
  return `
    <article class="listing-card">
      <img src="${listing.image}" alt="">
      <p>${listing.category}</p>
      <h3>${listing.name}</h3>
      <span>${listing.city}</span>
      <strong>${listing.priceFrom}</strong>
      ${listing.rating ? `<span>${listing.rating}</span>` : ""}
      ${listing.verified ? "<span>Vérifié</span>" : ""}
      <a href="${listing.href}">Voir détails</a>
    </article>
  `;
}

function VehicleCard(listing) {
  return `
    <article class="listing-card">
      <img src="${listing.image}" alt="">
      <p>${listing.category}</p>
      <h3>${listing.brand} ${listing.model}</h3>
      <span>${listing.city}</span>
      <strong>${listing.price}</strong>
      ${listing.transmission ? `<span>${listing.transmission}</span>` : ""}
      ${listing.fuel ? `<span>${listing.fuel}</span>` : ""}
      ${listing.verified ? "<span>Vérifié</span>" : ""}
      <a href="${listing.href}">Voir détails</a>
    </article>
  `;
}

function TripCard(listing) {
  return `
    <article class="listing-card">
      <h3>${listing.departureCity} → ${listing.arrivalCity}</h3>
      <p>${listing.transportType}</p>
      <strong>${listing.priceFrom}</strong>
      ${listing.company ? `<span>${listing.company}</span>` : ""}
      ${listing.departureTime ? `<span>${listing.departureTime}</span>` : ""}
      ${listing.verified ? "<span>Vérifié</span>" : ""}
      <a href="${listing.href}">Voir détails</a>
    </article>
  `;
}

function ListingSections() {
  document.querySelector("#listing-sections").innerHTML = listingSections.map(HorizontalListingSection).join("");
}

function AdvantagesSection() {
  document.querySelector("#advantages-section").innerHTML = advantages
    .map((advantage) => `
      <article class="advantage-card">
        <h3>${advantage.title}</h3>
        <p>${advantage.text}</p>
      </article>
    `)
    .join("");
}

function ProfessionalCTA() {
  document.querySelector("#professional-cta").innerHTML = `
    <div class="professional-cta-inner">
      <div>
        <h2>Vous êtes agence, hôtel, loueur ou transporteur ?</h2>
        <p>Créez votre espace, publiez vos offres et gérez vos contacts depuis Péncmi.</p>
        <div class="professional-actions">
          <a class="btn btn-light" href="${routeHref(routes.register)}">Créer mon espace</a>
          <a class="btn btn-primary" href="${routeHref(routes.publish)}">Publier une annonce</a>
        </div>
      </div>
      <div class="professional-benefits">
        ${professionalBenefits.map((benefit) => `<span>${benefit}</span>`).join("")}
      </div>
    </div>
  `;
}

function Footer() {
  const footer = editableHomeContentDefaults.footerBrand;
  const columns = editableHomeContentDefaults.footerColumns;

  document.querySelector("#site-footer").innerHTML = `
    <div class="footer-grid">
      <div class="footer-brand">
        <strong>${footer.name}</strong>
        <p>${footer.description}</p>
      </div>
      ${columns.map((column) => `
        <div class="footer-column">
          <h3>${column.title}</h3>
          ${column.links.map(([label, href]) => `<a href="${routeHref(href)}">${label}</a>`).join("")}
        </div>
      `).join("")}
    </div>
    <div class="footer-bottom">${editableHomeContentDefaults.footerBottom}</div>
  `;
}

Header();
HeroSearch();
CategoryGrid();
ListingSections();
AdvantagesSection();
ProfessionalCTA();
Footer();

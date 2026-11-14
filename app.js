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
  if (window.PencmiConfig?.routeHref) {
    return window.PencmiConfig.routeHref(path);
  }

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

  if (path.startsWith("/immobilier/annonce/")) {
    return `./immobilier/annonce/?id=${encodeURIComponent(path.slice("/immobilier/annonce/".length))}`;
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
    icon: "🏠",
    text: "Louer, acheter ou vendre une maison, un appartement, un terrain ou un studio au Sénégal.",
    button: "Voir les biens",
    href: routes.realEstate
  },
  {
    title: "Hôtels & Auberges",
    icon: "🏨",
    text: "Réserver un hôtel, une auberge, une résidence ou un appartement meublé.",
    button: "Trouver un séjour",
    href: routes.hotels
  },
  {
    title: "Voitures",
    icon: "🚗",
    text: "Louer, acheter ou vendre une voiture avec ou sans chauffeur.",
    button: "Voir les voitures",
    href: routes.vehicles
  },
  {
    title: "Voyages interurbains",
    icon: "🚌",
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

function getApiBaseUrl() {
  return String(window.PencmiConfig?.apiBaseUrl || window.PencmiRuntimeConfig?.apiBaseUrl || "").replace(/\/+$/, "");
}

async function apiRequest(path) {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new Error("API indisponible.");
  }

  const response = await fetch(`${baseUrl}${path}`);
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(payload?.error?.message || "Chargement impossible.");
  }

  return payload?.data ?? payload;
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function listFromApiPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

function formatPriceFCFA(value) {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  return `${Number(value).toLocaleString("fr-FR")} FCFA`;
}

function formatRealEstateCategory(listing) {
  const parts = [];

  if (listing.transaction) {
    parts.push(capitalize(listing.transaction));
  }

  if (listing.propertyType) {
    parts.push(capitalize(listing.propertyType));
  }

  return parts.join(" · ");
}

function capitalize(value) {
  const text = String(value || "").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

function mapHomeRealEstateListing(listing) {
  const metadata = listing.metadata || {};
  const photos = Array.isArray(metadata.photos) ? metadata.photos.filter(Boolean) : [];
  const image = metadata.coverPhoto || photos[0] || "";

  return {
    image,
    category: formatRealEstateCategory(listing),
    title: listing.title,
    city: listing.city,
    district: listing.neighborhood,
    price: formatPriceFCFA(listing.price ?? metadata.price),
    verified: Boolean(listing.owner?.professionalProfile?.verified),
    href: routeHref(`/immobilier/annonce/${listing.id}`),
  };
}

function mapHomeHotelListing(listing) {
  const metadata = listing.metadata || {};
  const photos = Array.isArray(metadata.photos) ? metadata.photos.filter(Boolean) : [];
  const image = metadata.coverPhoto || photos[0] || "";

  return {
    image,
    category: [listing.propertyType, listing.city].filter(Boolean).join(" · "),
    name: listing.name,
    city: listing.city,
    priceFrom: formatPriceFCFA(metadata.nightlyPrice ?? metadata.priceFrom),
    rating: metadata.stars ? `${metadata.stars} étoiles` : "",
    verified: Boolean(listing.owner?.professionalProfile?.verified),
    href: routeHref(`/hotels/${listing.id}`),
  };
}

function mapHomeVehicleListing(listing) {
  const metadata = listing.metadata || {};
  const photos = Array.isArray(metadata.photos) ? metadata.photos.filter(Boolean) : [];
  const image = metadata.coverPhoto || photos[0] || "";

  return {
    image,
    category: [{ sale: 'Vente', rental: 'Location', chauffeur: 'Avec chauffeur' }[listing.vehicleMode], listing.city].filter(Boolean).join(" · "),
    brand: metadata.brand || "",
    model: metadata.model || listing.title,
    city: listing.city,
    price: `${formatPriceFCFA(listing.price)}${listing.vehicleMode === 'rental' ? ' / jour' : listing.vehicleMode === 'chauffeur' ? metadata.chauffeurPriceUnit === 'service' ? ' / service' : ' / trajet' : ''}`,
    transmission: metadata.gearbox || "",
    fuel: metadata.fuel || "",
    verified: Boolean(listing.owner?.professionalProfile?.verified),
    href: routeHref(`/voitures/${listing.id}`),
  };
}

function mapHomeTripListing(listing) {
  const metadata = listing.metadata || {};
  return {
    departureCity: listing.departureCity,
    arrivalCity: listing.arrivalCity,
    transportType: listing.vehicleType,
    priceFrom: formatPriceFCFA(listing.pricePerSeat ?? metadata.pricePerSeat),
    company: metadata.transporterName || listing.owner?.professionalProfile?.businessName || "",
    departureTime: listing.departureTime || "",
    verified: Boolean(listing.owner?.professionalProfile?.verified),
    href: routeHref(`/voyages/${listing.id}`),
  };
}

async function loadHomeListings() {
  const loaders = [
    ["realEstate", "/immobilier", mapHomeRealEstateListing],
    ["hotels", "/hotels", mapHomeHotelListing],
    ["vehicles", "/voitures", mapHomeVehicleListing],
    ["trips", "/voyages", mapHomeTripListing],
  ];

  await Promise.all(loaders.map(async ([key, path, mapper]) => {
    const section = listingSections.find((entry) => entry.key === key);
    if (!section) {
      return;
    }

    try {
      const payload = await apiRequest(path);
      const items = listFromApiPayload(payload);
      section.items = shuffle(items)
        .map(mapper)
        .filter(Boolean)
        .slice(0, 6);
    } catch {
      section.items = [];
    }
  }));
}

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

const escapeValue = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const cardPhoto = (href, label, image) => `
      <a href="${escapeValue(href)}" aria-label="${escapeValue(label)}" tabindex="-1">
        ${image ? `<img src="${escapeValue(image)}" alt="${escapeValue(label)}" loading="lazy">` : '<div class="real-estate-photo-placeholder" role="img" aria-label="Aucune photo disponible">Aucune photo disponible</div>'}
      </a>`;
const cardTags = tags => {
  const items = tags.filter(Boolean);
  return items.length ? `<div class="listing-card-tags">${items.map(tag => `<span>${escapeValue(tag)}</span>`).join("")}</div>` : "";
};
function ListingCardBody({ href, category, title, place, price, tags = [] }) {
  return `
      <div class="listing-card-body">
        ${category ? `<p>${escapeValue(category)}</p>` : ""}
        <h3><a href="${escapeValue(href)}">${escapeValue(title)}</a></h3>
        ${place ? `<span class="listing-card-place">${escapeValue(place)}</span>` : ""}
        ${price ? `<strong>${escapeValue(price)}</strong>` : ""}
        ${cardTags(tags)}
        <a class="listing-card-link" href="${escapeValue(href)}">Voir détails</a>
      </div>`;
}

function RealEstateCard(listing) {
  return `
    <article class="listing-card">${cardPhoto(listing.href, listing.title, listing.image)}${ListingCardBody({
      href: listing.href, category: listing.category, title: listing.title,
      place: [listing.city, listing.district].filter(Boolean).join(", "), price: listing.price,
      tags: [listing.verified && "Vérifié"],
    })}
    </article>
  `;
}

function HotelCard(listing) {
  return `
    <article class="listing-card">${cardPhoto(listing.href, listing.name, listing.image)}${ListingCardBody({
      href: listing.href, category: listing.category, title: listing.name, place: listing.city, price: listing.priceFrom,
      tags: [listing.rating, listing.verified && "Vérifié"],
    })}
    </article>
  `;
}

function VehicleCard(listing) {
  const title = [listing.brand, listing.model].filter(Boolean).join(" ");
  return `
    <article class="listing-card">${cardPhoto(listing.href, title, listing.image)}${ListingCardBody({
      href: listing.href, category: listing.category, title, place: listing.city, price: listing.price,
      tags: [listing.transmission, listing.fuel, listing.verified && "Vérifié"],
    })}
    </article>
  `;
}

function TripCard(listing) {
  return `
    <article class="listing-card">${ListingCardBody({
      href: listing.href, category: listing.transportType, title: `${listing.departureCity} → ${listing.arrivalCity}`,
      place: [listing.company, listing.departureTime].filter(Boolean).join(" · "), price: listing.priceFrom,
      tags: [listing.verified && "Vérifié"],
    })}
    </article>
  `;
}

// Mobile carousels advance on their own, pause while the visitor interacts, and respect reduced motion.
function AutoScrollCarousels() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (const list of document.querySelectorAll(".horizontal-list")) {
    let pausedUntil = 0;
    const pause = () => { pausedUntil = Date.now() + 8000; };
    for (const type of ["pointerdown", "touchstart", "wheel", "focusin", "mouseenter"]) list.addEventListener(type, pause, { passive: true });
    setInterval(() => {
      if (Date.now() < pausedUntil || document.hidden || list.scrollWidth <= list.clientWidth + 4) return;
      const card = list.querySelector(".listing-card");
      if (!card) return;
      const step = card.getBoundingClientRect().width + parseFloat(getComputedStyle(list).columnGap || "0");
      const atEnd = list.scrollLeft + list.clientWidth >= list.scrollWidth - 4;
      list.scrollTo({ left: atEnd ? 0 : list.scrollLeft + step, behavior: "smooth" });
    }, 4000);
  }
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

document.addEventListener("DOMContentLoaded", async () => {
  Header();
  HeroSearch();
  CategoryGrid();
  await loadHomeListings();
  ListingSections();
  AutoScrollCarousels();
  AdvantagesSection();
  ProfessionalCTA();
  Footer();
});

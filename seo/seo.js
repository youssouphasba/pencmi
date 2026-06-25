const seoMetas = [];
const seoTemplates = [];
const seoSlugs = [];
const seoLocations = [];
const seoRedirects = [];
const sitemapEntries = [];
const seoAuditIssues = [];

const seoBaseUrl = "https://www.pencmi.com";

const editableSeoDefaults = {
  brand: "Péncmi",
  defaultOgImage: "/assets/og/pencmi-default.png",
  emptyStateTitle: "Aucune annonce disponible pour le moment.",
  emptyStateDescription: "Cette page sera mise à jour dès que de nouvelles offres seront disponibles.",
  adminEmptyTitle: "Aucun problème SEO détecté pour le moment.",
  robotsText: `User-agent: *
Allow: /

Disallow: /admin
Disallow: /dashboard
Disallow: /compte
Disallow: /login
Disallow: /register
Disallow: /forgot-password
Disallow: /reset-password
Disallow: /api

Sitemap: https://www.pencmi.com/sitemap.xml`,
  publicMeta: {
    "/": {
      id: "home",
      module: "home",
      pageType: "home",
      title: "Péncmi - Immobilier, hôtels, voitures et voyages au Sénégal",
      description: "Trouvez des offres immobilières, hébergements, voitures et trajets interurbains au Sénégal sur Péncmi.",
      h1: "Trouvez un logement, un hôtel, une voiture ou un trajet au Sénégal",
      indexing: "index",
      schemaType: "WebSite"
    },
    "/immobilier": {
      id: "real-estate-module",
      module: "real_estate",
      pageType: "module",
      title: "Immobilier au Sénégal | Péncmi",
      description: "Recherchez des annonces immobilières au Sénégal : locations, ventes, appartements, maisons, villas, terrains et bureaux.",
      h1: "Immobilier au Sénégal",
      indexing: "index",
      schemaType: "CollectionPage"
    },
    "/hotels": {
      id: "hotels-module",
      module: "hotels",
      pageType: "module",
      title: "Hôtels et auberges au Sénégal | Péncmi",
      description: "Trouvez des hôtels, auberges, résidences et appartements meublés au Sénégal avec une structure prête pour les disponibilités réelles.",
      h1: "Hôtels et auberges au Sénégal",
      indexing: "index",
      schemaType: "CollectionPage"
    },
    "/voitures": {
      id: "vehicles-module",
      module: "vehicles",
      pageType: "module",
      title: "Voitures au Sénégal | Péncmi",
      description: "Consultez les voitures à vendre, à louer, avec chauffeur, garages et loueurs au Sénégal sur Péncmi.",
      h1: "Voitures au Sénégal",
      indexing: "index",
      schemaType: "CollectionPage"
    },
    "/voyages": {
      id: "trips-module",
      module: "trips",
      pageType: "module",
      title: "Voyages interurbains au Sénégal | Péncmi",
      description: "Recherchez des trajets interurbains entre villes du Sénégal : bus, car, minibus, 7 places et covoiturage.",
      h1: "Voyages interurbains au Sénégal",
      indexing: "index",
      schemaType: "CollectionPage"
    },
    "/conditions": {
      id: "terms",
      module: "legal",
      pageType: "legal",
      title: "Conditions d’utilisation | Péncmi",
      description: "Consultez les conditions d’utilisation de Péncmi pour les clients, annonceurs et professionnels.",
      h1: "Conditions d’utilisation",
      indexing: "index",
      schemaType: "WebPage"
    },
    "/confidentialite": {
      id: "privacy",
      module: "legal",
      pageType: "legal",
      title: "Politique de confidentialité | Péncmi",
      description: "Découvrez comment Péncmi prévoit de gérer les données personnelles, les notifications et les préférences utilisateur.",
      h1: "Politique de confidentialité",
      indexing: "index",
      schemaType: "WebPage"
    },
    "/mentions-legales": {
      id: "legal-notice",
      module: "legal",
      pageType: "legal",
      title: "Mentions légales | Péncmi",
      description: "Informations légales administrables de Péncmi, à compléter par l’administrateur avant mise en production.",
      h1: "Mentions légales",
      indexing: "index",
      schemaType: "WebPage"
    },
    "/aide": {
      id: "help",
      module: "help",
      pageType: "faq",
      title: "Centre d’aide | Péncmi",
      description: "Accédez au centre d’aide Péncmi pour comprendre la recherche, les annonces, les contacts, les favoris et la sécurité.",
      h1: "Centre d’aide",
      indexing: "index",
      schemaType: "FAQPage"
    },
    "/contact": {
      id: "contact",
      module: "support",
      pageType: "support",
      title: "Contact | Péncmi",
      description: "Contactez Péncmi pour une question, un signalement, un problème de compte ou une demande liée aux annonces.",
      h1: "Contact",
      indexing: "index",
      schemaType: "ContactPage"
    },
    "/securite": {
      id: "security",
      module: "security",
      pageType: "article",
      title: "Conseils de sécurité | Péncmi",
      description: "Consultez les conseils de sécurité Péncmi pour utiliser les annonces, messages et contacts avec prudence.",
      h1: "Conseils de sécurité",
      indexing: "index",
      schemaType: "Article"
    },
    "/regles-publication": {
      id: "publishing-rules",
      module: "legal",
      pageType: "article",
      title: "Règles de publication | Péncmi",
      description: "Règles de publication administrables pour les annonces immobilières, hôtels, voitures et voyages sur Péncmi.",
      h1: "Règles de publication",
      indexing: "index",
      schemaType: "Article"
    },
    "/conseils-anti-arnaque": {
      id: "anti-scam",
      module: "security",
      pageType: "article",
      title: "Conseils anti-arnaque | Péncmi",
      description: "Conseils anti-arnaque Péncmi pour repérer les annonces suspectes, paiements douteux et comportements abusifs.",
      h1: "Conseils anti-arnaque",
      indexing: "index",
      schemaType: "Article"
    },
    "/support": {
      id: "support",
      module: "support",
      pageType: "support",
      title: "Support | Péncmi",
      description: "Accédez au support Péncmi et préparez vos demandes d’aide sans exposer de ticket privé aux moteurs de recherche.",
      h1: "Support",
      indexing: "index",
      schemaType: "WebPage"
    },
    "/guide/immobilier-senegal": {
      id: "guide-real-estate-senegal",
      module: "real_estate",
      pageType: "article",
      title: "Guide immobilier Sénégal | Péncmi",
      description: "Guide administrable pour comprendre la recherche immobilière au Sénégal avec Péncmi.",
      h1: "Guide immobilier Sénégal",
      indexing: "index",
      schemaType: "Article"
    },
    "/guide/location-appartement-senegal": {
      id: "guide-rent-apartment-senegal",
      module: "real_estate",
      pageType: "article",
      title: "Guide location appartement Sénégal | Péncmi",
      description: "Guide administrable pour rechercher une location d’appartement au Sénégal avec Péncmi.",
      h1: "Guide location appartement Sénégal",
      indexing: "index",
      schemaType: "Article"
    },
    "/guide/acheter-terrain-senegal": {
      id: "guide-buy-land-senegal",
      module: "real_estate",
      pageType: "article",
      title: "Guide achat terrain Sénégal | Péncmi",
      description: "Guide administrable pour comprendre la recherche et les précautions autour d’un terrain au Sénégal.",
      h1: "Guide achat terrain Sénégal",
      indexing: "index",
      schemaType: "Article"
    },
    "/guide/trouver-hotel-senegal": {
      id: "guide-hotels-senegal",
      module: "hotels",
      pageType: "article",
      title: "Guide hôtel Sénégal | Péncmi",
      description: "Guide administrable pour rechercher un hôtel, une auberge ou une résidence au Sénégal.",
      h1: "Guide hôtel Sénégal",
      indexing: "index",
      schemaType: "Article"
    },
    "/guide/louer-voiture-senegal": {
      id: "guide-rent-car-senegal",
      module: "vehicles",
      pageType: "article",
      title: "Guide location voiture Sénégal | Péncmi",
      description: "Guide administrable pour rechercher une voiture à louer au Sénégal avec Péncmi.",
      h1: "Guide location voiture Sénégal",
      indexing: "index",
      schemaType: "Article"
    },
    "/guide/voiture-avec-chauffeur-senegal": {
      id: "guide-car-with-driver-senegal",
      module: "vehicles",
      pageType: "article",
      title: "Guide voiture avec chauffeur Sénégal | Péncmi",
      description: "Guide administrable pour comprendre les offres de voiture avec chauffeur au Sénégal.",
      h1: "Guide voiture avec chauffeur Sénégal",
      indexing: "index",
      schemaType: "Article"
    },
    "/guide/voyage-interurbain-senegal": {
      id: "guide-intercity-trip-senegal",
      module: "trips",
      pageType: "article",
      title: "Guide voyage interurbain Sénégal | Péncmi",
      description: "Guide administrable pour rechercher un trajet interurbain au Sénégal avec Péncmi.",
      h1: "Guide voyage interurbain Sénégal",
      indexing: "index",
      schemaType: "Article"
    },
    "/guide/dakar-touba": {
      id: "guide-dakar-touba",
      module: "trips",
      pageType: "route",
      title: "Guide trajet Dakar Touba | Péncmi",
      description: "Guide administrable pour comprendre la recherche de trajet Dakar Touba avec Péncmi.",
      h1: "Guide trajet Dakar Touba",
      indexing: "index",
      schemaType: "Article"
    },
    "/guide/securite-annonces-senegal": {
      id: "guide-safety-listings-senegal",
      module: "security",
      pageType: "article",
      title: "Guide sécurité annonces Sénégal | Péncmi",
      description: "Guide administrable sur les précautions à prendre avant de contacter un annonceur au Sénégal.",
      h1: "Guide sécurité annonces Sénégal",
      indexing: "index",
      schemaType: "Article"
    }
  },
  privatePrefixes: ["/admin", "/dashboard", "/compte", "/login", "/register", "/forgot-password", "/reset-password", "/publier", "/favoris"],
  noindexPaths: ["/signaler", "/support/detail", "/immobilier/alertes", "/hotels/alertes", "/voitures/alertes", "/voyages/alertes"],
  moduleRoutes: {
    real_estate: ["/immobilier", "/immobilier/location", "/immobilier/vente", "/immobilier/achat", "/immobilier/terrains", "/immobilier/appartements", "/immobilier/maisons", "/immobilier/villas", "/immobilier/studios", "/immobilier/chambres", "/immobilier/bureaux", "/immobilier/commerces", "/immobilier/meubles", "/immobilier/agences"],
    hotels: ["/hotels", "/hotels/hotel", "/hotels/auberge", "/hotels/residence", "/hotels/appartement-meuble", "/hotels/chambre", "/hotels/avec-piscine", "/hotels/pas-cher", "/hotels/luxe", "/hotels/famille", "/hotels/proche-plage", "/hotels/proche-aeroport"],
    vehicles: ["/voitures", "/voitures/achat", "/voitures/vente", "/voitures/location", "/voitures/avec-chauffeur", "/voitures/neuves", "/voitures/occasion", "/voitures/importees", "/voitures/automatiques", "/voitures/manuelles", "/voitures/essence", "/voitures/diesel", "/voitures/hybrides", "/voitures/electriques", "/voitures/suv", "/voitures/4x4", "/voitures/citadines", "/voitures/berlines", "/voitures/pick-up", "/voitures/utilitaires", "/voitures/bus", "/voitures/minibus", "/voitures/motos"],
    trips: ["/voyages", "/voyages/bus", "/voyages/car", "/voyages/minibus", "/voyages/sept-places", "/voyages/covoiturage", "/voyages/voiture-particuliere", "/voyages/vehicule-avec-chauffeur"]
  },
  locationLevels: ["country", "region", "department", "city", "district", "station"],
  senegalRegions: ["Dakar", "Diourbel", "Fatick", "Kaffrine", "Kaolack", "Kédougou", "Kolda", "Louga", "Matam", "Saint-Louis", "Sédhiou", "Tambacounda", "Thiès", "Ziguinchor"],
  adminCards: [
    ["Pages SEO", "/admin/seo/pages"],
    ["Templates SEO", "/admin/seo/templates"],
    ["Localisations", "/admin/seo/localisations"],
    ["Sitemaps", "/admin/seo/sitemaps"],
    ["Redirections", "/admin/seo/redirects"],
    ["Robots.txt", "/admin/seo/robots"],
    ["Schema.org", "/admin/seo/schema"]
  ],
  routeLabels: {
    "/": "Accueil",
    "/immobilier": "Immobilier",
    "/immobilier/location": "Location immobilière",
    "/immobilier/vente": "Vente immobilière",
    "/immobilier/achat": "Achat immobilier",
    "/immobilier/terrains": "Terrains",
    "/immobilier/appartements": "Appartements",
    "/immobilier/maisons": "Maisons",
    "/immobilier/villas": "Villas",
    "/immobilier/studios": "Studios",
    "/immobilier/chambres": "Chambres",
    "/immobilier/bureaux": "Bureaux",
    "/immobilier/commerces": "Commerces",
    "/immobilier/meubles": "Meublés",
    "/immobilier/agences": "Agences immobilières",
    "/hotels": "Hôtels",
    "/hotels/hotel": "Hôtels",
    "/hotels/auberge": "Auberges",
    "/hotels/residence": "Résidences",
    "/hotels/appartement-meuble": "Appartements meublés",
    "/hotels/chambre": "Chambres",
    "/hotels/avec-piscine": "Hébergements avec piscine",
    "/hotels/pas-cher": "Hébergements pas chers",
    "/hotels/luxe": "Hébergements de luxe",
    "/hotels/famille": "Hébergements famille",
    "/hotels/proche-plage": "Hébergements proches de la plage",
    "/hotels/proche-aeroport": "Hébergements proches de l’aéroport",
    "/voitures": "Voitures",
    "/voitures/achat": "Achat voiture",
    "/voitures/vente": "Vente voiture",
    "/voitures/location": "Location voiture",
    "/voitures/avec-chauffeur": "Voiture avec chauffeur",
    "/voitures/neuves": "Voitures neuves",
    "/voitures/occasion": "Voitures d’occasion",
    "/voitures/importees": "Voitures importées",
    "/voitures/automatiques": "Voitures automatiques",
    "/voitures/manuelles": "Voitures manuelles",
    "/voitures/essence": "Voitures essence",
    "/voitures/diesel": "Voitures diesel",
    "/voitures/hybrides": "Voitures hybrides",
    "/voitures/electriques": "Voitures électriques",
    "/voitures/suv": "SUV",
    "/voitures/4x4": "4x4",
    "/voitures/citadines": "Citadines",
    "/voitures/berlines": "Berlines",
    "/voitures/pick-up": "Pick-up",
    "/voitures/utilitaires": "Utilitaires",
    "/voitures/bus": "Bus",
    "/voitures/minibus": "Minibus",
    "/voitures/motos": "Motos",
    "/voyages": "Voyages",
    "/voyages/bus": "Voyages en bus",
    "/voyages/car": "Voyages en car",
    "/voyages/minibus": "Voyages en minibus",
    "/voyages/sept-places": "Voyages en 7 places",
    "/voyages/covoiturage": "Covoiturage",
    "/voyages/voiture-particuliere": "Voiture particulière",
    "/voyages/vehicule-avec-chauffeur": "Véhicule avec chauffeur",
    "/aide": "Aide",
    "/conditions": "Conditions d’utilisation",
    "/confidentialite": "Confidentialité",
    "/mentions-legales": "Mentions légales",
    "/contact": "Contact",
    "/securite": "Sécurité",
    "/regles-publication": "Règles de publication",
    "/conseils-anti-arnaque": "Conseils anti-arnaque",
    "/support": "Support",
    "/guide": "Guides",
    "/guide/immobilier-senegal": "Guide immobilier Sénégal",
    "/guide/location-appartement-senegal": "Guide location appartement Sénégal",
    "/guide/acheter-terrain-senegal": "Guide achat terrain Sénégal",
    "/guide/trouver-hotel-senegal": "Guide hôtels au Sénégal",
    "/guide/louer-voiture-senegal": "Guide location voiture Sénégal",
    "/guide/voiture-avec-chauffeur-senegal": "Guide voiture avec chauffeur Sénégal",
    "/guide/voyage-interurbain-senegal": "Guide voyage interurbain Sénégal",
    "/guide/dakar-touba": "Guide Dakar Touba",
    "/guide/securite-annonces-senegal": "Guide sécurité annonces Sénégal"
  }
};

function seoEscape(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function normalizeSlug(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function generateSlug(value = "", existingSlugs = []) {
  const base = normalizeSlug(value);
  if (!existingSlugs.includes(base)) return base;
  let index = 2;
  while (existingSlugs.includes(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

function interpolateTemplate(template = "", variables = {}) {
  return template.replace(/\{([a-zA-Z0-9]+)\}/g, (_, key) => variables[key] || "");
}

function generateSeoTitle(template, variables = {}) {
  return interpolateTemplate(template, variables).replace(/\s+/g, " ").trim();
}

function generateSeoDescription(template, variables = {}) {
  return interpolateTemplate(template, variables).replace(/\s+/g, " ").trim();
}

function generateSeoH1(template, variables = {}) {
  return interpolateTemplate(template, variables).replace(/\s+/g, " ").trim();
}

function cleanSeoPath(path = "/") {
  const normalized = path.replace(/\/index\.html$/, "/").replace(/\/$/, "");
  return normalized || "/";
}

function buildCanonicalUrl(path = "/", baseUrl = seoBaseUrl) {
  const cleanPath = cleanSeoPath(path.split("?")[0]);
  return `${baseUrl}${cleanPath === "/" ? "" : cleanPath}`;
}

function isPrivateSeoPath(path = "/") {
  const cleanPath = cleanSeoPath(path);
  return editableSeoDefaults.privatePrefixes.some((prefix) => cleanPath === prefix || cleanPath.startsWith(`${prefix}/`)) || editableSeoDefaults.noindexPaths.some((prefix) => cleanPath === prefix || cleanPath.startsWith(`${prefix}/`));
}

function shouldIndexPage(page = {}) {
  if (page.indexing === "index") return true;
  if (page.indexing === "noindex") return false;
  return !isPrivateSeoPath(page.path || "/") && Boolean(page.title && page.description && page.h1);
}

function buildBreadcrumbItems(path = "/") {
  const cleanPath = cleanSeoPath(path);
  const parts = cleanPath.split("/").filter(Boolean);
  const items = [{ label: "Accueil", href: "/" }];
  let current = "";
  parts.forEach((part) => {
    current += `/${part}`;
    items.push({ label: editableSeoDefaults.routeLabels[current] || part, href: current });
  });
  return items;
}

function buildOpenGraphMeta(meta = {}) {
  return {
    title: meta.ogTitle || meta.title,
    description: meta.ogDescription || meta.description,
    url: meta.canonicalUrl || buildCanonicalUrl(meta.path),
    type: meta.pageType === "article" ? "article" : "website",
    image: meta.ogImage || editableSeoDefaults.defaultOgImage
  };
}

function buildStructuredData(meta = {}) {
  const graph = [
    {
      "@type": "Organization",
      name: editableSeoDefaults.brand,
      url: seoBaseUrl
    },
    {
      "@type": "WebSite",
      name: editableSeoDefaults.brand,
      url: seoBaseUrl
    }
  ];
  const breadcrumbs = buildBreadcrumbItems(meta.path || "/");
  if (breadcrumbs.length > 1) {
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbs.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.label,
        item: buildCanonicalUrl(item.href)
      }))
    });
  }
  if (meta.schemaType) {
    graph.push({
      "@type": meta.schemaType,
      name: meta.h1 || meta.title,
      description: meta.description,
      url: meta.canonicalUrl || buildCanonicalUrl(meta.path)
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}

function buildSitemapEntries(pages = Object.values(editableSeoDefaults.publicMeta)) {
  return pages.filter((page) => shouldIndexPage(page)).map((page) => ({
    path: page.path || Object.keys(editableSeoDefaults.publicMeta).find((key) => editableSeoDefaults.publicMeta[key] === page) || "/",
    lastModified: page.updatedAt,
    changeFrequency: page.pageType === "home" ? "daily" : "weekly",
    priority: page.pageType === "home" ? 1 : 0.7,
    indexable: true
  }));
}

function detectSeoIssues(pages = Object.values(editableSeoDefaults.publicMeta)) {
  return pages.flatMap((page) => {
    const issues = [];
    if (!page.title) issues.push({ id: `${page.id}-title`, path: page.path, module: page.module, issueType: "missing_title", severity: "high", message: "Titre SEO manquant." });
    if (!page.description) issues.push({ id: `${page.id}-description`, path: page.path, module: page.module, issueType: "missing_description", severity: "high", message: "Meta description manquante." });
    if (!page.h1) issues.push({ id: `${page.id}-h1`, path: page.path, module: page.module, issueType: "missing_h1", severity: "medium", message: "H1 manquant." });
    if (!page.canonicalUrl && !page.path) issues.push({ id: `${page.id}-canonical`, path: page.path, module: page.module, issueType: "missing_canonical", severity: "medium", message: "Canonical manquant." });
    return issues;
  });
}

function setMetaTag(selector, attributes = {}) {
  let node = document.head.querySelector(selector);
  if (!node) {
    node = document.createElement(attributes.tagName || "meta");
    document.head.appendChild(node);
  }
  Object.entries(attributes).forEach(([key, value]) => {
    if (key !== "tagName") node.setAttribute(key, value);
  });
  return node;
}

function CanonicalLink(url) {
  return `<link rel="canonical" href="${seoEscape(url)}">`;
}

function OpenGraphTags(meta = {}) {
  const og = buildOpenGraphMeta(meta);
  return `<meta property="og:title" content="${seoEscape(og.title)}"><meta property="og:description" content="${seoEscape(og.description)}"><meta property="og:url" content="${seoEscape(og.url)}"><meta property="og:type" content="${seoEscape(og.type)}"><meta property="og:image" content="${seoEscape(og.image)}"><meta name="twitter:card" content="summary_large_image">`;
}

function StructuredData(data = {}) {
  return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
}

function SeoHead(meta = {}) {
  const canonicalUrl = meta.canonicalUrl || buildCanonicalUrl(meta.path);
  const robots = shouldIndexPage(meta) ? "index,follow" : "noindex,follow";
  return `<title>${seoEscape(meta.title)}</title><meta name="description" content="${seoEscape(meta.description)}"><meta name="robots" content="${robots}">${CanonicalLink(canonicalUrl)}${OpenGraphTags({ ...meta, canonicalUrl })}${StructuredData(buildStructuredData({ ...meta, canonicalUrl }))}`;
}

function applySeoHead(meta = {}) {
  if (!meta.title || !meta.description) return;
  const canonicalUrl = meta.canonicalUrl || buildCanonicalUrl(meta.path);
  document.title = meta.title;
  setMetaTag('meta[name="description"]', { name: "description", content: meta.description });
  setMetaTag('meta[name="robots"]', { name: "robots", content: shouldIndexPage(meta) ? "index,follow" : "noindex,follow" });
  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.appendChild(canonical);
  }
  canonical.setAttribute("href", canonicalUrl);
  const og = buildOpenGraphMeta({ ...meta, canonicalUrl });
  setMetaTag('meta[property="og:title"]', { property: "og:title", content: og.title });
  setMetaTag('meta[property="og:description"]', { property: "og:description", content: og.description });
  setMetaTag('meta[property="og:url"]', { property: "og:url", content: og.url });
  setMetaTag('meta[property="og:type"]', { property: "og:type", content: og.type });
  setMetaTag('meta[property="og:image"]', { property: "og:image", content: og.image });
  setMetaTag('meta[name="twitter:card"]', { name: "twitter:card", content: "summary_large_image" });
  let structured = document.head.querySelector('script[data-seo-structured-data]');
  if (!structured) {
    structured = document.createElement("script");
    structured.type = "application/ld+json";
    structured.dataset.seoStructuredData = "true";
    document.head.appendChild(structured);
  }
  structured.textContent = JSON.stringify(buildStructuredData({ ...meta, canonicalUrl }));
}

function getCurrentSeoPath() {
  const explicitPath = document.body?.dataset?.seoPath;
  if (explicitPath) return explicitPath;
  if (window.location.protocol === "file:") {
    const pathname = window.location.pathname.replace(/\\/g, "/");
    const marker = "/pencmi/";
    const index = pathname.toLowerCase().lastIndexOf(marker);
    const relative = index >= 0 ? pathname.slice(index + marker.length) : pathname.split("/").slice(-2).join("/");
    return cleanSeoPath(`/${relative.replace(/index\.html$/, "")}`);
  }
  return cleanSeoPath(window.location.pathname);
}

function resolveSeoMeta(path = getCurrentSeoPath()) {
  if (isPrivateSeoPath(path)) {
    return {
      id: `private-${normalizeSlug(path)}`,
      module: "support",
      pageType: "support",
      path,
      title: document.title || `${editableSeoDefaults.brand}`,
      description: "Page privée Péncmi non indexable.",
      h1: document.querySelector("h1")?.textContent || "Page privée",
      indexing: "noindex",
      schemaType: "WebPage"
    };
  }
  return editableSeoDefaults.publicMeta[path] || {
    id: `public-${normalizeSlug(path)}`,
    module: "home",
    pageType: "category",
    path,
    title: document.title || `${editableSeoDefaults.brand}`,
    description: document.querySelector('meta[name="description"]')?.content || editableSeoDefaults.emptyStateDescription,
    h1: document.querySelector("h1")?.textContent || editableSeoDefaults.brand,
    indexing: "auto",
    schemaType: "WebPage"
  };
}

function SeoBreadcrumbs(items = []) {
  return `<nav class="seo-breadcrumbs" aria-label="Fil d’Ariane">${items.map((item, index) => index === items.length - 1 ? `<span>${seoEscape(item.label)}</span>` : `<a href="${seoEscape(item.href)}">${seoEscape(item.label)}</a><span>/</span>`).join("")}</nav>`;
}

function SeoIntroBlock(meta = {}) {
  return `<section class="seo-intro-block"><h1>${seoEscape(meta.h1 || meta.title)}</h1><p>${seoEscape(meta.description || editableSeoDefaults.emptyStateDescription)}</p></section>`;
}

function SeoInternalLinks({ title = "Liens utiles", links = [] } = {}) {
  return `<section class="seo-link-panel"><h2>${seoEscape(title)}</h2><div class="seo-link-grid">${links.map((link) => `<a href="${seoEscape(link.href)}">${seoEscape(link.label)}</a>`).join("")}</div></section>`;
}

function SeoLocationLinks(links = []) {
  return SeoInternalLinks({ title: "Localisations", links });
}

function SeoCategoryLinks(links = []) {
  return SeoInternalLinks({ title: "Catégories", links });
}

function SeoSimilarLinks(links = []) {
  return SeoInternalLinks({ title: "Pages proches", links });
}

function SeoEmptyState({ title = editableSeoDefaults.emptyStateTitle, description = editableSeoDefaults.emptyStateDescription, links = [] } = {}) {
  return `<section class="seo-empty-state"><h2>${seoEscape(title)}</h2><p>${seoEscape(description)}</p>${links.length ? SeoSimilarLinks(links) : ""}</section>`;
}

function SeoModulePage(meta = {}) {
  return `${SeoBreadcrumbs(buildBreadcrumbItems(meta.path))}${SeoIntroBlock(meta)}${SeoEmptyState()}`;
}

function SeoCategoryPage(meta = {}) {
  return SeoModulePage(meta);
}

function SeoLocationPage(meta = {}) {
  return SeoModulePage(meta);
}

function SeoCategoryLocationPage(meta = {}) {
  return SeoModulePage(meta);
}

function SeoBrandPage(meta = {}) {
  return SeoModulePage(meta);
}

function SeoBrandModelPage(meta = {}) {
  return SeoModulePage(meta);
}

function SeoRoutePage(meta = {}) {
  return SeoModulePage(meta);
}

function SeoHelpArticlePage(meta = {}) {
  return SeoModulePage(meta);
}

function adminSeoRouteHref(path) {
  if (typeof window === "undefined" || window.location.protocol !== "file:") return path;
  const depth = Number(document.body.dataset.routeDepth || "2");
  const prefix = "../".repeat(depth);
  const routes = {
    "/admin/seo": `${prefix}admin/seo/`,
    "/admin/seo/pages": `${prefix}admin/seo/pages/`,
    "/admin/seo/templates": `${prefix}admin/seo/templates/`,
    "/admin/seo/localisations": `${prefix}admin/seo/localisations/`,
    "/admin/seo/sitemaps": `${prefix}admin/seo/sitemaps/`,
    "/admin/seo/redirects": `${prefix}admin/seo/redirects/`,
    "/admin/seo/robots": `${prefix}admin/seo/robots/`,
    "/admin/seo/schema": `${prefix}admin/seo/schema/`
  };
  return routes[path] || path;
}

function SeoIndexingBadge(indexing = "auto") {
  return `<span class="seo-badge seo-badge-${indexing}">${indexing}</span>`;
}

function SeoAuditIssueList(issues = seoAuditIssues) {
  return issues.length ? `<section class="seo-link-panel">${issues.map((issue) => `<article><strong>${seoEscape(issue.path)}</strong><p>${seoEscape(issue.message)}</p></article>`).join("")}</section>` : SeoEmptyState({ title: editableSeoDefaults.adminEmptyTitle, description: "Les données SEO réelles alimenteront cet audit plus tard." });
}

function SeoTemplatePreview(template = {}) {
  return `<section class="seo-preview-card"><h2>Aperçu template</h2><p>${seoEscape(template.titleTemplate || "Titre SEO administrable")}</p><p>${seoEscape(template.descriptionTemplate || "Description SEO administrable")}</p></section>`;
}

function AdminSeoLayout(content, currentPage = "dashboard", title = "SEO Péncmi", subtitle = "Structure frontend pour titres, descriptions, canonical, sitemaps, robots, schema et audit SEO.") {
  const nav = editableSeoDefaults.adminCards;
  return `<div class="seo-admin-shell"><main class="seo-admin-main"><header class="seo-admin-header"><div><h1>${seoEscape(title)}</h1><p>${seoEscape(subtitle)}</p></div><a class="ds-button ds-button-outline" href="${adminSeoRouteHref("/admin/seo")}">SEO</a></header><nav class="ds-cluster">${nav.map(([label, href]) => `<a class="ds-button ${href.endsWith(currentPage) ? "ds-button-primary" : "ds-button-outline"}" href="${adminSeoRouteHref(href)}">${seoEscape(label)}</a>`).join("")}</nav>${content}</main></div>`;
}

function AdminSeoDashboard() {
  const cards = editableSeoDefaults.adminCards.map(([label, href]) => `<article class="seo-preview-card"><h2>${seoEscape(label)}</h2><p>Structure prête, aucune donnée réelle chargée.</p><a class="ds-button ds-button-outline" href="${adminSeoRouteHref(href)}">Gérer</a></article>`).join("");
  return AdminSeoLayout(`<section class="seo-admin-grid">${cards}</section>${SeoAuditIssueList(detectSeoIssues())}`, "dashboard", "Audit SEO", "Suivez les pages indexables, noindex, titres, descriptions, canonical, sitemaps et schema.");
}

function AdminSeoPagesPage() {
  return AdminSeoLayout(SeoAuditIssueList(detectSeoIssues(Object.values(editableSeoDefaults.publicMeta))), "pages", "Pages SEO", "Gérez les titres, descriptions, H1, canonical et indexation des pages publiques.");
}

function AdminSeoTemplatesPage() {
  return AdminSeoLayout(`${SeoTemplatePreview()}${SeoEmptyState({ title: "Aucun template SEO administrable pour le moment.", description: "Les modèles seront alimentés depuis l’administration plus tard." })}`, "templates", "Templates SEO", "Préparez les modèles SEO par module, catégorie, localisation, annonce, marque, trajet et aide.");
}

function AdminSeoTemplateEditor() {
  return AdminSeoTemplatesPage();
}

function AdminSeoLocationsPage() {
  const regionLinks = editableSeoDefaults.senegalRegions.map((name) => ({ label: name, href: `/admin/seo/localisations?region=${normalizeSlug(name)}` }));
  return AdminSeoLayout(`${SeoLocationLinks(regionLinks)}${SeoEmptyState({ title: "Aucune localisation dynamique chargée.", description: "La structure accepte pays, régions, départements, villes, quartiers et gares." })}`, "localisations", "Localisations SEO", "Préparez les pages locales indexables par module et niveau de localisation.");
}

function AdminSeoSitemapsPage() {
  const entries = buildSitemapEntries();
  return AdminSeoLayout(`<section class="seo-link-panel"><h2>Sitemaps prévus</h2><div class="seo-link-grid">${["/sitemap.xml", "/sitemaps/pages.xml", "/sitemaps/immobilier.xml", "/sitemaps/hotels.xml", "/sitemaps/voitures.xml", "/sitemaps/voyages.xml", "/sitemaps/localisations.xml", "/sitemaps/aide.xml", "/sitemaps/annonces.xml"].map((href) => `<a href="${href}">${href}</a>`).join("")}</div></section><section class="seo-preview-card"><h2>Entrées réelles actuelles</h2><p>${entries.length}</p></section>`, "sitemaps", "Sitemaps", "Préparez la génération future sans créer de fausses URLs.");
}

function AdminSeoRedirectsPage() {
  return AdminSeoLayout(SeoEmptyState({ title: "Aucune redirection SEO pour le moment.", description: "Les redirections 301 et 302 seront configurées ici plus tard." }), "redirects", "Redirections SEO", "Préparez les changements de slugs et anciennes URLs sans redirection backend réelle.");
}

function AdminSeoRobotsPage() {
  return AdminSeoLayout(`<section class="seo-preview-card"><h2>robots.txt prévu</h2><pre>${seoEscape(editableSeoDefaults.robotsText)}</pre></section>`, "robots", "Robots.txt", "Prévisualisez les règles d’indexation publiques et privées.");
}

function AdminSeoSchemaPage() {
  return AdminSeoLayout(`<section class="seo-preview-card"><h2>Schema.org</h2><p>WebSite, Organization, BreadcrumbList, CollectionPage, WebPage, Article, FAQPage, Hotel, Vehicle, Trip et Offer sont prévus selon les données réelles disponibles.</p></section>`, "schema", "Schema.org", "Préparez les données structurées sans faux avis, fausses notes ni fausses disponibilités.");
}

function renderSeoAdminPage() {
  const root = document.querySelector("#seo-admin-root");
  if (!root) return;
  const page = document.body.dataset.seoAdminPage || "dashboard";
  const pages = {
    dashboard: AdminSeoDashboard,
    pages: AdminSeoPagesPage,
    templates: AdminSeoTemplatesPage,
    templateEditor: AdminSeoTemplateEditor,
    localisations: AdminSeoLocationsPage,
    sitemaps: AdminSeoSitemapsPage,
    redirects: AdminSeoRedirectsPage,
    robots: AdminSeoRobotsPage,
    schema: AdminSeoSchemaPage
  };
  root.innerHTML = (pages[page] || AdminSeoDashboard)();
}

function applySeoForCurrentPage() {
  if (typeof document === "undefined") return;
  const meta = resolveSeoMeta();
  applySeoHead(meta);
}

document.addEventListener("DOMContentLoaded", () => {
  applySeoForCurrentPage();
  renderSeoAdminPage();
});

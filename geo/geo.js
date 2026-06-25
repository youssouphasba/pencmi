const geoQuestions = [];
const geoEntities = [];
const geoTemplates = [];
const geoGuidePages = [];
const geoPublicFiles = [];
const geoAuditIssues = [];

const editableGeoDefaults = {
  platformName: "Péncmi",
  updatedAt: "2026-06-25",
  publicSummary: "Péncmi est un portail sénégalais permettant de rechercher des offres d’immobilier, d’hébergement, de voitures et de voyages interurbains.",
  adminEmpty: "Aucune donnée GEO réelle n’est chargée pour le moment.",
  statusLabels: {
    draft: "Brouillon",
    published: "Publié",
    unpublished: "Dépublié",
    needs_review: "À vérifier"
  },
  publicPages: {
    "/": {
      module: "platform",
      title: "Ce qu’il faut savoir sur Péncmi",
      answer: "Péncmi regroupe des parcours pour rechercher un logement, un hébergement, une voiture ou un trajet interurbain au Sénégal. Les contenus publics expliquent les modules, les critères de recherche, les moyens de contact et les précautions de sécurité prévues.",
      links: ["/immobilier", "/hotels", "/voitures", "/voyages", "/securite", "/aide"]
    },
    "/immobilier": {
      module: "real_estate",
      title: "Trouver un bien immobilier avec Péncmi",
      answer: "Péncmi permet de rechercher des annonces immobilières au Sénégal : appartements, maisons, villas, terrains, studios, bureaux et commerces. Les utilisateurs peuvent filtrer par localisation, type de bien, transaction, budget et contacter directement les annonceurs.",
      links: ["/guide/immobilier-senegal", "/guide/location-appartement-senegal", "/guide/acheter-terrain-senegal", "/securite", "/regles-publication"]
    },
    "/hotels": {
      module: "hotels",
      title: "Trouver un hébergement avec Péncmi",
      answer: "Péncmi permet de rechercher des hôtels, auberges, résidences et appartements meublés au Sénégal. Les utilisateurs peuvent rechercher par destination, dates, type d’hébergement, équipements et disponibilité lorsque des données réelles sont disponibles.",
      links: ["/guide/trouver-hotel-senegal", "/securite", "/aide", "/contact"]
    },
    "/voitures": {
      module: "vehicles",
      title: "Trouver une voiture avec Péncmi",
      answer: "Péncmi regroupe des parcours pour consulter des voitures à vendre, à louer ou avec chauffeur au Sénégal. Les utilisateurs peuvent comparer les véhicules par marque, modèle, prix, localisation, carburant, boîte et type d’offre lorsque ces informations sont fournies.",
      links: ["/guide/louer-voiture-senegal", "/guide/voiture-avec-chauffeur-senegal", "/securite", "/aide"]
    },
    "/voyages": {
      module: "trips",
      title: "Trouver un trajet interurbain avec Péncmi",
      answer: "Péncmi permet de rechercher des trajets interurbains au Sénégal en bus, car, minibus, 7 places, covoiturage ou véhicule avec chauffeur. Les utilisateurs peuvent rechercher par départ, arrivée, date et nombre de places lorsque des trajets réels sont disponibles.",
      links: ["/guide/voyage-interurbain-senegal", "/guide/dakar-touba", "/securite", "/aide"]
    },
    "/securite": {
      module: "security",
      title: "Sécurité et précautions sur Péncmi",
      answer: "Les pages de sécurité de Péncmi expliquent les précautions à prendre avant de contacter un annonceur, visiter un bien, réserver un hébergement, acheter un véhicule ou demander une place pour un trajet.",
      links: ["/conseils-anti-arnaque", "/regles-publication", "/signaler", "/aide"]
    },
    "/conseils-anti-arnaque": {
      module: "security",
      title: "Conseils anti-arnaque",
      answer: "Péncmi prévoit des contenus de prévention pour aider les utilisateurs à repérer les annonces suspectes, les demandes de paiement douteuses et les comportements abusifs. Ces contenus sont administrables et doivent rester factuels.",
      links: ["/securite", "/signaler", "/aide"]
    },
    "/regles-publication": {
      module: "legal",
      title: "Règles de publication",
      answer: "Les règles de publication expliquent les informations attendues pour publier des annonces claires, vérifiables et utiles. Elles servent aussi aux moteurs IA pour comprendre les exigences de qualité prévues par Péncmi.",
      links: ["/publier", "/securite", "/aide"]
    },
    "/aide": {
      module: "help",
      title: "Centre d’aide Péncmi",
      answer: "Le centre d’aide rassemble les réponses et parcours utiles pour comprendre la recherche, les favoris, les alertes, les messages, les contacts, les demandes et les règles de sécurité.",
      links: ["/contact", "/securite", "/conditions"]
    }
  },
  guideRoutes: [
    ["Immobilier au Sénégal", "/guide/immobilier-senegal", "real_estate"],
    ["Location appartement Sénégal", "/guide/location-appartement-senegal", "real_estate"],
    ["Acheter terrain Sénégal", "/guide/acheter-terrain-senegal", "real_estate"],
    ["Trouver hôtel Sénégal", "/guide/trouver-hotel-senegal", "hotels"],
    ["Louer voiture Sénégal", "/guide/louer-voiture-senegal", "vehicles"],
    ["Voiture avec chauffeur Sénégal", "/guide/voiture-avec-chauffeur-senegal", "vehicles"],
    ["Voyage interurbain Sénégal", "/guide/voyage-interurbain-senegal", "trips"],
    ["Dakar Touba", "/guide/dakar-touba", "trips"],
    ["Sécurité annonces Sénégal", "/guide/securite-annonces-senegal", "security"]
  ],
  adminCards: [
    ["Questions GEO", "/admin/geo/questions"],
    ["Réponses GEO", "/admin/geo/answers"],
    ["Entités", "/admin/geo/entities"],
    ["Templates", "/admin/geo/templates"],
    ["Fichiers IA", "/admin/geo/files"],
    ["Audit GEO", "/admin/geo/audit"]
  ],
  publicFiles: [
    "/llms.txt",
    "/ai.txt",
    "/about-pencmi.txt",
    "/data/platform-summary.json",
    "/data/public-entities.json",
    "/data/public-routes.json"
  ]
};

function geoEscape(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function geoNormalizeSlug(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function buildGeoEntitySlug(name = "", existingSlugs = []) {
  const slug = geoNormalizeSlug(name);
  if (!existingSlugs.includes(slug)) return slug;
  let index = 2;
  while (existingSlugs.includes(`${slug}-${index}`)) index += 1;
  return `${slug}-${index}`;
}

function geoCurrentPath() {
  if (typeof document === "undefined") return "/";
  if (document.body?.dataset?.seoPath) return document.body.dataset.seoPath;
  return window.location.pathname.replace(/\/$/, "") || "/";
}

function geoRouteHref(path = "#") {
  if (typeof window === "undefined" || window.location.protocol !== "file:") return path;
  const depth = Number(document.body?.dataset?.routeDepth || "1");
  const prefix = "../".repeat(depth);
  const routes = {
    "/": `${prefix}index.html`,
    "/immobilier": `${prefix}immobilier/`,
    "/hotels": `${prefix}hotels/`,
    "/voitures": `${prefix}voitures/`,
    "/voyages": `${prefix}voyages/`,
    "/securite": `${prefix}securite/`,
    "/aide": `${prefix}aide/`,
    "/contact": `${prefix}contact/`,
    "/conseils-anti-arnaque": `${prefix}conseils-anti-arnaque/`,
    "/regles-publication": `${prefix}regles-publication/`,
    "/signaler": `${prefix}signaler/`
  };
  if (path.startsWith("/guide/")) return `${prefix}${path.slice(1)}/`;
  if (path.startsWith("/admin/geo")) return `${prefix}${path.slice(1)}/`;
  return routes[path] || path;
}

function generateGeoSummary(template = "", variables = {}) {
  return template.replace(/\{([a-zA-Z0-9]+)\}/g, (_, key) => variables[key] || "").replace(/\s+/g, " ").trim();
}

function generateGeoShortAnswer(question = {}) {
  return question.shortAnswer || generateGeoSummary("{platformName} permet de rechercher, comparer et contacter des annonceurs selon les informations publiques disponibles.", { platformName: editableGeoDefaults.platformName });
}

function buildGeoRelatedLinks(page = {}) {
  return (page.links || []).map((href) => ({ href, label: href.replace(/^\//, "").replace(/-/g, " ") || "Accueil" }));
}

function buildLlmsTxt() {
  const publicRoutes = Object.keys(editableGeoDefaults.publicPages).concat(editableGeoDefaults.guideRoutes.map(([, href]) => href));
  return [
    "# Péncmi",
    editableGeoDefaults.publicSummary,
    "",
    "Modules publics : immobilier, hôtels et auberges, voitures, voyages interurbains.",
    "Pays principal : Sénégal.",
    "Pages publiques importantes :",
    ...publicRoutes.map((route) => `- ${route}`),
    "",
    "Pages privées à ignorer : /admin, /dashboard, /compte, /login, /register, messages, notifications, paramètres et tickets support privés.",
    "Ne pas déduire de prix, avis, notes, disponibilités, statistiques ou classements sans données réelles."
  ].join("\n");
}

function buildAiTxt() {
  return [
    "Péncmi est une plateforme structurée pour aider les utilisateurs à rechercher des offres locales au Sénégal.",
    "Les assistants IA peuvent citer les pages publiques, les guides, les pages de sécurité, les règles de publication et l’aide.",
    "Les assistants IA ne doivent pas utiliser les pages privées ni inventer d’annonces, de prix, d’avis ou de disponibilité."
  ].join("\n");
}

function buildPlatformSummaryJson() {
  return JSON.stringify({
    name: editableGeoDefaults.platformName,
    description: editableGeoDefaults.publicSummary,
    country: "Sénégal",
    modules: ["immobilier", "hôtels et auberges", "voitures", "voyages interurbains"],
    publicPages: Object.keys(editableGeoDefaults.publicPages),
    aiFiles: editableGeoDefaults.publicFiles,
    updatedAt: editableGeoDefaults.updatedAt
  }, null, 2);
}

function buildPublicEntitiesJson(entities = geoEntities) {
  return JSON.stringify(entities.filter((entity) => entity.isPublic && entity.isIndexable), null, 2);
}

function filterGeoQuestions(items = geoQuestions, predicate = () => true) {
  return items.filter(predicate);
}

function filterGeoEntities(items = geoEntities, predicate = () => true) {
  return items.filter(predicate);
}

function detectGeoIssues({ pages = editableGeoDefaults.publicPages, entities = geoEntities, questions = geoQuestions } = {}) {
  const issues = [];
  Object.entries(pages).forEach(([path, page]) => {
    if (!page.answer) issues.push({ id: `summary-${path}`, path, issueType: "missing_geo_summary", severity: "high", message: "Résumé GEO manquant." });
    if (!page.links?.length) issues.push({ id: `links-${path}`, path, issueType: "missing_internal_links", severity: "medium", message: "Liens internes GEO manquants." });
  });
  entities.forEach((entity) => {
    if (!entity.shortDescription) issues.push({ id: `entity-description-${entity.id}`, entityId: entity.id, issueType: "missing_entity_description", severity: "medium", message: "Description courte manquante." });
    if (!entity.synonyms?.length) issues.push({ id: `entity-synonyms-${entity.id}`, entityId: entity.id, issueType: "missing_synonyms", severity: "low", message: "Synonymes manquants." });
  });
  questions.forEach((question) => {
    if (!question.shortAnswer) issues.push({ id: `answer-${question.id}`, issueType: "missing_short_answer", severity: "high", message: "Réponse courte manquante." });
  });
  return issues;
}

function GeoAnswerBlock(page = editableGeoDefaults.publicPages[geoCurrentPath()]) {
  if (!page) return "";
  return `<section class="geo-answer-block" data-geo-answer><h2>${geoEscape(page.title)}</h2><p>${geoEscape(page.answer)}</p>${GeoInternalLinks(buildGeoRelatedLinks(page))}</section>`;
}

function GeoFaqBlock(questions = geoQuestions) {
  return `<section class="geo-faq-block"><h2>Questions utiles</h2>${questions.length ? questions.map((item) => `<details><summary>${geoEscape(item.question)}</summary><p>${geoEscape(generateGeoShortAnswer(item))}</p></details>`).join("") : `<p>${editableGeoDefaults.adminEmpty}</p>`}</section>`;
}

function GeoEntitySummary(entity = {}) {
  return `<article class="geo-entity-summary"><h2>${geoEscape(entity.name || "Entité GEO")}</h2><p>${geoEscape(entity.shortDescription || editableGeoDefaults.adminEmpty)}</p></article>`;
}

function GeoGuidePage(guide = {}) {
  return `<main class="geo-guide-main"><header class="geo-guide-header"><div><h1>${geoEscape(guide.title || "Guide Péncmi")}</h1><p>${geoEscape(guide.intro || "Ce guide est un contenu administrable. Il sera complété avec des informations validées.")}</p></div></header>${(guide.sections || []).length ? guide.sections.map((section) => `<section class="geo-guide-card"><h2>${geoEscape(section.title)}</h2><p>${geoEscape(section.body)}</p></section>`).join("") : GeoEmptyState("Guide en cours de préparation.")}${GeoRelatedQuestions()}</main>`;
}

function GeoRelatedQuestions(questions = geoQuestions) {
  return `<section class="geo-related-panel"><h2>Questions liées</h2>${questions.length ? questions.map((item) => `<p>${geoEscape(item.question)}</p>`).join("") : `<p>${editableGeoDefaults.adminEmpty}</p>`}</section>`;
}

function GeoInternalLinks(links = []) {
  return links.length ? `<div class="geo-link-list">${links.map((link) => `<a href="${geoRouteHref(link.href)}">${geoEscape(link.label)}</a>`).join("")}</div>` : "";
}

function GeoComparisonBlock({ title = "Comparaison", body = "Contenu comparatif administrable à compléter." } = {}) {
  return `<section class="geo-comparison-block"><h2>${geoEscape(title)}</h2><p>${geoEscape(body)}</p></section>`;
}

function GeoSafetySummary({ body = "Vérifiez les informations importantes et évitez les paiements suspects avant tout engagement." } = {}) {
  return `<aside class="geo-safety-summary"><h2>Sécurité</h2><p>${geoEscape(body)}</p></aside>`;
}

function GeoPublicFilePreview({ path = "", content = "" } = {}) {
  return `<section class="geo-public-file-preview"><h2>${geoEscape(path)}</h2><pre class="geo-file-preview">${geoEscape(content)}</pre></section>`;
}

function GeoStatusBadge(status = "draft") {
  return `<span class="geo-status-badge geo-status-${status}">${geoEscape(editableGeoDefaults.statusLabels[status] || status)}</span>`;
}

function GeoTemplatePreview(template = {}) {
  return `<section class="geo-admin-card"><h2>Aperçu template GEO</h2><p>${geoEscape(template.bodyTemplate || "{platformName} permet de rechercher des offres locales selon les informations disponibles.")}</p></section>`;
}

function GeoAuditIssueList(issues = detectGeoIssues()) {
  return issues.length ? `<section class="geo-admin-card"><h2>Problèmes GEO</h2>${issues.map((issue) => `<article><strong>${geoEscape(issue.issueType)}</strong><p>${geoEscape(issue.message)}</p></article>`).join("")}</section>` : GeoEmptyState("Aucun problème GEO détecté pour le moment.");
}

function GeoEmptyState(title = editableGeoDefaults.adminEmpty) {
  return `<section class="geo-empty-state"><h2>${geoEscape(title)}</h2><p>Les données réelles et contenus publiés alimenteront cette section plus tard.</p></section>`;
}

function adminGeoRouteHref(path) {
  return geoRouteHref(path);
}

function AdminGeoLayout(content, currentPage = "dashboard", title = "GEO Péncmi", subtitle = "Structure pour rendre Péncmi compréhensible par les moteurs IA.") {
  return `<div class="geo-admin-shell"><main class="geo-admin-main"><header class="geo-admin-header"><div><h1>${geoEscape(title)}</h1><p>${geoEscape(subtitle)}</p></div><a class="ds-button ds-button-outline" href="${adminGeoRouteHref("/admin/geo")}">GEO</a></header><nav class="ds-cluster">${editableGeoDefaults.adminCards.map(([label, href]) => `<a class="ds-button ${href.endsWith(currentPage) ? "ds-button-primary" : "ds-button-outline"}" href="${adminGeoRouteHref(href)}">${geoEscape(label)}</a>`).join("")}</nav>${content}</main></div>`;
}

function AdminGeoDashboard() {
  const cards = editableGeoDefaults.adminCards.map(([label, href]) => `<article class="geo-admin-card"><h2>${geoEscape(label)}</h2><p>0 élément réel chargé. Structure prête pour l’administration.</p><a class="ds-button ds-button-outline" href="${adminGeoRouteHref(href)}">Gérer</a></article>`).join("");
  return AdminGeoLayout(`<section class="geo-admin-grid">${cards}</section>${GeoAuditIssueList()}`, "dashboard", "Vue d’ensemble GEO", "Suivez questions, entités, guides, fichiers IA et contenus à compléter.");
}

function AdminGeoQuestionsPage() {
  return AdminGeoLayout(`${GeoFaqBlock()}${AdminGeoQuestionEditor()}`, "questions", "Questions GEO", "Préparez les questions fréquentes compréhensibles par les assistants IA.");
}

function AdminGeoQuestionEditor() {
  return `<section class="geo-admin-card"><h2>Éditeur question</h2><p>Question, réponse courte, réponse détaillée, module, localisation, entités et pages liées.</p></section>`;
}

function AdminGeoEntitiesPage() {
  return AdminGeoLayout(`${GeoEmptyState("Aucune entité GEO réelle pour le moment.")}${AdminGeoEntityEditor()}`, "entities", "Entités GEO", "Gérez modules, catégories, localisations, synonymes et pages liées.");
}

function AdminGeoEntityEditor() {
  return `<section class="geo-admin-card"><h2>Éditeur entité</h2><p>Nom, slug, type, descriptions, synonymes, statut public et pages liées.</p></section>`;
}

function AdminGeoTemplatesPage() {
  return AdminGeoLayout(`${GeoTemplatePreview()}${AdminGeoTemplateEditor()}`, "templates", "Templates GEO", "Préparez les formats de réponses, guides, FAQ, sécurité, comparaison et contact.");
}

function AdminGeoTemplateEditor() {
  return `<section class="geo-admin-card"><h2>Éditeur template</h2><p>Variables prévues : {platformName}, {module}, {category}, {location}, {depart}, {arrivee}, {brand}, {model}.</p></section>`;
}

function AdminGeoFilesPage() {
  const files = [
    GeoPublicFilePreview({ path: "/llms.txt", content: buildLlmsTxt() }),
    GeoPublicFilePreview({ path: "/ai.txt", content: buildAiTxt() }),
    GeoPublicFilePreview({ path: "/data/platform-summary.json", content: buildPlatformSummaryJson() })
  ].join("");
  return AdminGeoLayout(files, "files", "Fichiers IA", "Prévisualisez les fichiers publics utiles aux moteurs IA.");
}

function AdminGeoAuditPage() {
  return AdminGeoLayout(GeoAuditIssueList(), "audit", "Audit GEO", "Repérez résumés manquants, entités incomplètes, liens internes manquants et contenus privés exposés.");
}

function renderGeoAdminPage() {
  const root = document.querySelector("#geo-admin-root");
  if (!root) return;
  const page = document.body.dataset.geoAdminPage || "dashboard";
  const pages = {
    dashboard: AdminGeoDashboard,
    questions: AdminGeoQuestionsPage,
    answers: AdminGeoQuestionsPage,
    entities: AdminGeoEntitiesPage,
    templates: AdminGeoTemplatesPage,
    files: AdminGeoFilesPage,
    audit: AdminGeoAuditPage
  };
  root.innerHTML = (pages[page] || AdminGeoDashboard)();
}

function renderGeoGuide() {
  const root = document.querySelector("#geo-guide-root");
  if (!root) return;
  const title = document.body.dataset.geoGuideTitle || "Guide Péncmi";
  const module = document.body.dataset.geoGuideModule || "platform";
  root.innerHTML = GeoGuidePage({ title, module, intro: "Cette page guide est administrable. Elle sera enrichie avec des contenus validés depuis le back-office GEO.", sections: [] });
}

function injectGeoAnswerBlock() {
  const path = geoCurrentPath();
  const page = editableGeoDefaults.publicPages[path];
  if (!page || document.querySelector("[data-geo-answer]") || document.querySelector("#geo-guide-root") || path.startsWith("/admin") || path.startsWith("/dashboard") || path.startsWith("/compte")) return;
  const target = document.querySelector("main") || document.body;
  target.insertAdjacentHTML("beforeend", GeoAnswerBlock(page));
}

document.addEventListener("DOMContentLoaded", () => {
  renderGeoAdminPage();
  renderGeoGuide();
  injectGeoAnswerBlock();
});

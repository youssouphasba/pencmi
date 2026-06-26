const adminContentPages = [];
const adminContentSections = [];
const contentVersions = [];
const faqItems = [];
const safetyTips = [];
const publishingRules = [];
const antiScamTips = [];
const supportCategories = [];
const footerLinks = [];
const supportTickets = [];
const supportMessages = [];

const contentRoutes = {
  conditions: "/conditions",
  privacy: "/confidentialite",
  legalNotice: "/mentions-legales",
  help: "/aide",
  contact: "/contact",
  security: "/securite",
  publishingRules: "/regles-publication",
  antiScam: "/conseils-anti-arnaque",
  support: "/support",
  supportDetail: "/support/detail",
  adminContent: "/admin/content",
  adminPages: "/admin/content/pages",
  adminPageEdit: "/admin/content/pages/edit",
  adminFaq: "/admin/content/faq",
  adminSecurityTips: "/admin/content/security-tips",
  adminPublishingRules: "/admin/content/publishing-rules",
  adminAntiScam: "/admin/content/anti-scam",
  adminSupportCategories: "/admin/content/support-categories",
  adminFooterLinks: "/admin/content/footer-links",
  adminSupport: "/admin/support",
  adminSupportDetail: "/admin/support/detail",
  accountSettings: "/compte/parametres",
  report: "/signaler",
  home: "/"
};

const editableContentDefaults = {
  labels: {
    brand: "Péncmi",
    publicHeaderSubtitle: "Aide et informations",
    adminHeaderSubtitle: "Contenus admin",
    tableOfContents: "Sommaire",
    emptyContent: "",
    adminReady: "Interface admin prête pour une future gestion persistante.",
    contentUpdated: "Le contenu a été mis à jour.",
    messagePrepared: "Votre message a été préparé.",
    noSupportTickets: "Vous n’avez aucune demande support pour le moment.",
    supportNotFound: "Demande introuvable",
    noSupportTicketLoaded: "Aucun ticket support n’est chargé pour le moment.",
    noAdminSupportTicketLoaded: "Aucun ticket support chargé pour le moment.",
    dashboardEmptyMetrics: "Éléments : 0. Publiés : 0. Brouillons : 0. Dernière modification : non disponible.",
    questionsManagedByAdmin: "Des réponses seront bientôt disponibles dans cette rubrique.",
    legalDraftNotice: ""
  },
  actions: {
    add: "Ajouter",
    edit: "Modifier",
    publish: "Publier",
    unpublish: "Dépublier",
    reorder: "Réordonner",
    manage: "Gérer",
    saveDraft: "Enregistrer en brouillon",
    preview: "Prévisualiser",
    cancel: "Annuler",
    restorePreviousVersion: "Restaurer version précédente",
    sendMessage: "Envoyer le message",
    createRequest: "Créer une demande",
    reply: "Répondre",
    markResolved: "Marquer comme résolu",
    backToSupport: "Retour au support",
    addInternalNote: "Ajouter note interne",
    changeStatus: "Changer statut",
    assignAdmin: "Assigner à un admin",
    close: "Fermer",
    content: "Contenus",
    reportIssue: "Signaler un problème"
  },
  contentStatusLabels: {
    draft: "Brouillon",
    published: "Publiée",
    unpublished: "Dépubliée",
    needs_review: "À vérifier"
  },
  supportStatusLabels: {
    new: "Nouveau",
    in_progress: "En cours",
    waiting_user: "En attente de réponse",
    resolved: "Résolu",
    closed: "Fermé"
  },
  supportPriorityLabels: {
    low: "Faible",
    normal: "Normale",
    important: "Importante",
    urgent: "Urgente"
  },
  pageSlugLabels: {
    conditions: "Conditions d’utilisation",
    confidentialite: "Politique de confidentialité",
    "mentions-legales": "Mentions légales",
    aide: "Centre d’aide",
    contact: "Contact",
    securite: "Sécurité",
    "regles-publication": "Règles de publication",
    "conseils-anti-arnaque": "Conseils anti-arnaque",
    support: "Support"
  },
  publicFooterLinks: [
    { label: "Conditions d’utilisation", href: "/conditions" },
    { label: "Confidentialité", href: "/confidentialite" },
    { label: "Mentions légales", href: "/mentions-legales" },
    { label: "Aide", href: "/aide" },
    { label: "Contact", href: "/contact" },
    { label: "Sécurité", href: "/securite" },
    { label: "Règles de publication", href: "/regles-publication" },
    { label: "Conseils anti-arnaque", href: "/conseils-anti-arnaque" }
  ],
  publicPages: {
    conditions: {
      title: "Conditions d’utilisation",
      subtitle: "Les règles d’utilisation de Péncmi pour les clients, annonceurs et professionnels.",
      adminUrl: "/admin/content/pages/conditions/edit",
      sections: ["Objet de la plateforme", "Création de compte", "Règles pour les clients", "Règles pour les annonceurs", "Publication des annonces", "Vérification des informations", "Contacts entre utilisateurs", "Messages et demandes", "Signalements", "Suspension ou suppression de contenu", "Responsabilités des utilisateurs", "Responsabilité de Péncmi", "Données personnelles", "Modification des conditions", "Contact"],
      warning: "Les informations affichées sur les annonces sont fournies par les annonceurs. Les utilisateurs doivent vérifier les informations importantes avant tout engagement."
    },
    confidentialite: {
      title: "Politique de confidentialité",
      subtitle: "Comment Péncmi collecte, utilise et protège vos données.",
      adminUrl: "/admin/content/pages/confidentialite/edit",
      sections: ["Données collectées", "Données de compte", "Données de contact", "Données des annonces", "Messages et demandes", "Favoris et alertes", "Notifications internes", "Emails", "Données techniques", "Utilisation des données", "Partage des données", "Conservation des données", "Sécurité des données", "Droits des utilisateurs", "Suppression du compte", "Contact confidentialité"],
      action: { label: "Gérer mes paramètres", href: "/compte/parametres" }
    },
    "mentions-legales": {
      title: "Mentions légales",
      subtitle: "Informations relatives au site Péncmi.",
      adminUrl: "/admin/content/pages/mentions-legales/edit",
      sections: ["Éditeur du site", "Nom commercial", "Responsable de publication", "Contact", "Hébergement", "Propriété intellectuelle", "Signalement de contenu", "Données personnelles"],
      warning: "Les informations légales complètes seront publiées avant la mise en production."
    },
    securite: {
      title: "Conseils de sécurité",
      subtitle: "Adoptez les bons réflexes avant de vous engager avec un annonceur ou un client.",
      adminUrl: "/admin/content/security-tips",
      sections: ["Conseils généraux", "Immobilier", "Hôtels", "Voitures", "Voyages", "Paiements suspects", "Signalements", "Vérifications"],
      action: { label: "Signaler un problème", href: "/signaler" }
    },
    "regles-publication": {
      title: "Règles de publication des annonces",
      subtitle: "Les annonces doivent être claires, honnêtes et conformes aux règles de Péncmi.",
      adminUrl: "/admin/content/publishing-rules",
      sections: ["Règles communes", "Immobilier", "Hôtels & Auberges", "Voitures", "Voyages interurbains", "Photos", "Prix", "Contacts", "Contenus interdits", "Validation et refus", "Suspension"]
    },
    "conseils-anti-arnaque": {
      title: "Éviter les arnaques",
      subtitle: "Quelques conseils pour utiliser Péncmi avec prudence.",
      adminUrl: "/admin/content/anti-scam",
      sections: ["Reconnaître une annonce suspecte", "Reconnaître un faux annonceur", "Avant de payer", "Avant une visite", "Avant une réservation", "Avant d’acheter une voiture", "Avant un trajet", "Comment signaler"],
      action: { label: "Signaler une annonce suspecte", href: "/signaler" }
    }
  },
  help: {
    title: "Comment pouvons-nous vous aider ?",
    subtitle: "Trouvez rapidement une réponse selon votre besoin.",
    searchLabel: "Recherche",
    searchPlaceholder: "Rechercher une question, une annonce, un compte, une réservation...",
    categories: ["Compte et connexion", "Rechercher une annonce", "Contacter un annonceur", "Favoris et alertes", "Immobilier", "Hôtels & Auberges", "Voitures", "Voyages interurbains", "Publier une annonce", "Vérification et badges", "Signalements et sécurité", "Notifications et emails"]
  },
  contact: {
    title: "Contacter Péncmi",
    subtitle: "Envoyez-nous votre demande, notre équipe vous répondra dès que possible.",
    fields: {
      name: "Nom",
      email: "Email",
      phone: "Téléphone",
      subject: "Sujet",
      category: "Catégorie",
      message: "Message"
    },
    categories: ["Question générale", "Problème de compte", "Problème avec une annonce", "Signalement", "Partenariat", "Professionnel / annonceur", "Autre"]
  },
  support: {
    title: "Support",
    subtitle: "Suivez vos demandes envoyées à l’équipe Péncmi.",
    detailReplyLabel: "Réponse"
  },
  admin: {
    nav: [
      { label: "Vue d’ensemble", href: "/admin/content", key: "dashboard" },
      { label: "Pages", href: "/admin/content/pages", key: "pages" },
      { label: "FAQ", href: "/admin/content/faq", key: "faq" },
      { label: "Sécurité", href: "/admin/content/security-tips", key: "security" },
      { label: "Publication", href: "/admin/content/publishing-rules", key: "rules" },
      { label: "Anti-arnaque", href: "/admin/content/anti-scam", key: "antiScam" },
      { label: "Catégories support", href: "/admin/content/support-categories", key: "categories" },
      { label: "Liens footer", href: "/admin/content/footer-links", key: "footer" },
      { label: "Support", href: "/admin/support", key: "support" }
    ],
    dashboardTitle: "Gestion des contenus",
    dashboardSubtitle: "Modifiez les pages légales, l’aide, les règles, les conseils et les contenus publics de Péncmi.",
    dashboardCards: [
      { title: "Pages légales", href: "/admin/content/pages" },
      { title: "FAQ", href: "/admin/content/faq" },
      { title: "Conseils de sécurité", href: "/admin/content/security-tips" },
      { title: "Règles de publication", href: "/admin/content/publishing-rules" },
      { title: "Conseils anti-arnaque", href: "/admin/content/anti-scam" },
      { title: "Catégories support", href: "/admin/content/support-categories" },
      { title: "Liens footer", href: "/admin/content/footer-links" }
    ],
    pagesTitle: "Pages administrables",
    pagesSubtitle: "Gérez les pages publiques importantes.",
    editorTitle: "Éditeur de page",
    editorSubtitle: "Modifiez le contenu administrable sans sauvegarde réelle.",
    versionHistoryTitle: "Historique des versions",
    noVersions: "Aucune version enregistrée pour le moment.",
    previewTitle: "Prévisualisation",
    sectionTitle: "Section",
    sectionListTitle: "Sections",
    sectionListEmpty: "Paragraphes, listes, avertissements, conseils, FAQ, liens et boutons seront listés ici.",
    supportDetailTitle: "Détail ticket support",
    supportDetailSubtitle: "Gérez la réponse, les notes internes, le statut et l’assignation.",
    internalNote: "Note interne",
    response: "Réponse"
  },
  adminPages: {
    faq: { key: "faq", title: "FAQ", columns: ["Question", "Réponse", "Catégorie", "Module", "Statut", "Ordre", "Actions"], empty: "Aucune question FAQ pour le moment." },
    security: { key: "security", title: "Conseils de sécurité", columns: ["Titre", "Texte", "Module", "Importance", "Statut", "Ordre", "Actions"], empty: "Aucun conseil de sécurité pour le moment." },
    rules: { key: "rules", title: "Règles de publication", columns: ["Titre", "Description", "Module", "Statut", "Ordre", "Actions"], empty: "Aucune règle de publication pour le moment." },
    antiScam: { key: "antiScam", title: "Conseils anti-arnaque", columns: ["Titre", "Texte", "Module", "Niveau de risque", "Statut", "Ordre", "Actions"], empty: "Aucun conseil anti-arnaque pour le moment." },
    categories: { key: "categories", title: "Catégories support", columns: ["Nom", "Description", "Statut", "Ordre", "Email futur", "Actions"], empty: "Aucune catégorie support pour le moment." },
    footer: { key: "footer", title: "Liens footer", columns: ["Label", "URL", "Colonne", "Ordre", "Statut", "Actions"], empty: "Aucun lien footer pour le moment." },
    support: { key: "support", title: "Tickets support", columns: ["Utilisateur", "Sujet", "Catégorie", "Statut", "Priorité", "Dernière réponse", "Création", "Actions"], empty: "Aucune demande support pour le moment." }
  }
};

function contentRouteHref(path) {
  if (window.location.protocol !== "file:") return path;
  const depth = Number(document.body.dataset.routeDepth || "1");
  const prefix = "../".repeat(depth);
  if (/^\/support\/[^/]+$/.test(path)) return `${prefix}support/detail/`;
  if (/^\/admin\/support\/[^/]+$/.test(path)) return `${prefix}admin/support/detail/`;
  if (/^\/admin\/content\/pages\/[^/]+\/edit$/.test(path)) return `${prefix}admin/content/pages/edit/`;
  const routes = {
    "/": `${prefix}index.html`,
    "/conditions": `${prefix}conditions/`,
    "/confidentialite": `${prefix}confidentialite/`,
    "/mentions-legales": `${prefix}mentions-legales/`,
    "/aide": `${prefix}aide/`,
    "/contact": `${prefix}contact/`,
    "/securite": `${prefix}securite/`,
    "/regles-publication": `${prefix}regles-publication/`,
    "/conseils-anti-arnaque": `${prefix}conseils-anti-arnaque/`,
    "/support": `${prefix}support/`,
    "/support/detail": `${prefix}support/detail/`,
    "/admin/content": `${prefix}admin/content/`,
    "/admin/content/pages": `${prefix}admin/content/pages/`,
    "/admin/content/pages/edit": `${prefix}admin/content/pages/edit/`,
    "/admin/content/faq": `${prefix}admin/content/faq/`,
    "/admin/content/security-tips": `${prefix}admin/content/security-tips/`,
    "/admin/content/publishing-rules": `${prefix}admin/content/publishing-rules/`,
    "/admin/content/anti-scam": `${prefix}admin/content/anti-scam/`,
    "/admin/content/support-categories": `${prefix}admin/content/support-categories/`,
    "/admin/content/footer-links": `${prefix}admin/content/footer-links/`,
    "/admin/support": `${prefix}admin/support/`,
    "/admin/support/detail": `${prefix}admin/support/detail/`,
    "/compte/parametres": `${prefix}compte/parametres/`,
    "/signaler": `${prefix}signaler/`
  };
  return routes[path] || path;
}

function slugId(value = "") {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function getContentStatusLabel(status) {
  return editableContentDefaults.contentStatusLabels[status] || editableContentDefaults.contentStatusLabels.draft;
}

function getPageSlugLabel(slug) {
  return editableContentDefaults.pageSlugLabels[slug] || "Page";
}

function getHelpCategoryLabel(category) {
  return category || "Général";
}

function getSupportStatusLabel(status) {
  return editableContentDefaults.supportStatusLabels[status] || editableContentDefaults.supportStatusLabels.new;
}

function getSupportPriorityLabel(priority) {
  return editableContentDefaults.supportPriorityLabels[priority] || editableContentDefaults.supportPriorityLabels.normal;
}

function sortContentSections(sections = []) {
  return [...sections].sort((a, b) => a.order - b.order);
}

function filterFaqItems(items = [], predicate = () => true) {
  return items.filter(predicate);
}

function buildPublicPageUrl(slug) {
  return `/${slug}`;
}

function buildAdminEditContentUrl(slug) {
  return `/admin/content/pages/${slug}/edit`;
}

function buildSupportTicketUrl(id = "") {
  return id ? `/support/${id}` : "/support";
}

function PublicHeader() {
  const labels = editableContentDefaults.labels;
  return `<header class="content-header"><a class="brand" href="${contentRouteHref(contentRoutes.home)}" aria-label="Accueil ${labels.brand}"><span class="brand-mark">P</span><span><strong>${labels.brand}</strong><small>${labels.publicHeaderSubtitle}</small></span></a></header>`;
}

function PublicFooter() {
  const configuredLinks = footerLinks.length ? footerLinks.filter((link) => link.active).sort((a, b) => a.order - b.order) : editableContentDefaults.publicFooterLinks;
  return `<footer class="content-footer"><div class="content-actions">${configuredLinks.map((link) => `<a href="${contentRouteHref(link.href || link.url)}">${link.label}</a>`).join("")}</div></footer>`;
}

function LegalPageLayout(config) {
  return `${PublicHeader()}<main class="content-main"><section class="content-hero"><h1>${config.title}</h1><p>${config.subtitle || ""}</p></section><div class="legal-layout">${LegalTableOfContents(config.sections)}<div>${PublicDynamicPage(config)}</div></div></main>${PublicFooter()}`;
}

function LegalTableOfContents(sections = []) {
  return `<aside class="legal-toc"><strong>${editableContentDefaults.labels.tableOfContents}</strong><nav>${sections.map((section) => `<a href="#${slugId(section)}">${section}</a>`).join("")}</nav></aside>`;
}

function PublicDynamicPage(config) {
  const warning = config.warning || editableContentDefaults.labels.legalDraftNotice;
  const action = config.action ? `<div class="content-actions"><a class="btn btn-primary" href="${contentRouteHref(config.action.href)}">${config.action.label}</a></div>` : "";
  return `<div class="content-section-list">${warning ? `<div class="content-warning">${warning}</div>` : ""}${config.sections.map((section) => `<section class="content-card" id="${slugId(section)}"><h2>${section}</h2>${editableContentDefaults.labels.emptyContent ? `<p>${editableContentDefaults.labels.emptyContent}</p>` : ""}</section>`).join("")}${action}</div>`;
}

function TermsPage() {
  return LegalPageLayout(editableContentDefaults.publicPages.conditions);
}

function PrivacyPage() {
  return LegalPageLayout(editableContentDefaults.publicPages.confidentialite);
}

function LegalNoticePage() {
  return LegalPageLayout(editableContentDefaults.publicPages["mentions-legales"]);
}

function HelpCenterPage() {
  const help = editableContentDefaults.help;
  return `${PublicHeader()}<main class="content-main"><section class="content-hero"><h1>${help.title}</h1><p>${help.subtitle}</p></section>${HelpSearch()}<section class="help-grid">${help.categories.map(HelpCategoryCard).join("")}</section>${FaqSection()}</main>${PublicFooter()}`;
}

function HelpSearch() {
  const help = editableContentDefaults.help;
  return `<section class="content-card help-search"><label class="content-field"><span>${help.searchLabel}</span><input type="search" placeholder="${help.searchPlaceholder}"></label></section>`;
}

function HelpCategoryCard(label) {
  return `<article class="content-card"><h2>${getHelpCategoryLabel(label)}</h2><p>${editableContentDefaults.labels.questionsManagedByAdmin}</p></article>`;
}

function FaqSection() {
  return faqItems.length ? `<section class="content-card">${faqItems.map((item) => `<details><summary>${item.question}</summary><p>${item.answer}</p></details>`).join("")}</section>` : ContentEmptyState(editableContentDefaults.labels.emptyContent);
}

function ContactPage() {
  const contact = editableContentDefaults.contact;
  return `${PublicHeader()}<main class="content-main"><section class="content-hero"><h1>${contact.title}</h1><p>${contact.subtitle}</p></section>${ContactForm()}</main>${PublicFooter()}`;
}

function ContactForm() {
  const contact = editableContentDefaults.contact;
  return `<form class="content-card content-form" data-content-form><label class="content-field"><span>${contact.fields.name}</span><input type="text"></label><label class="content-field"><span>${contact.fields.email}</span><input type="email"></label><label class="content-field"><span>${contact.fields.phone}</span><input type="tel"></label><label class="content-field"><span>${contact.fields.subject}</span><input type="text"></label><label class="content-field"><span>${contact.fields.category}</span><select>${contact.categories.map((category) => `<option>${category}</option>`).join("")}</select></label><label class="content-field"><span>${contact.fields.message}</span><textarea></textarea></label><div class="content-message" data-content-success>${editableContentDefaults.labels.messagePrepared}</div><div class="content-actions"><button class="btn btn-primary" type="submit">${editableContentDefaults.actions.sendMessage}</button></div></form>`;
}

function SafetyPage() {
  return LegalPageLayout(editableContentDefaults.publicPages.securite);
}

function PublishingRulesPage() {
  return LegalPageLayout(editableContentDefaults.publicPages["regles-publication"]);
}

function AntiScamTipsPage() {
  return LegalPageLayout(editableContentDefaults.publicPages["conseils-anti-arnaque"]);
}

function SupportPage() {
  const support = editableContentDefaults.support;
  return `${PublicHeader()}<main class="content-main"><section class="content-hero"><h1>${support.title}</h1><p>${support.subtitle}</p></section>${supportTickets.length ? SupportTable() : EmptySupportState()}<div class="support-actions"><a class="btn btn-primary" href="${contentRouteHref(contentRoutes.contact)}">${editableContentDefaults.actions.createRequest}</a></div></main>${PublicFooter()}`;
}

function SupportTicketDetailPage() {
  const support = editableContentDefaults.support;
  return `${PublicHeader()}<main class="content-main"><section class="support-card"><h1>${editableContentDefaults.labels.supportNotFound}</h1><p>${editableContentDefaults.labels.noSupportTicketLoaded}</p><label class="content-field"><span>${support.detailReplyLabel}</span><textarea></textarea></label><div class="support-actions"><button class="btn btn-primary" type="button">${editableContentDefaults.actions.reply}</button><button class="btn btn-light" type="button">${editableContentDefaults.actions.markResolved}</button><a class="btn btn-ghost" href="${contentRouteHref(contentRoutes.support)}">${editableContentDefaults.actions.backToSupport}</a></div></section></main>${PublicFooter()}`;
}

function SupportStatusBadge(status) {
  return `<span class="support-status-badge">${getSupportStatusLabel(status)}</span>`;
}

function EmptySupportState() {
  return `<section class="content-empty-state"><h2>${editableContentDefaults.labels.noSupportTickets}</h2></section>`;
}

function AdminContentLayout(content, currentPage, title, subtitle) {
  const labels = editableContentDefaults.labels;
  const nav = editableContentDefaults.admin.nav;
  return `<div class="content-admin-shell"><aside class="admin-sidebar"><div class="dashboard-brand"><span>P</span><div><strong>${labels.brand}</strong><small>${labels.adminHeaderSubtitle}</small></div></div><nav class="admin-nav">${nav.map((item) => `<a href="${contentRouteHref(item.href)}"${item.key === currentPage ? ' aria-current="page"' : ""}><span>${item.label}</span><span class="notification-badge">0</span></a>`).join("")}</nav></aside><main class="content-admin-main"><header class="content-admin-header"><div><h1>${title}</h1><p>${subtitle}</p></div><a class="btn btn-ghost" href="${contentRouteHref(contentRoutes.adminContent)}">${editableContentDefaults.actions.content}</a></header>${content}</main></div>`;
}

function AdminContentDashboard() {
  const admin = editableContentDefaults.admin;
  const cards = admin.dashboardCards.map((card) => `<article class="admin-content-card"><h2>${card.title}</h2><p>${editableContentDefaults.labels.dashboardEmptyMetrics}</p><a class="btn btn-light" href="${contentRouteHref(card.href)}">${editableContentDefaults.actions.manage}</a></article>`).join("");
  return AdminContentLayout(`<section class="admin-content-grid">${cards}</section>`, "dashboard", admin.dashboardTitle, admin.dashboardSubtitle);
}

function AdminContentPagesList() {
  const pages = Object.keys(editableContentDefaults.pageSlugLabels);
  const rows = pages.map((slug) => [getPageSlugLabel(slug), slug, getContentStatusLabel("draft"), "", "", `<a href="${contentRouteHref(buildAdminEditContentUrl(slug))}">${editableContentDefaults.actions.edit}</a>`]);
  return AdminContentLayout(AdminTable(["Titre", "Slug", "Statut", "Dernière modification", "Admin", "Actions"], rows), "pages", editableContentDefaults.admin.pagesTitle, editableContentDefaults.admin.pagesSubtitle);
}

function AdminContentPageEditor() {
  const admin = editableContentDefaults.admin;
  const actions = editableContentDefaults.actions;
  return AdminContentLayout(`<form class="admin-content-card admin-editor" data-content-form>${ContentSectionEditor()}${ContentSectionList()}${ContentPreview()}${ContentVersionHistory()}<div class="content-message" data-content-success>${editableContentDefaults.labels.contentUpdated}</div><div class="admin-content-actions"><button class="btn btn-light" type="submit">${actions.saveDraft}</button><button class="btn btn-primary" type="submit">${actions.publish}</button><button class="btn btn-ghost" type="button">${actions.preview}</button><button class="btn btn-ghost" type="button">${actions.cancel}</button><button class="btn btn-ghost" type="button">${actions.restorePreviousVersion}</button></div></form>`, "pages", admin.editorTitle, admin.editorSubtitle);
}

function ContentSectionEditor() {
  const admin = editableContentDefaults.admin;
  return `<section class="admin-content-card"><h2>${admin.sectionTitle}</h2><label class="content-field"><span>Titre SEO</span><input type="text"></label><label class="content-field"><span>Description SEO</span><textarea></textarea></label><label class="content-field"><span>Titre visible</span><input type="text"></label><label class="content-field"><span>Sous-titre visible</span><input type="text"></label><label class="content-field"><span>Contenu principal</span><textarea></textarea></label><label class="content-field"><span>Statut</span><select><option>${getContentStatusLabel("draft")}</option><option>${getContentStatusLabel("published")}</option><option>${getContentStatusLabel("unpublished")}</option><option>${getContentStatusLabel("needs_review")}</option></select></label></section>`;
}

function ContentSectionList() {
  const admin = editableContentDefaults.admin;
  return `<section class="admin-content-card"><h2>${admin.sectionListTitle}</h2><p>${admin.sectionListEmpty}</p></section>`;
}

function ContentPreview() {
  return `<section class="admin-content-card"><h2>${editableContentDefaults.admin.previewTitle}</h2><p>${editableContentDefaults.labels.emptyContent}</p></section>`;
}

function ContentStatusBadge(status) {
  return `<span class="content-status-badge">${getContentStatusLabel(status)}</span>`;
}

function ContentVersionHistory() {
  const admin = editableContentDefaults.admin;
  return `<section class="admin-content-card"><h2>${admin.versionHistoryTitle}</h2><p>${admin.noVersions}</p></section>`;
}

function FaqAdminPage() {
  const config = editableContentDefaults.adminPages.faq;
  return GenericContentAdminPage(config.key, config.title, config.columns, faqItems, config.empty);
}

function FaqEditor() {
  return ContentSectionEditor();
}

function SecurityTipsAdminPage() {
  const config = editableContentDefaults.adminPages.security;
  return GenericContentAdminPage(config.key, config.title, config.columns, safetyTips, config.empty);
}

function PublishingRulesAdminPage() {
  const config = editableContentDefaults.adminPages.rules;
  return GenericContentAdminPage(config.key, config.title, config.columns, publishingRules, config.empty);
}

function AntiScamAdminPage() {
  const config = editableContentDefaults.adminPages.antiScam;
  return GenericContentAdminPage(config.key, config.title, config.columns, antiScamTips, config.empty);
}

function SupportCategoriesAdminPage() {
  const config = editableContentDefaults.adminPages.categories;
  return GenericContentAdminPage(config.key, config.title, config.columns, supportCategories, config.empty);
}

function FooterLinksAdminPage() {
  const config = editableContentDefaults.adminPages.footer;
  return GenericContentAdminPage(config.key, config.title, config.columns, footerLinks, config.empty);
}

function AdminSupportPage() {
  const config = editableContentDefaults.adminPages.support;
  return GenericContentAdminPage(config.key, config.title, config.columns, supportTickets, config.empty);
}

function AdminSupportTicketDetailPage() {
  const admin = editableContentDefaults.admin;
  const actions = editableContentDefaults.actions;
  return AdminContentLayout(`<section class="admin-content-card"><h2>Ticket support</h2><p>${editableContentDefaults.labels.noAdminSupportTicketLoaded}</p><label class="content-field"><span>${admin.internalNote}</span><textarea></textarea></label><label class="content-field"><span>${admin.response}</span><textarea></textarea></label><div class="admin-content-actions"><button class="btn btn-primary" type="button">${actions.reply}</button><button class="btn btn-light" type="button">${actions.addInternalNote}</button><button class="btn btn-light" type="button">${actions.changeStatus}</button><button class="btn btn-light" type="button">${actions.assignAdmin}</button><button class="btn btn-light" type="button">${actions.markResolved}</button><button class="btn btn-ghost" type="button">${actions.close}</button></div></section>`, "support", admin.supportDetailTitle, admin.supportDetailSubtitle);
}

function SupportPriorityBadge(priority) {
  return `<span class="support-priority-badge">${getSupportPriorityLabel(priority)}</span>`;
}

function ContentEmptyState(title = editableContentDefaults.labels.emptyContent) {
  return `<section class="content-empty-state"><h2>${title}</h2></section>`;
}

function GenericContentAdminPage(currentPage, title, columns, items, emptyTitle) {
  const actions = editableContentDefaults.actions;
  return AdminContentLayout(`<section class="content-filter-row"><button class="btn btn-primary" type="button">${actions.add}</button><button class="btn btn-light" type="button">${actions.edit}</button><button class="btn btn-light" type="button">${actions.publish}</button><button class="btn btn-light" type="button">${actions.unpublish}</button><button class="btn btn-ghost" type="button">${actions.reorder}</button></section>${items.length ? AdminTable(columns, items) : ContentEmptyState(emptyTitle)}`, currentPage, title, editableContentDefaults.labels.adminReady);
}

function AdminTable(columns, items) {
  return `<section class="content-table-shell"><div class="content-scroll"><table class="content-table"><thead><tr>${columns.map((column) => `<th>${column}</th>`).join("")}</tr></thead><tbody>${items.map((item) => `<tr>${columns.map((_, index) => `<td>${Array.isArray(item) ? item[index] || "" : ""}</td>`).join("")}</tr>`).join("")}</tbody></table></div></section>`;
}

function SupportTable() {
  return AdminTable(["Sujet", "Catégorie", "Statut", "Date", "Dernière réponse", "Actions"], supportTickets);
}

function renderContentPage() {
  const root = document.querySelector("#content-root");
  if (!root) return;
  const page = document.body.dataset.contentPage;
  const pages = {
    conditions: TermsPage,
    privacy: PrivacyPage,
    legalNotice: LegalNoticePage,
    help: HelpCenterPage,
    contact: ContactPage,
    security: SafetyPage,
    publishingRules: PublishingRulesPage,
    antiScam: AntiScamTipsPage,
    support: SupportPage,
    supportDetail: SupportTicketDetailPage,
    adminContent: AdminContentDashboard,
    adminPages: AdminContentPagesList,
    adminPageEdit: AdminContentPageEditor,
    adminFaq: FaqAdminPage,
    adminSecurityTips: SecurityTipsAdminPage,
    adminPublishingRules: PublishingRulesAdminPage,
    adminAntiScam: AntiScamAdminPage,
    adminSupportCategories: SupportCategoriesAdminPage,
    adminFooterLinks: FooterLinksAdminPage,
    adminSupport: AdminSupportPage,
    adminSupportDetail: AdminSupportTicketDetailPage
  };
  root.innerHTML = (pages[page] || HelpCenterPage)();
  document.querySelectorAll("[data-content-form]").forEach((form) => form.addEventListener("submit", (event) => {
    event.preventDefault();
    form.querySelector("[data-content-success]")?.classList.add("is-visible");
  }));
}

document.addEventListener("DOMContentLoaded", renderContentPage);

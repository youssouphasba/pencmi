const billingPlans = [];
const advertiserSubscriptions = [];
const listingBoosts = [];
const sponsoredListings = [];
const billingInvoices = [];
const paymentMethods = [];
const billingUsage = null;
const promotions = [];
const monetizationSettings = null;

const editableMonetizationDefaults = {
  labels: {
    comingSoonTitle: "Paiement non activé pour le moment.",
    comingSoonText: "Cette option sera disponible prochainement.",
    billingTitle: "Mon abonnement et mes options",
    billingSubtitle: "Gérez votre visibilité, vos annonces sponsorisées et vos options premium.",
    emptyPaidOptions: "Aucune option payante active pour le moment.",
    noInvoices: "Aucune facture disponible pour le moment.",
    noPaymentMethods: "Aucun moyen de paiement enregistré.",
    noUsage: "Aucune donnée d’utilisation disponible pour le moment.",
    noSubscription: "Aucun abonnement actif.",
    noBoosts: "Aucun boost actif.",
    noSponsored: "Aucune annonce sponsorisée active.",
    adminEmpty: "Aucune donnée de monétisation disponible pour le moment."
  },
  actions: {
    choosePlan: "Choisir ce plan",
    currentPlan: "Plan actuel",
    contactPencmi: "Contacter Péncmi",
    boostListing: "Booster cette annonce",
    addPaymentMethod: "Ajouter un moyen de paiement",
    manage: "Gérer",
    save: "Enregistrer",
    publish: "Publier",
    unpublish: "Dépublier",
    reorder: "Réordonner"
  },
  statusLabels: {
    draft: "Brouillon",
    active: "Active",
    inactive: "Inactive",
    archived: "Archivée",
    pending_payment: "En attente de paiement",
    scheduled: "Programmée",
    ended: "Terminée",
    cancelled: "Annulée",
    refused: "Refusée",
    pending_review: "En attente",
    suspended: "Suspendue",
    pending: "En attente",
    paid: "Payée",
    failed: "Échouée",
    refunded: "Remboursée",
    none: "Aucun"
  },
  routes: {
    billing: "/dashboard/billing",
    plans: "/dashboard/billing/plans",
    boosts: "/dashboard/billing/boosts",
    sponsored: "/dashboard/billing/sponsored",
    invoices: "/dashboard/billing/invoices",
    paymentMethods: "/dashboard/billing/payment-methods",
    usage: "/dashboard/billing/usage",
    settings: "/dashboard/billing/settings",
    admin: "/admin/monetization",
    adminPlans: "/admin/monetization/plans",
    adminBoosts: "/admin/monetization/boosts",
    adminSponsored: "/admin/monetization/sponsored",
    adminPricing: "/admin/monetization/pricing",
    adminInvoices: "/admin/monetization/invoices",
    adminPayments: "/admin/monetization/payments",
    adminPromotions: "/admin/monetization/promotions",
    adminSettings: "/admin/monetization/settings"
  },
  billingCards: [
    ["Mon plan", "/dashboard/billing/plans"],
    ["Booster une annonce", "/dashboard/billing/boosts"],
    ["Annonces sponsorisées", "/dashboard/billing/sponsored"],
    ["Factures", "/dashboard/billing/invoices"],
    ["Moyens de paiement", "/dashboard/billing/payment-methods"],
    ["Utilisation", "/dashboard/billing/usage"]
  ],
  adminCards: [
    ["Plans", "/admin/monetization/plans"],
    ["Boosts", "/admin/monetization/boosts"],
    ["Sponsorisation", "/admin/monetization/sponsored"],
    ["Prix", "/admin/monetization/pricing"],
    ["Factures", "/admin/monetization/invoices"],
    ["Paiements", "/admin/monetization/payments"],
    ["Promotions", "/admin/monetization/promotions"],
    ["Paramètres", "/admin/monetization/settings"]
  ],
  modules: ["Immobilier", "Hôtels", "Voitures", "Voyages"],
  visibilityAreas: ["Sénégal", "Région", "Département", "Ville", "Quartier"],
  boostGoals: ["Plus de vues", "Plus de contacts", "Mise en avant locale", "Visibilité rapide"],
  paymentProviders: ["Carte bancaire", "Wave", "Orange Money", "Free Money", "Virement bancaire", "Paiement manuel"],
  currencies: ["XOF", "EUR", "USD"],
  sponsoredBadge: "Sponsorisé",
  featuredBadge: "Mis en avant",
  proBadge: "Pro",
  premiumBadge: "Premium"
};

function monetizationEscape(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function billingRouteHref(path = "#") {
  if (typeof window === "undefined" || window.location.protocol !== "file:") return path;
  const depth = Number(document.body?.dataset?.routeDepth || "2");
  const prefix = "../".repeat(depth);
  const normalized = path.replace(/^\//, "");
  return `${prefix}${normalized}/`;
}

function getBillingPlanLabel(plan = {}) {
  return plan.name || editableMonetizationDefaults.labels.noSubscription;
}

function getBillingStatusLabel(status = "none") {
  return editableMonetizationDefaults.statusLabels[status] || editableMonetizationDefaults.statusLabels.none;
}

function getPaymentStatusLabel(status = "pending") {
  return editableMonetizationDefaults.statusLabels[status] || editableMonetizationDefaults.statusLabels.pending;
}

function formatCurrency(amount, currency = "XOF") {
  if (typeof amount !== "number") return "Prix administrable";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount);
}

function calculateBoostPrice({ durationDays = 0, basePrice } = {}) {
  if (typeof basePrice !== "number") return null;
  return durationDays * basePrice;
}

function calculateSubscriptionUsage({ activeListings = 0, maxActiveListings = 0 } = {}) {
  return { activeListings, maxActiveListings, remainingListings: Math.max(maxActiveListings - activeListings, 0) };
}

function buildBillingRoute(key = "billing") {
  return editableMonetizationDefaults.routes[key] || editableMonetizationDefaults.routes.billing;
}

function isPaidFeatureEnabled(settings = monetizationSettings, feature = "") {
  return Boolean(settings && settings[feature]);
}

function canAdvertiserUseFeature(subscription = null, feature = "") {
  return Boolean(subscription && subscription.status === "active" && feature);
}

function MonetizationStatusBadge(status = "draft") {
  return `<span class="monetization-status-badge monetization-status-${status}">${monetizationEscape(getBillingStatusLabel(status))}</span>`;
}

function InvoiceStatusBadge(status = "pending") {
  return `<span class="billing-status-badge billing-status-${status}">${monetizationEscape(getPaymentStatusLabel(status))}</span>`;
}

function SponsoredBadge(label = editableMonetizationDefaults.sponsoredBadge) {
  return `<span class="sponsored-badge">${monetizationEscape(label)}</span>`;
}

function BillingEmptyState(title = editableMonetizationDefaults.labels.adminEmpty) {
  return `<section class="billing-empty-state"><h2>${monetizationEscape(title)}</h2><p>${monetizationEscape(editableMonetizationDefaults.labels.comingSoonText)}</p></section>`;
}

function PaymentComingSoonModal() {
  return `<section class="billing-card" data-payment-coming-soon><h2>${editableMonetizationDefaults.labels.comingSoonTitle}</h2><p>${editableMonetizationDefaults.labels.comingSoonText}</p></section>`;
}

function BillingLayout(content, currentPage = "billing", title = editableMonetizationDefaults.labels.billingTitle, subtitle = editableMonetizationDefaults.labels.billingSubtitle) {
  const nav = editableMonetizationDefaults.billingCards;
  return `<div class="billing-shell"><main class="billing-main"><header class="billing-header"><div><h1>${monetizationEscape(title)}</h1><p>${monetizationEscape(subtitle)}</p></div><a class="ds-button ds-button-outline" href="${billingRouteHref("/dashboard")}">Dashboard</a></header><nav class="ds-cluster">${nav.map(([label, href]) => `<a class="ds-button ${href.endsWith(currentPage) ? "ds-button-primary" : "ds-button-outline"}" href="${billingRouteHref(href)}">${monetizationEscape(label)}</a>`).join("")}</nav>${content}</main></div>`;
}

function BillingDashboardPage() {
  const cards = editableMonetizationDefaults.billingCards.map(([label, href]) => `<article class="billing-card"><h2>${monetizationEscape(label)}</h2><p>0 donnée active. Les options payantes seront configurées plus tard.</p><a class="ds-button ds-button-outline" href="${billingRouteHref(href)}">${editableMonetizationDefaults.actions.manage}</a></article>`).join("");
  return BillingLayout(`<section class="billing-grid">${cards}</section>${BillingEmptyState(editableMonetizationDefaults.labels.emptyPaidOptions)}`, "billing");
}

function BillingPlanCard(plan = null) {
  if (!plan) return `<article class="billing-card"><h2>Plan administrable</h2><p>Les plans, prix, modules et limites seront définis depuis le back-office.</p><strong>${formatCurrency()}</strong><div class="ds-cluster"><button class="ds-button ds-button-primary" type="button" data-payment-action>${editableMonetizationDefaults.actions.choosePlan}</button><button class="ds-button ds-button-outline" type="button">${editableMonetizationDefaults.actions.contactPencmi}</button></div></article>`;
  return `<article class="billing-card"><h2>${monetizationEscape(plan.name)}</h2><p>${monetizationEscape(plan.description || "")}</p><strong>${formatCurrency(plan.price, plan.currency)}</strong><button class="ds-button ds-button-primary" type="button" data-payment-action>${editableMonetizationDefaults.actions.choosePlan}</button></article>`;
}

function BillingPlansPage() {
  const content = billingPlans.length ? billingPlans.map(BillingPlanCard).join("") : BillingPlanCard();
  return BillingLayout(`<section class="billing-plan-grid">${content}</section><div id="payment-modal-slot"></div>`, "plans", "Plans annonceur", "Comparez les plans et options disponibles plus tard.");
}

function BoostListingForm() {
  const options = (items) => items.map((item) => `<option>${monetizationEscape(item)}</option>`).join("");
  return `<form class="billing-form-card" data-payment-form><div class="billing-form-grid"><label class="content-field"><span>Module</span><select>${options(editableMonetizationDefaults.modules)}</select></label><label class="content-field"><span>Annonce</span><select><option>Aucune annonce chargée</option></select></label><label class="content-field"><span>Durée</span><select><option>Durée administrable</option></select></label><label class="content-field"><span>Zone de visibilité</span><select>${options(editableMonetizationDefaults.visibilityAreas)}</select></label><label class="content-field"><span>Objectif</span><select>${options(editableMonetizationDefaults.boostGoals)}</select></label><label class="content-field"><span>Budget futur</span><input type="text" placeholder="Prix administrable"></label></div><div class="ds-cluster"><button class="ds-button ds-button-primary" type="submit">${editableMonetizationDefaults.actions.boostListing}</button></div></form>`;
}

function BoostSummaryCard() {
  return `<article class="billing-card"><h2>Résumé du boost</h2><p>Annonce sélectionnée, durée, zone, prix estimé et dates seront affichés lorsque les données réelles seront disponibles.</p></article>`;
}

function BillingBoostsPage() {
  return BillingLayout(`${BoostListingForm()}${BoostSummaryCard()}<div id="payment-modal-slot"></div>`, "boosts", "Boosts d’annonces", "Préparez une mise en avant sans activer de paiement réel.");
}

function SponsoredListingCard(item = null) {
  if (!item) return `<article class="billing-card"><h2>Annonces sponsorisées</h2>${SponsoredBadge()}<p>${editableMonetizationDefaults.labels.noSponsored}</p></article>`;
  return `<article class="billing-card"><h2>${monetizationEscape(item.listingId)}</h2>${SponsoredBadge()}${MonetizationStatusBadge(item.status)}</article>`;
}

function SponsoredListingsPage() {
  const content = sponsoredListings.length ? sponsoredListings.map(SponsoredListingCard).join("") : SponsoredListingCard();
  return BillingLayout(`<section class="billing-grid">${content}</section>`, "sponsored", "Annonces sponsorisées", "Suivez les sponsorisations actives, programmées, terminées ou refusées.");
}

function InvoicesPage() {
  const columns = ["Numéro", "Date", "Montant", "Statut", "Type", "Téléchargement futur"];
  return BillingLayout(billingInvoices.length ? MonetizationTable(columns, billingInvoices) : BillingEmptyState(editableMonetizationDefaults.labels.noInvoices), "invoices", "Factures", "Aucune facture réelle n’est générée maintenant.");
}

function PaymentMethodsPage() {
  return BillingLayout(`<section class="billing-card"><h2>Moyens de paiement futurs</h2><p>${editableMonetizationDefaults.labels.noPaymentMethods}</p><div class="ds-cluster">${editableMonetizationDefaults.paymentProviders.map((provider) => MonetizationStatusBadge("draft") + `<span>${monetizationEscape(provider)}</span>`).join("")}</div><button class="ds-button ds-button-primary" type="button" data-payment-action>${editableMonetizationDefaults.actions.addPaymentMethod}</button></section><div id="payment-modal-slot"></div>`, "payment-methods", "Moyens de paiement", "Les paiements seront disponibles prochainement.");
}

function BillingUsagePage() {
  return BillingLayout(BillingEmptyState(editableMonetizationDefaults.labels.noUsage), "usage", "Utilisation", "Suivez les limites du plan et les options utilisées plus tard.");
}

function BillingSettingsPage() {
  return BillingLayout(BillingEmptyState("Aucun paramètre de facturation annonceur disponible pour le moment."), "settings", "Paramètres de facturation", "Préparez les préférences liées aux futures options payantes.");
}

function AdminMonetizationLayout(content, currentPage = "dashboard", title = "Monétisation", subtitle = "Structure frontend pour plans, boosts, sponsorisation, prix, factures, paiements et promotions.") {
  const nav = editableMonetizationDefaults.adminCards;
  return `<div class="monetization-admin-shell"><main class="monetization-admin-main"><header class="monetization-admin-header"><div><h1>${monetizationEscape(title)}</h1><p>${monetizationEscape(subtitle)}</p></div><a class="ds-button ds-button-outline" href="${billingRouteHref("/admin")}">Admin</a></header><nav class="ds-cluster">${nav.map(([label, href]) => `<a class="ds-button ${href.endsWith(currentPage) ? "ds-button-primary" : "ds-button-outline"}" href="${billingRouteHref(href)}">${monetizationEscape(label)}</a>`).join("")}</nav>${content}</main></div>`;
}

function AdminMonetizationDashboard() {
  const cards = editableMonetizationDefaults.adminCards.map(([label, href]) => `<article class="monetization-card"><h2>${monetizationEscape(label)}</h2><p>0 donnée réelle. Configuration future administrable.</p><a class="ds-button ds-button-outline" href="${billingRouteHref(href)}">${editableMonetizationDefaults.actions.manage}</a></article>`).join("");
  return AdminMonetizationLayout(`<section class="monetization-grid">${cards}</section>${BillingEmptyState(editableMonetizationDefaults.labels.adminEmpty)}`, "dashboard", "Vue d’ensemble monétisation", "Aucun revenu, paiement ou abonnement réel n’est affiché.");
}

function AdminBillingPlanEditor() {
  return `<section class="monetization-card"><h2>Éditeur de plan</h2><p>Nom, description, prix, devise, période, modules, limites, fonctionnalités et statut seront configurés ici.</p></section>`;
}

function AdminBillingPlansPage() {
  return AdminMonetizationLayout(`${AdminBillingPlanEditor()}${MonetizationAdminEmpty("Aucun plan créé pour le moment.")}`, "plans", "Plans", "Créez et organisez les plans sans figer les prix dans le code.");
}

function AdminBoostsConfigPage() {
  return AdminMonetizationLayout(MonetizationAdminEmpty("Aucune configuration de boost pour le moment."), "boosts", "Boosts", "Gérez durées, zones, modules, règles d’affichage et prix administrables.");
}

function AdminSponsoredListingsPage() {
  return AdminMonetizationLayout(MonetizationAdminEmpty("Aucune annonce sponsorisée pour le moment."), "sponsored", "Annonces sponsorisées", "Approuvez, refusez, suspendez ou prolongez les sponsorisations futures.");
}

function PricingEditor() {
  return `<section class="monetization-card"><h2>Éditeur de prix</h2><p>Plans, boosts, sponsorisations, devises, taxes futures, promotions et tarifs par zone seront administrables.</p></section>`;
}

function AdminPricingPage() {
  return AdminMonetizationLayout(PricingEditor(), "pricing", "Prix", "Configurez les prix sans paiement réel.");
}

function AdminInvoicesPage() {
  return AdminMonetizationLayout(MonetizationAdminEmpty("Aucune facture disponible pour le moment."), "invoices", "Factures", "Structure de facturation future.");
}

function AdminPaymentsPage() {
  return AdminMonetizationLayout(MonetizationAdminEmpty("Aucun paiement disponible pour le moment."), "payments", "Paiements", "Stripe, Wave, Orange Money, Free Money, PayDunya, CinetPay, Flutterwave, virement et paiement manuel sont seulement prévus.");
}

function PromotionEditor() {
  return `<section class="monetization-card"><h2>Éditeur promotion</h2><p>Nom, code, type, valeur, dates, modules, plans et statut seront administrables.</p></section>`;
}

function AdminPromotionsPage() {
  return AdminMonetizationLayout(`${PromotionEditor()}${MonetizationAdminEmpty("Aucune promotion disponible pour le moment.")}`, "promotions", "Promotions", "Préparez les remises, périodes gratuites et boosts offerts.");
}

function AdminMonetizationSettingsPage() {
  return AdminMonetizationLayout(`<section class="monetization-card"><h2>Paramètres monétisation</h2><p>Activation abonnements, boosts, sponsorisation, factures, paiements en ligne, paiement manuel, devise par défaut et pays cible.</p></section>`, "settings", "Paramètres", "Contrôlez les fonctionnalités payantes futures.");
}

function MonetizationAdminEmpty(title) {
  return `<section class="billing-empty-state"><h2>${monetizationEscape(title)}</h2><p>${monetizationEscape(editableMonetizationDefaults.labels.comingSoonText)}</p></section>`;
}

function MonetizationTable(columns = [], rows = []) {
  return `<section class="monetization-table-shell"><table class="monetization-table"><thead><tr>${columns.map((column) => `<th>${monetizationEscape(column)}</th>`).join("")}</tr></thead><tbody>${rows.map(() => `<tr>${columns.map(() => "<td></td>").join("")}</tr>`).join("")}</tbody></table></section>`;
}

function renderMonetizationPage() {
  const root = document.querySelector("#monetization-root");
  if (!root) return;
  const page = document.body.dataset.billingPage || document.body.dataset.adminMonetizationPage || "billing";
  const pages = {
    billing: BillingDashboardPage,
    plans: BillingPlansPage,
    boosts: BillingBoostsPage,
    sponsored: SponsoredListingsPage,
    invoices: InvoicesPage,
    paymentMethods: PaymentMethodsPage,
    usage: BillingUsagePage,
    settings: BillingSettingsPage,
    adminDashboard: AdminMonetizationDashboard,
    adminPlans: AdminBillingPlansPage,
    adminBoosts: AdminBoostsConfigPage,
    adminSponsored: AdminSponsoredListingsPage,
    adminPricing: AdminPricingPage,
    adminInvoices: AdminInvoicesPage,
    adminPayments: AdminPaymentsPage,
    adminPromotions: AdminPromotionsPage,
    adminSettings: AdminMonetizationSettingsPage
  };
  root.innerHTML = (pages[page] || BillingDashboardPage)();
  document.querySelectorAll("[data-payment-action], [data-payment-form]").forEach((node) => node.addEventListener("click", (event) => {
    if (node.matches("form")) return;
    event.preventDefault();
    const slot = document.querySelector("#payment-modal-slot");
    if (slot) slot.innerHTML = PaymentComingSoonModal();
  }));
  document.querySelectorAll("[data-payment-form]").forEach((form) => form.addEventListener("submit", (event) => {
    event.preventDefault();
    const slot = document.querySelector("#payment-modal-slot");
    if (slot) slot.innerHTML = PaymentComingSoonModal();
  }));
}

document.addEventListener("DOMContentLoaded", renderMonetizationPage);

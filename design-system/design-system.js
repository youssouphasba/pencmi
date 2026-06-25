const designSystemColors = {
  primary: "#1D4ED8",
  primaryDark: "#0F172A",
  primaryLight: "#DBEAFE",
  background: "#F8FAFC",
  surface: "#FFFFFF",
  border: "#E2E8F0",
  text: "#0F172A",
  textMuted: "#64748B",
  success: "#16A34A",
  successLight: "#DCFCE7",
  warning: "#F59E0B",
  warningLight: "#FEF3C7",
  danger: "#DC2626",
  dangerLight: "#FEE2E2",
  info: "#0284C7",
  infoLight: "#E0F2FE"
};

const designSystemTypography = {
  h1: "ds-page-title",
  h2: "ds-section-title",
  h3: "ds-card-title",
  body: "ds-body",
  small: "ds-small",
  label: "ds-label"
};

const colors = designSystemColors;
const typography = designSystemTypography;

const editableDesignSystemLabels = {
  brandName: "Péncmi",
  brandDescription: "Portail pour immobilier, hôtels, voitures et voyages interurbains.",
  menu: "Menu",
  close: "Fermer",
  login: "Se connecter",
  register: "Créer mon espace",
  publish: "Publier une annonce",
  allNotifications: "Voir toutes les notifications",
  markAllRead: "Tout marquer comme lu",
  notifications: "Notifications",
  noNotifications: "Aucune notification pour le moment.",
  requiredField: "Ce champ est obligatoire.",
  invalidEmail: "Veuillez renseigner une adresse email valide.",
  invalidPhone: "Veuillez renseigner un numéro de téléphone valide.",
  invalidForm: "Veuillez vérifier les informations saisies.",
  error: "Une erreur est survenue.",
  notFound: "Page introuvable.",
  unauthorized: "Accès non autorisé.",
  forbidden: "Vous devez être connecté pour accéder à cette page.",
  safetyTitle: "Conseils de sécurité"
};

const publicNavigation = [
  { label: "Immobilier", href: "/immobilier" },
  { label: "Hôtels", href: "/hotels" },
  { label: "Voitures", href: "/voitures" },
  { label: "Voyages", href: "/voyages" }
];

const legalNavigation = [
  { label: "Conditions d’utilisation", href: "/conditions" },
  { label: "Confidentialité", href: "/confidentialite" },
  { label: "Mentions légales", href: "/mentions-legales" },
  { label: "Aide", href: "/aide" },
  { label: "Sécurité", href: "/securite" },
  { label: "Contact", href: "/contact" }
];

const footerNavigation = [
  {
    title: "Services",
    links: [
      { label: "Immobilier", href: "/immobilier" },
      { label: "Hôtels & Auberges", href: "/hotels" },
      { label: "Voitures", href: "/voitures" },
      { label: "Voyages interurbains", href: "/voyages" }
    ]
  },
  {
    title: "Espace utilisateur",
    links: [
      { label: "Se connecter", href: "/login" },
      { label: "Créer un compte", href: "/register" },
      { label: "Publier une annonce", href: "/login?next=/publier" },
      { label: "Mes favoris", href: "/compte/favoris" },
      { label: "Aide", href: "/aide" }
    ]
  },
  {
    title: "Légal et sécurité",
    links: [
      { label: "Conditions d’utilisation", href: "/conditions" },
      { label: "Confidentialité", href: "/confidentialite" },
      { label: "Mentions légales", href: "/mentions-legales" },
      { label: "Sécurité", href: "/securite" },
      { label: "Conseils anti-arnaque", href: "/conseils-anti-arnaque" },
      { label: "Contact", href: "/contact" }
    ]
  }
];

const statusLabels = {
  active: { label: "Actif", variant: "success" },
  pending_review: { label: "En attente", variant: "pending" },
  suspended: { label: "Suspendu", variant: "danger" },
  expired: { label: "Expiré", variant: "inactive" },
  deleted: { label: "Supprimé", variant: "danger" },
  draft: { label: "Brouillon", variant: "neutral" },
  verified: { label: "Vérifié", variant: "verified" },
  refused: { label: "Refusé", variant: "danger" },
  new: { label: "Nouveau", variant: "info" },
  read: { label: "Lu", variant: "neutral" },
  replied: { label: "Répondu", variant: "success" },
  closed: { label: "Clôturé", variant: "inactive" },
  full: { label: "Complet", variant: "warning" },
  available: { label: "Disponible", variant: "success" },
  unavailable: { label: "Indisponible", variant: "inactive" },
  needs_improvement: { label: "À améliorer", variant: "warning" }
};

function dsEscape(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function dsRouteHref(path = "#") {
  if (window.PencmiConfig?.routeHref) return window.PencmiConfig.routeHref(path);
  if (typeof window === "undefined" || window.location.protocol !== "file:") return path;
  const depth = Number(document.body?.dataset?.routeDepth || "1");
  const prefix = "../".repeat(depth);
  const routes = {
    "/": `${prefix}index.html`,
    "/immobilier": `${prefix}immobilier/`,
    "/hotels": `${prefix}hotels/`,
    "/voitures": `${prefix}voitures/`,
    "/voyages": `${prefix}voyages/`,
    "/login": `${prefix}login/`,
    "/register": `${prefix}register/`,
    "/aide": `${prefix}aide/`,
    "/conditions": `${prefix}conditions/`,
    "/confidentialite": `${prefix}confidentialite/`,
    "/mentions-legales": `${prefix}mentions-legales/`,
    "/securite": `${prefix}securite/`,
    "/conseils-anti-arnaque": `${prefix}conseils-anti-arnaque/`,
    "/contact": `${prefix}contact/`,
    "/compte/favoris": `${prefix}compte/favoris/`,
    "/dashboard/notifications": `${prefix}dashboard/notifications/`,
    "/compte/notifications": `${prefix}compte/notifications/`
  };
  if (path.startsWith("/login?next=/publier")) return `${prefix}login/?next=/publier`;
  return routes[path] || path;
}

function Button({ label = "", href = "", type = "button", variant = "primary", size = "md", fullWidth = false, disabled = false, loading = false, attributes = "" } = {}) {
  const classes = ["ds-button", `ds-button-${variant}`, size !== "md" ? `ds-button-${size}` : "", fullWidth ? "ds-button-full" : ""].filter(Boolean).join(" ");
  const content = loading ? `${dsEscape(label)}...` : dsEscape(label);
  if (href) return `<a class="${classes}" href="${dsRouteHref(href)}"${disabled ? ' aria-disabled="true"' : ""} ${attributes}>${content}</a>`;
  return `<button class="${classes}" type="${type}"${disabled ? " disabled" : ""} ${attributes}>${content}</button>`;
}

function Card({ title = "", description = "", content = "", actions = "", variant = "" } = {}) {
  return `<article class="ds-card ds-card-lg ${variant ? `ds-card-${variant}` : ""}">${title ? `<h2 class="ds-section-title">${dsEscape(title)}</h2>` : ""}${description ? `<p class="ds-muted">${dsEscape(description)}</p>` : ""}${content}${actions ? `<div class="ds-cluster">${actions}</div>` : ""}</article>`;
}

function Badge({ label = "", variant = "neutral" } = {}) {
  return `<span class="ds-badge ds-badge-${variant}">${dsEscape(label)}</span>`;
}

function StatusBadge(status = "draft") {
  const option = statusLabels[status] || statusLabels.draft;
  return Badge(option);
}

function Input({ label = "", name = "", type = "text", placeholder = "", value = "", help = "", required = false } = {}) {
  return `<label class="content-field"><span>${dsEscape(label)}</span><input name="${dsEscape(name)}" type="${dsEscape(type)}" placeholder="${dsEscape(placeholder)}" value="${dsEscape(value)}"${required ? " required" : ""}>${help ? `<small class="ds-muted">${dsEscape(help)}</small>` : ""}</label>`;
}

function Textarea({ label = "", name = "", placeholder = "", value = "", help = "", required = false } = {}) {
  return `<label class="content-field"><span>${dsEscape(label)}</span><textarea name="${dsEscape(name)}" placeholder="${dsEscape(placeholder)}"${required ? " required" : ""}>${dsEscape(value)}</textarea>${help ? `<small class="ds-muted">${dsEscape(help)}</small>` : ""}</label>`;
}

function Select({ label = "", name = "", options = [], value = "", required = false } = {}) {
  return `<label class="content-field"><span>${dsEscape(label)}</span><select name="${dsEscape(name)}"${required ? " required" : ""}>${options.map((option) => `<option value="${dsEscape(option.value || option)}"${(option.value || option) === value ? " selected" : ""}>${dsEscape(option.label || option)}</option>`).join("")}</select></label>`;
}

function Checkbox({ label = "", name = "", checked = false } = {}) {
  return `<label class="ds-cluster"><input type="checkbox" name="${dsEscape(name)}"${checked ? " checked" : ""}><span>${dsEscape(label)}</span></label>`;
}

function RadioGroup({ legend = "", name = "", options = [], value = "" } = {}) {
  return `<fieldset class="content-field"><legend>${dsEscape(legend)}</legend>${options.map((option) => `<label class="ds-cluster"><input type="radio" name="${dsEscape(name)}" value="${dsEscape(option.value || option)}"${(option.value || option) === value ? " checked" : ""}><span>${dsEscape(option.label || option)}</span></label>`).join("")}</fieldset>`;
}

function Switch({ label = "", name = "", checked = false } = {}) {
  return `<label class="ds-cluster"><input type="checkbox" role="switch" name="${dsEscape(name)}"${checked ? " checked" : ""}><span>${dsEscape(label)}</span></label>`;
}

function FormSection({ title = "", description = "", content = "" } = {}) {
  return Card({ title, description, content, variant: "form-section" });
}

function FormStepper({ steps = [], currentStep = 0 } = {}) {
  return `<ol class="ds-cluster">${steps.map((step, index) => `<li>${Badge({ label: step, variant: index === currentStep ? "info" : "neutral" })}</li>`).join("")}</ol>`;
}

function Modal({ title = "", content = "", actions = "", closeLabel = editableDesignSystemLabels.close } = {}) {
  return `<div class="ds-modal" role="dialog" aria-modal="true"><section class="ds-modal-panel"><header class="ds-modal-header"><h2>${dsEscape(title)}</h2><button class="ds-button ds-button-ghost" type="button">${dsEscape(closeLabel)}</button></header><div class="ds-modal-body">${content}</div>${actions ? `<footer class="ds-modal-actions">${actions}</footer>` : ""}</section></div>`;
}

function ConfirmModal({ title = "", message = "", confirmLabel = "Confirmer", cancelLabel = "Annuler", variant = "danger" } = {}) {
  return Modal({ title, content: `<p>${dsEscape(message)}</p>`, actions: `${Button({ label: cancelLabel, variant: "outline" })}${Button({ label: confirmLabel, variant })}` });
}

function Drawer({ title = "", content = "" } = {}) {
  return `<div class="ds-drawer"><aside class="ds-drawer-panel"><header class="ds-drawer-header"><h2>${dsEscape(title)}</h2><button class="ds-button ds-button-ghost" type="button">${editableDesignSystemLabels.close}</button></header><div class="ds-drawer-body">${content}</div></aside></div>`;
}

function DataTable({ columns = [], rows = [] } = {}) {
  return `<section class="ds-table-shell"><table class="ds-table"><thead><tr>${columns.map((column) => `<th>${dsEscape(column)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map((_, index) => `<td>${dsEscape(row[index] || "")}</td>`).join("")}</tr>`).join("")}</tbody></table></section>`;
}

function ResponsiveTableCard({ title = "", rows = [] } = {}) {
  return Card({ title, content: `<dl>${rows.map(([label, value]) => `<div><dt>${dsEscape(label)}</dt><dd>${dsEscape(value)}</dd></div>`).join("")}</dl>` });
}

function EmptyState({ title = "", description = "", primaryActionLabel = "", primaryActionHref = "", secondaryActionLabel = "", secondaryActionHref = "" } = {}) {
  const actions = `${primaryActionLabel ? Button({ label: primaryActionLabel, href: primaryActionHref }) : ""}${secondaryActionLabel ? Button({ label: secondaryActionLabel, href: secondaryActionHref, variant: "outline" }) : ""}`;
  return `<section class="ds-empty-state"><h2>${dsEscape(title)}</h2>${description ? `<p class="ds-muted">${dsEscape(description)}</p>` : ""}${actions ? `<div class="ds-cluster">${actions}</div>` : ""}</section>`;
}

function ErrorState({ title = editableDesignSystemLabels.error, description = "" } = {}) {
  return EmptyState({ title, description });
}

function NotFoundState({ title = editableDesignSystemLabels.notFound, description = "" } = {}) {
  return EmptyState({ title, description, primaryActionLabel: "Retour à l’accueil", primaryActionHref: "/" });
}

function UnauthorizedState({ title = editableDesignSystemLabels.unauthorized, description = "" } = {}) {
  return EmptyState({ title, description, primaryActionLabel: "Retour à l’accueil", primaryActionHref: "/" });
}

function ForbiddenState({ title = editableDesignSystemLabels.forbidden, description = "" } = {}) {
  return EmptyState({ title, description, primaryActionLabel: editableDesignSystemLabels.login, primaryActionHref: "/login" });
}

function NotificationBadge(count = 0) {
  return count > 0 ? `<span class="notification-badge">${count}</span>` : "";
}

function NotificationBell({ count = 0, href = "/dashboard/notifications" } = {}) {
  return `<a class="ds-button ds-button-outline" href="${dsRouteHref(href)}" aria-label="${editableDesignSystemLabels.notifications}"><span aria-hidden="true">!</span>${NotificationBadge(count)}</a>`;
}

function NotificationDropdown({ notifications = [], href = "/dashboard/notifications" } = {}) {
  return `<section class="ds-card"><h2>${editableDesignSystemLabels.notifications}</h2>${notifications.length ? notifications.map(NotificationItem).join("") : `<p class="ds-muted">${editableDesignSystemLabels.noNotifications}</p>`}<div class="ds-cluster">${Button({ label: editableDesignSystemLabels.markAllRead, variant: "outline" })}${Button({ label: editableDesignSystemLabels.allNotifications, href, variant: "link" })}</div></section>`;
}

function NotificationItem({ title = "", message = "", href = "" } = {}) {
  return `<a class="ds-card" href="${dsRouteHref(href || "#")}"><strong>${dsEscape(title)}</strong>${message ? `<p class="ds-muted">${dsEscape(message)}</p>` : ""}</a>`;
}

function DashboardSidebar({ items = [], currentHref = "" } = {}) {
  return `<aside class="dashboard-sidebar"><nav class="dashboard-nav">${items.map((item) => `<a href="${dsRouteHref(item.href)}"${item.href === currentHref || item.active ? ' aria-current="page"' : ""}><span>${dsEscape(item.label)}</span>${DashboardSidebarBadge(item.badgeCount || 0)}</a>`).join("")}</nav></aside>`;
}

function KpiCard({ label = "", value = "0", description = "" } = {}) {
  return `<article class="kpi-card"><span>${dsEscape(label)}</span><strong class="admin-kpi-value">${dsEscape(value)}</strong>${description ? `<p>${dsEscape(description)}</p>` : ""}</article>`;
}

function SearchHero({ title = "", subtitle = "", content = "" } = {}) {
  return `<section class="hero"><div class="hero-content"><h1>${dsEscape(title)}</h1>${subtitle ? `<p class="hero-subtitle">${dsEscape(subtitle)}</p>` : ""}${content}</div></section>`;
}

function SearchBar({ fields = [], buttonLabel = "Rechercher" } = {}) {
  return `<form class="search-card">${fields.map((field) => Input(field)).join("")}${Button({ label: buttonLabel, type: "submit" })}</form>`;
}

function SearchFilters({ title = "Filtres", content = "", actions = "" } = {}) {
  return `<aside class="ds-card ds-search-filters"><h2 class="ds-card-title">${dsEscape(title)}</h2>${content}${actions ? `<div class="ds-cluster">${actions}</div>` : ""}</aside>`;
}

function ListingCard({ title = "", subtitle = "", meta = [], badges = [], actions = "", href = "" } = {}) {
  const body = `<article class="ds-card ds-listing-card">${badges.length ? `<div class="ds-cluster">${badges.map((badge) => Badge(badge)).join("")}</div>` : ""}<h2 class="ds-card-title">${dsEscape(title)}</h2>${subtitle ? `<p class="ds-muted">${dsEscape(subtitle)}</p>` : ""}${meta.length ? `<dl class="ds-listing-meta">${meta.map(([label, value]) => `<div><dt>${dsEscape(label)}</dt><dd>${dsEscape(value)}</dd></div>`).join("")}</dl>` : ""}${actions ? `<div class="ds-cluster">${actions}</div>` : ""}</article>`;
  return href ? `<a class="ds-listing-link" href="${dsRouteHref(href)}">${body}</a>` : body;
}

function ActiveFiltersBar({ filters = [] } = {}) {
  return `<div class="ds-cluster">${filters.map((filter) => Badge({ label: filter, variant: "info" })).join("")}</div>`;
}

function ContactButtons({ preferences = {}, labels = {} } = {}) {
  const buttons = [
    ["whatsappEnabled", labels.whatsapp || "WhatsApp", "success"],
    ["phoneEnabled", labels.phone || "Appeler", "primary"],
    ["emailEnabled", labels.email || "Email", "outline"],
    ["internalMessagingEnabled", labels.message || "Envoyer un message", "secondary"],
    ["visitRequestEnabled", labels.visit || "Demander une visite", "secondary"],
    ["reservationRequestEnabled", labels.reservation || "Demander une réservation", "secondary"],
    ["seatRequestEnabled", labels.seat || "Demander une place", "secondary"],
    ["rentalRequestEnabled", labels.rental || "Demander une location", "secondary"],
    ["chauffeurRequestEnabled", labels.chauffeur || "Demander un chauffeur", "secondary"]
  ];
  return `<div class="ds-cluster">${buttons.filter(([key]) => preferences[key]).map(([, label, variant]) => Button({ label, variant })).join("")}</div>`;
}

function SafetyTipsBox({ title = editableDesignSystemLabels.safetyTitle, tips = [] } = {}) {
  return `<aside class="ds-alert ds-alert-warning"><strong>${dsEscape(title)}</strong>${tips.length ? `<ul>${tips.map((tip) => `<li>${dsEscape(tip)}</li>`).join("")}</ul>` : ""}</aside>`;
}

function VerificationBadge({ verified = false, label = "Vérifié" } = {}) {
  return verified ? Badge({ label, variant: "verified" }) : "";
}

function PhotoGallery({ photos = [] } = {}) {
  return `<section class="ds-card">${photos.length ? photos.map((photo, index) => `<img src="${dsEscape(photo.src)}" alt="${dsEscape(photo.alt || `Photo ${index + 1}`)}">`).join("") : ImagePlaceholder({ label: "Aucune photo" })}</section>`;
}

function ImagePlaceholder({ label = "" } = {}) {
  return `<div class="ds-empty-state"><span>${dsEscape(label)}</span></div>`;
}

function SkeletonCard() {
  return `<div class="ds-card"><div class="ds-skeleton" style="height:140px"></div></div>`;
}

function SkeletonTable() {
  return `<div class="ds-table-shell"><div class="ds-skeleton" style="height:260px"></div></div>`;
}

function SkeletonPage() {
  return `<main class="ds-container ds-stack"><div class="ds-skeleton" style="height:64px"></div><div class="ds-skeleton" style="height:220px"></div><div class="ds-skeleton" style="height:140px"></div></main>`;
}

function MobileMenu({ items = publicNavigation } = {}) {
  return Drawer({ title: editableDesignSystemLabels.menu, content: `<nav class="ds-stack">${items.map((item) => `<a class="ds-button ds-button-ghost" href="${dsRouteHref(item.href)}">${dsEscape(item.label)}</a>`).join("")}</nav>` });
}

function PublicHeader({ navigation = publicNavigation } = {}) {
  return `<header class="ds-public-header site-header"><a class="brand" href="${dsRouteHref("/")}"><span class="brand-mark">P</span><span><strong>${editableDesignSystemLabels.brandName}</strong><small>${editableDesignSystemLabels.brandDescription}</small></span></a><nav class="main-nav">${navigation.map((item) => `<a href="${dsRouteHref(item.href)}">${dsEscape(item.label)}</a>`).join("")}</nav><div class="header-actions">${Button({ label: editableDesignSystemLabels.login, href: "/login", variant: "outline" })}${Button({ label: editableDesignSystemLabels.register, href: "/register", variant: "secondary" })}${Button({ label: editableDesignSystemLabels.publish, href: "/login?next=/publier" })}</div></header>`;
}

function PublicFooter({ columns = footerNavigation } = {}) {
  return `<footer class="content-footer"><div class="footer-grid"><div class="footer-brand"><strong>${editableDesignSystemLabels.brandName}</strong><p>${editableDesignSystemLabels.brandDescription}</p></div>${columns.map((column) => `<div class="footer-column"><h3>${dsEscape(column.title)}</h3>${column.links.map((item) => `<a href="${dsRouteHref(item.href)}">${dsEscape(item.label)}</a>`).join("")}</div>`).join("")}</div><div class="footer-bottom">© 2026 ${editableDesignSystemLabels.brandName}. Tous droits réservés.</div></footer>`;
}

function PublicLayout({ content = "" } = {}) {
  return `${PublicHeader()}<main>${content}</main>${PublicFooter()}`;
}

function SearchLayout({ hero = "", filters = "", results = "" } = {}) {
  return PublicLayout({ content: `${hero}<section class="ds-container"><div class="results-layout">${filters}${results}</div></section>` });
}

function ListingDetailLayout({ content = "", contact = "", safety = "" } = {}) {
  return PublicLayout({ content: `<section class="ds-container detail-layout"><div>${content}${safety}</div><aside>${contact}</aside></section>` });
}

function DashboardLayout({ sidebar = "", header = "", content = "" } = {}) {
  return `<div class="dashboard-shell">${sidebar}<main class="dashboard-main">${header}${content}</main></div>`;
}

function ClientAccountLayout(props = {}) {
  return DashboardLayout(props);
}

function AdminLayout(props = {}) {
  return DashboardLayout(props);
}

function LegalPageLayout({ title = "", subtitle = "", content = "" } = {}) {
  return PublicLayout({ content: `<section class="content-main ds-container-legal"><header class="content-hero"><h1>${dsEscape(title)}</h1>${subtitle ? `<p>${dsEscape(subtitle)}</p>` : ""}</header>${content}</section>` });
}

function AuthLayout({ content = "" } = {}) {
  return `<main class="auth-page"><section class="auth-main">${content}</section></main>`;
}

const DatePickerPlaceholder = Input;
const TimeInput = (props = {}) => Input({ ...props, type: "time" });
const PhoneInput = (props = {}) => Input({ ...props, type: "tel" });
const EmailInput = (props = {}) => Input({ ...props, type: "email" });
const FileUploadPlaceholder = (props = {}) => Input({ ...props, type: "file" });
const FormErrorMessage = (message = editableDesignSystemLabels.invalidForm) => `<p class="ds-alert ds-alert-danger">${dsEscape(message)}</p>`;
const LoadingButton = (props = {}) => Button({ ...props, loading: true, disabled: true });
const DrawerFilterButton = (label = "Filtres") => Button({ label, variant: "outline" });
const MobileFilterDrawer = Drawer;
const ContactModal = Modal;
const ReportModal = Modal;
const VisitRequestModal = Modal;
const ReservationRequestModal = Modal;
const TableToolbar = ({ content = "" } = {}) => `<div class="ds-cluster">${content}</div>`;
const TableFilters = ({ content = "" } = {}) => `<section class="ds-card">${content}</section>`;
const TablePagination = ({ content = "" } = {}) => `<nav class="ds-cluster">${content}</nav>`;
const SearchResultHeader = ({ title = "", actions = "" } = {}) => `<header class="dashboard-section-header"><h2>${dsEscape(title)}</h2>${actions}</header>`;
const SortSelect = (props = {}) => Select({ label: "Tri", ...props });
const FilterChip = (label = "") => Badge({ label, variant: "info" });
const PaginationPlaceholder = () => `<nav class="ds-cluster"></nav>`;
const ContactButton = Button;
const ContactPreferencesPreview = ContactButtons;
const MessageForm = ({ content = "" } = {}) => `<form class="ds-stack">${content}</form>`;
const PhoneDisplay = (phone = "") => `<span>${dsEscape(phone)}</span>`;
const WhatsappButton = (props = {}) => Button({ variant: "success", ...props });
const TrustBox = SafetyTipsBox;
const ReportButton = (props = {}) => Button({ label: "Signaler", variant: "warning", ...props });
const DashboardSidebarBadge = NotificationBadge;
const Avatar = ({ src = "", alt = "" } = {}) => src ? `<img class="ds-avatar" src="${dsEscape(src)}" alt="${dsEscape(alt)}">` : ImagePlaceholder({ label: alt });
const LogoPlaceholder = ImagePlaceholder;

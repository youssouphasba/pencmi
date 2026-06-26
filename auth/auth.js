const authState = {
  currentUser: null,
  professionalProfile: null,
};

const ACCESS_TOKEN_STORAGE_KEY = "pencmi_access_token";
const REFRESH_TOKEN_STORAGE_KEY = "pencmi_refresh_token";
const API_BASE_STORAGE_KEY = "pencmi_api_base_url";

const authRoutes = {
  home: "/",
  login: "/login",
  register: "/register",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  account: "/compte",
  accountProfile: "/compte/profil",
  accountSettings: "/compte/parametres",
  accountNotifications: "/compte/notifications",
  dashboard: "/dashboard",
  dashboardProfile: "/dashboard/profil",
  dashboardSettings: "/dashboard/settings",
  dashboardVerification: "/dashboard/verification",
  dashboardNotifications: "/dashboard/notifications",
  realEstateDashboard: "/dashboard/immobilier",
  hotelsDashboard: "/dashboard/hotels",
  vehiclesDashboard: "/dashboard/voitures",
  tripsDashboard: "/dashboard/voyages",
  publish: "/publier",
  admin: "/admin",
};

const roleLabels = {
  client: "Client",
  advertiser_individual: "Annonceur particulier",
  real_estate_agency: "Agence immobilière",
  hotel_manager: "Hôtel, auberge ou résidence",
  vehicle_renter: "Loueur de voitures",
  vehicle_dealer: "Garage automobile",
  chauffeur: "Chauffeur professionnel",
  transport_provider: "Transporteur",
  admin: "Admin Péncmi",
};

const permissionsByRole = {
  client: ["manage_messages", "manage_notifications"],
  advertiser_individual: ["publish_real_estate", "publish_vehicle", "publish_trip", "manage_messages", "manage_contacts", "manage_notifications"],
  real_estate_agency: ["publish_real_estate", "manage_real_estate", "manage_messages", "manage_contacts", "manage_notifications"],
  hotel_manager: ["publish_hotel", "manage_hotels", "manage_messages", "manage_contacts", "manage_notifications"],
  vehicle_renter: ["publish_vehicle", "manage_vehicles", "manage_messages", "manage_contacts", "manage_notifications"],
  vehicle_dealer: ["publish_vehicle", "manage_vehicles", "manage_messages", "manage_contacts", "manage_notifications"],
  chauffeur: ["publish_vehicle", "manage_vehicles", "manage_messages", "manage_contacts", "manage_notifications"],
  transport_provider: ["publish_trip", "manage_trips", "manage_messages", "manage_contacts", "manage_notifications"],
  admin: ["publish_real_estate", "publish_hotel", "publish_vehicle", "publish_trip", "manage_real_estate", "manage_hotels", "manage_vehicles", "manage_trips", "manage_messages", "manage_contacts", "manage_notifications", "access_admin"],
};

const protectedRoutes = {
  client: ["/compte", "/compte/profil", "/compte/messages", "/compte/favoris", "/compte/alertes", "/compte/notifications", "/compte/reservations", "/compte/visites", "/compte/locations", "/compte/chauffeur", "/compte/trajets", "/compte/parametres", "/compte/signalements"],
  advertiser: ["/dashboard", "/dashboard/immobilier", "/dashboard/hotels", "/dashboard/voitures", "/dashboard/voyages", "/dashboard/reports"],
  admin: ["/admin"],
};

function authRouteHref(path) {
  if (window.location.protocol !== "file:") return path;

  const depth = Number(document.body.dataset.routeDepth || "0");
  const prefix = depth ? "../".repeat(depth) : "./";
  const routes = {
    "/": `${prefix}index.html`,
    "/login": `${prefix}login/`,
    "/register": `${prefix}register/`,
    "/forgot-password": `${prefix}forgot-password/`,
    "/reset-password": `${prefix}reset-password/`,
    "/compte": `${prefix}compte/`,
    "/compte/profil": `${prefix}compte/profil/`,
    "/compte/parametres": `${prefix}compte/parametres/`,
    "/compte/notifications": `${prefix}compte/notifications/`,
    "/dashboard": `${prefix}dashboard/`,
    "/dashboard/profil": `${prefix}dashboard/profil/`,
    "/dashboard/settings": `${prefix}dashboard/settings/`,
    "/dashboard/verification": `${prefix}dashboard/verification/`,
    "/dashboard/notifications": `${prefix}dashboard/notifications/`,
    "/dashboard/immobilier": `${prefix}dashboard/immobilier/`,
    "/dashboard/hotels": `${prefix}dashboard/hotels/`,
    "/dashboard/voitures": `${prefix}dashboard/voitures/`,
    "/dashboard/voyages": `${prefix}dashboard/voyages/`,
    "/publier": `${prefix}publier/`,
    "/admin": `${prefix}admin/`,
  };

  if (path.startsWith("/login?")) return `${prefix}login/${path.slice("/login".length)}`;
  if (path.startsWith("/publier?")) return `${prefix}publier/${path.slice("/publier".length)}`;
  return routes[path] || path;
}

function getNextParam() {
  return new URLSearchParams(window.location.search).get("next");
}

function getRedirectAfterLogin(role = "client", next = getNextParam()) {
  return next || getDashboardRouteByRole(role);
}

function getDashboardRouteByRole(role) {
  const routesByRole = {
    client: authRoutes.account,
    advertiser_individual: authRoutes.dashboard,
    real_estate_agency: authRoutes.realEstateDashboard,
    hotel_manager: authRoutes.hotelsDashboard,
    vehicle_renter: authRoutes.vehiclesDashboard,
    vehicle_dealer: authRoutes.vehiclesDashboard,
    chauffeur: authRoutes.vehiclesDashboard,
    transport_provider: authRoutes.tripsDashboard,
    admin: authRoutes.admin,
  };

  return routesByRole[role] || authRoutes.account;
}

function getPermissionsForRole(role) {
  return permissionsByRole[role] || [];
}

function hasPermission(role, permission) {
  return getPermissionsForRole(role).includes(permission);
}

function buildLoginRedirect(path = window.location.pathname) {
  return `${authRoutes.login}?next=${encodeURIComponent(path)}`;
}

function getRouteAccessType(path = window.location.pathname) {
  if (protectedRoutes.client.some((route) => path.startsWith(route))) return "client";
  if (protectedRoutes.advertiser.some((route) => path.startsWith(route))) return "advertiser";
  if (protectedRoutes.admin.some((route) => path.startsWith(route))) return "admin";
  return "public";
}

function canAccessRoute(user = authState.currentUser, path = window.location.pathname) {
  const accessType = getRouteAccessType(path);
  if (accessType === "public") return true;
  if (!user) return false;
  if (accessType === "client") return user.role === "client" || user.role === "admin";
  if (accessType === "advertiser") return user.role !== "client";
  if (accessType === "admin") return user.role === "admin";
  return false;
}

function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function validatePhoneNumber(value) {
  return /^[+0-9\s-]{7,18}$/.test(String(value || "").trim());
}

function validatePassword(value) {
  return String(value || "").length >= 8;
}

function isPrivateFrontendHost(hostname = "") {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".local") ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  );
}

function getApiBaseUrl() {
  const configuredBaseUrl =
    document.body.dataset.apiBaseUrl ||
    window.PencmiConfig?.apiBaseUrl ||
    window.PencmiApiBaseUrl ||
    window.localStorage.getItem(API_BASE_STORAGE_KEY) ||
    "";

  if (configuredBaseUrl) {
    return configuredBaseUrl.replace(/\/+$/, "");
  }

  if (window.location.protocol === "http:" || window.location.protocol === "https:") {
    if (isPrivateFrontendHost(window.location.hostname)) {
      return "";
    }
    return `${window.location.origin}/api/v1`;
  }

  return "";
}

function getStoredAccessToken() {
  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) || "";
}

function setStoredTokens(tokens) {
  if (tokens?.accessToken) {
    window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, tokens.accessToken);
  }
  if (tokens?.refreshToken) {
    window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, tokens.refreshToken);
  }
}

function clearStoredTokens() {
  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
}

async function apiRequest(path, options = {}) {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new Error("API non configurée.");
  }

  const headers = new Headers(options.headers || {});
  const token = getStoredAccessToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const isFormData = options.body instanceof FormData;
  if (!isFormData && options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error("API inaccessible. Vérifiez l'URL du backend et la configuration CORS.");
  }

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || "Une erreur est survenue.";
    throw new Error(Array.isArray(message) ? message.join(", ") : message);
  }

  return payload?.data ?? payload;
}

function showMessage(element, message, visible = true) {
  if (!element) return;
  if (message) {
    element.textContent = message;
  }
  element.classList.toggle("is-visible", visible);
}

function getProfessionalTypeOptions() {
  return [
    ["real_estate_agency", "Agence immobilière"],
    ["hotel", "Hôtel"],
    ["auberge", "Auberge"],
    ["residence", "Résidence"],
    ["vehicle_renter", "Loueur de voitures"],
    ["vehicle_dealer", "Garage automobile"],
    ["chauffeur", "Chauffeur professionnel"],
    ["transport_provider", "Transporteur"],
    ["other", "Autre"],
  ];
}

function getRoleOptions() {
  return [
    ["client", "Client"],
    ["advertiser_individual", "Annonceur particulier"],
    ["real_estate_agency", "Agence immobilière"],
    ["hotel_manager", "Hôtel / Auberge / Résidence"],
    ["vehicle_renter", "Loueur de voitures"],
    ["vehicle_dealer", "Garage automobile"],
    ["chauffeur", "Chauffeur professionnel"],
    ["transport_provider", "Transporteur"],
    ["admin", "Admin Péncmi"],
  ];
}

function getProfessionalTypeForRole(role) {
  const mapping = {
    real_estate_agency: "real_estate_agency",
    hotel_manager: "hotel",
    vehicle_renter: "vehicle_renter",
    vehicle_dealer: "vehicle_dealer",
    chauffeur: "chauffeur",
    transport_provider: "transport_provider",
  };

  return mapping[role] || "other";
}

function getRoleForProfessionalType(type) {
  const mapping = {
    real_estate_agency: "real_estate_agency",
    hotel: "hotel_manager",
    auberge: "hotel_manager",
    residence: "hotel_manager",
    vehicle_renter: "vehicle_renter",
    vehicle_dealer: "vehicle_dealer",
    chauffeur: "chauffeur",
    transport_provider: "transport_provider",
    other: "advertiser_individual",
  };

  return mapping[type] || "advertiser_individual";
}

async function loadCurrentSession() {
  const token = getStoredAccessToken();
  if (!token || !getApiBaseUrl()) {
    return;
  }

  try {
    authState.currentUser = await apiRequest("/auth/me");
    if (authState.currentUser?.role !== "client" && authState.currentUser?.role !== "admin") {
      authState.professionalProfile = await apiRequest("/professional-profiles/me").catch(() => null);
    } else {
      authState.professionalProfile = null;
    }
  } catch {
    clearStoredTokens();
    authState.currentUser = null;
    authState.professionalProfile = null;
  }
}

function AuthLayout(content, side = "") {
  return `
    <header class="auth-header">
      <a class="brand" href="${authRouteHref(authRoutes.home)}" aria-label="Accueil Péncmi"><span class="brand-mark">P</span><span><strong>Péncmi</strong><small>Comptes utilisateurs</small></span></a>
      <div class="auth-actions"><a class="btn btn-ghost" href="${authRouteHref(authRoutes.login)}">Se connecter</a><a class="btn btn-light" href="${authRouteHref(authRoutes.register)}">Créer un compte</a></div>
    </header>
    <main class="auth-main">
      <section class="auth-shell">
        <div class="auth-intro">
          <h1>Votre espace Péncmi</h1>
          <p>Connectez-vous à votre espace client ou annonceur pour gérer vos messages, favoris, annonces, demandes et notifications.</p>
          <div class="verification-grid">
            ${VerificationBadge("Email vérifié", false)}
            ${VerificationBadge("Téléphone vérifié", false)}
            ${VerificationBadge("Profil vérifié", false)}
            ${VerificationBadge("Professionnel vérifié", false)}
          </div>
        </div>
        <div class="auth-card">${content}</div>
      </section>
      ${side}
    </main>
  `;
}

function LoginPage() {
  const next = getNextParam();
  return AuthLayout(`
    <h1>Se connecter</h1>
    <p>${next ? "Connexion requise pour continuer vers la page demandée." : "Accédez à votre compte Péncmi."}</p>
    <form class="auth-form" data-login-form>
      <label class="auth-field"><span>Email ou téléphone</span><input type="text" name="identifier" autocomplete="username"></label>
      <label class="auth-field"><span>Mot de passe</span><input type="password" name="password" autocomplete="current-password"></label>
      <div class="auth-error" data-auth-error>Identifiants incorrects. Veuillez réessayer.</div>
      <div class="auth-actions"><button class="btn btn-primary" type="submit">Se connecter</button></div>
      <div class="auth-links"><a href="${authRouteHref(authRoutes.forgotPassword)}">Mot de passe oublié ?</a><a href="${authRouteHref(authRoutes.register)}">Créer un compte</a></div>
    </form>
  `);
}

function RegisterPage() {
  return AuthLayout(`
    <h1>Créer votre compte Péncmi</h1>
    <form class="auth-form" data-register-form>
      ${RoleSelector()}
      <div data-register-fields>${RegisterClientForm()}</div>
      <div class="auth-error" data-auth-error></div>
      <div class="auth-message" data-auth-success>Votre compte a été créé avec succès.</div>
      <div class="auth-actions"><button class="btn btn-primary" type="submit">Créer mon compte</button></div>
    </form>
  `);
}

function ForgotPasswordPage() {
  return AuthLayout(`
    <h1>Mot de passe oublié</h1>
    <p>Renseignez votre email ou téléphone pour recevoir les instructions.</p>
    <form class="auth-form" data-success-form>
      <label class="auth-field"><span>Email ou téléphone</span><input type="text" autocomplete="username"></label>
      <div class="auth-message" data-auth-success>Si un compte existe, vous recevrez les instructions de réinitialisation.</div>
      <div class="auth-actions"><button class="btn btn-primary" type="submit">Recevoir un lien de réinitialisation</button></div>
    </form>
  `);
}

function ResetPasswordPage() {
  return AuthLayout(`
    <h1>Réinitialiser le mot de passe</h1>
    <form class="auth-form" data-success-form>
      <label class="auth-field"><span>Nouveau mot de passe</span><input type="password" autocomplete="new-password"></label>
      <label class="auth-field"><span>Confirmer le mot de passe</span><input type="password" autocomplete="new-password"></label>
      <div class="auth-message" data-auth-success>Votre mot de passe a été réinitialisé.</div>
      <div class="auth-actions"><button class="btn btn-primary" type="submit">Réinitialiser le mot de passe</button></div>
    </form>
  `);
}

function RoleSelector() {
  return `
    <section class="register-step">
      <h2>Type de compte</h2>
      <div class="role-selector">
        <label class="role-option"><input type="radio" name="accountType" value="client" checked><strong>Je cherche un bien, un hôtel, une voiture ou un trajet</strong><small>Espace client, favoris, alertes, messages et demandes.</small></label>
        <label class="role-option"><input type="radio" name="accountType" value="advertiser"><strong>Je veux publier une annonce</strong><small>Publication immobilier, voiture ou voyage selon votre besoin.</small></label>
        <label class="role-option"><input type="radio" name="accountType" value="professional"><strong>Je suis une entreprise ou un professionnel</strong><small>Agence, hôtel, loueur, garage, chauffeur ou transporteur.</small></label>
      </div>
    </section>
  `;
}

function RegisterClientForm() {
  return `
    <section class="register-step">
      <label class="auth-field"><span>Prénom</span><input type="text" name="clientFirstName" autocomplete="given-name"></label>
      <label class="auth-field"><span>Nom</span><input type="text" name="clientLastName" autocomplete="family-name"></label>
      <label class="auth-field"><span>Téléphone</span><input type="tel" name="clientPhone" autocomplete="tel"></label>
      <label class="auth-field"><span>Email</span><input type="email" name="clientEmail" autocomplete="email"></label>
      <label class="auth-field"><span>Mot de passe</span><input type="password" name="clientPassword" autocomplete="new-password"></label>
      <label class="auth-field"><span>Confirmation mot de passe</span><input type="password" name="clientPasswordConfirmation" autocomplete="new-password"></label>
    </section>
  `;
}

function RegisterAdvertiserForm() {
  return `
    <section class="register-step">
      <label class="auth-field"><span>Prénom</span><input type="text" name="advertiserFirstName" autocomplete="given-name"></label>
      <label class="auth-field"><span>Nom</span><input type="text" name="advertiserLastName" autocomplete="family-name"></label>
      <label class="auth-field"><span>Téléphone</span><input type="tel" name="advertiserPhone" autocomplete="tel"></label>
      <label class="auth-field"><span>Email</span><input type="email" name="advertiserEmail" autocomplete="email"></label>
      <label class="auth-field"><span>Type d’annonce prévue</span><select name="plannedListingType"><option>Immobilier</option><option>Voiture</option><option>Voyage</option></select></label>
      <label class="auth-field"><span>Mot de passe</span><input type="password" name="advertiserPassword" autocomplete="new-password"></label>
      <label class="auth-field"><span>Confirmation mot de passe</span><input type="password" name="advertiserPasswordConfirmation" autocomplete="new-password"></label>
    </section>
  `;
}

function RegisterProfessionalForm() {
  return `
    <section class="register-step">
      <label class="auth-field"><span>Nom de l’entreprise</span><input type="text" name="businessName" autocomplete="organization"></label>
      <label class="auth-field"><span>Type professionnel</span><select name="professionalType">${getProfessionalTypeOptions().map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label>
      <label class="auth-field"><span>Prénom du responsable</span><input type="text" name="professionalOwnerFirstName" autocomplete="given-name"></label>
      <label class="auth-field"><span>Nom du responsable</span><input type="text" name="professionalOwnerLastName" autocomplete="family-name"></label>
      <label class="auth-field"><span>Téléphone</span><input type="tel" name="professionalPhone" autocomplete="tel"></label>
      <label class="auth-field"><span>Email</span><input type="email" name="professionalEmail" autocomplete="email"></label>
      <label class="auth-field"><span>Ville</span><input type="text" name="professionalCity" autocomplete="address-level2"></label>
      <label class="auth-field"><span>Mot de passe</span><input type="password" name="professionalPassword" autocomplete="new-password"></label>
      <label class="auth-field"><span>Confirmation mot de passe</span><input type="password" name="professionalPasswordConfirmation" autocomplete="new-password"></label>
    </section>
  `;
}

function UnauthorizedState(title = "Accès non autorisé", message = "Votre rôle ne permet pas d’accéder à cette page.", href = authRoutes.home) {
  return `
    <section class="unauthorized-state">
      <h1>${title}</h1>
      <p>${message}</p>
      <a class="btn btn-primary" href="${authRouteHref(href)}">Retour à l’accueil</a>
    </section>
  `;
}

function AccountLayout(content, currentPage = "overview", mode = "client") {
  const nav = mode === "dashboard"
    ? [
        ["Tableau de bord", authRoutes.dashboard, "dashboard"],
        ["Profil", authRoutes.dashboardProfile, "profile"],
        ["Paramètres", authRoutes.dashboardSettings, "settings"],
        ["Notifications", authRoutes.dashboardNotifications, "notifications"],
      ]
    : [
        ["Mon compte", authRoutes.account, "overview"],
        ["Profil", authRoutes.accountProfile, "profile"],
        ["Paramètres", authRoutes.accountSettings, "settings"],
        ["Notifications", authRoutes.accountNotifications, "notifications"],
      ];

  return `
    <main class="account-main">
      <section class="account-layout">
        <aside class="account-sidebar">
          <div class="dashboard-brand"><span>P</span><div><strong>Péncmi</strong><small>${mode === "dashboard" ? "Annonceur" : "Compte client"}</small></div></div>
          <nav class="account-nav">${nav.map(([label, href, key]) => `<a href="${authRouteHref(href)}"${key === currentPage ? ' aria-current="page"' : ""}><span>${label}</span><span class="notification-badge">0</span></a>`).join("")}</nav>
        </aside>
        <section>${content}</section>
      </section>
    </main>
  `;
}

function AccountHomePage() {
  return AccountLayout(`
    <section class="account-card">
      <h1>Mon compte</h1>
      <p>Gérez vos favoris, alertes, messages, demandes et notifications depuis votre espace client.</p>
      ${RoleBadge(authState.currentUser ? roleLabels[authState.currentUser.role] : "Client")}
    </section>
    <section class="account-empty-state">
      <h2>Aucune activité pour le moment.</h2>
      <p>Vos favoris, demandes, réservations, visites et trajets apparaîtront ici.</p>
    </section>
  `);
}

function DashboardEntryPage() {
  const cards = [
    ["Immobilier", "Gérez vos biens, visites, contacts et statistiques.", authRoutes.realEstateDashboard],
    ["Hôtels & Auberges", "Gérez vos hébergements, disponibilités et réservations.", authRoutes.hotelsDashboard],
    ["Voitures", "Gérez vos véhicules, messages, contacts et performances.", authRoutes.vehiclesDashboard],
    ["Voyages interurbains", "Gérez vos trajets, demandes de place et messages.", authRoutes.tripsDashboard],
    ["Vérification", "Suivez vos documents, badges et score de confiance.", authRoutes.dashboardVerification],
  ];

  return AccountLayout(`
    <section class="account-card">
      <h1>Mon espace annonceur</h1>
      <p>Accédez aux modules autorisés selon votre rôle. Les compteurs sont prévus pour les futures données.</p>
    </section>
    <section class="dashboard-entry-grid">
      ${cards.map(([title, text, href]) => `<article class="dashboard-entry-card"><span class="notification-badge">0</span><h2>${title}</h2><p>${text}</p><a class="btn btn-light" href="${authRouteHref(href)}">Accéder</a></article>`).join("")}
    </section>
    <section class="account-empty-state">
      <h2>Commencez par publier votre première annonce.</h2>
      <div class="dashboard-entry-actions"><a class="btn btn-primary" href="${authRouteHref(authRoutes.publish)}">Publier une annonce</a></div>
    </section>
  `, "dashboard", "dashboard");
}

function shouldShowProfessionalProfile(mode) {
  if (mode === "dashboard") return true;
  if (!authState.currentUser) return false;
  return authState.currentUser.role !== "client" && authState.currentUser.role !== "admin";
}

function AccountProfilePage(mode = "client") {
  return AccountLayout(`
    <section class="account-card">
      <h1>Profil utilisateur</h1>
      <form class="account-form" data-profile-form data-profile-mode="${mode}">
        <div class="account-grid">
          <label class="auth-field"><span>Prénom</span><input type="text" name="firstName" autocomplete="given-name"></label>
          <label class="auth-field"><span>Nom</span><input type="text" name="lastName" autocomplete="family-name"></label>
          <label class="auth-field"><span>Téléphone</span><input type="tel" name="phone" autocomplete="tel"></label>
          <label class="auth-field"><span>Email</span><input type="email" name="email" autocomplete="email"></label>
          <label class="auth-field"><span>Photo de profil</span><input type="file" name="avatarFile" accept="image/*"></label>
          <label class="auth-field"><span>Ville</span><input type="text" name="city" autocomplete="address-level2"></label>
          <label class="auth-field"><span>Langue préférée</span><select name="preferredLanguage"><option>Français</option><option>Wolof</option><option>Anglais</option></select></label>
          <label class="auth-field"><span>Type de compte</span><select name="accountRole" disabled>${getRoleOptions().map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label>
        </div>
        ${shouldShowProfessionalProfile(mode) ? ProfessionalProfileForm() : ""}
        <div class="auth-error" data-auth-error></div>
        <div class="auth-message" data-auth-success>Votre profil a été mis à jour.</div>
        <div class="account-actions"><button class="btn btn-primary" type="submit">Enregistrer les modifications</button></div>
      </form>
    </section>
  `, "profile", mode);
}

function ProfessionalProfileForm() {
  return `
    <section class="settings-section" data-professional-profile-section>
      <h2>Profil professionnel</h2>
      <div class="account-grid">
        <label class="auth-field"><span>Nom de l’entreprise</span><input type="text" name="businessName" autocomplete="organization"></label>
        <label class="auth-field"><span>Type professionnel</span><select name="profileProfessionalType">${getProfessionalTypeOptions().map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></label>
        <label class="auth-field"><span>Adresse</span><input type="text" name="businessAddress" autocomplete="street-address"></label>
        <label class="auth-field"><span>Ville</span><input type="text" name="businessCity" autocomplete="address-level2"></label>
        <label class="auth-field"><span>Logo</span><input type="file" name="logoFile" accept="image/*"></label>
        <label class="auth-field"><span>Numéro de téléphone professionnel</span><input type="tel" name="professionalPhoneProfile" autocomplete="tel"></label>
        <label class="auth-field"><span>Email professionnel</span><input type="email" name="professionalEmailProfile" autocomplete="email"></label>
        <label class="auth-field"><span>WhatsApp</span><input type="tel" name="professionalWhatsapp"></label>
        <label class="auth-field"><span>Site web</span><input type="url" name="professionalWebsite"></label>
        <label class="auth-field"><span>Date d’ouverture</span><input type="date" name="openingDate"></label>
        <label class="auth-field"><span>Horaires d’ouverture</span><input type="text" name="openingHours" placeholder="Lun-Sam 08:00 - 20:00"></label>
        <label class="auth-field"><span>Description</span><textarea name="professionalDescription"></textarea></label>
      </div>
    </section>
  `;
}

function AccountSettingsPage(mode = "client") {
  const notificationsHref = mode === "dashboard" ? authRoutes.dashboardNotifications : authRoutes.accountNotifications;
  return AccountLayout(`
    <section class="account-card">
      <h1>Paramètres du compte</h1>
      <form class="account-form" data-settings-form>
        <section class="settings-section">
          <h2>Sécurité</h2>
          <label class="auth-field"><span>Changer le mot de passe</span><input type="password" autocomplete="new-password"></label>
          <div class="verification-grid">${VerificationBadge("Email vérifié", false)}${VerificationBadge("Téléphone vérifié", false)}${VerificationBadge("Sessions connectées plus tard", false)}</div>
        </section>
        <section class="settings-section">
          <h2>Notifications</h2>
          <p><a class="btn btn-light" href="${authRouteHref(notificationsHref)}">Voir mes notifications</a></p>
        </section>
        <section class="settings-section">
          <h2>Confidentialité</h2>
          ${["Afficher mon téléphone aux annonceurs", "Recevoir des emails importants", "Recevoir des alertes", "Recevoir des recommandations"].map((label) => `<label class="settings-option"><input type="checkbox"><span>${label}</span></label>`).join("")}
        </section>
        <section class="settings-section">
          <h2>Suppression du compte</h2>
          <button class="btn danger-button" type="button" data-open-delete-modal>Supprimer mon compte</button>
        </section>
        <div class="auth-message" data-auth-success>Vos paramètres ont été mis à jour.</div>
        <div class="settings-actions"><button class="btn btn-primary" type="submit">Enregistrer les modifications</button></div>
      </form>
      <div class="modal-backdrop" data-delete-modal>
        <div class="auth-modal">
          <h2>Confirmer la suppression</h2>
          <p>Cette action est prévue pour une future intégration sécurisée. Aucun compte n’est supprimé maintenant.</p>
          <div class="settings-actions"><button class="btn btn-ghost" type="button" data-close-delete-modal>Annuler</button><button class="btn danger-button" type="button">Supprimer mon compte</button></div>
        </div>
      </div>
    </section>
  `, "settings", mode);
}

function VerificationBadge(label, verified = false) {
  return `<span class="verification-badge${verified ? "" : " is-muted"}">${label}</span>`;
}

function RoleBadge(label) {
  return `<span class="role-badge">${label}</span>`;
}

function collectRegisterPayload(form) {
  const accountType = form.querySelector('input[name="accountType"]:checked')?.value || "client";

  if (accountType === "client") {
    return {
      role: "client",
      firstName: form.querySelector('[name="clientFirstName"]')?.value.trim(),
      lastName: form.querySelector('[name="clientLastName"]')?.value.trim(),
      phone: form.querySelector('[name="clientPhone"]')?.value.trim(),
      email: form.querySelector('[name="clientEmail"]')?.value.trim(),
      password: form.querySelector('[name="clientPassword"]')?.value || "",
    };
  }

  if (accountType === "advertiser") {
    return {
      role: "advertiser_individual",
      firstName: form.querySelector('[name="advertiserFirstName"]')?.value.trim(),
      lastName: form.querySelector('[name="advertiserLastName"]')?.value.trim(),
      phone: form.querySelector('[name="advertiserPhone"]')?.value.trim(),
      email: form.querySelector('[name="advertiserEmail"]')?.value.trim(),
      password: form.querySelector('[name="advertiserPassword"]')?.value || "",
    };
  }

  const professionalType = form.querySelector('[name="professionalType"]')?.value || "other";
  return {
    role: getRoleForProfessionalType(professionalType),
    firstName: form.querySelector('[name="professionalOwnerFirstName"]')?.value.trim(),
    lastName: form.querySelector('[name="professionalOwnerLastName"]')?.value.trim(),
    phone: form.querySelector('[name="professionalPhone"]')?.value.trim(),
    email: form.querySelector('[name="professionalEmail"]')?.value.trim(),
    password: form.querySelector('[name="professionalPassword"]')?.value || "",
  };
}

function collectProfessionalRegisterProfilePayload(form) {
  return {
    businessName: form.querySelector('[name="businessName"]')?.value.trim(),
    professionalType: form.querySelector('[name="professionalType"]')?.value || "other",
    city: form.querySelector('[name="professionalCity"]')?.value.trim() || undefined,
  };
}

function collectProfessionalProfilePayload(form) {
  const businessName = form.querySelector('[name="businessName"]')?.value.trim();
  if (!businessName) {
    return null;
  }

  return {
    businessName,
    professionalType: form.querySelector('[name="profileProfessionalType"]')?.value || getProfessionalTypeForRole(authState.currentUser?.role),
    address: form.querySelector('[name="businessAddress"]')?.value.trim() || undefined,
    city: form.querySelector('[name="businessCity"]')?.value.trim() || undefined,
    professionalPhone: form.querySelector('[name="professionalPhoneProfile"]')?.value.trim() || undefined,
    professionalEmail: form.querySelector('[name="professionalEmailProfile"]')?.value.trim() || undefined,
    whatsappNumber: form.querySelector('[name="professionalWhatsapp"]')?.value.trim() || undefined,
    website: form.querySelector('[name="professionalWebsite"]')?.value.trim() || undefined,
    description: form.querySelector('[name="professionalDescription"]')?.value.trim() || undefined,
    openingDate: form.querySelector('[name="openingDate"]')?.value || undefined,
    openingHours: form.querySelector('[name="openingHours"]')?.value.trim() || undefined,
  };
}

function fillUserProfileForm(form, user) {
  if (!form || !user) return;
  const setValue = (name, value) => {
    const field = form.querySelector(`[name="${name}"]`);
    if (field) field.value = value || "";
  };

  setValue("firstName", user.firstName);
  setValue("lastName", user.lastName);
  setValue("phone", user.phone);
  setValue("email", user.email);
  setValue("city", user.city);
  setValue("accountRole", user.role || "client");
}

function fillProfessionalProfileForm(form, profile) {
  if (!form || !profile) return;
  const setValue = (name, value) => {
    const field = form.querySelector(`[name="${name}"]`);
    if (field) field.value = value || "";
  };

  setValue("businessName", profile.businessName);
  setValue("profileProfessionalType", profile.professionalType);
  setValue("businessAddress", profile.address);
  setValue("businessCity", profile.city);
  setValue("professionalPhoneProfile", profile.professionalPhone);
  setValue("professionalEmailProfile", profile.professionalEmail);
  setValue("professionalWhatsapp", profile.whatsappNumber);
  setValue("professionalWebsite", profile.website);
  setValue("professionalDescription", profile.description);
  setValue("openingDate", profile.openingDate ? String(profile.openingDate).slice(0, 10) : "");
  setValue("openingHours", profile.openingHours);
}

async function uploadProfileAsset(path, input) {
  if (!input?.files?.length) return;
  const formData = new FormData();
  formData.append("file", input.files[0]);
  await apiRequest(path, {
    method: "POST",
    body: formData,
  });
}

async function bindProfileForm(form) {
  const success = form.querySelector("[data-auth-success]");
  const error = form.querySelector("[data-auth-error]");

  fillUserProfileForm(form, authState.currentUser);
  fillProfessionalProfileForm(form, authState.professionalProfile);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    showMessage(error, "", false);
    showMessage(success, "", false);

    if (!getApiBaseUrl() || !getStoredAccessToken()) {
      showMessage(error, "Profil indisponible tant que l'API ou la session n'est pas configurée.");
      return;
    }

    try {
      const userPayload = {
        firstName: form.querySelector('[name="firstName"]')?.value.trim() || undefined,
        lastName: form.querySelector('[name="lastName"]')?.value.trim() || undefined,
        phone: form.querySelector('[name="phone"]')?.value.trim() || undefined,
        email: form.querySelector('[name="email"]')?.value.trim() || undefined,
        city: form.querySelector('[name="city"]')?.value.trim() || undefined,
      };

      authState.currentUser = await apiRequest("/users/me", {
        method: "PATCH",
        body: JSON.stringify(userPayload),
      });

      if (shouldShowProfessionalProfile(form.dataset.profileMode)) {
        const professionalPayload = collectProfessionalProfilePayload(form);
        if (professionalPayload) {
          authState.professionalProfile = await apiRequest("/professional-profiles/me", {
            method: "PUT",
            body: JSON.stringify(professionalPayload),
          });
        }
      }

      await uploadProfileAsset("/users/me/avatar", form.querySelector('[name="avatarFile"]'));
      if (shouldShowProfessionalProfile(form.dataset.profileMode)) {
        await uploadProfileAsset("/professional-profiles/me/logo", form.querySelector('[name="logoFile"]'));
      }

      await loadCurrentSession();
      fillUserProfileForm(form, authState.currentUser);
      fillProfessionalProfileForm(form, authState.professionalProfile);
      showMessage(success, "Votre profil a été mis à jour.");
    } catch (apiError) {
      showMessage(error, apiError.message || "La mise à jour du profil a échoué.");
    }
  });
}

function bindAuthForms() {
  const loginForm = document.querySelector("[data-login-form]");
  loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const error = loginForm.querySelector("[data-auth-error]");
    showMessage(error, "", false);

    const identifier = loginForm.querySelector('[name="identifier"]')?.value.trim();
    const password = loginForm.querySelector('[name="password"]')?.value || "";
    if (!identifier || !password) {
      showMessage(error, "Veuillez renseigner vos identifiants.");
      return;
    }

    if (!getApiBaseUrl()) {
      showMessage(error, "Connexion indisponible tant que l'URL du backend n'est pas configurée.");
      return;
    }

    try {
      const tokens = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ identifier, password }),
      });
      setStoredTokens(tokens);
      await loadCurrentSession();
      const target = getRedirectAfterLogin(authState.currentUser?.role || "client", getNextParam());
      window.location.href = authRouteHref(target);
    } catch (apiError) {
      showMessage(error, apiError.message || "Identifiants incorrects. Veuillez réessayer.");
    }
  });

  const registerForm = document.querySelector("[data-register-form]");
  registerForm?.addEventListener("change", (event) => {
    if (event.target.name !== "accountType") return;
    const container = document.querySelector("[data-register-fields]");
    const forms = {
      client: RegisterClientForm,
      advertiser: RegisterAdvertiserForm,
      professional: RegisterProfessionalForm,
    };
    container.innerHTML = forms[event.target.value]();
  });

  registerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const success = registerForm.querySelector("[data-auth-success]");
    const error = registerForm.querySelector("[data-auth-error]");
    showMessage(error, "", false);
    showMessage(success, "", false);

    const payload = collectRegisterPayload(registerForm);
    if (!validatePassword(payload.password)) {
      showMessage(error, "Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    if (!getApiBaseUrl()) {
      showMessage(error, "Inscription indisponible tant que l'URL du backend n'est pas configurée.");
      return;
    }

    try {
      const tokens = await apiRequest("/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setStoredTokens(tokens);
      await loadCurrentSession();

      const accountType = registerForm.querySelector('input[name="accountType"]:checked')?.value;
      if (accountType === "professional") {
        const professionalPayload = collectProfessionalRegisterProfilePayload(registerForm);
        if (professionalPayload.businessName) {
          authState.professionalProfile = await apiRequest("/professional-profiles/me", {
            method: "PUT",
            body: JSON.stringify(professionalPayload),
          });
        }
      }

      showMessage(success, "Votre compte a été créé avec succès.");
      const target = getRedirectAfterLogin(authState.currentUser?.role || payload.role);
      window.setTimeout(() => {
        window.location.href = authRouteHref(target);
      }, 400);
    } catch (apiError) {
      showMessage(error, apiError.message || "La création du compte a échoué.");
    }
  });

  document.querySelectorAll("[data-success-form], [data-settings-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      form.querySelector("[data-auth-success]")?.classList.add("is-visible");
    });
  });

  const profileForm = document.querySelector("[data-profile-form]");
  if (profileForm) {
    void bindProfileForm(profileForm);
  }

  document.querySelector("[data-open-delete-modal]")?.addEventListener("click", () => {
    document.querySelector("[data-delete-modal]")?.classList.add("is-open");
  });

  document.querySelector("[data-close-delete-modal]")?.addEventListener("click", () => {
    document.querySelector("[data-delete-modal]")?.classList.remove("is-open");
  });
}

async function renderAuthPage() {
  const root = document.querySelector("[data-auth-root]");
  if (!root) return;

  await loadCurrentSession();

  const page = document.body.dataset.authPage;
  if (!canAccessRoute() && getRouteAccessType(window.location.pathname) !== "public" && getApiBaseUrl()) {
    root.innerHTML = UnauthorizedState("Connexion requise", "Connectez-vous pour accéder à cette page.", buildLoginRedirect(window.location.pathname));
    return;
  }

  const pages = {
    login: LoginPage,
    register: RegisterPage,
    forgotPassword: ForgotPasswordPage,
    resetPassword: ResetPasswordPage,
    account: AccountHomePage,
    accountProfile: () => AccountProfilePage("client"),
    accountSettings: () => AccountSettingsPage("client"),
    dashboard: DashboardEntryPage,
    dashboardProfile: () => AccountProfilePage("dashboard"),
    dashboardSettings: () => AccountSettingsPage("dashboard"),
  };

  root.innerHTML = (pages[page] || LoginPage)();
  bindAuthForms();
}

document.addEventListener("DOMContentLoaded", () => {
  void renderAuthPage();
});

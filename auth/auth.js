const authState = {
  currentUser: null,
  professionalProfile: null
};

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
  admin: "/admin"
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
  admin: "Admin Péncmi"
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
  admin: ["publish_real_estate", "publish_hotel", "publish_vehicle", "publish_trip", "manage_real_estate", "manage_hotels", "manage_vehicles", "manage_trips", "manage_messages", "manage_contacts", "manage_notifications", "access_admin"]
};

const protectedRoutes = {
  client: ["/compte", "/compte/profil", "/compte/messages", "/compte/favoris", "/compte/alertes", "/compte/notifications", "/compte/reservations", "/compte/visites", "/compte/locations", "/compte/chauffeur", "/compte/trajets", "/compte/parametres", "/compte/signalements"],
  advertiser: ["/dashboard", "/dashboard/immobilier", "/dashboard/hotels", "/dashboard/voitures", "/dashboard/voyages", "/dashboard/reports"],
  admin: ["/admin"]
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
    "/admin": `${prefix}admin/`
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
    admin: authRoutes.admin
  };

  return routesByRole[role] || authRoutes.account;
}

function getPermissionsForRole(role) {
  return permissionsByRole[role] || [];
}

function hasPermission(role, permission) {
  return getPermissionsForRole(role).includes(permission);
}

function getVisibleDashboardModules(role = "client") {
  const modules = [
    { module: "real_estate", label: "Immobilier", href: authRoutes.realEstateDashboard, permission: "manage_real_estate" },
    { module: "hotels", label: "Hôtels & Auberges", href: authRoutes.hotelsDashboard, permission: "manage_hotels" },
    { module: "vehicles", label: "Voitures", href: authRoutes.vehiclesDashboard, permission: "manage_vehicles" },
    { module: "trips", label: "Voyages interurbains", href: authRoutes.tripsDashboard, permission: "manage_trips" }
  ];

  if (role === "advertiser_individual") {
    return modules.filter((item) => ["real_estate", "vehicles", "trips"].includes(item.module));
  }

  if (role === "admin") {
    return modules;
  }

  return modules.filter((item) => hasPermission(role, item.permission));
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

function isRoleAllowedForRoute(role, path = window.location.pathname) {
  const accessType = getRouteAccessType(path);
  if (accessType === "public") return true;
  if (accessType === "client") return role === "client" || role === "admin";
  if (accessType === "advertiser") return role !== "client";
  if (accessType === "admin") return role === "admin";
  return false;
}

function canAccessRoute(user = authState.currentUser, path = window.location.pathname) {
  const accessType = getRouteAccessType(path);
  if (accessType === "public") return true;
  if (!user) return false;
  return isRoleAllowedForRoute(user.role, path);
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
      <label class="auth-field"><span>Prénom</span><input type="text" autocomplete="given-name"></label>
      <label class="auth-field"><span>Nom</span><input type="text" autocomplete="family-name"></label>
      <label class="auth-field"><span>Téléphone</span><input type="tel" autocomplete="tel"></label>
      <label class="auth-field"><span>Email</span><input type="email" autocomplete="email"></label>
      <label class="auth-field"><span>Mot de passe</span><input type="password" autocomplete="new-password"></label>
      <label class="auth-field"><span>Confirmation mot de passe</span><input type="password" autocomplete="new-password"></label>
    </section>
  `;
}

function RegisterAdvertiserForm() {
  return `
    <section class="register-step">
      <label class="auth-field"><span>Prénom</span><input type="text" autocomplete="given-name"></label>
      <label class="auth-field"><span>Nom</span><input type="text" autocomplete="family-name"></label>
      <label class="auth-field"><span>Téléphone</span><input type="tel" autocomplete="tel"></label>
      <label class="auth-field"><span>Email</span><input type="email" autocomplete="email"></label>
      <label class="auth-field"><span>Type d’annonce prévue</span><select><option>Immobilier</option><option>Voiture</option><option>Voyage</option></select></label>
      <label class="auth-field"><span>Mot de passe</span><input type="password" autocomplete="new-password"></label>
      <label class="auth-field"><span>Confirmation mot de passe</span><input type="password" autocomplete="new-password"></label>
    </section>
  `;
}

function RegisterProfessionalForm() {
  return `
    <section class="register-step">
      <label class="auth-field"><span>Nom de l’entreprise</span><input type="text" autocomplete="organization"></label>
      <label class="auth-field"><span>Type professionnel</span><select><option>Agence immobilière</option><option>Hôtel / Auberge / Résidence</option><option>Loueur de voitures</option><option>Garage automobile</option><option>Chauffeur professionnel</option><option>Transporteur</option><option>Autre</option></select></label>
      <label class="auth-field"><span>Prénom du responsable</span><input type="text" autocomplete="given-name"></label>
      <label class="auth-field"><span>Nom du responsable</span><input type="text" autocomplete="family-name"></label>
      <label class="auth-field"><span>Téléphone</span><input type="tel" autocomplete="tel"></label>
      <label class="auth-field"><span>Email</span><input type="email" autocomplete="email"></label>
      <label class="auth-field"><span>Ville</span><input type="text" autocomplete="address-level2"></label>
      <label class="auth-field"><span>Mot de passe</span><input type="password" autocomplete="new-password"></label>
      <label class="auth-field"><span>Confirmation mot de passe</span><input type="password" autocomplete="new-password"></label>
    </section>
  `;
}

function ProtectedRoute(content, allowedRoles = []) {
  if (!authState.currentUser) {
    return UnauthorizedState("Connexion requise", "Connectez-vous pour accéder à cette page.", buildLoginRedirect(window.location.pathname));
  }

  if (allowedRoles.length && !allowedRoles.includes(authState.currentUser.role)) {
    return UnauthorizedState("Accès non autorisé", "Votre rôle ne permet pas d’accéder à cette page.", authRoutes.home);
  }

  return content;
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
        ["Notifications", authRoutes.dashboardNotifications, "notifications"]
      ]
    : [
        ["Mon compte", authRoutes.account, "overview"],
        ["Profil", authRoutes.accountProfile, "profile"],
        ["Paramètres", authRoutes.accountSettings, "settings"],
        ["Notifications", authRoutes.accountNotifications, "notifications"]
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
      ${RoleBadge("Client")}
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
    ["Vérification", "Suivez vos documents, badges et score de confiance.", authRoutes.dashboardVerification]
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

function AccountProfilePage(mode = "client") {
  return AccountLayout(`
    <section class="account-card">
      <h1>Profil utilisateur</h1>
      <form class="account-form" data-success-form>
        <div class="account-grid">
          <label class="auth-field"><span>Prénom</span><input type="text" autocomplete="given-name"></label>
          <label class="auth-field"><span>Nom</span><input type="text" autocomplete="family-name"></label>
          <label class="auth-field"><span>Téléphone</span><input type="tel" autocomplete="tel"></label>
          <label class="auth-field"><span>Email</span><input type="email" autocomplete="email"></label>
          <label class="auth-field"><span>Photo de profil</span><input type="file" accept="image/*"></label>
          <label class="auth-field"><span>Ville</span><input type="text" autocomplete="address-level2"></label>
          <label class="auth-field"><span>Langue préférée</span><select><option>Français</option><option>Wolof</option><option>Anglais</option></select></label>
          <label class="auth-field"><span>Type de compte</span><select><option>Client</option><option>Annonceur particulier</option><option>Professionnel</option></select></label>
        </div>
        ${ProfessionalProfileForm()}
        <div class="auth-message" data-auth-success>Votre profil a été mis à jour.</div>
        <div class="account-actions"><button class="btn btn-primary" type="submit">Enregistrer les modifications</button></div>
      </form>
    </section>
  `, "profile", mode);
}

function ProfessionalProfileForm() {
  return `
    <section class="settings-section">
      <h2>Profil professionnel</h2>
      <div class="account-grid">
        <label class="auth-field"><span>Nom de l’entreprise</span><input type="text" autocomplete="organization"></label>
        <label class="auth-field"><span>Type professionnel</span><select><option>Agence immobilière</option><option>Hôtel / Auberge / Résidence</option><option>Loueur de voitures</option><option>Garage automobile</option><option>Chauffeur professionnel</option><option>Transporteur</option><option>Autre</option></select></label>
        <label class="auth-field"><span>Adresse</span><input type="text" autocomplete="street-address"></label>
        <label class="auth-field"><span>Ville</span><input type="text" autocomplete="address-level2"></label>
        <label class="auth-field"><span>Logo</span><input type="file" accept="image/*"></label>
        <label class="auth-field"><span>Numéro de téléphone professionnel</span><input type="tel" autocomplete="tel"></label>
        <label class="auth-field"><span>Email professionnel</span><input type="email" autocomplete="email"></label>
        <label class="auth-field"><span>WhatsApp</span><input type="tel"></label>
        <label class="auth-field"><span>Site web</span><input type="url"></label>
        <label class="auth-field"><span>Description</span><textarea></textarea></label>
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

function bindAuthForms() {
  document.querySelector("[data-login-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const target = getRedirectAfterLogin("client", getNextParam());
    window.location.href = authRouteHref(target);
  });

  document.querySelector("[data-register-form]")?.addEventListener("change", (event) => {
    if (event.target.name !== "accountType") return;
    const container = document.querySelector("[data-register-fields]");
    const forms = {
      client: RegisterClientForm,
      advertiser: RegisterAdvertiserForm,
      professional: RegisterProfessionalForm
    };
    container.innerHTML = forms[event.target.value]();
  });

  document.querySelector("[data-register-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    document.querySelector("[data-auth-success]")?.classList.add("is-visible");
  });

  document.querySelectorAll("[data-success-form], [data-settings-form]").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      form.querySelector("[data-auth-success]")?.classList.add("is-visible");
    });
  });

  document.querySelector("[data-open-delete-modal]")?.addEventListener("click", () => {
    document.querySelector("[data-delete-modal]")?.classList.add("is-open");
  });

  document.querySelector("[data-close-delete-modal]")?.addEventListener("click", () => {
    document.querySelector("[data-delete-modal]")?.classList.remove("is-open");
  });
}

function renderAuthPage() {
  const root = document.querySelector("[data-auth-root]");
  if (!root) return;

  const page = document.body.dataset.authPage;
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
    dashboardSettings: () => AccountSettingsPage("dashboard")
  };

  root.innerHTML = (pages[page] || LoginPage)();
  bindAuthForms();
}

document.addEventListener("DOMContentLoaded", renderAuthPage);

const routes = {
  dashboard: "/dashboard/immobilier",
  listings: "/dashboard/immobilier/annonces",
  messages: "/dashboard/immobilier/messages",
  contacts: "/dashboard/immobilier/contacts",
  visits: "/dashboard/immobilier/visites",
  favorites: "/dashboard/immobilier/favoris",
  stats: "/dashboard/immobilier/statistiques",
  contactSettings: "/dashboard/immobilier/contact-settings",
  emailSettings: "/dashboard/immobilier/email-settings",
  profile: "/dashboard/profil"
};

let errorMessage = "";
let successMessage = "";
let preferences = {
  whatsappEnabled: false,
  phoneEnabled: false,
  emailEnabled: false,
  internalMessagingEnabled: false,
  contactFormEnabled: false,
  visitRequestEnabled: false,
  emailNotificationsEnabled: false,
  automaticEmailsEnabled: false,
  notifyOnNewMessage: false,
  notifyOnVisitRequest: false,
  notifyOnContactForm: false,
  useContactEmailForNotifications: false,
  whatsappNumber: "",
  phoneNumber: "",
  contactEmail: "",
  notificationEmail: "",
  preferredContactMethod: ""
};

const sidebarItems = [
  ["Vue d’ensemble", routes.dashboard],
  ["Mes annonces", routes.listings],
  ["Messages", routes.messages, "0"],
  ["Contacts", routes.contacts, "0"],
  ["Demandes de visite", routes.visits, "0"],
  ["Favoris reçus", routes.favorites],
  ["Statistiques", routes.stats],
  ["Moyens de contact", routes.contactSettings],
  ["Emails automatiques", routes.emailSettings],
  ["Mon profil", routes.profile]
];

const contactMethodLabels = {
  whatsapp: "WhatsApp",
  phone: "Appel téléphonique",
  email: "Email",
  internal_message: "Messagerie Péncmi",
  form: "Formulaire",
  visit_request: "Demande de visite"
};

function routeHref(path) {
  if (window.location.protocol !== "file:") {
    return path;
  }

  if (path === "/dashboard/immobilier") {
    return "../";
  }

  if (path === "/dashboard/immobilier/annonces") {
    return "../annonces/";
  }

  if (path === "/dashboard/immobilier/contact-settings") {
    return "./";
  }

  if (path === "/dashboard/immobilier/email-settings") {
    return "../email-settings/";
  }

  return path;
}

function validatePhoneNumber(value) {
  const normalized = normalizePhoneNumber(value);
  return /^\+?\d{8,15}$/.test(normalized);
}

function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function normalizePhoneNumber(value) {
  return String(value || "").replace(/[^\d+]/g, "");
}

function getEnabledContactMethods(data = preferences) {
  const methods = [];

  if (data.whatsappEnabled) methods.push("whatsapp");
  if (data.phoneEnabled) methods.push("phone");
  if (data.emailEnabled) methods.push("email");
  if (data.internalMessagingEnabled) methods.push("internal_message");
  if (data.contactFormEnabled) methods.push("form");
  if (data.visitRequestEnabled) methods.push("visit_request");

  return methods;
}

function getPreferredContactMethod(data = preferences) {
  const enabledMethods = getEnabledContactMethods(data);
  return enabledMethods.includes(data.preferredContactMethod) ? data.preferredContactMethod : "";
}

function buildContactButtonsPreview(data = preferences) {
  const buttons = [];

  if (data.whatsappEnabled) buttons.push("WhatsApp");
  if (data.phoneEnabled) buttons.push("Appeler");
  if (data.emailEnabled) buttons.push("Email");
  if (data.internalMessagingEnabled) buttons.push("Envoyer un message");
  if (data.visitRequestEnabled) buttons.push("Demander une visite");
  if (data.contactFormEnabled) buttons.push("Demander plus d’informations");

  return buttons;
}

function validateContactPreferences(data = preferences) {
  const enabledMethods = getEnabledContactMethods(data);

  if (!enabledMethods.length) {
    return "Veuillez activer au moins un moyen de contact.";
  }

  if (data.whatsappEnabled && !validatePhoneNumber(data.whatsappNumber)) {
    return "Veuillez renseigner un numéro WhatsApp valide.";
  }

  if (data.phoneEnabled && !validatePhoneNumber(data.phoneNumber)) {
    return "Veuillez renseigner un numéro de téléphone valide.";
  }

  if (data.emailEnabled && !validateEmail(data.contactEmail)) {
    return "Veuillez renseigner une adresse email valide.";
  }

  if (data.emailNotificationsEnabled && !validateEmail(data.notificationEmail)) {
    return "Veuillez renseigner un email de notification valide.";
  }

  if (data.preferredContactMethod && !enabledMethods.includes(data.preferredContactMethod)) {
    return "La méthode préférée doit être activée.";
  }

  return "";
}

function DashboardSidebar() {
  return `
    <aside class="dashboard-sidebar" id="dashboard-sidebar">
      <div class="dashboard-brand">
        <span>P</span>
        <div>
          <strong>Péncmi</strong>
          <small>Annonceur immobilier</small>
        </div>
      </div>
      <nav class="dashboard-nav" aria-label="Navigation dashboard">
        ${sidebarItems.map(([label, href, badge]) => `
          <a href="${routeHref(href)}"${href === routes.contactSettings ? ' aria-current="page"' : ""}>
            <span>${label}</span>
            ${badge ? `<span class="notification-badge">${badge}</span>` : ""}
          </a>
        `).join("")}
      </nav>
    </aside>
  `;
}

function ContactSettingsHeader() {
  return `
    <header class="dashboard-header">
      <div>
        <button class="btn btn-ghost dashboard-menu-toggle" type="button" data-open-sidebar>Menu</button>
        <h1>Moyens de contact</h1>
        <p>Choisissez comment les clients peuvent vous contacter sur vos annonces immobilières.</p>
        <button class="btn btn-ghost summary-toggle" type="button" data-toggle-summary>Voir le résumé</button>
      </div>
      <div class="dashboard-header-actions">
        <a class="btn btn-ghost" href="${routeHref(routes.dashboard)}">Retour au dashboard</a>
        <a class="btn btn-light" href="${routes.listings}">Voir mes annonces</a>
        <a class="btn btn-light" href="${routeHref(routes.emailSettings)}">Emails automatiques</a>
      </div>
    </header>
  `;
}

function ContactMethodToggle(key, label) {
  return `
    <label class="contact-option">
      <input type="checkbox" data-pref="${key}"${preferences[key] ? " checked" : ""}>
      <strong>${label}</strong>
    </label>
  `;
}

function PhoneNumberInput(key, label, placeholder) {
  return `
    <label class="contact-field">
      <span>${label}</span>
      <input type="tel" data-pref="${key}" value="${preferences[key] || ""}" placeholder="${placeholder}">
    </label>
  `;
}

function EmailInput(key, label, placeholder) {
  return `
    <label class="contact-field">
      <span>${label}</span>
      <input type="email" data-pref="${key}" value="${preferences[key] || ""}" placeholder="${placeholder}">
    </label>
  `;
}

function PreferredContactSelect() {
  return `
    <section class="contact-card-section">
      <h2>Méthode préférée</h2>
      <p>Choisissez le moyen de contact à mettre en avant sur vos annonces.</p>
      <div class="contact-field-grid">
        <label class="contact-field">
          <span>Méthode de contact préférée</span>
          <select data-pref="preferredContactMethod">
            <option value="">Sélectionner une méthode</option>
            ${Object.entries(contactMethodLabels)
              .filter(([key]) => key !== "visit_request")
              .map(([key, label]) => `<option value="${key}"${preferences.preferredContactMethod === key ? " selected" : ""}>${label}</option>`)
              .join("")}
          </select>
        </label>
      </div>
    </section>
  `;
}

function EmailNotificationSettings() {
  return `
    <section class="contact-card-section">
      <h2>Notifications email</h2>
      <p>Recevez un email lorsqu’un client vous écrit ou demande une visite.</p>
      ${ContactMethodToggle("emailNotificationsEnabled", "Activer les notifications email")}
      <div class="contact-field-grid">
        ${EmailInput("notificationEmail", "Email de notification", "notification@exemple.com")}
      </div>
      ${ContactMethodToggle("useContactEmailForNotifications", "Utiliser le même email que l’email de contact")}
      ${ContactMethodToggle("notifyOnNewMessage", "Recevoir un email pour les nouveaux messages")}
      ${ContactMethodToggle("notifyOnVisitRequest", "Recevoir un email pour les demandes de visite")}
      ${ContactMethodToggle("notifyOnContactForm", "Recevoir un email pour les formulaires de demande")}
      ${ContactMethodToggle("automaticEmailsEnabled", "Activer les emails automatiques client")}
    </section>
  `;
}

function ContactSettingsSummary() {
  const enabledMethods = getEnabledContactMethods();
  const line = (label, active) => `
    <div class="summary-line">
      <span>${label}</span>
      <strong>${active ? "Activé" : "Désactivé"}</strong>
    </div>
  `;

  return `
    <aside class="contact-summary" id="contact-summary">
      <h2>Résumé</h2>
      ${!enabledMethods.length ? `<p class="dashboard-muted">Activez au moins un moyen de contact pour recevoir des demandes.</p>` : ""}
      <div class="summary-list">
        ${line("WhatsApp", preferences.whatsappEnabled)}
        ${line("Appel", preferences.phoneEnabled)}
        ${line("Email", preferences.emailEnabled)}
        ${line("Messagerie Péncmi", preferences.internalMessagingEnabled)}
        ${line("Formulaire", preferences.contactFormEnabled)}
        ${line("Demande de visite", preferences.visitRequestEnabled)}
        ${line("Notifications email", preferences.emailNotificationsEnabled)}
        ${line("Emails automatiques", preferences.automaticEmailsEnabled)}
        <div class="summary-line">
          <span>Méthode préférée</span>
          <strong>${contactMethodLabels[getPreferredContactMethod()] || "Non définie"}</strong>
        </div>
      </div>
      ${ListingContactPreview()}
    </aside>
  `;
}

function ListingContactPreview() {
  const buttons = buildContactButtonsPreview();

  return `
    <section class="contact-preview">
      <h3>Aperçu sur vos annonces</h3>
      <div class="preview-buttons">
        ${buttons.length ? buttons.map((label) => `<button class="btn btn-light" type="button">${label}</button>`).join("") : `<p class="dashboard-muted">Aucun bouton de contact actif.</p>`}
      </div>
    </section>
  `;
}

function ContactSettingsSaveBar() {
  return `
    <div class="settings-save-bar">
      <a class="btn btn-ghost" href="${routeHref(routes.dashboard)}">Annuler</a>
      <button class="btn btn-primary" type="button" data-save-settings>Enregistrer les paramètres</button>
    </div>
  `;
}

function FormErrorMessage(message) {
  return message ? `<div class="form-error">${message}</div>` : "";
}

function ContactSettingsForm() {
  return `
    <section class="contact-settings-form">
      <section class="contact-card-section">
        <h2>WhatsApp</h2>
        <p>Permettez aux clients de vous contacter directement par WhatsApp.</p>
        ${ContactMethodToggle("whatsappEnabled", "Activer WhatsApp")}
        <div class="contact-field-grid">
          ${PhoneNumberInput("whatsappNumber", "Numéro WhatsApp", "+221 77 000 00 00")}
        </div>
      </section>

      <section class="contact-card-section">
        <h2>Appel téléphonique</h2>
        <p>Affichez un bouton d’appel sur vos annonces.</p>
        ${ContactMethodToggle("phoneEnabled", "Activer l’appel téléphonique")}
        <div class="contact-field-grid">
          ${PhoneNumberInput("phoneNumber", "Numéro de téléphone", "+221 77 000 00 00")}
        </div>
      </section>

      <section class="contact-card-section">
        <h2>Email</h2>
        <p>Permettez aux clients de vous contacter par email.</p>
        ${ContactMethodToggle("emailEnabled", "Activer le contact par email")}
        <div class="contact-field-grid">
          ${EmailInput("contactEmail", "Email de contact", "contact@exemple.com")}
        </div>
      </section>

      <section class="contact-card-section">
        <h2>Messagerie Péncmi</h2>
        <p>Recevez et répondez aux messages des clients directement depuis votre espace.</p>
        ${ContactMethodToggle("internalMessagingEnabled", "Activer la messagerie interne Péncmi")}
      </section>

      <section class="contact-card-section">
        <h2>Formulaire de demande</h2>
        <p>Les clients peuvent vous envoyer une demande depuis un formulaire.</p>
        ${ContactMethodToggle("contactFormEnabled", "Activer le formulaire de demande")}
      </section>

      <section class="contact-card-section">
        <h2>Demande de visite</h2>
        <p>Permettez aux clients de demander une visite pour vos biens.</p>
        ${ContactMethodToggle("visitRequestEnabled", "Activer les demandes de visite")}
      </section>

      ${EmailNotificationSettings()}
      ${PreferredContactSelect()}
      ${FormErrorMessage(errorMessage)}
      ${successMessage ? `<div class="success-message">${successMessage}</div>` : ""}
      ${ContactSettingsSaveBar()}
    </section>
  `;
}

function ContactSettingsPage() {
  document.querySelector("#contact-settings-page").innerHTML = `
    <div class="dashboard-shell">
      ${DashboardSidebar()}
      <main class="dashboard-main">
        ${ContactSettingsHeader()}
        <div class="contact-settings-layout">
          ${ContactSettingsForm()}
          ${ContactSettingsSummary()}
        </div>
      </main>
    </div>
  `;

  bindContactSettingsEvents();
}

function coercePreferenceValue(input) {
  if (input.type === "checkbox") {
    return input.checked;
  }

  return input.value;
}

function bindContactSettingsEvents() {
  document.querySelector("[data-open-sidebar]")?.addEventListener("click", () => {
    document.querySelector("#dashboard-sidebar").classList.toggle("is-open");
  });

  document.querySelector("[data-toggle-summary]")?.addEventListener("click", () => {
    document.querySelector("#contact-summary").classList.toggle("is-open");
  });

  document.querySelectorAll("[data-pref]").forEach((input) => {
    input.addEventListener("change", () => {
      preferences[input.dataset.pref] = coercePreferenceValue(input);

      if (input.dataset.pref === "useContactEmailForNotifications" && input.checked) {
        preferences.notificationEmail = preferences.contactEmail;
      }

      errorMessage = "";
      successMessage = "";
      ContactSettingsPage();
    });
  });

  document.querySelector("[data-save-settings]")?.addEventListener("click", () => {
    if (preferences.useContactEmailForNotifications) {
      preferences.notificationEmail = preferences.contactEmail;
    }

    errorMessage = validateContactPreferences();
    successMessage = errorMessage ? "" : "Vos moyens de contact ont été mis à jour.";
    ContactSettingsPage();
  });
}

ContactSettingsPage();

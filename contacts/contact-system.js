const contactChannels = {
  whatsapp: "WhatsApp",
  phone: "Appeler",
  email: "Email",
  internal_message: "Envoyer un message",
  form: "Demander plus d’informations",
  visit_request: "Demander une visite",
  reservation_request: "Demander une réservation",
  seat_request: "Demander une place"
};

const contactHistories = [];
const emailLogs = [];

const emailSettingsConfig = {
  real_estate: {
    title: "Emails automatiques immobilier",
    subtitle: "Configurez les emails liés aux biens, demandes d’information et visites.",
    dashboardLabel: "Annonceur immobilier",
    basePath: "/dashboard/immobilier",
    localBase: "../",
    templates: [
      ["request_received", "Votre demande concernant ce bien a été envoyée", "Bonjour {{clientName}},\nVotre demande concernant {{listingTitle}} a bien été envoyée."],
      ["message_received", "Nouveau message concernant un bien immobilier", "Vous avez un nouveau message concernant {{listingTitle}}."],
      ["visit_proposed", "Une visite vous a été proposée", "Une visite vous a été proposée le {{visitDate}} à {{visitTime}}."],
      ["visit_confirmed", "Votre visite est confirmée", "Votre visite pour {{listingTitle}} est confirmée."],
      ["visit_cancelled", "Votre visite a été annulée", "La visite prévue pour {{listingTitle}} a été annulée."]
    ],
    variables: ["clientName", "listingTitle", "propertyType", "transaction", "city", "district", "price", "visitDate", "visitTime", "advertiserName", "advertiserPhone", "advertiserWhatsapp", "conversationLink"]
  },
  hotels: {
    title: "Emails automatiques hôtels",
    subtitle: "Configurez les emails liés aux réservations, chambres, arrivées et départs.",
    dashboardLabel: "Annonceur hôtels",
    basePath: "/dashboard/hotels",
    localBase: "../",
    templates: [
      ["request_received", "Votre demande de réservation a bien été envoyée", "Bonjour {{clientName}},\nVotre demande pour {{hotelName}} du {{checkIn}} au {{checkOut}} a bien été envoyée."],
      ["request_accepted", "Votre réservation a été acceptée", "Votre réservation pour {{hotelName}} a été acceptée."],
      ["request_refused", "Votre demande de réservation n’a pas été acceptée", "Votre demande pour {{hotelName}} n’a pas été acceptée."],
      ["request_cancelled", "Votre réservation a été annulée", "Votre réservation pour {{hotelName}} a été annulée."],
      ["arrival_reminder", "Rappel de votre séjour", "Votre séjour à {{hotelName}} commence bientôt."],
      ["post_service_message", "Message après départ", "Merci pour votre séjour à {{hotelName}}."]
    ],
    variables: ["clientName", "hotelName", "roomName", "checkIn", "checkOut", "nights", "adults", "children", "roomsRequested", "estimatedPrice", "reservationStatus", "availabilityStatus", "hotelPhone", "hotelWhatsapp", "hotelEmail", "reservationLink", "conversationLink"],
    delays: ["24h avant arrivée", "48h avant arrivée", "Après départ"]
  },
  vehicles: {
    title: "Emails automatiques voitures",
    subtitle: "Configurez les emails selon le type d’annonce : vente, location ou chauffeur.",
    dashboardLabel: "Annonceur voitures",
    basePath: "/dashboard/voitures",
    localBase: "../",
    templates: [
      ["request_received", "Votre demande concernant ce véhicule a été envoyée", "Votre demande concernant {{vehicleTitle}} a bien été envoyée."],
      ["message_received", "Nouveau message du vendeur", "Vous avez un nouveau message concernant {{vehicleTitle}}."],
      ["request_accepted", "Votre location de voiture a été acceptée", "Votre demande de location de {{vehicleTitle}} a été acceptée."],
      ["arrival_reminder", "Rappel de votre location", "Rappel pour la récupération de {{vehicleTitle}}."],
      ["price_drop_alert", "Le prix d’un véhicule favori a changé", "Le prix de {{vehicleTitle}} a changé."]
    ],
    variables: ["clientName", "vehicleTitle", "brand", "model", "year", "mileage", "fuel", "gearbox", "price", "pickupDate", "returnDate", "estimatedPrice", "deposit", "pickupLocation", "destination", "driverName", "conversationLink"]
  },
  trips: {
    title: "Emails automatiques voyages",
    subtitle: "Configurez les emails liés aux demandes de place, départs, annulations et messages.",
    dashboardLabel: "Annonceur voyages",
    basePath: "/dashboard/voyages",
    localBase: "../",
    templates: [
      ["request_received", "Votre demande de place a bien été envoyée", "Votre demande de place pour {{departureCity}} → {{arrivalCity}} a bien été envoyée."],
      ["request_accepted", "Votre place a été acceptée", "Votre place pour {{departureCity}} → {{arrivalCity}} est acceptée."],
      ["request_refused", "Votre demande de place n’a pas été acceptée", "Votre demande de place n’a pas été acceptée."],
      ["request_cancelled", "Votre trajet a été annulé", "Le trajet {{departureCity}} → {{arrivalCity}} a été annulé."],
      ["arrival_reminder", "Rappel de votre départ", "Votre départ est prévu le {{departureDate}} à {{departureTime}}."],
      ["schedule_changed", "Horaire de trajet modifié", "L’horaire du trajet {{departureCity}} → {{arrivalCity}} a été modifié."]
    ],
    variables: ["clientName", "departureCity", "arrivalCity", "departurePoint", "arrivalPoint", "departureDate", "departureTime", "requestedSeats", "pricePerSeat", "estimatedPrice", "luggage", "transportProviderName", "transportProviderPhone", "transportProviderWhatsapp", "tripStatus", "reservationStatus", "conversationLink"]
  }
};

function getCurrentEmailModule() {
  return document.body.dataset.emailModule || "real_estate";
}

function emailRoute(path) {
  if (window.location.protocol !== "file:") {
    return path;
  }

  const moduleKey = getCurrentEmailModule();
  const config = emailSettingsConfig[moduleKey];
  if (path === config.basePath) return config.localBase;
  if (path === `${config.basePath}/email-settings`) return "./";
  if (path === `${config.basePath}/contact-settings`) return "../contact-settings/";
  return path;
}

function EmailDashboardSidebar() {
  const moduleKey = getCurrentEmailModule();
  const config = emailSettingsConfig[moduleKey];
  return `
    <aside class="dashboard-sidebar" id="email-sidebar">
      <div class="dashboard-brand"><span>P</span><div><strong>Péncmi</strong><small>${config.dashboardLabel}</small></div></div>
      <nav class="dashboard-nav">
        <a href="${emailRoute(config.basePath)}"><span>Dashboard</span></a>
        <a href="${emailRoute(`${config.basePath}/contact-settings`)}"><span>Moyens de contact</span></a>
        <a href="${emailRoute(`${config.basePath}/email-settings`)}" aria-current="page"><span>Emails automatiques</span></a>
      </nav>
    </aside>
  `;
}

function ContactButtonsPreview(channels = []) {
  return `<section class="contact-system-card"><h2>Aperçu des boutons côté client</h2><div class="contact-preview-buttons">${channels.length ? channels.map((channel) => `<button class="btn btn-light" type="button">${contactChannels[channel]}</button>`).join("") : `<p>Aucun bouton actif.</p>`}</div></section>`;
}

function ContactMethodToggle(key, label, enabled = false) {
  return `<label class="choice-card"><input type="checkbox" data-contact-pref="${key}"${enabled ? " checked" : ""}><span>${label}</span></label>`;
}

function ContactPreferencesSummary(channels = []) {
  return `<section class="contact-system-card"><h2>Résumé des moyens activés</h2><div class="contact-badge-row">${channels.length ? channels.map((channel) => `<span class="contact-source-badge">${contactChannels[channel]}</span>`).join("") : `<span class="contact-source-badge">Aucun canal actif</span>`}</div></section>`;
}

function ModuleContactForm(moduleKey = "real_estate") {
  const extra = {
    real_estate: ["visit_request"],
    hotels: ["reservation_request"],
    vehicles: [],
    trips: ["seat_request"]
  }[moduleKey] || [];
  const channels = ["whatsapp", "phone", "email", "internal_message", "form", ...extra];
  return `<section class="contact-system-card"><h2>Canaux disponibles</h2><div class="contact-settings-grid">${channels.map((channel) => ContactMethodToggle(channel, contactChannels[channel])).join("")}</div></section>`;
}

function ContactModal(moduleKey = "real_estate") {
  const title = moduleKey === "vehicles" ? "Contacter l’annonceur" : "Envoyer un message";
  return `<section class="contact-system-card"><h2>${title}</h2><div class="contact-settings-grid"><label class="contact-field-common"><span>Nom</span><input type="text"></label><label class="contact-field-common"><span>Téléphone</span><input type="tel"></label><label class="contact-field-common"><span>Email</span><input type="email"></label><label class="contact-field-common"><span>Message</span><input type="text"></label></div></section>`;
}

function ContactSourceBadge(source) {
  return `<span class="contact-source-badge">${contactChannels[source] || source}</span>`;
}

function ContactStatusBadge(status) {
  const labels = { new: "Nouveau", read: "Lu", replied: "Répondu", closed: "Clôturé" };
  return `<span class="contact-status-badge">${labels[status] || status}</span>`;
}

function EmailStatusBadge(status) {
  const labels = { pending: "En attente", sent: "Envoyé", failed: "Échec", cancelled: "Annulé" };
  return `<span class="email-status-badge">${labels[status] || status}</span>`;
}

function ContactHistoryTable() {
  return `
    <section class="contact-history-card">
      <h2>Historique des contacts</h2>
      ${contactHistories.length ? `<div class="contact-table-wrap"><table class="contact-table"><thead><tr><th>Module</th><th>Annonce</th><th>Client</th><th>Source</th><th>Statut</th><th>Email</th><th>Date</th></tr></thead><tbody></tbody></table></div>` : `<p>Aucun contact reçu pour le moment.</p>`}
    </section>
  `;
}

function EmailTemplateList(config) {
  return `
    <section class="contact-system-card">
      <h2>Modèles disponibles</h2>
      <div class="email-template-list">
        ${config.templates.length ? config.templates.map(([trigger, subject], index) => `
          <article class="email-template-item">
            <header><h3>${subject}</h3><label><input type="checkbox" checked> Actif</label></header>
            <span class="email-status-badge">${trigger}</span>
            <button class="btn btn-ghost" type="button" data-select-template="${index}">Modifier</button>
          </article>
        `).join("") : `<p>Aucun email automatique configuré pour le moment.</p>`}
      </div>
    </section>
  `;
}

function EmailTemplateEditor(config) {
  const template = config.templates[0];
  return `
    <section class="email-editor-card">
      <h2>Modifier le modèle</h2>
      <div class="email-editor-grid">
        <label class="email-field"><span>Déclencheur</span><select><option>${template[0]}</option></select></label>
        <label class="email-field"><span>Statut</span><select><option>Activé</option><option>Désactivé</option></select></label>
        <label class="email-field full"><span>Objet</span><input type="text" value="${template[1]}"></label>
        <label class="email-field full"><span>Message</span><textarea>${template[2]}</textarea></label>
        <label class="email-field"><span>Délai</span><input type="number" min="0" placeholder="24"></label>
        <label class="email-field"><span>Unité</span><select><option>minutes</option><option>heures</option><option>jours</option></select></label>
      </div>
      <div class="email-actions">
        <button class="btn btn-light" type="button">Prévisualiser</button>
        <button class="btn btn-ghost" type="button">Restaurer le modèle</button>
        <button class="btn btn-primary" type="button">Enregistrer</button>
        <button class="btn btn-ghost" type="button">Envoyer un test</button>
      </div>
    </section>
  `;
}

function EmailVariablesPanel(config) {
  return `<section class="contact-system-card"><h2>Variables disponibles</h2><div class="variables-list">${config.variables.map((variable) => `<span class="variable-chip">{{${variable}}}</span>`).join("")}</div></section>`;
}

function EmailPreview(config) {
  const template = config.templates[0];
  return `<section class="email-preview-card"><h2>Aperçu</h2><div class="email-preview-box"><strong>${template[1]}</strong>\n\n${template[2]}</div></section>`;
}

function EmailLogTable() {
  return `<section class="email-log-card"><h2>Derniers envois</h2>${emailLogs.length ? `<div class="contact-table-wrap"><table class="contact-table"><thead><tr><th>Destinataire</th><th>Objet</th><th>Statut</th><th>Date</th></tr></thead><tbody></tbody></table></div>` : `<p>Aucun email envoyé pour le moment.</p>`}</section>`;
}

function EmailSettingsPage() {
  const moduleKey = getCurrentEmailModule();
  const config = emailSettingsConfig[moduleKey];
  document.querySelector("#email-settings-root").innerHTML = `
    <div class="dashboard-shell">
      ${EmailDashboardSidebar()}
      <main class="dashboard-main">
        <header class="dashboard-header">
          <div><button class="btn btn-ghost dashboard-menu-toggle" type="button" data-open-sidebar>Menu</button><h1>${config.title}</h1><p>${config.subtitle}</p></div>
          <div class="dashboard-header-actions"><a class="btn btn-ghost" href="${emailRoute(`${config.basePath}/contact-settings`)}">Moyens de contact</a></div>
        </header>
        <div class="contact-system-layout">
          <div>
            ${EmailTemplateList(config)}
            ${EmailTemplateEditor(config)}
            ${ContactHistoryTable()}
            ${EmailLogTable()}
          </div>
          <aside>
            ${EmailVariablesPanel(config)}
            ${EmailPreview(config)}
          </aside>
        </div>
      </main>
    </div>
  `;
  document.querySelector("[data-open-sidebar]")?.addEventListener("click", () => document.querySelector("#email-sidebar").classList.toggle("is-open"));
}

if (document.querySelector("#email-settings-root")) {
  EmailSettingsPage();
}

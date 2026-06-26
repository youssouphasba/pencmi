const routes = {
  dashboard: "/dashboard/immobilier",
  listings: "/dashboard/immobilier/annonces",
  messages: "/dashboard/immobilier/messages",
  contacts: "/dashboard/immobilier/contacts",
  visits: "/dashboard/immobilier/visites",
  favorites: "/dashboard/immobilier/favoris",
  stats: "/dashboard/immobilier/statistiques",
  contactSettings: "/dashboard/immobilier/contact-settings",
  profile: "/dashboard/profil"
};

let visitRequests = [];
let activeStatus = "all";

function getApiBaseUrl() {
  return String(window.PencmiConfig?.apiBaseUrl || window.PencmiRuntimeConfig?.apiBaseUrl || window.PencmiApiBaseUrl || window.localStorage.getItem("pencmi_api_base_url") || "").replace(/\/+$/, "");
}

function getAccessToken() {
  return window.localStorage.getItem("pencmi_access_token") || "";
}

function listFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

async function apiRequest(path, options = {}) {
  const baseUrl = getApiBaseUrl();
  const token = getAccessToken();
  if (!baseUrl || !token) {
    throw new Error("Connexion annonceur requise.");
  }
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message || "Chargement impossible.");
  }
  return payload?.data ?? payload;
}

function routeHref(path) {
  if (window.location.protocol !== "file:") {
    return path;
  }
  if (path === routes.dashboard) return "../";
  if (path === routes.listings) return "../annonces/";
  if (path === routes.favorites) return "../favoris/";
  if (path === routes.stats) return "../statistiques/";
  if (path === routes.contactSettings) return "../contact-settings/";
  if (path === routes.visits) return "./";
  return path;
}

function DashboardSidebar() {
  const visitCount = String(visitRequests.length || 0);
  const items = [
    ["Vue d’ensemble", routes.dashboard],
    ["Mes annonces", routes.listings],
    ["Messages", routes.messages],
    ["Contacts", routes.contacts, visitCount],
    ["Demandes de visite", routes.visits, visitCount],
    ["Favoris reçus", routes.favorites],
    ["Statistiques", routes.stats],
    ["Moyens de contact", routes.contactSettings],
    ["Mon profil", routes.profile]
  ];

  return `
    <aside class="dashboard-sidebar" id="dashboard-sidebar">
      <div class="dashboard-brand"><span>P</span><div><strong>Péncmi</strong><small>Annonceur immobilier</small></div></div>
      <nav class="dashboard-nav">${items.map(([label, href, badge]) => `
        <a href="${routeHref(href)}"${href === routes.visits ? ' aria-current="page"' : ""}>
          <span>${label}</span>${badge ? `<span class="notification-badge">${badge}</span>` : ""}
        </a>`).join("")}</nav>
    </aside>
  `;
}

function VisitStatusBadge(status) {
  const labels = {
    new: "Nouvelle",
    pending: "Visite proposée",
    accepted: "Confirmée",
    refused: "Refusée",
    cancelled: "Annulée",
    completed: "Terminée",
    requires_more_info: "Infos demandées"
  };
  return `<span class="status-badge">${labels[status] || "À renseigner"}</span>`;
}

function VisitRequestCard(visit) {
  return `
    <article class="page-panel visit-card">
      <h3>${visit.clientName || "Client"}</h3>
      <p>${visit.listing?.title || visit.listingTitle || ""} ${VisitStatusBadge(visit.status)}</p>
      <p>${[visit.clientPhone, visit.clientEmail].filter(Boolean).join(" · ")}</p>
      ${visit.message ? `<p>${visit.message}</p>` : ""}
      <div class="page-actions">
        <button type="button" data-open-detail>Voir détail</button>
        <button type="button" data-visit-status="pending" data-visit-id="${visit.id}">Proposer un créneau</button>
        <button type="button" data-visit-status="accepted" data-visit-id="${visit.id}">Confirmer</button>
        <button type="button" data-visit-status="requires_more_info" data-visit-id="${visit.id}">Demander des infos</button>
        <button type="button" data-visit-status="cancelled" data-visit-id="${visit.id}">Annuler</button>
        <button type="button" data-visit-status="completed" data-visit-id="${visit.id}">Marquer terminée</button>
        <button type="button">Répondre au client</button>
        <a href="${routes.messages}">Ouvrir conversation</a>
      </div>
    </article>
  `;
}

function VisitRequestTable() {
  const filteredVisits = activeStatus === "all" ? visitRequests : visitRequests.filter((visit) => visit.status === activeStatus);
  return filteredVisits.length
    ? `<div class="cards-list">${filteredVisits.map(VisitRequestCard).join("")}</div>`
    : EmptyState("Aucune demande de visite pour le moment.", [
      ["Voir mes annonces", routes.listings],
      ["Configurer mes moyens de contact", routes.contactSettings]
    ]);
}

function VisitProposalModal() {
  return `
    <div class="modal-backdrop">
      <div class="modal-panel">
        <h2>Proposer un créneau</h2>
        <form class="modal-form">
          <input type="date">
          <input type="time">
          <textarea placeholder="Message optionnel"></textarea>
          <div class="page-actions">
            <button type="button">Envoyer la proposition</button>
            <button type="button" data-close-modal>Annuler</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function VisitDetailModal() {
  return `
    <div class="modal-backdrop">
      <div class="modal-panel">
        <h2>Détail de la demande de visite</h2>
        <p>Les informations complètes de la demande seront affichées ici quand les données seront connectées.</p>
        <button class="btn btn-ghost" type="button" data-close-modal>Fermer</button>
      </div>
    </div>
  `;
}

function EmptyState(title, actions = []) {
  return `
    <section class="empty-panel">
      <div>
        <h2>${title}</h2>
        <p>Les données apparaîtront ici dès qu’elles seront disponibles.</p>
        <div class="page-actions">${actions.map(([label, href]) => `<a href="${routeHref(href)}">${label}</a>`).join("")}</div>
      </div>
    </section>
  `;
}

function VisitsPage() {
  document.querySelector("#visits-page").innerHTML = `
    <div class="dashboard-shell">
      ${DashboardSidebar()}
      <main class="dashboard-main">
        <header class="dashboard-header">
          <div><button class="btn btn-ghost dashboard-menu-toggle" type="button" data-open-sidebar>Menu</button><h1>Demandes de visite</h1><p>Gérez les demandes de visite reçues sur vos annonces immobilières.</p></div>
        </header>
        <div class="status-tabs">${[["Toutes", "all"], ["Nouvelles", "new"], ["Proposées", "pending"], ["Confirmées", "accepted"], ["Infos demandées", "requires_more_info"], ["Annulées", "cancelled"], ["Terminées", "completed"]].map(([label, status]) => `<button class="${activeStatus === status ? "is-active" : ""}" type="button" data-status="${status}">${label}</button>`).join("")}</div>
        <section class="filter-strip"><input type="search" placeholder="Recherche par client, annonce ou ville"></section>
        ${VisitRequestTable()}
      </main>
    </div>
  `;
  bindEvents();
}

async function updateVisitStatus(id, status) {
  const updated = await apiRequest(`/dashboard/immobilier/visits/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });
  visitRequests = visitRequests.map((visit) => visit.id === id ? updated : visit);
  VisitsPage();
}

function openModal(content) {
  document.querySelector("#modal-root").innerHTML = content;
  document.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", () => document.querySelector("#modal-root").innerHTML = ""));
}

function bindEvents() {
  document.querySelector("[data-open-sidebar]")?.addEventListener("click", () => document.querySelector("#dashboard-sidebar").classList.toggle("is-open"));
  document.querySelectorAll("[data-status]").forEach((button) => button.addEventListener("click", () => { activeStatus = button.dataset.status; VisitsPage(); }));
  document.querySelectorAll("[data-open-proposal]").forEach((button) => button.addEventListener("click", () => openModal(VisitProposalModal())));
  document.querySelectorAll("[data-open-detail]").forEach((button) => button.addEventListener("click", () => openModal(VisitDetailModal())));
  document.querySelectorAll("[data-visit-status]").forEach((button) => {
    button.addEventListener("click", () => {
      button.disabled = true;
      void updateVisitStatus(button.dataset.visitId, button.dataset.visitStatus).catch(() => {
        button.disabled = false;
      });
    });
  });
}

async function loadVisitRequests() {
  VisitsPage();
  try {
    const payload = await apiRequest("/dashboard/immobilier/visits");
    visitRequests = listFromPayload(payload);
  } catch {
    visitRequests = [];
  }
  VisitsPage();
}

void loadVisitRequests();

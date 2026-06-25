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

const visitRequests = [];
let activeStatus = "all";

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
  const items = [
    ["Vue d’ensemble", routes.dashboard],
    ["Mes annonces", routes.listings],
    ["Messages", routes.messages, "0"],
    ["Contacts", routes.contacts, "0"],
    ["Demandes de visite", routes.visits, "0"],
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
  const labels = { new: "Nouvelle", proposed: "Visite proposée", confirmed: "Confirmée", cancelled: "Annulée", completed: "Terminée" };
  return `<span class="status-badge">${labels[status] || status}</span>`;
}

function VisitRequestCard(visit) {
  return `
    <article class="page-panel visit-card">
      <h3>${visit.clientName || "Client"}</h3>
      <p>${visit.listingTitle || ""} ${VisitStatusBadge(visit.status)}</p>
      <div class="page-actions">
        <button type="button" data-open-detail>Voir détail</button>
        <button type="button" data-open-proposal>Proposer un créneau</button>
        <button type="button">Confirmer</button>
        <button type="button">Annuler</button>
        <button type="button">Répondre au client</button>
        <a href="${routes.messages}">Ouvrir conversation</a>
      </div>
    </article>
  `;
}

function VisitRequestTable() {
  return visitRequests.length
    ? `<div class="cards-list">${visitRequests.map(VisitRequestCard).join("")}</div>`
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
        <div class="status-tabs">${[["Toutes", "all"], ["Nouvelles", "new"], ["Proposées", "proposed"], ["Confirmées", "confirmed"], ["Annulées", "cancelled"], ["Terminées", "completed"]].map(([label, status]) => `<button class="${activeStatus === status ? "is-active" : ""}" type="button" data-status="${status}">${label}</button>`).join("")}</div>
        <section class="filter-strip"><input type="search" placeholder="Recherche par client, annonce ou ville"></section>
        ${VisitRequestTable()}
      </main>
    </div>
  `;
  bindEvents();
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
}

VisitsPage();

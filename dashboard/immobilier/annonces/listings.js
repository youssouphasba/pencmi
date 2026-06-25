const routes = {
  dashboard: "/dashboard/immobilier",
  listings: "/dashboard/immobilier/annonces",
  messages: "/dashboard/immobilier/messages",
  contacts: "/dashboard/immobilier/contacts",
  visits: "/dashboard/immobilier/visites",
  favorites: "/dashboard/immobilier/favoris",
  stats: "/dashboard/immobilier/statistiques",
  contactSettings: "/dashboard/immobilier/contact-settings",
  profile: "/dashboard/profil",
  publish: "/publier?category=immobilier"
};

const advertiserListings = [];
let activeStatus = "all";
let filters = {
  query: "",
  status: "all",
  transaction: "all",
  propertyType: "all",
  region: "",
  city: "",
  period: "all",
  performance: "all"
};

const statusTabs = [
  ["Toutes", "all"],
  ["Actives", "active"],
  ["En attente", "pending_review"],
  ["Brouillons", "draft"],
  ["Suspendues", "suspended"],
  ["Expirées", "expired"],
  ["Supprimées", "deleted"]
];

const propertyTypes = ["appartement", "maison", "villa", "terrain", "studio", "chambre", "bureau", "commerce"];
const transactions = ["location", "vente", "achat"];

function routeHref(path) {
  if (window.location.protocol !== "file:") {
    return path;
  }

  if (path === "/dashboard/immobilier") {
    return "../";
  }

  if (path === "/dashboard/immobilier/annonces") {
    return "./";
  }

  if (path === "/dashboard/immobilier/contact-settings") {
    return "../contact-settings/";
  }

  if (path === "/publier?category=immobilier") {
    return "../../../publier/?category=immobilier";
  }

  if (path.startsWith("/immobilier/annonce/")) {
    return `../../../immobilier/annonce/?id=${encodeURIComponent(path.slice("/immobilier/annonce/".length))}`;
  }

  return path;
}

function formatPriceFCFA(value) {
  return value ? `${Number(value).toLocaleString("fr-FR")} FCFA` : "";
}

function formatDate(value) {
  return value ? new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)) : "";
}

function getListingStatusLabel(status) {
  const labels = {
    draft: "Brouillon",
    pending_review: "En attente de validation",
    active: "Active",
    suspended: "Suspendue",
    expired: "Expirée",
    deleted: "Supprimée"
  };

  return labels[status] || status || "";
}

function getCompletionLabel(score) {
  if (score >= 80) return "Complet";
  if (score >= 50) return "À améliorer";
  return "Incomplet";
}

function filterAdvertiserListings(listings, currentFilters) {
  return listings.filter((listing) => {
    const query = currentFilters.query.trim().toLowerCase();
    const matchesQuery = !query || [listing.title, listing.city, listing.district].filter(Boolean).some((value) => value.toLowerCase().includes(query));
    const matchesStatus = currentFilters.status === "all" || listing.status === currentFilters.status;
    const matchesTransaction = currentFilters.transaction === "all" || listing.transaction === currentFilters.transaction;
    const matchesPropertyType = currentFilters.propertyType === "all" || listing.propertyType === currentFilters.propertyType;
    const matchesRegion = !currentFilters.region || listing.region === currentFilters.region;
    const matchesCity = !currentFilters.city || listing.city === currentFilters.city;

    return matchesQuery && matchesStatus && matchesTransaction && matchesPropertyType && matchesRegion && matchesCity;
  });
}

function sortAdvertiserListings(listings) {
  if (filters.performance === "most_viewed") {
    return [...listings].sort((a, b) => b.quickStats.views - a.quickStats.views);
  }

  if (filters.performance === "most_contacted") {
    return [...listings].sort((a, b) => b.quickStats.contacts - a.quickStats.contacts);
  }

  if (filters.performance === "no_contact") {
    return listings.filter((listing) => !listing.quickStats.contacts);
  }

  if (filters.performance === "needs_improvement") {
    return listings.filter((listing) => listing.completionScore < 80);
  }

  return listings;
}

function getListingMainRecommendation(listing) {
  return (listing.recommendations || []).slice(0, 2);
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
      <div class="dashboard-brand">
        <span>P</span>
        <div>
          <strong>Péncmi</strong>
          <small>Annonceur immobilier</small>
        </div>
      </div>
      <nav class="dashboard-nav" aria-label="Navigation dashboard">
        ${items.map(([label, href, badge]) => `
          <a href="${routeHref(href)}"${href === routes.listings ? ' aria-current="page"' : ""}>
            <span>${label}</span>
            ${badge ? `<span class="notification-badge">${badge}</span>` : ""}
          </a>
        `).join("")}
      </nav>
    </aside>
  `;
}

function AdvertiserListingsHeader() {
  return `
    <header class="dashboard-header">
      <div>
        <button class="btn btn-ghost dashboard-menu-toggle" type="button" data-open-sidebar>Menu</button>
        <h1>Mes annonces immobilières</h1>
        <p>Gérez vos biens publiés, vos brouillons et vos annonces en attente.</p>
      </div>
      <div class="dashboard-header-actions">
        <a class="btn btn-primary" href="${routeHref(routes.publish)}">Publier une annonce</a>
        <a class="btn btn-light" href="${routeHref(routes.dashboard)}">Retour au dashboard</a>
      </div>
    </header>
  `;
}

function ListingStatusTabs() {
  return `
    <div class="status-tabs" aria-label="Statuts annonces">
      ${statusTabs.map(([label, status]) => `
        <button class="status-tab${activeStatus === status ? " is-active" : ""}" type="button" data-status-tab="${status}">
          ${label} (0)
        </button>
      `).join("")}
    </div>
  `;
}

function selectOptions(values, selectedValue, labeler = (value) => value) {
  return values.map((value) => `<option value="${value}"${selectedValue === value ? " selected" : ""}>${labeler(value)}</option>`).join("");
}

function ListingSearchAndFilters() {
  return `
    <section class="listings-toolbar">
      <input class="listing-search" type="search" data-filter="query" value="${filters.query}" placeholder="Rechercher par titre, ville ou quartier">
      <div class="filters-grid">
        <select data-filter="status">
          <option value="all">Statut</option>
          ${selectOptions(statusTabs.filter(([, status]) => status !== "all").map(([, status]) => status), filters.status, getListingStatusLabel)}
        </select>
        <select data-filter="propertyType">
          <option value="all">Type de bien</option>
          ${selectOptions(propertyTypes, filters.propertyType, (value) => value.charAt(0).toUpperCase() + value.slice(1))}
        </select>
        <select data-filter="transaction">
          <option value="all">Type d’annonce</option>
          ${selectOptions(transactions, filters.transaction, (value) => value.charAt(0).toUpperCase() + value.slice(1))}
        </select>
        <input data-filter="region" value="${filters.region}" placeholder="Région">
        <input data-filter="city" value="${filters.city}" placeholder="Ville">
        <select data-filter="period">
          <option value="all">Toutes les périodes</option>
          <option value="today"${filters.period === "today" ? " selected" : ""}>Aujourd’hui</option>
          <option value="7d"${filters.period === "7d" ? " selected" : ""}>7 jours</option>
          <option value="30d"${filters.period === "30d" ? " selected" : ""}>30 jours</option>
          <option value="90d"${filters.period === "90d" ? " selected" : ""}>90 jours</option>
        </select>
        <select data-filter="performance">
          <option value="all">Toutes les performances</option>
          <option value="most_viewed"${filters.performance === "most_viewed" ? " selected" : ""}>Les plus vues</option>
          <option value="most_contacted"${filters.performance === "most_contacted" ? " selected" : ""}>Les plus contactées</option>
          <option value="no_contact"${filters.performance === "no_contact" ? " selected" : ""}>Sans contact</option>
          <option value="needs_improvement"${filters.performance === "needs_improvement" ? " selected" : ""}>À améliorer</option>
        </select>
        <button class="btn btn-ghost" type="button" data-reset-filters>Réinitialiser les filtres</button>
      </div>
    </section>
  `;
}

function AdvertiserListingsTable(listings) {
  if (!advertiserListings.length) {
    return ListingsEmptyState();
  }

  if (!listings.length) {
    return NoFilteredListingsState();
  }

  return `
    <div class="listings-table-wrap">
      <table class="listings-table">
        <thead>
          <tr>
            <th>Annonce</th>
            <th>Statut</th>
            <th>Localisation</th>
            <th>Prix</th>
            <th>Vues</th>
            <th>Contacts</th>
            <th>Messages</th>
            <th>Favoris</th>
            <th>Score</th>
            <th>Dernière mise à jour</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>${listings.map(AdvertiserListingRow).join("")}</tbody>
      </table>
    </div>
    <div class="listing-cards">${listings.map(AdvertiserListingCard).join("")}</div>
  `;
}

function AdvertiserListingRow(listing) {
  return `
    <tr>
      <td>
        <div class="listing-title-cell">
          <span class="listing-thumb">Photo</span>
          <div>
            <strong>${listing.title}</strong>
            <div>${listing.propertyType} · ${listing.transaction}</div>
          </div>
        </div>
      </td>
      <td>${ListingStatusBadge(listing.status)}</td>
      <td>${[listing.city, listing.district].filter(Boolean).join(", ")}</td>
      <td>${formatPriceFCFA(listing.price)}</td>
      <td>${listing.quickStats.views}</td>
      <td>${listing.quickStats.contacts}</td>
      <td>${listing.quickStats.messages}</td>
      <td>${listing.quickStats.favorites}</td>
      <td>${ListingCompletionScore(listing.completionScore)}</td>
      <td>${formatDate(listing.updatedAt || listing.createdAt)}</td>
      <td>${ListingActionsMenu(listing)}</td>
    </tr>
  `;
}

function AdvertiserListingCard(listing) {
  return `
    <article class="listing-card">
      <h3>${listing.title}</h3>
      ${ListingStatusBadge(listing.status)}
      <div class="listing-card-grid">
        <div><span>Ville</span><strong>${listing.city || ""}</strong></div>
        <div><span>Quartier</span><strong>${listing.district || ""}</strong></div>
        <div><span>Prix</span><strong>${formatPriceFCFA(listing.price)}</strong></div>
        <div><span>Vues</span><strong>${listing.quickStats.views}</strong></div>
        <div><span>Contacts</span><strong>${listing.quickStats.contacts}</strong></div>
        <div><span>Messages</span><strong>${listing.quickStats.messages}</strong></div>
        <div><span>Favoris</span><strong>${listing.quickStats.favorites}</strong></div>
        <div><span>Score</span><strong>${listing.completionScore}%</strong></div>
      </div>
      ${ListingRecommendationsPreview(listing)}
      ${ListingActionsMenu(listing)}
      <div class="listing-actions-secondary">
        <button type="button" data-open-disable="${listing.id}">Désactiver</button>
        <button type="button" data-open-delete="${listing.id}">Supprimer</button>
      </div>
    </article>
  `;
}

function ListingStatusBadge(status) {
  return `<span class="status-badge">${getListingStatusLabel(status)}</span>`;
}

function ListingCompletionScore(score) {
  return `<span class="completion-label">${score}% · ${getCompletionLabel(score)}</span>`;
}

function ListingQuickStats(stats) {
  return `
    <span>Vues ${stats.views}</span>
    <span>Contacts ${stats.contacts}</span>
    <span>Messages ${stats.messages}</span>
    <span>Favoris ${stats.favorites}</span>
  `;
}

function ListingRecommendationsPreview(listing) {
  const recommendations = getListingMainRecommendation(listing);
  return recommendations.length ? `<div class="recommendations-preview">${recommendations.join(" · ")}</div>` : "";
}

function ListingActionsMenu(listing) {
  return `
    <div class="listing-actions">
      <a href="${routeHref(`/immobilier/annonce/${listing.id}`)}">Voir</a>
      <a href="/dashboard/immobilier/annonces/${listing.id}/edit">Modifier</a>
      <a href="/dashboard/immobilier/statistiques?listingId=${listing.id}">Statistiques</a>
      <button type="button" data-open-disable="${listing.id}">Désactiver</button>
      <button type="button" data-open-delete="${listing.id}">Supprimer</button>
    </div>
  `;
}

function ConfirmDisableListingModal() {
  return `
    <div class="modal-backdrop" data-modal>
      <div class="modal-panel">
        <h2>Désactiver cette annonce ?</h2>
        <p>Elle ne sera plus visible par les clients, mais vous pourrez la réactiver plus tard.</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" type="button" data-close-modal>Annuler</button>
          <button class="btn btn-primary" type="button" data-close-modal>Désactiver</button>
        </div>
      </div>
    </div>
  `;
}

function ConfirmDeleteListingModal() {
  return `
    <div class="modal-backdrop" data-modal>
      <div class="modal-panel">
        <h2>Supprimer cette annonce ?</h2>
        <p>Cette action pourra être définitive une fois connectée au serveur.</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" type="button" data-close-modal>Annuler</button>
          <button class="btn btn-primary" type="button" data-close-modal>Supprimer</button>
        </div>
      </div>
    </div>
  `;
}

function ListingsEmptyState() {
  return `
    <section class="listings-empty">
      <div>
        <h2>Vous n’avez aucune annonce immobilière pour le moment.</h2>
        <p>Publiez votre premier bien pour commencer à recevoir des demandes.</p>
        <a class="btn btn-primary" href="${routeHref(routes.publish)}">Publier ma première annonce</a>
      </div>
    </section>
  `;
}

function NoFilteredListingsState() {
  return `
    <section class="no-filtered-listings">
      <div>
        <h2>Aucune annonce ne correspond à vos filtres.</h2>
        <p>Modifiez vos critères ou réinitialisez les filtres.</p>
        <div class="listing-actions">
          <button type="button" data-reset-filters>Réinitialiser les filtres</button>
          <a href="${routeHref(routes.publish)}">Publier une annonce</a>
        </div>
      </div>
    </section>
  `;
}

function ListingsPagination() {
  return `
    <section class="listings-pagination">
      <button class="btn btn-ghost" type="button">Page précédente</button>
      <span>Page 1</span>
      <select>
        <option>10 annonces par page</option>
        <option>20 annonces par page</option>
        <option>50 annonces par page</option>
      </select>
      <button class="btn btn-ghost" type="button">Page suivante</button>
    </section>
  `;
}

function AdvertiserListingsPage() {
  const filteredListings = sortAdvertiserListings(filterAdvertiserListings(advertiserListings, filters));

  document.querySelector("#advertiser-listings-page").innerHTML = `
    <div class="dashboard-shell">
      ${DashboardSidebar()}
      <main class="dashboard-main">
        ${AdvertiserListingsHeader()}
        ${ListingStatusTabs()}
        ${ListingSearchAndFilters()}
        ${AdvertiserListingsTable(filteredListings)}
        ${ListingsPagination()}
      </main>
    </div>
  `;

  bindListingsEvents();
}

function resetFilters() {
  activeStatus = "all";
  filters = {
    query: "",
    status: "all",
    transaction: "all",
    propertyType: "all",
    region: "",
    city: "",
    period: "all",
    performance: "all"
  };
}

function openModal(content) {
  document.querySelector("#modal-root").innerHTML = content;
  document.querySelectorAll("[data-close-modal]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelector("#modal-root").innerHTML = "";
    });
  });
}

function bindListingsEvents() {
  document.querySelector("[data-open-sidebar]")?.addEventListener("click", () => {
    document.querySelector("#dashboard-sidebar").classList.toggle("is-open");
  });

  document.querySelectorAll("[data-status-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      activeStatus = button.dataset.statusTab;
      filters.status = activeStatus;
      AdvertiserListingsPage();
    });
  });

  document.querySelectorAll("[data-filter]").forEach((input) => {
    input.addEventListener("change", () => {
      filters[input.dataset.filter] = input.value;
      if (input.dataset.filter === "status") {
        activeStatus = input.value;
      }
      AdvertiserListingsPage();
    });
  });

  document.querySelectorAll("[data-reset-filters]").forEach((button) => {
    button.addEventListener("click", () => {
      resetFilters();
      AdvertiserListingsPage();
    });
  });

  document.querySelectorAll("[data-open-disable]").forEach((button) => {
    button.addEventListener("click", () => openModal(ConfirmDisableListingModal()));
  });

  document.querySelectorAll("[data-open-delete]").forEach((button) => {
    button.addEventListener("click", () => openModal(ConfirmDeleteListingModal()));
  });
}

AdvertiserListingsPage();

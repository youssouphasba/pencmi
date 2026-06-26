const realEstateDashboardRoutes = {
  overview: "/dashboard/immobilier",
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

function realEstateDashboardRouteHref(path) {
  if (window.location.protocol !== "file:") return path;
  const depth = Number(document.body?.dataset?.routeDepth || "3");
  const prefix = "../".repeat(depth);
  if (path.includes("?")) {
    const [base, query] = path.split("?");
    return `${realEstateDashboardRouteHref(base)}?${query}`;
  }
  if (path === "/") return `${prefix}index.html`;
  return `${prefix}${path.replace(/^\//, "")}/`;
}

function realEstateDashboardApiBaseUrl() {
  return String(window.PencmiConfig?.apiBaseUrl || window.PencmiRuntimeConfig?.apiBaseUrl || window.PencmiApiBaseUrl || window.localStorage.getItem("pencmi_api_base_url") || "").replace(/\/+$/, "");
}

function realEstateDashboardToken() {
  return window.localStorage.getItem("pencmi_access_token") || "";
}

function listFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

async function realEstateDashboardApiRequest(path) {
  const baseUrl = realEstateDashboardApiBaseUrl();
  const token = realEstateDashboardToken();
  if (!baseUrl || !token) {
    throw new Error("Connexion annonceur requise.");
  }
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message || "Chargement impossible.");
  }
  return payload?.data ?? payload;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("fr-FR");
}

function realEstateDashboardSidebar(currentPage) {
  const items = [
    ["Vue d’ensemble", realEstateDashboardRoutes.overview, "overview"],
    ["Mes annonces", realEstateDashboardRoutes.listings, "listings"],
    ["Messages", realEstateDashboardRoutes.messages, "messages"],
    ["Contacts", realEstateDashboardRoutes.contacts, "contacts"],
    ["Demandes de visite", realEstateDashboardRoutes.visits, "visits"],
    ["Favoris reçus", realEstateDashboardRoutes.favorites, "favorites"],
    ["Statistiques", realEstateDashboardRoutes.stats, "stats"],
    ["Moyens de contact", realEstateDashboardRoutes.contactSettings, "contactSettings"],
    ["Emails automatiques", realEstateDashboardRoutes.emailSettings, "emailSettings"],
    ["Mon profil", realEstateDashboardRoutes.profile, "profile"]
  ];
  return `<aside class="dashboard-sidebar" id="dashboard-sidebar"><div class="dashboard-brand"><span>P</span><div><strong>Péncmi</strong><small>Annonceur immobilier</small></div></div><nav class="dashboard-nav">${items.map(([label, href, key]) => `<a href="${realEstateDashboardRouteHref(href)}"${key === currentPage ? ' aria-current="page"' : ""}><span>${label}</span></a>`).join("")}</nav></aside>`;
}

function ContactsTable(contacts) {
  return `
    <section class="dashboard-card">
      <h2>Contacts reçus</h2>
      <div class="listings-table-wrap">
        <table class="listings-table">
          <thead><tr><th>Client</th><th>Annonce</th><th>Téléphone</th><th>Email</th><th>Message</th><th>Date</th><th>Actions</th></tr></thead>
          <tbody>${contacts.map((contact) => `<tr><td>${contact.clientName || "Client"}</td><td>${contact.listing?.title || "Annonce"}</td><td>${contact.clientPhone || ""}</td><td>${contact.clientEmail || ""}</td><td>${contact.message || ""}</td><td>${formatDate(contact.createdAt)}</td><td><a class="btn btn-ghost" href="${realEstateDashboardRouteHref(realEstateDashboardRoutes.visits)}">Voir la demande</a></td></tr>`).join("")}</tbody>
        </table>
      </div>
    </section>
  `;
}

function realEstateDashboardEmptyPage() {
  const root = document.querySelector("#dashboard-layout");
  if (!root) return;
  const currentPage = document.body.dataset.dashboardPage || "messages";
  const title = document.body.dataset.pageTitle || "Dashboard immobilier";
  const subtitle = document.body.dataset.pageSubtitle || "";
  const emptyTitle = document.body.dataset.emptyTitle || "Aucune donnée disponible pour le moment.";
  const emptyText = document.body.dataset.emptyText || "";
  root.innerHTML = `
    <div class="dashboard-shell">
      ${realEstateDashboardSidebar(currentPage)}
      <main class="dashboard-main">
        <header class="dashboard-header">
          <div>
            <p class="dashboard-eyebrow">Immobilier</p>
            <h1>${title}</h1>
            ${subtitle ? `<p>${subtitle}</p>` : ""}
          </div>
          <div class="dashboard-header-actions">
            <a class="btn btn-ghost" href="${realEstateDashboardRouteHref(realEstateDashboardRoutes.overview)}">Vue d’ensemble</a>
            <a class="btn btn-primary" href="${realEstateDashboardRouteHref(realEstateDashboardRoutes.listings)}">Mes annonces</a>
          </div>
        </header>
        <section class="dashboard-card" data-empty-content>
          <h2>${emptyTitle}</h2>
          ${emptyText ? `<p class="dashboard-muted">${emptyText}</p>` : ""}
        </section>
      </main>
    </div>
  `;
}

async function realEstateDashboardPage() {
  const currentPage = document.body.dataset.dashboardPage || "messages";
  realEstateDashboardEmptyPage();

  if (currentPage !== "contacts") {
    return;
  }

  try {
    const payload = await realEstateDashboardApiRequest("/dashboard/immobilier/visits");
    const contacts = listFromPayload(payload);
    if (!contacts.length) return;
    const placeholder = document.querySelector("[data-empty-content]");
    if (placeholder) {
      placeholder.outerHTML = ContactsTable(contacts);
    }
  } catch {
    realEstateDashboardEmptyPage();
  }
}

document.addEventListener("DOMContentLoaded", realEstateDashboardPage);

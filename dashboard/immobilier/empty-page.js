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

function realEstateDashboardEmptyPage() {
  const root = document.querySelector("#dashboard-layout");
  if (!root) return;
  const currentPage = document.body.dataset.dashboardPage || "messages";
  const title = document.body.dataset.pageTitle || "Tableau de bord";
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
  const placeholder = document.querySelector("[data-empty-content]");
  if (!placeholder || !["messages", "contacts"].includes(currentPage)) return;
  const area = document.createElement("div");
  placeholder.replaceWith(area);
  try {
    if (currentPage === "messages") {
      const { mountInbox } = await import("../../messaging/inbox.mjs");
      mountInbox(area, { scope: "owner", module: "real_estate", emptyTitle: "Aucun message reçu pour le moment.", emptyText: "Les conversations liées à vos annonces apparaîtront ici." });
    } else {
      const { mountContacts } = await import("../../messaging/contacts-panel.mjs");
      mountContacts(area, { module: "real_estate", messagesHref: realEstateDashboardRouteHref(realEstateDashboardRoutes.messages) });
    }
  } catch {
    area.textContent = "Chargement impossible. Rechargez la page.";
  }
}

document.addEventListener("DOMContentLoaded", realEstateDashboardPage);

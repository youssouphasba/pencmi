// Page frames of the hotel synchronisation: the hotelier settings and the admin list of
// partners. Their content is mounted by hotel-sync-page.mjs.

const hotelIntegrationRoutes = {
  syncSettings: "/dashboard/hotels/integration/sync-settings",
  hotelDashboard: "/dashboard/hotels"
};

const adminHotelIntegrationRoutes = {
  partners: "/admin/hotel-integrations/partners",
  admin: "/admin"
};

function hotelIntegrationEscape(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function buildHotelIntegrationRoute(path) {
  if (window.location.protocol !== "file:") return path;
  const depth = Number(document.body?.dataset?.routeDepth || "3");
  const prefix = "../".repeat(depth);
  if (path === "/") return `${prefix}index.html`;
  return `${prefix}${path.replace(/^\//, "")}/`;
}

function hotelIntegrationNav(items, currentPage, className) {
  return `<nav class="${className}">${items.map(([label, href, key]) => `<a href="${buildHotelIntegrationRoute(href)}"${key === currentPage ? ' aria-current="page"' : ""}><span>${label}</span></a>`).join("")}</nav>`;
}

function HotelIntegrationSyncSettingsPage() {
  const sidebar = `<aside class="dashboard-sidebar"><div class="dashboard-brand"><span>P</span><div><strong>Péncmi</strong><small>Intégration hôtel</small></div></div>${hotelIntegrationNav([
    ["Synchronisation", hotelIntegrationRoutes.syncSettings, "syncSettings"],
    ["Dashboard hôtels", hotelIntegrationRoutes.hotelDashboard, "dashboard"]
  ], "syncSettings", "dashboard-nav")}</aside>`;
  return `<div class="hotel-integration-shell"><div class="hotel-integration-layout">${sidebar}<main class="hotel-integration-main"><header class="hotel-integration-header"><div><h1>Synchronisation des disponibilités</h1><p>${hotelIntegrationEscape("Reliez votre logiciel hôtelier par calendrier iCal ou par votre channel manager : Péncmi se met à jour sans que vous ayez à vous connecter.")}</p></div><a class="btn btn-ghost" href="${buildHotelIntegrationRoute(hotelIntegrationRoutes.hotelDashboard)}">Dashboard hôtels</a></header><div id="hotel-sync-root"><p>Chargement des réglages…</p></div></main></div></div>`;
}

function AdminHotelIntegrationPartnersPage() {
  const sidebar = `<aside class="admin-sidebar"><div class="dashboard-brand"><span>P</span><div><strong>Péncmi</strong><small>Admin intégrations hôtels</small></div></div>${hotelIntegrationNav([
    ["Partenaires", adminHotelIntegrationRoutes.partners, "partners"],
    ["Administration", adminHotelIntegrationRoutes.admin, "admin"]
  ], "partners", "admin-nav")}</aside>`;
  return `<div class="admin-hotel-integration-shell"><div class="admin-hotel-integration-layout">${sidebar}<main class="admin-hotel-integration-main"><header class="admin-hotel-integration-header"><div><h1>Partenaires de synchronisation</h1><p>${hotelIntegrationEscape("Channel managers et éditeurs de logiciels hôteliers reliés à Péncmi. Les hôteliers choisissent le leur dans leurs réglages de synchronisation.")}</p></div></header><div id="admin-channel-partners-root"><p>Chargement des partenaires…</p></div></main></div></div>`;
}

document.addEventListener("DOMContentLoaded", () => {
  const hotelier = document.querySelector("#hotel-integration-root");
  if (hotelier) hotelier.innerHTML = HotelIntegrationSyncSettingsPage();
  const admin = document.querySelector("#admin-hotel-integration-root");
  if (admin) admin.innerHTML = AdminHotelIntegrationPartnersPage();
});

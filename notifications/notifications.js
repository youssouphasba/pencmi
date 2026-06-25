const pencmiNotifications = [];
const notificationSummary = {
  totalUnread: 0,
  unreadMessages: 0,
  unreadContacts: 0,
  pendingReservations: 0,
  pendingVisits: 0,
  pendingSeatRequests: 0,
  availabilityAlerts: 0,
  incompleteListings: 0,
  failedEmails: 0
};

function notificationRoute(path) {
  if (window.location.protocol !== "file:") {
    return path;
  }
  if (path === "/dashboard/notifications") return "../notifications/";
  if (path === "/dashboard") return "../";
  return path;
}

function NotificationBadge(value = 0) {
  return `<span class="notification-badge">${value}</span>`;
}

function DashboardSidebarBadge(value = 0) {
  return `<span class="notification-badge">${value}</span>`;
}

function NotificationBell() {
  return `
    <div class="notification-shell">
      <button class="notification-bell" type="button" data-toggle-notifications aria-label="Notifications">
        <span aria-hidden="true">!</span>
        ${NotificationBadge(notificationSummary.totalUnread)}
      </button>
      ${NotificationDropdown()}
    </div>
  `;
}

function NotificationDropdown() {
  return `
    <section class="notification-dropdown" id="notification-dropdown">
      <header>
        <strong>Notifications</strong>
        <button class="btn btn-ghost" type="button" data-mark-all-read>Tout marquer comme lu</button>
      </header>
      ${pencmiNotifications.length ? NotificationList(pencmiNotifications.slice(0, 5)) : EmptyNotificationsState("compact")}
      <a class="btn btn-light" href="${notificationRoute("/dashboard/notifications")}">Voir toutes les notifications</a>
    </section>
  `;
}

function NotificationList(items = pencmiNotifications) {
  return `<div class="notification-list">${items.length ? items.map(NotificationItem).join("") : EmptyNotificationsState("compact")}</div>`;
}

function NotificationItem(notification) {
  return `
    <article class="notification-item">
      <h3>${notification.title}</h3>
      <p>${notification.message}</p>
      <div class="notification-toolbar">
        ${NotificationPriorityBadge(notification.priority)}
        ${NotificationStatusBadge(notification.status)}
        ${notification.targetUrl ? `<a class="btn btn-ghost" href="${notification.targetUrl}">Ouvrir</a>` : ""}
      </div>
    </article>
  `;
}

function NotificationFilters() {
  return `
    <section class="notification-filters">
      <select><option>Tous les modules</option><option>Immobilier</option><option>Hôtels</option><option>Voitures</option><option>Voyages</option></select>
      <select><option>Tous les types</option><option>Message</option><option>Contact</option><option>Réservation</option><option>Visite</option><option>Demande de place</option><option>Disponibilité</option><option>Annonce</option><option>Email</option><option>Système</option></select>
      <select><option>Tous les statuts</option><option>Non lue</option><option>Lue</option><option>Archivée</option></select>
      <select><option>Date</option><option>Plus récentes</option><option>Plus anciennes</option></select>
    </section>
  `;
}

function NotificationPriorityBadge(priority = "normal") {
  const labels = { low: "Faible", normal: "Normale", important: "Importante", urgent: "Urgente" };
  return `<span class="notification-priority-badge">${labels[priority] || labels.normal}</span>`;
}

function NotificationStatusBadge(status = "unread") {
  const labels = { unread: "Non lue", read: "Lue", archived: "Archivée" };
  return `<span class="notification-status-badge">${labels[status] || labels.unread}</span>`;
}

function EmptyNotificationsState(mode = "full") {
  if (mode === "compact") {
    return `<div class="notification-item"><h3>Aucune notification pour le moment.</h3></div>`;
  }
  return `<section class="empty-notifications-state"><div><h2>Aucune notification pour le moment.</h2><p>Les nouveaux messages, contacts, réservations, visites, demandes et alertes apparaîtront ici.</p></div></section>`;
}

function NotificationsPage() {
  const root = document.querySelector("#notifications-page");
  if (!root) return;
  root.innerHTML = `
    <section class="notifications-page-header">
      <div>
        <h1>Notifications</h1>
        <p>Suivez les événements importants de vos espaces Péncmi.</p>
      </div>
      <button class="btn btn-primary" type="button" data-mark-all-read>Tout marquer comme lu</button>
    </section>
    ${NotificationFilters()}
    <section class="notifications-card">
      ${pencmiNotifications.length ? NotificationList() : EmptyNotificationsState()}
    </section>
  `;
}

function bindNotificationBell() {
  document.querySelectorAll("[data-toggle-notifications]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelector("#notification-dropdown")?.classList.toggle("is-open");
    });
  });
}

document.addEventListener("click", (event) => {
  if (!event.target.closest(".notification-shell")) {
    document.querySelector("#notification-dropdown")?.classList.remove("is-open");
  }
});

document.addEventListener("DOMContentLoaded", () => {
  NotificationsPage();
  bindNotificationBell();
});

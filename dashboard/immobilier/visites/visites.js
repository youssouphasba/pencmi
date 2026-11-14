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
let searchQuery = "";
const escapeVisit = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const visitDate = (value) => { const date = value ? new Date(value) : null; return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short" }).format(date) : ""; };

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
  return `<span class="status-badge visit-status-${String(status || "").replace(/[^a-z_]/g, "")}">${labels[status] || "À renseigner"}</span>`;
}

// One clear next step per status; the rest stays under "Plus d'actions".
const VISIT_ACTIONS = {
  new: [["accepted", "Confirmer la visite"], ["pending", "Proposer un créneau"], ["requires_more_info", "Demander des précisions"], ["cancelled", "Refuser"]],
  requires_more_info: [["accepted", "Confirmer la visite"], ["pending", "Proposer un créneau"], ["cancelled", "Refuser"]],
  pending: [["accepted", "Confirmer la visite"], ["requires_more_info", "Demander des précisions"], ["cancelled", "Annuler"]],
  accepted: [["completed", "Marquer comme effectuée"], ["cancelled", "Annuler la visite"]],
};

function VisitRequestCard(visit) {
  const actions = VISIT_ACTIONS[visit.status] || [];
  const [primary, secondary, ...more] = actions;
  // Proposing a slot or asking for details needs words for the client: those open a small form.
  const button = ([status, label], kind) => ["pending", "requires_more_info"].includes(status)
    ? `<button class="visit-btn ${kind}" type="button" data-visit-dialog="${status}" data-visit-id="${escapeVisit(visit.id)}">${label}</button>`
    : `<button class="visit-btn ${kind}" type="button" data-visit-status="${status}" data-visit-id="${escapeVisit(visit.id)}">${label}</button>`;
  const phone = visit.clientPhone ? `<a class="visit-contact" href="tel:${escapeVisit(String(visit.clientPhone).replace(/\s/g, ""))}">📞 ${escapeVisit(visit.clientPhone)}</a>` : "";
  const email = visit.clientEmail ? `<a class="visit-contact" href="mailto:${escapeVisit(visit.clientEmail)}">✉️ ${escapeVisit(visit.clientEmail)}</a>` : "";
  const when = visitDate(visit.preferredDate);
  return `
    <article class="page-panel visit-card">
      <header class="visit-head">
        <div>
          <h3>${escapeVisit(visit.clientName || "Client")}</h3>
          <p class="visit-listing">${escapeVisit(visit.listing?.title || visit.listingTitle || "")}</p>
        </div>
        ${VisitStatusBadge(visit.status)}
      </header>
      ${when ? `<p class="visit-when">📅 Visite souhaitée : <strong>${when}</strong></p>` : ""}
      ${visit.message ? `<blockquote class="visit-message">${escapeVisit(visit.message)}</blockquote>` : ""}
      ${phone || email ? `<div class="visit-contacts">${phone}${email}</div>` : ""}
      ${primary ? `<div class="visit-actions">${button(primary, "primary")}${secondary ? button(secondary, "secondary") : ""}</div>` : ""}
      <div class="visit-footer">
        ${visit.clientUserId ? `<button class="visit-link" type="button" data-visit-dialog="message" data-visit-id="${escapeVisit(visit.id)}">💬 Écrire au client</button>` : `<span class="visit-note">Sans compte Péncmi : appelez-le ou écrivez-lui par email.</span>`}
        ${more.length ? `<details class="visit-more"><summary>Plus d’actions</summary><div>${more.map((action) => button(action, "ghost")).join("")}</div></details>` : ""}
      </div>
    </article>
  `;
}

function VisitRequestTable() {
  const query = searchQuery.trim().toLowerCase();
  const filteredVisits = visitRequests
    .filter((visit) => activeStatus === "all" || visit.status === activeStatus)
    .filter((visit) => !query || [visit.clientName, visit.listing?.title, visit.listingTitle, visit.listing?.city, visit.clientPhone, visit.clientEmail]
      .some((value) => String(value || "").toLowerCase().includes(query)));
  return filteredVisits.length
    ? `<div class="cards-list">${filteredVisits.map(VisitRequestCard).join("")}</div>`
    : EmptyState("Aucune demande de visite pour le moment.", [
      ["Voir mes annonces", routes.listings],
      ["Configurer mes moyens de contact", routes.contactSettings]
    ]);
}

const VISIT_DIALOGS = {
  pending: { title: "Proposer un créneau", submit: "Envoyer la proposition", note: "Message (facultatif)", placeholder: "Ex. : je serai sur place avec les clés." },
  requires_more_info: { title: "Demander des précisions", submit: "Envoyer la question", note: "Votre question", placeholder: "Ex. : combien de personnes viendront à la visite ?" },
  message: { title: "Écrire au client", submit: "Envoyer", note: "Votre message", placeholder: "Écrivez votre message…" },
};

function VisitDialog(kind, visit) {
  const dialog = VISIT_DIALOGS[kind];
  const today = new Date().toISOString().slice(0, 10);
  const noAccount = !visit.clientUserId && kind !== "message"
    ? `<p class="visit-dialog-warning">Ce client n’a pas de compte Péncmi : il verra le changement de statut, mais pas ce message. Appelez-le ou écrivez-lui par email.</p>` : "";
  return `
    <div class="modal-backdrop" data-close-modal-backdrop>
      <div class="modal-panel visit-dialog" role="dialog" aria-modal="true" aria-labelledby="visit-dialog-title">
        <h2 id="visit-dialog-title">${dialog.title}</h2>
        <p class="visit-dialog-to">À ${escapeVisit(visit.clientName || "votre client")} · ${escapeVisit(visit.listing?.title || "")}</p>
        <form class="modal-form" data-visit-form="${kind}" data-visit-id="${escapeVisit(visit.id)}">
          ${kind === "pending" ? `<div class="visit-dialog-row"><label>Date<input type="date" name="date" min="${today}" required></label><label>Heure<input type="time" name="time" step="900"></label></div>` : ""}
          <label>${dialog.note}<textarea name="message" rows="4" maxlength="2000" placeholder="${dialog.placeholder}" ${kind === "pending" ? "" : "required"}></textarea></label>
          ${noAccount}
          <p class="visit-dialog-error" role="alert"></p>
          <div class="visit-dialog-actions">
            <button class="visit-btn ghost" type="button" data-close-modal>Annuler</button>
            <button class="visit-btn primary" type="submit">${dialog.submit}</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

// UUID v4 for retry-safe requests; crypto.randomUUID needs HTTPS, getRandomValues does not.
function newRequestId() {
  if (window.crypto?.randomUUID && window.isSecureContext) return window.crypto.randomUUID();
  const bytes = window.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function showVisitToast(text, conversationId) {
  document.querySelector(".visit-toast")?.remove();
  const toast = document.createElement("div");
  toast.className = "visit-toast";
  toast.setAttribute("role", "status");
  toast.innerHTML = `<span>${escapeVisit(text)}</span>${conversationId ? `<a href="${routeHref(routes.messages)}/?conversation=${encodeURIComponent(conversationId)}">Voir la conversation</a>` : ""}`;
  document.body.append(toast);
  setTimeout(() => toast.remove(), 7000);
}

async function submitVisitDialog(form) {
  const kind = form.dataset.visitForm, id = form.dataset.visitId;
  const data = new FormData(form);
  const message = String(data.get("message") || "").trim();
  const requestId = newRequestId();
  if (kind === "message") {
    const sent = await apiRequest(`/dashboard/immobilier/visits/${encodeURIComponent(id)}/messages`, { method: "POST", body: JSON.stringify({ body: message, requestId }) });
    return { toast: "Message envoyé au client.", conversationId: sent?.conversationId };
  }
  const body = { status: kind, requestId, ...(message ? { message } : {}),
    ...(kind === "pending" ? { proposedDate: data.get("date"), ...(data.get("time") ? { proposedTime: data.get("time") } : {}) } : {}) };
  const updated = await apiRequest(`/dashboard/immobilier/visits/${encodeURIComponent(id)}/status`, { method: "PATCH", body: JSON.stringify(body) });
  visitRequests = visitRequests.map((visit) => visit.id === id ? { ...visit, ...updated } : visit);
  return { toast: updated?.messageDelivered === false ? "Statut mis à jour. Prévenez le client par téléphone ou email." : kind === "pending" ? "Proposition envoyée au client." : "Question envoyée au client.",
    conversationId: updated?.conversationId };
}

function openVisitDialog(kind, id) {
  const visit = visitRequests.find((item) => item.id === id);
  if (!visit) return;
  openModal(VisitDialog(kind, visit));
  const form = document.querySelector("[data-visit-form]");
  const backdrop = document.querySelector("[data-close-modal-backdrop]");
  backdrop?.addEventListener("click", (event) => { if (event.target === backdrop) document.querySelector("#modal-root").innerHTML = ""; });
  form?.querySelector("input, textarea")?.focus();
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    const error = form.querySelector(".visit-dialog-error");
    submit.disabled = true; error.textContent = "";
    try {
      const result = await submitVisitDialog(form);
      document.querySelector("#modal-root").innerHTML = "";
      VisitsPage();
      showVisitToast(result.toast, result.conversationId);
    } catch (failure) {
      error.textContent = failure.message || "L’envoi a échoué. Réessayez.";
      submit.disabled = false;
    }
  });
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
        <section class="filter-strip"><input type="search" data-visit-search value="${escapeVisit(searchQuery)}" placeholder="Rechercher un client, une annonce, une ville" aria-label="Rechercher une demande"></section>
        <div id="visits-list">${VisitRequestTable()}</div>
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
  const search = document.querySelector("[data-visit-search]");
  search?.addEventListener("input", () => {
    searchQuery = search.value;
    const list = document.querySelector("#visits-list");
    if (list) list.innerHTML = VisitRequestTable();
    bindVisitActions();
  });
  bindVisitActions();
}

function bindVisitActions() {
  document.querySelectorAll("[data-visit-dialog]").forEach((button) => button.addEventListener("click", () => openVisitDialog(button.dataset.visitDialog, button.dataset.visitId)));
  document.querySelectorAll("[data-visit-status]").forEach((button) => {
    button.addEventListener("click", () => {
      button.disabled = true;
      void updateVisitStatus(button.dataset.visitId, button.dataset.visitStatus).catch(() => {
        button.disabled = false;
        window.alert("La mise à jour de la demande a échoué. Vérifiez la connexion puis réessayez.");
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

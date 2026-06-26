const tripDetailRoutes = {
  home: "/",
  trips: "/voyages",
  alerts: "/voyages/alertes",
  login: "/login",
};

let tripDetailState = {
  listing: null,
};

function tripDetailRouteHref(path) {
  return window.PencmiConfig?.routeHref ? window.PencmiConfig.routeHref(path) : path;
}

function tripDetailMetadata() {
  return tripDetailState.listing?.metadata || {};
}

function tripDetailAdvertiser() {
  return pencmiBuildAdvertiser(tripDetailState.listing?.owner);
}

function tripDetailHeader() {
  document.querySelector("#trip-detail-header").innerHTML = `
    <a class="brand" href="${tripDetailRouteHref(tripDetailRoutes.home)}"><span class="brand-mark">P</span><span><strong>Péncmi</strong><small>Détail trajet</small></span></a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="trip-detail-menu" aria-label="Ouvrir le menu"><span></span><span></span><span></span></button>
    <div class="header-panel" id="trip-detail-menu"><nav class="main-nav"><a href="${tripDetailRouteHref(tripDetailRoutes.trips)}">Voyages</a><a href="${tripDetailRouteHref(tripDetailRoutes.alerts)}">Alertes</a></nav><div class="header-actions"><a class="btn btn-ghost" href="${tripDetailRouteHref(tripDetailRoutes.login)}">Se connecter</a></div></div>
  `;

  const toggle = document.querySelector(".menu-toggle");
  const panel = document.querySelector(".header-panel");
  toggle?.addEventListener("click", () => {
    const isOpen = panel.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
}

function tripNotFound() {
  return `<section class="trip-empty"><div><h1>Trajet introuvable</h1><p>Le trajet demandé n’est pas disponible pour le moment.</p><div class="trip-empty-actions"><a class="btn btn-primary" href="${tripDetailRouteHref(tripDetailRoutes.trips)}">Retour aux trajets</a><a class="btn btn-ghost" href="${tripDetailRouteHref(tripDetailRoutes.alerts)}">Créer une alerte</a></div></div></section>`;
}

function tripConditionsSection() {
  const metadata = tripDetailMetadata();
  const conditions = Array.isArray(metadata.conditions) ? metadata.conditions : [];
  return `<section class="trip-detail-card"><h2>Conditions</h2>${conditions.length ? `<div class="trip-chip-row">${conditions.map((item) => `<span class="trip-chip">${item}</span>`).join("")}</div>` : `<p>Aucune condition renseignée pour le moment.</p>`}</section>`;
}

function tripVehicleSection() {
  const metadata = tripDetailMetadata();
  const items = [
    ["Véhicule", metadata.vehicleLabel],
    ["Heure d’arrivée estimée", metadata.estimatedArrivalTime],
    ["Durée estimée", metadata.estimatedDuration],
    ["Bagages", metadata.luggageAllowed ? "Acceptés" : ""],
    ["Gros bagages", metadata.largeLuggageAllowed ? "Acceptés" : ""],
    ["Climatisation", metadata.airConditioning ? "Oui" : ""],
    ["Trajet direct", metadata.directTrip ? "Oui" : ""],
  ].filter(([, value]) => value);
  return `<section class="trip-detail-card"><h2>Informations véhicule</h2>${items.length ? `<div class="trip-chip-row">${items.map(([label, value]) => `<span class="trip-chip">${label} : ${value}</span>`).join("")}</div>` : `<p>Aucune information véhicule disponible.</p>`}</section>`;
}

function tripAdvertiserCard() {
  const advertiser = tripDetailAdvertiser();
  return `
    <aside class="trip-detail-card">
      <h2>Profil conducteur ou transporteur</h2>
      ${advertiser.logoUrl ? `<img src="${advertiser.logoUrl}" alt="${advertiser.name}" style="width:72px;height:72px;object-fit:contain;border-radius:18px;border:1px solid var(--border);background:var(--surface-soft);">` : ""}
      <p><strong>${advertiser.name}</strong></p>
      ${advertiser.type ? `<p>${advertiser.type}</p>` : ""}
      ${advertiser.city ? `<p>${advertiser.city}</p>` : ""}
      ${advertiser.openingHours ? `<p>${advertiser.openingHours}</p>` : ""}
      ${advertiser.verified ? `<div class="trip-chip-row"><span class="trip-chip">Professionnel vérifié</span></div>` : ""}
      <div class="trip-detail-actions">
        <a class="btn btn-light" href="${pencmiAdvertiserHref(advertiser.id)}">Voir le profil</a>
        ${advertiser.phone ? `<a class="btn btn-ghost" href="tel:${advertiser.phone}">Téléphone</a>` : ""}
        ${advertiser.whatsapp ? `<a class="btn btn-primary" target="_blank" rel="noreferrer" href="https://wa.me/${advertiser.whatsapp.replace(/\D/g, "")}">WhatsApp</a>` : ""}
      </div>
    </aside>
  `;
}

function tripReservationModal() {
  return `
    <div class="modal-backdrop" id="trip-reservation-modal" aria-hidden="true">
      <section class="trip-modal-card" role="dialog" aria-modal="true" aria-labelledby="trip-reservation-title">
        <h2 id="trip-reservation-title">Demander une place</h2>
        <form class="trip-form-grid" id="trip-reservation-form">
          <label class="trip-form-field"><span>Nom</span><input type="text" name="clientName" required></label>
          <label class="trip-form-field"><span>Téléphone</span><input type="tel" name="clientPhone"></label>
          <label class="trip-form-field"><span>Email</span><input type="email" name="clientEmail"></label>
          <label class="trip-form-field"><span>Nombre de places</span><input type="number" name="requestedSeats" min="1" value="1"></label>
          <label class="choice-card"><input type="checkbox" name="luggage" value="1"><span>Bagages</span></label>
          <label class="trip-form-field"><span>Message</span><textarea name="message">Bonjour, je suis intéressé par ce trajet. Y a-t-il encore des places disponibles ?</textarea></label>
          <div class="trip-form-actions" style="grid-column:1 / -1;">
            <button class="btn btn-ghost" type="button" data-close-reservation>Annuler</button>
            <button class="btn btn-primary" type="submit">Envoyer la demande</button>
          </div>
        </form>
        <p id="trip-reservation-confirmation" hidden>Votre demande de place a été envoyée.</p>
      </section>
    </div>
  `;
}

function tripContactModal() {
  const advertiser = tripDetailAdvertiser();
  const emailHref = advertiser.email ? `mailto:${advertiser.email}?subject=${encodeURIComponent(`Trajet ${tripDetailState.listing?.title || "Péncmi"}`)}` : "";
  return `
    <div class="modal-backdrop" id="trip-contact-modal" aria-hidden="true">
      <section class="trip-modal-card" role="dialog" aria-modal="true" aria-labelledby="trip-contact-title">
        <h2 id="trip-contact-title">Contacter le transporteur</h2>
        <div class="trip-chip-row">
          ${advertiser.phone ? `<a class="btn btn-light" href="tel:${advertiser.phone}">Appeler</a>` : ""}
          ${advertiser.whatsapp ? `<a class="btn btn-primary" target="_blank" rel="noreferrer" href="https://wa.me/${advertiser.whatsapp.replace(/\D/g, "")}">WhatsApp</a>` : ""}
          ${advertiser.email ? `<a class="btn btn-ghost" href="${emailHref}">Email</a>` : ""}
        </div>
        <div class="trip-form-actions"><button class="btn btn-ghost" type="button" data-close-contact>Fermer</button></div>
      </section>
    </div>
  `;
}

function tripDetailPage() {
  if (!tripDetailState.listing) {
    document.querySelector("#trip-detail-page").innerHTML = tripNotFound();
    return;
  }

  const listing = tripDetailState.listing;
  const metadata = tripDetailMetadata();

  document.querySelector("#trip-detail-page").innerHTML = `
    <div class="trip-detail-grid">
      <div>
        <section class="trip-detail-card">
          <h1>${listing.title}</h1>
          <div class="trip-card-line">
            <div><span>${listing.departureTime || ""}</span><strong>${listing.departureCity}</strong><small>${listing.departurePoint || ""}</small></div>
            <div class="trip-line-dot"></div>
            <div><span>${metadata.estimatedArrivalTime || ""}</span><strong>${listing.arrivalCity}</strong><small>${listing.arrivalPoint || ""}</small></div>
          </div>
          <div class="trip-chip-row">
            ${listing.vehicleType ? `<span class="trip-chip">${listing.vehicleType}</span>` : ""}
            ${listing.availableSeats ? `<span class="trip-chip">${listing.availableSeats} places</span>` : ""}
            ${listing.pricePerSeat ? `<span class="trip-chip">${pencmiFormatPrice(listing.pricePerSeat, listing.currency || "FCFA")}</span>` : ""}
            ${listing.departureDate ? `<span class="trip-chip">${pencmiFormatDate(listing.departureDate)}</span>` : ""}
          </div>
          ${metadata.description ? `<p>${metadata.description}</p>` : ""}
          <div class="trip-detail-actions" id="reservation">
            <button class="btn btn-ghost" type="button" data-share>Partager</button>
            ${typeof ReportButton === "function" ? ReportButton("Signaler") : ""}
            <button class="btn btn-light" type="button" data-open-contact>Envoyer un message</button>
            <button class="btn btn-primary" type="button" data-open-reservation>Demander une place</button>
          </div>
        </section>
        ${tripVehicleSection()}
        ${tripConditionsSection()}
        ${typeof SafetyTipsBox === "function" ? SafetyTipsBox("trips") : ""}
      </div>
      ${tripAdvertiserCard()}
    </div>
    ${tripReservationModal()}
    ${tripContactModal()}
    ${typeof ReportModal === "function" ? ReportModal() : ""}
  `;

  bindTripDetailActions();
  if (typeof bindReportModal === "function") {
    bindReportModal(document);
  }
}

function bindTripDetailActions() {
  document.querySelector("[data-open-reservation]")?.addEventListener("click", () => {
    document.querySelector("#trip-reservation-modal")?.classList.add("is-open");
  });
  document.querySelector("[data-close-reservation]")?.addEventListener("click", () => {
    document.querySelector("#trip-reservation-modal")?.classList.remove("is-open");
  });
  document.querySelector("[data-open-contact]")?.addEventListener("click", () => {
    document.querySelector("#trip-contact-modal")?.classList.add("is-open");
  });
  document.querySelector("[data-close-contact]")?.addEventListener("click", () => {
    document.querySelector("#trip-contact-modal")?.classList.remove("is-open");
  });
  document.querySelector("[data-share]")?.addEventListener("click", async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: tripDetailState.listing?.title || "Péncmi", url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(url).catch(() => undefined);
  });

  document.querySelector("#trip-reservation-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    await pencmiApiRequest(`/voyages/${encodeURIComponent(tripDetailState.listing.id)}/seat-requests`, {
      method: "POST",
      body: JSON.stringify({
        clientName: formData.get("clientName"),
        clientPhone: formData.get("clientPhone"),
        clientEmail: formData.get("clientEmail"),
        requestedSeats: Number(formData.get("requestedSeats") || 1),
        luggage: formData.get("luggage") === "1",
        message: formData.get("message"),
      }),
    });

    const confirmation = document.querySelector("#trip-reservation-confirmation");
    if (confirmation) {
      confirmation.hidden = false;
    }
    event.currentTarget.reset();
  });
}

async function loadTripDetail() {
  const id = pencmiQueryValue("id");
  if (!id) {
    tripDetailState.listing = null;
    return;
  }
  tripDetailState.listing = await pencmiApiRequest(`/voyages/${encodeURIComponent(id)}`);
}

document.addEventListener("DOMContentLoaded", async () => {
  tripDetailHeader();
  try {
    await loadTripDetail();
  } catch {
    tripDetailState.listing = null;
  }
  tripDetailPage();
});

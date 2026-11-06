const tripDetailRoutes = {
  home: "/",
  trips: "/voyages",
  alerts: "/voyages/alertes",
  login: "/login",
};

const tripDetailEscape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const tripDetailDisplay = value => typeof value === 'string' ? tripDetailEscape(value) : Array.isArray(value) ? value.map(tripDetailDisplay) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, tripDetailDisplay(item)])) : value;
let tripRequestId, tripRequestBusy = false, tripDetailContent;

let tripDetailState = {
  listing: null,
};

function tripDetailRouteHref(path) {
  return window.PencmiConfig?.routeHref ? window.PencmiConfig.routeHref(path) : path;
}

function tripDetailMetadata() {
  return tripDetailDisplay(tripDetailState.listing?.metadata || {});
}

function tripDetailAdvertiser() {
  const advertiser = pencmiBuildAdvertiser(tripDetailState.listing?.owner);
  const c = tripDetailState.listing?.metadata?.contactPreferences || {};
  return tripDetailDisplay({ ...advertiser, phone: c.phoneEnabled ? c.phoneNumber : '', whatsapp: c.whatsappEnabled ? c.whatsappNumber : '', email: c.emailEnabled ? c.contactEmail : '' });
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
    ["Heure d’arrivée estimée", metadata.estimatedArrivalTime ? metadata.estimatedArrivalTime + (metadata.arrivalDayOffset > 1 ? ` (J+${metadata.arrivalDayOffset})` : metadata.arrivalNextDay ? ' (lendemain)' : '') : ''],
    ["Durée estimée", !metadata.durationMinutes ? metadata.estimatedDuration : ''],
    ["Bagages", metadata.luggageAllowed ? "Acceptés" : ""],
    ["Gros bagages", metadata.largeLuggageAllowed ? "Acceptés" : ""],
    ["Climatisation", metadata.airConditioning ? "Oui" : ""],
    ['Bagages inclus dans le prix', typeof metadata.luggageIncluded === 'boolean' ? metadata.luggageIncluded ? 'Oui' : 'Non' : ''],
    ['Supplément bagage', metadata.luggageExtra != null ? `${metadata.luggageExtra} FCFA` : ''],
    ['Prix négociable', metadata.negotiable ? 'Oui' : ''],
    ['Informations passagers', metadata.passengerInfo],
    ['Durée estimée', metadata.durationMinutes ? `${metadata.durationMinutes} minutes` : ''],
    ['Arrivée estimée', tripDetailState.listing?.estimatedArrivalAt ? new Date(tripDetailState.listing.estimatedArrivalAt).toLocaleString('fr-FR',{timeZone:'Africa/Dakar'}) : ''],
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
          <label class="trip-form-field"><span>Nombre de places</span><input type="number" name="requestedSeats" min="1" max="${Number(tripDetailState.listing?.availableSeats) || 1}" value="1" required></label>
          <label class="choice-card"><input type="checkbox" name="luggage" value="1"><span>Bagages</span></label>
          <label class="trip-form-field"><span>Message</span><textarea name="message">Bonjour, je suis intéressé par ce trajet. Y a-t-il encore des places disponibles ?</textarea></label>
          <div class="trip-form-actions" style="grid-column:1 / -1;">
            <button class="btn btn-ghost" type="button" data-close-reservation>Annuler</button>
            <button class="btn btn-primary" type="submit">Envoyer la demande</button>
          </div>
        </form>
        <p id="trip-reservation-confirmation" hidden>Votre demande de place a été envoyée.</p>
        <p id="trip-reservation-error" role="alert" hidden></p>
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

  const listing = tripDetailDisplay(tripDetailState.listing);
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
            ${listing.vehicleType ? `<span class="trip-chip">${tripDetailContent.tripTypes[listing.vehicleType] || listing.vehicleType}</span>` : ""}
            ${listing.availableSeats ? `<span class="trip-chip">${listing.availableSeats} places</span>` : ""}
            ${listing.pricePerSeat ? `<span class="trip-chip">${pencmiFormatPrice(listing.pricePerSeat, listing.currency || "FCFA")}</span>` : ""}
            ${listing.departureDate ? `<span class="trip-chip">${new Date(listing.departureDate).toLocaleDateString('fr-FR', { timeZone: 'Africa/Dakar' })}</span>` : ""}
          </div>
          ${metadata.description ? `<p>${metadata.description}</p>` : ""}
          ${metadata.instructions ? `<p>${metadata.instructions}</p>` : ''}
          ${metadata.meetingPoints ? `<p>Rendez-vous : ${metadata.meetingPoints}</p>` : ''}
          <p>${listing.occurrenceId ? `${listing.availableSeats} places restantes sur ${listing.offeredSeats} proposées. La demande doit être acceptée pour être confirmée.` : 'Départ historique : disponibilité à confirmer. Les nouvelles demandes sont indisponibles tant que ce départ n’a pas été revalidé.'}</p>
          ${(listing.occurrences?.length||0)>1?`<label class="trip-form-field"><span>Choisir le départ</span><select data-select-occurrence>${listing.occurrences.map(item=>`<option value="${item.id}"${item.id===listing.occurrenceId?' selected':''}>${new Date(item.departureAt).toLocaleString('fr-FR',{timeZone:'Africa/Dakar'})} · ${item.remainingSeats} places</option>`).join('')}</select></label>`:''}
          ${(metadata.stops||[]).length?`<h2>Arrêts intermédiaires</h2><ol>${metadata.stops.map(stop=>`<li>${stop.city} — ${stop.point||''}${stop.arrivalTime?` · ${stop.arrivalTime}${stop.nextDay?' (lendemain)':''}`:''}${stop.boarding?' · montée':''}${stop.alighting?' · descente':''}</li>`).join('')}</ol>`:''}
          ${(metadata.rendezvous||[]).length?`<h2>Rendez-vous</h2><ul>${metadata.rendezvous.map(item=>`<li>${item.label} : ${item.point}</li>`).join('')}</ul>`:''}
          <div class="trip-detail-actions" id="reservation">
            <button class="btn btn-ghost" type="button" data-share>Partager</button>
            ${typeof ReportButton === "function" ? ReportButton("Signaler") : ""}
            <button class="btn btn-light" type="button" data-open-contact>Contacter le transporteur</button>
            <span data-listing-messaging></span>
            <span data-favorite-module="trips" data-favorite-id="${String(listing.id).replace(/[^A-Za-z0-9_-]/g, '')}"></span>
            ${listing.occurrenceId && listing.availableSeats > 0 && metadata.contactPreferences?.reservationRequestEnabled !== false ? '<button class="btn btn-primary" type="button" data-open-reservation>Demander une place</button>' : ''}
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
  const tripListing = tripDetailState.listing;
  if (tripListing?.metadata?.contactPreferences?.internalMessagingEnabled === true) {
    void import('../../messaging/listing-messaging.mjs').then(({ mountListingMessaging }) => mountListingMessaging(document.querySelector('[data-listing-messaging]'), { module: 'trips', listingId: tripListing.id, listingTitle: tripListing.title, enabled: true }));
  }
  document.querySelector('[data-select-occurrence]')?.addEventListener('change',event=>{const url=new URL(location.href);url.searchParams.set('occurrenceId',event.target.value);location.href=url;});
  document.querySelector("[data-open-reservation]")?.addEventListener("click", () => {
    document.querySelector("#trip-reservation-modal")?.classList.add("is-open");
    document.querySelector('#trip-reservation-modal')?.setAttribute('aria-hidden', 'false');
  });
  document.querySelector("[data-close-reservation]")?.addEventListener("click", () => {
    document.querySelector("#trip-reservation-modal")?.classList.remove("is-open");
    document.querySelector('#trip-reservation-modal')?.setAttribute('aria-hidden', 'true');
  });
  document.querySelector("[data-open-contact]")?.addEventListener("click", () => {
    document.querySelector("#trip-contact-modal")?.classList.add("is-open");
    document.querySelector('#trip-contact-modal')?.setAttribute('aria-hidden', 'false');
  });
  document.querySelector("[data-close-contact]")?.addEventListener("click", () => {
    document.querySelector("#trip-contact-modal")?.classList.remove("is-open");
    document.querySelector('#trip-contact-modal')?.setAttribute('aria-hidden', 'true');
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
    if (tripRequestBusy) return;
    const form = event.currentTarget, button = form.querySelector('[type="submit"]'), errorBox = document.querySelector('#trip-reservation-error');
    const formData = new FormData(form);
    if (!formData.get('clientPhone') && !formData.get('clientEmail')) { errorBox.textContent = 'Renseignez un téléphone ou un email.'; errorBox.hidden = false; return; }
    tripRequestBusy = true; button.disabled = true; errorBox.hidden = true;
    try {
    const { publicationOperationId } = await import('../../publier/real-estate-api.mjs');
    tripRequestId ||= publicationOperationId();
    await pencmiApiRequest(`/voyages/${encodeURIComponent(tripDetailState.listing.id)}/seat-requests`, {
      method: "POST",
      body: JSON.stringify({
        requestId: tripRequestId,
        occurrenceId: tripDetailState.listing.occurrenceId,
        clientName: formData.get("clientName"),
        clientPhone: formData.get("clientPhone") || undefined,
        clientEmail: formData.get("clientEmail") || undefined,
        requestedSeats: Number(formData.get("requestedSeats") || 1),
        luggage: formData.get("luggage") === "1",
        message: formData.get("message"),
      }),
    });

    const confirmation = document.querySelector("#trip-reservation-confirmation");
    if (confirmation) {
      confirmation.hidden = false;
      confirmation.textContent = 'Votre demande a été reçue. Elle ne constitue pas une réservation confirmée.';
    }
    form.hidden = true;
    const close = document.createElement('button'); close.type = 'button'; close.className = 'btn btn-light'; close.textContent = 'Fermer'; close.onclick = () => { const modal = document.querySelector('#trip-reservation-modal'); modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true'); }; confirmation.append(close);
    } catch (error) { errorBox.textContent = error.message || 'Envoi impossible. Vos données sont conservées.'; errorBox.hidden = false; }
    finally { tripRequestBusy = false; button.disabled = false; }
  });
}

async function loadTripDetail() {
  const id = pencmiQueryValue("id");
  if (!id) {
    tripDetailState.listing = null;
    return;
  }
  const occurrenceId=pencmiQueryValue('occurrenceId');
  tripDetailState.listing = await pencmiApiRequest(`/voyages/${encodeURIComponent(id)}${occurrenceId?`?occurrenceId=${encodeURIComponent(occurrenceId)}`:''}`);
}

document.addEventListener("DOMContentLoaded", async () => {
  tripDetailContent = await import('../trip-content.mjs');
  tripDetailHeader();
  try {
    await loadTripDetail();
  } catch {
    tripDetailState.listing = null;
  }
  tripDetailPage();
});
void import("../../saved/enhance.mjs").catch(() => {});

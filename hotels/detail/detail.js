const hotelDetailRoutes = {
  home: "/",
  hotels: "/hotels",
  alerts: "/hotels/alertes",
  login: "/login",
};

let hotelDetailState = {
  listing: null,
};

function hotelDetailRouteHref(path) {
  return window.PencmiConfig?.routeHref ? window.PencmiConfig.routeHref(path) : path;
}

function hotelDetailMetadata() {
  return hotelDetailState.listing?.metadata || {};
}

function hotelDetailAdvertiser() {
  return pencmiBuildAdvertiser(hotelDetailState.listing?.owner);
}

function hotelDetailPhotos() {
  return pencmiListingPhotos(hotelDetailMetadata());
}

function hotelDetailHeader() {
  document.querySelector("#hotel-detail-header").innerHTML = `
    <a class="brand" href="${hotelDetailRouteHref(hotelDetailRoutes.home)}" aria-label="Accueil Péncmi"><span class="brand-mark">P</span><span><strong>Péncmi</strong><small>Détail hébergement</small></span></a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="hotel-detail-menu" aria-label="Ouvrir le menu"><span></span><span></span><span></span></button>
    <div class="header-panel" id="hotel-detail-menu"><nav class="main-nav" aria-label="Navigation principale"><a href="${hotelDetailRouteHref(hotelDetailRoutes.hotels)}">Hôtels</a><a href="${hotelDetailRouteHref(hotelDetailRoutes.alerts)}">Alertes</a></nav><div class="header-actions"><a class="btn btn-ghost" href="${hotelDetailRouteHref(hotelDetailRoutes.login)}">Se connecter</a></div></div>
  `;

  const toggle = document.querySelector(".menu-toggle");
  const panel = document.querySelector(".header-panel");
  toggle?.addEventListener("click", () => {
    const isOpen = panel.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
}

function hotelNotFound() {
  return `
    <section class="hotel-empty">
      <div>
        <h1>Hébergement introuvable</h1>
        <p>L’hébergement demandé n’est pas disponible pour le moment.</p>
        <div class="hotel-empty-actions">
          <a class="btn btn-primary" href="${hotelDetailRouteHref(hotelDetailRoutes.hotels)}">Retour aux hébergements</a>
          <a class="btn btn-ghost" href="${hotelDetailRouteHref(hotelDetailRoutes.alerts)}">Créer une alerte</a>
        </div>
      </div>
    </section>
  `;
}

function hotelGallery() {
  const photos = hotelDetailPhotos();
  const firstPhoto = photos[0];

  if (!firstPhoto) {
    return `<section class="hotel-detail-card"><div class="hotel-photo-placeholder">Aucune photo disponible pour le moment.</div></section>`;
  }

  return `
    <section class="hotel-detail-card">
      <img src="${firstPhoto}" alt="${hotelDetailState.listing.name}" id="hotel-main-photo" style="width:100%;max-height:420px;object-fit:cover;border-radius:18px;">
      ${photos.length > 1 ? `<div class="hotel-chip-row">${photos.map((photo, index) => `<button class="btn btn-ghost" type="button" data-hotel-photo="${photo}"${index === 0 ? ' aria-current="true"' : ""}>Photo ${index + 1}</button>`).join("")}</div>` : ""}
    </section>
  `;
}

function hotelRooms() {
  const rooms = Array.isArray(hotelDetailState.listing?.rooms) ? hotelDetailState.listing.rooms : [];
  return `
    <section class="hotel-detail-card" id="reservation">
      <h2>Chambres et logements disponibles</h2>
      ${rooms.length ? `<div class="hotel-room-grid">${rooms.map((room) => `
        <article class="hotel-detail-card">
          <h2>${room.name}</h2>
          <p>${[room.roomType, room.capacity ? `${room.capacity} personnes` : ""].filter(Boolean).join(" · ")}</p>
          <div class="hotel-chip-row">${room.status ? `<span class="hotel-chip">${room.status}</span>` : ""}</div>
          <button class="btn btn-primary" type="button" data-open-reservation data-room-name="${room.name}">Demander une réservation</button>
        </article>
      `).join("")}</div>` : `<p>Aucune chambre ou logement renseigné pour le moment.</p>`}
    </section>
  `;
}

function hotelAmenitiesSection() {
  const amenities = Array.isArray(hotelDetailMetadata().amenities) ? hotelDetailMetadata().amenities : [];
  return `<section class="hotel-detail-card"><h2>Commodités</h2>${amenities.length ? `<div class="hotel-chip-row">${amenities.map((item) => `<span class="hotel-chip">${item}</span>`).join("")}</div>` : `<p>Aucune commodité renseignée pour le moment.</p>`}</section>`;
}

function hotelConditionsSection() {
  const conditions = Array.isArray(hotelDetailMetadata().conditions) ? hotelDetailMetadata().conditions : [];
  return `<section class="hotel-detail-card"><h2>Conditions</h2>${conditions.length ? `<div class="hotel-chip-row">${conditions.map((item) => `<span class="hotel-chip">${item}</span>`).join("")}</div>` : `<p>Aucune condition renseignée pour le moment.</p>`}</section>`;
}

function hotelAdvertiserCard() {
  const advertiser = hotelDetailAdvertiser();
  return `
    <aside class="hotel-detail-card">
      <h2>Profil annonceur</h2>
      ${advertiser.logoUrl ? `<img src="${advertiser.logoUrl}" alt="${advertiser.name}" style="width:72px;height:72px;object-fit:contain;border-radius:18px;border:1px solid var(--border);background:var(--surface-soft);">` : ""}
      <p><strong>${advertiser.name}</strong></p>
      ${advertiser.type ? `<p>${advertiser.type}</p>` : ""}
      ${advertiser.city ? `<p>${advertiser.city}</p>` : ""}
      ${advertiser.openingHours ? `<p>${advertiser.openingHours}</p>` : ""}
      ${advertiser.verified ? `<div class="hotel-chip-row"><span class="hotel-chip">Professionnel vérifié</span></div>` : ""}
      <div class="hotel-detail-actions">
        <a class="btn btn-light" href="${pencmiAdvertiserHref(advertiser.id)}">Voir le profil</a>
        ${advertiser.phone ? `<a class="btn btn-ghost" href="tel:${advertiser.phone}">Téléphone</a>` : ""}
        ${advertiser.whatsapp ? `<a class="btn btn-primary" target="_blank" rel="noreferrer" href="https://wa.me/${advertiser.whatsapp.replace(/\D/g, "")}">WhatsApp</a>` : ""}
      </div>
    </aside>
  `;
}

function hotelReservationModal() {
  const listing = hotelDetailState.listing;
  return `
    <div class="modal-backdrop" id="reservation-modal" aria-hidden="true">
      <section class="hotel-modal-card" role="dialog" aria-modal="true" aria-labelledby="reservation-title">
        <h2 id="reservation-title">Demander une réservation</h2>
        <form class="hotel-form-grid" id="hotel-reservation-form">
          <label class="hotel-form-field"><span>Nom</span><input type="text" name="clientName" required></label>
          <label class="hotel-form-field"><span>Téléphone</span><input type="tel" name="clientPhone"></label>
          <label class="hotel-form-field"><span>Email</span><input type="email" name="clientEmail"></label>
          <label class="hotel-form-field"><span>Chambre ou logement</span><input type="text" name="roomName" id="hotel-room-name"></label>
          <label class="hotel-form-field"><span>Date d’arrivée</span><input type="date" name="checkIn"></label>
          <label class="hotel-form-field"><span>Date de départ</span><input type="date" name="checkOut"></label>
          <label class="hotel-form-field"><span>Nombre de voyageurs</span><input type="number" name="guests" min="1" value="1"></label>
          <label class="hotel-form-field"><span>Message</span><textarea name="message">Bonjour, je souhaite réserver cet hébergement.</textarea></label>
          <div class="hotel-form-actions" style="grid-column:1 / -1;">
            <button class="btn btn-ghost" type="button" data-close-modal>Annuler</button>
            <button class="btn btn-primary" type="submit">Envoyer la demande</button>
          </div>
        </form>
        <p id="reservation-message" hidden>Votre demande a été envoyée. L’établissement vous confirmera la disponibilité.</p>
        ${listing ? `<p style="margin-top:12px;color:var(--muted);">${listing.name}</p>` : ""}
      </section>
    </div>
  `;
}

function hotelContactModal() {
  const advertiser = hotelDetailAdvertiser();
  const emailHref = advertiser.email ? `mailto:${advertiser.email}?subject=${encodeURIComponent(`Demande d'information - ${hotelDetailState.listing?.name || "Péncmi"}`)}` : "";
  return `
    <div class="modal-backdrop" id="contact-modal" aria-hidden="true">
      <section class="hotel-modal-card" role="dialog" aria-modal="true" aria-labelledby="contact-title">
        <h2 id="contact-title">Contacter l’établissement</h2>
        <div class="hotel-chip-row">
          ${advertiser.phone ? `<a class="btn btn-light" href="tel:${advertiser.phone}">Appeler</a>` : ""}
          ${advertiser.whatsapp ? `<a class="btn btn-primary" target="_blank" rel="noreferrer" href="https://wa.me/${advertiser.whatsapp.replace(/\D/g, "")}">WhatsApp</a>` : ""}
          ${advertiser.email ? `<a class="btn btn-ghost" href="${emailHref}">Email</a>` : ""}
        </div>
        <div class="hotel-form-actions">
          <button class="btn btn-ghost" type="button" data-close-contact>Fermer</button>
        </div>
      </section>
    </div>
  `;
}

function hotelDetailPage() {
  if (!hotelDetailState.listing) {
    document.querySelector("#hotel-detail-page").innerHTML = hotelNotFound();
    return;
  }

  const listing = hotelDetailState.listing;
  const metadata = hotelDetailMetadata();

  document.querySelector("#hotel-detail-page").innerHTML = `
    <div class="hotel-detail-grid">
      <div>
        ${hotelGallery()}
        <section class="hotel-detail-card">
          <h1>${listing.name}</h1>
          <div class="hotel-chip-row">
            ${listing.propertyType ? `<span class="hotel-chip">${listing.propertyType}</span>` : ""}
            ${listing.city ? `<span class="hotel-chip">${listing.city}</span>` : ""}
            ${metadata.stars ? `<span class="hotel-chip">${metadata.stars} étoiles</span>` : ""}
          </div>
          ${listing.description ? `<p>${listing.description}</p>` : ""}
          <div class="hotel-detail-actions">
            <button class="btn btn-ghost" type="button" data-share>Partager</button>
            ${typeof ReportButton === "function" ? ReportButton("Signaler") : ""}
            <button class="btn btn-light" type="button" data-open-contact>Contacter</button>
            <button class="btn btn-primary" type="button" data-open-reservation>Demander une réservation</button>
          </div>
        </section>
        ${hotelRooms()}
        ${hotelAmenitiesSection()}
        ${hotelConditionsSection()}
        ${typeof SafetyTipsBox === "function" ? SafetyTipsBox("hotels") : ""}
      </div>
      ${hotelAdvertiserCard()}
    </div>
    ${hotelReservationModal()}
    ${hotelContactModal()}
    ${typeof ReportModal === "function" ? ReportModal() : ""}
  `;

  bindHotelDetailActions();
  if (typeof bindReportModal === "function") {
    bindReportModal(document);
  }
}

function bindHotelDetailActions() {
  const mainPhoto = document.querySelector("#hotel-main-photo");
  document.querySelectorAll("[data-hotel-photo]").forEach((button) => {
    button.addEventListener("click", () => {
      if (mainPhoto) {
        mainPhoto.src = button.dataset.hotelPhoto || "";
      }
    });
  });

  document.querySelectorAll("[data-open-reservation]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelector("#reservation-modal")?.classList.add("is-open");
      const roomName = button.dataset.roomName || "";
      const input = document.querySelector("#hotel-room-name");
      if (input) {
        input.value = roomName;
      }
    });
  });

  document.querySelector("[data-close-modal]")?.addEventListener("click", () => {
    document.querySelector("#reservation-modal")?.classList.remove("is-open");
  });

  document.querySelector("[data-open-contact]")?.addEventListener("click", () => {
    document.querySelector("#contact-modal")?.classList.add("is-open");
  });

  document.querySelector("[data-close-contact]")?.addEventListener("click", () => {
    document.querySelector("#contact-modal")?.classList.remove("is-open");
  });

  document.querySelector("[data-share]")?.addEventListener("click", async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: hotelDetailState.listing?.name || "Péncmi", url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(url).catch(() => undefined);
  });

  document.querySelector("#hotel-reservation-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const message = [formData.get("message"), formData.get("roomName") ? `Chambre souhaitée : ${formData.get("roomName")}` : ""].filter(Boolean).join("\n");

    await pencmiApiRequest(`/hotels/${encodeURIComponent(hotelDetailState.listing.id)}/reservation-requests`, {
      method: "POST",
      body: JSON.stringify({
        clientName: formData.get("clientName"),
        clientPhone: formData.get("clientPhone"),
        clientEmail: formData.get("clientEmail"),
        checkIn: formData.get("checkIn") || undefined,
        checkOut: formData.get("checkOut") || undefined,
        guests: Number(formData.get("guests") || 1),
        message,
      }),
    });

    const confirmation = document.querySelector("#reservation-message");
    if (confirmation) {
      confirmation.hidden = false;
    }
    event.currentTarget.reset();
  });
}

async function loadHotelDetail() {
  const id = pencmiQueryValue("id");
  if (!id) {
    hotelDetailState.listing = null;
    return;
  }

  hotelDetailState.listing = await pencmiApiRequest(`/hotels/${encodeURIComponent(id)}`);
}

document.addEventListener("DOMContentLoaded", async () => {
  hotelDetailHeader();
  try {
    await loadHotelDetail();
  } catch {
    hotelDetailState.listing = null;
  }
  hotelDetailPage();
});

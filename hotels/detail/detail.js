const hotelDetailRoutes = {
  home: "/",
  hotels: "/hotels",
  alerts: "/hotels/alertes",
  login: "/login",
};

let hotelDetailState = {
  listing: null,
};
let hotelDetailReservation;
const hotelDetailEscape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const hotelCalendarDate = value => new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Dakar' }).format(new Date(value));

function hotelDetailRouteHref(path) {
  return window.PencmiConfig?.routeHref ? window.PencmiConfig.routeHref(path) : path;
}

function hotelDetailMetadata() {
  return hotelDetailState.listing?.metadata || {};
}

function hotelCanRequestReservation() {
  return hotelDetailState.listing?.rooms?.length > 0 && hotelDetailMetadata().contactPreferences?.reservationRequestEnabled !== false;
}

function hotelDetailAdvertiser() {
  const advertiser = pencmiBuildAdvertiser(hotelDetailState.listing?.owner);
  const preferences = hotelDetailMetadata().contactPreferences;
  if (!preferences || !Object.keys(preferences).length) return advertiser;
  return { ...advertiser, phone: preferences.phoneEnabled ? preferences.phoneNumber : '', whatsapp: preferences.whatsappEnabled ? preferences.whatsappNumber : '', email: preferences.emailEnabled ? preferences.contactEmail : '' };
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
      <img src="${hotelDetailEscape(firstPhoto)}" alt="${hotelDetailEscape(hotelDetailState.listing.name)}" id="hotel-main-photo" style="width:100%;max-height:420px;object-fit:cover;border-radius:8px;">
      ${photos.length > 1 ? `<div class="hotel-chip-row">${photos.map((photo, index) => `<button class="btn btn-ghost" type="button" data-hotel-photo="${hotelDetailEscape(photo)}"${index === 0 ? ' aria-current="true"' : ""}>Photo ${index + 1}</button>`).join("")}</div>` : ""}
    </section>
  `;
}

function hotelRooms() {
  const rooms = Array.isArray(hotelDetailState.listing?.rooms) ? hotelDetailState.listing.rooms : [];
  return `
    <section class="hotel-detail-card" id="reservation">
      <h2>Chambres et logements</h2>
      ${rooms.length ? `<div class="hotel-room-grid">${rooms.map((room) => `
        <article class="hotel-detail-card">
          <h3>${hotelDetailEscape(room.name)}</h3>
          ${room.photos?.length ? `<div class="hotel-chip-row">${room.photos.map((url, i) => `<button class="btn btn-ghost" type="button" data-hotel-photo="${hotelDetailEscape(url)}">Photo de la chambre ${i + 1}</button>`).join('')}</div>` : ''}
          <p>${hotelDetailEscape([room.roomType, room.capacity ? `${room.capacity} personnes` : ""].filter(Boolean).join(" · "))}</p>
          <p>${pencmiFormatPrice(room.basePrice, 'FCFA')} / nuit</p>
          <p>${(room.amenities || []).map(hotelDetailEscape).join(' · ')}</p>
          <p>Disponibilité à confirmer</p>
          ${room.rates?.length ? `<details><summary>Tarifs datés</summary>${room.rates.map(rate => `<p>${hotelCalendarDate(rate.date)} : ${pencmiFormatPrice(rate.price, rate.currency)}</p>`).join('')}</details>` : ''}
          ${room.availability?.length ? `<details><summary>Calendrier renseigné</summary>${room.availability.map(day => `<p>${hotelCalendarDate(day.date)} : ${hotelDetailEscape(({ open: day.stopSell ? 'Ventes suspendues' : 'Sur demande', closed: 'Fermé', full: 'Complet', maintenance: 'Maintenance', unconfirmed: 'À confirmer' })[day.status] || 'À confirmer')}${day.available !== undefined ? ` · ${Number(day.available)} unité(s)` : ''}</p>`).join('')}</details>` : ''}
          <button class="btn btn-primary" type="button" data-open-reservation data-room-id="${hotelDetailEscape(room.id)}" ${hotelCanRequestReservation() ? '' : 'disabled'}>Demander une réservation</button>
        </article>
      `).join("")}</div>` : `<p>Aucune chambre ou logement renseigné pour le moment.</p>`}
    </section>
  `;
}

function hotelAmenitiesSection() {
  const amenities = Array.isArray(hotelDetailMetadata().amenities) ? hotelDetailMetadata().amenities : [];
  return `<section class="hotel-detail-card"><h2>Commodités</h2>${amenities.length ? `<div class="hotel-chip-row">${amenities.map((item) => `<span class="hotel-chip">${hotelDetailEscape(item)}</span>`).join("")}</div>` : `<p>Aucune commodité renseignée pour le moment.</p>`}</section>`;
}

function hotelConditionsSection() {
  const conditions = Array.isArray(hotelDetailMetadata().conditions) ? hotelDetailMetadata().conditions : [];
  return `<section class="hotel-detail-card"><h2>Conditions</h2>${conditions.length ? `<div class="hotel-chip-row">${conditions.map((item) => `<span class="hotel-chip">${hotelDetailEscape(item)}</span>`).join("")}</div>` : `<p>Aucune condition renseignée pour le moment.</p>`}</section>`;
}

function hotelAdvertiserCard() {
  const advertiser = hotelDetailAdvertiser();
  return `
    <aside class="hotel-detail-card">
      <h2>Profil annonceur</h2>
      ${advertiser.logoUrl ? `<img src="${hotelDetailEscape(advertiser.logoUrl)}" alt="${hotelDetailEscape(advertiser.name)}" style="width:72px;height:72px;object-fit:contain;border-radius:8px;border:1px solid var(--border);background:var(--surface-soft);">` : ""}
      <p><strong>${hotelDetailEscape(advertiser.name)}</strong></p>
      ${advertiser.type ? `<p>${hotelDetailEscape(advertiser.type)}</p>` : ""}
      ${advertiser.city ? `<p>${hotelDetailEscape(advertiser.city)}</p>` : ""}
      ${advertiser.openingHours ? `<p>${hotelDetailEscape(advertiser.openingHours)}</p>` : ""}
      ${advertiser.verified ? `<div class="hotel-chip-row"><span class="hotel-chip">Professionnel vérifié</span></div>` : ""}
      <div class="hotel-detail-actions">
        <a class="btn btn-light" href="${pencmiAdvertiserHref(advertiser.id)}">Voir le profil</a>
        ${advertiser.phone ? `<a class="btn btn-ghost" href="tel:${hotelDetailEscape(advertiser.phone)}">Téléphone</a>` : ""}
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
          <label class="hotel-form-field"><span>Nom</span><input type="text" name="clientName" minlength="2" maxlength="120" autocomplete="name" required></label>
          <label class="hotel-form-field"><span>Téléphone</span><input type="tel" name="clientPhone" maxlength="30" autocomplete="tel"></label>
          <label class="hotel-form-field"><span>Email</span><input type="email" name="clientEmail" maxlength="254" autocomplete="email"></label>
          <label class="hotel-form-field"><span>Catégorie de chambre</span><select name="roomId" id="hotel-room-id" required><option value="">Choisir une catégorie</option>${(listing?.rooms || []).map(room => `<option value="${hotelDetailEscape(room.id)}">${hotelDetailEscape(room.name)}</option>`).join('')}</select></label>
          <label class="hotel-form-field"><span>Date d’arrivée</span><input type="date" name="checkIn" min="${hotelDetailReservation.reservationToday()}" required></label>
          <label class="hotel-form-field"><span>Date de départ</span><input type="date" name="checkOut" min="${hotelDetailReservation.reservationToday()}" required></label>
          <label class="hotel-form-field"><span>Nombre de voyageurs</span><input type="number" name="guests" min="1" max="100" value="1" required></label>
          <label class="hotel-form-field"><span>Nombre d’unités</span><input type="number" name="units" min="1" max="10" value="1" required></label>
          <label class="hotel-form-field"><span>Message</span><textarea name="message" maxlength="2000">Bonjour, je souhaite réserver cet hébergement.</textarea></label>
          <div id="hotel-stay-quote" class="hotel-reservation-feedback" aria-live="polite">Choisissez une chambre et les dates pour vérifier le séjour.</div>
          <div class="hotel-form-actions" style="grid-column:1 / -1;">
            <button class="btn btn-ghost" type="button" data-close-modal>Annuler</button>
            <button class="btn btn-primary" type="submit">Envoyer la demande</button>
          </div>
        </form>
        <p id="reservation-message" role="status" hidden></p>
        <button class="btn btn-light" type="button" data-new-hotel-request hidden>Nouvelle demande</button>
        ${listing ? `<p style="margin-top:12px;color:var(--muted);">${hotelDetailEscape(listing.name)}</p>` : ""}
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
          ${advertiser.phone ? `<a class="btn btn-light" href="tel:${hotelDetailEscape(advertiser.phone)}">Appeler</a>` : ""}
          ${advertiser.whatsapp ? `<a class="btn btn-primary" target="_blank" rel="noreferrer" href="https://wa.me/${advertiser.whatsapp.replace(/\D/g, "")}">WhatsApp</a>` : ""}
          ${advertiser.email ? `<a class="btn btn-ghost" href="${hotelDetailEscape(emailHref)}">Email</a>` : ""}
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
          <h1>${hotelDetailEscape(listing.name)}</h1>
          <div class="hotel-chip-row">
            ${listing.propertyType ? `<span class="hotel-chip">${hotelDetailEscape(listing.propertyType)}</span>` : ""}
            ${listing.city ? `<span class="hotel-chip">${hotelDetailEscape(listing.city)}</span>` : ""}
            ${metadata.stars ? `<span class="hotel-chip">${hotelDetailEscape(metadata.stars)} étoiles</span>` : ""}
          </div>
          ${listing.description ? `<p>${hotelDetailEscape(listing.description)}</p>` : ""}
          <div class="hotel-detail-actions">
            <button class="btn btn-ghost" type="button" data-share>Partager</button>
            ${typeof ReportButton === "function" ? ReportButton("Signaler") : ""}
            <button class="btn btn-light" type="button" data-open-contact>Contacter</button>
            <button class="btn btn-primary" type="button" data-open-reservation ${hotelCanRequestReservation() ? '' : 'disabled'}>Demander une réservation</button>
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

  hotelDetailReservation.bindHotelReservation({ property: hotelDetailState.listing, api: pencmiApiRequest, formatPrice: pencmiFormatPrice, escape: hotelDetailEscape });

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
  hotelDetailReservation = await import('../reservation.mjs');
  hotelDetailHeader();
  try {
    await loadHotelDetail();
  } catch {
    hotelDetailState.listing = null;
  }
  hotelDetailPage();
});

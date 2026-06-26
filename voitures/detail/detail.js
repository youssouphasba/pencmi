const vehicleDetailRoutes = {
  home: "/",
  vehicles: "/voitures",
  alerts: "/voitures/alertes",
  login: "/login",
};

let vehicleDetailState = {
  listing: null,
};

function vehicleDetailRouteHref(path) {
  return window.PencmiConfig?.routeHref ? window.PencmiConfig.routeHref(path) : path;
}

function vehicleDetailMetadata() {
  return vehicleDetailState.listing?.metadata || {};
}

function vehicleDetailAdvertiser() {
  return pencmiBuildAdvertiser(vehicleDetailState.listing?.owner);
}

function vehicleDetailPhotos() {
  return pencmiListingPhotos(vehicleDetailMetadata());
}

function vehicleDetailHeader() {
  document.querySelector("#vehicle-detail-header").innerHTML = `
    <a class="brand" href="${vehicleDetailRouteHref(vehicleDetailRoutes.home)}"><span class="brand-mark">P</span><span><strong>Péncmi</strong><small>Détail voiture</small></span></a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="vehicle-detail-menu" aria-label="Ouvrir le menu"><span></span><span></span><span></span></button>
    <div class="header-panel" id="vehicle-detail-menu"><nav class="main-nav"><a href="${vehicleDetailRouteHref(vehicleDetailRoutes.vehicles)}">Voitures</a><a href="${vehicleDetailRouteHref(vehicleDetailRoutes.alerts)}">Alertes</a></nav><div class="header-actions"><a class="btn btn-ghost" href="${vehicleDetailRouteHref(vehicleDetailRoutes.login)}">Se connecter</a></div></div>
  `;

  const toggle = document.querySelector(".menu-toggle");
  const panel = document.querySelector(".header-panel");
  toggle?.addEventListener("click", () => {
    const isOpen = panel.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
}

function vehicleNotFound() {
  return `<section class="vehicle-empty"><div><h1>Annonce introuvable</h1><p>L’annonce demandée n’est pas disponible pour le moment.</p><div class="vehicle-empty-actions"><a class="btn btn-primary" href="${vehicleDetailRouteHref(vehicleDetailRoutes.vehicles)}">Retour aux voitures</a><a class="btn btn-ghost" href="${vehicleDetailRouteHref(vehicleDetailRoutes.alerts)}">Créer une alerte</a></div></div></section>`;
}

function vehicleGallery() {
  const photos = vehicleDetailPhotos();
  const firstPhoto = photos[0];
  if (!firstPhoto) {
    return `<section class="vehicle-detail-card"><div class="vehicle-photo-placeholder">Aucune photo disponible pour le moment.</div></section>`;
  }

  return `
    <section class="vehicle-detail-card">
      <img src="${firstPhoto}" alt="${vehicleDetailState.listing.title}" id="vehicle-main-photo" style="width:100%;max-height:420px;object-fit:cover;border-radius:18px;">
      ${photos.length > 1 ? `<div class="vehicle-chip-row">${photos.map((photo, index) => `<button class="btn btn-ghost" type="button" data-vehicle-photo="${photo}"${index === 0 ? ' aria-current="true"' : ""}>Photo ${index + 1}</button>`).join("")}</div>` : ""}
    </section>
  `;
}

function vehicleSpecifications() {
  const metadata = vehicleDetailMetadata();
  const items = [
    ["Marque", metadata.brand],
    ["Modèle", metadata.model],
    ["Année", metadata.year],
    ["Kilométrage", metadata.mileage ? `${metadata.mileage} km` : ""],
    ["Carburant", metadata.fuel],
    ["Boîte", metadata.gearbox],
    ["Catégorie", metadata.category],
    ["Places", metadata.seats],
  ].filter(([, value]) => value);

  return `<section class="vehicle-detail-card"><h2>Caractéristiques</h2>${items.length ? `<div class="vehicle-chip-row">${items.map(([label, value]) => `<span class="vehicle-chip">${label} : ${value}</span>`).join("")}</div>` : `<p>Aucune caractéristique renseignée.</p>`}</section>`;
}

function vehicleDocumentsSection() {
  const documents = Array.isArray(vehicleDetailMetadata().documents) ? vehicleDetailMetadata().documents : [];
  return `<section class="vehicle-detail-card"><h2>Documents disponibles</h2>${documents.length ? `<div class="vehicle-chip-row">${documents.map((item) => `<span class="vehicle-chip">${item}</span>`).join("")}</div>` : `<p>Aucun document renseigné pour le moment.</p>`}</section>`;
}

function vehicleOptionsSection() {
  const options = Array.isArray(vehicleDetailMetadata().options) ? vehicleDetailMetadata().options : [];
  return `<section class="vehicle-detail-card"><h2>Équipements</h2>${options.length ? `<div class="vehicle-chip-row">${options.map((item) => `<span class="vehicle-chip">${item}</span>`).join("")}</div>` : `<p>Aucun équipement renseigné pour le moment.</p>`}</section>`;
}

function vehicleAdvertiserCard() {
  const advertiser = vehicleDetailAdvertiser();
  return `
    <aside class="vehicle-detail-card" id="contact">
      <h2>Profil vendeur ou loueur</h2>
      ${advertiser.logoUrl ? `<img src="${advertiser.logoUrl}" alt="${advertiser.name}" style="width:72px;height:72px;object-fit:contain;border-radius:18px;border:1px solid var(--border);background:var(--surface-soft);">` : ""}
      <p><strong>${advertiser.name}</strong></p>
      ${advertiser.type ? `<p>${advertiser.type}</p>` : ""}
      ${advertiser.city ? `<p>${advertiser.city}</p>` : ""}
      ${advertiser.openingHours ? `<p>${advertiser.openingHours}</p>` : ""}
      ${advertiser.verified ? `<div class="vehicle-chip-row"><span class="vehicle-chip">Professionnel vérifié</span></div>` : ""}
      <div class="vehicle-detail-actions">
        <a class="btn btn-light" href="${pencmiAdvertiserHref(advertiser.id)}">Voir le profil</a>
        ${advertiser.phone ? `<a class="btn btn-ghost" href="tel:${advertiser.phone}">Téléphone</a>` : ""}
        ${advertiser.whatsapp ? `<a class="btn btn-primary" target="_blank" rel="noreferrer" href="https://wa.me/${advertiser.whatsapp.replace(/\D/g, "")}">WhatsApp</a>` : ""}
      </div>
    </aside>
  `;
}

function vehicleRequestModal() {
  const mode = vehicleDetailState.listing?.vehicleMode;
  const title = mode === "chauffeur" ? "Demander un chauffeur" : mode === "rental" ? "Demander une location" : "Contacter l’annonceur";
  const dateLabel = mode === "chauffeur" ? "Date du service" : "Date de début";

  return `
    <div class="modal-backdrop" id="vehicle-contact-modal" aria-hidden="true">
      <section class="vehicle-modal-card" role="dialog" aria-modal="true" aria-labelledby="vehicle-contact-title">
        <h2 id="vehicle-contact-title">${title}</h2>
        <form class="vehicle-form-grid" id="vehicle-request-form">
          <label class="vehicle-form-field"><span>Nom</span><input type="text" name="clientName" required></label>
          <label class="vehicle-form-field"><span>Téléphone</span><input type="tel" name="clientPhone"></label>
          <label class="vehicle-form-field"><span>Email</span><input type="email" name="clientEmail"></label>
          <label class="vehicle-form-field"><span>${dateLabel}</span><input type="date" name="startDate"></label>
          ${mode === "rental" ? `<label class="vehicle-form-field"><span>Date de fin</span><input type="date" name="endDate"></label>` : ""}
          <label class="vehicle-form-field"><span>Message</span><textarea name="message">${mode === "sale" ? "Bonjour, je suis intéressé par ce véhicule. Est-il toujours disponible ?" : "Bonjour, je souhaite obtenir plus d’informations sur cette annonce."}</textarea></label>
          <div class="vehicle-form-actions" style="grid-column:1 / -1;">
            <button class="btn btn-ghost" type="button" data-close-contact>Annuler</button>
            <button class="btn btn-primary" type="submit">${mode === "sale" ? "Envoyer" : "Envoyer la demande"}</button>
          </div>
        </form>
        <p id="vehicle-contact-confirmation" hidden>Votre demande a été envoyée.</p>
      </section>
    </div>
  `;
}

function vehicleDetailPage() {
  if (!vehicleDetailState.listing) {
    document.querySelector("#vehicle-detail-page").innerHTML = vehicleNotFound();
    return;
  }

  const listing = vehicleDetailState.listing;
  const metadata = vehicleDetailMetadata();
  const advertiser = vehicleDetailAdvertiser();

  document.querySelector("#vehicle-detail-page").innerHTML = `
    <div class="vehicle-detail-grid">
      <div>
        ${vehicleGallery()}
        <section class="vehicle-detail-card">
          <h1>${listing.title}</h1>
          <div class="vehicle-chip-row">
            ${listing.vehicleMode ? `<span class="vehicle-chip">${listing.vehicleMode}</span>` : ""}
            ${listing.city ? `<span class="vehicle-chip">${listing.city}</span>` : ""}
            ${listing.price ? `<span class="vehicle-chip">${pencmiFormatPrice(listing.price, listing.currency || "FCFA")}</span>` : ""}
          </div>
          ${listing.description ? `<p>${listing.description}</p>` : ""}
          <div class="vehicle-detail-actions">
            <button class="btn btn-ghost" type="button" data-share>Partager</button>
            ${typeof ReportButton === "function" ? ReportButton("Signaler") : ""}
            <button class="btn btn-primary" type="button" data-open-contact>${listing.vehicleMode === "sale" ? "Contacter" : "Envoyer une demande"}</button>
          </div>
          ${advertiser.email ? `<p style="margin-top:12px;color:var(--muted);">Email : ${advertiser.email}</p>` : ""}
        </section>
        ${vehicleSpecifications()}
        ${vehicleOptionsSection()}
        ${vehicleDocumentsSection()}
        ${metadata.conditions ? `<section class="vehicle-detail-card"><h2>Conditions</h2><p>${metadata.conditions}</p></section>` : ""}
        ${typeof SafetyTipsBox === "function" ? SafetyTipsBox("vehicles") : ""}
      </div>
      ${vehicleAdvertiserCard()}
    </div>
    ${vehicleRequestModal()}
    ${typeof ReportModal === "function" ? ReportModal() : ""}
  `;

  bindVehicleDetailActions();
  if (typeof bindReportModal === "function") {
    bindReportModal(document);
  }
}

function bindVehicleDetailActions() {
  const mainPhoto = document.querySelector("#vehicle-main-photo");
  document.querySelectorAll("[data-vehicle-photo]").forEach((button) => {
    button.addEventListener("click", () => {
      if (mainPhoto) {
        mainPhoto.src = button.dataset.vehiclePhoto || "";
      }
    });
  });

  document.querySelector("[data-open-contact]")?.addEventListener("click", () => {
    document.querySelector("#vehicle-contact-modal")?.classList.add("is-open");
  });

  document.querySelector("[data-close-contact]")?.addEventListener("click", () => {
    document.querySelector("#vehicle-contact-modal")?.classList.remove("is-open");
  });

  document.querySelector("[data-share]")?.addEventListener("click", async () => {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title: vehicleDetailState.listing?.title || "Péncmi", url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard?.writeText(url).catch(() => undefined);
  });

  document.querySelector("#vehicle-request-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const listing = vehicleDetailState.listing;

    if (listing.vehicleMode === "sale") {
      const advertiser = vehicleDetailAdvertiser();
      const email = advertiser.email ? `mailto:${advertiser.email}?subject=${encodeURIComponent(`Annonce ${listing.title}`)}&body=${encodeURIComponent(String(formData.get("message") || ""))}` : "";
      if (email) {
        window.location.href = email;
      }
      const confirmation = document.querySelector("#vehicle-contact-confirmation");
      if (confirmation) {
        confirmation.hidden = false;
      }
      return;
    }

    const path = listing.vehicleMode === "chauffeur" ? `/voitures/${encodeURIComponent(listing.id)}/chauffeur-requests` : `/voitures/${encodeURIComponent(listing.id)}/rental-requests`;
    await pencmiApiRequest(path, {
      method: "POST",
      body: JSON.stringify({
        clientName: formData.get("clientName"),
        clientPhone: formData.get("clientPhone"),
        clientEmail: formData.get("clientEmail"),
        startDate: formData.get("startDate") || undefined,
        endDate: formData.get("endDate") || undefined,
        message: formData.get("message"),
      }),
    });

    const confirmation = document.querySelector("#vehicle-contact-confirmation");
    if (confirmation) {
      confirmation.hidden = false;
    }
    event.currentTarget.reset();
  });
}

async function loadVehicleDetail() {
  const id = pencmiQueryValue("id");
  if (!id) {
    vehicleDetailState.listing = null;
    return;
  }

  vehicleDetailState.listing = await pencmiApiRequest(`/voitures/${encodeURIComponent(id)}`);
}

document.addEventListener("DOMContentLoaded", async () => {
  vehicleDetailHeader();
  try {
    await loadVehicleDetail();
  } catch {
    vehicleDetailState.listing = null;
  }
  vehicleDetailPage();
});

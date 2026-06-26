const routes = {
  home: "/",
  realEstate: "/immobilier",
  login: "/login",
  register: "/register",
  favorites: "/login?next=/favoris/immobilier",
  alerts: "/login?next=/immobilier/alertes",
  publishRealEstate: "/login?next=/publier?category=immobilier",
};

function routeHref(path) {
  if (window.location.protocol !== "file:") return path;
  if (path === "/") return "../../index.html";
  if (path === "/immobilier") return "../";
  if (path.startsWith("/immobilier?")) return `../${path.slice("/immobilier".length)}`;
  if (path.startsWith("/immobilier/annonce/")) return `./?id=${encodeURIComponent(path.slice("/immobilier/annonce/".length))}`;
  return path;
}

function getApiBaseUrl() {
  return String(window.PencmiConfig?.apiBaseUrl || window.PencmiRuntimeConfig?.apiBaseUrl || "").replace(/\/+$/, "");
}

async function apiRequest(path, options = {}) {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new Error("API immobilier indisponible.");
  }

  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message || "Annonce introuvable.");
  }

  return payload?.data ?? payload;
}

function formatPriceFCFA(value) {
  if (!value) return "";
  return `${Number(value).toLocaleString("fr-FR")} FCFA`;
}

function formatPropertyType(type) {
  const labels = {
    appartement: "Appartement",
    maison: "Maison",
    villa: "Villa",
    terrain: "Terrain",
    studio: "Studio",
    chambre: "Chambre",
    bureau: "Bureau",
    commerce: "Commerce",
  };
  return labels[type] || type || "";
}

function formatTransaction(transaction) {
  const labels = {
    location: "Location",
    vente: "Vente",
    achat: "Achat",
  };
  return labels[transaction] || transaction || "";
}

function formatProfessionalType(type) {
  const labels = {
    real_estate_agency: "Agence immobilière",
    hotel: "Hôtel",
    auberge: "Auberge",
    residence: "Résidence",
    vehicle_renter: "Loueur de voitures",
    vehicle_dealer: "Garage automobile",
    chauffeur: "Chauffeur professionnel",
    transport_provider: "Transporteur",
    other: "Professionnel",
  };

  return labels[type] || "Annonceur";
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" }).format(new Date(value));
}

function mapListing(listing) {
  const metadata = listing.metadata || {};
  const profile = listing.owner?.professionalProfile || {};
  const advertiserName = profile.businessName || [listing.owner?.firstName, listing.owner?.lastName].filter(Boolean).join(" ");

  return {
    id: listing.id,
    title: listing.title,
    transaction: listing.transaction,
    propertyType: listing.propertyType,
    city: listing.city,
    district: listing.neighborhood,
    description: listing.description,
    price: listing.price,
    createdAt: listing.createdAt,
    updatedAt: listing.updatedAt,
    photos: metadata.photos || [],
    coverPhoto: metadata.coverPhoto || metadata.photos?.[0] || "",
    surface: metadata.surface,
    bedrooms: metadata.bedrooms,
    bathrooms: metadata.bathrooms,
    advertiser: {
      id: listing.owner?.id || "",
      name: advertiserName,
      type: formatProfessionalType(profile.professionalType),
      city: profile.city || listing.owner?.city,
      logoUrl: profile.logoUrl,
      isVerified: Boolean(profile.verified),
      phone: profile.professionalPhone,
      whatsapp: profile.whatsappNumber,
      email: profile.professionalEmail,
      openingHours: profile.openingHours,
    },
  };
}

function RealEstateHeader() {
  document.querySelector("#real-estate-header").innerHTML = `
    <a class="brand" href="${routeHref(routes.home)}" aria-label="Accueil Péncmi">
      <span class="brand-mark">P</span>
      <span>
        <strong>Péncmi</strong>
        <small>Immobilier</small>
      </span>
    </a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="main-menu" aria-label="Ouvrir le menu">
      <span></span><span></span><span></span>
    </button>
    <div class="header-panel" id="main-menu">
      <nav class="main-nav" aria-label="Navigation principale">
        <a href="${routeHref(routes.home)}">Accueil</a>
        <a href="${routeHref(routes.realEstate)}" aria-current="page">Immobilier</a>
      </nav>
      <div class="header-actions">
        <a class="btn btn-ghost" href="${routes.login}">Se connecter</a>
        <a class="btn btn-light" href="${routes.register}">Créer mon espace</a>
        <a class="btn btn-primary" href="${routes.publishRealEstate}">Publier une annonce</a>
      </div>
    </div>
  `;

  const toggle = document.querySelector(".menu-toggle");
  const panel = document.querySelector(".header-panel");
  toggle?.addEventListener("click", () => {
    const isOpen = panel.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });
}

function ListingNotFoundState(message = "Cette annonce n’est pas disponible pour le moment.") {
  return `
    <section class="not-found-card">
      <h1>Annonce introuvable</h1>
      <p>${message}</p>
      <div class="empty-actions">
        <a class="btn btn-primary" href="${routeHref(routes.realEstate)}">Retour aux annonces</a>
        <a class="btn btn-light" href="${routes.alerts}">Créer une alerte</a>
      </div>
    </section>
  `;
}

function RealEstatePhotoGallery(listing) {
  if (!listing.photos.length) {
    return `<section class="detail-card photo-gallery"><div class="photo-placeholder">Aucune photo disponible</div></section>`;
  }

  return `
    <section class="detail-card photo-gallery">
      <img class="gallery-main-image" data-photo-main src="${listing.coverPhoto}" alt="${listing.title}">
      <div class="badge-row"><span class="badge">${listing.photos.length} photo${listing.photos.length > 1 ? "s" : ""}</span></div>
      <div class="gallery-thumbnails">
        ${listing.photos.map((photo, index) => `
          <button
            class="gallery-thumb${photo === listing.coverPhoto ? " is-active" : ""}"
            type="button"
            data-photo-thumb
            data-photo-src="${photo}"
            aria-label="Voir la photo ${index + 1}"
          >
            <img src="${photo}" alt="">
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

function ListingMainInfo(listing) {
  const badges = [formatTransaction(listing.transaction), formatPropertyType(listing.propertyType)].filter(Boolean);
  return `
    <section class="detail-card main-info">
      <div class="badge-row">${badges.map((badge) => `<span class="badge">${badge}</span>`).join("")}</div>
      <h1>${listing.title}</h1>
      ${listing.price ? `<div class="price">${formatPriceFCFA(listing.price)}</div>` : ""}
      <p>${[listing.district, listing.city].filter(Boolean).join(", ")}</p>
      <p>Mis à jour le ${formatDate(listing.updatedAt || listing.createdAt)}</p>
      <div class="action-row">
        <a class="btn btn-ghost" href="${routes.favorites}">Ajouter aux favoris</a>
        <button class="btn btn-ghost" type="button" data-open-report>Signaler</button>
      </div>
    </section>
  `;
}

function PropertyFeaturesGrid(listing) {
  const features = [
    ["Surface", listing.surface ? `${listing.surface} m²` : ""],
    ["Chambres", listing.bedrooms],
    ["Salles de bain", listing.bathrooms],
  ].filter(([, value]) => value !== "" && value !== undefined && value !== null);

  return `
    <section class="detail-card">
      <h2>Caractéristiques</h2>
      ${features.length ? `<div class="detail-grid">${features.map(([label, value]) => `<div class="detail-item"><span>${label}</span><strong>${value}</strong></div>`).join("")}</div>` : "<p>Aucune caractéristique disponible pour le moment.</p>"}
    </section>
  `;
}

function DescriptionSection(listing) {
  return `<section class="detail-card"><h2>Description</h2><p>${listing.description || "Aucune description disponible pour le moment."}</p></section>`;
}

function ContactCard(listing) {
  const advertiser = listing.advertiser;
  const advertiserHref = window.PencmiConfig?.routeHref
    ? window.PencmiConfig.routeHref(`/annonceurs/${advertiser.id}`)
    : "#";
  return `
    <aside class="contact-card">
      <h2>Annonceur</h2>
      ${advertiser.logoUrl ? `<img class="advertiser-avatar" src="${advertiser.logoUrl}" alt="${advertiser.name}">` : `<div class="advertiser-avatar">${advertiser.name ? advertiser.name.slice(0, 1).toUpperCase() : "P"}</div>`}
      <strong>${advertiser.name || "Annonceur"}</strong>
      ${advertiser.type ? `<p>${advertiser.type}</p>` : ""}
      ${advertiser.city ? `<p>${advertiser.city}</p>` : ""}
      ${advertiser.isVerified ? `<span class="badge">Professionnel vérifié</span>` : ""}
      ${advertiser.openingHours ? `<p>${advertiser.openingHours}</p>` : ""}
      <div class="contact-actions">
        <a class="btn btn-light" href="${advertiserHref}">Voir le profil</a>
        <button class="btn btn-ghost" type="button" data-open-visit>Demander une visite</button>
      </div>
    </aside>
  `;
}

function VisitRequestModal() {
  return `
    <div class="modal-backdrop" data-modal>
      <div class="modal-panel">
        <h2>Demander une visite</h2>
        <form class="modal-form" data-visit-form>
          <input type="text" name="clientName" placeholder="Nom" required>
          <input type="tel" name="clientPhone" placeholder="Téléphone">
          <input type="email" name="clientEmail" placeholder="Email">
          <input type="date" name="preferredDate">
          <textarea name="message" placeholder="Message"></textarea>
          <div class="modal-actions">
            <button class="btn btn-primary" type="submit">Envoyer la demande</button>
            <button class="btn btn-ghost" type="button" data-close-modal>Fermer</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function VisitRequestFeedback(message, isError = false) {
  return `
    <div class="modal-feedback${isError ? " is-error" : ""}">
      <p>${message}</p>
      <div class="modal-actions">
        <button class="btn btn-primary" type="button" data-close-modal>Fermer</button>
      </div>
    </div>
  `;
}

function ReportModal() {
  return `
    <div class="modal-backdrop" data-modal>
      <div class="modal-panel">
        <h2>Signaler l’annonce</h2>
        <p>Le signalement sera relié plus tard au module de modération.</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" type="button" data-close-modal>Fermer</button>
        </div>
      </div>
    </div>
  `;
}

function openModal(content) {
  document.querySelector("#modal-root").innerHTML = content;
  document.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", closeModal));
}

function closeModal() {
  document.querySelector("#modal-root").innerHTML = "";
}

function bindDetailActions(listing) {
  const mainImage = document.querySelector("[data-photo-main]");
  const thumbnails = Array.from(document.querySelectorAll("[data-photo-thumb]"));

  thumbnails.forEach((button) => {
    button.addEventListener("click", () => {
      const nextPhoto = button.dataset.photoSrc;
      if (!mainImage || !nextPhoto) {
        return;
      }

      mainImage.src = nextPhoto;
      thumbnails.forEach((thumb) => {
        thumb.classList.toggle("is-active", thumb === button);
      });
    });
  });

  document.querySelector("[data-open-visit]")?.addEventListener("click", () => {
    openModal(VisitRequestModal());
    document.querySelector("[data-visit-form]")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      try {
        await apiRequest(`/immobilier/${listing.id}/visit-requests`, {
          method: "POST",
          body: JSON.stringify({
            clientName: form.get("clientName"),
            clientPhone: form.get("clientPhone"),
            clientEmail: form.get("clientEmail"),
            preferredDate: form.get("preferredDate") || undefined,
            message: form.get("message"),
          }),
        });
        document.querySelector(".modal-panel").innerHTML = VisitRequestFeedback("Votre demande de visite a été envoyée.");
        document.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", closeModal));
        window.setTimeout(closeModal, 1800);
      } catch (error) {
        document.querySelector(".modal-panel").innerHTML = VisitRequestFeedback(error instanceof Error ? error.message : "Envoi impossible.", true);
        document.querySelectorAll("[data-close-modal]").forEach((button) => button.addEventListener("click", closeModal));
      }
    });
  });

  document.querySelector("[data-open-report]")?.addEventListener("click", () => {
    openModal(ReportModal());
  });
}

function renderListingDetail(listing) {
  const root = document.querySelector("#listing-detail-page");
  root.innerHTML = `
    <div class="detail-layout">
      <div class="detail-main">
        ${RealEstatePhotoGallery(listing)}
        ${ListingMainInfo(listing)}
        ${PropertyFeaturesGrid(listing)}
        ${DescriptionSection(listing)}
        ${typeof SafetyTipsBox === "function" ? SafetyTipsBox("real_estate") : ""}
      </div>
      ${ContactCard(listing)}
    </div>
  `;
  bindDetailActions(listing);
}

async function initializePage() {
  RealEstateHeader();

  const listingId = new URLSearchParams(window.location.search).get("id");
  if (!listingId) {
    document.querySelector("#listing-detail-page").innerHTML = ListingNotFoundState();
    return;
  }

  try {
    const listing = await apiRequest(`/immobilier/${listingId}`);
    renderListingDetail(mapListing(listing));
  } catch (error) {
    document.querySelector("#listing-detail-page").innerHTML = ListingNotFoundState(error instanceof Error ? error.message : "Annonce introuvable.");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  void initializePage();
});

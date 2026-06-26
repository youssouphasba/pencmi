const advertiserRoutes = {
  home: "/",
  login: "/login",
  realEstate: "/immobilier",
  hotels: "/hotels",
  vehicles: "/voitures",
  trips: "/voyages",
};

function advertiserRouteHref(path) {
  return window.PencmiConfig?.routeHref ? window.PencmiConfig.routeHref(path) : path;
}

function advertiserHeader() {
  document.querySelector("#advertiser-header").innerHTML = `
    <a class="brand" href="${advertiserRouteHref(advertiserRoutes.home)}" aria-label="Accueil Péncmi">
      <span class="brand-mark">P</span>
      <span><strong>Péncmi</strong><small>Annonceur</small></span>
    </a>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="advertiser-menu" aria-label="Ouvrir le menu"><span></span><span></span><span></span></button>
    <div class="header-panel" id="advertiser-menu">
      <nav class="main-nav" aria-label="Navigation principale">
        <a href="${advertiserRouteHref(advertiserRoutes.realEstate)}">Immobilier</a>
        <a href="${advertiserRouteHref(advertiserRoutes.hotels)}">Hôtels</a>
        <a href="${advertiserRouteHref(advertiserRoutes.vehicles)}">Voitures</a>
        <a href="${advertiserRouteHref(advertiserRoutes.trips)}">Voyages</a>
      </nav>
      <div class="header-actions">
        <a class="btn btn-ghost" href="${advertiserRouteHref(advertiserRoutes.login)}">Se connecter</a>
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

function advertiserFooter() {
  document.querySelector("#advertiser-footer").innerHTML = `
    <div class="footer-grid">
      <div class="footer-brand">
        <strong>Péncmi</strong>
        <p>Plateforme de petites annonces et de mise en relation au Sénégal.</p>
      </div>
      <div class="footer-column">
        <h3>Explorer</h3>
        <a href="${advertiserRouteHref(advertiserRoutes.realEstate)}">Immobilier</a>
        <a href="${advertiserRouteHref(advertiserRoutes.hotels)}">Hôtels</a>
        <a href="${advertiserRouteHref(advertiserRoutes.vehicles)}">Voitures</a>
        <a href="${advertiserRouteHref(advertiserRoutes.trips)}">Voyages</a>
      </div>
    </div>
    <div class="footer-bottom">© 2026 Péncmi. Tous droits réservés.</div>
  `;
}

function advertiserLabel(value) {
  const labels = {
    real_estate_agency: "Agence immobilière",
    hotel: "Hôtel",
    auberge: "Auberge",
    residence: "Résidence",
    vehicle_renter: "Loueur de voitures",
    vehicle_dealer: "Garage automobile",
    chauffeur: "Chauffeur professionnel",
    transport_provider: "Transporteur",
    advertiser_individual: "Annonceur particulier",
    hotel_manager: "Gestionnaire hôtelier",
    vehicle_renter_role: "Loueur de voitures",
    vehicle_dealer_role: "Garage automobile",
    transport_provider_role: "Transporteur",
  };

  return labels[value] || String(value || "").replace(/_/g, " ");
}

function advertiserListingHref(moduleKey, id) {
  const routeMap = {
    realEstate: `/immobilier/annonce/${id}`,
    hotels: `/hotels/${id}`,
    vehicles: `/voitures/${id}`,
    trips: `/voyages/${id}`,
  };

  return advertiserRouteHref(routeMap[moduleKey] || "/");
}

function advertiserListingCard(moduleKey, listing) {
  const metadata = listing.metadata || {};
  const photos = typeof pencmiListingPhotos === "function" ? pencmiListingPhotos(metadata) : [];
  const image = photos[0] || "";

  const title =
    listing.title ||
    listing.name ||
    `${listing.departureCity || ""} → ${listing.arrivalCity || ""}`.trim() ||
    "Annonce";

  const subtitle =
    moduleKey === "hotels"
      ? [listing.propertyType, listing.city].filter(Boolean).join(" · ")
      : moduleKey === "vehicles"
        ? [metadata.brand, metadata.model, listing.city].filter(Boolean).join(" · ")
        : moduleKey === "trips"
          ? [listing.departureCity, listing.arrivalCity, listing.departureTime].filter(Boolean).join(" · ")
          : [listing.transaction, listing.propertyType, listing.city].filter(Boolean).join(" · ");

  const price =
    moduleKey === "hotels"
      ? pencmiFormatPrice(metadata.nightlyPrice || metadata.priceFrom || null, listing.currency || "FCFA")
      : moduleKey === "vehicles"
        ? pencmiFormatPrice(listing.price || metadata.price || null, listing.currency || "FCFA")
        : moduleKey === "trips"
          ? pencmiFormatPrice(listing.pricePerSeat || metadata.pricePerSeat || null, listing.currency || "FCFA")
          : pencmiFormatPrice(listing.price || metadata.price || null, listing.currency || "FCFA");

  return `
    <article class="advertiser-listing-card">
      ${image ? `<img src="${image}" alt="${title}">` : `<div class="advertiser-listing-photo-fallback">Aucune image</div>`}
      <div class="advertiser-listing-body">
        <h3>${title}</h3>
        ${subtitle ? `<p>${subtitle}</p>` : ""}
        <div class="advertiser-listing-footer">
          <strong>${price}</strong>
          <a class="btn btn-light" href="${advertiserListingHref(moduleKey, listing.id)}">Voir détails</a>
        </div>
      </div>
    </article>
  `;
}

function advertiserSection(title, moduleKey, listings) {
  if (!listings.length) {
    return "";
  }

  return `
    <section class="advertiser-section-card">
      <h2>${title}</h2>
      <div class="advertiser-listings-grid">
        ${listings.map((listing) => advertiserListingCard(moduleKey, listing)).join("")}
      </div>
    </section>
  `;
}

function advertiserEscapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function advertiserRatingStars(value) {
  const rating = Math.round(Number(value || 0));
  return [1, 2, 3, 4, 5].map((item) => (item <= rating ? "★" : "☆")).join("");
}

function advertiserReviewsSection(payload) {
  const reviewsPayload = payload?.reviewsPayload || {};
  const summary = reviewsPayload.summary || payload?.reviewSummary || {};
  const reviews = Array.isArray(reviewsPayload.reviews) ? reviewsPayload.reviews : [];
  const average = summary.averageRating;
  const count = Number(summary.reviewCount || 0);

  return `
    <section class="advertiser-section-card advertiser-reviews-card">
      <div class="advertiser-reviews-heading">
        <div>
          <h2>Notes et avis</h2>
          <p>${count ? `${count} avis publié${count > 1 ? "s" : ""}` : "Aucun avis publié pour le moment."}</p>
        </div>
        <div class="advertiser-rating-summary">
          <strong>${average ? average.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "-"}</strong>
          <span>${advertiserRatingStars(average)}</span>
        </div>
      </div>
      ${
        reviews.length
          ? `<div class="advertiser-reviews-list">
              ${reviews
                .map(
                  (review) => `
                    <article class="advertiser-review-item">
                      <div>
                        <strong>${advertiserRatingStars(review.rating)}</strong>
                        <span>${pencmiFormatDate(review.publishedAt || review.createdAt)}</span>
                      </div>
                      ${review.comment ? `<p>${advertiserEscapeHtml(review.comment)}</p>` : ""}
                    </article>
                  `,
                )
                .join("")}
            </div>`
          : `<div class="advertiser-empty-review">Les avis validés seront affichés ici.</div>`
      }
      <form class="advertiser-review-form" id="advertiser-review-form">
        <h3>Noter cet annonceur</h3>
        <label for="advertiser-review-rating">Note</label>
        <select id="advertiser-review-rating" name="rating" required>
          <option value="">Choisir une note</option>
          <option value="5">5 - Excellent</option>
          <option value="4">4 - Très bien</option>
          <option value="3">3 - Correct</option>
          <option value="2">2 - Insuffisant</option>
          <option value="1">1 - Mauvaise expérience</option>
        </select>
        <label for="advertiser-review-comment">Avis</label>
        <textarea id="advertiser-review-comment" name="comment" rows="4" maxlength="1200" placeholder="Décrivez votre expérience avec cet annonceur."></textarea>
        <button class="btn btn-primary" type="submit">Envoyer l’avis</button>
        <p class="advertiser-review-feedback" id="advertiser-review-feedback" role="status" aria-live="polite"></p>
      </form>
    </section>
  `;
}

function advertiserPageContent(payload) {
  const user = payload?.user;
  const profile = user?.professionalProfile || {};
  const listings = payload?.listings || {};
  const counts = payload?.counts || {};
  const displayName =
    profile.businessName ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    "Annonceur";

  return `
    <section class="advertiser-hero-card">
      <div>
        <div class="advertiser-identity">
          ${profile.logoUrl ? `<img class="advertiser-logo" src="${profile.logoUrl}" alt="${displayName}">` : `<div class="advertiser-logo-fallback">${displayName.slice(0, 1).toUpperCase()}</div>`}
          <div>
            <h1>${displayName}</h1>
            <div class="advertiser-meta">
              ${profile.professionalType ? `<span class="badge">${advertiserLabel(profile.professionalType)}</span>` : ""}
              ${user?.city ? `<span class="badge">${user.city}</span>` : ""}
              ${user?.professionalVerified || profile.verified ? `<span class="badge">Professionnel vérifié</span>` : ""}
            </div>
            ${profile.description ? `<p>${profile.description}</p>` : ""}
            <div class="advertiser-links">
              ${profile.website ? `<a class="btn btn-ghost" href="${profile.website}" target="_blank" rel="noreferrer">Site web</a>` : ""}
              ${profile.professionalEmail ? `<a class="btn btn-ghost" href="mailto:${profile.professionalEmail}">Email</a>` : ""}
              ${profile.professionalPhone ? `<a class="btn btn-ghost" href="tel:${profile.professionalPhone}">Téléphone</a>` : ""}
              ${profile.whatsappNumber ? `<a class="btn btn-primary" href="https://wa.me/${profile.whatsappNumber.replace(/\D/g, "")}" target="_blank" rel="noreferrer">WhatsApp</a>` : ""}
            </div>
          </div>
        </div>
      </div>
      <div>
        <div class="advertiser-stats">
          <div class="advertiser-stat"><strong>${counts.realEstate || 0}</strong><span>Biens</span></div>
          <div class="advertiser-stat"><strong>${counts.hotels || 0}</strong><span>Hébergements</span></div>
          <div class="advertiser-stat"><strong>${counts.vehicles || 0}</strong><span>Véhicules</span></div>
          <div class="advertiser-stat"><strong>${counts.trips || 0}</strong><span>Trajets</span></div>
        </div>
        <div class="advertiser-badges">
          ${profile.openingHours ? `<span class="badge">${profile.openingHours}</span>` : ""}
          ${profile.city ? `<span class="badge">${profile.city}</span>` : ""}
        </div>
      </div>
    </section>
    <div class="advertiser-grid">
      <div>
        ${advertiserReviewsSection(payload)}
        ${advertiserSection("Annonces immobilières", "realEstate", listings.realEstate || [])}
        ${advertiserSection("Hébergements", "hotels", listings.hotels || [])}
        ${advertiserSection("Véhicules", "vehicles", listings.vehicles || [])}
        ${advertiserSection("Trajets", "trips", listings.trips || [])}
      </div>
      <aside class="advertiser-side-card">
        <h2>Informations</h2>
        ${profile.address ? `<p>${profile.address}</p>` : ""}
        ${profile.professionalEmail ? `<p>${profile.professionalEmail}</p>` : ""}
        ${profile.professionalPhone ? `<p>${profile.professionalPhone}</p>` : ""}
        ${profile.whatsappNumber ? `<p>${profile.whatsappNumber}</p>` : ""}
        ${profile.openingHours ? `<p>${profile.openingHours}</p>` : ""}
      </aside>
    </div>
  `;
}

function bindAdvertiserReviewForm(advertiserId) {
  const form = document.querySelector("#advertiser-review-form");
  const feedback = document.querySelector("#advertiser-review-feedback");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (feedback) {
      feedback.textContent = "";
    }
    const formData = new FormData(form);
    const rating = Number(formData.get("rating"));
    const comment = String(formData.get("comment") || "").trim();

    try {
      await pencmiApiRequest(`/professional-profiles/public/${encodeURIComponent(advertiserId)}/reviews`, {
        method: "POST",
        body: JSON.stringify({ rating, comment: comment || undefined }),
      });
      form.reset();
      if (feedback) {
        feedback.textContent = "Votre avis a été envoyé et sera vérifié avant publication.";
      }
    } catch (error) {
      if (feedback) {
        feedback.textContent = error.message || "L’avis n’a pas pu être envoyé.";
      }
    }
  });
}

function advertiserNotFound() {
  return `
    <section class="advertiser-empty-card">
      <h1>Annonceur introuvable</h1>
      <p>Le profil demandé n’est pas disponible pour le moment.</p>
      <a class="btn btn-primary" href="${advertiserRouteHref(advertiserRoutes.home)}">Retour à l’accueil</a>
    </section>
  `;
}

async function loadAdvertiserPage() {
  const root = document.querySelector("#advertiser-page");
  const advertiserId = pencmiQueryValue("id");

  if (!advertiserId) {
    root.innerHTML = advertiserNotFound();
    return;
  }

  try {
    const [payload, reviewsPayload] = await Promise.all([
      pencmiApiRequest(`/professional-profiles/public/${encodeURIComponent(advertiserId)}`),
      pencmiApiRequest(`/professional-profiles/public/${encodeURIComponent(advertiserId)}/reviews`).catch(() => null),
    ]);
    payload.reviewsPayload = reviewsPayload;
    root.innerHTML = advertiserPageContent(payload);
    bindAdvertiserReviewForm(advertiserId);
  } catch {
    root.innerHTML = advertiserNotFound();
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  advertiserHeader();
  advertiserFooter();
  await loadAdvertiserPage();
});

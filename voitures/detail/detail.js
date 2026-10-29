document.addEventListener('DOMContentLoaded', async () => {
  const {
    vehicleEscape: esc,
    vehicleModes,
    vehiclePrice,
    vehicleCopy,
    vehicleSafeUrl,
  } = await import('../vehicle-content.mjs');
  const href = (path) => window.PencmiConfig?.routeHref?.(path) || path;
  const root = document.querySelector('#vehicle-detail-page');
  document.querySelector('#vehicle-detail-header').innerHTML =
    `<a class="brand" href="/" aria-label="Accueil Péncmi"><img src="/Logo%20pencmi.jpeg" width="64" height="64" style="object-fit:contain" alt="Péncmi"></a><nav class="header-actions"><a class="btn btn-ghost" href="${href('/voitures')}">Voitures</a><a class="btn btn-ghost" href="${href('/dashboard/voitures')}">Mon espace</a></nav>`;
  let listing;
  try {
    const id = pencmiQueryValue('id');
    if (!id) throw new Error('Annonce introuvable.');
    listing = await pencmiApiRequest(`/voitures/${encodeURIComponent(id)}`);
  } catch (failure) {
    root.innerHTML = `<section class="vehicle-empty"><h1>Annonce indisponible</h1><p role="alert">${esc(failure.message)}</p><a class="btn btn-primary" href="${href('/voitures')}">Retour aux voitures</a></section>`;
    return;
  }
  const metadata = listing.metadata || {},
    advertiser = pencmiBuildAdvertiser(listing.owner);
  document.title = `${listing.title} - Péncmi`;
  const preferences = metadata.contactPreferences || {};
  const photos = pencmiListingPhotos(metadata)
    .map(vehicleSafeUrl)
    .filter(Boolean);
  const isRequest = ['rental', 'chauffeur'].includes(listing.vehicleMode);
  const formEnabled = isRequest || preferences.contactFormEnabled !== false;
  const phone = preferences.phoneNumber || advertiser.phone,
    whatsapp = preferences.whatsappNumber || advertiser.whatsapp,
    email = preferences.contactEmail || advertiser.email;
  const specifications = [
    ['Marque', metadata.brand],
    ['Modèle', metadata.model],
    ['Version', metadata.version],
    ['Année', metadata.year],
    ['Kilométrage', metadata.mileage == null ? null : `${metadata.mileage} km`],
    ['Carburant', metadata.fuel],
    ['Boîte', metadata.gearbox],
    ['Catégorie', metadata.category],
    ['Places', metadata.seats],
    ['Couleur', metadata.color],
    ['État', metadata.condition],
    ['Puissance', metadata.power],
  ].filter(
    ([, value]) => value !== undefined && value !== null && value !== '',
  );
  const chips = (values) =>
    `<div class="vehicle-chip-row">${values.map((value) => `<span class="vehicle-chip">${esc(value)}</span>`).join('')}</div>`;
  const today = new Date().toLocaleDateString('en-CA', {
    timeZone: 'Africa/Dakar',
  });
  const title =
    listing.vehicleMode === 'rental'
      ? 'Demander une location'
      : listing.vehicleMode === 'chauffeur'
        ? 'Demander un véhicule avec chauffeur'
        : 'Contacter l’annonceur';
  const conditions = [
    metadata.conditions,
    metadata.rentalConditions,
    metadata.serviceConditions,
    metadata.coveredAreas,
  ].filter(Boolean);
  const secondaryPrices =
    listing.vehicleMode === 'rental'
      ? [
          ['Tarif hebdomadaire', metadata.pricePerWeek],
          ['Tarif mensuel', metadata.pricePerMonth],
          ['Caution', metadata.deposit],
        ].filter(([, value]) => value !== undefined && value !== null)
      : [];
  root.innerHTML = `<div class="vehicle-detail-grid"><div>
    <section class="vehicle-detail-card">${photos.length ? `<img id="vehicle-main-photo" src="${esc(photos[0])}" alt="${esc(listing.title)}" style="width:100%;max-height:420px;object-fit:contain"><div class="vehicle-chip-row">${photos.map((url, index) => `<button type="button" class="btn btn-ghost" data-vehicle-photo="${index}" aria-label="Photo ${index + 1}">Photo ${index + 1}</button>`).join('')}</div>` : '<div class="vehicle-photo-placeholder">Aucune photo disponible</div>'}</section>
    <section class="vehicle-detail-card"><h1>${esc(listing.title)}</h1>${chips([vehicleModes[listing.vehicleMode], listing.city, vehiclePrice(listing)].filter(Boolean))}<p>${esc(listing.description)}</p><div class="vehicle-detail-actions"><button class="btn btn-ghost" type="button" data-share>Partager</button>${typeof ReportButton === 'function' ? ReportButton('Signaler') : ''}${formEnabled ? `<button class="btn btn-primary" type="button" data-open-contact>${title}</button>` : ''}</div><p>${secondaryPrices.map(([label, price]) => `${esc(label)} : ${esc(pencmiFormatPrice(price, 'FCFA'))}`).join(' · ')}</p>${metadata.includedMileage !== undefined ? `<p>Kilométrage inclus : ${esc(metadata.includedMileage)}</p>` : ''}</section>
    <section class="vehicle-detail-card"><h2>Caractéristiques</h2>${chips(specifications.map(([label, value]) => `${label} : ${value}`))}</section>
    <section class="vehicle-detail-card"><h2>Équipements</h2>${chips(Array.isArray(metadata.options) ? metadata.options : [])}</section>
    <section class="vehicle-detail-card"><h2>Documents déclarés</h2><p>${esc(vehicleCopy.documents)}</p>${chips(Array.isArray(metadata.documents) ? metadata.documents : [])}</section>
    ${conditions.length ? `<section class="vehicle-detail-card"><h2>Conditions et services</h2>${conditions.map((value) => `<p>${esc(value)}</p>`).join('')}</section>` : ''}
    ${typeof SafetyTipsBox === 'function' ? SafetyTipsBox('vehicles') : ''}
    </div><aside class="vehicle-detail-card" id="contact"><h2>Annonceur</h2>${advertiser.logoUrl && vehicleSafeUrl(advertiser.logoUrl) ? `<img src="${esc(vehicleSafeUrl(advertiser.logoUrl))}" alt="${esc(advertiser.name)}" width="72" height="72" style="object-fit:contain">` : ''}<p><strong>${esc(advertiser.name)}</strong></p><p>${esc(advertiser.type)}</p><p>${esc(advertiser.city)}</p><p>${esc(advertiser.openingHours)}</p>${advertiser.verified ? chips(['Professionnel vérifié']) : ''}<div class="vehicle-detail-actions"><a class="btn btn-light" href="${esc(pencmiAdvertiserHref(advertiser.id))}">Voir le profil</a>${phone && preferences.phoneEnabled !== false ? `<a class="btn btn-ghost" href="tel:${esc(phone.replace(/[^+\d]/g, ''))}">Téléphone</a>` : ''}${whatsapp && preferences.whatsappEnabled !== false ? `<a class="btn btn-ghost" href="https://wa.me/${esc(whatsapp.replace(/\D/g, ''))}" target="_blank" rel="noreferrer">WhatsApp</a>` : ''}${email && preferences.emailEnabled !== false ? `<a class="btn btn-ghost" href="mailto:${esc(encodeURIComponent(email))}">Email</a>` : ''}</div></aside></div>
    ${formEnabled ? `<div class="modal-backdrop" id="vehicle-contact-modal" aria-hidden="true"><section class="vehicle-modal-card" role="dialog" aria-modal="true" aria-labelledby="vehicle-contact-title" tabindex="-1"><h2 id="vehicle-contact-title">${title}</h2><form id="vehicle-request-form" class="vehicle-form-grid"><label class="vehicle-form-field"><span>Nom</span><input name="clientName" required minlength="2" maxlength="120" autocomplete="name"></label><label class="vehicle-form-field"><span>Téléphone</span><input type="tel" name="clientPhone" maxlength="30" autocomplete="tel"></label><label class="vehicle-form-field"><span>Email</span><input type="email" name="clientEmail" maxlength="254" autocomplete="email"></label>${isRequest ? `<label class="vehicle-form-field"><span>${listing.vehicleMode === 'rental' ? 'Début de location' : 'Date du service'}</span><input type="date" name="startDate" required min="${today}"></label>` : ''}${listing.vehicleMode === 'rental' ? `<label class="vehicle-form-field"><span>Fin de location</span><input type="date" name="endDate" required min="${today}"></label>` : ''}<label class="vehicle-form-field"><span>Message</span><textarea name="message" maxlength="2000"></textarea></label><p class="full" id="vehicle-request-error" role="alert" hidden></p><div class="vehicle-form-actions"><button class="btn btn-ghost" type="button" data-close-contact>Fermer</button><button class="btn btn-primary" type="submit">Envoyer${isRequest ? ' la demande' : ''}</button></div></form><p id="vehicle-contact-confirmation" role="status" hidden></p><button class="btn btn-light" type="button" data-close-success hidden>Fermer</button></section></div>` : ''}
    ${typeof ReportModal === 'function' ? ReportModal() : ''}`;
  document.querySelectorAll('[data-vehicle-photo]').forEach(
    (button) =>
      (button.onclick = () => {
        document.querySelector('#vehicle-main-photo').src =
          photos[Number(button.dataset.vehiclePhoto)];
      }),
  );
  const modal = document.querySelector('#vehicle-contact-modal'),
    form = document.querySelector('#vehicle-request-form');
  const close = () => {
    modal?.classList.remove('is-open');
    modal?.setAttribute('aria-hidden', 'true');
    document.querySelector('[data-open-contact]')?.focus();
  };
  document
    .querySelector('[data-open-contact]')
    ?.addEventListener('click', () => {
      modal.classList.add('is-open');
      modal.setAttribute('aria-hidden', 'false');
      modal.querySelector('input,button').focus();
    });
  document
    .querySelector('[data-close-contact]')
    ?.addEventListener('click', close);
  document
    .querySelector('[data-close-success]')
    ?.addEventListener('click', close);
  modal?.addEventListener('click', (event) => {
    if (event.target === modal) close();
  });
  document.addEventListener('keydown', (event) => {
    if (!modal?.classList.contains('is-open')) return;
    if (event.key === 'Escape') close();
    if (event.key === 'Tab') {
      const controls = [
          ...modal.querySelectorAll('button,input,textarea'),
        ].filter(
          (element) => !element.disabled && element.getClientRects().length,
        ),
        first = controls[0],
        last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  document
    .querySelector('[data-share]')
    ?.addEventListener('click', async () => {
      if (navigator.share)
        await navigator
          .share({ title: listing.title, url: location.href })
          .catch(() => {});
      else await navigator.clipboard?.writeText(location.href).catch(() => {});
    });
  let busy = false;
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    const data = Object.fromEntries(new FormData(form)),
      error = document.querySelector('#vehicle-request-error');
    if (!data.clientPhone?.trim() && !data.clientEmail?.trim()) {
      error.textContent = 'Renseignez un téléphone ou un email.';
      error.hidden = false;
      return;
    }
    const body = Object.fromEntries(
      Object.entries(data)
        .filter(([, value]) => String(value).trim())
        .map(([key, value]) => [key, String(value).trim()]),
    );
    busy = true;
    error.hidden = true;
    form.querySelector('[type="submit"]').disabled = true;
    try {
      const route =
        listing.vehicleMode === 'rental'
          ? 'rental-requests'
          : listing.vehicleMode === 'chauffeur'
            ? 'chauffeur-requests'
            : 'contact';
      const receipt = await pencmiApiRequest(
        `/voitures/${encodeURIComponent(listing.id)}/${route}`,
        { method: 'POST', body: JSON.stringify(body) },
      );
      if (
        !receipt?.id ||
        (isRequest ? receipt.status !== 'new' : receipt.received !== true)
      )
        throw new Error(
          'La réception n’a pas été confirmée. Vos informations sont conservées.',
        );
      form.hidden = true;
      const confirmation = document.querySelector(
        '#vehicle-contact-confirmation',
      );
      confirmation.textContent = isRequest
        ? vehicleCopy.requestReceived
        : vehicleCopy.contactReceived;
      confirmation.hidden = false;
      document.querySelector('[data-close-success]').hidden = false;
      document.querySelector('[data-close-success]').focus();
    } catch (failure) {
      error.textContent = failure.message;
      error.hidden = false;
    } finally {
      busy = false;
      form.querySelector('[type="submit"]').disabled = false;
    }
  });
  if (typeof bindReportModal === 'function') bindReportModal(document);
});

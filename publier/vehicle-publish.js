if (new URLSearchParams(location.search).get('category') === 'voiture') {
  void (async () => {
    const [
      { publicationRequest: api, publicationOperationId: uuid },
      {
        emptyVehicleDraft,
        vehicleDraftFromListing,
        vehicleFieldStep,
        vehicleSteps,
        vehicleChoices,
      },
      {
        vehicleModes,
        vehicleStatuses,
        vehicleCopy,
        vehicleEscape: esc,
        vehiclePrice,
      },
    ] = await Promise.all([
      import('./real-estate-api.mjs'),
      import('./vehicle-publication.mjs'),
      import('../voitures/vehicle-content.mjs'),
    ]);
    const root = document.querySelector('#publish-page');
    document.title = 'Publier une voiture - Péncmi';
    document.body.dataset.vehiclePublication = '';
    let step = Math.min(
      11,
      Math.max(
        0,
        Number(new URLSearchParams(location.search).get('step')) || 0,
      ),
    );
    let draft = emptyVehicleDraft(),
      id = new URLSearchParams(location.search).get('id'),
      photos = [],
      status = 'draft';
    let busy = false,
      dirty = false,
      message = '',
      error = '',
      fields = [];
    const blobs = new Map(),
      uploads = new Map();
    const requestId =
      sessionStorage.getItem('pencmi_vehicle_creation') || uuid();
    const get = (path) =>
      path.split('.').reduce((value, key) => value?.[key], draft);
    function set(path, value) {
      const keys = path.split('.');
      const key = keys.pop();
      const target = keys.reduce(
        (object, part) => (object[part] ||= {}),
        draft,
      );
      if (value === undefined) delete target[key];
      else target[key] = value;
      dirty = true;
      message = '';
    }
    function field(path, label, type = 'text', choices) {
      const value = get(path) ?? '',
        issue = fields.find((item) => item.path === path);
      const attribute = `data-vehicle-field="${path}"${issue ? ' aria-invalid="true"' : ''}`;
      const control = choices
        ? `<select ${attribute}><option value="">Sélectionner</option>${choices
            .map((option) => {
              const [key, text] = Array.isArray(option)
                ? option
                : [option, option];
              return `<option value="${esc(key)}"${value === key ? ' selected' : ''}>${esc(text)}</option>`;
            })
            .join('')}</select>`
        : type === 'textarea'
          ? `<textarea ${attribute} maxlength="6000">${esc(value)}</textarea>`
          : `<input ${attribute} type="${type}" value="${esc(value)}"${type === 'number' ? ' min="0" step="1" max="2147483647"' : ''} maxlength="${type === 'email' ? 254 : 500}">`;
      return `<label class="form-field"><span>${esc(label)}</span>${control}${issue ? `<small class="form-error">${esc(issue.message)}</small>` : ''}</label>`;
    }
    const checkbox = (path, label) =>
      `<label class="choice-card"><input type="checkbox" data-vehicle-field="${path}"${get(path) ? ' checked' : ''}><span>${esc(label)}</span></label>`;
    const collection = (key) =>
      `<div class="checkbox-list">${vehicleChoices[key].map((value) => `<label class="choice-card"><input type="checkbox" data-vehicle-list="${key}" value="${esc(value)}"${draft.metadata[key].includes(value) ? ' checked' : ''}><span>${esc(value)}</span></label>`).join('')}</div>`;
    function stepContent() {
      const m = 'metadata.';
      switch (step) {
        case 0:
          return `<div class="option-grid">${Object.entries(vehicleModes)
            .map(
              ([value, label]) =>
                `<label class="choice-card"><input type="radio" name="vehicleMode" data-vehicle-field="vehicleMode" value="${value}"${draft.vehicleMode === value ? ' checked' : ''}><span>${label}</span></label>`,
            )
            .join('')}</div>`;
        case 1:
          return (
            field(
              `${m}identity.brand`,
              'Marque',
              'text',
              vehicleChoices.brand,
            ) +
            field(`${m}identity.model`, 'Modèle') +
            field(`${m}identity.version`, 'Version') +
            field(`${m}identity.year`, 'Année', 'number')
          );
        case 2:
          return [
            'mileage',
            'fuel',
            'gearbox',
            'category',
            'seats',
            'color',
            'condition',
            'power',
          ]
            .map((key, index) =>
              field(
                `${m}info.${key}`,
                [
                  'Kilométrage',
                  'Carburant',
                  'Boîte de vitesses',
                  'Type de véhicule',
                  'Nombre de places',
                  'Couleur',
                  'État',
                  'Puissance',
                ][index],
                ['mileage', 'seats'].includes(key) ? 'number' : 'text',
                vehicleChoices[key],
              ),
            )
            .join('');
        case 3:
          return (
            field(
              `${m}location.region`,
              'Région',
              'text',
              (window.SENEGAL_LOCATIONS || []).map((item) => item.region),
            ) +
            field(`${m}location.city`, 'Ville') +
            field(`${m}location.district`, 'Quartier') +
            field(`${m}location.addressHint`, 'Indication privée') +
            checkbox(`${m}location.approximate`, 'Localisation approximative')
          );
        case 4: {
          const prefix = `${m}pricing.`;
          if (draft.vehicleMode === 'sale')
            return (
              field(prefix + 'price', 'Prix total (FCFA)', 'number') +
              checkbox(prefix + 'negotiable', 'Prix négociable')
            );
          if (draft.vehicleMode === 'rental')
            return (
              [
                ['pricePerDay', 'Tarif journalier (FCFA)'],
                ['pricePerWeek', 'Tarif hebdomadaire (FCFA)'],
                ['pricePerMonth', 'Tarif mensuel (FCFA)'],
                ['deposit', 'Caution (FCFA)'],
              ]
                .map(([key, label]) => field(prefix + key, label, 'number'))
                .join('') +
              field(prefix + 'includedMileage', 'Kilométrage inclus') +
              field(
                prefix + 'rentalConditions',
                'Conditions de location',
                'textarea',
              )
            );
          if (draft.vehicleMode === 'chauffeur')
            return (
              field(prefix + 'pricePerTrip', 'Tarif (FCFA)', 'number') +
              field(prefix + 'chauffeurPriceUnit', 'Unité tarifaire', 'text', [
                ['trip', 'Par trajet'],
                ['service', 'Par service'],
              ]) +
              field(prefix + 'coveredAreas', 'Zones desservies', 'textarea') +
              field(
                prefix + 'serviceConditions',
                'Conditions du service',
                'textarea',
              )
            );
          return '<p>Choisissez d’abord le type d’annonce.</p>';
        }
        case 5:
          return `<div class="form-field full"><p>${esc(vehicleCopy.photoLimits)}</p><input type="file" data-upload-vehicle multiple accept="image/jpeg,image/png,image/webp"><div class="vehicle-publication-photos">${photos.map((photo, index) => `<figure><img src="${esc(blobs.get(photo.id) || (photo.managed ? '' : photo.url))}" alt="Photo ${index + 1}"><figcaption>${index === 0 ? 'Couverture' : `Photo ${index + 1}`}</figcaption><div class="publish-nav-group"><button type="button" class="btn btn-ghost" data-photo-move="${index}" data-direction="-1"${index === 0 ? ' disabled' : ''} aria-label="Déplacer avant">←</button><button type="button" class="btn btn-ghost" data-photo-move="${index}" data-direction="1"${index === photos.length - 1 ? ' disabled' : ''} aria-label="Déplacer après">→</button><button type="button" class="btn btn-ghost" data-photo-cover="${index}">Couverture</button><button type="button" class="btn btn-ghost" data-photo-delete="${esc(photo.id)}">Supprimer</button><label class="btn btn-light">Remplacer<input type="file" data-photo-replace="${esc(photo.id)}" accept="image/jpeg,image/png,image/webp" hidden></label></div></figure>`).join('')}</div></div>`;
        case 6:
          return collection('equipment');
        case 7:
          return `<div class="full"><p>${esc(vehicleCopy.documents)}</p><p>${esc(vehicleCopy.documentUpload)}</p>${collection('documents')}</div>`;
        case 8:
          return (
            field('title', 'Titre') +
            field('description', 'Description', 'textarea') +
            field(`${m}conditions`, 'Conditions générales', 'textarea')
          );
        case 9:
          return (
            checkbox(`${m}contactPreferences.phoneEnabled`, 'Téléphone') +
            field(`${m}contactPreferences.phoneNumber`, 'Téléphone', 'tel') +
            checkbox(`${m}contactPreferences.whatsappEnabled`, 'WhatsApp') +
            field(
              `${m}contactPreferences.whatsappNumber`,
              'Numéro WhatsApp',
              'tel',
            ) +
            checkbox(`${m}contactPreferences.emailEnabled`, 'Email') +
            field(
              `${m}contactPreferences.contactEmail`,
              'Email de contact',
              'email',
            ) +
            checkbox(
              `${m}contactPreferences.contactFormEnabled`,
              'Formulaire de contact',
            )
          );
        case 10:
          return `<div class="preview-box full">${photos[0] && (blobs.get(photos[0].id) || !photos[0].managed) ? `<img class="vehicle-publication-preview" src="${esc(blobs.get(photos[0].id) || photos[0].url)}" alt="Photo de couverture">` : '<div class="preview-photo">Aucune photo</div>'}<h3>${esc(draft.title || 'Titre non renseigné')}</h3><p>${esc([draft.metadata.identity.brand, draft.metadata.identity.model, draft.metadata.location.city].filter(Boolean).join(' · '))}</p><strong>${esc(vehiclePrice({ vehicleMode: draft.vehicleMode, price: draft.metadata.pricing[draft.vehicleMode === 'sale' ? 'price' : draft.vehicleMode === 'rental' ? 'pricePerDay' : 'pricePerTrip'], metadata: draft.metadata.pricing }))}</strong><p>${esc(draft.description)}</p><p>${esc(draft.metadata.equipment.join(' · '))}</p><p>${esc(draft.metadata.conditions)}</p></div>`;
        default:
          return `<div class="full"><p>Votre annonce sera examinée avant sa mise en ligne.</p><p>Statut : ${esc(vehicleStatuses[status] || status)}</p><button class="btn btn-primary" type="button" data-submit-vehicle>Soumettre l’annonce</button></div>`;
      }
    }
    function render() {
      root.innerHTML = `<div class="publish-shell"><section class="publish-main"><div class="publish-top"><h1>Publier une voiture</h1><p>Étape ${step + 1} sur 12</p><div class="progress-track"><div class="progress-bar" style="width:${Math.round(((step + 1) / 12) * 100)}%"></div></div></div><div class="stepper">${vehicleSteps.map((label, index) => `<button type="button" class="step-pill${step === index ? ' is-active' : ''}" data-step-vehicle="${index}">${index + 1}. ${esc(label)}</button>`).join('')}</div><section class="step-card"><h2>${esc(vehicleSteps[step])}</h2><div class="form-grid">${stepContent()}</div></section>${error ? `<div class="form-error" role="alert">${esc(error)}</div>` : ''}${message ? `<div class="status-message" role="status">${esc(message)}</div>` : ''}<div class="publish-nav"><div class="publish-nav-group"><button class="btn btn-ghost" data-prev-vehicle${step === 0 ? ' disabled' : ''}>Retour</button><button class="btn btn-light" data-draft-vehicle>Enregistrer en brouillon</button></div><div class="publish-nav-group"><button class="btn btn-ghost" data-preview-vehicle>Prévisualiser</button><button class="btn btn-primary" data-next-vehicle>${step === 11 ? 'Soumettre' : 'Suivant'}</button></div></div><a href="/dashboard/voitures/annonces/">Mes annonces</a></section><aside class="draft-summary"><h2>Résumé</h2><p>${esc(vehicleModes[draft.vehicleMode] || 'Type non renseigné')}</p><p>${esc(draft.metadata.location.city || 'Ville non renseignée')}</p><p>${esc(vehicleStatuses[status] || status)}</p></aside></div>`;
      root
        .querySelectorAll('[data-vehicle-field]')
        .forEach((input) =>
          input.addEventListener(
            input.type === 'checkbox' ||
              input.type === 'radio' ||
              input.tagName === 'SELECT'
              ? 'change'
              : 'input',
            () =>
              set(
                input.dataset.vehicleField,
                input.type === 'checkbox'
                  ? input.checked
                  : input.type === 'number'
                    ? input.value === ''
                      ? null
                      : Number(input.value)
                    : input.value,
              ),
          ),
        );
      root.querySelectorAll('[data-vehicle-list]').forEach((input) =>
        input.addEventListener('change', () => {
          const key = input.dataset.vehicleList;
          draft.metadata[key] = input.checked
            ? [...new Set([...draft.metadata[key], input.value])]
            : draft.metadata[key].filter((item) => item !== input.value);
          dirty = true;
        }),
      );
      root.querySelectorAll('[data-step-vehicle]').forEach(
        (button) =>
          (button.onclick = () => {
            step = Number(button.dataset.stepVehicle);
            render();
          }),
      );
      root.querySelector('[data-prev-vehicle]').onclick = () => {
        step--;
        render();
      };
      root.querySelector('[data-next-vehicle]').onclick = () =>
        step === 11 ? operation(submit) : (step++, render());
      root.querySelector('[data-draft-vehicle]').onclick = () =>
        operation(async () => {
          await save(true);
          message = 'Brouillon enregistré.';
        });
      root.querySelector('[data-preview-vehicle]').onclick = () => {
        step = 10;
        render();
      };
      root
        .querySelector('[data-submit-vehicle]')
        ?.addEventListener('click', () => operation(submit));
      root
        .querySelector('[data-upload-vehicle]')
        ?.addEventListener('change', (event) =>
          operation(() => upload([...event.target.files])),
        );
      root
        .querySelectorAll('[data-photo-replace]')
        .forEach(
          (input) =>
            (input.onchange = () =>
              operation(() =>
                upload([...input.files], input.dataset.photoReplace),
              )),
        );
      root.querySelectorAll('[data-photo-move]').forEach(
        (button) =>
          (button.onclick = () =>
            operation(async () => {
              const order = photos.map((photo) => photo.id);
              const index = Number(button.dataset.photoMove),
                other = index + Number(button.dataset.direction);
              [order[index], order[other]] = [order[other], order[index]];
              apply(
                await api(
                  `/dashboard/voitures/${encodeURIComponent(id)}/photos/order`,
                  { method: 'PATCH', body: { photoIds: order } },
                ),
              );
            })),
      );
      root.querySelectorAll('[data-photo-cover]').forEach(
        (button) =>
          (button.onclick = () =>
            operation(async () => {
              const index = Number(button.dataset.photoCover),
                order = photos.map((photo) => photo.id);
              order.unshift(...order.splice(index, 1));
              apply(
                await api(
                  `/dashboard/voitures/${encodeURIComponent(id)}/photos/order`,
                  { method: 'PATCH', body: { photoIds: order } },
                ),
              );
            })),
      );
      root
        .querySelectorAll('[data-photo-delete]')
        .forEach(
          (button) =>
            (button.onclick = () =>
              operation(async () =>
                apply(
                  await api(
                    `/dashboard/voitures/${encodeURIComponent(id)}/photos/${encodeURIComponent(button.dataset.photoDelete)}`,
                    { method: 'DELETE' },
                  ),
                ),
              )),
        );
      root
        .querySelectorAll('button,input,select,textarea')
        .forEach((control) => {
          if (busy) control.disabled = true;
        });
      root.setAttribute('aria-busy', String(busy));
    }
    function apply(listing) {
      if (!listing?.id || !vehicleStatuses[listing.status])
        throw new Error(
          'La confirmation du serveur est invalide. Vos données restent dans le formulaire.',
        );
      if (
        photos.some(
          (photo) =>
            !(listing.photos || []).some((next) => next.id === photo.id),
        )
      )
        uploads.clear();
      for (const [photoId, url] of blobs)
        if (!(listing.photos || []).some((photo) => photo.id === photoId)) {
          URL.revokeObjectURL(url);
          blobs.delete(photoId);
        }
      id = listing.id;
      draft = vehicleDraftFromListing(listing);
      photos = listing.photos || [];
      status = listing.status;
      dirty = false;
      const url = new URL(location.href);
      url.searchParams.set('id', id);
      history.replaceState(null, '', url);
      sessionStorage.removeItem('pencmi_vehicle_creation');
    }
    async function previews() {
      for (const photo of photos)
        if (photo.managed && !blobs.has(photo.id)) {
          const blob = await api(
            `/files/${encodeURIComponent(photo.id)}/content`,
            { binary: true },
          );
          blobs.set(photo.id, URL.createObjectURL(blob));
        }
    }
    async function save(force = false) {
      if (id && !dirty && !force) return;
      if (!id) sessionStorage.setItem('pencmi_vehicle_creation', requestId);
      const body = JSON.parse(JSON.stringify(draft));
      if (!id) {
        const created = await api('/dashboard/voitures', {
          method: 'POST',
          body: { ...body, requestId },
        });
        if (!created?.id)
          throw new Error(
            'La création du brouillon n’a pas été confirmée. Réessayez sans quitter cette page.',
          );
        id = created.id;
        const url = new URL(location.href);
        url.searchParams.set('id', id);
        history.replaceState(null, '', url);
      }
      apply(
        await api(`/dashboard/voitures/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body,
        }),
      );
    }
    async function submit() {
      await save();
      apply(
        await api(`/dashboard/voitures/${encodeURIComponent(id)}/submit`, {
          method: 'POST',
        }),
      );
      message = vehicleCopy.submitted;
    }
    async function upload(files, replacePhotoId) {
      for (const file of files)
        if (
          !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
          file.size > 5 * 1024 * 1024
        )
          throw new Error(vehicleCopy.photoLimits);
      if (photos.length + files.length - (replacePhotoId ? 1 : 0) > 30)
        throw new Error(vehicleCopy.photoLimits);
      await save();
      for (const file of files) {
        const form = new FormData(),
          key = `${replacePhotoId || 'new'}:${file.name}:${file.size}:${file.lastModified}`;
        if (!uploads.has(key)) uploads.set(key, uuid());
        form.set('uploadId', uploads.get(key));
        form.set('photo', file);
        if (replacePhotoId) form.set('replacePhotoId', replacePhotoId);
        apply(
          await api(`/dashboard/voitures/${encodeURIComponent(id)}/photos`, {
            method: 'POST',
            body: form,
          }),
        );
      }
    }
    async function operation(action) {
      if (busy) return;
      busy = true;
      error = '';
      message = '';
      fields = [];
      render();
      try {
        if (dirty && step === 5) await save();
        await action();
      } catch (failure) {
        error = failure.message;
        fields = failure.fields || [];
        if (fields.length) step = vehicleFieldStep(fields[0].path);
      } finally {
        try {
          await previews();
        } catch (failure) {
          error ||= failure.message;
        }
        busy = false;
        render();
      }
    }
    document.querySelector('#publish-header').innerHTML =
      '<a class="brand" href="/" aria-label="Accueil Péncmi"><img src="/Logo%20pencmi.jpeg" width="64" height="64" style="object-fit:contain" alt="Péncmi"></a><div class="header-actions"><a class="btn btn-ghost" href="/voitures/">Voitures</a><a class="btn btn-light" href="/dashboard/voitures/">Mon espace</a></div>';
    window.addEventListener('beforeunload', (event) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    });
    window.addEventListener('pagehide', () =>
      blobs.forEach((url) => URL.revokeObjectURL(url)),
    );
    render();
    if (id)
      await operation(async () =>
        apply(await api(`/dashboard/voitures/${encodeURIComponent(id)}`)),
      );
  })().catch((error) => {
    document.querySelector('#publish-page').textContent = error.message;
  });
}

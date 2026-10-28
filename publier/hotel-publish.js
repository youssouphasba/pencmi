if (new URLSearchParams(location.search).get('category') === 'hotel') {
  (async () => {
    document.body.dataset.hotelPublication = '';
    const api = await import('./real-estate-api.mjs');
    const { hotelCatalog: catalog, escapeHotel: esc, emptyHotelDraft, hotelPayload, hotelFromServer, hotelFieldStep } = await import('./hotel-publication.mjs');
    const params = new URLSearchParams(location.search);
    let id = params.get('id');
    const requestId = api.publicationOperationId();
    let draft = emptyHotelDraft();
    let photos = [];
    let external = false;
    let busy = false;
    let step = Math.max(0, Math.min(12, Math.trunc(Number(params.get('step'))) || 0));
    let message = '';
    let errors = [];
    let status = 'draft';
    let saved = false;
    const objectUrls = new Map();
    const photoAttempts = new Map();
    const root = document.querySelector('#publish-page');
    const valueAt = path => path.split('.').reduce((value, key) => value?.[key], draft);
    const set = (path, value) => {
      const keys = path.split('.');
      let target = draft;
      for (const key of keys.slice(0, -1)) target = target[key] ??= {};
      target[keys.at(-1)] = value;
      saved = false;
    };
    const errorAt = path => errors.filter(error => error.path === path).map(error => `<small class="form-error" role="alert">${esc(error.message)}</small>`).join('');
    const field = (path, label, type = 'text', attributes = '') => `<label class="form-field"><span>${esc(label)}</span><input data-hotel-field="${esc(path)}" type="${type}" value="${esc(valueAt(path))}" ${attributes}>${errorAt(path)}</label>`;
    const check = (path, label) => `<label class="choice-card"><input type="checkbox" data-hotel-field="${esc(path)}"${valueAt(path) ? ' checked' : ''}><span>${esc(label)}</span>${errorAt(path)}</label>`;
    const textarea = (path, label) => `<label class="form-field full"><span>${esc(label)}</span><textarea data-hotel-field="${esc(path)}">${esc(valueAt(path))}</textarea>${errorAt(path)}</label>`;
    const choices = (path, labels) => `<div class="checkbox-list">${labels.map(label => `<label class="choice-card"><input type="checkbox" data-hotel-choice="${esc(path)}" value="${esc(label)}"${valueAt(path)?.includes(label) ? ' checked' : ''}><span>${esc(label)}</span></label>`).join('')}</div>`;
    const select = (path, label, options) => `<label class="form-field"><span>${esc(label)}</span><select data-hotel-field="${esc(path)}"><option value="">Sélectionner</option>${Object.entries(options).map(([key, text]) => `<option value="${esc(key)}"${String(valueAt(path)) === key ? ' selected' : ''}>${esc(text)}</option>`).join('')}</select>${errorAt(path)}</label>`;
    const editorRooms = () => draft.rooms.map((room, i) => room.remove ? '' : `<section class="hotel-room-editor"><h3>${esc(room.name || `Catégorie ${i + 1}`)}</h3><div class="form-grid">${field(`rooms.${i}.name`, 'Nom')}${field(`rooms.${i}.roomType`, 'Type de chambre')}${field(`rooms.${i}.capacity`, 'Capacité maximale', 'number', 'min="1"')}${field(`rooms.${i}.adults`, 'Adultes', 'number', 'min="1"')}${field(`rooms.${i}.children`, 'Enfants', 'number', 'min="0"')}${field(`rooms.${i}.beds`, 'Nombre de lits', 'number', 'min="1"')}${field(`rooms.${i}.bedType`, 'Type de lit')}${field(`rooms.${i}.totalUnits`, 'Nombre total d’unités', 'number', 'min="1"')}</div>${choices(`rooms.${i}.amenities`, catalog.roomAmenities)}${check(`rooms.${i}.enabled`, 'Catégorie activée')}<button type="button" class="btn btn-ghost" data-remove-room="${i}">Supprimer cette catégorie</button></section>`).join('');
    function periods(room, i, calendar) {
      const key = calendar ? 'calendar' : 'rates';
      return `<section class="hotel-room-editor"><h3>${esc(room.name || `Catégorie ${i + 1}`)}</h3>${!calendar ? field(`rooms.${i}.basePrice`, 'Tarif de base par nuit (FCFA)', 'number', 'min="0" step="1"') : ''}${(room[key] || []).map((period, j) => `<div class="hotel-period form-grid">${field(`rooms.${i}.${key}.${j}.start`, 'Du (inclus)', 'date')}${field(`rooms.${i}.${key}.${j}.end`, 'Au (inclus)', 'date')}${calendar ? `${select(`rooms.${i}.${key}.${j}.status`, 'État', catalog.calendar)}${field(`rooms.${i}.${key}.${j}.available`, 'Quantité disponible', 'number', 'min="0" step="1"')}${check(`rooms.${i}.${key}.${j}.stopSell`, 'Suspendre les ventes')}${field(`rooms.${i}.${key}.${j}.minStay`, 'Séjour minimum (nuits)', 'number', 'min="1"')}${field(`rooms.${i}.${key}.${j}.maxStay`, 'Séjour maximum (nuits)', 'number', 'min="1"')}` : field(`rooms.${i}.${key}.${j}.price`, 'Prix par nuit (FCFA)', 'number', 'min="0" step="1"')}<button class="btn btn-ghost" type="button" data-remove-period="${i}:${key}:${j}">Retirer la période</button></div>`).join('')}<button class="btn btn-light" type="button" data-add-period="${i}:${key}">Ajouter une période</button></section>`;
    }
    function content() {
      switch (step) {
        case 0: return `<div class="option-grid">${Object.entries(catalog.types).map(([code, label]) => `<label class="choice-card"><input type="radio" name="hotelType" data-hotel-field="propertyType" value="${code}"${draft.propertyType === code ? ' checked' : ''}><span>${label}</span></label>`).join('')}</div>${errorAt('propertyType')}`;
        case 1: return `<div class="form-grid">${field('name', 'Nom de l’établissement')}${field('metadata.general.stars', 'Classement déclaré (0 à 5 étoiles)', 'number', 'min="0" max="5"')}${field('metadata.general.totalRooms', 'Nombre total de chambres déclaré', 'number', 'min="0"')}${field('metadata.general.checkInTime', 'Heure d’arrivée', 'time')}${field('metadata.general.checkOutTime', 'Heure de départ', 'time')}${textarea('description', 'Description')}</div>`;
        case 2: return `<div class="form-grid">${select('region', 'Région', Object.fromEntries((window.SENEGAL_LOCATIONS || []).map(item => [item.region, item.region])))}${field('city', 'Ville')}${field('metadata.location.district', 'Quartier')}${field('address', 'Adresse privée ou indication')}${check('metadata.location.approximate', 'Localisation approximative')}${check('metadata.location.hideExactAddress', 'Masquer l’adresse exacte')}</div>`;
        case 3: return `${external ? '<p>Les chambres sont gérées par votre logiciel hôtelier.</p>' : ''}<fieldset${external ? ' disabled' : ''}>${errorAt('rooms')}${editorRooms()}<button class="btn btn-light" type="button" data-add-room>Ajouter une catégorie</button></fieldset>`;
        case 4: return `<fieldset${external ? ' disabled' : ''}>${draft.rooms.map((room, i) => room.remove ? '' : periods(room, i, false)).join('') || '<p>Ajoutez une catégorie de chambres avant de définir ses tarifs.</p>'}</fieldset>`;
        case 5: return `<div class="photo-dropzone"><label class="form-field"><span>Photos JPEG, PNG ou WebP — 5 Mo maximum, 30 photos par établissement</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple data-hotel-photos></label><label class="form-field"><span>Photos de</span><select data-photo-room><option value="">L’établissement</option>${draft.rooms.filter(room => room.id && !room.remove).map(room => `<option value="${esc(room.id)}">${esc(room.name)}</option>`).join('')}</select></label><p>Quota total : 150 Mo par annonceur.</p></div><div class="hotel-photo-grid">${photos.map((photo, i) => `<figure><img ${objectUrls.get(photo.id) || !photo.managed ? `src="${esc(objectUrls.get(photo.id) || photo.url)}"` : ''} alt="Photo ${i + 1}" data-photo-preview="${esc(photo.id)}"><figcaption>${i === 0 ? 'Photo principale' : `Photo ${i + 1}`}</figcaption><div class="hotel-photo-actions"><button type="button" class="btn btn-ghost" aria-label="Déplacer avant" data-move-photo="${i}:-1"${i === 0 ? ' disabled' : ''}>←</button><button type="button" class="btn btn-ghost" aria-label="Déplacer après" data-move-photo="${i}:1"${i === photos.length - 1 ? ' disabled' : ''}>→</button><button type="button" class="btn btn-ghost" data-delete-photo="${esc(photo.id)}">Supprimer</button></div></figure>`).join('')}</div>`;
        case 6: return choices('metadata.amenities', catalog.amenities);
        case 7: return `${choices('metadata.conditions.options', catalog.conditions)}${textarea('metadata.conditions.additionalFees', 'Frais supplémentaires éventuels')}`;
        case 8: return `<p>Les dates non renseignées restent à confirmer. Fuseau horaire : Sénégal (Africa/Dakar).</p><fieldset${external ? ' disabled' : ''}>${draft.rooms.map((room, i) => room.remove ? '' : periods(room, i, true)).join('') || '<p>Ajoutez une catégorie de chambres avant de renseigner ses disponibilités.</p>'}</fieldset>`;
        case 9: return `<div class="option-grid"><label class="choice-card"><input type="radio" checked name="management"><span>Manuel</span></label><label class="choice-card"><input type="radio" disabled name="management"><span>Semi-automatique — indisponible</span></label><label class="choice-card"><input type="radio" disabled name="management"><span>Automatique — indisponible</span></label></div>${check('metadata.management.showRemainingRoomsToClients', 'Afficher les quantités renseignées aux clients')}<p>Les demandes doivent être confirmées par l’établissement. Aucun stock n’est bloqué à l’envoi d’une demande.</p>`;
        case 10: return `${Object.entries(catalog.contacts).map(([key, label]) => check(`metadata.contactPreferences.${key}`, label)).join('')}<div class="form-grid">${field('metadata.contactPreferences.whatsappNumber', 'Numéro WhatsApp', 'tel')}${field('metadata.contactPreferences.phoneNumber', 'Téléphone', 'tel')}${field('metadata.contactPreferences.contactEmail', 'Email de contact', 'email')}${field('metadata.contactPreferences.notificationEmail', 'Email de notification', 'email')}</div>${errorAt('metadata.contactPreferences')}`;
        case 11: return `<div class="preview-box"><h3>${esc(draft.name || 'Nom non renseigné')}</h3><p>${esc(catalog.types[draft.propertyType])} · ${esc(draft.city)}</p><p>${esc(draft.description)}</p>${draft.rooms.filter(room => !room.remove).map(room => `<p>${esc(room.name)} · ${esc(room.capacity)} personnes · ${room.basePrice !== undefined ? `${esc(room.basePrice)} FCFA / nuit` : 'Tarif non renseigné'}</p>`).join('')}<p>${photos.length} photo(s)</p></div>`;
        default: return '<p>Votre hébergement sera soumis à validation avant sa mise en ligne.</p><button class="btn btn-primary" type="button" data-submit-hotel>Soumettre l’hébergement</button>';
      }
    }
    function render() {
      document.title = 'Publier un hébergement - Péncmi';
      document.querySelector('#publish-header').innerHTML = '<a class="brand" href="/"><strong>Péncmi</strong></a><div class="header-actions"><a class="btn btn-ghost" href="/hotels">Hôtels</a><a class="btn btn-light" href="/dashboard/hotels/annonces">Mes hébergements</a></div>';
      root.innerHTML = `<div class="publish-shell"><section class="publish-main"><div class="publish-top"><h1>${id ? 'Modifier mon hébergement' : 'Publier un hébergement'}</h1><p>Étape ${step + 1} sur 13 · ${esc(catalog.status[status] || status)}</p></div><nav class="stepper" aria-label="Étapes">${catalog.steps.map((label, i) => `<button type="button" data-hotel-step="${i}" class="step-pill${i === step ? ' is-active' : ''}"${busy ? ' disabled' : ''}>${i + 1}. ${label}</button>`).join('')}</nav><fieldset${busy ? ' disabled' : ''}><section class="step-card"><h2>${catalog.steps[step]}</h2>${content()}</section></fieldset>${errors.length ? `<div class="form-error" role="alert">${errors.map(error => `<p>${esc(error.message)}</p>`).join('')}</div>` : ''}<div role="status" class="status-message">${esc(busy ? 'Enregistrement en cours…' : message)}</div><div class="publish-nav"><div class="publish-nav-group"><button class="btn btn-ghost" type="button" data-prev-hotel${busy || step === 0 ? ' disabled' : ''}>Retour</button><button class="btn btn-light" type="button" data-save-hotel${busy ? ' disabled' : ''}>Enregistrer en brouillon</button></div><div class="publish-nav-group"><button class="btn btn-ghost" type="button" data-hotel-step="11"${busy ? ' disabled' : ''}>Prévisualiser</button><button class="btn btn-primary" type="button" data-next-hotel${busy ? ' disabled' : ''}>${step === 12 ? 'Soumettre' : 'Suivant'}</button></div></div></section><aside class="draft-summary"><h2>Résumé</h2><p>${esc(draft.name || 'Hébergement sans nom')}</p><p>${esc(draft.city)}</p><p>${draft.rooms.filter(room => !room.remove).length} catégorie(s)</p><p>${photos.length} photo(s)</p></aside></div>`;
      bind();
      root.querySelectorAll('[data-delete-photo]').forEach(button => {
        const label = document.createElement('label');
        label.className = 'form-field';
        const name = document.createElement('span'); name.textContent = 'Remplacer';
        const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp'; input.disabled = busy;
        input.addEventListener('change', () => uploadFiles([...input.files], undefined, button.dataset.deletePhoto));
        label.append(name, input); button.closest('figure').append(label);
      });
      root.querySelectorAll('[data-photo-preview]').forEach(async img => {
        if (objectUrls.has(img.dataset.photoPreview)) return;
        const photo = photos.find(item => item.id === img.dataset.photoPreview);
        if (!photo?.managed) return;
        try {
          const blob = await api.publicationRequest(`/files/${encodeURIComponent(photo.id)}/content`, { binary: true });
          const url = URL.createObjectURL(blob); objectUrls.set(photo.id, url); if (img.isConnected) img.src = url;
        } catch { img.alt = 'Aperçu indisponible'; }
      });
    }
    function accept(property) {
      id = property.id; draft = hotelFromServer(property); photos = property.photos || []; external = property.externalInventory; status = property.status; saved = true;
      const url = new URL(location.href); url.searchParams.set('id', id); history.replaceState(null, '', url);
    }
    async function save() {
      const payload = hotelPayload(draft, external);
      const property = await api.publicationRequest(id ? `/dashboard/hotels/${encodeURIComponent(id)}` : '/dashboard/hotels', { method: id ? 'PATCH' : 'POST', body: id ? payload : { ...payload, requestId } });
      accept(property); return property;
    }
    async function operation(action) {
      if (busy) return;
      busy = true; errors = []; message = ''; render();
      try { await action(); }
      catch (error) {
        errors = error.fields?.length ? error.fields : [{ path: '', message: error.message }];
        if (error.fields?.length) step = hotelFieldStep(error.fields[0].path);
        if (error.status === 401) message = 'Reconnectez-vous dans un autre onglet, puis réessayez sans fermer ce formulaire.';
      } finally { busy = false; render(); }
    }
    async function submit() { await save(); accept(await api.publicationRequest(`/dashboard/hotels/${encodeURIComponent(id)}/submit`, { method: 'POST' })); message = 'Votre hébergement a été soumis avec succès.'; }
    function uploadFiles(files, roomId, replacePhotoId) {
      return operation(async () => {
        if (photos.length + files.length - (replacePhotoId ? 1 : 0) > 30) throw new Error('Limite de 30 photos atteinte.');
        if (files.some(file => file.size > 5 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) throw new Error('Choisissez des photos JPEG, PNG ou WebP de 5 Mo maximum.');
        await save();
        for (const file of files) {
          const key = `${replacePhotoId || roomId || ''}:${file.name}:${file.size}:${file.lastModified}`;
          const uploadId = photoAttempts.get(key) || api.publicationOperationId(); photoAttempts.set(key, uploadId);
          const form = new FormData(); form.append('photo', file); form.append('uploadId', uploadId); if (roomId) form.append('roomId', roomId); if (replacePhotoId) form.append('replacePhotoId', replacePhotoId);
          accept(await api.publicationRequest(`/dashboard/hotels/${encodeURIComponent(id)}/photos`, { method: 'POST', body: form })); photoAttempts.delete(key);
        }
        message = 'Photos enregistrées.';
      });
    }
    function bind() {
      root.querySelectorAll('[data-hotel-field]').forEach(input => input.addEventListener('input', () => set(input.dataset.hotelField, input.type === 'checkbox' ? input.checked : input.type === 'number' ? (input.value === '' ? undefined : Number(input.value)) : input.value)));
      root.querySelectorAll('[data-hotel-choice]').forEach(input => input.addEventListener('change', () => { const values = valueAt(input.dataset.hotelChoice) || []; set(input.dataset.hotelChoice, input.checked ? [...values, input.value] : values.filter(value => value !== input.value)); }));
      root.querySelectorAll('[data-hotel-step]').forEach(button => button.onclick = () => { if (!busy) { step = Number(button.dataset.hotelStep); render(); } });
      root.querySelector('[data-prev-hotel]').onclick = () => { step--; render(); };
      root.querySelector('[data-next-hotel]').onclick = () => step === 12 ? operation(submit) : (step++, render());
      root.querySelector('[data-save-hotel]').onclick = () => operation(async () => { await save(); message = 'Brouillon enregistré.'; });
      root.querySelector('[data-submit-hotel]')?.addEventListener('click', () => operation(submit));
      root.querySelector('[data-add-room]')?.addEventListener('click', () => { draft.rooms.push({ clientId: api.publicationOperationId(), name: '', currency: 'FCFA', enabled: true, amenities: [], rates: [], calendar: [] }); saved = false; render(); });
      root.querySelectorAll('[data-remove-room]').forEach(button => button.onclick = () => { const i = Number(button.dataset.removeRoom); if (draft.rooms[i].id) draft.rooms[i].remove = true; else draft.rooms.splice(i, 1); saved = false; render(); });
      root.querySelectorAll('[data-add-period]').forEach(button => button.onclick = () => { const [i, key] = button.dataset.addPeriod.split(':'); (draft.rooms[i][key] ??= []).push(key === 'rates' ? { start: '', end: '', currency: 'FCFA', price: 0 } : { start: '', end: '', available: 0, status: 'closed', stopSell: false }); saved = false; render(); });
      root.querySelectorAll('[data-remove-period]').forEach(button => button.onclick = () => { const [i, key, j] = button.dataset.removePeriod.split(':'); draft.rooms[i][key].splice(j, 1); saved = false; render(); });
      root.querySelector('[data-hotel-photos]')?.addEventListener('change', event => {
        const files = [...event.target.files]; const roomId = root.querySelector('[data-photo-room]')?.value;
        uploadFiles(files, roomId);
      });
      root.querySelectorAll('[data-move-photo]').forEach(button => button.onclick = () => operation(async () => { if (!saved) await save(); const [i, delta] = button.dataset.movePhoto.split(':').map(Number); const order = photos.map(photo => photo.id); [order[i], order[i + delta]] = [order[i + delta], order[i]]; accept(await api.publicationRequest(`/dashboard/hotels/${encodeURIComponent(id)}/photos/order`, { method: 'PATCH', body: { photoIds: order } })); }));
      root.querySelectorAll('[data-delete-photo]').forEach(button => button.onclick = () => operation(async () => { if (!saved) await save(); accept(await api.publicationRequest(`/dashboard/hotels/${encodeURIComponent(id)}/photos/${encodeURIComponent(button.dataset.deletePhoto)}`, { method: 'DELETE' })); }));
    }
    window.addEventListener('beforeunload', event => { if (!saved && (draft.name || draft.rooms.length)) { event.preventDefault(); event.returnValue = ''; } });
    window.addEventListener('pagehide', () => objectUrls.forEach(url => URL.revokeObjectURL(url)));
    render();
    if (id) await operation(async () => accept(await api.publicationRequest(`/dashboard/hotels/${encodeURIComponent(id)}`)));
  })().catch(() => { document.querySelector('#publish-page').textContent = 'Le formulaire n’a pas pu être chargé. Réessayez.'; });
}

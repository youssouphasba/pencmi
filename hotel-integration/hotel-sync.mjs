// Hotel synchronisation: hotelier settings (iCal calendars, channel manager) and the
// admin list of channel manager partners.
import { getPublicationApiBase, publicationRequest } from '/publier/real-estate-api.mjs';

const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

export const SYNC_MODES = [
  ['none', 'Aucune synchronisation', 'Vous mettez à jour vos disponibilités directement dans Péncmi.'],
  ['ical', 'Calendrier iCal', 'Votre logiciel publie un lien calendrier par chambre. Péncmi le relit toutes les quelques minutes et publie le sien, que votre logiciel lit à son tour.'],
  ['channel_manager', 'Channel manager', 'Votre channel manager envoie à Péncmi vos disponibilités et vos prix, et reçoit les réservations Péncmi dans votre logiciel.'],
];

export function relativeAge(value, now = new Date()) {
  if (!value) return '';
  const minutes = Math.max(0, Math.round((now - new Date(value)) / 60000));
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `il y a ${hours} h`;
  return `il y a ${Math.round(hours / 24)} jours`;
}

/** What the hotelier needs to know about one imported calendar. */
export function importStatus(entry, freshnessHours, now = new Date()) {
  if (entry.lastSuccessAt && (!entry.lastAttemptAt || new Date(entry.lastSuccessAt) >= new Date(entry.lastAttemptAt))) {
    const fresh = now - new Date(entry.lastSuccessAt) < freshnessHours * 3600_000;
    return { tone: fresh ? 'ok' : 'warning', text: `Lu ${relativeAge(entry.lastSuccessAt, now)} · ${entry.blockedNights} nuit(s) occupée(s)` };
  }
  if (entry.lastError) return { tone: 'error', text: `${entry.lastError}${entry.lastSuccessAt ? ` Dernière lecture réussie ${relativeAge(entry.lastSuccessAt, now)}.` : ''}` };
  return { tone: 'warning', text: 'Pas encore lu.' };
}

/** The address to paste in the hotel software: the server gives it, or it is built from the API address. */
export function exportHref(room, apiBase) {
  if (room.icalExportUrl) return room.icalExportUrl;
  if (!room.icalExportPath) return '';
  try {
    return new URL(room.icalExportPath, apiBase || window.location.origin).toString();
  } catch {
    return room.icalExportPath;
  }
}

function fieldErrors(error) {
  const details = (error.fields || []).map((field) => field.message).filter(Boolean);
  return details.length ? `${error.message} ${details.join(' ')}` : error.message;
}

// ------------------------------------------------------------------ Hotelier page

const state = { hotels: [], propertyId: '', view: null, message: '', tone: 'ok', busy: false };

function roomCard(room, view, apiBase) {
  const href = exportHref(room, apiBase);
  const imports = room.imports.map((entry) => {
    const status = importStatus(entry, view.icalFreshnessHours);
    return `<li class="hotel-sync-import">
      <div><code title="${escape(entry.url)}">${escape(entry.url.length > 70 ? `${entry.url.slice(0, 67)}…` : entry.url)}</code>
      <small>${entry.unitsPerEvent > 1 ? `${entry.unitsPerEvent} unités par événement · ` : ''}<span class="hotel-sync-tone-${status.tone}">${escape(status.text)}</span></small></div>
      <button type="button" class="btn btn-ghost" data-action="delete-import" data-id="${escape(entry.id)}">Retirer</button>
    </li>`;
  }).join('');
  return `<article class="hotel-integration-card hotel-sync-room" data-room="${escape(room.id)}">
    <h3>${escape(room.name)}${room.totalUnits ? ` <small>(${escape(room.totalUnits)} unité(s))</small>` : ''}</h3>
    <div class="hotel-sync-block">
      <h4>1. Lien Péncmi à copier dans votre logiciel</h4>
      <p class="hotel-sync-hint">Votre logiciel l’ajoute comme calendrier externe : les nuits réservées sur Péncmi s’y bloquent. Aucune donnée client n’y figure.</p>
      ${href ? `<div class="hotel-sync-copy"><input type="text" readonly value="${escape(href)}" aria-label="Lien calendrier Péncmi de ${escape(room.name)}">
        <button type="button" class="btn btn-primary" data-action="copy" data-value="${escape(href)}">Copier</button>
        <button type="button" class="btn btn-ghost" data-action="create-export">Nouveau lien</button>
        <button type="button" class="btn btn-ghost" data-action="delete-export">Désactiver</button></div>`
        : `<button type="button" class="btn btn-primary" data-action="create-export">Créer le lien</button>`}
    </div>
    <div class="hotel-sync-block">
      <h4>2. Lien calendrier publié par votre logiciel</h4>
      <p class="hotel-sync-hint">Chaque événement de ce calendrier bloque les nuits correspondantes sur Péncmi.</p>
      ${imports ? `<ul class="hotel-sync-imports">${imports}</ul>` : ''}
      <form class="hotel-sync-import-form" data-action="add-import">
        <label class="hotel-integration-field"><span>Lien iCal (https://…)</span><input name="url" type="url" required maxlength="2000" placeholder="https://…/calendar.ics"></label>
        <label class="hotel-integration-field"><span>Unités bloquées par événement</span><input name="unitsPerEvent" type="number" min="1" max="50" value="1" required></label>
        <button class="btn btn-primary" type="submit">Ajouter</button>
      </form>
    </div>
  </article>`;
}

function channelSection(view) {
  if (view.mode !== 'channel_manager') return '';
  return `<section class="hotel-integration-card">
    <h2>À transmettre à ${escape(view.channelPartner?.name || 'votre channel manager')}</h2>
    <p>Code établissement : <strong><code>${escape(view.hotelCode)}</code></strong></p>
    <table class="hotel-sync-table"><thead><tr><th>Chambre</th><th>Code chambre</th></tr></thead><tbody>
      ${view.rooms.map((room) => `<tr><td>${escape(room.name)}</td><td><code>${escape(room.roomCode)}</code></td></tr>`).join('')}
    </tbody></table>
    <p class="hotel-sync-hint">${view.lastSyncAt ? `Dernières disponibilités reçues ${escape(relativeAge(view.lastSyncAt))}.` : 'Aucune disponibilité reçue pour l’instant : vos chambres restent « à confirmer ».'}
    ${view.pendingChannelEvents ? ` ${escape(view.pendingChannelEvents)} réservation(s) en attente de lecture par votre channel manager.` : ''}</p>
  </section>`;
}

function renderHotelier(root) {
  const view = state.view;
  const apiBase = getPublicationApiBase();
  const hotelPicker = state.hotels.length > 1
    ? `<label class="hotel-integration-field"><span>Établissement</span><select data-action="pick-hotel">${state.hotels.map((hotel) => `<option value="${escape(hotel.id)}"${hotel.id === state.propertyId ? ' selected' : ''}>${escape(hotel.name)}</option>`).join('')}</select></label>`
    : '';
  const message = state.message ? `<div class="hotel-integration-notice hotel-sync-tone-${state.tone}" role="status">${escape(state.message)}</div>` : '';
  if (!view) {
    root.innerHTML = `${hotelPicker}${message}`;
    return;
  }
  const partners = view.partners.length
    ? `<label class="hotel-integration-field" data-partner-field><span>Votre channel manager</span><select name="partnerCode">${view.partners.map((partner) => `<option value="${escape(partner.code)}"${view.channelPartner?.code === partner.code ? ' selected' : ''}>${escape(partner.name)}</option>`).join('')}</select></label>`
    : '<p class="hotel-integration-notice" data-partner-field>Aucun channel manager n’est encore relié à Péncmi. Indiquez-nous le vôtre : nous le contactons.</p>';
  const showRooms = view.mode === 'ical' || view.rooms.some((room) => room.imports.length || room.icalExportPath);
  root.innerHTML = `${hotelPicker}${message}
    <form class="hotel-integration-card" data-action="save-settings">
      <h2>Comment vos disponibilités arrivent sur Péncmi</h2>
      <div class="hotel-sync-modes">${SYNC_MODES.map(([value, label, help]) => `<label class="choice-card"><input type="radio" name="mode" value="${value}"${view.mode === value ? ' checked' : ''}><span><strong>${label}</strong><small>${help}</small></span></label>`).join('')}</div>
      ${partners}
      <label class="choice-card"><input type="checkbox" name="autoConfirm"${view.autoConfirm ? ' checked' : ''}><span><strong>Confirmer automatiquement les demandes</strong>
        <small>Quand le stock synchronisé couvre le séjour, la demande est acceptée sans attendre votre réponse et part vers votre logiciel. Avec iCal, seulement si les calendriers de la chambre ont été lus il y a moins de ${escape(view.icalFreshnessHours)} h.</small></span></label>
      <button class="btn btn-primary" type="submit"${state.busy ? ' disabled' : ''}>Enregistrer</button>
    </form>
    ${channelSection(view)}
    ${showRooms ? `<section><h2>Calendriers par chambre</h2>${view.rooms.length ? view.rooms.map((room) => roomCard(room, view, apiBase)).join('') : '<p>Ajoutez d’abord vos chambres dans votre annonce.</p>'}</section>` : ''}`;
  syncPartnerField(root);
}

function syncPartnerField(root) {
  const mode = root.querySelector('input[name="mode"]:checked')?.value;
  const field = root.querySelector('[data-partner-field]');
  if (field) field.hidden = mode !== 'channel_manager';
  const auto = root.querySelector('input[name="autoConfirm"]');
  if (auto) auto.disabled = mode === 'none';
}

async function loadView(root) {
  state.view = null;
  renderHotelier(root);
  state.view = await publicationRequest(`/dashboard/hotels/integrations/${encodeURIComponent(state.propertyId)}/sync`);
  renderHotelier(root);
}

async function run(root, action, success) {
  state.busy = true;
  try {
    await action();
    state.message = success;
    state.tone = 'ok';
  } catch (error) {
    state.message = fieldErrors(error);
    state.tone = 'error';
  } finally {
    state.busy = false;
  }
  try {
    await loadView(root);
  } catch (error) {
    state.message = error.message;
    state.tone = 'error';
    renderHotelier(root);
  }
}

export async function mountHotelSync(root) {
  root.addEventListener('change', async (event) => {
    if (event.target.name === 'mode') syncPartnerField(root);
    if (event.target.dataset.action === 'pick-hotel') {
      state.propertyId = event.target.value;
      state.message = '';
      await loadView(root).catch((error) => { state.message = error.message; state.tone = 'error'; renderHotelier(root); });
    }
  });
  root.addEventListener('submit', (event) => {
    const form = event.target;
    event.preventDefault();
    const base = `/dashboard/hotels/integrations/${encodeURIComponent(state.propertyId)}/sync`;
    if (form.dataset.action === 'save-settings') {
      const data = new FormData(form);
      const mode = data.get('mode') || 'none';
      const body = { mode, autoConfirm: data.get('autoConfirm') === 'on' };
      if (mode === 'channel_manager' && data.get('partnerCode')) body.partnerCode = data.get('partnerCode');
      run(root, () => publicationRequest(base, { method: 'PUT', body }), 'Réglages enregistrés.');
    }
    if (form.dataset.action === 'add-import') {
      const roomId = form.closest('[data-room]').dataset.room;
      const data = new FormData(form);
      run(root, async () => {
        const entry = await publicationRequest(`${base}/rooms/${encodeURIComponent(roomId)}/ical-imports`, {
          method: 'POST', body: { url: String(data.get('url')).trim(), unitsPerEvent: Number(data.get('unitsPerEvent')) },
        });
        if (entry.lastError) throw new Error(`Calendrier ajouté, mais pas encore lisible : ${entry.lastError}`);
      }, 'Calendrier ajouté et lu.');
    }
  });
  root.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const base = `/dashboard/hotels/integrations/${encodeURIComponent(state.propertyId)}/sync`;
    const roomId = button.closest('[data-room]')?.dataset.room;
    const action = button.dataset.action;
    if (action === 'copy') {
      try {
        await navigator.clipboard.writeText(button.dataset.value);
        button.textContent = 'Copié';
      } catch {
        button.previousElementSibling?.select();
      }
    }
    if (action === 'create-export') {
      if (button.textContent.includes('Nouveau') && !window.confirm('L’ancien lien cessera de fonctionner : il faudra coller le nouveau dans votre logiciel. Continuer ?')) return;
      run(root, () => publicationRequest(`${base}/rooms/${encodeURIComponent(roomId)}/ical-export`, { method: 'POST' }), 'Lien créé : copiez-le dans votre logiciel.');
    }
    if (action === 'delete-export' && window.confirm('Votre logiciel ne recevra plus les réservations Péncmi de cette chambre. Continuer ?'))
      run(root, () => publicationRequest(`${base}/rooms/${encodeURIComponent(roomId)}/ical-export`, { method: 'DELETE' }), 'Lien désactivé.');
    if (action === 'delete-import' && window.confirm('Les nuits bloquées par ce calendrier seront libérées sur Péncmi. Continuer ?'))
      run(root, () => publicationRequest(`${base}/ical-imports/${encodeURIComponent(button.dataset.id)}`, { method: 'DELETE' }), 'Calendrier retiré.');
  });
  try {
    const hotels = await publicationRequest('/dashboard/hotels');
    state.hotels = (Array.isArray(hotels) ? hotels : hotels?.items || []).filter((hotel) => hotel && hotel.id);
    const wanted = new URLSearchParams(window.location.search).get('property');
    state.propertyId = state.hotels.some((hotel) => hotel.id === wanted) ? wanted : state.hotels[0]?.id || '';
    if (!state.propertyId) {
      state.message = 'Publiez d’abord votre établissement pour le synchroniser.';
      state.tone = 'warning';
      renderHotelier(root);
      return;
    }
    await loadView(root);
  } catch (error) {
    state.message = error.message;
    state.tone = 'error';
    renderHotelier(root);
  }
}

// ------------------------------------------------------------------ Admin page

export async function mountChannelPartners(root) {
  let secretNotice = '';
  let message = '';
  const render = (partners) => {
    root.innerHTML = `${secretNotice}${message ? `<div class="hotel-integration-notice" role="status">${escape(message)}</div>` : ''}
      <form class="admin-hotel-integration-card" data-action="create">
        <h2>Ajouter un channel manager partenaire</h2>
        <div class="hotel-integration-form-grid">
          <label class="hotel-integration-field"><span>Code (identifiant technique)</span><input name="code" required pattern="[a-z0-9][a-z0-9-]{1,30}" placeholder="siteminder"></label>
          <label class="hotel-integration-field"><span>Nom affiché aux hôteliers</span><input name="name" required minlength="2" maxlength="80" placeholder="SiteMinder"></label>
        </div>
        <button class="btn btn-primary" type="submit">Créer et générer le secret</button>
      </form>
      <section class="admin-hotel-integration-card"><h2>Partenaires</h2>
        ${partners.length ? `<table class="hotel-sync-table"><thead><tr><th>Nom</th><th>Code</th><th>Hôtels connectés</th><th>Statut</th><th>Actions</th></tr></thead><tbody>
          ${partners.map((partner) => `<tr><td>${escape(partner.name)}</td><td><code>${escape(partner.code)}</code></td><td>${escape(partner.hotels)}</td><td>${partner.active ? 'Actif' : 'Désactivé'}</td>
            <td><button type="button" class="btn btn-ghost" data-action="rotate" data-id="${escape(partner.id)}">Nouveau secret</button>
            <button type="button" class="btn btn-ghost" data-action="toggle" data-id="${escape(partner.id)}" data-active="${partner.active}">${partner.active ? 'Désactiver' : 'Réactiver'}</button></td></tr>`).join('')}
        </tbody></table>` : '<p>Aucun channel manager partenaire pour l’instant.</p>'}
      </section>`;
  };
  const showSecret = (partner) => {
    secretNotice = `<div class="hotel-integration-notice" role="alert"><strong>Secret de ${escape(partner.name)}, affiché une seule fois.</strong>
      Transmettez-le par un canal sûr avec le code <code>${escape(partner.code)}</code> (en-têtes <code>X-Channel-Partner</code> et <code>X-Channel-Secret</code>).
      <input type="text" readonly value="${escape(partner.secret)}" aria-label="Secret"></div>`;
  };
  const load = async () => render(await publicationRequest('/admin/hotel-channel-partners'));
  const act = async (action) => {
    try {
      await action();
    } catch (error) {
      message = fieldErrors(error);
    }
    await load().catch((error) => { message = error.message; render([]); });
  };
  root.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(event.target);
    message = '';
    act(async () => showSecret(await publicationRequest('/admin/hotel-channel-partners', {
      method: 'POST', body: { code: String(data.get('code')).trim(), name: String(data.get('name')).trim() },
    })));
  });
  root.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    message = '';
    secretNotice = '';
    const id = encodeURIComponent(button.dataset.id);
    if (button.dataset.action === 'rotate' && window.confirm('L’ancien secret cessera immédiatement de fonctionner. Continuer ?'))
      act(async () => showSecret(await publicationRequest(`/admin/hotel-channel-partners/${id}/secret`, { method: 'POST' })));
    if (button.dataset.action === 'toggle') {
      const active = button.dataset.active !== 'true';
      if (!active && !window.confirm('Les hôtels reliés à ce partenaire ne seront plus synchronisés. Continuer ?')) return;
      act(() => publicationRequest(`/admin/hotel-channel-partners/${id}`, { method: 'PATCH', body: { active } }));
    }
  });
  await load().catch((error) => { message = error.message; render([]); });
}

// Boarding list of a departure: confirmed passengers, ticket check by code, no-shows.
import { apiRequest, el, formatDateTime } from '../../messaging/messaging-ui.mjs';
import { accountError } from '../../compte/account-ui.mjs';

const LABELS = { boarded: 'Embarqué', no_show: 'Absent' };

export function mountBoarding(root, { trips = [] } = {}) {
  const tripSelect = el('select', { 'aria-label': 'Trajet' }, el('option', { value: '', text: 'Choisir un trajet' }),
    trips.map((trip) => el('option', { value: trip.id, text: trip.title || `${trip.departureCity || ''} → ${trip.arrivalCity || ''}` })));
  const departureSelect = el('select', { 'aria-label': 'Départ', disabled: true }, el('option', { value: '', text: 'Choisir un départ' }));
  const status = el('p', { role: 'status' });
  const manifest = el('div', { 'aria-live': 'polite' });
  root.replaceChildren(el('section', { class: 'trip-dashboard-card' },
    el('div', { class: 'trip-filters' }, el('label', {}, 'Trajet ', tripSelect), ' ', el('label', {}, 'Départ ', departureSelect))), status, manifest);

  tripSelect.addEventListener('change', async () => {
    manifest.replaceChildren();
    departureSelect.replaceChildren(el('option', { value: '', text: 'Choisir un départ' }));
    departureSelect.disabled = true;
    if (!tripSelect.value) return;
    status.textContent = 'Chargement des départs…';
    try {
      const trip = await apiRequest(`/dashboard/voyages/${encodeURIComponent(tripSelect.value)}`);
      const recent = Date.now() - 2 * 86400000;
      const occurrences = (trip.occurrences || []).filter((occurrence) => new Date(occurrence.departureAt).valueOf() >= recent);
      departureSelect.append(...occurrences.map((occurrence) => el('option', {
        value: occurrence.id,
        text: `${formatDateTime(occurrence.departureAt)} · ${occurrence.confirmedSeats} place(s) confirmée(s)${occurrence.cancelledAt ? ' · annulé' : ''}`,
      })));
      departureSelect.disabled = !occurrences.length;
      status.textContent = occurrences.length ? '' : 'Aucun départ récent ou à venir pour ce trajet.';
      if (occurrences.length === 1) { departureSelect.value = occurrences[0].id; void load(); }
    } catch (error) { accountError(status, error); }
  });
  departureSelect.addEventListener('change', () => load());

  const board = async (body, notice) => {
    try {
      await apiRequest(`/dashboard/voyages/${encodeURIComponent(tripSelect.value)}/occurrences/${encodeURIComponent(departureSelect.value)}/boarding`, { method: 'POST', body });
      await load(notice);
      return true;
    } catch (error) {
      status.textContent = error.message || 'Enregistrement impossible.';
      return false;
    }
  };

  async function load(notice = '') {
    if (!departureSelect.value) { manifest.replaceChildren(); return; }
    manifest.textContent = 'Chargement de la liste…';
    try {
      const data = await apiRequest(`/dashboard/voyages/${encodeURIComponent(tripSelect.value)}/occurrences/${encodeURIComponent(departureSelect.value)}/manifest`);
      const code = el('input', { name: 'ticketCode', autocomplete: 'off', autocapitalize: 'characters', maxLength: 14, placeholder: 'Ex. : ABCDE-FGHJK', required: true });
      const check = el('form', { class: 'trip-dashboard-card' },
        el('h2', { text: 'Contrôler un billet' }),
        el('label', {}, 'Code du billet ', code), ' ',
        el('button', { class: 'btn btn-primary', type: 'submit', text: 'Valider l’embarquement', disabled: !data.occurrence.boardingOpen }));
      check.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!code.value.trim()) { status.textContent = 'Saisissez le code du billet.'; code.focus(); return; }
        if (await board({ ticketCode: code.value, status: 'boarded' }, 'Passager embarqué.')) manifest.querySelector('[name=ticketCode]')?.focus();
      });
      const { totals, occurrence } = data;
      manifest.replaceChildren(
        el('section', { class: 'trip-dashboard-card' },
          el('h2', { text: `${occurrence.trip.departureCity} → ${occurrence.trip.arrivalCity}, ${formatDateTime(occurrence.departureAt)}` }),
          el('p', { text: `${totals.passengers} réservation(s), ${totals.seats} place(s) · ${totals.boardedSeats} embarquée(s) · ${totals.noShowSeats} absente(s)` }),
          occurrence.cancelledAt ? el('p', { role: 'alert', text: 'Ce départ est annulé.' })
            : occurrence.boardingOpen ? null : el('p', { text: 'L’embarquement ouvre 24 h avant le départ et ferme 12 h après.' })),
        check,
        data.passengers.length ? el('section', { class: 'trip-table-wrap' }, el('table', { class: 'trip-table' },
          el('thead', {}, el('tr', {}, ['Passager', 'Téléphone', 'Places', 'Bagages', 'Billet', 'Embarquement', ''].map((text) => el('th', { scope: 'col', text })))),
          el('tbody', {}, data.passengers.map((passenger) => el('tr', {},
            el('td', { text: passenger.clientName || 'Client' }),
            el('td', { text: passenger.clientPhone || '—' }),
            el('td', { text: String(passenger.allocatedSeats ?? '') }),
            el('td', { text: passenger.luggage ? 'Oui' : 'Non' }),
            el('td', { text: passenger.ticketCode ? `${passenger.ticketCode.slice(0, 5)}-${passenger.ticketCode.slice(5)}` : '—' }),
            el('td', { text: LABELS[passenger.boardingStatus] || 'En attente' }),
            el('td', {}, occurrence.boardingOpen ? [
              passenger.boardingStatus !== 'boarded' ? el('button', { class: 'btn btn-primary', type: 'button', text: 'Embarqué', onClick: () => board({ requestId: passenger.id, status: 'boarded' }, 'Passager embarqué.') }) : null,
              passenger.boardingStatus !== 'no_show' ? el('button', { class: 'btn btn-ghost', type: 'button', text: 'Absent', onClick: () => board({ requestId: passenger.id, status: 'no_show' }, 'Absence enregistrée.') }) : null,
              passenger.boardingStatus ? el('button', { class: 'btn btn-ghost', type: 'button', text: 'Annuler', onClick: () => board({ requestId: passenger.id, status: 'pending' }, 'Statut remis en attente.') }) : null,
            ] : null)))))) : el('p', { class: 'trip-dashboard-card', text: 'Aucune place confirmée sur ce départ.' }),
      );
      status.textContent = notice;
    } catch (error) { accountError(manifest, error, () => load()); }
  }
}

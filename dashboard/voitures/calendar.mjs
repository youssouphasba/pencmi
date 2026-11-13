// Fleet calendar of rental vehicles: accepted rentals, requests waiting, and the dates the
// owner blocks (maintenance, rented elsewhere). Blocked dates refuse new requests.
import { apiRequest, el } from '../../messaging/messaging-ui.mjs';
import { accountError } from '../../compte/account-ui.mjs';

const DAY = 86_400_000;
const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const iso = (date) => date.toISOString().slice(0, 10);
const utc = (value) => new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
const label = (date, options = { day: 'numeric', month: 'long', year: 'numeric' }) => date.toLocaleDateString('fr-FR', { timeZone: 'UTC', ...options });
const lastDay = (end) => new Date(utc(end).valueOf() - DAY);

function ensureStyles() {
  if (document.querySelector('style[data-fleet-calendar]')) return;
  document.head.append(el('style', { 'data-fleet-calendar': 'true', text: `
    .fleet-calendar{display:grid;gap:16px}
    .fleet-month{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px}
    .fleet-month>span{font-size:.75rem;text-align:center;color:var(--muted,#667)}
    .fleet-day{min-height:44px;border:1px solid var(--line,#dde);border-radius:8px;padding:4px;font-size:.85rem;background:#fff}
    .fleet-day.is-past{opacity:.45}
    .fleet-day.is-booked{background:#d9480f;color:#fff;border-color:#d9480f}
    .fleet-day.is-blocked{background:repeating-linear-gradient(45deg,#e9ecef,#e9ecef 6px,#ced4da 6px,#ced4da 12px)}
    .fleet-day.is-pending{box-shadow:inset 0 -4px 0 #f59f00}
    .fleet-legend{display:flex;flex-wrap:wrap;gap:12px;font-size:.85rem}
    .fleet-legend i{display:inline-block;width:14px;height:14px;border-radius:4px;vertical-align:-2px;margin-right:4px;border:1px solid #ced4da}
    .fleet-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
    .fleet-calendar ul{padding-left:18px}
  ` }));
}

export function mountFleetCalendar(root, { listings = [] } = {}) {
  ensureStyles();
  const rentals = listings.filter((listing) => listing.vehicleMode === 'rental');
  if (!rentals.length) {
    root.replaceChildren(el('p', { class: 'vehicle-dashboard-card', text: 'Le calendrier concerne les véhicules proposés en location. Publiez une annonce de location pour l’utiliser.' }));
    return;
  }
  const params = new URLSearchParams(window.location.search);
  const select = el('select', { 'aria-label': 'Véhicule' }, rentals.map((listing) => el('option', { value: listing.id, text: listing.title || 'Véhicule sans titre', selected: listing.id === params.get('id') })));
  let month = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const title = el('h2', { 'aria-live': 'polite' });
  const grid = el('div', { class: 'fleet-month', role: 'grid', 'aria-label': 'Jours du mois' });
  const details = el('div');
  const status = el('p', { role: 'status' });

  const startInput = el('input', { type: 'date', name: 'startDate', required: true, min: iso(new Date()) });
  const endInput = el('input', { type: 'date', name: 'endDate', required: true, min: iso(new Date()) });
  const reasonInput = el('input', { type: 'text', name: 'reason', maxLength: 200, placeholder: 'Ex. : entretien, loué hors Péncmi' });
  const form = el('form', { class: 'vehicle-dashboard-card' },
    el('h2', { text: 'Bloquer des dates' }),
    el('p', { text: 'Les dates bloquées n’acceptent plus de demande de location et apparaissent indisponibles aux clients, sans le motif.' }),
    el('label', {}, 'Du ', startInput), ' ', el('label', {}, 'Jusqu’au (inclus) ', endInput), ' ',
    el('label', {}, 'Motif (privé) ', reasonInput), ' ',
    el('button', { class: 'btn btn-primary', type: 'submit', text: 'Bloquer' }));

  const load = async (notice = '') => {
    const from = month;
    const to = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1));
    title.textContent = label(month, { month: 'long', year: 'numeric' });
    grid.replaceChildren(el('p', { text: 'Chargement…' }));
    try {
      const data = await apiRequest(`/dashboard/voitures/${encodeURIComponent(select.value)}/calendar?from=${iso(from)}&to=${iso(to)}`);
      const booked = data.rentals.filter((rental) => ['accepted', 'completed'].includes(rental.status) && rental.startDate && rental.endDate);
      const pending = data.rentals.filter((rental) => ['new', 'pending'].includes(rental.status) && rental.startDate && rental.endDate);
      const covers = (period, date) => utc(period.startDate) <= date && date < utc(period.endDate);
      const offset = (from.getUTCDay() + 6) % 7;
      const days = Math.round((to - from) / DAY);
      const todayValue = utc(iso(new Date())).valueOf();
      grid.replaceChildren(...WEEKDAYS.map((name) => el('span', { text: name, 'aria-hidden': 'true' })),
        ...Array.from({ length: offset }, () => el('div', { 'aria-hidden': 'true' })),
        ...Array.from({ length: days }, (_, index) => {
          const date = new Date(from.valueOf() + index * DAY);
          const isBooked = booked.some((period) => covers(period, date));
          const isBlocked = data.blocks.some((period) => covers(period, date));
          const isPending = pending.some((period) => covers(period, date));
          const state = isBooked ? 'loué' : isBlocked ? 'bloqué' : 'libre';
          return el('div', {
            class: `fleet-day${date.valueOf() < todayValue ? ' is-past' : ''}${isBooked ? ' is-booked' : ''}${isBlocked ? ' is-blocked' : ''}${isPending ? ' is-pending' : ''}`,
            role: 'gridcell', 'aria-label': `${label(date)} : ${state}${isPending ? ', demande en attente' : ''}`,
          }, el('span', { text: String(index + 1), 'aria-hidden': 'true' }));
        }));
      const period = (item) => `du ${label(utc(item.startDate))} au ${label(lastDay(item.endDate))}`;
      details.replaceChildren(
        el('section', { class: 'vehicle-dashboard-card' }, el('h2', { text: 'Locations acceptées ce mois' }),
          booked.length ? el('ul', {}, booked.map((rental) => el('li', { text: `${rental.clientName || 'Client'} — ${period(rental)} (retour le ${label(utc(rental.endDate))})` }))) : el('p', { text: 'Aucune.' })),
        el('section', { class: 'vehicle-dashboard-card' }, el('h2', { text: 'Demandes en attente ce mois' }),
          pending.length ? el('ul', {}, pending.map((rental) => el('li', { text: `${rental.clientName || 'Client'} — ${period(rental)}` }))) : el('p', { text: 'Aucune.' }),
          pending.length ? el('a', { class: 'btn btn-light', href: '../contacts/', text: 'Traiter les demandes' }) : null),
        el('section', { class: 'vehicle-dashboard-card' }, el('h2', { text: 'Dates bloquées' }),
          data.blocks.length ? el('ul', {}, data.blocks.map((block) => el('li', {}, `${period(block)}${block.reason ? ` — ${block.reason}` : ''} `,
            el('button', { class: 'btn btn-ghost', type: 'button', text: 'Débloquer', onClick: async (event) => {
              event.currentTarget.disabled = true;
              try { await apiRequest(`/dashboard/voitures/${encodeURIComponent(select.value)}/blocks/${encodeURIComponent(block.id)}`, { method: 'DELETE' }); await load('Dates débloquées.'); }
              catch (error) { status.textContent = error.message || 'Déblocage impossible.'; event.currentTarget.disabled = false; }
            } })))) : el('p', { text: 'Aucune.' })));
      status.textContent = notice;
    } catch (error) {
      accountError(grid, error, () => load());
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!startInput.value || !endInput.value) { status.textContent = 'Choisissez les deux dates.'; (startInput.value ? endInput : startInput).focus(); return; }
    if (endInput.value < startInput.value) { status.textContent = 'La date de fin doit suivre la date de début.'; endInput.focus(); return; }
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    try {
      await apiRequest(`/dashboard/voitures/${encodeURIComponent(select.value)}/blocks`, {
        method: 'POST', body: { startDate: startInput.value, endDate: endInput.value, reason: reasonInput.value.trim() || undefined },
      });
      month = new Date(Date.UTC(Number(startInput.value.slice(0, 4)), Number(startInput.value.slice(5, 7)) - 1, 1));
      form.reset();
      await load('Dates bloquées.');
    } catch (error) {
      status.textContent = error.message || 'Blocage impossible.';
    } finally {
      button.disabled = false;
    }
  });
  const shift = (delta) => { month = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + delta, 1)); void load(); };
  select.addEventListener('change', () => load());
  root.replaceChildren(el('div', { class: 'fleet-calendar' },
    el('div', { class: 'fleet-toolbar' }, el('label', {}, 'Véhicule ', select),
      el('button', { class: 'btn btn-light', type: 'button', text: '← Mois précédent', onClick: () => shift(-1) }),
      el('button', { class: 'btn btn-light', type: 'button', text: 'Mois suivant →', onClick: () => shift(1) })),
    title,
    el('div', { class: 'fleet-legend', 'aria-hidden': 'true' },
      el('span', {}, el('i', { style: 'background:#d9480f' }), 'Loué'),
      el('span', {}, el('i', { style: 'background:repeating-linear-gradient(45deg,#e9ecef,#e9ecef 3px,#ced4da 3px,#ced4da 6px)' }), 'Bloqué'),
      el('span', {}, el('i', { style: 'box-shadow:inset 0 -4px 0 #f59f00' }), 'Demande en attente')),
    grid, status, form, details));
  return load();
}

import { publicationOperationId } from '../publier/real-estate-api.mjs';

export const hotelRequestLabels = { new: 'Nouvelle', pending: 'En attente', accepted: 'Acceptée', refused: 'Refusée', cancelled: 'Annulée', expired: 'Expirée', completed: 'Terminée', requires_more_info: 'Informations demandées' };
export const hotelRequestActions = { pending: 'Mettre en attente', accepted: 'Accepter', refused: 'Refuser', cancelled: 'Annuler', expired: 'Marquer expirée', completed: 'Terminer', requires_more_info: 'Demander des informations' };
export function reservationToday() {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Dakar', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return ['year', 'month', 'day'].map(key => parts.find(part => part.type === key).value).join('-');
}
export function hotelStayPayload(form) {
  const data = new FormData(form);
  return { roomId: String(data.get('roomId') || ''), checkIn: String(data.get('checkIn') || ''), checkOut: String(data.get('checkOut') || ''), guests: Number(data.get('guests')), units: Number(data.get('units')) };
}
export function hotelRequestPayload(form, requestId) {
  const data = new FormData(form);
  return { ...hotelStayPayload(form), requestId, clientName: String(data.get('clientName') || '').trim(), clientPhone: String(data.get('clientPhone') || '').trim() || undefined,
    clientEmail: String(data.get('clientEmail') || '').trim() || undefined, message: String(data.get('message') || '').trim() || undefined };
}
export function hotelRequestIntent(propertyId, storage) {
  const key = `pencmi_hotel_request_${propertyId}`;
  let id;
  try { storage ??= globalThis.sessionStorage; id = storage?.getItem(key); } catch { }
  if (!/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(id || '')) id = publicationOperationId();
  try { storage.setItem(key, id); } catch { }
  return { id, clear() { try { if (storage.getItem(key) === id) storage.removeItem(key); } catch { } } };
}
export function bindHotelReservation({ root = document, property, api, formatPrice, escape, intentFactory = hotelRequestIntent }) {
  const form = root.querySelector('#hotel-reservation-form');
  if (!form) return;
  const feedback = root.querySelector('#reservation-message');
  const quoteBox = root.querySelector('#hotel-stay-quote');
  const submit = form.querySelector('[type="submit"]');
  const newRequest = root.querySelector('[data-new-hotel-request]');
  let intent = intentFactory(property.id);
  let busy = false;
  let received = false;
  let quoteVersion = 0;
  let timer;
  let controller;
  const feedbackText = (message, error = false) => { feedback.hidden = false; feedback.textContent = message; feedback.setAttribute('role', error ? 'alert' : 'status'); };
  async function refreshQuote() {
    const version = ++quoteVersion;
    controller?.abort();
    const stay = hotelStayPayload(form);
    const room = property.rooms.find(item => item.id === stay.roomId);
    const guestInput = form.elements.namedItem('guests');
    if (room?.capacity && stay.units) guestInput.max = String(room.capacity * stay.units);
    if (!stay.roomId || !stay.checkIn || !stay.checkOut || !stay.guests || !stay.units) { quoteBox.textContent = 'Choisissez une chambre et les dates pour vérifier le séjour.'; return; }
    controller = new AbortController();
    quoteBox.textContent = 'Vérification du séjour…';
    try {
      const result = await api(`/hotels/${encodeURIComponent(property.id)}/stay-quote`, { method: 'POST', signal: controller.signal, body: JSON.stringify(stay) });
      if (version !== quoteVersion) return;
      quoteBox.innerHTML = `<p>${escape(result.message)}</p><p>${result.estimatedTotal !== null && result.estimatedTotal !== undefined ? `Prix estimatif : ${escape(formatPrice(result.estimatedTotal, 'FCFA'))}` : 'Prix du séjour à confirmer.'}</p>${result.remainingUnits !== null && result.remainingUnits !== undefined ? `<p>Stock restant renseigné : ${Number(result.remainingUnits)} unité(s).</p>` : ''}`;
    } catch (error) { if (version === quoteVersion) quoteBox.textContent = error.name === 'AbortError' ? 'Vérification interrompue.' : error.message || 'Disponibilité et prix à confirmer.'; }
  }
  form.addEventListener('input', event => {
    if (['roomId', 'checkIn', 'checkOut', 'guests', 'units'].includes(event.target.name)) { quoteVersion++; controller?.abort(); clearTimeout(timer); timer = setTimeout(refreshQuote, 250); }
  });
  root.querySelectorAll('[data-open-reservation]').forEach(button => button.addEventListener('click', () => {
    const modal = root.querySelector('#reservation-modal'); modal.classList.add('is-open'); modal.setAttribute('aria-hidden', 'false');
    const roomId = button.dataset.roomId;
    if (!received && !busy && roomId) form.elements.namedItem('roomId').value = roomId;
    void refreshQuote();
  }));
  const close = () => { const modal = root.querySelector('#reservation-modal'); modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true'); };
  root.querySelector('[data-close-modal]')?.addEventListener('click', close);
  root.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  newRequest?.addEventListener('click', () => { intent.clear(); intent = intentFactory(property.id); received = false; submit.disabled = false; feedback.hidden = true; newRequest.hidden = true; });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || received || !form.reportValidity()) return;
    const payload = hotelRequestPayload(form, intent.id);
    if (!payload.clientPhone && !payload.clientEmail) { feedbackText('Renseignez au moins un téléphone ou un email pour recevoir une réponse.', true); return; }
    busy = true; submit.disabled = true; feedbackText('Envoi de votre demande…');
    const controls = [...form.querySelectorAll('input, select, textarea')];
    controls.forEach(control => { control.disabled = true; });
    const sendController = new AbortController();
    const timeout = setTimeout(() => sendController.abort(), 60000);
    try {
      const receipt = await api(`/hotels/${encodeURIComponent(property.id)}/reservation-requests`, { method: 'POST', signal: sendController.signal, body: JSON.stringify(payload) });
      if (!receipt?.received || !receipt.id) throw new Error('La réception de votre demande n’a pas été confirmée. Réessayez sans fermer le formulaire.');
      received = true; intent.clear(); feedbackText('Votre demande a été reçue. Ce n’est pas une confirmation de séjour : l’établissement doit encore l’accepter.');
      if (newRequest) newRequest.hidden = false;
    } catch (error) { feedbackText(error.name === 'AbortError' ? 'La réception reste à vérifier. Vos informations sont conservées ; réessayez avec cette même demande.' : error.message || 'L’envoi a échoué. Vos informations sont conservées.', true); }
    finally { clearTimeout(timeout); busy = false; controls.forEach(control => { control.disabled = false; }); submit.disabled = received; }
  });
}

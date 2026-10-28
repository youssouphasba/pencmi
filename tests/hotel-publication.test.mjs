import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyHotelDraft, hotelPayload, hotelFromServer, hotelFieldStep, escapeHotel, hotelCatalog } from '../publier/hotel-publication.mjs';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('hotel wizard retains thirteen steps and only manual management', () => {
  assert.equal(hotelCatalog.steps.length, 13);
  assert.equal(emptyHotelDraft().metadata.management.mode, 'manual');
});
test('publication payload excludes server fields and external inventory', () => {
  const draft = { ...emptyHotelDraft(), ownerUserId: 'injected', status: 'active', rooms: [{ id: 'room' }] };
  assert.equal(hotelPayload(draft).ownerUserId, undefined);
  assert.equal(hotelPayload(draft).status, undefined);
  assert.equal(hotelPayload(draft, true).rooms, undefined);
});
test('persisted hotel data and stable rooms rehydrate', () => {
  const room = { id: 'room', name: 'Double', calendar: [{ start: '2026-11-01', available: 0, status: 'maintenance' }] };
  const draft = hotelFromServer({ name: 'Hôtel', city: 'Dakar', metadata: { publication: { general: { checkInTime: '14:00' }, amenities: ['Wi-Fi'] } }, rooms: [room] });
  assert.equal(draft.rooms[0].id, 'room');
  assert.equal(draft.metadata.general.checkInTime, '14:00');
  assert.equal(draft.rooms[0].calendar[0].available, 0);
  assert.deepEqual(hotelPayload(draft).metadata.amenities, ['Wi-Fi']);
});
test('errors navigate to the correct step', () => {
  assert.equal(hotelFieldStep('rooms.0.calendar.0.available'), 8);
  assert.equal(hotelFieldStep('rooms.0.basePrice'), 4);
  assert.equal(hotelFieldStep('metadata.contactPreferences.contactEmail'), 10);
});
test('preview and form values escape HTML and attribute injection', () => {
  assert.equal(escapeHotel('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});
test('homepage includes hotels without photos and preserves real photos', async () => {
  const context = vm.createContext({ window: { location: { protocol: 'http:', search: '' } }, document: { addEventListener() {} }, URLSearchParams, Intl, console });
  vm.runInContext(await readFile(new URL('../app.js', import.meta.url), 'utf8'), context);
  const hotel = { id: 'hotel-test', name: 'Hôtel <b>texte</b>', city: 'Dakar', propertyType: 'hotel', metadata: { photos: [], nightlyPrice: 0 } };
  const mapped = context.mapHomeHotelListing(hotel);
  assert.ok(mapped);
  assert.equal(mapped.image, '');
  const html = context.HotelCard(mapped);
  assert.match(html, /Aucune photo disponible/);
  assert.doesNotMatch(html, /<b>/);
  hotel.metadata.photos = ['https://example.test/photo.jpg'];
  assert.equal(context.mapHomeHotelListing(hotel).image, hotel.metadata.photos[0]);
});

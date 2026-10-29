import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import {
  emptyVehicleDraft,
  vehicleDraftFromListing,
  vehicleFieldStep,
  vehicleSteps,
} from '../publier/vehicle-publication.mjs';
import {
  vehicleEscape,
  vehiclePrice,
  vehicleSafeUrl,
} from '../voitures/vehicle-content.mjs';

test('vehicle photos resolve relative API paths against the backend and reject unsafe protocols', () => {
  const previous = globalThis.PencmiRuntimeConfig;
  globalThis.PencmiRuntimeConfig = {
    apiBaseUrl: 'https://backend.example.test/api/v1',
  };
  try {
    assert.equal(
      vehicleSafeUrl('/api/v1/files/public/photo'),
      'https://backend.example.test/api/v1/files/public/photo',
    );
    assert.equal(vehicleSafeUrl('javascript:alert(1)'), '');
    assert.equal(vehicleSafeUrl(''), '');
  } finally {
    if (previous === undefined) delete globalThis.PencmiRuntimeConfig;
    else globalThis.PencmiRuntimeConfig = previous;
  }
});

test('vehicle wizard preserves twelve steps and all mode prices on rehydration', () => {
  assert.equal(vehicleSteps.length, 12);
  const draft = vehicleDraftFromListing({
    vehicleMode: 'rental',
    title: 'Titre',
    publication: {
      pricing: { price: 9000000, pricePerDay: 25000, pricePerTrip: 20000 },
      contactPreferences: { phoneEnabled: true },
    },
  });
  assert.equal(draft.metadata.pricing.price, 9000000);
  assert.equal(draft.metadata.pricing.pricePerDay, 25000);
  assert.equal(draft.metadata.contactPreferences.phoneEnabled, true);
  assert.equal(
    emptyVehicleDraft().metadata.contactPreferences.contactFormEnabled,
    true,
  );
});
test('vehicle prices distinguish total, daily, trip and service', () => {
  assert.match(
    vehiclePrice({ vehicleMode: 'rental', price: 25000 }),
    /FCFA \/ jour$/,
  );
  assert.match(
    vehiclePrice({
      vehicleMode: 'chauffeur',
      price: 25000,
      metadata: { chauffeurPriceUnit: 'service' },
    }),
    /FCFA \/ service$/,
  );
  assert.doesNotMatch(
    vehiclePrice({ vehicleMode: 'sale', price: 25000 }),
    /jour|trajet|service/,
  );
  assert.equal(
    vehiclePrice({ vehicleMode: 'sale', price: null }),
    'Prix non renseigné',
  );
});
test('vehicle error locations and HTML escaping are stable', () => {
  assert.equal(vehicleFieldStep('metadata.pricing.pricePerDay'), 4);
  assert.equal(vehicleFieldStep('metadata.contactPreferences.phoneNumber'), 9);
  assert.equal(vehicleFieldStep('description'), 8);
  assert.equal(
    vehicleEscape('<img onerror="x">'),
    '&lt;img onerror=&quot;x&quot;&gt;',
  );
});
test('homepage includes vehicles without photos, preserves images and escapes titles', async () => {
  const context = vm.createContext({
    window: { location: { protocol: 'http:', search: '' } },
    document: { addEventListener() {} },
    URLSearchParams,
    Intl,
    console,
  });
  vm.runInContext(
    await readFile(new URL('../app.js', import.meta.url), 'utf8'),
    context,
  );
  const vehicle = {
    id: 'vehicle-test',
    title: 'Voiture <script>test</script>',
    vehicleMode: 'rental',
    city: 'Dakar',
    price: 25000,
    metadata: { photos: [] },
  };
  const mapped = context.mapHomeVehicleListing(vehicle);
  assert.ok(mapped);
  assert.equal(mapped.image, '');
  assert.match(mapped.price, /jour/);
  const html = context.VehicleCard(mapped);
  assert.match(html, /Aucune photo disponible/);
  assert.doesNotMatch(html, /<script>/);
  vehicle.metadata.photos = ['https://example.test/car.jpg'];
  assert.equal(
    context.mapHomeVehicleListing(vehicle).image,
    vehicle.metadata.photos[0],
  );
});

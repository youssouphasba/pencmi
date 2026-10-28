import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { fieldLocation, getPublicationApiBase, publicationFromListing, publicationOperationId, publicationPayload } from '../publier/real-estate-api.mjs';

const defaults = () => ({ content: {}, location: { country: 'SN' }, pricing: { currency: 'FCFA', pricePeriod: 'month' },
  features: {}, conditions: {}, documents: [{ type: 'bail', label: 'Bail', available: false }], contactPreferences: {} });

test('owner payload roundtrip preserves all sections without client-only or administrative fields', () => {
  const saved = { id: 'a', title: 'Appartement à Dakar', description: 'Description', transaction: 'location', propertyType: 'appartement',
    city: 'Dakar', neighborhood: 'Yoff', price: 200000, status: 'pending_review', photos: [{ id: 'photo-a', url: '/files/photo-a' }],
    metadata: { publication: { location: { country: 'SN', city: 'Dakar', district: 'Yoff', region: 'Dakar' },
      pricing: { price: 200000, currency: 'FCFA', negotiable: true }, features: { surface: 80, furnished: true },
      conditions: { deposit: 100000 }, documents: [{ type: 'bail', available: true }], contactPreferences: { internalMessagingEnabled: true } } } };
  const form = publicationFromListing(saved, defaults());
  form.completionScore = 100;
  const payload = publicationPayload(form);
  assert.equal(payload.title, saved.title);
  assert.deepEqual(JSON.parse(JSON.stringify(payload.metadata)), { ...saved.metadata.publication,
    pricing: { pricePeriod: 'month', ...saved.metadata.publication.pricing } });
  assert.equal(payload.status, undefined);
  assert.equal(payload.completionScore, undefined);
  assert.equal(payload.metadata.documents[0].label, undefined);
  assert.equal(form.photos[0].id, 'photo-a');
});

test('legacy listing values are retained and external photos are not treated as uploaded assets', () => {
  const form = publicationFromListing({ title: 'Ancienne annonce', city: 'Dakar', price: 100, metadata: { region: 'Dakar', surface: 40, photos: ['https://example.test/photo.jpg'] } }, defaults());
  assert.equal(form.pricing.price, 100);
  assert.equal(form.features.surface, 40);
  assert.equal(form.photos.length, 0);
  assert.equal(form.legacyPhotos.length, 1);
});

test('server validation paths identify the corresponding step and field', () => {
  assert.deepEqual(fieldLocation('metadata.pricing.price'), { step: 3, path: 'pricing.price' });
  assert.deepEqual(fieldLocation('description'), { step: 6, path: 'content.description' });
  assert.equal(fieldLocation('photos').step, 5);
  assert.equal(fieldLocation('metadata.contactPreferences.notificationEmail').step, 9);
});

test('operation IDs remain cryptographically random on a phone over local HTTP', () => {
  const provider = { getRandomValues: values => webcrypto.getRandomValues(values) };
  const a = publicationOperationId(provider), b = publicationOperationId(provider);
  assert.match(a, /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/);
  assert.notEqual(a, b);
});

test('API URL uses existing runtime configuration rather than a fixed backend host', () => {
  const platform = { document: { body: { dataset: {} } }, PencmiConfig: { apiBaseUrl: 'https://api.example.test/api/v1/' },
    localStorage: { getItem: () => null }, location: { hostname: 'example.test', origin: 'https://example.test' } };
  assert.equal(getPublicationApiBase(platform), 'https://api.example.test/api/v1');
  delete platform.PencmiConfig;
  assert.equal(getPublicationApiBase(platform), 'https://example.test/api/v1');
  platform.location.hostname = '192.168.1.10';
  assert.equal(getPublicationApiBase(platform), '');
});

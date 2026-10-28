import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function frontend(path) {
  const context = vm.createContext({ window: { location: { protocol: 'http:', search: '' } },
    document: { addEventListener() {} }, URLSearchParams, Intl, console });
  vm.runInContext(await readFile(new URL(path, import.meta.url), 'utf8'), context);
  return context;
}

const listing = (metadata = {}) => ({ id: 'listing-test', status: 'active', title: 'Appartement à Dakar',
  city: 'Dakar', neighborhood: 'Yoff', price: 200000, metadata });

test('homepage keeps active listings without photos and provides a linked neutral placeholder', async () => {
  const app = await frontend('../app.js');
  const mapped = app.mapHomeRealEstateListing(listing());
  assert.ok(mapped);
  assert.equal(mapped.image, '');
  const html = app.RealEstateCard(mapped);
  assert.match(html, /Aucune photo disponible/);
  assert.match(html, /href="\/immobilier\/annonce\/listing-test"/);
  assert.doesNotMatch(html, /<img/);
});

test('homepage preserves actual cover photos and photo arrays', async () => {
  const app = await frontend('../app.js');
  for (const metadata of [{ coverPhoto: 'https://example.test/cover.jpg' }, { photos: ['https://example.test/photo.jpg'] }]) {
    const mapped = app.mapHomeRealEstateListing(listing(metadata));
    assert.equal(mapped.image, metadata.coverPhoto || metadata.photos[0]);
    assert.match(app.RealEstateCard(mapped), /<img/);
    assert.doesNotMatch(app.RealEstateCard(mapped), /real-estate-photo-placeholder/);
  }
});

test('real estate results display listings with and without images', async () => {
  const app = await frontend('../immobilier/immobilier.js');
  assert.match(app.RealEstateListingCard(app.mapListing(listing())), /Aucune photo disponible/);
  assert.match(app.RealEstateListingCard(app.mapListing(listing({ photos: ['https://example.test/photo.jpg'] }))), /src="https:\/\/example.test\/photo.jpg"/);
});

test('detail page preserves cover-only images and uses a placeholder when genuinely empty', async () => {
  const app = await frontend('../immobilier/annonce/detail.js');
  assert.match(app.RealEstatePhotoGallery(app.mapListing(listing())), /Aucune photo disponible/);
  for (const metadata of [{ coverPhoto: 'https://example.test/cover.jpg' }, { photos: ['https://example.test/photo.jpg'] }]) {
    const mapped = app.mapListing(listing(metadata));
    assert.equal(mapped.photos.length, 1);
    assert.match(app.RealEstatePhotoGallery(mapped), /gallery-main-image/);
    assert.doesNotMatch(app.RealEstatePhotoGallery(mapped), /Aucune photo disponible/);
  }
});

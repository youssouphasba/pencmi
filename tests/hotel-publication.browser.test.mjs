import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { join, resolve, sep } from 'node:path';
import { createRequire } from 'node:module';

test('hotel wizard: thirteen steps, persistence, recovery, network errors and responsive layouts', { skip: !process.env.PENCMI_PLAYWRIGHT_MODULE, timeout: 120000 }, async () => {
  const { chromium } = await import(pathToFileURL(process.env.PENCMI_PLAYWRIGHT_MODULE).href);
  const root = resolve(import.meta.dirname, '..');
  const require = createRequire(new URL('../backend/package.json', import.meta.url));
  const multer = require('multer');
  const sharp = require('sharp');
  const upload = multer({ storage: multer.memoryStorage() }).single('photo');
  const image = await sharp({ create: { width: 20, height: 16, channels: 3, background: '#268d6e' } }).png().toBuffer();
  const images = new Map();
  let origin;
  let property;
  let failNext = false;
  let creates = 0;
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/config/runtime-config.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(`window.PencmiRuntimeConfig={apiBaseUrl:${JSON.stringify(`${origin}/api/v1`)}};`); }
      if (url.pathname.startsWith('/api/v1/')) {
        if (req.method === 'GET' && (url.pathname === '/api/v1/hotels' || url.pathname.startsWith('/api/v1/hotels/'))) {
          const fixture = { id: 'public-hotel', name: 'Hôtel <b>sans HTML</b>', propertyType: 'hotel', city: 'Dakar', status: 'active', description: 'Description publique',
            metadata: { photos: [], priceFrom: 25000, amenities: ['Wi-Fi'], conditions: ['Paiement sur place'] },
            rooms: [{ id: 'public-room', name: 'Chambre double', capacity: 2, basePrice: 25000, currency: 'FCFA', rates: [{ date: '2026-11-01T00:00:00.000Z', price: 30000, currency: 'FCFA' }], availability: [{ date: '2026-11-02T00:00:00.000Z', status: 'maintenance', available: 0, stopSell: true }] }] };
          res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ success: true, data: url.pathname === '/api/v1/hotels' ? [fixture] : fixture }));
        }
        if (failNext) { failNext = false; res.writeHead(503, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: { message: 'Connexion interrompue.' } })); }
        if (url.pathname.startsWith('/api/v1/files/')) {
          const id = url.pathname.split('/')[4];
          res.setHeader('Content-Type', 'image/png'); return res.end(images.get(id) || image);
        }
        if (req.method === 'POST' && url.pathname.endsWith('/photos')) {
          await new Promise((resolve, reject) => upload(req, res, error => error ? reject(error) : resolve()));
          assert.equal(req.file.mimetype, 'image/png');
          assert.ok(req.file.buffer.equals(image));
          const id = req.body.uploadId;
          images.set(id, req.file.buffer);
          const photo = { id, url: `${origin}/api/v1/files/${id}/content`, managed: true };
          const previous = property.photos.findIndex(item => item.id === req.body.replacePhotoId);
          if (previous >= 0) property.photos.splice(previous, 1, photo); else property.photos.push(photo);
          res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ success: true, data: property }));
        }
        if (req.method === 'DELETE' && url.pathname.includes('/photos/')) property.photos = property.photos.filter(photo => !url.pathname.endsWith(photo.id));
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        const body = Buffer.concat(chunks).toString();
        if (req.method === 'POST' && url.pathname === '/api/v1/dashboard/hotels') { creates++; property = { id: 'persisted-hotel', status: 'draft', photos: [], externalInventory: false }; }
        if (body && ['POST', 'PATCH'].includes(req.method)) {
          const input = JSON.parse(body);
          if (input.photoIds) property.photos = input.photoIds.map(id => property.photos.find(photo => photo.id === id));
          else property = { ...property, ...input, metadata: { publication: input.metadata || property?.metadata?.publication }, rooms: (input.rooms || property?.rooms || []).filter(room => !room.remove).map((room, i) => { const { clientId, ...data } = room; return { ...data, id: room.id || `room-${i}` }; }) };
        }
        if (url.pathname.endsWith('/submit')) property.status = 'pending_review';
        res.setHeader('Content-Type', 'application/json'); return res.end(JSON.stringify({ success: true, data: url.pathname.startsWith('/api/v1/dashboard/hotels') ? property || [] : [] }));
      }
      const relative = url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname;
      const path = resolve(root, `.${decodeURIComponent(relative)}`);
      if (!path.startsWith(`${root}${sep}`) || !/\.(?:html|m?js|css|jpeg|png)$/.test(path) || path.includes(`${sep}backend${sep}`)) { res.writeHead(404); return res.end(); }
      const bytes = await readFile(path);
      res.setHeader('Content-Type', /\.m?js$/.test(path) ? 'text/javascript; charset=utf-8' : path.endsWith('.css') ? 'text/css' : path.endsWith('.html') ? 'text/html; charset=utf-8' : 'image/jpeg'); res.end(bytes);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    for (const width of [360, 390, 768, 1280]) {
      property = undefined; creates = 0;
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const pageErrors = [];
      page.on('pageerror', error => pageErrors.push(error.message));
      page.on('dialog', dialog => dialog.accept());
      await page.addInitScript(() => localStorage.setItem('pencmi_access_token', 'test-token'));
      await page.goto(`${origin}/publier/?category=hotel`);
      await page.locator('[data-hotel-field="propertyType"][value="hotel"]').check();
      await page.locator('[data-next-hotel]').click();
      await page.locator('[data-hotel-field="name"]').fill('Hôtel <script>window.xss=1</script>');
      await page.locator('[data-hotel-field="description"]').fill('Description conservée');
      await page.locator('[data-save-hotel]').click();
      await page.getByText('Brouillon enregistré.', { exact: true }).waitFor();
      assert.equal(creates, 1);
      await page.locator('[data-hotel-step="3"]').click();
      await page.locator('[data-add-room]').click();
      await page.locator('[data-hotel-field="rooms.0.name"]').fill('Double');
      await page.locator('[data-hotel-field="rooms.0.capacity"]').fill('2');
      await page.locator('[data-hotel-field="rooms.0.totalUnits"]').fill('4');
      await page.locator('[data-hotel-field="rooms.0.adults"]').fill('2');
      await page.locator('[data-hotel-field="rooms.0.beds"]').fill('1');
      await page.locator('[data-add-room]').click();
      await page.locator('[data-hotel-field="rooms.1.name"]').fill('Familiale');
      await page.locator('[data-hotel-field="rooms.1.capacity"]').fill('4');
      await page.locator('[data-hotel-field="rooms.1.adults"]').fill('4');
      await page.locator('[data-hotel-field="rooms.1.beds"]').fill('2');
      await page.locator('[data-hotel-field="rooms.1.totalUnits"]').fill('2');
      await page.locator('[data-hotel-step="4"]').click();
      await page.locator('[data-hotel-field="rooms.0.basePrice"]').fill('25000');
      await page.locator('[data-hotel-field="rooms.1.basePrice"]').fill('40000');
      await page.locator('[data-add-period="0:rates"]').click();
      await page.locator('[data-hotel-field="rooms.0.rates.0.start"]').fill('2026-11-01');
      await page.locator('[data-hotel-field="rooms.0.rates.0.end"]').fill('2026-11-03');
      await page.locator('[data-hotel-field="rooms.0.rates.0.price"]').fill('30000');
      await page.locator('[data-hotel-step="8"]').click();
      await page.locator('[data-add-period="0:calendar"]').click();
      await page.locator('[data-hotel-field="rooms.0.calendar.0.start"]').fill('2026-11-01');
      await page.locator('[data-hotel-field="rooms.0.calendar.0.end"]').fill('2026-11-03');
      await page.locator('[data-hotel-field="rooms.0.calendar.0.status"]').selectOption('maintenance');
      await page.locator('[data-hotel-step="2"]').click();
      await page.locator('[data-hotel-field="city"]').fill('Dakar');
      await page.locator('[data-hotel-step="10"]').click();
      await page.locator('[data-hotel-field="metadata.contactPreferences.reservationRequestEnabled"]').check();
      await page.locator('[data-save-hotel]').click();
      await page.getByText('Brouillon enregistré.', { exact: true }).waitFor();
      await page.reload();
      await page.locator('[data-hotel-step="3"]').first().click();
      assert.equal(await page.locator('[data-hotel-field="rooms.0.name"]').inputValue(), 'Double');
      assert.equal(property.rooms[0].rates[0].price, 30000);
      assert.equal(property.rooms[0].calendar[0].status, 'maintenance');
      await page.locator('[data-hotel-step="5"]').click();
      await page.locator('[data-hotel-photos]').setInputFiles([{ name: 'photo.png', mimeType: 'image/png', buffer: image }, { name: 'second.png', mimeType: 'image/png', buffer: image }]);
      await page.getByText('Photos enregistrées.', { exact: true }).waitFor();
      assert.equal(property.photos.length, 2);
      await page.waitForFunction(() => [...document.querySelectorAll('[data-photo-preview]')].every(img => img.naturalWidth > 0));
      const firstPhoto = property.photos[0].id;
      await page.locator('[data-move-photo="1:-1"]').click();
      await page.waitForFunction(id => document.querySelector('[data-photo-preview]')?.dataset.photoPreview !== id, firstPhoto);
      await page.locator('figure input[type="file"]').first().setInputFiles({ name: 'replacement.png', mimeType: 'image/png', buffer: image });
      await page.getByText('Photos enregistrées.', { exact: true }).waitFor();
      assert.equal(property.photos.length, 2);
      await page.locator('[data-delete-photo]').first().click();
      await page.waitForFunction(() => document.querySelectorAll('[data-photo-preview]').length === 1);
      assert.equal(property.photos.length, 1);
      for (let step = 0; step < 13; step++) {
        await page.locator(`[data-hotel-step="${step}"]`).first().click();
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        assert.equal(overflow, false, `overflow at width ${width}, step ${step}`);
      }
      await page.locator('[data-hotel-step="1"]').click();
      await page.locator('[data-hotel-field="name"]').fill('Nom préservé après échec');
      failNext = true;
      await page.locator('[data-save-hotel]').click();
      await page.getByText('Connexion interrompue.', { exact: true }).waitFor();
      assert.equal(await page.locator('[data-hotel-field="name"]').inputValue(), 'Nom préservé après échec');
      assert.equal(await page.getByText('Brouillon enregistré.', { exact: true }).count(), 0);
      await page.locator('[data-save-hotel]').click();
      await page.getByText('Brouillon enregistré.', { exact: true }).waitFor();
      await page.locator('[data-hotel-step="12"]').click();
      await page.locator('[data-submit-hotel]').click();
      await page.getByText('Votre hébergement a été soumis avec succès.', { exact: true }).waitFor();
      assert.equal(property.status, 'pending_review');
      assert.equal(creates, 1);
      assert.equal(await page.evaluate(() => window.xss), undefined);
      assert.deepEqual(pageErrors, []);
      if (process.env.PENCMI_PUBLICATION_SCREENSHOT_DIRECTORY) {
        await page.locator('[data-hotel-step="3"]').click();
        await mkdir(process.env.PENCMI_PUBLICATION_SCREENSHOT_DIRECTORY, { recursive: true });
        await page.screenshot({ path: join(process.env.PENCMI_PUBLICATION_SCREENSHOT_DIRECTORY, `hotel-publication-${width}.png`), fullPage: true });
      }
      await page.goto(`${origin}/hotels/`);
      await page.getByRole('heading', { name: 'Hôtel <b>sans HTML</b>', exact: true }).waitFor();
      assert.equal(await page.locator('h3 b').count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      await page.goto(`${origin}/hotels/detail/?id=public-hotel`);
      await page.getByRole('heading', { level: 1, name: 'Hôtel <b>sans HTML</b>', exact: true }).waitFor();
      await page.locator('.hotel-photo-placeholder').waitFor();
      await page.getByRole('heading', { name: 'Chambre double', exact: true }).waitFor();
      await page.getByText('Calendrier renseigné', { exact: true }).click();
      await page.getByText(/Maintenance/).waitFor();
      assert.equal(await page.locator('h1 b').count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      assert.deepEqual(pageErrors, []);
      await page.close();
    }
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
});

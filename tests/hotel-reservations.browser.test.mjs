import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve, sep } from 'node:path';

test('hotel requests and owner actions on mobile and desktop', { skip: !process.env.PENCMI_PLAYWRIGHT_MODULE, timeout: 120000 }, async () => {
  const { chromium } = await import(pathToFileURL(process.env.PENCMI_PLAYWRIGHT_MODULE).href);
  const root = resolve(import.meta.dirname, '..');
  let origin;
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/config/runtime-config.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(`window.PencmiRuntimeConfig={apiBaseUrl:${JSON.stringify(`${origin}/api/v1`)}};`); }
      const file = resolve(root, '.' + decodeURIComponent(url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname));
      if (!file.startsWith(root + sep) || !/\.(html|m?js|css|jpeg|png)$/.test(file) || file.includes(sep + 'backend' + sep)) { res.writeHead(404); return res.end(); }
      const data = await readFile(file);
      res.setHeader('Content-Type', /\.m?js$/.test(file) ? 'text/javascript; charset=utf-8' : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html; charset=utf-8' : 'image/jpeg');
      res.end(data);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    for (const width of [360, 390, 768, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const property = { id: 'hotel', name: 'Hôtel', status: 'active', city: 'Dakar', propertyType: 'hotel', metadata: { photos: [], amenities: [], conditions: [] },
        rooms: [{ id: 'room', name: 'Double', capacity: 2, basePrice: 10000, rates: [], availability: [] }] };
      const requests = [];
      let failure = true;
      let actionFailure = true;
      let ownerRequest = { id: 'request', clientName: '<img src=x onerror="window.xss=1">', clientEmail: 'client@example.test', property: { id: 'hotel', name: 'Hôtel' }, room: { id: 'room', name: 'Double' },
        checkIn: '2030-06-01', checkOut: '2030-06-03', units: 1, guests: 2, status: 'new', createdAt: '2030-05-30', message: '<script>window.xss=1</script>',
        confirmation: { canConfirm: true, confirmed: false, message: 'Stock renseigné.', remainingUnits: 1 }, allowedActions: ['accepted', 'refused', 'requires_more_info'], events: [] };
      await page.addInitScript(base => { localStorage.setItem('pencmi_api_base_url', base); localStorage.setItem('pencmi_access_token', 'test-token'); }, `${origin}/api/v1`);
      await page.route('**/api/v1/**', async route => {
        const req = route.request(); const url = new URL(req.url());
        const send = (data, status = 200, meta) => route.fulfill({ status, json: status < 400 ? { success: true, data, meta } : { success: false, error: { message: data } } });
        if (url.pathname.endsWith('/stay-quote')) return send({ message: 'Stock renseigné, sous réserve de confirmation.', remainingUnits: 1, estimatedTotal: 20000, status: 'on_request' });
        if (url.pathname.endsWith('/reservation-requests')) {
          requests.push(req.postDataJSON());
          if (failure) { failure = false; return send('Connexion interrompue.', 503); }
          return send({ id: 'request', received: true, status: 'new' }, 201);
        }
        if (url.pathname.endsWith('/status')) {
          if (actionFailure) { actionFailure = false; return send('Le stock restant ne couvre pas cette demande.', 409); }
          const status = req.postDataJSON().status;
          ownerRequest = { ...ownerRequest, status, confirmation: { confirmed: status === 'accepted', remainingUnits: status === 'accepted' ? 0 : 1 }, allowedActions: status === 'accepted' ? ['cancelled'] : [] };
          return send(ownerRequest);
        }
        if (url.pathname === '/api/v1/dashboard/hotels/reservations') {
          const page = Number(url.searchParams.get('page') || 1);
          return send([page === 1 ? ownerRequest : { ...ownerRequest, id: 'historical', clientName: 'Autre demande', allowedActions: [] }], 200, { page, total: 21, limit: 20, totalPages: 2 });
        }
        if (url.pathname === '/api/v1/dashboard/hotels') return send([property]);
        if (url.pathname === '/api/v1/hotels/hotel') return send(property);
        return send([]);
      });
      await page.goto(`${origin}/hotels/detail/?id=hotel`);
      await page.locator('[data-open-reservation]').first().click();
      const form = page.locator('#hotel-reservation-form');
      await form.locator('[name=roomId]').selectOption('room');
      await form.locator('[name=clientName]').fill('Client');
      await form.locator('[name=clientEmail]').fill('client@example.test');
      await form.locator('[name=checkIn]').fill('2030-06-01');
      await form.locator('[name=checkOut]').fill('2030-06-03');
      await form.locator('[name=guests]').fill('2');
      await form.locator('[name=units]').fill('1');
      await page.waitForFunction(() => document.querySelector('#hotel-stay-quote').textContent.includes('20'));
      await form.locator('[type=submit]').click();
      await page.waitForFunction(() => document.querySelector('#reservation-message').textContent.includes('Connexion interrompue'));
      assert.equal(await form.locator('[name=clientEmail]').inputValue(), 'client@example.test');
      await form.locator('[type=submit]').click();
      await page.waitForFunction(() => document.querySelector('#reservation-message').textContent.includes('Ce n’est pas une confirmation'));
      assert.equal(requests.length, 2);
      assert.equal(requests[0].requestId, requests[1].requestId);
      assert.equal(requests[1].roomId, 'room');
      assert.equal(await form.locator('[type=submit]').isDisabled(), true);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#reservation-modal').getAttribute('aria-hidden'), 'true');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.goto(`${origin}/dashboard/hotels/reservations/`);
      await page.locator('[data-reservation-status=accepted]').waitFor();
      await page.getByRole('button', { name: 'Suivant', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('tbody').textContent.includes('Autre demande'));
      await page.getByRole('button', { name: 'Précédent', exact: true }).click();
      await page.locator('[data-reservation-status=accepted]').waitFor();
      assert.equal(await page.evaluate(() => window.xss), undefined);
      await page.locator('[data-reservation-note]').fill('Vérification du stock');
      await page.locator('[data-reservation-status=accepted]').click();
      await page.waitForFunction(() => document.querySelector('[data-reservation-feedback]').textContent.includes('stock restant'));
      assert.ok(await page.locator('tbody').innerText().then(text => text.includes('Nouvelle')));
      assert.equal(await page.locator('[data-reservation-note]').inputValue(), 'Vérification du stock');
      await page.locator('[data-reservation-status=accepted]').click();
      await page.locator('[data-reservation-status=cancelled]').waitFor();
      assert.ok((await page.locator('tbody').innerText()).includes('Stock alloué'));
      await page.locator('[data-reservation-status=cancelled]').click();
      await page.waitForFunction(() => document.querySelector('tbody').textContent.includes('Annulée'));
      assert.equal(await page.locator('[data-reservation-status]').count(), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser?.close(); await new Promise(done => server.close(done)); }
});

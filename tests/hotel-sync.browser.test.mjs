import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve, sep } from 'node:path';

async function staticServer() {
  const root = resolve(import.meta.dirname, '..');
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const file = resolve(root, '.' + decodeURIComponent(url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname));
      if (!file.startsWith(root + sep) || !/\.(html|m?js|css)$/.test(file) || file.includes(sep + 'backend' + sep)) { res.writeHead(404); return res.end(); }
      const data = await readFile(file);
      res.setHeader('Content-Type', /\.m?js$/.test(file) ? 'text/javascript; charset=utf-8' : file.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8');
      res.end(data);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

test('hotelier connects calendars and a channel manager on mobile and desktop', { skip: !process.env.PENCMI_PLAYWRIGHT_MODULE, timeout: 120000 }, async () => {
  const { chromium } = await import(pathToFileURL(process.env.PENCMI_PLAYWRIGHT_MODULE).href);
  const { server, origin } = await staticServer();
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    for (const width of [360, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const calls = [];
      const view = {
        mode: 'none', autoConfirm: false, hotelCode: null, channelPartner: null, lastSyncAt: null,
        partners: [{ code: 'acme', name: 'Acme Channel' }], icalFreshnessHours: 3, icalRefreshMinutes: 15, pendingChannelEvents: 0,
        rooms: [{ id: 'room1', roomCode: 'room1', name: '<b>Double</b>', status: 'active', capacity: 2, totalUnits: 3, icalExportPath: null, icalExportUrl: null, imports: [] }],
      };
      await page.addInitScript(base => { localStorage.setItem('pencmi_api_base_url', base); localStorage.setItem('pencmi_access_token', 'test-token'); }, `${origin}/api/v1`);
      await page.route('**/api/v1/**', async route => {
        const req = route.request(); const url = new URL(req.url()); const path = url.pathname.replace('/api/v1', '');
        const send = (data, status = 200) => route.fulfill({ status, json: status < 400 ? { success: true, data } : { success: false, error: { message: data } } });
        calls.push(`${req.method()} ${path}`);
        if (path === '/dashboard/hotels') return send([{ id: 'hotel', name: 'Hôtel Teranga' }]);
        const base = '/dashboard/hotels/integrations/hotel/sync';
        if (path === base && req.method() === 'GET') return send(view);
        if (path === base && req.method() === 'PUT') {
          const body = req.postDataJSON();
          Object.assign(view, { mode: body.mode, autoConfirm: body.autoConfirm });
          if (body.mode === 'channel_manager') Object.assign(view, { hotelCode: 'PCM0011223344', channelPartner: { code: body.partnerCode, name: 'Acme Channel' } });
          return send(view);
        }
        if (path === `${base}/rooms/room1/ical-export`) {
          view.rooms[0].icalExportPath = '/api/v1/hotel-calendars/abcdefabcdefabcdefabcdefabcdefab.ics';
          return send({});
        }
        if (path === `${base}/rooms/room1/ical-imports`) {
          const body = req.postDataJSON();
          if (body.url.includes('broken')) return send('Le lien du calendrier doit pointer vers un site public.', 400);
          const entry = { id: 'imp1', url: body.url, unitsPerEvent: body.unitsPerEvent, active: true, lastAttemptAt: new Date().toISOString(), lastSuccessAt: new Date().toISOString(), lastError: null, blockedNights: 4 };
          view.rooms[0].imports.push(entry);
          return send(entry, 201);
        }
        return send([]);
      });
      page.on('dialog', dialog => dialog.accept());
      await page.goto(`${origin}/dashboard/hotels/integration/sync-settings/`);
      await page.waitForSelector('form[data-action="save-settings"]');
      assert.equal(await page.locator('[data-partner-field]').isHidden(), true);

      await page.check('input[name="mode"][value="ical"]');
      await page.check('input[name="autoConfirm"]');
      await page.click('form[data-action="save-settings"] button[type="submit"]');
      await page.waitForSelector('.hotel-sync-room');
      assert.match(await page.locator('[role="status"]').textContent(), /Réglages enregistrés/);
      assert.equal(await page.locator('.hotel-sync-room h3 b').count(), 0, 'room names are escaped');

      await page.click('.hotel-sync-room button[data-action="create-export"]');
      await page.waitForSelector('.hotel-sync-copy input');
      assert.equal(await page.locator('.hotel-sync-copy input').inputValue(), `${origin}/api/v1/hotel-calendars/abcdefabcdefabcdefabcdefabcdefab.ics`);

      const form = page.locator('.hotel-sync-import-form');
      await form.locator('[name=url]').fill('https://broken.example.com/cal.ics');
      await form.locator('[type=submit]').click();
      await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent.includes('site public'));
      await page.locator('.hotel-sync-import-form [name=url]').fill('https://pms.example.com/room1.ics');
      await page.locator('.hotel-sync-import-form [type=submit]').click();
      await page.waitForSelector('.hotel-sync-import');
      assert.match(await page.locator('.hotel-sync-import').textContent(), /4 nuit\(s\) occupée\(s\)/);

      await page.check('input[name="mode"][value="channel_manager"]');
      assert.equal(await page.locator('[data-partner-field]').isVisible(), true);
      await page.click('form[data-action="save-settings"] button[type="submit"]');
      await page.waitForFunction(() => document.body.textContent.includes('PCM0011223344'));
      assert.ok(calls.filter(call => call.startsWith('PUT')).length === 2);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 1, `no horizontal scroll at ${width}px (${overflow})`);
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally {
    await browser?.close();
    server.close();
  }
});

test('admin creates a channel manager partner and sees its secret once', { skip: !process.env.PENCMI_PLAYWRIGHT_MODULE, timeout: 60000 }, async () => {
  const { chromium } = await import(pathToFileURL(process.env.PENCMI_PLAYWRIGHT_MODULE).href);
  const { server, origin } = await staticServer();
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const partners = [];
    await page.addInitScript(base => { localStorage.setItem('pencmi_api_base_url', base); localStorage.setItem('pencmi_access_token', 'admin-token'); }, `${origin}/api/v1`);
    await page.route('**/api/v1/admin/hotel-channel-partners**', async route => {
      const req = route.request();
      if (req.method() === 'POST') {
        const body = req.postDataJSON();
        const partner = { id: 'p1', ...body, active: true, hotels: 0 };
        partners.push(partner);
        return route.fulfill({ status: 201, json: { success: true, data: { ...partner, secret: `pcmcm_${'f'.repeat(64)}` } } });
      }
      return route.fulfill({ json: { success: true, data: partners } });
    });
    await page.goto(`${origin}/admin/hotel-integrations/partners/`);
    await page.waitForSelector('form[data-action="create"]');
    await page.fill('[name=code]', 'acme');
    await page.fill('[name=name]', 'Acme Channel');
    await page.click('form[data-action="create"] button[type=submit]');
    await page.waitForSelector('[role="alert"] input');
    assert.equal(await page.locator('[role="alert"] input').inputValue(), `pcmcm_${'f'.repeat(64)}`);
    assert.match(await page.locator('.hotel-sync-table').textContent(), /Acme Channel/);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    server.close();
  }
});

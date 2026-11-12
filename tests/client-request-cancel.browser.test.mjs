import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

test('client cancels a confirmed hotel request after an explicit confirmation, on mobile and desktop', {
  skip: !process.env.PENCMI_PLAYWRIGHT_MODULE, timeout: 90000,
}, async () => {
  const { chromium } = await import(pathToFileURL(process.env.PENCMI_PLAYWRIGHT_MODULE).href);
  const root = resolve(import.meta.dirname, '..');
  const id = randomUUID();
  let origin, status, cancels, fail;
  const request = () => ({
    id, type: 'hotel', status, canCancel: status === 'accepted', createdAt: '2026-11-01T10:00:00Z', updatedAt: '2026-11-02T10:00:00Z',
    listing: { id: 'p1', available: true, title: '<img src=x onerror=alert(1)> Hôtel Teranga', url: '/hotels/detail/?id=p1' },
    contact: { name: 'Awa' }, message: 'Arrivée tardive', details: { checkIn: '2026-12-01', checkOut: '2026-12-03', guests: 2, units: 1 },
    detailUrl: `/compte/reservations/?id=${id}`, conversationUrl: null,
  });
  const server = createServer(async (req, res) => {
    try {
      const { pathname } = new URL(req.url, origin);
      if (pathname === '/config/runtime-config.js') {
        res.setHeader('Content-Type', 'text/javascript');
        return res.end(`window.PencmiRuntimeConfig={apiBaseUrl:${JSON.stringify(origin + '/api/v1')}}`);
      }
      if (pathname.startsWith('/api/v1/')) {
        res.setHeader('Content-Type', 'application/json');
        const respond = data => res.end(JSON.stringify({ success: true, data }));
        if (pathname === `/api/v1/compte/requests/hotel/${id}/cancel` && req.method === 'POST') {
          cancels++;
          if (fail) { fail = false; res.writeHead(409); return res.end(JSON.stringify({ error: { message: 'Le séjour a commencé.' } })); }
          status = 'cancelled';
          return respond(request());
        }
        if (pathname === `/api/v1/compte/requests/hotel/${id}`) return respond(request());
        if (pathname === '/api/v1/auth/me') return respond({ id: 'client', role: 'client' });
        return respond([]);
      }
      const file = resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
      if (!file.startsWith(root + sep) || /[/\\](backend|node_modules|\.git)[/\\]/.test(file)) throw Error();
      const bytes = await readFile(file);
      res.setHeader('Content-Type', /\.m?js$/.test(file) ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
      res.end(bytes);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    for (const width of [360, 1440]) {
      status = 'accepted'; cancels = 0; fail = true;
      const page = await browser.newPage({ viewport: { width, height: 800 } });
      page.setDefaultTimeout(10000);
      await page.addInitScript(token => localStorage.setItem('pencmi_access_token', token), randomUUID());
      await page.goto(`${origin}/compte/reservations/?id=${id}`);
      await page.getByRole('button', { name: 'Annuler ma demande' }).click();
      await page.getByText(/Les nuits confirmées seront libérées\./).waitFor();
      assert.equal(cancels, 0, 'nothing is sent before the confirmation');
      await page.getByRole('button', { name: 'Garder ma demande' }).click();
      assert.equal(cancels, 0);
      await page.getByRole('button', { name: 'Annuler ma demande' }).click();
      await page.getByRole('button', { name: 'Confirmer l’annulation' }).click();
      await page.getByText('Le séjour a commencé.', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Annuler ma demande' }).click();
      await page.getByRole('button', { name: 'Confirmer l’annulation' }).click();
      await page.getByText('Votre demande a été annulée.', { exact: true }).waitFor();
      assert.equal(cancels, 2);
      assert.equal(await page.getByRole('button', { name: 'Annuler ma demande' }).count(), 0);
      assert.equal(await page.locator('img[src=x]').count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await page.close();
    }
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise(done => server.close(done));
  }
});

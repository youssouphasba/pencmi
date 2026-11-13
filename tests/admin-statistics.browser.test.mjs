import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

test('admin statistics: totals, period figures and period switch on mobile and desktop', {
  skip: !process.env.PENCMI_PLAYWRIGHT_MODULE, timeout: 90000,
}, async () => {
  const { chromium } = await import(pathToFileURL(process.env.PENCMI_PLAYWRIGHT_MODULE).href);
  const root = resolve(import.meta.dirname, '..');
  let origin; const periods = [];
  const request = (total, accepted, refused) => ({ total, waiting: total - accepted - refused, accepted, refused, cancelled: 0, acceptanceRate: accepted + refused ? Math.round(accepted / (accepted + refused) * 100) : null });
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, origin);
      const { pathname } = url;
      if (pathname === '/config/runtime-config.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(`window.PencmiRuntimeConfig={apiBaseUrl:${JSON.stringify(origin + '/api/v1')}}`); }
      if (pathname.startsWith('/api/v1/')) {
        const respond = data => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ success: true, data })); };
        if (pathname === '/api/v1/auth/me') return respond({ id: 'admin-1', role: 'admin' });
        if (pathname === '/api/v1/admin/overview') return respond({ users: 1200, advertisers: 140, reports: 3, failedEmails: 0, listingCounts: { real_estate: { active: 50, pending: 4 }, hotels: { active: 10, pending: 1 }, vehicles: { active: 0, pending: 0 }, trips: { active: 5, pending: 0 } } });
        if (pathname === '/api/v1/admin/statistics') {
          const days = Number(url.searchParams.get('days')); periods.push(days);
          return respond({ days, signups: { clients: days, professionals: 2, total: days + 2, series: Array.from({ length: days }, (_, i) => ({ day: `2030-01-${String((i % 28) + 1).padStart(2, '0')}`, signups: 1 })) },
            newListings: { real_estate: 3, hotels: 1, vehicles: 0, trips: 2, total: 6 },
            requests: { visit: request(10, 6, 2), hotel: request(4, 1, 1), rental: request(0, 0, 0), chauffeur: request(0, 0, 0), trip: request(7, 7, 0) },
            contacts: { real_estate: 12, hotels: 3 }, reports: { opened: 2, closed: 1 }, messages: 40, verifications: { pending: 1 },
            topEvents: [{ module: 'hotels', eventType: '<img src=x onerror=alert(1)>', count: 9 }] });
        }
        res.writeHead(404); return res.end();
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
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      page.setDefaultTimeout(10000);
      await page.addInitScript(token => localStorage.setItem('pencmi_access_token', token), randomUUID());
      await page.goto(`${origin}/admin/statistiques/`);
      await page.getByRole('heading', { name: 'Sur les 30 derniers jours' }).waitFor();
      await page.getByRole('row', { name: /Visites immobilières 10 2 6 2 0 75 %/ }).waitFor();
      await page.getByRole('row', { name: /Places de voyage 7 0 7 0 0 100 %/ }).waitFor();
      const kpis = await page.locator('.admin-kpi-value').allTextContents();
      assert.ok(kpis.some(text => /^1\s200$/.test(text)), JSON.stringify(kpis));
      assert.equal(await page.locator('img[src=x]').count(), 0);
      await page.getByLabel('Période').selectOption('7');
      await page.getByRole('heading', { name: 'Sur les 7 derniers jours' }).waitFor();
      assert.deepEqual(periods.slice(-2), [30, 7]);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await page.close();
    }
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise(done => server.close(done));
  }
});

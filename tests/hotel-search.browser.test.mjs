import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

test('browser: hotel search sends the stay to the API, shows availability and maps the results', { skip: !process.env.PENCMI_PLAYWRIGHT_MODULE, timeout: 90000 }, async () => {
  const { chromium } = await import(pathToFileURL(process.env.PENCMI_PLAYWRIGHT_MODULE).href);
  const root = fileURLToPath(new URL('../', import.meta.url));
  const served = /^\/(config|hotels|publier|saved|auth|seo|geo|immobilier|vendor|design-system)\//;
  const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json' };
  const hotel = (id, city, extra = {}) => ({ id, name: `Hôtel ${id}`, propertyType: 'hotel', city, rooms: [], metadata: {}, owner: {}, ...extra });
  const quote = (status, estimatedTotal) => ({ status, nights: 2, units: 1, guests: 3, estimatedTotal });
  const queries = [];
  let origin;
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, origin);
      const pathname = decodeURIComponent(url.pathname);
      if (pathname === '/config/runtime-config.js') {
        res.writeHead(200, { 'Content-Type': 'text/javascript' });
        return res.end(`window.PencmiRuntimeConfig = ${JSON.stringify({ apiBaseUrl: `${origin}/api/v1` })};`);
      }
      if (pathname === '/api/v1/hotels') {
        const query = Object.fromEntries(url.searchParams);
        queries.push(query);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        if (query.amenity) {
          // 25 properties have a pool: the filter and the pages are the API's job.
          const page = Number(query.page || 1);
          const pool = Array.from({ length: 25 }, (_, index) => hotel(`piscine-${index + 1}`, 'Dakar'));
          return res.end(JSON.stringify({ data: pool.slice((page - 1) * 20, page * 20), meta: { page, limit: 20, total: 25, totalPages: 2 } }));
        }
        const data = query.checkIn
          ? [hotel('libre', 'Dakar', { stay: quote('on_request', 60000) }), hotel('a-confirmer', 'Saly', { stay: quote('unconfirmed', null) })]
          : [hotel('libre', 'Dakar'), hotel('a-confirmer', 'Saly'), hotel('complet', '<img src=x onerror="window.__xss=1">')];
        return res.end(JSON.stringify({ data, meta: { page: 1, total: data.length, totalPages: 1 } }));
      }
      if (pathname.startsWith('/api/')) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"data":[]}'); }
      if (pathname === '/hotels') { res.writeHead(302, { Location: `/hotels/${url.search}` }); return res.end(); }
      const file = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
      const type = types[path.extname(file)];
      if (!served.test(file) || !type || file.includes('..')) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` });
      res.end(await readFile(path.join(root, file)));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  const day = offset => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage();
    // Map tiles come from a third party; the test only checks the markers.
    await page.route(/tile\.openstreetmap\.org/, route => route.abort());
    const cards = page.locator('.hotel-card');
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${origin}/hotels/`);
      await cards.nth(2).waitFor();
      assert.deepEqual(queries.at(-1), {});
      assert.equal(await cards.filter({ hasText: 'Disponibilité à confirmer' }).count(), 3);

      // The search form sends the dates, the guests and the rooms to the API.
      await page.locator('#hotel-search-form input[name="checkIn"]').fill(day(10));
      await page.locator('#hotel-search-form input[name="checkOut"]').fill(day(12));
      await page.locator('#hotel-search-form input[name="adults"]').fill('2');
      await page.locator('#hotel-search-form input[name="children"]').fill('1');
      await page.locator('#hotel-search-form button[type="submit"]').click();
      await page.getByText('Les établissements complets ou fermés sur ces dates ne sont pas affichés.').waitFor();
      assert.deepEqual(queries.at(-1), { checkIn: day(10), checkOut: day(12), guests: '3', rooms: '1' });
      assert.equal(await cards.count(), 2);
      await cards.filter({ hasText: /Disponible pour vos dates · 2 nuits · environ 60.000 FCFA le séjour/ }).waitFor();
      assert.equal(await cards.filter({ hasText: 'Disponibilité à confirmer pour vos dates · 2 nuits' }).count(), 1);

      // The map opens on demand, one marker per city.
      await page.getByRole('button', { name: 'Voir la carte' }).click();
      const markers = page.locator('[data-listing-map] .pencmi-map-marker');
      await markers.nth(1).waitFor();
      assert.equal(await markers.count(), 2);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      await page.getByRole('button', { name: 'Masquer la carte' }).click();
      assert.equal(await page.locator('[data-listing-map]').count(), 0);

      // Filters are sent to the API, which counts and pages the whole search.
      await page.goto(`${origin}/hotels/`);
      await cards.nth(2).waitFor();
      await page.locator('#hotel-filter-form input[name="query"]').fill('Téranga');
      await page.locator('#hotel-filter-form input[name="maxPrice"]').fill('50000');
      await page.locator('#hotel-filter-form select[name="stars"]').selectOption('3');
      await page.locator('#hotel-filter-form select[name="amenity"]').selectOption('Piscine');
      await page.locator('#hotel-filter-form button[type="submit"]').click();
      await page.getByText('25 hébergements').waitFor();
      assert.deepEqual(queries.at(-1), { query: 'Téranga', maxPrice: '50000', stars: '3', amenity: 'Piscine' });
      assert.equal(await cards.count(), 20);
      await page.getByText('Page 1 sur 2').waitFor();
      await page.getByRole('button', { name: 'Suivant' }).click();
      await page.getByText('Page 2 sur 2').waitFor();
      assert.equal(queries.at(-1).page, '2');
      assert.equal(queries.at(-1).amenity, 'Piscine');
      assert.equal(await cards.count(), 5);
      await page.getByRole('button', { name: 'Précédent' }).waitFor();

      // Incoherent dates are explained and never sent to the API.
      await page.goto(`${origin}/hotels/?checkIn=${day(12)}&checkOut=${day(10)}`);
      await page.getByRole('alert').filter({ hasText: 'La date de départ doit suivre la date d’arrivée.' }).waitFor();
      assert.deepEqual(queries.at(-1), {});
      await page.goto(`${origin}/hotels/?checkIn=2020-01-01&checkOut=2020-01-03`);
      await page.getByRole('alert').filter({ hasText: 'La date d’arrivée ne peut pas être passée.' }).waitFor();
      assert.deepEqual(queries.at(-1), {});
      assert.equal(await page.evaluate(() => window.__xss), undefined);
    }
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

test('browser: real estate search filters on the server and pages through every result', { skip: !process.env.PENCMI_PLAYWRIGHT_MODULE, timeout: 90000 }, async () => {
  const { chromium } = await import(pathToFileURL(process.env.PENCMI_PLAYWRIGHT_MODULE).href);
  const root = new URL('../', import.meta.url);
  const assets = new Set(['config/platform.js', 'design-system/design-system.css', 'immobilier/index.html', 'immobilier/immobilier.js',
    'immobilier/immobilier.css', 'immobilier/senegal-locations.js', 'seo/seo.js', 'geo/geo.js', 'geo/geo.css', 'config/senegal-map.js', 'config/senegal-map.css', 'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css']);
  const listing = (id, price, furnished, owner = 'Agence Teranga') => ({ id, title: `Bien ${id}`, status: 'active', city: 'Dakar',
    transaction: 'location', propertyType: 'appartement', price, owner: { professionalProfile: { businessName: owner } },
    metadata: { photos: [], features: { furnished } } });
  const all = [
    ...Array.from({ length: 25 }, (_, index) => listing(`match-${String(index + 1).padStart(2, '0')}`, 100000, true,
      index ? 'Agence Teranga' : '<img src=x onerror="window.__xss=1">')),
    listing('too-expensive', 900000, true), listing('unfurnished', 100000, false), listing('no-price', null, true),
  ];
  const allowed = new Set(['page', 'limit', 'city', 'transaction', 'propertyType', 'maxPrice', 'furnished']);
  const queries = [];
  let origin;
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, origin);
      const path = decodeURIComponent(url.pathname);
      if (path === '/config/runtime-config.js') {
        res.writeHead(200, { 'Content-Type': 'text/javascript' });
        return res.end(`window.PencmiRuntimeConfig = ${JSON.stringify({ apiBaseUrl: `${origin}/api/v1` })};`);
      }
      if (path === '/api/v1/immobilier') {
        const query = Object.fromEntries(url.searchParams);
        queries.push(query);
        res.setHeader('Content-Type', 'application/json');
        // Mirrors the API contract: unknown or malformed parameters are refused.
        if (Object.keys(query).some(key => !allowed.has(key)) || (query.maxPrice && !/^[1-9]\d*$/.test(query.maxPrice))
          || (query.furnished && query.furnished !== 'true')) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ success: false, error: { message: 'Paramètres invalides.' } }));
        }
        const rows = all.filter(row => (!query.maxPrice || (row.price !== null && row.price <= Number(query.maxPrice)))
          && (!query.furnished || row.metadata.features.furnished));
        const page = Number(query.page || 1), limit = 20;
        return res.end(JSON.stringify({ success: true, data: rows.slice((page - 1) * limit, page * limit),
          meta: { page, limit, total: rows.length, totalPages: Math.ceil(rows.length / limit) } }));
      }
      if (path === '/immobilier') { res.writeHead(302, { Location: `/immobilier/${url.search}` }); return res.end(); }
      const file = path.endsWith('/') ? `${path.slice(1)}index.html` : path.slice(1);
      if (!assets.has(file)) { res.writeHead(404); return res.end(); }
      const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html';
      res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` });
      res.end(await readFile(new URL(file, root)));
    } catch { res.writeHead(500); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage();
    // Map tiles come from a third party; the test only checks the markers.
    await page.route(/tile\.openstreetmap\.org/, route => route.abort());
    const cards = page.locator('.results-list article');
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${origin}/immobilier/`);
      await page.getByText('28 annonces disponibles').waitFor();
      assert.equal(await cards.count(), 20);

      // The map opens on demand and groups the listings of the page by city.
      assert.equal(await page.locator('#map-panel').count(), 0);
      await page.getByRole('button', { name: 'Voir la carte' }).click();
      const marker = page.locator('#map-panel .pencmi-map-marker');
      await marker.waitFor();
      assert.equal(await marker.count(), 1);
      assert.equal((await marker.textContent()).trim(), '20');
      await marker.click();
      await page.locator('.pencmi-map-popup').getByRole('link', { name: 'Bien match-02', exact: true }).waitFor();
      assert.equal(await page.evaluate(() => window.__xss), undefined);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      await page.getByRole('button', { name: 'Masquer la carte' }).click();
      assert.equal(await page.locator('#map-panel').count(), 0);

      // The filter form sends the budget and the furnished option to the API.
      if (width < 900) await page.locator('[data-open-filters]').click();
      await page.locator('#filters-form input[name="maxPrice"]').fill('150000');
      await page.locator('#filters-form input[name="furnished"]').check();
      await page.locator('#filters-form button[type="submit"]').click();
      await page.getByText('25 annonces disponibles').waitFor();
      assert.deepEqual(queries.at(-1), { maxPrice: '150000', furnished: 'true' });
      assert.equal(await cards.count(), 20);
      assert.equal(await cards.filter({ hasText: 'Meublé' }).count(), 20);
      assert.equal(await page.evaluate(() => window.__xss), undefined);
      const pager = page.getByRole('navigation', { name: 'Pages de résultats' });
      await pager.getByText('Page 1 sur 2').waitFor();
      assert.equal(await pager.getByRole('link', { name: 'Précédent' }).count(), 0);

      await pager.getByRole('link', { name: 'Suivant' }).click();
      await pager.getByText('Page 2 sur 2').waitFor();
      assert.deepEqual(queries.at(-1), { maxPrice: '150000', furnished: 'true', page: '2' });
      assert.equal(await cards.count(), 5);
      await page.getByRole('heading', { name: 'Bien match-25', exact: true }).waitFor();
      assert.equal(await pager.getByRole('link', { name: 'Suivant' }).count(), 0);
      assert.equal(await page.locator('#filters-form input[name="furnished"]').isChecked(), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);

      await pager.getByRole('link', { name: 'Précédent' }).click();
      await pager.getByText('Page 1 sur 2').waitFor();

      // Hostile or malformed URL values are neither executed nor sent to the API.
      await page.goto(`${origin}/immobilier/?city=${encodeURIComponent('"><img src=x onerror="window.__xss=1">')}&maxPrice=abc&furnished=yes&page=-3`);
      await page.getByText('28 annonces disponibles').waitFor();
      assert.deepEqual(Object.keys(queries.at(-1)), ['city']);
      assert.equal(await page.evaluate(() => window.__xss), undefined);
    }
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

// Landing pages (/hotels/auberge, /voitures/location...) share the script of their
// universe: each one must reach the API and apply the filter it is named after.
test('browser: landing pages load results with the filter of the page', { skip: !process.env.PENCMI_PLAYWRIGHT_MODULE, timeout: 180000 }, async () => {
  const { chromium } = await import(pathToFileURL(process.env.PENCMI_PLAYWRIGHT_MODULE).href);
  const root = fileURLToPath(new URL('../', import.meta.url));
  const served = /^\/(config|hotels|voitures|voyages|immobilier|publier|saved|auth|seo|geo|vendor|design-system|safety)\//;
  const types = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json' };
  const rows = {
    hotels: { id: 'h1', name: 'Auberge du Fleuve', propertyType: 'auberge', city: 'Saint-Louis', rooms: [], metadata: {}, owner: {} },
    voitures: { id: 'v1', title: 'Toyota Prado', vehicleMode: 'rental', city: 'Dakar', metadata: { brand: 'Toyota', model: 'Prado' }, owner: {} },
    voyages: { id: 't1', departureCity: 'Dakar', arrivalCity: 'Thiès', vehicleType: 'bus', metadata: {}, owner: {} },
    immobilier: { id: 'r1', title: 'Appartement Almadies', status: 'active', city: 'Dakar', transaction: 'location', propertyType: 'appartement', price: 100000, owner: {}, metadata: { photos: [], features: {} } },
  };
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
      const universe = pathname.match(/^\/api\/v1\/(hotels|voitures|voyages|immobilier)$/)?.[1];
      if (universe) {
        queries.push({ universe, ...Object.fromEntries(url.searchParams) });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, data: [rows[universe]], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }));
      }
      if (pathname.startsWith('/api/')) { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end('{"data":[]}'); }
      const file = pathname.endsWith('/') ? `${pathname}index.html` : pathname;
      const type = types[path.extname(file)];
      if (!served.test(file) || !type || file.includes('..')) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` });
      res.end(await readFile(path.join(root, file)));
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  // [page, universe, text of the result, filter sent to the API]
  const pages = [
    ['/hotels/hotel/', 'hotels', 'Auberge du Fleuve', { propertyType: 'hotel' }],
    ['/hotels/auberge/', 'hotels', 'Auberge du Fleuve', { propertyType: 'auberge' }],
    ['/hotels/residence/', 'hotels', 'Auberge du Fleuve', { propertyType: 'residence' }],
    ['/hotels/appartement-meuble/', 'hotels', 'Auberge du Fleuve', { propertyType: 'appartement_meuble' }],
    ['/hotels/ville/detail/?city=Saint-Louis', 'hotels', 'Auberge du Fleuve', { city: 'Saint-Louis' }],
    ['/hotels/region/detail/', 'hotels', 'Auberge du Fleuve', {}],
    ['/voitures/achat/', 'voitures', 'Toyota Prado', { vehicleMode: 'sale' }],
    ['/voitures/vente/', 'voitures', 'Toyota Prado', { vehicleMode: 'sale' }],
    ['/voitures/location/', 'voitures', 'Toyota Prado', { vehicleMode: 'rental' }],
    ['/voitures/avec-chauffeur/', 'voitures', 'Toyota Prado', { vehicleMode: 'chauffeur' }],
    ['/voitures/marque/detail/detail/?brand=Toyota', 'voitures', 'Toyota Prado', { brand: 'Toyota' }],
    ['/voitures/ville/detail/', 'voitures', 'Toyota Prado', {}],
    ['/voyages/bus/', 'voyages', 'Thiès', { vehicleType: 'bus' }],
    ['/voyages/car/', 'voyages', 'Thiès', { vehicleType: 'car' }],
    ['/voyages/minibus/', 'voyages', 'Thiès', { vehicleType: 'minibus' }],
    ['/voyages/sept-places/', 'voyages', 'Thiès', { vehicleType: 'sept_places' }],
    ['/voyages/covoiturage/', 'voyages', 'Thiès', { vehicleType: 'covoiturage' }],
    ['/voyages/gare/detail/', 'voyages', 'Thiès', {}],
    ['/immobilier/location/', 'immobilier', 'Appartement Almadies', { transaction: 'location' }],
    ['/immobilier/vente/', 'immobilier', 'Appartement Almadies', { transaction: 'vente' }],
    ['/immobilier/achat/', 'immobilier', 'Appartement Almadies', { transaction: 'achat' }],
    ['/immobilier/appartements/', 'immobilier', 'Appartement Almadies', { propertyType: 'Appartement' }],
    ['/immobilier/terrains/', 'immobilier', 'Appartement Almadies', { propertyType: 'Terrain' }],
    ['/immobilier/ville/detail/?city=Dakar', 'immobilier', 'Appartement Almadies', { city: 'Dakar' }],
    // The address of the page wins over the filter of the landing page.
    ['/hotels/auberge/?type=hotel', 'hotels', 'Auberge du Fleuve', { propertyType: 'hotel' }],
  ];
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    for (const [address, universe, text, filter] of pages) {
      queries.length = 0;
      errors.length = 0;
      await page.goto(`${origin}${address}`);
      await page.locator('main article').filter({ hasText: text }).first().waitFor();
      const sent = queries.find(query => query.universe === universe);
      assert.ok(sent, `${address} did not call the API`);
      for (const [key, value] of Object.entries(filter)) assert.equal(sent[key], value, `${address} ${key}`);
      for (const key of ['propertyType', 'vehicleMode', 'vehicleType', 'transaction']) {
        if (!(key in filter)) assert.equal(sent[key], undefined, `${address} unexpected ${key}`);
      }
      assert.deepEqual(errors, [], address);
    }
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});

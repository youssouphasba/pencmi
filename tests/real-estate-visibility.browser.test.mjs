import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

test('browser: homepage, results and details retain listings without photos on mobile and desktop', { skip: !process.env.PENCMI_PLAYWRIGHT_MODULE, timeout: 60000 }, async () => {
  const { chromium } = await import(pathToFileURL(process.env.PENCMI_PLAYWRIGHT_MODULE).href);
  const sharp = createRequire(new URL('../backend/package.json', import.meta.url))('sharp');
  const photo = await sharp({ create: { width: 16, height: 12, channels: 3, background: '#269b83' } }).png().toBuffer();
  const root = new URL('../', import.meta.url);
  const assets = new Set(['index.html', 'app.js', 'styles.css', 'Logo pencmi.jpeg', 'config/platform.js',
    'design-system/design-system.css', 'immobilier/index.html', 'immobilier/immobilier.js', 'immobilier/immobilier.css',
    'immobilier/senegal-locations.js', 'immobilier/annonce/index.html', 'immobilier/annonce/detail.js', 'immobilier/annonce/detail.css',
    'safety/safety.js', 'safety/safety.css', 'seo/seo.js', 'geo/geo.js']);
  let origin;
  const listings = () => [
    { id: 'without-photo', title: 'Appartement sans photo', status: 'active', city: 'Dakar', transaction: 'location', propertyType: 'appartement', price: 200000, metadata: { photos: [] } },
    { id: 'with-photo', title: 'Appartement avec photo', status: 'active', city: 'Dakar', transaction: 'location', propertyType: 'appartement', price: 250000, metadata: { coverPhoto: `${origin}/photo.png`, photos: [`${origin}/photo.png`] } },
  ];
  const server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (path === '/config/runtime-config.js') {
        res.writeHead(200, { 'Content-Type': 'text/javascript' });
        return res.end(`window.PencmiRuntimeConfig = ${JSON.stringify({ apiBaseUrl: `${origin}/api/v1` })};`);
      }
      if (path === '/photo.png') { res.writeHead(200, { 'Content-Type': 'image/png' }); return res.end(photo); }
      if (path.startsWith('/api/v1/')) {
        const data = path === '/api/v1/immobilier' ? listings() : path.startsWith('/api/v1/immobilier/') ? listings().find(item => path.endsWith(`/${item.id}`)) : [];
        res.writeHead(data ? 200 : 404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: Boolean(data), data }));
      }
      const file = path === '/' ? 'index.html' : path.endsWith('/') ? `${path.slice(1)}index.html` : path.slice(1);
      if (!assets.has(file)) { res.writeHead(404); return res.end(); }
      const body = await readFile(new URL(file, root));
      const type = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.jpeg') ? 'image/jpeg' : 'text/html';
      res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8` });
      res.end(body);
    } catch { res.writeHead(500); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage();
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(origin);
      const emptyCard = page.locator('#listing-sections article').filter({ has: page.getByRole('heading', { name: 'Appartement sans photo', exact: true }) });
      await emptyCard.locator('.real-estate-photo-placeholder').waitFor();
      assert.equal(await emptyCard.locator('img').count(), 0);
      const photoCard = page.locator('#listing-sections article').filter({ has: page.getByRole('heading', { name: 'Appartement avec photo', exact: true }) });
      await photoCard.locator('img').waitFor();
      assert.equal(await photoCard.locator('img').getAttribute('src'), `${origin}/photo.png`);
      if (process.env.PENCMI_PUBLICATION_SCREENSHOT_DIRECTORY) {
        await mkdir(process.env.PENCMI_PUBLICATION_SCREENSHOT_DIRECTORY, { recursive: true });
        await page.locator('#listing-sections').screenshot({ path: join(process.env.PENCMI_PUBLICATION_SCREENSHOT_DIRECTORY, `visibility-${width}.png`) });
      }
      await page.goto(`${origin}/immobilier/`);
      await page.getByRole('heading', { name: 'Appartement sans photo', exact: true }).waitFor();
      await page.getByRole('heading', { name: 'Appartement avec photo', exact: true }).waitFor();
      await page.goto(`${origin}/immobilier/annonce/?id=without-photo`);
      await page.locator('.photo-placeholder').waitFor();
      await page.getByRole('heading', { level: 1, name: 'Appartement sans photo' }).waitFor();
      await page.goto(`${origin}/immobilier/annonce/?id=with-photo`);
      await page.locator('.gallery-main-image').waitFor();
      assert.equal(await page.locator('.gallery-main-image').getAttribute('src'), `${origin}/photo.png`);
      assert.equal(await page.locator('.gallery-main-image').evaluate(img => img.naturalWidth), 16);
    }
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
});

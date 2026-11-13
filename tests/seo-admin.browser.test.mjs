import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

test('an admin overrides a page title, the public page uses it, and the override is removed', {
  skip: !process.env.PENCMI_PLAYWRIGHT_MODULE, timeout: 90000,
}, async () => {
  const { chromium } = await import(pathToFileURL(process.env.PENCMI_PLAYWRIGHT_MODULE).href);
  const root = resolve(import.meta.dirname, '..');
  let origin; let overrides = []; const writes = [];
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, origin);
      const { pathname } = url;
      if (pathname === '/config/runtime-config.js') { res.setHeader('Content-Type', 'text/javascript'); return res.end(`window.PencmiRuntimeConfig={apiBaseUrl:${JSON.stringify(origin + '/api/v1')}}`); }
      if (pathname.startsWith('/api/v1/')) {
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        const body = chunks.length ? JSON.parse(Buffer.concat(chunks)) : undefined;
        const respond = (data) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ success: true, data })); };
        if (pathname === '/api/v1/seo/meta') return respond(overrides.find((item) => item.path === url.searchParams.get('path')) ?? null);
        if (pathname === '/api/v1/admin/seo/meta' && req.method === 'GET') return respond(overrides);
        if (pathname === '/api/v1/admin/seo/meta' && req.method === 'PUT') { writes.push(body); overrides = [...overrides.filter((item) => item.path !== body.path), { id: 'm1', ...body }]; return respond({ id: 'm1', ...body }); }
        if (pathname === '/api/v1/admin/seo/meta/m1' && req.method === 'DELETE') { overrides = []; return respond({ id: 'm1', deleted: true }); }
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
    const page = await browser.newPage({ viewport: { width: 360, height: 900 } });
    page.setDefaultTimeout(10000);
    await page.addInitScript(token => localStorage.setItem('pencmi_access_token', token), randomUUID());
    await page.goto(`${origin}/admin/seo/pages/`);
    const form = page.locator('form', { has: page.getByRole('heading', { name: '/hotels', exact: true }) });
    await form.getByLabel('Titre').fill('court');
    await form.getByRole('button', { name: 'Enregistrer' }).click();
    await page.getByText('/hotels : le titre doit faire 10 à 70 caractères.').waitFor();
    assert.equal(writes.length, 0);
    await form.getByLabel('Titre').fill('Hôtels et auberges au Sénégal | Péncmi');
    await form.getByLabel('Ne pas indexer cette page').check();
    await form.getByRole('button', { name: 'Enregistrer' }).click();
    await page.getByText('Réglage enregistré pour /hotels.').waitFor();
    assert.equal(writes[0].noindex, true);

    const visitor = await browser.newPage();
    await visitor.goto(`${origin}/aide/`);
    overrides = [{ id: 'm2', path: '/aide', title: 'Aide <script>x</script> Péncmi', description: 'd'.repeat(60), noindex: true }];
    await visitor.reload();
    const seen = [];
    visitor.on('request', (request) => seen.push(request.url()));
    await visitor.reload();
    await visitor.waitForFunction(() => document.title.startsWith('Aide <script>'), null, { timeout: 5000 }).catch(async (error) => { throw new Error(`${error.message} title=${await visitor.title()} requests=${seen.filter((u) => u.includes('/api/')).join(',')}`); });
    assert.equal(await visitor.locator('meta[name="robots"]').getAttribute('content'), 'noindex,follow');
    assert.equal(await visitor.locator('head script:not([src]):not([type])').count(), 0);
    await visitor.close();

    overrides = [{ id: 'm1', ...writes[0] }];
    await page.reload();
    await page.locator('form', { has: page.getByRole('heading', { name: '/hotels', exact: true }) }).getByRole('button', { name: 'Rétablir le texte intégré' }).click();
    await page.getByText('Texte intégré rétabli pour /hotels.').waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise(done => server.close(done));
  }
});

test('each public page keeps its own canonical URL', {
  skip: !process.env.PENCMI_PLAYWRIGHT_MODULE, timeout: 60000,
}, async () => {
  const { chromium } = await import(pathToFileURL(process.env.PENCMI_PLAYWRIGHT_MODULE).href);
  const root = resolve(import.meta.dirname, '..');
  const server = createServer(async (req, res) => {
    try {
      const { pathname } = new URL(req.url, 'http://x');
      if (pathname.startsWith('/api/')) { res.writeHead(404); return res.end(); }
      const file = resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
      if (!file.startsWith(root + sep) || /[/\\](backend|node_modules|\.git)[/\\]/.test(file)) throw Error();
      const bytes = await readFile(file);
      res.setHeader('Content-Type', /\.m?js$/.test(file) ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
      res.end(bytes);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage();
    for (const path of ['/hotels', '/voitures', '/aide']) {
      await page.goto(`${origin}${path}/`);
      await page.waitForFunction(() => document.readyState === 'complete');
      assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'), `https://www.pencmi.com${path}`);
    }
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise(done => server.close(done));
  }
});

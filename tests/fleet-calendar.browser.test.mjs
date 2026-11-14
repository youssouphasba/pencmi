import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const month = new Date();
const ym = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, '0')}`;
const future = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

async function start(api) {
  let origin;
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, origin);
      const { pathname } = url;
      if (pathname === '/config/runtime-config.js') {
        res.setHeader('Content-Type', 'text/javascript');
        return res.end(`window.PencmiRuntimeConfig={apiBaseUrl:${JSON.stringify(origin + '/api/v1')}}`);
      }
      if (pathname.startsWith('/api/v1/')) {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const body = chunks.length ? JSON.parse(Buffer.concat(chunks)) : undefined;
        const result = await api(req.method, pathname, body, url.searchParams);
        if (result?.httpError) { res.writeHead(result.httpError, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: { message: result.message } })); }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, data: result ?? [], meta: { page: 1, totalPages: 1, total: Array.isArray(result) ? result.length : 0 } }));
      }
      const file = resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
      if (!file.startsWith(root + sep) || /[/\\](backend|node_modules|\.git)[/\\]/.test(file)) throw Error();
      const bytes = await readFile(file);
      res.setHeader('Content-Type', /\.m?js$/.test(file) ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.jpeg') ? 'image/jpeg' : 'text/html');
      res.end(bytes);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${server.address().port}`;
  return { server, origin };
}
const stop = async server => { server.closeAllConnections(); await new Promise(done => server.close(done)); };

test('a renter sees the month, blocks dates, meets a conflict and unblocks', {
  skip: !process.env.PENCMI_PLAYWRIGHT_MODULE, timeout: 90000,
}, async () => {
  const { chromium } = await import(pathToFileURL(process.env.PENCMI_PLAYWRIGHT_MODULE).href);
  let blocks, posts, conflict;
  const { server, origin } = await start((method, path, body) => {
    if (path === '/api/v1/dashboard/voitures' && method === 'GET') return [
      { id: 'v1', title: 'Clio <b>2020</b>', vehicleMode: 'rental', status: 'active' },
      { id: 'v2', title: 'Hilux à vendre', vehicleMode: 'sale', status: 'active' },
    ];
    if (path === '/api/v1/dashboard/voitures/v1/calendar') return {
      listing: { id: 'v1' }, blocks,
      rentals: [
        { id: 'r1', status: 'accepted', clientName: 'Awa <i>Diop</i>', startDate: `${ym}-10T00:00:00.000Z`, endDate: `${ym}-13T00:00:00.000Z` },
        { id: 'r2', status: 'pending', clientName: 'Moussa', startDate: `${ym}-20T00:00:00.000Z`, endDate: `${ym}-22T00:00:00.000Z` },
      ],
    };
    if (path === '/api/v1/dashboard/voitures/v1/blocks' && method === 'POST') {
      posts.push(body);
      if (conflict) { conflict = false; return { httpError: 409, message: 'Une location acceptée occupe déjà ces dates.' }; }
      const block = { id: `b${posts.length}`, startDate: `${body.startDate}T00:00:00.000Z`, endDate: `${body.endDate}T00:00:00.000Z`, reason: body.reason ?? null };
      blocks.push(block);
      return block;
    }
    const removed = path.match(/^\/api\/v1\/dashboard\/voitures\/v1\/blocks\/(\w+)$/)?.[1];
    if (removed && method === 'DELETE') { blocks = blocks.filter((block) => block.id !== removed); return { id: removed, deleted: true }; }
    return [];
  });
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    for (const width of [360, 1280]) {
      blocks = []; posts = []; conflict = true;
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      page.setDefaultTimeout(10000);
      await page.addInitScript(token => localStorage.setItem('pencmi_access_token', token), randomUUID());
      await page.goto(`${origin}/dashboard/voitures/calendrier/`);
      await page.getByText('Awa <i>Diop</i>', { exact: false }).waitFor();
      assert.equal(await page.locator('main b, main i:not(.fleet-legend i)').count(), 0);
      assert.deepEqual(await page.getByLabel('Véhicule').locator('option').allTextContents(), ['Clio <b>2020</b>'], 'only rental vehicles');
      assert.equal(await page.locator('.fleet-day.is-booked').count(), 3, 'end date excluded');
      assert.equal(await page.locator('.fleet-day.is-pending').count(), 2);

      const day = future(3);
      await page.getByLabel('Du', { exact: true }).fill(day);
      await page.getByLabel('Jusqu’au (inclus)').fill(day);
      await page.getByLabel('Motif (privé)').fill('Vidange');
      await page.getByRole('button', { name: 'Bloquer' }).click();
      await page.getByText('Une location acceptée occupe déjà ces dates.').waitFor();
      await page.getByRole('button', { name: 'Bloquer' }).click();
      await page.getByText('Dates bloquées.', { exact: true }).waitFor();
      assert.deepEqual(posts.at(-1), { startDate: day, endDate: day, reason: 'Vidange' });
      await page.getByText(/— Vidange/).waitFor();
      await page.getByRole('button', { name: 'Débloquer' }).click();
      await page.getByText('Dates débloquées.').waitFor();
      assert.equal(blocks.length, 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await page.close();
    }
  } finally {
    await browser?.close();
    await stop(server);
  }
});

test('a client sees unavailable dates and cannot request them', {
  skip: !process.env.PENCMI_PLAYWRIGHT_MODULE, timeout: 60000,
}, async () => {
  const { chromium } = await import(pathToFileURL(process.env.PENCMI_PLAYWRIGHT_MODULE).href);
  const requests = [];
  const busyStart = future(10), busyEnd = future(13);
  const { server, origin } = await start((method, path, body) => {
    if (path === '/api/v1/voitures/v1') return { id: 'v1', title: 'Clio', vehicleMode: 'rental', city: 'Dakar', status: 'active', metadata: {}, owner: { id: 'o1' } };
    if (path === '/api/v1/voitures/v1/availability') return { busy: [{ start: busyStart, end: busyEnd }] };
    if (path === '/api/v1/voitures/v1/rental-requests' && method === 'POST') { requests.push(body); return { id: 'r9', status: 'new' }; }
    return [];
  });
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(`${origin}/voitures/detail/?id=v1`);
    // A visitor without an account is invited to sign in instead of seeing the form.
    await page.locator('[data-open-contact]').click({ timeout: 5000 });
    await page.getByText('Connectez-vous pour envoyer votre demande').waitFor();
    assert.equal(await page.getByRole('link', { name: 'Se connecter' }).getAttribute('href'), '/login/?next=%2Fvoitures%2Fdetail%2F%3Fid%3Dv1');
    await page.evaluate(() => localStorage.setItem('pencmi_access_token', 'test-token'));
    await page.reload();
    await page.locator('[data-open-contact]').click({ timeout: 5000 }).catch(async (error) => { throw new Error(`${error.message}\n${errors.join('\n')}\n${(await page.locator('body').innerText()).slice(0, 500)}`); });
    await page.getByText('Dates déjà indisponibles').waitFor();
    await page.getByLabel('Nom').fill('Fatou');
    await page.getByLabel('Téléphone').fill('+221770000000');
    await page.getByLabel('Début de location').fill(future(11));
    await page.getByLabel('Fin de location').fill(future(15));
    await page.getByRole('button', { name: 'Envoyer la demande' }).click();
    await page.getByText('Ces dates chevauchent une période indisponible.', { exact: false }).waitFor();
    assert.equal(requests.length, 0);
    await page.getByLabel('Début de location').fill(future(13));
    await page.getByRole('button', { name: 'Envoyer la demande' }).click();
    await page.locator('#vehicle-contact-confirmation:not([hidden])').waitFor();
    assert.equal(requests.length, 1, 'the return day of a booking is free');
  } finally {
    await browser?.close();
    await stop(server);
  }
});

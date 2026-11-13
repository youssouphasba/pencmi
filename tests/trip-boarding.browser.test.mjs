import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const soon = new Date(Date.now() + 2 * 3600000).toISOString();

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
        const result = await api(req.method, pathname, body);
        if (result?.httpError) { res.writeHead(result.httpError, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: { message: result.message } })); }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, data: result ?? [], meta: { page: 1, totalPages: 1, total: Array.isArray(result) ? result.length : 0 } }));
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
  return { server, origin };
}
const stop = async server => { server.closeAllConnections(); await new Promise(done => server.close(done)); };

test('a carrier checks tickets, marks a no-show and sees the totals', {
  skip: !process.env.PENCMI_PLAYWRIGHT_MODULE, timeout: 90000,
}, async () => {
  const { chromium } = await import(pathToFileURL(process.env.PENCMI_PLAYWRIGHT_MODULE).href);
  let passengers, calls;
  const manifest = () => {
    const seats = (rows) => rows.reduce((sum, row) => sum + row.allocatedSeats, 0);
    return {
      occurrence: { id: 'o1', departureAt: soon, cancelledAt: null, boardingOpen: true, trip: { departureCity: 'Dakar', arrivalCity: 'Saint-Louis' } },
      totals: { passengers: passengers.length, seats: seats(passengers), boardedSeats: seats(passengers.filter((p) => p.boardingStatus === 'boarded')), noShowSeats: seats(passengers.filter((p) => p.boardingStatus === 'no_show')) },
      passengers,
    };
  };
  const { server, origin } = await start((method, path, body) => {
    if (path === '/api/v1/dashboard/voyages' && method === 'GET') return [{ id: 't1', title: 'Dakar → Saint-Louis', status: 'active' }];
    if (path === '/api/v1/dashboard/voyages/t1') return { id: 't1', occurrences: [{ id: 'o1', departureAt: soon, confirmedSeats: 3, cancelledAt: null }] };
    if (path === '/api/v1/dashboard/voyages/t1/occurrences/o1/manifest') return manifest();
    if (path === '/api/v1/dashboard/voyages/t1/occurrences/o1/boarding') {
      calls.push(body);
      const passenger = body.ticketCode ? passengers.find((p) => p.ticketCode === body.ticketCode.replace(/[\s-]/g, '').toUpperCase()) : passengers.find((p) => p.id === body.requestId);
      if (!passenger) return { httpError: 404, message: 'Billet inconnu pour ce départ.' };
      passenger.boardingStatus = body.status === 'pending' ? null : body.status;
      return passenger;
    }
    if (path === '/api/v1/dashboard/voyages/statistics') return {};
    return [];
  });
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    for (const width of [360, 1280]) {
      calls = [];
      passengers = [
        { id: 'r1', clientName: 'Awa <b>Diop</b>', clientPhone: '+221770000001', allocatedSeats: 2, luggage: true, ticketCode: 'ABCDEFGHJK', boardingStatus: null },
        { id: 'r2', clientName: 'Moussa Fall', clientPhone: null, allocatedSeats: 1, luggage: false, ticketCode: 'MNPQRSTUVW', boardingStatus: null },
      ];
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      page.setDefaultTimeout(10000);
      await page.addInitScript(token => localStorage.setItem('pencmi_access_token', token), randomUUID());
      await page.goto(`${origin}/dashboard/voyages/embarquement/`);
      await page.getByLabel('Trajet').selectOption('t1');
      await page.getByText('2 réservation(s), 3 place(s) · 0 embarquée(s) · 0 absente(s)').waitFor();
      assert.equal(await page.locator('main b').count(), 0);

      await page.getByLabel('Code du billet').fill('zzzzz-zzzzz');
      await page.getByRole('button', { name: 'Valider l’embarquement' }).click();
      await page.getByText('Billet inconnu pour ce départ.').waitFor();
      await page.getByLabel('Code du billet').fill('abcde-fghjk');
      await page.getByRole('button', { name: 'Valider l’embarquement' }).click();
      await page.getByText('2 réservation(s), 3 place(s) · 2 embarquée(s) · 0 absente(s)').waitFor();
      await page.getByRole('row', { name: /Moussa Fall/ }).getByRole('button', { name: 'Absent' }).click();
      await page.getByText('· 1 absente(s)', { exact: false }).waitFor();
      assert.deepEqual(calls.at(-1), { requestId: 'r2', status: 'no_show' });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await page.close();
    }
  } finally {
    await browser?.close();
    await stop(server);
  }
});

test('a client sees the ticket of confirmed seats', {
  skip: !process.env.PENCMI_PLAYWRIGHT_MODULE, timeout: 60000,
}, async () => {
  const { chromium } = await import(pathToFileURL(process.env.PENCMI_PLAYWRIGHT_MODULE).href);
  const request = (id, status, ticket) => ({
    id, type: 'trip', status, canCancel: false, createdAt: soon, updatedAt: soon,
    listing: { id: 't1', available: true, title: 'Dakar → Saint-Louis', url: '/voyages/detail/?id=t1' },
    details: { departureAt: soon, departureCity: 'Dakar', arrivalCity: 'Saint-Louis', requestedSeats: 2, allocatedSeats: status === 'accepted' ? 2 : null, ticket },
  });
  const { server, origin } = await start((method, path) => {
    if (path === '/api/v1/compte/requests') return [request('r1', 'accepted', { code: 'ABCDEFGHJK', boardingStatus: null }), request('r2', 'cancelled', null)];
    return [];
  });
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 360, height: 900 } });
    page.setDefaultTimeout(10000);
    await page.addInitScript(token => localStorage.setItem('pencmi_access_token', token), randomUUID());
    await page.goto(`${origin}/compte/trajets/`);
    await page.getByText('ABCDE-FGHJK').waitFor();
    assert.equal(await page.locator('.cr-ticket').count(), 1, 'no ticket for a cancelled request');
    await page.getByText('Présentez ce code au transporteur à l’embarquement.').waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  } finally {
    await browser?.close();
    await stop(server);
  }
});

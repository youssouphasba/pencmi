import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve, sep, extname } from 'node:path';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const XSS = '<img src=x onerror="window.xss=1"><b>piège</b>';
const UNIVERSES = [
  { module: 'real_estate', page: '/dashboard/immobilier/statistiques/', extra: {}, types: { visit: 1 } },
  { module: 'hotels', page: '/dashboard/hotels/statistiques/', extra: { hotels: { rooms: { total: 3, active: 2 }, allocatedRoomNights: 11, topRooms: [{ id: 'r', name: XSS, requests: 4 }] } }, types: { reservation: 1 } },
  { module: 'vehicles', page: '/dashboard/voitures/statistiques/', extra: {}, types: { rental: 1, chauffeur: 1 } },
  { module: 'trips', page: '/dashboard/voyages/statistiques/', extra: { trips: { requestedSeats: 9, allocatedSeats: 4, historicalUnallocatedRequests: 2 } }, types: { seat: 1 } },
];
const UNAVAILABLE = [{ key: 'views', label: 'Vues', reason: 'Aucune collecte.' }];

function report(universe, period, listingId) {
  const days = period === 'today' ? 1 : Number(period);
  const total = (listingId ? 2 : 7) + days;
  const series = Array.from({ length: days }, (_, index) => ({ date: new Date(Date.UTC(2026, 9, 1 + index)).toISOString().slice(0, 10), requests: index === days - 1 ? total : 0, contacts: 0, inboundMessages: 0 }));
  return { module: universe.module, listingId: listingId || null, period: { key: period }, listings: { total: 2, deleted: 1, byStatus: { active: 2 } },
    options: [{ id: 'a', title: XSS, status: 'active', deleted: false }, { id: 'b', title: 'Autre', status: 'active', deleted: false }],
    requests: { total, accepted: 1, pending: 2, byStatus: { new: total - 1, accepted: 1 }, byType: universe.types },
    acceptanceRate: { accepted: 1, received: total, value: 1 / total }, contacts: { direct: 0, bySource: {} }, messages: { conversationsOpened: 0, inbound: 0 },
    requestsByListing: { a: total }, favorites: { inPeriod: 3, allTime: 5, byListing: { a: 3 } }, series, topListings: { rankedBy: 'requests', rows: [{ id: 'a', title: XSS, status: 'active', deleted: false, requests: total, contacts: 0, inboundMessages: 0 }] },
    activeWithoutActivity: listingId ? [] : [{ id: 'b', title: XSS }], unavailable: UNAVAILABLE, ...universe.extra };
}

test('statistics of the four universes: filters, true chart, states and no injection', { skip: !process.env.PENCMI_PLAYWRIGHT_MODULE, timeout: 300000 }, async () => {
  const { chromium } = await import(pathToFileURL(process.env.PENCMI_PLAYWRIGHT_MODULE).href);
  const root = resolve(import.meta.dirname, '..');
  let origin;
  const state = { mode: 'ok', queries: [] };
  const send = (res, data, status = 200, meta) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(status < 400 ? { success: true, data, ...(meta ? { meta } : {}) } : { success: false, error: { message: data } }));
  };
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    for await (const _ of req);
    try {
      if (url.pathname === '/config/runtime-config.js') {
        res.setHeader('Content-Type', 'text/javascript');
        return res.end(`window.PencmiRuntimeConfig={apiBaseUrl:${JSON.stringify(`${origin}/api/v1`)}};`);
      }
      if (url.pathname.startsWith('/api/v1')) {
        const path = url.pathname.slice('/api/v1'.length);
        if (path === '/dashboard/stats/report') {
          const universe = UNIVERSES.find((row) => row.module === url.searchParams.get('module'));
          state.queries.push(Object.fromEntries(url.searchParams));
          if (state.mode === 'error') return send(res, 'Service indisponible.', 503);
          if (state.mode === 'expired') return send(res, 'Session expirée.', 401);
          if (state.mode === 'none') return send(res, { ...report(universe, url.searchParams.get('period') || '30'), options: [], listings: { total: 0, deleted: 0, byStatus: {} } });
          if (state.mode === 'zero') {
            const base = report(universe, url.searchParams.get('period') || '30');
            return send(res, { ...base, requests: { total: 0, accepted: 0, pending: 0, byStatus: {}, byType: {} }, acceptanceRate: { accepted: 0, received: 0, value: null }, requestsByListing: {},
              series: base.series.map((row) => ({ ...row, requests: 0 })), topListings: { rankedBy: 'requests', rows: [] } });
          }
          return send(res, report(universe, url.searchParams.get('period') || '30', url.searchParams.get('listingId')));
        }
        if (path.startsWith('/auth/')) return send(res, 'Session expirée.', 401);
        if (path === '/dashboard/voyages/statistics') return send(res, { totalRequests: 0 });
        if (path === '/dashboard/immobilier') return send(res, [{ id: 'a', title: XSS, status: 'active', city: XSS, metadata: { views: 999, favorites: 999 } }], 200, { page: 1, limit: 20, total: 1, totalPages: 1 });
        if (path === '/dashboard/immobilier/visits') return send(res, [{ id: 'v', clientName: XSS, listing: { id: 'a', title: XSS }, status: 'new' }], 200, { page: 1, limit: 20, total: 1, totalPages: 1 });
        return send(res, [], 200, { page: 1, limit: 20, total: 0, totalPages: 1 });
      }
      let file = resolve(root, `.${decodeURIComponent(url.pathname)}`);
      assert.ok(file === root || file.startsWith(root + sep));
      if (!extname(file)) file = resolve(file, 'index.html');
      res.setHeader('Content-Type', TYPES[extname(file)] || 'application/octet-stream');
      return res.end(await readFile(file));
    } catch {
      res.statusCode = 404;
      return res.end('');
    }
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const noOverflow = async (page, label) => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `débordement : ${label}`);
  const session = () => { localStorage.setItem('pencmi_access_token', 'token'); localStorage.setItem('pencmi_refresh_token', 'refresh'); };
  try {
    for (const width of [360, 390, 768, 1280]) {
      for (const universe of UNIVERSES) {
        const label = `${universe.module} ${width}px`;
        const context = await browser.newContext({ viewport: { width, height: 800 } });
        await context.addInitScript(session);
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        state.mode = 'ok';
        state.queries.length = 0;
        await page.goto(origin + universe.page);
        await page.locator('.ps-kpis .kpi-value').first().waitFor();
        assert.equal(state.queries.at(-1).period, '30');
        assert.equal(state.queries.at(-1).ownerUserId, undefined);
        const text = () => page.locator('.ps-panel').innerText();
        assert.ok((await text()).includes('37'), `valeur 30 jours : ${label}`);
        assert.equal(await page.locator('.ps-chart').count(), 1);
        assert.equal(await page.locator('.ps-chart rect').count(), 1, 'une barre par jour réel, pas de courbe inventée');
        assert.equal(await page.getByText('Bloc graphique prévu').count(), 0);
        assert.ok((await text()).includes('Vues : Donnée indisponible'));
        assert.ok((await text()).includes('Favoris reçus'));
        assert.ok((await text()).includes('5 au total'));
        // The filters change the request and the figures.
        await page.locator('select[name=period]').selectOption('7');
        await page.waitForFunction(() => document.querySelector('.ps-kpis')?.textContent.includes('14'));
        assert.equal(state.queries.at(-1).period, '7');
        await page.locator('select[name=listingId]').selectOption('a');
        await page.waitForFunction(() => document.querySelector('.ps-kpis')?.textContent.includes('9'));
        assert.deepEqual([state.queries.at(-1).period, state.queries.at(-1).listingId], ['7', 'a']);
        assert.equal(await page.locator('select[name=listingId]').inputValue(), 'a');
        await page.locator('select[name=listingId]').selectOption('');
        await page.locator('select[name=period]').selectOption('today');
        await page.waitForFunction(() => document.querySelector('.ps-kpis')?.textContent.includes('8'));
        assert.equal(state.queries.at(-1).listingId, undefined);
        // Stored text stays text.
        assert.equal(await page.locator('.ps-panel img, .ps-panel b').count(), 0);
        assert.ok((await text()).includes('<b>piège</b>'));
        assert.equal(await page.evaluate(() => window.xss), undefined);
        await noOverflow(page, label);
        if (universe.module === 'trips') { assert.ok((await text()).includes('Places demandées')); assert.ok((await text()).includes('Places réservées')); }
        if (universe.module === 'hotels') { assert.ok((await text()).includes('Nuits réservées')); assert.ok(!(await text()).includes('Taux d’occupation\n0')); }
        // A true zero is a zero, with no chart and no invented rate.
        state.mode = 'zero';
        await page.locator('select[name=period]').selectOption('90');
        await page.getByText('Rien à signaler sur cette période', { exact: false }).waitFor();
        assert.equal(await page.locator('.ps-chart').count(), 0);
        assert.ok((await page.locator('.ps-kpis').innerText()).includes('Donnée indisponible'));
        // An error is never shown as zeros, and it can be retried.
        state.mode = 'error';
        await page.locator('select[name=period]').selectOption('30');
        await page.getByText('Service indisponible.').waitFor();
        assert.equal(await page.locator('.ps-kpis').count(), 0);
        state.mode = 'ok';
        await page.getByRole('button', { name: 'Réessayer' }).click();
        await page.locator('.ps-kpis .kpi-value').first().waitFor();
        // No listing at all.
        state.mode = 'none';
        await page.locator('select[name=period]').selectOption('7');
        await page.getByText('Aucune statistique pour le moment.').waitFor();
        // Expired session.
        state.mode = 'expired';
        await page.locator('select[name=period]').selectOption('30');
        await page.getByRole('link', { name: 'Se connecter' }).waitFor();
        await noOverflow(page, `session ${label}`);
        assert.deepEqual(errors, [], label);
        await context.close();
      }
    }
    // Real estate overview and favorites: no figure read from listing metadata.
    state.mode = 'ok';
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await context.addInitScript(session);
    const page = await context.newPage();
    state.queries.length = 0;
    await page.goto(`${origin}/dashboard/immobilier/`);
    await page.locator('.kpi-card').first().waitFor();
    const overview = await page.locator('.dashboard-main').innerText();
    assert.ok(!overview.includes('999'), 'les compteurs de metadata ne sont plus affichés');
    assert.ok(overview.includes('donnée indisponible'));
    assert.ok(overview.includes('5 au total'));
    assert.equal(await page.locator('.dashboard-main img[src="x"], .dashboard-main b').count(), 0);
    assert.equal(await page.evaluate(() => window.xss), undefined);
    await page.locator('[data-period-filter]').selectOption('7');
    await page.waitForFunction(() => document.querySelector('.kpi-grid')?.textContent.includes('14'));
    assert.equal(state.queries.at(-1).period, '7');
    await page.goto(`${origin}/dashboard/immobilier/favoris/`);
    await page.locator('.pm-table tbody tr').waitFor();
    assert.equal(await page.locator('.pm-table img, .pm-table b').count(), 0);
    assert.ok((await page.locator('#owner-favorites').innerText()).includes('5 au total'));
    assert.equal(await page.evaluate(() => window.xss), undefined);
    await context.close();
    // Without a session.
    const anonymous = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const blank = await anonymous.newPage();
    await blank.goto(origin + UNIVERSES[0].page);
    await blank.getByRole('link', { name: 'Se connecter' }).waitFor();
    await anonymous.close();
  } finally {
    await browser.close();
    await new Promise((done) => server.close(done));
  }
});

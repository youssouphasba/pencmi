import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve, sep, extname } from 'node:path';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const XSS = '<img src=x onerror="window.xss=1"><b>piège</b>';
const UNIVERSES = [
  { module: 'real_estate', detail: (id) => `/immobilier/annonce/?id=${id}`, api: '/immobilier', search: '/immobilier/?city=Dakar', favorites: '/favoris/immobilier/', alerts: '/immobilier/alertes/', field: ['city', 'Saly'], filter: { city: 'Dakar' },
    listing: (id) => ({ id, title: XSS, status: 'active', city: 'Dakar', metadata: { photos: [], contactPreferences: {} }, owner: { id: 'owner' } }) },
  { module: 'hotels', detail: (id) => `/hotels/detail/?id=${id}`, api: '/hotels', search: '/hotels/?city=Dakar', favorites: '/favoris/hotels/', alerts: '/hotels/alertes/', field: ['city', 'Saly'], filter: { city: 'Dakar' },
    listing: (id) => ({ id, name: XSS, status: 'active', city: 'Dakar', rooms: [], metadata: { photos: [], contactPreferences: {} }, owner: { id: 'owner' } }) },
  { module: 'vehicles', detail: (id) => `/voitures/detail/?id=${id}`, api: '/voitures', search: '/voitures/?brand=Toyota&maxPrice=9000', favorites: '/favoris/voitures/', alerts: '/voitures/alertes/', field: ['brand', 'Kia'], filter: { brand: 'Toyota', maxPrice: 9000 },
    listing: (id) => ({ id, title: XSS, status: 'active', city: 'Dakar', vehicleMode: 'sale', metadata: { photos: [], contactPreferences: {} }, owner: { id: 'owner' } }) },
  { module: 'trips', detail: (id) => `/voyages/detail/?id=${id}`, api: '/voyages', search: '/voyages/?depart=Dakar&arrivee=Touba&passengers=1', favorites: '/favoris/voyages/', alerts: '/voyages/alertes/', field: ['departureCity', 'Thiès'], filter: { departureCity: 'Dakar', arrivalCity: 'Touba' },
    listing: (id) => ({ id, title: XSS, status: 'active', departureCity: 'Dakar', arrivalCity: 'Touba', vehicleType: 'bus', metadata: { contactPreferences: {} }, owner: { id: 'owner' } }) },
];

test('favorites and alerts in the four universes, at the four widths', { skip: !process.env.PENCMI_PLAYWRIGHT_MODULE, timeout: 300000 }, async () => {
  const { chromium } = await import(pathToFileURL(process.env.PENCMI_PLAYWRIGHT_MODULE).href);
  const root = resolve(import.meta.dirname, '..');
  let origin;
  const state = { favorites: new Map(), alerts: new Map(), notifications: [], processor: false, seq: 0, puts: [] };
  const send = (res, data, status = 200, meta) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(status < 400 ? { success: true, data, ...(meta ? { meta } : {}) } : { success: false, error: { message: data } }));
  };
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : undefined;
    try {
      if (url.pathname === '/config/runtime-config.js') {
        res.setHeader('Content-Type', 'text/javascript');
        return res.end(`window.PencmiRuntimeConfig={apiBaseUrl:${JSON.stringify(`${origin}/api/v1`)}};`);
      }
      if (url.pathname.startsWith('/api/v1')) {
        const path = url.pathname.slice('/api/v1'.length);
        if (path === '/favorites/check') return send(res, { favorites: url.searchParams.get('ids').split(',').filter((id) => state.favorites.has(`${url.searchParams.get('module')}:${id}`)) });
        if (path === '/favorites') {
          const rows = [...state.favorites.values()].filter((row) => !url.searchParams.get('module') || row.module === url.searchParams.get('module'));
          return send(res, rows, 200, { page: 1, limit: 20, total: rows.length, totalPages: 1 });
        }
        const favorite = path.match(/^\/favorites\/([^/]+)\/([^/]+)$/);
        if (favorite) {
          const key = `${favorite[1]}:${favorite[2]}`;
          if (req.method === 'PUT') {
            state.puts.push(key);
            state.favorites.set(key, { module: favorite[1], listingId: favorite[2], available: !favorite[2].startsWith('off'), title: favorite[2].startsWith('off') ? null : XSS, city: favorite[2].startsWith('off') ? null : XSS, price: favorite[2].startsWith('off') ? null : 5000, currency: 'FCFA', category: null, url: favorite[2].startsWith('off') ? null : `/x/${favorite[2]}`, photo: null, nextDeparture: null, addedAt: new Date().toISOString() });
          } else state.favorites.delete(key);
          return send(res, { favorite: req.method === 'PUT' });
        }
        if (path === '/saved-alerts/capabilities') return send(res, { internalNotifications: state.processor, emailNotifications: false });
        if (path === '/saved-alerts' && req.method === 'POST') {
          if (!Object.keys(body.filters).length) return send(res, 'Indiquez au moins un critère.', 400);
          const row = { id: `a${++state.seq}`, module: body.module, name: body.name, filters: body.filters, active: true, usable: true, searchUrl: '/x', createdAt: new Date().toISOString() };
          state.alerts.set(row.id, row);
          return send(res, row, 201);
        }
        if (path === '/saved-alerts') {
          const rows = [...state.alerts.values()].filter((row) => !url.searchParams.get('module') || row.module === url.searchParams.get('module'));
          return send(res, rows, 200, { page: 1, limit: 20, total: rows.length, totalPages: 1 });
        }
        const alert = path.match(/^\/saved-alerts\/([^/]+)(\/matches)?$/);
        if (alert) {
          if (alert[2]) return send(res, [{ listingId: 'm1', available: true, title: XSS, url: '/x/m1' }], 200, { page: 1, limit: 10, total: 1, totalPages: 1 });
          if (req.method === 'DELETE') { state.alerts.delete(alert[1]); return send(res, { deleted: true }); }
          Object.assign(state.alerts.get(alert[1]), body);
          return send(res, state.alerts.get(alert[1]));
        }
        if (path === '/notifications/read-all') { state.notifications.forEach((row) => { row.status = 'read'; }); return send(res, { count: 1 }); }
        if (path === '/notifications') return send(res, state.notifications);
        const notice = path.match(/^\/notifications\/([^/]+)\/read$/);
        if (notice) { state.notifications.find((row) => row.id === notice[1]).status = 'read'; return send(res, { count: 1 }); }
        for (const universe of UNIVERSES) {
          if (path === universe.api) return send(res, [universe.listing('card1')], 200, { page: 1, limit: 20, total: 1, totalPages: 1 });
          if (path.startsWith(`${universe.api}/`)) return send(res, universe.listing(path.slice(universe.api.length + 1)));
        }
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
        const listingId = `l-${universe.module}`;
        const key = `${universe.module}:${listingId}`;
        // Anonymous: a sign-in link back to the listing, and no fictional access.
        const anonymous = await browser.newContext({ viewport: { width, height: 800 } });
        const blank = await anonymous.newPage();
        state.puts.length = 0;
        await blank.goto(origin + universe.detail(listingId));
        const signIn = blank.getByRole('link', { name: /Ajouter aux favoris/ });
        await signIn.waitFor();
        assert.equal(new URL(await signIn.getAttribute('href'), origin).searchParams.get('next'), universe.detail(listingId), label);
        for (const path of [universe.favorites, universe.alerts]) {
          await blank.goto(origin + path);
          await blank.locator('.pm-panel').getByRole('link', { name: 'Se connecter', exact: true }).waitFor();
        }
        assert.equal(state.puts.length, 0, 'aucun enregistrement sans session');
        await anonymous.close();

        const context = await browser.newContext({ viewport: { width, height: 800 } });
        await context.addInitScript(session);
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', (error) => errors.push(error.message));
        // Listing page: failure, safe retry, double click, reload.
        await page.goto(origin + universe.detail(listingId));
        const button = page.locator(`[data-favorite-id="${listingId}"] button`);
        await button.waitFor();
        assert.equal(await button.getAttribute('aria-pressed'), 'false');
        await page.route(`**/api/v1/favorites/${universe.module}/${listingId}`, (route) => route.abort(), { times: 1 });
        await button.click();
        await page.locator(`[data-favorite-id="${listingId}"] .pm-error`).waitFor();
        assert.equal(await button.getAttribute('aria-pressed'), 'false', 'aucun faux succès');
        assert.equal(state.favorites.has(key), false);
        await button.click();
        await page.waitForFunction((id) => document.querySelector(`[data-favorite-id="${id}"] button`)?.getAttribute('aria-pressed') === 'true', listingId);
        assert.ok(state.favorites.has(key));
        await page.reload();
        await page.waitForFunction((id) => document.querySelector(`[data-favorite-id="${id}"] button`)?.getAttribute('aria-pressed') === 'true', listingId);
        await noOverflow(page, `fiche ${label}`);
        // Search page: the card button, and saving the search actually selected.
        state.alerts.clear();
        await page.goto(origin + universe.search);
        await page.locator('[data-favorite-id="card1"] button').waitFor();
        await page.locator('[data-favorite-id="card1"] button').click();
        await page.waitForFunction(() => document.querySelector('[data-favorite-id="card1"] button')?.getAttribute('aria-pressed') === 'true');
        await page.getByRole('button', { name: 'Enregistrer cette recherche' }).click();
        await page.getByText('Recherche enregistrée dans vos alertes.').waitFor();
        const saved = [...state.alerts.values()][0];
        assert.equal(saved.module, universe.module);
        assert.deepEqual(saved.filters, universe.filter, `critères de la recherche : ${label}`);
        await noOverflow(page, `recherche ${label}`);
        assert.equal(await page.evaluate(() => window.xss), undefined);
        // Favorites page: real rows, an unavailable one, removal.
        state.favorites.set(`${universe.module}:off1`, { module: universe.module, listingId: 'off1', available: false, title: null, city: null, price: null, url: null, photo: null, addedAt: new Date().toISOString() });
        await page.goto(origin + universe.favorites);
        await page.getByRole('heading', { name: 'Annonce indisponible' }).waitFor();
        assert.equal(await page.locator('.sv-list img, .sv-list b').count(), 0);
        assert.ok((await page.locator('.sv-page').innerText()).includes('<b>piège</b>'));
        const unavailable = page.locator('.sv-card', { hasText: 'Annonce indisponible' });
        assert.equal(await unavailable.getByRole('link').count(), 0);
        await unavailable.getByRole('button', { name: 'Retirer des favoris' }).click();
        await page.waitForFunction(() => !document.querySelector('.sv-page').textContent.includes('Annonce indisponible'));
        assert.equal(state.favorites.has(`${universe.module}:off1`), false);
        await noOverflow(page, `favoris ${label}`);
        // Alerts page: no promise that does not exist, validation, create, edit, pause, results, delete.
        state.alerts.clear();
        await page.goto(origin + universe.alerts);
        await page.getByText('Les notifications automatiques ne sont pas encore activées', { exact: false }).waitFor();
        const text = await page.locator('.sv-page').innerText();
        for (const promise of ['Immédiatement', 'Chaque jour', 'Chaque semaine']) assert.ok(!text.includes(promise), promise);
        const form = page.locator('form.sv-form');
        await form.locator('[name=name]').fill('Ma recherche');
        await form.locator('[type=submit]').click();
        await form.locator('.pm-error').waitFor();
        assert.equal(state.alerts.size, 0);
        await form.locator(`[name=${universe.field[0]}]`).fill(universe.field[1]);
        await form.locator('[type=submit]').click();
        const card = page.locator('.sv-card', { hasText: 'Ma recherche' });
        await card.waitFor();
        assert.deepEqual([...state.alerts.values()][0].filters, { [universe.field[0]]: universe.field[1] });
        await card.getByRole('button', { name: 'Voir les résultats' }).click();
        await card.locator('a', { hasText: 'piège' }).waitFor();
        await card.getByRole('button', { name: 'Voir les résultats' }).click();
        await card.locator('a', { hasText: 'piège' }).waitFor();
        assert.equal(await card.locator('img, b').count(), 0);
        await card.getByRole('button', { name: 'Mettre en pause' }).click();
        await page.locator('.sv-card', { hasText: 'En pause' }).waitFor();
        assert.equal([...state.alerts.values()][0].active, false);
        await page.locator('.sv-card').getByRole('button', { name: 'Modifier' }).click();
        await page.getByRole('heading', { name: 'Modifier l’alerte' }).waitFor();
        assert.equal(await page.locator(`form.sv-form [name=${universe.field[0]}]`).inputValue(), universe.field[1]);
        await page.locator('form.sv-form [name=name]').fill('Renommée');
        await page.locator('form.sv-form [type=submit]').click();
        await page.locator('.sv-card', { hasText: 'Renommée' }).waitFor();
        await noOverflow(page, `alertes ${label}`);
        await page.locator('.sv-card').getByRole('button', { name: 'Supprimer' }).click();
        await page.getByText('Vous n’avez aucune alerte pour le moment.').waitFor();
        assert.equal(state.alerts.size, 0);
        assert.equal(await page.evaluate(() => window.xss), undefined);
        assert.deepEqual(errors, [], label);
        await context.close();
      }
      // Account pages, across universes.
      const context = await browser.newContext({ viewport: { width, height: 800 } });
      await context.addInitScript(session);
      const page = await context.newPage();
      state.processor = true;
      await page.goto(`${origin}/compte/favoris/`);
      await page.locator('.sv-card').first().waitFor();
      await page.locator('select[name=module]').selectOption('hotels');
      await page.waitForFunction(() => { const cards = [...document.querySelectorAll('.sv-badge')].map((node) => node.textContent); return cards.length && cards.every((text) => text === 'Hôtels'); });
      await noOverflow(page, `compte favoris ${width}`);
      state.alerts.set('h', { id: 'h', module: 'hotels', name: 'Saly', filters: { city: 'Saly' }, active: true, usable: true, searchUrl: '/hotels?city=Saly' });
      state.alerts.set('v', { id: 'v', module: 'vehicles', name: XSS, filters: { brand: XSS }, active: true, usable: true, searchUrl: 'javascript:alert(1)' });
      await page.goto(`${origin}/compte/alertes/`);
      await page.getByText('Vous recevez une notification dans votre compte', { exact: false }).waitFor();
      await page.locator('.sv-card', { hasText: 'Saly' }).waitFor();
      assert.equal(await page.locator('.sv-card img, .sv-card b').count(), 0);
      assert.equal(await page.locator('a[href^="javascript"]').count(), 0);
      await noOverflow(page, `compte alertes ${width}`);
      state.notifications = [
        { id: 'n1', status: 'unread', title: XSS, message: XSS, targetUrl: '/voitures/detail/?id=v1', createdAt: new Date().toISOString() },
        { id: 'n2', status: 'unread', title: 'Autre', message: 'Lien refusé', targetUrl: '//evil.example', createdAt: new Date().toISOString() },
      ];
      await page.goto(`${origin}/compte/notifications/`);
      await page.locator('.sv-unread').first().waitFor();
      assert.equal(await page.locator('.sv-card img, .sv-card b').count(), 0);
      assert.equal(await page.getByRole('link', { name: 'Ouvrir' }).count(), 1);
      await page.locator('.sv-card', { hasText: 'Autre' }).getByRole('button', { name: 'Marquer comme lu' }).click();
      await page.waitForFunction(() => document.querySelectorAll('.sv-unread').length === 1);
      await page.getByRole('button', { name: 'Tout marquer comme lu' }).click();
      await page.waitForFunction(() => document.querySelectorAll('.sv-unread').length === 0);
      await noOverflow(page, `compte notifications ${width}`);
      await context.close();
      state.processor = false;
      state.favorites.clear();
      state.alerts.clear();
      state.notifications = [];
    }
  } finally {
    await browser.close();
    await new Promise((done) => server.close(done));
  }
});

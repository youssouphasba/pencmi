import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve, sep, extname } from 'node:path';

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
const XSS = '<img src=x onerror="window.xss=1"><b>piège</b>';
const preferences = (enabled) => ({ publication: { contactPreferences: { internalMessagingEnabled: enabled } } });

const UNIVERSES = [
  { module: 'real_estate', detail: (id) => `/immobilier/annonce/?id=${id}`, api: '/immobilier/', dashboard: '/dashboard/immobilier',
    listing: (id, enabled) => ({ id, title: 'Villa', status: 'active', city: 'Dakar', metadata: { photos: [], contactPreferences: { internalMessagingEnabled: enabled } }, owner: { id: 'owner' } }) },
  { module: 'hotels', detail: (id) => `/hotels/detail/?id=${id}`, api: '/hotels/', dashboard: '/dashboard/hotels',
    listing: (id, enabled) => ({ id, name: 'Hôtel', status: 'active', city: 'Dakar', rooms: [], metadata: { photos: [], contactPreferences: { internalMessagingEnabled: enabled } }, owner: { id: 'owner' } }) },
  { module: 'vehicles', detail: (id) => `/voitures/detail/?id=${id}`, api: '/voitures/', dashboard: '/dashboard/voitures',
    listing: (id, enabled) => ({ id, title: 'Corolla', status: 'active', city: 'Dakar', vehicleMode: 'sale', metadata: { photos: [], contactPreferences: { internalMessagingEnabled: enabled } }, owner: { id: 'owner' } }) },
  { module: 'trips', detail: (id) => `/voyages/detail/?id=${id}`, api: '/voyages/', dashboard: '/dashboard/voyages',
    listing: (id, enabled) => ({ id, title: 'Dakar Touba', status: 'active', departureCity: 'Dakar', arrivalCity: 'Touba', vehicleType: 'bus', metadata: { contactPreferences: { internalMessagingEnabled: enabled } }, owner: { id: 'owner' } }) },
];

test('messages and contacts in the four universes, at the four widths', { skip: !process.env.PENCMI_PLAYWRIGHT_MODULE, timeout: 300000 }, async () => {
  const { chromium } = await import(pathToFileURL(process.env.PENCMI_PLAYWRIGHT_MODULE).href);
  const root = resolve(import.meta.dirname, '..');
  let origin;
  const state = { conversations: new Map(), opens: [], reads: [], sends: [], contactQueries: [] };
  const send = (res, data, status = 200, meta) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(status < 400 ? { success: true, data, ...(meta ? { meta } : {}) } : { success: false, error: { message: data } }));
  };
  const view = (row) => ({ id: row.id, module: row.module, targetId: row.targetId, listingTitle: XSS, counterpartName: 'Awa <i>Diop</i>', updatedAt: new Date().toISOString(),
    messages: row.messages, unreadCount: row.unread, hasOlderMessages: false });
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
        if (path === '/messages/conversations/by-listing') {
          const row = [...state.conversations.values()].find((item) => item.targetId === url.searchParams.get('listingId'));
          return send(res, row ? view(row) : null);
        }
        if (path === '/messages/conversations' && req.method === 'POST') {
          state.opens.push(body);
          const id = `c_${body.listingId}`;
          const row = state.conversations.get(id) ?? { id, module: body.module, targetId: body.listingId, messages: [], unread: 1 };
          state.conversations.set(id, row);
          const message = row.messages.find((item) => item.id === body.requestId) ?? { id: body.requestId, body: body.body, createdAt: new Date().toISOString(), mine: true };
          if (!row.messages.includes(message)) row.messages.push(message);
          return send(res, { conversationId: id, created: true, message }, 201);
        }
        if (path === '/messages/conversations') {
          const rows = [...state.conversations.values()].filter((row) => !url.searchParams.get('module') || row.module === url.searchParams.get('module'));
          return send(res, rows.map(view), 200, { page: 1, limit: 20, total: rows.length, totalPages: 1 });
        }
        const match = path.match(/^\/messages\/conversations\/([^/]+)(\/read|\/messages)?$/);
        if (match) {
          const row = state.conversations.get(match[1]);
          if (!row) return send(res, 'Accès non autorisé.', 403);
          if (match[2] === '/read') { state.reads.push(row.id); row.unread = 0; return send(res, { lastReadAt: new Date().toISOString() }); }
          if (match[2] === '/messages') {
            state.sends.push(body);
              const message = row.messages.find((item) => item.id === body.requestId) ?? { id: body.requestId, body: body.body, createdAt: new Date().toISOString(), mine: true };
            if (!row.messages.includes(message)) row.messages.push(message);
            return send(res, message, 201);
          }
          return send(res, view(row));
        }
        if (path === '/dashboard/contacts') {
          state.contactQueries.push(Object.fromEntries(url.searchParams));
          const page = Number(url.searchParams.get('page') || 1);
          return send(res, [{ id: `e${page}`, module: url.searchParams.get('module'), source: url.searchParams.get('source') || 'internal_message', listingTitle: XSS, createdAt: new Date().toISOString(),
            details: { clientName: `Client page ${page} ${XSS}`, conversationId: 'c_x', message: XSS } }], 200, { page, limit: 20, total: 130, totalPages: 7 });
        }
        for (const universe of UNIVERSES)
          if (path.startsWith(universe.api) && !path.startsWith('/dashboard')) {
            const id = path.slice(universe.api.length);
            return send(res, universe.listing(id, !id.startsWith('off')));
          }
        if (path === '/dashboard/voyages/statistics') return send(res, { totalRequests: 0 });
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
  const noOverflow = async (page, label) => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `débordement horizontal : ${label}`);
  try {
    for (const width of [360, 390, 768, 1280]) {
      for (const universe of UNIVERSES) {
        const label = `${universe.module} ${width}px`;
        const listingId = `l-${universe.module}-${width}`;
        const context = await browser.newContext({ viewport: { width, height: 800 } });
        const errors = [];
        // Anonymous: a sign-in link back to the listing, and no message form.
        let page = await context.newPage();
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(origin + universe.detail(listingId));
        const signIn = page.getByRole('link', { name: 'Se connecter pour envoyer un message' });
        await signIn.waitFor();
        const next = new URL(await signIn.getAttribute('href'), origin).searchParams.get('next');
        assert.equal(next, universe.detail(listingId), label);
        await page.goto(origin + universe.detail('off-channel'));
        await page.locator('h1').first().waitFor();
        await page.waitForTimeout(150);
        assert.equal(await page.getByText('envoyer un message', { exact: false }).count(), 0, `canal fermé, anonyme : ${label}`);
        await page.close();

        await context.addInitScript(() => { localStorage.setItem('pencmi_access_token', 'token'); localStorage.setItem('pencmi_refresh_token', 'refresh'); });
        page = await context.newPage();
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(origin + universe.detail('off-channel'));
        await page.locator('h1').first().waitFor();
        await page.waitForTimeout(150);
        assert.equal(await page.getByRole('button', { name: 'Envoyer un message' }).count(), 0, `canal fermé : ${label}`);

        // Connected: a lost response is retried with the same id, and a double click sends once.
        await page.goto(origin + universe.detail(listingId));
        await page.getByRole('button', { name: 'Envoyer un message' }).click();
        const dialog = page.locator('dialog.pm-dialog');
        await dialog.getByText('Votre premier message', { exact: false }).waitFor();
        state.opens.length = 0;
        const lostOpen = [];
        await page.route('**/api/v1/messages/conversations', (route) => { lostOpen.push(route.request().postDataJSON()); return route.abort(); }, { times: 1 });
        await dialog.locator('textarea').fill(XSS);
        await dialog.locator('[type=submit]').click();
        await dialog.locator('.pm-form .pm-error').waitFor();
        assert.equal(await dialog.locator('textarea').inputValue(), XSS, 'le texte reste après une erreur');
        assert.equal(await dialog.getByText('Message envoyé.').count(), 0, 'aucun faux succès');
        await dialog.locator('[type=submit]').dblclick();
        await dialog.getByText('Message envoyé.').waitFor();
        assert.equal(lostOpen.length, 1);
        assert.equal(state.opens.length, 1, `un seul envoi après l’erreur, malgré le double clic : ${label}`);
        assert.equal(lostOpen[0].requestId, state.opens[0].requestId);
        assert.equal(state.opens[0].module, universe.module);
        assert.equal(await dialog.locator('.pm-message-body img, .pm-message-body b').count(), 0);
        assert.equal(await dialog.locator('.pm-message-body').first().textContent(), XSS);
        await noOverflow(page, `fiche ${label}`);
        await dialog.getByRole('button', { name: 'Fermer' }).click();
        // After a reload, the message comes back from the API.
        await page.reload();
        await page.getByRole('button', { name: 'Envoyer un message' }).click();
        await page.locator('dialog.pm-dialog .pm-message-body').first().waitFor();
        assert.ok(state.reads.includes(`c_${listingId}`));
        await page.close();

        // Advertiser inbox of this universe.
        page = await context.newPage();
        page.on('pageerror', (error) => errors.push(error.message));
        state.conversations.get(`c_${listingId}`).unread = 2;
        await page.goto(`${origin}${universe.dashboard}/messages/`);
        const item = page.locator(`.pm-conversation`).first();
        await item.waitFor();
        await page.locator('.pm-unread').first().waitFor();
        assert.equal(await page.locator('.pm-conversation-title img, .pm-preview b').count(), 0);
        await noOverflow(page, `boîte ${label}`);
        await item.click();
        const reply = page.locator('.pm-thread .pm-form');
        await reply.locator('textarea').waitFor();
        state.sends.length = 0;
        const lostReply = [];
        await page.route('**/api/v1/messages/conversations/*/messages', (route) => { lostReply.push(route.request().postDataJSON()); return route.abort(); }, { times: 1 });
        await reply.locator('textarea').fill('Réponse réelle');
        await reply.locator('[type=submit]').click();
        await reply.locator('.pm-error').waitFor();
        await reply.locator('[type=submit]').click();
        await page.locator('.pm-thread .pm-message-body', { hasText: 'Réponse réelle' }).waitFor();
        assert.equal(state.sends.length, 1);
        assert.equal(lostReply[0].requestId, state.sends[0].requestId);
        assert.equal(await page.locator('.pm-thread .pm-message-body', { hasText: 'Réponse réelle' }).count(), 1);
        await noOverflow(page, `conversation ${label}`);
        if (width < 768) {
          await page.getByRole('button', { name: 'Retour à la liste' }).click();
          await page.locator('.pm-conversation').first().waitFor();
        }
        assert.equal(await page.evaluate(() => window.xss), undefined);
        await page.close();

        // Contacts: real source, server pagination, escaped content.
        page = await context.newPage();
        page.on('pageerror', (error) => errors.push(error.message));
        state.contactQueries.length = 0;
        await page.goto(`${origin}${universe.dashboard}/contacts/`);
        await page.locator('.pm-table tbody tr').first().waitFor();
        assert.equal(await page.locator('.pm-table img, .pm-table b').count(), 0);
        assert.ok((await page.locator('.pm-contacts').innerText()).includes('130 contacts'));
        await page.getByRole('button', { name: 'Suivant', exact: true }).click();
        await page.getByText('Client page 2', { exact: false }).waitFor();
        assert.equal(state.contactQueries.at(-1).page, '2');
        assert.equal(state.contactQueries.at(-1).module, universe.module);
        await page.locator('select[name=source]').selectOption('internal_message');
        await page.getByText('Page 1 sur 7').waitFor();
        await noOverflow(page, `contacts ${label}`);
        assert.equal(await page.evaluate(() => window.xss), undefined);
        await page.close();
        assert.deepEqual(errors, [], label);
        await context.close();
      }
      // Client inbox: every universe, from the account.
      const context = await browser.newContext({ viewport: { width, height: 800 } });
      await context.addInitScript(() => { localStorage.setItem('pencmi_access_token', 'token'); localStorage.setItem('pencmi_refresh_token', 'refresh'); });
      const page = await context.newPage();
      await page.goto(`${origin}/compte/messages/`);
      await page.locator('.pm-conversation').first().waitFor();
      await page.locator('select[name=module]').selectOption('hotels');
      await page.waitForFunction(() => document.querySelector('.pm-list').textContent.includes('Hôtels'));
      await noOverflow(page, `compte ${width}px`);
      await context.close();
      state.conversations.clear();
    }
    // Without a session, the dashboards ask to sign in rather than showing an empty success.
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await page.goto(`${origin}/dashboard/immobilier/messages/`);
    await page.getByRole('link', { name: 'Se connecter' }).waitFor();
    await context.close();
  } finally {
    await browser.close();
    await new Promise((done) => server.close(done));
  }
});

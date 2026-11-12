import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

test('admin accounts: filters, suspension with reason, conflict and reactivation on mobile and desktop', {
  skip: !process.env.PENCMI_PLAYWRIGHT_MODULE, timeout: 90000,
}, async () => {
  const { chromium } = await import(pathToFileURL(process.env.PENCMI_PLAYWRIGHT_MODULE).href);
  const root = resolve(import.meta.dirname, '..');
  let origin, users, calls, conflict;
  const server = createServer(async (req, res) => {
    try {
      const { pathname } = new URL(req.url, origin);
      if (pathname === '/config/runtime-config.js') {
        res.setHeader('Content-Type', 'text/javascript');
        return res.end(`window.PencmiRuntimeConfig={apiBaseUrl:${JSON.stringify(origin + '/api/v1')}}`);
      }
      if (pathname.startsWith('/api/v1/')) {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const body = chunks.length ? JSON.parse(Buffer.concat(chunks)) : {};
        const respond = data => res.end(JSON.stringify({ success: true, data }));
        res.setHeader('Content-Type', 'application/json');
        if (pathname === '/api/v1/auth/me') return respond({ id: 'admin-1', role: 'admin' });
        if (pathname === '/api/v1/admin/overview') return respond({ users: users.length });
        if (pathname === '/api/v1/admin/users') return respond(users);
        const id = pathname.match(/^\/api\/v1\/admin\/users\/([^/]+)\/status$/)?.[1];
        if (id && req.method === 'PATCH') {
          calls.push({ id, ...body });
          if (conflict) {
            conflict = false; res.writeHead(409);
            return res.end(JSON.stringify({ error: { message: 'Le statut du compte a changé. Actualisez la liste.' } }));
          }
          users.find(user => user.id === id).status = body.status;
          return respond({ id, status: body.status, listingsChanged: 2 });
        }
        res.writeHead(404); return res.end();
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
    for (const width of [360, 1440]) {
      calls = []; conflict = true;
      users = [
        { id: 'admin-1', firstName: 'Awa', lastName: 'Admin', role: 'admin', status: 'active', email: 'awa@example.test', createdAt: '2026-01-02T10:00:00Z' },
        { id: 'pro-1', firstName: '<img src=x onerror=alert(1)>', lastName: 'Diop', role: 'hotel_manager', status: 'active', email: 'diop@example.test', createdAt: '2026-02-02T10:00:00Z' },
        { id: 'client-1', firstName: 'Moussa', lastName: 'Fall', role: 'client', status: 'suspended', phone: '+221770000000', createdAt: '2026-03-02T10:00:00Z' },
      ];
      const page = await browser.newPage({ viewport: { width, height: 800 } });
      page.setDefaultTimeout(10000);
      await page.addInitScript(token => localStorage.setItem('pencmi_access_token', token), randomUUID());
      await page.goto(`${origin}/admin/users/`);
      await page.getByText('3 comptes sur 3', { exact: true }).waitFor();
      assert.equal(await page.locator('img[src=x]').count(), 0);
      // An administrator account offers no decision.
      assert.equal(await page.getByRole('row', { name: /Awa Admin/ }).getByRole('button').count(), 0);

      await page.getByLabel('Statut').selectOption('suspended');
      await page.getByText('1 compte sur 3', { exact: true }).waitFor();
      await page.getByLabel('Statut').selectOption('');
      await page.getByLabel('Recherche').fill('diop@');
      await page.getByText('1 compte sur 3', { exact: true }).waitFor();

      await page.getByRole('button', { name: 'Suspendre', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('button', { name: 'Suspendre le compte' }).click();
      assert.equal(calls.length, 0, 'a suspension is never sent without a reason');
      await dialog.getByLabel('Motif (obligatoire)').fill('Fausses annonces répétées');
      await dialog.getByRole('button', { name: 'Suspendre le compte' }).click();
      await dialog.getByText('Le statut du compte a changé. Actualisez la liste.', { exact: true }).waitFor();
      assert.equal(await dialog.getByLabel('Motif (obligatoire)').inputValue(), 'Fausses annonces répétées');
      await dialog.getByRole('button', { name: 'Suspendre le compte' }).click();
      await page.getByText(/compte suspendu\. 2 annonces retirées du site\./).waitFor();
      assert.deepEqual(calls.at(-1), { id: 'pro-1', status: 'suspended', reason: 'Fausses annonces répétées' });

      await page.getByRole('button', { name: 'Réactiver', exact: true }).click();
      await dialog.getByRole('button', { name: 'Réactiver le compte' }).click();
      await page.getByText(/compte réactivé\. 2 annonces remises en ligne\./).waitFor();
      assert.deepEqual(calls.at(-1), { id: 'pro-1', status: 'active' });
      await page.getByRole('button', { name: 'Suspendre', exact: true }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await page.close();
    }
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise(done => server.close(done));
  }
});

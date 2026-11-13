import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

test('assistant consent, confirmation, safe rendering and network recovery on mobile and desktop', {
  skip: !process.env.PENCMI_PLAYWRIGHT_MODULE, timeout: 90000,
}, async () => {
  const { chromium } = await import(pathToFileURL(process.env.PENCMI_PLAYWRIGHT_MODULE).href);
  const root = resolve(import.meta.dirname, '..');
  let origin, confirmations = 0, calls = 0, fail = false;
  const server = createServer(async (req, res) => {
    try {
      const { pathname } = new URL(req.url, origin);
      if (pathname === '/config/runtime-config.js') {
        res.setHeader('Content-Type', 'text/javascript');
        return res.end(`window.PencmiRuntimeConfig={apiBaseUrl:${JSON.stringify(origin + '/api/v1')}}`);
      }
      if (pathname.startsWith('/api/v1/')) {
        res.setHeader('Content-Type', 'application/json');
        const respond = data => res.end(JSON.stringify({ success: true, data }));
        if (pathname.endsWith('/auth/me')) return respond({ role: 'admin' });
        if (pathname.endsWith('/assistant/capabilities')) return respond({ enabled: true });
        if (pathname.endsWith('/assistant/chat')) {
          calls++;
          if (fail) { res.writeHead(503); return res.end(JSON.stringify({ error: { message: 'Service indisponible' } })); }
          return respond({ kind: 'proposal', label: 'Créer un ticket', args: { subject: '<img src=x onerror=alert(1)>', body: 'Demande' }, confirmation: randomUUID(), expiresAt: new Date(Date.now() + 300000).toISOString() });
        }
        if (pathname.endsWith('/assistant/confirm')) { confirmations++; return respond({ kind: 'result', label: 'Ticket', completed: true, result: { data: { status: 'open' } } }); }
        res.writeHead(404); return res.end();
      }
      const file = resolve(root, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
      if (!file.startsWith(root + sep) || /[/\\](backend|node_modules|\.git)[/\\]/.test(file)) throw Error();
      const bytes = await readFile(file);
      res.setHeader('Content-Type', /\.m?js$/.test(file) ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
      res.end(bytes);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    for (const width of [360, 1440]) {
      confirmations = 0; calls = 0; fail = false;
      const page = await browser.newPage({ viewport: { width, height: 800 } });
      page.setDefaultTimeout(10000);
      await page.addInitScript(token => localStorage.setItem('pencmi_access_token', token), randomUUID());
      await page.goto(origin + '/assistant/');
      const input = page.getByLabel('Votre demande');
      await input.fill('Créer un ticket');
      await page.getByRole('button', { name: 'Envoyer', exact: true }).click();
      assert.equal(calls, 0);
      await page.getByRole('checkbox').check();
      await page.getByRole('button', { name: 'Envoyer', exact: true }).click();
      await page.getByText('<img src=x onerror=alert(1)>', { exact: true }).waitFor();
      assert.equal(await page.locator('img[src=x]').count(), 0);
      assert.equal(confirmations, 0);
      await page.getByRole('button', { name: 'Confirmer cette action' }).click();
      await page.getByRole('heading', { name: 'Ticket', exact: true }).waitFor();
      assert.equal(confirmations, 1);
      assert.equal(await page.getByRole('button', { name: 'Confirmer cette action' }).count(), 0);
      fail = true;
      await input.fill('Ma saisie conservée');
      await page.getByRole('button', { name: 'Envoyer', exact: true }).click();
      await page.getByText('Service indisponible', { exact: true }).waitFor();
      assert.equal(await input.inputValue(), 'Ma saisie conservée');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await page.screenshot({ path: resolve(process.env.TEMP || root, `pencmi-assistant-${width}.png`), fullPage: true });
      await page.close();
    }
  } finally {
    await browser?.close(); server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

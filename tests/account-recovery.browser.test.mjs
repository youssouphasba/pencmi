import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

test('recovery forms: unavailable mode, anonymous requests, retry, secret-free URL and confirmed success', {
  skip: !process.env.PENCMI_PLAYWRIGHT_MODULE, timeout: 120000,
}, async () => {
  const { chromium } = await import(pathToFileURL(process.env.PENCMI_PLAYWRIGHT_MODULE).href);
  const root = resolve(import.meta.dirname, '..');
  let origin, enabled = false, fail = false;
  const calls = [];
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/config/runtime-config.js') {
        res.setHeader('Content-Type', 'text/javascript');
        return res.end(`window.PencmiRuntimeConfig={apiBaseUrl:${JSON.stringify(`${origin}/api/v1`)}}`);
      }
      if (url.pathname.startsWith('/api/v1/auth/')) {
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        const body = Buffer.concat(chunks).toString();
        calls.push({ path: url.pathname, headers: req.headers, body: body ? JSON.parse(body) : undefined });
        res.setHeader('Content-Type', 'application/json');
        if (req.method === 'POST' && fail) { fail = false; res.writeHead(503); return res.end(JSON.stringify({ error: { message: 'Réessayez.' } })); }
        return res.end(JSON.stringify({ success: true, data: req.method === 'GET' ? { passwordRecovery: enabled } : { changed: true, message: 'Demande reçue.' } }));
      }
      const file = url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname;
      const target = resolve(root, '.' + file);
      if (!target.startsWith(root + sep) || /\/(backend|node_modules)\//.test(file)) throw Error();
      const body = await readFile(target);
      res.setHeader('Content-Type', /\.m?js$/.test(file) ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
      res.end(body);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    for (const width of [360, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      enabled = false;
      await page.goto(`${origin}/forgot-password/`);
      await page.getByRole('link', { name: 'Contacter le support', exact: true }).waitFor();
      assert.equal(await page.locator('form').count(), 0);
      enabled = true;
      await page.reload();
      await page.locator('[name=identifier]').fill('person@example.test');
      fail = true;
      await page.locator('button[type=submit]').click();
      await page.locator('[data-error]:visible').waitFor();
      assert.equal(await page.locator('[data-result]').isVisible(), false);
      assert.equal(await page.locator('[name=identifier]').inputValue(), 'person@example.test');
      await page.locator('button[type=submit]').click();
      await page.locator('[data-result]:visible').waitFor();
      const token = randomBytes(32).toString('hex');
      const password = `Aa9!${randomBytes(16).toString('hex')}`;
      await page.goto(`${origin}/reset-password/#token=${token}`);
      await page.locator('[name=password]').fill(password);
      assert.equal(page.url().includes(token), false);
      await page.locator('[name=confirmation]').fill(password);
      fail = true;
      await page.locator('button[type=submit]').click();
      await page.locator('[data-error]:visible').waitFor();
      assert.equal(await page.locator('[data-result]').isVisible(), false);
      await page.locator('button[type=submit]').click();
      await page.locator('[data-result]:visible').waitFor();
      assert.equal(await page.locator('[name=password]').count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      assert.equal(calls.filter(call => call.path.endsWith('/reset-password')).at(-1).body.token === token, true);
      await page.close();
    }
    assert.equal(calls.every(call => !call.headers.authorization), true);
    assert.equal(calls.every(call => !call.path.includes('#token=')), true);
  } finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

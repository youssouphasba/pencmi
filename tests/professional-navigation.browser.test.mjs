import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { safeNext } from '../auth/navigation.mjs';

test('login redirects stay same-origin and cannot loop to login', () => {
  for (const next of ['https://example.test', '//example.test', '/\\example.test', '/login/?next=/login']) {
    assert.equal(safeNext(next, '/dashboard/', 'https://pencmi.test'), '/dashboard/');
  }
  assert.equal(safeNext('/publier/?category=hotel', '/dashboard/', 'https://pencmi.test'), '/publier/?category=hotel');
});

test('professional navigation retains session and publication context on mobile and desktop', {
  skip: !process.env.PENCMI_PLAYWRIGHT_MODULE, timeout: 120000,
}, async () => {
  const { chromium } = await import(pathToFileURL(process.env.PENCMI_PLAYWRIGHT_MODULE).href);
  const root = resolve(import.meta.dirname, '..');
  let origin;
  const token = randomUUID();
  const errors = [];
  let logoutCalls = 0;
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname === '/config/runtime-config.js') {
        res.setHeader('Content-Type', 'text/javascript');
        return res.end(`window.PencmiRuntimeConfig={apiBaseUrl:${JSON.stringify(`${origin}/api/v1`)}}`);
      }
      if (url.pathname.startsWith('/api/v1/')) {
        if (url.pathname.endsWith('/auth/logout')) logoutCalls++;
        const data = url.pathname.endsWith('/auth/me') ? { id: randomUUID(), role: 'hotel_manager' } : [];
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ success: true, data, meta: { total: 0 } }));
      }
      let file = url.pathname;
      if (!file.split('/').at(-1).includes('.')) file = file.replace(/\/$/, '') + '/index.html';
      const target = resolve(root, '.' + file);
      if (!target.startsWith(root + sep) || /\/(backend|node_modules)\//.test(file)) throw Error();
      const data = await readFile(target);
      res.setHeader('Content-Type', /\.m?js$/.test(file) ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.html') ? 'text/html' : 'image/jpeg');
      res.end(data);
    } catch { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    for (const width of [360, 390, 1170, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addInitScript(value => localStorage.setItem('pencmi_access_token', value), token);
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${origin}/dashboard/hotels/`);
      await page.locator('.hotel-dashboard-header h1').waitFor();
      await page.waitForLoadState('networkidle');
      const menu = page.locator('[data-open-sidebar]');
      if (width <= 1180) {
        await menu.click();
        assert.equal(await menu.getAttribute('aria-expanded'), 'true');
        assert.equal(await page.locator('#hotel-sidebar').isVisible(), true);
        await page.keyboard.press('Escape');
        assert.equal(await menu.getAttribute('aria-expanded'), 'false');
        assert.equal(await page.locator('#hotel-sidebar').isVisible(), false);
      } else assert.equal(await menu.isVisible(), false);
      await page.goto(origin);
      await page.locator('.header-actions a').filter({ hasText: /^Mon espace$/ }).waitFor({ state: 'attached' });
      assert.equal(await page.evaluate(() => localStorage.getItem('pencmi_access_token')), token);
      await page.goto(`${origin}/login/?next=/publier/?category=hotel`);
      await page.waitForURL('**/publier/?category=hotel');
      await page.locator('[data-next-hotel]').click();
      const input = page.locator('[data-hotel-field="name"]');
      await input.fill('Saisie conservée');
      const publicationMenu = page.locator('.publication-menu-toggle');
      if (width <= 1100) {
        await publicationMenu.click();
        assert.equal(await page.locator('#publication-navigation').isVisible(), true);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#publication-navigation').isVisible(), false);
      } else assert.equal(await page.locator('#publication-navigation').isVisible(), true);
      assert.equal(await input.inputValue(), 'Saisie conservée');
      await page.locator('[data-next-hotel]').click();
      await page.locator('[data-prev-hotel]').click();
      assert.equal(await input.inputValue(), 'Saisie conservée');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      for (const link of await page.locator('#publication-navigation a').evaluateAll(links => links.map(a => a.href))) {
        assert.equal((await context.request.get(link)).status(), 200);
      }
      await context.close();
    }
    assert.equal(logoutCalls, 0);
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

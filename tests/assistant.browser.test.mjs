import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

test('assistant consent, memory, listing cards, confirmation, safe rendering and network recovery on mobile and desktop', {
  skip: !process.env.PENCMI_PLAYWRIGHT_MODULE, timeout: 90000,
}, async () => {
  const { chromium } = await import(pathToFileURL(process.env.PENCMI_PLAYWRIGHT_MODULE).href);
  const root = resolve(import.meta.dirname, '..');
  let origin, confirmations = 0, calls = 0, fail = false;
  const bodies = [];
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
        if (pathname.endsWith('/assistant/capabilities')) return respond({ enabled: true, help: [
          { id: 'find', title: 'Trouver et comparer', items: [{ tool: 'search', text: 'Chercher des annonces.', examples: ['Un hôtel à Saly pour 2 personnes ce week-end'], confirmationRequired: false }] },
          { id: 'saved', title: 'Favoris et alertes', items: [{ tool: 'add_favorite', text: 'Ajouter une annonce à vos favoris.', examples: ['Ajoute cet hôtel à mes favoris'], confirmationRequired: true }] }] });
        if (pathname.endsWith('/assistant/chat')) {
          calls++;
          let raw = ''; for await (const chunk of req) raw += chunk;
          bodies.push(JSON.parse(raw));
          if (fail) { res.writeHead(503); return res.end(JSON.stringify({ error: { message: 'Service indisponible' } })); }
          if (calls === 1) return respond({ kind: 'turn', text: 'Deux hôtels à Saly. Le moins cher est <b>Teranga</b>.', memo: 'MEMO-SEARCH', blocks: [{ type: 'result', tool: 'search', module: 'hotels', label: 'Rechercher des annonces',
            result: { data: [{ id: 'h1', name: 'Hôtel Teranga', city: 'Saly', metadata: { priceFrom: 25000, stars: 3 } }, { id: 'h2', name: '<img src=x onerror=alert(2)>', city: 'Saly', metadata: { priceFrom: 40000 } }], meta: { total: 2 } } }] });
          return respond({ kind: 'turn', text: 'Je prépare le ticket.', memo: 'MEMO-PROPOSAL', blocks: [{ type: 'proposal', tool: 'create_ticket', label: 'Créer un ticket', args: { subject: '<img src=x onerror=alert(1)>', body: 'Demande' }, confirmation: randomUUID(), expiresAt: new Date(Date.now() + 300000).toISOString() }] });
        }
        if (pathname.endsWith('/assistant/confirm')) { confirmations++; return respond({ kind: 'result', label: 'Ticket', completed: true, memo: 'MEMO-DONE', result: { data: { status: 'open' } } }); }
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
      confirmations = 0; calls = 0; fail = false; bodies.length = 0;
      const page = await browser.newPage({ viewport: { width, height: 800 } });
      page.setDefaultTimeout(10000);
      await page.addInitScript(token => localStorage.setItem('pencmi_access_token', token), randomUUID());
      await page.goto(origin + '/assistant/');
      const input = page.getByLabel('Votre message');
      const send = page.getByRole('button', { name: 'Envoyer', exact: true });
      // Help sheet: tapping an example fills the composer.
      await page.getByRole('button', { name: 'Ce que Guindi sait faire' }).click();
      await page.getByRole('dialog').getByText('« Ajoute cet hôtel à mes favoris »').click();
      assert.equal(await input.inputValue(), 'Ajoute cet hôtel à mes favoris');
      await input.fill('Un hôtel à Saly');
      await send.click();
      await page.getByText('Hôtel Teranga', { exact: true }).waitFor();
      await page.getByText('dès 25 000 FCFA / nuit').waitFor();
      assert.equal(await page.locator('a.chat-card').first().getAttribute('href'), '/hotels/detail/?id=h1');
      await page.getByText('<img src=x onerror=alert(2)>', { exact: true }).waitFor();
      await page.getByText('Le moins cher est <b>Teranga</b>.', { exact: false }).waitFor();
      assert.equal(await page.locator('b').count(), 0);
      assert.equal(bodies[0].consent, true);
      await input.fill('Crée un ticket');
      await input.press('Enter');
      await page.getByText('<img src=x onerror=alert(1)>', { exact: true }).waitFor();
      assert.deepEqual(bodies[1].history, [{ role: 'user', content: 'Un hôtel à Saly' }, { role: 'assistant', content: 'MEMO-SEARCH' }]);
      assert.equal(await page.locator('img[src=x]').count(), 0);
      assert.equal(confirmations, 0);
      await page.getByRole('button', { name: 'Confirmer', exact: true }).click();
      await page.getByText('✓ C’est fait.').waitFor();
      assert.equal(confirmations, 1);
      assert.equal(await page.getByRole('button', { name: 'Confirmer', exact: true }).count(), 0);
      fail = true;
      await input.fill('Ma saisie conservée');
      await send.click();
      await page.getByText('Service indisponible', { exact: true }).waitFor();
      assert.equal(await input.inputValue(), 'Ma saisie conservée');
      assert.deepEqual(bodies.at(-1).history.map(turn => turn.content), ['Un hôtel à Saly', 'MEMO-SEARCH', 'Crée un ticket', 'MEMO-PROPOSAL', 'MEMO-DONE']);
      // New conversation clears history.
      await page.getByRole('button', { name: 'Nouvelle conversation' }).click();
      assert.equal(await page.locator('.msg.user').count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await page.screenshot({ path: resolve(process.env.TEMP || root, `pencmi-assistant-${width}.png`), fullPage: true });
      await page.close();
    }
  } finally {
    await browser?.close(); server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

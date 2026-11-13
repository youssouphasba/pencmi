import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');

async function start(api) {
  let origin;
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
        const body = chunks.length ? JSON.parse(Buffer.concat(chunks)) : undefined;
        const data = await api(req.method, pathname, body);
        if (data === undefined) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, data }));
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

test('public pages show default text, then the published version, without HTML injection', {
  skip: !process.env.PENCMI_PLAYWRIGHT_MODULE, timeout: 90000,
}, async () => {
  const { chromium } = await import(pathToFileURL(process.env.PENCMI_PLAYWRIGHT_MODULE).href);
  let published = null, faq = null;
  const { server, origin } = await start((method, path) => {
    if (path === '/api/v1/content/pages/regles-publication') return published;
    if (path === '/api/v1/content/faq') return faq;
  });
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 360, height: 800 } });
    page.setDefaultTimeout(10000);
    await page.goto(`${origin}/regles-publication/`);
    await page.getByRole('heading', { name: 'Contenus interdits' }).waitFor();
    await page.getByText('Biens ou services illégaux, contrefaçons.').waitFor();

    published = { title: 'Règles 2027', subtitle: null, sections: [{ heading: '<img src=x onerror=alert(1)>', body: 'Premier paragraphe.\n\n- point un\n- point deux' }] };
    await page.reload();
    await page.getByRole('heading', { name: 'Règles 2027' }).waitFor();
    assert.equal(await page.locator('img[src=x]').count(), 0);
    assert.equal(await page.locator('main li').count(), 2);
    assert.equal(await page.getByText('Contenus interdits').count(), 0);

    await page.goto(`${origin}/aide/`);
    await page.getByText('Comment créer un compte ?').waitFor();
    faq = [{ id: 'f1', question: 'Question du back-office ?', answer: 'Réponse.', category: 'hotels' }];
    await page.reload();
    await page.getByRole('heading', { name: 'Hôtels & Auberges' }).waitFor();
    await page.getByLabel('Rechercher dans l’aide').fill('introuvable');
    await page.getByText('Aucune question ne correspond.', { exact: false }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  } finally {
    await browser?.close();
    await stop(server);
  }
});

test('an admin edits a page from its default text, saves a draft, publishes, and manages the FAQ', {
  skip: !process.env.PENCMI_PLAYWRIGHT_MODULE, timeout: 90000,
}, async () => {
  const { chromium } = await import(pathToFileURL(process.env.PENCMI_PLAYWRIGHT_MODULE).href);
  let saved, puts, faq;
  const { server, origin } = await start((method, path, body) => {
    if (path === '/api/v1/admin/content/pages/securite' && method === 'GET') return saved;
    if (path === '/api/v1/admin/content/pages/securite' && method === 'PUT') {
      puts.push(body);
      saved = { ...body, slug: 'securite', updatedAt: '2026-11-13T12:00:00Z', versions: [] };
      return saved;
    }
    if (path === '/api/v1/admin/content/faq' && method === 'GET') return faq;
    if (path === '/api/v1/admin/content/faq' && method === 'POST') { const item = { id: `f${faq.length}`, ...body }; faq.push(item); return item; }
  });
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    for (const width of [360, 1280]) {
      saved = null; puts = []; faq = [];
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      page.setDefaultTimeout(10000);
      await page.addInitScript(token => localStorage.setItem('pencmi_access_token', token), randomUUID());
      await page.goto(`${origin}/admin/content/pages/edit/?slug=securite`);
      await page.getByText('Cette page n’a jamais été enregistrée', { exact: false }).waitFor();
      assert.equal(await page.getByLabel('Titre de la page').inputValue(), 'Conseils de sécurité');
      const sections = await page.locator('fieldset').count();

      await page.getByRole('button', { name: 'Ajouter une section' }).click();
      await page.getByRole('button', { name: 'Enregistrer en brouillon' }).click();
      await page.getByText('Chaque section doit avoir un titre.').waitFor();
      assert.equal(puts.length, 0);
      await page.locator('fieldset').last().getByLabel('Titre de la section').fill('Urgences');
      await page.locator('fieldset').last().getByLabel(/^Texte/).fill('Appelez le 17.');
      await page.getByRole('button', { name: 'Enregistrer en brouillon' }).click();
      await page.getByText('Brouillon enregistré.', { exact: false }).waitFor();
      assert.equal(puts[0].status, 'draft');
      assert.equal(puts[0].sections.length, sections + 1);
      assert.deepEqual(puts[0].sections.at(-1), { heading: 'Urgences', body: 'Appelez le 17.' });
      await page.getByRole('button', { name: 'Publier' }).click();
      await page.getByText('Page publiée : elle est en ligne.').waitFor();
      assert.equal(puts[1].status, 'active');

      await page.goto(`${origin}/admin/content/faq/`);
      await page.getByRole('button', { name: 'Partir des questions par défaut' }).click();
      await page.getByText(/questions importées\./).waitFor();
      assert.ok(faq.length >= 10);
      await page.getByLabel('Question', { exact: true }).fill('Puis-je payer en ligne ?');
      await page.getByLabel('Réponse').fill('Pas encore.');
      await page.getByRole('button', { name: 'Enregistrer' }).first().click();
      await page.getByText('Question ajoutée.').waitFor();
      assert.equal(faq.at(-1).question, 'Puis-je payer en ligne ?');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await page.close();
    }
  } finally {
    await browser?.close();
    await stop(server);
  }
});

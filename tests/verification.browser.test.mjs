import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF\n');

async function start(api) {
  let origin;
  const server = createServer(async (req, res) => {
    try {
      const { pathname, searchParams } = new URL(req.url, origin);
      if (pathname === '/config/runtime-config.js') {
        res.setHeader('Content-Type', 'text/javascript');
        return res.end(`window.PencmiRuntimeConfig={apiBaseUrl:${JSON.stringify(origin + '/api/v1')}}`);
      }
      if (pathname.startsWith('/api/v1/')) {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        return api({ req, res, pathname, searchParams, raw: Buffer.concat(chunks) });
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
const json = (res, data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(status < 400 ? { success: true, data } : { error: { message: data } })); };
const stop = async server => { server.closeAllConnections(); await new Promise(done => server.close(done)); };

test('a professional sends verification documents and follows the decision', {
  skip: !process.env.PENCMI_PLAYWRIGHT_MODULE, timeout: 90000,
}, async () => {
  const { chromium } = await import(pathToFileURL(process.env.PENCMI_PLAYWRIGHT_MODULE).href);
  let latest, uploads;
  const { server, origin } = await start(({ req, res, pathname, raw }) => {
    if (pathname === '/api/v1/verification/me') return json(res, {
      eligible: true, verified: false, requiredDocuments: ['identity', 'business_registration'], maxDocuments: 6, latest,
      documentTypes: [{ type: 'identity', label: 'Pièce d’identité' }, { type: 'business_registration', label: 'Registre de commerce (RCCM)' }, { type: 'ninea', label: 'NINEA' }],
    });
    if (pathname === '/api/v1/verification/requests' && req.method === 'POST') {
      uploads.push({ type: req.headers['content-type'], body: raw.toString('latin1') });
      latest = { id: 'r1', status: 'pending', createdAt: '2026-11-13T10:00:00Z', reason: null, documents: [{ id: 'd1', label: 'Pièce d’identité' }, { id: 'd2', label: 'Registre de commerce (RCCM)' }, { id: 'd3', label: 'NINEA' }] };
      return json(res, { id: 'r1', status: 'pending' }, 201);
    }
    res.writeHead(404); res.end();
  });
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    for (const width of [360, 1280]) {
      latest = { id: 'r0', status: 'requires_more_info', createdAt: '2026-11-01T10:00:00Z', reviewedAt: '2026-11-02T10:00:00Z', reason: '<img src=x onerror=alert(1)> Pièce illisible', documents: [{ id: 'd0', label: 'Pièce d’identité' }] };
      uploads = [];
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      page.setDefaultTimeout(10000);
      await page.addInitScript(token => localStorage.setItem('pencmi_access_token', token), randomUUID());
      await page.goto(`${origin}/dashboard/verification/`);
      await page.getByText('Correction demandée').first().waitFor();
      await page.getByText(/Message de l’équipe Péncmi : <img src=x/).waitFor();
      assert.equal(await page.locator('img[src=x]').count(), 0);

      await page.getByRole('button', { name: 'Envoyer pour vérification' }).click();
      await page.getByText('Ajoutez : Pièce d’identité, Registre de commerce (RCCM).').waitFor();
      assert.equal(uploads.length, 0);
      const file = name => ({ name, mimeType: 'application/pdf', buffer: pdf });
      await page.getByLabel('Pièce d’identité (obligatoire)').setInputFiles(file('cni.pdf'));
      await page.getByLabel('Registre de commerce (RCCM) (obligatoire)').setInputFiles(file('rccm.pdf'));
      await page.getByLabel('Ajouter un document facultatif').selectOption('ninea');
      await page.getByLabel('NINEA').setInputFiles(file('ninea.pdf'));
      await page.getByRole('button', { name: 'Envoyer pour vérification' }).click();
      await page.getByText('En cours d’examen').waitFor();
      await page.getByText('L’équipe examine vos documents. Vous serez notifié de la décision.').waitFor();
      assert.equal(await page.getByRole('button', { name: 'Envoyer pour vérification' }).count(), 0, 'no second request while one is reviewed');
      assert.equal(uploads.length, 1);
      assert.match(uploads[0].type, /^multipart\/form-data/);
      for (const field of ['identity', 'business_registration', 'ninea']) assert.match(uploads[0].body, new RegExp(`name="${field}"`));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await page.close();
    }
  } finally {
    await browser?.close();
    await stop(server);
  }
});

test('an admin reviews documents, needs a reason to refuse and records the decision', {
  skip: !process.env.PENCMI_PLAYWRIGHT_MODULE, timeout: 90000,
}, async () => {
  const { chromium } = await import(pathToFileURL(process.env.PENCMI_PLAYWRIGHT_MODULE).href);
  let decisions, downloads, request;
  const { server, origin } = await start(({ req, res, pathname, searchParams, raw }) => {
    if (pathname === '/api/v1/admin/verification/requests') {
      const rows = request.status === searchParams.get('status') ? [{ id: 'r1', createdAt: '2026-11-13T10:00:00Z', documentCount: 2, user: request.user }] : [];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ success: true, data: rows, meta: { page: 1, totalPages: 1, total: rows.length } }));
    }
    if (pathname === '/api/v1/admin/verification/requests/r1' && req.method === 'GET') return json(res, request);
    if (pathname === '/api/v1/admin/verification/requests/r1/documents/d1') {
      downloads += 1;
      res.writeHead(200, { 'Content-Type': 'application/pdf', 'Content-Disposition': 'attachment; filename="identity.pdf"' });
      return res.end(pdf);
    }
    if (pathname === '/api/v1/admin/verification/requests/r1' && req.method === 'PATCH') {
      const body = JSON.parse(raw);
      decisions.push(body);
      request.status = body.decision; request.reason = body.reason;
      return json(res, { id: 'r1', status: body.decision, documentsDeleted: 2 });
    }
    res.writeHead(404); res.end();
  });
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    for (const width of [360, 1280]) {
      decisions = []; downloads = 0;
      request = {
        id: 'r1', status: 'pending', reason: null,
        user: { id: 'u1', role: 'real_estate_agency', status: 'active', email: 'agence@example.test', emailVerified: true, professionalVerified: false, createdAt: '2026-10-01T10:00:00Z', professionalProfile: { businessName: '<b>Agence Teranga</b>', city: 'Dakar' } },
        documents: [{ id: 'd1', documentType: 'identity', label: 'Pièce d’identité', available: true }, { id: 'd2', documentType: 'business_registration', label: 'Registre de commerce (RCCM)', available: true }],
      };
      const page = await browser.newPage({ viewport: { width, height: 900 }, acceptDownloads: true });
      page.setDefaultTimeout(10000);
      await page.addInitScript(token => localStorage.setItem('pencmi_access_token', token), randomUUID());
      await page.goto(`${origin}/admin/verification/`);
      await page.getByRole('cell', { name: '<b>Agence Teranga</b>' }).waitFor();
      assert.equal(await page.locator('main b').count(), 0);
      await page.getByRole('button', { name: 'Examiner' }).click();

      const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Télécharger' }).first().click()]);
      assert.equal(download.suggestedFilename(), 'identity.pdf');
      assert.equal(downloads, 1);

      await page.getByLabel('Action').selectOption('refused');
      await page.getByRole('button', { name: 'Enregistrer la décision' }).click();
      await page.getByText('Indiquez le motif au professionnel.').waitFor();
      assert.equal(decisions.length, 0);
      await page.getByLabel('Motif').fill('Registre de commerce expiré');
      await page.getByRole('button', { name: 'Enregistrer la décision' }).click();
      await page.getByText('Aucune demande dans cette catégorie.').waitFor();
      assert.deepEqual(decisions, [{ decision: 'refused', reason: 'Registre de commerce expiré' }]);
      await page.getByLabel('Statut').selectOption('refused');
      await page.getByRole('cell', { name: '<b>Agence Teranga</b>' }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await page.close();
    }
  } finally {
    await browser?.close();
    await stop(server);
  }
});

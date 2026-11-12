import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

test('report delivery, moderation and admin support on mobile and desktop', {
  skip: !process.env.PENCMI_PLAYWRIGHT_MODULE, timeout: 90000,
}, async () => {
  const { chromium } = await import(pathToFileURL(process.env.PENCMI_PLAYWRIGHT_MODULE).href);
  const root = resolve(import.meta.dirname, '..');
  const reportId = randomUUID(), ticketId = randomUUID(), targetId = randomUUID();
  let origin, reportStatus, ticketStatus, fail, reply, lastReport;
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
        const respond = (data, meta) => res.end(JSON.stringify({ success: true, data, meta }));
        res.setHeader('Content-Type', 'application/json');
        const report = { id: reportId, module: 'real_estate', targetType: 'listing', targetId, reason: 'fake_photos',
          message: '<img src=x onerror=alert(1)>', status: reportStatus, updatedAt: new Date().toISOString() };
        if (pathname === '/api/v1/reports' && req.method === 'POST') {
          if (fail) { fail = false; res.writeHead(503); return res.end(JSON.stringify({ error: { message: 'Service indisponible' } })); }
          lastReport = body;
          return respond(report);
        }
        if (pathname === '/api/v1/reports/mine') return respond([report], { totalPages: 1 });
        if (pathname === `/api/v1/reports/admin/${reportId}/status`) {
          reportStatus = body.status;
          return respond({ id: reportId, status: reportStatus });
        }
        if (pathname === `/api/v1/reports/admin/${reportId}`) return respond({ ...report, advertiserId: targetId,
          actions: reportStatus === 'resolved' ? [] : ['resolved'], decisions: [] });
        if (pathname === `/api/v1/support/admin/tickets/${ticketId}/messages`) { reply = body.body; return respond({ id: randomUUID() }); }
        if (pathname === `/api/v1/support/admin/tickets/${ticketId}/status`) {
          ticketStatus = body.status;
          return respond({ id: ticketId, status: ticketStatus });
        }
        if (pathname === `/api/v1/support/admin/tickets/${ticketId}`) return respond({
          id: ticketId, subject: 'Accès au compte', status: ticketStatus, userId: targetId, canReply: ticketStatus === 'open',
          messages: reply ? [{ body: reply, createdAt: new Date().toISOString() }] : [],
          actions: ticketStatus === 'open' ? ['closed'] : ['open'],
        });
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
      reportStatus = 'new'; ticketStatus = 'open'; fail = true; reply = '';
      const page = await browser.newPage({ viewport: { width, height: 800 } });
      page.setDefaultTimeout(10000);
      await page.addInitScript(token => localStorage.setItem('pencmi_access_token', token), randomUUID());
      await page.goto(`${origin}/signaler/?module=real_estate&targetType=listing&targetId=${targetId}`);
      await page.getByRole('combobox').selectOption('fake_photos');
      await page.getByLabel('Message complémentaire').fill('Photos à vérifier');
      const send = page.getByRole('button', { name: 'Envoyer le signalement' });
      await send.click();
      await page.getByText('Service indisponible', { exact: true }).waitFor();
      assert.equal(await page.getByLabel('Message complémentaire').inputValue(), 'Photos à vérifier');
      await send.click();
      await page.getByRole('link', { name: 'Suivre mes signalements' }).click();
      await page.getByRole('heading', { name: 'Fausses photos' }).waitFor();
      assert.equal(lastReport.targetId, targetId);
      await page.goto(`${origin}/admin/reports/detail/?id=${reportId}`);
      await page.getByText('<img src=x onerror=alert(1)>', { exact: true }).waitFor();
      assert.equal(await page.locator('img[src=x]').count(), 0);
      await page.getByLabel('Note interne').fill('Analyse terminée.');
      await page.getByRole('button', { name: 'Enregistrer la décision' }).click();
      await page.getByText('Résolu', { exact: true }).waitFor();
      await page.goto(`${origin}/admin/support/detail/?id=${ticketId}`);
      await page.getByLabel('Réponse', { exact: true }).fill('Votre demande a été traitée.');
      await page.getByRole('button', { name: 'Envoyer la réponse' }).click();
      await page.getByText('Votre demande a été traitée.', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Changer le statut' }).click();
      await page.getByText('Fermé', { exact: true }).waitFor();
      assert.equal(await page.getByRole('button', { name: 'Envoyer la réponse' }).count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await page.close();
    }
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});

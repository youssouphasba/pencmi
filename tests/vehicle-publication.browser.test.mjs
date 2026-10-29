import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve, sep, join } from 'node:path';
import { createRequire } from 'node:module';

test(
  'vehicle wizard, gallery, requests and dashboard work on mobile and desktop',
  { skip: !process.env.PENCMI_PLAYWRIGHT_MODULE, timeout: 180000 },
  async () => {
    const { chromium } = await import(
      pathToFileURL(process.env.PENCMI_PLAYWRIGHT_MODULE).href
    );
    const root = resolve(import.meta.dirname, '..'),
      require = createRequire(
        new URL('../backend/package.json', import.meta.url),
      );
    const upload = require('multer')({
      storage: require('multer').memoryStorage(),
    }).single('photo');
    const image = await require('sharp')({
      create: { width: 20, height: 16, channels: 3, background: '#268d6e' },
    })
      .png()
      .toBuffer();
    let origin,
      listing,
      failNext = false,
      creates = 0,
      publicMode = 'rental',
      publicFilters,
      requestCount = 0,
      deleteCount = 0;
    const publicVehicle = () => ({
      id: 'public-car',
      title: 'Voiture <b>sans HTML</b>',
      status: 'active',
      city: 'Dakar',
      vehicleMode: publicMode,
      price: 25000,
      description: 'Description publique',
      metadata: {
        brand: 'Toyota',
        model: 'Corolla',
        fuel: 'Essence',
        photos: [],
        contactPreferences: { contactFormEnabled: true },
        documents: ['Assurance'],
      },
    });
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname === '/config/runtime-config.js') {
          res.setHeader('Content-Type', 'text/javascript');
          return res.end(
            `window.PencmiRuntimeConfig={apiBaseUrl:${JSON.stringify(`${origin}/api/v1`)}};`,
          );
        }
        if (url.pathname.startsWith('/api/v1/')) {
          if (failNext) {
            failNext = false;
            res.writeHead(503, { 'Content-Type': 'application/json' });
            return res.end(
              JSON.stringify({ error: { message: 'Connexion interrompue.' } }),
            );
          }
          if (url.pathname.startsWith('/api/v1/files/')) {
            assert.equal(req.headers.authorization, 'Bearer test-token');
            res.setHeader('Content-Type', 'image/png');
            return res.end(image);
          }
          let data;
          if (url.pathname === '/api/v1/voitures') {
            publicFilters = new URLSearchParams(url.search);
            res.setHeader('Content-Type', 'application/json');
            return res.end(
              JSON.stringify({
                success: true,
                data: [publicVehicle()],
                meta: { page: 1, total: 1, totalPages: 1 },
              }),
            );
          }
          if (
            req.method === 'GET' &&
            url.pathname.startsWith('/api/v1/voitures/')
          )
            data = publicVehicle();
          else if (req.method === 'POST' && url.pathname.endsWith('/photos')) {
            await new Promise((done, reject) =>
              upload(req, res, (error) => (error ? reject(error) : done())),
            );
            assert.ok(req.file.buffer.equals(image));
            const photo = {
              id: req.body.uploadId,
              url: `${origin}/api/v1/files/public/${req.body.uploadId}`,
              managed: true,
            };
            const index = listing.photos.findIndex(
              (item) => item.id === req.body.replacePhotoId,
            );
            if (index >= 0) listing.photos.splice(index, 1, photo);
            else listing.photos.push(photo);
            data = listing;
          } else {
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            const body = Buffer.concat(chunks).toString(),
              input = body ? JSON.parse(body) : {};
            if (
              url.pathname === '/api/v1/dashboard/voitures' &&
              req.method === 'POST'
            ) {
              creates++;
              listing = {
                id: 'saved-car',
                status: 'draft',
                photos: [],
                ...input,
                publication: input.metadata,
              };
              data = listing;
            } else if (
              url.pathname === '/api/v1/dashboard/voitures' &&
              req.method === 'GET'
            )
              data = listing ? [listing] : [];
            else if (
              url.pathname === '/api/v1/dashboard/voitures/saved-car' &&
              req.method === 'PATCH'
            ) {
              listing = { ...listing, ...input, publication: input.metadata };
              data = listing;
            } else if (url.pathname.endsWith('/submit')) {
              listing.status = 'pending_review';
              data = listing;
            } else if (url.pathname.endsWith('/photos/order')) {
              listing.photos = input.photoIds.map((id) =>
                listing.photos.find((photo) => photo.id === id),
              );
              data = listing;
            } else if (
              url.pathname.includes('/photos/') &&
              req.method === 'DELETE'
            ) {
              listing.photos = listing.photos.filter(
                (photo) => !url.pathname.endsWith(photo.id),
              );
              data = listing;
            } else if (
              url.pathname === '/api/v1/dashboard/voitures/saved-car' &&
              req.method === 'DELETE'
            ) {
              deleteCount++;
              listing = undefined;
              data = { deleted: true };
            } else if (url.pathname === '/api/v1/dashboard/voitures/saved-car')
              data = listing;
            else if (
              req.method === 'POST' &&
              url.pathname.startsWith('/api/v1/voitures/')
            ) {
              assert.equal(input.clientName, 'Client de recette');
              assert.equal(
                url.pathname.split('/').at(-1),
                publicMode === 'sale'
                  ? 'contact'
                  : publicMode === 'rental'
                    ? 'rental-requests'
                    : 'chauffeur-requests',
              );
              requestCount++;
              data = { id: 'request', status: 'new', received: true };
            } else data = [];
          }
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ success: true, data }));
        }
        const path = resolve(
          root,
          '.' +
            decodeURIComponent(
              url.pathname.endsWith('/')
                ? url.pathname + 'index.html'
                : url.pathname,
            ),
        );
        if (
          !path.startsWith(root + sep) ||
          path.includes(sep + 'backend' + sep) ||
          !/\.(html|m?js|css|jpeg|png)$/.test(path)
        ) {
          res.writeHead(404);
          return res.end();
        }
        const content = await readFile(path);
        res.setHeader(
          'Content-Type',
          /\.m?js$/.test(path)
            ? 'text/javascript; charset=utf-8'
            : path.endsWith('.css')
              ? 'text/css'
              : path.endsWith('.html')
                ? 'text/html; charset=utf-8'
                : 'image/jpeg',
        );
        res.end(content);
      } catch {
        res.writeHead(500);
        res.end();
      }
    });
    await new Promise((done) => server.listen(0, '127.0.0.1', done));
    origin = `http://127.0.0.1:${server.address().port}`;
    let browser;
    try {
      browser = await chromium.launch({ channel: 'msedge', headless: true });
      for (const width of [360, 390, 768, 1280]) {
        listing = undefined;
        creates = 0;
        const page = await browser.newPage({
            viewport: { width, height: 900 },
          }),
          errors = [];
        page.on('pageerror', (failure) => errors.push(failure.message));
        page.on('dialog', (dialog) => dialog.accept());
        await page.addInitScript(() =>
          localStorage.setItem('pencmi_access_token', 'test-token'),
        );
        await page.goto(`${origin}/publier/?category=voiture`);
        await page
          .locator('[data-vehicle-field="vehicleMode"][value="sale"]')
          .check();
        await page.locator('[data-step-vehicle="1"]').click();
        await page
          .locator('[data-vehicle-field="metadata.identity.brand"]')
          .selectOption('Toyota');
        await page
          .locator('[data-vehicle-field="metadata.identity.model"]')
          .fill('Corolla');
        await page.locator('[data-draft-vehicle]').click();
        await page
          .getByText('Brouillon enregistré.', { exact: true })
          .waitFor();
        assert.equal(creates, 1);
        await page.reload();
        await page.locator('[data-step-vehicle="1"]').click();
        assert.equal(
          await page
            .locator('[data-vehicle-field="metadata.identity.model"]')
            .inputValue(),
          'Corolla',
        );
        for (const [mode, key, amount] of [
          ['sale', 'price', '9000000'],
          ['rental', 'pricePerDay', '25000'],
          ['chauffeur', 'pricePerTrip', '20000'],
        ]) {
          await page.locator('[data-step-vehicle="0"]').click();
          await page
            .locator(`[data-vehicle-field="vehicleMode"][value="${mode}"]`)
            .check();
          await page.locator('[data-step-vehicle="4"]').click();
          await page
            .locator(`[data-vehicle-field="metadata.pricing.${key}"]`)
            .fill(amount);
          assert.equal(
            await page
              .locator('[data-vehicle-field="metadata.pricing.price"]')
              .count(),
            mode === 'sale' ? 1 : 0,
          );
        }
        await page.locator('[data-step-vehicle="8"]').click();
        await page
          .locator('[data-vehicle-field="title"]')
          .fill('Voiture <script>window.xss=1</script>');
        await page
          .locator('[data-vehicle-field="description"]')
          .fill('Description conservée');
        failNext = true;
        await page.locator('[data-draft-vehicle]').click();
        await page
          .getByText('Connexion interrompue.', { exact: true })
          .waitFor();
        assert.equal(
          await page.locator('[data-vehicle-field="description"]').inputValue(),
          'Description conservée',
        );
        assert.equal(
          await page
            .getByText('Brouillon enregistré.', { exact: true })
            .count(),
          0,
        );
        await page.locator('[data-draft-vehicle]').click();
        await page
          .getByText('Brouillon enregistré.', { exact: true })
          .waitFor();
        assert.equal(listing.publication.pricing.price, 9000000);
        assert.equal(listing.publication.pricing.pricePerDay, 25000);
        await page.locator('[data-step-vehicle="5"]').click();
        await page.locator('[data-upload-vehicle]').setInputFiles([
          { name: 'photo.png', mimeType: 'image/png', buffer: image },
          { name: 'second.png', mimeType: 'image/png', buffer: image },
        ]);
        await page.waitForFunction(
          () =>
            document.querySelectorAll('figure img').length === 2 &&
            [...document.querySelectorAll('figure img')].every(
              (img) => img.naturalWidth > 0,
            ),
        );
        const first = listing.photos[0].id;
        await page.locator('[data-photo-cover="1"]').click();
        await page.waitForFunction(
          (id) =>
            !document.querySelector(`[data-photo-delete="${id}"]`).disabled,
          first,
        );
        assert.notEqual(listing.photos[0].id, first);
        await page.locator('[data-photo-replace]').first().setInputFiles({
          name: 'replace.png',
          mimeType: 'image/png',
          buffer: image,
        });
        await page.waitForFunction(
          () => !document.querySelector('[data-photo-delete]')?.disabled,
        );
        await page.locator('[data-photo-delete]').first().click();
        await page.waitForFunction(
          () => document.querySelectorAll('figure img').length === 1,
        );
        for (let step = 0; step < 12; step++) {
          await page.locator(`[data-step-vehicle="${step}"]`).click();
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth + 1,
            ),
            false,
            `overflow ${width} step ${step}`,
          );
        }
        await page.locator('[data-submit-vehicle]').click();
        await page
          .getByText('Votre annonce est en attente de validation.', {
            exact: true,
          })
          .waitFor();
        assert.equal(listing.status, 'pending_review');
        assert.equal(creates, 1);
        assert.equal(await page.evaluate(() => window.xss), undefined);
        if (process.env.PENCMI_PUBLICATION_SCREENSHOT_DIRECTORY) {
          await mkdir(process.env.PENCMI_PUBLICATION_SCREENSHOT_DIRECTORY, {
            recursive: true,
          });
          await page.screenshot({
            path: join(
              process.env.PENCMI_PUBLICATION_SCREENSHOT_DIRECTORY,
              `vehicle-publication-${width}.png`,
            ),
            fullPage: true,
          });
        }
        publicMode = 'rental';
        await page.goto(`${origin}/voitures/?brand=Toyota`);
        await page.getByRole('heading', { name: 'Toyota Corolla' }).waitFor();
        await page
          .locator('#vehicle-search-form [name="type"]')
          .selectOption('chauffeur');
        await page
          .locator('#vehicle-search-form [name="model"]')
          .fill('Corolla');
        await page.locator('#vehicle-search-form [name="city"]').fill('Dakar');
        await page
          .locator('#vehicle-search-form [name="maxPrice"]')
          .fill('50000');
        publicMode = 'chauffeur';
        await page.locator('#vehicle-search-form [type="submit"]').click();
        await page.waitForURL(
          (url) => url.searchParams.get('type') === 'chauffeur',
        );
        await page.getByRole('heading', { name: 'Toyota Corolla' }).waitFor();
        assert.equal(publicFilters.get('vehicleMode'), 'chauffeur');
        assert.equal(publicFilters.get('model'), 'Corolla');
        assert.equal(publicFilters.get('maxPrice'), '50000');
        await page
          .locator('#vehicle-filter-form [name="fuel"]')
          .selectOption('Essence');
        await page.locator('#vehicle-filter-form [type="submit"]').click();
        await page.waitForURL(
          (url) => url.searchParams.get('fuel') === 'Essence',
        );
        await page.getByRole('heading', { name: 'Toyota Corolla' }).waitFor();
        assert.equal(publicFilters.get('fuel'), 'Essence');
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth + 1,
          ),
          false,
        );
        for (const mode of ['sale', 'rental', 'chauffeur']) {
          publicMode = mode;
          await page.goto(`${origin}/voitures/detail/?id=public-car`);
          await page
            .getByRole('heading', {
              name: 'Voiture <b>sans HTML</b>',
              exact: true,
            })
            .waitFor();
          assert.equal(await page.locator('h1 b').count(), 0);
          assert.equal(
            await page.evaluate(
              () => document.documentElement.scrollWidth > innerWidth + 1,
            ),
            false,
          );
          await page.locator('[data-open-contact]').click();
          assert.equal(
            await page.locator('[data-close-success]').isVisible(),
            false,
          );
          await page.locator('[name="clientName"]').fill('Client de recette');
          await page
            .locator('[name="clientEmail"]')
            .fill('client@example.test');
          if (mode !== 'sale')
            await page.locator('[name="startDate"]').fill('2030-01-01');
          if (mode === 'rental')
            await page.locator('[name="endDate"]').fill('2030-01-03');
          failNext = true;
          await page.locator('#vehicle-request-form [type="submit"]').click();
          await page
            .getByText('Connexion interrompue.', { exact: true })
            .waitFor();
          assert.equal(
            await page.locator('[name="clientName"]').inputValue(),
            'Client de recette',
          );
          await page.locator('#vehicle-request-form [type="submit"]').click();
          await page.locator('#vehicle-contact-confirmation').waitFor();
          assert.equal(
            await page.locator('#vehicle-request-form').isVisible(),
            false,
          );
          await page.locator('[data-close-success]').click();
          assert.equal(
            await page
              .locator('#vehicle-contact-modal')
              .getAttribute('aria-hidden'),
            'true',
          );
        }
        await page.goto(`${origin}/dashboard/voitures/annonces/`);
        await page
          .getByRole('link', { name: 'Modifier', exact: true })
          .waitFor();
        assert.match(
          await page
            .getByRole('link', { name: 'Modifier', exact: true })
            .getAttribute('href'),
          /id=saved-car/,
        );
        await page.locator('[data-delete-vehicle]').click();
        await page
          .getByRole('heading', {
            name: 'Vous n’avez aucune annonce voiture pour le moment.',
          })
          .waitFor();
        assert.deepEqual(errors, []);
        await page.close();
      }
      assert.equal(requestCount, 12);
      assert.equal(deleteCount, 4);
    } finally {
      await browser?.close();
      server.closeAllConnections();
      await new Promise((done) => server.close(done));
    }
  },
);

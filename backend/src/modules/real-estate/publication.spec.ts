import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { access, mkdir, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';
import request = require('supertest');
import type SharpFactory from 'sharp';
import express = require('express');
import { AuthService } from '../../auth/auth.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { AllExceptionsFilter } from '../../common/filters/all-exceptions.filter';
import { PrismaService } from '../../database/prisma/prisma.service';
import { FilesController } from '../../files/files.controller';
import { FilesService } from '../../files/files.service';
import { RealEstateController } from './real-estate.controller';
import { RealEstateService } from './real-estate.service';
import { publicationDatabase } from './publication.fixture';

const sharp: typeof SharpFactory = require('sharp');

describe('Real estate publication API', () => {
  let app: INestApplication;
  let db: ReturnType<typeof publicationDatabase>;
  let image: Buffer;
  let directory: string;
  let storageSettings: Record<string, string>;
  const owner = 'owner-a';
  const payload = () => ({
    title: 'Appartement à Dakar',
    description: 'Description complète du logement.',
    transaction: 'location',
    propertyType: 'appartement',
    metadata: {
      location: {
        country: 'SN',
        region: 'Dakar',
        city: 'Dakar',
        district: 'Yoff',
        addressHint: 'Adresse privée',
        isApproximateLocation: true,
      },
      pricing: {
        price: 250000,
        currency: 'FCFA',
        pricePeriod: 'month',
        negotiable: true,
      },
      features: { surface: 90, bedrooms: 2, parking: true },
      conditions: { deposit: 250000, availableImmediately: true },
      documents: [{ type: 'bail', available: true }],
      contactPreferences: {
        internalMessagingEnabled: true,
        emailNotificationsEnabled: true,
        notificationEmail: 'private@example.test',
      },
    },
  });
  const api = (
    method: 'get' | 'post' | 'patch' | 'delete',
    path: string,
    token = owner,
  ) =>
    request(app.getHttpServer())
      [method](`/api/v1${path}`)
      .set('Authorization', `Bearer ${token}`);
  const create = async (body = {}) =>
    (await api('post', '/dashboard/immobilier').send(body).expect(201)).body;
  const photo = (id: string, uploadId = randomUUID(), token = owner) =>
    api('post', `/dashboard/immobilier/${id}/photos`, token)
      .field('uploadId', uploadId)
      .attach('photo', image, {
        filename: 'image.png',
        contentType: 'image/png',
      });

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'pencmi-publication-'));
    image = await sharp({
      create: { width: 16, height: 16, channels: 3, background: '#25aa77' },
    })
      .png()
      .toBuffer();
  });
  beforeEach(async () => {
    db = publicationDatabase();
    storageSettings = {
      NODE_ENV: 'test',
      STORAGE_DRIVER: 'local',
      API_PREFIX: 'api/v1',
      LOCAL_UPLOAD_DIRECTORY: directory,
    };
    const module = await Test.createTestingModule({
      controllers: [RealEstateController, FilesController],
      providers: [
        RealEstateService,
        FilesService,
        { provide: PrismaService, useValue: db.prisma },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => storageSettings[key],
          },
        },
        {
          provide: AuthService,
          useValue: {
            validateAccessToken: async (token: string) => {
              if (!['owner-a', 'owner-b', 'client', 'hotel'].includes(token))
                throw new UnauthorizedException();
              return {
                id: token,
                role:
                  token === 'client'
                    ? 'client'
                    : token === 'hotel'
                      ? 'hotel_manager'
                      : 'real_estate_agency',
                sessionId: token,
              };
            },
          },
        },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    const root = join(__dirname, '../../../..');
    app.use(
      ['/Logo%20pencmi.jpeg', '/Logo pencmi.jpeg'],
      (_req: any, res: any) => res.sendFile(join(root, 'Logo pencmi.jpeg')),
    );
    app.use('/config/runtime-config.js', (req: any, res: any) =>
      res
        .type('application/javascript')
        .send(
          `window.PencmiRuntimeConfig = ${JSON.stringify({ apiBaseUrl: `http://${req.headers.host}/api/v1` })};`,
        ),
    );
    for (const dir of [
      'publier',
      'design-system',
      'dashboard/immobilier/annonces/edit',
    ])
      app.use(`/${dir}`, express.static(join(root, dir)));
    for (const path of [
      'immobilier/senegal-locations.js',
      'immobilier/immobilier.css',
      'auth/token-session.mjs',
    ]) {
      app.use(`/${path}`, (_req: any, res: any) =>
        res.sendFile(join(root, path)),
      );
    }
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });
  afterEach(async () => {
    await app.close();
  });
  afterAll(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('saves an incomplete draft, resumes it and updates without duplication', async () => {
    const requestId = randomUUID();
    const created = await create({ requestId });
    expect(created.status).toBe('draft');
    expect((await create({ requestId })).id).toBe(created.id);
    await api('get', `/dashboard/immobilier/${created.id}`).expect(200);
    const updated = await api('patch', `/dashboard/immobilier/${created.id}`)
      .send(payload())
      .expect(200);
    expect(updated.body.price).toBe(250000);
    expect(updated.body.metadata.publication.conditions.deposit).toBe(250000);
    expect(updated.body.city).toBe('Dakar');
    expect(db.listings()).toHaveLength(1);
    expect(
      (await api('get', '/dashboard/immobilier').expect(200)).body.data,
    ).toHaveLength(1);
  });

  it('recovers a concurrent idempotent primary-key collision without hiding other constraints', async () => {
    const requestId = randomUUID();
    const created = await create({ requestId });
    db.prisma.realEstateListing.upsert.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Concurrent primary key', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['id'] },
      }),
    );
    expect((await create({ requestId })).id).toBe(created.id);
    expect(db.listings()).toHaveLength(1);
    db.prisma.realEstateListing.upsert.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unrelated slug conflict', {
        code: 'P2002',
        clientVersion: 'test',
        meta: { target: ['slug'] },
      }),
    );
    await api('post', '/dashboard/immobilier').send({ requestId }).expect(500);
  });

  it('does not permit another owner to read, change, submit or delete photos', async () => {
    const created = await create();
    await api('get', `/dashboard/immobilier/${created.id}`, 'owner-b').expect(
      404,
    );
    await api('patch', `/dashboard/immobilier/${created.id}`, 'owner-b')
      .send(payload())
      .expect(404);
    await api(
      'post',
      `/dashboard/immobilier/${created.id}/submit`,
      'owner-b',
    ).expect(404);
    await photo(created.id, randomUUID(), 'owner-b').expect(404);
    await api(
      'delete',
      `/dashboard/immobilier/${created.id}/photos/unknown`,
      'owner-b',
    ).expect(404);
  });

  it.each(['client', 'hotel', 'invalid'])(
    'denies publication to %s',
    async (token) => {
      await api('post', '/dashboard/immobilier', token)
        .send({})
        .expect(token === 'invalid' ? 401 : 403);
      expect(db.listings()).toHaveLength(0);
    },
  );

  it.each([
    { status: 'active' },
    { ownerUserId: 'other' },
    { slug: 'chosen' },
    { metadata: { permissions: ['admin'] } },
    { metadata: { features: { verified: true } } },
    { metadata: { pricing: { price: -1 } } },
  ])('refuses administrative or malformed fields %j', async (body) => {
    await api('post', '/dashboard/immobilier').send(body).expect(400);
    expect(db.listings()).toHaveLength(0);
  });

  it('rejects incomplete submission with field errors without changing its status', async () => {
    const created = await create();
    const result = await api(
      'post',
      `/dashboard/immobilier/${created.id}/submit`,
    ).expect(400);
    expect(
      result.body.error.details.fields.map((field: any) => field.path),
    ).toContain('transaction');
    expect(db.listings()[0].status).toBe('draft');
  });

  it.each([
    ['active', false, true, 200],
    ['active', false, false, 200],
    ['draft', false, false, 404],
    ['pending_review', false, false, 404],
    ['deleted', false, false, 404],
    ['active', true, false, 404],
  ])(
    'public visibility for status=%s deleted=%s photo=%s',
    async (status, deleted, hasPhoto, expected) => {
      const created = await create(payload());
      if (hasPhoto) await photo(created.id).expect(201);
      db.listings()[0].status = status;
      db.listings()[0].deletedAt = deleted ? new Date() : null;
      const response = await request(app.getHttpServer())
        .get('/api/v1/immobilier')
        .expect(200);
      expect(response.body.data).toHaveLength(expected === 200 ? 1 : 0);
      await request(app.getHttpServer())
        .get(`/api/v1/immobilier/${created.id}`)
        .expect(expected as number);
    },
  );

  it.each(['draft', 'pending_review', 'deleted'])(
    'refuses public photos for a %s listing',
    async (status) => {
      const created = await create(payload());
      const uploaded = (await photo(created.id).expect(201)).body;
      db.listings()[0].status = status;
      await request(app.getHttpServer())
        .get(`/api/v1/files/public/${uploaded.id}`)
        .expect(404);
    },
  );

  it('refuses uploads explicitly when production storage is not persistent', async () => {
    const created = await create();
    storageSettings.NODE_ENV = 'production';
    const response = await photo(created.id).expect(503);
    expect(response.body.error.message).toMatch(/stockage persistant/);
    expect(db.assets()).toHaveLength(0);
  });

  it('does not serve an explicitly private photo even for an active listing', async () => {
    const created = await create(payload());
    const uploaded = (await photo(created.id).expect(201)).body;
    db.listings()[0].status = 'active';
    db.assets()[0].visibility = 'private';
    await request(app.getHttpServer())
      .get(`/api/v1/files/public/${uploaded.id}`)
      .expect(404);
    await api('get', `/files/${uploaded.id}/content`).expect(200);
  });

  it('does not expose a draft through public visit requests or ignore disabled visits', async () => {
    const created = await create(payload());
    await request(app.getHttpServer())
      .post(`/api/v1/immobilier/${created.id}/visit-requests`)
      .send({})
      .expect(404);
    db.listings()[0].status = 'active';
    db.listings()[0].metadata.publication.contactPreferences.visitRequestEnabled = false;
    await request(app.getHttpServer())
      .post(`/api/v1/immobilier/${created.id}/visit-requests`)
      .send({})
      .expect(400);
  });

  it('does not let an owner force an active status when editing', async () => {
    const created = await create();
    await api('patch', `/dashboard/immobilier/${created.id}`)
      .send({ status: 'active' })
      .expect(400);
    expect(db.listings()[0].status).toBe('draft');
  });

  it('preserves the existing optional description and photo rules', async () => {
    const body = payload();
    delete (body as any).description;
    const created = await create(body);
    await api('post', `/dashboard/immobilier/${created.id}/submit`).expect(201);
    expect(db.listings()[0].status).toBe('pending_review');
  });

  it.each(['suspended', 'expired', 'deleted'])(
    'refuses editing and submission of a %s listing',
    async (status) => {
      const created = await create(payload());
      db.listings()[0].status = status;
      await api('patch', `/dashboard/immobilier/${created.id}`)
        .send({ title: 'Changed' })
        .expect(409);
      await api('post', `/dashboard/immobilier/${created.id}/submit`).expect(
        409,
      );
      expect(db.listings()[0].title).toBe(payload().title);
    },
  );

  it.each(['jpeg', 'webp'] as const)(
    'accepts actual %s photos regardless of an untrusted filename',
    async (format) => {
      const created = await create();
      const buffer = await sharp(image).toFormat(format).toBuffer();
      const result = await api(
        'post',
        `/dashboard/immobilier/${created.id}/photos`,
      )
        .field('uploadId', randomUUID())
        .attach('photo', buffer, {
          filename: 'not-trusted.exe',
          contentType: 'application/octet-stream',
        })
        .expect(201);
      const content = await api(
        'get',
        `/files/${result.body.id}/content`,
      ).expect(200);
      expect(content.headers['content-type']).toContain(`image/${format}`);
      expect((await sharp(content.body).metadata()).format).toBe(format);
    },
  );

  it('uploads real photos, reads owner content, orders, replaces, removes and submits for review', async () => {
    const created = await create(payload());
    const uploadId = randomUUID();
    const first = (await photo(created.id, uploadId).expect(201)).body;
    expect((await photo(created.id, uploadId).expect(201)).body.id).toBe(
      first.id,
    );
    expect(db.assets()).toHaveLength(1);
    const content = await api('get', `/files/${first.id}/content`).expect(200);
    expect((await sharp(content.body).metadata()).format).toBe('png');
    await request(app.getHttpServer())
      .get(`/api/v1/files/public/${first.id}`)
      .expect(404);
    await api('get', `/files/${first.id}/content`, 'owner-b').expect(404);
    const second = (await photo(created.id).expect(201)).body;
    await api('patch', `/dashboard/immobilier/${created.id}/photos/order`)
      .send({ photoIds: [second.id, first.id] })
      .expect(200);
    let saved = (await api('get', `/dashboard/immobilier/${created.id}`)).body;
    expect(saved.photos.map((item: any) => item.id)).toEqual([
      second.id,
      first.id,
    ]);
    const replaced = await api(
      'post',
      `/dashboard/immobilier/${created.id}/photos`,
    )
      .field('uploadId', randomUUID())
      .field('replacePhotoId', second.id)
      .attach('photo', image, 'new.png')
      .expect(201);
    await api(
      'delete',
      `/dashboard/immobilier/${created.id}/photos/${first.id}`,
    ).expect(200);
    saved = (await api('get', `/dashboard/immobilier/${created.id}`)).body;
    expect(saved.photos.map((item: any) => item.id)).toEqual([
      replaced.body.id,
    ]);
    const submitted = await api(
      'post',
      `/dashboard/immobilier/${created.id}/submit`,
    ).expect(201);
    expect(submitted.body.status).toBe('pending_review');
    expect(
      (await request(app.getHttpServer()).get('/api/v1/immobilier')).body.data,
    ).toEqual([]);
    db.listings()[0].status = 'active';
    const publicResult = (
      await request(app.getHttpServer()).get(`/api/v1/immobilier/${created.id}`)
    ).body;
    expect(publicResult.metadata.photos).toHaveLength(1);
    expect(JSON.stringify(publicResult)).not.toMatch(
      /private@example|Adresse privée|documents|ownerUserId/,
    );
    await request(app.getHttpServer())
      .get(`/api/v1/files/public/${replaced.body.id}`)
      .expect(200);
    await api('patch', `/dashboard/immobilier/${created.id}`)
      .send({ title: 'Nouvelle version' })
      .expect(200);
    expect(db.listings()[0].status).toBe('draft');
  });

  it.each(['svg', 'truncated', 'oversize'])(
    'rejects invalid photo %s',
    async (kind) => {
      const created = await create();
      const buffer =
        kind === 'svg'
          ? Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')
          : kind === 'truncated'
            ? image.subarray(0, 20)
            : Buffer.alloc(5 * 1024 * 1024 + 1);
      const result = await api(
        'post',
        `/dashboard/immobilier/${created.id}/photos`,
      )
        .field('uploadId', randomUUID())
        .attach('photo', buffer, 'image.png');
      expect([400, 413]).toContain(result.status);
      expect(db.assets()).toHaveLength(0);
    },
  );

  it('enforces the photo count and owner quota', async () => {
    const created = await create();
    db.listings()[0].metadata = {
      photoIds: Array.from({ length: 12 }, (_, index) => `photo-${index}`),
    };
    await photo(created.id).expect(400);
    db.listings()[0].metadata = {};
    db.assets().push({
      id: 'large',
      ownerUserId: owner,
      module: 'real_estate',
      sizeBytes: 100 * 1024 * 1024,
      deletedAt: null,
    });
    await photo(created.id).expect(400);
  });

  it('removes an uploaded binary when the database write rolls back', async () => {
    const created = await create();
    const discard = jest.spyOn(app.get(FilesService), 'discardPhotoBinary');
    db.prisma.realEstateListing.update.mockRejectedValueOnce(
      new Error('database write failed'),
    );
    await photo(created.id).expect(500);
    expect(db.assets()).toHaveLength(0);
    expect(discard).toHaveBeenCalledTimes(1);
    await expect(
      access(join(directory, discard.mock.calls[0][0].storageKey)),
    ).rejects.toThrow();
  });

  it('preserves an uploaded binary when only the transaction acknowledgement was lost', async () => {
    const created = await create();
    const uploadId = randomUUID();
    db.prisma.$transaction.mockImplementationOnce(async (work: any) => {
      await work(db.prisma);
      throw new Error('commit acknowledgement lost');
    });
    await photo(created.id, uploadId).expect(500);
    const retried = (await photo(created.id, uploadId).expect(201)).body;
    expect(db.assets()).toHaveLength(1);
    await api('get', `/files/${retried.id}/content`).expect(200);
  });

  it('refuses a photo order containing another listing photo or a duplicated id', async () => {
    const created = await create();
    const first = (await photo(created.id)).body;
    await api('patch', `/dashboard/immobilier/${created.id}/photos/order`)
      .send({ photoIds: [first.id, first.id] })
      .expect(400);
    await api('patch', `/dashboard/immobilier/${created.id}/photos/order`)
      .send({ photoIds: ['other'] })
      .expect(400);
    await api('delete', `/files/${first.id}`).expect(400);
  });

  it('preserves existing external photos and allows ordering, replacing and removing their references', async () => {
    const created = await create(payload());
    db.listings()[0].metadata.photos = [
      'https://example.test/one.jpg',
      'https://example.test/two.jpg',
    ];
    const loaded = (await api('get', `/dashboard/immobilier/${created.id}`))
      .body;
    expect(loaded.photos).toHaveLength(2);
    expect(loaded.photos[0].legacy).toBe(true);
    await api('patch', `/dashboard/immobilier/${created.id}/photos/order`)
      .send({ photoIds: loaded.photos.map((item: any) => item.id).reverse() })
      .expect(200);
    expect(db.listings()[0].metadata.photos[0]).toBe(
      'https://example.test/two.jpg',
    );
    await api('post', `/dashboard/immobilier/${created.id}/photos`)
      .field('uploadId', randomUUID())
      .field('replacePhotoId', loaded.photos[1].id)
      .attach('photo', image, 'new.png')
      .expect(201);
    await api(
      'delete',
      `/dashboard/immobilier/${created.id}/photos/${loaded.photos[0].id}`,
    ).expect(200);
    expect(db.listings()[0].metadata.photos).toHaveLength(1);
    expect(db.listings()[0].metadata.legacyPhotos).toEqual([]);
  });

  (process.env.PENCMI_PLAYWRIGHT_MODULE ? it : it.skip)(
    'browser: all twelve steps, real binary photos, resume, network failure and submission on mobile',
    async () => {
      await app.listen(0, '127.0.0.1');
      const url = await app.getUrl();
      const modulePath = process.env.PENCMI_PLAYWRIGHT_MODULE!;
      const { chromium } = require(
        (modulePath.startsWith('file:')
          ? fileURLToPath(modulePath)
          : modulePath
        ).replace(/\.mjs$/, '.js'),
      );
      const browser = await chromium.launch({
        channel: 'msedge',
        headless: true,
      });
      try {
        const page = await browser.newPage({
          viewport: { width: 390, height: 844 },
        });
        await page.addInitScript(
          ({ url, owner }: any) => {
            localStorage.setItem('pencmi_access_token', owner);
            localStorage.setItem('pencmi_api_base_url', `${url}/api/v1`);
          },
          { url, owner },
        );
        const capture = async (name: string) => {
          if (!process.env.PENCMI_PUBLICATION_SCREENSHOT_DIRECTORY) return;
          await mkdir(process.env.PENCMI_PUBLICATION_SCREENSHOT_DIRECTORY, {
            recursive: true,
          });
          await page.screenshot({
            path: join(
              process.env.PENCMI_PUBLICATION_SCREENSHOT_DIRECTORY,
              `${name}.png`,
            ),
            fullPage: true,
          });
        };
        const next = async () => {
          await page.locator('[data-next-step]').click();
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
        };
        await page.goto(`${url}/publier/?category=immobilier`);
        await page.locator('[data-save-draft]').click();
        await page
          .getByRole('status')
          .filter({ hasText: 'Brouillon enregistré.' })
          .waitFor();
        expect(db.listings()).toHaveLength(1);
        await page.locator('[value="location"]').check();
        await next();
        await page.locator('[value="appartement"]').check();
        await next();
        await page
          .locator('[data-path="location.region"]')
          .selectOption('Dakar');
        await page.locator('[data-path="location.city"]').selectOption('Dakar');
        await page.locator('[data-path="location.district"]').fill('Yoff');
        await next();
        await page.locator('[data-path="pricing.price"]').fill('250000');
        await next();
        await page.locator('[data-path="features.surface"]').fill('90');
        await next();
        await page.locator('[data-photo-upload]').setInputFiles({
          name: 'photo.png',
          mimeType: 'image/png',
          buffer: image,
        });
        await page.locator('.publication-photo img').waitFor();
        expect(
          await page
            .locator('.publication-photo img')
            .evaluate((img: HTMLImageElement) => img.naturalWidth),
        ).toBe(16);
        await capture('photos-mobile');
        await next();
        const title = '<img src=x onerror="window.injected=true"> Appartement';
        await page.locator('[data-path="content.title"]').fill(title);
        await page
          .locator('[data-path="content.description"]')
          .fill('Un logement lumineux à Dakar.');
        await next();
        await page.locator('[data-path="conditions.deposit"]').fill('250000');
        await next();
        await page.locator('[data-document-index="1"]').check();
        await next();
        await page
          .locator('[data-path="contactPreferences.internalMessagingEnabled"]')
          .check();
        await page.locator('[data-save-draft]').click();
        await page
          .getByRole('status')
          .filter({ hasText: 'Brouillon enregistré.' })
          .waitFor();
        const id = db.listings()[0].id;
        await page.goto(`${url}/dashboard/immobilier/annonces/edit/?id=${id}`);
        await page.locator('[data-preview-step]:enabled').waitFor();
        await page.locator('[data-preview-step]').click();
        await page.getByText(title, { exact: true }).waitFor();
        expect(
          await page.evaluate(() => (window as any).injected),
        ).toBeUndefined();
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await capture('preview-mobile');
        await page.setViewportSize({ width: 1280, height: 900 });
        await capture('preview-desktop');
        await page.setViewportSize({ width: 390, height: 844 });
        await page.route('**/api/v1/dashboard/immobilier/*', (route: any) =>
          route.request().method() === 'PATCH'
            ? route.abort()
            : route.continue(),
        );
        await page.locator('[data-save-draft]').click();
        await page.getByText(/Connexion interrompue/).waitFor();
        expect(await page.locator('.status-message').count()).toBe(0);
        expect(db.listings()).toHaveLength(1);
        await page.unroute('**/api/v1/dashboard/immobilier/*');
        await next();
        await page.locator('[data-submit-listing]').first().click();
        await page
          .getByText('Votre annonce a été soumise avec succès.', {
            exact: true,
          })
          .waitFor();
        expect(db.listings()[0].status).toBe('pending_review');
        expect(
          db.listings()[0].metadata.publication.documents[1].available,
        ).toBe(true);
        expect(db.listings()[0].metadata.publication.features.surface).toBe(90);
        await page.screenshot({
          path: join(directory, 'publication-mobile.png'),
          fullPage: true,
        });
        await page.setViewportSize({ width: 1280, height: 900 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      } finally {
        await browser.close();
      }
    },
    90000,
  );
});

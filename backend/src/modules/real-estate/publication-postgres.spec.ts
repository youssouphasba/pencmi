import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type SharpFactory from 'sharp';
import { PrismaService } from '../../database/prisma/prisma.service';
import { FilesService } from '../../files/files.service';
import { RealEstateService } from './real-estate.service';

const sharp: typeof SharpFactory = require('sharp');
const testUrl = process.env.TEST_DATABASE_URL;

(testUrl ? describe : describe.skip)(
  'Real estate publication against PostgreSQL',
  () => {
    it('persists drafts and photos, serializes retries and submits without public exposure', async () => {
      if (
        !testUrl ||
        !/(?:^|[_-])test(?:[_-]|$)/i.test(new URL(testUrl).pathname.slice(1))
      ) {
        throw new Error(
          'TEST_DATABASE_URL must point to an explicitly named test database.',
        );
      }
      const prisma = new PrismaClient({
        datasources: { db: { url: testUrl } },
      });
      const directory = await mkdtemp(
        join(tmpdir(), 'pencmi-publication-postgres-'),
      );
      const files = new FilesService(
        prisma as PrismaService,
        new ConfigService({
          STORAGE_DRIVER: 'local',
          LOCAL_UPLOAD_DIRECTORY: directory,
          API_PREFIX: 'api/v1',
        }),
      );
      const service = new RealEstateService(prisma as PrismaService, files);
      let ownerUserId: string | undefined;
      try {
        const user = await prisma.user.create({
          data: { role: 'real_estate_agency', status: 'active' },
        });
        ownerUserId = user.id;
        const requestId = randomUUID();
        const created = await Promise.all([
          service.create(user.id, { requestId }),
          service.create(user.id, { requestId }),
        ]);
        expect(created[0].id).toBe(created[1].id);
        expect(
          await prisma.realEstateListing.count({ where: { ownerUserId } }),
        ).toBe(1);
        const id = created[0].id;
        await service.update(user.id, id, {
          title: 'Appartement à Dakar',
          description: 'Description du logement.',
          transaction: 'location',
          propertyType: 'appartement',
          metadata: {
            location: {
              country: 'SN',
              region: 'Dakar',
              city: 'Dakar',
              district: 'Yoff',
            },
            pricing: { price: 250000, currency: 'FCFA' },
            features: { surface: 90 },
            conditions: { deposit: 250000 },
            documents: [{ type: 'bail', available: true }],
            contactPreferences: { internalMessagingEnabled: true },
          },
        });
        const image = await sharp({
          create: { width: 16, height: 16, channels: 3, background: '#187b46' },
        })
          .png()
          .toBuffer();
        const input = {
          buffer: image,
          size: image.length,
          mimetype: 'image/png',
          originalname: 'photo.png',
        };
        const uploadId = randomUUID();
        const uploaded = await Promise.all([
          service.uploadPhoto(user.id, id, uploadId, input),
          service.uploadPhoto(user.id, id, uploadId, input),
        ]);
        expect(uploaded[0].id).toBe(uploaded[1].id);
        expect(await prisma.fileAsset.count({ where: { ownerUserId } })).toBe(
          1,
        );
        const saved = await service.findOwned(user.id, id);
        expect(saved.price).toBe(250000);
        expect(saved.photos).toHaveLength(1);
        expect(
          (await files.streamOwnedContent(uploaded[0].id, user.id)).buffer
            .length,
        ).toBeGreaterThan(0);
        expect((await service.submit(user.id, id)).status).toBe(
          'pending_review',
        );
        await expect(service.findPublicOne(id)).rejects.toThrow();
        await expect(
          service.update('another-user', id, { title: 'Forbidden' }),
        ).rejects.toThrow();
      } finally {
        if (ownerUserId) {
          const assets = await prisma.fileAsset.findMany({
            where: { ownerUserId },
            select: { id: true },
          });
          await prisma.fileUsage.deleteMany({
            where: { fileId: { in: assets.map((asset) => asset.id) } },
          });
          await prisma.fileAsset.deleteMany({ where: { ownerUserId } });
          await prisma.realEstateListing.deleteMany({ where: { ownerUserId } });
          await prisma.user.delete({ where: { id: ownerUserId } });
        }
        await prisma.$disconnect();
        await rm(directory, { recursive: true, force: true });
      }
    }, 60000);
  },
);

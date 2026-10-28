import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import type SharpFactory from 'sharp';
import { PrismaService } from '../../database/prisma/prisma.service';
import { FilesService } from '../../files/files.service';
import { HotelPublicationService } from './hotel-publication.service';

const sharp: typeof SharpFactory = require('sharp');
(process.env.TEST_DATABASE_URL &&
  process.env.HOTEL_REMOTE_STORAGE_TEST === 'true'
  ? describe
  : describe.skip)('Hotel persistent remote storage', () => {
  it('uploads a real image, reads it from a new storage instance and cleans only its own asset', async () => {
    const url = process.env.TEST_DATABASE_URL!;
    if (
      !new URL(url).pathname.endsWith('_test') ||
      !process.env.PRODUCTION_CLUSTER_ID
    )
      throw new Error('An isolated database is required.');
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    const identity: any[] = await prisma.$queryRawUnsafe(
      'SELECT system_identifier::text AS id FROM pg_control_system()',
    );
    if (identity[0].id === process.env.PRODUCTION_CLUSTER_ID)
      throw new Error('Production database writes forbidden.');
    const config = new ConfigService({
      ...process.env,
      NODE_ENV: 'production',
      STORAGE_DRIVER: 'r2',
    });
    const files = new FilesService(prisma as PrismaService, config);
    const service = new HotelPublicationService(prisma as PrismaService, files);
    const user = await prisma.user.create({
      data: { role: 'hotel_manager', status: 'active' },
    });
    let id: string | undefined;
    let photoId: string | undefined;
    try {
      id = (await service.create(user.id, { requestId: randomUUID() })).id;
      const buffer = await sharp({
        create: { width: 16, height: 16, channels: 3, background: '#217c61' },
      })
        .webp()
        .toBuffer();
      const result = await service.photo(
        user.id,
        id,
        { uploadId: randomUUID() },
        {
          buffer,
          size: buffer.length,
          mimetype: 'image/webp',
          originalname: 'test.webp',
        },
      );
      photoId = result.photos[0].id;
      await expect(files.streamPublicContent(photoId)).rejects.toThrow();
      const fresh = new FilesService(prisma as PrismaService, config);
      expect(
        (await fresh.streamOwnedContent(photoId, user.id)).buffer.length,
      ).toBeGreaterThan(0);
      await service.removePhoto(user.id, id, photoId);
      expect(
        (await prisma.fileAsset.findUniqueOrThrow({ where: { id: photoId } }))
          .sizeBytes,
      ).toBe(0);
    } finally {
      if (photoId) {
        const asset = await prisma.fileAsset.findUnique({
          where: { id: photoId },
        });
        if (asset) await files.discardPhotoBinary(asset);
      }
      if (id) await prisma.fileUsage.deleteMany({ where: { targetId: id } });
      await prisma.fileAsset.deleteMany({ where: { ownerUserId: user.id } });
      if (id) await prisma.hotelProperty.delete({ where: { id } });
      await prisma.user.delete({ where: { id: user.id } });
      await prisma.$disconnect();
    }
  }, 90000);
});

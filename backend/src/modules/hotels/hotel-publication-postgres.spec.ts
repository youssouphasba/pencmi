import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type SharpFactory from 'sharp';
import { PrismaService } from '../../database/prisma/prisma.service';
import { FilesService } from '../../files/files.service';
import { HotelPublicationService } from './hotel-publication.service';
import { HotelsService } from './hotels.service';
import { HotelReservationsService } from './hotel-reservations.service';

const sharp: typeof SharpFactory = require('sharp');
const url = process.env.TEST_DATABASE_URL;
(url ? describe : describe.skip)(
  'Hotel publication on isolated PostgreSQL',
  () => {
    it('persists drafts, rooms, prices, calendar, photos and enforces boundaries', async () => {
      if (
        !url ||
        !new URL(url).pathname.endsWith('_test') ||
        !process.env.PRODUCTION_CLUSTER_ID
      )
        throw new Error('An explicit isolated test database is required.');
      const prisma = new PrismaClient({ datasources: { db: { url } } });
      const cluster: any[] = await prisma.$queryRawUnsafe(
        'SELECT system_identifier::text AS id FROM pg_control_system()',
      );
      if (cluster[0].id === process.env.PRODUCTION_CLUSTER_ID)
        throw new Error('Production test writes are forbidden.');
      const directory = await mkdtemp(join(tmpdir(), 'pencmi-hotels-'));
      const config = new ConfigService({
        STORAGE_DRIVER: 'local',
        LOCAL_UPLOAD_DIRECTORY: directory,
      });
      const files = new FilesService(prisma as PrismaService, config);
      const service = new HotelPublicationService(
        prisma as PrismaService,
        files,
      );
      const publicService = new HotelsService(
        prisma as PrismaService,
        new HotelReservationsService(prisma as PrismaService),
      );
      const users: string[] = [];
      const properties: string[] = [];
      try {
        const owner = await prisma.user.create({
          data: { role: 'hotel_manager', status: 'active' },
        });
        users.push(owner.id);
        const other = await prisma.user.create({
          data: { role: 'hotel_manager', status: 'active' },
        });
        users.push(other.id);
        const requestId = randomUUID();
        const created = await Promise.all([
          service.create(owner.id, { requestId }),
          service.create(owner.id, { requestId }),
        ]);
        const id = created[0].id;
        properties.push(id);
        expect(created[1].id).toBe(id);
        expect(
          await prisma.hotelProperty.count({
            where: { ownerUserId: owner.id },
          }),
        ).toBe(1);
        expect((await service.owned(owner.id, id)).status).toBe('draft');
        await expect(service.submit(owner.id, id)).rejects.toThrow();
        await expect(service.owned(other.id, id)).rejects.toThrow();
        await expect(
          service.update(other.id, id, { name: 'Intrusion' }),
        ).rejects.toThrow();
        await expect(
          service.update(owner.id, id, { status: 'active' } as any),
        ).rejects.toThrow();
        const baseRoom = {
          clientId: randomUUID(),
          name: 'Double',
          roomType: 'double',
          capacity: 3,
          adults: 2,
          children: 1,
          beds: 2,
          totalUnits: 4,
          currency: 'FCFA',
          enabled: true,
          basePrice: 25000,
          rates: [
            {
              start: '2026-11-01',
              end: '2026-11-03',
              price: 30000,
              currency: 'FCFA',
            },
          ],
          calendar: [
            {
              start: '2026-11-01',
              end: '2026-11-03',
              available: 0,
              status: 'maintenance',
              stopSell: true,
              minStay: 2,
            },
          ],
        };
        const saved = await service.update(owner.id, id, {
          name: 'Hébergement de recette',
          propertyType: 'hotel',
          city: 'Dakar',
          region: 'Dakar',
          address: 'Adresse privée',
          description: 'Description complète',
          metadata: {
            general: { stars: 3 },
            amenities: ['Wi-Fi'],
            management: { mode: 'manual', showRemainingRoomsToClients: true },
            contactPreferences: {
              internalMessagingEnabled: true,
              notificationEmail: 'private@example.com',
            },
          },
          rooms: [
            baseRoom,
            {
              ...baseRoom,
              clientId: randomUUID(),
              name: 'Familiale',
              basePrice: 40000,
              rates: [],
              calendar: [],
            },
          ],
        });
        expect(saved.rooms).toHaveLength(2);
        expect(saved.rooms[0].rates).toHaveLength(1);
        expect(saved.rooms[0].calendar).toHaveLength(1);
        expect(saved.rooms[0].calendar[0].status).toBe('maintenance');
        await service.update(owner.id, id, { rooms: saved.rooms });
        expect(
          (await service.owned(owner.id, id)).rooms
            .map((room) => room.id)
            .sort(),
        ).toEqual(saved.rooms.map((room) => room.id).sort());
        await expect(
          service.update(owner.id, id, {
            rooms: [{ ...saved.rooms[0], totalUnits: -1 }],
          }),
        ).rejects.toThrow();
        await expect(publicService.findPublicOne(id)).rejects.toThrow();
        const buffer = await sharp({
          create: { width: 16, height: 16, channels: 3, background: '#137b49' },
        })
          .png()
          .toBuffer();
        const image = {
          buffer,
          size: buffer.length,
          mimetype: 'image/png',
          originalname: 'image.png',
        };
        const uploadId = randomUUID();
        const uploaded = await Promise.all([
          service.photo(
            owner.id,
            id,
            { uploadId, roomId: saved.rooms[0].id },
            image,
          ),
          service.photo(
            owner.id,
            id,
            { uploadId, roomId: saved.rooms[0].id },
            image,
          ),
        ]);
        expect(uploaded[0].photos).toHaveLength(1);
        let photoId = uploaded[0].photos[0].id;
        await expect(files.streamPublicContent(photoId)).rejects.toThrow();
        expect(
          (await files.streamOwnedContent(photoId, owner.id)).buffer,
        ).toEqual(buffer);
        await expect(
          service.removePhoto(other.id, id, photoId),
        ).rejects.toThrow();
        await expect(
          service.photo(
            owner.id,
            id,
            { uploadId: randomUUID() },
            { ...image, buffer: Buffer.from('<svg/>') },
          ),
        ).rejects.toThrow();
        expect((await service.submit(owner.id, id)).status).toBe(
          'pending_review',
        );
        await expect(publicService.findPublicOne(id)).rejects.toThrow();
        await prisma.hotelProperty.update({
          where: { id },
          data: { status: 'active' },
        });
        const published = await publicService.findPublicOne(id);
        expect(published.metadata.priceFrom).toBe(25000);
        expect(JSON.stringify(published)).not.toContain('Adresse privée');
        expect(JSON.stringify(published)).not.toContain('private@example.com');
        expect((await files.streamPublicContent(photoId)).buffer).toEqual(
          buffer,
        );
        const restartedFiles = new FilesService(
          prisma as PrismaService,
          config,
        );
        expect(
          (await restartedFiles.streamPublicContent(photoId)).buffer,
        ).toEqual(buffer);
        const oldPhotoId = photoId;
        const replacement = await service.photo(
          owner.id,
          id,
          { uploadId: randomUUID(), replacePhotoId: oldPhotoId },
          image,
        );
        expect(replacement.photos).toHaveLength(1);
        photoId = replacement.photos[0].id;
        expect(photoId).not.toBe(oldPhotoId);
        await expect(
          files.streamOwnedContent(oldPhotoId, owner.id),
        ).rejects.toThrow();
        expect(
          (await service.reorder(owner.id, id, [photoId])).photos[0].id,
        ).toBe(photoId);
        await expect(
          service.reorder(owner.id, id, ['unrelated-photo']),
        ).rejects.toThrow();
        await expect(
          service.update(owner.id, id, {
            rooms: [{ ...saved.rooms[0], remove: true }],
          }),
        ).rejects.toThrow();
        await prisma.hotelIntegration.create({
          data: { propertyId: id, sourceOfTruth: 'external_system' },
        });
        await expect(
          service.update(owner.id, id, { rooms: saved.rooms }),
        ).rejects.toThrow();
        await expect(
          service.update(owner.id, id, { name: 'Overwrite' }),
        ).rejects.toThrow();
        const unchanged = await prisma.hotelRoomRate.count({
          where: { roomId: saved.rooms[0].id },
        });
        expect(unchanged).toBe(3);
        await service.removePhoto(owner.id, id, photoId);
        expect((await service.owned(owner.id, id)).photos).toHaveLength(0);
      } finally {
        await prisma.fileUsage.deleteMany({
          where: { targetId: { in: properties } },
        });
        await prisma.fileAsset.deleteMany({
          where: { ownerUserId: { in: users } },
        });
        await prisma.hotelProperty.deleteMany({
          where: { ownerUserId: { in: users } },
        });
        await prisma.user.deleteMany({ where: { id: { in: users } } });
        await prisma.$disconnect();
        await rm(directory, { recursive: true, force: true });
      }
    }, 120000);
  },
);

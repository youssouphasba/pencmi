import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type SharpFactory from 'sharp';
import { PrismaService } from '../../database/prisma/prisma.service';
import { FilesService } from '../../files/files.service';
import { VehiclePublicationService } from './vehicle-publication.service';
import { VehiclesService } from './vehicles.service';
import { completeVehicle } from './vehicle-publication.test-data';

const sharp: typeof SharpFactory = require('sharp');
const url = process.env.TEST_DATABASE_URL;
(url ? describe : describe.skip)(
  'Vehicle publication on isolated PostgreSQL',
  () => {
    let prisma: PrismaClient,
      files: FilesService,
      publication: VehiclePublicationService,
      service: VehiclesService;
    let owner: string, other: string, directory: string;
    const ids: string[] = [];
    beforeAll(async () => {
      if (
        !url ||
        !new URL(url).pathname.endsWith('_test') ||
        !process.env.PRODUCTION_CLUSTER_ID
      )
        throw new Error('Explicit isolated database required.');
      prisma = new PrismaClient({ datasources: { db: { url } }, log: [] });
      const cluster: any[] = await prisma.$queryRawUnsafe(
        'SELECT system_identifier::text AS id FROM pg_control_system()',
      );
      if (cluster[0].id === process.env.PRODUCTION_CLUSTER_ID)
        throw new Error('Production writes forbidden.');
      directory = await mkdtemp(join(tmpdir(), 'pencmi-vehicles-'));
      files = new FilesService(
        prisma as PrismaService,
        new ConfigService({
          STORAGE_DRIVER: 'local',
          LOCAL_UPLOAD_DIRECTORY: directory,
        }),
      );
      publication = new VehiclePublicationService(
        prisma as PrismaService,
        files,
      );
      service = new VehiclesService(prisma as PrismaService);
      owner = (
        await prisma.user.create({
          data: { role: 'vehicle_dealer', status: 'active' },
        })
      ).id;
      other = (
        await prisma.user.create({
          data: { role: 'vehicle_renter', status: 'active' },
        })
      ).id;
    }, 60000);
    afterAll(async () => {
      if (!prisma || !owner) return;
      await prisma.contactEvent.deleteMany({ where: { ownerUserId: owner } });
      await prisma.vehicleRentalRequest.deleteMany({
        where: { listingId: { in: ids } },
      });
      await prisma.vehicleChauffeurRequest.deleteMany({
        where: { listingId: { in: ids } },
      });
      await prisma.fileUsage.deleteMany({ where: { targetId: { in: ids } } });
      for (const asset of await prisma.fileAsset.findMany({
        where: { ownerUserId: owner },
      }))
        await files.discardPhotoBinary(asset);
      await prisma.fileAsset.deleteMany({ where: { ownerUserId: owner } });
      await prisma.vehicleListing.deleteMany({ where: { id: { in: ids } } });
      await prisma.user.deleteMany({ where: { id: { in: [owner, other] } } });
      await prisma.$disconnect();
      if (directory) await rm(directory, { recursive: true, force: true });
    }, 60000);
    async function create(input: any = {}) {
      const result = await publication.create(owner, {
        ...input,
        requestId: randomUUID(),
      });
      ids.push(result.id);
      return result;
    }
    it('saves concurrent incomplete drafts without duplication, resumes and preserves edits after retry', async () => {
      const requestId = randomUUID();
      const [a, b] = await Promise.all([
        publication.create(owner, { requestId }),
        publication.create(owner, { requestId }),
      ]);
      ids.push(a.id);
      expect(a.id).toBe(b.id);
      await publication.update(owner, a.id, { title: 'Titre conservé' });
      expect((await publication.create(owner, { requestId })).title).toBe(
        'Titre conservé',
      );
      expect((await publication.findOwned(owner, a.id)).status).toBe('draft');
      await expect(publication.submit(owner, a.id)).rejects.toThrow();
      await expect(service.findPublicOne(a.id)).rejects.toThrow();
    }, 60000);
    it.each(['sale', 'rental', 'chauffeur'] as const)(
      'persists %s prices, all sections and submits without exposing private metadata',
      async (vehicleMode) => {
        const draft = await create({ ...completeVehicle, vehicleMode });
        expect(draft.price).toBe(
          { sale: 9000000, rental: 25000, chauffeur: 20000 }[vehicleMode],
        );
        expect(draft.publication.pricing.price).toBe(9000000);
        expect(draft.publication.documents).toEqual(['Assurance']);
        expect((await publication.submit(owner, draft.id)).status).toBe(
          'pending_review',
        );
        await expect(service.findPublicOne(draft.id)).rejects.toThrow();
        await prisma.vehicleListing.update({
          where: { id: draft.id },
          data: { status: 'active' },
        });
        const visible = await service.findPublicOne(draft.id);
        expect(visible.title).toBe(completeVehicle.title);
        expect(visible.metadata.photos).toEqual([]);
        expect(visible.metadata.brand).toBe('Toyota');
        expect(JSON.stringify(visible)).not.toContain('Indication privée');
        expect(JSON.stringify(visible)).not.toContain('private@example.test');
        expect(visible).not.toHaveProperty('ownerUserId');
        if (vehicleMode !== 'sale')
          expect(visible.metadata).not.toHaveProperty('price');
        const updated = await publication.update(owner, draft.id, {
          metadata: { info: { color: 'Blanc' } },
        });
        expect(updated.status).toBe('draft');
        expect(updated.publication.identity.model).toBe('Corolla');
        expect(updated.publication.info.fuel).toBe('Essence');
        await expect(service.findPublicOne(draft.id)).rejects.toThrow();
      },
      60000,
    );
    it('rejects foreign edits, administrative fields and invalid nested fields', async () => {
      const draft = await create();
      await expect(publication.findOwned(other, draft.id)).rejects.toThrow();
      await expect(
        publication.update(other, draft.id, completeVehicle),
      ).rejects.toThrow();
      await expect(
        publication.update(owner, draft.id, { status: 'active' } as any),
      ).rejects.toThrow();
      await expect(
        publication.update(owner, draft.id, {
          metadata: { ownerUserId: other },
        }),
      ).rejects.toThrow();
      await expect(service.softDelete(other, draft.id)).rejects.toThrow();
    }, 60000);
    it('preserves prices across mode changes and allows explicit clearing', async () => {
      const draft = await create(completeVehicle);
      const rental = await publication.update(owner, draft.id, {
        vehicleMode: 'rental',
      });
      expect(rental.price).toBe(25000);
      expect(rental.publication.pricing.price).toBe(9000000);
      expect(
        (
          await publication.update(owner, draft.id, {
            metadata: { pricing: { pricePerDay: null } },
          })
        ).price,
      ).toBeNull();
      await expect(publication.submit(owner, draft.id)).rejects.toThrow();
    }, 60000);
    it('uploads binary photos, protects drafts, orders, replaces and deletes scoped files', async () => {
      const draft = await create(completeVehicle);
      const buffer = await sharp({
        create: { width: 20, height: 16, channels: 3, background: '#147b49' },
      })
        .png()
        .toBuffer();
      const file = {
        buffer,
        size: buffer.length,
        mimetype: 'image/png',
        originalname: 'photo.png',
      };
      const uploadId = randomUUID();
      const first = await publication.photo(
        owner,
        draft.id,
        { uploadId },
        file,
      );
      const photoId = first.photos[0].id;
      expect(
        (await publication.photo(owner, draft.id, { uploadId }, file)).photos,
      ).toHaveLength(1);
      await expect(files.streamPublicContent(photoId)).rejects.toThrow();
      await expect(files.streamOwnedContent(photoId, other)).rejects.toThrow();
      expect(
        (await files.streamOwnedContent(photoId, owner)).buffer.length,
      ).toBeGreaterThan(0);
      await expect(files.softDelete(photoId, owner)).rejects.toThrow();
      await expect(
        publication.removePhoto(other, draft.id, photoId),
      ).rejects.toThrow();
      await expect(
        publication.photo(
          owner,
          draft.id,
          { uploadId: randomUUID() },
          { ...file, buffer: Buffer.from('<svg></svg>') },
        ),
      ).rejects.toThrow();
      await expect(
        publication.photo(
          owner,
          draft.id,
          { uploadId: randomUUID() },
          {
            ...file,
            size: 6 * 1024 * 1024,
            buffer: Buffer.alloc(6 * 1024 * 1024),
          },
        ),
      ).rejects.toThrow();
      const second = await publication.photo(
        owner,
        draft.id,
        { uploadId: randomUUID() },
        file,
      );
      const order = second.photos.map((photo) => photo.id).reverse();
      const reordered = await publication.reorder(owner, draft.id, order);
      expect(reordered.photos.map((photo) => photo.id)).toEqual(order);
      expect((reordered.metadata as any).coverPhoto).toBe(
        reordered.photos[0].url,
      );
      await expect(
        publication.reorder(owner, draft.id, ['foreign']),
      ).rejects.toThrow();
      await publication.submit(owner, draft.id);
      await prisma.vehicleListing.update({
        where: { id: draft.id },
        data: { status: 'active' },
      });
      expect(
        (await files.streamPublicContent(photoId)).buffer.length,
      ).toBeGreaterThan(0);
      expect(
        (await service.findPublicOne(draft.id)).metadata.photos,
      ).toHaveLength(2);
      const replaced = await publication.photo(
        owner,
        draft.id,
        { uploadId: randomUUID(), replacePhotoId: photoId },
        file,
      );
      expect(replaced.photos).toHaveLength(2);
      expect(replaced.photos.some((photo) => photo.id === photoId)).toBe(false);
      expect(
        (await prisma.fileAsset.findUniqueOrThrow({ where: { id: photoId } }))
          .sizeBytes,
      ).toBe(0);
      await expect(
        files.streamPublicContent(replaced.photos[0].id),
      ).rejects.toThrow();
      const removed = await publication.removePhoto(
        owner,
        draft.id,
        replaced.photos[0].id,
      );
      expect(removed.photos).toHaveLength(1);
      const reloadedFiles = new FilesService(
        prisma as PrismaService,
        new ConfigService({
          STORAGE_DRIVER: 'local',
          LOCAL_UPLOAD_DIRECTORY: directory,
        }),
      );
      expect(
        (await reloadedFiles.streamOwnedContent(removed.photos[0].id, owner))
          .buffer.length,
      ).toBeGreaterThan(0);
    }, 120000);
    it('only accepts requests for active listings of the matching type and saves real contacts', async () => {
      const sale = await create(completeVehicle),
        rental = await create({ ...completeVehicle, vehicleMode: 'rental' }),
        chauffeur = await create({
          ...completeVehicle,
          vehicleMode: 'chauffeur',
        });
      const contact = {
        clientName: 'Client de recette',
        clientEmail: 'client@example.test',
        startDate: '2030-01-01',
        endDate: '2030-01-03',
        message: 'Message conservé',
      };
      await expect(
        service.createRentalRequest(rental.id, contact),
      ).rejects.toThrow();
      for (const listing of [sale, rental, chauffeur])
        await prisma.vehicleListing.update({
          where: { id: listing.id },
          data: { status: 'active' },
        });
      await expect(
        service.createRentalRequest(sale.id, contact),
      ).rejects.toThrow();
      await expect(
        service.createRentalRequest(chauffeur.id, contact),
      ).rejects.toThrow();
      await expect(
        service.createChauffeurRequest(rental.id, contact),
      ).rejects.toThrow();
      await expect(
        service.createRentalRequest(rental.id, {
          ...contact,
          startDate: '2000-01-01',
        }),
      ).rejects.toThrow();
      await expect(
        service.createRentalRequest(rental.id, {
          ...contact,
          endDate: contact.startDate,
        }),
      ).rejects.toThrow();
      await expect(
        service.createRentalRequest(rental.id, {
          ...contact,
          clientEmail: undefined,
        }),
      ).rejects.toThrow();
      expect(
        (await service.createRentalRequest(rental.id, contact)).status,
      ).toBe('new');
      expect(
        (await service.createChauffeurRequest(chauffeur.id, contact)).status,
      ).toBe('new');
      expect((await service.createContact(sale.id, contact)).received).toBe(
        true,
      );
      expect(
        await prisma.contactEvent.count({
          where: {
            ownerUserId: owner,
            targetId: { in: [sale.id, rental.id, chauffeur.id] },
          },
        }),
      ).toBe(3);
      expect(
        (await service.findMyRentalRequests(other, { page: 1, limit: 100 }))
          .data,
      ).toHaveLength(0);
      const request = (
        await service.findMyRentalRequests(owner, { page: 1, limit: 100 })
      ).data.find((item) => item.listingId === rental.id)!;
      await expect(
        service.updateRentalRequestStatus(other, request.id, {
          status: 'accepted',
        }),
      ).rejects.toThrow();
      await service.updateRentalRequestStatus(owner, request.id, {
        status: 'accepted',
      });
      await expect(
        publication.update(owner, rental.id, { vehicleMode: 'sale' }),
      ).rejects.toThrow();
      await service.softDelete(owner, chauffeur.id);
      await expect(
        service.createChauffeurRequest(chauffeur.id, contact),
      ).rejects.toThrow();
      await expect(service.findPublicOne(chauffeur.id)).rejects.toThrow();
    }, 90000);
    it('queries persisted current and legacy metadata with server-side filters and pagination', async () => {
      const draft = await create(completeVehicle);
      await prisma.vehicleListing.update({
        where: { id: draft.id },
        data: { status: 'active', title: `Filtre-${draft.id}` },
      });
      const found = await service.findPublic({
        query: `Filtre-${draft.id}`,
        brand: 'toy',
        model: 'roll',
        fuel: 'essence',
        gearbox: 'auto',
        vehicleMode: 'sale',
        minPrice: 8000000,
        maxPrice: 10000000,
        page: 1,
        limit: 1,
      });
      expect(found.data.map((item) => item.id)).toEqual([draft.id]);
      expect(
        (
          await service.findPublic({
            query: 'Toyota',
            vehicleMode: 'sale',
            page: 1,
            limit: 100,
          })
        ).data.map((item) => item.id),
      ).toContain(draft.id);
      expect(
        (
          await service.findPublic({
            query: `Filtre-${draft.id}`,
            maxPrice: 1,
            page: 1,
            limit: 20,
          })
        ).data,
      ).toHaveLength(0);
      await service.softDelete(owner, draft.id);
      expect(
        (
          await service.findPublic({
            query: `Filtre-${draft.id}`,
            page: 1,
            limit: 20,
          })
        ).data,
      ).toHaveLength(0);
    }, 60000);
    it('refuses production uploads without persistent storage and enforces photo count and owner quota', async () => {
      const draft = await create(completeVehicle);
      const buffer = await sharp({
        create: { width: 16, height: 16, channels: 3, background: '#147b49' },
      })
        .jpeg()
        .toBuffer();
      const file = {
        buffer,
        size: buffer.length,
        mimetype: 'image/jpeg',
        originalname: 'photo.jpg',
      };
      const unsafe = new VehiclePublicationService(
        prisma as PrismaService,
        new FilesService(
          prisma as PrismaService,
          new ConfigService({
            NODE_ENV: 'production',
            STORAGE_DRIVER: 'local',
          }),
        ),
      );
      await expect(
        unsafe.photo(owner, draft.id, { uploadId: randomUUID() }, file),
      ).rejects.toThrow();
      await prisma.vehicleListing.update({
        where: { id: draft.id },
        data: {
          metadata: {
            photos: Array.from(
              { length: 30 },
              (_, index) => `https://example.test/${index}.jpg`,
            ),
          },
        },
      });
      await expect(
        publication.photo(owner, draft.id, { uploadId: randomUUID() }, file),
      ).rejects.toThrow('30 photos');
      const quota = await prisma.fileAsset.create({
        data: {
          ownerUserId: owner,
          module: 'vehicles',
          mimeType: 'image/jpeg',
          sizeBytes: 150 * 1024 * 1024,
          storageKey: `vehicles/${owner}/quota-fixture`,
        },
      });
      try {
        const empty = await create();
        await expect(
          publication.photo(owner, empty.id, { uploadId: randomUUID() }, file),
        ).rejects.toThrow('Quota');
      } finally {
        await prisma.fileAsset.delete({ where: { id: quota.id } });
      }
    }, 60000);
    (process.env.HOTEL_REMOTE_STORAGE_TEST === 'true' ? it : it.skip)(
      'persists a real vehicle photo in R2 and reads it from a fresh storage instance',
      async () => {
        const config = new ConfigService({
          ...process.env,
          NODE_ENV: 'production',
          STORAGE_DRIVER: 'r2',
        });
        const remoteFiles = new FilesService(prisma as PrismaService, config);
        const remote = new VehiclePublicationService(
          prisma as PrismaService,
          remoteFiles,
        );
        const draft = await remote.create(owner, {
          ...completeVehicle,
          requestId: randomUUID(),
        });
        ids.push(draft.id);
        let photoId: string | undefined;
        try {
          const buffer = await sharp({
            create: {
              width: 16,
              height: 16,
              channels: 3,
              background: '#218c61',
            },
          })
            .webp()
            .toBuffer();
          const saved = await remote.photo(
            owner,
            draft.id,
            { uploadId: randomUUID() },
            {
              buffer,
              size: buffer.length,
              mimetype: 'image/webp',
              originalname: 'photo.webp',
            },
          );
          photoId = saved.photos[0].id;
          await expect(
            remoteFiles.streamPublicContent(photoId),
          ).rejects.toThrow();
          expect(
            (
              await new FilesService(
                prisma as PrismaService,
                config,
              ).streamOwnedContent(photoId, owner)
            ).buffer.length,
          ).toBeGreaterThan(0);
          await prisma.vehicleListing.update({
            where: { id: draft.id },
            data: { status: 'active' },
          });
          expect(
            (await remoteFiles.streamPublicContent(photoId)).buffer.length,
          ).toBeGreaterThan(0);
          await remote.removePhoto(owner, draft.id, photoId);
          expect(
            (
              await prisma.fileAsset.findUniqueOrThrow({
                where: { id: photoId },
              })
            ).sizeBytes,
          ).toBe(0);
        } finally {
          if (photoId) {
            const asset = await prisma.fileAsset.findUnique({
              where: { id: photoId },
            });
            if (asset) await remoteFiles.discardPhotoBinary(asset);
          }
        }
      },
      90000,
    );
  },
);

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { HotelReservationsService } from './hotel-reservations.service';
import { HotelPublicationService } from './hotel-publication.service';
import { HotelsService } from './hotels.service';
import { PaginationDto } from '../../common/pagination/pagination.dto';

const url = process.env.TEST_DATABASE_URL;
(url ? describe : describe.skip)(
  'Hotel reservations on isolated PostgreSQL',
  () => {
    it('enforces ownership, idempotency, atomic allocation and safe calendar changes', async () => {
      if (
        !url ||
        !new URL(url).pathname.endsWith('_test') ||
        !process.env.PRODUCTION_CLUSTER_ID
      )
        throw new Error('Explicit isolated PostgreSQL required.');
      const db = new PrismaClient({ datasources: { db: { url } } });
      const cluster: any[] = await db.$queryRawUnsafe(
        'SELECT system_identifier::text AS id FROM pg_control_system()',
      );
      if (cluster[0].id === process.env.PRODUCTION_CLUSTER_ID) {
        await db.$disconnect();
        throw new Error('Production writes forbidden.');
      }
      const service = new HotelReservationsService(db as PrismaService);
      const publication = new HotelPublicationService(
        db as PrismaService,
        {} as any,
      );
      const publicService = new HotelsService(db as PrismaService, service);
      const users: string[] = [];
      const propertyIds: string[] = [];
      const checkIn = '2030-06-01';
      const checkOut = '2030-06-03';
      try {
        const owner = await db.user.create({
          data: { role: 'hotel_manager', status: 'active' },
        });
        users.push(owner.id);
        const other = await db.user.create({
          data: { role: 'hotel_manager', status: 'active' },
        });
        users.push(other.id);
        const property = await db.hotelProperty.create({
          data: {
            ownerUserId: owner.id,
            name: 'Inventory test',
            city: 'Dakar',
            slug: randomUUID(),
            propertyType: 'hotel',
            status: 'active',
          },
        });
        propertyIds.push(property.id);
        const foreign = await db.hotelProperty.create({
          data: {
            ownerUserId: other.id,
            name: 'Other',
            city: 'Dakar',
            slug: randomUUID(),
            propertyType: 'hotel',
            status: 'active',
          },
        });
        propertyIds.push(foreign.id);
        const room = await db.hotelRoom.create({
          data: {
            propertyId: property.id,
            name: 'Double',
            capacity: 2,
            status: 'active',
            metadata: { totalUnits: 1, basePrice: 10000 },
          },
        });
        const foreignRoom = await db.hotelRoom.create({
          data: {
            propertyId: foreign.id,
            name: 'Other',
            capacity: 2,
            status: 'active',
          },
        });
        await db.hotelRoomAvailability.createMany({
          data: [checkIn, '2030-06-02'].map((date) => ({
            roomId: room.id,
            date: new Date(date),
            available: 1,
            status: 'open',
          })),
        });
        const payload = (suffix: string) => ({
          roomId: room.id,
          checkIn,
          checkOut,
          guests: 2,
          units: 1,
          requestId: randomUUID(),
          clientName: 'Client',
          clientEmail: `${suffix}@example.test`,
        });
        const first = payload('first');
        const receipts = await Promise.all([
          service.create(property.id, first),
          service.create(property.id, first),
        ]);
        expect(receipts[0].id).toBe(receipts[1].id);
        expect(Object.keys(receipts[0]).sort()).toEqual([
          'createdAt',
          'id',
          'received',
          'status',
        ]);
        expect(
          await db.hotelStockAllocation.count({ where: { roomId: room.id } }),
        ).toBe(0);
        expect(
          await db.hotelReservationRequest.count({
            where: { propertyId: property.id },
          }),
        ).toBe(1);
        await expect(
          service.create(property.id, { ...first, guests: 1 }),
        ).rejects.toThrow();
        await expect(
          service.create(property.id, {
            ...payload('foreign'),
            roomId: foreignRoom.id,
          }),
        ).rejects.toThrow();
        for (const change of [
          { checkIn: checkOut, checkOut: checkIn },
          { checkIn: '2000-01-01', checkOut: '2000-01-02' },
          { guests: 3 },
          { units: 0 },
          { clientEmail: undefined },
          { ownerUserId: other.id },
        ])
          await expect(
            service.create(property.id, {
              ...payload('invalid'),
              ...change,
            } as any),
          ).rejects.toThrow();
        const second = await service.create(property.id, payload('second'));
        const concurrent = await Promise.allSettled([
          service.update(owner.id, receipts[0].id, { status: 'accepted' }),
          service.update(owner.id, second.id, { status: 'accepted' }),
        ]);
        expect(
          concurrent.filter((result) => result.status === 'fulfilled'),
        ).toHaveLength(1);
        expect(
          concurrent.filter((result) => result.status === 'rejected'),
        ).toHaveLength(1);
        const accepted = (
          concurrent.find(
            (result) => result.status === 'fulfilled',
          ) as PromiseFulfilledResult<any>
        ).value;
        expect(accepted.confirmation.confirmed).toBe(true);
        await expect(
          publicService.softDelete(owner.id, property.id),
        ).rejects.toThrow();
        expect(
          await db.hotelStockAllocation.count({
            where: { roomId: room.id, releasedAt: null },
          }),
        ).toBe(2);
        expect(
          (await service.update(owner.id, accepted.id, { status: 'accepted' }))
            .status,
        ).toBe('accepted');
        expect(
          await db.hotelStockAllocation.count({
            where: { requestId: accepted.id },
          }),
        ).toBe(2);
        expect(
          (
            await db.hotelRoomAvailability.findMany({
              where: { roomId: room.id },
            })
          ).every((day) => day.available === 1),
        ).toBe(true);
        await expect(
          service.update(other.id, accepted.id, { status: 'cancelled' }),
        ).rejects.toThrow();
        await expect(
          service.update(owner.id, 'missing', { status: 'accepted' }),
        ).rejects.toThrow();
        await expect(
          publication.update(owner.id, property.id, {
            rooms: [{ id: room.id, enabled: false }],
          }),
        ).rejects.toThrow();
        await expect(
          publication.update(owner.id, property.id, {
            rooms: [
              {
                id: room.id,
                calendar: [
                  {
                    start: checkIn,
                    end: '2030-06-02',
                    available: 0,
                    status: 'closed',
                  },
                ],
              },
            ],
          }),
        ).rejects.toThrow();
        await expect(
          publication.update(owner.id, property.id, {
            rooms: [{ id: room.id, capacity: 1 }],
          }),
        ).rejects.toThrow();
        const publicData = await publicService.findPublicOne(property.id);
        expect(JSON.stringify(publicData)).not.toContain('clientEmail');
        expect(JSON.stringify(publicData)).not.toContain('stockAllocations');
        expect(
          (
            await service.quote(property.id, {
              roomId: room.id,
              checkIn,
              checkOut,
              units: 1,
              guests: 2,
            })
          ).remainingUnits,
        ).toBe(0);
        await service.update(owner.id, accepted.id, { status: 'cancelled' });
        const released = await db.hotelStockAllocation.findMany({
          where: { requestId: accepted.id },
        });
        expect(released.every((item) => item.releasedAt)).toBe(true);
        await service.update(owner.id, accepted.id, { status: 'cancelled' });
        expect(
          await db.hotelStockAllocation.findMany({
            where: { requestId: accepted.id },
          }),
        ).toEqual(released);
        await expect(
          service.update(owner.id, accepted.id, { status: 'accepted' }),
        ).rejects.toThrow();
        expect(
          (
            await service.quote(property.id, {
              roomId: room.id,
              checkIn,
              checkOut,
              units: 1,
              guests: 2,
            })
          ).remainingUnits,
        ).toBe(1);
        const waitingId =
          accepted.id === receipts[0].id ? second.id : receipts[0].id;
        await service.update(owner.id, waitingId, { status: 'accepted' });
        await service.update(owner.id, waitingId, { status: 'refused' });
        expect(
          await db.hotelStockAllocation.count({
            where: { roomId: room.id, releasedAt: null },
          }),
        ).toBe(0);
        const unknown = await service.create(property.id, {
          ...payload('unknown'),
          checkIn: '2030-07-01',
          checkOut: '2030-07-02',
        });
        await expect(
          service.update(owner.id, unknown.id, { status: 'accepted' }),
        ).rejects.toThrow();
        await db.hotelRestriction.create({
          data: { roomId: room.id, date: new Date(checkIn), stopSell: true },
        });
        await expect(
          service.create(property.id, payload('stop')),
        ).rejects.toThrow();
        await db.hotelRestriction.deleteMany({ where: { roomId: room.id } });
        await db.hotelIntegration.create({
          data: { propertyId: property.id, sourceOfTruth: 'external_system' },
        });
        const external = await service.create(property.id, payload('external'));
        await expect(
          service.update(owner.id, external.id, { status: 'accepted' }),
        ).rejects.toThrow();
        expect(
          await db.hotelStockAllocation.count({
            where: { requestId: external.id },
          }),
        ).toBe(0);
        const legacy = await db.hotelReservationRequest.create({
          data: {
            propertyId: property.id,
            clientName: 'Historical',
            status: 'new',
          },
        });
        const own = await service.findMine(owner.id, new PaginationDto());
        const firstPage = await service.findMine(owner.id, {
          page: 1,
          limit: 1,
        });
        expect(firstPage.data).toHaveLength(1);
        expect(firstPage.meta.total).toBe(own.data.length);
        expect(own.data.find((item) => item.id === legacy.id)).toMatchObject({
          legacy: true,
          confirmation: { confirmed: false },
        });
        await expect(
          service.update(owner.id, legacy.id, { status: 'accepted' }),
        ).rejects.toThrow();
        expect(
          (await service.findMine(other.id, new PaginationDto())).data,
        ).toHaveLength(0);
      } finally {
        await db.contactEvent.deleteMany({
          where: { module: 'hotels', targetId: { in: propertyIds } },
        });
        await db.hotelReservationRequest.deleteMany({
          where: { propertyId: { in: propertyIds } },
        });
        await db.hotelProperty.deleteMany({
          where: { id: { in: propertyIds } },
        });
        await db.user.deleteMany({ where: { id: { in: users } } });
        await db.$disconnect();
      }
    }, 180000);
  },
);

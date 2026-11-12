import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ClientRequestsService } from './client-requests.service';

type Row = Record<string, any>;
const day = 86_400_000;

function table(rows: Row[], relations: Record<string, (row: Row) => unknown> = {}) {
  const hit = (row: Row, where: Row) => Object.entries(where).every(([key, value]) => (row[key] ?? null) === value);
  const withRelations = (row: Row | undefined, include?: Row) => row
    ? { ...row, ...Object.fromEntries(Object.keys(include ?? {}).map(key => [key, relations[key]?.(row) ?? null])) }
    : null;
  return {
    rows,
    findFirst: jest.fn(async ({ where, include }: Row) => withRelations(rows.find(row => hit(row, where)), include)),
    update: jest.fn(async ({ where, data }: Row) => {
      const row = rows.find(item => hit(item, where))!;
      for (const [key, value] of Object.entries<any>(data)) {
        if (key === 'events') (row.events ??= []).push(value.create);
        else if (value && typeof value === 'object' && 'increment' in value) row[key] += value.increment;
        else if (value && typeof value === 'object' && 'decrement' in value) row[key] -= value.decrement;
        else row[key] = value;
      }
      return row;
    }),
    updateMany: jest.fn(async ({ where, data }: Row) => {
      const found = rows.filter(row => hit(row, where));
      found.forEach(row => Object.assign(row, data));
      return { count: found.length };
    }),
  };
}

describe('Client cancellation of a request', () => {
  let service: ClientRequestsService;
  let db: Row;
  let locks: string[];
  const request = (extra: Row) => ({ clientUserId: 'client', status: 'pending', updatedAt: new Date(), ...extra });

  beforeEach(() => {
    locks = [];
    const occurrence = { id: 'occ', departureAt: new Date(Date.now() + 3 * day), confirmedSeats: 2, remainingSeats: 8 };
    const past = { id: 'occ-past', departureAt: new Date(Date.now() - day), confirmedSeats: 1, remainingSeats: 9 };
    const owner = () => ({ ownerUserId: 'owner' });
    db = {
      hotelReservationRequest: table([
        request({ id: 'h-accepted', propertyId: 'p1', status: 'accepted', checkIn: new Date(Date.now() + 5 * day) }),
        request({ id: 'h-started', propertyId: 'p1', status: 'accepted', checkIn: new Date(Date.now() - day) }),
        request({ id: 'h-refused', propertyId: 'p1', status: 'refused' }),
      ], { property: owner }),
      hotelStockAllocation: table([
        { id: 'a1', requestId: 'h-accepted', releasedAt: null }, { id: 'a2', requestId: 'h-accepted', releasedAt: null },
        { id: 'a3', requestId: 'h-started', releasedAt: null },
      ]),
      tripSeatRequest: table([
        request({ id: 't-accepted', tripId: 'trip', status: 'accepted', allocatedSeats: 2, occurrenceId: 'occ' }),
        request({ id: 't-pending', tripId: 'trip', allocatedSeats: 0, occurrenceId: 'occ' }),
        request({ id: 't-past', tripId: 'trip', status: 'accepted', allocatedSeats: 1, occurrenceId: 'occ-past' }),
      ], { trip: owner, occurrence: row => [occurrence, past].find(item => item.id === row.occurrenceId) }),
      tripOccurrence: table([occurrence, past]),
      realEstateVisitRequest: table([request({ id: 'v1', listingId: 'l1' }), request({ id: 'v-other', listingId: 'l1', clientUserId: 'someone' }),
        request({ id: 'v-guest', listingId: 'l1', clientUserId: null })], { listing: owner }),
      vehicleRentalRequest: table([request({ id: 'r1', listingId: 'car' }), request({ id: 'r-done', listingId: 'car', status: 'completed' })], { listing: owner }),
      vehicleChauffeurRequest: table([request({ id: 'c1', listingId: 'car', status: 'requires_more_info' })], { listing: owner }),
      notification: { rows: [] as Row[], create: jest.fn(async ({ data }: Row) => { db.notification.rows.push(data); return data; }) },
      $queryRaw: jest.fn(async (strings: TemplateStringsArray) => { locks.push(strings.join('?').match(/FROM "(\w+)"/)![1]); return []; }),
    };
    const prisma = { $transaction: jest.fn(async (callback: (tx: Row) => unknown) => callback(db)) };
    service = new ClientRequestsService(prisma as unknown as PrismaService);
    jest.spyOn(service, 'findOne').mockImplementation(async (_user, type, id) => ({ id, type }) as never);
  });

  const status = (name: string, id: string) => db[name].rows.find((row: Row) => row.id === id).status;

  it('releases the confirmed hotel nights and records who cancelled', async () => {
    await expect(service.cancel('client', 'hotel', 'h-accepted')).resolves.toEqual({ id: 'h-accepted', type: 'hotel' });
    expect(status('hotelReservationRequest', 'h-accepted')).toBe('cancelled');
    expect(db.hotelStockAllocation.rows.filter((row: Row) => row.requestId === 'h-accepted').every((row: Row) => row.releasedAt)).toBe(true);
    expect(db.hotelStockAllocation.rows.find((row: Row) => row.id === 'a3').releasedAt).toBeNull();
    expect(db.hotelReservationRequest.rows[0].events[0]).toMatchObject({ actorUserId: 'client', fromStatus: 'accepted', toStatus: 'cancelled' });
    expect(locks).toEqual(['HotelProperty', 'HotelReservationRequest']);
    expect(db.notification.rows[0]).toMatchObject({ userId: 'owner', module: 'hotels', type: 'request_cancelled_by_client',
      targetUrl: '/dashboard/hotels/reservations/', metadata: { requestId: 'h-accepted', previousStatus: 'accepted' } });
  });

  it('keeps a stay that has started and a request already decided', async () => {
    await expect(service.cancel('client', 'hotel', 'h-started')).rejects.toBeInstanceOf(ConflictException);
    await expect(service.cancel('client', 'hotel', 'h-refused')).rejects.toBeInstanceOf(ConflictException);
    await expect(service.cancel('client', 'rental', 'r-done')).rejects.toBeInstanceOf(ConflictException);
    expect(status('hotelReservationRequest', 'h-started')).toBe('accepted');
    expect(db.hotelStockAllocation.rows.find((row: Row) => row.id === 'a3').releasedAt).toBeNull();
    expect(db.notification.rows).toHaveLength(0);
  });

  it('gives the seats of an accepted trip request back once', async () => {
    await service.cancel('client', 'trip', 't-accepted');
    expect(db.tripOccurrence.rows[0]).toMatchObject({ confirmedSeats: 0, remainingSeats: 10 });
    expect(db.tripSeatRequest.rows[0]).toMatchObject({ status: 'cancelled', allocatedSeats: 0 });
    expect(locks).toEqual(['TripListing', 'TripOccurrence']);
    await expect(service.cancel('client', 'trip', 't-accepted')).rejects.toThrow('déjà annulée');
    expect(db.tripOccurrence.rows[0]).toMatchObject({ confirmedSeats: 0, remainingSeats: 10 });
  });

  it('cancels a pending trip request without touching seats, and refuses after departure', async () => {
    await service.cancel('client', 'trip', 't-pending');
    expect(db.tripOccurrence.rows[0]).toMatchObject({ confirmedSeats: 2, remainingSeats: 8 });
    await expect(service.cancel('client', 'trip', 't-past')).rejects.toBeInstanceOf(ConflictException);
    expect(status('tripSeatRequest', 't-past')).toBe('accepted');
    expect(db.tripOccurrence.rows[1]).toMatchObject({ confirmedSeats: 1, remainingSeats: 9 });
  });

  it('cancels visit, rental and chauffeur requests of the same account only', async () => {
    await service.cancel('client', 'visit', 'v1');
    await service.cancel('client', 'rental', 'r1');
    await service.cancel('client', 'chauffeur', 'c1');
    expect([status('realEstateVisitRequest', 'v1'), status('vehicleRentalRequest', 'r1'), status('vehicleChauffeurRequest', 'c1')])
      .toEqual(['cancelled', 'cancelled', 'cancelled']);
    expect(db.notification.rows.map((row: Row) => row.targetUrl))
      .toEqual(['/dashboard/immobilier/visites/', '/dashboard/voitures/contacts/', '/dashboard/voitures/contacts/']);
    await expect(service.cancel('client', 'visit', 'v-other')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.cancel('client', 'visit', 'v-guest')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.cancel('client', 'visit', 'unknown')).rejects.toBeInstanceOf(NotFoundException);
    // A rental identifier is not reachable through the chauffeur type.
    await expect(service.cancel('client', 'chauffeur', 'r1')).rejects.toBeInstanceOf(NotFoundException);
    expect(status('realEstateVisitRequest', 'v-other')).toBe('pending');
  });
});

import { ConflictException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { RENTAL_BOOKED_MESSAGE, VehiclesService } from './vehicles.service';

type Row = Record<string, any>;
const day = (offset: number) => new Date(Date.UTC(2031, 0, 1 + offset));
const iso = (offset: number) => day(offset).toISOString().slice(0, 10);

function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const value = row[key];
    if (expected instanceof Date) return value?.valueOf() === expected.valueOf();
    if (expected && typeof expected === 'object') {
      if ('lt' in expected) return value != null && value < expected.lt;
      if ('gt' in expected) return value != null && value > expected.gt;
      if ('gte' in expected) return value != null && value >= expected.gte;
      if ('not' in expected) return value !== expected.not;
      return true; // relation filters are resolved by the fixture itself
    }
    return (value ?? null) === (expected ?? null);
  });
}

describe('Vehicle rental double booking', () => {
  let service: VehiclesService;
  let requests: Row[];
  const listing = { id: 'car', ownerUserId: 'owner', status: 'active', vehicleMode: 'rental', deletedAt: null, metadata: {} };
  const contact = { clientName: 'Awa Diop', clientPhone: '+221770000000' };
  const stored = (id: string, from: number, to: number, status = 'pending', listingId = 'car') =>
    ({ id, listingId, status, startDate: day(from), endDate: day(to), clientUserId: null, createdAt: new Date(), updatedAt: new Date() });

  beforeEach(() => {
    requests = [stored('accepted-10-15', 10, 15, 'accepted'), stored('other-car', 10, 15, 'accepted', 'car-2')];
    const rental = {
      findFirst: async ({ where }: Row) => requests.find(row => matches(row, where)) ?? null,
      findUnique: async ({ where }: Row) => requests.find(row => row.id === where.id) ?? null,
      findUniqueOrThrow: async ({ where }: Row) => requests.find(row => row.id === where.id)!,
      create: async ({ data }: Row) => {
        const row = { id: randomUUID(), status: 'new', createdAt: new Date(), updatedAt: new Date(), ...data };
        requests.push(row);
        return row;
      },
      update: async ({ where, data }: Row) => Object.assign(requests.find(row => row.id === where.id)!, data),
    };
    const tx = {
      vehicleRentalRequest: rental,
      vehicleListing: { findFirst: async () => listing },
      vehicleAvailabilityBlock: { findFirst: async () => null },
      contactEvent: { create: async () => ({}) },
      $queryRaw: async () => [{ status: 'active', deletedAt: null }],
    };
    const prisma = { $transaction: async (callback: (client: Row) => unknown) => callback(tx) };
    service = new VehiclesService(prisma as unknown as PrismaService);
  });

  const ask = (from: number, to: number) =>
    service.createRentalRequest('car', { ...contact, startDate: iso(from), endDate: iso(to), requestId: randomUUID() } as never);
  const accept = (id: string) => service.updateRentalRequestStatus('owner', id, { status: 'accepted' } as never);

  it.each([[9, 11], [10, 15], [12, 13], [14, 20], [5, 30]])('refuses a new request for days %i to %i on a booked vehicle', async (from, to) => {
    await expect(ask(from, to)).rejects.toThrow(RENTAL_BOOKED_MESSAGE);
    expect(requests).toHaveLength(2);
  });

  it('accepts periods that only touch a booking: return day and pick-up day may coincide', async () => {
    await expect(ask(5, 10)).resolves.toMatchObject({ status: 'new' });
    await expect(ask(15, 18)).resolves.toMatchObject({ status: 'new' });
  });

  it('lets several pending requests coexist but only one be accepted for the same days', async () => {
    requests.push(stored('first', 20, 25), stored('second', 22, 27), stored('later', 25, 28));
    await accept('first');
    await expect(accept('second')).rejects.toBeInstanceOf(ConflictException);
    expect(requests.find(row => row.id === 'second')!.status).toBe('pending');
    await expect(accept('later')).resolves.toMatchObject({ status: 'accepted' });
  });

  it('frees the period once the accepted request is cancelled', async () => {
    requests.push(stored('second', 12, 14));
    await expect(accept('second')).rejects.toBeInstanceOf(ConflictException);
    await service.updateRentalRequestStatus('owner', 'accepted-10-15', { status: 'cancelled' } as never);
    await expect(accept('second')).resolves.toMatchObject({ status: 'accepted' });
  });

  it('never confirms a legacy request without complete dates', async () => {
    requests.push({ ...stored('legacy', 40, 41), endDate: null });
    await expect(accept('legacy')).rejects.toThrow('dates complètes');
  });
});

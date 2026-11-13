import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { VehicleCalendarService, vehicleUnavailable } from './vehicle-calendar';

const future = (days: number) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

function setup({ listing = { id: 'v', vehicleMode: 'rental', title: 'Clio' }, rental = null, block = null }: any = {}) {
  const tx: any = {
    $queryRaw: jest.fn(),
    vehicleListing: { findFirst: jest.fn(async () => listing) },
    vehicleRentalRequest: { findFirst: jest.fn(async () => rental), findMany: jest.fn(async () => []) },
    vehicleAvailabilityBlock: {
      findFirst: jest.fn(async () => block),
      findMany: jest.fn(async () => []),
      create: jest.fn(async ({ data }: any) => ({ id: 'b', ...data })),
      deleteMany: jest.fn(async () => ({ count: 1 })),
    },
  };
  const prisma: any = { ...tx, $transaction: jest.fn(async (run: any) => run(tx)) };
  return { tx, prisma, service: new VehicleCalendarService(prisma) };
}

describe('vehicle availability', () => {
  it('treats owner blocks like accepted rentals', async () => {
    const { tx } = setup({ block: { id: 'b' } });
    await expect(vehicleUnavailable(tx, 'v', new Date('2030-01-01'), new Date('2030-01-03'))).resolves.toBe('block');
    tx.vehicleRentalRequest.findFirst.mockResolvedValueOnce({ id: 'r' });
    await expect(vehicleUnavailable(tx, 'v', new Date('2030-01-01'), new Date('2030-01-03'))).resolves.toBe('rental');
  });

  it('stores a block with an exclusive end, under the listing lock', async () => {
    const { tx, service } = setup();
    const start = future(3);
    await service.addBlock('owner', 'v', { startDate: start, endDate: start, reason: 'Vidange' });
    expect(tx.$queryRaw).toHaveBeenCalled();
    const data = tx.vehicleAvailabilityBlock.create.mock.calls[0][0].data;
    expect(data.endDate.valueOf() - data.startDate.valueOf()).toBe(86400000);
    expect(data).toMatchObject({ listingId: 'v', reason: 'Vidange', createdByUserId: 'owner' });
  });

  it('refuses past dates, reversed dates, overlaps and non rental vehicles', async () => {
    await expect(setup().service.addBlock('o', 'v', { startDate: '2020-01-01', endDate: '2020-01-02' })).rejects.toThrow(BadRequestException);
    await expect(setup().service.addBlock('o', 'v', { startDate: future(5), endDate: future(3) })).rejects.toThrow(BadRequestException);
    await expect(setup({ rental: { id: 'r' } }).service.addBlock('o', 'v', { startDate: future(3), endDate: future(4) })).rejects.toThrow('Une location acceptée');
    await expect(setup({ block: { id: 'b' } }).service.addBlock('o', 'v', { startDate: future(3), endDate: future(4) })).rejects.toThrow(ConflictException);
    await expect(setup({ listing: { id: 'v', vehicleMode: 'sale' } }).service.addBlock('o', 'v', { startDate: future(3), endDate: future(4) })).rejects.toThrow(BadRequestException);
    await expect(setup({ listing: null }).service.calendar('o', 'v', {})).rejects.toThrow(NotFoundException);
  });

  it('publishes merged busy periods without client details', async () => {
    const { prisma, service } = setup();
    prisma.vehicleRentalRequest.findMany.mockResolvedValueOnce([
      { startDate: new Date('2030-01-01T00:00:00Z'), endDate: new Date('2030-01-04T00:00:00Z') },
      { startDate: new Date('2030-01-10T00:00:00Z'), endDate: new Date('2030-01-12T00:00:00Z') },
    ]);
    prisma.vehicleAvailabilityBlock.findMany.mockResolvedValueOnce([{ startDate: new Date('2030-01-04T00:00:00Z'), endDate: new Date('2030-01-06T00:00:00Z') }]);
    const result = await service.publicAvailability('v', { from: '2030-01-01', to: '2030-02-01' });
    expect(result.busy).toEqual([{ start: '2030-01-01', end: '2030-01-06' }, { start: '2030-01-10', end: '2030-01-12' }]);
    expect(prisma.vehicleRentalRequest.findMany.mock.calls[0][0].select).toEqual({ startDate: true, endDate: true });
  });
});

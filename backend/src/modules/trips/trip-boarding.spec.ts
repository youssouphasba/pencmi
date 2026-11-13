import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { newTicketCode, TripBoardingDto, TripBoardingService } from './trip-boarding';

const HOUR = 3600000;
function setup({ departureIn = 2 * HOUR, cancelled = null as Date | null, request = { id: 'r1', occurrenceId: 'o1', status: 'accepted', boardingStatus: null } as any } = {}) {
  const tx: any = {
    tripSeatRequest: { findFirst: jest.fn(async () => request), update: jest.fn(async ({ data }: any) => ({ id: 'r1', ...data })) },
    auditLog: { create: jest.fn() },
  };
  const prisma: any = {
    tripOccurrence: { findFirst: jest.fn(async () => ({ id: 'o1', departureAt: new Date(Date.now() + departureIn), cancelledAt: cancelled, confirmedSeats: 3, trip: { id: 't1' } })) },
    tripSeatRequest: { findMany: jest.fn(async () => [
      { id: 'r1', allocatedSeats: 2, boardingStatus: 'boarded' },
      { id: 'r2', allocatedSeats: 1, boardingStatus: null },
    ]) },
    $transaction: jest.fn(async (run: any) => run(tx)),
  };
  return { tx, prisma, service: new TripBoardingService(prisma) };
}

describe('trip tickets', () => {
  it('generates unambiguous 10 character codes and normalizes typed codes', async () => {
    const code = newTicketCode();
    expect(code).toMatch(/^[2-9A-HJ-NP-Z]{10}$/);
    const dto = plainToInstance(TripBoardingDto, { ticketCode: ` ${code.slice(0, 5).toLowerCase()}-${code.slice(5)} `, status: 'boarded' });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto.ticketCode).toBe(code);
    expect(await validate(plainToInstance(TripBoardingDto, { ticketCode: 'O0I1O0I1O0', status: 'boarded' }))).not.toHaveLength(0);
  });
});

describe('boarding', () => {
  it('lists confirmed passengers with seat totals', async () => {
    const result = await setup().service.manifest('owner', 't1', 'o1');
    expect(result.totals).toEqual({ passengers: 2, seats: 3, boardedSeats: 2, noShowSeats: 0 });
    expect(result.occurrence.boardingOpen).toBe(true);
  });

  it('boards a passenger by ticket code and audits it', async () => {
    const { tx, service } = setup();
    await expect(service.board('owner', 't1', 'o1', { ticketCode: 'ABCDEFGHJK', status: 'boarded' })).resolves.toMatchObject({ boardingStatus: 'boarded' });
    expect(tx.tripSeatRequest.findFirst.mock.calls[0][0].where).toEqual({ ticketCode: 'ABCDEFGHJK' });
    expect(tx.auditLog.create.mock.calls[0][0].data).toMatchObject({ action: 'trip.boarding.boarded', metadata: { byCode: true } });
  });

  it('refuses a ticket of another departure, a cancelled or reused ticket, and closed boarding', async () => {
    await expect(setup({ request: { id: 'r', occurrenceId: 'other', status: 'accepted' } }).service.board('o', 't1', 'o1', { ticketCode: 'ABCDEFGHJK', status: 'boarded' })).rejects.toThrow(NotFoundException);
    await expect(setup({ request: { id: 'r', occurrenceId: 'o1', status: 'cancelled' } }).service.board('o', 't1', 'o1', { ticketCode: 'ABCDEFGHJK', status: 'boarded' })).rejects.toThrow('annulé');
    await expect(setup({ request: { id: 'r', occurrenceId: 'o1', status: 'accepted', boardingStatus: 'boarded' } }).service.board('o', 't1', 'o1', { ticketCode: 'ABCDEFGHJK', status: 'boarded' })).rejects.toThrow('déjà été utilisé');
    await expect(setup({ departureIn: 48 * HOUR }).service.board('o', 't1', 'o1', { requestId: 'r1', status: 'boarded' })).rejects.toThrow(ConflictException);
    await expect(setup({ cancelled: new Date() }).service.board('o', 't1', 'o1', { requestId: 'r1', status: 'boarded' })).rejects.toThrow('annulé');
    await expect(setup().service.board('o', 't1', 'o1', { status: 'boarded' })).rejects.toThrow(BadRequestException);
  });

  it('marks a no-show or undoes a boarding from the list', async () => {
    const { tx, service } = setup({ request: { id: 'r1', occurrenceId: 'o1', status: 'accepted', boardingStatus: 'boarded' } });
    await service.board('o', 't1', 'o1', { requestId: 'r1', status: 'pending' });
    expect(tx.tripSeatRequest.update.mock.calls[0][0].data).toEqual({ boardingStatus: null, boardedAt: null });
  });
});

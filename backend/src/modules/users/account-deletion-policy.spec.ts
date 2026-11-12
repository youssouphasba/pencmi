import { Prisma } from '@prisma/client';
import { ACCOUNT_DELETION_BLOCKING_STATUSES, findAccountDeletionBlockers } from './account-deletion-policy';
import { randomUUID } from 'crypto';

describe('Account deletion blocking requests', () => {
  const models = ['realEstateVisitRequest', 'hotelReservationRequest', 'vehicleRentalRequest', 'vehicleChauffeurRequest', 'tripSeatRequest'];
  const makeTx = (blocked?: string) => Object.fromEntries(models.map(name => [name, { count: jest.fn().mockResolvedValue(name === blocked ? 1 : 0) }]));

  it('requires explicit closure, including accepted requests regardless of dates', () => {
    expect(ACCOUNT_DELETION_BLOCKING_STATUSES).toEqual(['new', 'pending', 'accepted', 'requires_more_info']);
  });

  it.each(models)('blocks when %s has an ongoing request', async model => {
    const tx = makeTx(model);
    const result = await findAccountDeletionBlockers(tx as unknown as Prisma.TransactionClient, randomUUID());
    expect(result.blockedByRequests).toBe(true);
    expect(Object.values(result.counts).reduce((a, b) => a + b, 0)).toBe(1);
  });

  it('scopes every count to the authenticated client or listing owner without disclosing requests', async () => {
    const id = randomUUID();
    const tx = makeTx();
    const result = await findAccountDeletionBlockers(tx as unknown as Prisma.TransactionClient, id);
    expect(result.blockedByRequests).toBe(false);
    for (const [model, delegate] of Object.entries(tx)) {
      const relation = model === 'hotelReservationRequest' ? 'property' : model === 'tripSeatRequest' ? 'trip' : 'listing';
      expect(delegate.count).toHaveBeenCalledWith({ where: {
        OR: [{ clientUserId: id }, { [relation]: { ownerUserId: id } }],
        status: { in: ACCOUNT_DELETION_BLOCKING_STATUSES },
      } });
    }
  });
});

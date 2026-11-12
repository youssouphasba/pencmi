import { Prisma, RequestStatus } from '@prisma/client';

export const ACCOUNT_DELETION_BLOCKING_STATUSES: RequestStatus[] = [
  'new', 'pending', 'accepted', 'requires_more_info',
];

export async function findAccountDeletionBlockers(tx: Prisma.TransactionClient, userId: string) {
  const status = { in: ACCOUNT_DELETION_BLOCKING_STATUSES };
  const listingScope = { OR: [{ clientUserId: userId }, { listing: { ownerUserId: userId } }], status };
  const [visits, stays, rentals, chauffeurServices, trips] = await Promise.all([
    tx.realEstateVisitRequest.count({ where: listingScope }),
    tx.hotelReservationRequest.count({ where: { OR: [{ clientUserId: userId }, { property: { ownerUserId: userId } }], status } }),
    tx.vehicleRentalRequest.count({ where: listingScope }),
    tx.vehicleChauffeurRequest.count({ where: listingScope }),
    tx.tripSeatRequest.count({ where: { OR: [{ clientUserId: userId }, { trip: { ownerUserId: userId } }], status } }),
  ]);
  const counts = { visits, stays, rentals, chauffeurServices, trips };
  return { blockedByRequests: Object.values(counts).some(count => count > 0), counts };
}

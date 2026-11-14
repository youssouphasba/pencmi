import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConversationsService } from './conversations.service';

describe('ConversationsService.messageRequester', () => {
  const rows: Record<string, any> = {};
  const finder = (key: string) => ({ findFirst: jest.fn(async ({ where }: any) => {
    const row = rows[key];
    const owner = where.listing?.ownerUserId ?? where.property?.ownerUserId ?? where.trip?.ownerUserId;
    return row && row.owner === owner && row.id === where.id ? row.data : null;
  }) });
  const prisma: any = { realEstateVisitRequest: finder('visit'), hotelReservationRequest: finder('hotel'),
    vehicleRentalRequest: finder('rental'), vehicleChauffeurRequest: finder('chauffeur'), tripSeatRequest: finder('trip') };
  const service = new ConversationsService(prisma);
  const write = jest.spyOn(service, 'writeToRequester').mockResolvedValue({ conversationId: 'cnv_1', message: {} } as any);
  const id = '00000000-0000-4000-8000-000000000000';

  beforeEach(() => write.mockClear());

  it('writes to the client of a request on the owner\'s listing, for each type', async () => {
    rows.hotel = { id: 'h1', owner: 'own', data: { propertyId: 'p1', clientUserId: 'c1' } };
    rows.trip = { id: 't1', owner: 'own', data: { tripId: 'tr1', clientUserId: 'c2' } };
    rows.rental = { id: 'r1', owner: 'own', data: { listingId: 'v1', clientUserId: 'c3' } };
    await service.messageRequester('own', 'hotel', 'h1', ' Bonjour ', id);
    await service.messageRequester('own', 'trip', 't1', 'Départ confirmé', id);
    await service.messageRequester('own', 'rental', 'r1', 'Clés au guichet', id);
    expect(write.mock.calls.map((call) => call.slice(0, 5))).toEqual([
      ['own', 'hotels', 'p1', 'c1', 'Bonjour'], ['own', 'trips', 'tr1', 'c2', 'Départ confirmé'], ['own', 'vehicles', 'v1', 'c3', 'Clés au guichet']]);
  });

  it('refuses requests of another owner and clients without an account', async () => {
    rows.visit = { id: 'v1', owner: 'own', data: { listingId: 'l1', clientUserId: null } };
    await expect(service.messageRequester('intruder', 'visit', 'v1', 'x', id)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.messageRequester('own', 'visit', 'v1', 'x', id)).rejects.toBeInstanceOf(ConflictException);
    expect(write).not.toHaveBeenCalled();
  });
});

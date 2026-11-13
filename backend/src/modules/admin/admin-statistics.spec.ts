import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AdminStatisticsQuery, AdminStatisticsService } from './admin-statistics';

const group = (rows: [string, number][]) => jest.fn(async () => rows.map(([key, n]) => ({ status: key, module: key, _count: { _all: n } })));

describe('admin statistics', () => {
  it('aggregates a period with acceptance rates and a full daily series', async () => {
    const count = jest.fn(async () => 2);
    const prisma: any = {
      user: { count },
      $queryRaw: jest.fn(async () => [{ day: new Date('2030-01-09T00:00:00Z'), count: 3 }]),
      realEstateListing: { count }, hotelProperty: { count }, vehicleListing: { count }, tripListing: { count },
      realEstateVisitRequest: { groupBy: group([['accepted', 3], ['refused', 1], ['pending', 2]]) },
      hotelReservationRequest: { groupBy: group([]) },
      vehicleRentalRequest: { groupBy: group([['completed', 1]]) },
      vehicleChauffeurRequest: { groupBy: group([]) },
      tripSeatRequest: { groupBy: group([['cancelled', 4]]) },
      contactEvent: { groupBy: group([['hotels', 5]]) },
      report: { count },
      message: { count },
      trackingEvent: { groupBy: jest.fn(async () => [{ module: 'hotels', eventType: 'listing_view', _count: { _all: 9 } }]) },
      verificationRequest: { groupBy: group([['pending', 1]]) },
    };
    const stats = await new AdminStatisticsService(prisma).statistics(7, new Date('2030-01-10T12:00:00Z'));
    expect(stats.signups).toMatchObject({ clients: 2, professionals: 2, total: 4 });
    expect(stats.signups.series).toHaveLength(7);
    expect(stats.signups.series.at(-2)).toEqual({ day: '2030-01-09', signups: 3 });
    expect(stats.requests.visit).toMatchObject({ total: 6, waiting: 2, accepted: 3, refused: 1, acceptanceRate: 75 });
    expect(stats.requests.hotel.acceptanceRate).toBeNull();
    expect(stats.requests.trip).toMatchObject({ cancelled: 4 });
    expect(stats.contacts).toEqual({ hotels: 5 });
    expect(stats.topEvents).toEqual([{ module: 'hotels', eventType: 'listing_view', count: 9 }]);
  });

  it('accepts only 7, 30 or 90 days', async () => {
    expect(await validate(plainToInstance(AdminStatisticsQuery, { days: '30' }))).toHaveLength(0);
    expect(await validate(plainToInstance(AdminStatisticsQuery, { days: '365' }))).not.toHaveLength(0);
  });
});

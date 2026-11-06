import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AuthService } from '../../auth/auth.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { ApiResponseInterceptor } from '../../common/interceptors/api-response.interceptor';
import { PrismaService } from '../../database/prisma/prisma.service';
import { createFakePrisma } from '../conversations/fake-prisma.fixture';
import { StatisticsController } from './statistics.controller';
import { StatisticsService, periodWindow } from './statistics.service';

const ROLES: Record<string, string> = { agency: 'real_estate_agency', hotelier: 'hotel_manager', dealer: 'vehicle_dealer', carrier: 'transport_provider', rival: 'advertiser_individual', client: 'client' };
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

describe('periodWindow', () => {
  const now = new Date('2026-11-06T15:30:00Z');
  it.each([['today', 1, '2026-11-06'], ['7', 7, '2026-10-31'], ['30', 30, '2026-10-08'], ['90', 90, '2026-08-09']] as const)('period %s', (period, count, first) => {
    const window = periodWindow(period, now);
    expect(window.days).toHaveLength(count);
    expect(window.days[0]).toBe(first);
    expect(window.days[count - 1]).toBe('2026-11-06');
    expect(window.from.toISOString()).toBe(`${first}T00:00:00.000Z`);
    expect(window.to).toBe(now);
  });
});

describe('Owner statistics over HTTP', () => {
  let app: INestApplication;
  let db: any;
  const http = () => request(app.getHttpServer());
  const report = (token: string, query: string) => http().get(`/dashboard/stats/report?${query}`).set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    db = createFakePrisma();
    const module = await Test.createTestingModule({
      controllers: [StatisticsController],
      providers: [
        StatisticsService,
        { provide: PrismaService, useFactory: () => db },
        { provide: AuthService, useValue: { validateAccessToken: async (token: string) => {
          if (!ROLES[token]) throw new UnauthorizedException();
          return { id: token, role: ROLES[token], sessionId: 's' };
        } } },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalGuards(new JwtAuthGuard(new Reflector(), module.get(AuthService)), new PermissionsGuard(new Reflector()));
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();
  });
  afterAll(() => app.close());

  beforeEach(async () => {
    const fresh = createFakePrisma();
    Object.keys(db).forEach((key) => delete db[key]);
    Object.assign(db, fresh);
    const listing = (id: string, ownerUserId: string, extra = {}) => ({ data: { id, ownerUserId, title: id, status: 'active', deletedAt: null, ...extra } });
    await db.realEstateListing.create(listing('re_a', 'agency'));
    await db.realEstateListing.create(listing('re_b', 'agency'));
    await db.realEstateListing.create(listing('re_draft', 'agency', { status: 'draft' }));
    await db.realEstateListing.create(listing('re_gone', 'agency', { deletedAt: new Date() }));
    await db.realEstateListing.create(listing('re_rival', 'rival'));
  });

  it('refuses anonymous, client, wrong universe and invalid parameters', async () => {
    await http().get('/dashboard/stats/report?module=real_estate').expect(401);
    await http().get('/dashboard/stats').expect(401);
    await report('client', 'module=real_estate').expect(403);
    await http().get('/dashboard/stats').set('Authorization', 'Bearer client').expect(403);
    await report('hotelier', 'module=real_estate').expect(403);
    await report('agency', 'module=hotels').expect(403);
    await report('agency', '').expect(400);
    await report('agency', 'module=support').expect(400);
    await report('agency', 'module=real_estate&period=365').expect(400);
    await report('agency', 'module=real_estate&ownerUserId=rival').expect(400);
  });

  it('refuses the listing of another advertiser and never adds it up', async () => {
    await db.realEstateVisitRequest.create({ data: { listingId: 're_rival', status: 'new' } });
    await db.realEstateVisitRequest.create({ data: { listingId: 're_a', status: 'new' } });
    await report('agency', 'module=real_estate&listingId=re_rival').expect(404);
    const own = (await report('agency', 'module=real_estate').expect(200)).body.data;
    expect(own.requests.total).toBe(1);
    expect(own.options.map((row: any) => row.id)).not.toContain('re_rival');
    const rival = (await report('rival', 'module=real_estate').expect(200)).body.data;
    expect(rival.requests.total).toBe(1);
    expect(rival.options.map((row: any) => row.id)).toEqual(['re_rival']);
  });

  it('no longer counts the tracking events of other advertisers in the former summary', async () => {
    await db.trackingEvent.create({ data: { module: 'real_estate', eventType: 'view', targetType: 'listing', targetId: 're_a' } });
    await db.trackingEvent.create({ data: { module: 'real_estate', eventType: 'view', targetType: 'listing', targetId: 're_rival' } });
    await db.trackingEvent.create({ data: { module: 'real_estate', eventType: 'view', targetType: 'listing', targetId: 'unknown' } });
    await db.trackingEvent.create({ data: { module: 'system', eventType: 'view' } });
    await db.contactEvent.create({ data: { module: 'real_estate', source: 'visit_request', targetType: 'listing', targetId: 're_a', ownerUserId: null } });
    await db.contactEvent.create({ data: { module: 'real_estate', source: 'visit_request', targetType: 'listing', targetId: 're_rival', ownerUserId: null } });
    const summary = (await http().get('/dashboard/stats?module=real_estate').set('Authorization', 'Bearer agency').expect(200)).body.data;
    expect(summary).toMatchObject({ trackingEvents: 1, contacts: 1 });
  });

  it('applies the period at its edges, the listing filter and a daily series', async () => {
    const add = (listingId: string, createdAt: Date, status = 'new') => db.realEstateVisitRequest.create({ data: { listingId, status, createdAt } });
    await add('re_a', new Date());
    await add('re_a', daysAgo(3), 'accepted');
    await add('re_b', daysAgo(20));
    await add('re_b', daysAgo(120));
    const start = periodWindow('7').from;
    await add('re_b', start);
    await add('re_b', new Date(start.getTime() - 1));
    const totals = async (query: string) => (await report('agency', `module=real_estate&${query}`).expect(200)).body.data.requests.total;
    expect(await totals('period=today')).toBe(1);
    expect(await totals('period=7')).toBe(3);
    expect(await totals('period=30')).toBe(5);
    expect(await totals('period=90')).toBe(5);
    expect(await totals('')).toBe(5);
    expect(await totals('period=7&listingId=re_a')).toBe(2);
    const data = (await report('agency', 'module=real_estate&period=7').expect(200)).body.data;
    expect(data.series).toHaveLength(7);
    expect(data.series.reduce((sum: number, row: any) => sum + row.requests, 0)).toBe(3);
    expect(data.series[0]).toMatchObject({ date: start.toISOString().slice(0, 10), requests: 1 });
    expect(data.requests.byStatus).toEqual({ new: 2, accepted: 1 });
    expect(data.requestsByListing).toEqual({ re_a: 2, re_b: 1 });
    expect(data.acceptanceRate).toEqual({ accepted: 1, received: 3, value: 1 / 3 });
    expect(data.topListings.rows[0]).toMatchObject({ id: 're_a', requests: 2 });
  });

  it('keeps a true zero distinct from a measure that is not collected', async () => {
    const data = (await report('agency', 'module=real_estate').expect(200)).body.data;
    expect(data.requests.total).toBe(0);
    expect(data.contacts.direct).toBe(0);
    expect(data.acceptanceRate.value).toBeNull();
    expect(data.unavailable.map((row: any) => row.key)).toEqual(expect.arrayContaining(['views', 'channelClicks', 'viewToContactRate', 'responseTime']));
    expect(data).not.toHaveProperty('views');
    expect(data.favorites).toEqual({ inPeriod: 0, allTime: 0, byListing: {} });
    expect(data.series.every((row: any) => row.requests === 0)).toBe(true);
  });

  it('counts the favorites of the owner listings only, without saying who saved them', async () => {
    const favorite = (id: string, userId: string, targetId: string, createdAt = new Date()) => db.favorite.create({ data: { id, userId, module: 'real_estate', targetId, createdAt } });
    await favorite('f1', 'client', 're_a');
    await favorite('f2', 'rival', 're_a');
    await favorite('f3', 'client', 're_b', daysAgo(60));
    await favorite('f4', 'client', 're_rival');
    const data = (await report('agency', 'module=real_estate&period=30').expect(200)).body.data;
    expect(data.favorites).toEqual({ inPeriod: 2, allTime: 3, byListing: { re_a: 2 } });
    expect(JSON.stringify(data.favorites)).not.toContain('client');
    expect((await report('agency', 'module=real_estate&listingId=re_b&period=90').expect(200)).body.data.favorites).toEqual({ inPeriod: 1, allTime: 1, byListing: { re_b: 1 } });
    expect((await report('rival', 'module=real_estate').expect(200)).body.data.favorites.allTime).toBe(1);
  });

  it('separates live, draft and deleted listings', async () => {
    const data = (await report('agency', 'module=real_estate').expect(200)).body.data;
    expect(data.listings).toEqual({ total: 3, deleted: 1, byStatus: { active: 2, draft: 1 } });
    expect(data.activeWithoutActivity.map((row: any) => row.id).sort()).toEqual(['re_a', 're_b']);
    await db.realEstateVisitRequest.create({ data: { listingId: 're_gone', status: 'new' } });
    const history = (await report('agency', 'module=real_estate').expect(200)).body.data;
    expect(history.requests.total).toBe(1);
    expect(history.topListings.rows[0]).toMatchObject({ id: 're_gone', deleted: true });
  });

  it('counts older contacts without an owner through the listing, and nothing twice', async () => {
    const event = (source: string, targetId: string, ownerUserId: string | null) => db.contactEvent.create({ data: { module: 'real_estate', source, targetType: 'listing', targetId, ownerUserId } });
    await event('form', 're_a', null);
    await event('form', 're_a', 'agency');
    await event('phone', 're_b', 'agency');
    await event('form', 're_rival', null);
    await event('form', 're_rival', 'rival');
    // Already counted as a request and as a conversation.
    await event('visit_request', 're_a', 'agency');
    await event('internal_message', 're_a', 'agency');
    await db.realEstateVisitRequest.create({ data: { listingId: 're_a', status: 'new' } });
    await db.conversation.create({ data: { id: 'c1', module: 'real_estate', targetType: 'listing', targetId: 're_a', participants: { create: [{ userId: 'agency' }, { userId: 'c' }] } } });
    await db.message.create({ data: { conversationId: 'c1', senderUserId: 'c', body: 'Question', hiddenAt: null } });
    await db.message.create({ data: { conversationId: 'c1', senderUserId: 'c', body: 'Masqué', hiddenAt: new Date() } });
    await db.message.create({ data: { conversationId: 'c1', senderUserId: 'agency', body: 'Réponse', hiddenAt: null } });
    const data = (await report('agency', 'module=real_estate').expect(200)).body.data;
    expect(data.contacts).toEqual({ direct: 3, bySource: { form: 2, phone: 1 } });
    expect(data.requests.total).toBe(1);
    expect(data.messages).toEqual({ conversationsOpened: 1, inbound: 1 });
  });

  it('does not count a conversation of a listing the participant does not own', async () => {
    await db.conversation.create({ data: { id: 'c2', module: 'real_estate', targetType: 'listing', targetId: 're_rival', participants: { create: [{ userId: 'agency' }, { userId: 'rival' }] } } });
    await db.message.create({ data: { conversationId: 'c2', senderUserId: 'rival', body: 'Réponse', hiddenAt: null } });
    const data = (await report('agency', 'module=real_estate').expect(200)).body.data;
    expect(data.messages).toEqual({ conversationsOpened: 0, inbound: 0 });
  });

  it('hotels: rooms, allocated nights and no invented occupancy', async () => {
    await db.hotelProperty.create({ data: { id: 'h1', ownerUserId: 'hotelier', name: 'Hôtel', status: 'active', deletedAt: null } });
    await db.hotelProperty.create({ data: { id: 'h2', ownerUserId: 'rival', name: 'Autre', status: 'active', deletedAt: null } });
    await db.hotelRoom.create({ data: { id: 'r1', propertyId: 'h1', name: 'Double', status: 'active' } });
    await db.hotelRoom.create({ data: { id: 'r2', propertyId: 'h1', name: 'Suite', status: 'suspended' } });
    await db.hotelRoom.create({ data: { id: 'rx', propertyId: 'h2', name: 'X', status: 'active' } });
    await db.hotelReservationRequest.create({ data: { propertyId: 'h1', roomId: 'r1', status: 'accepted' } });
    await db.hotelReservationRequest.create({ data: { propertyId: 'h1', roomId: 'r1', status: 'new' } });
    await db.hotelStockAllocation.create({ data: { roomId: 'r1', date: daysAgo(1), units: 2, releasedAt: null } });
    await db.hotelStockAllocation.create({ data: { roomId: 'r1', date: daysAgo(1), units: 5, releasedAt: new Date() } });
    await db.hotelStockAllocation.create({ data: { roomId: 'rx', date: daysAgo(1), units: 9, releasedAt: null } });
    const data = (await report('hotelier', 'module=hotels').expect(200)).body.data;
    expect(data.hotels).toEqual({ rooms: { total: 2, active: 1 }, allocatedRoomNights: 2, topRooms: [{ id: 'r1', name: 'Double', requests: 2 }] });
    expect(data.requests).toMatchObject({ total: 2, accepted: 1, byType: { reservation: 2 } });
    expect(data.unavailable.map((row: any) => row.key)).toContain('occupancyRate');
    expect(data).not.toHaveProperty('occupancyRate');
  });

  it('vehicles: rental and chauffeur requests stay apart', async () => {
    await db.vehicleListing.create({ data: { id: 'v1', ownerUserId: 'dealer', title: 'Corolla', status: 'active', deletedAt: null } });
    await db.vehicleRentalRequest.create({ data: { listingId: 'v1', status: 'new' } });
    await db.vehicleRentalRequest.create({ data: { listingId: 'v1', status: 'accepted' } });
    await db.vehicleChauffeurRequest.create({ data: { listingId: 'v1', status: 'refused' } });
    const data = (await report('dealer', 'module=vehicles').expect(200)).body.data;
    expect(data.requests).toMatchObject({ total: 3, accepted: 1, byType: { rental: 2, chauffeur: 1 }, byStatus: { new: 1, accepted: 1, refused: 1 } });
  });

  it('trips: seats asked for and seats allocated are not merged', async () => {
    await db.tripListing.create({ data: { id: 't1', ownerUserId: 'carrier', title: 'Dakar Touba', status: 'active', deletedAt: null } });
    await db.tripSeatRequest.create({ data: { tripId: 't1', status: 'accepted', requestedSeats: 3, allocatedSeats: 2 } });
    await db.tripSeatRequest.create({ data: { tripId: 't1', status: 'new', requestedSeats: 4, allocatedSeats: 0 } });
    await db.tripSeatRequest.create({ data: { tripId: 't1', status: 'accepted', requestedSeats: 1, allocatedSeats: null } });
    const data = (await report('carrier', 'module=trips').expect(200)).body.data;
    expect(data.trips).toEqual({ requestedSeats: 8, allocatedSeats: 2, historicalUnallocatedRequests: 1 });
  });
});

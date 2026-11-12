import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { StatisticsService } from './statistics.service';

const url = process.env.TEST_DATABASE_URL;
(url ? describe : describe.skip)('Owner statistics on isolated PostgreSQL', () => {
  let db: PrismaClient, service: StatisticsService;
  const run = randomUUID();
  const owner = `stat-owner-${run}`, rival = `stat-rival-${run}`, mine = `stat-mine-${run}`, theirs = `stat-theirs-${run}`;
  const as = (id: string) => ({ id, role: 'real_estate_agency' as const, sessionId: 's' });

  beforeAll(async () => {
    expect(new URL(url as string).pathname).toMatch(/_test$/);
    db = new PrismaClient({ datasources: { db: { url } } });
    service = new StatisticsService(db as PrismaService);
    await db.user.createMany({ data: [
      { id: owner, role: 'real_estate_agency', email: `${owner}@example.test` },
      { id: rival, role: 'real_estate_agency', email: `${rival}@example.test` },
    ] });
    await db.realEstateListing.createMany({ data: [
      { id: mine, ownerUserId: owner, status: 'active', slug: mine, title: 'Villa', city: 'Dakar' },
      { id: theirs, ownerUserId: rival, status: 'active', slug: theirs, title: 'Autre', city: 'Dakar' },
    ] });
    const recent = new Date(Date.now() - 60_000);
    await db.realEstateVisitRequest.createMany({ data: [
      { listingId: mine, status: 'accepted', createdAt: recent },
      { listingId: mine, status: 'new', createdAt: new Date(Date.now() - 40 * 86_400_000) },
      { listingId: theirs, status: 'new', createdAt: recent },
    ] });
    await db.contactEvent.createMany({ data: [
      { module: 'real_estate', source: 'form', targetType: 'listing', targetId: mine, ownerUserId: null, createdAt: recent },
      { module: 'real_estate', source: 'visit_request', targetType: 'listing', targetId: mine, ownerUserId: null, createdAt: recent },
      { module: 'real_estate', source: 'form', targetType: 'listing', targetId: theirs, ownerUserId: null, createdAt: recent },
    ] });
    await db.trackingEvent.createMany({ data: [
      { module: 'real_estate', eventType: 'view', targetType: 'listing', targetId: mine, createdAt: recent },
      { module: 'real_estate', eventType: 'view', targetType: 'listing', targetId: theirs, createdAt: recent },
    ] });
  });
  afterAll(async () => {
    await db.trackingEvent.deleteMany({ where: { targetId: { in: [mine, theirs] } } });
    await db.contactEvent.deleteMany({ where: { targetId: { in: [mine, theirs] } } });
    await db.realEstateVisitRequest.deleteMany({ where: { listingId: { in: [mine, theirs] } } });
    await db.realEstateListing.deleteMany({ where: { id: { in: [mine, theirs] } } });
    await db.user.deleteMany({ where: { id: { in: [owner, rival] } } });
    await db.$disconnect();
  });

  it('limits every figure to the owner, on real queries', async () => {
    const report = await service.report(as(owner), { module: 'real_estate', period: '30' });
    expect(report.requests).toMatchObject({ total: 1, accepted: 1 });
    expect(report.contacts).toEqual({ direct: 1, bySource: { form: 1 } });
    expect(report.options.map((row) => row.id)).toEqual([mine]);
    expect((await service.report(as(owner), { module: 'real_estate', period: '90' })).requests.total).toBe(2);
    await expect(service.report(as(owner), { module: 'real_estate', period: '30', listingId: theirs })).rejects.toThrow();
    expect(await service.findDashboardStats(owner, 'real_estate')).toMatchObject({ trackingEvents: 1, contacts: 2 });
  });
});

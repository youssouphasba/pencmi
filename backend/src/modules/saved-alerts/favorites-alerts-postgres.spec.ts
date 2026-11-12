import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { FavoritesService } from '../favorites/favorites.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SavedAlertsProcessor } from './saved-alerts.processor';
import { SavedAlertsService } from './saved-alerts.service';

const url = process.env.TEST_DATABASE_URL;
(url ? describe : describe.skip)('Favorites and alerts on isolated PostgreSQL', () => {
  let db: PrismaClient, favorites: FavoritesService, alerts: SavedAlertsService, processor: SavedAlertsProcessor;
  const run = randomUUID();
  const owner = `fa-owner-${run}`, client = `fa-client-${run}`, v1 = `fa-v1-${run}`, v2 = `fa-v2-${run}`;
  const trip = `fa-trip-${run}`;
  const property = `fa-property-${run}`, hotel = `fa-hotel-${run}`;
  const city = `Ville ${run}`;
  const vehicle = (id: string, status: 'active' | 'draft') => ({ id, ownerUserId: owner, status, slug: id, title: `Corolla ${run}`, vehicleMode: 'sale', city, price: 1000,
    metadata: { publication: { identity: { brand: 'Toyota', year: 2020 }, info: { fuel: 'Diesel' } } } });

  beforeAll(async () => {
    expect(new URL(url as string).pathname).toMatch(/_test$/);
    db = new PrismaClient({ datasources: { db: { url } } });
    favorites = new FavoritesService(db as PrismaService);
    alerts = new SavedAlertsService(db as PrismaService);
    processor = new SavedAlertsProcessor(db as PrismaService);
    await db.user.createMany({ data: [{ id: owner, role: 'vehicle_dealer', email: `${owner}@example.test` }, { id: client, role: 'client', email: `${client}@example.test` }] });
    await db.vehicleListing.create({ data: vehicle(v1, 'active') });
  });
  afterAll(async () => {
    await db.notification.deleteMany({ where: { userId: client } });
    await db.savedAlert.deleteMany({ where: { userId: client } });
    await db.favorite.deleteMany({ where: { userId: client } });
    await db.tripOccurrence.deleteMany({ where: { tripId: trip } });
    await db.tripListing.deleteMany({ where: { id: trip } });
    await db.realEstateListing.deleteMany({ where: { id: property } });
    await db.hotelProperty.deleteMany({ where: { id: hotel } });
    await db.vehicleListing.deleteMany({ where: { id: { in: [v1, v2] } } });
    await db.user.deleteMany({ where: { id: { in: [owner, client] } } });
    await db.$disconnect();
  });

  it('keeps one favorite under real concurrency', async () => {
    await Promise.all(Array.from({ length: 8 }, () => favorites.add(client, 'vehicles', v1)));
    expect(await db.favorite.count({ where: { userId: client } })).toBe(1);
    expect((await favorites.list(client, { page: 1, limit: 20 })).data[0]).toMatchObject({ listingId: v1, available: true });
  });

  it('matches JSON criteria in PostgreSQL and notifies once, after a restart too', async () => {
    const alert = await alerts.create(client, { module: 'vehicles', name: 'Toyota', filters: { brand: 'toyota', minYear: 2018, fuel: 'Diesel', maxPrice: 2000, city: city.toLowerCase() } });
    expect((await alerts.matches(client, alert.id, { page: 1, limit: 20 })).data.map((row: any) => row.listingId)).toContain(v1);
    await processor.runOnce();
    await db.vehicleListing.create({ data: vehicle(v2, 'active') });
    const later = new Date(Date.now() + 1000);
    await processor.runOnce(later);
    await new SavedAlertsProcessor(db as PrismaService).runOnce(later);
    expect(await db.notification.count({ where: { userId: client, type: 'saved_alert_match', targetUrl: { contains: v2 } } })).toBe(1);
  });

  it('links the departure and price that actually match the saved criteria', async () => {
    await db.tripListing.create({ data: { id: trip, slug: trip, ownerUserId: owner, status: 'active', title: 'Départ de recette', departureCity: city, arrivalCity: 'Saint-Louis', vehicleType: 'bus' } });
    const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
    const first = day(5), second = day(10);
    await db.tripOccurrence.createMany({ data: [first, second].map((date, i) => ({ id: `${trip}-${i}`, tripId: trip, serviceDate: new Date(`${date}T00:00:00Z`), departureAt: new Date(`${date}T08:00:00Z`), totalCapacity: 10, offeredSeats: 10, remainingSeats: 10, pricePerSeat: i ? 2000 : 6000 })) });
    const alert = await alerts.create(client, { module: 'trips', name: 'Départ précis', filters: { departureCity: city, date: second, maxPrice: 3000 } });
    const result = await alerts.matches(client, alert.id, { page: 1, limit: 20 });
    expect(result.data[0]).toMatchObject({ listingId: trip, price: 2000, url: expect.stringContaining(`occurrenceId=${trip}-1`) });
    await db.tripListing.update({ where: { id: trip }, data: { title: 'Départ mis à jour' } });
    await processor.runOnce(new Date(Date.now() + 2000));
    expect(await db.notification.findFirst({ where: { userId: client, targetUrl: { contains: trip } } })).toMatchObject({ targetUrl: expect.stringContaining(`occurrenceId=${trip}-1`) });
  });

  it('persists real-estate and hotel favorites, filters, pauses and private-listing protection', async () => {
    const cases = [
      { module: 'real_estate' as const, id: property, delegate: db.realEstateListing, data: { id: property, slug: property, ownerUserId: owner, status: 'active' as const, title: 'Appartement', city, price: 150000, metadata: { surface: 90, privateNote: 'secret' } }, filters: { city, minSurface: 80 } },
      { module: 'hotels' as const, id: hotel, delegate: db.hotelProperty, data: { id: hotel, slug: hotel, ownerUserId: owner, status: 'active' as const, name: 'Hôtel', propertyType: 'hotel', city, contactSettings: { notificationEmail: 'private@example.test' } }, filters: { city, propertyType: 'hotel' } },
    ];
    for (const item of cases) {
      const alert = await alerts.create(client, { module: item.module, name: item.module, filters: item.filters });
      await (item.delegate as any).create({ data: item.data });
      await favorites.add(client, item.module, item.id);
      const page = await alerts.matches(client, alert.id, { page: 1, limit: 20 });
      expect(page.data.map((row: any) => row.listingId)).toContain(item.id);
      expect(JSON.stringify(page)).not.toMatch(/private@example|privateNote/);
      await processor.runOnce(new Date(Date.now() + 2000));
      expect(await db.notification.count({ where: { userId: client, module: item.module, targetUrl: { contains: item.id } } })).toBe(1);
      await alerts.update(client, alert.id, { active: false });
      await (item.delegate as any).update({ where: { id: item.id }, data: { status: 'suspended' } });
      expect((await alerts.matches(client, alert.id, { page: 1, limit: 20 })).meta.total).toBe(0);
      expect((await favorites.list(client, { module: item.module, page: 1, limit: 20 })).data[0]).toMatchObject({ available: false, title: null, url: null });
      await expect(alerts.findOne(owner, alert.id)).rejects.toMatchObject({ status: 404 });
      await alerts.remove(client, alert.id);
    }
  });

  it('does not exceed the account quota under concurrent creates', async () => {
    const existing = await db.savedAlert.count({ where: { userId: client } });
    for (let i = existing; i < 29; i++) await alerts.create(client, { module: 'hotels', name: `Ville ${i}`, filters: { city: `Ville ${i}` } });
    const results = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => alerts.create(client, { module: 'hotels', name: `Concurrent ${i}`, filters: { city: `Concurrent ${i}` } })));
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await db.savedAlert.count({ where: { userId: client } })).toBe(30);
  });

  it('allows only one concurrent update to the same criteria', async () => {
    const rows = await db.savedAlert.findMany({ where: { userId: client, module: 'hotels' }, take: 8 });
    const results = await Promise.allSettled(rows.map((row) => alerts.update(client, row.id, { filters: { city: 'Même recherche' } })));
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
  });

  it('isolates notification history and read actions between accounts', async () => {
    const notifications = new NotificationsService(db as PrismaService);
    const mine = await notifications.findMine(client);
    expect(mine.length).toBeGreaterThanOrEqual(4);
    expect(await notifications.findMine(owner)).toEqual([]);
    expect(await notifications.markRead(mine[0].id, owner)).toEqual({ count: 0 });
    expect((await notifications.findMine(client))[0].status).toBe('unread');
    expect(await notifications.markRead(mine[0].id, client)).toEqual({ count: 1 });
    await notifications.markAllRead(client);
    expect((await notifications.findMine(client)).every((row) => row.status === 'read' && row.readAt)).toBe(true);
  });
});

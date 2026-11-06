import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { FavoritesService } from '../favorites/favorites.service';
import { SavedAlertsProcessor } from './saved-alerts.processor';
import { SavedAlertsService } from './saved-alerts.service';

const url = process.env.TEST_DATABASE_URL;
(url ? describe : describe.skip)('Favorites and alerts on isolated PostgreSQL', () => {
  let db: PrismaClient, favorites: FavoritesService, alerts: SavedAlertsService, processor: SavedAlertsProcessor;
  const run = randomUUID();
  const owner = `fa-owner-${run}`, client = `fa-client-${run}`, v1 = `fa-v1-${run}`, v2 = `fa-v2-${run}`;
  const vehicle = (id: string, status: 'active' | 'draft') => ({ id, ownerUserId: owner, status, slug: id, title: `Corolla ${run}`, vehicleMode: 'sale', city: 'Dakar', price: 1000,
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
    const alert = await alerts.create(client, { module: 'vehicles', name: 'Toyota', filters: { brand: 'toyota', minYear: 2018, fuel: 'Diesel', maxPrice: 2000, city: 'dakar' } });
    expect((await alerts.matches(client, alert.id, { page: 1, limit: 20 })).data.map((row: any) => row.listingId)).toContain(v1);
    await processor.runOnce();
    await db.vehicleListing.create({ data: vehicle(v2, 'active') });
    const later = new Date(Date.now() + 1000);
    await processor.runOnce(later);
    await new SavedAlertsProcessor(db as PrismaService).runOnce(later);
    expect(await db.notification.count({ where: { userId: client, type: 'saved_alert_match', targetUrl: { contains: v2 } } })).toBe(1);
  });
});

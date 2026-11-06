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
import { FavoritesController } from '../favorites/favorites.controller';
import { FavoritesService } from '../favorites/favorites.service';
import { SavedAlertsController } from './saved-alerts.controller';
import { SavedAlertsProcessor } from './saved-alerts.processor';
import { MAX_ALERTS_PER_ACCOUNT, SavedAlertsService } from './saved-alerts.service';

const DAY = 86_400_000;
const USERS = ['awa', 'modou', 'owner'];

describe('Favorites and saved alerts over HTTP', () => {
  let app: INestApplication;
  let db: any;
  const http = () => request(app.getHttpServer());
  const as = (token: string) => ({ Authorization: `Bearer ${token}` });
  const processor = () => new SavedAlertsProcessor(db as PrismaService);

  const seedListing = (table: string, id: string, extra: Record<string, unknown> = {}) =>
    db[table].create({ data: { id, ownerUserId: 'owner', status: 'active', deletedAt: null, title: `Titre ${id}`, city: 'Dakar', updatedAt: new Date(), ...extra } });
  const future = (tripId: string, extra: Record<string, unknown> = {}) =>
    db.tripOccurrence.create({ data: { id: `occ_${tripId}_${Math.random()}`, tripId, serviceDate: new Date(Date.now() + 5 * DAY), departureAt: new Date(Date.now() + 5 * DAY), remainingSeats: 10, pricePerSeat: 5000, cancelledAt: null, ...extra } });

  beforeAll(async () => {
    db = createFakePrisma();
    const module = await Test.createTestingModule({
      controllers: [FavoritesController, SavedAlertsController],
      providers: [
        FavoritesService, SavedAlertsService,
        { provide: PrismaService, useFactory: () => db },
        { provide: AuthService, useValue: { validateAccessToken: async (token: string) => {
          if (!USERS.includes(token)) throw new UnauthorizedException();
          return { id: token, role: 'client', sessionId: 's' };
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
  });

  describe('favorites', () => {
    const universes = [['real_estate', 'realEstateListing'], ['vehicles', 'vehicleListing'], ['hotels', 'hotelProperty'], ['trips', 'tripListing']] as const;

    it('refuses anonymous access and invalid parameters', async () => {
      await http().get('/favorites').expect(401);
      await http().put('/favorites/hotels/x').expect(401);
      await http().delete('/favorites/hotels/x').expect(401);
      await http().get('/favorites?module=support').set(as('awa')).expect(400);
      await http().put('/favorites/support/x').set(as('awa')).expect(400);
      await http().put('/favorites/hotels/a%20b').set(as('awa')).expect(400);
      await http().get('/favorites/check?module=hotels').set(as('awa')).expect(400);
      await http().get(`/favorites/check?module=hotels&ids=${Array.from({ length: 101 }, (_, i) => `x${i}`).join(',')}`).set(as('awa')).expect(400);
      await http().get('/favorites?userId=modou').set(as('awa')).expect(400);
    });

    it.each(universes)('%s: add twice, concurrently, read back and remove twice', async (module, table) => {
      await seedListing(table, 'l1', table === 'hotelProperty' ? { name: 'Hôtel', propertyType: 'hotel' } : {});
      const results = await Promise.all(Array.from({ length: 5 }, () => http().put(`/favorites/${module}/l1`).set(as('awa'))));
      expect(results.map((row) => row.status)).toEqual([200, 200, 200, 200, 200]);
      expect(await db.favorite.count()).toBe(1);
      const list = (await http().get(`/favorites?module=${module}`).set(as('awa')).expect(200)).body;
      expect(list.meta.total).toBe(1);
      expect(list.data[0]).toMatchObject({ module, listingId: 'l1', available: true });
      expect(list.data[0].url).toMatch(/^\/[a-z]+\//);
      expect((await http().get(`/favorites/check?module=${module}&ids=l1,l2`).set(as('awa')).expect(200)).body.data.favorites).toEqual(['l1']);
      await http().delete(`/favorites/${module}/l1`).set(as('awa')).expect(200);
      await http().delete(`/favorites/${module}/l1`).set(as('awa')).expect(200);
      expect(await db.favorite.count()).toBe(0);
    });

    it('refuses a listing that is not public', async () => {
      await seedListing('vehicleListing', 'draft', { status: 'draft' });
      await seedListing('vehicleListing', 'refused', { status: 'refused' });
      await seedListing('vehicleListing', 'gone', { deletedAt: new Date() });
      for (const id of ['draft', 'refused', 'gone', 'absent']) await http().put(`/favorites/vehicles/${id}`).set(as('awa')).expect(404);
      expect(await db.favorite.count()).toBe(0);
    });

    it('keeps a favorite that became unavailable, without any of its data, and it can still be removed', async () => {
      await seedListing('vehicleListing', 'v1', { price: 1000, metadata: { secret: 'privé', photos: ['https://cdn.example/a.jpg'] } });
      await http().put('/favorites/vehicles/v1').set(as('awa')).expect(200);
      expect((await http().get('/favorites').set(as('awa'))).body.data[0]).toMatchObject({ available: true, price: 1000, photo: 'https://cdn.example/a.jpg' });
      await db.vehicleListing.update({ where: { id: 'v1' }, data: { status: 'suspended' } });
      await http().put('/favorites/vehicles/v1').set(as('awa')).expect(200);
      const row = (await http().get('/favorites').set(as('awa'))).body.data[0];
      expect(row).toMatchObject({ listingId: 'v1', available: false, title: null, price: null, url: null, photo: null });
      expect(JSON.stringify(row)).not.toContain('privé');
      await http().delete('/favorites/vehicles/v1').set(as('awa')).expect(200);
      expect(await db.favorite.count()).toBe(0);
    });

    it('drops an unsafe photo', async () => {
      await seedListing('vehicleListing', 'v1', { metadata: { photos: ['javascript:alert(1)'] } });
      await http().put('/favorites/vehicles/v1').set(as('awa')).expect(200);
      expect((await http().get('/favorites').set(as('awa'))).body.data[0].photo).toBeNull();
    });

    it('never shows the favorites of another account', async () => {
      await seedListing('vehicleListing', 'v1');
      await http().put('/favorites/vehicles/v1').set(as('awa')).expect(200);
      expect((await http().get('/favorites').set(as('modou')).expect(200)).body.meta.total).toBe(0);
      expect((await http().get('/favorites/check?module=vehicles&ids=v1').set(as('modou'))).body.data.favorites).toEqual([]);
      await http().delete('/favorites/vehicles/v1').set(as('modou')).expect(200);
      expect(await db.favorite.count()).toBe(1);
    });

    it('lets an owner save their own public listing', async () => {
      await seedListing('vehicleListing', 'v1');
      await http().put('/favorites/vehicles/v1').set(as('owner')).expect(200);
    });

    it('trips: saves the stable trip and links a real future departure, or none', async () => {
      await seedListing('tripListing', 't1', { departureCity: 'Dakar', arrivalCity: 'Touba', pricePerSeat: 4000, currency: 'FCFA', vehicleType: 'bus' });
      await db.tripOccurrence.create({ data: { id: 'past', tripId: 't1', departureAt: new Date(Date.now() - DAY), cancelledAt: null, pricePerSeat: 1 } });
      await db.tripOccurrence.create({ data: { id: 'off', tripId: 't1', departureAt: new Date(Date.now() + DAY), cancelledAt: new Date(), pricePerSeat: 2 } });
      await http().put('/favorites/trips/t1').set(as('awa')).expect(200);
      let row = (await http().get('/favorites').set(as('awa'))).body.data[0];
      expect(row).toMatchObject({ listingId: 't1', available: true, nextDeparture: null, price: 4000, url: '/voyages/detail/?id=t1' });
      await db.tripOccurrence.create({ data: { id: 'next', tripId: 't1', departureAt: new Date(Date.now() + 3 * DAY), cancelledAt: null, pricePerSeat: 5000 } });
      row = (await http().get('/favorites').set(as('awa'))).body.data[0];
      expect(row).toMatchObject({ price: 5000, url: '/voyages/detail/?id=t1&occurrenceId=next' });
      expect(row.nextDeparture).toBeTruthy();
      expect(row).not.toHaveProperty('remainingSeats');
    });

    it('pages by the server', async () => {
      for (let i = 0; i < 25; i++) { await seedListing('vehicleListing', `v${i}`); await http().put(`/favorites/vehicles/v${i}`).set(as('awa')).expect(200); }
      const first = (await http().get('/favorites?limit=10&page=3').set(as('awa'))).body;
      expect(first.data).toHaveLength(5);
      expect(first.meta).toMatchObject({ total: 25, totalPages: 3 });
      await http().get('/favorites?limit=101').set(as('awa')).expect(400);
    });
  });

  describe('alerts', () => {
    const create = (token: string, module: string, filters: unknown, name = 'Ma recherche') => http().post('/saved-alerts').set(as(token)).send({ module, name, filters });

    it('refuses anonymous access, a browser-supplied account and invalid input', async () => {
      await http().get('/saved-alerts').expect(401);
      await http().post('/saved-alerts').send({}).expect(401);
      await http().post('/saved-alerts').set(as('awa')).send({ module: 'hotels', name: 'A b', filters: { city: 'Dakar' }, userId: 'modou' }).expect(400);
      await create('awa', 'support', { city: 'Dakar' }).expect(400);
      await create('awa', 'hotels', {}).expect(400);
      await create('awa', 'hotels', { city: 'Dakar' }, ' ').expect(400);
      // Criteria that cannot be compared reliably are refused, not silently ignored.
      await create('awa', 'hotels', { maxPrice: 1000 }).expect(400);
      await create('awa', 'hotels', { checkIn: '2030-01-01' }).expect(400);
      await create('awa', 'vehicles', { vehicleMode: 'moto' }).expect(400);
      await create('awa', 'vehicles', { minPrice: 10, maxPrice: 5 }).expect(400);
      await create('awa', 'vehicles', { minPrice: -1 }).expect(400);
      await create('awa', 'vehicles', { minYear: 1800 }).expect(400);
      await create('awa', 'real_estate', { minPrice: '10' }).expect(400);
      await create('awa', 'trips', { date: '2030-02-31' }).expect(400);
      await create('awa', 'trips', { date: '2020-01-01' }).expect(400);
      await create('awa', 'trips', { vehicleType: 'avion' }).expect(400);
      await create('awa', 'trips', { passengers: 0 }).expect(400);
      expect(await db.savedAlert.count()).toBe(0);
    });

    it('creates, reads, updates, pauses and deletes, for its owner only', async () => {
      const alert = (await create('awa', 'vehicles', { brand: 'Toyota', maxPrice: 5000 }).expect(201)).body.data;
      expect(alert).toMatchObject({ name: 'Ma recherche', active: true, filters: { brand: 'Toyota', maxPrice: 5000 }, searchUrl: '/voitures?brand=Toyota&maxPrice=5000' });
      await http().get(`/saved-alerts/${alert.id}`).set(as('modou')).expect(404);
      await http().get(`/saved-alerts/${alert.id}/matches`).set(as('modou')).expect(404);
      await http().patch(`/saved-alerts/${alert.id}`).set(as('modou')).send({ active: false }).expect(404);
      await http().delete(`/saved-alerts/${alert.id}`).set(as('modou')).expect(200);
      expect(await db.savedAlert.count()).toBe(1);
      expect((await http().get('/saved-alerts').set(as('modou'))).body.meta.total).toBe(0);
      const updated = (await http().patch(`/saved-alerts/${alert.id}`).set(as('awa')).send({ name: 'Renommée', filters: { brand: 'Kia' } }).expect(200)).body.data;
      expect(updated).toMatchObject({ name: 'Renommée', filters: { brand: 'Kia' } });
      await http().patch(`/saved-alerts/${alert.id}`).set(as('awa')).send({ filters: { brand: 'Kia', foo: 1 } }).expect(400);
      expect((await http().patch(`/saved-alerts/${alert.id}`).set(as('awa')).send({ active: false }).expect(200)).body.data.active).toBe(false);
      expect((await http().get(`/saved-alerts/${alert.id}`).set(as('awa')).expect(200)).body.data).toMatchObject({ active: false, name: 'Renommée' });
      await http().delete(`/saved-alerts/${alert.id}`).set(as('awa')).expect(200);
      await http().delete(`/saved-alerts/${alert.id}`).set(as('awa')).expect(200);
      await http().get(`/saved-alerts/${alert.id}`).set(as('awa')).expect(404);
    });

    it('refuses an exact duplicate, even concurrently and in another key order, but not for another account', async () => {
      await create('awa', 'vehicles', { brand: 'Kia', city: 'Dakar' }).expect(201);
      await create('awa', 'vehicles', { city: 'Dakar', brand: 'Kia' }).expect(409);
      await create('modou', 'vehicles', { brand: 'Kia', city: 'Dakar' }).expect(201);
      const results = await Promise.all(Array.from({ length: 4 }, () => create('awa', 'hotels', { city: 'Saly' })));
      expect(results.filter((row) => row.status === 201)).toHaveLength(1);
      expect(results.filter((row) => row.status === 409)).toHaveLength(3);
      const other = (await create('awa', 'hotels', { city: 'Mbour' }).expect(201)).body.data;
      await http().patch(`/saved-alerts/${other.id}`).set(as('awa')).send({ filters: { city: 'Saly' } }).expect(409);
      // The id of a renamed search does not block the search it used to be.
      await http().patch(`/saved-alerts/${other.id}`).set(as('awa')).send({ filters: { city: 'Thiès' } }).expect(200);
      await create('awa', 'hotels', { city: 'Mbour' }).expect(201);
    });

    it('limits the number of alerts per account', async () => {
      for (let i = 0; i < MAX_ALERTS_PER_ACCOUNT; i++) await db.savedAlert.create({ data: { userId: 'awa', module: 'hotels', active: true, criteria: { version: 1, name: 'x', filters: { city: `c${i}` } } } });
      await create('awa', 'hotels', { city: 'Saly' }).expect(409);
    });

    it('keeps an older format readable and deletable, without interpreting it', async () => {
      await db.savedAlert.create({ data: { id: 'old', userId: 'awa', module: 'hotels', active: true, criteria: { foo: 'bar' } } });
      expect((await http().get('/saved-alerts/old').set(as('awa')).expect(200)).body.data).toMatchObject({ usable: false, filters: null, searchUrl: null });
      expect((await http().get('/saved-alerts/old/matches').set(as('awa')).expect(200)).body.data).toEqual([]);
      await http().patch('/saved-alerts/old').set(as('awa')).send({ name: 'Autre' }).expect(409);
      await http().delete('/saved-alerts/old').set(as('awa')).expect(200);
    });

    it('states that notifications are off unless the processor is really enabled', async () => {
      const before = process.env.SAVED_ALERTS_PROCESSOR_ENABLED;
      delete process.env.SAVED_ALERTS_PROCESSOR_ENABLED;
      expect((await http().get('/saved-alerts/capabilities').set(as('awa')).expect(200)).body.data).toEqual({ internalNotifications: false, emailNotifications: false });
      process.env.SAVED_ALERTS_PROCESSOR_ENABLED = 'true';
      expect((await http().get('/saved-alerts/capabilities').set(as('awa'))).body.data.internalNotifications).toBe(true);
      if (before === undefined) delete process.env.SAVED_ALERTS_PROCESSOR_ENABLED; else process.env.SAVED_ALERTS_PROCESSOR_ENABLED = before;
    });

    describe('matches', () => {
      const ids = async (id: string, query = '') => (await http().get(`/saved-alerts/${id}/matches${query}`).set(as('awa')).expect(200)).body.data.map((row: any) => row.listingId);

      it('real estate', async () => {
        await seedListing('realEstateListing', 'yes', { transaction: 'location', propertyType: 'villa', neighborhood: 'Almadies', price: 500, metadata: { publication: { features: { surface: 120 } } } });
        await seedListing('realEstateListing', 'small', { transaction: 'location', propertyType: 'villa', neighborhood: 'Almadies', price: 500, metadata: { publication: { features: { surface: 50 } } } });
        await seedListing('realEstateListing', 'dear', { transaction: 'location', propertyType: 'villa', neighborhood: 'Almadies', price: 900, metadata: { surface: 120 } });
        await seedListing('realEstateListing', 'sale', { transaction: 'vente', propertyType: 'villa', neighborhood: 'Almadies', price: 500, metadata: { surface: 120 } });
        await seedListing('realEstateListing', 'draft', { status: 'draft', transaction: 'location', propertyType: 'villa', neighborhood: 'Almadies', price: 500, metadata: { surface: 120 } });
        const alert = (await create('awa', 'real_estate', { transaction: 'location', propertyType: 'villa', city: 'almadies', maxPrice: 600, minSurface: 100 }).expect(201)).body.data;
        expect(await ids(alert.id)).toEqual(['yes']);
      });

      it('hotels', async () => {
        await seedListing('hotelProperty', 'yes', { name: 'Hôtel', region: 'Thiès', propertyType: 'hotel' });
        await seedListing('hotelProperty', 'no', { name: 'Hôtel', region: 'Fatick', propertyType: 'hotel' });
        const alert = (await create('awa', 'hotels', { city: 'thiès', propertyType: 'hotel' }).expect(201)).body.data;
        expect(await ids(alert.id)).toEqual(['yes']);
      });

      it('vehicles', async () => {
        const meta = (brand: string, year: number, fuel = 'Diesel') => ({ publication: { identity: { brand, year }, info: { fuel } } });
        await seedListing('vehicleListing', 'yes', { vehicleMode: 'sale', price: 100, metadata: meta('Toyota', 2020) });
        await seedListing('vehicleListing', 'old', { vehicleMode: 'sale', price: 100, metadata: meta('Toyota', 2010) });
        await seedListing('vehicleListing', 'brand', { vehicleMode: 'sale', price: 100, metadata: meta('Kia', 2020) });
        await seedListing('vehicleListing', 'mode', { vehicleMode: 'rental', price: 100, metadata: meta('Toyota', 2020) });
        await seedListing('vehicleListing', 'fuel', { vehicleMode: 'sale', price: 100, metadata: meta('Toyota', 2020, 'Essence') });
        const alert = (await create('awa', 'vehicles', { vehicleMode: 'sale', brand: 'toyota', minYear: 2018, fuel: 'Diesel', maxPrice: 200 }).expect(201)).body.data;
        expect(await ids(alert.id)).toEqual(['yes']);
      });

      it('trips: only a real future departure with enough seats, on the Dakar date', async () => {
        const trip = (id: string, extra = {}) => seedListing('tripListing', id, { departureCity: 'Dakar', arrivalCity: 'Touba', vehicleType: 'bus', departureTime: '08:00', ...extra });
        const day = new Date(Date.now() + 5 * DAY).toISOString().slice(0, 10);
        const serviceDate = new Date(`${day}T00:00:00Z`);
        await trip('yes'); await future('yes', { serviceDate, remainingSeats: 3, pricePerSeat: 5000 });
        await trip('full'); await future('full', { serviceDate, remainingSeats: 1 });
        await trip('past'); await future('past', { serviceDate, departureAt: new Date(Date.now() - DAY) });
        await trip('off'); await future('off', { serviceDate, cancelledAt: new Date() });
        await trip('other'); await future('other', { serviceDate: new Date(serviceDate.getTime() + DAY) });
        await trip('dear'); await future('dear', { serviceDate, pricePerSeat: 9000 });
        await trip('night', { departureTime: '23:00' }); await future('night', { serviceDate });
        await trip('none');
        const alert = (await create('awa', 'trips', { departureCity: 'dakar', arrivalCity: 'touba', date: day, passengers: 2, maxPrice: 6000, vehicleType: 'bus', timeOfDay: 'morning' }).expect(201)).body.data;
        expect(await ids(alert.id)).toEqual(['yes']);
      });

      it('sorts and pages in the database, so that no page comes up short', async () => {
        for (let i = 0; i < 25; i++) await seedListing('vehicleListing', `m${String(i).padStart(2, '0')}`, { vehicleMode: 'sale', updatedAt: new Date(Date.now() - i * 1000) });
        for (let i = 0; i < 10; i++) await seedListing('vehicleListing', `x${i}`, { vehicleMode: 'rental', updatedAt: new Date() });
        const alert = (await create('awa', 'vehicles', { vehicleMode: 'sale' }).expect(201)).body.data;
        const page = (await http().get(`/saved-alerts/${alert.id}/matches?limit=20&page=1`).set(as('awa'))).body;
        expect(page.data).toHaveLength(20);
        expect(page.meta).toMatchObject({ total: 25, totalPages: 2 });
        expect(page.data[0].listingId).toBe('m00');
        expect(await ids(alert.id, '?limit=20&page=2')).toHaveLength(5);
      });
    });

    describe('processor', () => {
      const started = async () => { await processor().runOnce(); };
      const alertFor = async (token = 'awa', filters: unknown = { vehicleMode: 'sale' }) => (await create(token, 'vehicles', filters).expect(201)).body.data;
      const notifications = (userId = 'awa') => db.notification.rows.filter((row: any) => row.userId === userId);
      const activate = (id: string, extra = {}) => seedListing('vehicleListing', id, { vehicleMode: 'sale', updatedAt: new Date(Date.now() + 1000), ...extra });
      const later = () => new Date(Date.now() + 5000);

      it('creates one notification, with a safe link, and nothing more on a second run', async () => {
        await started();
        await alertFor();
        await activate('v1');
        expect(await processor().runOnce(later())).toEqual({ created: 1 });
        expect(notifications()[0]).toMatchObject({ type: 'saved_alert_match', module: 'vehicles', targetUrl: '/voitures/detail/?id=v1', message: 'Titre v1' });
        expect(await processor().runOnce(later())).toEqual({ created: 0 });
        expect(notifications()).toHaveLength(1);
      });

      it('sends no retroactive batch: not on the first run, nor for listings older than the alert', async () => {
        await seedListing('vehicleListing', 'before', { vehicleMode: 'sale', updatedAt: new Date(Date.now() - 1000) });
        await alertFor();
        await started();
        expect(notifications()).toHaveLength(0);
        expect(await processor().runOnce(later())).toEqual({ created: 0 });
        expect((await http().get(`/saved-alerts/${(await db.savedAlert.findFirst({})).id}/matches`).set(as('awa'))).body.data).toHaveLength(1);
      });

      it('survives a crash: a new processor finishes the work without duplicates', async () => {
        await started();
        await alertFor();
        await activate('v1');
        await activate('v2');
        const save = db.idempotencyKey.upsert;
        db.idempotencyKey.upsert = async (args: any) => { if (args.where.key.endsWith('vehicles')) throw new Error('crash before the cursor'); return save.call(db.idempotencyKey, args); };
        await expect(processor().runOnce(later())).rejects.toThrow('crash');
        db.idempotencyKey.upsert = save;
        expect(notifications()).toHaveLength(2);
        expect(await processor().runOnce(later())).toEqual({ created: 0 });
        await activate('v3');
        expect(await processor().runOnce(later())).toEqual({ created: 1 });
        expect(notifications()).toHaveLength(3);
      });

      it('does not lose a listing if the crash comes before any notification', async () => {
        await started();
        await alertFor();
        await activate('v1');
        const insert = db.notification.createMany;
        db.notification.createMany = async () => { throw new Error('crash'); };
        await expect(processor().runOnce(later())).rejects.toThrow('crash');
        db.notification.createMany = insert;
        expect(await processor().runOnce(later())).toEqual({ created: 1 });
      });

      it('keeps one notification under concurrent runs and repeated activations', async () => {
        await started();
        await alertFor();
        await activate('v1');
        await Promise.all([processor().runOnce(later()), processor().runOnce(later()), processor().runOnce(later())]);
        expect(notifications()).toHaveLength(1);
        await db.vehicleListing.update({ where: { id: 'v1' }, data: { status: 'suspended' } });
        await processor().runOnce(later());
        await db.vehicleListing.update({ where: { id: 'v1' }, data: { status: 'active', updatedAt: new Date(Date.now() + 2000) } });
        await processor().runOnce(later());
        expect(notifications()).toHaveLength(1);
      });

      it('picks up a listing whose date falls just before the previous scan', async () => {
        await started();
        await alertFor();
        await processor().runOnce(later());
        // A transaction that wrote its date, then committed after that scan.
        await seedListing('vehicleListing', 'late', { vehicleMode: 'sale', updatedAt: new Date(Date.now() + 1000) });
        expect(await processor().runOnce(new Date(Date.now() + 6000))).toEqual({ created: 1 });
      });

      it('never notifies a draft, a refused listing, a mismatch, the owner or a paused alert', async () => {
        await started();
        await alertFor('owner');
        const paused = await alertFor('modou');
        await http().patch(`/saved-alerts/${paused.id}`).set(as('modou')).send({ active: false }).expect(200);
        await alertFor('awa', { vehicleMode: 'rental' });
        await activate('v1');
        await activate('draft', { status: 'draft' });
        await activate('refused', { status: 'refused' });
        expect(await processor().runOnce(later())).toEqual({ created: 0 });
        expect(db.notification.rows).toHaveLength(0);
      });

      it('isolates accounts: each one receives only its own alert', async () => {
        await started();
        await alertFor('awa');
        await alertFor('modou', { vehicleMode: 'rental' });
        await activate('v1');
        await processor().runOnce(later());
        expect(notifications('awa')).toHaveLength(1);
        expect(notifications('modou')).toHaveLength(0);
      });

      it('does not report what appeared while an alert was paused, or before its criteria changed', async () => {
        await started();
        const alert = await alertFor();
        await http().patch(`/saved-alerts/${alert.id}`).set(as('awa')).send({ active: false }).expect(200);
        await seedListing('vehicleListing', 'during', { vehicleMode: 'sale', updatedAt: new Date() });
        await new Promise((done) => setTimeout(done, 5));
        await http().patch(`/saved-alerts/${alert.id}`).set(as('awa')).send({ active: true }).expect(200);
        expect(await processor().runOnce(later())).toEqual({ created: 0 });
        await activate('after');
        expect(await processor().runOnce(later())).toEqual({ created: 1 });
      });

      it('trips: one notification for the parent, and only with a future departure', async () => {
        await started();
        await alertFor('awa');
        const trip = (await create('awa', 'trips', { departureCity: 'Dakar' }).expect(201)).body.data;
        expect(trip.active).toBe(true);
        await seedListing('tripListing', 'none', { departureCity: 'Dakar', arrivalCity: 'Touba', updatedAt: new Date(Date.now() + 1000) });
        await seedListing('tripListing', 't1', { departureCity: 'Dakar', arrivalCity: 'Touba', updatedAt: new Date(Date.now() + 1000) });
        await future('t1'); await future('t1'); await future('t1');
        expect(await processor().runOnce(later())).toEqual({ created: 1 });
        expect(notifications()[0].targetUrl).toBe('/voyages/detail/?id=t1');
      });

      it('has no timer unless it is really enabled', () => {
        delete process.env.SAVED_ALERTS_PROCESSOR_ENABLED;
        const instance: any = processor();
        instance.onModuleInit();
        expect(instance.timer).toBeUndefined();
      });
    });
  });
});

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { createServer } from 'http';
import { readFile, mkdir } from 'fs/promises';
import { resolve, sep, extname } from 'path';
import * as bcrypt from 'bcryptjs';
import request = require('supertest');
import { AuthService } from '../../auth/auth.service';
import { AuthController } from '../../auth/auth.controller';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { ApiResponseInterceptor } from '../../common/interceptors/api-response.interceptor';
import { AllExceptionsFilter } from '../../common/filters/all-exceptions.filter';
import { PrismaService } from '../../database/prisma/prisma.service';
import { FilesService } from '../../files/files.service';
import { RealEstateController } from '../real-estate/real-estate.controller';
import { RealEstateService } from '../real-estate/real-estate.service';
import { HotelsController } from '../hotels/hotels.controller';
import { HotelsService } from '../hotels/hotels.service';
import { HotelPublicationService } from '../hotels/hotel-publication.service';
import { HotelReservationsService } from '../hotels/hotel-reservations.service';
import { VehiclesController } from '../vehicles/vehicles.controller';
import { VehiclesService } from '../vehicles/vehicles.service';
import { VehiclePublicationService } from '../vehicles/vehicle-publication.service';
import { TripsController } from '../trips/trips.controller';
import { TripsService } from '../trips/trips.service';
import { TripPublicationService } from '../trips/trip-publication.service';
import { TripOccurrencesService } from '../trips/trip-occurrences.service';
import { NotificationsController } from '../notifications/notifications.controller';
import { NotificationsService } from '../notifications/notifications.service';
import { SavedAlertsProcessor } from '../saved-alerts/saved-alerts.processor';
import { ClientRequestsController } from './client-requests.controller';
import { ClientRequestsService } from './client-requests.service';
import { CLIENT_REQUEST_TYPES, ClientRequestType } from './client-requests.dto';

const url = process.env.TEST_DATABASE_URL;
(url ? describe : describe.skip)(
  'Client requests: real JWT, HTTP and isolated PostgreSQL',
  () => {
    let db: PrismaClient, app: INestApplication, auth: AuthService;
    const run = randomUUID(),
      owner = `cr-owner-${run}`,
      a = `cr-a-${run}`,
      b = `cr-b-${run}`,
      suspended = `cr-suspended-${run}`;
    const ids = {
      hotel: `cr-h-${run}`,
      visit: `cr-v-${run}`,
      rental: `cr-r-${run}`,
      chauffeur: `cr-c-${run}`,
      trip: `cr-t-${run}`,
    };
    const room = `cr-room-${run}`,
      occurrence = `cr-occ-${run}`;
    const password = randomUUID();
    const tokens: Record<
      string,
      { accessToken: string; refreshToken: string }
    > = {};
    const receipts: Partial<Record<ClientRequestType, string>> = {};
    const xss = '<img src=x onerror="window.requestXss=1">';
    const headers = (user = a) => ({
      Authorization: `Bearer ${tokens[user].accessToken}`,
    });
    const http = () => request(app.getHttpServer());
    const paths = {
      hotel: `/hotels/${ids.hotel}/reservation-requests`,
      visit: `/immobilier/${ids.visit}/visit-requests`,
      rental: `/voitures/${ids.rental}/rental-requests`,
      chauffeur: `/voitures/${ids.chauffeur}/chauffeur-requests`,
      trip: `/voyages/${ids.trip}/seat-requests`,
    };
    const payload = (type: ClientRequestType) => ({
      requestId: randomUUID(),
      clientName: 'Client test',
      clientEmail: 'client@example.test',
      message: xss,
      ...(type === 'hotel'
        ? {
            roomId: room,
            checkIn: '2030-06-01',
            checkOut: '2030-06-03',
            guests: 2,
            units: 1,
          }
        : type === 'visit'
          ? { preferredDate: '2030-06-01' }
          : type === 'rental'
            ? { startDate: '2030-06-01', endDate: '2030-06-03' }
            : type === 'chauffeur'
              ? { startDate: '2030-06-01' }
              : {
                  occurrenceId: occurrence,
                  requestedSeats: 2,
                  luggage: false,
                }),
    });

    beforeAll(async () => {
      const target = new URL(url!);
      if (
        !target.pathname.endsWith('_test') ||
        !['127.0.0.1', 'localhost'].includes(target.hostname)
      )
        throw new Error('Loopback isolated PostgreSQL required.');
      db = new PrismaClient({ datasources: { db: { url } } });
      const hash = await bcrypt.hash(password, 4);
      await db.user.createMany({
        data: [owner, a, b, suspended].map((id) => ({
          id,
          role:
            id === owner
              ? ('advertiser_individual' as const)
              : ('client' as const),
          email: `${id}@example.test`,
          passwordHash: hash,
        })),
      });
      await db.realEstateListing.create({
        data: {
          id: ids.visit,
          slug: ids.visit,
          ownerUserId: owner,
          title: xss,
          city: 'Dakar',
          status: 'active',
        },
      });
      await db.vehicleListing.createMany({
        data: (['rental', 'chauffeur'] as const).map((mode) => ({
          id: ids[mode],
          slug: ids[mode],
          ownerUserId: owner,
          title: xss,
          vehicleMode: mode,
          city: 'Dakar',
          status: 'active' as const,
        })),
      });
      await db.hotelProperty.create({
        data: {
          id: ids.hotel,
          slug: ids.hotel,
          ownerUserId: owner,
          name: xss,
          propertyType: 'hotel',
          city: 'Dakar',
          status: 'active',
        },
      });
      await db.hotelRoom.create({
        data: {
          id: room,
          propertyId: ids.hotel,
          name: 'Double',
          capacity: 2,
          metadata: { totalUnits: 5, basePrice: 10000 },
        },
      });
      await db.hotelRoomAvailability.createMany({
        data: ['2030-06-01', '2030-06-02'].map((day) => ({
          roomId: room,
          date: new Date(day),
          available: 5,
          status: 'open',
        })),
      });
      await db.tripListing.create({
        data: {
          id: ids.trip,
          slug: ids.trip,
          ownerUserId: owner,
          title: xss,
          vehicleType: 'bus',
          departureCity: 'Dakar',
          arrivalCity: 'Touba',
          departureTime: '08:00',
          status: 'active',
        },
      });
      await db.tripOccurrence.create({
        data: {
          id: occurrence,
          tripId: ids.trip,
          departureAt: new Date('2030-06-01T08:00:00Z'),
          serviceDate: new Date('2030-06-01'),
          totalCapacity: 30,
          offeredSeats: 30,
          remainingSeats: 30,
          pricePerSeat: 5000,
        },
      });
      const module = await Test.createTestingModule({
        controllers: [
          ClientRequestsController,
          AuthController,
          RealEstateController,
          HotelsController,
          VehiclesController,
          TripsController,
          NotificationsController,
        ],
        providers: [
          AuthService,
          ClientRequestsService,
          RealEstateService,
          HotelsService,
          HotelReservationsService,
          VehiclesService,
          TripsService,
          TripOccurrencesService,
          NotificationsService,
          JwtService,
          { provide: PrismaService, useValue: db },
          {
            provide: ConfigService,
            useValue: new ConfigService({
              JWT_SECRET: randomUUID() + randomUUID(),
              REFRESH_TOKEN_SECRET: randomUUID() + randomUUID(),
              JWT_EXPIRES_IN: '15m',
              REFRESH_TOKEN_EXPIRES_IN: '30d',
            }),
          },
          ...[
            FilesService,
            HotelPublicationService,
            VehiclePublicationService,
            TripPublicationService,
          ].map((provide) => ({ provide, useValue: {} })),
        ],
      }).compile();
      auth = module.get(AuthService);
      for (const user of [a, b, owner, suspended])
        tokens[user] = await auth.login({
          identifier: `${user}@example.test`,
          password,
        });
      await db.user.update({
        where: { id: suspended },
        data: { status: 'suspended' },
      });
      app = module.createNestApplication();
      app.setGlobalPrefix('api/v1');
      app.useGlobalGuards(
        new JwtAuthGuard(new Reflector(), auth),
        new PermissionsGuard(new Reflector()),
      );
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      app.useGlobalFilters(new AllExceptionsFilter());
      app.useGlobalInterceptors(new ApiResponseInterceptor());
      await app.listen(0, '127.0.0.1');
    }, 30000);

    afterAll(async () => {
      await app?.close();
      if (!db) return;
      await db.conversation.deleteMany({
        where: { targetId: { in: Object.values(ids) } },
      });
      await db.notification.deleteMany({
        where: { userId: { in: [a, b, owner, suspended] } },
      });
      await db.hotelReservationRequest.deleteMany({
        where: { propertyId: ids.hotel },
      });
      await db.realEstateVisitRequest.deleteMany({
        where: { listingId: ids.visit },
      });
      await db.vehicleRentalRequest.deleteMany({
        where: { listingId: ids.rental },
      });
      await db.vehicleChauffeurRequest.deleteMany({
        where: { listingId: ids.chauffeur },
      });
      await db.tripSeatRequest.deleteMany({ where: { tripId: ids.trip } });
      await db.tripOccurrence.deleteMany({ where: { tripId: ids.trip } });
      await db.contactEvent.deleteMany({
        where: { targetId: { in: Object.values(ids) } },
      });
      await db.auditLog.deleteMany({
        where: { targetId: { in: Object.values(ids) } },
      });
      await db.hotelProperty.deleteMany({ where: { id: ids.hotel } });
      await db.realEstateListing.deleteMany({ where: { id: ids.visit } });
      await db.vehicleListing.deleteMany({
        where: { id: { in: [ids.rental, ids.chauffeur] } },
      });
      await db.tripListing.deleteMany({ where: { id: ids.trip } });
      await db.user.deleteMany({
        where: { id: { in: [owner, a, b, suspended] } },
      });
      await db.$disconnect();
    });

    it.each(CLIENT_REQUEST_TYPES)(
      '%s: binds JWT identity, isolates accounts and rejects forged fields',
      async (type) => {
        const body = payload(type);
        const results = await Promise.all(
          Array.from({ length: 5 }, () =>
            http()
              .post('/api/v1' + paths[type])
              .set(headers())
              .send(body),
          ),
        );
        expect(results.map((result) => result.status)).toEqual([
          201, 201, 201, 201, 201,
        ]);
        expect(new Set(results.map((result) => result.body.data.id)).size).toBe(
          1,
        );
        const id = (receipts[type] = results[0].body.data.id);
        const page = (
          await http()
            .get(`/api/v1/compte/requests?type=${type}`)
            .set(headers())
            .expect(200)
        ).body;
        expect(page.meta.total).toBe(1);
        expect(page.data[0]).toMatchObject({
          id,
          type,
          status: 'new',
          listing: { available: true },
          message: xss,
        });
        expect(JSON.stringify(page)).not.toMatch(
          /ownerUserId|clientUserId|passwordHash|requestFingerprint|contactSettings/,
        );
        await http()
          .get(`/api/v1/compte/requests/${type}/${id}`)
          .set(headers(b))
          .expect(404);
        await http()
          .get(`/api/v1/compte/requests/${type}/${id}`)
          .set(headers(owner))
          .expect(404);
        expect(
          (
            await http()
              .get(`/api/v1/compte/requests?type=${type}`)
              .set(headers(b))
          ).body.meta.total,
        ).toBe(0);
        for (const forged of [
          { clientUserId: b },
          { ownerUserId: owner },
          { status: 'accepted' },
          { price: 1 },
          { allocatedSeats: 30 },
        ])
          await http()
            .post('/api/v1' + paths[type])
            .set(headers())
            .send({ ...payload(type), ...forged })
            .expect(400);
        await http()
          .post('/api/v1' + paths[type])
          .set(headers(b))
          .send(body)
          .expect(409);
        await http()
          .post('/api/v1' + paths[type])
          .send(body)
          .expect(409);
        const anonymousBody = payload(type);
        const anonymous = await http()
          .post('/api/v1' + paths[type])
          .send(anonymousBody)
          .expect(201);
        await http()
          .post('/api/v1' + paths[type])
          .set(headers())
          .send(anonymousBody)
          .expect(409);
        await http()
          .get(`/api/v1/compte/requests/${type}/${anonymous.body.data.id}`)
          .set(headers())
          .expect(404);
        expect(
          (
            await http()
              .get(`/api/v1/compte/requests?type=${type}`)
              .set(headers())
          ).body.meta.total,
        ).toBe(1);
        await http()
          .post('/api/v1' + paths[type])
          .set({ Authorization: 'Bearer invalid' })
          .send(payload(type))
          .expect(401);
        await http()
          .post('/api/v1' + paths[type])
          .set(headers(suspended))
          .send(payload(type))
          .expect(401);
        await http().get(`/api/v1/compte/requests?type=${type}`).expect(401);
      },
    );

    it('validates pagination and filters; professionals do not bypass ownership', async () => {
      for (const suffix of [
        '?type=unknown',
        '?type=hotel&limit=101',
        '?type=trip&page=0',
        `?type=visit&clientUserId=${b}`,
      ])
        await http()
          .get('/api/v1/compte/requests' + suffix)
          .set(headers())
          .expect(400);
      await http()
        .get('/api/v1/compte/requests/hotel/missing')
        .set(headers())
        .expect(404);
      await http()
        .get('/api/v1/compte/requests/summary')
        .set(headers(suspended))
        .expect(401);
      await http()
        .post('/api/v1/dashboard/voitures/' + ids.rental)
        .set(headers())
        .send({})
        .expect(404);
    });

    it('lets a professional make their own client request without gaining access to other clients', async () => {
      const response = await http()
        .post('/api/v1' + paths.rental)
        .set(headers(owner))
        .send(payload('rental'))
        .expect(201);
      await http()
        .get(`/api/v1/compte/requests/rental/${response.body.data.id}`)
        .set(headers(owner))
        .expect(200);
      await http()
        .get(`/api/v1/compte/requests/rental/${response.body.data.id}`)
        .set(headers())
        .expect(404);
    });

    it('does not allocate stock when sending; records owner decisions and notifications atomically', async () => {
      await db.user.update({ where: { id: owner }, data: { role: 'admin' } });
      expect(
        await db.hotelStockAllocation.count({ where: { roomId: room } }),
      ).toBe(0);
      expect(
        (
          await db.tripOccurrence.findUniqueOrThrow({
            where: { id: occurrence },
          })
        ).remainingSeats,
      ).toBe(30);
      const routes = {
        hotel: 'hotels/reservations',
        visit: 'immobilier/visits',
        rental: 'voitures/rental-requests',
        chauffeur: 'voitures/chauffeur-requests',
        trip: 'voyages/seat-requests',
      };
      for (const type of CLIENT_REQUEST_TYPES) {
        const path = `/api/v1/dashboard/${routes[type]}/${receipts[type]}/status`;
        await http()
          .patch(path)
          .set(headers())
          .send({ status: 'pending' })
          .expect(403);
        await http()
          .patch(path)
          .set(headers(owner))
          .send({ status: 'pending' })
          .expect(200);
        await http()
          .patch(path)
          .set(headers(owner))
          .send({ status: 'pending' })
          .expect(200);
      }
      expect(
        await db.notification.count({
          where: { userId: a, type: 'request_status_changed' },
        }),
      ).toBe(5);
      const hotelService = new HotelReservationsService(db as PrismaService);
      await hotelService.update(owner, receipts.hotel!, { status: 'accepted' });
      await hotelService.update(owner, receipts.hotel!, { status: 'accepted' });
      expect(
        await db.hotelStockAllocation.count({
          where: { requestId: receipts.hotel, releasedAt: null },
        }),
      ).toBe(2);
      const tripService = new TripOccurrencesService(db as PrismaService);
      await tripService.updateRequest(owner, receipts.trip!, {
        status: 'accepted',
      });
      await expect(
        tripService.updateRequest(owner, receipts.trip!, {
          status: 'accepted',
        }),
      ).rejects.toMatchObject({ status: 409 });
      expect(
        (
          await http()
            .get(`/api/v1/compte/requests/trip/${receipts.trip}`)
            .set(headers())
        ).body.data.details,
      ).toMatchObject({ allocatedSeats: 2, quotedPricePerSeat: 5000 });
      expect(
        (
          await db.tripOccurrence.findUniqueOrThrow({
            where: { id: occurrence },
          })
        ).remainingSeats,
      ).toBe(28);
      await hotelService.update(owner, receipts.hotel!, {
        status: 'cancelled',
      });
      await hotelService.update(owner, receipts.hotel!, {
        status: 'cancelled',
      });
      await tripService.updateRequest(owner, receipts.trip!, {
        status: 'cancelled',
      });
      await tripService.updateRequest(owner, receipts.trip!, {
        status: 'cancelled',
      });
      expect(
        (
          await db.tripOccurrence.findUniqueOrThrow({
            where: { id: occurrence },
          })
        ).remainingSeats,
      ).toBe(30);
      expect(
        await db.hotelStockAllocation.count({
          where: { requestId: receipts.hotel, releasedAt: null },
        }),
      ).toBe(0);
      expect(
        await db.notification.count({
          where: { userId: a, type: 'request_status_changed' },
        }),
      ).toBe(9);
    });

    it.each(CLIENT_REQUEST_TYPES)(
      '%s: pages beyond 100 and preserves private historical requests without exposing a draft',
      async (type) => {
        const data = Array.from({ length: 105 }, (_, i) => ({
          id: `cr-page-${type}-${i}-${run}`,
          clientUserId: b,
        }));
        if (type === 'hotel')
          await db.hotelReservationRequest.createMany({
            data: data.map((row) => ({ ...row, propertyId: ids.hotel })),
          });
        if (type === 'visit')
          await db.realEstateVisitRequest.createMany({
            data: data.map((row) => ({ ...row, listingId: ids.visit })),
          });
        if (type === 'rental')
          await db.vehicleRentalRequest.createMany({
            data: data.map((row) => ({ ...row, listingId: ids.rental })),
          });
        if (type === 'chauffeur')
          await db.vehicleChauffeurRequest.createMany({
            data: data.map((row) => ({ ...row, listingId: ids.chauffeur })),
          });
        if (type === 'trip')
          await db.tripSeatRequest.createMany({
            data: data.map((row) => ({
              ...row,
              tripId: ids.trip,
              requestedSeats: 1,
            })),
          });
        const page1 = (
          await http()
            .get(`/api/v1/compte/requests?type=${type}&limit=100&page=1`)
            .set(headers(b))
        ).body;
        const page2 = (
          await http()
            .get(`/api/v1/compte/requests?type=${type}&limit=100&page=2`)
            .set(headers(b))
        ).body;
        expect(page1.meta).toMatchObject({ total: 105, totalPages: 2 });
        expect(page2.data).toHaveLength(5);
        expect(
          new Set([...page1.data, ...page2.data].map((row) => row.id)).size,
        ).toBe(105);
        const summary = (
          await http().get('/api/v1/compte/requests/summary').set(headers(b))
        ).body.data;
        expect(summary.totals[type]).toBe(105);
        const delegate =
          type === 'hotel'
            ? db.hotelProperty
            : type === 'visit'
              ? db.realEstateListing
              : type === 'trip'
                ? db.tripListing
                : db.vehicleListing;
        await (delegate as any).update({
          where: { id: ids[type] },
          data: {
            status: 'suspended',
            ...(type === 'hotel'
              ? { name: 'Private new title' }
              : { title: 'Private new title' }),
          },
        });
        const historical = (
          await http()
            .get(`/api/v1/compte/requests/${type}/${receipts[type]}`)
            .set(headers())
            .expect(200)
        ).body.data;
        expect(historical.listing).toMatchObject({
          available: false,
          title: 'Annonce indisponible',
          url: null,
        });
        expect(JSON.stringify(historical)).not.toContain('Private new title');
        await (delegate as any).update({
          where: { id: ids[type] },
          data: { deletedAt: new Date() },
        });
        const deleted = (
          await http()
            .get(`/api/v1/compte/requests/${type}/${receipts[type]}`)
            .set(headers())
            .expect(200)
        ).body.data;
        expect(deleted.listing).toMatchObject({ available: false, url: null });
        await http()
          .post('/api/v1' + paths[type])
          .set(headers())
          .send(payload(type))
          .expect(404);
        await (delegate as any).update({
          where: { id: ids[type] },
          data: {
            status: 'active',
            deletedAt: null,
            ...(type === 'hotel' ? { name: xss } : { title: xss }),
          },
        });
      },
    );

    it('links only a conversation in which the current client participates', async () => {
      const own = await db.conversation.create({
        data: {
          module: 'vehicles',
          targetType: 'listing',
          targetId: ids.rental,
          participants: { create: [{ userId: a }, { userId: owner }] },
        },
      });
      const foreign = await db.conversation.create({
        data: {
          module: 'vehicles',
          targetType: 'listing',
          targetId: ids.rental,
          participants: { create: [{ userId: b }, { userId: owner }] },
        },
      });
      const result = (
        await http()
          .get(`/api/v1/compte/requests/rental/${receipts.rental}`)
          .set(headers())
          .expect(200)
      ).body.data;
      expect(result.conversationUrl).toContain(own.id);
      expect(result.conversationUrl).not.toContain(foreign.id);
    });

    it('processor is disabled by default, can stop/restart locally and keeps its durable cursor', async () => {
      const old = process.env.SAVED_ALERTS_PROCESSOR_ENABLED;
      const spy = jest.spyOn(global, 'setInterval');
      try {
        delete process.env.SAVED_ALERTS_PROCESSOR_ENABLED;
        const off = new SavedAlertsProcessor(db as PrismaService);
        off.onModuleInit();
        expect(spy).not.toHaveBeenCalled();
        process.env.SAVED_ALERTS_PROCESSOR_ENABLED = 'true';
        const first = new SavedAlertsProcessor(db as PrismaService);
        first.onModuleInit();
        await first.runOnce();
        first.onModuleDestroy();
        const restart = new SavedAlertsProcessor(db as PrismaService);
        restart.onModuleInit();
        await restart.runOnce();
        restart.onModuleDestroy();
        expect(spy).toHaveBeenCalledTimes(2);
        expect(
          await db.idempotencyKey.count({
            where: { scope: 'saved_alert_cursor' },
          }),
        ).toBe(4);
      } finally {
        spy.mockRestore();
        if (old === undefined)
          delete process.env.SAVED_ALERTS_PROCESSOR_ENABLED;
        else process.env.SAVED_ALERTS_PROCESSOR_ENABLED = old;
      }
    });

    (process.env.PENCMI_PLAYWRIGHT_MODULE ? it : it.skip)(
      'real browser and real SQL: all five public forms, account details, reconnect and responsive states',
      async () => {
        const { chromium } = require(
          process.env.PENCMI_PLAYWRIGHT_MODULE!.replace(
            /index\.mjs$/,
            'index.js',
          ),
        );
        const root = resolve(__dirname, '../../../..');
        const api = await app.getUrl();
        let origin: string;
        const server = createServer(async (req, res) => {
          try {
            const target = new URL(req.url!, 'http://localhost');
            if (target.pathname.startsWith('/api/v1/')) {
              const chunks: Buffer[] = [];
              for await (const chunk of req) chunks.push(Buffer.from(chunk));
              const response = await fetch(
                api + target.pathname + target.search,
                {
                  method: req.method,
                  headers: {
                    ...(req.headers.authorization
                      ? { Authorization: req.headers.authorization }
                      : {}),
                    'Content-Type': 'application/json',
                  },
                  body: chunks.length ? Buffer.concat(chunks) : undefined,
                },
              );
              res.writeHead(response.status, {
                'Content-Type': 'application/json',
              });
              return res.end(await response.text());
            }
            if (target.pathname === '/config/runtime-config.js') {
              res.setHeader('Content-Type', 'text/javascript');
              return res.end(
                `window.PencmiRuntimeConfig={apiBaseUrl:${JSON.stringify(origin + '/api/v1')}};`,
              );
            }
            const file = resolve(
              root,
              '.' +
                decodeURIComponent(
                  target.pathname.endsWith('/')
                    ? target.pathname + 'index.html'
                    : target.pathname,
                ),
            );
            if (
              !file.startsWith(root + sep) ||
              /[\\/](backend|node_modules|\.git)[\\/]/.test(file) ||
              !/\.(html|css|m?js|json|png|jpe?g|svg|woff2?)$/i.test(file)
            ) {
              res.statusCode = 404;
              return res.end();
            }
            const types: Record<string, string> = {
              '.html': 'text/html; charset=utf-8',
              '.js': 'text/javascript',
              '.mjs': 'text/javascript',
              '.css': 'text/css',
              '.json': 'application/json',
            };
            res.setHeader(
              'Content-Type',
              types[extname(file)] || 'application/octet-stream',
            );
            res.end(await readFile(file));
          } catch {
            res.statusCode = 404;
            res.end();
          }
        });
        await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
        origin = `http://127.0.0.1:${(server.address() as any).port}`;
        const browser = await chromium.launch({
          channel: 'msedge',
          headless: true,
        });
        const publicPaths = {
          hotel: `/hotels/detail/?id=${ids.hotel}`,
          visit: `/immobilier/annonce/?id=${ids.visit}`,
          rental: `/voitures/detail/?id=${ids.rental}`,
          chauffeur: `/voitures/detail/?id=${ids.chauffeur}`,
          trip: `/voyages/detail/?id=${ids.trip}&occurrenceId=${occurrence}`,
        };
        const pages = {
          hotel: 'reservations',
          visit: 'visites',
          rental: 'locations',
          chauffeur: 'chauffeur',
          trip: 'trajets',
        };
        try {
          for (const width of [360, 390, 768, 1280]) {
            const login = await auth.login({
              identifier: `${a}@example.test`,
              password,
            });
            const context = await browser.newContext({
              viewport: { width, height: 900 },
            });
            await context.addInitScript(
              ({
                accessToken,
                refreshToken,
              }: {
                accessToken: string;
                refreshToken: string;
              }) => {
                if (!localStorage.getItem('pencmi_access_token')) {
                  localStorage.setItem('pencmi_access_token', accessToken);
                  localStorage.setItem('pencmi_refresh_token', refreshToken);
                }
              },
              login,
            );
            const page = await context.newPage();
            const noOverflow = async () =>
              expect(
                await page.evaluate(
                  () => document.documentElement.scrollWidth <= innerWidth + 1,
                ),
              ).toBe(true);
            for (const type of CLIENT_REQUEST_TYPES) {
              await page.goto(origin + publicPaths[type]);
              const opener =
                type === 'hotel' || type === 'trip'
                  ? '[data-open-reservation]'
                  : type === 'visit'
                    ? '[data-open-visit]'
                    : '[data-open-contact]';
              await page.locator(opener).first().click();
              const selector =
                type === 'hotel'
                  ? '#hotel-reservation-form'
                  : type === 'visit'
                    ? '[data-visit-form]'
                    : type === 'trip'
                      ? '#trip-reservation-form'
                      : '#vehicle-request-form';
              const form = page.locator(selector);
              await form.locator('[name=clientName]').fill('Client navigateur');
              await form
                .locator('[name=clientEmail]')
                .fill(`${type}-${width}@example.test`);
              await form.locator('[name=message]').fill(xss);
              if (type === 'hotel') {
                await form.locator('[name=roomId]').selectOption(room);
                await form.locator('[name=checkIn]').fill('2030-06-01');
                await form.locator('[name=checkOut]').fill('2030-06-03');
              } else if (type === 'visit')
                await form.locator('[name=preferredDate]').fill('2030-06-01');
              else if (type !== 'trip') {
                await form.locator('[name=startDate]').fill('2030-06-01');
                if (type === 'rental')
                  await form.locator('[name=endDate]').fill('2030-06-03');
              }
              if (type === 'visit' && width === 360) {
                await page.route(
                  '**/api/v1' + paths.visit,
                  async (route: any) => {
                    await route.fetch();
                    await route.abort();
                  },
                  { times: 1 },
                );
                await form.locator('[type=submit]').click();
                await form
                  .locator('[role=alert]')
                  .filter({ hasText: /interrompue|impossible|Failed/ })
                  .waitFor();
                expect(await form.locator('[name=message]').inputValue()).toBe(
                  xss,
                );
              }
              await form.locator('[type=submit]').click();
              const link = page.getByRole('link', {
                name: 'Suivre ma demande',
                exact: true,
              });
              await link.waitFor();
              const detailUrl = await link.getAttribute('href');
              await link.click();
              await page
                .getByRole('heading', { name: 'Votre demande', exact: true })
                .waitFor();
              expect(await page.locator('.cr-request').innerText()).toContain(
                xss,
              );
              expect(
                await page.evaluate(() => (window as any).requestXss),
              ).toBeUndefined();
              expect(await page.locator('.cr-request img').count()).toBe(0);
              await noOverflow();
              if (type === 'trip' && (width === 360 || width === 1280)) {
                const directory = resolve(
                  process.env.LOCALAPPDATA!,
                  'Pencmi',
                  'test-artifacts',
                  'stage16',
                );
                await mkdir(directory, { recursive: true });
                await page.screenshot({
                  path: resolve(directory, `request-${width}.png`),
                  fullPage: true,
                });
              }
              await page.goto(`${origin}/compte/${pages[type]}/`);
              await page.locator('.cr-request').first().waitFor();
              await noOverflow();
              await page.goto(origin + detailUrl);
              await page
                .getByRole('heading', { name: 'Votre demande', exact: true })
                .waitFor();
            }
            await page.goto(origin + '/compte/visites/');
            await page.locator('.cr-request').first().waitFor();
            await page.route(
              '**/api/v1/compte/requests?*',
              (route: any) => route.abort(),
              { times: 1 },
            );
            await page.reload();
            await page
              .getByRole('button', { name: 'Réessayer', exact: true })
              .waitFor();
            await page
              .getByRole('button', { name: 'Réessayer', exact: true })
              .click();
            await page.locator('.cr-request').first().waitFor();
            await page.goto(origin + '/compte/');
            await page.waitForFunction(
              () =>
                Number(
                  document.querySelector('[data-request-total="visit"]')
                    ?.textContent,
                ) > 0,
            );
            await noOverflow();
            if (width === 360 || width === 1280) {
              const directory = resolve(
                process.env.LOCALAPPDATA!,
                'Pencmi',
                'test-artifacts',
                'stage16',
              );
              await mkdir(directory, { recursive: true });
              await page.screenshot({
                path: resolve(directory, `account-${width}.png`),
                fullPage: true,
              });
            }
            const claims = new JwtService().decode<{ sessionId: string }>(
              login.accessToken,
            );
            await auth.logout(a, claims.sessionId);
            await page.goto(origin + '/compte/visites/');
            await page
              .locator('#pencmi-client-requests')
              .getByRole('link', { name: 'Se connecter', exact: true })
              .waitFor();
            const renewed = await auth.login({
              identifier: `${a}@example.test`,
              password,
            });
            await page.evaluate(
              ({
                accessToken,
                refreshToken,
              }: {
                accessToken: string;
                refreshToken: string;
              }) => {
                localStorage.setItem('pencmi_access_token', accessToken);
                localStorage.setItem('pencmi_refresh_token', refreshToken);
              },
              renewed,
            );
            await page.reload();
            await page.locator('.cr-request').first().waitFor();
            await context.close();
            const peer = await browser.newContext({
              viewport: { width, height: 900 },
            });
            await peer.addInitScript(
              ({
                accessToken,
                refreshToken,
              }: {
                accessToken: string;
                refreshToken: string;
              }) => {
                localStorage.setItem('pencmi_access_token', accessToken);
                localStorage.setItem('pencmi_refresh_token', refreshToken);
              },
              tokens[b],
            );
            const peerPage = await peer.newPage();
            await peerPage.goto(origin + '/compte/visites/');
            await peerPage
              .getByText('Page 1 sur 6 · 105 demandes', { exact: true })
              .waitFor();
            await peerPage
              .getByRole('button', { name: 'Suivant', exact: true })
              .click();
            await peerPage
              .getByText('Page 2 sur 6 · 105 demandes', { exact: true })
              .waitFor();
            expect(
              await peerPage.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth + 1,
              ),
            ).toBe(true);
            await peer.close();
          }
        } finally {
          await browser.close();
          await new Promise<void>((done) => server.close(() => done()));
        }
      },
      240000,
    );
  },
);

import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import request = require('supertest');
import { AuthService } from '../../auth/auth.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { HotelsController } from './hotels.controller';
import { HotelsService } from './hotels.service';
import { HotelPublicationService } from './hotel-publication.service';

describe('Hotel publication HTTP permissions and whitelist', () => {
  let app: INestApplication;
  const reservations = {
    createReservationRequest: jest.fn(async () => ({
      id: 'request',
      status: 'new',
      received: true,
    })),
    quoteStay: jest.fn(async () => ({ canConfirm: false })),
    updateReservationStatus: jest.fn(async () => ({ status: 'accepted' })),
    findMyReservationRequests: jest.fn(async () => ({
      data: [],
      meta: { total: 0 },
    })),
  };
  const publication = {
    create: jest.fn(async () => ({ id: 'owned', status: 'draft' })),
    update: jest.fn(),
    submit: jest.fn(),
    owned: jest.fn(),
    photo: jest.fn(),
    reorder: jest.fn(),
    removePhoto: jest.fn(),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [HotelsController],
      providers: [
        { provide: HotelsService, useValue: reservations },
        { provide: HotelPublicationService, useValue: publication },
        {
          provide: AuthService,
          useValue: {
            validateAccessToken: async (token: string) => {
              if (!['hotel', 'client'].includes(token))
                throw new UnauthorizedException();
              return {
                id: 'authenticated-user',
                role: token === 'hotel' ? 'hotel_manager' : 'client',
                sessionId: 'session',
              };
            },
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalGuards(
      new JwtAuthGuard(new Reflector(), module.get(AuthService)),
      new PermissionsGuard(new Reflector()),
    );
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });
  afterAll(async () => app.close());
  beforeEach(() => jest.clearAllMocks());
  it('refuses unauthenticated creation', async () => {
    await request(app.getHttpServer())
      .post('/dashboard/hotels')
      .send({})
      .expect(401);
    expect(publication.create).not.toHaveBeenCalled();
  });
  const stay = {
    roomId: 'room',
    checkIn: '2030-06-01',
    checkOut: '2030-06-03',
    guests: 2,
    units: 1,
  };
  const requestBody = {
    ...stay,
    requestId: 'a813c505-8547-467c-b978-b2a21a2ee519',
    clientName: 'Client',
    clientEmail: 'client@example.test',
  };
  it('keeps the public request distinct from protected owner management', async () => {
    await request(app.getHttpServer())
      .post('/hotels/h/reservation-requests')
      .send(requestBody)
      .expect(201);
    expect(reservations.createReservationRequest).toHaveBeenCalledWith(
      'h',
      requestBody,
    );
    await request(app.getHttpServer())
      .post('/hotels/h/stay-quote')
      .send(stay)
      .expect(201);
    await request(app.getHttpServer())
      .patch('/dashboard/hotels/reservations/r/status')
      .send({ status: 'accepted' })
      .expect(401);
    await request(app.getHttpServer())
      .patch('/dashboard/hotels/reservations/r/status')
      .set('Authorization', 'Bearer client')
      .send({ status: 'accepted' })
      .expect(403);
    expect(reservations.updateReservationStatus).not.toHaveBeenCalled();
  });
  it('uses the authenticated owner for status changes', async () => {
    await request(app.getHttpServer())
      .patch('/dashboard/hotels/reservations/r/status')
      .set('Authorization', 'Bearer hotel')
      .send({ status: 'accepted' })
      .expect(200);
    expect(reservations.updateReservationStatus).toHaveBeenCalledWith(
      'authenticated-user',
      'r',
      { status: 'accepted' },
    );
  });
  it.each(['ownerUserId', 'clientUserId', 'status', 'id'])(
    'rejects injected request field %s',
    async (key) => {
      await request(app.getHttpServer())
        .post('/hotels/h/reservation-requests')
        .send({ ...requestBody, [key]: 'injected' })
        .expect(400);
      expect(reservations.createReservationRequest).not.toHaveBeenCalled();
    },
  );
  it.each([
    { units: 0 },
    { units: true },
    { units: 1.2 },
    { guests: true },
    { guests: 0 },
    { roomId: '' },
    { requestId: 'invalid' },
    { clientName: '  ' },
    { clientEmail: 'bad' },
    { checkIn: 'bad' },
  ])('rejects invalid reservation DTO %p', async (change) => {
    await request(app.getHttpServer())
      .post('/hotels/h/reservation-requests')
      .send({ ...requestBody, ...change })
      .expect(400);
    expect(reservations.createReservationRequest).not.toHaveBeenCalled();
  });
  it('refuses client publication permissions', async () => {
    await request(app.getHttpServer())
      .post('/dashboard/hotels')
      .set('Authorization', 'Bearer client')
      .send({})
      .expect(403);
    expect(publication.create).not.toHaveBeenCalled();
  });
  it('uses only authenticated identity for authorized creation', async () => {
    await request(app.getHttpServer())
      .post('/dashboard/hotels')
      .set('Authorization', 'Bearer hotel')
      .send({})
      .expect(201);
    expect(publication.create).toHaveBeenCalledWith('authenticated-user', {});
  });
  it.each(['ownerUserId', 'status', 'slug'])(
    'rejects root administrative field %s',
    async (key) => {
      await request(app.getHttpServer())
        .post('/dashboard/hotels')
        .set('Authorization', 'Bearer hotel')
        .send({ [key]: 'active' })
        .expect(400);
      expect(publication.create).not.toHaveBeenCalled();
    },
  );
  it.each(['/dashboard/hotels/known', '/dashboard/hotels/known/photos/photo'])(
    'protects private resource %s',
    async (path) => {
      await request(app.getHttpServer())
        .delete(path)
        .set('Authorization', 'Bearer client')
        .expect(403);
    },
  );
});

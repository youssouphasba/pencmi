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
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { VehiclePublicationService } from './vehicle-publication.service';

describe('Vehicle publication HTTP access', () => {
  let app: INestApplication;
  const publication = {
    create: jest.fn(async () => ({ id: 'draft', status: 'draft' })),
    update: jest.fn(),
    submit: jest.fn(),
    findOwned: jest.fn(),
    photo: jest.fn(),
    reorder: jest.fn(),
    removePhoto: jest.fn(),
  };
  const service = {
    createContact: jest.fn(async () => ({ received: true })),
    createRentalRequest: jest.fn(),
    createChauffeurRequest: jest.fn(),
    findPublic: jest.fn(async () => ({ data: [], meta: { total: 0 } })),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [VehiclesController],
      providers: [
        { provide: VehiclesService, useValue: service },
        { provide: VehiclePublicationService, useValue: publication },
        {
          provide: AuthService,
          useValue: {
            validateAccessToken: async (token: string) => {
              if (!['seller', 'client', 'hotel', 'admin'].includes(token))
                throw new UnauthorizedException();
              return {
                id: 'authenticated-owner',
                role: {
                  seller: 'vehicle_dealer',
                  client: 'client',
                  hotel: 'hotel_manager',
                  admin: 'admin',
                }[token],
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
  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());
  it('refuses anonymous owner routes', async () => {
    for (const path of ['/dashboard/voitures', '/dashboard/voitures/id'])
      await request(app.getHttpServer()).get(path).expect(401);
    await request(app.getHttpServer())
      .post('/dashboard/voitures')
      .send({})
      .expect(401);
    expect(publication.create).not.toHaveBeenCalled();
  });
  it.each(['client', 'hotel'])(
    'refuses unrelated %s permissions',
    async (role) => {
      await request(app.getHttpServer())
        .post('/dashboard/voitures')
        .set('Authorization', `Bearer ${role}`)
        .send({})
        .expect(403);
      expect(publication.create).not.toHaveBeenCalled();
    },
  );
  it.each(['seller', 'admin'])(
    'uses the authenticated owner for %s creation',
    async (role) => {
      await request(app.getHttpServer())
        .post('/dashboard/voitures')
        .set('Authorization', `Bearer ${role}`)
        .send({})
        .expect(201);
      expect(publication.create).toHaveBeenCalledWith(
        'authenticated-owner',
        {},
      );
    },
  );
  it.each([
    { status: 'active' },
    { ownerUserId: 'other' },
    { slug: 'custom' },
    { requestId: 'not-uuid' },
    { vehicleMode: 'unknown' },
  ])('rejects disallowed creation fields %j', async (body) => {
    await request(app.getHttpServer())
      .post('/dashboard/voitures')
      .set('Authorization', 'Bearer seller')
      .send(body)
      .expect(400);
    expect(publication.create).not.toHaveBeenCalled();
  });
  it('rejects request identity injection, empty names and invalid contacts', async () => {
    for (const body of [
      { clientName: 'Client', senderUserId: 'other' },
      { clientName: '   ' },
      { clientName: 'Client', clientEmail: 'invalid' },
      {
        clientName: 'Client',
        clientEmail: 'client@example.test',
        startDate: '2030-02-31',
      },
    ])
      await request(app.getHttpServer())
        .post('/voitures/id/contact')
        .send(body)
        .expect(400);
    expect(service.createContact).not.toHaveBeenCalled();
  });
  it('validates public filters and keeps valid filters public', async () => {
    await request(app.getHttpServer())
      .get('/voitures?vehicleMode=rental&brand=Toyota&minPrice=1000')
      .expect(200);
    expect(service.findPublic).toHaveBeenCalledWith(
      expect.objectContaining({
        vehicleMode: 'rental',
        brand: 'Toyota',
        minPrice: 1000,
      }),
    );
    await request(app.getHttpServer()).get('/voitures?minPrice=-1').expect(400);
  });
  it('keeps photos protected, validates their order and limits', async () => {
    await request(app.getHttpServer())
      .patch('/dashboard/voitures/id/photos/order')
      .send({ photoIds: [] })
      .expect(401);
    for (const photoIds of [
      ['same', 'same'],
      Array.from({ length: 31 }, (_, index) => String(index)),
    ])
      await request(app.getHttpServer())
        .patch('/dashboard/voitures/id/photos/order')
        .set('Authorization', 'Bearer seller')
        .send({ photoIds })
        .expect(400);
    expect(publication.reorder).not.toHaveBeenCalled();
  });
  it('passes multipart bytes and the authenticated owner to the photo service', async () => {
    const bytes = Buffer.from('multipart bytes');
    await request(app.getHttpServer())
      .post('/dashboard/voitures/id/photos')
      .set('Authorization', 'Bearer seller')
      .field('uploadId', '815075f0-564c-4224-a5d6-89fbd23b6ee4')
      .attach('photo', bytes, {
        filename: 'image.png',
        contentType: 'image/png',
      })
      .expect(201);
    expect(publication.photo).toHaveBeenCalledWith(
      'authenticated-owner',
      'id',
      expect.objectContaining({
        uploadId: '815075f0-564c-4224-a5d6-89fbd23b6ee4',
      }),
      expect.objectContaining({ buffer: bytes }),
    );
  });
  it('rejects an oversized multipart upload before the photo service', async () => {
    await request(app.getHttpServer())
      .post('/dashboard/voitures/id/photos')
      .set('Authorization', 'Bearer seller')
      .field('uploadId', '815075f0-564c-4224-a5d6-89fbd23b6ee4')
      .attach('photo', Buffer.alloc(6 * 1024 * 1024), {
        filename: 'image.png',
        contentType: 'image/png',
      })
      .expect(413);
    expect(publication.photo).not.toHaveBeenCalled();
  });
});

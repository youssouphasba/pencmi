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
        { provide: HotelsService, useValue: {} },
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

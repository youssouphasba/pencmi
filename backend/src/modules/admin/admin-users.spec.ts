import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request = require('supertest');
import { AuthService } from '../../auth/auth.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

type Row = Record<string, any>;

function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const value = row[key];
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      if ('in' in expected) return expected.in.includes(value);
      if ('not' in expected) return value !== expected.not;
      if ('gt' in expected) return value > expected.gt;
    }
    return (value ?? null) === expected;
  });
}

function table(rows: Row[]) {
  return {
    rows,
    findMany: async ({ where }: Row) => rows.filter(row => matches(row, where)).map(row => ({ ...row })),
    findFirst: async ({ where }: Row) => [...rows].reverse().find(row => matches(row, where)) ?? null,
    findUnique: async ({ where }: Row) => rows.find(row => matches(row, where)) ?? null,
    updateMany: async ({ where, data }: Row) => {
      const hit = rows.filter(row => matches(row, where));
      hit.forEach(row => Object.assign(row, data));
      return { count: hit.length };
    },
    create: async ({ data }: Row) => { rows.push({ ...data, createdAt: new Date(Date.now() + rows.length) }); return data; },
  };
}

describe('Admin account suspension', () => {
  let app: INestApplication;
  let db: Record<string, ReturnType<typeof table>>;
  const prisma = { $transaction: jest.fn() };
  const auth = { validateAccessToken: jest.fn() };
  const patch = (id: string, body: object, token = 'admin') =>
    request(app.getHttpServer()).patch(`/admin/users/${id}/status`).set('Authorization', `Bearer ${token}`).send(body);

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AdminUsersController],
      providers: [AdminUsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuthService, useValue: auth },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });
  afterAll(() => app.close());

  beforeEach(() => {
    const listing = (id: string, status: string, ownerUserId = 'pro') => ({ id, status, ownerUserId, deletedAt: null });
    db = {
      user: table([
        { id: 'pro', role: 'hotel_manager', status: 'active', deletedAt: null },
        { id: 'admin-1', role: 'admin', status: 'active', deletedAt: null },
        { id: 'admin-2', role: 'admin', status: 'active', deletedAt: null },
        { id: 'gone', role: 'client', status: 'deleted', deletedAt: new Date() },
      ]),
      realEstateListing: table([listing('re-active', 'active'), listing('re-draft', 'draft'), listing('re-other', 'active', 'someone')]),
      hotelProperty: table([listing('hotel-active', 'active'), listing('hotel-already', 'suspended')]),
      vehicleListing: table([listing('car-active', 'active')]),
      tripListing: table([]),
      userSession: table([{ id: 's1', userId: 'pro', revokedAt: null }, { id: 's2', userId: 'admin-1', revokedAt: null }]),
      refreshToken: table([{ id: 'r1', userId: 'pro', revokedAt: null }]),
      auditLog: table([]),
    };
    prisma.$transaction.mockImplementation(async callback => callback(db));
    auth.validateAccessToken.mockImplementation(async token => {
      if (token === 'admin') return { id: 'admin-1', role: 'admin' };
      if (token === 'client') return { id: 'pro', role: 'client' };
      throw new UnauthorizedException('Authentification requise.');
    });
  });

  const status = (name: string, id: string) => db[name].rows.find(row => row.id === id)!.status;

  it('refuses anonymous callers and non-admin roles', async () => {
    await request(app.getHttpServer()).patch('/admin/users/pro/status').send({ status: 'suspended', reason: 'x' }).expect(401);
    await patch('pro', { status: 'suspended', reason: 'Fraude' }, 'client').expect(403);
    expect(status('user', 'pro')).toBe('active');
  });

  it('requires a reason and a known status', async () => {
    await patch('pro', { status: 'suspended' }).expect(400);
    await patch('pro', { status: 'suspended', reason: '   ' }).expect(400);
    await patch('pro', { status: 'deleted', reason: 'x' }).expect(400);
    await patch('pro', { status: 'suspended', reason: 'x', role: 'admin' }).expect(400);
    expect(status('user', 'pro')).toBe('active');
  });

  it('protects the acting admin, other admins and deleted accounts', async () => {
    await patch('admin-1', { status: 'suspended', reason: 'x' }).expect(403);
    await patch('admin-2', { status: 'suspended', reason: 'x' }).expect(403);
    await patch('gone', { status: 'active' }).expect(404);
    await patch('unknown', { status: 'suspended', reason: 'x' }).expect(404);
    expect(status('user', 'admin-2')).toBe('active');
  });

  it('suspends the account, its sessions and only its public listings', async () => {
    const response = await patch('pro', { status: 'suspended', reason: 'Fraude signalée' }).expect(200);
    expect(response.body).toEqual({ id: 'pro', status: 'suspended', listingsChanged: 3 });
    expect(status('user', 'pro')).toBe('suspended');
    expect(status('realEstateListing', 're-active')).toBe('suspended');
    expect(status('realEstateListing', 're-draft')).toBe('draft');
    expect(status('realEstateListing', 're-other')).toBe('active');
    expect(status('vehicleListing', 'car-active')).toBe('suspended');
    expect(db.userSession.rows.find(row => row.id === 's1')!.revokedAt).toBeInstanceOf(Date);
    expect(db.userSession.rows.find(row => row.id === 's2')!.revokedAt).toBeNull();
    expect(db.refreshToken.rows[0].revokedAt).toBeInstanceOf(Date);
    expect(db.auditLog.rows[0]).toMatchObject({ actorUserId: 'admin-1', action: 'account.suspended', targetId: 'pro',
      metadata: { reason: 'Fraude signalée', listings: { real_estate: ['re-active'], hotels: ['hotel-active'], vehicles: ['car-active'] } } });
    await patch('pro', { status: 'suspended', reason: 'Encore' }).expect(409);
  });

  it('reactivation restores only the listings withdrawn by the suspension and left untouched since', async () => {
    await patch('pro', { status: 'suspended', reason: 'Vérification' }).expect(200);
    // An admin refuses one of them while the account is suspended.
    db.vehicleListing.rows[0].status = 'refused';
    await db.auditLog.create({ data: { module: 'vehicles', targetType: 'listing', targetId: 'car-active', action: 'listing.refused' } });
    const response = await patch('pro', { status: 'active' }).expect(200);
    expect(response.body).toEqual({ id: 'pro', status: 'active', listingsChanged: 2 });
    expect(status('user', 'pro')).toBe('active');
    expect(status('realEstateListing', 're-active')).toBe('active');
    expect(status('hotelProperty', 'hotel-active')).toBe('active');
    expect(status('hotelProperty', 'hotel-already')).toBe('suspended');
    expect(status('vehicleListing', 'car-active')).toBe('refused');
    await patch('pro', { status: 'active' }).expect(409);
  });
});

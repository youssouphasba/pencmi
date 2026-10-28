import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import request = require('supertest');
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { RegisterDto } from './dto/register.dto';
import { PrismaService } from '../database/prisma/prisma.service';
import { PUBLIC_REGISTRATION_ROLES } from '../common/constants/roles';
import { UsersController } from '../modules/users/users.controller';
import { UsersService } from '../modules/users/users.service';
import { FilesService } from '../files/files.service';
import { AdminController } from '../modules/admin/admin.controller';
import { AdminService } from '../modules/admin/admin.service';

describe('Public registration security', () => {
  let app: INestApplication;
  let service: AuthService;
  const prisma = {
    user: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    userSession: { create: jest.fn(), findUnique: jest.fn() },
    refreshToken: { create: jest.fn() },
  };
  const jwt = { signAsync: jest.fn(), verifyAsync: jest.fn() };
  const admin = { overview: jest.fn() };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController, UsersController, AdminController],
      providers: [AuthService, UsersService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: { get: () => undefined, getOrThrow: () => 'test-only-secret' } },
        { provide: FilesService, useValue: {} },
        { provide: AdminService, useValue: admin },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    service = module.get(AuthService);
  });

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockImplementation(async ({ data }) => ({ id: 'created-user', ...data }));
    prisma.userSession.create.mockResolvedValue({ id: 'session' });
    jwt.signAsync.mockResolvedValue('test-token');
    jwt.verifyAsync.mockResolvedValue({ id: 'client-id', role: 'client' });
  });

  afterAll(async () => { await app.close(); });

  it.each(PUBLIC_REGISTRATION_ROLES)('allows public role %s', async (role) => {
    await request(app.getHttpServer()).post('/auth/register')
      .send({ role, email: 'registration@example.test', password: 'Test-password-123' }).expect(201);
    expect(prisma.user.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ role }) }));
    expect(jwt.signAsync).toHaveBeenCalledWith(expect.objectContaining({ role }), expect.anything());
  });

  it.each(['admin', 'ADMIN', 'unknown', null, ['admin'], { role: 'admin' }])('rejects invalid or privileged role %j', async (role) => {
    await request(app.getHttpServer()).post('/auth/register')
      .send({ role, email: 'registration@example.test', password: 'Test-password-123' }).expect(400);
    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });

  it('rejects admin even when DTO validation is bypassed', async () => {
    await expect(service.register({ role: 'admin', password: 'Test-password-123' } as unknown as RegisterDto)).rejects.toThrow();
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('rejects injected permissions at registration', async () => {
    await request(app.getHttpServer()).post('/auth/register').send({
      role: 'client', email: 'registration@example.test', password: 'Test-password-123', permissions: ['access_admin'],
    }).expect(400);
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('rejects a role change through the profile endpoint', async () => {
    await request(app.getHttpServer()).patch('/users/me').set('Authorization', 'Bearer test-token')
      .send({ role: 'admin' }).expect(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('does not mass-assign privileges in the profile service', async () => {
    await app.get(UsersService).updateProfile('client-id', { firstName: 'Client', role: 'admin' } as never);
    const data = prisma.user.update.mock.calls[0][0].data;
    expect(data.firstName).toBe('Client');
    expect(data).not.toHaveProperty('role');
  });

  it('denies admin access to clients', async () => {
    await request(app.getHttpServer()).get('/admin/overview').set('Authorization', 'Bearer test-token').expect(403);
    expect(admin.overview).not.toHaveBeenCalled();
  });

  it('preserves existing administrator login and access', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'existing-admin', role: 'admin', status: 'active', passwordHash: await bcrypt.hash('Test-password-123', 4) });
    await request(app.getHttpServer()).post('/auth/login')
      .send({ identifier: 'admin@example.test', password: 'Test-password-123' }).expect(201);
    expect(jwt.signAsync).toHaveBeenCalledWith(expect.objectContaining({ role: 'admin' }), expect.anything());
    jwt.verifyAsync.mockResolvedValue({ id: 'existing-admin', role: 'admin' });
    admin.overview.mockResolvedValue({});
    await request(app.getHttpServer()).get('/admin/overview').set('Authorization', 'Bearer test-token').expect(200);
  });
});

import { INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AccountStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import request = require('supertest');
import { PrismaService } from '../database/prisma/prisma.service';
import { AdminController } from '../modules/admin/admin.controller';
import { AdminService } from '../modules/admin/admin.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PermissionsGuard } from './guards/permissions.guard';

type TestUser = { id: string; role: UserRole; status: AccountStatus; deletedAt: Date | null; passwordHash: string };
type TestSession = { id: string; userId: string; revokedAt: Date | null; lastUsedAt?: Date };
type TestRefreshToken = { id: string; tokenHash: string; userId: string; sessionId: string; expiresAt: Date; revokedAt: Date | null };

describe('JWT session security', () => {
  const jwt = new JwtService();
  const config: Record<string, string> = {
    JWT_SECRET: 'test-only-access-secret-not-for-production',
    REFRESH_TOKEN_SECRET: 'test-only-refresh-secret-not-for-production',
    JWT_EXPIRES_IN: '2m', REFRESH_TOKEN_EXPIRES_IN: '2h',
  };
  let app: INestApplication;
  let service: AuthService;
  let passwordHash: string;
  let user: TestUser | null;
  let sessions: Map<string, TestSession>;
  let tokens: Map<string, TestRefreshToken>;
  const prisma = {
    user: { findFirst: jest.fn(), findUniqueOrThrow: jest.fn() },
    userSession: { findUnique: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
    refreshToken: { findUnique: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const admin = { overview: jest.fn() };
  const hash = (token: string) => createHash('sha256').update(token).digest('hex');

  async function signed(kind: 'access' | 'refresh', claims: Record<string, unknown> = {}) {
    return jwt.signAsync({ id: 'user-a', sessionId: 'session-a', role: 'client', ...claims }, {
      secret: kind === 'access' ? config.JWT_SECRET : config.REFRESH_TOKEN_SECRET,
      expiresIn: '5m', jwtid: randomUUID(),
    });
  }

  function store(token: string, overrides: Partial<TestRefreshToken> = {}) {
    const claims = jwt.decode<{ id: string; sessionId: string; exp: number }>(token);
    const row = { id: randomUUID(), tokenHash: hash(token), userId: claims.id, sessionId: claims.sessionId,
      expiresAt: new Date(claims.exp * 1000), revokedAt: null, ...overrides };
    tokens.set(hash(token), row);
    return row;
  }

  beforeAll(async () => {
    passwordHash = await bcrypt.hash('Test-password-123', 4);
    const module = await Test.createTestingModule({
      controllers: [AuthController, AdminController],
      providers: [AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: { get: (key: string) => config[key], getOrThrow: (key: string) => config[key] } },
        { provide: AdminService, useValue: admin },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();
    service = module.get(AuthService);
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    user = { id: 'user-a', role: 'client', status: 'active', deletedAt: null, passwordHash };
    sessions = new Map([
      ['session-a', { id: 'session-a', userId: 'user-a', revokedAt: null }],
      ['session-b', { id: 'session-b', userId: 'user-b', revokedAt: null }],
    ]);
    tokens = new Map();
    prisma.user.findFirst.mockImplementation(async () => user?.deletedAt ? null : user);
    prisma.user.findUniqueOrThrow.mockImplementation(async () => user);
    prisma.userSession.findUnique.mockImplementation(async ({ where }) => {
      const session = sessions.get(where.id);
      return session ? { ...session, user } : null;
    });
    prisma.userSession.create.mockImplementation(async ({ data }) => {
      const session = { id: randomUUID(), ...data, revokedAt: null };
      sessions.set(session.id, session);
      return session;
    });
    prisma.userSession.updateMany.mockImplementation(async ({ where, data }) => {
      const session = sessions.get(where.id);
      if (!session || session.userId !== where.userId || session.revokedAt
        || (where.user && (!user || user.status !== 'active' || user.deletedAt))) return { count: 0 };
      Object.assign(session, data);
      return { count: 1 };
    });
    prisma.refreshToken.findUnique.mockImplementation(async ({ where }) => tokens.get(where.tokenHash) ?? null);
    prisma.refreshToken.create.mockImplementation(async ({ data }) => {
      if (tokens.has(data.tokenHash)) throw new Error('Duplicate token hash');
      const token = { id: randomUUID(), ...data, revokedAt: null };
      tokens.set(data.tokenHash, token);
      return token;
    });
    prisma.refreshToken.updateMany.mockImplementation(async ({ where, data }) => {
      let count = 0;
      for (const token of tokens.values()) {
        if (token.sessionId === where.sessionId && token.userId === where.userId && !token.revokedAt) {
          Object.assign(token, data);
          count++;
        }
      }
      return { count };
    });
    prisma.$transaction.mockImplementation(async (callback) => {
      const oldSessions = structuredClone(sessions);
      const oldTokens = structuredClone(tokens);
      try { return await callback(prisma); }
      catch (error) { sessions = oldSessions; tokens = oldTokens; throw error; }
    });
    admin.overview.mockResolvedValue({ allowed: true });
  });

  afterAll(async () => { await app.close(); });

  it('accepts an active user with a valid session and returns only the current identity', async () => {
    const result = await service.validateAccessToken(await signed('access', { role: 'admin', permissions: ['access_admin'] }));
    expect(result).toEqual({ id: 'user-a', role: 'client', sessionId: 'session-a' });
  });

  it.each(['suspended', 'deleted', 'pending_verification'] as const)('rejects access for account status %s', async (status) => {
    user!.status = status;
    await expect(service.validateAccessToken(await signed('access'))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it.each(['missing-user', 'soft-deleted-user', 'missing-session', 'revoked-session', 'foreign-session'])('rejects access with %s', async (scenario) => {
    if (scenario === 'missing-user') user = null;
    if (scenario === 'soft-deleted-user') user!.deletedAt = new Date();
    if (scenario === 'missing-session') sessions.delete('session-a');
    if (scenario === 'revoked-session') sessions.get('session-a')!.revokedAt = new Date();
    if (scenario === 'foreign-session') sessions.get('session-a')!.userId = 'user-b';
    await expect(service.validateAccessToken(await signed('access'))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it.each([
    { sessionId: undefined }, { sessionId: '' }, { sessionId: 12 }, { sessionId: '   ' },
    { id: undefined }, { id: '' }, { id: ['user-a'] },
  ])('rejects malformed access claims %#', async (claims) => {
    await expect(service.validateAccessToken(await signed('access', claims))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.userSession.findUnique).not.toHaveBeenCalled();
  });

  it('rejects access without expiration', async () => {
    const token = await jwt.signAsync({ id: 'user-a', sessionId: 'session-a' }, { secret: config.JWT_SECRET });
    await expect(service.validateAccessToken(token)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects expired and incorrectly signed access tokens', async () => {
    for (const options of [{ secret: config.JWT_SECRET, expiresIn: -1 }, { secret: 'incorrect-test-secret', expiresIn: 300 }]) {
      const token = await jwt.signAsync({ id: 'user-a', sessionId: 'session-a' }, options);
      await expect(service.validateAccessToken(token)).rejects.toBeInstanceOf(UnauthorizedException);
    }
  });

  it('removes old administrator privileges through the real permissions guard', async () => {
    const token = await signed('access', { role: 'admin' });
    await request(app.getHttpServer()).get('/admin/overview').set('Authorization', `Bearer ${token}`).expect(403);
    expect(admin.overview).not.toHaveBeenCalled();
  });

  it('preserves administrator access when the database account is currently admin', async () => {
    user!.role = 'admin';
    await request(app.getHttpServer()).get('/admin/overview').set('Authorization', `Bearer ${await signed('access')}`).expect(200);
  });

  it('accepts legitimate refresh and signs tokens with the current database role', async () => {
    const old = await signed('refresh', { role: 'admin' });
    store(old);
    const result = await service.refresh(old);
    const claims = await jwt.verifyAsync(result.accessToken, { secret: config.JWT_SECRET });
    expect(claims).toMatchObject({ id: 'user-a', role: 'client', sessionId: 'session-a' });
    expect(result.tokenType).toBe('Bearer');
    expect(sessions.get('session-a')!.lastUsedAt).toBeInstanceOf(Date);
  });

  it.each(['revoked', 'expired', 'foreign-user', 'foreign-session', 'unregistered'])('rejects refresh record %s', async (scenario) => {
    const token = await signed('refresh');
    const row = store(token);
    if (scenario === 'revoked') row.revokedAt = new Date();
    if (scenario === 'expired') row.expiresAt = new Date(Date.now() - 1000);
    if (scenario === 'foreign-user') row.userId = 'user-b';
    if (scenario === 'foreign-session') row.sessionId = 'session-b';
    if (scenario === 'unregistered') tokens.clear();
    await expect(service.refresh(token)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it.each(['suspended', 'deleted', 'pending_verification'] as const)('rejects refresh for account status %s', async (status) => {
    const token = await signed('refresh');
    store(token);
    user!.status = status;
    await expect(service.refresh(token)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it.each(['missing-user', 'soft-deleted-user', 'revoked-session', 'missing-session', 'foreign-session'])('rejects refresh with %s', async (scenario) => {
    const token = await signed('refresh');
    store(token);
    if (scenario === 'missing-user') user = null;
    if (scenario === 'soft-deleted-user') user!.deletedAt = new Date();
    if (scenario === 'revoked-session') sessions.get('session-a')!.revokedAt = new Date();
    if (scenario === 'missing-session') sessions.delete('session-a');
    if (scenario === 'foreign-session') sessions.get('session-a')!.userId = 'user-b';
    await expect(service.refresh(token)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it.each([{ id: undefined }, { id: '' }, { sessionId: undefined }, { sessionId: '' }, { sessionId: 42 }])('rejects malformed refresh claims %#', async (claims) => {
    await expect(service.refresh(await signed('refresh', claims))).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects invalid signatures, expired refresh tokens and refresh tokens without expiration', async () => {
    const payload = { id: 'user-a', sessionId: 'session-a' };
    const invalid = [
      await jwt.signAsync(payload, { secret: 'incorrect-test-secret', expiresIn: 300 }),
      await jwt.signAsync(payload, { secret: config.REFRESH_TOKEN_SECRET, expiresIn: -1 }),
      await jwt.signAsync(payload, { secret: config.REFRESH_TOKEN_SECRET }),
    ];
    for (const token of invalid) await expect(service.refresh(token)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not interchange access and refresh signatures', async () => {
    await expect(service.refresh(await signed('access'))).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.validateAccessToken(await signed('refresh'))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuses refresh when the session is revoked before the conditional lock', async () => {
    const token = await signed('refresh');
    store(token);
    prisma.userSession.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.refresh(token)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('logs out only the authenticated session and invalidates its tokens', async () => {
    const accessToken = await signed('access');
    const refreshToken = await signed('refresh');
    store(refreshToken);
    const otherToken = await signed('refresh', { id: 'user-b', sessionId: 'session-b' });
    store(otherToken);
    await request(app.getHttpServer()).post('/auth/logout').set('Authorization', `Bearer ${accessToken}`)
      .send({ userId: 'user-b', sessionId: 'session-b' }).expect(201, { revoked: true });
    expect(sessions.get('session-a')!.revokedAt).toBeInstanceOf(Date);
    expect(tokens.get(hash(refreshToken))!.revokedAt).toBeInstanceOf(Date);
    expect(sessions.get('session-b')!.revokedAt).toBeNull();
    expect(tokens.get(hash(otherToken))!.revokedAt).toBeNull();
    await expect(service.validateAccessToken(accessToken)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.refresh(refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    await request(app.getHttpServer()).post('/auth/logout').set('Authorization', `Bearer ${accessToken}`).expect(401);
  });

  it('rejects attempts to revoke another user’s session', async () => {
    await expect(service.logout('user-a', 'session-b')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.userSession.updateMany).not.toHaveBeenCalled();
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('keeps service logout idempotent for an already revoked owned session', async () => {
    sessions.get('session-a')!.revokedAt = new Date();
    await expect(service.logout('user-a', 'session-a')).resolves.toEqual({ revoked: true });
  });

  it('uses one transaction for session and token revocation', async () => {
    prisma.refreshToken.updateMany.mockRejectedValueOnce(new Error('Simulated write failure'));
    await expect(service.logout('user-a', 'session-a')).rejects.toThrow('Simulated write failure');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(sessions.get('session-a')!.revokedAt).toBeNull();
  });

  it('preserves login and refresh response contracts and configured lifetimes', async () => {
    const login = await request(app.getHttpServer()).post('/auth/login')
      .send({ identifier: 'user@example.test', password: 'Test-password-123' }).expect(201);
    expect(Object.keys(login.body).sort()).toEqual(['accessToken', 'refreshToken', 'tokenType']);
    const access = jwt.decode<{ iat: number; exp: number }>(login.body.accessToken);
    const refresh = jwt.decode<{ iat: number; exp: number }>(login.body.refreshToken);
    expect(access.exp - access.iat).toBe(120);
    expect(refresh.exp - refresh.iat).toBe(7200);
    expect(tokens.get(hash(login.body.refreshToken))!.expiresAt.getTime()).toBe(refresh.exp * 1000);
    const renewed = await request(app.getHttpServer()).post('/auth/refresh').send({ refreshToken: login.body.refreshToken }).expect(201);
    expect(Object.keys(renewed.body).sort()).toEqual(['accessToken', 'refreshToken', 'tokenType']);
    await expect(service.validateAccessToken(renewed.body.accessToken)).resolves.toMatchObject({ id: 'user-a', role: 'client' });
  });

  it('creates distinct refresh hashes even for consecutive renewals', async () => {
    const token = await signed('refresh');
    store(token);
    const first = await service.refresh(token);
    const second = await service.refresh(token);
    expect(first.refreshToken).not.toBe(second.refreshToken);
    expect(tokens.has(hash(first.refreshToken))).toBe(true);
    expect(tokens.has(hash(second.refreshToken))).toBe(true);
  });
});

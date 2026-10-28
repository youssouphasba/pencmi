import { ExecutionContext, INestApplication, Logger, RequestMethod, UnauthorizedException, ValidationPipe, VersioningType } from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { createHash } from 'crypto';
import request = require('supertest');
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuthService } from '../../auth/auth.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { ApiResponseInterceptor } from '../../common/interceptors/api-response.interceptor';
import { HotelIntegrationsService } from './hotel-integrations.service';
import { CreateHotelApiKeyDto } from './hotel-integrations.dto';
import { HOTEL_PARTNER_PERMISSIONS } from './hotel-partner-auth';
import { HotelPartnerGuard } from './hotel-partner.guard';
import { HotelIntegrationsController } from './hotel-integrations.controller';
import { HotelPartnerController } from './hotel-partner.controller';

describe('Hotel partner security', () => {
  let app: INestApplication;
  let service: HotelIntegrationsService;
  const rawKey = `pencmi_${'a'.repeat(64)}`;
  const partner = { integrationId: 'integration-a', propertyId: 'property-a' };
  const property = { name: 'Hotel', propertyType: 'hotel', city: 'Dakar', region: 'Dakar' };
  const path = '/api/hotel-partner/v1/property/external-a';
  const prisma = {
    hotelApiKey: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
    hotelIntegration: { upsert: jest.fn() },
    hotelExternalMapping: { findFirst: jest.fn() },
    hotelProperty: { findFirst: jest.fn(), update: jest.fn() },
    hotelWebhook: { create: jest.fn() },
  };
  const auth = { validateAccessToken: jest.fn() };
  let warn: jest.SpyInstance;

  function validKey(overrides: Record<string, unknown> = {}) {
    return {
      id: 'key-a', active: true, revokedAt: null,
      permissions: ['hotel.property.read', 'hotel.property.write', 'hotel.requests.read'],
      integration: { id: partner.integrationId, propertyId: partner.propertyId, status: 'active', property: { deletedAt: null } },
      ...overrides,
    };
  }

  beforeAll(async () => {
    const testModule = await Test.createTestingModule({
      controllers: [HotelIntegrationsController, HotelPartnerController],
      providers: [HotelIntegrationsService, HotelPartnerGuard,
        { provide: PrismaService, useValue: prisma },
        { provide: AuthService, useValue: auth },
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: PermissionsGuard },
      ],
    }).compile();
    service = testModule.get(HotelIntegrationsService);
    app = testModule.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: [{ path: 'api/hotel-partner/v1/(.*)', method: RequestMethod.ALL }] });
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    await app.init();
  });

  beforeEach(() => {
    jest.resetAllMocks();
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    prisma.hotelApiKey.findUnique.mockResolvedValue(validKey());
    prisma.hotelApiKey.update.mockResolvedValue({ id: 'key-a' });
    prisma.hotelExternalMapping.findFirst.mockImplementation(async ({ where }) =>
      where.integrationId === partner.integrationId && where.externalId === 'external-a' ? { internalId: partner.propertyId } : null);
    prisma.hotelProperty.findFirst.mockResolvedValue(property);
    prisma.hotelProperty.update.mockResolvedValue(property);
    auth.validateAccessToken.mockImplementation(async (token) => {
      if (token !== 'owner-jwt') throw new UnauthorizedException();
      return { id: 'owner-a', role: 'hotel_manager' };
    });
  });
  afterEach(() => { warn.mockRestore(); });
  afterAll(async () => { await app.close(); });

  it.each(['get', 'put'] as const)('rejects %s without an API key', async (method) => {
    await request(app.getHttpServer())[method](path).send(property).expect(401);
    expect(prisma.hotelProperty.update).not.toHaveBeenCalled();
  });

  it('rejects an unknown key without logging it', async () => {
    prisma.hotelApiKey.findUnique.mockResolvedValue(null);
    await request(app.getHttpServer()).get(path).set('X-API-Key', rawKey).expect(401);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(rawKey);
    expect(prisma.hotelApiKey.update).not.toHaveBeenCalled();
  });

  it.each([
    { revokedAt: new Date() }, { active: false },
    { integration: { ...validKey().integration, status: 'inactive' } },
    { integration: { ...validKey().integration, status: 'unexpected' } },
    { integration: { ...validKey().integration, property: { deletedAt: new Date() } } },
  ])('rejects unavailable keys and integrations %#', async (override) => {
    prisma.hotelApiKey.findUnique.mockResolvedValue(validKey(override));
    await request(app.getHttpServer()).get(path).set('X-API-Key', rawKey).expect(401);
    expect(prisma.hotelExternalMapping.findFirst).not.toHaveBeenCalled();
    expect(prisma.hotelApiKey.update).not.toHaveBeenCalled();
  });

  it.each([
    ['get', ['hotel.property.write']], ['put', ['hotel.property.read']],
  ] as const)('rejects %s without the required permission', async (method, permissions) => {
    prisma.hotelApiKey.findUnique.mockResolvedValue(validKey({ permissions }));
    await request(app.getHttpServer())[method](path).set('X-API-Key', rawKey).send(property).expect(403);
    expect(prisma.hotelExternalMapping.findFirst).not.toHaveBeenCalled();
  });

  it('does not accept JWT as partner authentication', async () => {
    await request(app.getHttpServer()).get(path).set('Authorization', 'Bearer owner-jwt').expect(401);
    expect(auth.validateAccessToken).not.toHaveBeenCalled();
  });

  it('denies a future operation without an explicit permission declaration', async () => {
    const guard = new HotelPartnerGuard(prisma as unknown as PrismaService, new Reflector());
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ headers: { 'x-api-key': rawKey } }) }),
      getHandler: () => function undeclaredOperation() {},
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(context)).rejects.toThrow('Opération partenaire non autorisée.');
  });

  it('returns no property data when the bound establishment is unavailable', async () => {
    prisma.hotelProperty.findFirst.mockResolvedValue(null);
    await request(app.getHttpServer()).get(path).set('X-API-Key', rawKey).expect(404);
  });

  it.each(['get', 'put'] as const)('rejects %s using a mapping belonging to another integration', async (method) => {
    await request(app.getHttpServer())[method]('/api/hotel-partner/v1/property/external-b')
      .set('X-API-Key', rawKey).send(property).expect(404);
    expect(prisma.hotelExternalMapping.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { integrationId: partner.integrationId, entityType: 'property', externalId: 'external-b' },
    }));
    expect(prisma.hotelProperty.update).not.toHaveBeenCalled();
  });

  it.each(['get', 'put'] as const)('rejects %s when a mapping points to another property', async (method) => {
    prisma.hotelExternalMapping.findFirst.mockResolvedValue({ internalId: 'property-b' });
    await request(app.getHttpServer())[method](path).set('X-API-Key', rawKey).send(property).expect(404);
    expect(prisma.hotelProperty.update).not.toHaveBeenCalled();
  });

  it.each(['get', 'put'] as const)('allows scoped %s with a valid key and safe response', async (method) => {
    const response = await request(app.getHttpServer())[method](path).set('X-API-Key', rawKey).send(property).expect(200);
    expect(response.body.data).toEqual({ externalPropertyId: 'external-a', ...property });
    expect(prisma.hotelApiKey.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { keyHash: createHash('sha256').update(rawKey).digest('hex') },
    }));
    expect(prisma.hotelApiKey.update).toHaveBeenCalledWith(expect.objectContaining({ data: { lastUsedAt: expect.any(Date) } }));
    const operation = method === 'get' ? prisma.hotelProperty.findFirst : prisma.hotelProperty.update;
    expect(operation).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: partner.propertyId, deletedAt: null, integration: { id: partner.integrationId, status: 'active' } },
      select: { name: true, propertyType: true, city: true, region: true },
    }));
  });

  it.each(['ownerUserId', 'status', 'permissions', 'contactSettings', 'id', 'keyHash', 'deletedAt'])('rejects sensitive PUT field %s', async (field) => {
    await request(app.getHttpServer()).put(path).set('X-API-Key', rawKey).send({ ...property, [field]: 'injected' }).expect(400);
    expect(prisma.hotelProperty.update).not.toHaveBeenCalled();
  });

  it('whitelists fields even when service DTO validation is bypassed', async () => {
    await service.partnerUpsertProperty(partner, 'external-a', { ...property, ownerUserId: 'attacker' } as never);
    expect(prisma.hotelProperty.update.mock.calls[0][0].data).toEqual(property);
  });

  it('disables events and still requires authentication', async () => {
    await request(app.getHttpServer()).get('/api/hotel-partner/v1/events').expect(401);
    await request(app.getHttpServer()).get('/api/hotel-partner/v1/events').set('X-API-Key', rawKey).expect(501);
  });

  it('does not allow an API key to replace dashboard JWT authentication', async () => {
    await request(app.getHttpServer()).get('/api/v1/dashboard/hotels/integrations/property-a').set('X-API-Key', rawKey).expect(401);
  });

  it('preserves owner access while excluding stored credential hashes', async () => {
    prisma.hotelIntegration.upsert.mockResolvedValue({ id: partner.integrationId, apiKeys: [], webhooks: [] });
    await request(app.getHttpServer()).get('/api/v1/dashboard/hotels/integrations/property-a')
      .set('Authorization', 'Bearer owner-jwt').expect(200);
    const query = prisma.hotelIntegration.upsert.mock.calls[0][0];
    expect(query.include.apiKeys.select).not.toHaveProperty('keyHash');
    expect(query.include.webhooks.select).not.toHaveProperty('secretHash');
  });

  it('denies dashboard access to another owner', async () => {
    prisma.hotelProperty.findFirst.mockResolvedValue(null);
    await request(app.getHttpServer()).get('/api/v1/dashboard/hotels/integrations/property-b')
      .set('Authorization', 'Bearer owner-jwt').expect(403);
    expect(prisma.hotelIntegration.upsert).not.toHaveBeenCalled();
  });

  it.each([{ permissions: [] }, { permissions: ['invalid'] }, { permissions: ['hotel.property.read', 'access_admin'] }])('rejects unsupported key permissions %j', async ({ permissions }) => {
    await request(app.getHttpServer()).post('/api/v1/dashboard/hotels/integrations/property-a/api-keys')
      .set('Authorization', 'Bearer owner-jwt').send({ name: 'Partner', permissions }).expect(400);
    expect(prisma.hotelApiKey.create).not.toHaveBeenCalled();
  });

  it('creates keys as hashes, never returning hashes or activating integrations', async () => {
    prisma.hotelIntegration.upsert.mockResolvedValue({ id: partner.integrationId });
    prisma.hotelApiKey.create.mockResolvedValue({ id: 'new-key', name: 'Partner', permissions: [...HOTEL_PARTNER_PERMISSIONS] });
    const response = await request(app.getHttpServer()).post('/api/v1/dashboard/hotels/integrations/property-a/api-keys')
      .set('Authorization', 'Bearer owner-jwt').send({ name: 'Partner', permissions: [...HOTEL_PARTNER_PERMISSIONS] }).expect(201);
    const query = prisma.hotelApiKey.create.mock.calls[0][0];
    expect(query.data.keyHash).toBe(createHash('sha256').update(response.body.data.key).digest('hex'));
    expect(query.data).not.toHaveProperty('key');
    expect(response.body.data).not.toHaveProperty('keyHash');
    expect(query.select).not.toHaveProperty('keyHash');
    expect(prisma.hotelIntegration.upsert.mock.calls[0][0].update).toEqual({});
  });

  it('validates permissions inside the service as well', async () => {
    await expect(service.createApiKey('owner-a', 'property-a', { name: 'Partner', permissions: ['access_admin'] } as unknown as CreateHotelApiKeyDto)).rejects.toThrow();
    expect(prisma.hotelApiKey.create).not.toHaveBeenCalled();
  });

  it('excludes webhook hashes from creation responses', async () => {
    prisma.hotelIntegration.upsert.mockResolvedValue({ id: partner.integrationId });
    prisma.hotelWebhook.create.mockResolvedValue({ id: 'webhook-a' });
    const result = await service.createWebhook('owner-a', 'property-a', { url: 'https://example.test/webhook', events: [] });
    expect(result).not.toHaveProperty('secretHash');
    expect(prisma.hotelWebhook.create.mock.calls[0][0].select).not.toHaveProperty('secretHash');
  });
});

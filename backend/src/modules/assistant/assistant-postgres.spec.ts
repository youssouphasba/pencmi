import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaClient, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import request = require('supertest');
import { ApiResponseInterceptor } from '../../common/interceptors/api-response.interceptor';
import { AllExceptionsFilter } from '../../common/filters/all-exceptions.filter';
import { createTestPassword, createTestSecret } from '../../common/testing/test-credentials.fixture';
import { PrismaService } from '../../database/prisma/prisma.service';
import { ASSISTANT_TOOLS, modelTools } from './assistant.catalog';

const target = process.env.TEST_DATABASE_URL;
(target ? describe : describe.skip)('Assistant: real isolated PostgreSQL and API, controlled model', () => {
  let db: PrismaClient, app: INestApplication, config: ConfigService;
  type Actor = { id: string; token: string };
  let client: Actor, other: Actor, admin: Actor, agency: Actor, hotel: Actor, car: Actor, transport: Actor;
  let listing: string;
  const ids: string[] = [];
  const realFetch = global.fetch;
  let tool: { name: string; args: unknown } | undefined;
  let calls = 0, fail = false, lastPrompt = '';
  const http = () => request(app.getHttpServer());
  const auth = (actor: Actor) => ({ Authorization: `Bearer ${actor.token}` });
  const chat = (actor: Actor = client, message = 'Veuillez effectuer cette opération.') => http().post('/api/v1/assistant/chat').set(auth(actor)).send({ message, consent: true });
  async function proposal(name: string, args: unknown, actor = client) {
    tool = { name, args };
    return (await chat(actor).expect(201)).body.data;
  }
  const confirm = (p: any, actor = client) => http().post('/api/v1/assistant/confirm').set(auth(actor)).send({ confirmation: p.confirmation, approved: true });
  beforeAll(async () => {
    const url = new URL(target!);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !url.pathname.endsWith('_test')) throw Error('Isolated loopback database required');
    db = new PrismaClient({ datasources: { db: { url: target } } });
    const vars = { DATABASE_URL: target!, NODE_ENV: 'test', JWT_SECRET: createTestSecret(), REFRESH_TOKEN_SECRET: createTestSecret(), COOKIE_SECRET: createTestSecret(),
      DEEPSEEK_API_KEY: createTestSecret(), ASSISTANT_ENABLED: 'true', ASSISTANT_ROLES: 'client,admin,real_estate_agency,hotel_manager,vehicle_renter,transport_provider',
      ASSISTANT_BUDGET_CENTS: 200, API_PREFIX: 'api/v1', SAVED_ALERTS_PROCESSOR_ENABLED: 'false', HOTEL_SYNC_PROCESSOR_ENABLED: 'false' };
    const previous = Object.fromEntries(Object.keys(vars).map(key => [key, process.env[key]]));
    for (const [key, value] of Object.entries(vars)) process.env[key] = String(value);
    try {
      const { AppModule } = await import('../../app.module');
      config = new ConfigService(vars);
      const mod = await Test.createTestingModule({ imports: [AppModule] }).overrideProvider(PrismaService).useValue(db).overrideProvider(ConfigService).useValue(config).compile();
      app = mod.createNestApplication({ logger: false });
      app.setGlobalPrefix('api/v1');
      app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
      app.useGlobalInterceptors(new ApiResponseInterceptor());
      app.useGlobalFilters(new AllExceptionsFilter());
      await app.listen(0, '127.0.0.1');
      config.set('PORT', app.getHttpServer().address().port);
    } finally {
      for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    }
    async function actor(role: UserRole) {
      const id = randomUUID(); ids.push(id);
      const password = createTestPassword(), identifier = `${id}@example.test`;
      await db.user.create({ data: { id, role, email: identifier, passwordHash: await bcrypt.hash(password, 4) } });
      const { body } = await http().post('/api/v1/auth/login').send({ identifier, password }).expect(201);
      return { id, token: body.data.accessToken };
    }
    client = await actor('client'); other = await actor('client'); admin = await actor('admin'); agency = await actor('real_estate_agency');
    hotel = await actor('hotel_manager'); car = await actor('vehicle_renter'); transport = await actor('transport_provider');
    listing = (await db.realEstateListing.create({ data: { ownerUserId: agency.id, title: 'Fixture', slug: randomUUID(), city: 'Dakar', status: 'active' } })).id;
    global.fetch = jest.fn(async (url: any, options: any) => {
      if (String(url) !== 'https://api.deepseek.com/chat/completions') return realFetch(url, options);
      calls++; lastPrompt = options.body;
      if (fail) return new Response('{}', { status: 503 });
      return Response.json({ choices: [{ finish_reason: 'stop', message: tool ? { tool_calls: [{ function: { name: tool.name, arguments: JSON.stringify(tool.args) } }] } : { content: 'Quelle ville souhaitez-vous ?' } }] });
    }) as typeof fetch;
  }, 60000);
  beforeEach(async () => {
    fail = false; calls = 0; tool = undefined;
    config.set('ASSISTANT_ENABLED', 'true'); config.set('ASSISTANT_BUDGET_CENTS', 200);
    await db.auditLog.deleteMany({ where: { actorUserId: { in: ids }, action: 'assistant.budget_reserved' } });
    // Reset the HTTP limiter between independent scenarios, not between requests within a scenario.
    const storage = app.get(require('@nestjs/throttler').ThrottlerStorage);
    if (storage.storage?.clear) storage.storage.clear();
  });
  afterAll(async () => {
    global.fetch = realFetch;
    if (db) {
      await db.favorite.deleteMany({ where: { userId: { in: ids } } });
      await db.supportTicket.deleteMany({ where: { userId: { in: ids } } });
      await db.realEstateListing.deleteMany({ where: { ownerUserId: { in: ids } } });
      await db.hotelProperty.deleteMany({ where: { ownerUserId: { in: ids } } });
      await db.vehicleListing.deleteMany({ where: { ownerUserId: { in: ids } } });
      await db.tripListing.deleteMany({ where: { ownerUserId: { in: ids } } });
      await db.auditLog.deleteMany({ where: { actorUserId: { in: ids } } });
      await db.user.deleteMany({ where: { id: { in: ids } } });
    }
    await app?.close(); await db?.$disconnect();
  });
  it('requires authentication, explicit consent and activation before any paid call', async () => {
    await http().post('/api/v1/assistant/chat').send({ message: 'Bonjour', consent: true }).expect(401);
    await http().post('/api/v1/assistant/chat').set(auth(client)).send({ message: 'Bonjour', consent: false }).expect(400);
    config.set('ASSISTANT_ENABLED', 'false'); await chat().expect(503);
    expect(calls).toBe(0);
  });
  it('reads real public search results without sending database records or bearer credentials to the model', async () => {
    tool = { name: 'search', args: { module: 'real_estate', filters: { city: 'Dakar' } } };
    const { body } = await chat().expect(201);
    expect(JSON.stringify(body.data.result)).toContain(listing);
    expect(lastPrompt).not.toContain(listing);
    expect(lastPrompt).not.toContain(client.token);
    expect(JSON.parse(lastPrompt).thinking).toEqual({ type: 'disabled' });
  });
  it('requires signed confirmation bound to the user and session; double confirmation executes once', async () => {
    const p = await proposal('add_favorite', { module: 'real_estate', id: listing });
    expect(await db.favorite.count({ where: { userId: client.id } })).toBe(0);
    await confirm(p, other).expect(403);
    await confirm({ ...p, confirmation: p.confirmation + 'a' }).expect(400);
    const results = await Promise.all([confirm(p), confirm(p)]);
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    expect(await db.favorite.count({ where: { userId: client.id } })).toBe(1);
  });
  it('refuses unknown tools, privilege escalation and arbitrary fields', async () => {
    tool = { name: 'admin_queue', args: {} }; await chat().expect(403);
    tool = { name: 'constructor', args: {} }; await chat().expect(400);
    tool = { name: 'draft', args: { module: 'hotels', title: 'Fixture', description: 'Fixture', ownerUserId: other.id } }; await chat().expect(400);
    tool = { name: 'draft', args: { module: 'hotels', title: 'Fixture', description: 'Fixture' } }; await chat().expect(403);
  });
  it.each(['real_estate', 'hotels', 'vehicles', 'trips'])('creates a real %s draft after confirmation', async module => {
    const actor = { real_estate: agency, hotels: hotel, vehicles: car, trips: transport }[module]!;
    const p = await proposal('draft', { module, title: 'Fixture', description: 'Fixture', ...(module === 'vehicles' ? { vehicleMode: 'rental' } : {}) }, actor);
    const result = await confirm(p, actor).expect(201);
    expect(result.body.data.result.data.status).toBe('draft');
  });
  it('preserves backend ownership and validation on submission', async () => {
    const p = await proposal('submit', { module: 'real_estate', id: listing }, agency);
    const result = await confirm(p, agency);
    expect([400, 409]).toContain(result.status);
    expect((await db.realEstateListing.findUniqueOrThrow({ where: { id: listing } })).status).toBe('active');
  });
  it('persists a support ticket only after approval', async () => {
    const p = await proposal('create_ticket', { subject: 'Fixture', body: 'Fixture' });
    await confirm(p).expect(201);
    expect(await db.supportTicket.count({ where: { userId: client.id } })).toBe(1);
    await confirm(p).expect(409);
  });
  it('refuses another professional owner even with a valid confirmation', async () => {
    const foreign = await db.realEstateListing.create({ data: { ownerUserId: hotel.id, title: 'Fixture', city: 'Dakar', slug: randomUUID(), status: 'draft' } });
    const p = await proposal('submit', { module: 'real_estate', id: foreign.id }, agency);
    const result = await confirm(p, agency);
    expect([403, 404]).toContain(result.status);
    expect((await db.realEstateListing.findUniqueOrThrow({ where: { id: foreign.id } })).status).toBe('draft');
  });
  it('refuses confirmation after session revocation without writing a ticket', async () => {
    const p = await proposal('create_ticket', { subject: 'Fixture', body: 'Fixture' }, other);
    await db.userSession.updateMany({ where: { userId: other.id }, data: { revokedAt: new Date() } });
    await confirm(p, other).expect(401);
    expect(await db.supportTicket.count({ where: { userId: other.id } })).toBe(0);
  });
  it('serializes budget reservations, retains them after a provider error and blocks subsequent calls', async () => {
    config.set('ASSISTANT_BUDGET_CENTS', 5); fail = true;
    const results = await Promise.all([chat(), chat()]);
    expect(results.map(r => r.status).sort()).toEqual([429, 503]);
    expect(calls).toBe(1);
    fail = false; await chat().expect(429);
    expect(calls).toBe(1);
  });
  it('has bounded schemas and no arbitrary endpoint, command or SQL tool', () => {
    expect(Buffer.byteLength(JSON.stringify(modelTools('admin')))).toBeLessThan(36000);
    expect(Object.keys(ASSISTANT_TOOLS)).not.toEqual(expect.arrayContaining(['sql', 'shell', 'http']));
  });
});

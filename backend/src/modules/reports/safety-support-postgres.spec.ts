import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { PrismaClient, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import request = require('supertest');
import { ApiResponseInterceptor } from '../../common/interceptors/api-response.interceptor';
import { createTestPassword, createTestSecret } from '../../common/testing/test-credentials.fixture';
import { PrismaService } from '../../database/prisma/prisma.service';

const target = process.env.TEST_DATABASE_URL;
(target ? describe : describe.skip)('Report and support permissions over HTTP and isolated PostgreSQL', () => {
  let db: PrismaClient, app: INestApplication;
  type Actor = { id: string; token: string };
  let client: Actor, owner: Actor, stranger: Actor, admin: Actor;
  let listing: string, conversation: string, message: string;
  const ids: string[] = [];
  const http = () => request(app.getHttpServer());
  const auth = (actor: Actor) => ({ Authorization: `Bearer ${actor.token}` });
  beforeAll(async () => {
    const url = new URL(target!);
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.endsWith('_test')) throw Error('Isolated loopback database required');
    db = new PrismaClient({ datasources: { db: { url: target } } });
    const config = { DATABASE_URL: target!, NODE_ENV: 'test', JWT_SECRET: createTestSecret(),
      REFRESH_TOKEN_SECRET: createTestSecret(), COOKIE_SECRET: createTestSecret(), SAVED_ALERTS_PROCESSOR_ENABLED: 'false' };
    const previous = Object.fromEntries(Object.keys(config).map(key => [key, process.env[key]]));
    Object.assign(process.env, config);
    try {
      const { AppModule } = await import('../../app.module');
      const module = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(PrismaService).useValue(db)
        .overrideProvider(ConfigService).useValue(new ConfigService(config)).compile();
      app = module.createNestApplication({ logger: false });
      app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
      app.useGlobalInterceptors(new ApiResponseInterceptor());
      await app.init();
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
    async function actor(role: UserRole): Promise<Actor> {
      const id = randomUUID(); ids.push(id);
      const password = createTestPassword(), identifier = `${id}@example.test`;
      await db.user.create({ data: { id, role, email: identifier, passwordHash: await bcrypt.hash(password, 4) } });
      const { body } = await http().post('/auth/login').send({ identifier, password }).expect(201);
      return { id, token: body.data.accessToken };
    }
    client = await actor('client');
    owner = await actor('real_estate_agency');
    stranger = await actor('client');
    admin = await actor('admin');
    listing = (await db.realEstateListing.create({ data: { ownerUserId: owner.id, slug: randomUUID(), title: 'Test', city: 'Dakar', status: 'active' } })).id;
    conversation = (await db.conversation.create({ data: { module: 'real_estate', targetType: 'listing', targetId: listing,
      participants: { create: [{ userId: client.id }, { userId: owner.id }] } } })).id;
    message = (await db.message.create({ data: { conversationId: conversation, senderUserId: owner.id, body: 'Test' } })).id;
  }, 30000);
  afterAll(async () => {
    if (db) {
      await db.moderationDecision.deleteMany({ where: { adminUserId: { in: ids } } });
      await db.report.deleteMany({ where: { reporterUserId: { in: ids } } });
      await db.supportTicket.deleteMany({ where: { userId: { in: ids } } });
      if (conversation) await db.conversation.delete({ where: { id: conversation } });
      if (listing) await db.realEstateListing.delete({ where: { id: listing } });
      await db.auditLog.deleteMany({ where: { actorUserId: { in: ids } } });
      await db.user.deleteMany({ where: { id: { in: ids } } });
    }
    await app?.close();
    await db?.$disconnect();
  });

  it('validates targets, deduplicates, audits decisions and isolates advertiser data', async () => {
    const payload = { module: 'real_estate', targetType: 'listing', targetId: listing, reason: 'fraud_attempt', message: randomUUID() };
    await http().post('/reports').send(payload).expect(401);
    await http().post('/reports').set(auth(owner)).send(payload).expect(400);
    await http().post('/reports').set(auth(client)).send({ ...payload, targetId: randomUUID() }).expect(404);
    const a = await http().post('/reports').set(auth(client)).send(payload).expect(201);
    const b = await http().post('/reports').set(auth(client)).send(payload).expect(201);
    const id = a.body.data.id;
    expect(b.body.data.id).toBe(id);
    expect((await http().get('/reports/mine').set(auth(stranger)).expect(200)).body.data).toEqual([]);
    await http().get(`/reports/admin/${id}`).set(auth(owner)).expect(403);
    await http().patch(`/reports/admin/${id}/status`).set(auth(admin))
      .send({ status: 'correction_requested', note: 'Note privée', messageToAdvertiser: 'Vérifiez cette annonce.' }).expect(200);
    const received = (await http().get('/reports/received').set(auth(owner)).expect(200)).body.data[0];
    expect(received).toMatchObject({ id, status: 'correction_requested', decisions: [{ messageToUser: 'Vérifiez cette annonce.' }] });
    expect(received).not.toHaveProperty('reporterUserId');
    expect(received).not.toHaveProperty('message');
    expect(JSON.stringify(received)).not.toContain('Note privée');
    const detail = (await http().get(`/reports/admin/${id}`).set(auth(admin)).expect(200)).body.data;
    expect(detail.decisions[0]).toMatchObject({ internalNote: 'Note privée', adminUserId: admin.id });
  });

  it('only lets participants report an incoming message and only admins hide it', async () => {
    const payload = { module: 'messages', targetType: 'message', targetId: message, reason: 'inappropriate_message' };
    await http().post('/reports').set(auth(stranger)).send(payload).expect(404);
    const { body } = await http().post('/reports').set(auth(client)).send(payload).expect(201);
    const path = `/reports/admin/${body.data.id}/hide-message`;
    await http().patch(path).set(auth(client)).send({ note: 'Test' }).expect(403);
    await http().patch(path).set(auth(admin)).send({ note: 'Test' }).expect(200);
    expect((await db.message.findUniqueOrThrow({ where: { id: message } })).hiddenAt).not.toBeNull();
    await http().patch(path).set(auth(admin)).send({ note: 'Test' }).expect(409);
  });

  it('allows an admin reply and a client response, then closes the thread', async () => {
    const { body } = await http().post('/support/tickets').set(auth(client)).send({ subject: 'Sujet test', body: 'Demande test' }).expect(201);
    const id = body.data.id, path = `/support/admin/tickets/${id}`;
    await http().get(path).set(auth(stranger)).expect(403);
    await http().post(path + '/messages').set(auth(admin)).send({ body: 'Réponse test' }).expect(201);
    await http().post(`/support/tickets/${id}/messages`).set(auth(stranger)).send({ body: 'Intrusion' }).expect(404);
    await http().post(`/support/tickets/${id}/messages`).set(auth(client)).send({ body: 'Retour test' }).expect(201);
    const own = (await http().get('/support/tickets').set(auth(client)).expect(200)).body.data;
    expect(own.find((row: { id: string }) => row.id === id).messages).toHaveLength(3);
    expect(await db.notification.count({ where: { userId: client.id, type: 'support_reply' } })).toBe(1);
    await http().patch(path + '/status').set(auth(admin)).send({ status: 'closed' }).expect(200);
    await http().post(path + '/messages').set(auth(admin)).send({ body: 'Trop tard' }).expect(409);
    await http().post(`/support/tickets/${id}/messages`).set(auth(client)).send({ body: 'Trop tard' }).expect(409);
  });

  it.each(['contacts', 'notifications', 'email-activity'])('protects the paginated admin %s read model', async section => {
    await http().get(`/admin/${section}`).set(auth(owner)).expect(403);
    const { body } = await http().get(`/admin/${section}?limit=1`).set(auth(admin)).expect(200);
    expect(body.data.length).toBeLessThanOrEqual(1);
    expect(body.meta.limit).toBe(1);
    expect(body.data.every((row: Record<string, unknown>) =>
      !('payload' in row || 'metadata' in row || 'message' in row))).toBe(true);
  });
});

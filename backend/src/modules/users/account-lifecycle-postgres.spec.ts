import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { FilesService } from '../../files/files.service';
import { lockRequestAccounts } from '../../common/utils/request-account-lock';
import { createTestPassword } from '../../common/testing/test-credentials.fixture';
import { queueBusinessEmail } from '../emails/business-email';
import { EmailsService } from '../emails/emails.service';
import { UsersService } from './users.service';

const target = process.env.TEST_DATABASE_URL;
(target ? describe : describe.skip)('Account lifecycle on isolated PostgreSQL', () => {
  let db: PrismaClient, service: UsersService;
  const ids: string[] = [];
  const listings: string[] = [];
  beforeAll(async () => {
    const url = new URL(target!);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !url.pathname.endsWith('_test'))
      throw Error('Isolated test database required');
    db = new PrismaClient({ datasources: { db: { url: target } } });
    service = new UsersService(db as PrismaService, {} as FilesService);
    await db.$connect();
  });
  afterAll(async () => {
    if (!db) return;
    await db.emailLog.deleteMany({ where: { toEmail: { in: ids.map(id => `${id}@example.test`) } } });
    await db.realEstateVisitRequest.deleteMany({ where: { listingId: { in: listings } } });
    await db.realEstateListing.deleteMany({ where: { id: { in: listings } } });
    await db.auditLog.deleteMany({ where: { actorUserId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  });
  async function account(role: 'client' | 'real_estate_agency' | 'admin' = 'client') {
    const id = randomUUID(); ids.push(id);
    const password = createTestPassword();
    const email = `${id}@example.test`;
    await db.user.create({ data: { id, role, email, firstName: 'Test', emailVerified: true, passwordHash: await bcrypt.hash(password, 4) } });
    const session = await db.userSession.create({ data: { userId: id } });
    return { id, email, password, sessionId: session.id };
  }
  it('blocks both parties until explicit closure, then withdraws listings and revokes access', async () => {
    const owner = await account('real_estate_agency');
    const client = await account();
    const listing = await db.realEstateListing.create({ data: { ownerUserId: owner.id, status: 'active', slug: randomUUID(), title: 'Test', city: 'Dakar' } });
    listings.push(listing.id);
    const visit = await db.realEstateVisitRequest.create({ data: { listingId: listing.id, clientUserId: client.id, status: 'accepted', preferredDate: new Date(0) } });
    await expect(service.deleteAccount(owner.id, owner.sessionId, owner.password)).rejects.toMatchObject({ status: 409 });
    await expect(service.deleteAccount(client.id, client.sessionId, client.password)).rejects.toMatchObject({ status: 409 });
    await db.realEstateVisitRequest.update({ where: { id: visit.id }, data: { status: 'completed' } });
    await expect(service.deleteAccount(owner.id, client.sessionId, owner.password)).rejects.toMatchObject({ status: 401 });
    await expect(service.deleteAccount(owner.id, owner.sessionId, client.password)).rejects.toMatchObject({ status: 400 });
    expect(await service.deleteAccount(owner.id, owner.sessionId, owner.password)).toEqual({ deleted: true });
    expect(await db.user.findUnique({ where: { id: owner.id } })).toMatchObject({ status: 'deleted', email: null, passwordHash: null });
    expect((await db.userSession.findUniqueOrThrow({ where: { id: owner.sessionId } })).revokedAt).not.toBeNull();
    expect((await db.realEstateListing.findUniqueOrThrow({ where: { id: listing.id } })).status).toBe('deleted');
    expect(await db.realEstateVisitRequest.count({ where: { id: visit.id } })).toBe(1);
    await expect(db.$transaction(tx => lockRequestAccounts(tx, owner.id, client.id))).rejects.toMatchObject({ status: 409 });
  });
  it('does not allow self-deletion of administrators', async () => {
    const admin = await account('admin');
    await expect(service.deleteAccount(admin.id, admin.sessionId, admin.password)).rejects.toMatchObject({ status: 403 });
  });
  it('refuses a competing request while an account update holds the closing lock', async () => {
    const owner = await account('real_estate_agency');
    const client = await account();
    await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${owner.id} FOR NO KEY UPDATE`;
      await expect(db.$transaction(other => lockRequestAccounts(other, owner.id, client.id))).rejects.toMatchObject({ status: 409 });
    });
    await expect(db.$transaction(tx => lockRequestAccounts(tx, owner.id, client.id))).resolves.toBeUndefined();
  });
  it('queues opted-in recipients exactly once and cancels after opt-out', async () => {
    const user = await account();
    const values = {
      BUSINESS_EMAILS_ENABLED: 'true', FRONTEND_URL: 'https://example.test',
      RESEND_API_KEY: randomBytes(32).toString('hex'), EMAIL_FROM: 'no-reply@example.test',
      EMAIL_QUEUE_ENCRYPTION_KEY: randomBytes(32).toString('hex'),
    };
    const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
    Object.assign(process.env, values);
    try {
      const mail = new EmailsService(db as PrismaService, new ConfigService(values));
      const event = randomUUID();
      const queue = () => db.$transaction(tx => queueBusinessEmail(tx, 'message', event, user.id, '/compte/messages/'));
      await queue();
      expect(await db.emailLog.count({ where: { toEmail: user.email } })).toBe(0);
      await service.setBusinessEmailPreference(user.id, true);
      await Promise.all([queue(), queue()]);
      expect(await db.emailLog.count({ where: { toEmail: user.email } })).toBe(1);
      await service.setBusinessEmailPreference(user.id, false);
      const send = jest.fn();
      expect(await mail.processNextBusinessEmail(send)).toBe(true);
      expect(send).not.toHaveBeenCalled();
      expect(await db.emailLog.findFirst({ where: { toEmail: user.email } })).toMatchObject({ status: 'cancelled', payload: null });
      await service.setBusinessEmailPreference(user.id, true);
      await db.$transaction(tx => queueBusinessEmail(tx, 'listing_decision', randomUUID(), user.id, '/dashboard/immobilier/'));
      const deliver = jest.fn().mockResolvedValue(new Response(JSON.stringify({ id: randomUUID() }), { status: 200 }));
      expect(await mail.processNextBusinessEmail(deliver)).toBe(true);
      expect(deliver).toHaveBeenCalledTimes(1);
      expect(JSON.parse(deliver.mock.calls[0][1].body)).toMatchObject({ to: [user.email] });
      expect(await db.emailLog.findFirst({ where: { toEmail: user.email, status: 'sent' } })).toMatchObject({ payload: null });
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});

import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { randomBytes, randomUUID } from 'crypto';
import { EmailVerificationService } from './email-verification.service';
import { EmailsService } from '../modules/emails/emails.service';
import { openRecoveryEmail } from '../modules/emails/recovery-email';
import { PrismaService } from '../database/prisma/prisma.service';

const target = process.env.TEST_DATABASE_URL;
(target ? describe : describe.skip)('Email verification on isolated PostgreSQL', () => {
  let db: PrismaClient, service: EmailVerificationService, emails: EmailsService;
  const key = randomBytes(32);
  const ids: string[] = [];
  beforeAll(async () => {
    const url = new URL(target!);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !url.pathname.endsWith('_test')) throw Error('Isolated test database required');
    db = new PrismaClient({ datasources: { db: { url: target } } });
    const config = new ConfigService({ NODE_ENV: 'test', EMAIL_VERIFICATION_ENABLED: 'true',
      EMAIL_QUEUE_ENCRYPTION_KEY: key.toString('hex'), RESEND_API_KEY: randomBytes(32).toString('hex'),
      EMAIL_FROM: 'no-reply@example.test', FRONTEND_URL: 'https://example.test' });
    service = new EmailVerificationService(db as PrismaService, config);
    emails = new EmailsService(db as PrismaService, config);
    await db.$connect();
  });
  afterAll(async () => {
    if (!db) return;
    await db.emailLog.deleteMany({ where: { toEmail: { in: ids.map(id => `${id}@example.test`) } } });
    await db.auditLog.deleteMany({ where: { actorUserId: { in: ids } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  });
  async function queued() {
    const id = randomUUID(); ids.push(id);
    await db.user.create({ data: { id, role: 'client', email: `${id}@example.test` } });
    await service.request(id);
    const log = await db.emailLog.findFirstOrThrow({ where: { toEmail: `${id}@example.test` } });
    const envelope = openRecoveryEmail((log.payload as { encrypted: string }).encrypted, key, log.id);
    const token = envelope.text.match(/#token=([a-f0-9]{64})/)![1];
    expect(JSON.stringify(log)).not.toContain(token);
    return { id, log, token };
  }
  it('fails closed when disabled', async () => {
    const disabled = new EmailVerificationService(db as PrismaService, new ConfigService({}));
    expect(await disabled.capabilities()).toEqual({ emailVerification: false });
    await expect(disabled.request(randomUUID())).rejects.toMatchObject({ status: 501 });
  });
  it('queues once, confirms once and records the real badge', async () => {
    const { id, token } = await queued();
    await service.request(id);
    expect(await db.emailVerificationToken.count({ where: { userId: id } })).toBe(1);
    expect(await service.confirm(token)).toEqual({ verified: true });
    await expect(service.confirm(token)).rejects.toMatchObject({ status: 400 });
    expect((await db.user.findUniqueOrThrow({ where: { id } })).emailVerified).toBe(true);
  });
  it('allows exactly one concurrent confirmation', async () => {
    const { token } = await queued();
    const results = await Promise.allSettled([service.confirm(token), service.confirm(token)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  });
  it.each(['suspended', 'deleted', 'expired', 'email_changed'])('rejects %s and never verifies', async state => {
    const { id, token } = await queued();
    if (state === 'expired') await db.emailVerificationToken.updateMany({ where: { userId: id }, data: { expiresAt: new Date(0) } });
    else await db.user.update({ where: { id }, data: state === 'email_changed' ? { email: `${randomUUID()}@example.test` } : { status: state as 'suspended' | 'deleted' } });
    await expect(service.confirm(token)).rejects.toMatchObject({ status: 400 });
    expect((await db.user.findUniqueOrThrow({ where: { id } })).emailVerified).toBe(false);
  });
  it('worker sends through supplied transport only and removes encrypted payload', async () => {
    await db.emailLog.updateMany({ where: { templateKey: 'account.email_verification', toEmail: { in: ids.map(id => `${id}@example.test`) } }, data: { status: 'cancelled' } });
    const { log } = await queued();
    const send = jest.fn().mockResolvedValue(new Response(JSON.stringify({ id: randomUUID() }), { status: 200 }));
    expect(await emails.processNextVerificationEmail(send)).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    const row = await db.emailLog.findUniqueOrThrow({ where: { id: log.id } });
    expect(row.status).toBe('sent');
    expect(row.payload).toBeNull();
  });
});

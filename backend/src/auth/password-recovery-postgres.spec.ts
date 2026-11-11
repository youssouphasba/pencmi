import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomUUID, createHash } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../database/prisma/prisma.service';
import { EmailsService } from '../modules/emails/emails.service';
import { openRecoveryEmail, recoveryEnabled, RECOVERY_COPY } from '../modules/emails/recovery-email';
import { createTestPassword, createTestSecret } from '../common/testing/test-credentials.fixture';
import { ValidationPipe } from '@nestjs/common';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const target = process.env.TEST_DATABASE_URL;
(target ? describe : describe.skip)('Password recovery with isolated PostgreSQL and fake email transport', () => {
  let db: PrismaClient, auth: AuthService, emails: EmailsService, config: ConfigService;
  const users: string[] = [];
  const key = randomBytes(32);
  beforeAll(async () => {
    const url = new URL(target!);
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !url.pathname.endsWith('_test')) throw Error('Isolated local test database required');
    db = new PrismaClient({ datasources: { db: { url: target } } });
    await db.$connect();
    config = new ConfigService({ NODE_ENV: 'test', PASSWORD_RECOVERY_ENABLED: 'true', EMAIL_QUEUE_ENCRYPTION_KEY: key.toString('hex'),
      RESEND_API_KEY: createTestSecret(), EMAIL_FROM: 'Pencmi <no-reply@example.test>', FRONTEND_URL: 'https://preview.example.test',
      JWT_SECRET: createTestSecret(), REFRESH_TOKEN_SECRET: createTestSecret(), JWT_EXPIRES_IN: '15m', REFRESH_TOKEN_EXPIRES_IN: '30d' });
    auth = new AuthService(db as PrismaService, new JwtService(), config);
    emails = new EmailsService(db as PrismaService, config);
  });
  afterAll(async () => {
    if (!db) return;
    await db.emailLog.deleteMany({ where: { toEmail: { in: users.map(id => `${id}@example.test`) } } });
    await db.passwordResetToken.deleteMany({ where: { userId: { in: users } } });
    await db.auditLog.deleteMany({ where: { actorUserId: { in: users } } });
    await db.refreshToken.deleteMany({ where: { userId: { in: users } } });
    await db.userSession.deleteMany({ where: { userId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });
  async function actor() {
    const id = randomUUID(); users.push(id);
    const password = createTestPassword();
    await db.user.create({ data: { id, role: 'client', status: 'active', email: `${id}@example.test`, passwordHash: await bcrypt.hash(password, 4) } });
    return { id, password, identifier: `${id}@example.test` };
  }
  async function queue(user: Awaited<ReturnType<typeof actor>>) {
    await auth.forgotPassword({ identifier: user.identifier });
    const log = await db.emailLog.findFirstOrThrow({ where: { toEmail: user.identifier }, orderBy: { createdAt: 'desc' } });
    const encrypted = (log.payload as { encrypted: string }).encrypted;
    const envelope = openRecoveryEmail(encrypted, key, log.id);
    const token = envelope.text.match(/#token=([a-f0-9]{64})/)?.[1];
    if (!token) throw Error('Recovery envelope has no token');
    return { log, token, envelope };
  }
  it('is disabled without explicit configuration and refuses invalid origins', async () => {
    expect(recoveryEnabled(new ConfigService({}))).toBe(false);
    const disabled = new AuthService(db as PrismaService, new JwtService(), new ConfigService({}));
    await expect(disabled.forgotPassword({ identifier: `${randomUUID()}@example.test` })).rejects.toMatchObject({ status: 501 });
    expect(recoveryEnabled(config)).toBe(true);
    expect(recoveryEnabled(new ConfigService({ NODE_ENV: 'production', PASSWORD_RECOVERY_ENABLED: 'true', EMAIL_QUEUE_ENCRYPTION_KEY: key.toString('hex'), RESEND_API_KEY: createTestSecret(), EMAIL_FROM: 'no-reply@example.test', FRONTEND_URL: 'http://example.test' }))).toBe(false);
  });
  it('returns the same response for unknown and eligible email without returning tokens', async () => {
    const user = await actor();
    const unknown = await auth.forgotPassword({ identifier: `${randomUUID()}@example.test` });
    const known = await auth.forgotPassword({ identifier: user.identifier.toUpperCase() });
    expect(known).toEqual(unknown);
    expect(known).toEqual({ message: RECOVERY_COPY.received });
    const { log, token } = await queue(user);
    expect(JSON.stringify(log).includes(token)).toBe(false);
    const hash = createHash('sha256').update(token).digest('hex');
    expect(await db.passwordResetToken.count({ where: { userId: user.id, tokenHash: hash } })).toBe(1);
    await auth.forgotPassword({ identifier: user.identifier });
    expect(await db.passwordResetToken.count({ where: { userId: user.id } })).toBe(1);
    await db.emailLog.update({ where: { id: log.id }, data: { status: 'cancelled' } });
  });
  it('consumes a token once under concurrency and invalidates access and refresh sessions', async () => {
    const user = await actor();
    const login = await auth.login({ identifier: user.identifier, password: user.password });
    const { token, log } = await queue(user);
    const passwords = [createTestPassword(), createTestPassword()];
    const results = await Promise.allSettled(passwords.map(password => auth.resetPassword({ token, password })));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const winner = results.findIndex(result => result.status === 'fulfilled');
    await expect(auth.login({ identifier: user.identifier, password: passwords[winner] })).resolves.toHaveProperty('accessToken');
    await expect(auth.login({ identifier: user.identifier, password: user.password })).rejects.toMatchObject({ status: 401 });
    await expect(auth.validateAccessToken(login.accessToken)).rejects.toMatchObject({ status: 401 });
    await expect(auth.refresh(login.refreshToken)).rejects.toMatchObject({ status: 401 });
    await expect(auth.resetPassword({ token, password: createTestPassword() })).rejects.toMatchObject({ status: 400 });
    expect(await db.auditLog.count({ where: { actorUserId: user.id, action: 'account.password_reset' } })).toBe(1);
    await db.emailLog.update({ where: { id: log.id }, data: { status: 'cancelled' } });
  }, 15000);
  it('rejects expired tokens and suspended or deleted accounts', async () => {
    for (const variant of ['expired', 'suspended', 'deleted']) {
      const user = await actor();
      const { token, log, envelope } = await queue(user);
      if (variant === 'expired') await db.passwordResetToken.update({ where: { id: envelope.resetId }, data: { expiresAt: new Date(0) } });
      else await db.user.update({ where: { id: user.id }, data: variant === 'suspended' ? { status: 'suspended' } : { deletedAt: new Date() } });
      await expect(auth.resetPassword({ token, password: createTestPassword() })).rejects.toMatchObject({ status: 400 });
      await db.emailLog.update({ where: { id: log.id }, data: { status: 'cancelled' } });
    }
  });
  it('invalidates outstanding recovery tokens after a regular password change', async () => {
    const user = await actor();
    const session = await auth.login({ identifier: user.identifier, password: user.password });
    const identity = await auth.validateAccessToken(session.accessToken);
    const { token, log } = await queue(user);
    await auth.changePassword(user.id, identity.sessionId, { currentPassword: user.password, newPassword: createTestPassword() });
    await expect(auth.resetPassword({ token, password: createTestPassword() })).rejects.toMatchObject({ status: 400 });
    await db.notification.deleteMany({ where: { userId: user.id } });
    await db.emailLog.update({ where: { id: log.id }, data: { status: 'cancelled' } });
  });
  it('serializes workers and sends once using a stable idempotency key, then erases the envelope', async () => {
    const user = await actor();
    const { log } = await queue(user);
    const sent: string[] = [];
    const transport: typeof fetch = jest.fn(async (_url, options) => {
      sent.push(new Headers(options?.headers).get('Idempotency-Key') || '');
      await new Promise(resolve => setTimeout(resolve, 40));
      return new Response(JSON.stringify({ id: randomUUID() }), { status: 200 });
    });
    await Promise.all([emails.processNextRecoveryEmail(transport), emails.processNextRecoveryEmail(transport)]);
    expect(sent).toEqual([`pencmi-recovery/${log.id}`]);
    const delivered = await db.emailLog.findUniqueOrThrow({ where: { id: log.id } });
    expect(delivered.status).toBe('sent');
    expect(delivered.payload).toBeNull();
    const adminLogs = await emails.findLogs();
    expect(adminLogs.every(item => !('payload' in item))).toBe(true);
  });
  it('retries a transient provider failure with the same key and no secret in errors', async () => {
    const user = await actor();
    const { log, token } = await queue(user);
    const transport: typeof fetch = jest.fn(async () => { throw Error(token); });
    await emails.processNextRecoveryEmail(transport);
    const retry = await db.emailLog.findUniqueOrThrow({ where: { id: log.id } });
    expect(retry.status).toBe('pending');
    expect(retry.error?.includes(token)).toBe(false);
    expect((retry.payload as { attempts: number }).attempts).toBe(1);
    await db.emailLog.update({ where: { id: log.id }, data: { payload: { ...(retry.payload as object), nextAttemptAt: 0 } } });
    let observedKey = '';
    await emails.processNextRecoveryEmail(async (_url, options) => {
      observedKey = new Headers(options?.headers).get('Idempotency-Key') || '';
      return new Response(JSON.stringify({ id: randomUUID() }), { status: 200 });
    });
    expect(observedKey).toBe(`pencmi-recovery/${log.id}`);
  });
  it('cancels consumed tokens before sending and terminates permanent provider failures', async () => {
    const user = await actor();
    const { log, envelope } = await queue(user);
    await db.passwordResetToken.update({ where: { id: envelope.resetId }, data: { usedAt: new Date() } });
    const send: typeof fetch = jest.fn(async () => new Response(null, { status: 403 }));
    await emails.processNextRecoveryEmail(send);
    expect(send).not.toHaveBeenCalled();
    expect((await db.emailLog.findUniqueOrThrow({ where: { id: log.id } })).status).toBe('cancelled');
    const other = await actor();
    const next = await queue(other);
    await emails.processNextRecoveryEmail(send);
    const failed = await db.emailLog.findUniqueOrThrow({ where: { id: next.log.id } });
    expect(failed.status).toBe('failed');
    expect(failed.payload).toBeNull();
  });
  it('rejects forged fields and weak passwords', async () => {
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    await expect(pipe.transform({ identifier: 'invalid' }, { type: 'body', metatype: ForgotPasswordDto })).rejects.toMatchObject({ status: 400 });
    await expect(pipe.transform({ token: randomBytes(32).toString('hex'), password: createTestPassword(), userId: randomUUID() }, { type: 'body', metatype: ResetPasswordDto })).rejects.toMatchObject({ status: 400 });
    await expect(auth.resetPassword({ token: randomBytes(32).toString('hex'), password: randomUUID() })).rejects.toMatchObject({ status: 400 });
  });
});

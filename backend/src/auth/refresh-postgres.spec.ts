import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma/prisma.service';
import { AuthService } from './auth.service';

const testUrl = process.env.TEST_DATABASE_URL;
const postgresTests = testUrl ? describe : describe.skip;

postgresTests('Refresh rotation against PostgreSQL', () => {
  it('serializes competing refreshes and preserves another device session', async () => {
    if (!testUrl || !/(?:^|[_-])test(?:[_-]|$)/i.test(new URL(testUrl).pathname.slice(1))) {
      throw new Error('TEST_DATABASE_URL must point to an explicitly named test database.');
    }
    const prisma = new PrismaClient({ datasources: { db: { url: testUrl } } });
    const jwt = new JwtService();
    const config = new ConfigService({ JWT_SECRET: randomUUID(), REFRESH_TOKEN_SECRET: randomUUID(),
      JWT_EXPIRES_IN: '5m', REFRESH_TOKEN_EXPIRES_IN: '1h' });
    const service = new AuthService(prisma as PrismaService, jwt, config);
    let userId: string | undefined;
    try {
      const user = await prisma.user.create({ data: { role: 'client', status: 'active', email: `refresh-test-${randomUUID()}@example.test` } });
      userId = user.id;
      const session = await prisma.userSession.create({ data: { userId } });
      const other = await prisma.userSession.create({ data: { userId } });
      const raw = await jwt.signAsync({ id: userId, sessionId: session.id }, { secret: config.getOrThrow('REFRESH_TOKEN_SECRET'), expiresIn: '5m' });
      const parent = await prisma.refreshToken.create({ data: { userId, sessionId: session.id,
        tokenHash: createHash('sha256').update(raw).digest('hex'), expiresAt: new Date(jwt.decode<{ exp: number }>(raw).exp * 1000) } });
      const results = await Promise.allSettled([service.refresh(raw), service.refresh(raw)]);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
      expect(await prisma.refreshToken.count({ where: { parentTokenId: parent.id } })).toBe(1);
      expect(await prisma.refreshToken.count({ where: { sessionId: session.id, consumedAt: null, revokedAt: null } })).toBe(0);
      expect((await prisma.userSession.findUniqueOrThrow({ where: { id: session.id } })).revokedAt).not.toBeNull();
      expect((await prisma.userSession.findUniqueOrThrow({ where: { id: other.id } })).revokedAt).toBeNull();
    } finally {
      if (userId) {
        await prisma.refreshToken.deleteMany({ where: { userId } });
        await prisma.userSession.deleteMany({ where: { userId } });
        await prisma.user.delete({ where: { id: userId } });
      }
      await prisma.$disconnect();
    }
  }, 30000);
});

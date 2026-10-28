import { ConfigService } from '@nestjs/config';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { randomBytes, randomUUID, createHash } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from './prisma/prisma.service';
import { HotelPartnerGuard } from '../modules/hotel-integrations/hotel-partner.guard';
import {
  HOTEL_PARTNER_PERMISSION,
  HotelPartnerRequest,
} from '../modules/hotel-integrations/hotel-partner-auth';
import { AdvertiserReviewsService } from '../modules/advertiser-reviews/advertiser-reviews.service';
import { AuditService } from '../audit/audit.service';
import { PaginationDto } from '../common/pagination/pagination.dto';

const url = process.env.TEST_DATABASE_URL;
(url ? describe : describe.skip)(
  'Migrated production copy against PostgreSQL',
  () => {
    let prisma: PrismaClient;
    beforeAll(async () => {
      if (
        !url ||
        !/^[a-z][a-z0-9_]*_test$/.test(new URL(url).pathname.slice(1)) ||
        !process.env.PRODUCTION_CLUSTER_ID
      ) {
        throw new Error(
          'Explicit isolated test target and production identity required',
        );
      }
      prisma = new PrismaClient({ datasources: { db: { url } }, log: [] });
      const identity = await prisma.$queryRawUnsafe<Array<{ cluster: string }>>(
        'SELECT system_identifier::text AS cluster FROM pg_control_system()',
      );
      if (identity[0].cluster === process.env.PRODUCTION_CLUSTER_ID)
        throw new Error('Production cluster forbidden');
    });
    afterAll(async () => {
      await prisma?.$disconnect();
    });

    it('logs in an existing copied user, rotates, rejects replay and logs out', async () => {
      const user = await prisma.user.findFirstOrThrow({
        where: { status: 'active', deletedAt: null, email: { not: null } },
      });
      const config = new ConfigService({
        JWT_SECRET: randomUUID(),
        REFRESH_TOKEN_SECRET: randomUUID(),
        JWT_EXPIRES_IN: '5m',
        REFRESH_TOKEN_EXPIRES_IN: '1h',
      });
      const service = new AuthService(
        prisma as PrismaService,
        new JwtService(),
        config,
      );
      const password = randomBytes(32).toString('hex');
      const sessions: string[] = [];
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: await bcrypt.hash(password, 12) },
        });
        const first = await service.login({
          identifier: user.email!,
          password,
        });
        const authenticated = await service.validateAccessToken(
          first.accessToken,
        );
        sessions.push(authenticated.sessionId);
        expect(authenticated.role === user.role).toBe(true);
        const rotated = await service.refresh(first.refreshToken);
        expect(
          Boolean(
            rotated.refreshToken && rotated.refreshToken !== first.refreshToken,
          ),
        ).toBe(true);
        await service.refresh(rotated.refreshToken);
        await expect(service.refresh(first.refreshToken)).rejects.toMatchObject(
          { status: 401 },
        );
        await expect(
          service.validateAccessToken(first.accessToken),
        ).rejects.toMatchObject({ status: 401 });
        const second = await service.login({
          identifier: user.email!,
          password,
        });
        const active = await service.validateAccessToken(second.accessToken);
        sessions.push(active.sessionId);
        await service.logout(user.id, active.sessionId);
        await expect(
          service.refresh(second.refreshToken),
        ).rejects.toMatchObject({ status: 401 });
        await expect(
          service.validateAccessToken(second.accessToken),
        ).rejects.toMatchObject({ status: 401 });
      } finally {
        await prisma.refreshToken.deleteMany({
          where: { sessionId: { in: sessions }, userId: user.id },
        });
        await prisma.userSession.deleteMany({
          where: { id: { in: sessions }, userId: user.id },
        });
        await prisma.user.update({
          where: { id: user.id },
          data: { passwordHash: user.passwordHash, updatedAt: user.updatedAt },
        });
      }
    }, 60000);

    it('authenticates a scoped hotel API key and refuses it once disabled', async () => {
      const property = await prisma.hotelProperty.findFirstOrThrow({
        where: { deletedAt: null, integration: { is: null } },
      });
      const integration = await prisma.hotelIntegration.create({
        data: { propertyId: property.id, status: 'active' },
      });
      const raw = `pencmi_${randomBytes(32).toString('hex')}`;
      try {
        const key = await prisma.hotelApiKey.create({
          data: {
            integrationId: integration.id,
            name: 'Isolated migration test',
            keyHash: createHash('sha256').update(raw).digest('hex'),
            permissions: ['hotel.property.read'],
          },
        });
        expect(key.active).toBe(true);
        const handler = () => undefined;
        Reflect.defineMetadata(
          HOTEL_PARTNER_PERMISSION,
          'hotel.property.read',
          handler,
        );
        const request = {
          headers: { 'x-api-key': raw },
        } as unknown as HotelPartnerRequest;
        const context = {
          getHandler: () => handler,
          switchToHttp: () => ({ getRequest: () => request }),
        } as unknown as ExecutionContext;
        const guard = new HotelPartnerGuard(
          prisma as PrismaService,
          new Reflector(),
        );
        expect(await guard.canActivate(context)).toBe(true);
        expect(request.hotelPartner?.propertyId === property.id).toBe(true);
        expect(
          Boolean(
            (
              await prisma.hotelApiKey.findUniqueOrThrow({
                where: { id: key.id },
              })
            ).lastUsedAt,
          ),
        ).toBe(true);
        await prisma.hotelApiKey.update({
          where: { id: key.id },
          data: { active: false },
        });
        await expect(guard.canActivate(context)).rejects.toMatchObject({
          status: 401,
        });
      } finally {
        await prisma.hotelIntegration.delete({ where: { id: integration.id } });
      }
    }, 30000);

    it('persists advertiser reviews and exposes only published reviews', async () => {
      const advertiser = await prisma.user.findFirstOrThrow({
        where: { deletedAt: null, professionalProfile: { isNot: null } },
      });
      const service = new AdvertiserReviewsService(
        prisma as PrismaService,
        {} as AuditService,
      );
      const before = await service.getPublicSummary(advertiser.id);
      let id: string | undefined;
      try {
        const created = await service.createPublicReview(advertiser.id, {
          rating: 4,
          comment: 'Isolated migration test',
        });
        id = created.id;
        expect(created.status).toBe('pending_review');
        expect(
          (await service.getPublicSummary(advertiser.id)).reviewCount,
        ).toBe(before.reviewCount);
        await prisma.advertiserReview.update({
          where: { id },
          data: { status: 'published', publishedAt: new Date() },
        });
        expect(
          (await service.getPublicSummary(advertiser.id)).reviewCount,
        ).toBe(before.reviewCount + 1);
        expect(
          (
            await service.getPublicReviews(advertiser.id, new PaginationDto())
          ).reviews.some((review) => review.id === id),
        ).toBe(true);
      } finally {
        if (id) await prisma.advertiserReview.delete({ where: { id } });
      }
    }, 30000);
  },
);

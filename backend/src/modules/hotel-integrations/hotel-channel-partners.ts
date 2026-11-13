import { Body, Controller, Delete, Get, Injectable, NotFoundException, ConflictException, Param, Patch, Post, Put, ServiceUnavailableException } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PrismaService } from '../../database/prisma/prisma.service';
import { parseHotelInput } from '../hotels/hotel-inventory';
import { hashChannelSecret } from './hotel-channel.guard';
import { newWebhookSecret, parseWebhookUrl, sealWebhookSecret, webhookEncryptionKey } from './hotel-webhooks';

const createSchema = z
  .object({
    code: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,30}$/, 'Code : lettres, chiffres et tirets.'),
    name: z.string().trim().min(2).max(80),
  })
  .strict();
const statusSchema = z.object({ active: z.boolean() }).strict();
const webhookSchema = z.object({ url: z.string().trim().min(8).max(2000) }).strict();
const partnerSelect = {
  id: true, code: true, name: true, active: true, createdAt: true, webhookUrl: true,
  _count: { select: { integrations: { where: { syncMode: 'channel_manager', status: 'active' } } } },
} as const;
const deliverySelect = {
  id: true, type: true, hotelCode: true, status: true, attempts: true, nextAttemptAt: true,
  lastStatus: true, lastError: true, createdAt: true, sentAt: true,
} as const;
const shape = ({ _count, ...partner }: any) => ({ ...partner, hotels: _count.integrations });
const newSecret = () => `pcmcm_${randomBytes(32).toString('hex')}`;

/** Channel managers Pencmi has a partnership with. The secret is shown once. */
@Injectable()
export class HotelChannelPartnersService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const [partners, deliveries] = await Promise.all([
      this.prisma.hotelChannelPartner.findMany({ orderBy: { name: 'asc' }, select: partnerSelect }),
      this.prisma.hotelChannelWebhookDelivery.groupBy({
        by: ['partnerId', 'status'],
        where: { status: { in: ['pending', 'sending', 'retrying', 'failed'] } },
        _count: { _all: true },
      }),
    ]);
    const count = (partnerId: string, statuses: string[]) =>
      deliveries
        .filter((row) => row.partnerId === partnerId && statuses.includes(row.status))
        .reduce((sum, row) => sum + row._count._all, 0);
    return partners.map((partner) => ({
      ...shape(partner),
      webhookDeliveries: { waiting: count(partner.id, ['pending', 'sending', 'retrying']), failed: count(partner.id, ['failed']) },
    }));
  }

  /** Registers the webhook and returns a new signing secret, shown once. */
  async setWebhook(adminId: string, id: string, body: unknown) {
    const input = parseHotelInput(webhookSchema, body);
    const url = parseWebhookUrl(input.url).toString();
    const key = webhookEncryptionKey();
    if (!key)
      throw new ServiceUnavailableException('Les webhooks ne sont pas configurés sur le serveur (HOTEL_WEBHOOK_ENCRYPTION_KEY).');
    await this.find(id);
    const secret = newWebhookSecret();
    const partner = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.hotelChannelPartner.update({
        where: { id }, data: { webhookUrl: url, webhookSecret: sealWebhookSecret(secret, key, id) }, select: partnerSelect,
      });
      await this.audit(tx, adminId, 'hotel_channel_partner.webhook_set', id, { host: new URL(url).host });
      return updated;
    });
    return { ...shape(partner), webhookSecret: secret };
  }

  async removeWebhook(adminId: string, id: string) {
    await this.find(id);
    const partner = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.hotelChannelPartner.update({
        where: { id }, data: { webhookUrl: null, webhookSecret: null }, select: partnerSelect,
      });
      await tx.hotelChannelWebhookDelivery.updateMany({
        where: { partnerId: id, status: { in: ['pending', 'retrying'] } },
        data: { status: 'skipped', lastError: 'Webhook retiré.' },
      });
      await this.audit(tx, adminId, 'hotel_channel_partner.webhook_removed', id, {});
      return updated;
    });
    return shape(partner);
  }

  /** Queues a `ping`, sent like any notification. */
  async testWebhook(id: string) {
    const partner = await this.prisma.hotelChannelPartner.findUnique({ where: { id }, select: { webhookUrl: true, active: true } });
    if (!partner) throw new NotFoundException('Channel manager introuvable.');
    if (!partner.webhookUrl || !partner.active) throw new ConflictException('Enregistrez un webhook sur un partenaire actif d’abord.');
    const delivery = await this.prisma.hotelChannelWebhookDelivery.create({
      data: { partnerId: id, type: 'ping' },
      select: deliverySelect,
    });
    return delivery;
  }

  async deliveries(id: string) {
    await this.find(id);
    return this.prisma.hotelChannelWebhookDelivery.findMany({
      where: { partnerId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: deliverySelect,
    });
  }

  async create(adminId: string, body: unknown) {
    const input = parseHotelInput(createSchema, body);
    if (await this.prisma.hotelChannelPartner.findUnique({ where: { code: input.code }, select: { id: true } }))
      throw new ConflictException('Ce code est déjà utilisé.');
    const secret = newSecret();
    const partner = await this.prisma.$transaction(async (tx) => {
      const created = await tx.hotelChannelPartner.create({
        data: { code: input.code, name: input.name, secretHash: hashChannelSecret(secret) },
        select: partnerSelect,
      });
      await this.audit(tx, adminId, 'hotel_channel_partner.created', created.id, { code: input.code });
      return created;
    });
    return { ...shape(partner), secret };
  }

  async rotateSecret(adminId: string, id: string) {
    await this.find(id);
    const secret = newSecret();
    const partner = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.hotelChannelPartner.update({
        where: { id }, data: { secretHash: hashChannelSecret(secret) }, select: partnerSelect,
      });
      await this.audit(tx, adminId, 'hotel_channel_partner.secret_rotated', id, {});
      return updated;
    });
    return { ...shape(partner), secret };
  }

  async setActive(adminId: string, id: string, body: unknown) {
    const input = parseHotelInput(statusSchema, body);
    await this.find(id);
    const partner = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.hotelChannelPartner.update({ where: { id }, data: { active: input.active }, select: partnerSelect });
      await this.audit(tx, adminId, input.active ? 'hotel_channel_partner.enabled' : 'hotel_channel_partner.disabled', id, {});
      return updated;
    });
    return shape(partner);
  }

  private async find(id: string) {
    const partner = await this.prisma.hotelChannelPartner.findUnique({ where: { id }, select: { id: true } });
    if (!partner) throw new NotFoundException('Channel manager introuvable.');
  }

  private audit(tx: any, adminId: string, action: string, targetId: string, metadata: object) {
    return tx.auditLog.create({ data: { actorUserId: adminId, action, module: 'hotels', targetType: 'other', targetId, metadata } });
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@RequirePermissions('access_admin')
@Controller('admin/hotel-channel-partners')
export class HotelChannelPartnersController {
  constructor(private readonly service: HotelChannelPartnersService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Post()
  create(@CurrentUser() admin: AuthenticatedUser, @Body() body: unknown) {
    return this.service.create(admin.id, body);
  }

  @Post(':id/secret')
  rotate(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.service.rotateSecret(admin.id, id);
  }

  @Put(':id/webhook')
  setWebhook(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string, @Body() body: unknown) {
    return this.service.setWebhook(admin.id, id, body);
  }

  @Delete(':id/webhook')
  removeWebhook(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string) {
    return this.service.removeWebhook(admin.id, id);
  }

  @Post(':id/webhook/test')
  testWebhook(@Param('id') id: string) {
    return this.service.testWebhook(id);
  }

  @Get(':id/webhook/deliveries')
  deliveries(@Param('id') id: string) {
    return this.service.deliveries(id);
  }

  @Patch(':id')
  setActive(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string, @Body() body: unknown) {
    return this.service.setActive(admin.id, id, body);
  }
}

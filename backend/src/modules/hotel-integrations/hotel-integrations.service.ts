import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateHotelApiKeyDto, CreateHotelWebhookDto, PartnerUpsertPropertyDto } from './hotel-integrations.dto';
import { HOTEL_PARTNER_PERMISSIONS, HotelPartnerContext } from './hotel-partner-auth';

const apiKeySelect = {
  id: true, integrationId: true, name: true, permissions: true, active: true,
  revokedAt: true, lastUsedAt: true, createdAt: true,
} satisfies Prisma.HotelApiKeySelect;
const webhookSelect = {
  id: true, integrationId: true, url: true, events: true, active: true, createdAt: true,
} satisfies Prisma.HotelWebhookSelect;
const partnerPropertySelect = {
  name: true, propertyType: true, city: true, region: true,
} satisfies Prisma.HotelPropertySelect;

@Injectable()
export class HotelIntegrationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findForProperty(ownerUserId: string, propertyId: string) {
    await this.assertHotelOwner(ownerUserId, propertyId);
    return this.prisma.hotelIntegration.upsert({
      where: { propertyId },
      create: { propertyId },
      update: {},
      include: {
        apiKeys: { select: apiKeySelect }, webhooks: { select: webhookSelect },
        syncLogs: { take: 20, orderBy: { createdAt: 'desc' }, select: { id: true, direction: true, entityType: true, status: true, createdAt: true } },
        conflicts: { select: { id: true, entityType: true, entityId: true, status: true, createdAt: true, resolvedAt: true } },
      },
    });
  }

  async createApiKey(ownerUserId: string, propertyId: string, dto: CreateHotelApiKeyDto) {
    if (!Array.isArray(dto.permissions) || !dto.permissions.length || dto.permissions.some((permission) => !HOTEL_PARTNER_PERMISSIONS.includes(permission))) {
      throw new BadRequestException('Permissions partenaire invalides.');
    }
    await this.assertHotelOwner(ownerUserId, propertyId);
    const integration = await this.prisma.hotelIntegration.upsert({
      where: { propertyId },
      create: { propertyId },
      update: {},
    });
    const rawKey = `pencmi_${randomBytes(32).toString('hex')}`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const apiKey = await this.prisma.hotelApiKey.create({
      data: { integrationId: integration.id, name: dto.name, permissions: dto.permissions, keyHash },
      select: apiKeySelect,
    });
    return { ...apiKey, key: rawKey };
  }

  async createWebhook(ownerUserId: string, propertyId: string, dto: CreateHotelWebhookDto) {
    await this.assertHotelOwner(ownerUserId, propertyId);
    const integration = await this.prisma.hotelIntegration.upsert({
      where: { propertyId },
      create: { propertyId },
      update: {},
    });
    const secret = randomBytes(32).toString('hex');
    const secretHash = createHash('sha256').update(secret).digest('hex');
    const webhook = await this.prisma.hotelWebhook.create({
      data: { integrationId: integration.id, url: dto.url, events: dto.events, secretHash },
      select: webhookSelect,
    });
    return { ...webhook, secret };
  }

  async partnerUpsertProperty(partner: HotelPartnerContext, externalPropertyId: string, dto: PartnerUpsertPropertyDto) {
    await this.assertPartnerMapping(partner, externalPropertyId);
    const property = await this.prisma.hotelProperty.update({
      where: { id: partner.propertyId, deletedAt: null, integration: { id: partner.integrationId, status: 'active' } },
      data: { name: dto.name, propertyType: dto.propertyType, city: dto.city, region: dto.region },
      select: partnerPropertySelect,
    });
    return { externalPropertyId, ...property };
  }

  async partnerFindProperty(partner: HotelPartnerContext, externalPropertyId: string) {
    await this.assertPartnerMapping(partner, externalPropertyId);
    const property = await this.prisma.hotelProperty.findFirst({
      where: { id: partner.propertyId, deletedAt: null, integration: { id: partner.integrationId, status: 'active' } },
      select: partnerPropertySelect,
    });
    if (!property) throw new NotFoundException('Établissement partenaire introuvable.');
    return { externalPropertyId, ...property };
  }

  private async assertPartnerMapping(partner: HotelPartnerContext, externalPropertyId: string) {
    const mapping = await this.prisma.hotelExternalMapping.findFirst({
      where: { integrationId: partner.integrationId, entityType: 'property', externalId: externalPropertyId },
      select: { internalId: true },
    });
    if (!mapping || mapping.internalId !== partner.propertyId) {
      throw new NotFoundException('Établissement partenaire introuvable.');
    }
  }

  private async assertHotelOwner(ownerUserId: string, propertyId: string) {
    const hotel = await this.prisma.hotelProperty.findFirst({ where: { id: propertyId, ownerUserId, deletedAt: null } });
    if (!hotel) throw new ForbiddenException('Accès non autorisé.');
  }
}

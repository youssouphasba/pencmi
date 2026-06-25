import { ForbiddenException, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateHotelApiKeyDto, CreateHotelWebhookDto, PartnerUpsertPropertyDto } from './hotel-integrations.dto';

@Injectable()
export class HotelIntegrationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findForProperty(ownerUserId: string, propertyId: string) {
    await this.assertHotelOwner(ownerUserId, propertyId);
    return this.prisma.hotelIntegration.upsert({
      where: { propertyId },
      create: { propertyId },
      update: {},
      include: { apiKeys: true, webhooks: true, syncLogs: { take: 20, orderBy: { createdAt: 'desc' } }, conflicts: true },
    });
  }

  async createApiKey(ownerUserId: string, propertyId: string, dto: CreateHotelApiKeyDto) {
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
    });
    return { ...webhook, secret };
  }

  async partnerUpsertProperty(externalPropertyId: string, dto: PartnerUpsertPropertyDto) {
    const mapping = await this.prisma.hotelExternalMapping.findFirst({
      where: { entityType: 'property', externalId: externalPropertyId },
    });
    if (!mapping) {
      return {
        externalPropertyId,
        status: 'mapping_required',
      };
    }
    return this.prisma.hotelProperty.update({
      where: { id: mapping.internalId },
      data: dto,
    });
  }

  async partnerFindProperty(externalPropertyId: string) {
    const mapping = await this.prisma.hotelExternalMapping.findFirstOrThrow({
      where: { entityType: 'property', externalId: externalPropertyId },
    });
    return this.prisma.hotelProperty.findUniqueOrThrow({ where: { id: mapping.internalId }, include: { rooms: true } });
  }

  private async assertHotelOwner(ownerUserId: string, propertyId: string) {
    const hotel = await this.prisma.hotelProperty.findFirst({ where: { id: propertyId, ownerUserId } });
    if (!hotel) throw new ForbiddenException('Accès non autorisé.');
  }
}

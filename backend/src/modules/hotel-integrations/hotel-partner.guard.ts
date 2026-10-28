import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'crypto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { HOTEL_PARTNER_PERMISSION, HotelPartnerPermission, HotelPartnerRequest } from './hotel-partner-auth';

@Injectable()
export class HotelPartnerGuard implements CanActivate {
  private readonly logger = new Logger(HotelPartnerGuard.name);

  constructor(private readonly prisma: PrismaService, private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<HotelPartnerRequest>();
    const rawKey = request.headers['x-api-key'];
    if (typeof rawKey !== 'string' || !/^pencmi_[a-f0-9]{64}$/.test(rawKey)) {
      this.logger.warn('Hotel partner authentication rejected: missing or malformed credential');
      throw new UnauthorizedException('Clé API partenaire requise.');
    }
    const key = await this.prisma.hotelApiKey.findUnique({
      where: { keyHash: createHash('sha256').update(rawKey).digest('hex') },
      select: {
        id: true, active: true, revokedAt: true, permissions: true,
        integration: { select: { id: true, status: true, propertyId: true, property: { select: { deletedAt: true } } } },
      },
    });
    if (!key || !key.active || key.revokedAt || key.integration.status !== 'active' || key.integration.property.deletedAt) {
      this.logger.warn('Hotel partner authentication rejected: credential or integration unavailable');
      throw new UnauthorizedException('Clé API partenaire non autorisée.');
    }
    await this.prisma.hotelApiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() }, select: { id: true } });
    const permission = this.reflector.get<HotelPartnerPermission>(HOTEL_PARTNER_PERMISSION, context.getHandler());
    if (!permission || !key.permissions.includes(permission)) {
      this.logger.warn('Hotel partner authorization rejected: operation not permitted');
      throw new ForbiddenException('Opération partenaire non autorisée.');
    }
    request.hotelPartner = { integrationId: key.integration.id, propertyId: key.integration.propertyId };
    return true;
  }
}

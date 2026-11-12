import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { PrismaService } from '../../database/prisma/prisma.service';
import { HotelChannelPartnerContext } from './hotel-sync.service';

export type HotelChannelRequest = Request & { channelPartner?: HotelChannelPartnerContext };
export const hashChannelSecret = (secret: string) => createHash('sha256').update(secret).digest('hex');

/** A channel manager authenticates once for every hotel that chose it. */
@Injectable()
export class HotelChannelGuard implements CanActivate {
  private readonly logger = new Logger(HotelChannelGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<HotelChannelRequest>();
    const code = request.headers['x-channel-partner'];
    const secret = request.headers['x-channel-secret'];
    if (typeof code !== 'string' || typeof secret !== 'string' || !/^pcmcm_[a-f0-9]{64}$/.test(secret) || code.length > 64) {
      this.logger.warn('Channel manager authentication rejected: missing or malformed credential');
      throw new UnauthorizedException('Identifiants channel manager requis.');
    }
    const partner = await this.prisma.hotelChannelPartner.findUnique({
      where: { code },
      select: { id: true, code: true, active: true, secretHash: true },
    });
    const expected = Buffer.from(partner?.secretHash ?? '0'.repeat(64), 'hex');
    const given = Buffer.from(hashChannelSecret(secret), 'hex');
    if (!partner || !partner.active || !timingSafeEqual(expected, given)) {
      this.logger.warn('Channel manager authentication rejected: credential unavailable');
      throw new UnauthorizedException('Identifiants channel manager non autorisés.');
    }
    request.channelPartner = { id: partner.id, code: partner.code };
    return true;
  }
}

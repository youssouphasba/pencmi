import { Body, Controller, Get, Injectable, NotFoundException, ConflictException, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PrismaService } from '../../database/prisma/prisma.service';
import { parseHotelInput } from '../hotels/hotel-inventory';
import { hashChannelSecret } from './hotel-channel.guard';

const createSchema = z
  .object({
    code: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,30}$/, 'Code : lettres, chiffres et tirets.'),
    name: z.string().trim().min(2).max(80),
  })
  .strict();
const statusSchema = z.object({ active: z.boolean() }).strict();
const partnerSelect = {
  id: true, code: true, name: true, active: true, createdAt: true,
  _count: { select: { integrations: { where: { syncMode: 'channel_manager', status: 'active' } } } },
} as const;
const shape = ({ _count, ...partner }: any) => ({ ...partner, hotels: _count.integrations });
const newSecret = () => `pcmcm_${randomBytes(32).toString('hex')}`;

/** Channel managers Pencmi has a partnership with. The secret is shown once. */
@Injectable()
export class HotelChannelPartnersService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const partners = await this.prisma.hotelChannelPartner.findMany({ orderBy: { name: 'asc' }, select: partnerSelect });
    return partners.map(shape);
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

  @Patch(':id')
  setActive(@CurrentUser() admin: AuthenticatedUser, @Param('id') id: string, @Body() body: unknown) {
    return this.service.setActive(admin.id, id, body);
  }
}

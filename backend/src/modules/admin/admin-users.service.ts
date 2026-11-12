import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MODERATION_MODULES, ModerationModule } from '../../common/utils/listing-moderation';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AdminUserStatusDto } from './admin-users.dto';

type ListingIds = Partial<Record<ModerationModule, string[]>>;
type ListingTable = {
  findMany(args: { where: object; select: { id: true } }): Promise<{ id: string }[]>;
  updateMany(args: { where: object; data: { status: 'active' | 'suspended' } }): Promise<{ count: number }>;
};

const SUSPENDED_ACTION = 'account.suspended';

function listingTable(tx: Prisma.TransactionClient, module: ModerationModule) {
  return {
    real_estate: tx.realEstateListing,
    hotels: tx.hotelProperty,
    vehicles: tx.vehicleListing,
    trips: tx.tripListing,
  }[module] as unknown as ListingTable;
}

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  setStatus(id: string, adminId: string, dto: AdminUserStatusDto) {
    const reason = dto.reason?.trim() || null;
    if (dto.status === 'suspended' && !reason) throw new BadRequestException('Un motif est nécessaire.');
    if (id === adminId) throw new ForbiddenException('Vous ne pouvez pas modifier le statut de votre propre compte.');
    const previous = dto.status === 'suspended' ? 'active' : 'suspended';
    return this.prisma.$transaction(async tx => {
      // The conditional update is the lock: two concurrent decisions cannot both succeed.
      const changed = await tx.user.updateMany({
        where: { id, status: previous, deletedAt: null, role: { not: 'admin' } },
        data: { status: dto.status },
      });
      if (!changed.count) {
        const user = await tx.user.findUnique({ where: { id }, select: { role: true, status: true, deletedAt: true } });
        if (!user || user.deletedAt || user.status === 'deleted') throw new NotFoundException('Compte introuvable.');
        if (user.role === 'admin') throw new ForbiddenException('Un compte administrateur ne peut pas être suspendu ici.');
        throw new ConflictException('Le statut du compte a changé. Actualisez la liste.');
      }
      const listings = dto.status === 'suspended'
        ? await this.suspendListings(tx, id)
        : await this.restoreListings(tx, id);
      if (dto.status === 'suspended') {
        const revokedAt = new Date();
        await tx.userSession.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt } });
        await tx.refreshToken.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt } });
      }
      await tx.auditLog.create({ data: {
        actorUserId: adminId, module: 'users', targetType: 'user', targetId: id,
        action: dto.status === 'suspended' ? SUSPENDED_ACTION : 'account.reactivated',
        metadata: { previousStatus: previous, status: dto.status, reason, listings },
      } });
      const listingsChanged = Object.values(listings).reduce((sum, ids) => sum + ids.length, 0);
      return { id, status: dto.status, listingsChanged };
    });
  }

  /** Withdraws the public listings of the account and returns their ids so that a reactivation restores exactly these. */
  private async suspendListings(tx: Prisma.TransactionClient, ownerUserId: string) {
    const listings: ListingIds = {};
    for (const module of MODERATION_MODULES) {
      const table = listingTable(tx, module);
      const rows = await table.findMany({ where: { ownerUserId, status: 'active', deletedAt: null }, select: { id: true } });
      if (!rows.length) continue;
      const ids = rows.map(row => row.id);
      await table.updateMany({ where: { id: { in: ids }, status: 'active' }, data: { status: 'suspended' } });
      listings[module] = ids;
    }
    return listings;
  }

  /** Restores only the listings withdrawn by the last account suspension that nobody has moderated since. */
  private async restoreListings(tx: Prisma.TransactionClient, ownerUserId: string) {
    const last = await tx.auditLog.findFirst({
      where: { module: 'users', targetType: 'user', targetId: ownerUserId, action: SUSPENDED_ACTION },
      orderBy: { createdAt: 'desc' }, select: { metadata: true, createdAt: true },
    });
    const recorded = (last?.metadata as { listings?: ListingIds } | null)?.listings ?? {};
    const listings: ListingIds = {};
    for (const module of MODERATION_MODULES) {
      const ids = (recorded[module] ?? []).filter(value => typeof value === 'string');
      if (!ids.length) continue;
      const moderated = await tx.auditLog.findMany({
        where: { module, targetType: 'listing', targetId: { in: ids }, createdAt: { gt: last!.createdAt } },
        select: { targetId: true },
      });
      const touched = new Set(moderated.map(row => row.targetId));
      const restorable = ids.filter(value => !touched.has(value));
      if (!restorable.length) continue;
      const table = listingTable(tx, module);
      const where = { id: { in: restorable }, ownerUserId, status: 'suspended', deletedAt: null };
      const rows = await table.findMany({ where, select: { id: true } });
      if (!rows.length) continue;
      await table.updateMany({ where, data: { status: 'active' } });
      listings[module] = rows.map(row => row.id);
    }
    return listings;
  }
}

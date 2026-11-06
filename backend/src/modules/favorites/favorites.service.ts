import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { getPagination } from '../../common/pagination/pagination.dto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { LISTING_MODULES, ListingModule } from '../conversations/conversation-listings';
import { FavoriteListDto } from './favorites.dto';
import { loadCards } from './listing-cards';

const PUBLIC = { status: 'active' as const, deletedAt: null };

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: FavoriteListDto) {
    const pagination = getPagination(query);
    const where = { userId, module: query.module ?? { in: [...LISTING_MODULES] } };
    const [rows, total] = await Promise.all([
      this.prisma.favorite.findMany({ where, skip: pagination.skip, take: pagination.take, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] }),
      this.prisma.favorite.count({ where }),
    ]);
    const cards = new Map<string, Awaited<ReturnType<typeof loadCards>>>();
    for (const module of LISTING_MODULES) {
      const ids = rows.filter((row) => row.module === module).map((row) => row.targetId);
      if (ids.length) cards.set(module, await loadCards(this.prisma, module, ids));
    }
    return {
      data: rows.map((row) => ({ module: row.module, addedAt: row.createdAt, ...cards.get(row.module)!.get(row.targetId)! })),
      meta: pagination.meta(total),
    };
  }

  async check(userId: string, module: ListingModule, ids: string[]) {
    const rows = await this.prisma.favorite.findMany({ where: { userId, module, targetId: { in: ids } }, select: { targetId: true } });
    const saved = new Set(rows.map((row) => row.targetId));
    return { favorites: ids.filter((id) => saved.has(id)) };
  }

  /** Idempotent: a retry, a double click or a concurrent request all end up on one row. */
  async add(userId: string, module: ListingModule, listingId: string) {
    const existing = await this.prisma.favorite.findUnique({ where: { userId_module_targetId: { userId, module, targetId: listingId } } });
    if (existing) return { module, listingId, favorite: true };
    if (!(await this.isPublic(module, listingId))) throw new NotFoundException('Annonce introuvable.');
    try {
      await this.prisma.favorite.create({ data: { id: this.id(userId, module, listingId), userId, module, targetId: listingId } });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
    }
    return { module, listingId, favorite: true };
  }

  async remove(userId: string, module: ListingModule, listingId: string) {
    await this.prisma.favorite.deleteMany({ where: { userId, module, targetId: listingId } });
    return { module, listingId, favorite: false };
  }

  private id(userId: string, module: string, listingId: string) {
    return 'fav_' + createHash('sha256').update(`${userId}:${module}:${listingId}`).digest('hex');
  }

  private async isPublic(module: ListingModule, id: string) {
    const where = { id, ...PUBLIC };
    if (module === 'real_estate') return !!(await this.prisma.realEstateListing.findFirst({ where, select: { id: true } }));
    if (module === 'hotels') return !!(await this.prisma.hotelProperty.findFirst({ where, select: { id: true } }));
    if (module === 'vehicles') return !!(await this.prisma.vehicleListing.findFirst({ where, select: { id: true } }));
    return !!(await this.prisma.tripListing.findFirst({ where, select: { id: true } }));
  }
}

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SavedAlert } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { getPagination, PaginationDto } from '../../common/pagination/pagination.dto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { isListingModule, ListingModule, LISTING_MODULES } from '../conversations/conversation-listings';
import { loadCards } from '../favorites/listing-cards';
import { canonical, CRITERIA_VERSION, Filters, matchWhere, searchUrl, validateFilters } from './alert-criteria';
import { CreateSavedAlertDto, SavedAlertListDto, UpdateSavedAlertDto } from './saved-alerts.dto';

export const MAX_ALERTS_PER_ACCOUNT = 30;
export const processorEnabled = () => process.env.SAVED_ALERTS_PROCESSOR_ENABLED === 'true';

type Criteria = { version: number; name: string; filters: Filters; since: string };

export function readCriteria(alert: Pick<SavedAlert, 'criteria' | 'createdAt'>): Criteria | null {
  const value = (alert.criteria || {}) as Partial<Criteria>;
  // Anything older than this format is kept, but never interpreted.
  if (value.version !== CRITERIA_VERSION || !value.filters) return null;
  return { version: value.version, name: value.name || 'Alerte', filters: value.filters, since: value.since || alert.createdAt.toISOString() };
}

export const listingDelegate = (prisma: PrismaService, module: ListingModule): any =>
  ({ real_estate: prisma.realEstateListing, hotels: prisma.hotelProperty, vehicles: prisma.vehicleListing, trips: prisma.tripListing })[module];

@Injectable()
export class SavedAlertsService {
  constructor(private readonly prisma: PrismaService) {}

  capabilities() {
    return { internalNotifications: processorEnabled(), emailNotifications: false };
  }

  async list(userId: string, query: SavedAlertListDto) {
    const pagination = getPagination(query);
    const where = { userId, module: query.module ?? { in: [...LISTING_MODULES] } };
    const [rows, total] = await Promise.all([
      this.prisma.savedAlert.findMany({ where, skip: pagination.skip, take: pagination.take, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }] }),
      this.prisma.savedAlert.count({ where }),
    ]);
    return { data: rows.map((row) => this.present(row)), meta: pagination.meta(total) };
  }

  async findOne(userId: string, id: string) {
    return this.present(await this.owned(userId, id));
  }

  async create(userId: string, dto: CreateSavedAlertDto) {
    const filters = validateFilters(dto.module, dto.filters);
    const mine = await this.prisma.savedAlert.findMany({ where: { userId }, select: { id: true, module: true, criteria: true, createdAt: true } });
    if (mine.length >= MAX_ALERTS_PER_ACCOUNT) throw new ConflictException(`Vous avez atteint la limite de ${MAX_ALERTS_PER_ACCOUNT} alertes.`);
    this.assertNotDuplicate(mine, dto.module, filters);
    const criteria = { version: CRITERIA_VERSION, name: dto.name, filters, since: new Date().toISOString() };
    const data = { userId, module: dto.module, criteria, active: dto.active ?? true };
    // The id comes from the content: two simultaneous requests cannot both succeed.
    const id = 'alr_' + createHash('sha256').update(`${userId}:${dto.module}:${canonical(filters)}`).digest('hex');
    try {
      return this.present(await this.prisma.savedAlert.create({ data: { ...data, id } }));
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw error;
    }
    const current = await this.prisma.savedAlert.findMany({ where: { userId }, select: { id: true, module: true, criteria: true, createdAt: true } });
    this.assertNotDuplicate(current, dto.module, filters);
    // That id belongs to an alert whose criteria have changed since: this one is still new.
    return this.present(await this.prisma.savedAlert.create({ data: { ...data, id: 'alr_' + randomUUID() } }));
  }

  async update(userId: string, id: string, dto: UpdateSavedAlertDto) {
    const alert = await this.owned(userId, id);
    const criteria = readCriteria(alert);
    if (!criteria || !isListingModule(alert.module)) throw new ConflictException('Cette ancienne alerte ne peut pas être modifiée. Supprimez-la.');
    const next = { ...criteria, name: dto.name ?? criteria.name };
    let restart = false;
    if (dto.filters) {
      next.filters = validateFilters(alert.module, dto.filters);
      if (canonical(next.filters) !== canonical(criteria.filters)) {
        const mine = await this.prisma.savedAlert.findMany({ where: { userId, id: { not: id } }, select: { id: true, module: true, criteria: true, createdAt: true } });
        this.assertNotDuplicate(mine, alert.module, next.filters);
        restart = true;
      }
    }
    if (dto.active === true && !alert.active) restart = true;
    // Changing or resuming an alert never reports listings published in the meantime.
    if (restart) next.since = new Date().toISOString();
    const updated = await this.prisma.savedAlert.update({ where: { id }, data: { criteria: next, ...(dto.active !== undefined ? { active: dto.active } : {}) } });
    return this.present(updated);
  }

  async remove(userId: string, id: string) {
    await this.prisma.savedAlert.deleteMany({ where: { id, userId } });
    return { id, deleted: true };
  }

  async matches(userId: string, id: string, query: PaginationDto) {
    const alert = await this.owned(userId, id);
    const criteria = readCriteria(alert);
    const pagination = getPagination(query);
    if (!criteria || !isListingModule(alert.module)) return { data: [], meta: pagination.meta(0) };
    const delegate = listingDelegate(this.prisma, alert.module);
    const where = matchWhere(alert.module, criteria.filters);
    // Filtered and paged by PostgreSQL, so that a page is never short because of a later filter.
    const [rows, total] = await Promise.all([
      delegate.findMany({ where, skip: pagination.skip, take: pagination.take, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], select: { id: true } }),
      delegate.count({ where }),
    ]);
    const cards = await loadCards(this.prisma, alert.module, rows.map((row: { id: string }) => row.id));
    return { data: rows.map((row: { id: string }) => cards.get(row.id)), meta: pagination.meta(total) };
  }

  private assertNotDuplicate(rows: Pick<SavedAlert, 'module' | 'criteria' | 'createdAt'>[], module: ListingModule, filters: Filters) {
    const wanted = canonical(filters);
    if (rows.some((row) => { const c = row.module === module ? readCriteria(row) : null; return c && canonical(c.filters) === wanted; }))
      throw new ConflictException('Une alerte identique existe déjà.');
  }

  /** Someone else's alert does not exist, as far as this account can tell. */
  private async owned(userId: string, id: string) {
    const alert = await this.prisma.savedAlert.findFirst({ where: { id, userId } });
    if (!alert) throw new NotFoundException('Alerte introuvable.');
    return alert;
  }

  private present(alert: SavedAlert) {
    const criteria = readCriteria(alert);
    const usable = criteria && isListingModule(alert.module);
    return {
      id: alert.id,
      module: alert.module,
      name: criteria?.name ?? 'Ancienne alerte',
      filters: criteria?.filters ?? null,
      active: alert.active,
      usable: !!usable,
      searchUrl: usable ? searchUrl(alert.module as ListingModule, criteria.filters) : null,
      createdAt: alert.createdAt,
      updatedAt: alert.updatedAt,
    };
  }
}

import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { LISTING_MODULES, ListingModule } from '../conversations/conversation-listings';
import { listingUrl, loadCards } from '../favorites/listing-cards';
import { matchWhere, tripOccurrenceWhere } from './alert-criteria';
import { listingDelegate, processorEnabled, readCriteria } from './saved-alerts.service';

const INTERVAL_MS = 60_000;
// A transaction can commit a little after the date it wrote: the scan always looks back this far.
const OVERLAP_MS = 5 * 60_000;
const LISTING_PAGE = 100;
const ALERT_PAGE = 200;
const SCOPE = 'saved_alert_cursor';

/**
 * Reads the active listings themselves, so it covers every way a listing becomes active
 * and needs no hook in any moderation transaction. State lives in PostgreSQL: after a
 * crash it scans again, and the id of a notification makes a second one impossible.
 */
@Injectable()
export class SavedAlertsProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SavedAlertsProcessor.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (!processorEnabled()) return;
    this.timer = setInterval(() => void this.tick(), INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.runOnce();
    } catch {
      this.logger.error('Traitement des alertes interrompu. Une nouvelle tentative aura lieu au prochain passage.');
    } finally {
      this.running = false;
    }
  }

  async runOnce(now = new Date()) {
    let created = 0;
    for (const module of LISTING_MODULES) created += await this.scan(module, now);
    return { created };
  }

  private async scan(module: ListingModule, now: Date) {
    const key = `saved-alerts:cursor:${module}`;
    const cursor = await this.prisma.idempotencyKey.findUnique({ where: { key } });
    const stored = (cursor?.response as { at?: string } | null)?.at;
    // First run: whatever is already online is not news.
    if (!stored) {
      await this.saveCursor(key, now);
      return 0;
    }
    const delegate = listingDelegate(this.prisma, module);
    const from = new Date(new Date(stored).getTime() - OVERLAP_MS);
    let created = 0;
    let after: string | undefined;
    for (;;) {
      const page: any[] = await delegate.findMany({
        where: { status: 'active', deletedAt: null, updatedAt: { gte: from, lte: now }, ...(after ? { id: { gt: after } } : {}) },
        orderBy: { id: 'asc' },
        take: LISTING_PAGE,
      });
      for (const listing of page) created += await this.notify(module, listing, now);
      if (page.length < LISTING_PAGE) break;
      after = page[page.length - 1].id;
    }
    // Saved last: a crash above only means that the same listings are read again.
    await this.saveCursor(key, now);
    return created;
  }

  private async notify(module: ListingModule, listing: any, now: Date) {
    const delegate = listingDelegate(this.prisma, module);
    const title: string = listing.title ?? listing.name;
    const rows: any[] = [];
    let after: string | undefined;
    for (;;) {
      const alerts = await this.prisma.savedAlert.findMany({
        where: { module, active: true, userId: { not: listing.ownerUserId }, ...(after ? { id: { gt: after } } : {}) },
        orderBy: { id: 'asc' },
        take: ALERT_PAGE,
      });
      for (const alert of alerts) {
        const criteria = readCriteria(alert);
        // Only what became active after the alert was set: no retroactive batch.
        if (!criteria || listing.updatedAt < new Date(criteria.since)) continue;
        const matching = await delegate.count({ where: { AND: [{ id: listing.id }, matchWhere(module, criteria.filters, now)] } });
        if (!matching) continue;
        const targetUrl = module === 'trips'
          ? (await loadCards(this.prisma, module, [listing.id], now, tripOccurrenceWhere(criteria.filters, now))).get(listing.id)?.url
          : listingUrl(module, listing.id);
        if (!targetUrl) continue;
        rows.push({
          id: 'ntf_' + createHash('sha256').update(`saved-alert:${alert.id}:${module}:${listing.id}`).digest('hex'),
          userId: alert.userId,
          module,
          type: 'saved_alert_match',
          title: `Nouvelle annonce pour « ${criteria.name} »`,
          message: title,
          targetUrl,
          metadata: { alertId: alert.id, listingId: listing.id },
        });
      }
      if (alerts.length < ALERT_PAGE) break;
      after = alerts[alerts.length - 1].id;
    }
    if (!rows.length) return 0;
    const result = await this.prisma.notification.createMany({ data: rows, skipDuplicates: true });
    return result.count;
  }

  private async saveCursor(key: string, at: Date) {
    const response = { at: at.toISOString() };
    await this.prisma.idempotencyKey.upsert({
      where: { key },
      create: { key, scope: SCOPE, response, expiresAt: new Date('2999-01-01T00:00:00Z') },
      update: { response },
    });
  }
}

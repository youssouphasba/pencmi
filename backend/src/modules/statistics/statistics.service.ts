import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { hasPermission, Permission } from '../../common/constants/permissions';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import {
  LISTING_MODULES,
  ListingModule,
  ownedListings,
  ownerContactScope,
} from '../conversations/conversation-listings';
import { StatisticsReportDto, StatPeriod } from './statistics.dto';

const DAY_MS = 86_400_000;
const MODULE_PERMISSION: Record<ListingModule, Permission> = {
  real_estate: 'manage_real_estate',
  hotels: 'manage_hotels',
  vehicles: 'manage_vehicles',
  trips: 'manage_trips',
};
// Requests and conversations are counted on their own: these are the other contacts.
const DIRECT_SOURCES = ['form', 'whatsapp', 'phone', 'email'] as const;
const ACCEPTED = ['accepted', 'completed'];
const PENDING = ['new', 'pending', 'requires_more_info'];
const TOP_LISTINGS = 10;

const NO_COLLECTION = 'Aucune collecte fiable n’existe pour le moment.';
const UNAVAILABLE = [
  { key: 'views', label: 'Vues', reason: NO_COLLECTION },
  { key: 'detailClicks', label: 'Clics détails', reason: NO_COLLECTION },
  { key: 'channelClicks', label: 'Clics WhatsApp, téléphone et email', reason: NO_COLLECTION },
  { key: 'favorites', label: 'Favoris reçus', reason: 'Les favoris ne sont pas encore enregistrés sur le serveur.' },
  { key: 'viewToContactRate', label: 'Taux vue → contact', reason: 'Les vues ne sont pas mesurées.' },
  { key: 'responseTime', label: 'Délai moyen de réponse', reason: 'Cette mesure n’est pas calculée pour le moment.' },
];
const OCCUPANCY = {
  key: 'occupancyRate',
  label: 'Taux d’occupation',
  reason: 'Le stock déclaré ne fournit pas de total fiable de chambres-nuits sur la période.',
};

type RequestRow = {
  listingId: string;
  type: string;
  status: string;
  createdAt: Date;
  roomId?: string | null;
  requestedSeats?: number;
  allocatedSeats?: number | null;
};

/** Calendar days in Africa/Dakar, which stays at UTC+0 all year round. */
export function periodWindow(period: StatPeriod, now = new Date()) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const count = period === 'today' ? 1 : Number(period);
  const from = new Date(today - (count - 1) * DAY_MS);
  const days = Array.from({ length: count }, (_, index) => dayKey(new Date(from.getTime() + index * DAY_MS)));
  return { from, to: now, days };
}

function dayKey(date: Date) {
  return new Date(date).toISOString().slice(0, 10);
}

function countBy<T>(rows: T[], key: (row: T) => string) {
  const counts: Record<string, number> = {};
  for (const row of rows) counts[key(row)] = (counts[key(row)] || 0) + 1;
  return counts;
}

@Injectable()
export class StatisticsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Former summary: every figure is now limited to the listings of this owner. */
  async findDashboardStats(ownerUserId: string, module?: ListingModule) {
    const scopes = await Promise.all(
      (module ? [module] : LISTING_MODULES).map(async (name) => ({
        name,
        ids: (await ownedListings(this.prisma, name, ownerUserId)).map((row) => row.id),
      })),
    );
    const [trackingEvents, contacts, notifications] = await Promise.all([
      this.prisma.trackingEvent.count({
        where: { OR: scopes.map(({ name, ids }) => ({ module: name, targetType: 'listing' as const, targetId: { in: ids } })) },
      }),
      this.prisma.contactEvent.count({
        where: { OR: scopes.map(({ name, ids }) => ownerContactScope(name, ownerUserId, ids)) },
      }),
      this.prisma.notification.count({ where: { userId: ownerUserId } }),
    ]);
    return { trackingEvents, contacts, notifications };
  }

  async report(user: AuthenticatedUser, query: StatisticsReportDto) {
    const { module, listingId } = query;
    if (!hasPermission(user.role, MODULE_PERMISSION[module]))
      throw new ForbiddenException('Accès non autorisé.');
    const period = query.period ?? '30';
    const owned = await this.listings(module, user.id);
    if (listingId && !owned.some((row) => row.id === listingId))
      throw new NotFoundException('Annonce introuvable.');
    const selected = listingId ? owned.filter((row) => row.id === listingId) : owned;
    const ids = selected.map((row) => row.id);
    const window = periodWindow(period);
    const createdAt = { gte: window.from, lte: window.to };

    const [requests, contacts, conversations] = await Promise.all([
      this.requests(module, ids, createdAt),
      this.prisma.contactEvent.findMany({
        where: { ...ownerContactScope(module, user.id, ids), source: { in: [...DIRECT_SOURCES] }, createdAt },
        select: { source: true, targetId: true, createdAt: true },
      }),
      this.prisma.conversation.findMany({
        where: { module, targetType: 'listing', targetId: { in: ids }, participants: { some: { userId: user.id } } },
        select: { id: true, targetId: true, createdAt: true },
      }),
    ]);
    const inbound = await this.prisma.message.findMany({
      where: { conversationId: { in: conversations.map((row) => row.id) }, senderUserId: { not: user.id }, hiddenAt: null, createdAt },
      select: { conversationId: true, createdAt: true },
    });

    const listingOf = new Map(conversations.map((row) => [row.id, row.targetId]));
    const accepted = requests.filter((row) => ACCEPTED.includes(row.status)).length;
    const ranking = selected.map((listing) => ({
      id: listing.id,
      title: listing.title,
      status: listing.status,
      deleted: listing.deleted,
      requests: requests.filter((row) => row.listingId === listing.id).length,
      contacts: contacts.filter((row) => row.targetId === listing.id).length,
      inboundMessages: inbound.filter((row) => listingOf.get(row.conversationId) === listing.id).length,
    }));
    const visible = selected.filter((row) => !row.deleted);

    return {
      module,
      listingId: listingId ?? null,
      period: { key: period, from: window.from, to: window.to, timezone: 'Africa/Dakar' },
      // Not limited by period: the state of the listings today.
      listings: { total: visible.length, deleted: selected.length - visible.length, byStatus: countBy(visible, (row) => row.status) },
      options: owned.map(({ id, title, status, deleted }) => ({ id, title, status, deleted })),
      requests: {
        total: requests.length,
        accepted,
        pending: requests.filter((row) => PENDING.includes(row.status)).length,
        byStatus: countBy(requests, (row) => row.status),
        byType: countBy(requests, (row) => row.type),
      },
      acceptanceRate: { accepted, received: requests.length, value: requests.length ? accepted / requests.length : null },
      contacts: { direct: contacts.length, bySource: countBy(contacts, (row) => row.source) },
      messages: {
        conversationsOpened: conversations.filter((row) => row.createdAt >= window.from && row.createdAt <= window.to).length,
        inbound: inbound.length,
      },
      requestsByListing: countBy(requests, (row) => row.listingId),
      series: this.series(window.days, requests, contacts, inbound),
      topListings: {
        rankedBy: 'requests',
        rows: [...ranking]
          .filter((row) => row.requests || row.contacts || row.inboundMessages)
          .sort((a, b) => b.requests - a.requests || b.contacts - a.contacts || b.inboundMessages - a.inboundMessages || a.id.localeCompare(b.id))
          .slice(0, TOP_LISTINGS),
      },
      activeWithoutActivity: ranking
        .filter((row) => row.status === 'active' && !row.deleted && !row.requests && !row.contacts && !row.inboundMessages)
        .map(({ id, title }) => ({ id, title })),
      ...(module === 'hotels' ? { hotels: await this.hotelDetails(ids, requests, window) } : {}),
      ...(module === 'trips' ? { trips: this.tripDetails(requests) } : {}),
      unavailable: module === 'hotels' ? [...UNAVAILABLE, OCCUPANCY] : UNAVAILABLE,
    };
  }

  private series(days: string[], requests: RequestRow[], contacts: { createdAt: Date }[], inbound: { createdAt: Date }[]) {
    const byDay = (rows: { createdAt: Date }[]) => countBy(rows, (row) => dayKey(row.createdAt));
    const [r, c, m] = [byDay(requests), byDay(contacts), byDay(inbound)];
    return days.map((date) => ({ date, requests: r[date] || 0, contacts: c[date] || 0, inboundMessages: m[date] || 0 }));
  }

  /** Every listing of the owner, with deleted ones kept apart so that history stays attributable. */
  private async listings(module: ListingModule, ownerUserId: string) {
    const where = { ownerUserId };
    if (module === 'hotels') {
      const rows = await this.prisma.hotelProperty.findMany({ where, select: { id: true, name: true, status: true, deletedAt: true } });
      return rows.map((row) => ({ id: row.id, title: row.name, status: row.status as string, deleted: !!row.deletedAt }));
    }
    const delegate: any = { real_estate: this.prisma.realEstateListing, vehicles: this.prisma.vehicleListing, trips: this.prisma.tripListing }[module];
    const rows: { id: string; title: string; status: string; deletedAt: Date | null }[] = await delegate.findMany({
      where,
      select: { id: true, title: true, status: true, deletedAt: true },
    });
    return rows.map((row) => ({ id: row.id, title: row.title, status: row.status, deleted: !!row.deletedAt }));
  }

  private async requests(module: ListingModule, ids: string[], createdAt: { gte: Date; lte: Date }): Promise<RequestRow[]> {
    const select = { status: true, createdAt: true };
    if (module === 'real_estate') {
      const rows = await this.prisma.realEstateVisitRequest.findMany({ where: { listingId: { in: ids }, createdAt }, select: { ...select, listingId: true } });
      return rows.map((row) => ({ ...row, type: 'visit' }));
    }
    if (module === 'hotels') {
      const rows = await this.prisma.hotelReservationRequest.findMany({ where: { propertyId: { in: ids }, createdAt }, select: { ...select, propertyId: true, roomId: true } });
      return rows.map(({ propertyId, ...row }) => ({ ...row, listingId: propertyId, type: 'reservation' }));
    }
    if (module === 'vehicles') {
      const [rentals, chauffeurs] = await Promise.all([
        this.prisma.vehicleRentalRequest.findMany({ where: { listingId: { in: ids }, createdAt }, select: { ...select, listingId: true } }),
        this.prisma.vehicleChauffeurRequest.findMany({ where: { listingId: { in: ids }, createdAt }, select: { ...select, listingId: true } }),
      ]);
      return [...rentals.map((row) => ({ ...row, type: 'rental' })), ...chauffeurs.map((row) => ({ ...row, type: 'chauffeur' }))];
    }
    const rows = await this.prisma.tripSeatRequest.findMany({
      where: { tripId: { in: ids }, createdAt },
      select: { ...select, tripId: true, requestedSeats: true, allocatedSeats: true },
    });
    return rows.map(({ tripId, ...row }) => ({ ...row, listingId: tripId, type: 'seat' }));
  }

  /** Room nights come from the stock really allocated, never from the requests. */
  private async hotelDetails(ids: string[], requests: RequestRow[], window: { from: Date; to: Date }) {
    const rooms = await this.prisma.hotelRoom.findMany({ where: { propertyId: { in: ids } }, select: { id: true, name: true, status: true } });
    const allocations = await this.prisma.hotelStockAllocation.findMany({
      where: { roomId: { in: rooms.map((row) => row.id) }, releasedAt: null, date: { gte: window.from, lte: window.to } },
      select: { units: true },
    });
    return {
      rooms: { total: rooms.length, active: rooms.filter((row) => row.status === 'active').length },
      allocatedRoomNights: allocations.reduce((sum, row) => sum + row.units, 0),
      topRooms: rooms
        .map((room) => ({ id: room.id, name: room.name, requests: requests.filter((row) => row.roomId === room.id).length }))
        .filter((row) => row.requests)
        .sort((a, b) => b.requests - a.requests || a.id.localeCompare(b.id))
        .slice(0, TOP_LISTINGS),
    };
  }

  /** Seats asked for and seats really allocated stay two separate figures. */
  private tripDetails(requests: RequestRow[]) {
    const accepted = requests.filter((row) => ACCEPTED.includes(row.status));
    return {
      requestedSeats: requests.reduce((sum, row) => sum + (row.requestedSeats || 0), 0),
      allocatedSeats: accepted.reduce((sum, row) => sum + (row.allocatedSeats || 0), 0),
      historicalUnallocatedRequests: accepted.filter((row) => row.allocatedSeats === null || row.allocatedSeats === undefined).length,
    };
  }
}

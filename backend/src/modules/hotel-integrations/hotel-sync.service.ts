import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import { PrismaService } from '../../database/prisma/prisma.service';
import { queueHotelChannelEvent } from '../hotels/hotel-channel-events';
import {
  HOTEL_ICAL_FRESHNESS_MS,
  MAX_HOTEL_STAY_NIGHTS,
  hotelDate,
  hotelSyncMode,
  hotelToday,
  parseHotelInput,
} from '../hotels/hotel-inventory';
import {
  buildIcal,
  fetchIcal,
  HOTEL_ICAL_HORIZON_DAYS,
  HotelIcalError,
  icalStaysFromAllocations,
  parseIcalNights,
  parseIcalUrl,
} from './hotel-ical';

export type HotelChannelPartnerContext = { id: string; code: string };

/** A calendar is read again after this delay. */
export const HOTEL_ICAL_REFRESH_MS = 15 * 60_000;
export const MAX_ICAL_IMPORTS_PER_ROOM = 5;
export const HOTEL_CHANNEL_RATE_PLAN = 'channel';
const CHANNEL_EVENTS_PAGE = 100;

const isoDay = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value), 'Date invalide.');

const syncSettingsSchema = z
  .object({
    mode: z.enum(['none', 'ical', 'channel_manager']),
    autoConfirm: z.boolean().default(false),
    partnerCode: z.string().trim().min(1).max(64).optional(),
  })
  .strict();
const icalImportSchema = z
  .object({
    url: z.string().trim().min(8).max(2000),
    unitsPerEvent: z.number().int().min(1).max(50).default(1),
  })
  .strict();
const inventoryItemSchema = z
  .object({
    roomCode: z.string().min(1).max(64),
    start: isoDay,
    end: isoDay,
    available: z.number().int().min(0).max(10_000).optional(),
    closed: z.boolean().optional(),
    price: z.number().int().min(0).max(100_000_000).optional(),
    currency: z.enum(['FCFA', 'XOF']).optional(),
    stopSell: z.boolean().optional(),
    // null lifts the restriction.
    minStay: z.number().int().min(1).max(MAX_HOTEL_STAY_NIGHTS).nullable().optional(),
    maxStay: z.number().int().min(1).max(MAX_HOTEL_STAY_NIGHTS).nullable().optional(),
  })
  .strict()
  .refine((item) => item.end >= item.start, { message: 'La fin précède le début.', path: ['end'] })
  .refine((item) => !item.minStay || !item.maxStay || item.minStay <= item.maxStay, {
    message: 'Le séjour minimum dépasse le séjour maximum.',
    path: ['maxStay'],
  })
  .refine(
    (item) =>
      [item.available, item.closed, item.price, item.stopSell, item.minStay, item.maxStay].some((value) => value !== undefined),
    { message: 'Indiquez au moins available, closed, price, stopSell, minStay ou maxStay.' },
  );
const inventorySchema = z.object({ items: z.array(inventoryItemSchema).min(1).max(200) }).strict();
const ackSchema = z.object({ eventIds: z.array(z.string().min(1).max(64)).min(1).max(CHANNEL_EVENTS_PAGE) }).strict();

const addDays = (value: string, days: number) =>
  new Date(Date.parse(`${value}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
const utcDay = (value: string) => new Date(`${value}T00:00:00Z`);
function daysBetween(start: string, end: string) {
  const days: string[] = [];
  for (let current = start; current <= end; current = addDays(current, 1)) days.push(current);
  return days;
}
const icalPath = (token: string) =>
  `/${(process.env.API_PREFIX || 'api/v1').replace(/^\/+|\/+$/g, '')}/hotel-calendars/${token}.ics`;
const publicIcalUrl = (token: string) => {
  const base = process.env.BACKEND_URL?.replace(/\/+$/, '');
  return base ? `${base}${icalPath(token)}` : null;
};

@Injectable()
export class HotelSyncService {
  private readonly logger = new Logger(HotelSyncService.name);
  /** Replaced in tests: no network access there. */
  fetcher: (url: string) => Promise<string> = fetchIcal;

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------- Hotelier settings

  async view(ownerUserId: string, propertyId: string) {
    await this.assertHotelOwner(ownerUserId, propertyId);
    const integration = await this.prisma.hotelIntegration.upsert({
      where: { propertyId },
      create: { propertyId },
      update: {},
      include: { channelPartner: { select: { code: true, name: true, active: true } } },
    });
    const [rooms, partners, pendingEvents] = await Promise.all([
      this.prisma.hotelRoom.findMany({
        where: { propertyId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true, name: true, status: true, capacity: true, metadata: true, icalExportToken: true,
          icalImports: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true, url: true, unitsPerEvent: true, active: true, lastAttemptAt: true,
              lastSuccessAt: true, lastError: true, _count: { select: { blocks: true } },
            },
          },
        },
      }),
      this.prisma.hotelChannelPartner.findMany({
        where: { active: true },
        orderBy: { name: 'asc' },
        select: { code: true, name: true },
      }),
      this.prisma.hotelChannelEvent.count({ where: { integrationId: integration.id, ackedAt: null } }),
    ]);
    return {
      mode: hotelSyncMode(integration),
      autoConfirm: integration.autoConfirm && hotelSyncMode(integration) !== 'none',
      hotelCode: integration.hotelCode,
      channelPartner: integration.channelPartner,
      lastSyncAt: integration.lastSyncAt,
      partners,
      icalFreshnessHours: HOTEL_ICAL_FRESHNESS_MS / 3600_000,
      icalRefreshMinutes: HOTEL_ICAL_REFRESH_MS / 60_000,
      pendingChannelEvents: pendingEvents,
      rooms: rooms.map((room) => ({
        id: room.id,
        roomCode: room.id,
        name: room.name,
        status: room.status,
        capacity: room.capacity,
        totalUnits: (room.metadata as any)?.totalUnits ?? null,
        icalExportPath: room.icalExportToken ? icalPath(room.icalExportToken) : null,
        icalExportUrl: room.icalExportToken ? publicIcalUrl(room.icalExportToken) : null,
        imports: room.icalImports.map(({ _count, ...entry }) => ({ ...entry, blockedNights: _count.blocks })),
      })),
    };
  }

  async updateSettings(ownerUserId: string, propertyId: string, body: unknown) {
    const input = parseHotelInput(syncSettingsSchema, body);
    await this.assertHotelOwner(ownerUserId, propertyId);
    await this.prisma.$transaction(
      async (tx) => {
        const current = await tx.hotelIntegration.upsert({
          where: { propertyId },
          create: { propertyId },
          update: {},
        });
        await tx.$queryRaw`SELECT id FROM "HotelIntegration" WHERE id = ${current.id} FOR UPDATE`;
        const previous = await tx.hotelIntegration.findUniqueOrThrow({ where: { id: current.id } });
        let partnerId: string | null = null;
        let hotelCode = previous.hotelCode;
        if (input.mode === 'channel_manager') {
          if (!input.partnerCode) throw new BadRequestException('Choisissez votre channel manager.');
          const partner = await tx.hotelChannelPartner.findFirst({
            where: { code: input.partnerCode, active: true },
            select: { id: true },
          });
          if (!partner) throw new BadRequestException('Ce channel manager n’est pas encore relié à Pencmi.');
          partnerId = partner.id;
          hotelCode ??= await this.newHotelCode(tx);
        }
        const updated = await tx.hotelIntegration.update({
          where: { id: previous.id },
          data: {
            syncMode: input.mode,
            autoConfirm: input.mode !== 'none' && input.autoConfirm,
            channelPartnerId: partnerId,
            hotelCode,
            // Synchronisation keeps the confirmation on Pencmi: the hotel software is told afterwards.
            ...(input.mode !== 'none' ? { status: 'active' } : {}),
          },
        });
        const entering =
          input.mode === 'channel_manager' &&
          (hotelSyncMode(previous) !== 'channel_manager' || previous.channelPartnerId !== partnerId);
        if (entering) await this.handOverToChannel(tx, updated);
        await tx.auditLog.create({
          data: {
            actorUserId: ownerUserId,
            action: 'hotel_sync.settings_updated',
            module: 'hotels',
            targetType: 'listing',
            targetId: propertyId,
            metadata: {
              from: hotelSyncMode(previous),
              to: input.mode,
              autoConfirm: updated.autoConfirm,
              partnerCode: input.mode === 'channel_manager' ? input.partnerCode : null,
            },
          },
        });
      },
      { maxWait: 10000, timeout: 30000 },
    );
    return this.view(ownerUserId, propertyId);
  }

  /**
   * A channel manager starts from nothing: it receives every stay still to come, and the
   * availability it sent before does not count them yet.
   */
  private async handOverToChannel(tx: any, integration: any) {
    await tx.hotelChannelEvent.deleteMany({ where: { integrationId: integration.id } });
    await tx.hotelStockAllocation.updateMany({
      where: { releasedAt: null, room: { propertyId: integration.propertyId } },
      data: { channelAckedAt: null },
    });
    const upcoming = await tx.hotelReservationRequest.findMany({
      where: {
        propertyId: integration.propertyId,
        status: 'accepted',
        checkOut: { gt: utcDay(hotelToday()) },
        allocations: { some: { releasedAt: null } },
      },
      orderBy: { checkIn: 'asc' },
      select: { id: true },
    });
    for (const request of upcoming) await queueHotelChannelEvent(tx, integration, request.id, 'commit');
  }

  private async newHotelCode(tx: any) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = `PCM${randomBytes(5).toString('hex').toUpperCase()}`;
      if (!(await tx.hotelIntegration.findUnique({ where: { hotelCode: code }, select: { id: true } }))) return code;
    }
    throw new Error('hotel code generation failed');
  }

  async createIcalExport(ownerUserId: string, propertyId: string, roomId: string) {
    await this.assertRoom(ownerUserId, propertyId, roomId);
    // A new link replaces the previous one, which stops working.
    const token = randomBytes(24).toString('base64url');
    await this.prisma.hotelRoom.update({ where: { id: roomId }, data: { icalExportToken: token } });
    return { roomId, icalExportPath: icalPath(token), icalExportUrl: publicIcalUrl(token) };
  }

  async deleteIcalExport(ownerUserId: string, propertyId: string, roomId: string) {
    await this.assertRoom(ownerUserId, propertyId, roomId);
    await this.prisma.hotelRoom.update({ where: { id: roomId }, data: { icalExportToken: null } });
    return { roomId, icalExportPath: null, icalExportUrl: null };
  }

  async addIcalImport(ownerUserId: string, propertyId: string, roomId: string, body: unknown) {
    const input = parseHotelInput(icalImportSchema, body);
    await this.assertRoom(ownerUserId, propertyId, roomId);
    let url: URL;
    try {
      url = parseIcalUrl(input.url);
    } catch (error) {
      throw new BadRequestException((error as Error).message);
    }
    if (url.pathname.includes('/hotel-calendars/'))
      throw new BadRequestException('Collez le lien publié par votre logiciel, pas celui de Pencmi.');
    const count = await this.prisma.hotelIcalImport.count({ where: { roomId } });
    if (count >= MAX_ICAL_IMPORTS_PER_ROOM)
      throw new BadRequestException(`Une chambre accepte au plus ${MAX_ICAL_IMPORTS_PER_ROOM} calendriers.`);
    const entry = await this.prisma.hotelIcalImport.create({
      data: { roomId, url: url.toString(), unitsPerEvent: input.unitsPerEvent },
      select: { id: true },
    });
    // Read at once, so the hotelier sees right away whether the link works.
    await this.refreshImport(entry.id);
    return this.prisma.hotelIcalImport.findUniqueOrThrow({
      where: { id: entry.id },
      select: {
        id: true, roomId: true, url: true, unitsPerEvent: true, active: true, lastAttemptAt: true,
        lastSuccessAt: true, lastError: true, _count: { select: { blocks: true } },
      },
    }).then(({ _count, ...rest }) => ({ ...rest, blockedNights: _count.blocks }));
  }

  async deleteIcalImport(ownerUserId: string, propertyId: string, importId: string) {
    const entry = await this.prisma.hotelIcalImport.findFirst({
      where: { id: importId, room: { propertyId, property: { ownerUserId, deletedAt: null } } },
      select: { id: true },
    });
    if (!entry) throw new NotFoundException('Calendrier introuvable.');
    await this.prisma.hotelIcalImport.delete({ where: { id: entry.id } });
    return { id: importId, deleted: true };
  }

  // ---------------------------------------------------------------- iCal

  /** The calendar of the nights Pencmi holds on a room, read by the hotel software. */
  async exportCalendar(rawToken: string) {
    const token = rawToken.replace(/\.ics$/i, '');
    if (!/^[A-Za-z0-9_-]{32}$/.test(token)) throw new NotFoundException('Calendrier introuvable.');
    const room = await this.prisma.hotelRoom.findUnique({
      where: { icalExportToken: token },
      select: { id: true, name: true, property: { select: { name: true, deletedAt: true } } },
    });
    if (!room || room.property.deletedAt) throw new NotFoundException('Calendrier introuvable.');
    const today = hotelToday();
    const allocations = await this.prisma.hotelStockAllocation.findMany({
      where: {
        roomId: room.id,
        releasedAt: null,
        date: { gte: utcDay(addDays(today, -1)), lt: utcDay(addDays(today, HOTEL_ICAL_HORIZON_DAYS)) },
      },
      select: { requestId: true, date: true, units: true },
    });
    return buildIcal(`Pencmi - ${room.property.name} - ${room.name}`, icalStaysFromAllocations(allocations));
  }

  /** Reads one calendar and replaces the nights it blocks. A failure keeps the previous ones. */
  async refreshImport(importId: string, now = new Date()) {
    const entry = await this.prisma.hotelIcalImport.findUnique({
      where: { id: importId },
      select: { id: true, url: true, unitsPerEvent: true, roomId: true },
    });
    if (!entry) return false;
    try {
      const text = await this.fetcher(entry.url);
      const nights = parseIcalNights(text, { unitsPerEvent: entry.unitsPerEvent, today: utcDay(hotelToday(now)) });
      await this.prisma.$transaction([
        this.prisma.hotelExternalBlock.deleteMany({ where: { importId: entry.id } }),
        this.prisma.hotelExternalBlock.createMany({
          data: [...nights].map(([date, units]) => ({ importId: entry.id, roomId: entry.roomId, date: utcDay(date), units })),
        }),
        this.prisma.hotelIcalImport.update({
          where: { id: entry.id },
          data: { lastAttemptAt: now, lastSuccessAt: now, lastError: null },
        }),
      ]);
      return true;
    } catch (error) {
      const message = error instanceof HotelIcalError ? error.message : 'Lecture du calendrier impossible.';
      if (!(error instanceof HotelIcalError)) this.logger.warn(`Calendrier ${entry.id} : lecture interrompue.`);
      await this.prisma.hotelIcalImport
        .updateMany({ where: { id: entry.id }, data: { lastAttemptAt: now, lastError: message } })
        .catch(() => undefined);
      return false;
    }
  }

  /** Reads the calendars due for a refresh. Each one is claimed first: several servers can run it. */
  async refreshDue(now = new Date(), limit = 20) {
    const due = await this.prisma.hotelIcalImport.findMany({
      where: {
        active: true,
        room: { property: { deletedAt: null } },
        OR: [{ lastAttemptAt: null }, { lastAttemptAt: { lt: new Date(now.valueOf() - HOTEL_ICAL_REFRESH_MS) } }],
      },
      orderBy: { lastAttemptAt: { sort: 'asc', nulls: 'first' } },
      take: limit,
      select: { id: true, lastAttemptAt: true },
    });
    let refreshed = 0;
    for (const entry of due) {
      const claim = await this.prisma.hotelIcalImport.updateMany({
        where: { id: entry.id, lastAttemptAt: entry.lastAttemptAt },
        data: { lastAttemptAt: now },
      });
      if (!claim.count) continue;
      if (await this.refreshImport(entry.id, now)) refreshed += 1;
    }
    return { due: due.length, refreshed };
  }

  // ---------------------------------------------------------------- Channel manager

  private async channelIntegration(partner: HotelChannelPartnerContext, hotelCode: string) {
    const integration = await this.prisma.hotelIntegration.findUnique({
      where: { hotelCode },
      include: { property: { select: { id: true, deletedAt: true } } },
    });
    if (
      !integration ||
      integration.channelPartnerId !== partner.id ||
      hotelSyncMode(integration) !== 'channel_manager' ||
      integration.property.deletedAt
    )
      throw new NotFoundException('Établissement inconnu pour ce channel manager.');
    return integration;
  }

  async channelRooms(partner: HotelChannelPartnerContext, hotelCode: string) {
    const integration = await this.channelIntegration(partner, hotelCode);
    const rooms = await this.prisma.hotelRoom.findMany({
      where: { propertyId: integration.propertyId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true, roomType: true, capacity: true, status: true },
    });
    return {
      hotelCode,
      currency: 'FCFA',
      ratePlan: HOTEL_CHANNEL_RATE_PLAN,
      rooms: rooms.map((room) => ({
        roomCode: room.id, name: room.name, roomType: room.roomType,
        capacity: room.capacity, bookable: room.status === 'active',
      })),
    };
  }

  /**
   * Availability and rates sent by the channel manager, by date range (both ends
   * included). The availability sent is the number of units still sellable.
   */
  async channelInventory(partner: HotelChannelPartnerContext, hotelCode: string, body: unknown) {
    const input = parseHotelInput(inventorySchema, body);
    const integration = await this.channelIntegration(partner, hotelCode);
    const rooms = await this.prisma.hotelRoom.findMany({
      where: { propertyId: integration.propertyId },
      select: { id: true },
    });
    const known = new Set(rooms.map((room) => room.id));
    const today = hotelToday();
    const horizon = addDays(today, HOTEL_ICAL_HORIZON_DAYS);
    input.items.forEach((item, index) => {
      if (!known.has(item.roomCode))
        throw new BadRequestException({ message: 'Chambre inconnue.', fields: [{ path: `items.${index}.roomCode`, message: 'Chambre inconnue.' }] });
      if (item.end > horizon)
        throw new BadRequestException({ message: `Dates au-delà de ${HOTEL_ICAL_HORIZON_DAYS} jours.`, fields: [{ path: `items.${index}.end`, message: 'Trop loin dans le futur.' }] });
    });
    let days = 0;
    await this.prisma.$transaction(
      async (tx) => {
        for (const item of input.items) {
          const start = item.start < today ? today : item.start;
          if (item.end < start) continue;
          const range = daysBetween(start, item.end);
          days += range.length;
          const where = { roomId: item.roomCode, date: { gte: utcDay(start), lte: utcDay(item.end) } };
          if (item.available !== undefined || item.closed !== undefined) {
            const status = item.closed === true ? 'closed' : 'open';
            await tx.hotelRoomAvailability.createMany({
              data: range.map((date) => ({ roomId: item.roomCode, date: utcDay(date), available: item.available ?? 0, status })),
              skipDuplicates: true,
            });
            await tx.hotelRoomAvailability.updateMany({
              where,
              data: { ...(item.available !== undefined ? { available: item.available } : {}), status, reliableUntil: null },
            });
          }
          if (item.price !== undefined) {
            await tx.hotelRoomRate.createMany({
              data: range.map((date) => ({
                roomId: item.roomCode, date: utcDay(date), ratePlan: HOTEL_CHANNEL_RATE_PLAN, price: item.price!, currency: 'FCFA',
              })),
              skipDuplicates: true,
            });
            await tx.hotelRoomRate.updateMany({
              where: { ...where, ratePlan: HOTEL_CHANNEL_RATE_PLAN },
              data: { price: item.price, currency: 'FCFA' },
            });
          }
          const restriction = {
            ...(item.stopSell !== undefined ? { stopSell: item.stopSell } : {}),
            ...(item.minStay !== undefined ? { minStay: item.minStay } : {}),
            ...(item.maxStay !== undefined ? { maxStay: item.maxStay } : {}),
          };
          if (Object.keys(restriction).length) {
            await tx.hotelRestriction.createMany({
              data: range.map((date) => ({ roomId: item.roomCode, date: utcDay(date) })),
              skipDuplicates: true,
            });
            await tx.hotelRestriction.updateMany({ where, data: restriction });
          }
        }
        await tx.hotelIntegration.update({ where: { id: integration.id }, data: { lastSyncAt: new Date() } });
      },
      { maxWait: 10000, timeout: 60000 },
    );
    return { hotelCode, items: input.items.length, days };
  }

  /**
   * Reservations to record in the hotel software, oldest first, until acknowledged.
   * They are marked delivered before being read: from then on Pencmi sends a
   * cancellation instead of silently withdrawing them.
   */
  async channelReservations(partner: HotelChannelPartnerContext, hotelCode: string) {
    const integration = await this.channelIntegration(partner, hotelCode);
    const now = new Date();
    await this.prisma.hotelChannelEvent.updateMany({
      where: { integrationId: integration.id, ackedAt: null, deliveredAt: null },
      data: { deliveredAt: now },
    });
    const events = await this.prisma.hotelChannelEvent.findMany({
      where: { integrationId: integration.id, ackedAt: null, deliveredAt: { not: null } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: CHANNEL_EVENTS_PAGE,
      select: {
        id: true, kind: true, createdAt: true,
        request: {
          select: {
            id: true, roomId: true, checkIn: true, checkOut: true, units: true, guests: true,
            clientName: true, clientPhone: true, clientEmail: true, message: true, createdAt: true,
            room: { select: { name: true } },
          },
        },
      },
    });
    const reservations = [];
    for (const event of events) {
      const request = event.request;
      const checkIn = request.checkIn ? hotelDate(request.checkIn) : null;
      const checkOut = request.checkOut ? hotelDate(request.checkOut) : null;
      reservations.push({
        eventId: event.id,
        type: event.kind,
        queuedAt: event.createdAt,
        reservation: {
          id: request.id,
          roomCode: request.roomId,
          roomName: request.room?.name ?? null,
          checkIn,
          checkOut,
          units: request.units,
          guests: request.guests,
          createdAt: request.createdAt,
          ...(event.kind === 'commit'
            ? {
                guest: { name: request.clientName, phone: request.clientPhone, email: request.clientEmail },
                message: request.message,
                total: await this.channelTotal(request.roomId, checkIn, checkOut, request.units),
                currency: 'FCFA',
              }
            : {}),
        },
      });
    }
    return { hotelCode, events: reservations };
  }

  /** Price of the stay from the rates the channel manager sent, when every night has one. */
  private async channelTotal(roomId: string | null, checkIn: string | null, checkOut: string | null, units: number | null) {
    if (!roomId || !checkIn || !checkOut || !units || checkOut <= checkIn) return null;
    const rates = await this.prisma.hotelRoomRate.findMany({
      where: { roomId, ratePlan: HOTEL_CHANNEL_RATE_PLAN, date: { gte: utcDay(checkIn), lt: utcDay(checkOut) } },
      select: { price: true },
    });
    const nights = daysBetween(checkIn, addDays(checkOut, -1)).length;
    if (rates.length !== nights) return null;
    return rates.reduce((sum, rate) => sum + rate.price, 0) * units;
  }

  async channelAcknowledge(partner: HotelChannelPartnerContext, hotelCode: string, body: unknown) {
    const input = parseHotelInput(ackSchema, body);
    const integration = await this.channelIntegration(partner, hotelCode);
    return this.prisma.$transaction(async (tx) => {
      const events = await tx.hotelChannelEvent.findMany({
        where: { id: { in: input.eventIds }, integrationId: integration.id, ackedAt: null, deliveredAt: { not: null } },
        select: { id: true, kind: true, requestId: true },
      });
      const now = new Date();
      await tx.hotelChannelEvent.updateMany({
        where: { id: { in: events.map((event) => event.id) }, ackedAt: null },
        data: { ackedAt: now },
      });
      // From now on the availability the channel manager sends already deducts these stays.
      const committed = events.filter((event) => event.kind === 'commit').map((event) => event.requestId);
      if (committed.length)
        await tx.hotelStockAllocation.updateMany({
          where: { requestId: { in: committed }, releasedAt: null, channelAckedAt: null },
          data: { channelAckedAt: now },
        });
      return { hotelCode, acknowledged: events.length };
    });
  }

  // ---------------------------------------------------------------- Guards

  private async assertHotelOwner(ownerUserId: string, propertyId: string) {
    const hotel = await this.prisma.hotelProperty.findFirst({
      where: { id: propertyId, ownerUserId, deletedAt: null },
      select: { id: true },
    });
    if (!hotel) throw new ForbiddenException('Accès non autorisé.');
  }

  private async assertRoom(ownerUserId: string, propertyId: string, roomId: string) {
    await this.assertHotelOwner(ownerUserId, propertyId);
    const room = await this.prisma.hotelRoom.findFirst({ where: { id: roomId, propertyId }, select: { id: true } });
    if (!room) throw new NotFoundException('Chambre introuvable.');
  }
}

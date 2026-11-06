import { Injectable } from '@nestjs/common';
import { ContactSource, Prisma } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { getPagination, PaginationDto } from '../../common/pagination/pagination.dto';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  displayName,
  LISTING_MODULES,
  ListingModule,
  ownedListings,
} from '../conversations/conversation-listings';

export class ContactListDto extends PaginationDto {
  @IsOptional() @IsIn(LISTING_MODULES) module?: ListingModule;
  @IsOptional() @IsEnum(ContactSource) source?: ContactSource;
  @IsOptional() @IsString() @MaxLength(80) listingId?: string;
}

const clientFields = { id: true, clientName: true, clientPhone: true, clientEmail: true, message: true, status: true };

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMine(ownerUserId: string, query: ContactListDto = {} as ContactListDto) {
    const pagination = getPagination(query);
    const modules = query.module ? [query.module] : [...LISTING_MODULES];
    const titles = new Map<string, string>();
    const scopes: Prisma.ContactEventWhereInput[] = [];
    for (const module of modules) {
      const owned = await ownedListings(this.prisma, module, ownerUserId);
      owned.forEach((row) => titles.set(`${module}:${row.id}`, row.title));
      const ids = owned.map((row) => row.id);
      scopes.push({
        module,
        targetType: 'listing',
        targetId: { in: query.listingId ? ids.filter((id) => id === query.listingId) : ids },
        // Older visit and reservation events carry no owner: the listing proves it.
        OR: [{ ownerUserId }, { ownerUserId: null }],
      });
    }
    const where: Prisma.ContactEventWhereInput = {
      OR: scopes,
      ...(query.source ? { source: query.source } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.contactEvent.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      }),
      this.prisma.contactEvent.count({ where }),
    ]);
    const details = await this.details(rows);
    const data = rows.map(({ clientUserId, ownerUserId: _owner, ...row }) => ({
      ...row,
      listingTitle: titles.get(`${row.module}:${row.targetId}`) ?? null,
      details: details.get(row.id) ?? null,
    }));
    return { data, meta: pagination.meta(total) };
  }

  /** The business record behind each event; an event without one simply has no details. */
  private async details(rows: Prisma.ContactEventGetPayload<object>[]) {
    const ids = (source: ContactSource) =>
      rows
        .filter((row) => row.source === source)
        .map((row) => (row.metadata as any)?.requestId)
        .filter((id): id is string => typeof id === 'string');
    const clientIds = rows
      .filter((row) => row.source === 'internal_message' && row.clientUserId)
      .map((row) => row.clientUserId as string);
    const [visits, reservations, rentals, chauffeurs, seats, clients] = await Promise.all([
      this.prisma.realEstateVisitRequest.findMany({
        where: { id: { in: ids('visit_request') } },
        select: { ...clientFields, listingId: true, preferredDate: true },
      }),
      this.prisma.hotelReservationRequest.findMany({
        where: { id: { in: ids('reservation_request') } },
        select: { ...clientFields, propertyId: true, checkIn: true, checkOut: true, guests: true },
      }),
      this.prisma.vehicleRentalRequest.findMany({
        where: { id: { in: ids('rental_request') } },
        select: { ...clientFields, listingId: true, startDate: true, endDate: true },
      }),
      this.prisma.vehicleChauffeurRequest.findMany({
        where: { id: { in: ids('chauffeur_request') } },
        select: { ...clientFields, listingId: true, pickupCity: true, destinationCity: true, serviceDate: true },
      }),
      this.prisma.tripSeatRequest.findMany({
        where: { id: { in: ids('seat_request') } },
        select: { ...clientFields, tripId: true, requestedSeats: true, occurrenceId: true },
      }),
      this.prisma.user.findMany({
        where: { id: { in: clientIds } },
        select: { id: true, firstName: true, lastName: true, professionalProfile: { select: { businessName: true } } },
      }),
    ]);
    const records = new Map<string, Record<string, any>>();
    for (const [source, list, field] of [
      ['visit_request', visits, 'listingId'],
      ['reservation_request', reservations, 'propertyId'],
      ['rental_request', rentals, 'listingId'],
      ['chauffeur_request', chauffeurs, 'listingId'],
      ['seat_request', seats, 'tripId'],
    ] as const)
      for (const record of list as Record<string, any>[])
        records.set(`${source}:${record[field]}:${record.id}`, record);
    const names = new Map(clients.map((client) => [client.id, displayName(client)]));
    const result = new Map<string, Record<string, unknown>>();
    for (const row of rows) {
      const metadata = (row.metadata || {}) as Record<string, any>;
      if (row.source === 'internal_message') {
        result.set(row.id, {
          clientName: row.clientUserId ? names.get(row.clientUserId) ?? null : null,
          conversationId: metadata.conversationId ?? null,
        });
      } else if (row.source === 'form') {
        result.set(row.id, {
          clientName: metadata.clientName ?? null,
          clientPhone: metadata.clientPhone || null,
          clientEmail: metadata.clientEmail || null,
          message: metadata.message || null,
        });
      } else {
        // Keyed by listing as well: a request of another listing never lends its details.
        const record = records.get(`${row.source}:${row.targetId}:${metadata.requestId}`);
        if (record) {
          const { id: _id, listingId: _l, propertyId: _p, tripId: _t, ...visible } = record;
          result.set(row.id, visible);
        }
      }
    }
    return result;
  }
}

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, RequestStatus } from '@prisma/client';
import { hotelDate, hotelToday } from '../hotels/hotel-inventory';
import { PrismaService } from '../../database/prisma/prisma.service';
import { getPagination } from '../../common/pagination/pagination.dto';
import { listingUrl } from '../favorites/listing-cards';
import { CLIENT_REQUEST_DESTINATIONS } from '../../common/constants/client-requests';
import { queueHotelChannelEvent } from '../hotels/hotel-channel-events';
import {
  CLIENT_REQUEST_TYPES,
  ClientRequestQueryDto,
  ClientRequestType,
} from './client-requests.dto';

const common = {
  id: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  clientName: true,
  clientPhone: true,
  clientEmail: true,
  message: true,
} as const;
/** Statuses a client may still withdraw from; a decided or finished request stays as it is. */
export const CLIENT_CANCELLABLE_STATUSES: readonly RequestStatus[] = ['new', 'pending', 'requires_more_info', 'accepted'];
const ownerPages: Record<ClientRequestType, string> = {
  hotel: '/dashboard/hotels/reservations/',
  visit: '/dashboard/immobilier/visites/',
  rental: '/dashboard/voitures/contacts/',
  chauffeur: '/dashboard/voitures/contacts/',
  trip: '/dashboard/voyages/reservations/',
};
const cancelLabels: Record<ClientRequestType, string> = {
  hotel: 'une demande de réservation',
  visit: 'une demande de visite',
  rental: 'une demande de location',
  chauffeur: 'une demande avec chauffeur',
  trip: 'une demande de places',
};

const listing = {
  id: true,
  title: true,
  status: true,
  deletedAt: true,
} as const;

@Injectable()
export class ClientRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: ClientRequestQueryDto) {
    const pagination = getPagination(query);
    const [rows, total] = await Promise.all([
      this.rows(
        query.type,
        userId,
        undefined,
        pagination.skip,
        pagination.take,
      ),
      this.count(query.type, userId),
    ]);
    return {
      data: rows.map((row) => this.present(query.type, row)),
      meta: pagination.meta(total),
    };
  }

  async summary(userId: string) {
    const totals = await Promise.all(
      CLIENT_REQUEST_TYPES.map(
        async (type) => [type, await this.count(type, userId)] as const,
      ),
    );
    return {
      totals: Object.fromEntries(totals),
      total: totals.reduce((sum, [, value]) => sum + value, 0),
    };
  }

  async findOne(userId: string, type: ClientRequestType, id: string) {
    const [row] = await this.rows(type, userId, id, 0, 1);
    if (!row) throw new NotFoundException('Demande introuvable.');
    const result = this.present(type, row);
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        module: CLIENT_REQUEST_DESTINATIONS[type].module,
        targetId: result.listing.id,
        participants: { some: { userId } },
      },
      select: { id: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    return {
      ...result,
      conversationUrl: conversation
        ? `/compte/messages/?conversation=${encodeURIComponent(conversation.id)}`
        : null,
    };
  }

  /**
   * Withdrawal by the client who made the request. Stock confirmed for an accepted request is
   * given back in the same transaction, under the same locks as the advertiser's own decisions.
   */
  async cancel(userId: string, type: ClientRequestType, id: string) {
    const owned = { id, clientUserId: userId };
    await this.prisma.$transaction(async (tx) => {
      const gone = () => new NotFoundException('Demande introuvable.');
      const assertOpen = (status: RequestStatus) => {
        if (status === 'cancelled') throw new ConflictException('Cette demande est déjà annulée.');
        if (!CLIENT_CANCELLABLE_STATUSES.includes(status))
          throw new ConflictException('Cette demande ne peut plus être annulée.');
      };
      let ownerUserId: string;
      let request: { id: string; clientUserId: string | null; status: RequestStatus; updatedAt: Date };
      if (type === 'hotel') {
        const target = await tx.hotelReservationRequest.findFirst({ where: owned, select: { propertyId: true } });
        if (!target) throw gone();
        await tx.$queryRaw`SELECT "id" FROM "HotelProperty" WHERE "id" = ${target.propertyId} FOR UPDATE`;
        await tx.$queryRaw`SELECT "id" FROM "HotelReservationRequest" WHERE "id" = ${id} FOR UPDATE`;
        const row = await tx.hotelReservationRequest.findFirst({ where: owned, include: { property: { select: { ownerUserId: true, integration: true } } } });
        if (!row) throw gone();
        assertOpen(row.status);
        if (row.status === 'accepted') {
          if (row.checkIn && hotelDate(row.checkIn) <= hotelToday())
            throw new ConflictException('Le séjour a commencé : contactez l’établissement pour toute modification.');
          await tx.hotelStockAllocation.updateMany({ where: { requestId: id, releasedAt: null }, data: { releasedAt: new Date() } });
          await queueHotelChannelEvent(tx, row.property.integration, id, 'cancel');
        }
        await tx.hotelReservationRequest.update({ where: { id }, data: { status: 'cancelled',
          events: { create: { actorUserId: userId, fromStatus: row.status, toStatus: 'cancelled', note: 'Annulée par le client.' } } } });
        ownerUserId = row.property.ownerUserId;
        request = row;
      } else if (type === 'trip') {
        const target = await tx.tripSeatRequest.findFirst({ where: owned, select: { tripId: true } });
        if (!target) throw gone();
        await tx.$queryRaw`SELECT "id" FROM "TripListing" WHERE "id" = ${target.tripId} FOR UPDATE`;
        const row = await tx.tripSeatRequest.findFirst({ where: owned, include: { trip: { select: { ownerUserId: true } }, occurrence: true } });
        if (!row) throw gone();
        if (row.occurrence) await tx.$queryRaw`SELECT "id" FROM "TripOccurrence" WHERE "id" = ${row.occurrence.id} FOR UPDATE`;
        assertOpen(row.status);
        let allocatedSeats = row.allocatedSeats;
        if (row.status === 'accepted' && allocatedSeats) {
          if (!row.occurrence || row.occurrence.departureAt <= new Date())
            throw new ConflictException('Le départ est passé : cette demande ne peut plus être annulée.');
          await tx.tripOccurrence.update({ where: { id: row.occurrence.id },
            data: { confirmedSeats: { decrement: allocatedSeats }, remainingSeats: { increment: allocatedSeats } } });
          allocatedSeats = 0;
        }
        await tx.tripSeatRequest.update({ where: { id }, data: { status: 'cancelled', allocatedSeats } });
        ownerUserId = row.trip.ownerUserId;
        request = row;
      } else if (type === 'visit') {
        await tx.$queryRaw`SELECT "id" FROM "RealEstateVisitRequest" WHERE "id" = ${id} FOR UPDATE`;
        const row = await tx.realEstateVisitRequest.findFirst({ where: owned, include: { listing: { select: { ownerUserId: true } } } });
        if (!row) throw gone();
        assertOpen(row.status);
        await tx.realEstateVisitRequest.update({ where: { id }, data: { status: 'cancelled' } });
        ownerUserId = row.listing.ownerUserId;
        request = row;
      } else {
        const table = (type === 'rental' ? tx.vehicleRentalRequest : tx.vehicleChauffeurRequest) as Prisma.VehicleRentalRequestDelegate;
        const target = await table.findFirst({ where: owned, select: { listingId: true } });
        if (!target) throw gone();
        await tx.$queryRaw`SELECT "id" FROM "VehicleListing" WHERE "id" = ${target.listingId} FOR UPDATE`;
        const row = await table.findFirst({ where: owned, include: { listing: { select: { ownerUserId: true } } } });
        if (!row) throw gone();
        assertOpen(row.status);
        await table.update({ where: { id }, data: { status: 'cancelled' } });
        ownerUserId = row.listing.ownerUserId;
        request = row;
      }
      await tx.notification.create({ data: {
        userId: ownerUserId, module: CLIENT_REQUEST_DESTINATIONS[type].module, type: 'request_cancelled_by_client',
        title: 'Demande annulée par le client', message: `Un client a annulé ${cancelLabels[type]}.`,
        targetUrl: ownerPages[type], metadata: { requestId: id, requestType: type, previousStatus: request.status },
      } });
    }, { maxWait: 10000, timeout: 30000 });
    return this.findOne(userId, type, id);
  }

  private count(
    type: ClientRequestType,
    clientUserId: string,
  ): Promise<number> {
    const where = { clientUserId };
    switch (type) {
      case 'hotel':
        return this.prisma.hotelReservationRequest.count({ where });
      case 'visit':
        return this.prisma.realEstateVisitRequest.count({ where });
      case 'rental':
        return this.prisma.vehicleRentalRequest.count({ where });
      case 'chauffeur':
        return this.prisma.vehicleChauffeurRequest.count({ where });
      case 'trip':
        return this.prisma.tripSeatRequest.count({ where });
    }
  }

  private rows(
    type: ClientRequestType,
    clientUserId: string,
    id: string | undefined,
    skip: number,
    take: number,
  ) {
    const args = {
      where: { clientUserId, ...(id ? { id } : {}) },
      skip,
      take,
      orderBy: [{ createdAt: 'desc' as const }, { id: 'asc' as const }],
    };
    switch (type) {
      case 'hotel':
        return this.prisma.hotelReservationRequest.findMany({
          ...args,
          select: {
            ...common,
            property: {
              select: { id: true, name: true, status: true, deletedAt: true },
            },
            room: { select: { name: true } },
            checkIn: true,
            checkOut: true,
            guests: true,
            units: true,
            allocations: {
              where: { releasedAt: null },
              select: { date: true, units: true },
            },
          },
        });
      case 'visit':
        return this.prisma.realEstateVisitRequest.findMany({
          ...args,
          select: {
            ...common,
            listing: { select: listing },
            preferredDate: true,
          },
        });
      case 'rental':
        return this.prisma.vehicleRentalRequest.findMany({
          ...args,
          select: {
            ...common,
            listing: { select: listing },
            startDate: true,
            endDate: true,
          },
        });
      case 'chauffeur':
        return this.prisma.vehicleChauffeurRequest.findMany({
          ...args,
          select: {
            ...common,
            listing: { select: listing },
            pickupCity: true,
            destinationCity: true,
            serviceDate: true,
          },
        });
      case 'trip':
        return this.prisma.tripSeatRequest.findMany({
          ...args,
          select: {
            ...common,
            trip: {
              select: {
                ...listing,
                departureCity: true,
                arrivalCity: true,
                departureDate: true,
                departureTime: true,
              },
            },
            occurrence: {
              select: { id: true, departureAt: true, cancelledAt: true },
            },
            requestedSeats: true,
            allocatedSeats: true,
            quotedPricePerSeat: true,
            luggage: true,
          },
        });
    }
  }

  private present(
    type: ClientRequestType,
    row: Awaited<ReturnType<ClientRequestsService['rows']>>[number],
  ) {
    // Only explicitly selected request data can leave this service.
    const record = row as typeof row & Record<string, any>;
    const target = record.property ?? record.listing ?? record.trip;
    let available = target.status === 'active' && !target.deletedAt;
    if (type === 'trip') {
      const occurrence = record.occurrence;
      const legacy =
        target.departureDate && target.departureTime
          ? new Date(
              `${target.departureDate.toISOString().slice(0, 10)}T${target.departureTime}:00Z`,
            )
          : null;
      available =
        available &&
        (occurrence
          ? !occurrence.cancelledAt && occurrence.departureAt > new Date()
          : !!legacy && legacy > new Date());
    }
    const details =
      type === 'hotel'
        ? {
            roomName: available ? (record.room?.name ?? null) : null,
            checkIn: record.checkIn,
            checkOut: record.checkOut,
            guests: record.guests,
            units: record.units,
            allocatedNights: record.allocations.length,
          }
        : type === 'visit'
          ? { preferredDate: record.preferredDate }
          : type === 'rental'
            ? { startDate: record.startDate, endDate: record.endDate }
            : type === 'chauffeur'
              ? {
                  serviceDate: record.serviceDate,
                  pickupCity: record.pickupCity,
                  destinationCity: record.destinationCity,
                }
              : {
                  departureAt: record.occurrence?.departureAt ?? null,
                  departureDate: target.departureDate,
                  departureTime: target.departureTime,
                  departureCity: target.departureCity,
                  arrivalCity: target.arrivalCity,
                  requestedSeats: record.requestedSeats,
                  allocatedSeats: record.allocatedSeats,
                  quotedPricePerSeat: record.quotedPricePerSeat,
                  luggage: record.luggage,
                };
    const confirmed = row.status === 'accepted';
    const canCancel =
      CLIENT_CANCELLABLE_STATUSES.includes(row.status) &&
      !(type === 'hotel' && confirmed && record.checkIn && hotelDate(record.checkIn) <= hotelToday()) &&
      !(type === 'trip' && confirmed && record.allocatedSeats &&
        (!record.occurrence || record.occurrence.departureAt <= new Date()));
    return {
      id: row.id,
      type,
      status: row.status,
      canCancel,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      listing: {
        id: target.id,
        available,
        title: available
          ? (target.title ?? target.name)
          : 'Annonce indisponible',
        url: available
          ? listingUrl(
              CLIENT_REQUEST_DESTINATIONS[type].module,
              target.id,
              record.occurrence?.id,
            )
          : null,
      },
      contact: {
        name: row.clientName,
        phone: row.clientPhone,
        email: row.clientEmail,
      },
      message: row.message,
      details,
      detailUrl: `/compte/${CLIENT_REQUEST_DESTINATIONS[type].page}/?id=${encodeURIComponent(row.id)}`,
    };
  }
}

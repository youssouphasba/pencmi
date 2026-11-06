import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import { getPagination } from '../../common/pagination/pagination.dto';
import { listingUrl } from '../favorites/listing-cards';
import { CLIENT_REQUEST_DESTINATIONS } from '../../common/constants/client-requests';
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
    return {
      id: row.id,
      type,
      status: row.status,
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

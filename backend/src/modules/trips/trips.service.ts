import { Injectable } from '@nestjs/common';
import { ContactSource, ListingStatus, PencmiModule, TargetType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { getPagination, PaginationDto } from '../../common/pagination/pagination.dto';
import { PrismaService } from '../../database/prisma/prisma.service';
import { CreateSeatRequestDto, CreateTripDto, TripSearchDto, UpdateTripDto } from './trips.dto';

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

  async findPublic(query: TripSearchDto) {
    const pagination = getPagination(query);
    const where: Prisma.TripListingWhereInput = {
      status: ListingStatus.active,
      deletedAt: null,
      ...(query.departureCity
        ? {
            OR: [
              { departureCity: { contains: query.departureCity, mode: 'insensitive' } },
              { departurePoint: { contains: query.departureCity, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.arrivalCity
        ? {
            AND: [
              {
                OR: [
                  { arrivalCity: { contains: query.arrivalCity, mode: 'insensitive' } },
                  { arrivalPoint: { contains: query.arrivalCity, mode: 'insensitive' } },
                ],
              },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.tripListing.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { updatedAt: 'desc' },
        include: {
          owner: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              city: true,
              role: true,
              professionalProfile: {
                select: {
                  businessName: true,
                  professionalType: true,
                  city: true,
                  logoUrl: true,
                  whatsappNumber: true,
                  professionalPhone: true,
                  professionalEmail: true,
                  openingHours: true,
                  verified: true,
                  website: true,
                  description: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.tripListing.count({ where }),
    ]);
    return { data, meta: pagination.meta(total) };
  }

  findPublicOne(id: string) {
    return this.prisma.tripListing.findFirstOrThrow({
      where: { id, status: ListingStatus.active, deletedAt: null },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            city: true,
            role: true,
            professionalProfile: {
              select: {
                businessName: true,
                professionalType: true,
                city: true,
                logoUrl: true,
                whatsappNumber: true,
                professionalPhone: true,
                professionalEmail: true,
                openingHours: true,
                verified: true,
                website: true,
                description: true,
              },
            },
          },
        },
      },
    });
  }

  async createSeatRequest(tripId: string, dto: CreateSeatRequestDto) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.tripSeatRequest.create({
        data: {
          tripId,
          clientName: dto.clientName,
          clientPhone: dto.clientPhone,
          clientEmail: dto.clientEmail,
          requestedSeats: dto.requestedSeats,
          luggage: dto.luggage,
          message: dto.message,
        },
      });
      await tx.contactEvent.create({
        data: { module: PencmiModule.trips, source: ContactSource.seat_request, targetType: TargetType.listing, targetId: tripId, metadata: { requestId: request.id } },
      });
      return request;
    });
  }

  async findMine(ownerUserId: string, dto: PaginationDto) {
    const pagination = getPagination(dto);
    const where = { ownerUserId, deletedAt: null };
    const [data, total] = await Promise.all([
      this.prisma.tripListing.findMany({ where, skip: pagination.skip, take: pagination.take, orderBy: { updatedAt: 'desc' } }),
      this.prisma.tripListing.count({ where }),
    ]);
    return { data, meta: pagination.meta(total) };
  }

  async findMySeatRequests(ownerUserId: string, dto: PaginationDto) {
    const pagination = getPagination(dto);
    const where = {
      trip: {
        ownerUserId,
        deletedAt: null,
      },
    };
    const [data, total] = await Promise.all([
      this.prisma.tripSeatRequest.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        include: {
          trip: {
            select: {
              id: true,
              title: true,
              departureCity: true,
              arrivalCity: true,
              departureDate: true,
              departureTime: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.tripSeatRequest.count({ where }),
    ]);
    return { data, meta: pagination.meta(total) };
  }

  create(ownerUserId: string, dto: CreateTripDto) {
    return this.prisma.tripListing.create({
      data: { ...dto, ownerUserId, departureDate: dto.departureDate ? new Date(dto.departureDate) : undefined },
    });
  }

  update(ownerUserId: string, id: string, dto: UpdateTripDto) {
    return this.prisma.tripListing.updateMany({
      where: { id, ownerUserId },
      data: { ...dto, departureDate: dto.departureDate ? new Date(dto.departureDate) : undefined },
    });
  }

  softDelete(ownerUserId: string, id: string) {
    return this.prisma.tripListing.updateMany({ where: { id, ownerUserId }, data: { deletedAt: new Date() } });
  }
}

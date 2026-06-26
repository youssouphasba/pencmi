import { Injectable } from '@nestjs/common';
import { ContactSource, ListingStatus, PencmiModule, RequestStatus, TargetType } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import { getPagination, PaginationDto } from '../../common/pagination/pagination.dto';
import { CreateHotelDto, CreateHotelReservationRequestDto, HotelSearchDto, UpdateHotelDto, UpdateHotelReservationStatusDto } from './hotels.dto';

@Injectable()
export class HotelsService {
  constructor(private readonly prisma: PrismaService) {}

  async findPublic(query: HotelSearchDto) {
    const pagination = getPagination(query);
    const where: Prisma.HotelPropertyWhereInput = {
      status: ListingStatus.active,
      deletedAt: null,
      propertyType: query.propertyType || undefined,
      ...(query.city
        ? {
            OR: [
              { city: { contains: query.city, mode: 'insensitive' } },
              { region: { contains: query.city, mode: 'insensitive' } },
              { address: { contains: query.city, mode: 'insensitive' } },
              { name: { contains: query.city, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.hotelProperty.findMany({
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
          rooms: true,
        },
      }),
      this.prisma.hotelProperty.count({ where }),
    ]);
    return { data, meta: pagination.meta(total) };
  }

  findPublicOne(id: string) {
    return this.prisma.hotelProperty.findFirstOrThrow({
      where: { id, status: ListingStatus.active, deletedAt: null },
      include: {
        rooms: true,
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

  async createReservationRequest(propertyId: string, dto: CreateHotelReservationRequestDto) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.hotelReservationRequest.create({
        data: {
          propertyId,
          clientName: dto.clientName,
          clientPhone: dto.clientPhone,
          clientEmail: dto.clientEmail,
          checkIn: dto.checkIn ? new Date(dto.checkIn) : undefined,
          checkOut: dto.checkOut ? new Date(dto.checkOut) : undefined,
          guests: dto.guests,
          message: dto.message,
        },
      });
      await tx.contactEvent.create({
        data: {
          module: PencmiModule.hotels,
          source: ContactSource.reservation_request,
          targetType: TargetType.listing,
          targetId: propertyId,
          metadata: { requestId: request.id },
        },
      });
      return request;
    });
  }

  async findMine(ownerUserId: string, dto: PaginationDto) {
    const pagination = getPagination(dto);
    const where = { ownerUserId, deletedAt: null };
    const [data, total] = await Promise.all([
      this.prisma.hotelProperty.findMany({ where, skip: pagination.skip, take: pagination.take, orderBy: { updatedAt: 'desc' } }),
      this.prisma.hotelProperty.count({ where }),
    ]);
    return { data, meta: pagination.meta(total) };
  }

  async findMyReservationRequests(ownerUserId: string, dto: PaginationDto) {
    const pagination = getPagination(dto);
    const where = {
      property: {
        ownerUserId,
        deletedAt: null,
      },
    };
    const [data, total] = await Promise.all([
      this.prisma.hotelReservationRequest.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { createdAt: 'desc' },
        include: {
          property: {
            select: {
              id: true,
              name: true,
              city: true,
              propertyType: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.hotelReservationRequest.count({ where }),
    ]);
    return { data, meta: pagination.meta(total) };
  }

  async updateReservationStatus(ownerUserId: string, id: string, dto: UpdateHotelReservationStatusDto) {
    const request = await this.prisma.hotelReservationRequest.findFirstOrThrow({
      where: {
        id,
        property: {
          ownerUserId,
          deletedAt: null,
        },
      },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
      },
    });

    return this.prisma.hotelReservationRequest.update({
      where: { id: request.id },
      data: { status: dto.status as RequestStatus },
      include: {
        property: {
          select: {
            id: true,
            name: true,
            city: true,
            propertyType: true,
            status: true,
          },
        },
      },
    });
  }

  create(ownerUserId: string, dto: CreateHotelDto) {
    return this.prisma.hotelProperty.create({ data: { ...dto, ownerUserId } });
  }

  update(ownerUserId: string, id: string, dto: UpdateHotelDto) {
    return this.prisma.hotelProperty.updateMany({ where: { id, ownerUserId }, data: dto });
  }

  softDelete(ownerUserId: string, id: string) {
    return this.prisma.hotelProperty.updateMany({ where: { id, ownerUserId }, data: { deletedAt: new Date() } });
  }
}

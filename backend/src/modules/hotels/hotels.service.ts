import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ContactSource,
  ListingStatus,
  PencmiModule,
  RequestStatus,
  TargetType,
} from '@prisma/client';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  getPagination,
  PaginationDto,
} from '../../common/pagination/pagination.dto';
import {
  CreateHotelReservationRequestDto,
  HotelSearchDto,
  UpdateHotelReservationStatusDto,
} from './hotels.dto';
import { hotelRoomsInclude, hotelSettings } from './hotel-publication.service';

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
          integration: {
            select: { sourceOfTruth: true, status: true, lastSyncAt: true },
          },
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
          rooms: { include: hotelRoomsInclude },
        },
      }),
      this.prisma.hotelProperty.count({ where }),
    ]);
    return {
      data: data.map((property) => this.publicProperty(property)),
      meta: pagination.meta(total),
    };
  }

  async findPublicOne(id: string) {
    const property = await this.prisma.hotelProperty.findFirst({
      where: { id, status: ListingStatus.active, deletedAt: null },
      include: {
        integration: {
          select: { sourceOfTruth: true, status: true, lastSyncAt: true },
        },
        rooms: { include: hotelRoomsInclude },
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
    if (!property) throw new NotFoundException('Hébergement introuvable.');
    return this.publicProperty(property);
  }

  publicProperty(property: any) {
    const settings = hotelSettings(property.contactSettings);
    const publication = hotelSettings(settings.publication);
    const contacts = hotelSettings(publication.contactPreferences);
    const publicContacts = Object.fromEntries(
      Object.entries(contacts).filter(
        ([key]) =>
          [
            'whatsappEnabled',
            'phoneEnabled',
            'emailEnabled',
            'internalMessagingEnabled',
            'contactFormEnabled',
            'reservationRequestEnabled',
          ].includes(key) ||
          (key === 'whatsappNumber' && contacts.whatsappEnabled) ||
          (key === 'phoneNumber' && contacts.phoneEnabled) ||
          (key === 'contactEmail' && contacts.emailEnabled),
      ),
    );
    const rooms = property.rooms
      .filter((room: any) => room.status === 'active')
      .map((room: any) => {
        const data = hotelSettings(room.metadata);
        return {
          id: room.id,
          name: room.name,
          roomType: room.roomType,
          capacity: room.capacity,
          adults: data.adults,
          children: data.children,
          beds: data.beds,
          bedType: data.bedType,
          amenities: Array.isArray(data.amenities) ? data.amenities : [],
          basePrice: data.basePrice ?? null,
          currency: 'FCFA',
          photos: Object.entries(hotelSettings(settings.photoRooms))
            .filter(
              ([url, roomId]) =>
                roomId === room.id && /^(https?:\/\/|\/api\/)/.test(url),
            )
            .map(([url]) => url),
          rates: room.rates.map((rate: any) => ({
            date: rate.date,
            price: rate.price,
            currency: rate.currency,
          })),
          availability: room.availability.map((day: any) => {
            const restriction = room.restrictions.find(
              (item: any) => item.date.valueOf() === day.date.valueOf(),
            );
            const external =
              property.integration?.sourceOfTruth === 'external_system';
            const reliable = external
              ? property.integration.status === 'active' &&
                day.reliableUntil &&
                day.reliableUntil > new Date()
              : !day.reliableUntil || day.reliableUntil > new Date();
            return {
              date: day.date,
              available:
                reliable && publication.management?.showRemainingRoomsToClients
                  ? day.available
                  : undefined,
              status: reliable
                ? day.status === 'open' && day.available === 0
                  ? 'full'
                  : day.status
                : 'unconfirmed',
              stopSell:
                restriction?.stopSell ||
                day.status !== 'open' ||
                day.available === 0,
              minStay: restriction?.minStay,
              maxStay: restriction?.maxStay,
            };
          }),
        };
      });
    const prices = rooms
      .filter((room: any) => Number.isInteger(room.basePrice))
      .map((room: any) => ({ price: room.basePrice, roomId: room.id }));
    prices.sort((a: any, b: any) => a.price - b.price);
    const legacyPrice = Number.isInteger(settings.nightlyPrice)
      ? settings.nightlyPrice
      : Number.isInteger(settings.priceFrom)
        ? settings.priceFrom
        : null;
    return {
      id: property.id,
      slug: property.slug,
      name: property.name,
      propertyType: property.propertyType,
      city: property.city,
      region: property.region,
      description: property.description,
      status: property.status,
      createdAt: property.createdAt,
      updatedAt: property.updatedAt,
      owner: property.owner,
      rooms,
      metadata: {
        photos: Array.isArray(settings.photos)
          ? settings.photos.filter(
              (url: unknown) =>
                typeof url === 'string' && /^(https?:\/\/|\/api\/)/.test(url),
            )
          : [],
        stars: publication.general?.stars ?? settings.stars,
        amenities: publication.amenities ?? settings.amenities ?? [],
        conditions:
          publication.conditions?.options ?? settings.conditions ?? [],
        checkInTime: publication.general?.checkInTime,
        checkOutTime: publication.general?.checkOutTime,
        priceFrom: prices[0]?.price ?? legacyPrice,
        nightlyPrice: prices[0]?.price ?? legacyPrice,
        priceSource:
          prices[0]?.roomId || (legacyPrice !== null ? property.id : null),
        contactPreferences: publicContacts,
        availabilityStatus: 'unconfirmed',
      },
    };
  }

  async createReservationRequest(
    propertyId: string,
    dto: CreateHotelReservationRequestDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const property = await tx.hotelProperty.findFirst({
        where: { id: propertyId, status: 'active', deletedAt: null },
        select: { id: true },
      });
      if (!property) throw new NotFoundException('Hébergement introuvable.');
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
      this.prisma.hotelProperty.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { updatedAt: 'desc' },
        include: { rooms: { include: hotelRoomsInclude } },
      }),
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

  async updateReservationStatus(
    ownerUserId: string,
    id: string,
    dto: UpdateHotelReservationStatusDto,
  ) {
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

  softDelete(ownerUserId: string, id: string) {
    return this.prisma.hotelProperty.updateMany({
      where: { id, ownerUserId },
      data: { deletedAt: new Date() },
    });
  }
}

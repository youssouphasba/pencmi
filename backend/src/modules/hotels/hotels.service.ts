import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ListingStatus } from '@prisma/client';
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
  HotelStayDto,
} from './hotels.dto';
import { hotelRoomsInclude, hotelSettings } from './hotel-publication.service';
import { HotelReservationsService } from './hotel-reservations.service';
import { hotelReservedOn, hotelDate } from './hotel-inventory';

@Injectable()
export class HotelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reservations: HotelReservationsService,
  ) {}

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
            const remaining =
              day.available - hotelReservedOn(room, hotelDate(day.date));
            const reliable =
              !external &&
              Number.isInteger(data.totalUnits) &&
              day.available <= data.totalUnits &&
              remaining >= 0 &&
              (!day.reliableUntil || day.reliableUntil > new Date());
            return {
              date: day.date,
              available:
                reliable && publication.management?.showRemainingRoomsToClients
                  ? remaining
                  : undefined,
              status: reliable
                ? day.status === 'open' && remaining === 0
                  ? 'full'
                  : day.status
                : 'unconfirmed',
              stopSell:
                restriction?.stopSell ||
                day.status !== 'open' ||
                remaining === 0,
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
    return this.reservations.create(propertyId, dto);
  }

  quoteStay(propertyId: string, dto: HotelStayDto) {
    return this.reservations.quote(propertyId, dto);
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
        include: {
          rooms: { include: hotelRoomsInclude },
          integration: { select: { sourceOfTruth: true } },
        },
      }),
      this.prisma.hotelProperty.count({ where }),
    ]);
    return {
      data: data.map((property) => ({
        ...property,
        rooms: property.rooms.map((room) => ({
          ...room,
          availability: room.availability.map((day) => ({
            ...day,
            allocatedUnits: hotelReservedOn(room, hotelDate(day.date)),
            remainingUnits:
              property.integration?.sourceOfTruth === 'external_system'
                ? null
                : Math.max(
                    0,
                    day.available - hotelReservedOn(room, hotelDate(day.date)),
                  ),
          })),
        })),
      })),
      meta: pagination.meta(total),
    };
  }

  async findMyReservationRequests(ownerUserId: string, dto: PaginationDto) {
    return this.reservations.findMine(ownerUserId, dto);
  }

  async updateReservationStatus(
    ownerUserId: string,
    id: string,
    dto: UpdateHotelReservationStatusDto,
  ) {
    return this.reservations.update(ownerUserId, id, dto);
  }

  softDelete(ownerUserId: string, id: string) {
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "HotelProperty" WHERE "id" = ${id} AND "ownerUserId" = ${ownerUserId} FOR UPDATE`;
        const property = await tx.hotelProperty.findFirst({
          where: { id, ownerUserId, deletedAt: null },
          select: { id: true },
        });
        if (!property) throw new NotFoundException('Hébergement introuvable.');
        if (
          await tx.hotelReservationRequest.count({
            where: { propertyId: id, status: 'accepted' },
          })
        )
          throw new ConflictException(
            'Traitez les séjours acceptés avant de retirer cet hébergement.',
          );
        return tx.hotelProperty.updateMany({
          where: { id, ownerUserId, deletedAt: null },
          data: { deletedAt: new Date() },
        });
      },
      { timeout: 15000 },
    );
  }
}

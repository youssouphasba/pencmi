import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RequestStatus } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma/prisma.service';
import {
  CreateHotelReservationRequestDto,
  HotelStayDto,
  UpdateHotelReservationStatusDto,
} from './hotels.dto';
import {
  activeHotelAllocations,
  HOTEL_RESERVATION_TRANSITIONS,
  HOTEL_STOCK_MESSAGES,
  hotelDate,
  hotelRequestSchema,
  hotelStayNights,
  hotelStayQuote,
  hotelStaySchema,
  hotelToday,
  parseHotelInput,
} from './hotel-inventory';
import {
  getPagination,
  PaginationDto,
} from '../../common/pagination/pagination.dto';

const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex');
export const reservationRoomInclude = {
  rates: true,
  availability: true,
  restrictions: true,
  stockAllocations: activeHotelAllocations,
} as const;
function completeAllocations(request: any): boolean {
  if (
    !request.roomId ||
    !request.checkIn ||
    !request.checkOut ||
    !request.units
  )
    return false;
  try {
    const nights = hotelStayNights(
      hotelDate(request.checkIn),
      hotelDate(request.checkOut),
      true,
    );
    const live = request.allocations.filter(
      (allocation: any) => !allocation.releasedAt,
    );
    return (
      live.length === nights.length &&
      nights.every((day) =>
        live.some(
          (allocation: any) =>
            hotelDate(allocation.date) === day &&
            allocation.units === request.units &&
            allocation.roomId === request.roomId,
        ),
      )
    );
  } catch {
    return false;
  }
}

const reservationIntegritySelect = {
  id: true,
  propertyId: true,
  roomId: true,
  checkIn: true,
  checkOut: true,
  units: true,
  status: true,
  allocations: {
    select: { roomId: true, date: true, units: true, releasedAt: true },
  },
} as const;

export function hotelHasUnreconciledReservations(
  records: any[],
  stay: Pick<HotelStayDto, 'roomId' | 'checkIn' | 'checkOut'>,
): boolean {
  return records.some(
    (record) =>
      record.status === 'accepted' &&
      (!record.roomId || record.roomId === stay.roomId) &&
      (!record.checkIn ||
        !record.checkOut ||
        hotelDate(record.checkIn) >= hotelDate(record.checkOut) ||
        (hotelDate(record.checkIn) < stay.checkOut &&
          hotelDate(record.checkOut) > stay.checkIn)) &&
      !completeAllocations(record),
  );
}

function withLegacyStock(
  quote: ReturnType<typeof hotelStayQuote>,
  records: any[],
  stay: Pick<HotelStayDto, 'roomId' | 'checkIn' | 'checkOut'>,
) {
  if (
    quote.status === 'unavailable' ||
    !hotelHasUnreconciledReservations(records, stay)
  )
    return quote;
  return {
    ...quote,
    canConfirm: false,
    status: 'unconfirmed',
    remainingUnits: null,
    reason: 'legacy_stock_unreconciled',
    message: HOTEL_STOCK_MESSAGES.legacy_stock_unreconciled,
  };
}

@Injectable()
export class HotelReservationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async lockProperty(
    tx: Prisma.TransactionClient,
    id: string,
    ownerUserId?: string,
  ) {
    await tx.$queryRaw`SELECT "id" FROM "HotelProperty" WHERE "id" = ${id} FOR UPDATE`;
    await tx.$queryRaw`SELECT "id" FROM "HotelIntegration" WHERE "propertyId" = ${id} FOR UPDATE`;
    const property = await tx.hotelProperty.findFirst({
      where: { id, deletedAt: null, ...(ownerUserId ? { ownerUserId } : {}) },
      include: { integration: true },
    });
    if (!property) throw new NotFoundException('Hébergement introuvable.');
    return property;
  }

  async quote(propertyId: string, input: HotelStayDto) {
    const stay = parseHotelInput(hotelStaySchema, input);
    return this.prisma.$transaction(
      async (tx) => {
        const property = await tx.hotelProperty.findFirst({
          where: { id: propertyId, status: 'active', deletedAt: null },
          include: { integration: true },
        });
        if (!property) throw new NotFoundException('Hébergement introuvable.');
        const room = await tx.hotelRoom.findFirst({
          where: { id: stay.roomId, propertyId, status: 'active' },
          include: reservationRoomInclude,
        });
        if (!room)
          throw new NotFoundException('Catégorie de chambre introuvable.');
        const accepted = await tx.hotelReservationRequest.findMany({
          where: { propertyId, status: 'accepted' },
          select: reservationIntegritySelect,
        });
        return withLegacyStock(
          hotelStayQuote(room, stay, property.integration),
          accepted,
          stay,
        );
      },
      { isolationLevel: 'RepeatableRead', timeout: 15000 },
    );
  }

  async create(propertyId: string, input: CreateHotelReservationRequestDto) {
    const data = parseHotelInput(hotelRequestSchema, input);
    const phone = data.clientPhone?.replace(/[ ()-]/g, '') || undefined;
    if (phone && !/^\+?\d{7,15}$/.test(phone))
      throw new BadRequestException('Numéro de téléphone invalide.');
    if (!phone && !data.clientEmail)
      throw new BadRequestException(
        'Renseignez au moins un téléphone ou un email utilisable.',
      );
    const { requestId, clientPhone, ...fields } = data;
    const canonical = {
      ...fields,
      clientPhone: phone || null,
      clientEmail: data.clientEmail || null,
      message: data.message || '',
    };
    const fingerprint = digest(JSON.stringify(canonical));
    const key = digest(`${propertyId}:${requestId}`);
    return this.prisma.$transaction(
      async (tx) => {
        const property = await this.lockProperty(tx, propertyId);
        const existing = await tx.hotelReservationRequest.findUnique({
          where: { idempotencyKey: key },
        });
        if (existing) {
          if (existing.requestFingerprint !== fingerprint)
            throw new ConflictException(
              'Cette demande a déjà été envoyée avec des informations différentes.',
            );
          return this.receipt(existing);
        }
        if (property.status !== 'active')
          throw new NotFoundException('Hébergement introuvable.');
        const preferences = (property.contactSettings as any)?.publication
          ?.contactPreferences;
        if (preferences && preferences.reservationRequestEnabled !== true)
          throw new ConflictException(
            'Les demandes de réservation ne sont pas activées pour cet établissement.',
          );
        hotelStayNights(data.checkIn, data.checkOut);
        const room = await tx.hotelRoom.findFirst({
          where: { id: data.roomId, propertyId, status: 'active' },
          include: reservationRoomInclude,
        });
        if (!room)
          throw new NotFoundException('Catégorie de chambre introuvable.');
        const quote = hotelStayQuote(room, data, property.integration);
        if (quote.status === 'unavailable')
          throw new ConflictException(quote.message);
        const duplicate = await tx.hotelReservationRequest.findFirst({
          where: {
            propertyId,
            requestFingerprint: fingerprint,
            createdAt: { gte: new Date(Date.now() - 120000) },
          },
        });
        if (duplicate) return this.receipt(duplicate);
        const recent = await tx.hotelReservationRequest.count({
          where: {
            propertyId,
            createdAt: { gte: new Date(Date.now() - 60000) },
            OR: [
              ...(phone ? [{ clientPhone: phone }] : []),
              ...(data.clientEmail ? [{ clientEmail: data.clientEmail }] : []),
            ],
          },
        });
        if (recent >= 3)
          throw new HttpException(
            'Veuillez patienter avant d’envoyer une nouvelle demande.',
            429,
          );
        const request = await tx.hotelReservationRequest.create({
          data: {
            propertyId,
            roomId: data.roomId,
            units: data.units,
            guests: data.guests,
            checkIn: new Date(`${data.checkIn}T00:00:00Z`),
            checkOut: new Date(`${data.checkOut}T00:00:00Z`),
            clientName: data.clientName,
            clientPhone: phone,
            clientEmail: data.clientEmail,
            message: data.message,
            idempotencyKey: key,
            requestFingerprint: fingerprint,
            status: 'new',
            events: { create: { toStatus: 'new' } },
          },
        });
        await tx.contactEvent.create({
          data: {
            module: 'hotels',
            source: 'reservation_request',
            targetType: 'listing',
            targetId: propertyId,
            metadata: { requestId: request.id },
          },
        });
        return this.receipt(request);
      },
      { maxWait: 10000, timeout: 30000 },
    );
  }

  private receipt(request: any) {
    return {
      id: request.id,
      status: request.status,
      createdAt: request.createdAt,
      received: true,
    };
  }

  private view(request: any, accepted: any[] = []) {
    let confirmation: any = {
      canConfirm: false,
      status: 'unconfirmed',
      reason: 'legacy_request',
      message: HOTEL_STOCK_MESSAGES.legacy_request,
      remainingUnits: null,
    };
    const legacy =
      !request.roomId ||
      !request.checkIn ||
      !request.checkOut ||
      !request.units ||
      !request.guests;
    if (!legacy && request.room) {
      try {
        confirmation = withLegacyStock(
          hotelStayQuote(
            request.room,
            {
              roomId: request.roomId,
              checkIn: hotelDate(request.checkIn),
              checkOut: hotelDate(request.checkOut),
              units: request.units,
              guests: request.guests,
            },
            request.property.integration,
          ),
          accepted,
          {
            roomId: request.roomId,
            checkIn: hotelDate(request.checkIn),
            checkOut: hotelDate(request.checkOut),
          },
        );
        if (
          request.property.status !== 'active' ||
          request.room.status !== 'active'
        )
          confirmation = {
            ...confirmation,
            canConfirm: false,
            message:
              'L’établissement et la catégorie doivent être actifs avant confirmation.',
          };
      } catch (error) {
        confirmation.message =
          error instanceof BadRequestException
            ? error.message
            : HOTEL_STOCK_MESSAGES.legacy_request;
      }
    }
    const live = request.allocations.filter(
      (allocation: any) => !allocation.releasedAt,
    );
    const confirmed =
      ['accepted', 'completed'].includes(request.status) &&
      !legacy &&
      completeAllocations(request);
    if (['accepted', 'completed'].includes(request.status) && !confirmed)
      confirmation = {
        ...confirmation,
        canConfirm: false,
        message: HOTEL_STOCK_MESSAGES.legacy_request,
      };
    const allowedActions = [
      ...HOTEL_RESERVATION_TRANSITIONS[request.status as RequestStatus],
    ].filter(
      (status) =>
        (status !== 'accepted' || confirmation.canConfirm) &&
        (status !== 'completed' ||
          (confirmed &&
            request.checkOut &&
            hotelDate(request.checkOut) <= hotelToday())),
    );
    const { property, room, idempotencyKey, requestFingerprint, ...safe } =
      request;
    return {
      ...safe,
      legacy,
      confirmation: {
        ...confirmation,
        confirmed,
        reservedUnits: live.length ? request.units : 0,
      },
      allowedActions,
      property: {
        id: property.id,
        name: property.name,
        city: property.city,
        propertyType: property.propertyType,
        status: property.status,
      },
      room: room
        ? {
            id: room.id,
            name: room.name,
            capacity: room.capacity,
            status: room.status,
          }
        : null,
    };
  }

  private include() {
    return {
      property: { include: { integration: true } },
      room: { include: reservationRoomInclude },
      allocations: true,
      events: { orderBy: { createdAt: 'asc' as const } },
    } as const;
  }

  async findMine(ownerUserId: string, dto: PaginationDto) {
    const pagination = getPagination(dto);
    const where = { property: { ownerUserId } };
    return this.prisma.$transaction(
      async (tx) => {
        const data = await tx.hotelReservationRequest.findMany({
          where,
          include: this.include(),
          skip: pagination.skip,
          take: pagination.take,
          orderBy: { createdAt: 'desc' },
        });
        const total = await tx.hotelReservationRequest.count({ where });
        const accepted = await tx.hotelReservationRequest.findMany({
          where: {
            status: 'accepted',
            propertyId: {
              in: [...new Set(data.map((request) => request.propertyId))],
            },
          },
          select: reservationIntegritySelect,
        });
        return {
          data: data.map((request) =>
            this.view(
              request,
              accepted.filter(
                (record) => record.propertyId === request.propertyId,
              ),
            ),
          ),
          meta: pagination.meta(total),
        };
      },
      { isolationLevel: 'RepeatableRead', timeout: 30000 },
    );
  }

  async update(
    ownerUserId: string,
    id: string,
    dto: UpdateHotelReservationStatusDto,
  ) {
    const allowedStatus = [
      'pending',
      'accepted',
      'refused',
      'cancelled',
      'expired',
      'completed',
      'requires_more_info',
    ];
    if (
      !allowedStatus.includes(dto.status) ||
      (dto.note && dto.note.length > 1000)
    )
      throw new BadRequestException('Statut ou note invalide.');
    const target = await this.prisma.hotelReservationRequest.findFirst({
      where: { id, property: { ownerUserId, deletedAt: null } },
      select: { propertyId: true },
    });
    if (!target) throw new NotFoundException('Demande introuvable.');
    return this.prisma.$transaction(
      async (tx) => {
        const property = await this.lockProperty(
          tx,
          target.propertyId,
          ownerUserId,
        );
        await tx.$queryRaw`SELECT "id" FROM "HotelReservationRequest" WHERE "id" = ${id} FOR UPDATE`;
        const request = await tx.hotelReservationRequest.findUniqueOrThrow({
          where: { id },
          include: this.include(),
        });
        const status = dto.status as RequestStatus;
        if (status === request.status) {
          if (status === 'accepted' && !completeAllocations(request))
            throw new ConflictException(HOTEL_STOCK_MESSAGES.legacy_request);
          return this.view(request);
        }
        if (!HOTEL_RESERVATION_TRANSITIONS[request.status].includes(status))
          throw new ConflictException(
            'Cette transition de statut n’est pas autorisée.',
          );
        if (status === 'accepted') {
          if (
            !request.roomId ||
            !request.room ||
            !request.checkIn ||
            !request.checkOut ||
            !request.units ||
            !request.guests
          )
            throw new ConflictException(HOTEL_STOCK_MESSAGES.legacy_request);
          if (property.status !== 'active' || request.room.status !== 'active')
            throw new ConflictException(
              'L’établissement et la catégorie doivent être actifs avant confirmation.',
            );
          if (property.integration?.sourceOfTruth === 'external_system')
            throw new ConflictException(
              HOTEL_STOCK_MESSAGES.external_confirmation_required,
            );
          await tx.$queryRaw`SELECT "id" FROM "HotelRoom" WHERE "id" = ${request.roomId} FOR UPDATE`;
          const room = await tx.hotelRoom.findUniqueOrThrow({
            where: { id: request.roomId },
            include: reservationRoomInclude,
          });
          const stay = {
            roomId: request.roomId,
            checkIn: hotelDate(request.checkIn),
            checkOut: hotelDate(request.checkOut),
            units: request.units,
            guests: request.guests,
          };
          const quote = hotelStayQuote(room, stay, property.integration);
          if (!quote.canConfirm) throw new ConflictException(quote.message);
          const accepted = await tx.hotelReservationRequest.findMany({
            where: { propertyId: request.propertyId, status: 'accepted' },
            select: reservationIntegritySelect,
          });
          if (hotelHasUnreconciledReservations(accepted, stay))
            throw new ConflictException(
              HOTEL_STOCK_MESSAGES.legacy_stock_unreconciled,
            );
          const nights = hotelStayNights(stay.checkIn, stay.checkOut);
          if (request.allocations.length)
            throw new ConflictException(
              'Cette demande possède déjà un historique d’allocations.',
            );
          await tx.hotelStockAllocation.createMany({
            data: nights.map((day) => ({
              id: randomUUID(),
              requestId: id,
              roomId: room.id,
              date: new Date(`${day}T00:00:00Z`),
              units: request.units!,
            })),
          });
        }
        if (
          status === 'completed' &&
          (!request.checkOut || hotelDate(request.checkOut) > hotelToday())
        )
          throw new ConflictException(
            'Le séjour ne peut être terminé avant sa date de départ.',
          );
        if (
          request.status === 'accepted' &&
          ['refused', 'cancelled'].includes(status)
        )
          await tx.hotelStockAllocation.updateMany({
            where: { requestId: id, releasedAt: null },
            data: { releasedAt: new Date() },
          });
        await tx.hotelReservationRequest.update({
          where: { id },
          data: {
            status,
            events: {
              create: {
                actorUserId: ownerUserId,
                fromStatus: request.status,
                toStatus: status,
                note: dto.note?.trim() || undefined,
              },
            },
          },
        });
        return this.view(
          await tx.hotelReservationRequest.findUniqueOrThrow({
            where: { id },
            include: this.include(),
          }),
        );
      },
      { maxWait: 10000, timeout: 30000 },
    );
  }
}

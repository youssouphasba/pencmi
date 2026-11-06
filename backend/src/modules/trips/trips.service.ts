import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "crypto";
import {
  ContactSource,
  ListingStatus,
  PencmiModule,
  RequestStatus,
  TargetType,
} from "@prisma/client";
import { Prisma } from "@prisma/client";
import {
  getPagination,
  PaginationDto,
} from "../../common/pagination/pagination.dto";
import { PrismaService } from "../../database/prisma/prisma.service";
import {
  CreateSeatRequestDto,
  TripSearchDto,
  UpdateSeatRequestStatusDto,
} from "./trips.dto";
import {
  canonicalTripType,
  TRIP_TYPE_ALIASES,
  tripDeparture,
} from "./trip-publication.schema";
import { tripObject } from "./trip-publication.service";

export function tripPublicWhere(
  query: Partial<TripSearchDto>,
  now = new Date(),
): Prisma.TripListingWhereInput {
  const today = new Date(now.toISOString().slice(0, 10) + "T00:00:00Z");
  const tomorrow = new Date(today.getTime() + 86400000);
  const and: Prisma.TripListingWhereInput[] = [
    { departureTime: { gte: "00:00", lte: "23:59" } },
    {
      OR: [
        { departureDate: { gte: tomorrow }, departureTime: { not: null } },
        {
          departureDate: { gte: today, lt: tomorrow },
          departureTime: { gt: now.toISOString().slice(11, 16) },
        },
      ],
    },
  ];
  for (const key of ["departureCity", "arrivalCity"] as const)
    if (query[key])
      and.push({ [key]: { contains: query[key], mode: "insensitive" } });
  if (query.query)
    and.push({
      OR: [
        "title",
        "departureCity",
        "arrivalCity",
        "departurePoint",
        "arrivalPoint",
      ].map((key) => ({
        [key]: { contains: query.query, mode: "insensitive" },
      })),
    });
  if (query.date) {
    const day = new Date(`${query.date}T00:00:00Z`);
    if (
      Number.isNaN(day.getTime()) ||
      day.toISOString().slice(0, 10) !== query.date
    )
      throw new BadRequestException("Date invalide.");
    and.push({
      departureDate: { gte: day, lt: new Date(day.getTime() + 86400000) },
    });
  }
  if (query.vehicleType)
    and.push({
      vehicleType: {
        in: [
          query.vehicleType,
          ...Object.keys(TRIP_TYPE_ALIASES).filter(
            (key) => TRIP_TYPE_ALIASES[key] === query.vehicleType,
          ),
        ],
      },
    });
  if (query.passengers) and.push({ availableSeats: { gte: query.passengers } });
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.minPrice > query.maxPrice
    )
      throw new BadRequestException("Fourchette de prix invalide.");
    and.push({ pricePerSeat: { gte: query.minPrice, lte: query.maxPrice } });
  }
  const hours: Record<string, [string, string]> = {
    morning: ["06:00", "12:00"],
    afternoon: ["12:00", "17:00"],
    evening: ["17:00", "21:00"],
  };
  if (query.timeOfDay === "night")
    and.push({
      OR: [
        { departureTime: { lt: "06:00" } },
        { departureTime: { gte: "21:00" } },
      ],
    });
  else if (query.timeOfDay && hours[query.timeOfDay])
    and.push({
      departureTime: {
        gte: hours[query.timeOfDay][0],
        lt: hours[query.timeOfDay][1],
      },
    });
  return { status: ListingStatus.active, deletedAt: null, AND: and };
}
export function publicTrip(row: any) {
  const m = tripObject(row.metadata),
    p = tripObject(m.publication),
    c = tripObject(p.contactPreferences);
  const contact = {
    phoneEnabled: !!c.phoneEnabled,
    phoneNumber: c.phoneEnabled ? c.phoneNumber : undefined,
    whatsappEnabled: !!c.whatsappEnabled,
    whatsappNumber: c.whatsappEnabled ? c.whatsappNumber : undefined,
    emailEnabled: !!c.emailEnabled,
    contactEmail: c.emailEnabled ? c.contactEmail : undefined,
    reservationRequestEnabled: p.contactPreferences
      ? !!c.reservationRequestEnabled
      : true,
  };
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    vehicleType: canonicalTripType(row.vehicleType),
    departureCity: row.departureCity,
    arrivalCity: row.arrivalCity,
    departurePoint: row.departurePoint,
    arrivalPoint: row.arrivalPoint,
    departureDate: row.departureDate,
    departureTime: row.departureTime,
    availableSeats: row.availableSeats,
    pricePerSeat: row.pricePerSeat,
    currency: row.currency,
    metadata: {
      description: p.content?.description ?? m.description,
      instructions: p.content?.instructions,
      conditions: p.conditions ?? m.conditions,
      meetingPoints: p.route?.meetingPoints,
      vehicleLabel:
        [p.vehicle?.brand, p.vehicle?.model].filter(Boolean).join(" ") ||
        m.vehicleLabel,
      passengerInfo: p.vehicle?.passengerInfo,
      totalSeats: p.vehicle?.totalSeats,
      estimatedArrivalTime: p.schedule?.arrivalTime ?? m.estimatedArrivalTime,
      arrivalNextDay:
        p.schedule?.arrivalNextDay ||
        (!!p.schedule?.arrivalTime &&
          p.schedule.arrivalTime < row.departureTime),
      airConditioning: p.vehicle?.airConditioning ?? m.airConditioning,
      luggageExtra: p.pricing?.luggageExtra,
      luggageIncluded: p.pricing?.luggageIncluded,
      negotiable: p.pricing?.negotiable,
      contactPreferences: contact,
    },
    owner: row.owner
      ? {
          ...row.owner,
          professionalProfile: row.owner.professionalProfile
            ? {
                ...row.owner.professionalProfile,
                professionalPhone: undefined,
                professionalEmail: undefined,
                whatsappNumber: undefined,
              }
            : null,
        }
      : undefined,
  };
}

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

  async findPublic(query: TripSearchDto) {
    const pagination = getPagination(query);
    const where = tripPublicWhere(query);
    const [data, total] = await Promise.all([
      this.prisma.tripListing.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [
          { departureDate: "asc" },
          { departureTime: "asc" },
          { id: "asc" },
        ],
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
    return { data: data.map(publicTrip), meta: pagination.meta(total) };
  }

  async findPublicOne(id: string) {
    const row = await this.prisma.tripListing.findFirst({
      where: { ...tripPublicWhere({}), id },
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
    if (!row) throw new NotFoundException("Trajet introuvable.");
    return publicTrip(row);
  }

  async createSeatRequest(tripId: string, dto: CreateSeatRequestDto) {
    if (!dto.clientPhone && !dto.clientEmail)
      throw new BadRequestException("Un téléphone ou un email est nécessaire.");
    const id =
      "seat_" +
      createHash("sha256").update(`${tripId}:${dto.requestId}`).digest("hex");
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "TripListing" WHERE "id" = ${tripId} FOR UPDATE`;
      const trip = await tx.tripListing.findFirst({
        where: { id: tripId, ...tripPublicWhere({}) },
      });
      if (
        !trip ||
        !trip.departureDate ||
        !trip.departureTime ||
        tripDeparture(trip.departureDate.toISOString(), trip.departureTime) <=
          new Date()
      )
        throw new NotFoundException("Trajet indisponible.");
      const preferences = tripObject(
        tripObject(trip.metadata).publication,
      ).contactPreferences;
      if (preferences && !preferences.reservationRequestEnabled)
        throw new ConflictException("Les demandes de place sont désactivées.");
      if (!trip.availableSeats || dto.requestedSeats > trip.availableSeats)
        throw new BadRequestException(
          "La demande dépasse les places déclarées.",
        );
      const previous = await tx.tripSeatRequest.findUnique({ where: { id } });
      if (previous) {
        if (
          previous.clientPhone !== (dto.clientPhone || null) ||
          previous.clientEmail !== (dto.clientEmail || null) ||
          previous.requestedSeats !== dto.requestedSeats ||
          previous.clientName !== dto.clientName ||
          previous.message !== (dto.message || null) ||
          previous.luggage !== (dto.luggage ?? null)
        )
          throw new ConflictException(
            "Cette demande a déjà été traitée avec des informations différentes.",
          );
        return { id: previous.id, status: previous.status };
      }
      const request = await tx.tripSeatRequest.create({
        data: {
          id,
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
        data: {
          ownerUserId: trip.ownerUserId,
          module: PencmiModule.trips,
          source: ContactSource.seat_request,
          targetType: TargetType.listing,
          targetId: tripId,
          metadata: { requestId: request.id },
        },
      });
      return { id: request.id, status: request.status };
    });
  }

  async findMine(ownerUserId: string, dto: PaginationDto) {
    const pagination = getPagination(dto);
    const where = { ownerUserId, deletedAt: null };
    const [data, total] = await Promise.all([
      this.prisma.tripListing.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: { updatedAt: "desc" },
      }),
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
        orderBy: { createdAt: "desc" },
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

  async updateSeatRequestStatus(
    ownerUserId: string,
    id: string,
    dto: UpdateSeatRequestStatusDto,
  ) {
    const request = await this.prisma.tripSeatRequest.findFirst({
      where: {
        id,
        trip: {
          ownerUserId,
          deletedAt: null,
        },
      },
      select: { id: true, status: true },
    });
    if (!request) throw new NotFoundException("Demande introuvable.");

    const transitions: Record<string, string[]> = {
      new: ["pending", "requires_more_info", "refused", "cancelled"],
      pending: ["requires_more_info", "refused", "cancelled"],
      requires_more_info: ["pending", "refused", "cancelled"],
      accepted: ["cancelled"],
    };
    if (
      request.status !== dto.status &&
      !transitions[request.status]?.includes(dto.status)
    )
      throw new ConflictException("Transition non autorisée.");

    try {
      return await this.prisma.tripSeatRequest.update({
        where: { id: request.id, status: request.status },
        data: { status: dto.status as RequestStatus },
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
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      )
        throw new ConflictException(
          "Cette demande a été modifiée. Actualisez la page.",
        );
      throw error;
    }
  }
}

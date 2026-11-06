import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { TripOccurrencesService } from "./trip-occurrences.service";
import { ListingStatus } from "@prisma/client";
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
  const occurrence = row.selectedOccurrence || row.occurrences?.[0];
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
    occurrenceId: occurrence?.id || null,
    occurrences: row.occurrences?.map((item: any) => ({
      id: item.id,
      serviceDate: item.serviceDate,
      departureAt: item.departureAt,
      estimatedArrivalAt: item.estimatedArrivalAt,
      remainingSeats: item.remainingSeats,
      pricePerSeat: item.pricePerSeat,
    })),
    slug: row.slug,
    title: row.title,
    vehicleType: canonicalTripType(row.vehicleType),
    departureCity: row.departureCity,
    arrivalCity: row.arrivalCity,
    departurePoint: row.departurePoint,
    arrivalPoint: row.arrivalPoint,
    departureDate: occurrence?.serviceDate || row.departureDate,
    departureTime:
      occurrence?.departureAt?.toISOString().slice(11, 16) || row.departureTime,
    availableSeats: occurrence ? occurrence.remainingSeats : null,
    pricePerSeat: occurrence ? occurrence.pricePerSeat : row.pricePerSeat,
    offeredSeats: occurrence?.offeredSeats,
    confirmedSeats: occurrence?.confirmedSeats,
    estimatedArrivalAt: occurrence?.estimatedArrivalAt || null,
    currency: row.currency,
    metadata: {
      description: p.content?.description ?? m.description,
      instructions: p.content?.instructions,
      conditions: p.conditions ?? m.conditions,
      meetingPoints: p.route?.meetingPoints,
      stops: p.route?.stops,
      rendezvous: p.route?.rendezvous,
      durationMinutes: occurrence?.estimatedArrivalAt
        ? (occurrence.estimatedArrivalAt.getTime() -
            occurrence.departureAt.getTime()) /
          60000
        : p.schedule?.durationMinutes,
      vehicleLabel:
        [p.vehicle?.brand, p.vehicle?.model].filter(Boolean).join(" ") ||
        m.vehicleLabel,
      passengerInfo: p.vehicle?.passengerInfo,
      totalSeats: p.vehicle?.totalSeats,
      estimatedArrivalTime:
        occurrence?.estimatedArrivalAt?.toISOString().slice(11, 16) ||
        p.schedule?.arrivalTime ||
        m.estimatedArrivalTime,
      arrivalDayOffset: occurrence?.estimatedArrivalAt
        ? Math.floor(
            (Date.parse(
              occurrence.estimatedArrivalAt.toISOString().slice(0, 10),
            ) -
              Date.parse(occurrence.serviceDate.toISOString().slice(0, 10))) /
              86400000,
          )
        : undefined,
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
  constructor(
    private readonly prisma: PrismaService,
    private readonly occurrences: TripOccurrencesService = new TripOccurrencesService(
      prisma,
    ),
  ) {}

  async findPublic(query: TripSearchDto) {
    const pagination = getPagination(query);
    const and: Prisma.TripListingWhereInput[] = [];
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
    const where: Prisma.TripOccurrenceWhereInput = {
      trip: { status: "active", deletedAt: null, AND: and },
      cancelledAt: null,
      departureAt: { gt: new Date() },
      remainingSeats: { gte: query.passengers || 1 },
    };
    if (query.date) {
      const date = new Date(query.date + "T00:00:00Z");
      if (
        !Number.isFinite(date.getTime()) ||
        date.toISOString().slice(0, 10) !== query.date
      )
        throw new BadRequestException("Date invalide.");
      where.serviceDate = date;
    }
    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.minPrice > query.maxPrice
    )
      throw new BadRequestException("Fourchette de prix invalide.");
    if (query.minPrice !== undefined || query.maxPrice !== undefined)
      where.pricePerSeat = { gte: query.minPrice, lte: query.maxPrice };
    const ranges: Record<string, [string, string]> = {
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
    else if (query.timeOfDay && ranges[query.timeOfDay])
      and.push({
        departureTime: {
          gte: ranges[query.timeOfDay][0],
          lt: ranges[query.timeOfDay][1],
        },
      });
    const [occurrences, total] = await Promise.all([
      this.prisma.tripOccurrence.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ departureAt: "asc" }, { id: "asc" }],
        include: {
          trip: {
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
                      logoUrl: true,
                      verified: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.tripOccurrence.count({ where }),
    ]);
    return {
      data: occurrences.map((occurrence) =>
        publicTrip({ ...occurrence.trip, selectedOccurrence: occurrence }),
      ),
      meta: pagination.meta(total),
    };
  }

  async findPublicOne(id: string, occurrenceId?: string) {
    const row = await this.prisma.tripListing.findFirst({
      where: { id, status: "active", deletedAt: null },
      include: {
        _count: { select: { occurrences: true } },
        occurrences: {
          where: { cancelledAt: null, departureAt: { gt: new Date() } },
          orderBy: [{ departureAt: "asc" }, { id: "asc" }],
          take: 90,
        },
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            city: true,
            role: true,
            professionalProfile: {
              select: { businessName: true, logoUrl: true, verified: true },
            },
          },
        },
      },
    });
    if (!row) throw new NotFoundException("Trajet introuvable.");
    const selected = occurrenceId
      ? row.occurrences.find((occurrence) => occurrence.id === occurrenceId)
      : row.occurrences[0];
    if (occurrenceId && !selected)
      throw new NotFoundException("Départ introuvable.");
    if (!selected && row._count.occurrences > 0)
      throw new NotFoundException("Aucun départ disponible.");
    if (
      !selected &&
      (!row.departureDate ||
        !row.departureTime ||
        tripDeparture(row.departureDate.toISOString(), row.departureTime) <=
          new Date())
    )
      throw new NotFoundException("Trajet introuvable.");
    return publicTrip({ ...row, selectedOccurrence: selected });
  }

  createSeatRequest(tripId: string, dto: CreateSeatRequestDto) {
    return this.occurrences.createRequest(tripId, dto);
  }

  async findMine(ownerUserId: string, dto: PaginationDto) {
    const pagination = getPagination(dto);
    const where = { ownerUserId, deletedAt: null };
    const [data, total] = await Promise.all([
      this.prisma.tripListing.findMany({
        where,
        include: { occurrences: { orderBy: { departureAt: "asc" } } },
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      }),
      this.prisma.tripListing.count({ where }),
    ]);
    const decisions = await this.prisma.auditLog.findMany({
      where: {
        module: "trips",
        targetId: { in: data.map((row) => row.id) },
        action: { in: ["trip.refused", "trip.suspended"] },
      },
      orderBy: { createdAt: "desc" },
      select: { targetId: true, metadata: true },
    });
    return {
      data: data.map((row) => ({
        ...row,
        moderationReason:
          tripObject(
            decisions.find((item) => item.targetId === row.id)?.metadata,
          ).reason || null,
      })),
      meta: pagination.meta(total),
    };
  }

  async findMySeatRequests(ownerUserId: string, dto: PaginationDto) {
    const pagination = getPagination(dto);
    const where = {
      trip: {
        ownerUserId,
      },
    };
    const [data, total] = await Promise.all([
      this.prisma.tripSeatRequest.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        include: {
          occurrence: true,
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

  updateSeatRequestStatus(
    ownerUserId: string,
    id: string,
    dto: UpdateSeatRequestStatusDto,
  ) {
    return this.occurrences.updateRequest(ownerUserId, id, dto);
  }

  private async targetIds(ownerUserId: string) {
    return (
      await this.prisma.tripListing.findMany({
        where: { ownerUserId },
        select: { id: true },
      })
    ).map((row) => row.id);
  }
  async contacts(ownerUserId: string, query: PaginationDto) {
    const ids = await this.targetIds(ownerUserId),
      p = getPagination(query);
    const where: Prisma.ContactEventWhereInput = {
      ownerUserId,
      module: "trips",
      targetType: "listing",
      targetId: { in: ids },
    };
    const [data, total] = await Promise.all([
      this.prisma.contactEvent.findMany({
        where,
        skip: p.skip,
        take: p.take,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      }),
      this.prisma.contactEvent.count({ where }),
    ]);
    return { data, meta: p.meta(total) };
  }
  async conversations(ownerUserId: string, query: PaginationDto) {
    const ids = await this.targetIds(ownerUserId),
      p = getPagination(query);
    const where: Prisma.ConversationWhereInput = {
      module: "trips",
      targetType: "listing",
      targetId: { in: ids },
      participants: { some: { userId: ownerUserId } },
    };
    const [data, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        skip: p.skip,
        take: p.take,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
      }),
      this.prisma.conversation.count({ where }),
    ]);
    return { data, meta: p.meta(total) };
  }
  async statistics(ownerUserId: string) {
    const ids = await this.targetIds(ownerUserId);
    const [
      requests,
      places,
      contacts,
      occurrences,
      inboundMessages,
      historical,
    ] = await Promise.all([
      this.prisma.tripSeatRequest.groupBy({
        by: ["status"],
        where: { tripId: { in: ids } },
        _count: { _all: true },
      }),
      this.prisma.tripSeatRequest.aggregate({
        where: { tripId: { in: ids } },
        _sum: { requestedSeats: true },
      }),
      this.prisma.contactEvent.groupBy({
        by: ["source"],
        where: {
          ownerUserId,
          module: "trips",
          targetType: "listing",
          targetId: { in: ids },
          source: { not: "seat_request" },
        },
        _count: { _all: true },
      }),
      this.prisma.tripOccurrence.aggregate({
        where: { tripId: { in: ids } },
        _sum: { confirmedSeats: true },
      }),
      this.prisma.message.count({
        where: {
          senderUserId: { not: ownerUserId },
          conversation: {
            module: "trips",
            targetType: "listing",
            targetId: { in: ids },
            participants: { some: { userId: ownerUserId } },
          },
        },
      }),
      this.prisma.tripSeatRequest.count({
        where: {
          tripId: { in: ids },
          status: { in: ["accepted", "completed"] },
          allocatedSeats: null,
        },
      }),
    ]);
    return {
      requestsByStatus: Object.fromEntries(
        requests.map((row) => [row.status, row._count._all]),
      ),
      totalRequests: requests.reduce((n, row) => n + row._count._all, 0),
      requestedSeats: places._sum.requestedSeats || 0,
      confirmedSeats: occurrences._sum.confirmedSeats || 0,
      directContacts: contacts.reduce((n, row) => n + row._count._all, 0),
      contactsBySource: Object.fromEntries(
        contacts.map((row) => [row.source, row._count._all]),
      ),
      inboundMessages,
      historicalUnallocatedRequests: historical,
      unavailableMetrics: ["views", "conversionRate", "responseTime"],
    };
  }
}

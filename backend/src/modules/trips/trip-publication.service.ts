import { assertModerationTransition, assertModerationVersion, recordListingDecision } from '../../common/utils/listing-moderation';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash, randomUUID } from "crypto";
import { PrismaService } from "../../database/prisma/prisma.service";
import { TripOccurrencesService } from "./trip-occurrences.service";
import { CreateTripDto, ModerateTripDto, UpdateTripDto } from "./trips.dto";
import {
  getPagination,
  PaginationDto,
} from "../../common/pagination/pagination.dto";
import {
  canonicalTripType,
  TripPublication,
  validateTripPublication,
  validateTripSubmission,
} from "./trip-publication.schema";

export const tripObject = (value: unknown): Record<string, any> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
export function tripPublicationFromListing(listing: any): TripPublication {
  const m = tripObject(listing.metadata);
  if (m.publication) return m.publication;
  return {
    vehicleType: canonicalTripType(
      listing.vehicleType,
    ) as TripPublication["vehicleType"],
    route: {
      departureCity: listing.departureCity,
      arrivalCity: listing.arrivalCity,
      departurePoint: listing.departurePoint || "",
      arrivalPoint: listing.arrivalPoint || "",
    },
    schedule: {
      date: listing.departureDate?.toISOString().slice(0, 10) || "",
      departureTime: listing.departureTime || "",
      arrivalTime: m.estimatedArrivalTime || "",
      regular: false,
    },
    vehicle: { totalSeats: m.totalSeats, airConditioning: m.airConditioning },
    pricing: {
      availableSeats: listing.availableSeats,
      pricePerSeat: listing.pricePerSeat,
      currency: "FCFA",
    },
    conditions: m.conditions || [],
    content: { title: listing.title, description: m.description || "" },
    contactPreferences: { reservationRequestEnabled: true },
  };
}
@Injectable()
export class TripPublicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly occurrences: TripOccurrencesService = new TripOccurrencesService(
      prisma,
    ),
  ) {}
  private async owned(
    tx: Prisma.TransactionClient,
    ownerUserId: string,
    id: string,
    edit = false,
  ) {
    if (edit)
      await tx.$queryRaw`SELECT "id" FROM "TripListing" WHERE "id" = ${id} AND "ownerUserId" = ${ownerUserId} FOR UPDATE`;
    const row = await tx.tripListing.findFirst({
      where: { id, ownerUserId, deletedAt: null },
    });
    if (!row) throw new NotFoundException("Trajet introuvable.");
    if (
      edit &&
      !["draft", "refused", "pending_review", "active"].includes(row.status)
    )
      throw new ConflictException(
        "Ce trajet ne peut pas être modifié dans son état actuel.",
      );
    return row;
  }
  private data(p: TripPublication, previous?: any) {
    return {
      title: p.content?.title || "",
      vehicleType: p.vehicleType || "",
      departureCity: p.route?.departureCity || "",
      arrivalCity: p.route?.arrivalCity || "",
      departurePoint: p.route?.departurePoint || null,
      arrivalPoint: p.route?.arrivalPoint || null,
      departureDate: p.schedule?.date
        ? new Date(`${p.schedule.date}T00:00:00Z`)
        : null,
      departureTime: p.schedule?.departureTime || null,
      pricePerSeat: p.pricing?.pricePerSeat ?? null,
      availableSeats: p.pricing?.availableSeats ?? null,
      currency: "FCFA",
      metadata: {
        ...tripObject(previous?.metadata),
        publication: p,
      } as Prisma.InputJsonValue,
    };
  }
  findOwned(ownerUserId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const row = await this.owned(tx, ownerUserId, id);
      const [occurrences, decision] = await Promise.all([
        tx.tripOccurrence.findMany({
          where: { tripId: id },
          orderBy: { departureAt: "asc" },
        }),
        tx.auditLog.findFirst({
          where: {
            targetId: id,
            module: "trips",
            action: { in: ["trip.refused", "trip.suspended"] },
          },
          orderBy: { createdAt: "desc" },
          select: { metadata: true, createdAt: true },
        }),
      ]);
      return {
        ...row,
        publication: tripPublicationFromListing(row),
        occurrences,
        moderationReason: tripObject(decision?.metadata).reason || null,
        moderatedAt: decision?.createdAt || null,
      };
    });
  }
  async create(ownerUserId: string, dto: CreateTripDto) {
    const p = validateTripPublication(dto.publication || {});
    const id =
      "trip_" +
      createHash("sha256")
        .update(`${ownerUserId}:${dto.requestId}`)
        .digest("hex");
    try {
      const row = await this.prisma.$transaction(async (tx) => {
        const created = await tx.tripListing.upsert({
          where: { id },
          update: {},
          create: {
            id,
            ownerUserId,
            slug: `voyage-${randomUUID()}`,
            ...this.data(p),
          },
        });
        await tx.$queryRaw`SELECT "id" FROM "TripListing" WHERE "id" = ${id} FOR UPDATE`;
        if (created.ownerUserId !== ownerUserId || created.deletedAt)
          throw new ConflictException("Cette création a déjà été traitée.");
        if (
          !(await tx.auditLog.count({
            where: { module: "trips", targetId: id, action: "trip.created" },
          }))
        )
          await this.occurrences.audit(tx, id, ownerUserId, "trip.created");
        return created;
      });
      if (row.ownerUserId !== ownerUserId || row.deletedAt)
        throw new ConflictException("Cette création a déjà été traitée.");
      return { ...row, publication: tripPublicationFromListing(row) };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        Array.isArray(error.meta?.target) &&
        error.meta.target.includes("id")
      )
        return this.findOwned(ownerUserId, id);
      throw error;
    }
  }
  update(ownerUserId: string, id: string, dto: UpdateTripDto) {
    const p = validateTripPublication(dto.publication);
    return this.prisma.$transaction(async (tx) => {
      const row = await this.owned(tx, ownerUserId, id, true);
      const changed =
        JSON.stringify(tripPublicationFromListing(row)) !== JSON.stringify(p);
      const previous = tripPublicationFromListing(row);
      if (
        changed &&
        JSON.stringify([
          previous.route,
          previous.schedule,
          previous.vehicle?.totalSeats,
          previous.pricing,
        ]) !==
          JSON.stringify([
            p.route,
            p.schedule,
            p.vehicle?.totalSeats,
            p.pricing,
          ])
      ) {
        await this.occurrences.protectAllocated(tx, id);
      }
      if (changed && ["active", "pending_review"].includes(row.status))
        validateTripSubmission(p);
      const updated = await tx.tripListing.update({
        where: { id },
        data: {
          ...this.data(p, row),
          status:
            changed && row.status === "active" ? "pending_review" : row.status,
        },
      });
      if (changed)
        await this.occurrences.audit(tx, id, ownerUserId, "trip.updated", {
          previousStatus: row.status,
          status: updated.status,
        });
      return updated;
    });
  }
  submit(ownerUserId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const row = await this.owned(tx, ownerUserId, id, true);
      const p = validateTripPublication(tripPublicationFromListing(row));
      validateTripSubmission(p);
      const updated = await tx.tripListing.update({
        where: { id },
        data: { status: "pending_review" },
      });
      if (row.status !== "pending_review")
        await this.occurrences.audit(tx, id, ownerUserId, "trip.submitted");
      return updated;
    });
  }
  softDelete(ownerUserId: string, id: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.owned(tx, ownerUserId, id, true);
      await this.occurrences.protectAllocated(tx, id);
      const updated = await tx.tripListing.update({
        where: { id },
        data: { status: "deleted", deletedAt: new Date() },
      });
      await this.occurrences.audit(tx, id, ownerUserId, "trip.deleted");
      return updated;
    });
  }
  async findForModeration(query: PaginationDto) {
    const pagination = getPagination(query),
      where = { deletedAt: null };
    const [data, total] = await Promise.all([
      this.prisma.tripListing.findMany({
        where,
        skip: pagination.skip,
        take: pagination.take,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      }),
      this.prisma.tripListing.count({ where }),
    ]);
    return { data, meta: pagination.meta(total) };
  }
  moderate(actorUserId: string, id: string, dto: ModerateTripDto) {
    if (dto.status !== "active" && !dto.reason?.trim())
      throw new BadRequestException("Un motif est nécessaire.");
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "TripListing" WHERE "id" = ${id} FOR UPDATE`;
      const row = await tx.tripListing.findFirst({
        where: { id, deletedAt: null },
      });
      if (!row || row.status === 'deleted') throw new NotFoundException("Trajet introuvable.");
      assertModerationVersion(row.updatedAt, dto.expectedUpdatedAt);
      assertModerationTransition(row.status, dto.status, dto.reason);
      if (dto.status === "active") {
        const p = validateTripPublication(tripPublicationFromListing(row));
        validateTripSubmission(p);
        await this.occurrences.materialize(tx, row, p);
      }
      const updated = await tx.tripListing.update({
        where: { id },
        data: { status: dto.status },
      });
      await recordListingDecision(tx, actorUserId, 'trips', row, dto.status, dto.reason);
      return updated;
    });
  }
}

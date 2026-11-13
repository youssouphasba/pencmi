import { notifyClientRequestStatus } from '../../common/utils/client-request-notification';
import { lockRequestAccounts } from '../../common/utils/request-account-lock';
import { CLIENT_REQUEST_TRANSACTION } from '../../common/utils/client-request-retry';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { PrismaService } from "../../database/prisma/prisma.service";
import {
  TripPublication,
  tripArrivalAt,
  tripDeparture,
  tripServiceDates,
} from "./trip-publication.schema";
import { CreateSeatRequestDto, UpdateSeatRequestStatusDto } from "./trips.dto";

@Injectable()
export class TripOccurrencesService {
  constructor(private readonly prisma: PrismaService) {}
  async audit(
    tx: Prisma.TransactionClient,
    tripId: string,
    actorUserId: string | undefined,
    action: string,
    metadata: Prisma.InputJsonObject = {},
  ) {
    await tx.auditLog.create({
      data: {
        actorUserId,
        action,
        module: "trips",
        targetType: "listing",
        targetId: tripId,
        metadata,
      },
    });
  }
  async protectAllocated(tx: Prisma.TransactionClient, tripId: string) {
    if (
      await tx.tripSeatRequest.count({
        where: {
          tripId,
          OR: [
            { status: "accepted" },
            {
              allocatedSeats: { gt: 0 },
              occurrence: { departureAt: { gt: new Date() } },
            },
          ],
        },
      })
    )
      throw new ConflictException(
        "Annulez explicitement les demandes acceptées avant cette opération.",
      );
  }
  async materialize(
    tx: Prisma.TransactionClient,
    trip: any,
    publication: TripPublication,
  ) {
    if (
      await tx.tripSeatRequest.count({
        where: { tripId: trip.id, status: "accepted", allocatedSeats: null },
      })
    )
      throw new ConflictException(
        "Une demande historique acceptée nécessite une réconciliation explicite avant la mise en service des places.",
      );
    const dates = tripServiceDates(publication),
      ids: string[] = [];
    const previous = await tx.tripOccurrence.findMany({
      where: { tripId: trip.id },
    });
    for (const date of dates) {
      if (
        tripDeparture(date, publication.schedule!.departureTime!) <= new Date()
      )
        continue;
      const id =
        "occ_" +
        createHash("sha256")
          .update(`${trip.id}:${date}:${publication.schedule!.departureTime}`)
          .digest("hex");
      ids.push(id);
      const existing = previous.find((row) => row.id === id);
      const data = {
        departureAt: tripDeparture(date, publication.schedule!.departureTime!),
        estimatedArrivalAt: tripArrivalAt(publication, date),
        totalCapacity: publication.vehicle!.totalSeats!,
        offeredSeats: publication.pricing!.availableSeats!,
        pricePerSeat: publication.pricing!.pricePerSeat!,
      };
      const confirmed = existing?.confirmedSeats || 0;
      if (
        confirmed &&
        (data.departureAt.getTime() !== existing!.departureAt.getTime() ||
          data.offeredSeats !== existing!.offeredSeats ||
          data.totalCapacity !== existing!.totalCapacity ||
          data.pricePerSeat !== existing!.pricePerSeat)
      )
        throw new ConflictException(
          "Un départ avec des places allouées ne peut pas être reconfiguré.",
        );
      await tx.tripOccurrence.upsert({
        where: { id },
        create: {
          id,
          tripId: trip.id,
          serviceDate: new Date(`${date}T00:00:00Z`),
          ...data,
          remainingSeats: data.offeredSeats,
        },
        update: { ...data, remainingSeats: data.offeredSeats - confirmed },
      });
    }
    for (const row of previous.filter(
      (row) =>
        !ids.includes(row.id) &&
        !row.cancelledAt &&
        row.departureAt > new Date(),
    )) {
      if (row.confirmedSeats > 0)
        throw new ConflictException(
          "Un départ avec des places allouées ne peut pas être retiré.",
        );
      const pending = await tx.tripSeatRequest.findMany({
        where: {
          occurrenceId: row.id,
          status: { in: ["new", "pending", "requires_more_info"] },
        },
      });
      for (const request of pending) {
        await tx.tripSeatRequest.update({
          where: { id: request.id },
          data: { status: "cancelled" },
        });
        await this.audit(tx, trip.id, undefined, "trip.request.cancelled", {
          requestId: request.id,
          occurrenceId: row.id,
          reason: "program_changed",
        });
      }
      await tx.tripOccurrence.update({
        where: { id: row.id },
        data: {
          cancelledAt: new Date(),
          cancellationReason: "Programme modifié après validation",
        },
      });
    }
  }
  async createRequest(tripId: string, dto: CreateSeatRequestDto, clientUserId?: string) {
    if (!dto.occurrenceId || (!dto.clientPhone && !dto.clientEmail))
      throw new BadRequestException(
        "Sélectionnez un départ et renseignez un contact.",
      );
    const id =
      "seat_" +
      createHash("sha256").update(`${tripId}:${dto.requestId}`).digest("hex");
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "TripListing" WHERE "id" = ${tripId} FOR UPDATE`;
      const trip = await tx.tripListing.findFirst({
        where: { id: tripId, status: "active", deletedAt: null },
      });
      if (!trip) throw new NotFoundException("Trajet indisponible.");
      await tx.$queryRaw`SELECT "id" FROM "TripOccurrence" WHERE "id" = ${dto.occurrenceId} AND "tripId" = ${tripId} FOR UPDATE`;
      const occurrence = await tx.tripOccurrence.findFirst({
        where: {
          id: dto.occurrenceId,
          tripId,
          cancelledAt: null,
          departureAt: { gt: new Date() },
        },
      });
      if (!occurrence) throw new NotFoundException("Départ indisponible.");
      const preferences = (trip.metadata as any)?.publication
        ?.contactPreferences;
      if (preferences && !preferences.reservationRequestEnabled)
        throw new ConflictException("Les demandes sont désactivées.");
      const previous = await tx.tripSeatRequest.findUnique({ where: { id } });
      if (previous) {
        if (
          (previous.clientUserId ?? null) !== (clientUserId ?? null) ||
          previous.occurrenceId !== dto.occurrenceId ||
          previous.clientName !== dto.clientName ||
          previous.clientEmail !== (dto.clientEmail || null) ||
          previous.clientPhone !== (dto.clientPhone || null) ||
          previous.message !== (dto.message || null) ||
          previous.luggage !== (dto.luggage ?? null) ||
          previous.requestedSeats !== dto.requestedSeats
        )
          throw new ConflictException(
            "Cette demande existe avec des informations différentes.",
          );
        return {
          id: previous.id,
          status: previous.status,
          occurrenceId: previous.occurrenceId,
        };
      }
      if (dto.requestedSeats > occurrence.remainingSeats)
        throw new ConflictException("Les places restantes sont insuffisantes.");
      await lockRequestAccounts(tx, trip.ownerUserId, clientUserId);
      const request = await tx.tripSeatRequest.create({
        data: {
          id,
          tripId,
          clientUserId,
          occurrenceId: occurrence.id,
          allocatedSeats: 0,
          quotedPricePerSeat: occurrence.pricePerSeat,
          clientName: dto.clientName,
          clientPhone: dto.clientPhone,
          clientEmail: dto.clientEmail,
          requestedSeats: dto.requestedSeats,
          message: dto.message,
          luggage: dto.luggage,
        },
      });
      await tx.contactEvent.create({
        data: {
          ownerUserId: trip.ownerUserId,
          module: "trips",
          source: "seat_request",
          targetType: "listing",
          targetId: tripId,
          metadata: { requestId: id, occurrenceId: occurrence.id },
        },
      });
      await this.audit(tx, tripId, undefined, "trip.request.created", {
        requestId: id,
        occurrenceId: occurrence.id,
      });
      return {
        id: request.id,
        status: request.status,
        occurrenceId: occurrence.id,
      };
    }, CLIENT_REQUEST_TRANSACTION);
  }
  async updateRequest(
    ownerUserId: string,
    id: string,
    dto: UpdateSeatRequestStatusDto,
  ) {
    const initial = await this.prisma.tripSeatRequest.findFirst({
      where: { id, trip: { ownerUserId } },
      select: { tripId: true },
    });
    if (!initial) throw new NotFoundException("Demande introuvable.");
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "TripListing" WHERE "id" = ${initial.tripId} AND "ownerUserId" = ${ownerUserId} FOR UPDATE`;
      const request = await tx.tripSeatRequest.findUniqueOrThrow({
        where: { id },
        include: { trip: true, occurrence: true },
      });
      const occurrence = request.occurrence;
      if (occurrence)
        await tx.$queryRaw`SELECT "id" FROM "TripOccurrence" WHERE "id" = ${occurrence.id} FOR UPDATE`;
      if (request.status === dto.status) {
        if (dto.status === "accepted")
          throw new ConflictException("Cette demande a déjà été acceptée.");
        return tx.tripSeatRequest.findUniqueOrThrow({
          where: { id },
          include: { trip: true, occurrence: true },
        });
      }
      const transitions: Record<string, string[]> = {
        new: [
          "accepted",
          "pending",
          "requires_more_info",
          "refused",
          "cancelled",
        ],
        pending: ["accepted", "requires_more_info", "refused", "cancelled"],
        requires_more_info: ["accepted", "pending", "refused", "cancelled"],
        accepted: ["cancelled", "completed"],
      };
      if (!transitions[request.status]?.includes(dto.status))
        throw new ConflictException("Transition non autorisée.");
      let allocated = request.allocatedSeats;
      if (dto.status === "accepted") {
        if (!occurrence || request.allocatedSeats === null)
          throw new ConflictException(
            "Demande historique non réconciliée : aucune allocation automatique.",
          );
        if (request.quotedPricePerSeat !== occurrence.pricePerSeat)
          throw new ConflictException(
            "Le tarif a changé. Une nouvelle demande est nécessaire.",
          );
        if (
          request.trip.status !== "active" ||
          request.trip.deletedAt ||
          occurrence.cancelledAt ||
          occurrence.departureAt <= new Date() ||
          occurrence.remainingSeats < request.requestedSeats
        )
          throw new ConflictException(
            "Ce départ ne peut pas confirmer ces places.",
          );
        const result = await tx.tripOccurrence.updateMany({
          where: {
            id: occurrence.id,
            remainingSeats: { gte: request.requestedSeats },
            cancelledAt: null,
          },
          data: {
            confirmedSeats: { increment: request.requestedSeats },
            remainingSeats: { decrement: request.requestedSeats },
          },
        });
        if (result.count !== 1)
          throw new ConflictException("Places insuffisantes.");
        allocated = request.requestedSeats;
      } else if (
        dto.status === "cancelled" &&
        request.status === "accepted" &&
        allocated
      ) {
        if (!occurrence || occurrence.departureAt <= new Date())
          throw new ConflictException(
            "Les places d’un départ passé ne peuvent pas être recréditées.",
          );
        await tx.tripOccurrence.update({
          where: { id: occurrence.id },
          data: {
            confirmedSeats: { decrement: allocated },
            remainingSeats: { increment: allocated },
          },
        });
        allocated = 0;
      } else if (
        dto.status === "completed" &&
        occurrence &&
        occurrence.departureAt > new Date()
      )
        throw new ConflictException("Le départ n’a pas encore eu lieu.");
      const updated = await tx.tripSeatRequest.update({
        where: { id },
        data: { status: dto.status, allocatedSeats: allocated },
        include: { trip: true, occurrence: true },
      });
      await notifyClientRequestStatus(tx, 'trip', request, dto.status);
      await this.audit(
        tx,
        initial.tripId,
        ownerUserId,
        `trip.request.${dto.status}`,
        {
          requestId: id,
          occurrenceId: request.occurrenceId,
          previousStatus: request.status,
          historicalUnallocated: request.allocatedSeats === null,
        },
      );
      return updated;
    });
  }
  async cancel(
    ownerUserId: string,
    tripId: string,
    occurrenceId: string,
    reason: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "TripListing" WHERE "id" = ${tripId} AND "ownerUserId" = ${ownerUserId} FOR UPDATE`;
      const trip = await tx.tripListing.findFirst({
        where: { id: tripId, ownerUserId, deletedAt: null },
      });
      if (!trip) throw new NotFoundException("Trajet introuvable.");
      await tx.$queryRaw`SELECT "id" FROM "TripOccurrence" WHERE "id" = ${occurrenceId} FOR UPDATE`;
      const row = await tx.tripOccurrence.findFirst({
        where: { id: occurrenceId, tripId },
      });
      if (!row) throw new NotFoundException("Départ introuvable.");
      if (row.cancelledAt) return row;
      if (row.departureAt <= new Date())
        throw new ConflictException("Un départ passé ne peut pas être annulé.");
      const requests = await tx.tripSeatRequest.findMany({
        where: {
          occurrenceId,
          status: { in: ["new", "pending", "requires_more_info", "accepted"] },
        },
      });
      if (
        requests.some(
          (request) =>
            request.status === "accepted" && request.allocatedSeats === null,
        )
      )
        throw new ConflictException(
          "Allocation historique inconnue : réconciliation nécessaire.",
        );
      for (const request of requests) {
        await tx.tripSeatRequest.update({
          where: { id: request.id },
          data: {
            status: "cancelled",
            allocatedSeats: request.allocatedSeats === null ? null : 0,
          },
        });
        await notifyClientRequestStatus(tx, 'trip', request, 'cancelled');
        await this.audit(tx, tripId, ownerUserId, "trip.request.cancelled", {
          requestId: request.id,
          occurrenceId,
          reason,
        });
      }
      const consumed = await tx.tripSeatRequest.aggregate({
        where: { occurrenceId, status: "completed" },
        _sum: { allocatedSeats: true },
      });
      const confirmedSeats = consumed._sum.allocatedSeats || 0;
      const cancelled = await tx.tripOccurrence.update({
        where: { id: occurrenceId },
        data: {
          cancelledAt: new Date(),
          cancellationReason: reason,
          confirmedSeats,
          remainingSeats: row.offeredSeats - confirmedSeats,
        },
      });
      await this.audit(tx, tripId, ownerUserId, "trip.occurrence.cancelled", {
        occurrenceId,
        reason,
      });
      return cancelled;
    });
  }
}

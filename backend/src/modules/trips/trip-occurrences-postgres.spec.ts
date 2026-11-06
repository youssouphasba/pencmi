import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../../database/prisma/prisma.service";
import { TripPublicationService } from "./trip-publication.service";
import { TripOccurrencesService } from "./trip-occurrences.service";
import { TripsService } from "./trips.service";
import { ConversationsService } from "../conversations/conversations.service";

const url = process.env.TEST_DATABASE_URL;
(url ? describe : describe.skip)(
  "Trip occurrences and capacity on isolated PostgreSQL",
  () => {
    let db: PrismaClient,
      publication: TripPublicationService,
      operations: TripOccurrencesService,
      service: TripsService,
      owner: string,
      other: string;
    const ids: string[] = [],
      conversations: string[] = [];
    const full = (seats = 1) => ({
      vehicleType: "bus",
      route: {
        departureCity: "Dakar",
        arrivalCity: "Touba",
        stops: [
          {
            city: "Thiès",
            point: "Gare",
            arrivalTime: "00:30",
            nextDay: true,
            boarding: true,
          },
        ],
        rendezvous: [{ label: "Entrée", point: "Guichet" }],
      },
      schedule: {
        date: "2099-01-01",
        departureTime: "23:00",
        arrivalTime: "02:00",
        durationMinutes: 180,
        regular: false,
      },
      vehicle: { totalSeats: 5 },
      pricing: { availableSeats: seats, pricePerSeat: 3000, currency: "FCFA" },
      content: { title: "Voyage stock", description: "Description" },
      contactPreferences: { reservationRequestEnabled: true },
    });
    beforeAll(async () => {
      if (
        !url ||
        !new URL(url).pathname.endsWith("_test") ||
        !process.env.PRODUCTION_CLUSTER_ID
      )
        throw new Error("Isolated target required.");
      db = new PrismaClient({ datasources: { db: { url } }, log: [] });
      const rows: any[] = await db.$queryRawUnsafe(
        "SELECT system_identifier::text AS id FROM pg_control_system()",
      );
      if (rows[0].id === process.env.PRODUCTION_CLUSTER_ID)
        throw new Error("Production forbidden.");
      operations = new TripOccurrencesService(db as PrismaService);
      publication = new TripPublicationService(db as PrismaService);
      service = new TripsService(db as PrismaService);
      owner = (
        await db.user.create({
          data: { role: "transport_provider", status: "active" },
        })
      ).id;
      other = (
        await db.user.create({
          data: { role: "transport_provider", status: "active" },
        })
      ).id;
    });
    afterAll(async () => {
      if (db && owner) {
        await db.message.deleteMany({
          where: { conversationId: { in: conversations } },
        });
        await db.conversationParticipant.deleteMany({
          where: { conversationId: { in: conversations } },
        });
        await db.conversation.deleteMany({
          where: { id: { in: conversations } },
        });
        await db.contactEvent.deleteMany({ where: { targetId: { in: ids } } });
        await db.auditLog.deleteMany({
          where: { module: "trips", targetId: { in: ids } },
        });
        await db.tripSeatRequest.deleteMany({ where: { tripId: { in: ids } } });
        await db.tripOccurrence.deleteMany({ where: { tripId: { in: ids } } });
        await db.tripListing.deleteMany({ where: { id: { in: ids } } });
        await db.user.deleteMany({ where: { id: { in: [owner, other] } } });
      }
      await db?.$disconnect();
    });
    async function draft(input: any = full(), user = owner) {
      const row = await publication.create(user, {
        requestId: randomUUID(),
        publication: input,
      });
      ids.push(row.id);
      return row;
    }
    async function active(input: any = full(), user = owner) {
      const row = await draft(input, user);
      await publication.submit(user, row.id);
      await publication.moderate(user, row.id, { status: "active" });
      return {
        ...row,
        occurrences: await db.tripOccurrence.findMany({
          where: { tripId: row.id },
          orderBy: { departureAt: "asc" },
        }),
      };
    }
    const request = (trip: any, occurrenceId = trip.occurrences[0].id) =>
      service.createSeatRequest(trip.id, {
        occurrenceId,
        requestId: randomUUID(),
        clientName: "Voyageur",
        clientEmail: "client@example.test",
        requestedSeats: 1,
      });
    it("persists bounded recurring dates, skips exceptions, keeps stable IDs and overnight arrivals", async () => {
      const input = full(3),
        day = new Date("2099-01-01T00:00:00Z").getUTCDay();
      input.schedule = {
        ...input.schedule,
        regular: true,
        validUntil: "2099-01-15",
        weekdays: [day],
        intervalWeeks: 1,
        excludedDates: ["2099-01-08"],
      } as any;
      const row = await active(input);
      expect(
        row.occurrences.map((o) => o.serviceDate.toISOString().slice(0, 10)),
      ).toEqual(["2099-01-01", "2099-01-15"]);
      expect(row.occurrences[0].estimatedArrivalAt!.toISOString()).toBe(
        "2099-01-02T02:00:00.000Z",
      );
      await publication.moderate(owner, row.id, {
        status: "suspended",
        reason: "Contrôle",
      });
      await publication.moderate(owner, row.id, { status: "active" });
      expect(
        (
          await db.tripOccurrence.findMany({
            where: { tripId: row.id },
            orderBy: { departureAt: "asc" },
          })
        ).map((o) => o.id),
      ).toEqual(row.occurrences.map((o) => o.id));
      const resumed = await publication.findOwned(owner, row.id);
      expect(resumed.publication.route?.stops?.[0].city).toBe("Thiès");
      const result = await service.findPublic({
        page: 1,
        limit: 100,
        date: "2099-01-15",
        departureCity: "Dakar",
        arrivalCity: "Touba",
        passengers: 2,
        vehicleType: "bus",
      });
      expect(
        result.data.some((o) => o.occurrenceId === row.occurrences[1].id),
      ).toBe(true);
      await expect(request(row, "missing")).rejects.toMatchObject({
        status: 404,
      });
    });
    it("serializes two acceptances on the last place, rejects replay and releases exactly once", async () => {
      const row = await active(),
        a = await request(row),
        b = await request(row);
      const results = await Promise.allSettled([
        service.updateSeatRequestStatus(owner, a.id, { status: "accepted" }),
        service.updateSeatRequestStatus(owner, b.id, { status: "accepted" }),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(
        (results.find((r) => r.status === "rejected") as PromiseRejectedResult)
          .reason.status,
      ).toBe(409);
      const winner = (
        results.find(
          (r) => r.status === "fulfilled",
        ) as PromiseFulfilledResult<any>
      ).value;
      expect(
        (
          await db.tripOccurrence.findUniqueOrThrow({
            where: { id: row.occurrences[0].id },
          })
        ).remainingSeats,
      ).toBe(0);
      expect((await service.findPublicOne(row.id)).availableSeats).toBe(0);
      await expect(
        service.updateSeatRequestStatus(owner, winner.id, {
          status: "accepted",
        }),
      ).rejects.toMatchObject({ status: 409 });
      await expect(
        publication.update(owner, row.id, {
          publication: {
            ...full(),
            pricing: { availableSeats: 2, pricePerSeat: 3000 },
          },
        }),
      ).rejects.toMatchObject({ status: 409 });
      await expect(publication.softDelete(owner, row.id)).rejects.toMatchObject(
        { status: 409 },
      );
      await Promise.all([
        service.updateSeatRequestStatus(owner, winner.id, {
          status: "cancelled",
        }),
        service.updateSeatRequestStatus(owner, winner.id, {
          status: "cancelled",
        }),
      ]);
      const stock = await db.tripOccurrence.findUniqueOrThrow({
        where: { id: row.occurrences[0].id },
      });
      expect(stock.remainingSeats).toBe(1);
      expect(stock.confirmedSeats).toBe(0);
      expect(
        await db.auditLog.count({
          where: { targetId: row.id, action: "trip.request.accepted" },
        }),
      ).toBe(1);
      expect(
        await db.auditLog.count({
          where: { targetId: row.id, action: "trip.request.cancelled" },
        }),
      ).toBe(1);
    });
    it("deduplicates requests, refuses changing their occurrence and rejects an obsolete quote", async () => {
      const input = full(2);
      input.schedule = {
        ...input.schedule,
        regular: true,
        validUntil: "2099-01-08",
        weekdays: [new Date("2099-01-01T00:00:00Z").getUTCDay()],
      } as any;
      const row = await active(input);
      const dto = {
        requestId: randomUUID(),
        occurrenceId: row.occurrences[0].id,
        clientName: "Voyageur",
        clientEmail: "client@example.test",
        requestedSeats: 1,
      };
      const results = await Promise.all([
        service.createSeatRequest(row.id, dto),
        service.createSeatRequest(row.id, dto),
      ]);
      expect(results[0].id).toBe(results[1].id);
      expect(
        await db.contactEvent.count({
          where: { targetId: row.id, source: "seat_request" },
        }),
      ).toBe(1);
      await expect(
        service.createSeatRequest(row.id, {
          ...dto,
          occurrenceId: row.occurrences[1].id,
        }),
      ).rejects.toMatchObject({ status: 409 });
      input.pricing.pricePerSeat = 3500;
      await publication.update(owner, row.id, { publication: input });
      await publication.moderate(owner, row.id, { status: "active" });
      await expect(
        service.updateSeatRequestStatus(owner, results[0].id, {
          status: "accepted",
        }),
      ).rejects.toMatchObject({ status: 409 });
      input.schedule.departureTime = "22:00";
      input.schedule.durationMinutes = 240;
      await publication.update(owner, row.id, { publication: input });
      await publication.moderate(owner, row.id, { status: "active" });
      const previous = await db.tripOccurrence.findUniqueOrThrow({
        where: { id: row.occurrences[0].id },
      });
      expect(previous.cancelledAt).not.toBeNull();
      expect(
        (
          await db.tripSeatRequest.findUniqueOrThrow({
            where: { id: results[0].id },
          })
        ).status,
      ).toBe("cancelled");
      expect(
        await db.tripOccurrence.count({
          where: { tripId: row.id, cancelledAt: null },
        }),
      ).toBe(2);
    });
    it("does not release consumed stock on completion, and rejects database counter violations", async () => {
      const row = await active(),
        r = await request(row);
      await service.updateSeatRequestStatus(owner, r.id, {
        status: "accepted",
      });
      await expect(
        db.tripOccurrence.update({
          where: { id: row.occurrences[0].id },
          data: { remainingSeats: -1, confirmedSeats: 2 },
        }),
      ).rejects.toThrow();
      await db.tripOccurrence.update({
        where: { id: row.occurrences[0].id },
        data: {
          serviceDate: new Date("2000-01-01"),
          departureAt: new Date("2000-01-01T23:00:00Z"),
          estimatedArrivalAt: new Date("2000-01-02T02:00:00Z"),
        },
      });
      await service.updateSeatRequestStatus(owner, r.id, {
        status: "completed",
      });
      await expect(
        service.updateSeatRequestStatus(owner, r.id, { status: "cancelled" }),
      ).rejects.toMatchObject({ status: 409 });
      expect(
        (
          await db.tripOccurrence.findUniqueOrThrow({
            where: { id: row.occurrences[0].id },
          })
        ).remainingSeats,
      ).toBe(0);
    });
    it("makes occurrence cancellation idempotent and rejects cross-owner or cross-occurrence requests", async () => {
      const row = await active(full(2)),
        foreign = await active(full(), other),
        r = await request(row);
      await service.updateSeatRequestStatus(owner, r.id, {
        status: "accepted",
      });
      await expect(
        operations.cancel(other, row.id, row.occurrences[0].id, "Motif"),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        request(row, foreign.occurrences[0].id),
      ).rejects.toMatchObject({ status: 404 });
      await Promise.all([
        operations.cancel(owner, row.id, row.occurrences[0].id, "Annulation"),
        operations.cancel(owner, row.id, row.occurrences[0].id, "Annulation"),
      ]);
      expect(
        (await db.tripSeatRequest.findUniqueOrThrow({ where: { id: r.id } }))
          .status,
      ).toBe("cancelled");
      expect(
        (
          await db.tripOccurrence.findUniqueOrThrow({
            where: { id: row.occurrences[0].id },
          })
        ).remainingSeats,
      ).toBe(2);
      await expect(service.findPublicOne(row.id)).rejects.toMatchObject({
        status: 404,
      });
      expect(
        await db.auditLog.count({
          where: { targetId: row.id, action: "trip.occurrence.cancelled" },
        }),
      ).toBe(1);
    });
    it("keeps historical accepted requests unallocated and returns only the moderation reason to their owner", async () => {
      const row = await draft();
      await db.tripSeatRequest.create({
        data: { tripId: row.id, status: "accepted", requestedSeats: 1 },
      });
      await publication.submit(owner, row.id);
      await expect(
        publication.moderate(owner, row.id, { status: "active" }),
      ).rejects.toMatchObject({ status: 409 });
      await publication.moderate(owner, row.id, {
        status: "refused",
        reason: "Horaires à préciser",
      });
      const resumed = await publication.findOwned(owner, row.id);
      expect(resumed.moderationReason).toBe("Horaires à préciser");
      expect((resumed as any).auditLog).toBeUndefined();
      await expect(publication.findOwned(other, row.id)).rejects.toMatchObject({
        status: 404,
      });
      const historical = await db.tripSeatRequest.findFirstOrThrow({
        where: { tripId: row.id },
      });
      expect(historical.allocatedSeats).toBeNull();
      await service.updateSeatRequestStatus(owner, historical.id, {
        status: "cancelled",
      });
      expect(await db.tripOccurrence.count({ where: { tripId: row.id } })).toBe(
        0,
      );
    });
    it("scopes contacts, messages, idempotent replies and statistics to owned trips", async () => {
      const row = await active(full(2)),
        foreign = await active(full(), other);
      await request(row);
      await db.contactEvent.createMany({
        data: [
          {
            module: "trips",
            ownerUserId: owner,
            source: "phone",
            targetType: "listing",
            targetId: row.id,
          },
          {
            module: "trips",
            ownerUserId: owner,
            source: "phone",
            targetType: "listing",
            targetId: foreign.id,
          },
        ],
      });
      for (const trip of [row, foreign]) {
        const conv = await db.conversation.create({
          data: {
            module: "trips",
            targetType: "listing",
            targetId: trip.id,
            participants: { create: [{ userId: owner }, { userId: other }] },
            messages: {
              create: { senderUserId: other, body: "Question existante" },
            },
          },
        });
        conversations.push(conv.id);
      }
      const list = await service.conversations(owner, { page: 1, limit: 100 });
      expect(list.data.some((c) => c.targetId === foreign.id)).toBe(false);
      expect(list.data.some((c) => c.targetId === row.id)).toBe(true);
      const conv = list.data.find((c) => c.targetId === row.id)!;
      const api = new ConversationsService(db as PrismaService),
        dto = { body: "Réponse réelle", requestId: randomUUID() };
      await Promise.all([
        api.createMessage(conv.id, owner, dto),
        api.createMessage(conv.id, owner, dto),
      ]);
      expect(
        await db.message.count({
          where: { conversationId: conv.id, senderUserId: owner },
        }),
      ).toBe(1);
      expect(
        (await service.contacts(owner, { page: 1, limit: 100 })).data.some(
          (e) => e.targetId === foreign.id,
        ),
      ).toBe(false);
      const stats = await service.statistics(owner);
      expect(stats.totalRequests).toBeGreaterThan(0);
      expect(stats.directContacts).toBe(1);
      expect(stats.inboundMessages).toBe(1);
      expect(stats.unavailableMetrics).toContain("views");
    });
    it("paginates more than 100 owned trips without leaking another account", async () => {
      const data = Array.from({ length: 105 }, () => ({
        id: randomUUID(),
        ownerUserId: owner,
        slug: randomUUID(),
        title: "Pagination",
        vehicleType: "bus",
        departureCity: "Dakar",
        arrivalCity: "Touba",
      }));
      ids.push(...data.map((row) => row.id));
      await db.tripListing.createMany({ data });
      const first = await service.findMine(owner, { page: 1, limit: 100 }),
        second = await service.findMine(owner, { page: 2, limit: 100 });
      const unique = new Set(
        [...first.data, ...second.data].map((row) => row.id),
      );
      expect(unique.size).toBe(first.meta.total);
      expect(
        [...first.data, ...second.data].every(
          (row) => row.ownerUserId === owner,
        ),
      ).toBe(true);
      await db.tripSeatRequest.createMany({
        data: Array.from({ length: 105 }, () => ({
          tripId: data[0].id,
          requestedSeats: 1,
        })),
      });
      const requests1 = await service.findMySeatRequests(owner, {
        page: 1,
        limit: 100,
      });
      const requests2 = await service.findMySeatRequests(owner, {
        page: 2,
        limit: 100,
      });
      expect(
        new Set([...requests1.data, ...requests2.data].map((row) => row.id))
          .size,
      ).toBe(requests1.meta.total);
      expect(
        [...requests1.data, ...requests2.data].every((row) =>
          ids.includes(row.tripId),
        ),
      ).toBe(true);
    });
  },
);

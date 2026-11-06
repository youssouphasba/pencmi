import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import { PrismaService } from "../../database/prisma/prisma.service";
import { TripPublicationService } from "./trip-publication.service";
import { TripsService } from "./trips.service";

const url = process.env.TEST_DATABASE_URL;
(url ? describe : describe.skip)(
  "Trip publication on isolated PostgreSQL",
  () => {
    let prisma: PrismaClient,
      publication: TripPublicationService,
      service: TripsService,
      owner: string,
      other: string;
    const ids: string[] = [];
    const complete = () => ({
      vehicleType: "bus",
      route: {
        departureCity: "Dakar",
        arrivalCity: "Thiès",
        departurePoint: "Gare",
      },
      schedule: {
        date: "2099-01-01",
        departureTime: "23:00",
        arrivalTime: "01:00",
        regular: false,
      },
      vehicle: { totalSeats: 20 },
      pricing: { availableSeats: 10, pricePerSeat: 3000, currency: "FCFA" },
      content: { title: "Départ", description: "Description" },
      contactPreferences: { reservationRequestEnabled: true },
    });
    beforeAll(async () => {
      if (
        !url ||
        !new URL(url).pathname.endsWith("_test") ||
        !process.env.PRODUCTION_CLUSTER_ID
      )
        throw new Error("Explicit isolated test database required.");
      prisma = new PrismaClient({ datasources: { db: { url } }, log: [] });
      const rows: any[] = await prisma.$queryRawUnsafe(
        "SELECT system_identifier::text AS id FROM pg_control_system()",
      );
      if (rows[0].id === process.env.PRODUCTION_CLUSTER_ID)
        throw new Error("Production writes forbidden.");
      publication = new TripPublicationService(prisma as PrismaService);
      service = new TripsService(prisma as PrismaService);
      owner = (
        await prisma.user.create({
          data: { role: "transport_provider", status: "active" },
        })
      ).id;
      other = (
        await prisma.user.create({
          data: { role: "transport_provider", status: "active" },
        })
      ).id;
    });
    afterAll(async () => {
      if (prisma && owner) {
        await prisma.contactEvent.deleteMany({ where: { ownerUserId: owner } });
        await prisma.auditLog.deleteMany({
          where: { targetId: { in: ids }, module: "trips" },
        });
        await prisma.tripSeatRequest.deleteMany({
          where: { tripId: { in: ids } },
        });
        await prisma.tripOccurrence.deleteMany({
          where: { tripId: { in: ids } },
        });
        await prisma.tripListing.deleteMany({ where: { id: { in: ids } } });
        await prisma.user.deleteMany({ where: { id: { in: [owner, other] } } });
      }
      await prisma?.$disconnect();
    });
    const create = async (p: any = {}) => {
      const row = await publication.create(owner, {
        requestId: randomUUID(),
        publication: p,
      });
      ids.push(row.id);
      return row;
    };
    it("saves an incomplete draft concurrently, resumes it and updates without duplicates", async () => {
      const dto = {
        requestId: randomUUID(),
        publication: { content: { title: "Brouillon" } },
      };
      const rows = await Promise.all([
        publication.create(owner, dto),
        publication.create(owner, dto),
      ]);
      ids.push(rows[0].id);
      expect(rows[0].id).toBe(rows[1].id);
      expect(
        await prisma.tripListing.count({ where: { id: rows[0].id } }),
      ).toBe(1);
      expect(
        (await publication.findOwned(owner, rows[0].id)).publication.content
          ?.title,
      ).toBe("Brouillon");
      await publication.update(owner, rows[0].id, { publication: complete() });
      const resumed = await publication.findOwned(owner, rows[0].id);
      expect(resumed.pricePerSeat).toBe(3000);
      expect(resumed.departureTime).toBe("23:00");
      expect(resumed.publication.vehicle?.totalSeats).toBe(20);
    });
    it("enforces ownership, submission validation, pending_review and hidden drafts", async () => {
      const draft = await create();
      await expect(publication.findOwned(other, draft.id)).rejects.toThrow();
      await expect(
        publication.update(other, draft.id, { publication: complete() }),
      ).rejects.toThrow();
      await expect(publication.submit(owner, draft.id)).rejects.toThrow();
      await publication.update(owner, draft.id, { publication: complete() });
      expect((await publication.submit(owner, draft.id)).status).toBe(
        "pending_review",
      );
      await expect(service.findPublicOne(draft.id)).rejects.toThrow();
      await publication.moderate(owner, draft.id, { status: "active" });
      expect(
        await prisma.auditLog.count({
          where: { targetId: draft.id, action: "trip.active" },
        }),
      ).toBe(1);
      await expect(
        publication.moderate(owner, draft.id, { status: "active" }),
      ).rejects.toThrow();
      expect(
        (await service.findPublicOne(draft.id)).metadata.arrivalNextDay,
      ).toBe(true);
      await publication.update(owner, draft.id, {
        publication: {
          ...complete(),
          content: { title: "Modifié", description: "Description" },
        },
      });
      expect((await publication.findOwned(owner, draft.id)).status).toBe(
        "pending_review",
      );
    });
    it("filters the complete dataset before pagination and excludes past, suspended and deleted trips", async () => {
      const a = await create(complete()),
        b = await create({
          ...complete(),
          vehicleType: "minibus",
          pricing: { pricePerSeat: 9000, availableSeats: 1 },
        });
      for (const row of [a, b]) {
        await publication.submit(owner, row.id);
        await publication.moderate(owner, row.id, { status: "active" });
      }
      const result = await service.findPublic({
        page: 1,
        limit: 1,
        departureCity: "dakar",
        arrivalCity: "thiès",
        date: "2099-01-01",
        passengers: 3,
        minPrice: 2500,
        maxPrice: 4000,
        vehicleType: "bus",
        timeOfDay: "night",
      });
      expect(result.data.map((row) => row.id)).toContain(a.id);
      expect(result.meta.total).toBe(1);
      for (const data of [
        { departureDate: new Date("2000-01-01") },
        { status: "suspended" as const },
        { deletedAt: new Date() },
      ]) {
        await prisma.tripListing.update({ where: { id: a.id }, data });
        if ("departureDate" in data)
          await prisma.tripOccurrence.updateMany({
            where: { tripId: a.id },
            data: {
              departureAt: new Date("2000-01-01"),
              estimatedArrivalAt: null,
            },
          });
        await expect(service.findPublicOne(a.id)).rejects.toThrow();
      }
    });
    it("creates idempotent requests without changing declared seats, rejects conflicts and ineligible trips", async () => {
      const row = await create(complete());
      const dto = {
        occurrenceId: "pending-occurrence",
        requestId: randomUUID(),
        clientName: "Client test",
        clientEmail: "client@example.test",
        requestedSeats: 2,
      };
      await expect(service.createSeatRequest(row.id, dto)).rejects.toThrow();
      await publication.submit(owner, row.id);
      await publication.moderate(owner, row.id, { status: "active" });
      dto.occurrenceId = (
        await prisma.tripOccurrence.findFirstOrThrow({
          where: { tripId: row.id },
        })
      ).id;
      const requests = await Promise.all([
        service.createSeatRequest(row.id, dto),
        service.createSeatRequest(row.id, dto),
      ]);
      expect(requests[0].id).toBe(requests[1].id);
      expect(requests[0].status).toBe("new");
      expect(
        await prisma.tripSeatRequest.count({ where: { tripId: row.id } }),
      ).toBe(1);
      expect(
        (await prisma.tripListing.findUniqueOrThrow({ where: { id: row.id } }))
          .availableSeats,
      ).toBe(10);
      await expect(
        service.createSeatRequest(row.id, { ...dto, requestedSeats: 3 }),
      ).rejects.toThrow();
      await expect(
        service.createSeatRequest(row.id, {
          ...dto,
          requestId: randomUUID(),
          requestedSeats: 30,
        }),
      ).rejects.toThrow();
      await expect(
        service.updateSeatRequestStatus(other, requests[0].id, {
          status: "refused",
        }),
      ).rejects.toThrow();
      await publication.softDelete(owner, row.id);
      await expect(
        publication.update(owner, row.id, { publication: complete() }),
      ).rejects.toThrow();
      expect(
        await prisma.tripSeatRequest.count({ where: { tripId: row.id } }),
      ).toBe(1);
    });
  },
);

import { randomUUID } from "crypto";
import {
  validateTripPublication,
  validateTripSubmission,
  tripDeparture,
} from "./trip-publication.schema";
import { TripPublicationService } from "./trip-publication.service";
import { publicTrip, tripPublicWhere, TripsService } from "./trips.service";

export const completeTrip = () => ({
  vehicleType: "bus" as const,
  route: {
    departureCity: "Dakar",
    arrivalCity: "Thiès",
    departurePoint: "Gare",
    arrivalPoint: "Centre",
  },
  schedule: {
    date: "2099-01-01",
    departureTime: "23:00",
    arrivalTime: "01:00",
    regular: false as const,
  },
  vehicle: { totalSeats: 20, brand: "Marque" },
  pricing: {
    availableSeats: 10,
    pricePerSeat: 3000,
    currency: "FCFA" as const,
  },
  content: { title: "Départ de nuit", description: "Description réelle" },
  contactPreferences: { reservationRequestEnabled: true },
  conditions: ["Bagages acceptés"],
});
describe("Trip publication validation and isolation", () => {
  it("accepts an incomplete draft but refuses incomplete submission", () => {
    expect(validateTripPublication({})).toEqual({});
    expect(() => validateTripSubmission({})).toThrow();
    const incomplete = validateTripPublication({
      ...completeTrip(),
      contactPreferences: { phoneEnabled: true },
    });
    expect(() => validateTripSubmission(incomplete)).toThrow();
  });
  it("preserves a night departure and estimates arrival on the following day", () => {
    const p = validateTripPublication(completeTrip());
    expect(() => validateTripSubmission(p)).not.toThrow();
    expect(tripDeparture("2099-01-01", "23:00").toISOString()).toBe(
      "2099-01-01T23:00:00.000Z",
    );
    expect(
      publicTrip({ departureTime: "23:00", metadata: { publication: p } })
        .metadata.arrivalNextDay,
    ).toBe(true);
  });
  it.each([
    { status: "active" },
    { ownerUserId: "victim" },
    { slug: "forced" },
    { vehicle: { plate: "private" } },
    { schedule: { regular: true } },
    { pricing: { pricePerSeat: 1.5 } },
    { pricing: { availableSeats: 0 } },
    { vehicle: { totalSeats: 2 }, pricing: { availableSeats: 3 } },
    { schedule: { date: "2026-02-30" } },
    { schedule: { departureTime: "25:00" } },
    { contactPreferences: { phoneEnabled: true, phoneNumber: "1      " } },
    { contactPreferences: { emailNotificationsEnabled: true } },
  ])("refuses invalid or privileged input %j", (value) =>
    expect(() => validateTripPublication(value)).toThrow(),
  );
  it("refuses past departure, identical cities and zero fare on submission", () => {
    for (const value of [
      {
        ...completeTrip(),
        schedule: { date: "2000-01-01", departureTime: "09:00" },
      },
      {
        ...completeTrip(),
        route: { departureCity: "Dakar", arrivalCity: "dakar" },
      },
      { ...completeTrip(), pricing: { availableSeats: 10, pricePerSeat: 0 } },
    ])
      expect(() =>
        validateTripSubmission(validateTripPublication(value)),
      ).toThrow();
  });
  it("projects only explicit public fields and hides disabled contacts and internal metadata", () => {
    const row = publicTrip({
      id: "x",
      ownerUserId: "private",
      metadata: {
        private: "secret",
        publication: {
          ...completeTrip(),
          contactPreferences: {
            emailEnabled: false,
            contactEmail: "private@example.com",
            notificationEmail: "secret",
          },
          vehicle: { plate: "private" },
        },
      },
    });
    expect(JSON.stringify(row)).not.toMatch(/private|secret|plate|ownerUserId/);
  });
  it("builds every filter in the database query, including departures and legacy types", () => {
    const where = tripPublicWhere({
      departureCity: "Dakar",
      arrivalCity: "Thiès",
      vehicleType: "bus",
      date: "2099-01-01",
      minPrice: 0,
      maxPrice: 4000,
      passengers: 3,
      timeOfDay: "night",
      query: "Gare",
    });
    expect(where).toMatchObject({ status: "active", deletedAt: null });
    expect(JSON.stringify(where)).toContain("Bus");
    expect(JSON.stringify(where)).toContain("gte");
    expect((where.AND as unknown[]).length).toBe(10);
    expect(() => tripPublicWhere({ date: "2026-02-30" })).toThrow();
  });
  it("uses a stable server id for concurrent retries without overwriting saved data", async () => {
    const db: any = {
      tripListing: {
        upsert: jest.fn(async (args) => ({ ...args.create, status: "draft" })),
      },
    };
    const service = new TripPublicationService(db),
      dto = { requestId: randomUUID(), publication: {} };
    const [a, b] = await Promise.all([
      service.create("owner", dto),
      service.create("owner", dto),
    ]);
    expect(a.id).toBe(b.id);
    expect(db.tripListing.upsert.mock.calls[0][0].update).toEqual({});
    expect((await service.create("other", dto)).id).not.toBe(a.id);
  });
  it("refuses an unrelated owner and suspended modifications before writing", async () => {
    const update = jest.fn(),
      tx: any = {
        $queryRaw: jest.fn(),
        tripListing: { findFirst: jest.fn().mockResolvedValue(null), update },
      };
    const service = new TripPublicationService({
      $transaction: (fn: any) => fn(tx),
    } as any);
    await expect(
      service.update("other", "id", { publication: {} }),
    ).rejects.toThrow("introuvable");
    expect(update).not.toHaveBeenCalled();
    tx.tripListing.findFirst.mockResolvedValue({ status: "suspended" });
    await expect(
      service.update("owner", "id", { publication: {} }),
    ).rejects.toThrow("état");
    expect(update).not.toHaveBeenCalled();
  });
  it("refuses inactive trips and requests above declared capacity", async () => {
    const create = jest.fn(),
      tx: any = {
        $queryRaw: jest.fn(),
        tripListing: { findFirst: jest.fn().mockResolvedValue(null) },
        tripSeatRequest: { create },
      };
    const service = new TripsService({
      $transaction: (fn: any) => fn(tx),
    } as any);
    const dto = {
      requestId: randomUUID(),
      clientName: "Client",
      clientPhone: "+221771234567",
      requestedSeats: 5,
    };
    await expect(service.createSeatRequest("id", dto)).rejects.toThrow(
      "indisponible",
    );
    tx.tripListing.findFirst.mockResolvedValue({
      departureDate: new Date("2099-01-01"),
      departureTime: "10:00",
      availableSeats: 2,
    });
    await expect(service.createSeatRequest("id", dto)).rejects.toThrow(
      "places",
    );
    expect(create).not.toHaveBeenCalled();
  });
});

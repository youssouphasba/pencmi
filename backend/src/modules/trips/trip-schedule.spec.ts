import {
  tripArrivalAt,
  tripServiceDates,
  validateTripPublication,
  validateTripSubmission,
} from "./trip-publication.schema";

describe("Trip schedule boundaries in Africa/Dakar", () => {
  const schedule = (end: string) =>
    validateTripPublication({
      schedule: {
        date: "2096-01-01",
        departureTime: "23:00",
        regular: true,
        validUntil: end,
        weekdays: [0, 1, 2, 3, 4, 5, 6],
      },
    });
  it("materializes at most 90 inclusive dates across a leap day", () => {
    const dates = tripServiceDates(schedule("2096-03-30"));
    expect(dates).toHaveLength(90);
    expect(dates).toContain("2096-02-29");
    expect(dates.at(-1)).toBe("2096-03-30");
    expect(() => tripServiceDates(schedule("2096-03-31"))).toThrow();
  });
  it("applies week frequency and exceptions without inventing a departure", () => {
    const data = schedule("2096-01-29");
    data.schedule!.weekdays = [new Date("2096-01-01T00:00:00Z").getUTCDay()];
    data.schedule!.intervalWeeks = 2;
    data.schedule!.excludedDates = ["2096-01-15"];
    expect(tripServiceDates(data)).toEqual(["2096-01-01", "2096-01-29"]);
    data.schedule!.excludedDates.push("2096-01-01", "2096-01-29");
    expect(() => tripServiceDates(data)).toThrow();
    data.schedule!.excludedDates = ["2095-12-31"];
    expect(() => tripServiceDates(data)).toThrow();
  });
  it("calculates midnight and next-day arrivals without local timezone shifts", () => {
    const data = validateTripPublication({
      schedule: {
        date: "2096-02-29",
        departureTime: "23:00",
        arrivalTime: "01:00",
        durationMinutes: 120,
      },
    });
    expect(tripArrivalAt(data, "2096-02-29")!.toISOString()).toBe(
      "2096-03-01T01:00:00.000Z",
    );
    data.schedule!.durationMinutes = 180;
    expect(() => tripArrivalAt(data, "2096-02-29")).toThrow();
    data.schedule = { departureTime: "23:00", durationMinutes: 2880 };
    expect(tripArrivalAt(data, "2096-02-29")!.toISOString()).toBe(
      "2096-03-02T23:00:00.000Z",
    );
  });
  it("preserves incomplete structured stops in drafts but validates them at submission", () => {
    const data = validateTripPublication({
      vehicleType: "bus",
      route: { departureCity: "Dakar", arrivalCity: "Touba", stops: [{}] },
      schedule: {
        date: "2096-01-01",
        departureTime: "23:00",
        arrivalTime: "02:00",
      },
      vehicle: { totalSeats: 2 },
      pricing: { availableSeats: 2, pricePerSeat: 1000 },
      content: { title: "Départ", description: "Description" },
      contactPreferences: { reservationRequestEnabled: true },
    });
    expect(() => validateTripSubmission(data)).toThrow();
    data.route!.stops = [
      { city: "Thiès", arrivalTime: "00:30", nextDay: true },
      { city: "Diourbel", arrivalTime: "01:00", nextDay: true },
    ];
    expect(() => validateTripSubmission(data)).not.toThrow();
    data.route!.stops[1].arrivalTime = "00:00";
    expect(() => validateTripSubmission(data)).toThrow();
  });
});

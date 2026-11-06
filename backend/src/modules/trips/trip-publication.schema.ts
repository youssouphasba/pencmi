import { BadRequestException } from "@nestjs/common";
import { z } from "zod";

export const TRIP_TYPES = [
  "bus",
  "car",
  "minibus",
  "sept_places",
  "voiture_particuliere",
  "covoiturage",
  "vehicule_avec_chauffeur",
] as const;
export const TRIP_TYPE_ALIASES: Record<string, string> = {
  Bus: "bus",
  Car: "car",
  Minibus: "minibus",
  "7 places": "sept_places",
  "Véhicule 7 places": "sept_places",
  "Voiture particulière": "voiture_particuliere",
  Covoiturage: "covoiturage",
  "Véhicule avec chauffeur": "vehicule_avec_chauffeur",
  avec_chauffeur: "vehicule_avec_chauffeur",
};
export const canonicalTripType = (value: string) =>
  TRIP_TYPE_ALIASES[value] || value;
export const TRIP_PHONE_PATTERN =
  /^(?=(?:\D*\d){7,15}\D*$)\+?[1-9][\d ()-]{6,24}$/;
const text = (max = 200) => z.string().trim().max(max).optional();
const amount = z.number().int().min(0).max(2147483647).nullable().optional();
const seats = z.number().int().min(1).max(200).nullable().optional();
const flag = z.boolean().optional();
const time = z
  .union([z.literal(""), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)])
  .optional();
const date = z.union([z.literal(""), z.iso.date()]).optional();
export const tripPublicationSchema = z
  .object({
    vehicleType: z.enum(TRIP_TYPES).optional(),
    route: z
      .object({
        departureCity: text(150),
        arrivalCity: text(150),
        departurePoint: text(300),
        arrivalPoint: text(300),
        meetingPoints: text(2000),
        stops: z
          .array(
            z
              .object({
                city: text(150),
                point: text(300),
                arrivalTime: time,
                nextDay: flag,
                boarding: flag,
                alighting: flag,
              })
              .strict(),
          )
          .max(20)
          .optional(),
        rendezvous: z
          .array(
            z
              .object({
                label: text(200),
                point: text(300),
              })
              .strict(),
          )
          .max(20)
          .optional(),
        approximate: flag,
      })
      .strict()
      .optional(),
    schedule: z
      .object({
        date,
        departureTime: time,
        arrivalTime: time,
        arrivalNextDay: flag,
        regular: flag,
        validUntil: date,
        weekdays: z
          .array(z.number().int().min(0).max(6))
          .max(7)
          .refine((v) => new Set(v).size === v.length)
          .optional(),
        intervalWeeks: z.number().int().min(1).max(4).optional(),
        excludedDates: z
          .array(z.iso.date())
          .max(90)
          .refine((v) => new Set(v).size === v.length)
          .optional(),
        durationMinutes: z
          .number()
          .int()
          .min(1)
          .max(2880)
          .nullable()
          .optional(),
      })
      .strict()
      .optional(),
    vehicle: z
      .object({
        brand: text(100),
        model: text(100),
        totalSeats: seats,
        airConditioning: flag,
        passengerInfo: text(2000),
      })
      .strict()
      .optional(),
    pricing: z
      .object({
        availableSeats: seats,
        pricePerSeat: amount,
        luggageExtra: amount,
        luggageIncluded: flag,
        negotiable: flag,
        currency: z.literal("FCFA").optional(),
      })
      .strict()
      .optional(),
    conditions: z.array(z.string().trim().min(1).max(200)).max(30).optional(),
    content: z
      .object({
        title: text(200),
        description: text(6000),
        instructions: text(3000),
      })
      .strict()
      .optional(),
    contactPreferences: z
      .object({
        whatsappEnabled: flag,
        phoneEnabled: flag,
        emailEnabled: flag,
        whatsappNumber: text(30),
        phoneNumber: text(30),
        contactEmail: z.union([z.literal(""), z.email().max(254)]).optional(),
        reservationRequestEnabled: flag,
        internalMessagingEnabled: flag,
        contactFormEnabled: z.literal(false).optional(),
        emailNotificationsEnabled: z.literal(false).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export type TripPublication = z.infer<typeof tripPublicationSchema>;
export function validateTripPublication(value: unknown): TripPublication {
  const result = tripPublicationSchema.safeParse(value);
  if (!result.success)
    throw new BadRequestException({
      message: "Vérifiez les champs du trajet.",
      fields: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  const data = result.data,
    fields: { path: string; message: string }[] = [];
  if (
    data.pricing?.availableSeats &&
    data.vehicle?.totalSeats &&
    data.pricing.availableSeats > data.vehicle.totalSeats
  )
    fields.push({
      path: "pricing.availableSeats",
      message: "Les places proposées dépassent la capacité.",
    });
  for (const key of ["phoneNumber", "whatsappNumber"] as const) {
    if (
      data.contactPreferences?.[key] &&
      !TRIP_PHONE_PATTERN.test(data.contactPreferences[key] || "")
    )
      fields.push({
        path: `contactPreferences.${key}`,
        message: "Renseignez un numéro utilisable.",
      });
  }
  if (fields.length)
    throw new BadRequestException({
      message: "Vérifiez les champs du trajet.",
      fields,
    });
  return data;
}
export function tripDeparture(dateValue: string, timeValue: string) {
  return new Date(`${dateValue.slice(0, 10)}T${timeValue}:00Z`);
}
export const TRIP_DAY_MS = 86400000;
export function tripServiceDates(data: TripPublication): string[] {
  const s = data.schedule;
  if (!s?.date) return [];
  if (!s.regular) return [s.date];
  const start = new Date(`${s.date}T00:00:00Z`),
    end = new Date(`${s.validUntil}T00:00:00Z`);
  if (
    !s.validUntil ||
    !s.weekdays?.length ||
    !Number.isFinite(end.getTime()) ||
    end < start ||
    (end.getTime() - start.getTime()) / TRIP_DAY_MS >= 90
  )
    throw new BadRequestException({
      message: "Vérifiez la période de circulation (90 jours maximum).",
      fields: [
        {
          path: "schedule.validUntil",
          message: "Renseignez les jours et une période de 90 jours maximum.",
        },
      ],
    });
  if (s.excludedDates?.some((day) => day < s.date! || day > s.validUntil!))
    throw new BadRequestException({
      message: "Une exception est hors période.",
      fields: [
        {
          path: "schedule.excludedDates",
          message: "Les exceptions doivent appartenir à la période.",
        },
      ],
    });
  const dates: string[] = [];
  for (
    let day = start.getTime(), index = 0;
    day <= end.getTime();
    day += TRIP_DAY_MS, index++
  ) {
    const current = new Date(day),
      iso = current.toISOString().slice(0, 10);
    if (
      Math.floor(index / 7) % (s.intervalWeeks || 1) === 0 &&
      s.weekdays.includes(current.getUTCDay()) &&
      !s.excludedDates?.includes(iso)
    )
      dates.push(iso);
  }
  if (!dates.length)
    throw new BadRequestException({
      message: "Aucun départ dans cette période.",
      fields: [
        {
          path: "schedule.weekdays",
          message:
            "Choisissez au moins un jour de circulation dans la période.",
        },
      ],
    });
  return dates;
}
export function tripArrivalAt(
  data: TripPublication,
  serviceDate: string,
): Date | null {
  const s = data.schedule!;
  const departure = tripDeparture(serviceDate, s.departureTime!);
  if (!s.arrivalTime)
    return s.durationMinutes
      ? new Date(departure.getTime() + s.durationMinutes * 60000)
      : null;
  const arrival = tripDeparture(serviceDate, s.arrivalTime);
  if (s.arrivalNextDay || s.arrivalTime < s.departureTime!)
    arrival.setUTCDate(arrival.getUTCDate() + 1);
  if (
    arrival <= departure ||
    (s.durationMinutes &&
      arrival.getTime() - departure.getTime() !== s.durationMinutes * 60000)
  )
    throw new BadRequestException({
      message: "Arrivée et durée incohérentes.",
      fields: [
        {
          path: "schedule.arrivalTime",
          message: "Vérifiez l’arrivée, le lendemain et la durée.",
        },
      ],
    });
  return arrival;
}
export function validateTripSubmission(
  data: TripPublication,
  now = new Date(),
) {
  const fields: { path: string; message: string }[] = [];
  const required = (
    path: string,
    valid: unknown,
    message = "Ce champ est obligatoire.",
  ) => {
    if (!valid) fields.push({ path, message });
  };
  required("vehicleType", data.vehicleType);
  required("route.departureCity", data.route?.departureCity);
  required("route.arrivalCity", data.route?.arrivalCity);
  if (
    data.route?.departureCity &&
    data.route.arrivalCity &&
    data.route.departureCity.localeCompare(data.route.arrivalCity, "fr", {
      sensitivity: "base",
    }) === 0
  )
    fields.push({
      path: "route.arrivalCity",
      message: "Choisissez une autre ville d’arrivée.",
    });
  required("schedule.date", data.schedule?.date);
  required("schedule.departureTime", data.schedule?.departureTime);
  if (
    data.schedule?.date &&
    data.schedule.departureTime &&
    !data.schedule.regular
  )
    required(
      "schedule.date",
      tripDeparture(data.schedule.date, data.schedule.departureTime) > now,
      "Le départ doit être dans le futur.",
    );
  required("vehicle.totalSeats", data.vehicle?.totalSeats);
  required("pricing.availableSeats", data.pricing?.availableSeats);
  required(
    "pricing.pricePerSeat",
    (data.pricing?.pricePerSeat || 0) > 0,
    "Renseignez un prix positif en FCFA.",
  );
  required("content.title", data.content?.title);
  required("content.description", data.content?.description);
  for (const [index, stop] of (data.route?.stops || []).entries())
    required(
      `route.stops.${index}.city`,
      stop.city,
      "Renseignez la ville de cet arrêt.",
    );
  for (const [index, point] of (data.route?.rendezvous || []).entries()) {
    required(`route.rendezvous.${index}.label`, point.label);
    required(`route.rendezvous.${index}.point`, point.point);
  }
  const c = data.contactPreferences;
  if (c?.phoneEnabled)
    required(
      "contactPreferences.phoneNumber",
      c.phoneNumber && TRIP_PHONE_PATTERN.test(c.phoneNumber),
      "Renseignez un numéro utilisable.",
    );
  if (c?.whatsappEnabled)
    required(
      "contactPreferences.whatsappNumber",
      c.whatsappNumber && TRIP_PHONE_PATTERN.test(c.whatsappNumber),
      "Renseignez un numéro WhatsApp utilisable.",
    );
  if (c?.emailEnabled)
    required(
      "contactPreferences.contactEmail",
      c.contactEmail,
      "Renseignez un email de contact.",
    );
  required(
    "contactPreferences",
    c &&
      (c.phoneEnabled ||
        c.whatsappEnabled ||
        c.emailEnabled ||
        c.reservationRequestEnabled),
    "Activez un moyen de contact utilisable.",
  );
  if (fields.length)
    throw new BadRequestException({
      message: "Le trajet est incomplet.",
      fields,
    });
  const dates = tripServiceDates(data);
  if (
    !dates.some(
      (date) => tripDeparture(date, data.schedule!.departureTime!) > now,
    )
  )
    throw new BadRequestException({
      message: "Aucun départ futur.",
      fields: [
        {
          path: "schedule.validUntil",
          message: "La période doit contenir un départ futur.",
        },
      ],
    });
  const departure = tripDeparture(dates[0], data.schedule!.departureTime!);
  const arrival = tripArrivalAt(data, dates[0]);
  let previous = departure;
  for (const [index, stop] of (data.route?.stops || []).entries()) {
    if (!stop.arrivalTime) continue;
    const at = tripDeparture(dates[0], stop.arrivalTime);
    if (stop.nextDay) at.setUTCDate(at.getUTCDate() + 1);
    if (at < previous || (arrival && at > arrival))
      throw new BadRequestException({
        message: "Horaires des arrêts incohérents.",
        fields: [
          {
            path: `route.stops.${index}.arrivalTime`,
            message: "Respectez l’ordre des arrêts et le jour d’arrivée.",
          },
        ],
      });
    previous = at;
  }
}

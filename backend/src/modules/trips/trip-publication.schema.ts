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
        regular: z.literal(false).optional(),
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
        internalMessagingEnabled: z.literal(false).optional(),
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
  if (data.schedule?.date && data.schedule.departureTime)
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
}

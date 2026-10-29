import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

export const VEHICLE_PHOTO_LIMIT = 30;
export const VEHICLE_PHOTO_QUOTA = 150 * 1024 * 1024;
export const VEHICLE_MODES = ['sale', 'rental', 'chauffeur'] as const;
export const VEHICLE_DOCUMENT_LABELS = [
  'Carte grise',
  'Assurance',
  'Visite technique',
  'Dédouanement',
  'Carnet d’entretien',
  'Facture disponible',
] as const;
const text = (max = 200) => z.string().trim().max(max).optional();
const amount = z.number().int().min(0).max(2147483647).nullable().optional();
const flag = z.boolean().optional();
const email = z
  .union([z.literal(''), z.string().trim().email().max(254)])
  .optional();
export const vehiclePublicationSchema = z
  .object({
    vehicleMode: z.enum(VEHICLE_MODES).optional(),
    title: text(200),
    description: text(6000),
    metadata: z
      .object({
        identity: z
          .object({
            brand: text(100),
            model: text(100),
            version: text(100),
            year: z
              .number()
              .int()
              .min(1900)
              .max(new Date().getUTCFullYear() + 1)
              .nullable()
              .optional(),
          })
          .strict()
          .optional(),
        info: z
          .object({
            mileage: amount,
            fuel: text(60),
            gearbox: text(60),
            category: text(80),
            seats: z.number().int().min(1).max(100).nullable().optional(),
            color: text(80),
            condition: text(100),
            power: text(100),
          })
          .strict()
          .optional(),
        location: z
          .object({
            region: text(100),
            city: text(150),
            district: text(150),
            addressHint: text(500),
            approximate: flag,
          })
          .strict()
          .optional(),
        pricing: z
          .object({
            price: amount,
            negotiable: flag,
            pricePerDay: amount,
            pricePerWeek: amount,
            pricePerMonth: amount,
            deposit: amount,
            includedMileage: z
              .union([
                z.number().int().min(0).max(10000000),
                z.string().trim().max(200),
              ])
              .optional(),
            rentalConditions: text(4000),
            pricePerTrip: amount,
            chauffeurPriceUnit: z.enum(['trip', 'service']).optional(),
            coveredAreas: text(2000),
            serviceConditions: text(4000),
            currency: z.literal('FCFA').optional(),
          })
          .strict()
          .optional(),
        equipment: z
          .array(z.string().trim().min(1).max(100))
          .max(100)
          .optional(),
        documents: z.array(z.enum(VEHICLE_DOCUMENT_LABELS)).max(6).optional(),
        conditions: text(4000),
        contactPreferences: z
          .object({
            whatsappEnabled: flag,
            phoneEnabled: flag,
            emailEnabled: flag,
            internalMessagingEnabled: flag,
            contactFormEnabled: flag,
            emailNotificationsEnabled: flag,
            whatsappNumber: text(40),
            phoneNumber: text(40),
            contactEmail: email,
            notificationEmail: email,
          })
          .strict()
          .optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
export type VehiclePublication = z.infer<typeof vehiclePublicationSchema>;
export function validateVehiclePublication(value: unknown): VehiclePublication {
  const parsed = vehiclePublicationSchema.safeParse(value);
  if (!parsed.success)
    throw new BadRequestException({
      message: 'Vérifiez les informations du véhicule.',
      fields: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
  return parsed.data;
}
export function validateVehicleSubmission(data: VehiclePublication) {
  const fields: { path: string; message: string }[] = [];
  const require = (valid: unknown, path: string, message: string) => {
    if (!valid) fields.push({ path, message });
  };
  require(data.vehicleMode, 'vehicleMode', 'Choisissez le type d’annonce.');
  require(data.title, 'title', 'Renseignez le titre.');
  require(data.description, 'description', 'Décrivez le véhicule.');
  const metadata = data.metadata || {};
  for (const [key, label] of [
    ['brand', 'la marque'],
    ['model', 'le modèle'],
    ['year', 'l’année'],
  ] as const)
    require(metadata.identity?.[
      key
    ], `metadata.identity.${key}`, `Renseignez ${label}.`);
  for (const key of [
    'fuel',
    'gearbox',
    'category',
    'seats',
    'condition',
  ] as const)
    require(metadata.info?.[
      key
    ], `metadata.info.${key}`, 'Complétez les caractéristiques du véhicule.');
  require(metadata.location
    ?.city, 'metadata.location.city', 'Renseignez la ville.');
  const priceKey =
    data.vehicleMode === 'rental'
      ? 'pricePerDay'
      : data.vehicleMode === 'chauffeur'
        ? 'pricePerTrip'
        : 'price';
  require((metadata.pricing?.[priceKey] ?? 0) >
    0, `metadata.pricing.${priceKey}`, 'Renseignez un tarif positif en FCFA.');
  if (data.vehicleMode === 'chauffeur') {
    require(metadata.pricing
      ?.chauffeurPriceUnit, 'metadata.pricing.chauffeurPriceUnit', 'Précisez si le tarif est par trajet ou par service.');
    require(metadata.pricing
      ?.coveredAreas, 'metadata.pricing.coveredAreas', 'Renseignez les zones desservies.');
  }
  const contacts = metadata.contactPreferences || {};
  require(contacts.whatsappEnabled ||
    contacts.phoneEnabled ||
    contacts.emailEnabled ||
    contacts.contactFormEnabled, 'metadata.contactPreferences', 'Activez un téléphone, WhatsApp, un email ou le formulaire de contact.');
  for (const [enabled, key] of [
    ['whatsappEnabled', 'whatsappNumber'],
    ['phoneEnabled', 'phoneNumber'],
  ] as const)
    if (contacts[enabled])
      require(/^\+?\d{7,15}$/.test(
        (contacts[key] || '').replace(/[ ()-]/g, ''),
      ), `metadata.contactPreferences.${key}`, 'Renseignez un téléphone utilisable.');
  if (contacts.emailEnabled)
    require(contacts.contactEmail, 'metadata.contactPreferences.contactEmail', 'Renseignez l’email de contact.');
  if (contacts.emailNotificationsEnabled)
    require(contacts.notificationEmail, 'metadata.contactPreferences.notificationEmail', 'Renseignez l’email de notification.');
  if (fields.length)
    throw new BadRequestException({
      message: 'Complétez les champs requis avant la soumission.',
      fields,
    });
}

export function vehiclePrimaryPrice(
  mode: string,
  pricing: NonNullable<NonNullable<VehiclePublication['metadata']>['pricing']>,
) {
  return mode === 'sale'
    ? pricing.price
    : mode === 'rental'
      ? pricing.pricePerDay
      : mode === 'chauffeur'
        ? pricing.pricePerTrip
        : undefined;
}
